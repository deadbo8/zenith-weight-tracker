/**
 * Zenith 2.0 Nutrition & Metabolism Intelligence Engine (Section 5)
 * Pure, deterministic nutrition calculation library.
 * - Energy target with biological safety floors and BMI guards
 * - Macro presets (Balanced, High Protein, Low Carb, Custom)
 * - Complete-day heuristics to prevent skewed averages
 * - Adaptive TDEE (observed expenditure blending)
 * - Forecast What-If calculator
 */

import { isNum } from './format.js';

export const CALORIE_FLOORS = {
  female: 1200,
  male: 1500,
  unspecified: 1350
};

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

/**
 * Calculate resting BMR via Mifflin-St Jeor
 */
export function calculateBMR(weightKg, heightCm, age, sex = 'male') {
  if (!isNum(weightKg) || weightKg <= 0) return 1600;
  const h = isNum(heightCm) && heightCm > 0 ? heightCm : 175;
  const a = isNum(age) && age > 0 ? age : 30;
  if (sex === 'female') {
    return Math.round(10 * weightKg + 6.25 * h - 5 * a - 161);
  }
  return Math.round(10 * weightKg + 6.25 * h - 5 * a + 5);
}

/**
 * Calculate baseline formula TDEE
 */
export function calculateFormulaTDEE(weightKg, heightCm, age, sex, activityLevel = 'moderate') {
  const bmr = calculateBMR(weightKg, heightCm, age, sex);
  const mult = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  return Math.round(bmr * mult);
}

/**
 * Calculate Daily Energy Target with Safety Rails (Section 5.1)
 */
export function calculateEnergyTarget({
  weightKg,
  heightCm,
  age = 30,
  sex = 'male',
  activityLevel = 'moderate',
  goalType = 'lose', // 'lose' | 'maintain' | 'gain'
  weeklyRatePref = 0.5, // kg/week
  customKcal = null,
  calorieMode = 'auto'
}) {
  const tdee = calculateFormulaTDEE(weightKg, heightCm, age, sex, activityLevel);
  const floor = CALORIE_FLOORS[sex] || CALORIE_FLOORS.unspecified;
  const bmi = (weightKg && heightCm) ? weightKg / Math.pow(heightCm / 100, 2) : 22;

  // Under-18 or Underweight (BMI < 18.5) guard: no automatic deficit
  if (age < 18 || bmi < 18.5) {
    return {
      targetKcal: tdee,
      formulaTDEE: tdee,
      deficit: 0,
      isFloorApplied: false,
      safetyNote: 'A professional can help set a plan that fits you.'
    };
  }

  if (calorieMode === 'custom' && isNum(customKcal) && customKcal > 0) {
    const isFloorApplied = customKcal < floor;
    return {
      targetKcal: Math.round(customKcal),
      formulaTDEE: tdee,
      deficit: tdee - customKcal,
      isFloorApplied,
      safetyNote: isFloorApplied ? 'We set a minimum so your plan stays sustainable.' : null
    };
  }

  // Rate in kcal/day (7700 kcal per kg)
  const rateKcal = (weeklyRatePref * 7700) / 7;
  let target = tdee;
  let deficit = 0;

  if (goalType === 'lose') {
    // Max deficit capped at min(rateKcal, 25% of TDEE, 1000 kcal)
    const maxDeficit = Math.min(rateKcal, 0.25 * tdee, 1000);
    target = tdee - maxDeficit;
    deficit = maxDeficit;
  } else if (goalType === 'gain') {
    const surplus = Math.min(rateKcal, 500);
    target = tdee + surplus;
    deficit = -surplus;
  }

  let isFloorApplied = false;
  let safetyNote = null;

  if (target < floor) {
    target = floor;
    isFloorApplied = true;
    safetyNote = 'We set a minimum so your plan stays sustainable.';
  }

  // Check if pace exceeds 1% of body weight per week
  if (weightKg && (weeklyRatePref / weightKg) > 0.01) {
    safetyNote = safetyNote || 'A gentler pace helps preserve lean muscle mass.';
  }

  return {
    targetKcal: Math.round(target),
    formulaTDEE: tdee,
    deficit: Math.round(deficit),
    isFloorApplied,
    safetyNote
  };
}

