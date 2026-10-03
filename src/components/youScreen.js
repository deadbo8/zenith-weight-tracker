/**
 * You Screen Component (Section 9)
 * Full-screen Cupertino-style settings and user profile with 48dp rows,
 * live recalculation, BYOK Gemini API key management, and data sovereignty.
 */

import { store, getLocalDateString } from '../state.js';
import { testConnection } from '../ai/geminiClient.js';
import { getKey, setKey, removeKey } from '../ai/secureKey.js';
import { triggerHaptic } from '../android.js';
import { captureProgressPhoto } from '../camera.js';

export function openYouScreen() {
  const existing = document.querySelector('#zenith-you-page');
  if (existing) existing.remove();

  document.body.classList.add('modal-open');

  const youPage = document.createElement('div');
  youPage.className = 'zenith-you-page is-visible';
  youPage.id = 'zenith-you-page';

  document.body.appendChild(youPage);
  renderYouPageContent(youPage);
}

export function closeYouScreen() {
  const youPage = document.querySelector('#zenith-you-page');
  if (youPage) {
    youPage.classList.remove('is-visible');
    youPage.classList.add('closing');
    setTimeout(() => {
      youPage.remove();
      const anyOther = document.querySelector('.modal-backdrop.open, .modal-backdrop.is-visible');
      if (!anyOther) {
        document.body.classList.remove('modal-open');
      }
    }, 220);
  } else {
    document.body.classList.remove('modal-open');
  }
}

