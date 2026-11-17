import type {
  Garment,
  Movement,
  SeasonReport,
  Trip,
  UserProfile,
} from '../types';

const DB_NAME = 'maleta_foranea_local_db';
const DB_VERSION = 1;
const STORE_STATE = 'wardrobe_state';
const RECORD_KEY = 'default_wardrobe';
const LS_FALLBACK_KEY = 'maleta_foranea_local_backup_v1';
const LEGACY_OFFLINE_DB = 'maleta_foranea_offline_db';

export type LocalStorageEngine = 'indexeddb' | 'localstorage' | 'memory';

export interface LocalWardrobeState {
  profile: UserProfile;
  garments: Garment[];
  trips: Trip[];
  movements: Movement[];
  seasons: SeasonReport[];
  updatedAtIso: string;
}

export function createDefaultProfile(): UserProfile {
  const now = Date.now();
  return {
    uid: 'local-user',
    displayName: 'Foráneo',
    email: '',
    cityLabel: 'La Ciudad',
    ranchLabel: 'El Rancho',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyWardrobeState(): LocalWardrobeState {
  return {
    profile: createDefaultProfile(),
    garments: [],
    trips: [],
    movements: [],
    seasons: [],
    updatedAtIso: new Date().toISOString(),
  };
}

function normalizeState(raw: unknown): LocalWardrobeState {
  if (!raw || typeof raw !== 'object') {
    return createEmptyWardrobeState();
  }
  const obj = raw as Partial<LocalWardrobeState>;
  const baseProfile = createDefaultProfile();
  const profile: UserProfile =
    obj.profile && typeof obj.profile === 'object'
      ? {
          ...baseProfile,
          ...obj.profile,
          cityLabel: obj.profile.cityLabel || 'La Ciudad',
          ranchLabel: obj.profile.ranchLabel || 'El Rancho',
        }
      : baseProfile;

  return {
    profile,
    garments: Array.isArray(obj.garments) ? obj.garments : [],
    trips: Array.isArray(obj.trips) ? obj.trips : [],
    movements: Array.isArray(obj.movements) ? obj.movements : [],
    seasons: Array.isArray(obj.seasons) ? obj.seasons : [],
    updatedAtIso:
      typeof obj.updatedAtIso === 'string'
        ? obj.updatedAtIso
        : new Date().toISOString(),
  };
}

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error || new Error('Failed to open local IndexedDB'));
  });
}

function readLocalStorageFallback(): LocalWardrobeState | null {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return null;
    }
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStorageFallback(state: LocalWardrobeState): boolean {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return false;
    }
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

async function migrateLegacyOfflineSnapshot(): Promise<LocalWardrobeState | null> {
  try {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return null;
    }
    const legacy = await new Promise<LocalWardrobeState | null>((resolve) => {
      const req = window.indexedDB.open(LEGACY_OFFLINE_DB, 1);
      let createdDuringProbe = false;
      req.onupgradeneeded = () => {
        createdDuringProbe = true;
        const db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'userId' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (createdDuringProbe || !db.objectStoreNames.contains('snapshots')) {
          db.close();
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction('snapshots', 'readonly');
          const store = tx.objectStore('snapshots');
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const rows = Array.isArray(allReq.result) ? allReq.result : [];
            db.close();
            if (rows.length === 0) {
              resolve(null);
              return;
            }
            const first = rows[0] as Record<string, unknown>;
            resolve(
              normalizeState({
                profile: first.profile,
                garments: first.garments,
                trips: first.trips,
                movements: first.movements,
                seasons: first.seasons,
                updatedAtIso:
                  typeof first.savedAtIso === 'string'
                    ? first.savedAtIso
                    : new Date().toISOString(),
              })
            );
          };
          allReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
    return legacy;
  } catch {
    return null;
  }
}

export async function loadLocalDatabase(): Promise<{
  state: LocalWardrobeState;
  engine: LocalStorageEngine;
}> {
  try {
    const db = await openLocalDb();
    const stored = await new Promise<LocalWardrobeState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const store = tx.objectStore(STORE_STATE);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        resolve(req.result ? normalizeState(req.result) : null);
      };
      req.onerror = () =>
        reject(req.error || new Error('Failed to read local database'));
    });
    db.close();

    if (stored) {
      writeLocalStorageFallback(stored);
      return { state: stored, engine: 'indexeddb' };
    }

    const lsBackup = readLocalStorageFallback();
    if (lsBackup) {
      await saveLocalDatabase(lsBackup);
      return { state: lsBackup, engine: 'indexeddb' };
    }

    const migrated = await migrateLegacyOfflineSnapshot();
    if (migrated) {
      await saveLocalDatabase(migrated);
      return { state: migrated, engine: 'indexeddb' };
    }

    const empty = createEmptyWardrobeState();
    await saveLocalDatabase(empty);
    return { state: empty, engine: 'indexeddb' };
  } catch {
    const lsState = readLocalStorageFallback();
    if (lsState) {
      return { state: lsState, engine: 'localstorage' };
    }
    const empty = createEmptyWardrobeState();
    const savedLs = writeLocalStorageFallback(empty);
    return {
      state: empty,
      engine: savedLs ? 'localstorage' : 'memory',
    };
  }
}

export async function saveLocalDatabase(
  state: LocalWardrobeState
): Promise<LocalStorageEngine> {
  const normalized: LocalWardrobeState = {
    ...state,
    updatedAtIso: new Date().toISOString(),
  };

  writeLocalStorageFallback(normalized);

  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      store.put(normalized, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error || new Error('Failed to write local IndexedDB'));
    });
    db.close();
    return 'indexeddb';
  } catch {
    return writeLocalStorageFallback(normalized) ? 'localstorage' : 'memory';
  }
}

export function parseImportedBackup(jsonText: string): LocalWardrobeState {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo no tiene un formato de respaldo válido.');
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.garments)) {
    throw new Error('El respaldo no contiene la lista de prendas.');
  }
  return normalizeState(obj);
}
