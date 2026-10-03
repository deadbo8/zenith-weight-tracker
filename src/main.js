/**
 * Zenith Main Application Bootstrap (Android-First Architecture)
 * Screen orchestration, native Capacitor bridge, Chart.js lifecycle,
 * reactive store subscriptions, and mobile ergonomics.
 */

import './style.css';
import { createIcons, icons } from 'lucide';
import { store } from './state.js';
import { ChartManager } from './charts.js';
import { renderHeader } from './components/header.js';
import { renderTodayHero } from './components/todayHero.js';
import { renderKpiCards } from './components/kpiCards.js';
import { renderRecentLogs } from './components/recentLogs.js';
import { renderQuickTools } from './components/quickTools.js';
import { renderRoadmap } from './components/roadmap.js';
import { renderPhotoSlider } from './components/photoSlider.js';
import { renderTrophiesPreview } from './components/trophiesPreview.js';
import { renderHistoryTable } from './components/historyTable.js';
import { renderTrendInsights } from './components/trendInsights.js';
import { ModalManager } from './components/modals.js';
import { triggerHaptic, updateStatusBar, initAndroidBridge } from './android.js';
import { scanDomForInvalidValues } from './format.js';

// Expose createIcons globally for dynamically rendered components
window.lucide = {
  createIcons: () => {
    try {
      createIcons({ icons });
    } catch (e) {
      console.warn('Lucide icon error:', e);
    }
  }
};

const appContainer = document.querySelector('#app');

import { FuelScreen } from './fuel/fuelScreen.js';
import { setupContextualFab } from './fuel/speedDial.js';
import { openYouScreen, closeYouScreen } from './components/youScreen.js';

