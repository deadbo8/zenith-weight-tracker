import { describe, it, expect, beforeEach } from 'vitest';
import { parseRawAiResponse, validateAiResponse } from '../src/ai/validate.js';
import { getCachedAiResult, setCachedAiResult, clearAiCache } from '../src/ai/cache.js';
import { getModelForTask, MODEL_TIERS } from '../src/ai/models.js';
import { AiError } from '../src/ai/geminiClient.js';

describe('AI Layer - Validator & Parser', () => {
  it('parses raw clean JSON correctly', () => {
    const raw = JSON.stringify({
      intent: 'log_meal',
      assistant_message: 'Logged your breakfast.',
      meal: {
        title: 'Oats with milk',
        meal_type: 'breakfast',
        items: [
          { name: 'Oats', quantity: 1, unit: 'cup', kcal: 150, protein_g: 5, carbs_g: 27, fat_g: 3, confidence: 0.9 }
        ],
        totals: { kcal: 150, protein_g: 5, carbs_g: 27, fat_g: 3 },
        overall_confidence: 0.9
      }
    });

    const parsed = parseRawAiResponse(raw);
    const validated = validateAiResponse(parsed);

    expect(validated.intent).toBe('log_meal');
    expect(validated.meal.title).toBe('Oats with milk');
    expect(validated.meal.items.length).toBe(1);
    expect(validated.meal.totals.kcal).toBe(150);
  });

  it('strips markdown code fences from AI response', () => {
    const raw = '```json\n{"intent":"log_water","water_ml":500,"assistant_message":"Added 500 ml water."}\n```';
    const parsed = parseRawAiResponse(raw);
    const validated = validateAiResponse(parsed);

    expect(validated.intent).toBe('log_water');
    expect(validated.waterMl).toBe(500);
    expect(validated.meal).toBeNull();
  });

  it('recomputes totals when AI totals differ by >10% from item sum', () => {
    const raw = {
      intent: 'log_meal',
      meal: {
        title: 'Lunch',
        meal_type: 'lunch',
        items: [
          { name: 'Rice', quantity: 1, unit: 'bowl', kcal: 200, protein_g: 4, carbs_g: 45, fat_g: 0.5, confidence: 0.8 },
          { name: 'Chicken', quantity: 1, unit: 'serving', kcal: 300, protein_g: 30, carbs_g: 0, fat_g: 10, confidence: 0.8 }
        ],
        // Item sum is 500 kcal, but reported is 750 kcal (>10% mismatch)
        totals: { kcal: 750, protein_g: 50, carbs_g: 60, fat_g: 20 },
        overall_confidence: 0.8
      }
    };

    const validated = validateAiResponse(raw);
    expect(validated.meal.totals.kcal).toBe(500); // Recomputed to 200 + 300
    expect(validated.meal.totals.proteinG).toBe(34); // 4 + 30
    expect(validated.meal.totalsRecomputed).toBe(true);
  });

  it('applies Atwater consistency check and reduces confidence for severe macro mismatch', () => {
    const raw = {
      intent: 'log_meal',
      meal: {
        title: 'Mystery Snack',
        meal_type: 'snack',
        items: [
          // 4*2 + 4*2 + 9*2 = 34 kcal, but kcal declared as 300 kcal (huge discrepancy)
          { name: 'Snack bar', quantity: 1, unit: 'piece', kcal: 300, protein_g: 2, carbs_g: 2, fat_g: 2, confidence: 0.9 }
        ],
        totals: { kcal: 300, protein_g: 2, carbs_g: 2, fat_g: 2 },
        overall_confidence: 0.9
      }
    };

    const validated = validateAiResponse(raw);
    expect(validated.meal.totals.kcal).toBe(300);
    expect(validated.meal.overallConfidence).toBeLessThanOrEqual(0.45);
    expect(validated.flags).toContain('rough_estimate');
  });

  it('handles support intent by suppressing meal card', () => {
    const raw = {
      intent: 'support',
      assistant_message: 'Take care of yourself. Food is nourishment, and you deserve kindness.',
      meal: {
        title: 'Not needed',
        items: []
      }
    };

    const validated = validateAiResponse(raw);
    expect(validated.intent).toBe('support');
    expect(validated.meal).toBeNull();
    expect(validated.assistantMessage).toContain('nourishment');
  });

  it('handles log_weight intent with proper units and value clamping', () => {
    const raw = {
      intent: 'log_weight',
      assistant_message: 'Logging 77.4 kg.',
      weight: { value: 77.42, unit: 'kg' }
    };

    const validated = validateAiResponse(raw);
    expect(validated.intent).toBe('log_weight');
    expect(validated.weight.value).toBe(77.4);
    expect(validated.weight.unit).toBe('kg');
  });
});

describe('AI Layer - Cache & Models', () => {
  beforeEach(() => {
    clearAiCache();
  });

  it('stores and retrieves cached results within 24 hours', async () => {
    const payload = { input: 'oats with milk', note: 'breakfast', model: 'gemini-3.5-flash', promptVersion: '2026-10-a' };
    const mockResult = { intent: 'log_meal', title: 'Oats' };

    await setCachedAiResult({ ...payload, result: mockResult });
    const cached = await getCachedAiResult(payload);

    expect(cached).toEqual(mockResult);
  });

  it('returns appropriate models by tier', () => {
    expect(getModelForTask('fast', 'vision')).toBe(MODEL_TIERS.fast.vision);
    expect(getModelForTask('balanced', 'text')).toBe(MODEL_TIERS.balanced.text);
    expect(getModelForTask('best', 'vision')).toBe(MODEL_TIERS.best.vision);

    // Overrides
    expect(getModelForTask('fast', 'vision', { vision: 'custom-model' })).toBe('custom-model');
  });

  it('creates structured AiError objects', () => {
    const err = new AiError('rate_limit', 'Too many requests', { status: 429 });
    expect(err.kind).toBe('rate_limit');
    expect(err.message).toBe('Too many requests');
    expect(err.status).toBe(429);
  });
});
