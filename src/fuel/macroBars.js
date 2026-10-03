/**
 * Macro Bars & Hydration Component (Section 8.1)
 * Clean tabular progress bars for Protein, Carbs, Fat, and Quick Water Pill.
 */

import { fmt, fmtInt } from '../format.js';

export function createMacroBars({
  consumed = { proteinG: 0, carbsG: 0, fatG: 0 },
  target = { proteinG: 120, carbsG: 200, fatG: 55 },
  waterMl = 0,
  waterTargetMl = 2500,
  calmMode = false
}) {
  const calcPercent = (val, max) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((val / max) * 100));
  };

  const pPct = calcPercent(consumed.proteinG, target.proteinG);
  const cPct = calcPercent(consumed.carbsG, target.carbsG);
  const fPct = calcPercent(consumed.fatG, target.fatG);

  const waterL = (waterMl / 1000).toFixed(1);
  const waterTargetL = (waterTargetMl / 1000).toFixed(1);

  if (calmMode) {
    return `
      <div class="macro-bars-card">
        <div class="macro-calm-summary">
          <span>Macros balanced throughout day</span>
        </div>
        <div class="water-quick-pill" id="btn-quick-water">
          <span class="water-icon">💧</span>
          <span class="water-text">${waterL} / ${waterTargetL} L</span>
          <button class="water-add-btn" id="btn-add-water-quick" aria-label="Add 250 ml water">+250ml</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="macro-bars-card">
      <div class="macro-row" data-macro="protein">
        <div class="macro-header">
          <span class="macro-name">Protein</span>
          <span class="macro-numbers"><strong>${Math.round(consumed.proteinG)}</strong> / ${Math.round(target.proteinG)} g</span>
        </div>
        <div class="macro-track">
          <div class="macro-fill macro-protein" style="width: ${pPct}%"></div>
        </div>
      </div>

      <div class="macro-row" data-macro="carbs">
        <div class="macro-header">
          <span class="macro-name">Carbs</span>
          <span class="macro-numbers"><strong>${Math.round(consumed.carbsG)}</strong> / ${Math.round(target.carbsG)} g</span>
        </div>
        <div class="macro-track">
          <div class="macro-fill macro-carbs" style="width: ${cPct}%"></div>
        </div>
      </div>

      <div class="macro-row" data-macro="fat">
        <div class="macro-header">
          <span class="macro-name">Fat</span>
          <span class="macro-numbers"><strong>${Math.round(consumed.fatG)}</strong> / ${Math.round(target.fatG)} g</span>
        </div>
        <div class="macro-track">
          <div class="macro-fill macro-fat" style="width: ${fPct}%"></div>
        </div>
      </div>

      <div class="water-quick-pill" id="btn-quick-water">
        <div class="water-left">
          <span class="water-icon">💧</span>
          <span class="water-text">${waterL} / ${waterTargetL} L</span>
        </div>
        <button class="water-add-btn" id="btn-add-water-quick" aria-label="Add 250 ml water">+250ml</button>
      </div>
    </div>
  `;
}
