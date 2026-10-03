/**
 * Zenith BYOK (Bring-Your-Own-Key) Secure Key Storage (Section 6.1)
 * - Uses WebCrypto AES-GCM with a non-extractable device key stored in IndexedDB
 * - Never stores keys in plain localStorage or unencrypted state
 * - Key is excluded from all logs, backups, and exports
 */

import { openDB } from 'idb';
import { CapacitorHttp } from '@capacitor/core';

const SECURE_DB_NAME = 'zenith_secure_vault';
const SECURE_STORE_NAME = 'keys';
const KEY_RECORD_ID = 'gemini_api_key';

let vaultDbPromise = null;

function getVaultDb() {
  if (!vaultDbPromise) {
    vaultDbPromise = openDB(SECURE_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SECURE_STORE_NAME)) {
          db.createObjectStore(SECURE_STORE_NAME, { keyPath: 'id' });
        }
      }
    });
  }
  return vaultDbPromise;
}

// Generate or retrieve non-extractable device encryption key
async function getDeviceKey() {
  const db = await getVaultDb();
  let master = await db.get(SECURE_STORE_NAME, 'master_crypto_key');
  if (master && master.key) {
    return master.key;
  }

  const generatedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );

  await db.put(SECURE_STORE_NAME, { id: 'master_crypto_key', key: generatedKey });
  return generatedKey;
}

export async function setKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    await removeKey();
    return;
  }
  const trimmed = rawKey.trim();
  const db = await getVaultDb();
  const deviceKey = await getDeviceKey();

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(trimmed);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    deviceKey,
    encoded
  );

  await db.put(SECURE_STORE_NAME, {
    id: KEY_RECORD_ID,
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher)),
    updatedAt: new Date().toISOString()
  });
}

export async function getKey() {
  try {
    const db = await getVaultDb();
    const record = await db.get(SECURE_STORE_NAME, KEY_RECORD_ID);
    if (!record || !record.cipher || !record.iv) return null;

    const deviceKey = await getDeviceKey();
    const iv = new Uint8Array(record.iv);
    const cipher = new Uint8Array(record.cipher);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      deviceKey,
      cipher
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.warn('[Zenith Key Vault] Failed to decrypt key');
    return null;
  }
}

export async function removeKey() {
  try {
    const db = await getVaultDb();
    await db.delete(SECURE_STORE_NAME, KEY_RECORD_ID);
  } catch (e) {}
}

export async function hasKey() {
  const k = await getKey();
  return !!k && k.length > 5;
}

/**
 * Test user-provided Gemini API key with real lightweight endpoint (Section 6.1)
 * GET /v1beta/models?pageSize=1
 */
export async function testKey(apiKey) {
  const keyToTest = apiKey || await getKey();
  if (!keyToTest) return { valid: false, reason: 'no_key', message: 'No API key provided' };

  try {
    const res = await CapacitorHttp.get({
      url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(keyToTest)}`,
      headers: {
        'x-goog-api-key': keyToTest
      },
      connectTimeout: 15000,
      readTimeout: 15000
    });

    if (res.status === 200) {
      return { valid: true, message: 'Connected successfully' };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { valid: false, reason: 'bad_key', message: 'Your API key was not accepted by Google' };
    }
    if (res.status === 429) {
      return { valid: false, reason: 'rate_limit', message: 'Google is rate-limiting this key' };
    }
    return { valid: false, reason: 'http_error', message: `Server returned status ${res.status}` };
  } catch (e) {
    return { valid: false, reason: 'network', message: 'Network connection error' };
  }
}
