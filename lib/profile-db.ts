/**
 * IndexedDB 存储 — 多风格档案（v0.6.0）
 *
 * 解决 localStorage 5MB 限制
 * 支持多套风格档案（议论文 + 散文 + 记叙文 各自）
 *
 * Schema:
 *   profiles: { id, name, type, dna, profile, samples, savedAt }
 *   favorites: { id, topic, savedAt }
 */

import type { StyleDNA } from './style-dna';
import type { StyleProfile } from './style-extractor';

const DB_NAME = 'essay-copilot';
const DB_VERSION = 1;
const STORE_PROFILES = 'profiles';
const STORE_FAVORITES = 'favorites';

export type StyleProfile_ = {
  id: string;
  name: string;
  type: 'argument' | 'narrative' | 'lyric' | 'other';
  dna: StyleDNA;
  profile: StyleProfile | null;
  samples: string[];
  savedAt: number;
};

export type FavoriteTopic = {
  id: string;
  topic: string;
  category?: string;
  notes?: string;
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB only available in browser'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    fn(store).then(resolve).catch(reject);
  });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============ Profiles API ============

export async function saveProfile(profile: StyleProfile_): Promise<void> {
  await withStore(STORE_PROFILES, 'readwrite', async store => {
    await promisifyRequest(store.put(profile));
  });
}

export async function loadProfile(id: string): Promise<StyleProfile_ | null> {
  return withStore(STORE_PROFILES, 'readonly', async store => {
    const result = await promisifyRequest(store.get(id));
    return result || null;
  });
}

export async function listProfiles(): Promise<StyleProfile_[]> {
  return withStore(STORE_PROFILES, 'readonly', async store => {
    const all = await promisifyRequest(store.getAll());
    return (all as StyleProfile_[]).sort((a, b) => b.savedAt - a.savedAt);
  });
}

export async function deleteProfile(id: string): Promise<void> {
  await withStore(STORE_PROFILES, 'readwrite', async store => {
    await promisifyRequest(store.delete(id));
  });
}

// ============ Favorites API ============

export async function addFavorite(topic: string, category?: string, notes?: string): Promise<FavoriteTopic> {
  const fav: FavoriteTopic = {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    topic,
    category,
    notes,
    savedAt: Date.now()
  };
  await withStore(STORE_FAVORITES, 'readwrite', async store => {
    await promisifyRequest(store.put(fav));
  });
  return fav;
}

export async function listFavorites(): Promise<FavoriteTopic[]> {
  return withStore(STORE_FAVORITES, 'readonly', async store => {
    const all = await promisifyRequest(store.getAll());
    return (all as FavoriteTopic[]).sort((a, b) => b.savedAt - a.savedAt);
  });
}

export async function deleteFavorite(id: string): Promise<void> {
  await withStore(STORE_FAVORITES, 'readwrite', async store => {
    await promisifyRequest(store.delete(id));
  });
}