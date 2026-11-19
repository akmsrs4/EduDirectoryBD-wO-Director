import type { DirectoryStats, FilterOptions, Institution } from '../types/institution';

const DB_NAME = 'edudirectory-bd-cache';
const DB_VERSION = 1;
const STORE_INSTITUTIONS = 'institutions';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_INSTITUTIONS)) {
          const store = db.createObjectStore(STORE_INSTITUTIONS, { keyPath: 'id' });
          store.createIndex('district', 'district', { unique: false });
          store.createIndex('eiin', 'eiin', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function cacheInstitutions(items: Institution[], clearExisting = false): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_INSTITUTIONS, 'readwrite');
      const store = tx.objectStore(STORE_INSTITUTIONS);
      if (clearExisting) store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful no-op if storage quota or IndexedDB is unavailable
  }
}

export async function getCachedInstitutions(): Promise<Institution[]> {
  try {
    const db = await openDB();
    return await new Promise<Institution[]>((resolve, reject) => {
      const tx = db.transaction(STORE_INSTITUTIONS, 'readonly');
      const req = tx.objectStore(STORE_INSTITUTIONS).getAll();
      req.onsuccess = () => resolve((req.result as Institution[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getCachedInstitutionById(id: string): Promise<Institution | null> {
  try {
    const db = await openDB();
    return await new Promise<Institution | null>((resolve, reject) => {
      const tx = db.transaction(STORE_INSTITUTIONS, 'readonly');
      const req = tx.objectStore(STORE_INSTITUTIONS).get(id);
      req.onsuccess = () => resolve((req.result as Institution | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedMeta<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cache errors
  }
}

export async function getCachedMeta<T>(key: string): Promise<{ value: T; updatedAt: number } | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => resolve((req.result as { value: T; updatedAt: number } | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_INSTITUTIONS, STORE_META], 'readwrite');
      tx.objectStore(STORE_INSTITUTIONS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export type CachedDirectoryBundle = {
  stats?: DirectoryStats;
  filterOptions?: FilterOptions;
};
