/**
 * Add Food Sheet Component (Section 8.2)
 * Clean manual entry for meals when no AI or photo is desired.
 */

import { triggerHaptic } from '../android.js';

export function openAddFoodSheet(defaultMealType = 'lunch', onSaveMeal) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop is-visible';
  overlay.id = 'modal-add-food';

  overlay.innerHTML = `
    <div class="modal-sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="add-food-title">
      <div class="modal-sheet-handle"></div>
      <div class="add-food-content">
        <h2 class="add-food-title" id="add-food-title">Add Food</h2>

        <div class="form-field">
          <label class="field-label" for="food-name">Food or Dish Name</label>
          <input type="text" id="food-name" class="field-input" placeholder="e.g. Oatmeal with peanut butter" autofocus />
        </div>

        <div class="form-field">
          <label class="field-label" for="food-meal-type">Meal</label>
          <select id="food-meal-type" class="field-input">
            <option value="breakfast" ${defaultMealType === 'breakfast' ? 'selected' : ''}>Breakfast</option>
            <option value="lunch" ${defaultMealType === 'lunch' ? 'selected' : ''}>Lunch</option>
            <option value="dinner" ${defaultMealType === 'dinner' ? 'selected' : ''}>Dinner</option>
            <option value="snack" ${defaultMealType === 'snack' ? 'selected' : ''}>Snack</option>
          </select>
        </div>

        <div class="form-field">
          <label class="field-label" for="food-kcal">Calories (kcal)</label>
          <input type="number" id="food-kcal" class="field-input" placeholder="e.g. 450" inputmode="numeric" />
        </div>

        <div class="macros-grid-input">
          <div class="form-field">
            <label class="field-label" for="food-protein">Protein (g)</label>
            <input type="number" id="food-protein" class="field-input" placeholder="25" inputmode="decimal" />
          </div>
          <div class="form-field">
            <label class="field-label" for="food-carbs">Carbs (g)</label>
            <input type="number" id="food-carbs" class="field-input" placeholder="50" inputmode="decimal" />
          </div>
          <div class="form-field">
            <label class="field-label" for="food-fat">Fat (g)</label>
            <input type="number" id="food-fat" class="field-input" placeholder="12" inputmode="decimal" />
          </div>
        </div>

        <div class="add-food-actions">
          <button class="btn-sheet-secondary" id="btn-cancel-add-food">Cancel</button>
          <button class="btn-sheet-primary" id="btn-save-add-food">Save Meal</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('#btn-cancel-add-food')?.addEventListener('click', () => {
    triggerHaptic('light');
    close();
  });

  overlay.querySelector('#btn-save-add-food')?.addEventListener('click', () => {
    const name = overlay.querySelector('#food-name')?.value.trim() || 'Meal';
    const type = overlay.querySelector('#food-meal-type')?.value || defaultMealType;
    const kcal = parseFloat(overlay.querySelector('#food-kcal')?.value) || 0;
    const proteinG = parseFloat(overlay.querySelector('#food-protein')?.value) || 0;
    const carbsG = parseFloat(overlay.querySelector('#food-carbs')?.value) || 0;
    const fatG = parseFloat(overlay.querySelector('#food-fat')?.value) || 0;

    triggerHaptic('success');
    close();

    if (onSaveMeal) {
      onSaveMeal({
        title: name,
        mealType: type,
        source: 'manual',
        items: [
          {
            id: `item_${Date.now()}`,
            name,
            quantity: 1,
            unit: 'serving',
            kcal,
            proteinG,
            carbsG,
            fatG,
            confidence: 1.0
          }
        ],
        totals: { kcal, proteinG, carbsG, fatG }
      });
    }
  });
}
