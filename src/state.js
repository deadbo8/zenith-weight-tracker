/**
 * ZenithTrack State Management (Schema v3 & Fuel Core)
 * Handles Weight entries, Fuel meals, Water logs, Profile, and AI interactions.
 * IndexedDB + localStorage mirror, pub/sub architecture, and lossless v2 -> v3 migration.
 */

import { putRecord, deleteRecord, getAllRecords, getMeta, setMeta, migrateV2toV3IfNeeded } from './db/index.js';
import { createAthleticProgressSvg } from './components/svgs.js';
import { calorieTarget, macroTargets, summarizeDay } from './nutrition.js';

const STORAGE_KEY = 'zenith_weight_tracker_v2';
const STORAGE_KEY_V3 = 'zenith_weight_tracker_v3_mirror';

export function getLocalDateString(d = new Date()) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DEFAULT_PROFILE_V3 = {
  id: 'user_default',
  displayName: 'My Profile',
  name: 'My Profile', // Legacy compat
  avatar: { type: 'initials', color: '#30D158' },
  sex: 'male',
  gender: 'male', // Legacy compat
  age: 28,
  birthDate: '',
  heightCm: 175,
  height: 175, // Legacy compat
  startWeight: null, // stored in kg
  goalWeight: null,  // stored in kg
  targetDate: '',
  goalType: 'lose',
  weeklyRatePref: 0.5,
  activityLevel: 'moderate',
  unit: 'kg', // Legacy compat
  units: {
    weight: 'kg',
    length: 'cm',
    energy: 'kcal',
    water: 'ml'
  },
  diet: {
    pattern: 'balanced',
    allergies: [],
    dislikes: [],
    cuisines: []
  },
  nutrition: {
    calorieMode: 'auto',
    customKcal: 2000,
    macroPreset: 'balanced',
    proteinPerKg: 1.6,
    fatPercent: 25,
    waterGoalMl: 'auto',
    showMacros: true,
    calmMode: false
  },
  ui: {
    theme: 'dark',
    headlineDisplay: 'trend',
    haptics: true
  },
  ai: {
    quality: 'balanced',
    sendProfileContext: true
  },
  theme: 'dark', // Legacy compat
  headlineDisplay: 'trend', // Legacy compat
  reminders: {
    weighIn: null,
    meals: [],
    water: null
  },
  createdAt: new Date().toISOString()
};

