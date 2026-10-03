/**
 * Milestone Roadmap & Smart Pace Forecasting Component (Journey Screen)
 * - Hero forecast sentence ("Projected 12 Mar, 6 days ahead of target").
 * - Vertical stepper with check rings: current checkpoint emphasized, completed fade to secondary text.
 */

import { store } from '../state.js';
import { calculateKPIs } from '../analytics.js';
import { triggerHaptic } from '../android.js';
import { projectedDate } from '../nutrition.js';

export function renderRoadmap(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const kpis = calculateKPIs(state.entries, state.profile);
  const hasEntries = state.entries.length > 0;
  const startWeight = state.profile.startWeight || (hasEntries ? state.entries[0].weight : null);
  const goalWeight = state.profile.goalWeight || null;

  if (startWeight == null || goalWeight == null) {
    container.innerHTML = `
      <div class="content-card">
        <div class="card-title-row">
          <h3 class="card-title">
            <i data-lucide="compass" style="color: var(--accent-primary);"></i>
            Journey & Roadmap
          </h3>
          <button class="btn btn-ghost" id="btn-roadmap-setup" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">
            <span>Configure</span>
          </button>
        </div>
        <div class="empty-state">
          <p style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">Set Your Target Milestones</p>
          <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 280px;">
            Configure your start and goal weight in settings to unlock automated trajectory checkpoints and arrival forecasting.
          </p>
          <button class="btn btn-secondary" id="btn-roadmap-setup-2" style="margin-top: 0.75rem; font-size: 0.82rem;">
            <span>Set Goals</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-roadmap-setup')?.addEventListener('click', () => onAction('open-settings'));
    container.querySelector('#btn-roadmap-setup-2')?.addEventListener('click', () => onAction('open-settings'));
    return;
  }

  const totalJourney = goalWeight - startWeight;
  const m25 = startWeight + totalJourney * 0.25;
  const m50 = startWeight + totalJourney * 0.50;
  const m75 = startWeight + totalJourney * 0.75;

  const current = kpis.currentWeight;
  const isLoss = totalJourney < 0;

  const isCompleted = (target) => {
    if (!hasEntries || current == null) return false;
    return isLoss ? current <= target : current >= target;
  };

  // Forecast hero sentence
  let forecastHeroHtml = '';
  if (kpis.projectedDate) {
    const projDate = new Date(kpis.projectedDate);
    const dateFormatted = projDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    let comparison = '';
    if (state.profile.targetDate) {
      const userTarget = new Date(state.profile.targetDate);
      const diffDays = Math.round((userTarget - projDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        comparison = ` · <span style="color: var(--accent-primary); font-weight: 500;">${diffDays} days ahead of target</span>`;
      } else if (diffDays < 0) {
        comparison = ` · <span style="color: var(--text-secondary); font-weight: 500;">${Math.abs(diffDays)} days behind target</span>`;
      }
    }

    forecastHeroHtml = `
      <div class="journey-forecast-card">
        <span class="journey-forecast-label">Smart Trajectory</span>
        <h3 class="journey-forecast-headline">${kpis.projectedDate ? `Projected ${new Date(kpis.projectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Holding steady towards goal'}</h3>
        <p class="journey-forecast-sub mono-num">
          Target: ${store.formatWeight(goalWeight)} · Current: ${store.formatWeight(current)}
        </p>

        <!-- What-If Intake Simulator (Section 5.5 & 8.5) -->
        <div class="what-if-box" data-no-sheet-drag>
          <div class="what-if-header">
            <span class="what-if-title">⚡ What If? Intake Simulator</span>
            <span class="what-if-val mono-num" id="what-if-kcal-val">2,000 kcal/day</span>
          </div>
          <input
            type="range"
            class="what-if-slider"
            id="what-if-slider"
            min="1200"
            max="3000"
            step="50"
            value="2000"
            aria-label="What If daily calorie intake"
          />
          <div class="what-if-result mono-num" id="what-if-result-text">
            Move slider to project goal date based on calorie intake
          </div>
        </div>
      </div>
    `;
  }

  const steps = [
    { label: 'Start Baseline', weight: startWeight, completed: isCompleted(startWeight) },
    { label: '25% Checkpoint', weight: m25, completed: isCompleted(m25) },
    { label: 'Halfway Mark (50%)', weight: m50, completed: isCompleted(m50) },
    { label: '75% Checkpoint', weight: m75, completed: isCompleted(m75) },
    { label: 'Target Goal', weight: goalWeight, completed: isCompleted(goalWeight) }
  ];

  // Find current active step index
  let currentIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].completed) {
      currentIdx = i;
      break;
    }
    if (i === steps.length - 1) currentIdx = steps.length - 1;
  }

  container.innerHTML = `
    <div class="journey-roadmap-card">
      <div class="card-title-row" style="margin-bottom: 0.75rem;">
        <h3 class="card-title">
          <i data-lucide="milestone" style="color: var(--accent-primary);"></i>
          Roadmap Checkpoints
        </h3>
        <button class="btn btn-ghost" id="btn-edit-target" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">
          <span>Edit Goals</span>
        </button>
      </div>

      ${forecastHeroHtml}

      <!-- Vertical Stepper with Apple Check Rings -->
      <div class="vertical-roadmap-stepper">
        ${steps.map((step, idx) => {
          const isDone = step.completed;
          const isCurrent = idx === currentIdx;
          const statusClass = isDone ? 'completed' : isCurrent ? 'current' : 'upcoming';

          return `
            <div class="stepper-row ${statusClass}">
              <div class="stepper-indicator">
                <div class="stepper-ring">
                  ${isDone ? '<i data-lucide="check" class="stepper-check-icon"></i>' : isCurrent ? '<div class="stepper-current-dot"></div>' : ''}
                </div>
                ${idx < steps.length - 1 ? '<div class="stepper-line"></div>' : ''}
              </div>

              <div class="stepper-content">
                <div class="stepper-title-row">
                  <span class="stepper-title">${step.label}</span>
                  <span class="stepper-weight mono-num">${store.formatWeight(step.weight)}</span>
                </div>
                ${isCurrent ? '<div class="stepper-current-badge">In Progress</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-edit-target')?.addEventListener('click', () => {
    triggerHaptic('light');
    onAction('open-settings');
  });

  // What-if slider interaction
  const slider = container.querySelector('#what-if-slider');
  const valLabel = container.querySelector('#what-if-kcal-val');
  const resText = container.querySelector('#what-if-result-text');

  slider?.addEventListener('input', (e) => {
    const kcal = parseInt(e.target.value, 10);
    if (valLabel) valLabel.textContent = `${kcal.toLocaleString()} kcal/day`;
    const proj = projectedDate(state, kcal);
    if (resText) {
      if (proj) {
        const d = new Date(proj);
        resText.textContent = `Projected arrival: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        resText.textContent = `Pace is neutral or near maintenance`;
      }
    }
  });

  if (window.lucide) window.lucide.createIcons();
}
