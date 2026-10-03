/**
 * Before / After Photo Comparison Component (Apple Style)
 */

import { store } from '../state.js';
import { renderEmptyPhotosSvg } from './svgs.js';

export function renderPhotoSlider(container, onAction) {
  const state = store.getState();
  const entriesWithPhotos = state.entries.filter(e => !!e.photo);

  if (entriesWithPhotos.length < 1) {
    container.innerHTML = `
      <div class="content-card">
        <div class="card-title-row">
          <h3 class="card-title">
            <i data-lucide="camera" style="color: var(--accent-primary);"></i>
            Visual Progress
          </h3>
        </div>
        <div class="empty-state">
          ${renderEmptyPhotosSvg()}
          <p style="font-size: 0.92rem; font-weight: 600; color: var(--text-primary); margin-top: 0.35rem;">No Photos Recorded</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 260px;">Attach check-in photos to your logs to compare transformations over time.</p>
          <button class="btn btn-secondary" id="btn-add-first-photo" style="margin-top: 0.5rem; font-size: 0.8rem;">
            <i data-lucide="camera"></i>
            <span>Log Check-in with Photo</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-add-first-photo')?.addEventListener('click', () => {
      onAction('open-log-modal');
    });
    return;
  }

  // If only 1 photo, use it as before and current
  const beforeEntry = entriesWithPhotos[0];
  const afterEntry = entriesWithPhotos.length > 1 ? entriesWithPhotos[entriesWithPhotos.length - 1] : beforeEntry;

  const beforeDate = new Date(beforeEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const afterDate = new Date(afterEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const beforeWeight = store.formatWeight(beforeEntry.weight);
  const afterWeight = store.formatWeight(afterEntry.weight);

  container.innerHTML = `
    <div class="content-card">
      <div class="card-title-row">
        <h3 class="card-title">
          <i data-lucide="camera" style="color: var(--accent-primary);"></i>
          Visual Progress
        </h3>
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">Drag to compare</span>
      </div>

      <div class="photo-split-wrapper" id="photo-split-container" data-no-sheet-drag>
        <!-- Before Image (Base background) -->
        <img class="split-image" src="${beforeEntry.photo}" alt="Before check-in" />
        <span class="split-badge before">${beforeDate} (${beforeWeight})</span>

        <!-- After Image (Clipped container) -->
        <div class="split-after-container" id="split-after-box" style="width: 50%;">
          <img class="split-image" id="split-after-img" src="${afterEntry.photo}" alt="After check-in" />
          <span class="split-badge after">${afterDate} (${afterWeight})</span>
        </div>

        <!-- Draggable Handle Divider -->
        <div class="split-handle" id="split-handle" style="left: 50%;">
          <div class="split-handle-btn">
            <i data-lucide="move-horizontal" style="width: 14px; height: 14px;"></i>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem;">
        <span style="color: var(--text-muted); font-family: var(--font-mono);">${entriesWithPhotos.length} check-in photos</span>
        <button class="btn btn-ghost" id="btn-snap-log" style="padding: 0.2rem 0.6rem; font-size: 0.78rem;">
          <i data-lucide="plus"></i>
          <span>Add Photo</span>
        </button>
      </div>
    </div>
  `;

  // Attach Draggable split slider logic
  const splitContainer = container.querySelector('#photo-split-container');
  const splitAfterBox = container.querySelector('#split-after-box');
  const splitHandle = container.querySelector('#split-handle');
  const splitAfterImg = container.querySelector('#split-after-img');

  if (splitContainer && splitAfterBox && splitHandle) {
    let isDragging = false;

    const setPosition = (clientX) => {
      const rect = splitContainer.getBoundingClientRect();
      let offsetX = clientX - rect.left;
      offsetX = Math.max(0, Math.min(rect.width, offsetX));
      const percentage = (offsetX / rect.width) * 100;

      splitAfterBox.style.width = `${percentage}%`;
      splitHandle.style.left = `${percentage}%`;
      if (splitAfterImg) {
        splitAfterImg.style.width = `${rect.width}px`;
      }
    };

    const updateImgWidth = () => {
      if (splitContainer && splitAfterImg) {
        splitAfterImg.style.width = `${splitContainer.offsetWidth}px`;
      }
    };
    updateImgWidth();
    window.addEventListener('resize', updateImgWidth);

    const onStart = (e) => {
      isDragging = true;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX) setPosition(clientX);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX) setPosition(clientX);
    };

    const onEnd = () => {
      isDragging = false;
    };

    splitContainer.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    splitContainer.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  container.querySelector('#btn-snap-log')?.addEventListener('click', () => {
    onAction('open-log-modal');
  });
}