// Android 4-Screen Ecosystem Layout Architecture: Today · Trends · [ + ] · Fuel · Journey
appContainer.innerHTML = `
  <div id="header-mount"></div>

  <main class="main-wrapper">
    <!-- Fresh Start Welcome (When entries = 0) -->
    <div id="fresh-start-mount" class="container"></div>

    <!-- SCREEN 1: TODAY (Check-in, Goal Card, Fuel Card, KPI Tiles) -->
    <section id="screen-summary" class="android-screen active" data-screen="summary">
      <div class="container screen-container">
        <!-- Collapsing Large Title -->
        <div class="screen-large-title-wrap">
          <h1 class="screen-large-title">Today</h1>
        </div>

        <!-- Today's Check-in Authoritative Hero -->
        <div id="today-hero-mount"></div>

        <!-- Goal Card + Fuel Card + 2 Compact Tiles (Pace & BMI) -->
        <div id="kpi-mount"></div>

        <!-- Recent Activity (Plain rows with hairline dividers) -->
        <div id="recent-logs-mount"></div>

        <!-- Insights Row (Horizontally scrollable strip + Weekly Review) -->
        <div id="quick-tools-mount"></div>
      </div>
    </section>

    <!-- SCREEN 2: TRENDS & ANALYTICS (Weight, Body, Net, Pattern, Intake) -->
    <section id="screen-trends" class="android-screen" data-screen="trends">
      <div class="container screen-container">
        <!-- Collapsing Large Title -->
        <div class="screen-large-title-wrap">
          <h1 class="screen-large-title">Trends</h1>
        </div>

        <!-- Interactive Trend Chart Card -->
        <div class="chart-card" id="analytics-section">
          <!-- Live Headline Above Chart (Updates on Scrub) -->
          <div class="trends-chart-headline">
            <div class="trends-headline-val mono-num" id="trends-headline-val">-- kg</div>
            <div class="trends-headline-sub" id="trends-headline-sub">30 days recorded</div>
          </div>

          <div class="chart-header">
            <div class="chart-controls-wrap">
              <!-- View Selector Tabs -->
              <div class="chart-tabs">
                <button class="chart-tab-btn active" data-view="trend">
                  <span>Weight</span>
                </button>
                <button class="chart-tab-btn" data-view="composition">
                  <span>Body</span>
                </button>
                <button class="chart-tab-btn" data-view="delta">
                  <span>Weekly Net</span>
                </button>
                <button class="chart-tab-btn" data-view="patterns">
                  <span>Day Pattern</span>
                </button>
                <button class="chart-tab-btn" data-view="intake">
                  <span>Intake</span>
                </button>
              </div>

              <div class="timeframe-and-table-row">
                <!-- Timeframe Filter Buttons -->
                <div class="timeframe-group">
                  <button class="timeframe-btn" data-time="7D">7D</button>
                  <button class="timeframe-btn active" data-time="30D">30D</button>
                  <button class="timeframe-btn" data-time="90D">90D</button>
                  <button class="timeframe-btn" data-time="6M">6M</button>
                  <button class="timeframe-btn" data-time="1Y">1Y</button>
                  <button class="timeframe-btn" data-time="ALL">ALL</button>
                </div>

                <!-- Table View Toggle for Accessibility & Precision -->
                <button class="chart-table-toggle-btn" id="btn-toggle-chart-table" title="Toggle Table View">
                  <i data-lucide="table"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Canvas Container -->
          <div class="chart-canvas-wrapper">
            <canvas id="main-chart-canvas"></canvas>
          </div>

          <!-- Sub-Stats Strip (Plain captions, no boxes) -->
          <div class="chart-stat-strip" id="chart-stat-strip"></div>
        </div>

        <!-- Contextual Intelligence Card -->
        <div id="trends-insight-mount"></div>
      </div>
    </section>

    <!-- SCREEN 3: FUEL (AI Nutrition, Energy Ring, Macros, Timeline, Chat Dock) -->
    <section id="screen-fuel" class="android-screen" data-screen="fuel">
      <div class="container screen-container" id="fuel-screen-mount"></div>
    </section>

    <!-- SCREEN 4: JOURNEY (Progress + History Segmented Control) -->
    <section id="screen-milestones" class="android-screen" data-screen="milestones">
      <div class="container screen-container">
        <!-- Collapsing Large Title -->
        <div class="screen-large-title-wrap">
          <h1 class="screen-large-title">Journey</h1>
        </div>

        <!-- Top Segmented Control (Progress | History) -->
        <div class="journey-segment-bar" data-no-sheet-drag>
          <button class="journey-segment-btn active" id="btn-segment-progress" data-segment="progress">Progress</button>
          <button class="journey-segment-btn" id="btn-segment-history" data-segment="history">History</button>
        </div>

        <!-- Segment 1: Progress (Forecast, Roadmap, Photo Slider, Awards) -->
        <div id="journey-progress-mount">
          <div class="milestones-stack">
            <div id="roadmap-mount"></div>
            <div id="photo-mount"></div>
            <div id="trophies-preview-mount"></div>
          </div>
        </div>

        <!-- Segment 2: History (Grouped List, Filter Strip, Search, Heat Map) -->
        <div id="journey-history-mount" class="hidden">
          <div id="history-mount"></div>
        </div>
      </div>
    </section>
  </main>

  <!-- Android Bottom Navigation Bar (Today · Trends · [ + ] · Fuel · Journey) -->
  <nav class="mobile-bottom-nav">
    <div class="mobile-bottom-nav-inner">
      <button class="mobile-nav-item active" data-tab="summary">
        <div class="nav-icon-pill">
          <i data-lucide="layout-grid"></i>
        </div>
        <span>Today</span>
      </button>

      <button class="mobile-nav-item" data-tab="trends">
        <div class="nav-icon-pill">
          <i data-lucide="trending-up"></i>
        </div>
        <span>Trends</span>
      </button>

      <!-- 56dp Flat Accent Center FAB with Speed Dial -->
      <button class="mobile-nav-center-btn" id="mobile-center-add" title="Quick Action">
        <i data-lucide="plus"></i>
      </button>

      <button class="mobile-nav-item" data-tab="fuel">
        <div class="nav-icon-pill">
          <i data-lucide="utensils"></i>
        </div>
        <span>Fuel</span>
      </button>

      <button class="mobile-nav-item" data-tab="milestones">
        <div class="nav-icon-pill">
          <i data-lucide="compass"></i>
        </div>
        <span>Journey</span>
      </button>
    </div>
  </nav>

  <!-- Mount point for pill-shaped Undo snackbar -->
  <div id="snackbar-mount"></div>
`;

