/**
 * Precision Horizontal Ruler Dial Component (Apple Physical Instrument)
 * - Fixed center needle outside the scroller (pointer-events: none)
 * - Highlighted active tick (.is-active) and neighboring magnification (.is-near)
 * - Native scroll-snap (scroll-snap-type: x mandatory)
 * - Edge fade gradient mask
 * - Reference marker for previous weight
 * - Tenths-based integer math to prevent floating point drift
 * - Throttled selection haptic (max 1 per 30ms on index change)
 * - Programmatic scroll guard to eliminate feedback loops
 * - Slider accessibility (role="slider", aria-valuenow, arrow keys)
 */

export function createRulerDial({ mount, value, span = 25, reference = null, unitLabel = 'kg', onChange, onTick }) {
  if (!mount) return null;

  const TICK_W = 12; // Must equal --tick-w in CSS
  const baseT = Math.round((value - span) * 10); // Tenths at index 0
  const count = span * 2 * 10 + 1;
  let lastIdx = -1;
  let programmatic = false;
  let raf = 0;
  let endTimer = 0;
  let lastTickAt = 0;
  let active = null;

  const tickHtml = i => {
    const t = baseT + i;
    const kind = t % 10 === 0 ? 'major' : t % 5 === 0 ? 'mid' : 'minor';
    const label = kind === 'major' ? ` data-label="${(t / 10).toFixed(0)}"` : '';
    return `<i class="tick ${kind}"${label} data-idx="${i}"></i>`;
  };

  mount.innerHTML = `
    <div class="ruler" data-no-sheet-drag role="slider" tabindex="0"
         aria-label="Weight" aria-valuemin="${(baseT / 10).toFixed(1)}" aria-valuemax="${((baseT + count - 1) / 10).toFixed(1)}"
         aria-valuenow="${value.toFixed(1)}" aria-valuetext="${value.toFixed(1)} ${unitLabel}">
      <div class="ruler-scroller">
        <div class="ruler-track">
          ${Array.from({ length: count }, (_, i) => tickHtml(i)).join('')}
        </div>
      </div>
      <div class="ruler-needle" aria-hidden="true"></div>
      ${reference != null ? `<div class="ruler-ref" aria-hidden="true" title="Last: ${reference} ${unitLabel}"></div>` : ''}
    </div>
  `;

  const root = mount.firstElementChild;
  const scroller = root.querySelector('.ruler-scroller');
  const ticks = root.querySelectorAll('.tick');
  const idxToVal = i => Math.round((baseT + i)) / 10;
  const valToIdx = v => Math.max(0, Math.min(count - 1, Math.round(v * 10) - baseT));
  const readIdx = () => Math.max(0, Math.min(count - 1, Math.round(scroller.scrollLeft / TICK_W)));

  function setActive(i) {
    if (active) active.classList.remove('is-active');
    if (ticks[lastIdx - 1]) ticks[lastIdx - 1].classList.remove('is-near');
    if (ticks[lastIdx + 1]) ticks[lastIdx + 1].classList.remove('is-near');

    active = ticks[i];
    if (active) active.classList.add('is-active');
    if (ticks[i - 1]) ticks[i - 1].classList.add('is-near');
    if (ticks[i + 1]) ticks[i + 1].classList.add('is-near');

    const curVal = idxToVal(i);
    root.setAttribute('aria-valuenow', curVal.toFixed(1));
    root.setAttribute('aria-valuetext', `${curVal.toFixed(1)} ${unitLabel}`);
  }

  scroller.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = readIdx();
      if (i !== lastIdx) {
        lastIdx = i;
        setActive(i);
        if (!programmatic) {
          const now = performance.now();
          if (now - lastTickAt > 30) {
            onTick?.();
            lastTickAt = now;
          }
          onChange?.(idxToVal(i), { source: 'scroll' });
        }
      }
      clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        programmatic = false;
      }, 140);
    });
  }, { passive: true });

  // Keyboard navigation for accessibility
  root.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) {
      e.preventDefault();
      const nextIdx = Math.max(0, Math.min(count - 1, readIdx() + d));
      const nextVal = idxToVal(nextIdx);
      api.setValue(nextVal, { smooth: true });
      onChange?.(nextVal, { source: 'key' });
    }
  });

  // Click on tick to jump
  ticks.forEach(t => {
    t.addEventListener('click', e => {
      e.stopPropagation();
      const i = parseInt(t.dataset.idx, 10);
      if (!isNaN(i)) {
        const nextVal = idxToVal(i);
        api.setValue(nextVal, { smooth: true });
        onChange?.(nextVal, { source: 'click' });
      }
    });
  });

  const api = {
    setValue(v, { smooth = true } = {}) {
      programmatic = true;
      const i = valToIdx(v);
      lastIdx = i;
      scroller.scrollTo({
        left: i * TICK_W,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setActive(i);
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      mount.innerHTML = '';
    }
  };

  requestAnimationFrame(() => api.setValue(value, { smooth: false }));
  return api;
}
