/**
 * Contextual FAB & Speed Dial Component (Section 3.2)
 * Handles contextual tap, long-press, and swipe-up speed dial menu.
 */

import { triggerHaptic } from '../android.js';

export function setupContextualFab({
  fabButton,
  onLogWeight,
  onSnapMeal,
  onDescribeMeal,
  onAddWater,
  getCurrentTab
}) {
  if (!fabButton) return;

  let pressTimer = null;
  let isLongPress = false;
  let startY = 0;

  const openSpeedDial = () => {
    isLongPress = true;
    triggerHaptic('medium');
    showSpeedDialMenu({
      onLogWeight,
      onSnapMeal,
      onDescribeMeal,
      onAddWater
    });
  };

  // Touch and click listeners
  fabButton.addEventListener('touchstart', (e) => {
    isLongPress = false;
    startY = e.touches[0].clientY;
    pressTimer = setTimeout(() => {
      openSpeedDial();
    }, 450);
  }, { passive: true });

  fabButton.addEventListener('touchmove', (e) => {
    const deltaY = startY - e.touches[0].clientY;
    // Swipe up on FAB opens speed dial
    if (deltaY > 30 && !isLongPress) {
      clearTimeout(pressTimer);
      openSpeedDial();
    }
  }, { passive: true });

  fabButton.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });

  fabButton.addEventListener('click', () => {
    if (isLongPress) return;
    const currentTab = getCurrentTab ? getCurrentTab() : 'today';

    if (currentTab === 'fuel') {
      // Tap on Fuel: focus chat dock input
      const input = document.querySelector('#dock-chat-input');
      if (input) {
        input.focus();
        triggerHaptic('light');
      }
    } else {
      // Tap on Today, Trends, Journey: Log Weight sheet
      triggerHaptic('light');
      if (onLogWeight) onLogWeight();
    }
  });
}

function showSpeedDialMenu({ onLogWeight, onSnapMeal, onDescribeMeal, onAddWater }) {
  const existing = document.querySelector('#zenith-speed-dial-scrim');
  if (existing) existing.remove();

  const scrim = document.createElement('div');
  scrim.className = 'speed-dial-scrim is-visible';
  scrim.id = 'zenith-speed-dial-scrim';

  scrim.innerHTML = `
    <div class="speed-dial-container" role="menu" aria-label="Quick Actions">
      <div class="speed-dial-items">
        <button class="speed-dial-item" id="sd-action-snap" role="menuitem">
          <span class="speed-dial-label">Snap meal</span>
          <span class="speed-dial-icon">📷</span>
        </button>
        <button class="speed-dial-item" id="sd-action-describe" role="menuitem">
          <span class="speed-dial-label">Describe meal</span>
          <span class="speed-dial-icon">💬</span>
        </button>
        <button class="speed-dial-item" id="sd-action-water" role="menuitem">
          <span class="speed-dial-label">Add water</span>
          <span class="speed-dial-icon">💧</span>
        </button>
        <button class="speed-dial-item" id="sd-action-weight" role="menuitem">
          <span class="speed-dial-label">Log weight</span>
          <span class="speed-dial-icon">⚖️</span>
        </button>
      </div>
      <button class="speed-dial-close-btn" id="btn-speed-dial-close" aria-label="Close menu">✕</button>
    </div>
  `;

  document.body.classList.add('modal-open');
  document.body.appendChild(scrim);

  const close = () => {
    triggerHaptic('light');
    scrim.classList.remove('is-visible');
    setTimeout(() => {
      scrim.remove();
      const anyOther = document.querySelector('.modal-backdrop.open, .modal-backdrop.is-visible, #zenith-you-page.is-visible');
      if (!anyOther) document.body.classList.remove('modal-open');
    }, 200);
  };

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.id === 'btn-speed-dial-close') close();
  });

  scrim.querySelector('#sd-action-snap')?.addEventListener('click', () => {
    close();
    if (onSnapMeal) onSnapMeal();
  });

  scrim.querySelector('#sd-action-describe')?.addEventListener('click', () => {
    close();
    if (onDescribeMeal) onDescribeMeal();
  });

  scrim.querySelector('#sd-action-water')?.addEventListener('click', () => {
    close();
    if (onAddWater) onAddWater();
  });

  scrim.querySelector('#sd-action-weight')?.addEventListener('click', () => {
    close();
    if (onLogWeight) onLogWeight();
  });
}
