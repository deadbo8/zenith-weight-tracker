/**
 * Trend Context Insights Component (Zenith Insight Layer)
 * - Plain-language headline over each chart.
 * - Plateau detection (14-day EMA slope near zero) with calm, reassuring context.
 * - Period comparisons: "This week vs last week" and "This month vs last month" delta indicators.
 * - 30-day habit consistency ring and best-time weekday insight.
 */

import { store } from '../state.js';
import {
  calculateWeekdayPatterns,
  calculateWeeklyAggregates,
  calculateKPIs,
  getTrendHeadline,
  getPeriodComparisons,
  getHabitConsistency,
  getBestDayInsight
} from '../analytics.js';

export function renderTrendInsights(container, currentView = 'trend') {
  if (!container) return;

  const state = store.getState();
  const entries = state.entries;
  const unit = state.profile.unit;
  const kpis = calculateKPIs(entries, state.profile);

  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  const isLossGoal = (state.profile.goalWeight || 70) <= (state.profile.startWeight || 80);
  const trendInfo = getTrendHeadline(entries, state.profile);
  const comparisons = getPeriodComparisons(entries);
  const consistency = getHabitConsistency(entries, 30);
  const bestDay = getBestDayInsight(entries);

  // Period comparisons row
  let comparisonsHtml = '';
  if (comparisons && (comparisons.weekDelta !== null || comparisons.monthDelta !== null)) {
    const renderDeltaBadge = (delta) => {
      if (delta === null) return '<span>—</span>';
      const toward = isLossGoal ? delta <= 0 : delta >= 0;
      const cls = toward ? 'delta-good' : 'delta-neutral';
      const sign = delta > 0 ? '+' : '';
      return `<span class="insight-comp-delta mono-num ${cls}">${sign}${store.toDisplayWeight(delta)} ${unit}</span>`;
    };

    comparisonsHtml = `
      <div class="insight-comparisons-row">
        <div class="insight-comp-item">
          <span class="insight-comp-label">This week vs last</span>
          ${renderDeltaBadge(comparisons.weekDelta)}
        </div>
        <div class="insight-comp-item">
          <span class="insight-comp-label">This month vs last</span>
          ${renderDeltaBadge(comparisons.monthDelta)}
        </div>
        <div class="insight-comp-item">
          <span class="insight-comp-label">30d Consistency</span>
          <span class="insight-comp-delta mono-num">${consistency.percentage}%</span>
        </div>
      </div>
    `;
  }

  let contentHtml = '';

  if (currentView === 'trend') {
    contentHtml = `
      <div class="content-card insight-card">
        <div class="card-title-row">
          <h4 class="card-title">
            <i data-lucide="${trendInfo.isPlateau ? 'anchor' : 'sparkles'}" style="color: var(--accent-primary);"></i>
            ${trendInfo.headline}
          </h4>
        </div>
        <p class="insight-text">${trendInfo.detail}</p>

        ${comparisonsHtml}

        <div class="insight-metric-pills">
          <div class="insight-pill">
            <span class="insight-pill-label">Scale Weight</span>
            <span class="insight-pill-val mono-num">${store.formatWeight(kpis.currentWeight)}</span>
          </div>
          <div class="insight-pill">
            <span class="insight-pill-label">7-Day Trend EMA</span>
            <span class="insight-pill-val mono-num">${kpis.movingAverage7d ? store.formatWeight(kpis.movingAverage7d) : '--'}</span>
          </div>
          <div class="insight-pill">
            <span class="insight-pill-label">Weekly Velocity</span>
            <span class="insight-pill-val mono-num">${store.formatDelta(kpis.weeklyRate)}/wk</span>
          </div>
        </div>

        ${bestDay ? `
          <div class="best-day-note">
            <i data-lucide="sun" style="width: 13px; height: 13px; color: var(--accent-primary);"></i>
            <span>You are typically lightest on <strong>${bestDay.day}</strong> (${store.formatDelta(bestDay.diff)} vs baseline).</span>
          </div>
        ` : ''}
      </div>
    `;
  } else if (currentView === 'composition') {
    const hasFat = entries.some(e => !!e.bodyFat);
    if (hasFat) {
      const latestWithFat = [...entries].reverse().find(e => !!e.bodyFat);
      const fatPct = latestWithFat.bodyFat;
      const fatMass = Math.round(latestWithFat.weight * (fatPct / 100) * 10) / 10;
      const leanMass = Math.round((latestWithFat.weight - fatMass) * 10) / 10;

      contentHtml = `
        <div class="content-card insight-card">
          <div class="card-title-row">
            <h4 class="card-title">
              <i data-lucide="pie-chart" style="color: var(--accent-primary);"></i>
              Body Composition Breakdown
            </h4>
          </div>
          <p class="insight-text">
            Based on your latest check-in with body fat data (${latestWithFat.bodyFat}%):
          </p>
          <div class="insight-metric-pills">
            <div class="insight-pill">
              <span class="insight-pill-label">Fat Mass</span>
              <span class="insight-pill-val mono-num">${store.formatWeight(fatMass)}</span>
            </div>
            <div class="insight-pill">
              <span class="insight-pill-label">Lean Body Mass</span>
              <span class="insight-pill-val mono-num">${store.formatWeight(leanMass)}</span>
            </div>
            <div class="insight-pill">
              <span class="insight-pill-label">Body Fat %</span>
              <span class="insight-pill-val mono-num">${fatPct}%</span>
            </div>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="content-card insight-card">
          <div class="card-title-row">
            <h4 class="card-title">
              <i data-lucide="pie-chart" style="color: var(--accent-primary);"></i>
              Body Fat Tracking
            </h4>
          </div>
          <p class="insight-text">
            Add body fat % estimates or smart scale readings to your logs to automatically track lean mass preservation and true fat loss.
          </p>
        </div>
      `;
    }
  } else if (currentView === 'delta') {
    const weekly = calculateWeeklyAggregates(entries);
    const lossWeeks = weekly.filter(w => w.change < 0).length;
    const totalWeeks = weekly.length;

    contentHtml = `
      <div class="content-card insight-card">
        <div class="card-title-row">
          <h4 class="card-title">
            <i data-lucide="bar-chart-2" style="color: var(--accent-primary);"></i>
            Weekly Consistency
          </h4>
        </div>
        <p class="insight-text">
          ${totalWeeks > 0 ? `You have logged across <strong>${totalWeeks} calendar weeks</strong>, with <strong>${lossWeeks} weeks</strong> showing net progress toward your goal.` : 'Log across multiple calendar weeks to view net weekly change bars.'}
        </p>
        ${comparisonsHtml}
      </div>
    `;
  } else if (currentView === 'patterns') {
    const patterns = calculateWeekdayPatterns(entries);
    const valid = patterns.filter(p => p.count > 0);

    if (valid.length >= 3) {
      const sortedByAvg = [...valid].sort((a, b) => a.average - b.average);
      const lowestDay = sortedByAvg[0].day;
      const highestDay = sortedByAvg[sortedByAvg.length - 1].day;

      contentHtml = `
        <div class="content-card insight-card">
          <div class="card-title-row">
            <h4 class="card-title">
              <i data-lucide="calendar" style="color: var(--accent-primary);"></i>
              Weekday Variation Patterns
            </h4>
          </div>
          <p class="insight-text">
            Historically, your scale weight tends to be lowest on <strong>${lowestDay}s</strong> and highest on <strong>${highestDay}s</strong>. This is normal biological variation driven by sodium and weekend nutrition.
          </p>
          ${bestDay ? `
            <div class="best-day-note">
              <i data-lucide="sparkles" style="width: 13px; height: 13px; color: var(--accent-primary);"></i>
              <span>Optimal weigh-in reference day: <strong>${bestDay.day}</strong></span>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="content-card insight-card">
          <div class="card-title-row">
            <h4 class="card-title">
              <i data-lucide="calendar" style="color: var(--accent-primary);"></i>
              Weekday Variation
            </h4>
          </div>
          <p class="insight-text">
            Log weigh-ins across different days of the week to reveal your natural cyclical weight patterns.
          </p>
        </div>
      `;
    }
  }

  container.innerHTML = contentHtml;
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