// Initialize Modal Manager
const modalManager = new ModalManager(appContainer);

// Initialize Chart Manager
const canvas = document.querySelector('#main-chart-canvas');
const chartManager = new ChartManager(canvas);

import { initSpringPhysics, popScale } from './motion.js';

// Initialize CSS Spring physics
initSpringPhysics();

// Active Screen State & Tab Switching
let currentActiveScreen = 'summary';
let currentChartView = 'trend';
let currentJourneySegment = 'progress';
const tabsOrder = ['summary', 'trends', 'fuel', 'milestones'];

let fuelScreenInstance = null;

export function setJourneySegment(segment) {
  currentJourneySegment = segment;
  const progressMount = document.querySelector('#journey-progress-mount');
  const historyMount = document.querySelector('#journey-history-mount');
  const btnProgress = document.querySelector('#btn-segment-progress');
  const btnHistory = document.querySelector('#btn-segment-history');

  if (segment === 'history') {
    progressMount?.classList.add('hidden');
    historyMount?.classList.remove('hidden');
    btnProgress?.classList.remove('active');
    btnHistory?.classList.add('active');
  } else {
    historyMount?.classList.add('hidden');
    progressMount?.classList.remove('hidden');
    btnHistory?.classList.remove('active');
    btnProgress?.classList.add('active');
  }
}

export function switchScreen(screenName) {
  if (!tabsOrder.includes(screenName)) return;
  if (currentActiveScreen === screenName) return;

  const prevIdx = tabsOrder.indexOf(currentActiveScreen);
  const nextIdx = tabsOrder.indexOf(screenName);
  document.documentElement.dataset.dir = nextIdx > prevIdx ? 'fwd' : 'back';

  const updateDOM = () => {
    currentActiveScreen = screenName;

    // Toggle active class on screen sections
    document.querySelectorAll('.android-screen').forEach(screen => {
      if (screen.getAttribute('data-screen') === screenName) {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
    });

    // Toggle active class on bottom nav items + icon pop
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === screenName) {
        item.classList.add('active');
        const icon = item.querySelector('i');
        if (icon) popScale(icon);
      } else {
        item.classList.remove('active');
      }
    });

    // Toggle active class on desktop nav items
    document.querySelectorAll('.nav-link-btn').forEach(item => {
      if (item.getAttribute('data-tab') === screenName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // If switching to trends screen, resize Chart.js so canvas fits dimensions perfectly
    if (screenName === 'trends') {
      setTimeout(() => {
        chartManager.chart?.resize();
      }, 60);
    }
  };

  // Trigger tactile haptic
  triggerHaptic('selection');

  // Fluid View Transitions with slide + fade
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(updateDOM);
  } else {
    updateDOM();
  }
}