async function renderYouPageContent(container) {
  const state = store.getState();
  const profile = state.profile;
  const currentKey = await getKey();
  const maskedKey = currentKey ? `●●●●●●●●${currentKey.slice(-4)}` : '';

  // Calculate profile completeness
  let filledCount = 0;
  const totalFields = 6;
  if (profile.heightCm) filledCount++;
  if (profile.sex && profile.sex !== 'unspecified') filledCount++;
  if (profile.age || profile.birthDate) filledCount++;
  if (profile.startWeight) filledCount++;
  if (profile.goalWeight) filledCount++;
  if (profile.activityLevel) filledCount++;

  const entriesCount = state.entries.length;
  const mealsCount = state.meals.length;
  const initials = profile.displayName ? profile.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'ME';

  container.innerHTML = `
    <div class="you-page-header-bar">
      <button class="you-page-back-btn" id="btn-close-you" aria-label="Close Profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <h1 class="you-page-nav-title">Profile & Settings</h1>
      <div style="width: 40px;"></div>
    </div>

    <div class="you-page-scrollable">
      <!-- Profile Header Card -->
      <div class="you-profile-card">
        <div class="you-avatar-row">
          <div class="you-avatar-circle" id="btn-change-avatar" role="button" aria-label="Change photo">
            ${profile.avatar?.photoPath ? `
              <img src="${profile.avatar.photoPath}" class="you-avatar-img" alt="${profile.displayName}" />
            ` : `
              <span>${initials}</span>
            `}
          </div>
          <div class="you-profile-meta">
            <h2 class="you-display-name">${profile.displayName || 'My Profile'}</h2>
            <span class="you-member-since">Zenith 2.0 · Precision Intelligence</span>
          </div>
        </div>

        <div class="you-profile-divider"></div>

        <div class="you-goal-summary-row">
          <span>Goal: <strong>${profile.goalType === 'lose' ? 'Lose' : (profile.goalType === 'gain' ? 'Gain' : 'Maintain')} ${profile.goalWeight ? store.formatWeight(profile.goalWeight) : '--'}</strong></span>
        </div>

        <div class="you-stats-row">
          <div class="you-stat-tile">
            <span class="stat-number">${entriesCount}</span>
            <span class="stat-label">weigh-ins</span>
          </div>
          <div class="you-stat-tile">
            <span class="stat-number">${mealsCount}</span>
            <span class="stat-label">meals</span>
          </div>
          <div class="you-stat-tile">
            <span class="stat-number">${state.unlockedBadges.length}</span>
            <span class="stat-label">badges</span>
          </div>
        </div>

        <div class="you-completeness-meter">
          <div class="completeness-bar">
            <div class="completeness-fill" style="width: ${(filledCount / totalFields) * 100}%"></div>
          </div>
          <span class="completeness-caption">Profile ${filledCount} of ${totalFields} complete</span>
        </div>
      </div>

      <!-- GROUP 1: BODY AND GOAL -->
      <div class="you-inset-group">
        <div class="group-title">Body and Goal</div>

        <div class="you-row">
          <span class="row-label">Biological Sex</span>
          <select class="row-select" id="field-sex">
            <option value="male" ${profile.sex === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${profile.sex === 'female' ? 'selected' : ''}>Female</option>
            <option value="unspecified" ${profile.sex === 'unspecified' ? 'selected' : ''}>Unspecified</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Age</span>
          <input type="number" id="field-age" class="row-input" value="${profile.age || 28}" min="12" max="110" />
        </div>

        <div class="you-row">
          <span class="row-label">Height (cm)</span>
          <input type="number" id="field-height" class="row-input" value="${profile.heightCm || 175}" min="100" max="250" />
        </div>

        <div class="you-row">
          <span class="row-label">Start Weight (${profile.units?.weight || 'kg'})</span>
          <input type="number" id="field-start-weight" class="row-input" value="${profile.startWeight ? store.toDisplayWeight(profile.startWeight) : ''}" placeholder="e.g. 80" step="0.1" />
        </div>

        <div class="you-row">
          <span class="row-label">Goal Weight (${profile.units?.weight || 'kg'})</span>
          <input type="number" id="field-goal-weight" class="row-input" value="${profile.goalWeight ? store.toDisplayWeight(profile.goalWeight) : ''}" placeholder="e.g. 72" step="0.1" />
        </div>

        <div class="you-row">
          <span class="row-label">Goal Type</span>
          <select class="row-select" id="field-goal-type">
            <option value="lose" ${profile.goalType === 'lose' ? 'selected' : ''}>Fat Loss</option>
            <option value="maintain" ${profile.goalType === 'maintain' ? 'selected' : ''}>Maintenance</option>
            <option value="gain" ${profile.goalType === 'gain' ? 'selected' : ''}>Muscle Gain</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Weekly Pace</span>
          <select class="row-select" id="field-weekly-pace">
            <option value="0.25" ${profile.weeklyRatePref === 0.25 ? 'selected' : ''}>0.25 kg/wk (Gentle)</option>
            <option value="0.5" ${profile.weeklyRatePref === 0.5 ? 'selected' : ''}>0.5 kg/wk (Recommended)</option>
            <option value="0.75" ${profile.weeklyRatePref === 0.75 ? 'selected' : ''}>0.75 kg/wk (Brisk)</option>
            <option value="1.0" ${profile.weeklyRatePref === 1.0 ? 'selected' : ''}>1.0 kg/wk (Aggressive)</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Activity Level</span>
          <select class="row-select" id="field-activity">
            <option value="sedentary" ${profile.activityLevel === 'sedentary' ? 'selected' : ''}>Sedentary (Desk job)</option>
            <option value="light" ${profile.activityLevel === 'light' ? 'selected' : ''}>Light (1-3 days/wk)</option>
            <option value="moderate" ${profile.activityLevel === 'moderate' ? 'selected' : ''}>Moderate (3-5 days/wk)</option>
            <option value="active" ${profile.activityLevel === 'active' ? 'selected' : ''}>Active (6-7 days/wk)</option>
            <option value="very_active" ${profile.activityLevel === 'very_active' ? 'selected' : ''}>Very Active (Athlete)</option>
          </select>
        </div>
      </div>

      <!-- GROUP 2: NUTRITION & CALM MODE -->
      <div class="you-inset-group">
        <div class="group-title">Nutrition</div>

        <div class="you-row">
          <span class="row-label">Calorie Target</span>
          <select class="row-select" id="field-calorie-mode">
            <option value="auto" ${profile.nutrition?.calorieMode === 'auto' ? 'selected' : ''}>Auto (Formula / Adaptive)</option>
            <option value="custom" ${profile.nutrition?.calorieMode === 'custom' ? 'selected' : ''}>Custom</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Macro Preset</span>
          <select class="row-select" id="field-macro-preset">
            <option value="balanced" ${profile.nutrition?.macroPreset === 'balanced' ? 'selected' : ''}>Balanced (40C / 30P / 30F)</option>
            <option value="high_protein" ${profile.nutrition?.macroPreset === 'high_protein' ? 'selected' : ''}>High Protein (2.0 g/kg)</option>
            <option value="low_carb" ${profile.nutrition?.macroPreset === 'low_carb' ? 'selected' : ''}>Low Carb (Ketogenic lean)</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Diet Pattern</span>
          <select class="row-select" id="field-diet-pattern">
            <option value="balanced" ${profile.diet?.pattern === 'balanced' ? 'selected' : ''}>Anything goes</option>
            <option value="vegetarian" ${profile.diet?.pattern === 'vegetarian' ? 'selected' : ''}>Vegetarian</option>
            <option value="vegan" ${profile.diet?.pattern === 'vegan' ? 'selected' : ''}>Vegan</option>
            <option value="pescatarian" ${profile.diet?.pattern === 'pescatarian' ? 'selected' : ''}>Pescatarian</option>
            <option value="keto" ${profile.diet?.pattern === 'keto' ? 'selected' : ''}>Keto</option>
          </select>
        </div>

        <div class="you-row">
          <div class="row-text-block">
            <span class="row-label">Calm Mode</span>
            <span class="row-subtitle">Hides raw numbers, shows gentle words & ranges</span>
          </div>
          <input type="checkbox" id="field-calm-mode" class="row-toggle" ${profile.nutrition?.calmMode ? 'checked' : ''} />
        </div>
      </div>

      <!-- GROUP 3: AI ASSISTANT (BYOK GEMINI) -->
      <div class="you-inset-group">
        <div class="group-title">AI Assistant (Bring-Your-Own-Key)</div>

        <div class="you-row-vertical">
          <div class="ai-key-header">
            <span class="row-label">Google Gemini API Key</span>
            <span class="ai-status-pill ${currentKey ? 'is-valid' : ''}" id="ai-key-status">
              ${currentKey ? 'Connected ✓' : 'Not Connected'}
            </span>
          </div>
          <div class="ai-key-input-wrap">
            <input
              type="password"
              id="field-gemini-key"
              class="row-input key-input"
              placeholder="Paste AI Studio Key"
              value="${currentKey || ''}"
            />
            <button class="btn-key-action" id="btn-paste-key">Paste</button>
            <button class="btn-key-action" id="btn-test-key">Test</button>
          </div>
          <div class="ai-key-subline">
            <a href="https://aistudio.google.com/apikey" target="_blank" class="ai-link">Get a free key at aistudio.google.com ↗</a>
            ${currentKey ? `<button class="btn-remove-key" id="btn-remove-key">Remove key</button>` : ''}
          </div>
        </div>

        <div class="you-row">
          <span class="row-label">Quality Tier</span>
          <select class="row-select" id="field-ai-quality">
            <option value="fast" ${state.ai?.quality === 'fast' ? 'selected' : ''}>Fast (Gemini 3.5 Flash-Lite)</option>
            <option value="balanced" ${state.ai?.quality === 'balanced' ? 'selected' : ''}>Balanced (Gemini 3.5 Flash)</option>
            <option value="best" ${state.ai?.quality === 'best' ? 'selected' : ''}>Best (Gemini 3.8 Flash)</option>
          </select>
        </div>

        <div class="you-row">
          <div class="row-text-block">
            <span class="row-label">Share profile with assistant</span>
            <span class="row-subtitle">Sends diet & allergies for portion estimates</span>
          </div>
          <input type="checkbox" id="field-share-profile" class="row-toggle" ${state.ai?.sendProfileContext !== false ? 'checked' : ''} />
        </div>

        <div class="you-row" id="btn-what-is-sent">
          <span class="row-label">What is sent to Google?</span>
          <span class="row-chevron">▸</span>
        </div>
      </div>

      <!-- GROUP 4: DISPLAY AND UNITS -->
      <div class="you-inset-group">
        <div class="group-title">Display and Units</div>

        <div class="you-row">
          <span class="row-label">Weight Unit</span>
          <select class="row-select" id="field-unit-weight">
            <option value="kg" ${(profile.units?.weight || profile.unit) === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
            <option value="lbs" ${(profile.units?.weight || profile.unit) === 'lbs' ? 'selected' : ''}>Pounds (lb)</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Theme</span>
          <select class="row-select" id="field-theme">
            <option value="dark" ${profile.ui?.theme === 'dark' ? 'selected' : ''}>Dark (Apple Health)</option>
            <option value="oled" ${profile.ui?.theme === 'oled' ? 'selected' : ''}>OLED True Black</option>
            <option value="light" ${profile.ui?.theme === 'light' ? 'selected' : ''}>Light Clean</option>
          </select>
        </div>

        <div class="you-row">
          <span class="row-label">Today Headline</span>
          <select class="row-select" id="field-headline">
            <option value="trend" ${(profile.ui?.headlineDisplay || profile.headlineDisplay) === 'trend' ? 'selected' : ''}>Trend (Exponential Avg)</option>
            <option value="scale" ${(profile.ui?.headlineDisplay || profile.headlineDisplay) === 'scale' ? 'selected' : ''}>Scale (Raw Weigh-in)</option>
          </select>
        </div>
      </div>

      <!-- GROUP 5: DATA AND BACKUP -->
      <div class="you-inset-group">
        <div class="group-title">Data and Sovereignty</div>

        <div class="you-row" id="row-export-csv" role="button">
          <span class="row-label">Export Weigh-in CSV</span>
          <span class="row-action-link">Export ↗</span>
        </div>

        <div class="you-row" id="row-export-meals-csv" role="button">
          <span class="row-label">Export Fuel Meals CSV</span>
          <span class="row-action-link">Export ↗</span>
        </div>

        <div class="you-row" id="row-backup-json" role="button">
          <span class="row-label">Backup Full Data (JSON v3)</span>
          <span class="row-action-link">Backup ↗</span>
        </div>

        <div class="you-row" id="row-load-sample" role="button">
          <span class="row-label">Load 60-Day Sample Data</span>
          <span class="row-action-link">Load</span>
        </div>

        <div class="you-row is-danger" id="row-reset-data" role="button">
          <span class="row-label">Reset All Data</span>
          <span class="row-danger-tag">Reset</span>
        </div>
      </div>

      <div class="you-footer-note">
        Zenith 2.0 · Private, Local-First, Zero Telemetry
      </div>
    </div>
  `;

  bindYouPageEvents(container);
}

