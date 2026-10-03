/**
 * Zenith Offline Fallback Food & Nutrition Estimator
 * Provides rule-based nutrition parsing when Gemini API key is missing or offline.
 */

const FOOD_DATABASE = [
  { keywords: ['egg', 'eggs'], title: 'Egg', defaultGrams: 50, perUnitKcal: 72, p: 6.3, c: 0.4, f: 4.8 },
  { keywords: ['toast', 'bread', 'slice of bread'], title: 'Whole Wheat Toast', defaultGrams: 35, perUnitKcal: 79, p: 4.0, c: 13.8, f: 1.1 },
  { keywords: ['coffee', 'espresso', 'black coffee'], title: 'Coffee', defaultGrams: 200, perUnitKcal: 5, p: 0.3, c: 0.5, f: 0.1 },
  { keywords: ['latte', 'cappuccino'], title: 'Latte', defaultGrams: 250, perUnitKcal: 130, p: 7.0, c: 11.0, f: 5.0 },
  { keywords: ['tea', 'green tea'], title: 'Tea', defaultGrams: 200, perUnitKcal: 2, p: 0.1, c: 0.3, f: 0.0 },
  { keywords: ['chicken', 'chicken breast', 'poultry'], title: 'Grilled Chicken Breast', defaultGrams: 150, perUnitKcal: 247, p: 46.5, c: 0.0, f: 5.4 },
  { keywords: ['rice', 'white rice', 'brown rice'], title: 'Steamed Rice', defaultGrams: 150, perUnitKcal: 195, p: 4.0, c: 42.0, f: 0.5 },
  { keywords: ['oatmeal', 'oats', 'porridge'], title: 'Rolled Oats Porridge', defaultGrams: 200, perUnitKcal: 158, p: 6.0, c: 27.0, f: 3.2 },
  { keywords: ['milk'], title: 'Milk (1 glass)', defaultGrams: 240, perUnitKcal: 122, p: 8.0, c: 12.0, f: 4.8 },
  { keywords: ['apple', 'apples'], title: 'Apple', defaultGrams: 180, perUnitKcal: 95, p: 0.5, c: 25.0, f: 0.3 },
  { keywords: ['banana', 'bananas'], title: 'Banana', defaultGrams: 120, perUnitKcal: 105, p: 1.3, c: 27.0, f: 0.3 },
  { keywords: ['orange', 'oranges'], title: 'Orange', defaultGrams: 140, perUnitKcal: 62, p: 1.2, c: 15.4, f: 0.2 },
  { keywords: ['pizza'], title: 'Pizza Slice', defaultGrams: 100, perUnitKcal: 266, p: 11.0, c: 32.0, f: 10.0 },
  { keywords: ['pasta', 'spaghetti', 'noodles'], title: 'Pasta', defaultGrams: 180, perUnitKcal: 260, p: 9.0, c: 50.0, f: 1.5 },
  { keywords: ['salad', 'green salad'], title: 'Fresh Garden Salad', defaultGrams: 150, perUnitKcal: 85, p: 2.5, c: 8.0, f: 5.0 },
  { keywords: ['salmon', 'fish'], title: 'Baked Salmon Fillet', defaultGrams: 150, perUnitKcal: 312, p: 34.0, c: 0.0, f: 18.0 },
  { keywords: ['steak', 'beef'], title: 'Lean Beef Steak', defaultGrams: 180, perUnitKcal: 380, p: 45.0, c: 0.0, f: 21.0 },
  { keywords: ['burger', 'hamburger'], title: 'Burger', defaultGrams: 200, perUnitKcal: 480, p: 26.0, c: 42.0, f: 24.0 },
  { keywords: ['protein shake', 'whey'], title: 'Whey Protein Shake', defaultGrams: 300, perUnitKcal: 140, p: 25.0, c: 3.0, f: 2.0 },
  { keywords: ['avocado'], title: 'Avocado', defaultGrams: 100, perUnitKcal: 160, p: 2.0, c: 8.5, f: 14.7 },
  { keywords: ['cheese'], title: 'Cheddar Cheese', defaultGrams: 30, perUnitKcal: 115, p: 7.0, c: 0.4, f: 9.5 },
  { keywords: ['yogurt', 'greek yogurt'], title: 'Greek Yogurt', defaultGrams: 170, perUnitKcal: 130, p: 15.0, c: 6.0, f: 4.0 },
  { keywords: ['peanut butter'], title: 'Peanut Butter (2 tbsp)', defaultGrams: 32, perUnitKcal: 188, p: 8.0, c: 6.0, f: 16.0 },
  { keywords: ['almonds', 'nuts'], title: 'Mixed Nuts', defaultGrams: 30, perUnitKcal: 170, p: 6.0, c: 6.0, f: 15.0 }
];

