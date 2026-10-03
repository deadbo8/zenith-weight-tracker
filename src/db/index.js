import { openDB } from 'idb';

const DB_NAME = 'zenith_db_v3';
const DB_VERSION = 1;
const LEGACY_STORAGE_KEY = 'zenith_weight_tracker_v2';

let dbPromise = null;

export function getDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('entries')) {
          db.createObjectStore('entries', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meals')) {
          const mealStore = db.createObjectStore('meals', { keyPath: 'id' });
          mealStore.createIndex('localDate', 'localDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('water')) {
          const waterStore = db.createObjectStore('water', { keyPath: 'id' });
          waterStore.createIndex('localDate', 'localDate', { unique: false });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat')) {
          const chatStore = db.createObjectStore('chat', { keyPath: 'id' });
          chatStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

export async function putRecord(storeName, value) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put(storeName, value);
  } catch (err) {
    console.warn(`IndexedDB put error [${storeName}]:`, err);
  }
}

export async function deleteRecord(storeName, key) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(storeName, key);
  } catch (err) {
    console.warn(`IndexedDB delete error [${storeName}]:`, err);
  }
}

export async function getAllRecords(storeName) {
  try {
    const db = await getDb();
    if (!db) return [];
    return await db.getAll(storeName);
  } catch (err) {
    console.warn(`IndexedDB getAll error [${storeName}]:`, err);
    return [];
  }
}

export async function getMeta(key) {
  try {
    const db = await getDb();
    if (!db) return null;
    const res = await db.get('meta', key);
    return res ? res.value : null;
  } catch (err) {
    return null;
  }
}

export async function setMeta(key, value) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put('meta', { key, value, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('IndexedDB setMeta error:', err);
  }
}

/**
 * Lossless Migration from Schema v2 (localStorage) to Schema v3 (IndexedDB)
 * Section 4.3:
 * - Safety copy saved to localStorage 'zenith_backup_v2_<timestamp>'
 * - Translates schema v2 profile and weight entries
 * - Populates IndexedDB in transaction
 * - Marks schemaVersion: 3 in meta store
 */
export async function migrateV2toV3IfNeeded() {
  const db = await getDb();
  if (!db) return false;
  const existingVersion = await getMeta('schemaVersion');
  if (existingVersion === 3) {
    return false; // Already on Schema v3
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) {
    await setMeta('schemaVersion', 3);
    return false;
  }

  try {
    const parsed = JSON.parse(legacyRaw);
    // 1. Create safety backup
    const backupKey = `zenith_backup_v2_${Date.now()}`;
    localStorage.setItem(backupKey, legacyRaw);

    // 2. Map profile
    const p = parsed.profile || {};
    const weightUnit = p.unit || 'kg';
    const profileV3 = {
      id: 'user_default',
      displayName: p.name || 'My Profile',
      avatar: { type: 'initials', color: '#30D158' },
      sex: p.gender || 'male',
      age: p.age || 28,
      heightCm: p.height || 175,
      startWeight: p.startWeight || null,
      goalWeight: p.goalWeight || null,
      targetDate: p.targetDate || null,
      goalType: p.goalWeight && p.startWeight ? (p.goalWeight < p.startWeight ? 'lose' : 'gain') : 'lose',
      weeklyRatePref: 0.5,
      activityLevel: p.activityLevel || 'moderate',
      units: {
        weight: weightUnit,
        length: weightUnit === 'lbs' ? 'in' : 'cm',
        energy: 'kcal',
        water: 'ml'
      },
      diet: { pattern: 'balanced', allergies: [], dislikes: [], cuisines: [] },
      nutrition: {
        calorieMode: 'auto',
        macroPreset: 'balanced',
        proteinPerKg: 1.6,
        fatPercent: 25,
        waterGoalMl: 'auto',
        showMacros: true,
        calmMode: false
      },
      ui: {
        theme: p.theme || 'dark',
        headlineDisplay: p.headlineDisplay || 'trend',
        haptics: true
      },
      reminders: { weighIn: null, meals: [], water: null },
      createdAt: new Date().toISOString()
    };

    // 3. Map weight entries with localDate
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entriesV3 = entries.map(e => {
      const d = new Date(e.date);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        ...e,
        localDate: e.localDate || localDate
      };
    });

    // 4. Write in transaction
    const tx = db.transaction(['entries', 'meta'], 'readwrite');
    for (const entry of entriesV3) {
      await tx.objectStore('entries').put(entry);
    }
    await tx.objectStore('meta').put({ key: 'profile', value: profileV3 });
    await tx.objectStore('meta').put({ key: 'unlockedBadges', value: parsed.unlockedBadges || [] });
    await tx.objectStore('meta').put({ key: 'schemaVersion', value: 3 });
    await tx.done;

    console.info('[Zenith Storage] Successfully migrated to Schema v3 with', entriesV3.length, 'entries');
    return true;
  } catch (err) {
    console.error('[Zenith Storage] Migration v2 -> v3 error:', err);
    return false;
  }
}
