/**
 * IndexedDB persistence for uploaded Excel files.
 *
 * Stores raw ArrayBuffers so we can re-parse on load without schema versioning.
 * IDB unavailability (private browsing in some browsers, locked DB, quota
 * exceeded) is logged via console.warn so issues can be diagnosed in DevTools
 * — but never throws, so the app keeps working without persistence.
 */

const DB_NAME = 'tangle-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export interface StoredFile {
  id: string;
  name: string;
  data: ArrayBuffer;
}

function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

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

function warn(op: string, err: unknown): void {
  console.warn(`[tangle/storage] ${op} failed — file persistence may be degraded:`, err);
}

export async function saveFile(id: string, name: string, data: ArrayBuffer): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, name, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    warn('saveFile', err);
  } finally {
    db?.close();
  }
}

export async function loadAllFiles(): Promise<StoredFile[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return [];

    return await new Promise<StoredFile[]>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as StoredFile[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    warn('loadAllFiles', err);
    return [];
  } finally {
    db?.close();
  }
}

export async function removeFile(id: string): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    warn('removeFile', err);
  } finally {
    db?.close();
  }
}

export async function clearAllFiles(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    if (!db) return;

    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    warn('clearAllFiles', err);
  } finally {
    db?.close();
  }
}