export function generateSampleData() {
  const entries = [];
  const startWeight = 82.5;
  const days = 60;
  const now = new Date();

  const moods = ['fasted', 'energetic', 'normal', 'post_workout', 'cheat_day', 'heavy', 'fasted'];
  const sampleNotes = [
    'Morning weigh-in after black coffee.',
    'Great HIIT cardio session yesterday.',
    'Feeling lighter and much more energetic.',
    'Weekend family dinner, slight water retention expected.',
    'Strict keto / calorie deficit maintained today.',
    'Leg day workout complete, hydration high.',
    'New personal record on deadlifts today!',
    'Consistent sleep 8 hours, feeling fantastic.'
  ];

  let currentWeight = startWeight;
  let currentFat = 23.8;

  for (let i = days - 1; i >= 0; i--) {
    const entryDate = new Date(now);
    entryDate.setDate(entryDate.getDate() - i);
    entryDate.setHours(7, 30 + Math.floor(Math.random() * 40), 0, 0);

    const trendDrop = 0.105;
    const fluctuation = (Math.random() - 0.47) * 0.45;
    currentWeight = Math.max(73.5, currentWeight - trendDrop + fluctuation);
    currentFat = Math.max(17.8, currentFat - 0.09 + (Math.random() - 0.5) * 0.1);

    const mood = moods[Math.floor(Math.random() * moods.length)];
    const note = Math.random() > 0.4 ? sampleNotes[Math.floor(Math.random() * sampleNotes.length)] : '';

    let photo = null;
    if (i === days - 1) {
      photo = createAthleticProgressSvg(1, '82.5 kg', '23.8% Fat', '#8b5cf6');
    } else if (i === Math.floor(days / 2)) {
      photo = createAthleticProgressSvg(30, '79.1 kg', '21.0% Fat', '#06b6d4');
    } else if (i === 0) {
      photo = createAthleticProgressSvg(60, `${currentWeight.toFixed(1)} kg`, `${currentFat.toFixed(1)}% Fat`, '#10b981');
    }

    entries.push({
      id: `entry_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      date: entryDate.toISOString(),
      localDate: getLocalDateString(entryDate),
      weight: Math.round(currentWeight * 10) / 10,
      bodyFat: Math.round(currentFat * 10) / 10,
      waist: Math.round((89 - (days - 1 - i) * 0.12) * 10) / 10,
      mood: mood,
      notes: note,
      photo: photo
    });
  }

  entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  return entries;
}

// Sample meals for rich demo
export function generateSampleMeals() {
  const today = getLocalDateString();
  return [
    {
      id: `meal_sample_1`,
      localDate: today,
      loggedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      mealType: 'breakfast',
      title: 'Oats with Greek Yogurt and Berries',
      items: [
        { id: 'i1', name: 'Rolled Oats', quantity: 1, unit: 'cup', gramsEstimate: 80, kcal: 300, proteinG: 10, carbsG: 54, fatG: 5, confidence: 0.95 },
        { id: 'i2', name: 'Greek Yogurt 0%', quantity: 150, unit: 'g', gramsEstimate: 150, kcal: 90, proteinG: 15, carbsG: 6, fatG: 0, confidence: 0.9 },
        { id: 'i3', name: 'Blueberries', quantity: 0.5, unit: 'cup', gramsEstimate: 75, kcal: 45, proteinG: 1, carbsG: 11, fatG: 0.5, confidence: 0.85 }
      ],
      totals: { kcal: 435, proteinG: 26, carbsG: 71, fatG: 5.5, fiberG: 7 },
      kcalLow: 390,
      kcalHigh: 480,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `meal_sample_2`,
      localDate: today,
      loggedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      mealType: 'lunch',
      title: 'Grilled Chicken Salad with Quinoa',
      items: [
        { id: 'i4', name: 'Chicken Breast', quantity: 180, unit: 'g', gramsEstimate: 180, kcal: 290, proteinG: 55, carbsG: 0, fatG: 6, confidence: 0.9 },
        { id: 'i5', name: 'Cooked Quinoa', quantity: 1, unit: 'cup', gramsEstimate: 185, kcal: 222, proteinG: 8, carbsG: 39, fatG: 3.5, confidence: 0.85 },
        { id: 'i6', name: 'Olive Oil Dressing', quantity: 1, unit: 'tbsp', gramsEstimate: 14, kcal: 120, proteinG: 0, carbsG: 0, fatG: 14, confidence: 0.8 }
      ],
      totals: { kcal: 632, proteinG: 63, carbsG: 39, fatG: 23.5, fiberG: 5 },
      kcalLow: 570,
      kcalHigh: 710,
      source: 'photo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

class Store {
  constructor() {
    this.subscribers = new Set();
    this.undoBuffer = null;
    this.undoMealBuffer = null;
    this.undoWaterBuffer = null;
    this.state = this.loadInitialState();

    // Async hydration from IndexedDB
    this.initDb();
  }

  loadInitialState() {
    // 1. Try v3 localStorage mirror
    try {
      if (typeof localStorage !== 'undefined') {
        const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
        if (rawV3) {
          const parsed = JSON.parse(rawV3);
          return this.sanitizeState(parsed);
        }

        // 2. Try v2 legacy
        const rawV2 = localStorage.getItem(STORAGE_KEY);
        if (rawV2) {
          const parsed = JSON.parse(rawV2);
          const entries = (parsed.entries || []).map(e => ({
            ...e,
            localDate: e.localDate || getLocalDateString(e.date)
          }));
          return this.sanitizeState({
            profile: { ...DEFAULT_PROFILE_V3, ...(parsed.profile || {}) },
            entries,
            unlockedBadges: parsed.unlockedBadges || []
          });
        }
      }
    } catch (e) {
      console.warn('[Zenith Store] Sync load error:', e);
    }

    return this.sanitizeState({});
  }

  sanitizeState(raw) {
    const profile = { ...DEFAULT_PROFILE_V3, ...(raw.profile || {}) };
    profile.units = { ...DEFAULT_PROFILE_V3.units, ...(profile.units || {}) };
    profile.nutrition = { ...DEFAULT_PROFILE_V3.nutrition, ...(profile.nutrition || {}) };
    profile.diet = { ...DEFAULT_PROFILE_V3.diet, ...(profile.diet || {}) };
    profile.ui = { ...DEFAULT_PROFILE_V3.ui, ...(profile.ui || {}) };
    profile.ai = { ...DEFAULT_PROFILE_V3.ai, ...(profile.ai || {}) };

    // Synchronize legacy top-level profile aliases
    profile.unit = profile.units.weight || profile.unit || 'kg';
    profile.theme = profile.ui.theme || profile.theme || 'dark';
    profile.headlineDisplay = profile.ui.headlineDisplay || profile.headlineDisplay || 'trend';
    profile.height = profile.heightCm || profile.height || 175;
    profile.heightCm = profile.height;
    profile.gender = profile.sex || profile.gender || 'male';
    profile.sex = profile.gender;
    profile.name = profile.displayName || profile.name || 'My Profile';
    profile.displayName = profile.name;

    return {
      schemaVersion: 3,
      profile,
      entries: Array.isArray(raw.entries) ? raw.entries : [],
      unlockedBadges: Array.isArray(raw.unlockedBadges) ? raw.unlockedBadges : (raw.badges || []),
      badges: Array.isArray(raw.unlockedBadges) ? raw.unlockedBadges : (raw.badges || []),
      meals: Array.isArray(raw.meals) ? raw.meals : [],
      water: Array.isArray(raw.water) ? raw.water : [],
      favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
      chat: Array.isArray(raw.chat) ? raw.chat.slice(-200) : [],
      drafts: Array.isArray(raw.drafts) ? raw.drafts : [],
      nutritionDays: raw.nutritionDays || {},
      ai: {
        enabled: true,
        provider: 'gemini',
        quality: 'balanced',
        autoLogConfidence: null,
        sendProfileContext: true,
        shareStatsWithCoach: false,
        keyStatus: 'none',
        usage: { month: getLocalDateString().slice(0, 7), requests: 0 },
        ...(raw.ai || {})
      }
    };
  }

  async initDb() {
    if (typeof window === 'undefined') return;
    try {
      await migrateV2toV3IfNeeded();
      const [entries, meals, water, favorites, chat, drafts, profileMeta, badgesMeta] = await Promise.all([
        getAllRecords('entries'),
        getAllRecords('meals'),
        getAllRecords('water'),
        getAllRecords('favorites'),
        getAllRecords('chat'),
        getAllRecords('drafts'),
        getMeta('profile'),
        getMeta('unlockedBadges')
      ]);

      let changed = false;
      if (entries && entries.length > 0) {
        this.state.entries = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        changed = true;
      }
      if (meals && meals.length > 0) {
        this.state.meals = meals.sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
        changed = true;
      }
      if (water && water.length > 0) {
        this.state.water = water;
        changed = true;
      }
      if (favorites && favorites.length > 0) {
        this.state.favorites = favorites;
        changed = true;
      }
      if (chat && chat.length > 0) {
        this.state.chat = chat.slice(-200);
        changed = true;
      }
      if (drafts && drafts.length > 0) {
        this.state.drafts = drafts;
        changed = true;
      }
      if (profileMeta) {
        this.state.profile = { ...this.state.profile, ...profileMeta };
        changed = true;
      }
      if (badgesMeta) {
        this.state.unlockedBadges = badgesMeta;
        this.state.badges = badgesMeta;
        changed = true;
      }

      if (changed) {
        this.saveMirror();
        this.notify(false);
      }
    } catch (e) {
      console.warn('[Zenith Store] IndexedDB hydration note:', e);
    }
  }

  saveMirror() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(this.state));
        // Keep legacy key populated with basic fields for compatibility
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          profile: this.state.profile,
          entries: this.state.entries,
          unlockedBadges: this.state.unlockedBadges
        }));
      }
    } catch (e) {
      console.warn('Storage mirror save error:', e);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(save = true) {
    if (save) {
      this.saveMirror();
    }
    for (const callback of this.subscribers) {
      try {
        callback(this.state);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  getState() {
    return this.state;
  }

  // Unit conversion helpers
  toDisplayWeight(weightKg) {
    if (weightKg == null || isNaN(weightKg) || weightKg === '') return null;
    const num = parseFloat(weightKg);
    if (isNaN(num)) return null;
    if (this.state.profile.unit === 'lbs' || this.state.profile.units.weight === 'lbs') {
      return Math.round(num * 2.20462 * 10) / 10;
    }
    return Math.round(num * 10) / 10;
  }

  toStorageWeight(displayWeight) {
    if (displayWeight == null || isNaN(displayWeight) || displayWeight === '') return null;
    const num = parseFloat(displayWeight);
    if (isNaN(num)) return null;
    if (this.state.profile.unit === 'lbs' || this.state.profile.units.weight === 'lbs') {
      return Math.round((num / 2.20462) * 10) / 10;
    }
    return Math.round(num * 10) / 10;
  }

  formatWeight(weightKg, withUnit = true) {
    const disp = this.toDisplayWeight(weightKg);
    if (disp == null) return '--';
    const val = disp.toFixed(1);
    const u = this.state.profile.units?.weight || this.state.profile.unit;
    return withUnit ? `${val} ${u}` : val;
  }

  formatDelta(deltaKg, withUnit = true) {
    if (deltaKg === null || deltaKg === undefined || isNaN(deltaKg)) return '--';
    const num = parseFloat(deltaKg);
    if (isNaN(num)) return '--';
    const isLbs = (this.state.profile.units?.weight || this.state.profile.unit) === 'lbs';
    const converted = isLbs ? num * 2.20462 : num;
    const sign = converted > 0 ? '+' : '';
    const formatted = `${sign}${converted.toFixed(1)}`;
    const u = this.state.profile.units?.weight || this.state.profile.unit;
    return withUnit ? `${formatted} ${u}` : formatted;
  }

  // Profile Actions
  setProfile(partialProfile) {
    this.state.profile = { ...this.state.profile, ...partialProfile };
    if (partialProfile.displayName) {
      this.state.profile.name = partialProfile.displayName;
    } else if (partialProfile.name) {
      this.state.profile.displayName = partialProfile.name;
    }
    if (partialProfile.unit) {
      this.state.profile.units = { ...this.state.profile.units, weight: partialProfile.unit };
    }
    if (partialProfile.units?.weight) {
      this.state.profile.unit = partialProfile.units.weight;
    }
    if (partialProfile.theme) {
      this.state.profile.ui = { ...this.state.profile.ui, theme: partialProfile.theme };
      document.documentElement?.setAttribute('data-theme', partialProfile.theme);
    }
    if (partialProfile.ai) {
      this.state.profile.ai = { ...(this.state.profile.ai || {}), ...partialProfile.ai };
    }
    setMeta('profile', this.state.profile);
    this.notify();
  }

  setUnit(unit) {
    this.setProfile({ unit, units: { ...this.state.profile.units, weight: unit } });
  }

  toggleUnit() {
    const next = (this.state.profile.units?.weight || this.state.profile.unit) === 'kg' ? 'lbs' : 'kg';
    this.setUnit(next);
    return next;
  }

  setTheme(theme) {
    this.state.profile.theme = theme;
    this.state.profile.ui.theme = theme;
    document.documentElement?.setAttribute('data-theme', theme);
    setMeta('profile', this.state.profile);
    this.notify();
  }

  setHeadlineDisplay(mode) {
    if (['trend', 'scale'].includes(mode)) {
      this.state.profile.headlineDisplay = mode;
      this.state.profile.ui.headlineDisplay = mode;
      setMeta('profile', this.state.profile);
      this.notify();
    }
  }

  // Weight Entry Actions
  addEntry(entryData) {
    const entryDate = entryData.date || new Date().toISOString();
    const localDate = entryData.localDate || getLocalDateString(entryDate);
    const newEntry = {
      id: entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: entryDate,
      localDate: localDate,
      weight: parseFloat(entryData.weight),
      bodyFat: entryData.bodyFat ? parseFloat(entryData.bodyFat) : null,
      waist: entryData.waist ? parseFloat(entryData.waist) : null,
      mood: entryData.mood || 'normal',
      notes: entryData.notes || '',
      photo: entryData.photo || null,
      photoPath: entryData.photoPath || null,
      thumbPath: entryData.thumbPath || null
    };

    this.state.entries.push(newEntry);
    this.state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    putRecord('entries', newEntry);
    this.notify();
    return newEntry;
  }

  updateEntry(id, updatedFields) {
    const index = this.state.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      const existing = this.state.entries[index];
      const entryDate = updatedFields.date || existing.date;
      const updated = {
        ...existing,
        ...updatedFields,
        date: entryDate,
        localDate: updatedFields.localDate || getLocalDateString(entryDate),
        weight: parseFloat(updatedFields.weight ?? existing.weight),
        bodyFat: updatedFields.bodyFat ? parseFloat(updatedFields.bodyFat) : (updatedFields.bodyFat === null ? null : existing.bodyFat),
        waist: updatedFields.waist ? parseFloat(updatedFields.waist) : (updatedFields.waist === null ? null : existing.waist)
      };
      this.state.entries[index] = updated;
      this.state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      putRecord('entries', updated);
      this.notify();
      return updated;
    }
    return null;
  }

  deleteEntry(id) {
    const idx = this.state.entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      const deleted = this.state.entries[idx];
      this.undoBuffer = { entry: deleted, index: idx };
      this.state.entries.splice(idx, 1);
      deleteRecord('entries', id);
      this.notify();
      return deleted;
    }
    return null;
  }

  undoDelete() {
    if (this.undoBuffer && this.undoBuffer.entry) {
      const { entry, index } = this.undoBuffer;
      this.state.entries.splice(index, 0, entry);
      this.undoBuffer = null;
      putRecord('entries', entry);
      this.notify();
      return entry;
    }
    return null;
  }

  // ==========================================
  // FUEL & NUTRITION ACTIONS (Phase E1)
  // ==========================================

  addMeal(mealData) {
    const now = new Date();
    const loggedAt = mealData.loggedAt || now.toISOString();
    const localDate = mealData.localDate || getLocalDateString(loggedAt);

    // Compute totals if items provided
    let totals = mealData.totals;
    if (!totals && Array.isArray(mealData.items)) {
      totals = mealData.items.reduce((acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        proteinG: Math.round((acc.proteinG + (item.proteinG || 0)) * 10) / 10,
        carbsG: Math.round((acc.carbsG + (item.carbsG || 0)) * 10) / 10,
        fatG: Math.round((acc.fatG + (item.fatG || 0)) * 10) / 10
      }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    }

    const meal = {
      id: mealData.id || `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      loggedAt,
      localDate,
      mealType: mealData.mealType || 'lunch',
      title: mealData.title || 'Logged Meal',
      items: Array.isArray(mealData.items) ? mealData.items : [],
      totals: totals || { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      kcalLow: mealData.kcalLow ?? Math.round((totals?.kcal || 0) * 0.85),
      kcalHigh: mealData.kcalHigh ?? Math.round((totals?.kcal || 0) * 1.15),
      source: mealData.source || 'manual',
      photoPath: mealData.photoPath || null,
      thumbPath: mealData.thumbPath || null,
      notes: mealData.notes || '',
      ai: mealData.ai || null,
      createdAt: mealData.createdAt || now.toISOString(),
      updatedAt: now.toISOString()
    };

    this.state.meals.push(meal);
    this.state.meals.sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
    putRecord('meals', meal);

    // Check awards / badges (e.g. first_meal)
    this.unlockBadge('first_meal');

    this.notify();
    return meal;
  }

  updateMeal(id, partialMeal) {
    const idx = this.state.meals.findIndex(m => m.id === id);
    if (idx !== -1) {
      const existing = this.state.meals[idx];
      const updated = {
        ...existing,
        ...partialMeal,
        updatedAt: new Date().toISOString()
      };
      this.state.meals[idx] = updated;
      putRecord('meals', updated);
      this.notify();
      return updated;
    }
    return null;
  }

  deleteMeal(id) {
    const idx = this.state.meals.findIndex(m => m.id === id);
    if (idx !== -1) {
      const deleted = this.state.meals[idx];
      this.undoMealBuffer = { meal: deleted, index: idx };
      this.state.meals.splice(idx, 1);
      deleteRecord('meals', id);
      this.notify();
      return deleted;
    }
    return null;
  }

  undoDeleteMeal() {
    if (this.undoMealBuffer && this.undoMealBuffer.meal) {
      const { meal, index } = this.undoMealBuffer;
      this.state.meals.splice(index, 0, meal);
      putRecord('meals', meal);
      this.undoMealBuffer = null;
      this.notify();
      return meal;
    }
    return null;
  }

  duplicateMeal(mealId, targetLocalDate = getLocalDateString()) {
    const source = this.state.meals.find(m => m.id === mealId);
    if (!source) return null;

    const clone = {
      ...source,
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      localDate: targetLocalDate,
      loggedAt: new Date().toISOString(),
      source: 'copy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.addMeal(clone);
  }

  addWater(ml, targetLocalDate = getLocalDateString()) {
    const record = {
      id: `water_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      loggedAt: new Date().toISOString(),
      localDate: targetLocalDate,
      ml: Math.round(Number(ml) || 250)
    };

    this.state.water.push(record);
    this.undoWaterBuffer = { record };
    putRecord('water', record);
    this.notify();
    return record;
  }

  undoAddWater() {
    if (this.undoWaterBuffer && this.undoWaterBuffer.record) {
      const { record } = this.undoWaterBuffer;
      const idx = this.state.water.findIndex(w => w.id === record.id);
      if (idx !== -1) {
        this.state.water.splice(idx, 1);
        deleteRecord('water', record.id);
        this.undoWaterBuffer = null;
        this.notify();
        return true;
      }
    }
    return false;
  }

  finishDay(targetLocalDate = getLocalDateString()) {
    this.state.nutritionDays[targetLocalDate] = {
      complete: true,
      markedAt: new Date().toISOString()
    };
    putRecord('meta', { key: 'nutritionDays', value: this.state.nutritionDays });
    this.notify();
  }

  // Favorites
  addFavorite(favData) {
    const favorite = {
      id: favData.id || `fav_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: favData.name || 'Favorite Food',
      items: favData.items || [],
      totals: favData.totals || { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      usedCount: 0,
      lastUsedAt: new Date().toISOString()
    };

    this.state.favorites.push(favorite);
    putRecord('favorites', favorite);
    this.notify();
    return favorite;
  }

  useFavorite(favId, localDate = getLocalDateString()) {
    const fav = this.state.favorites.find(f => f.id === favId);
    if (!fav) return null;

    fav.usedCount = (fav.usedCount || 0) + 1;
    fav.lastUsedAt = new Date().toISOString();
    putRecord('favorites', fav);

    return this.addMeal({
      title: fav.name,
      items: JSON.parse(JSON.stringify(fav.items)),
      totals: { ...fav.totals },
      source: 'favorite',
      localDate
    });
  }

  // Chat Actions
  addChatMessage(msg) {
    const message = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      role: msg.role || 'user',
      createdAt: msg.createdAt || new Date().toISOString(),
      text: msg.text || '',
      imagePath: msg.imagePath || null,
      thumbPath: msg.thumbPath || null,
      draftId: msg.draftId || null,
      status: msg.status || 'ok',
      error: msg.error || null,
      ...(msg.meta || {})
    };

    this.state.chat.push(message);
    if (this.state.chat.length > 200) {
      this.state.chat = this.state.chat.slice(-200);
    }
    putRecord('chat', message);
    this.notify();
    return message;
  }

  clearChat() {
    this.state.chat = [];
    this.notify();
  }

  // Drafts
  saveDraft(draft) {
    const d = {
      id: draft.id || `draft_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...draft
    };
    const idx = this.state.drafts.findIndex(x => x.id === d.id);
    if (idx !== -1) {
      this.state.drafts[idx] = d;
    } else {
      this.state.drafts.push(d);
    }
    putRecord('drafts', d);
    this.notify();
    return d;
  }

  discardDraft(draftId) {
    const idx = this.state.drafts.findIndex(x => x.id === draftId);
    if (idx !== -1) {
      this.state.drafts.splice(idx, 1);
      deleteRecord('drafts', draftId);
      this.notify();
    }
  }

  // ==========================================
  // SELECTORS & COMPUTED VIEWS
  // ==========================================

  getMealsByDay(localDate = getLocalDateString()) {
    return this.state.meals.filter(m => m.localDate === localDate);
  }

  getWaterByDay(localDate = getLocalDateString()) {
    return this.state.water
      .filter(w => w.localDate === localDate)
      .reduce((sum, w) => sum + (w.ml || 0), 0);
  }

  getDailyNutritionSummary(localDate = getLocalDateString()) {
    const meals = this.getMealsByDay(localDate);
    const daySummary = summarizeDay(this.state, localDate);

    // Get current weight for targets
    const latestEntry = this.state.entries[this.state.entries.length - 1];
    const weightKg = latestEntry ? latestEntry.weight : (this.state.profile.startWeight || 70);

    const targetKcal = calorieTarget(this.state.profile, 2200);
    const macros = macroTargets(this.state.profile, targetKcal, weightKg);

    const waterMl = this.getWaterByDay(localDate);
    const waterTargetMl = this.state.profile.nutrition?.waterGoalMl === 'auto'
      ? Math.round(weightKg * 35)
      : (this.state.profile.nutrition?.waterGoalMl || 2500);

    return {
      localDate,
      consumed: daySummary.totals,
      target: {
        kcal: targetKcal,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG
      },
      waterMl,
      waterTargetMl,
      mealCount: meals.length,
      isComplete: !!(this.state.nutritionDays && this.state.nutritionDays[localDate]?.complete),
      calmMode: !!this.state.profile.nutrition?.calmMode,
      showMacros: this.state.profile.nutrition?.showMacros !== false
    };
  }

  getWeekDots(anchorLocalDate = getLocalDateString()) {
    const anchor = new Date(anchorLocalDate + 'T12:00:00');
    // Start of week (Monday)
    const day = anchor.getDay(); // 0 is Sunday
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diff);

    const todayStr = getLocalDateString();
    const dots = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = getLocalDateString(d);
      const meals = this.state.meals.filter(m => m.localDate === dStr);
      const isComplete = !!(this.state.nutritionDays && this.state.nutritionDays[dStr]?.complete);

      dots.push({
        date: dStr,
        dayNumber: d.getDate(),
        dayLabel: dayNames[i],
        hasMeals: meals.length > 0,
        mealCount: meals.length,
        isComplete,
        isToday: dStr === todayStr,
        isSelected: dStr === anchorLocalDate
      });
    }

    return dots;
  }

  getRecentMealTitles(limit = 10) {
    const titles = new Set();
    const sorted = [...this.state.meals].sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
    for (const m of sorted) {
      if (m.title && !titles.has(m.title)) {
        titles.add(m.title);
        if (titles.size >= limit) break;
      }
    }
    return Array.from(titles);
  }

  // ==========================================
  // BADGES & REVIEWS
  // ==========================================

  unlockBadge(badgeId) {
    if (!this.state.unlockedBadges.includes(badgeId)) {
      this.state.unlockedBadges.push(badgeId);
      this.state.badges = this.state.unlockedBadges;
      setMeta('unlockedBadges', this.state.unlockedBadges);
      this.notify();
      return true;
    }
    return false;
  }

  loadSampleData() {
    this.state.entries = generateSampleData();
    this.state.meals = generateSampleMeals();
    this.state.profile.startWeight = 82.5;
    this.state.profile.goalWeight = 73.0;
    this.state.unlockedBadges = [
      'first_step', 'consistency_3', 'streak_7', 'milestone_1kg', 'milestone_5kg',
      'first_meal', 'protein_7'
    ];
    this.state.badges = this.state.unlockedBadges;
    this.notify();
  }

  clearAllData() {
    this.state.entries = [];
    this.state.meals = [];
    this.state.water = [];
    this.state.chat = [];
    this.state.drafts = [];
    this.state.unlockedBadges = [];
    this.state.badges = [];
    this.state.profile.startWeight = null;
    this.state.profile.goalWeight = null;
    this.notify();
  }

  // ==========================================
  // IMPORT & EXPORT (Section 4.4)
  // ==========================================

  exportJSON(includeChat = false) {
    const exportState = { ...this.state };
    if (!includeChat) {
      delete exportState.chat;
    }
    // Never include secrets!
    if (exportState.ai) {
      delete exportState.ai.key;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zenith_backup_v3_${getLocalDateString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed) {
        this.state = this.sanitizeState(parsed);
        this.notify();
        return { success: true };
      }
      return { success: false, error: 'Invalid file format' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  exportCSV() {
    if (!this.state.entries.length) return;
    const unit = this.state.profile.units?.weight || this.state.profile.unit || 'kg';
    const headers = ['Date', `Weight (${unit})`, 'Body Fat (%)', 'Waist (cm)', 'Mood', 'Notes', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Water (ml)'];

    const rows = this.state.entries.map(e => {
      const dStr = e.localDate || getLocalDateString(e.date);
      const daySummary = summarizeDay(this.state, dStr);
      const waterMl = this.getWaterByDay(dStr);

      return [
        dStr,
        this.toDisplayWeight(e.weight),
        e.bodyFat || '',
        e.waist || '',
        `"${(e.mood || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
        daySummary.totals.kcal || '',
        daySummary.totals.proteinG || '',
        daySummary.totals.carbsG || '',
        daySummary.totals.fatG || '',
        waterMl || ''
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `zenith_weight_intake_${getLocalDateString()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  exportMealsCSV() {
    if (!this.state.meals.length) return;
    const headers = ['Date', 'Time', 'Meal', 'Title', 'Item', 'Quantity', 'Unit', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Source'];
    const rows = [];

    for (const m of this.state.meals) {
      const time = m.loggedAt ? new Date(m.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      if (m.items && m.items.length > 0) {
        for (const it of m.items) {
          rows.push([
            m.localDate,
            time,
            m.mealType,
            `"${m.title.replace(/"/g, '""')}"`,
            `"${it.name.replace(/"/g, '""')}"`,
            it.quantity,
            it.unit,
            it.kcal,
            it.proteinG,
            it.carbsG,
            it.fatG,
            m.source
          ]);
        }
      } else {
        rows.push([
          m.localDate,
          time,
          m.mealType,
          `"${m.title.replace(/"/g, '""')}"`,
          'Total',
          1,
          'meal',
          m.totals.kcal,
          m.totals.proteinG,
          m.totals.carbsG,
          m.totals.fatG,
          m.source
        ]);
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `zenith_meals_${getLocalDateString()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

export const store = new Store();