// Sub-Stats Strip renderer (Plain captions, no boxes)
function renderChartStatStrip() {
  const state = store.getState();
  const entries = state.entries;
  const strip = document.querySelector('#chart-stat-strip');
  if (!strip) return;

  if (!entries.length) {
    strip.innerHTML = '';
    return;
  }

  const weights = entries.map(e => e.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const avgW = weights.reduce((a, c) => a + c, 0) / weights.length;

  strip.innerHTML = `
    <div class="stat-plain-item">
      <span class="stat-plain-label">Lowest</span>
      <span class="stat-plain-value mono-num">${store.formatWeight(minW)}</span>
    </div>
    <div class="stat-plain-item">
      <span class="stat-plain-label">Highest</span>
      <span class="stat-plain-value mono-num">${store.formatWeight(maxW)}</span>
    </div>
    <div class="stat-plain-item">
      <span class="stat-plain-label">Average</span>
      <span class="stat-plain-value mono-num">${store.formatWeight(avgW)}</span>
    </div>
    <div class="stat-plain-item">
      <span class="stat-plain-label">Recorded</span>
      <span class="stat-plain-value mono-num">${entries.length} days</span>
    </div>
  `;
}

// Fresh Start Banner Renderer (when 0 entries exist)
function renderFreshStartBanner() {
  const mount = document.querySelector('#fresh-start-mount');
  if (!mount) return;
  const state = store.getState();

  if (state.entries.length > 0) {
    mount.innerHTML = '';
    return;
  }

  mount.innerHTML = `
    <div class="fresh-start-banner">
      <div class="fresh-start-content">
        <h2 class="fresh-start-title">Track with Precision</h2>
        <p class="fresh-start-desc">
          Minimalist weight & body intelligence. Log your first check-in to establish your baseline, or explore with sample data.
        </p>
        <div class="fresh-start-actions">
          <button class="btn btn-primary" id="btn-fresh-log">
            <i data-lucide="plus"></i>
            <span>Log Weight</span>
          </button>
          <button class="btn btn-secondary" id="btn-fresh-settings">
            <span>Profile & Goals</span>
          </button>
          <button class="btn btn-ghost" id="btn-fresh-demo" title="Preview with 60 days of sample data">
            <span>Sample Data</span>
          </button>
        </div>
      </div>
    </div>
  `;

  mount.querySelector('#btn-fresh-log')?.addEventListener('click', () => {
    modalManager.openLogModal();
  });
  mount.querySelector('#btn-fresh-settings')?.addEventListener('click', () => {
    openYouScreen();
  });
  mount.querySelector('#btn-fresh-demo')?.addEventListener('click', () => {
    handleAction('load-demo');
  });
}

// Action Dispatcher for components
function handleAction(action, payload) {
  if (action === 'open-log-modal') {
    triggerHaptic('light');
    modalManager.openLogModal();
  } else if (action === 'edit-entry') {
    triggerHaptic('light');
    modalManager.openLogModal(payload);
  } else if (action === 'open-settings' || action === 'open-you') {
    triggerHaptic('light');
    openYouScreen();
  } else if (action === 'open-calc') {
    triggerHaptic('light');
    modalManager.openCalculatorModal();
  } else if (action === 'open-badges') {
    triggerHaptic('light');
    modalManager.openBadgesModal();
  } else if (action === 'view-photo') {
    triggerHaptic('light');
    modalManager.openPhotoLightbox(payload);
  } else if (action === 'switch-tab') {
    switchScreen(payload);
  } else if (action === 'toast') {
    if (typeof payload === 'string') {
      modalManager.showSnackbar(payload);
    } else {
      modalManager.showSnackbar(payload.message, payload.actionText, payload.actionCallback);
    }
  } else if (action === 'load-demo') {
    store.loadSampleData();
    modalManager.triggerConfetti();
    triggerHaptic('success');
    modalManager.showSnackbar('Sample data loaded');
  }
}

// Full UI render pass
function renderApp() {
  const state = store.getState();
  const theme = state.profile.theme || 'dark';

  // Set theme on html element and update Android Status Bar
  document.documentElement.setAttribute('data-theme', theme);
  updateStatusBar(theme);

  // Render header & onboarding banner
  renderHeader(document.querySelector('#header-mount'), handleAction);
  renderFreshStartBanner();

  // Screen 1: Today
  renderTodayHero(document.querySelector('#today-hero-mount'), handleAction);
  renderKpiCards(document.querySelector('#kpi-mount'), handleAction);
  renderRecentLogs(document.querySelector('#recent-logs-mount'), handleAction, (target) => {
    switchScreen('milestones');
    setJourneySegment('history');
  });
  renderQuickTools(document.querySelector('#quick-tools-mount'), handleAction, switchScreen);

  // Screen 2: Trends
  renderChartStatStrip();
  chartManager.render(state.entries, state.profile);
  renderTrendInsights(document.querySelector('#trends-insight-mount'), currentChartView);

  // Screen 3: Fuel Screen Initialization
  if (!fuelScreenInstance) {
    fuelScreenInstance = new FuelScreen({
      containerId: 'fuel-screen-mount',
      onNavigateTab: (tab) => switchScreen(tab),
      onOpenWeightLog: () => modalManager.openLogModal()
    });
    fuelScreenInstance.mount();
  }

  // Screen 4: Journey (Progress & History Segment)
  renderRoadmap(document.querySelector('#roadmap-mount'), handleAction);
  renderPhotoSlider(document.querySelector('#photo-mount'), handleAction);
  renderTrophiesPreview(document.querySelector('#trophies-preview-mount'), handleAction);
  renderHistoryTable(document.querySelector('#history-mount'), handleAction);

  // Refresh Lucide icons
  window.lucide.createIcons();

  // Quality Guard: Scan DOM for forbidden null/undefined/NaN in dev
  scanDomForInvalidValues();
}

// Subscribe to state changes
store.subscribe(() => {
  renderApp();
});

// Setup Chart View and Timeframe Buttons
document.querySelectorAll('.chart-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic('selection');
    document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.getAttribute('data-view');
    currentChartView = view;

    const state = store.getState();
    chartManager.setView(view, state.entries, state.profile);
    renderTrendInsights(document.querySelector('#trends-insight-mount'), currentChartView);
    window.lucide.createIcons();
  });
});

