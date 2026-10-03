/**
 * Meal Confirm Card Component (Section 8.4)
 * Editable preview card before saving AI-analyzed or parsed meals.
 * Includes portion steppers, macro summaries, confidence cues, and follow-up chips.
 */

import { fmtInt } from '../format.js';
import { scaleItem } from '../nutrition.js';
import { triggerHaptic } from '../android.js';

export function createMealConfirmCard(mealDraft, profileAllergies = []) {
  if (!mealDraft) return '';

  const { title, mealType, items = [], totals, kcalLow, kcalHigh, overallConfidence = 0.8, photoPath, thumbPath } = mealDraft;

  const isRough = overallConfidence < 0.5;
  const dotsFilled = overallConfidence >= 0.8 ? 3 : (overallConfidence >= 0.5 ? 2 : 1);
  const confidenceDots = '●'.repeat(dotsFilled) + '○'.repeat(3 - dotsFilled);

  // Check allergies
  const allergyHits = [];
  if (Array.isArray(profileAllergies) && profileAllergies.length > 0) {
    const mealText = (title + ' ' + items.map(i => i.name).join(' ')).toLowerCase();
    for (const alg of profileAllergies) {
      if (alg && mealText.includes(alg.toLowerCase())) {
        allergyHits.push(alg);
      }
    }
  }

  // Items rows
  const itemRows = items.map((it, idx) => {
    const qty = it.quantity != null ? it.quantity : 1;
    const unitStr = it.unit || 'portion';
    const gramsStr = it.gramsEstimate || it.grams ? ` (${it.gramsEstimate || it.grams}g)` : '';
    return `
      <div class="confirm-item-row" data-item-idx="${idx}">
        <div class="confirm-item-info">
          <div class="confirm-item-name">${it.name}</div>
          <div class="confirm-item-meta">${qty} ${unitStr}${gramsStr}</div>
        </div>
        <div class="confirm-item-controls">
          <div class="confirm-stepper">
            <button class="btn-stepper-sub" data-sub-idx="${idx}" aria-label="Decrease portion">−</button>
            <span class="stepper-val">${qty}</span>
            <button class="btn-stepper-add" data-add-idx="${idx}" aria-label="Increase portion">+</button>
          </div>
          <div class="confirm-item-kcal">${fmtInt(it.kcal)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Collect assumptions
  const allAssumptions = [];
  for (const it of items) {
    if (Array.isArray(it.assumptions)) {
      for (const a of it.assumptions) {
        if (!allAssumptions.includes(a)) allAssumptions.push(a);
      }
    }
  }

  return `
    <div class="meal-confirm-card" id="active-meal-confirm-card">
      <div class="confirm-card-header">
        ${(thumbPath || photoPath) ? `
          <img src="${thumbPath || photoPath}" class="confirm-photo" alt="Meal photo" />
        ` : ''}
        <div class="confirm-header-content">
          <div class="confirm-title-row">
            <span class="confirm-title">${title || 'Logged Meal'}</span>
            <select class="confirm-type-select" id="confirm-meal-type">
              <option value="breakfast" ${mealType === 'breakfast' ? 'selected' : ''}>Breakfast</option>
              <option value="lunch" ${mealType === 'lunch' ? 'selected' : ''}>Lunch</option>
              <option value="dinner" ${mealType === 'dinner' ? 'selected' : ''}>Dinner</option>
              <option value="snack" ${mealType === 'snack' ? 'selected' : ''}>Snack</option>
            </select>
          </div>
          <div class="confirm-kcal-headline">
            about <strong>${fmtInt(totals?.kcal || 0)}</strong> kcal
            ${(kcalLow && kcalHigh) ? `<span class="confirm-kcal-range">(${fmtInt(kcalLow)} to ${fmtInt(kcalHigh)})</span>` : ''}
          </div>
          <div class="confirm-confidence-row">
            <span class="confidence-dots">${confidenceDots}</span>
            <span class="confidence-label">${isRough ? 'Rough estimate' : 'Good estimate'}</span>
            ${allAssumptions.length > 0 ? `
              <button class="btn-disclosure" id="btn-toggle-assumptions">How I estimated ▸</button>
            ` : ''}
          </div>
        </div>
      </div>

      ${allAssumptions.length > 0 ? `
        <div class="confirm-assumptions-box hidden" id="confirm-assumptions-box">
          <div class="assumptions-title">Assumptions made:</div>
          <ul>
            ${allAssumptions.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${allergyHits.length > 0 ? `
        <div class="confirm-allergy-warning">
          ⚠️ Contains ${allergyHits.join(', ')} (from your profile)
        </div>
      ` : ''}

      <div class="confirm-items-list">
        ${itemRows}
      </div>

      <div class="confirm-card-macros">
        <span>Protein <strong>${Math.round(totals?.proteinG || 0)}g</strong></span>
        <span>Carbs <strong>${Math.round(totals?.carbsG || 0)}g</strong></span>
        <span>Fat <strong>${Math.round(totals?.fatG || 0)}g</strong></span>
      </div>

      <div class="confirm-card-actions">
        <button class="btn-confirm-discard" id="btn-confirm-discard">Discard</button>
        <button class="btn-confirm-save" id="btn-confirm-save">Log meal</button>
      </div>
    </div>
  `;
}

export function bindMealConfirmCard(cardElem, draft, { onUpdate, onSave, onDiscard, onFollowUp }) {
  if (!cardElem || !draft) return;

  // Toggle assumptions
  const toggleBtn = cardElem.querySelector('#btn-toggle-assumptions');
  const assumptionsBox = cardElem.querySelector('#confirm-assumptions-box');
  if (toggleBtn && assumptionsBox) {
    toggleBtn.addEventListener('click', () => {
      assumptionsBox.classList.toggle('hidden');
      toggleBtn.textContent = assumptionsBox.classList.contains('hidden') ? 'How I estimated ▸' : 'How I estimated ▾';
    });
  }

  // Meal type change
  const typeSelect = cardElem.querySelector('#confirm-meal-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      draft.mealType = e.target.value;
      if (onUpdate) onUpdate(draft);
    });
  }

  // Steppers (Add / Subtract portion)
  cardElem.querySelectorAll('[data-sub-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sub-idx'), 10);
      if (draft.items[idx]) {
        triggerHaptic('selection');
        const it = draft.items[idx];
        const newQty = Math.max(0.5, Math.round((it.quantity - (it.quantity > 2 ? 1 : 0.5)) * 10) / 10);
        draft.items[idx] = scaleItem(it, newQty);
        recomputeDraftTotals(draft);
        if (onUpdate) onUpdate(draft);
      }
    });
  });

  cardElem.querySelectorAll('[data-add-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-add-idx'), 10);
      if (draft.items[idx]) {
        triggerHaptic('selection');
        const it = draft.items[idx];
        const newQty = Math.round((it.quantity + (it.quantity >= 2 ? 1 : 0.5)) * 10) / 10;
        draft.items[idx] = scaleItem(it, newQty);
        recomputeDraftTotals(draft);
        if (onUpdate) onUpdate(draft);
      }
    });
  });

  // Discard & Save
  const discardBtn = cardElem.querySelector('#btn-confirm-discard');
  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      triggerHaptic('warning');
      if (onDiscard) onDiscard(draft);
    });
  }

  const saveBtn = cardElem.querySelector('#btn-confirm-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      triggerHaptic('success');
      if (onSave) onSave(draft);
    });
  }
}

function recomputeDraftTotals(draft) {
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const it of draft.items) {
    kcal += it.kcal || 0;
    p += it.proteinG || 0;
    c += it.carbsG || 0;
    f += it.fatG || 0;
  }
  draft.totals = {
    kcal,
    proteinG: Math.round(p * 10) / 10,
    carbsG: Math.round(c * 10) / 10,
    fatG: Math.round(f * 10) / 10
  };
  draft.kcalLow = Math.round(kcal * 0.85);
  draft.kcalHigh = Math.round(kcal * 1.15);
}
