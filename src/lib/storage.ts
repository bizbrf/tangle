/**
 * IndexedDB persistence for uploaded Excel files.
 *
 * Stores raw ArrayBuffers so we can re-parse on load without schema versioning.
 * Gracefully no-ops if IndexedDB is unavailable (e.g., private browsing in some browsers).
 */

const DB_NAME = 'tangle-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export interface StoredFile {
  id: string;
  name: string;
  data: ArrayBuffer;
}

/** Check whether IndexedDB is available in this environment. */
function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Open (or create) the database. Returns null if IndexedDB is unavailable. */
function openDB(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save a file's raw data to IndexedDB. */
export async function saveFile(id: string, name: string, data: ArrayBuffer): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, name, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback — just don't persist.
  } finally {
    db?.close();
  }
}

/** Load all stored files from IndexedDB. */
export async function loadAllFiles(): Promise<StoredFile[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as StoredFile[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** Remove a single file from IndexedDB by id. */
export async function removeFile(id: string): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback.
  } finally {
    db?.close();
  }
}

/** Clear all stored files from IndexedDB. */
export async function clearAllFiles(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback.
  } finally {
    db?.close();
  }
}
