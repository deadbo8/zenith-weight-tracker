import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateFormulaTDEE,
  calculateEnergyTarget,
  calculateMacroTargets,
  isDayComplete,
  summarizeDay,
  calculateAdaptiveTDEE,
  calculateForecastWhatIf,
  CALORIE_FLOORS
} from '../src/nutrition.js';

describe('Phase C - Section 5: Nutrition Engine', () => {
  it('calculateBMR and formula TDEE match standard metabolic equations', () => {
    // 80kg male, 180cm, 30y: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmrMale = calculateBMR(80, 180, 30, 'male');
    expect(bmrMale).toBe(1780);

    const tdeeMale = calculateFormulaTDEE(80, 180, 30, 'male', 'moderate');
    // 1780 * 1.55 = 2759
    expect(tdeeMale).toBe(2759);
  });

  it('calculateEnergyTarget respects safety floors and under-18 / underweight guard', () => {
    // Underweight (BMI < 18.5)
    const underweight = calculateEnergyTarget({
      weightKg: 45,
      heightCm: 170, // BMI = 15.6
      age: 25,
      sex: 'female',
      goalType: 'lose'
    });
    expect(underweight.deficit).toBe(0);
    expect(underweight.safetyNote).toContain('professional');

    // Calorie Floor test (female floor 1200)
    const smallDeficit = calculateEnergyTarget({
      weightKg: 50,
      heightCm: 155,
      age: 40,
      sex: 'female',
      activityLevel: 'sedentary', // TDEE is low
      goalType: 'lose',
      weeklyRatePref: 1.0 // 1100 kcal deficit would go below 1200
    });
    expect(smallDeficit.targetKcal).toBe(CALORIE_FLOORS.female);
    expect(smallDeficit.isFloorApplied).toBe(true);
  });

  it('calculateMacroTargets calculates correct grams for presets', () => {
    const targets = calculateMacroTargets({
      targetKcal: 2000,
      weightKg: 80,
      preset: 'balanced',
      goalType: 'lose'
    });
    // 80kg * 1.6 = 128g protein = 512 kcal
    expect(targets.proteinG).toBe(128);
    // 25% of 2000 = 500 kcal / 9 = 56g fat
    expect(targets.fatG).toBe(56);
    // Remainder: 2000 - (512 + 504) = 984 / 4 = 246g carbs
    expect(targets.carbsG).toBe(246);
    expect(targets.waterMl).toBe(2800); // 35 * 80
  });

  it('isDayComplete enforces the heuristic', () => {
    expect(isDayComplete({ meals: [{ totals: { kcal: 500 } }] })).toBe(false);
    expect(isDayComplete({ meals: [{ totals: { kcal: 500 } }, { totals: { kcal: 350 } }] })).toBe(true); // >= 2 & >= 800
    expect(isDayComplete({ dayMeta: { complete: true }, meals: [] })).toBe(true);
  });

  it('summarizeDay correctly identifies on-target days and negative remaining', () => {
    const target = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 };
    const meals = [
      { totals: { kcal: 1200, proteinG: 90, carbsG: 120, fatG: 35 } },
      { totals: { kcal: 900, proteinG: 70, carbsG: 90, fatG: 30 } }
    ];
    const summary = summarizeDay({ meals, waterLogs: [{ ml: 500 }], target });
    expect(summary.consumed.kcal).toBe(2100);
    expect(summary.remaining.kcal).toBe(-100); // 100 over
    expect(summary.withinRange).toBe(true); // 2100 is within 10% of 2000
    expect(summary.waterTotalMl).toBe(500);
  });

  it('calculateAdaptiveTDEE calculates observed expenditure accurately', () => {
    // 14 days, 12 complete days, known 500 kcal deficit and stable weight
    const weighIns = [
      { date: '2026-09-01T08:00:00Z', weight: 80.0 },
      { date: '2026-09-03T08:00:00Z', weight: 80.0 },
      { date: '2026-09-05T08:00:00Z', weight: 80.0 },
      { date: '2026-09-07T08:00:00Z', weight: 80.0 },
      { date: '2026-09-09T08:00:00Z', weight: 80.0 },
      { date: '2026-09-11T08:00:00Z', weight: 80.0 },
      { date: '2026-09-13T08:00:00Z', weight: 80.0 },
      { date: '2026-09-15T08:00:00Z', weight: 80.0 }
    ];
    const dailyIntake = {};
    for (let i = 1; i <= 15; i++) {
      dailyIntake[`2026-09-${String(i).padStart(2, '0')}`] = { kcal: 2200, isComplete: true };
    }

    const res = calculateAdaptiveTDEE({
      weighInEntries: weighIns,
      dailyIntakeMap: dailyIntake,
      formulaTDEE: 2500
    });

    expect(res.status).toBe('ready');
    // If weight stayed constant with 2200 kcal, observed TDEE is 2200!
    expect(res.observedTDEE).toBe(2200);
    expect(res.tdeeUsed).toBeLessThan(2500);
  });

  it('calculateForecastWhatIf projects arrival dates and flags impossible balances', () => {
    // Current 80kg, goal 75kg, tdee 2500, target 2000 (-500 kcal/day)
    const proj = calculateForecastWhatIf({
      targetKcal: 2000,
      currentWeight: 80,
      goalWeight: 75,
      tdeeUsed: 2500
    });
    expect(proj.achievable).toBe(true);
    expect(proj.days).toBeGreaterThan(60);
    expect(proj.days).toBeLessThan(90); // ~77 days

    // Surplus when trying to lose weight
    const badProj = calculateForecastWhatIf({
      targetKcal: 2800,
      currentWeight: 80,
      goalWeight: 75,
      tdeeUsed: 2500
    });
    expect(badProj.achievable).toBe(false);
  });
});