/**
 * Calculate Macro Targets (Section 5.2)
 */
export function calculateMacroTargets({
  targetKcal,
  weightKg = 75,
  preset = 'balanced', // 'balanced' | 'high_protein' | 'low_carb' | 'custom'
  goalType = 'lose',
  customProteinPerKg = null,
  customFatPercent = null
}) {
  let proteinPerKg = 1.6;
  let fatPercent = 0.25;

  if (preset === 'high_protein') {
    proteinPerKg = 2.0;
    fatPercent = 0.25;
  } else if (preset === 'low_carb') {
    proteinPerKg = 1.8;
    fatPercent = 0.40;
  } else if (preset === 'custom') {
    if (isNum(customProteinPerKg)) proteinPerKg = customProteinPerKg;
    if (isNum(customFatPercent)) fatPercent = customFatPercent / 100;
  } else {
    // Balanced
    proteinPerKg = goalType === 'maintain' ? 1.2 : 1.6;
    fatPercent = 0.25;
  }

  // Cap protein at 2.2 g/kg
  proteinPerKg = Math.min(2.2, proteinPerKg);
  const proteinG = Math.round(proteinPerKg * weightKg);
  const proteinKcal = proteinG * 4;

  // Fat grams: fatPercent * targetKcal / 9, minimum 0.6 g/kg
  const minFatG = Math.round(0.6 * weightKg);
  const computedFatG = Math.round((fatPercent * targetKcal) / 9);
  const fatG = Math.max(minFatG, computedFatG);
  const fatKcal = fatG * 9;

  // Carbs: remainder kcal / 4
  const remainingKcal = Math.max(0, targetKcal - (proteinKcal + fatKcal));
  const carbsG = Math.round(remainingKcal / 4);

  // Fiber guideline: 14g per 1000 kcal
  const fiberG = Math.round(14 * (targetKcal / 1000));

  // Water auto: 35ml per kg, min 1500ml
  const waterMl = Math.max(1500, Math.round(35 * weightKg));

  return {
    kcal: targetKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    waterMl
  };
}

/**
 * Convenient Profile-based Target Wrappers (Section 5 & Task C1)
 */
export function calorieTarget(profile, fallbackTdee = 2200) {
  if (!profile) return 2000;
  const p = profile.nutrition || {};
  const res = calculateEnergyTarget({
    weightKg: profile.startWeight || 75,
    heightCm: profile.heightCm || profile.height || 175,
    age: profile.age || 30,
    sex: profile.sex || profile.gender || 'male',
    activityLevel: profile.activityLevel || 'moderate',
    goalType: profile.goalType || 'lose',
    weeklyRatePref: profile.weeklyRatePref || 0.5,
    customKcal: p.customKcal,
    calorieMode: p.calorieMode || 'auto'
  });
  return res.targetKcal;
}

export function macroTargets(profile, targetKcal = 2000, weightKg = 75) {
  const p = profile?.nutrition || {};
  return calculateMacroTargets({
    targetKcal,
    weightKg,
    preset: p.macroPreset || 'balanced',
    goalType: profile?.goalType || 'lose',
    customProteinPerKg: p.proteinPerKg,
    customFatPercent: p.fatPercent
  });
}

/**
 * Complete-Day Heuristic (Section 5.3)
 * A day counts toward adaptive averages only if:
 * 1. User marked finished, OR
 * 2. >= 2 logged meals AND >= 800 kcal, OR
 * 3. Past day with >= 3 logged meals
 */
export function isDayComplete({ meals = [], dayMeta = {}, dateStr, todayStr }) {
  if (dayMeta?.complete === true) return true;
  const count = meals.length;
  const totalKcal = meals.reduce((sum, m) => sum + (m.totals?.kcal || 0), 0);

  if (count >= 2 && totalKcal >= 800) return true;
  if (dateStr && todayStr && dateStr < todayStr && count >= 3) return true;
  return false;
}

/**
 * Summarize Day's Intake vs Targets (Section 5.3)
 */
