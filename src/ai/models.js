/**
 * Zenith Gemini Model Configuration & Tiers (Section 6.3)
 * Centralizes model identifiers, fallback orders, and tier mappings.
 */

export const MODEL_TIERS = {
  fast:     { vision: 'gemini-1.5-flash', text: 'gemini-1.5-flash' },
  balanced: { vision: 'gemini-1.5-flash', text: 'gemini-1.5-flash' }, // default
  best:     { vision: 'gemini-2.0-flash', text: 'gemini-2.0-flash' }
};

export const FALLBACK_ORDER = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

export function getModelForTask(tier = 'balanced', taskType = 'vision', overrides = {}) {
  if (taskType === 'vision' && overrides.vision) return overrides.vision;
  if (taskType === 'text' && overrides.text) return overrides.text;

  const tierConfig = MODEL_TIERS[tier] || MODEL_TIERS.balanced;
  return taskType === 'vision' ? tierConfig.vision : tierConfig.text;
}
