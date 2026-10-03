/**
 * Log History Component (Apple Inset Grouped & Calendar Heat View)
 * - Sticky month headers with tiny summary (average, change, entries).
 * - Instant delete with Undo snackbar (no blocking confirm() dialog).
 * - Calendar heat view toggle: monthly grid where each day's status is visible.
 * - Horizontal filter chips and live search.
 */

import { store } from '../state.js';
import { renderEmptyHistorySvg } from './svgs.js';
import { triggerHaptic } from '../android.js';

export function renderHistoryTable(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const entries = [...state.entries];
  const unit = state.profile.unit;
  const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);

  // Local state
  let searchQuery = '';
  let conditionFilter = 'all';
  let sortOrder = 'newest';
  let viewMode = 'list'; // 'list' | 'calendar'

  function renderView() {
    const contentMount = container.querySelector('#history-content-mount');
    if (!contentMount) return;

    if (viewMode === 'calendar') {
      renderCalendarView(contentMount);
    } else {
      renderListView(contentMount);
    }
  }

  function renderCalendarView(mount) {
    if (!entries.length) {
      mount.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1rem;">
          <p style="font-weight: 600; color: var(--text-primary);">No Check-ins to Display</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Log your daily weigh-ins to fill out your consistency calendar.</p>
        </div>
      `;
      return;
    }

    // Determine latest month or current month
    const latestDate = new Date(entries[entries.length - 1].date);
    const year = latestDate.getFullYear();
    const month = latestDate.getMonth(); // 0-indexed

    const monthName = latestDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Map entries by date key 'YYYY-MM-DD'
    const entryMap = new Map();
    entries.forEach(e => {
      const dKey = new Date(e.date).toISOString().slice(0, 10);
      entryMap.set(dKey, e);
    });

    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    let cellsHtml = '';
    // Empty prefix cells
    for (let i = 0; i < firstDayIndex; i++) {
      cellsHtml += `<div class="cal-day-cell empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const entry = entryMap.get(dateKey);

      if (entry) {
        cellsHtml += `
          <div class="cal-day-cell logged" data-id="${entry.id}" title="${dateKey}: ${store.formatWeight(entry.weight)}">
            <span class="cal-day-num">${day}</span>
            <span class="cal-day-dot"></span>
            <span class="cal-day-weight mono-num">${store.formatWeight(entry.weight, false)}</span>
          </div>
        `;
      } else {
        cellsHtml += `
          <div class="cal-day-cell missed" data-date="${dateKey}" title="${dateKey}: Missed weigh-in">
            <span class="cal-day-num">${day}</span>
            <span class="cal-missed-ring"></span>
          </div>
        `;
      }
    }

    mount.innerHTML = `
      <div class="calendar-heat-card">
        <div class="cal-header-row">
          <span class="cal-month-title">${monthName}</span>
          <span class="cal-legend-text">
            <span class="cal-legend-dot logged"></span> Logged
            <span class="cal-legend-dot missed" style="margin-left: 8px;"></span> Rest
          </span>
        </div>

        <div class="cal-grid">
          ${dayHeaders.map(h => `<div class="cal-weekday-header">${h}</div>`).join('')}
          ${cellsHtml}
        </div>
      </div>
    `;

    mount.querySelectorAll('.cal-day-cell.logged').forEach(cell => {
      cell.addEventListener('click', () => {
        triggerHaptic('light');
        const id = cell.dataset.id;
        const entry = entries.find(e => e.id === id);
        if (entry) onAction('edit-entry', entry);
      });
    });

    mount.querySelectorAll('.cal-day-cell.missed').forEach(cell => {
      cell.addEventListener('click', () => {
        triggerHaptic('light');
        onAction('open-log-modal');
      });
    });
  }

  function renderListView(mount) {
    let filtered = entries.filter(e => {
      if (conditionFilter !== 'all' && e.mood !== conditionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dateStr = new Date(e.date).toLocaleDateString().toLowerCase();
        const notesStr = (e.notes || '').toLowerCase();
        const moodStr = (e.mood || '').toLowerCase();
        if (!dateStr.includes(q) && !notesStr.includes(q) && !moodStr.includes(q)) return false;
      }
      return true;
    });

    if (sortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortOrder === 'oldest') {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortOrder === 'heaviest') {
      filtered.sort((a, b) => b.weight - a.weight);
    } else if (sortOrder === 'lightest') {
      filtered.sort((a, b) => a.weight - b.weight);
    }

    const countBadge = container.querySelector('#history-count-badge');
    if (countBadge) countBadge.textContent = `${filtered.length} logs`;

    if (!filtered.length) {
      const isSearchOrFilter = entries.length > 0;
      mount.innerHTML = `
        <div class="empty-state">
          ${renderEmptyHistorySvg()}
          <p style="font-weight: 600; color: var(--text-primary); font-size: 0.92rem; margin-top: 0.35rem;">
            ${isSearchOrFilter ? 'No Check-ins Found' : 'Nothing logged yet'}
          </p>
          <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 280px;">
            ${isSearchOrFilter ? 'Try clearing your filters or search terms.' : 'Record your first weigh-in or explore with sample data.'}
          </p>
          <div style="display: flex; gap: 8px; margin-top: 0.75rem; flex-wrap: wrap; justify-content: center;">
            <button class="btn btn-primary" id="btn-history-empty-add" style="font-size: 0.82rem;">
              <i data-lucide="plus"></i>
              <span>Log Weight</span>
            </button>
            ${!isSearchOrFilter ? `
              <button class="btn btn-secondary" id="btn-history-sample" style="font-size: 0.82rem;">
                <i data-lucide="sparkles"></i>
                <span>Try with sample data</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
      mount.querySelector('#btn-history-empty-add')?.addEventListener('click', () => {
        onAction('open-log-modal');
      });
      mount.querySelector('#btn-history-sample')?.addEventListener('click', () => {
        store.loadSampleData();
        triggerHaptic('success');
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Chronological copy for deltas
    const chronological = [...state.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group entries by month: 'October 2026'
    const groups = new Map();
    filtered.forEach(entry => {
      const d = new Date(entry.date);
      const monthKey = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!groups.has(monthKey)) groups.set(monthKey, []);
      groups.get(monthKey).push(entry);
    });

    let groupsHtml = '';
    groups.forEach((groupEntries, monthKey) => {
      // Month summary stats
      const monthWeights = groupEntries.map(e => e.weight);
      const avgW = monthWeights.reduce((a, c) => a + c, 0) / monthWeights.length;
      const firstW = groupEntries[groupEntries.length - 1].weight;
      const lastW = groupEntries[0].weight;
      const monthDiff = lastW - firstW;
      const towardGoal = isLossGoal ? monthDiff <= 0 : monthDiff >= 0;
      const deltaClass = towardGoal ? 'delta-good' : 'delta-neutral';

      const rowsHtml = groupEntries.map(entry => {
        const d = new Date(entry.date);
        const isToday = new Date().toDateString() === d.toDateString();
        const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();

        let dateTitle = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        if (isToday) dateTitle = 'Today';
        else if (isYesterday) dateTitle = 'Yesterday';

        const timeSub = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        const origIdx = chronological.findIndex(e => e.id === entry.id);
        let deltaDisplay = null;
        let rowDeltaClass = 'delta-neutral';
        let deltaIcon = 'minus';

        if (origIdx > 0) {
          const prev = chronological[origIdx - 1];
          const diff = entry.weight - prev.weight;
          deltaDisplay = store.formatDelta(diff);
          const rowToward = isLossGoal ? diff <= 0 : diff >= 0;
          rowDeltaClass = rowToward ? 'delta-good' : 'delta-neutral';
          deltaIcon = diff < 0 ? 'trending-down' : diff > 0 ? 'trending-up' : 'minus';
        }

        const conditionMap = {
          fasted: 'Fasted',
          energetic: 'Energy',
          post_workout: 'Post-Wkt',
          cheat_day: 'Refeed',
          heavy: 'Water Ret.'
        };
        const conditionLabel = entry.mood && conditionMap[entry.mood] ? conditionMap[entry.mood] : null;

        return `
          <div class="history-inset-row" data-id="${entry.id}">
            <div class="history-row-date">
              <span class="history-date-main">${dateTitle}</span>
              <span class="history-date-sub mono-num">${timeSub}</span>
            </div>

            <div class="history-row-weight">
              <span class="history-weight-digits mono-num">${store.formatWeight(entry.weight, false)}</span>
              <span class="history-weight-unit">${unit}</span>
              ${deltaDisplay ? `
                <span class="hairline-row-delta ${rowDeltaClass}">
                  <i data-lucide="${deltaIcon}"></i>
                  ${deltaDisplay}
                </span>
              ` : ''}
            </div>

            <div class="history-row-meta">
              ${entry.bodyFat ? `<span class="hairline-badge mono-num">${entry.bodyFat}%</span>` : ''}
              ${conditionLabel ? `<span class="hairline-badge">${conditionLabel}</span>` : ''}
              ${entry.photo ? `<img src="${entry.photo}" class="history-photo-thumb" data-photo="${entry.id}" title="View photo" />` : ''}
            </div>

            <div class="history-row-actions">
              <button class="action-icon-btn btn-edit-entry" data-id="${entry.id}" title="Edit Check-in">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="action-icon-btn delete btn-delete-entry" data-id="${entry.id}" title="Delete Check-in (Instant with Undo)">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      groupsHtml += `
        <div class="history-month-group">
          <div class="sticky-month-header">
            <span class="sticky-month-title">${monthKey}</span>
            <div class="sticky-month-summary mono-num">
              <span>Avg ${store.formatWeight(avgW)}</span>
              <span class="${deltaClass}">${monthDiff > 0 ? '+' : ''}${store.toDisplayWeight(monthDiff)} ${unit}</span>
              <span>${groupEntries.length} logs</span>
            </div>
          </div>

          <div class="history-inset-card">
            ${rowsHtml}
          </div>
        </div>
      `;
    });

    mount.innerHTML = groupsHtml;

    // Attach listeners
    mount.querySelectorAll('.btn-edit-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic('light');
        const id = btn.dataset.id;
        const entry = state.entries.find(item => item.id === id);
        if (entry) onAction('edit-entry', entry);
      });
    });

    mount.querySelectorAll('.btn-delete-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic('warning');
        const id = btn.dataset.id;
        // Instant delete with Undo snackbar (no blocking confirm dialog!)
        store.deleteEntry(id);
        onAction('toast', {
          message: 'Check-in deleted',
          actionText: 'Undo',
          actionCallback: () => store.undoDelete()
        });
      });
    });

    mount.querySelectorAll('.history-photo-thumb').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic('light');
        const id = thumb.dataset.photo;
        const entry = state.entries.find(item => item.id === id);
        if (entry && entry.photo) onAction('view-photo', entry);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  container.innerHTML = `
    <div class="history-screen-wrapper">
      <!-- Search & Controls Header -->
      <div class="history-toolbar">
        <div class="history-search-bar">
          <i data-lucide="search" class="history-search-icon"></i>
          <input type="text" class="history-search-input" id="history-search-input" placeholder="Search notes, dates, tags..." />
        </div>

        <div class="history-toolbar-actions">
          <!-- View Toggle: List vs Calendar -->
          <div class="segmented-control" id="history-view-toggle">
            <button type="button" class="segment-btn ${viewMode === 'list' ? 'active' : ''}" data-mode="list" title="Grouped List">
              <i data-lucide="list"></i>
            </button>
            <button type="button" class="segment-btn ${viewMode === 'calendar' ? 'active' : ''}" data-mode="calendar" title="Calendar Heat View">
              <i data-lucide="calendar"></i>
            </button>
          </div>

          <button class="btn btn-ghost" id="btn-export-csv" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;" title="Download CSV backup">
            <i data-lucide="download"></i>
            <span>Export</span>
          </button>
        </div>
      </div>

      <!-- Filter Chips Strip -->
      <div class="history-filter-strip">
        <button class="history-filter-chip ${conditionFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="history-filter-chip ${conditionFilter === 'fasted' ? 'active' : ''}" data-filter="fasted">Fasted</button>
        <button class="history-filter-chip ${conditionFilter === 'energetic' ? 'active' : ''}" data-filter="energetic">Energetic</button>
        <button class="history-filter-chip ${conditionFilter === 'post_workout' ? 'active' : ''}" data-filter="post_workout">Post-Workout</button>
        <button class="history-filter-chip ${conditionFilter === 'cheat_day' ? 'active' : ''}" data-filter="cheat_day">Refeed</button>
        <button class="history-filter-chip ${conditionFilter === 'heavy' ? 'active' : ''}" data-filter="heavy">Water Retained</button>
      </div>

      <!-- Content Mount (List or Calendar) -->
      <div id="history-content-mount"></div>
    </div>
  `;

  // Bind toolbar events
  const searchInput = container.querySelector('#history-search-input');
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderView();
  });

  container.querySelectorAll('#history-view-toggle .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic('selection');
      container.querySelectorAll('#history-view-toggle .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.mode;
      renderView();
    });
  });

  container.querySelectorAll('.history-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      triggerHaptic('light');
      container.querySelectorAll('.history-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      conditionFilter = chip.dataset.filter;
      renderView();
    });
  });

  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    store.exportCSV();
    onAction('toast', { message: 'CSV exported' });
  });

  // Initial render
  renderView();
}
