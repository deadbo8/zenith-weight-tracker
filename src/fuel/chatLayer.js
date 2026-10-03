/**
 * Fuel Chat & Composer Layer (Section 8.3 & Task E3)
 * Full conversational interface with photo analysis, Gemini AI integration,
 * confirm cards, follow-up correction chips, and offline queue support.
 */

import { generate, AiError } from '../ai/geminiClient.js';
import { SYSTEM_NUTRITION, buildUserContext, buildCorrectionPrompt, PROMPT_VERSION } from '../ai/prompts.js';
import { RESPONSE_SCHEMA } from '../ai/schema.js';
import { parseRawAiResponse, validateAiResponse } from '../ai/validate.js';
import { getCachedAiResult, setCachedAiResult } from '../ai/cache.js';
import { getKey, setKey } from '../ai/secureKey.js';
import { estimateOfflineMeal } from '../ai/fallbackEstimator.js';
import { getModelForTask } from '../ai/models.js';
import { capturePhoto, captureProgressPhoto } from '../camera.js';
import { createMealConfirmCard, bindMealConfirmCard } from './mealConfirmCard.js';
import { openAddFoodSheet } from './addFoodSheet.js';
import { triggerHaptic } from '../android.js';

export class ChatLayer {
  constructor({ store, onMealLogged, onWeightLogged }) {
    this.store = store;
    this.onMealLogged = onMealLogged;
    this.onWeightLogged = onWeightLogged;
    this.isAnalyzing = false;
    this.activeDraft = null;
    this.pendingImage = null; // { base64, dataUrl, photoPath, thumbPath }
  }

  renderDock() {
    const recents = this.store.getRecentMealTitles(3);
    const recentChips = recents.map(t => `
      <button class="quick-food-chip" data-quick-title="${t}">${t}</button>
    `).join('');

    return `
      <div class="fuel-chat-dock" id="fuel-chat-dock">
        <!-- Quick action chips row -->
        <div class="dock-chips-bar" data-no-sheet-drag>
          <button class="quick-food-chip" id="btn-quick-chip-water">+250ml water</button>
          ${recentChips}
          <button class="quick-food-chip" id="btn-quick-chip-manual">+ Manual</button>
        </div>

        <!-- Pending image preview strip if photo snapped -->
        <div class="dock-preview-strip hidden" id="dock-photo-preview">
          <div class="preview-img-wrap">
            <img id="dock-preview-img" src="" alt="Captured meal" />
            <button class="btn-clear-photo" id="btn-clear-dock-photo" aria-label="Remove photo">✕</button>
          </div>
          <span class="preview-caption">Photo ready to analyze</span>
        </div>

        <!-- Input Row -->
        <div class="dock-input-row">
          <button class="dock-btn-icon" id="btn-dock-camera" aria-label="Take food photo" title="Camera">
            <i data-lucide="camera" style="width: 18px; height: 18px;"></i>
          </button>
          <button class="dock-btn-icon" id="btn-dock-gallery" aria-label="Choose photo from gallery" title="Gallery">
            <i data-lucide="image" style="width: 18px; height: 18px;"></i>
          </button>
          
          <div class="dock-text-input-wrap">
            <input
              type="text"
              id="dock-chat-input"
              class="dock-text-input"
              placeholder="Tell me what you ate…"
              autocomplete="off"
            />
          </div>

          <button class="dock-btn-send" id="btn-dock-send" aria-label="Send food description" disabled>
            ↑
          </button>
        </div>
      </div>
    `;
  }

  bindDock(container) {
    if (!container) return;

    const input = container.querySelector('#dock-chat-input');
    const sendBtn = container.querySelector('#btn-dock-send');
    const cameraBtn = container.querySelector('#btn-dock-camera');
    const galleryBtn = container.querySelector('#btn-dock-gallery');
    const previewWrap = container.querySelector('#dock-photo-preview');
    const previewImg = container.querySelector('#dock-preview-img');
    const clearPhotoBtn = container.querySelector('#btn-clear-dock-photo');

    // Input state
    input?.addEventListener('input', () => {
      const hasText = input.value.trim().length > 0;
      const hasPhoto = !!this.pendingImage;
      if (sendBtn) {
        sendBtn.disabled = !hasText && !hasPhoto;
        sendBtn.classList.toggle('is-active', hasText || hasPhoto);
      }
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !sendBtn.disabled) {
        e.preventDefault();
        this.submitInput(input.value.trim());
      }
    });

    sendBtn?.addEventListener('click', () => {
      if (!sendBtn.disabled) {
        this.submitInput(input.value.trim());
      }
    });

