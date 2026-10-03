/**
 * Zenith Motion & Spring Physics Engine
 * Real physics-based spring curves using CSS linear() easing,
 * rolling digit counters, and micro-interaction springs.
 */

/**
 * Generate CSS linear() easing from spring physics equations
 */
export function spring({ stiffness = 180, damping = 20, mass = 1 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass)); // underdamped when z < 1
  const wd = w0 * Math.sqrt(Math.max(0.001, 1 - z * z));
  
  const x = t => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const dur = Math.min(1.2, 4 / (z * w0));
  const N = 40;
  const pts = Array.from({ length: N + 1 }, (_, i) => x((i / N) * dur).toFixed(3));
  
  return {
    easing: `linear(${pts.join(',')})`,
    ms: Math.round(dur * 1000)
  };
}

/**
 * Initialize global CSS spring variables on documentElement
 */
export function initSpringPhysics() {
  // Snappy: stiffness 300, damping 26 (taps, buttons, chips, icons)
  const snappy = spring({ stiffness: 300, damping: 26, mass: 1 });
  // Gentle: stiffness 170, damping 20 (sheets, cards, shared element transitions)
  const gentle = spring({ stiffness: 170, damping: 20, mass: 1 });

  document.documentElement.style.setProperty('--spring-snappy', snappy.easing);
  document.documentElement.style.setProperty('--spring-gentle', gentle.easing);
  document.documentElement.style.setProperty('--spring', gentle.easing);
  document.documentElement.style.setProperty('--spring-snappy-dur', `${snappy.ms}ms`);
  document.documentElement.style.setProperty('--spring-gentle-dur', `${gentle.ms}ms`);
}

/**
 * Number roll animation: rolls digits smoothly from previous value to target
 * using exponential deceleration
 */
export function rollTo(el, to, ms = 450, dp = 1, suffix = '') {
  if (!el) return;
  const rawTarget = typeof to === 'number' ? to : parseFloat(to);
  if (isNaN(rawTarget)) return;

  if (el._rollRaf) {
    cancelAnimationFrame(el._rollRaf);
    el._rollRaf = null;
  }

  const currentStr = el.dataset.v ?? el.textContent.replace(/[^0-9.-]/g, '');
  const from = parseFloat(currentStr);

  if (isNaN(from) || Math.abs(from - rawTarget) < 0.001) {
    el.textContent = `${rawTarget.toFixed(dp)}${suffix}`;
    el.dataset.v = String(rawTarget);
    return;
  }

  const t0 = performance.now();
  const ease = t => 1 - Math.pow(2, -10 * t);

  function tick(now) {
    const elapsed = now - t0;
    const progress = Math.min(elapsed / ms, 1);
    const curVal = from + (rawTarget - from) * ease(progress);
    el.textContent = `${curVal.toFixed(dp)}${suffix}`;

    if (progress < 1) {
      el._rollRaf = requestAnimationFrame(tick);
    } else {
      el.textContent = `${rawTarget.toFixed(dp)}${suffix}`;
      el.dataset.v = String(rawTarget);
      el._rollRaf = null;
    }
  }

  el._rollRaf = requestAnimationFrame(tick);
}

/**
 * Micro-scale pop (1 -> 1.12 -> 1) on selected elements
 */
export function popScale(element) {
  if (!element) return;
  element.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.12)' },
    { transform: 'scale(1)' }
  ], {
    duration: 220,
    easing: 'ease-out'
  });
}