export function summarizeDay(arg1 = {}, arg2) {
  let meals = [];
  let waterLogs = [];
  let target = { kcal: 2000, proteinG: 120, carbsG: 200, fatG: 55 };
  let dayMeta = {};
  let dateStr = '';
  let todayStr = '';

  if (arg1 && typeof arg1 === 'object') {
    if (Array.isArray(arg1.meals) && typeof arg2 === 'string') {
      // Called as summarizeDay(state, localDate)
      dateStr = arg2;
      todayStr = dateStr;
      meals = arg1.meals.filter(m => m.localDate === dateStr);
      waterLogs = (arg1.water || []).filter(w => w.localDate === dateStr);
      dayMeta = (arg1.nutritionDays && arg1.nutritionDays[dateStr]) || {};
      const tKcal = calorieTarget(arg1.profile, 2200);
      const mTargets = macroTargets(arg1.profile, tKcal);
      target = { kcal: tKcal, ...mTargets };
    } else {
      // Called as summarizeDay({ meals, waterLogs, target, dayMeta, dateStr, todayStr })
      meals = arg1.meals || [];
      waterLogs = arg1.waterLogs || [];
      target = arg1.target || target;
      dayMeta = arg1.dayMeta || {};
      dateStr = arg1.dateStr || '';
      todayStr = arg1.todayStr || '';
    }
  }

  const consumed = meals.reduce(
    (acc, m) => {
      const t = m.totals || {};
      acc.kcal += t.kcal || 0;
      acc.proteinG += t.proteinG || 0;
      acc.carbsG += t.carbsG || 0;
      acc.fatG += t.fatG || 0;
      acc.fiberG += t.fiberG || 0;
      return acc;
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );

  const waterTotalMl = waterLogs.reduce((sum, w) => sum + (w.ml || 0), 0);

  const remaining = {
    kcal: target.kcal - consumed.kcal,
    proteinG: target.proteinG - consumed.proteinG,
    carbsG: target.carbsG - consumed.carbsG,
    fatG: target.fatG - consumed.fatG
  };

  const withinRange = Math.abs(consumed.kcal - target.kcal) <= target.kcal * 0.1;
  const complete = isDayComplete({ meals, dayMeta, dateStr, todayStr });

  return {
    consumed,
    totals: consumed,
    target,
    remaining,
    waterTotalMl,
    mealsCount: meals.length,
    isComplete: complete,
    withinRange
  };
}

/**
 * Adaptive TDEE Calculation (Section 5.4)
 * Requires: >= 14 days span, >= 10 complete intake days in last 28, >= 8 weigh-ins
 */
export function calculateAdaptiveTDEE({
  weighInEntries = [],
  dailyIntakeMap = {}, // 'YYYY-MM-DD' -> { kcal, isComplete }
  formulaTDEE,
  windowDays = 28
}) {
  if (!isNum(formulaTDEE) || formulaTDEE <= 0) return null;

  // Filter complete days in the window
  const completeEntries = Object.entries(dailyIntakeMap)
    .filter(([_, d]) => d.isComplete && d.kcal >= 800)
    .map(([date, d]) => ({ date, kcal: d.kcal }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (completeEntries.length < 10) {
    return {
      status: 'insufficient_intake',
      tdeeUsed: formulaTDEE,
      formulaTDEE,
      observedTDEE: null,
      completeDays: completeEntries.length,
      weight: 0
    };
  }

  // Check weigh-ins
  const sortedWeighIns = [...weighInEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedWeighIns.length < 8) {
    return {
      status: 'insufficient_weighins',
      tdeeUsed: formulaTDEE,
      formulaTDEE,
      observedTDEE: null,
      completeDays: completeEntries.length,
      weight: 0
    };
  }

  // Calculate average intake
  const avgIntake = completeEntries.reduce((s, c) => s + c.kcal, 0) / completeEntries.length;

  // Calculate weight trend delta over the period
  const startWeight = sortedWeighIns[0].weight;
  const endWeight = sortedWeighIns[sortedWeighIns.length - 1].weight;
  const trendDelta = endWeight - startWeight; // kg
  const daysSpan = Math.max(14, Math.round((new Date(sortedWeighIns[sortedWeighIns.length - 1].date) - new Date(sortedWeighIns[0].date)) / 86400000));

  // Observed TDEE: avgIntake - (trendDelta * 7700 / daysSpan)
  const observedTDEE = Math.round(avgIntake - (trendDelta * 7700) / daysSpan);

  // Blending weight w = clamp((completeDays - 10) / 18, 0, 0.7)
  let w = Math.max(0, Math.min(0.7, (completeEntries.length - 10) / 18));

  // If observed differs by > 25% from formula, cap w <= 0.4
  if (Math.abs(observedTDEE - formulaTDEE) / formulaTDEE > 0.25) {
    w = Math.min(w, 0.4);
  }

  const tdeeUsed = Math.round(w * observedTDEE + (1 - w) * formulaTDEE);

  return {
    status: 'ready',
    tdeeUsed,
    formulaTDEE,
    observedTDEE,
    completeDays: completeEntries.length,
    weight: Math.round(w * 100) / 100,
    daysSpan
  };
}

/**
 * Forecast "What If" Calculator (Section 5.5)
 */
export function calculateForecastWhatIf({ targetKcal, currentWeight, goalWeight, tdeeUsed }) {
  if (!isNum(targetKcal) || !isNum(currentWeight) || !isNum(goalWeight) || !isNum(tdeeUsed)) {
    return null;
  }

  const isLoss = goalWeight < currentWeight;
  const dailyBalance = targetKcal - tdeeUsed; // negative for deficit
  const kgPerDay = dailyBalance / 7700;

  if (isLoss && kgPerDay >= -0.005) {
    return {
      achievable: false,
      message: 'Not on a path to goal at this intake'
    };
  }

  if (!isLoss && kgPerDay <= 0.005) {
    return {
      achievable: false,
      message: 'Not on a path to goal at this intake'
    };
  }

  const remainingKg = Math.abs(currentWeight - goalWeight);
  const days = Math.round(remainingKg / Math.abs(kgPerDay));

  if (days <= 0 || days > 1825) {
    return {
      achievable: false,
      message: 'Beyond 5-year projection window'
    };
  }

  const arrival = new Date();
  arrival.setDate(arrival.getDate() + days);

  return {
    achievable: true,
    days,
    projectedDate: arrival.toISOString().split('T')[0],
    kgPerWeek: Math.abs(Math.round(kgPerDay * 7 * 10) / 10)
  };
}

/**
 * Proportionally scale a meal item to a new quantity
 */
export function scaleItem(item, newQty) {
  if (!item || !isNum(item.quantity) || item.quantity <= 0) return { ...item, quantity: newQty };
  const ratio = newQty / item.quantity;
  return {
    ...item,
    quantity: newQty,
    gramsEstimate: isNum(item.gramsEstimate) ? Math.round(item.gramsEstimate * ratio) : item.gramsEstimate,
    kcal: Math.round((item.kcal || 0) * ratio),
    proteinG: Math.round((item.proteinG || 0) * ratio * 10) / 10,
    carbsG: Math.round((item.carbsG || 0) * ratio * 10) / 10,
    fatG: Math.round((item.fatG || 0) * ratio * 10) / 10
  };
}

/**
 * Helper to get projected goal date based on daily intake
 */
export function projectedDate(state, customKcal) {
  const currentWeight = state.entries?.[state.entries.length - 1]?.weight || state.profile?.startWeight;
  const goalWeight = state.profile?.goalWeight;
  if (!currentWeight || !goalWeight) return null;
  const tdee = calculateFormulaTDEE(
    currentWeight,
    state.profile?.heightCm || state.profile?.height || 175,
    state.profile?.age || 30,
    state.profile?.sex || state.profile?.gender || 'male',
    state.profile?.activityLevel || 'moderate'
  );
  const targetKcal = customKcal || calorieTarget(state.profile, tdee);
  const whatIf = calculateForecastWhatIf({ targetKcal, currentWeight, goalWeight, tdeeUsed: tdee });
  return whatIf?.achievable ? whatIf.projectedDate : null;
}

