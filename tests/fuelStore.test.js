import { describe, it, expect, beforeEach } from 'vitest';
import { store, getLocalDateString } from '../src/state.js';

describe('Fuel Store & Selectors (Phase E1)', () => {
  beforeEach(() => {
    store.clearAllData();
  });

  it('correctly formats local date string in YYYY-MM-DD format', () => {
    const d = new Date(2026, 9, 3, 14, 30); // Oct 3, 2026
    const str = getLocalDateString(d);
    expect(str).toBe('2026-10-03');
  });

  it('adds and updates a meal with automatic total calculation', () => {
    const meal = store.addMeal({
      title: 'Scrambled Eggs with Avocado',
      mealType: 'breakfast',
      items: [
        { name: 'Eggs', quantity: 3, unit: 'piece', kcal: 210, proteinG: 18, carbsG: 2, fatG: 15 },
        { name: 'Avocado', quantity: 0.5, unit: 'piece', kcal: 120, proteinG: 1.5, carbsG: 6, fatG: 11 }
      ]
    });

    expect(meal.id).toBeDefined();
    expect(meal.totals.kcal).toBe(330);
    expect(meal.totals.proteinG).toBe(19.5);
    expect(store.getState().meals.length).toBe(1);

    // Update meal
    const updated = store.updateMeal(meal.id, { title: 'Eggs & Guacamole' });
    expect(updated.title).toBe('Eggs & Guacamole');
  });

  it('supports delete meal and undo delete meal', () => {
    const meal = store.addMeal({
      title: 'Lunch Salad',
      totals: { kcal: 450, proteinG: 30, carbsG: 20, fatG: 25 }
    });

    expect(store.getState().meals.length).toBe(1);

    const deleted = store.deleteMeal(meal.id);
    expect(deleted.id).toBe(meal.id);
    expect(store.getState().meals.length).toBe(0);

    const restored = store.undoDeleteMeal();
    expect(restored.id).toBe(meal.id);
    expect(store.getState().meals.length).toBe(1);
  });

  it('duplicates a meal to target date', () => {
    const meal = store.addMeal({
      title: 'Dinner Salmon',
      localDate: '2026-10-01',
      totals: { kcal: 500, proteinG: 40, carbsG: 5, fatG: 30 }
    });

    const dup = store.duplicateMeal(meal.id, '2026-10-02');
    expect(dup.title).toBe('Dinner Salmon');
    expect(dup.localDate).toBe('2026-10-02');
    expect(dup.source).toBe('copy');
    expect(store.getState().meals.length).toBe(2);
  });

  it('logs water and provides undo', () => {
    const w = store.addWater(350);
    expect(w.ml).toBe(350);
    expect(store.getWaterByDay(getLocalDateString())).toBe(350);

    const undone = store.undoAddWater();
    expect(undone).toBe(true);
    expect(store.getWaterByDay(getLocalDateString())).toBe(0);
  });

  it('computes daily nutrition summary and week dots', () => {
    const today = getLocalDateString();
    store.addMeal({
      title: 'Protein Shake',
      localDate: today,
      totals: { kcal: 250, proteinG: 35, carbsG: 10, fatG: 3 }
    });

    const summary = store.getDailyNutritionSummary(today);
    expect(summary.consumed.kcal).toBe(250);
    expect(summary.consumed.proteinG).toBe(35);
    expect(summary.mealCount).toBe(1);
    expect(summary.target.kcal).toBeGreaterThan(1200);

    const dots = store.getWeekDots(today);
    expect(dots.length).toBe(7);
    const todayDot = dots.find(d => d.isToday);
    expect(todayDot).toBeDefined();
    expect(todayDot.hasMeals).toBe(true);
  });
});
