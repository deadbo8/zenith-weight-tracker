/**
 * Gemini Response Schema Specification (Section 6.4)
 */

const num = { type: 'NUMBER' };
const str = { type: 'STRING' };

const macros = {
  kcal: num,
  protein_g: num,
  carbs_g: num,
  fat_g: num,
  fiber_g: num,
  sugar_g: num,
  sodium_mg: num
};

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: ['log_meal', 'log_weight', 'log_water', 'question', 'clarify', 'support']
    },
    assistant_message: str,
    meal: {
      type: 'OBJECT',
      properties: {
        title: str,
        meal_type: { type: 'STRING', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: str,
              quantity: num,
              unit: { type: 'STRING', enum: ['g', 'ml', 'piece', 'cup', 'tbsp', 'tsp', 'slice', 'bowl', 'serving'] },
              grams: num,
              ...macros,
              confidence: num,
              assumptions: { type: 'ARRAY', items: str }
            },
            required: ['name', 'quantity', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence']
          }
        },
        totals: {
          type: 'OBJECT',
          properties: macros,
          required: ['kcal', 'protein_g', 'carbs_g', 'fat_g']
        },
        kcal_low: num,
        kcal_high: num,
        overall_confidence: num
      },
      required: ['title', 'meal_type', 'items', 'totals', 'overall_confidence']
    },
    weight: {
      type: 'OBJECT',
      properties: {
        value: num,
        unit: { type: 'STRING', enum: ['kg', 'lb'] }
      }
    },
    water_ml: num,
    clarifying_question: str,
    follow_up_chips: { type: 'ARRAY', items: str },
    flags: {
      type: 'ARRAY',
      items: {
        type: 'STRING',
        enum: ['label_read', 'non_food', 'low_light', 'multiple_plates', 'drink_only', 'restaurant_estimate']
      }
    }
  },
  required: ['intent', 'assistant_message']
};
