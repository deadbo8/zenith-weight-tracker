/**
 * Header Component (Zenith 2.0 Peaceful Minimalist Bar)
 * Clean screen title, quiet streak badge, and avatar button opening You profile.
 * The old gear icon is replaced by the You profile avatar per Section 3.3.
 */

import { store } from '../state.js';
import { calculateStreak } from '../analytics.js';
import { triggerHaptic } from '../android.js';

export function renderHeader(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const profile = state.profile;
  const streak = calculateStreak(state.entries);
  const initials = profile.displayName ? profile.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'ME';

  container.innerHTML = `
    <header class="navbar">
      <div class="container nav-inner">
        <!-- Brand / Screen Title -->
        <div class="brand" id="brand-home" title="Zenith Precision Dashboard">
          <div class="brand-icon-wrapper">
            <i data-lucide="scale"></i>
          </div>
          <div class="brand-info">
            <span class="brand-title">Zenith</span>
          </div>
          <!-- Streak Indicator (Quiet Chip) -->
          ${streak > 0 ? `
            <div class="streak-chip" id="btn-streak-badge" title="${streak} Day Logging Streak">
              <i data-lucide="flame" class="streak-fire-icon"></i>
              <span class="mono-num">${streak}d</span>
            </div>
          ` : ''}
        </div>

        <!-- Center: Segmented Navigation (Desktop) -->
        <nav class="nav-links hide-on-mobile">
          <button class="nav-link-btn active" data-tab="summary">
            <i data-lucide="layout-grid"></i>
            <span>Today</span>
          </button>
          <button class="nav-link-btn" data-tab="trends">
            <i data-lucide="trending-up"></i>
            <span>Trends</span>
          </button>
          <button class="nav-link-btn" data-tab="fuel">
            <i data-lucide="utensils"></i>
            <span>Fuel</span>
          </button>
          <button class="nav-link-btn" data-tab="milestones">
            <i data-lucide="compass"></i>
            <span>Journey</span>
          </button>
        </nav>

        <!-- Right: Avatar Button opening You (Section 3.3 & 9) -->
        <div class="nav-actions">
          <button class="header-avatar-btn" id="btn-open-you" title="You Profile & Settings" aria-label="Open You Profile">
            ${profile.avatar?.photoPath ? `
              <img src="${profile.avatar.photoPath}" class="header-avatar-img" alt="${profile.displayName}" />
            ` : `
              <span class="header-avatar-initials">${initials}</span>
            `}
          </button>
        </div>
      </div>
    </header>
  `;

  // Bind Events
  container.querySelector('#btn-open-you')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-you');
  });

  container.querySelector('#btn-streak-badge')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-badges');
  });

  // Desktop nav tabs
  container.querySelectorAll('.nav-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic('selection');
      const tab = btn.dataset.tab;
      onAction('switch-tab', tab);
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
