/**
 * Trophies Preview Component (Journey Screen)
 * Displays a horizontal row of the next 3 badges with progress rings + "All 12" for the full room.
 * Locked badges are monochrome with a short calm hint.
 */

import { store } from '../state.js';
import { BADGES_REGISTRY } from '../analytics.js';
import { renderBadgeCrestSvg } from './svgs.js';
import { triggerHaptic } from '../android.js';

export function renderTrophiesPreview(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const unlocked = state.unlockedBadges || [];
  const allBadges = Object.values(BADGES_REGISTRY);

  const earnedList = allBadges.filter(b => unlocked.includes(b.id));
  const lockedList = allBadges.filter(b => !unlocked.includes(b.id));

  // Next 3 badges to display
  const displayBadges = [
    ...earnedList.slice(-2),
    ...lockedList.slice(0, 3)
  ].slice(0, 3);

  container.innerHTML = `
    <div class="content-card trophies-preview-card">
      <div class="card-title-row">
        <h3 class="card-title">
          <i data-lucide="award" style="color: var(--accent-primary);"></i>
          Awards & Milestones
        </h3>
        <button class="btn btn-ghost" id="btn-view-all-badges" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">
          <span>All 12 (${earnedList.length}/12)</span>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>

      <div class="trophies-preview-strip">
        ${displayBadges.map(badge => {
          const isUnlocked = unlocked.includes(badge.id);
          return `
            <div class="trophy-preview-item ${isUnlocked ? 'unlocked' : 'locked'}" title="${badge.name}: ${badge.description}">
              <div class="trophy-icon-wrap">
                ${renderBadgeCrestSvg(badge.id, isUnlocked)}
              </div>
              <span class="trophy-preview-name">${badge.name}</span>
              <span class="trophy-preview-status">${isUnlocked ? 'Earned' : 'Upcoming'}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-view-all-badges')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-badges');
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
