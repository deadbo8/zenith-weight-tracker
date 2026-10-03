/**
 * AI Response Parser & Validator (Section 6.4 & 7.1)
 * Strips code fences, parses JSON, coerces numbers, clamps ranges,
 * verifies Atwater macro consistency, and recomputes totals.
 */

const VALID_UNITS = new Set(['g', 'ml', 'piece', 'cup', 'tbsp', 'tsp', 'slice', 'bowl', 'serving']);
const VALID_INTENTS = new Set(['log_meal', 'log_weight', 'log_water', 'question', 'clarify', 'support']);
const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

function clamp(v, min, max, fallback = 0) {
  const n = Number(v);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function cleanString(str, maxLen = 280) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

export function parseRawAiResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty AI response');
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // 2. Strip markdown code fences if present
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch (err2) {
        // Fall through to brace extraction
      }
    }

    // 3. Find first { and last }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(rawText.slice(start, end + 1));
      } catch (err3) {
        // Failed
      }
    }

    throw new Error('Could not parse valid JSON from AI response');
  }
}

/**
 * Validate and sanitize parsed AI response
 */
export function validateAiResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid AI response structure');
  }

  let intent = cleanString(parsed.intent || 'log_meal');
  if (!VALID_INTENTS.has(intent)) intent = 'log_meal';

  const assistantMessage = cleanString(parsed.assistant_message || parsed.assistantMessage || '', 280);
  const clarifyingQuestion = parsed.clarifying_question ? cleanString(parsed.clarifying_question, 200) : null;
  const followUpChips = Array.isArray(parsed.follow_up_chips)
    ? parsed.follow_up_chips.map(c => cleanString(c, 40)).filter(Boolean).slice(0, 3)
    : [];
  const flags = Array.isArray(parsed.flags)
    ? parsed.flags.map(f => cleanString(f, 40)).filter(Boolean)
    : [];

  let weight = null;
  if (parsed.weight && typeof parsed.weight === 'object') {
    const wVal = Number(parsed.weight.value);
    if (!isNaN(wVal) && wVal > 20 && wVal < 500) {
      weight = {
        value: Math.round(wVal * 10) / 10,
        unit: parsed.weight.unit === 'lb' ? 'lb' : 'kg'
      };
    }
  }

  let waterMl = null;
  if (parsed.water_ml != null || parsed.waterMl != null) {
    const ml = Number(parsed.water_ml ?? parsed.waterMl);
    if (!isNaN(ml) && ml > 0 && ml < 5000) {
      waterMl = Math.round(ml);
    }
  }

  let meal = null;
  const rawMeal = parsed.meal;

  if (rawMeal && typeof rawMeal === 'object' && intent !== 'support') {
    meal = validateMeal(rawMeal, flags);
  }

  // If intent was log_weight or log_water without a meal, clear meal
  if (intent === 'log_weight' && weight) meal = null;
  if (intent === 'log_water' && waterMl) meal = null;

  return {
    intent,
    assistantMessage,
    meal,
    weight,
    waterMl,
    clarifyingQuestion,
    followUpChips,
    flags
  };
}

