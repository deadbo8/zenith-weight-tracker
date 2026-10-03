/**
 * Fuel Screen Component (Section 8.1 - 8.4)
 * Orchestrates DayStrip, EnergyRing, MacroBars, MealTimeline, and the ChatDock.
 */

import { store, getLocalDateString } from '../state.js';
import { createEnergyRing } from './energyRing.js';
import { createMacroBars } from './macroBars.js';
import { createDayStrip, bindDayStrip } from './dayStrip.js';
import { createMealTimeline, bindMealTimeline } from './mealTimeline.js';
import { ChatLayer } from './chatLayer.js';
import { openMealDetailSheet } from './mealDetailSheet.js';
import { openAddFoodSheet } from './addFoodSheet.js';
import { triggerHaptic } from '../android.js';

export class FuelScreen {
  constructor({ containerId = 'tab-fuel', onNavigateTab, onOpenWeightLog }) {
    this.containerId = containerId;
    this.selectedDate = getLocalDateString();
    this.onNavigateTab = onNavigateTab;
    this.onOpenWeightLog = onOpenWeightLog;

    this.chatLayer = new ChatLayer({
      store,
      onMealLogged: () => this.render(),
      onWeightLogged: () => {
        if (this.onOpenWeightLog) this.onOpenWeightLog();
      }
    });

    // Subscribe to store changes
    store.subscribe(() => {
      const el = document.getElementById(this.containerId);
      if (el && !el.classList.contains('hidden')) {
        this.render();
      }
    });
  }

  mount() {
    this.render();
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Preserve active chat messages DOM element if already rendered
    let existingChatEl = container.querySelector('#fuel-chat-messages');
    if (existingChatEl) {
      existingChatEl.remove();
    } else {
      existingChatEl = document.createElement('div');
      existingChatEl.className = 'fuel-chat-messages-container';
      existingChatEl.id = 'fuel-chat-messages';
    }

    const summary = store.getDailyNutritionSummary(this.selectedDate);
    const weekDots = store.getWeekDots(this.selectedDate);
    const meals = store.getMealsByDay(this.selectedDate);
    const calmMode = summary.calmMode;
    const isDayFinished = summary.isComplete;

    container.innerHTML = `
      <div class="screen-scroll-container fuel-screen-body">
        <!-- Screen Top Header with Streak -->
        <div class="screen-header-row">
          <div class="screen-title-col">
            <h1 class="screen-title">Fuel</h1>
            <span class="screen-subtitle">Body Intelligence & Energy</span>
          </div>
          <div class="fuel-streak-badge" aria-label="5 day meals streak">
            <span>🔥</span>
            <strong>${meals.length > 0 ? 'Logged' : 'Pending'}</strong>
          </div>
        </div>

        <!-- 7-Day Calendar Strip -->
        ${createDayStrip(weekDots, this.selectedDate)}

        <!-- Hero Card: Energy Ring & Macro Bars -->
        <div class="fuel-hero-card">
          <div class="fuel-hero-ring-col">
            ${createEnergyRing({
              targetKcal: summary.target.kcal,
              consumedKcal: summary.consumed.kcal,
              calmMode: calmMode
            })}
          </div>
          <div class="fuel-hero-macros-col">
            ${createMacroBars({
              consumed: summary.consumed,
              target: summary.target,
              waterMl: summary.waterMl,
              waterTargetMl: summary.waterTargetMl,
              calmMode: calmMode
            })}
          </div>
        </div>

        <!-- Chat Conversation Messages (preserved live DOM node) -->
        <div id="fuel-chat-messages-anchor"></div>

        <!-- Meal Timeline by Category -->
        <div class="fuel-timeline-wrapper">
          <div class="timeline-header-row">
            <h2 class="timeline-title">Meals & Fuel</h2>
            <span class="timeline-count">${meals.length} ${meals.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          ${createMealTimeline(meals, calmMode, isDayFinished)}
        </div>

        <!-- Spacer for sticky dock -->
        <div class="dock-spacer"></div>
      </div>

      <!-- Sticky Floating Chat Dock -->
      ${this.chatLayer.renderDock()}
    `;

    // Re-mount the live chat DOM node
    const anchor = container.querySelector('#fuel-chat-messages-anchor');
    if (anchor) {
      anchor.replaceWith(existingChatEl);
    }

    // Bind event handlers
    this.bindEvents(container);
  }

  bindEvents(container) {
    // Bind Day Strip
    bindDayStrip(container, (newDate) => {
      this.selectedDate = newDate;
      this.render();
    });

    // Bind Calm Mode Toggle if present
    container.querySelector('#btn-toggle-calm-nums')?.addEventListener('click', () => {
      triggerHaptic('light');
      const cur = store.getState().profile.nutrition?.calmMode;
      store.setProfile({
        nutrition: {
          ...store.getState().profile.nutrition,
          calmMode: !cur
        }
      });
    });

    // Bind Quick Water button in Macro card
    container.querySelector('#btn-add-water-quick')?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic('success');
      store.addWater(250, this.selectedDate);
      this.chatLayer.showToast('Added 250 ml water', () => store.undoAddWater());
      this.render();
    });

    // Bind Meal Timeline
    bindMealTimeline(container, {
      onOpenMeal: (mealId) => {
        const meal = store.getState().meals.find(m => m.id === mealId);
        if (meal) {
          openMealDetailSheet(meal, {
            onDuplicate: (id) => {
              store.duplicateMeal(id, getLocalDateString());
              this.chatLayer.showToast('Meal duplicated to today');
              this.render();
            },
            onDelete: (id) => {
              const deleted = store.deleteMeal(id);
              this.chatLayer.showToast(`Deleted "${deleted?.title || 'meal'}"`, () => {
                store.undoDeleteMeal();
                this.render();
              });
              this.render();
            }
          });
        }
      },
      onAddMeal: (mealType) => {
        openAddFoodSheet(mealType, (newMeal) => {
          newMeal.localDate = this.selectedDate;
          store.addMeal(newMeal);
          this.chatLayer.showToast(`Logged "${newMeal.title}"`);
          this.render();
        });
      },
      onFinishDay: () => {
        store.finishDay(this.selectedDate);
        this.chatLayer.showToast('Day marked complete for averages');
        this.render();
      }
    });

    // Bind Chat Dock
    this.chatLayer.bindDock(container);
  }
}
