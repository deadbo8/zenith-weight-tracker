/**
 * Zenith Modals & Sheets System (Apple & Android Ergonomics)
 * - Single close path: ModalManager.close(id, { reason, force })
 * - Swipe-down to dismiss via attachSheetGesture on all sheets and modals
 * - Precision Log Weight Sheet with Horizontal Ruler Dial (0.1 ticks, needle, edge fade mask)
 * - Standardized 2-column FieldNumber grid for Body Fat & Waist (Section 1.4)
 * - Direct Camera & Photo Library architecture with canvas EXIF stripping (Section 1.5)
 * - Unsaved changes guard (isDirty -> "Discard changes?" snackbar)
 * - Pill-shaped bottom Snackbar with inline "Undo" action
 */

import confetti from 'canvas-confetti';
import { store } from '../state.js';
import {
  BADGES_REGISTRY,
  calculateKPIs,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  getHealthyWeightRange,
  toLocalDateString
} from '../analytics.js';
import { renderBadgeCrestSvg, renderBmiGaugeSvg } from './svgs.js';
import { triggerHaptic } from '../android.js';
import { createRulerDial } from './rulerDial.js';
import { attachSheetGesture } from './sheetGesture.js';
import { createFieldNumber } from './fieldNumber.js';
import { capturePhoto, openPhotoActionSheet, photoUrl, deletePhoto } from '../camera.js';
import { isNum, fmt, fmtInt, fmtDelta } from '../format.js';

