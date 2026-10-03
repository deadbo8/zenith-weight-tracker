/**
 * Standardized Number Input Field Component (Section 1.4)
 * - 2-column grid ready (height 60px, radius 14px, caption label above value)
 * - type="text" with inputmode="decimal" (no native spinners)
 * - Select-all on focus
 * - Locale comma/dot decimal handling
 * - Clean range validation: shows inline hint ("Check this value"), stores null when empty (never 0)
 */

export function createFieldNumber({ id, label, unit, min, max, decimals = 1, value = null, onChange }) {
  const container = document.createElement('div');
  container.className = 'field';
  container.id = `field-${id}`;

  const formatInitial = (v) => {
    if (v === null || v === undefined || isNaN(v)) return '';
    return Number(v).toFixed(decimals);
  };

  container.innerHTML = `
    <label for="${id}">${label}</label>
    <input type="text" inputmode="decimal" enterkeyhint="next" id="${id}" value="${formatInitial(value)}" placeholder="—" />
    <span class="unit">${unit}</span>
    <span class="hint" style="display:none">Check this value</span>
  `;

  const input = container.querySelector('input');
  const hint = container.querySelector('.hint');

  const parseVal = (raw) => {
    if (!raw) return null;
    const cleaned = String(raw).trim().replace(',', '.').replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const validate = () => {
    const raw = input.value.trim();
    if (!raw) {
      container.classList.remove('invalid');
      hint.style.display = 'none';
      return { valid: true, value: null };
    }
    const val = parseVal(raw);
    if (val === null || (min != null && val < min) || (max != null && val > max)) {
      container.classList.add('invalid');
      hint.style.display = 'block';
      return { valid: false, value: val };
    }
    container.classList.remove('invalid');
    hint.style.display = 'none';
    return { valid: true, value: Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals) };
  };

  // Select all on focus
  input.addEventListener('focus', () => {
    requestAnimationFrame(() => input.select());
  });

  input.addEventListener('input', () => {
    const res = validate();
    onChange?.(res.value, res.valid);
  });

  input.addEventListener('blur', () => {
    const res = validate();
    if (res.valid && res.value !== null) {
      input.value = res.value.toFixed(decimals);
    }
  });

  return {
    element: container,
    getValue() {
      const res = validate();
      return res.valid ? res.value : null;
    },
    isValid() {
      return validate().valid;
    },
    setValue(v) {
      input.value = formatInitial(v);
      validate();
    }
  };
}
