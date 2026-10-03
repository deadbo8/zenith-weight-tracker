/**
 * Zenith Gemini Model Configuration & Tiers (Section 6.3)
 * Centralizes model identifiers, fallback orders, and tier mappings.
 */

export const MODEL_TIERS = {
  fast:     { vision: 'gemini-3.5-flash-lite', text: 'gemini-3.5-flash-lite' },
  balanced: { vision: 'gemini-3.5-flash',      text: 'gemini-3.5-flash-lite' }, // default
  best:     { vision: 'gemini-3.8-flash',      text: 'gemini-3.5-flash' }
};

export const FALLBACK_ORDER = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

export function getModelForTask(tier = 'balanced', taskType = 'vision', overrides = {}) {
  if (taskType === 'vision' && overrides.vision) return overrides.vision;
  if (taskType === 'text' && overrides.text) return overrides.text;

  const tierConfig = MODEL_TIERS[tier] || MODEL_TIERS.balanced;
  return taskType === 'vision' ? tierConfig.vision : tierConfig.text;
}