document.querySelectorAll('.timeframe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic('selection');
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const time = btn.getAttribute('data-time');
    const state = store.getState();
    chartManager.setTimeframe(time, state.entries, state.profile);
  });
});

// Table View Toggle Button
document.querySelector('#btn-toggle-chart-table')?.addEventListener('click', () => {
  triggerHaptic('light');
  const btn = document.querySelector('#btn-toggle-chart-table');
  const state = store.getState();
  const isTable = chartManager.toggleTableView(state.entries, state.profile);
  if (btn) {
    if (isTable) {
      btn.classList.add('active');
      btn.setAttribute('title', 'Return to Chart View');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('title', 'Show Table View');
    }
  }
});

// Journey Segment Control Listeners
document.querySelector('#btn-segment-progress')?.addEventListener('click', () => {
  triggerHaptic('selection');
  setJourneySegment('progress');
});

document.querySelector('#btn-segment-history')?.addEventListener('click', () => {
  triggerHaptic('selection');
  setJourneySegment('history');
});

// Mobile Bottom Nav actions
document.querySelectorAll('.mobile-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.getAttribute('data-tab');
    if (tab) {
      switchScreen(tab);
    }
  });
});

// Contextual FAB with Speed-Dial (Section 3.2)
setupContextualFab({
  fabButton: document.querySelector('#mobile-center-add'),
  getCurrentTab: () => currentActiveScreen,
  onLogWeight: () => modalManager.openLogModal(),
  onSnapMeal: () => {
    switchScreen('fuel');
    document.querySelector('#btn-dock-camera')?.click();
  },
  onDescribeMeal: () => {
    switchScreen('fuel');
    document.querySelector('#dock-chat-input')?.focus();
  },
  onAddWater: () => {
    store.addWater(250);
    modalManager.showSnackbar('Added 250 ml water', 'Undo', () => store.undoAddWater());
  }
});

// Initialize Android Bridge (Hardware Back Button, Haptics, Keyboard)
initAndroidBridge({
  getActiveModal: () => {
    const speedDial = document.querySelector('#zenith-speed-dial-scrim.is-visible');
    if (speedDial) return speedDial;
    const youPage = document.querySelector('#zenith-you-page.is-visible');
    if (youPage) return youPage;
    return document.querySelector('.modal-backdrop.open, .modal-backdrop.is-visible');
  },
  closeActiveModal: (modal) => {
    if (modal.id === 'zenith-speed-dial-scrim') {
      modal.remove();
      return;
    }
    if (modal.id === 'zenith-you-page') {
      closeYouScreen();
      return;
    }
    modal.querySelector('.close-modal, #btn-cancel-log, #btn-cancel-add-food')?.click() || modal.remove();
  },
  getActiveTab: () => currentActiveScreen,
  switchTab: (tab) => {
    if (currentActiveScreen === 'milestones' && currentJourneySegment === 'history') {
      setJourneySegment('progress');
      return;
    }
    switchScreen(tab);
  }
});

// Keyboard shortcuts with safeguards
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    return;
  }
  if (document.body.classList.contains('modal-open')) {
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    modalManager.openLogModal();
  } else if (e.key === 't' || e.key === 'T') {
    const current = store.getState().profile.theme;
    const next = current === 'dark' || current === 'oled' ? 'light' : 'dark';
    store.setTheme(next);
  }
});

// Initial boot pass
renderApp();
