/**
 * Day Strip Component (Section 8.1)
 * Horizontal week calendar with dots indicating logged intake & complete days.
 */

import { triggerHaptic } from '../android.js';

export function createDayStrip(weekDots = [], selectedDate, onSelectDate) {
  const dotsHtml = weekDots.map(d => {
    const isSel = d.isSelected || d.date === selectedDate;
    const isToday = d.isToday;
    const hasMeals = d.hasMeals;
    const isComplete = d.isComplete;

    return `
      <button
        class="day-strip-item ${isSel ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}"
        data-date="${d.date}"
        aria-label="${d.dayLabel} ${d.dayNumber}, ${hasMeals ? d.mealCount + ' meals' : 'no meals'}"
      >
        <span class="day-strip-name">${d.dayLabel}</span>
        <span class="day-strip-number">${d.dayNumber}</span>
        <span class="day-strip-dot ${isComplete ? 'is-complete' : (hasMeals ? 'is-logged' : '')}"></span>
      </button>
    `;
  }).join('');

  return `
    <div class="day-strip-container" data-no-sheet-drag>
      <div class="day-strip-track">
        ${dotsHtml}
      </div>
    </div>
  `;
}

export function bindDayStrip(container, onSelectDate) {
  if (!container) return;
  const items = container.querySelectorAll('.day-strip-item');
  items.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const date = btn.getAttribute('data-date');
      if (date) {
        triggerHaptic('selection');
        onSelectDate(date);
      }
    });
  });
}
