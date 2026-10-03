/**
 * Meal Timeline Component (Section 8.1)
 * Inset-grouped meals by type: Breakfast, Lunch, Dinner, Snacks.
 * Includes thumbnails, calorie totals, tap to inspect, and section add buttons.
 */

import { fmtInt } from '../format.js';
import { triggerHaptic } from '../android.js';

const MEAL_SECTIONS = [
  { key: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { key: 'lunch', label: 'Lunch', icon: '🍲' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snack', label: 'Snacks', icon: '🍎' }
];

export function createMealTimeline(meals = [], calmMode = false, isDayFinished = false) {
  const sectionsHtml = MEAL_SECTIONS.map(sec => {
    const secMeals = meals.filter(m => m.mealType === sec.key);
    const secKcal = secMeals.reduce((sum, m) => sum + (m.totals?.kcal || 0), 0);

    const mealRows = secMeals.map(m => {
      const itemsCount = m.items?.length || 1;
      const thumb = m.thumbPath || m.photoPath;
      const kcalDisplay = calmMode ? '' : `<span class="meal-row-kcal">${fmtInt(m.totals?.kcal || 0)} kcal</span>`;

      return `
        <div class="meal-timeline-row" data-meal-id="${m.id}" role="button" tabindex="0">
          <div class="meal-thumb-container">
            ${thumb ? `
              <img src="${thumb}" class="meal-thumb" alt="${m.title}" loading="lazy" />
            ` : `
              <div class="meal-thumb-placeholder">${sec.icon}</div>
            `}
          </div>
          <div class="meal-info">
            <div class="meal-title">${m.title}</div>
            <div class="meal-subtitle">${itemsCount} ${itemsCount === 1 ? 'item' : 'items'} · ${m.totals?.proteinG || 0}g protein</div>
          </div>
          <div class="meal-right">
            ${kcalDisplay}
            <span class="meal-chevron">›</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="meal-section-group" data-section="${sec.key}">
        <div class="meal-section-header">
          <div class="meal-section-title-wrap">
            <span class="meal-section-title">${sec.label}</span>
            ${(!calmMode && secKcal > 0) ? `<span class="meal-section-kcal">${fmtInt(secKcal)} kcal</span>` : ''}
          </div>
          <button class="meal-section-add-btn" data-add-meal-type="${sec.key}" aria-label="Add ${sec.label}">+ Add</button>
        </div>
        <div class="meal-section-items">
          ${secMeals.length > 0 ? mealRows : `
            <div class="meal-empty-slot">
              <span>No ${sec.label.toLowerCase()} logged yet</span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="meal-timeline-container">
      ${sectionsHtml}

      <div class="meal-timeline-footer">
        <button class="btn-finish-day ${isDayFinished ? 'is-finished' : ''}" id="btn-finish-day">
          ${isDayFinished ? '✓ Day Marked Complete' : 'Finish Day'}
        </button>
      </div>
    </div>
  `;
}

export function bindMealTimeline(container, { onOpenMeal, onAddMeal, onFinishDay }) {
  if (!container) return;

  // Meal row clicks
  container.querySelectorAll('.meal-timeline-row').forEach(row => {
    row.addEventListener('click', () => {
      const mealId = row.getAttribute('data-meal-id');
      if (mealId && onOpenMeal) {
        triggerHaptic('light');
        onOpenMeal(mealId);
      }
    });
  });

  // Section add buttons
  container.querySelectorAll('[data-add-meal-type]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-add-meal-type');
      if (type && onAddMeal) {
        triggerHaptic('light');
        onAddMeal(type);
      }
    });
  });

  // Finish day button
  const finishBtn = container.querySelector('#btn-finish-day');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      triggerHaptic('success');
      if (onFinishDay) onFinishDay();
    });
  }
}
