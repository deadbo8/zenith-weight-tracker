/**
 * Zenith Safe Number & KPI Formatting Hardening (Section 1.3)
 * Never show null, undefined, NaN, Infinity, or [object Object] anywhere in the UI.
 */

export const isNum = v => typeof v === 'number' && Number.isFinite(v);

export const fmt = (v, { dp = 1, unit = '', fallback = '—' } = {}) =>
  isNum(v) ? `${v.toFixed(dp)}${unit ? ' ' + unit : ''}` : fallback;

export const fmtInt = (v, fallback = '—') =>
  isNum(v) ? Math.round(v).toLocaleString() : fallback;

export const safe = (v, fallback = '') =>
  (v === null || v === undefined || Number.isNaN(v) ? fallback : v);

/**
 * Reference weight fallback chain:
 * 1. Latest entry weight (source: 'entry')
 * 2. Profile start weight (source: 'start')
 * 3. null (source: 'none')
 */
export function referenceWeight(state) {
  if (!state) return { kg: null, source: 'none' };
  const entries = state.entries || [];
  const last = entries.length > 0 ? entries[entries.length - 1]?.weight : null;
  if (isNum(last)) return { kg: last, source: 'entry' };
  if (isNum(state.profile?.startWeight)) return { kg: state.profile.startWeight, source: 'start' };
  return { kg: null, source: 'none' };
}

/**
 * Safe delta formatter with optional sign and fallback
 */
export const fmtDelta = (diff, unit = '', { plusSign = true, fallback = '—' } = {}) => {
  if (!isNum(diff)) return fallback;
  const rounded = Math.round(diff * 10) / 10;
  const sign = rounded > 0 && plusSign ? '+' : '';
  return `${sign}${rounded.toFixed(1)}${unit ? ' ' + unit : ''}`;
};

/**
 * Dev-only guard that scans rendered DOM for forbidden strings:
 * null, undefined, NaN, Infinity, [object Object]
 */
export function scanDomForInvalidValues() {
  if (import.meta.env?.DEV) {
    const invalidPattern = /\b(null|undefined|NaN|Infinity|\[object Object\])\b/;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent?.trim();
        if (txt && invalidPattern.test(txt)) {
          console.warn('[Zenith Quality Guard] Invalid value rendered in DOM:', txt, node.parentElement);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          for (const child of node.childNodes) walk(child);
        }
      }
    };
    walk(document.body);
  }
}

