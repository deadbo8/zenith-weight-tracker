/**
 * Goal Card + Compact Tiles Component (Zenith 2.0 Hardening - Section 1.3)
 * - Safe numeric formatters: never render null, undefined, NaN, or Infinity
 * - Goal Card: Thin progress bar, "62% · 4.6 kg to go" or calm "Set a goal" empty state
 * - Pace Tile: Weekly rate with unit, calm status ("On track", "Needs 2 check-ins", "One more check-in")
 * - BMI Tile: Number with category, calm "Add your height and a weigh-in" when empty
 */

import { store } from '../state.js';
import { calculateKPIs, getRecentSparkline, calculateTDEE } from '../analytics.js';
import { triggerHaptic } from '../android.js';
import { fmt, fmtInt, fmtDelta, isNum } from '../format.js';

export function renderKpiCards(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const kpis = calculateKPIs(state.entries, state.profile);
  const unit = state.profile.unit || 'kg';
  const hasEntries = kpis.hasEntries;

  // Sparklines for tiles
  const sparklineWeights = getRecentSparkline(state.entries, 7);
  const renderMiniSparklineSvg = (values) => {
    const width = 64;
    const height = 22;
    const pad = 2;

    if (!values || values.length < 2) {
      // Dashed flat line for empty or 1-entry state
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="tile-sparkline">
          <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="3 3" />
        </svg>
      `;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const points = values.map((val, idx) => {
      const x = pad + (idx / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const strokeColor = 'var(--accent-primary)';

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="tile-sparkline">
        <polyline fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      </svg>
    `;
  };

  const sparklineHtml = renderMiniSparklineSvg(sparklineWeights);

  // Goal Card Setup
  const goalWeight = state.profile.goalWeight;
  const hasGoal = isNum(goalWeight) && goalWeight > 0;
  const goalStatus = kpis.goal.status; // 'empty' | 'partial' | 'ready'
  const progressPercent = kpis.goal.percent || 0;
  const remainingKg = kpis.goal.remaining;

  let remainingDisplay = '';
  if (goalStatus === 'ready' && isNum(remainingKg)) {
    remainingDisplay = `· ${fmt(store.toDisplayWeight(remainingKg))} ${unit} to go`;
  } else if (goalStatus === 'partial' && isNum(remainingKg)) {
    remainingDisplay = `· ${fmt(store.toDisplayWeight(remainingKg))} ${unit} from baseline`;
  } else if (!hasGoal) {
    remainingDisplay = '· Tap to set target';
  }

  // Plain-language forecast line
  let forecastLine = 'Track daily to project arrival date';
  if (kpis.projectedDate) {
    const d = new Date(kpis.projectedDate);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    forecastLine = `On track for ${dateStr}`;
  } else if (hasGoal && hasEntries) {
    forecastLine = 'Holding steady towards goal';
  } else if (!hasGoal) {
    forecastLine = 'Set your goal weight in Settings';
  }

  // Pace Tile Stats
  const paceStatusObj = kpis.pace;
  let weeklyRateDisplay = '—';
  let monthlyRateDisplay = 'Needs 2 check-ins';
  let paceStatus = paceStatusObj.paceStatus || 'Steady';

  if (paceStatusObj.status === 'ready' && isNum(paceStatusObj.weeklyRate)) {
    weeklyRateDisplay = store.formatDelta(paceStatusObj.weeklyRate, false);
    monthlyRateDisplay = isNum(paceStatusObj.velocity30d) ? `${store.formatDelta(paceStatusObj.velocity30d)} in 30d` : 'Recent trend';
  } else if (paceStatusObj.status === 'partial') {
    weeklyRateDisplay = '—';
    monthlyRateDisplay = 'One more check-in';
    paceStatus = 'One more check-in';
  }

  // BMI Tile Stats
  const bmiObj = kpis.bmiDetails;
  let bmiDisplay = '—';
  let bmiCatLabel = '—';
  let bmiSubtitle = 'Add height & weigh-in';

  if (bmiObj.status === 'ready' && isNum(bmiObj.value)) {
    bmiDisplay = fmt(bmiObj.value, { dp: 1 });
    bmiCatLabel = bmiObj.category || 'Normal';
    const latestWeight = hasEntries ? state.entries[state.entries.length - 1].weight : state.profile.startWeight;
    const tdeeVal = calculateTDEE(latestWeight, state.profile.height, state.profile.age, state.profile.gender, state.profile.activityLevel);
    bmiSubtitle = isNum(tdeeVal) ? `TDEE ~${fmtInt(tdeeVal)} kcal` : (bmiObj.reason || 'Active plan');
  } else if (bmiObj.status === 'partial') {
    bmiSubtitle = bmiObj.reason || 'Add height in settings';
  }

  // Fuel Summary for Today
  const todaySummary = store.getDailyNutritionSummary(store.getState().profile ? undefined : undefined);
  const todayMeals = store.getMealsByDay();
  const hasMeals = todayMeals.length > 0;
  const remainingKcal = Math.max(0, todaySummary.target.kcal - todaySummary.consumed.kcal);
  const isOverKcal = todaySummary.consumed.kcal > todaySummary.target.kcal;
  const overKcal = isOverKcal ? todaySummary.consumed.kcal - todaySummary.target.kcal : 0;
  const proteinPct = Math.min(100, Math.round((todaySummary.consumed.proteinG / Math.max(1, todaySummary.target.proteinG)) * 100));

  container.innerHTML = `
    <div class="kpi-streamlined-stack">
      <!-- 1. Goal Progress Card -->
      <div class="goal-highlight-card" id="card-goal-progress" title="Adjust goal settings">
        <div class="goal-highlight-top">
          <div class="goal-title-group">
            <span class="goal-card-label">Goal Target</span>
            <span class="goal-target-val mono-num">
              ${hasGoal ? store.formatWeight(goalWeight) : 'Not configured'}
            </span>
          </div>

          <div class="goal-percent-badge mono-num">
            <span>${progressPercent}%</span>
            <span class="goal-remaining-sub">${remainingDisplay}</span>
          </div>
        </div>

        <!-- Thin Minimalist Progress Bar -->
        <div class="goal-thin-progress-track">
          <div class="goal-thin-progress-fill" style="width: ${Math.min(100, Math.max(0, progressPercent))}%;"></div>
        </div>

        <div class="goal-highlight-footer">
          <span class="goal-forecast-text">
            <i data-lucide="compass" style="width: 13px; height: 13px; opacity: 0.7;"></i>
            ${forecastLine}
          </span>
          <button class="goal-configure-btn" id="btn-configure-goal">
            <span>${hasGoal ? 'Edit' : 'Set Goal'}</span>
          </button>
        </div>
      </div>

      <!-- 1.5. Today Fuel Card (Section 8.5) -->
      <div class="today-fuel-card" id="card-today-fuel" role="button" tabindex="0">
        <div class="today-fuel-header">
          <div class="today-fuel-title-wrap">
            <span class="today-fuel-badge">FUEL</span>
            <span class="today-fuel-title">Nutrition & Energy</span>
          </div>
          <button class="today-fuel-btn-action" id="btn-today-log-meal">
            <span>📷 Log Meal</span>
          </button>
        </div>

        ${hasMeals ? `
          <div class="today-fuel-body">
            <div class="today-fuel-headline">
              <span class="today-fuel-kcal mono-num">
                ${isOverKcal ? `${fmtInt(overKcal)} kcal over` : `${fmtInt(remainingKcal)} kcal left`}
              </span>
              <span class="today-fuel-sub">
                Eaten ${fmtInt(todaySummary.consumed.kcal)} · Goal ${fmtInt(todaySummary.target.kcal)}
              </span>
            </div>
            <div class="today-fuel-protein-row">
              <div class="protein-text-row">
                <span>Protein</span>
                <span class="mono-num">${Math.round(todaySummary.consumed.proteinG)} / ${Math.round(todaySummary.target.proteinG)} g</span>
              </div>
              <div class="protein-mini-track">
                <div class="protein-mini-fill" style="width: ${proteinPct}%;"></div>
              </div>
            </div>
          </div>
        ` : `
          <div class="today-fuel-empty">
            <span class="empty-fuel-prompt">Snap your first meal or describe it with AI</span>
            <span class="empty-fuel-hint">Tracks remaining calories & macros</span>
          </div>
        `}
      </div>

      <!-- 2. Two Compact Secondary Tiles -->
      <div class="compact-tiles-row">
        <!-- Tile 1: Pace -->
        <div class="compact-tile" id="tile-pace" title="View Pace & Roadmap">
          <div class="compact-tile-header">
            <span class="compact-tile-label">Pace</span>
            ${sparklineHtml}
          </div>

          <div class="compact-tile-val-wrap">
            <span class="compact-tile-number mono-num">${weeklyRateDisplay}</span>
            <span class="compact-tile-unit">${unit}/wk</span>
          </div>

          <div class="compact-tile-footer">
            <span class="compact-status-chip">${paceStatus}</span>
            <span class="compact-secondary-note mono-num">${monthlyRateDisplay}</span>
          </div>
        </div>

        <!-- Tile 2: BMI & Metabolism -->
        <div class="compact-tile" id="tile-bmi" title="View Metabolic Intelligence">
          <div class="compact-tile-header">
            <span class="compact-tile-label">BMI & Health</span>
            <span class="compact-status-chip ${bmiCatLabel.toLowerCase().includes('health') || bmiCatLabel.toLowerCase().includes('normal') ? 'good' : ''}">
              ${bmiCatLabel}
            </span>
          </div>

          <div class="compact-tile-val-wrap">
            <span class="compact-tile-number mono-num">${bmiDisplay}</span>
            <span class="compact-tile-unit">BMI</span>
          </div>

          <div class="compact-tile-footer">
            <span class="compact-secondary-note mono-num">${bmiSubtitle}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Events
  container.querySelector('#card-goal-progress')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-settings');
  });

  container.querySelector('#btn-configure-goal')?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    onAction('open-settings');
  });

  container.querySelector('#tile-pace')?.addEventListener('click', () => {
    triggerHaptic('selection');
    onAction('switch-tab', 'milestones');
  });

  container.querySelector('#tile-bmi')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-calc');
  });

  // Fuel card navigation
  container.querySelector('#card-today-fuel')?.addEventListener('click', () => {
    triggerHaptic('selection');
    onAction('switch-tab', 'fuel');
  });

  container.querySelector('#btn-today-log-meal')?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerHaptic('selection');
    onAction('switch-tab', 'fuel');
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
