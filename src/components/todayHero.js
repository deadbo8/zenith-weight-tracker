/**
 * Today's Authoritative Hero Component (Zenith 2.0 Precision Design)
 * Section 1.6 & Section 1.3:
 * - Row 1: Title (left) & Edit text button (right, 48dp tap target)
 * - Row 2: Timestamp and condition caption ("7:48 AM · Fasted")
 * - Headline number with KG ↔ LB toggle
 * - Meta row: Secondary readout ("Scale 77.8 kg") + delta chip with 12px min gaps
 * - Segmented control [ Trend | Scale ] (36px visual height inside 48dp hit area, wraps cleanly on narrow screens)
 * - Safe number formatting with format.js (never null, NaN, or Infinity)
 * - Empty state: "No check-in yet. Your first weigh-in starts the trend." with "Log first weigh-in" action
 */

import { store } from '../state.js';
import { toLocalDateString, calculateEMA } from '../analytics.js';
import { triggerHaptic } from '../android.js';
import { fmt, fmtDelta, isNum } from '../format.js';

export function renderTodayHero(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const entries = state.entries || [];
  const unit = state.profile.unit || 'kg';
  const headlineMode = state.profile.headlineDisplay || 'trend';
  const todayStr = toLocalDateString(new Date());

  // Check today's entry
  const todayEntry = entries.find(e => toLocalDateString(e.date) === todayStr);

  // Chronological list
  const sortedChronological = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  let prevEntry = null;

  if (todayEntry) {
    const todayIdx = sortedChronological.findIndex(e => e.id === todayEntry.id);
    if (todayIdx > 0) {
      prevEntry = sortedChronological[todayIdx - 1];
    }
  } else if (sortedChronological.length > 0) {
    prevEntry = sortedChronological[sortedChronological.length - 1];
  }

  // Calculate 7-day EMA
  const emaList = calculateEMA(sortedChronological, 7);
  const latestEmaKg = emaList.length ? emaList[emaList.length - 1] : null;

  const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);

  if (todayEntry) {
    // Logged today
    const rawWeightKg = todayEntry.weight;
    const trendWeightKg = latestEmaKg != null ? latestEmaKg : rawWeightKg;

    const displayRaw = store.toDisplayWeight(rawWeightKg);
    const displayTrend = store.toDisplayWeight(trendWeightKg);

    const isTrendHeadline = headlineMode === 'trend';
    const heroNumber = isTrendHeadline ? displayTrend : displayRaw;
    const secondaryLabel = isTrendHeadline
      ? `Scale ${fmt(displayRaw)} ${unit}`
      : `Trend ${fmt(displayTrend)} ${unit}`;

    // Delta compared to yesterday / previous
    let deltaHtml = '';
    if (prevEntry) {
      const diffKg = todayEntry.weight - prevEntry.weight;
      const diffDisplay = store.formatDelta(diffKg);
      // Apple color rule: Green for toward goal, Neutral gray for away (never red)
      const towardGoal = isLossGoal ? diffKg <= 0 : diffKg >= 0;
      const deltaClass = towardGoal ? 'delta-good' : 'delta-neutral';
      const deltaIcon = diffKg < 0 ? 'trending-down' : diffKg > 0 ? 'trending-up' : 'minus';

      deltaHtml = `
        <span class="hero-delta-chip ${deltaClass}">
          <i data-lucide="${deltaIcon}"></i>
          ${diffDisplay} vs yesterday
        </span>
      `;
    }

    const timeStr = new Date(todayEntry.date).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });

    const conditionMap = {
      fasted: 'Fasted',
      energetic: 'High Energy',
      post_workout: 'Post-Workout',
      cheat_day: 'Refeed',
      heavy: 'Water Retained',
      normal: 'Normal'
    };
    const conditionTag = todayEntry.mood && todayEntry.mood !== 'normal' ? conditionMap[todayEntry.mood] || todayEntry.mood : null;

    container.innerHTML = `
      <div class="today-authoritative-hero">
        <!-- Row 1: Title (left) & Edit text button (right, 48dp tap area) -->
        <div class="hero-head">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="hero-static-dot"></span>
            <span class="hero-status-title" style="font-weight: 600; font-size: 1.05rem;">Today's check-in</span>
          </div>
          <button class="btn btn-ghost" id="btn-edit-today-log" style="min-height: 48px; padding: 0 14px; font-weight: 500; font-size: 0.9rem;" title="Edit check-in">
            Edit
          </button>
        </div>

        <!-- Row 2: Secondary-text caption (time and condition) -->
        <div class="hero-sub mono-num">
          ${timeStr}${conditionTag ? ` · ${conditionTag}` : ''}
        </div>

        <!-- Headline Hero Number -->
        <div class="hero-display-group" style="margin-top: 14px;">
          <div class="hero-number-wrap">
            <span class="hero-big-number mono-num">${fmt(heroNumber, { dp: 1 })}</span>
            <button class="hero-unit-toggle" id="btn-hero-unit" title="Tap to switch KG ↔ LB">
              ${unit}
            </button>
          </div>
        </div>

        <!-- Row 3: Meta row with delta on left and Trend | Scale segmented toggle on right -->
        <div class="hero-meta">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span class="hero-secondary-stat mono-num">${secondaryLabel}</span>
            ${deltaHtml}
          </div>

          <!-- Segmented Control [ Trend | Scale ] -->
          <div class="seg" role="radiogroup" aria-label="Headline weight preference">
            <button type="button" class="${isTrendHeadline ? 'active' : ''}" id="btn-seg-trend" title="Focus on 7-day smoothed trend">Trend</button>
            <button type="button" class="${!isTrendHeadline ? 'active' : ''}" id="btn-seg-scale" title="Focus on raw scale weigh-in">Scale</button>
          </div>
        </div>

        <!-- Badges & Notes Row -->
        ${(todayEntry.bodyFat || todayEntry.waist || todayEntry.notes) ? `
          <div class="hero-footer-row" style="margin-top: 14px;">
            <div class="hero-chips-wrap">
              ${todayEntry.bodyFat ? `
                <span class="hero-info-chip mono-num">${fmt(todayEntry.bodyFat)}% Fat</span>
              ` : ''}
              ${todayEntry.waist ? `
                <span class="hero-info-chip mono-num">${fmt(todayEntry.waist)}cm Waist</span>
              ` : ''}
            </div>

            ${todayEntry.notes ? `
              <div class="hero-note-preview" title="${todayEntry.notes}">
                <i data-lucide="message-square"></i>
                <span>${todayEntry.notes}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    // Events
    container.querySelector('#btn-edit-today-log')?.addEventListener('click', () => {
      triggerHaptic('light');
      onAction('edit-entry', todayEntry);
    });

    container.querySelector('#btn-hero-unit')?.addEventListener('click', () => {
      triggerHaptic('selection');
      store.toggleUnit();
    });

    container.querySelector('#btn-seg-trend')?.addEventListener('click', () => {
      if (headlineMode !== 'trend') {
        triggerHaptic('selection');
        store.setHeadlineDisplay('trend');
      }
    });

    container.querySelector('#btn-seg-scale')?.addEventListener('click', () => {
      if (headlineMode !== 'scale') {
        triggerHaptic('selection');
        store.setHeadlineDisplay('scale');
      }
    });

  } else {
    // Unlogged state (Section 1.3 empty-state table)
    const hasHistory = entries.length > 0;
    const lastWeightDisplay = prevEntry ? store.formatWeight(prevEntry.weight) : null;
    const lastDate = prevEntry ? new Date(prevEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

    container.innerHTML = `
      <div class="today-authoritative-hero unlogged">
        <div class="hero-head">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="hero-neutral-dot"></span>
            <span class="hero-status-title" style="font-weight: 600; font-size: 1.05rem;">Today's check-in</span>
          </div>

          <button class="hero-unit-toggle quiet" id="btn-hero-unit" title="Tap to switch KG ↔ LB">
            ${unit}
          </button>
        </div>

        <div class="hero-sub">
          ${hasHistory ? 'Ready when you are' : 'No check-in yet'}
        </div>

        <div class="hero-unlogged-body" style="margin-top: 14px;">
          <div class="hero-unlogged-prompt">
            <h3 class="hero-unlogged-title">${hasHistory ? 'Morning Weigh-in' : 'Start Your Trajectory'}</h3>
            <p class="hero-unlogged-desc">
              ${hasHistory 
                ? 'Weighing in right after waking filters out hydration noise and keeps your trajectory crystal clear.'
                : 'Your first weigh-in starts the trend. Log today to establish your baseline.'}
            </p>
            ${hasHistory && lastWeightDisplay ? `
              <div class="hero-last-ref">
                <span>Previous: </span>
                <strong class="mono-num">${lastWeightDisplay}</strong>
                <span class="hero-last-date">(${lastDate})</span>
              </div>
            ` : ''}
          </div>

          <button class="btn btn-primary hero-log-action-btn" id="btn-hero-log-action" style="min-height: 48px;">
            <i data-lucide="plus"></i>
            <span>${hasHistory ? 'Log Check-in' : 'Log first weigh-in'}</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-hero-log-action')?.addEventListener('click', () => {
      triggerHaptic('medium');
      onAction('open-log-modal');
    });

    container.querySelector('#btn-hero-unit')?.addEventListener('click', () => {
      triggerHaptic('selection');
      store.toggleUnit();
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