    // Camera action - opens device camera directly
    cameraBtn?.addEventListener('click', async () => {
      triggerHaptic('light');
      try {
        const photoResult = await capturePhoto('camera');
        if (photoResult && (photoResult.photoUri || photoResult.displayUrl)) {
          this.setPendingPhoto(photoResult);
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.add('is-active');
          }
        }
      } catch (err) {
        console.warn('Camera error:', err);
      }
    });

    // Gallery action - opens photo library directly
    galleryBtn?.addEventListener('click', async () => {
      triggerHaptic('light');
      try {
        const photoResult = await capturePhoto('gallery');
        if (photoResult && (photoResult.photoUri || photoResult.displayUrl)) {
          this.setPendingPhoto(photoResult);
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.add('is-active');
          }
        }
      } catch (err) {
        console.warn('Gallery picker note:', err);
      }
    });

    clearPhotoBtn?.addEventListener('click', () => {
      this.pendingImage = null;
      if (previewWrap) previewWrap.classList.add('hidden');
      const hasText = input?.value.trim().length > 0;
      if (sendBtn) {
        sendBtn.disabled = !hasText;
        sendBtn.classList.toggle('is-active', hasText);
      }
    });

    // Quick chips
    container.querySelector('#btn-quick-chip-water')?.addEventListener('click', () => {
      triggerHaptic('success');
      this.store.addWater(250);
      this.showToast('Added 250 ml water', () => this.store.undoAddWater());
    });

    container.querySelector('#btn-quick-chip-manual')?.addEventListener('click', () => {
      triggerHaptic('light');
      openAddFoodSheet('lunch', (meal) => {
        this.store.addMeal(meal);
        this.showToast(`Logged "${meal.title}"`);
        if (this.onMealLogged) this.onMealLogged();
      });
    });

    container.querySelectorAll('[data-quick-title]').forEach(chip => {
      chip.addEventListener('click', () => {
        const title = chip.getAttribute('data-quick-title');
        if (input) {
          input.value = title;
          input.focus();
          sendBtn.disabled = false;
          sendBtn.classList.add('is-active');
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  setPendingPhoto(photoResult) {
    this.pendingImage = photoResult;
    const previewWrap = document.querySelector('#dock-photo-preview');
    const previewImg = document.querySelector('#dock-preview-img');
    if (previewWrap && previewImg) {
      previewImg.src = photoResult.thumbUri || photoResult.displayUrl || photoResult.photoUri;
      previewWrap.classList.remove('hidden');
    }
  }

  async submitInput(text) {
    const input = document.querySelector('#dock-chat-input');
    if (input) input.value = '';

    const photo = this.pendingImage;
    this.pendingImage = null;
    const previewWrap = document.querySelector('#dock-photo-preview');
    if (previewWrap) previewWrap.classList.add('hidden');

    const sendBtn = document.querySelector('#btn-dock-send');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.remove('is-active');
    }

    // Immediately render user message bubble
    this.addUserMessage(text, photo);

    // Verify API Key
    const apiKey = await getKey();
    if (!apiKey) {
      this.showApiKeyModal({ text, photo });
      return;
    }

    await this.processAiRequest({ text, photo });
  }

  async processAiRequest({ text, photo }) {
    this.isAnalyzing = true;
    this.showShimmerBubble();

    try {
      const state = this.store.getState();
      const profile = state.profile;

      // 1. Build context & prompt
      const promptText = buildUserContext({
        note: text || '',
        profile: profile?.nutrition?.shareStatsWithCoach ? profile : { unit: profile?.unit, units: profile?.units },
        todaySoFar: {
          kcal: this.store.getMealsByDay().reduce((s, m) => s + (m.totals?.kcal || 0), 0)
        },
        recentFoods: this.store.getRecentMealTitles ? this.store.getRecentMealTitles(4) : []
      });

      // 2. Build contents
      const parts = [];
      if (photo?.base64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: photo.base64
          }
        });
      }
      parts.push({
        text: promptText
      });

      const contents = [{ role: 'user', parts }];

      // Check Cache
      const modelToUse = getModelForTask('balanced', photo ? 'vision' : 'text');
      const cacheKey = { input: text || photo?.photoUri, note: text, model: modelToUse, promptVersion: PROMPT_VERSION };
      let validated = await getCachedAiResult(cacheKey);

      if (!validated) {
        const rawRes = await generate({
          model: modelToUse,
          system: SYSTEM_NUTRITION,
          contents,
          schema: RESPONSE_SCHEMA
        });

        const parsed = parseRawAiResponse(rawRes.text);
        validated = validateAiResponse(parsed);

        // Store cache
        await setCachedAiResult({ ...cacheKey, result: validated });
      }

      this.hideShimmerBubble();
      this.handleAiResult(validated, photo);

    } catch (err) {
      this.hideShimmerBubble();
      console.warn('AI Generation Error:', err);

      if (err.kind === 'no_key' || err.kind === 'bad_key') {
        this.showApiKeyModal({ text, photo });
      } else if (!navigator.onLine || err.kind === 'network') {
        if (text) {
          this.addAssistantMessage('Offline: estimating meal nutrition locally:');
          const fallback = estimateOfflineMeal(text);
          this.handleAiResult(fallback, photo);
        } else {
          this.addAssistantMessage('Network offline. Reconnect to analyze meal photos.');
        }
      } else {
        if (text) {
          this.addAssistantMessage('AI temporary error. Using local nutrition estimation:');
          const fallback = estimateOfflineMeal(text);
          this.handleAiResult(fallback, photo);
        } else {
          this.addAssistantMessage('I could not analyze that just now. You can retry or add the meal manually.');
        }
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  handleAiResult(result, photo) {
    const { intent, assistantMessage, meal, weight, waterMl, followUpChips } = result;

    if (assistantMessage) {
      this.addAssistantMessage(assistantMessage);
    }

    if (intent === 'log_meal' && meal) {
      // Attach photo paths if available
      if (photo) {
        meal.photoPath = photo.photoUri;
        meal.thumbPath = photo.thumbUri;
        meal.source = 'photo';
      } else {
        meal.source = 'text';
      }

      this.activeDraft = meal;
      this.showMealConfirmCard(meal, followUpChips);

    } else if (intent === 'log_weight' && weight) {
      this.showWeightConfirmCard(weight);

    } else if (intent === 'log_water' && waterMl) {
      this.store.addWater(waterMl);
      this.showToast(`Logged ${waterMl} ml water`, () => this.store.undoAddWater());

    } else if (intent === 'support') {
      // Clean empathetic support, no calorie summary card
    }
  }

  showMealConfirmCard(meal, followUpChips = []) {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const allergies = this.store.getState().profile.diet?.allergies || [];
    const cardHtml = createMealConfirmCard(meal, allergies);

    const wrap = document.createElement('div');
    wrap.className = 'chat-card-attachment';
    wrap.innerHTML = cardHtml;

    // Follow-up chips
    if (followUpChips && followUpChips.length > 0) {
      const chipsRow = document.createElement('div');
      chipsRow.className = 'confirm-followup-chips';
      chipsRow.innerHTML = followUpChips.map(c => `
        <button class="followup-chip" data-chip="${c}">${c}</button>
      `).join('');
      wrap.appendChild(chipsRow);

      chipsRow.querySelectorAll('.followup-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const chipText = btn.getAttribute('data-chip');
          wrap.remove();
          this.submitInput(chipText);
        });
      });
    }

    container.appendChild(wrap);
    wrap.scrollIntoView({ behavior: 'smooth' });

    bindMealConfirmCard(wrap.querySelector('.meal-confirm-card'), meal, {
      onSave: (savedDraft) => {
        wrap.remove();
        const logged = this.store.addMeal(savedDraft);
        this.showToast(`Logged "${logged.title}" (${logged.totals.kcal} kcal)`, () => {
          this.store.deleteMeal(logged.id);
        });
        if (this.onMealLogged) this.onMealLogged();
      },
      onDiscard: () => {
        wrap.remove();
        this.addAssistantMessage('Meal discarded.');
      },
      onUpdate: (updatedDraft) => {
        this.activeDraft = updatedDraft;
      }
    });
  }

  showWeightConfirmCard(weight) {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'chat-card-attachment weight-confirm-bubble';
    card.innerHTML = `
      <div class="weight-confirm-box">
        <span class="weight-label">Weigh-in detected</span>
        <div class="weight-val"><strong>${weight.value}</strong> ${weight.unit}</div>
        <div class="weight-actions">
          <button class="btn-weight-cancel" id="btn-cancel-weight-chat">Cancel</button>
          <button class="btn-weight-save" id="btn-save-weight-chat">Log Weight</button>
        </div>
      </div>
    `;

    container.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth' });

    card.querySelector('#btn-cancel-weight-chat')?.addEventListener('click', () => {
      card.remove();
    });

    card.querySelector('#btn-save-weight-chat')?.addEventListener('click', () => {
      card.remove();
      const weightKg = weight.unit === 'lb' ? weight.value / 2.20462 : weight.value;
      this.store.addEntry({ weight: weightKg });
      this.showToast(`Logged ${weight.value} ${weight.unit} weigh-in`);
      if (this.onWeightLogged) this.onWeightLogged();
    });
  }

  showShimmerBubble() {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const shimmer = document.createElement('div');
    shimmer.className = 'chat-bubble assistant is-shimmer';
    shimmer.id = 'chat-shimmer-bubble';
    shimmer.innerHTML = `
      <div class="shimmer-sweep"></div>
      <span>Looking at your meal…</span>
      <button class="btn-shimmer-cancel" id="btn-cancel-ai-req">Cancel</button>
    `;
    container.appendChild(shimmer);
    shimmer.scrollIntoView({ behavior: 'smooth' });

    shimmer.querySelector('#btn-cancel-ai-req')?.addEventListener('click', () => {
      this.hideShimmerBubble();
    });
  }

  hideShimmerBubble() {
    document.querySelector('#chat-shimmer-bubble')?.remove();
  }

  addUserMessage(text, photo = null) {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';

    let photoHtml = '';
    const imgUri = photo?.thumbUri || photo?.photoUri;
    if (imgUri) {
      photoHtml = `<img src="${imgUri}" class="user-bubble-photo" alt="Meal photo" />`;
    }

    bubble.innerHTML = `
      ${photoHtml}
      ${text ? `<span>${text}</span>` : ''}
    `;
    container.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth' });
  }

  addAssistantMessage(text) {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    bubble.innerHTML = `<span>${text}</span>`;
    container.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth' });
  }

  showApiKeyModal(pending = null) {
    const container = document.querySelector('#fuel-chat-messages');
    if (!container) return;

    const existing = container.querySelector('#gemini-key-prompt-card');
    if (existing) {
      existing.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const card = document.createElement('div');
    card.className = 'chat-card-attachment';
    card.id = 'gemini-key-prompt-card';
    card.innerHTML = `
      <div class="api-key-setup-card">
        <div class="key-card-header">
          <div class="key-card-badge">🔑 Gemini AI Intelligence</div>
          <button class="key-card-close" id="btn-close-key-card" aria-label="Dismiss">✕</button>
        </div>
        <div class="key-card-body">
          <p class="key-card-desc">
            To analyze photos & natural language with Gemini 1.5/2.0 Flash, add your free Google AI Studio key:
          </p>
          <div class="key-card-input-row">
            <input
              type="password"
              id="inline-gemini-key-input"
              class="key-card-input"
              placeholder="Paste AI Studio Key (AIza...)"
              autocomplete="off"
            />
            <button class="key-card-save-btn" id="btn-save-inline-key">Connect</button>
          </div>
          <div class="key-card-actions-row">
            <a href="https://aistudio.google.com/apikey" target="_blank" class="key-card-link">
              Get Free Key at aistudio.google.com ↗
            </a>
            ${pending?.text ? `
              <button class="key-card-offline-btn" id="btn-estimate-offline">
                ⚡ Estimate Offline
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth' });

    card.querySelector('#btn-close-key-card')?.addEventListener('click', () => {
      card.remove();
    });

    card.querySelector('#btn-estimate-offline')?.addEventListener('click', () => {
      triggerHaptic('light');
      card.remove();
      if (pending?.text) {
        const offlineResult = estimateOfflineMeal(pending.text);
        this.handleAiResult(offlineResult, pending.photo);
      }
    });

    const keyInput = card.querySelector('#inline-gemini-key-input');
    const saveBtn = card.querySelector('#btn-save-inline-key');

    saveBtn?.addEventListener('click', async () => {
      const keyVal = keyInput?.value?.trim();
      if (!keyVal) return;

      saveBtn.textContent = 'Saving…';
      saveBtn.disabled = true;

      try {
        await setKey(keyVal);
        triggerHaptic('success');
        this.showToast('Gemini API key encrypted & saved');
        card.remove();
        if (pending && (pending.text || pending.photo)) {
          await this.processAiRequest(pending);
        }
      } catch (err) {
        saveBtn.textContent = 'Error';
        saveBtn.disabled = false;
        console.error('Failed to save key:', err);
      }
    });
  }

  showToast(message, onUndo = null) {
    const existing = document.querySelector('.zenith-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'zenith-toast is-visible';
    toast.innerHTML = `
      <span class="toast-msg">${message}</span>
      ${onUndo ? `<button class="toast-undo" id="btn-toast-undo">Undo</button>` : ''}
    `;

    document.body.appendChild(toast);

    if (onUndo) {
      toast.querySelector('#btn-toast-undo')?.addEventListener('click', () => {
        triggerHaptic('light');
        toast.remove();
        onUndo();
      });
    }

    setTimeout(() => {
      toast.remove();
    }, 4500);
  }
}
