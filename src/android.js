/**
 * Android Native Integration Module
 * Capacitor Haptics, Status Bar, App Back Button, and Keyboard management.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

// Tactile Haptic Feedback
export async function triggerHaptic(type = 'light') {
  try {
    if (type === 'selection') {
      await Haptics.selectionChanged();
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (type === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (e) {
    // Fallback to Web Vibration API if on browser / WebView without plugin
    if ('vibrate' in navigator) {
      if (type === 'success') navigator.vibrate([20, 40, 20]);
      else if (type === 'medium') navigator.vibrate(25);
      else navigator.vibrate(12);
    }
  }
}

// Android Status Bar Styling
export async function updateStatusBar(theme = 'dark') {
  try {
    if (theme === 'light') {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#f2f2f7' });
    } else {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#000000' });
    }
  } catch (e) {
    // Graceful fallback on web
  }
}

// Hardware Back Button & Keyboard Setup
export function initAndroidBridge({ onBackNavigation, getActiveModal, closeActiveModal, getActiveTab, switchTab }) {
  // 1. Android Hardware Back Button & Gesture Navigation
  try {
    App.addListener('backButton', () => {
      // If a modal or sheet is open, close it
      const activeModal = getActiveModal ? getActiveModal() : null;
      if (activeModal) {
        closeActiveModal(activeModal);
        triggerHaptic('light');
        return;
      }

      // If photo lightbox is open, close it
      const lightbox = document.getElementById('modal-photo-lightbox');
      if (lightbox && lightbox.classList.contains('open')) {
        lightbox.querySelector('.close-modal')?.click();
        triggerHaptic('light');
        return;
      }

      // If on another tab, return to summary tab
      const currentTab = getActiveTab ? getActiveTab() : 'summary';
      if (currentTab !== 'summary') {
        switchTab('summary');
        triggerHaptic('selection');
        return;
      }

      // If already on summary with nothing open, minimize app
      App.minimizeApp();
    });
  } catch (e) {
    // Browser environment fallback
  }

  // 2. Android Keyboard Ergonomics
  try {
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  } catch (e) {}
}
