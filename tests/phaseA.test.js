import { describe, it, expect } from 'vitest';
import { isNum, fmt, fmtInt, safe, referenceWeight, fmtDelta } from '../src/format.js';
import { calculateKPIs, calculateBMI, calculateBMR, calculateTDEE } from '../src/analytics.js';

describe('Phase A - Task 1.3: Number & KPI Formatting Hardening', () => {
  it('isNum validates numbers and excludes NaN and Infinity', () => {
    expect(isNum(0)).toBe(true);
    expect(isNum(77.8)).toBe(true);
    expect(isNum(-5.2)).toBe(true);
    expect(isNum(NaN)).toBe(false);
    expect(isNum(Infinity)).toBe(false);
    expect(isNum(-Infinity)).toBe(false);
    expect(isNum(null)).toBe(false);
    expect(isNum(undefined)).toBe(false);
    expect(isNum('77.8')).toBe(false);
  });

  it('fmt formats numbers with decimal places and calm fallback', () => {
    expect(fmt(77.43, { dp: 1 })).toBe('77.4');
    expect(fmt(77.43, { dp: 1, unit: 'kg' })).toBe('77.4 kg');
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
  });

  it('fmtInt formats integers with locale string and calm fallback', () => {
    expect(fmtInt(2450.4)).toBe('2,450');
    expect(fmtInt(null)).toBe('—');
    expect(fmtInt(NaN)).toBe('—');
  });

  it('safe strips null/undefined/NaN', () => {
    expect(safe('Valid', 'fallback')).toBe('Valid');
    expect(safe(null, 'fallback')).toBe('fallback');
    expect(safe(undefined, 'fallback')).toBe('fallback');
    expect(safe(NaN, 'fallback')).toBe('fallback');
  });

  it('referenceWeight fallback chain works correctly', () => {
    // 1. Latest entry weight
    const stateWithEntries = {
      entries: [{ weight: 80.0 }, { weight: 77.8 }],
      profile: { startWeight: 82.0 }
    };
    expect(referenceWeight(stateWithEntries)).toEqual({ kg: 77.8, source: 'entry' });

    // 2. Profile start weight fallback
    const stateNoEntries = {
      entries: [],
      profile: { startWeight: 82.0 }
    };
    expect(referenceWeight(stateNoEntries)).toEqual({ kg: 82.0, source: 'start' });

    // 3. No weight available
    const emptyState = {
      entries: [],
      profile: {}
    };
    expect(referenceWeight(emptyState)).toEqual({ kg: null, source: 'none' });
  });

  it('calculateKPIs never returns null or NaN in empty state and provides status blocks', () => {
    const kpisEmpty = calculateKPIs([], { height: null, goalWeight: null, startWeight: null });
    expect(kpisEmpty.hasEntries).toBe(false);
    expect(kpisEmpty.bmiDetails.status).toBe('empty');
    expect(kpisEmpty.bmiDetails.value).toBe(null);
    expect(kpisEmpty.bmiCategory).toBe('—');
    expect(kpisEmpty.pace.status).toBe('empty');
    expect(kpisEmpty.pace.weeklyRate).toBe(null);
    expect(kpisEmpty.goal.status).toBe('empty');
    expect(kpisEmpty.trend.status).toBe('empty');

    // Partial state: height set, startWeight set, but no entries
    const kpisPartial = calculateKPIs([], { height: 180, startWeight: 80, goalWeight: 75 });
    expect(kpisPartial.bmiDetails.status).toBe('ready');
    expect(kpisPartial.bmiDetails.value).toBe(24.7);
    expect(kpisPartial.bmiDetails.source).toBe('start');
    expect(kpisPartial.goal.status).toBe('partial');
    expect(kpisPartial.goal.remaining).toBe(5);

    // Ready state: multiple entries spanning time
    const entries = [
      { date: '2026-10-01T08:00:00.000Z', weight: 80.0 },
      { date: '2026-10-02T08:00:00.000Z', weight: 79.5 },
      { date: '2026-10-03T08:00:00.000Z', weight: 79.2 }
    ];
    const kpisReady = calculateKPIs(entries, { height: 180, startWeight: 80, goalWeight: 75 });
    expect(kpisReady.hasEntries).toBe(true);
    expect(kpisReady.currentWeight).toBe(79.2);
    expect(kpisReady.bmiDetails.status).toBe('ready');
    expect(kpisReady.pace.status).toBe('ready');
    expect(kpisReady.goal.status).toBe('ready');
    expect(kpisReady.trend.status).toBe('ready');
  });

  it('calculateBMI, BMR, and TDEE guard division by zero and invalid inputs', () => {
    expect(calculateBMI(null, 180)).toBe(null);
    expect(calculateBMI(80, 0)).toBe(null);
    expect(calculateBMI(80, -180)).toBe(null);
    expect(calculateBMI(80, 180)).toBe(24.7);

    expect(calculateBMR(null, 180, 30)).toBe(null);
    expect(calculateTDEE(null, 180, 30, 'male')).toBe(null);
  });
});

describe('Phase A - Task 1.1: Ruler Dial Tenths Math', () => {
  it('converts value to index and back with zero floating point drift', () => {
    const value = 77.8;
    const span = 25;
    const baseT = Math.round((value - span) * 10); // 528 tenths
    const count = span * 2 * 10 + 1; // 501 ticks

    const idxToVal = i => (baseT + i) / 10;
    const valToIdx = v => Math.max(0, Math.min(count - 1, Math.round(v * 10) - baseT));

    // Initial center index
    const centerIdx = valToIdx(77.8);
    expect(idxToVal(centerIdx)).toBe(77.8);

    // Test steps
    expect(idxToVal(valToIdx(77.4))).toBe(77.4);
    expect(idxToVal(valToIdx(77.9))).toBe(77.9);
    expect(idxToVal(valToIdx(52.8))).toBe(52.8);
    expect(idxToVal(valToIdx(102.8))).toBe(102.8);
  });
});

describe('Phase A - Task 1.4: Field Number Number Parser', () => {
  const parseVal = (raw) => {
    if (!raw) return null;
    const cleaned = String(raw).trim().replace(',', '.').replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  it('accepts dot and comma decimals and strips extraneous chars', () => {
    expect(parseVal('18.5')).toBe(18.5);
    expect(parseVal('18,5')).toBe(18.5);
    expect(parseVal(' 82.0 cm ')).toBe(82.0);
    expect(parseVal('')).toBe(null);
    expect(parseVal('   ')).toBe(null);
  });
});
