import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { triggerHaptic } from './android.js';
import { attachSheetGesture } from './components/sheetGesture.js';

/**
 * Zenith Native Camera & Progress Photo Architecture (Section 1.5)
 * - On-device pipeline: orientation fix, EXIF/GPS stripping via HTML5 Canvas
 * - Generates 1600px full JPEG (0.82) + 400px thumb (0.70)
 * - Stores in Directory.Data/photos/ to keep IndexedDB and localStorage lean
 * - Supports Camera, System Photo Library, and Browser fallback
 */

export const captureProgressPhoto = capturePhoto;

export async function capturePhoto(source = 'camera') {
  if (Capacitor.isNativePlatform()) {
    try {
      const shot = await Camera.getPhoto({
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 90,
        correctOrientation: true,
        allowEditing: false
      });
      const webPath = shot.webPath || Capacitor.convertFileSrc(shot.path);
      return processAndStore(webPath, { maxEdge: 1600 });
    } catch (err) {
      if (err.message && err.message.includes('User cancelled')) {
        return null;
      }
      console.warn('Camera capture error:', err);
      throw err;
    }
  } else {
    // Browser fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.capture = 'environment';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const objUrl = URL.createObjectURL(file);
        try {
          const res = await processAndStore(objUrl, { maxEdge: 1600 });
          URL.revokeObjectURL(objUrl);
          resolve(res);
        } catch (ex) {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        }
      };
      input.click();
    });
  }
}

async function processAndStore(src, { maxEdge = 1600, quality = 0.82 } = {}) {
  const img = await loadImage(src);
  const full = await drawToBlob(img, maxEdge, quality); // Re-encoding strips EXIF & GPS
  const thumb = await drawToBlob(img, 400, 0.70);
  const fullBase64 = await blobToBase64(full.blob);
  const thumbBase64 = await blobToBase64(thumb.blob);
  const id = crypto.randomUUID ? crypto.randomUUID() : 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const photoPath = `photos/${id}.jpg`;
  const thumbPath = `photos/${id}_t.jpg`;

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: photoPath,
        data: fullBase64,
        directory: Directory.Data,
        recursive: true
      });
      await Filesystem.writeFile({
        path: thumbPath,
        data: thumbBase64,
        directory: Directory.Data,
        recursive: true
      });
    } catch (fsErr) {
      console.warn('Filesystem write error, falling back:', fsErr);
    }
  }

  // Generate web accessible preview url
  const displayUrl = full.blobUrl;

  return {
    id,
    photoPath,
    thumbPath,
    displayUrl,
    photoUri: displayUrl,
    thumbUri: thumb.blobUrl,
    base64: fullBase64,
    width: full.w,
    height: full.h,
    bytes: full.blob.size
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawToBlob(img, maxEdge, q) {
  const s = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise((resolve) => {
    c.toBlob((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      resolve({ blob, blobUrl, w, h });
    }, 'image/jpeg', q);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function photoUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) {
    return path;
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    } catch (e) {
      return path;
    }
  }
  return path;
}

export async function deletePhoto(path) {
  if (!path) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch (e) {
      // Ignored if file doesn't exist
    }
  }
}

/**
 * Universal Photo Action Sheet
 * "Take photo", "Choose from library", "Remove photo"
 */
export function openPhotoActionSheet({ onCamera, onGallery, onRemove, hasExisting = false }) {
  triggerHaptic('light');
  const existing = document.getElementById('photo-action-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'photo-action-sheet';
  sheet.className = 'modal-backdrop';
  sheet.innerHTML = `
    <div class="modal-dialog photo-action-dialog" style="max-width: 400px; padding: 1rem 1.25rem 1.75rem; border-radius: 24px 24px 0 0; background: var(--bg-surface-elevated); box-shadow: var(--shadow-sheet);">
      <div class="sheet-handle" id="photo-sheet-grabber" style="margin-bottom: 0.75rem;"></div>
      <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 1rem; text-align: center; color: var(--text-primary);">Check-in Photo</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button type="button" class="btn btn-secondary action-sheet-btn" id="act-camera" style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; height: 56px; border-radius: var(--radius-md); padding: 0 16px; border: 1px solid var(--border-subtle); background: var(--bg-surface);">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(48, 209, 88, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="camera" style="width: 20px; height: 20px; color: var(--accent-primary);"></i>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
            <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">Take photo</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">Use device camera to snap a new photo</span>
          </div>
        </button>

        <button type="button" class="btn btn-secondary action-sheet-btn" id="act-gallery" style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; height: 56px; border-radius: var(--radius-md); padding: 0 16px; border: 1px solid var(--border-subtle); background: var(--bg-surface);">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="image" style="width: 20px; height: 20px; color: var(--text-primary);"></i>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
            <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">Choose from gallery</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">Select from your photo library</span>
          </div>
        </button>

        ${hasExisting ? `
          <button type="button" class="btn btn-secondary action-sheet-btn" id="act-remove" style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; height: 56px; border-radius: var(--radius-md); padding: 0 16px; border: 1px solid rgba(255, 69, 58, 0.25); background: var(--bg-surface);">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 69, 58, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i data-lucide="trash-2" style="width: 20px; height: 20px; color: var(--color-error);"></i>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
              <span style="font-weight: 600; font-size: 0.95rem; color: var(--color-error);">Remove photo</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary);">Delete current check-in photo</span>
            </div>
          </button>
        ` : ''}

        <button type="button" class="btn btn-ghost action-sheet-btn" id="act-cancel" style="height: 48px; margin-top: 6px; border-radius: var(--radius-md); font-weight: 600; color: var(--text-secondary); background: transparent;">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(sheet);
  if (window.lucide) window.lucide.createIcons();
  requestAnimationFrame(() => sheet.classList.add('open'));

  const dialog = sheet.querySelector('.photo-action-dialog');
  const grabber = sheet.querySelector('#photo-sheet-grabber');

  let closed = false;
  let detachGesture = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (detachGesture) detachGesture();
    sheet.classList.remove('open');
    setTimeout(() => sheet.remove(), 250);
  };

  detachGesture = attachSheetGesture(dialog, {
    handle: grabber,
    onClose: close
  });

  sheet.querySelector('#act-camera')?.addEventListener('click', () => {
    close();
    onCamera?.();
  });
  sheet.querySelector('#act-gallery')?.addEventListener('click', () => {
    close();
    onGallery?.();
  });
  sheet.querySelector('#act-remove')?.addEventListener('click', () => {
    close();
    onRemove?.();
  });
  sheet.querySelector('#act-cancel')?.addEventListener('click', close);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });
}
