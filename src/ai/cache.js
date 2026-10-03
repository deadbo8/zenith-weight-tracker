/**
 * 24-Hour Hash Cache for AI Responses (Section 6.5)
 * Caches responses by hash of (imageBytes/text, note, model, promptVersion)
 * to avoid duplicate API charges and latency.
 */

const CACHE_PREFIX = 'zenith_ai_cache_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const memoryCache = new Map();

async function hashKey(payload) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fall through to simple hash
    }
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export async function getCachedAiResult({ input, note = '', model = '', promptVersion = '' }) {
  try {
    const key = await hashKey({ input, note, model, promptVersion });
    const storageKey = `${CACHE_PREFIX}${key}`;

    // Check memory first
    if (memoryCache.has(storageKey)) {
      const entry = memoryCache.get(storageKey);
      if (Date.now() - entry.savedAt <= TTL_MS) {
        return entry.result;
      }
      memoryCache.delete(storageKey);
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const entry = JSON.parse(raw);
        if (Date.now() - entry.savedAt <= TTL_MS) {
          memoryCache.set(storageKey, entry);
          return entry.result;
        }
        localStorage.removeItem(storageKey);
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function setCachedAiResult({ input, note = '', model = '', promptVersion = '', result }) {
  try {
    const key = await hashKey({ input, note, model, promptVersion });
    const storageKey = `${CACHE_PREFIX}${key}`;
    const entry = {
      savedAt: Date.now(),
      result
    };

    memoryCache.set(storageKey, entry);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(entry));
      cleanOldEntries();
    }
  } catch (e) {
    cleanOldEntries(true);
  }
}

function cleanOldEntries(aggressive = false) {
  try {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (aggressive || (now - v.savedAt > TTL_MS)) {
        memoryCache.delete(k);
      }
    }

    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            if (aggressive || !item?.savedAt || (now - item.savedAt > TTL_MS)) {
              localStorage.removeItem(k);
            }
          } catch {
            localStorage.removeItem(k);
          }
        }
      }
    }
  } catch (e) {}
}

export function clearAiCache() {
  memoryCache.clear();
  cleanOldEntries(true);
}