function validateMeal(rawMeal, flags) {
  let mealType = cleanString(rawMeal.meal_type || rawMeal.mealType || 'lunch');
  if (!VALID_MEAL_TYPES.has(mealType)) mealType = 'lunch';

  const title = cleanString(rawMeal.title || 'Logged Meal', 100);

  // Validate items (capped at 12)
  const rawItems = Array.isArray(rawMeal.items) ? rawMeal.items.slice(0, 12) : [];
  const items = [];

  let sumKcal = 0;
  let sumProtein = 0;
  let sumCarbs = 0;
  let sumFat = 0;
  let sumFiber = 0;
  let sumSugar = 0;
  let sumSodium = 0;

  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue;
    const name = cleanString(it.name || 'Food item', 80);
    if (!name) continue;

    const quantity = Math.max(0.1, clamp(it.quantity, 0.1, 100, 1));
    let unit = cleanString(it.unit || 'serving').toLowerCase();
    if (!VALID_UNITS.has(unit)) unit = 'serving';

    const grams = it.grams != null ? clamp(it.grams, 1, 3000, null) : null;
    const kcal = Math.round(clamp(it.kcal, 0, 3000, 0));
    const proteinG = Math.round(clamp(it.protein_g ?? it.proteinG, 0, 500, 0) * 10) / 10;
    const carbsG = Math.round(clamp(it.carbs_g ?? it.carbsG, 0, 500, 0) * 10) / 10;
    const fatG = Math.round(clamp(it.fat_g ?? it.fatG, 0, 500, 0) * 10) / 10;
    const fiberG = it.fiber_g != null || it.fiberG != null ? clamp(it.fiber_g ?? it.fiberG, 0, 150, 0) : undefined;
    const sugarG = it.sugar_g != null || it.sugarG != null ? clamp(it.sugar_g ?? it.sugarG, 0, 250, 0) : undefined;
    const sodiumMg = it.sodium_mg != null || it.sodiumMg != null ? clamp(it.sodium_mg ?? it.sodiumMg, 0, 10000, 0) : undefined;

    const confidence = clamp(it.confidence, 0.1, 1.0, 0.7);
    const assumptions = Array.isArray(it.assumptions)
      ? it.assumptions.map(a => cleanString(a, 100)).filter(Boolean).slice(0, 5)
      : [];

    sumKcal += kcal;
    sumProtein += proteinG;
    sumCarbs += carbsG;
    sumFat += fatG;
    if (fiberG != null) sumFiber += fiberG;
    if (sugarG != null) sumSugar += sugarG;
    if (sodiumMg != null) sumSodium += sodiumMg;

    items.push({
      id: it.id || `item_${Math.random().toString(36).substring(2, 9)}`,
      name,
      quantity,
      unit,
      gramsEstimate: grams,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      sugarG,
      sodiumMg,
      confidence,
      assumptions
    });
  }

  // Fallback item if no items parsed
  if (items.length === 0) {
    const fallbackKcal = Math.round(clamp(rawMeal.totals?.kcal ?? rawMeal.kcal, 50, 2500, 450));
    items.push({
      id: `item_${Math.random().toString(36).substring(2, 9)}`,
      name: title,
      quantity: 1,
      unit: 'serving',
      gramsEstimate: null,
      kcal: fallbackKcal,
      proteinG: 15,
      carbsG: 50,
      fatG: 15,
      confidence: 0.5,
      assumptions: ['Estimated portion']
    });
    sumKcal = fallbackKcal;
    sumProtein = 15;
    sumCarbs = 50;
    sumFat = 15;
  }

  // 3. Recompute totals and check mismatch
  const reportedTotals = rawMeal.totals || {};
  let finalKcal = reportedTotals.kcal != null ? Number(reportedTotals.kcal) : sumKcal;
  let recomputed = false;

  // Check >10% mismatch
  if (isNaN(finalKcal) || Math.abs(finalKcal - sumKcal) > 0.1 * Math.max(1, sumKcal)) {
    finalKcal = sumKcal;
    recomputed = true;
  }

  let finalProtein = reportedTotals.protein_g ?? reportedTotals.proteinG ?? sumProtein;
  let finalCarbs = reportedTotals.carbs_g ?? reportedTotals.carbsG ?? sumCarbs;
  let finalFat = reportedTotals.fat_g ?? reportedTotals.fatG ?? sumFat;

  if (recomputed) {
    finalProtein = Math.round(sumProtein * 10) / 10;
    finalCarbs = Math.round(sumCarbs * 10) / 10;
    finalFat = Math.round(sumFat * 10) / 10;
  }

  let overallConfidence = clamp(rawMeal.overall_confidence ?? rawMeal.overallConfidence, 0.1, 1.0, 0.7);

  // 4. Atwater Consistency Check: 4*P + 4*C + 9*F within 15% of kcal
  const atwaterKcal = (4 * finalProtein) + (4 * finalCarbs) + (9 * finalFat);
  if (finalKcal > 50 && Math.abs(atwaterKcal - finalKcal) > 0.15 * finalKcal) {
    // Keep kcal, but reduce confidence and set rough estimate flag
    overallConfidence = Math.min(overallConfidence, 0.45);
    if (!flags.includes('rough_estimate')) flags.push('rough_estimate');
  }

  // Uncertainty ranges
  let kcalLow = rawMeal.kcal_low ?? rawMeal.kcalLow;
  let kcalHigh = rawMeal.kcal_high ?? rawMeal.kcalHigh;

  if (kcalLow == null || kcalHigh == null || kcalLow >= kcalHigh || kcalLow < 0) {
    const variance = overallConfidence < 0.5 ? 0.25 : 0.15;
    kcalLow = Math.max(0, Math.round(finalKcal * (1 - variance)));
    kcalHigh = Math.round(finalKcal * (1 + variance));
  } else {
    kcalLow = Math.round(kcalLow);
    kcalHigh = Math.round(kcalHigh);
  }

  return {
    title,
    mealType,
    items,
    totals: {
      kcal: finalKcal,
      proteinG: Math.round(finalProtein * 10) / 10,
      carbsG: Math.round(finalCarbs * 10) / 10,
      fatG: Math.round(finalFat * 10) / 10,
      fiberG: sumFiber > 0 ? Math.round(sumFiber * 10) / 10 : undefined,
      sugarG: sumSugar > 0 ? Math.round(sumSugar * 10) / 10 : undefined,
      sodiumMg: sumSodium > 0 ? Math.round(sumSodium) : undefined
    },
    kcalLow,
    kcalHigh,
    overallConfidence,
    totalsRecomputed: recomputed
  };
}
