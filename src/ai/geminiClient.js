import { CapacitorHttp } from '@capacitor/core';
import { getKey } from './secureKey.js';
import { FALLBACK_ORDER } from './models.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class AiError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/**
 * Generate content with Gemini using CapacitorHttp, automatic retries for transient errors,
 * and fallback models on model retirement (404 / model_gone).
 */
export async function generate({
  model = 'gemini-3.5-flash',
  system,
  contents,
  schema,
  temperature = 0.2,
  maxOutputTokens = 2048,
  timeoutMs = 60000,
  maxRetries = 2
}) {
  const apiKey = await getKey();
  if (!apiKey) throw new AiError('no_key', 'No API key configured');

  let currentModel = model;
  let fallbackIndex = 0;

  const executeCall = async (modelToUse) => {
    let attempt = 0;
    let useSchema = !!schema;

    while (true) {
      const body = {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
          ...(useSchema && schema
            ? { responseMimeType: 'application/json', responseSchema: schema }
            : { responseMimeType: 'application/json' })
        }
      };

      try {
        const res = await CapacitorHttp.post({
          url: `${BASE}/models/${encodeURIComponent(modelToUse)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          data: body,
          connectTimeout: 15000,
          readTimeout: timeoutMs
        });

        if (res.status === 200) {
          return parseCandidate(res.data, modelToUse);
        }

        // If 400 occurred with responseSchema, retry immediately without responseSchema (plain JSON mode)
        if (res.status === 400 && useSchema) {
          console.warn('[GeminiClient] 400 with responseSchema, retrying with prompt-only JSON format...');
          useSchema = false;
          continue;
        }

        const err = mapHttpError(res.status, res.data);
        if (shouldRetry(err.kind) && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 400;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      } catch (err) {
        if (err instanceof AiError) {
          throw err;
        }
        // Network or fetch failure
        if (attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 400;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new AiError('network', 'Network error connecting to Gemini', { cause: err });
      }
    }
  };

  try {
    return await executeCall(currentModel);
  } catch (err) {
    if (err.kind === 'model_gone' && fallbackIndex < FALLBACK_ORDER.length) {
      const nextFallback = FALLBACK_ORDER[fallbackIndex++];
      if (nextFallback !== currentModel) {
        return await executeCall(nextFallback);
      }
    }
    throw err;
  }
}

function parseCandidate(rawData, modelUsed) {
  let data = rawData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.warn('[GeminiClient] Could not parse raw string payload as JSON:', e);
    }
  }

  if (data?.promptFeedback?.blockReason) {
    throw new AiError('blocked', 'Request blocked by safety filters', {
      reason: data.promptFeedback.blockReason
    });
  }

  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text) {
    throw new AiError('empty', 'Empty response from model', {
      finishReason: cand?.finishReason,
      raw: data
    });
  }

  return {
    text,
    model: modelUsed,
    finishReason: cand?.finishReason,
    usage: data?.usageMetadata
  };
}

function mapHttpError(status, rawData) {
  let data = rawData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {}
  }
  const msg = data?.error?.message ?? (typeof data === 'string' ? data : '');
  if ((status === 400 && /API key|key invalid|API_KEY_INVALID/i.test(msg)) || status === 401 || status === 403) {
    return new AiError('bad_key', msg || 'Invalid API key');
  }
  if (status === 404) return new AiError('model_gone', msg || 'Model not found');
  if (status === 429) return new AiError('rate_limit', msg || 'Rate limit or quota reached');
  if (status >= 500) return new AiError('server', msg || 'Google server error');
  return new AiError('bad_request', msg || `Bad request (status ${status})`, { status, raw: data });
}

function shouldRetry(kind) {
  return kind === 'rate_limit' || kind === 'server' || kind === 'network';
}

/**
 * Test Gemini API connection using a minimal models query.
 */
export async function testConnection(customKey = null) {
  const apiKey = customKey || (await getKey());
  if (!apiKey) return { ok: false, kind: 'no_key', message: 'No API key provided' };

  try {
    const res = await CapacitorHttp.get({
      url: `${BASE}/models?pageSize=1&key=${encodeURIComponent(apiKey)}`,
      headers: {
        'x-goog-api-key': apiKey
      },
      connectTimeout: 10000,
      readTimeout: 15000
    });

    if (res.status === 200) {
      return { ok: true, message: 'Connected successfully' };
    }

    const err = mapHttpError(res.status, res.data);
    return { ok: false, kind: err.kind, message: err.message };
  } catch (err) {
    return { ok: false, kind: 'network', message: 'Network connection failed' };
  }
}

/**
 * Fetch available Gemini models that support generateContent.
 */
export async function fetchAvailableModels() {
  const apiKey = await getKey();
  if (!apiKey) throw new AiError('no_key', 'No API key');

  try {
    const res = await CapacitorHttp.get({
      url: `${BASE}/models?pageSize=100&key=${encodeURIComponent(apiKey)}`,
      headers: { 'x-goog-api-key': apiKey },
      connectTimeout: 10000,
      readTimeout: 15000
    });

    if (res.status === 200 && Array.isArray(res.data?.models)) {
      return res.data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => ({
          name: m.name.replace(/^models\//, ''),
          displayName: m.displayName || m.name,
          description: m.description
        }));
    }
    throw mapHttpError(res.status, res.data);
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError('network', 'Failed to fetch models', { cause: err });
  }
}
