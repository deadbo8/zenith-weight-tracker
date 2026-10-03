import { triggerHaptic } from '../android.js';

/**
 * Universal Swipe-Down-To-Dismiss Gesture for Bottom Sheets and Modals (Section 1.2)
 * - Drag zones: grabber & header always work; content works when scrollTop <= 0 and no text field focused
 * - Exclusions: elements with [data-no-sheet-drag] (ruler, sliders, charts) never trigger sheet drag
 * - Physics: 1:1 finger tracking, dismisses if dy > 120px OR velocity > 0.5 px/ms
 * - Unsaved changes guard: springs back and calls onDirtyDismiss if isDirty()
 */
export function attachSheetGesture(sheet, { handle, scroller, onClose, isDirty = () => false, onDirtyDismiss }) {
  if (!sheet) return () => {};

  const DIST = 120;
  const VEL = 0.5;
  const scrim = sheet.closest('.modal-backdrop')?.querySelector('.scrim') || sheet.closest('.modal-backdrop');
  let state = 'idle'; // idle | armed | drag | scroll
  let x0 = 0, y0 = 0, lastY = 0, lastT = 0, dy = 0, v = 0, closing = false;

  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');

  const onTouchStart = (e) => {
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    if (e.target.closest('[data-no-sheet-drag]')) {
      state = 'scroll';
      return;
    }
    const fromHandle = handle && (handle === e.target || handle.contains(e.target));
    const isAtTop = scroller ? scroller.scrollTop <= 0 : true;
    state = (fromHandle || (isAtTop && !typing())) ? 'armed' : 'scroll';
    x0 = t.clientX;
    y0 = lastY = t.clientY;
    lastT = e.timeStamp;
    dy = 0;
    v = 0;
  };

  const onTouchMove = (e) => {
    if (state === 'idle' || state === 'scroll') return;
    const t = e.touches[0];
    const mx = t.clientX - x0;
    const my = t.clientY - y0;

    if (state === 'armed') {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      if (my > 0 && Math.abs(my) > Math.abs(mx)) {
        state = 'drag';
        sheet.style.transition = 'none';
      } else {
        state = 'scroll';
        return;
      }
    }

    if (state === 'drag') {
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, my);
      const dt = e.timeStamp - lastT;
      if (dt > 0) v = (t.clientY - lastY) / dt;
      lastY = t.clientY;
      lastT = e.timeStamp;
      sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
      if (scrim) {
        scrim.style.opacity = String(Math.max(0, 1 - dy / (sheet.offsetHeight * 0.9)));
      }
    }
  };

  const reset = () => {
    sheet.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)';
    sheet.style.transform = '';
    if (scrim) {
      scrim.style.transition = 'opacity 320ms ease';
      scrim.style.opacity = '';
      setTimeout(() => {
        if (scrim) scrim.style.transition = '';
      }, 340);
    }
    setTimeout(() => {
      sheet.style.transition = '';
    }, 340);
  };

  const onTouchEnd = () => {
    const wasDrag = state === 'drag';
    state = 'idle';
    if (!wasDrag) return;

    sheet.style.transition = 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)';
    const wantsClose = dy > DIST || v > VEL;

    if (wantsClose && isDirty()) {
      reset();
      onDirtyDismiss?.();
      return;
    }

    if (!wantsClose) {
      reset();
      return;
    }

    // Dismiss
    sheet.style.transform = 'translate3d(0, 100%, 0)';
    if (scrim) {
      scrim.style.transition = 'opacity 240ms ease';
      scrim.style.opacity = '0';
    }
    triggerHaptic('light');

    const finish = () => {
      if (closing) return;
      closing = true;
      onClose?.({ reason: 'swipe' });
    };

    sheet.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 360); // Safety net
  };

  sheet.addEventListener('touchstart', onTouchStart, { passive: true });
  sheet.addEventListener('touchmove', onTouchMove, { passive: false });
  sheet.addEventListener('touchend', onTouchEnd);
  sheet.addEventListener('touchcancel', onTouchEnd);

  // Return teardown function
  return () => {
    sheet.removeEventListener('touchstart', onTouchStart);
    sheet.removeEventListener('touchmove', onTouchMove);
    sheet.removeEventListener('touchend', onTouchEnd);
    sheet.removeEventListener('touchcancel', onTouchEnd);
  };
}