function bindYouPageEvents(container) {
  // Close
  container.querySelector('#btn-close-you')?.addEventListener('click', () => {
    triggerHaptic('light');
    closeYouScreen();
  });

  // Body and Goal inputs
  const bindField = (id, prop, transform = v => v) => {
    container.querySelector(`#${id}`)?.addEventListener('change', (e) => {
      triggerHaptic('selection');
      store.setProfile({ [prop]: transform(e.target.value) });
    });
  };

  bindField('field-sex', 'sex');
  bindField('field-age', 'age', v => parseInt(v, 10));
  bindField('field-height', 'heightCm', v => parseFloat(v));
  bindField('field-goal-type', 'goalType');
  bindField('field-weekly-pace', 'weeklyRatePref', v => parseFloat(v));
  bindField('field-activity', 'activityLevel');

  // Start & Goal weights
  container.querySelector('#field-start-weight')?.addEventListener('change', (e) => {
    const kg = store.toStorageWeight(parseFloat(e.target.value));
    store.setProfile({ startWeight: kg });
    triggerHaptic('selection');
  });

  container.querySelector('#field-goal-weight')?.addEventListener('change', (e) => {
    const kg = store.toStorageWeight(parseFloat(e.target.value));
    store.setProfile({ goalWeight: kg });
    triggerHaptic('selection');
  });

  // Nutrition & Calm mode
  container.querySelector('#field-calm-mode')?.addEventListener('change', (e) => {
    triggerHaptic('selection');
    store.setProfile({
      nutrition: {
        ...store.getState().profile.nutrition,
        calmMode: e.target.checked
      }
    });
  });

  container.querySelector('#field-macro-preset')?.addEventListener('change', (e) => {
    store.setProfile({
      nutrition: {
        ...store.getState().profile.nutrition,
        macroPreset: e.target.value
      }
    });
  });

  container.querySelector('#field-diet-pattern')?.addEventListener('change', (e) => {
    store.setProfile({
      diet: {
        ...store.getState().profile.diet,
        pattern: e.target.value
      }
    });
  });

  // Gemini Key Management
  const keyInput = container.querySelector('#field-gemini-key');
  const pasteBtn = container.querySelector('#btn-paste-key');
  const testBtn = container.querySelector('#btn-test-key');
  const removeBtn = container.querySelector('#btn-remove-key');
  const statusPill = container.querySelector('#ai-key-status');

  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && keyInput) {
        keyInput.value = text.trim();
        await setKey(text.trim());
        triggerHaptic('success');
        if (statusPill) {
          statusPill.textContent = 'Saved ✓';
          statusPill.classList.add('is-valid');
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  });

  testBtn?.addEventListener('click', async () => {
    const keyToTest = keyInput?.value.trim();
    if (!keyToTest) return;

    if (statusPill) statusPill.textContent = 'Testing…';
    triggerHaptic('light');

    const res = await testConnection(keyToTest);
    if (res.ok) {
      await setKey(keyToTest);
      triggerHaptic('success');
      if (statusPill) {
        statusPill.textContent = 'Connected ✓';
        statusPill.classList.add('is-valid');
      }
    } else {
      triggerHaptic('warning');
      if (statusPill) {
        statusPill.textContent = res.kind === 'bad_key' ? 'Invalid key' : 'Error';
        statusPill.classList.remove('is-valid');
      }
    }
  });

  removeBtn?.addEventListener('click', async () => {
    await removeKey();
    if (keyInput) keyInput.value = '';
    if (statusPill) {
      statusPill.textContent = 'Not Connected';
      statusPill.classList.remove('is-valid');
    }
    triggerHaptic('light');
  });

  // What is sent explainer
  container.querySelector('#btn-what-is-sent')?.addEventListener('click', () => {
    alert(
      "Privacy Explainer:\n\n" +
      "Zenith calls Gemini using your own API key directly from your device.\n\n" +
      "Sent per request:\n" +
      "• The food photo or text description\n" +
      "• Today's calorie target & diet pattern\n" +
      "• Approximate local time (e.g. lunch)\n\n" +
      "NEVER sent:\n" +
      "• Your name or birthday\n" +
      "• Your weight history\n" +
      "• Device identifiers or telemetry\n" +
      "• EXIF GPS coordinates (photos are re-encoded first)"
    );
  });

  // Display and Units
  container.querySelector('#field-unit-weight')?.addEventListener('change', (e) => {
    store.setUnit(e.target.value);
    triggerHaptic('selection');
  });

  container.querySelector('#field-theme')?.addEventListener('change', (e) => {
    store.setTheme(e.target.value);
    triggerHaptic('selection');
  });

  container.querySelector('#field-headline')?.addEventListener('change', (e) => {
    store.setHeadlineDisplay(e.target.value);
    triggerHaptic('selection');
  });

  // Data Actions
  container.querySelector('#row-export-csv')?.addEventListener('click', () => {
    triggerHaptic('success');
    store.exportCSV();
  });

  container.querySelector('#row-export-meals-csv')?.addEventListener('click', () => {
    triggerHaptic('success');
    store.exportMealsCSV();
  });

  container.querySelector('#row-backup-json')?.addEventListener('click', () => {
    triggerHaptic('success');
    store.exportJSON(true);
  });

  container.querySelector('#row-load-sample')?.addEventListener('click', () => {
    if (confirm('Load 60-day realistic sample data?')) {
      triggerHaptic('success');
      store.loadSampleData();
      closeYouScreen();
    }
  });

  container.querySelector('#row-reset-data')?.addEventListener('click', () => {
    const input = prompt('Type RESET to permanently wipe all stored data:');
    if (input === 'RESET') {
      triggerHaptic('warning');
      store.clearAllData();
      closeYouScreen();
    }
  });

  // Change avatar photo
  container.querySelector('#btn-change-avatar')?.addEventListener('click', async () => {
    try {
      const res = await captureProgressPhoto();
      if (res && res.photoUri) {
        store.setProfile({
          avatar: {
            type: 'photo',
            photoPath: res.photoUri,
            thumbPath: res.thumbUri
          }
        });
        renderYouPageContent(container);
      }
    } catch (e) {
      console.warn('Avatar photo error:', e);
    }
  });
}