const WORD_NUMS = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

export function estimateOfflineMeal(rawText = '') {
  const text = (rawText || '').trim().toLowerCase();

  // 1. Check for weight command: "weigh 74.5 kg" or "75.2kg"
  const weightMatch = text.match(/(?:weigh(?:ed|t)?\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs|lb)/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg';
    return {
      intent: 'log_weight',
      assistantMessage: `Detected weigh-in of ${val} ${unit}.`,
      weight: { value: val, unit }
    };
  }

  // 2. Check for water command: "500ml water", "2 glasses water"
  const waterMatch = text.match(/(\d+)\s*(ml|milliliters?|glass(?:es)?|cups?)\s*water/i) || text.match(/water\s*(\d+)\s*(ml|milliliters?|glass(?:es)?|cups?)/i);
  if (waterMatch) {
    let amount = parseInt(waterMatch[1], 10);
    const unit = waterMatch[2].toLowerCase();
    if (unit.startsWith('glass') || unit.startsWith('cup')) amount *= 250;
    return {
      intent: 'log_water',
      assistantMessage: `Logged ${amount} ml water.`,
      waterMl: amount
    };
  }

  // Determine current meal category
  const hour = new Date().getHours();
  let category = 'lunch';
  if (hour < 11) category = 'breakfast';
  else if (hour < 15) category = 'lunch';
  else if (hour < 18) category = 'snack';
  else category = 'dinner';

  // Override if mentioned in text
  if (text.includes('breakfast')) category = 'breakfast';
  else if (text.includes('lunch')) category = 'lunch';
  else if (text.includes('dinner')) category = 'dinner';
  else if (text.includes('snack')) category = 'snack';

  // 3. Scan for matched foods
  const matchedItems = [];
  const segments = text.split(/,|\band\b|\+/);

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    let qty = 1;
    const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+/);
    if (numMatch) {
      qty = parseFloat(numMatch[1]);
    } else {
      for (const [w, n] of Object.entries(WORD_NUMS)) {
        if (new RegExp(`\\b${w}\\b`).test(trimmed)) {
          qty = n;
          break;
        }
      }
    }

    let foundFood = null;
    for (const food of FOOD_DATABASE) {
      for (const kw of food.keywords) {
        if (new RegExp(`\\b${kw}\\b`).test(trimmed)) {
          foundFood = food;
          break;
        }
      }
      if (foundFood) break;
    }

    if (foundFood) {
      matchedItems.push({
        name: foundFood.title,
        quantity: qty,
        unit: 'portion',
        grams: Math.round(foundFood.defaultGrams * qty),
        gramsEstimate: Math.round(foundFood.defaultGrams * qty),
        portionDesc: `${qty} portion${qty > 1 ? 's' : ''}`,
        kcal: Math.round(foundFood.perUnitKcal * qty),
        proteinG: Math.round(foundFood.p * qty * 10) / 10,
        carbsG: Math.round(foundFood.c * qty * 10) / 10,
        fatG: Math.round(foundFood.f * qty * 10) / 10
      });
    }
  }

  // Fallback if no specific food matched from dictionary
  if (matchedItems.length === 0) {
    const titleCapitalized = rawText.trim()
      ? rawText.trim().charAt(0).toUpperCase() + rawText.trim().slice(1)
      : 'Quick Meal';
    matchedItems.push({
      name: titleCapitalized,
      quantity: 1,
      unit: 'serving',
      grams: 250,
      gramsEstimate: 250,
      portionDesc: '1 meal serving',
      kcal: 420,
      proteinG: 24,
      carbsG: 45,
      fatG: 14
    });
  }

  const totals = matchedItems.reduce((acc, item) => ({
    kcal: acc.kcal + item.kcal,
    proteinG: Math.round((acc.proteinG + item.proteinG) * 10) / 10,
    carbsG: Math.round((acc.carbsG + item.carbsG) * 10) / 10,
    fatG: Math.round((acc.fatG + item.fatG) * 10) / 10
  }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const title = matchedItems.map(i => i.name).join(', ') || 'Logged Food';

  return {
    intent: 'log_meal',
    assistantMessage: `Offline estimate: ${totals.kcal} kcal (${totals.proteinG}g protein). Tap below to adjust or save.`,
    meal: {
      title,
      category,
      totals,
      items: matchedItems,
      confidence: 'medium',
      source: 'offline'
    },
    followUpChips: ['+250ml water', 'Add coffee', 'Double portion']
  };
}
