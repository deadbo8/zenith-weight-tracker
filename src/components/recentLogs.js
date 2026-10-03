/**
 * Recent Activity Preview Component (Apple Hairline Separators)
 * Clean list of the last 3 check-in entries as plain rows with hairline dividers (not cards).
 * "View all" is a clean text link pointing directly to the History tab.
 */

import { store } from '../state.js';
import { triggerHaptic } from '../android.js';

export function renderRecentLogs(container, onAction, onSwitchTab) {
  if (!container) return;

  const state = store.getState();
  const entries = state.entries;
  const unit = state.profile.unit;

  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  // Get up to 3 most recent logs (sorted newest first)
  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  // Chronological copy to compute chronological deltas
  const chronological = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);

  const rowsHtml = recentEntries.map((entry, index) => {
    const d = new Date(entry.date);
    const isToday = new Date().toDateString() === d.toDateString();
    const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();

    let dateTitle = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (isToday) dateTitle = 'Today';
    else if (isYesterday) dateTitle = 'Yesterday';

    const timeSub = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    // Delta compared to immediately preceding chronological weigh-in
    const idx = chronological.findIndex(e => e.id === entry.id);
    let deltaHtml = '';
    if (idx > 0) {
      const prev = chronological[idx - 1];
      const diff = entry.weight - prev.weight;
      const towardGoal = isLossGoal ? diff <= 0 : diff >= 0;
      const deltaClass = towardGoal ? 'delta-good' : 'delta-neutral';
      const deltaIcon = diff < 0 ? 'trending-down' : diff > 0 ? 'trending-up' : 'minus';

      deltaHtml = `
        <span class="hairline-row-delta ${deltaClass}">
          <i data-lucide="${deltaIcon}"></i>
          ${store.formatDelta(diff)}
        </span>
      `;
    }

    const conditionMap = {
      fasted: 'Fasted',
      energetic: 'Energy',
      post_workout: 'Post-Wkt',
      cheat_day: 'Refeed',
      heavy: 'Water Ret.'
    };
    const conditionTag = entry.mood && conditionMap[entry.mood] ? conditionMap[entry.mood] : null;

    return `
      <div class="hairline-log-row" data-id="${entry.id}">
        <div class="hairline-row-date">
          <span class="hairline-date-label">${dateTitle}</span>
          <span class="hairline-time-label mono-num">${timeSub}</span>
        </div>

        <div class="hairline-row-center">
          ${entry.bodyFat ? `<span class="hairline-badge mono-num">${entry.bodyFat}%</span>` : ''}
          ${conditionTag ? `<span class="hairline-badge">${conditionTag}</span>` : ''}
          ${entry.photo ? `<span class="hairline-badge photo"><i data-lucide="image" style="width: 11px; height: 11px;"></i></span>` : ''}
        </div>

        <div class="hairline-row-weight">
          <span class="hairline-weight-num mono-num">${store.formatWeight(entry.weight, false)}</span>
          <span class="hairline-weight-unit">${unit}</span>
          ${deltaHtml}
        </div>

        <i data-lucide="chevron-right" class="hairline-row-arrow"></i>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="recent-hairline-card">
      <div class="recent-hairline-header">
        <span class="recent-hairline-title">Recent Activity</span>
        <button class="recent-view-all-link" id="btn-recent-view-all">
          <span>View all</span>
          <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
        </button>
      </div>

      <div class="recent-hairline-list">
        ${rowsHtml}
      </div>
    </div>
  `;

  // Row edit tap
  container.querySelectorAll('.hairline-log-row').forEach(row => {
    row.addEventListener('click', () => {
      triggerHaptic('light');
      const id = row.getAttribute('data-id');
      const entry = entries.find(e => e.id === id);
      if (entry) onAction('edit-entry', entry);
    });
  });

  // View all link
  container.querySelector('#btn-recent-view-all')?.addEventListener('click', () => {
    triggerHaptic('selection');
    if (onSwitchTab) onSwitchTab('history');
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