export class ModalManager {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.openModals = new Map(); // id -> { id, element, isDirty, teardown, teardownBack }
    this.initSnackbarContainer();
  }

  initSnackbarContainer() {
    let container = document.getElementById('snackbar-mount');
    if (!container) {
      container = document.createElement('div');
      container.id = 'snackbar-mount';
      container.className = 'snackbar-container';
      document.body.appendChild(container);
    }
    this.snackbarContainer = container;
  }

  showSnackbar(message, actionText = null, actionCallback = null, duration = 4000) {
    if (!this.snackbarContainer) this.initSnackbarContainer();

    // Clear previous snackbars to prevent stacking
    this.snackbarContainer.innerHTML = '';

    const snackbar = document.createElement('div');
    snackbar.className = 'snackbar-pill';
    snackbar.innerHTML = `
      <span class="snackbar-msg">${message}</span>
      ${actionText ? `<button class="snackbar-action" id="snackbar-action-btn">${actionText}</button>` : ''}
    `;

    this.snackbarContainer.appendChild(snackbar);

    if (actionText && actionCallback) {
      snackbar.querySelector('#snackbar-action-btn')?.addEventListener('click', () => {
        triggerHaptic('success');
        actionCallback();
        snackbar.classList.add('dismissing');
        setTimeout(() => snackbar.remove(), 200);
      });
    }

    const timer = setTimeout(() => {
      snackbar.classList.add('dismissing');
      setTimeout(() => snackbar.remove(), 200);
    }, duration);

    snackbar.addEventListener('click', (e) => {
      if (e.target.id !== 'snackbar-action-btn') {
        clearTimeout(timer);
        snackbar.classList.add('dismissing');
        setTimeout(() => snackbar.remove(), 200);
      }
    });
  }

  showToast(message, icon = 'check-circle') {
    this.showSnackbar(message);
  }

  triggerConfetti() {
    try {
      confetti({
        particleCount: 50,
        spread: 55,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }

  setupBackButton(closeFn) {
    document.body.classList.add('modal-open');
    window.history.pushState({ modalOpen: true }, '');
    let closed = false;
    const onPop = () => {
      if (!closed) {
        closed = true;
        closeFn(false);
        this.checkUnlockScroll();
      }
    };
    window.addEventListener('popstate', onPop, { once: true });
    return (popHistory = true) => {
      if (!closed) {
        closed = true;
        window.removeEventListener('popstate', onPop);
        if (popHistory && window.history.state?.modalOpen) {
          window.history.back();
        }
        this.checkUnlockScroll();
      }
    };
  }

  checkUnlockScroll() {
    setTimeout(() => {
      const openModals = document.querySelectorAll('.modal-backdrop.open');
      if (openModals.length === 0) {
        document.body.classList.remove('modal-open');
      }
    }, 120);
  }

  registerModal(id, config) {
    this.openModals.set(id, { id, ...config });
  }

  /**
   * Single close path for all sheets & modals (Section 1.2)
   */
  close(id, { reason = 'programmatic', force = false, popHistory = true } = {}) {
    const modalInfo = id ? this.openModals.get(id) : Array.from(this.openModals.values()).pop();
    if (!modalInfo) {
      const el = id ? document.getElementById(id) : document.querySelector('.modal-backdrop.open');
      if (el) {
        el.classList.remove('open');
        setTimeout(() => el.remove(), 250);
        this.checkUnlockScroll();
      }
      return true;
    }

    // Check unsaved changes if not forced
    if (!force && modalInfo.isDirty && modalInfo.isDirty()) {
      triggerHaptic('warning');
      this.showSnackbar('Discard changes?', 'Discard', () => {
        this.close(modalInfo.id, { reason, force: true, popHistory });
      });
      return false;
    }

    if (modalInfo.teardown) {
      try { modalInfo.teardown(); } catch (e) {}
    }

    if (modalInfo.element) {
      modalInfo.element.classList.remove('open');
      setTimeout(() => {
        modalInfo.element.remove();
        this.checkUnlockScroll();
      }, 250);
    }

    if (modalInfo.teardownBack) {
      modalInfo.teardownBack(popHistory);
    }

    this.openModals.delete(modalInfo.id);
    triggerHaptic('light');
    return true;
  }

  removeExistingModal(id) {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
      this.openModals.delete(id);
    }
  }

  // -------------------------------------------------------------
  // 1. Log / Edit Weigh-in Sheet (Ruler Dial + FieldNumber Grid)
  // -------------------------------------------------------------
  openLogModal(existingEntry = null) {
    const isEdit = !!existingEntry;
    const state = store.getState();
    const unit = state.profile.unit || 'kg';
    const isImperial = unit === 'lbs';
    const lengthUnit = isImperial ? 'in' : 'cm';

    // Find previous weight for context
    const sortedChronological = [...state.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    let prevEntry = null;
    if (existingEntry) {
      const idx = sortedChronological.findIndex(e => e.id === existingEntry.id);
      if (idx > 0) prevEntry = sortedChronological[idx - 1];
    } else if (sortedChronological.length > 0) {
      prevEntry = sortedChronological[sortedChronological.length - 1];
    }

    const defaultWeightKg = existingEntry
      ? existingEntry.weight
      : (prevEntry ? prevEntry.weight : (state.profile.startWeight || 75));

    let currentDisplayWeight = store.toDisplayWeight(defaultWeightKg);
    const prevDisplayWeight = prevEntry ? store.toDisplayWeight(prevEntry.weight) : currentDisplayWeight;

    const initialDisplayWeight = currentDisplayWeight;
    const initialMood = existingEntry ? (existingEntry.mood || 'normal') : 'normal';
    const initialNotes = existingEntry?.notes || '';
    const initialFat = existingEntry?.bodyFat != null ? existingEntry.bodyFat : null;
    const initialWaistCm = existingEntry?.waist != null ? existingEntry.waist : null;
    const initialWaistDisplay = initialWaistCm != null
      ? (isImperial ? Math.round((initialWaistCm / 2.54) * 10) / 10 : initialWaistCm)
      : null;
    let currentPhotoData = existingEntry?.photo || null;
    const initialPhoto = currentPhotoData;

    const dateVal = existingEntry
      ? existingEntry.date.slice(0, 16)
      : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    let selectedMood = initialMood;
    let isDetailsExpanded = isEdit || false;

    const modalId = 'modal-log-entry';
    this.removeExistingModal(modalId);

    const modalWrapper = document.createElement('div');
    modalWrapper.id = modalId;
    modalWrapper.className = 'modal-backdrop';

    // Live delta calculation (neutral gray for away from goal, never red)
    const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);
    const getDiffText = (currentVal) => {
      if (!prevEntry) return 'First weigh-in baseline';
      const diff = Math.round((currentVal - prevDisplayWeight) * 10) / 10;
      if (diff === 0) return 'Same as yesterday';
      const sign = diff > 0 ? '+' : '';
      return `${sign}${diff.toFixed(1)} ${unit} vs yesterday`;
    };

    modalWrapper.innerHTML = `
      <div class="modal-dialog log-sheet-dialog">
        <div class="sheet-handle" id="log-sheet-grabber"></div>

        <div class="modal-header">
          <button type="button" class="btn btn-ghost close-modal" id="btn-cancel-log" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Cancel</button>
          <h3 class="modal-title">
            ${isEdit ? 'Edit Check-in' : 'Log Weight'}
          </h3>
          <button type="button" class="btn btn-primary" id="btn-save-log" style="padding: 0.35rem 0.9rem; font-size: 0.85rem; font-weight: 600;">
            ${isEdit ? 'Done' : 'Save'}
          </button>
        </div>

        <div class="modal-body sheet-scroller" style="padding-bottom: 2rem;">
          <!-- Numeric Hero Stepper -->
          <div class="weight-hero-input">
            <div class="weight-input-container">
              <input type="text" inputmode="decimal" class="weight-huge-input mono-num" id="log-weight-input" value="${currentDisplayWeight.toFixed(1)}" />
              <span class="weight-huge-unit">${unit}</span>
            </div>

            <!-- Live Context Delta beneath number -->
            <div class="weight-live-context" id="weight-live-diff">${getDiffText(currentDisplayWeight)}</div>

            <!-- Precision Horizontal Ruler Dial (Apple Instrument, Section 1.1) -->
            <div id="ruler-dial-mount" data-no-sheet-drag></div>

            <!-- Stepper Adjustment Pills with Accelerating Repeat -->
            <div class="adjuster-pills" style="margin-top: 10px;">
              <button type="button" class="adjuster-btn" data-step="-1.0">-1.0</button>
              <button type="button" class="adjuster-btn" data-step="-0.5">-0.5</button>
              <button type="button" class="adjuster-btn" data-step="-0.1">-0.1</button>
              <button type="button" class="adjuster-btn" data-step="+0.1">+0.1</button>
              <button type="button" class="adjuster-btn" data-step="+0.5">+0.5</button>
              <button type="button" class="adjuster-btn" data-step="+1.0">+1.0</button>
            </div>
          </div>

          <!-- Quick Date Chip & Condition Tags -->
          <div class="quick-log-row">
            <div class="date-chips-group">
              <button type="button" class="date-quick-chip active" id="chip-date-today">Today</button>
              <button type="button" class="date-quick-chip" id="chip-date-yesterday">Yesterday</button>
            </div>
          </div>

          <!-- Condition Tags (Apple Minimalist Pills) -->
          <div class="form-group" style="margin-top: 0.75rem;">
            <label class="form-label" style="font-size: 0.76rem; color: var(--text-secondary);">Condition</label>
            <div class="tag-grid" id="mood-tags-container">
              <button type="button" class="tag-btn ${selectedMood === 'fasted' ? 'active' : ''}" data-mood="fasted">Fasted</button>
              <button type="button" class="tag-btn ${selectedMood === 'energetic' ? 'active' : ''}" data-mood="energetic">Energetic</button>
              <button type="button" class="tag-btn ${selectedMood === 'post_workout' ? 'active' : ''}" data-mood="post_workout">Post-Workout</button>
              <button type="button" class="tag-btn ${selectedMood === 'normal' ? 'active' : ''}" data-mood="normal">Normal</button>
              <button type="button" class="tag-btn ${selectedMood === 'cheat_day' ? 'active' : ''}" data-mood="cheat_day">Refeed</button>
              <button type="button" class="tag-btn ${selectedMood === 'heavy' ? 'active' : ''}" data-mood="heavy">Water Retained</button>
            </div>
          </div>

          <!-- Progressive Disclosure Toggle ("More Details") -->
          <div class="disclosure-row">
            <button type="button" class="btn-disclosure" id="btn-toggle-details">
              <span id="disclosure-text">${isDetailsExpanded ? 'Fewer details' : 'More details (body fat, waist, notes, photo)'}</span>
              <i data-lucide="${isDetailsExpanded ? 'chevron-up' : 'chevron-down'}" id="disclosure-icon"></i>
            </button>
          </div>

          <!-- Progressive Disclosure Body -->
          <div id="progressive-details-container" style="display: ${isDetailsExpanded ? 'block' : 'none'};">
            <!-- Full Date & Time Picker -->
            <div class="form-group">
              <label class="form-label" for="log-date-input">Date & Time</label>
              <input type="datetime-local" class="form-input" id="log-date-input" value="${dateVal}" />
            </div>

            <!-- Standardized 2-column FieldNumber grid (Section 1.4) -->
            <div class="field-grid" id="field-grid-mount"></div>

            <!-- Notes -->
            <div class="form-group">
              <label class="form-label" for="log-notes-input">Notes</label>
              <textarea class="form-input form-textarea" id="log-notes-input" placeholder="Optional notes...">${initialNotes}</textarea>
            </div>

            <!-- Progress Photo (Camera & Filesystem, Section 1.5) -->
            <div class="form-group">
              <label class="form-label">Progress Photo</label>
              <div id="photo-upload-container"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => modalWrapper.classList.add('open'));

    const weightInput = modalWrapper.querySelector('#log-weight-input');
    const diffTextEl = modalWrapper.querySelector('#weight-live-diff');

    // Create 2-column FieldNumbers (Section 1.4)
    const fieldGridMount = modalWrapper.querySelector('#field-grid-mount');
    const fatField = createFieldNumber({
      id: 'log-fat-input',
      label: 'Body Fat',
      unit: '%',
      min: 2,
      max: 60,
      decimals: 1,
      value: initialFat
    });
    const waistMin = isImperial ? 12 : 30;
    const waistMax = isImperial ? 100 : 250;
    const waistField = createFieldNumber({
      id: 'log-waist-input',
      label: 'Waist',
      unit: lengthUnit,
      min: waistMin,
      max: waistMax,
      decimals: 1,
      value: initialWaistDisplay
    });
    fieldGridMount.appendChild(fatField.element);
    fieldGridMount.appendChild(waistField.element);

    // Mount Ruler Dial (Section 1.1)
    const rulerMount = modalWrapper.querySelector('#ruler-dial-mount');
    let rulerApi = null;
    if (rulerMount) {
      rulerApi = createRulerDial({
        mount: rulerMount,
        value: currentDisplayWeight,
        span: 25,
        reference: prevEntry ? prevDisplayWeight : null,
        unitLabel: unit,
        onChange: (newVal) => {
          updateWeight(newVal, true, false);
        },
        onTick: () => triggerHaptic('selection')
      });
    }

    const updateWeight = (newVal, updateInput = true, syncRuler = true) => {
      newVal = Math.round(newVal * 10) / 10;
      currentDisplayWeight = newVal;
      if (updateInput && weightInput) weightInput.value = newVal.toFixed(1);
      if (diffTextEl) diffTextEl.textContent = getDiffText(newVal);
      if (syncRuler && rulerApi) rulerApi.setValue(newVal, { smooth: true });
    };

    weightInput?.addEventListener('input', () => {
      const cleaned = weightInput.value.replace(',', '.');
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 0) {
        updateWeight(val, false, true);
      }
    });

    // Stepper buttons with accelerating repeat
    modalWrapper.querySelectorAll('.adjuster-btn').forEach(btn => {
      let timer = null;
      let interval = null;
      const step = parseFloat(btn.getAttribute('data-step'));

      const applyStep = () => {
        triggerHaptic('light');
        let val = currentDisplayWeight || 0;
        val = Math.round((val + step) * 10) / 10;
        updateWeight(val, true, true);
      };

      btn.addEventListener('click', applyStep);

      const startRepeat = () => {
        timer = setTimeout(() => {
          interval = setInterval(applyStep, 70);
        }, 300);
      };

      const stopRepeat = () => {
        clearTimeout(timer);
        clearInterval(interval);
      };

      btn.addEventListener('mousedown', startRepeat);
      btn.addEventListener('mouseup', stopRepeat);
      btn.addEventListener('mouseleave', stopRepeat);
      btn.addEventListener('touchstart', startRepeat, { passive: true });
      btn.addEventListener('touchend', stopRepeat);
    });

    // Date chips
    const chipToday = modalWrapper.querySelector('#chip-date-today');
    const chipYesterday = modalWrapper.querySelector('#chip-date-yesterday');
    const dateInput = modalWrapper.querySelector('#log-date-input');

    chipToday?.addEventListener('click', () => {
      triggerHaptic('light');
      chipToday.classList.add('active');
      chipYesterday.classList.remove('active');
      const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      if (dateInput) dateInput.value = now;
    });

    chipYesterday?.addEventListener('click', () => {
      triggerHaptic('light');
      chipYesterday.classList.add('active');
      chipToday.classList.remove('active');
      const yest = new Date(Date.now() - 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      if (dateInput) dateInput.value = yest;
    });

    // Condition tags
    modalWrapper.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        modalWrapper.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMood = btn.getAttribute('data-mood');
      });
    });

    // Progressive disclosure
    const btnToggle = modalWrapper.querySelector('#btn-toggle-details');
    const detailsContainer = modalWrapper.querySelector('#progressive-details-container');
    const disclosureText = modalWrapper.querySelector('#disclosure-text');
    const disclosureIcon = modalWrapper.querySelector('#disclosure-icon');

    btnToggle?.addEventListener('click', () => {
      triggerHaptic('light');
      isDetailsExpanded = !isDetailsExpanded;
      if (detailsContainer) detailsContainer.style.display = isDetailsExpanded ? 'block' : 'none';
      if (disclosureText) disclosureText.textContent = isDetailsExpanded ? 'Fewer details' : 'More details (body fat, waist, notes, photo)';
      if (disclosureIcon) disclosureIcon.setAttribute('data-lucide', isDetailsExpanded ? 'chevron-up' : 'chevron-down');
      if (window.lucide) window.lucide.createIcons();
    });

    // Photo Component (Native Camera + Filesystem, Section 1.5)
    const photoContainer = modalWrapper.querySelector('#photo-upload-container');
    const renderPhotoUI = async () => {
      if (currentPhotoData) {
        const displaySrc = await photoUrl(currentPhotoData);
        photoContainer.innerHTML = `
          <div class="photo-preview-box">
            <img src="${displaySrc}" class="photo-preview-img" />
            <button type="button" class="remove-photo-btn" id="btn-photo-action" title="Change photo">
              <i data-lucide="more-horizontal"></i>
            </button>
          </div>
        `;
      } else {
        photoContainer.innerHTML = `
          <div class="upload-dropzone" id="dropzone-area">
            <i data-lucide="camera" style="width: 22px; height: 22px; color: var(--text-muted);"></i>
            <span style="font-weight: 500; font-size: 0.8rem; color: var(--text-secondary);">Add check-in photo</span>
          </div>
        `;
      }
      if (window.lucide) window.lucide.createIcons();

      photoContainer.querySelector('#dropzone-area')?.addEventListener('click', () => {
        openPhotoActionSheet({
          hasExisting: false,
          onCamera: async () => {
            const photo = await capturePhoto('camera');
            if (photo) {
              currentPhotoData = photo.photoPath || photo.displayUrl;
              renderPhotoUI();
            }
          },
          onGallery: async () => {
            const photo = await capturePhoto('gallery');
            if (photo) {
              currentPhotoData = photo.photoPath || photo.displayUrl;
              renderPhotoUI();
            }
          }
        });
      });

      photoContainer.querySelector('#btn-photo-action')?.addEventListener('click', () => {
        openPhotoActionSheet({
          hasExisting: true,
          onCamera: async () => {
            const photo = await capturePhoto('camera');
            if (photo) {
              currentPhotoData = photo.photoPath || photo.displayUrl;
              renderPhotoUI();
            }
          },
          onGallery: async () => {
            const photo = await capturePhoto('gallery');
            if (photo) {
              currentPhotoData = photo.photoPath || photo.displayUrl;
              renderPhotoUI();
            }
          },
          onRemove: () => {
            currentPhotoData = null;
            renderPhotoUI();
          }
        });
      });
    };
    renderPhotoUI();

    // Check unsaved changes (isDirty)
    const isDirty = () => {
      const notesVal = modalWrapper.querySelector('#log-notes-input')?.value || '';
      const fatVal = fatField.getValue();
      const waistVal = waistField.getValue();
      const weightDiff = Math.abs(currentDisplayWeight - initialDisplayWeight) > 0.05;
      const notesDiff = notesVal !== initialNotes;
      const moodDiff = selectedMood !== initialMood;
      const fatDiff = fatVal !== initialFat;
      const waistDiff = waistVal !== initialWaistDisplay;
      const photoDiff = currentPhotoData !== initialPhoto;
      return weightDiff || notesDiff || moodDiff || fatDiff || waistDiff || photoDiff;
    };

    // Attach Swipe-Down gesture (Section 1.2)
    const sheetDialog = modalWrapper.querySelector('.modal-dialog');
    const grabber = modalWrapper.querySelector('#log-sheet-grabber');
    const scroller = modalWrapper.querySelector('.modal-body');
    const detachGesture = attachSheetGesture(sheetDialog, {
      handle: grabber,
      scroller,
      onClose: () => this.close(modalId, { reason: 'swipe' }),
      isDirty: () => isDirty(),
      onDirtyDismiss: () => {
        this.showSnackbar('Discard changes?', 'Discard', () => {
          this.close(modalId, { force: true });
        });
      }
    });

    const teardownBack = this.setupBackButton(() => this.close(modalId, { reason: 'back' }));

    this.registerModal(modalId, {
      element: modalWrapper,
      isDirty,
      teardown: () => {
        detachGesture?.();
        rulerApi?.destroy();
      },
      teardownBack
    });

    // Close buttons & scrim tap
    modalWrapper.querySelector('#btn-cancel-log')?.addEventListener('click', () => {
      this.close(modalId, { reason: 'cancel' });
    });

    modalWrapper.addEventListener('click', (e) => {
      if (e.target === modalWrapper) {
        this.close(modalId, { reason: 'scrim' });
      }
    });

    // Save logic
    modalWrapper.querySelector('#btn-save-log')?.addEventListener('click', () => {
      if (!isNum(currentDisplayWeight) || currentDisplayWeight <= 0) {
        this.showSnackbar('Please enter a valid weight');
        triggerHaptic('warning');
        return;
      }

      triggerHaptic('success');
      const weightKg = store.toStorageWeight(currentDisplayWeight);
      const dateStr = modalWrapper.querySelector('#log-date-input')?.value;
      const bodyFat = fatField.getValue();
      let waist = waistField.getValue();
      if (isImperial && waist != null) {
        waist = Math.round(waist * 2.54 * 10) / 10; // Convert inches to cm for storage
      }
      const notes = modalWrapper.querySelector('#log-notes-input')?.value || '';

      const payload = {
        date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        weight: weightKg,
        bodyFat,
        waist,
        mood: selectedMood,
        notes,
        photo: currentPhotoData
      };

      if (isEdit) {
        store.updateEntry(existingEntry.id, payload);
        this.showSnackbar('Check-in updated');
      } else {
        store.addEntry(payload);
        this.showSnackbar(`Logged ${store.formatWeight(weightKg)}`);

        // Check if all-time low
        const minPrevious = state.entries.length ? Math.min(...state.entries.map(e => e.weight)) : Infinity;
        if (weightKg < minPrevious) {
          this.triggerConfetti();
          this.showSnackbar('New all-time low reached');
        }
      }

      this.checkAndNotifyBadges();
      this.close(modalId, { force: true });
    });
  }

  // -------------------------------------------------------------
  // 2. Settings Sheet
  // -------------------------------------------------------------
  openSettingsModal() {
    const modalId = 'modal-settings';
    this.removeExistingModal(modalId);

    const state = store.getState();
    const p = state.profile;
    const unit = p.unit || 'kg';
    const headlineMode = p.headlineDisplay || 'trend';

    const modalWrapper = document.createElement('div');
    modalWrapper.id = modalId;
    modalWrapper.className = 'modal-backdrop';

    modalWrapper.innerHTML = `
      <div class="modal-dialog">
        <div class="sheet-handle" id="settings-grabber"></div>

        <div class="modal-header">
          <button type="button" class="btn btn-ghost close-modal" id="btn-cancel-settings" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Cancel</button>
          <h3 class="modal-title">Settings</h3>
          <button type="button" class="btn btn-primary" id="btn-save-settings" style="padding: 0.35rem 0.9rem; font-size: 0.85rem; font-weight: 600;">Save</button>
        </div>

        <div class="modal-body sheet-scroller" style="padding-bottom: 2.5rem;">
          <!-- Section 1: Units & Preferences -->
          <div class="settings-section">
            <span class="settings-section-title">Display & Units</span>
            <div class="settings-group-card">
              <div class="settings-row">
                <div>
                  <div class="settings-row-label">Weight Unit</div>
                  <div class="settings-row-sub">Kilograms or Pounds</div>
                </div>
                <div class="segmented-control" id="settings-unit-toggle">
                  <button type="button" class="segment-btn ${unit === 'kg' ? 'active' : ''}" data-unit="kg">KG</button>
                  <button type="button" class="segment-btn ${unit === 'lbs' ? 'active' : ''}" data-unit="lbs">LB</button>
                </div>
              </div>

              <div class="settings-row">
                <div>
                  <div class="settings-row-label">Today Headline</div>
                  <div class="settings-row-sub">Focus on smoothed trend or raw scale</div>
                </div>
                <div class="segmented-control" id="settings-headline-toggle">
                  <button type="button" class="segment-btn ${headlineMode === 'trend' ? 'active' : ''}" data-headline="trend">Trend</button>
                  <button type="button" class="segment-btn ${headlineMode === 'scale' ? 'active' : ''}" data-headline="scale">Scale</button>
                </div>
              </div>

              <div class="settings-row">
                <div>
                  <div class="settings-row-label">Appearance</div>
                  <div class="settings-row-sub">OLED dark, classic dark, or light</div>
                </div>
                <div class="segmented-control" id="settings-theme-toggle">
                  <button type="button" class="segment-btn ${p.theme === 'dark' || !p.theme ? 'active' : ''}" data-theme="dark">Dark</button>
                  <button type="button" class="segment-btn ${p.theme === 'light' ? 'active' : ''}" data-theme="light">Light</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Profile & Targets -->
          <div class="settings-section">
            <span class="settings-section-title">Profile & Targets</span>
            <div class="settings-group-card">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="form-group">
                  <label class="form-label" for="set-name">Name</label>
                  <input type="text" class="form-input" id="set-name" value="${p.name || ''}" placeholder="Your name" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-gender">Gender</label>
                  <select class="select-field" id="set-gender" style="width: 100%;">
                    <option value="male" ${p.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${p.gender === 'female' ? 'selected' : ''}>Female</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
                <div class="form-group">
                  <label class="form-label" for="set-height">Height (cm)</label>
                  <input type="number" class="form-input mono-num" id="set-height" value="${p.height || 175}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-age">Age</label>
                  <input type="number" class="form-input mono-num" id="set-age" value="${p.age || 28}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
                <div class="form-group">
                  <label class="form-label" for="set-start-weight">Start (${unit})</label>
                  <input type="number" step="0.1" class="form-input mono-num" id="set-start-weight" value="${store.toDisplayWeight(p.startWeight) || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-goal-weight">Goal (${unit})</label>
                  <input type="number" step="0.1" class="form-input mono-num" id="set-goal-weight" value="${store.toDisplayWeight(p.goalWeight) || ''}" />
                </div>
              </div>

              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label" for="set-target-date">Target Date</label>
                <input type="date" class="form-input" id="set-target-date" value="${p.targetDate || ''}" />
              </div>

              <div class="form-group" style="margin-top: 0.5rem;">
                <label class="form-label" for="set-activity">Activity Level</label>
                <select class="select-field" id="set-activity" style="width: 100%;">
                  <option value="sedentary" ${p.activityLevel === 'sedentary' ? 'selected' : ''}>Sedentary (Desk work)</option>
                  <option value="light" ${p.activityLevel === 'light' ? 'selected' : ''}>Light (Exercise 1-3 days/wk)</option>
                  <option value="moderate" ${p.activityLevel === 'moderate' ? 'selected' : ''}>Moderate (Exercise 3-5 days/wk)</option>
                  <option value="active" ${p.activityLevel === 'active' ? 'selected' : ''}>Active (Workouts 6-7 days/wk)</option>
                  <option value="very_active" ${p.activityLevel === 'very_active' ? 'selected' : ''}>Athlete (2x training/day)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Section 3: Data & Backup -->
          <div class="settings-section">
            <span class="settings-section-title">Data & Portability</span>
            <div class="settings-group-card">
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary" id="btn-export-json" style="font-size: 0.82rem;">
                  <i data-lucide="download"></i>
                  <span>Backup JSON</span>
                </button>
                <button type="button" class="btn btn-secondary" id="btn-trigger-import" style="font-size: 0.82rem;">
                  <i data-lucide="upload"></i>
                  <span>Restore JSON</span>
                </button>
                <input type="file" id="file-import-json" accept=".json" style="display: none;" />
                <button type="button" class="btn btn-secondary" id="btn-export-csv-settings" style="font-size: 0.82rem;">
                  <i data-lucide="file-spreadsheet"></i>
                  <span>Export CSV</span>
                </button>
                <button type="button" class="btn btn-secondary" id="btn-load-sample-settings" style="font-size: 0.82rem;">
                  <i data-lucide="sparkles"></i>
                  <span>Sample Data</span>
                </button>
              </div>

              <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 0.85rem; font-weight: 500; color: var(--color-error);">Clear All History</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">Permanently erases all recorded check-ins</div>
                </div>
                <button type="button" class="btn btn-ghost" id="btn-clear-data" style="color: var(--color-error); font-size: 0.8rem;">
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => modalWrapper.classList.add('open'));

    // Attach sheet gesture
    const sheetDialog = modalWrapper.querySelector('.modal-dialog');
    const grabber = modalWrapper.querySelector('#settings-grabber');
    const scroller = modalWrapper.querySelector('.modal-body');
    const detachGesture = attachSheetGesture(sheetDialog, {
      handle: grabber,
      scroller,
      onClose: () => this.close(modalId, { reason: 'swipe' })
    });

    const teardownBack = this.setupBackButton(() => this.close(modalId, { reason: 'back' }));

    this.registerModal(modalId, {
      element: modalWrapper,
      teardown: () => detachGesture?.(),
      teardownBack
    });

    modalWrapper.querySelector('#btn-cancel-settings')?.addEventListener('click', () => {
      this.close(modalId, { reason: 'cancel' });
    });

    modalWrapper.addEventListener('click', (e) => {
      if (e.target === modalWrapper) this.close(modalId, { reason: 'scrim' });
    });

    // Unit toggle buttons
    let selectedUnit = unit;
    modalWrapper.querySelectorAll('#settings-unit-toggle .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic('selection');
        modalWrapper.querySelectorAll('#settings-unit-toggle .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedUnit = btn.dataset.unit;
      });
    });

    // Headline mode toggle
    let selectedHeadline = headlineMode;
    modalWrapper.querySelectorAll('#settings-headline-toggle .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic('selection');
        modalWrapper.querySelectorAll('#settings-headline-toggle .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedHeadline = btn.dataset.headline;
      });
    });

    // Theme toggle
    let selectedTheme = p.theme || 'dark';
    modalWrapper.querySelectorAll('#settings-theme-toggle .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic('selection');
        modalWrapper.querySelectorAll('#settings-theme-toggle .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTheme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', selectedTheme);
      });
    });

    modalWrapper.querySelector('#btn-export-json')?.addEventListener('click', () => {
      store.exportJSON();
      this.showSnackbar('Backup downloaded');
    });

    modalWrapper.querySelector('#btn-export-csv-settings')?.addEventListener('click', () => {
      store.exportCSV();
      this.showSnackbar('CSV exported');
    });

    modalWrapper.querySelector('#btn-load-sample-settings')?.addEventListener('click', () => {
      store.loadSampleData();
      this.triggerConfetti();
      this.showSnackbar('60 days of sample data loaded');
      this.close(modalId, { force: true });
    });

    const fileImport = modalWrapper.querySelector('#file-import-json');
    modalWrapper.querySelector('#btn-trigger-import')?.addEventListener('click', () => fileImport?.click());
    fileImport?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const res = store.importJSON(ev.target.result);
          if (res.success) {
            this.showSnackbar('Data restored successfully');
            this.close(modalId, { force: true });
          } else {
            this.showSnackbar('Import error: ' + (res.error || 'Invalid file'));
            triggerHaptic('warning');
          }
        };
        reader.readAsText(file);
      }
    });

    const clearBtn = modalWrapper.querySelector('#btn-clear-data');
    let clearArmed = false;
    clearBtn?.addEventListener('click', () => {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.textContent = 'Tap again to confirm wipe';
        triggerHaptic('warning');
        setTimeout(() => {
          clearArmed = false;
          if (clearBtn) clearBtn.textContent = 'Clear All';
        }, 3500);
      } else {
        triggerHaptic('heavy');
        store.clearAllData();
        this.showSnackbar('All data cleared');
        this.close(modalId, { force: true });
      }
    });

    modalWrapper.querySelector('#btn-save-settings')?.addEventListener('click', () => {
      const name = modalWrapper.querySelector('#set-name').value;
      const gender = modalWrapper.querySelector('#set-gender').value;
      const height = parseFloat(modalWrapper.querySelector('#set-height').value) || 175;
      const age = parseInt(modalWrapper.querySelector('#set-age').value) || 28;
      const startWeightInput = parseFloat(modalWrapper.querySelector('#set-start-weight').value);
      const goalWeightInput = parseFloat(modalWrapper.querySelector('#set-goal-weight').value);
      const targetDate = modalWrapper.querySelector('#set-target-date').value;
      const activityLevel = modalWrapper.querySelector('#set-activity').value;

      store.setProfile({
        name,
        gender,
        height,
        age,
        startWeight: store.toStorageWeight(startWeightInput),
        goalWeight: store.toStorageWeight(goalWeightInput),
        targetDate,
        activityLevel,
        unit: selectedUnit,
        headlineDisplay: selectedHeadline,
        theme: selectedTheme
      });

      triggerHaptic('success');
      this.showSnackbar('Settings saved');
      this.close(modalId, { force: true });
    });
  }

  // -------------------------------------------------------------
  // 3. Health & Calorie Intelligence Modal (Section 1.3 Safe Values)
  // -------------------------------------------------------------
  openCalculatorModal() {
    const modalId = 'modal-calculators';
    this.removeExistingModal(modalId);

    const state = store.getState();
    const p = state.profile;
    const latestWeight = state.entries.length ? state.entries[state.entries.length - 1].weight : (p.startWeight || 75);

    const bmr = calculateBMR(latestWeight, p.height, p.age, p.gender);
    const tdee = calculateTDEE(latestWeight, p.height, p.age, p.gender, p.activityLevel);
    const healthyRange = getHealthyWeightRange(p.height);
    const bmi = calculateBMI(latestWeight, p.height);

    const mildLoss = isNum(tdee) ? tdee - 300 : null;
    const optimalLoss = isNum(tdee) ? tdee - 500 : null;
    const leanBulk = isNum(tdee) ? tdee + 300 : null;

    const proteinGrams = isNum(latestWeight) ? Math.round(latestWeight * 2.0) : null;
    const fatGrams = isNum(optimalLoss) ? Math.round((optimalLoss * 0.25) / 9) : null;
    const carbGrams = isNum(optimalLoss) && isNum(proteinGrams) && isNum(fatGrams)
      ? Math.round((optimalLoss - (proteinGrams * 4 + fatGrams * 9)) / 4)
      : null;

    const modalWrapper = document.createElement('div');
    modalWrapper.id = modalId;
    modalWrapper.className = 'modal-backdrop';

    modalWrapper.innerHTML = `
      <div class="modal-dialog">
        <div class="sheet-handle" id="calc-grabber"></div>

        <div class="modal-header">
          <button type="button" class="btn btn-ghost close-modal" id="btn-done-calc" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Done</button>
          <h3 class="modal-title">Metabolic Target</h3>
          <span style="width: 48px;"></span>
        </div>

        <div class="modal-body sheet-scroller" style="padding-bottom: 2.5rem;">
          <div class="calc-results-grid">
            <div class="calc-kpi-box">
              <span style="font-size: 0.68rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Basal Metabolic Rate</span>
              <div style="font-size: 1.6rem; font-weight: 600; color: var(--text-primary); margin: 0.2rem 0;" class="mono-num">${fmtInt(bmr)} <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">kcal</span></div>
              <p style="font-size: 0.72rem; color: var(--text-secondary);">Resting baseline expenditure.</p>
            </div>

            <div class="calc-kpi-box">
              <span style="font-size: 0.68rem; text-transform: uppercase; color: var(--accent-primary); font-weight: 600;">Maintenance (TDEE)</span>
              <div style="font-size: 1.6rem; font-weight: 600; color: var(--accent-primary); margin: 0.2rem 0;" class="mono-num">${fmtInt(tdee)} <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">kcal</span></div>
              <p style="font-size: 0.72rem; color: var(--text-secondary);">${p.activityLevel || 'moderate'} activity.</p>
            </div>
          </div>

          <!-- Goal Intake Targets -->
          <div style="margin-top: 1rem;">
            <span style="font-size: 0.72rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">Intake Targets</span>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary);">
                <div>
                  <strong style="font-size: 0.85rem;">Optimal Fat Loss</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">-500 kcal deficit (~0.5 kg/wk)</div>
                </div>
                <div class="mono-num" style="font-weight: 600; font-size: 1rem; color: var(--accent-primary);">${fmtInt(optimalLoss)} kcal</div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border-left: 3px solid var(--color-neutral);">
                <div>
                  <strong style="font-size: 0.85rem;">Mild Deficit</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">-300 kcal deficit (~0.3 kg/wk)</div>
                </div>
                <div class="mono-num" style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${fmtInt(mildLoss)} kcal</div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border-left: 3px solid var(--color-neutral);">
                <div>
                  <strong style="font-size: 0.85rem;">Lean Muscle Surplus</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">+300 kcal surplus (+0.25 kg/wk)</div>
                </div>
                <div class="mono-num" style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${fmtInt(leanBulk)} kcal</div>
              </div>
            </div>
          </div>

          <!-- Macros -->
          <div style="background: var(--bg-surface-elevated); padding: 0.85rem; border-radius: var(--radius-md); margin-top: 1rem;">
            <span style="font-size: 0.75rem; font-weight: 600;">Daily Macronutrients (${fmtInt(optimalLoss)} kcal)</span>
            <div class="macro-split-bar" style="margin: 0.5rem 0;">
              <div class="macro-protein" style="width: 35%;"></div>
              <div class="macro-carbs" style="width: 40%;"></div>
              <div class="macro-fats" style="width: 25%;"></div>
            </div>
            <div class="macro-legend">
              <span>Protein: <strong class="mono-num">${fmtInt(proteinGrams)}g</strong></span>
              <span>Carbs: <strong class="mono-num">${fmtInt(carbGrams)}g</strong></span>
              <span>Fats: <strong class="mono-num">${fmtInt(fatGrams)}g</strong></span>
            </div>
          </div>

          <!-- BMI -->
          <div style="background: var(--bg-surface-elevated); padding: 0.85rem; border-radius: var(--radius-md); margin-top: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.35rem;">
              <span>Body Mass Index (BMI)</span>
              <span class="mono-num" style="color: var(--accent-primary);">${fmt(bmi)}</span>
            </div>
            ${isNum(bmi) ? renderBmiGaugeSvg(bmi) : '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 6px 0;">Add your height and weigh-in to display gauge</div>'}
          </div>

          <!-- Healthy Weight Range -->
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.75rem 0.85rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); margin-top: 0.75rem;">
            <span style="color: var(--text-secondary);">Healthy weight range (${p.height || 175}cm):</span>
            <strong class="mono-num" style="color: var(--text-primary);">${store.formatWeight(healthyRange.min)} – ${store.formatWeight(healthyRange.max)}</strong>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => modalWrapper.classList.add('open'));

    // Attach sheet gesture
    const sheetDialog = modalWrapper.querySelector('.modal-dialog');
    const grabber = modalWrapper.querySelector('#calc-grabber');
    const scroller = modalWrapper.querySelector('.modal-body');
    const detachGesture = attachSheetGesture(sheetDialog, {
      handle: grabber,
      scroller,
      onClose: () => this.close(modalId, { reason: 'swipe' })
    });

    const teardownBack = this.setupBackButton(() => this.close(modalId, { reason: 'back' }));

    this.registerModal(modalId, {
      element: modalWrapper,
      teardown: () => detachGesture?.(),
      teardownBack
    });

    modalWrapper.querySelector('#btn-done-calc')?.addEventListener('click', () => {
      this.close(modalId, { reason: 'done' });
    });

    modalWrapper.addEventListener('click', (e) => {
      if (e.target === modalWrapper) this.close(modalId, { reason: 'scrim' });
    });
  }

  // -------------------------------------------------------------
  // 4. Achievements / Trophy Room Modal
  // -------------------------------------------------------------
  openBadgesModal() {
    const modalId = 'modal-badges';
    this.removeExistingModal(modalId);

    const state = store.getState();
    const unlocked = new Set(state.unlockedBadges);

    const modalWrapper = document.createElement('div');
    modalWrapper.id = modalId;
    modalWrapper.className = 'modal-backdrop';

    modalWrapper.innerHTML = `
      <div class="modal-dialog">
        <div class="sheet-handle" id="badges-grabber"></div>

        <div class="modal-header">
          <button type="button" class="btn btn-ghost close-modal" id="btn-done-badges" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Done</button>
          <h3 class="modal-title">Awards & Milestones (${unlocked.size}/${BADGES_REGISTRY.length})</h3>
          <span style="width: 48px;"></span>
        </div>

        <div class="modal-body sheet-scroller" style="padding-bottom: 2.5rem;">
          <div class="achievements-grid">
            ${BADGES_REGISTRY.map(badge => {
              const isUnlocked = unlocked.has(badge.id);
              return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                  <div class="achievement-icon-wrapper" style="background: transparent;">
                    ${renderBadgeCrestSvg(badge.id, isUnlocked)}
                  </div>
                  <div class="achievement-name">${badge.name}</div>
                  <div class="achievement-desc">${badge.description}</div>
                  ${isUnlocked ? '<div class="achievement-date">Unlocked</div>' : '<div class="achievement-hint">Locked</div>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => modalWrapper.classList.add('open'));

    // Attach sheet gesture
    const sheetDialog = modalWrapper.querySelector('.modal-dialog');
    const grabber = modalWrapper.querySelector('#badges-grabber');
    const scroller = modalWrapper.querySelector('.modal-body');
    const detachGesture = attachSheetGesture(sheetDialog, {
      handle: grabber,
      scroller,
      onClose: () => this.close(modalId, { reason: 'swipe' })
    });

    const teardownBack = this.setupBackButton(() => this.close(modalId, { reason: 'back' }));

    this.registerModal(modalId, {
      element: modalWrapper,
      teardown: () => detachGesture?.(),
      teardownBack
    });

    modalWrapper.querySelector('#btn-done-badges')?.addEventListener('click', () => {
      this.close(modalId, { reason: 'done' });
    });

    modalWrapper.addEventListener('click', (e) => {
      if (e.target === modalWrapper) this.close(modalId, { reason: 'scrim' });
    });
  }

  // -------------------------------------------------------------
  // 5. Photo Lightbox Modal
  // -------------------------------------------------------------
  async openPhotoLightbox(entry) {
    const modalId = 'modal-photo-lightbox';
    this.removeExistingModal(modalId);

    const dateStr = new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const weightStr = store.formatWeight(entry.weight);
    const photoSrc = await photoUrl(entry.photo);

    const modalWrapper = document.createElement('div');
    modalWrapper.id = modalId;
    modalWrapper.className = 'modal-backdrop';

    modalWrapper.innerHTML = `
      <div class="modal-dialog" style="max-width: 540px; padding: 0; background: #000000; border-color: rgba(255,255,255,0.15);">
        <div style="position: relative; width: 100%; height: 440px; background: #000000; display: flex; align-items: center; justify-content: center;">
          <img src="${photoSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          <button type="button" class="action-icon-btn close-modal" id="btn-close-lightbox" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: #fff;">
            <i data-lucide="x"></i>
          </button>
          <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 1.25rem; background: linear-gradient(0deg, rgba(0,0,0,0.9), transparent); color: #ffffff;">
            <div style="font-size: 1.2rem; font-weight: 600;" class="mono-num">${weightStr}</div>
            <div style="font-size: 0.8rem; color: rgba(235, 235, 245, 0.7);">${dateStr}</div>
            ${entry.notes ? `<div style="font-size: 0.78rem; margin-top: 0.35rem; color: rgba(255,255,255,0.9);">${entry.notes}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => modalWrapper.classList.add('open'));

    const sheetDialog = modalWrapper.querySelector('.modal-dialog');
    const detachGesture = attachSheetGesture(sheetDialog, {
      scroller: null,
      onClose: () => this.close(modalId, { reason: 'swipe' })
    });

    const teardownBack = this.setupBackButton(() => this.close(modalId, { reason: 'back' }));

    this.registerModal(modalId, {
      element: modalWrapper,
      teardown: () => detachGesture?.(),
      teardownBack
    });

    modalWrapper.querySelector('#btn-close-lightbox')?.addEventListener('click', () => {
      this.close(modalId, { reason: 'close' });
    });

    modalWrapper.addEventListener('click', (e) => {
      if (e.target === modalWrapper) this.close(modalId, { reason: 'scrim' });
    });
  }

  checkAndNotifyBadges() {
    const state = store.getState();
    BADGES_REGISTRY.forEach(badge => {
      if (!state.unlockedBadges.includes(badge.id)) {
        if (badge.check(state.entries, state.profile)) {
          const newlyUnlocked = store.unlockBadge(badge.id);
          if (newlyUnlocked) {
            this.triggerConfetti();
            this.showSnackbar(`Award Unlocked: ${badge.name}`);
          }
        }
      }
    });
  }
}
