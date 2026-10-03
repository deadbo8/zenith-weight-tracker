/**
 * Insights Strip & Weekly Review Component (Apple Minimalism)
 * - Weekly Review Card: average, change, consistency, and one sentence of calm insight.
 * - Horizontal Insights Strip: compact chips for Metabolic Target, Awards, and Visual Progress.
 */

import { store } from '../state.js';
import { BADGES_REGISTRY, calculateWeeklyReview } from '../analytics.js';
import { triggerHaptic } from '../android.js';

export function renderQuickTools(container, onAction, onSwitchTab) {
  if (!container) return;

  const state = store.getState();
  const unlockedCount = state.unlockedBadges.length;
  const totalBadges = Object.keys(BADGES_REGISTRY).length;
  const photosCount = state.entries.filter(e => !!e.photo).length;
  const unit = state.profile.unit;

  // Calculate Weekly Review
  const review = calculateWeeklyReview(state.entries, state.profile);

  let weeklyReviewHtml = '';
  if (review && review.hasReview) {
    const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);
    const towardGoal = isLossGoal ? review.diff <= 0 : review.diff >= 0;
    const deltaClass = towardGoal ? 'delta-good' : 'delta-neutral';
    const deltaSign = review.diff > 0 ? '+' : '';

    weeklyReviewHtml = `
      <div class="weekly-review-card">
        <div class="weekly-review-header">
          <div class="weekly-review-badge">
            <i data-lucide="sparkles"></i>
            <span>Weekly Review</span>
          </div>
          <span class="weekly-review-days mono-num">${review.logCount}/7 days logged</span>
        </div>

        <div class="weekly-review-stats">
          <div>
            <span class="weekly-stat-label">7-Day Avg</span>
            <div class="weekly-stat-val mono-num">${store.formatWeight(review.avgWeight)}</div>
          </div>
          <div>
            <span class="weekly-stat-label">Net Change</span>
            <div class="weekly-stat-val mono-num ${deltaClass}">${deltaSign}${store.toDisplayWeight(review.diff)} ${unit}</div>
          </div>
          <div>
            <span class="weekly-stat-label">Consistency</span>
            <div class="weekly-stat-val mono-num">${Math.round(review.consistencyRate)}%</div>
          </div>
        </div>

        <p class="weekly-review-sentence">${review.insightSentence}</p>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="insights-stack">
      ${weeklyReviewHtml}

      <!-- Horizontally Scrollable Insights Strip -->
      <div class="insights-strip-wrapper">
        <div class="insights-strip-scroll">
          <!-- Chip 1: Metabolic Target -->
          <button type="button" class="insight-chip" id="chip-open-calc">
            <div class="insight-chip-icon">
              <i data-lucide="calculator"></i>
            </div>
            <div class="insight-chip-text">
              <span class="insight-chip-title">Metabolic Target</span>
              <span class="insight-chip-sub">BMR & TDEE</span>
            </div>
          </button>

          <!-- Chip 2: Awards & Milestones -->
          <button type="button" class="insight-chip" id="chip-open-badges">
            <div class="insight-chip-icon">
              <i data-lucide="award"></i>
            </div>
            <div class="insight-chip-text">
              <span class="insight-chip-title">Awards</span>
              <span class="insight-chip-sub mono-num">${unlockedCount}/${totalBadges}</span>
            </div>
          </button>

          <!-- Chip 3: Visual Progress -->
          <button type="button" class="insight-chip" id="chip-open-photos">
            <div class="insight-chip-icon">
              <i data-lucide="camera"></i>
            </div>
            <div class="insight-chip-text">
              <span class="insight-chip-title">Visual Progress</span>
              <span class="insight-chip-sub">${photosCount} Photos</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#chip-open-calc')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-calc');
  });

  container.querySelector('#chip-open-badges')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-badges');
  });

  container.querySelector('#chip-open-photos')?.addEventListener('click', () => {
    triggerHaptic('selection');
    if (onSwitchTab) onSwitchTab('milestones');
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
