import type {
  Garment,
  Movement,
  SeasonReport,
  Trip,
  UserProfile,
} from '../types';

const DB_NAME = 'maleta_foranea_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

export interface OfflineSnapshot {
  userId: string;
  profile: UserProfile | null;
  garments: Garment[];
  trips: Trip[];
  movements: Movement[];
  seasons: SeasonReport[];
  savedAtIso: string;
}

interface SerializedTimestamp {
  __ms: number;
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return { __ms: (value as { toMillis: () => number }).toMillis() } satisfies SerializedTimestamp;
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveOfflineSnapshot(
  snapshot: Omit<OfflineSnapshot, 'savedAtIso'>
): Promise<void> {
  try {
    const db = await openOfflineDb();
    const payload = serializeValue({
      ...snapshot,
      savedAtIso: new Date().toISOString(),
    }) as OfflineSnapshot;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error || new Error('Failed to write snapshot to IndexedDB'));
    });
    db.close();
  } catch (error) {
    console.warn('No se pudo actualizar el espejo local en IndexedDB:', error);
  }
}

export async function loadOfflineSnapshot(
  userId: string
): Promise<OfflineSnapshot | null> {
  try {
    const db = await openOfflineDb();
    const result = await new Promise<OfflineSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);
      req.onsuccess = () => resolve((req.result as OfflineSnapshot) || null);
      req.onerror = () =>
        reject(req.error || new Error('Failed to read IndexedDB snapshot'));
    });
    db.close();
    return result;
  } catch (error) {
    console.warn('No se pudo leer el respaldo local de IndexedDB:', error);
    return null;
  }
}

export async function clearOfflineSnapshot(userId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore cleanup errors
  }
}
