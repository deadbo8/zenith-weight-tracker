/**
 * Meal Detail Sheet Component
 * Detailed view of an existing logged meal with editing and deletion.
 */

import { fmtInt } from '../format.js';
import { triggerHaptic } from '../android.js';

export function openMealDetailSheet(meal, { onEdit, onDelete, onDuplicate }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop is-visible';
  overlay.id = 'modal-meal-detail';

  const itemsHtml = (meal.items || []).map(it => `
    <div class="meal-detail-item-row">
      <div class="item-name-col">
        <strong>${it.name}</strong>
        <span class="item-qty">${it.quantity} ${it.unit}${it.gramsEstimate ? ` (${it.gramsEstimate}g)` : ''}</span>
      </div>
      <div class="item-macros-col">
        <span>${it.kcal} kcal</span>
        <span class="item-submacros">P: ${it.proteinG}g · C: ${it.carbsG}g · F: ${it.fatG}g</span>
      </div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-detail-title">
      <div class="modal-sheet-handle"></div>
      <div class="meal-detail-sheet-content">
        <div class="meal-detail-header">
          <div class="meal-detail-type-badge">${meal.mealType.toUpperCase()}</div>
          <h2 class="meal-detail-title" id="meal-detail-title">${meal.title}</h2>
          <div class="meal-detail-time">
            Logged ${new Date(meal.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${meal.localDate}
          </div>
        </div>

        ${meal.photoPath ? `
          <div class="meal-detail-photo-wrap">
            <img src="${meal.photoPath}" class="meal-detail-large-photo" alt="${meal.title}" />
          </div>
        ` : ''}

        <div class="meal-detail-totals-card">
          <div class="detail-total-kcal">
            <strong>${fmtInt(meal.totals?.kcal || 0)}</strong> <span>kcal</span>
          </div>
          <div class="detail-total-macros">
            <div class="total-macro-pill">Protein <strong>${meal.totals?.proteinG || 0}g</strong></div>
            <div class="total-macro-pill">Carbs <strong>${meal.totals?.carbsG || 0}g</strong></div>
            <div class="total-macro-pill">Fat <strong>${meal.totals?.fatG || 0}g</strong></div>
          </div>
        </div>

        <div class="meal-detail-items-list">
          <h3 class="items-list-heading">Items (${meal.items?.length || 0})</h3>
          ${itemsHtml || '<div class="empty-items-note">Single dish entry</div>'}
        </div>

        <div class="meal-detail-actions">
          <button class="btn-sheet-secondary" id="btn-duplicate-meal">Duplicate to Today</button>
          <button class="btn-sheet-danger" id="btn-delete-meal">Delete Meal</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('#btn-duplicate-meal')?.addEventListener('click', () => {
    triggerHaptic('success');
    close();
    if (onDuplicate) onDuplicate(meal.id);
  });

  overlay.querySelector('#btn-delete-meal')?.addEventListener('click', () => {
    triggerHaptic('warning');
    close();
    if (onDelete) onDelete(meal.id);
  });
}
