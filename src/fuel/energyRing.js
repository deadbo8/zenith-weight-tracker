/**
 * Energy Ring Component (Section 8.1 & 8.7)
 * Multi-layer SVG progress ring: track, consumed progress, and neutral gray lap for overages.
 * Supports Calm Mode, tabular typography, and spring transition.
 */

import { fmt, fmtInt } from '../format.js';

export function createEnergyRing({
  targetKcal = 2000,
  consumedKcal = 0,
  calmMode = false,
  size = 140,
  strokeWidth = 12
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = targetKcal > 0 ? Math.min(1, consumedKcal / targetKcal) : 0;
  const offset = circumference * (1 - percent);

  const isOver = consumedKcal > targetKcal;
  const overKcal = isOver ? consumedKcal - targetKcal : 0;
  const remainingKcal = Math.max(0, targetKcal - consumedKcal);

  // Overlap second thin lap if over target (neutral gray, never red!)
  const overPercent = targetKcal > 0 && isOver ? Math.min(1, overKcal / targetKcal) : 0;
  const overOffset = circumference * (1 - overPercent);

  let centerHtml = '';
  if (calmMode) {
    let word = 'Room left';
    if (consumedKcal === 0) word = 'Start day';
    else if (isOver) word = 'Plenty eaten';
    else if (percent >= 0.85) word = 'On track';
    else if (percent >= 0.5) word = 'Halfway';

    centerHtml = `
      <div class="ring-calm-label">${word}</div>
      <button class="ring-calm-toggle" id="btn-toggle-calm-nums" aria-label="Show calorie numbers">Show numbers</button>
    `;
  } else {
    if (isOver) {
      centerHtml = `
        <div class="ring-value is-over">${fmtInt(overKcal)}</div>
        <div class="ring-unit">kcal over</div>
        <div class="ring-subcaption">Goal ${fmtInt(targetKcal)}</div>
      `;
    } else {
      centerHtml = `
        <div class="ring-value">${fmtInt(remainingKcal)}</div>
        <div class="ring-unit">kcal left</div>
        <div class="ring-subcaption">Eaten ${fmtInt(consumedKcal)} · Goal ${fmtInt(targetKcal)}</div>
      `;
    }
  }

  return `
    <div class="energy-ring-card">
      <div class="energy-ring-container" style="width: ${size}px; height: ${size}px;">
        <svg class="energy-ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <!-- Background track -->
          <circle
            class="ring-bg"
            cx="${size / 2}" cy="${size / 2}" r="${radius}"
            stroke="var(--fill-tertiary)"
            stroke-width="${strokeWidth}"
            fill="none"
          />
          <!-- Progress stroke (accent) -->
          <circle
            class="ring-progress"
            cx="${size / 2}" cy="${size / 2}" r="${radius}"
            stroke="var(--accent-primary)"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
            fill="none"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 ${size / 2} ${size / 2})"
          />
          ${isOver ? `
          <!-- Over target lap (neutral gray, thin, never red) -->
          <circle
            class="ring-over"
            cx="${size / 2}" cy="${size / 2}" r="${radius - 3}"
            stroke="var(--text-muted)"
            stroke-width="3"
            stroke-linecap="round"
            fill="none"
            stroke-dasharray="${2 * Math.PI * (radius - 3)}"
            stroke-dashoffset="${overOffset}"
            transform="rotate(-90 ${size / 2} ${size / 2})"
          />
          ` : ''}
        </svg>
        <div class="ring-center-content">
          ${centerHtml}
        </div>
      </div>
    </div>
  `;
}
