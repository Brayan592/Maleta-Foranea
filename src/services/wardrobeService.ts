import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  LIMITS,
  STARTER_GARMENTS,
  type Garment,
  type GarmentFormValues,
  type GarmentLocation,
  type LaundryStatus,
  type TargetLocation,
  type Trip,
  type TripEndpoint,
} from '../types';

function clampString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function clampQuantity(qty: number): number {
  const n = Number.isFinite(qty) ? Math.round(qty) : 1;
  return Math.max(LIMITS.QUANTITY_MIN, Math.min(LIMITS.QUANTITY_MAX, n));
}

function clampNonNegativeInt(val: number, maxVal: number): number {
  const n = Number.isFinite(val) ? Math.round(val) : 0;
  return Math.max(0, Math.min(maxVal, n));
}

/**
 * Executes a Firestore write with offline-resilience:
 * When IndexedDB persistentLocalCache is enabled, Firestore immediately commits
 * locally and triggers onSnapshot, while the Promise waits for server ack.
 * When offline or on a weak highway connection, we let the write stay queued in
 * IndexedDB instead of blocking the UI indefinitely.
 */
async function runOfflineSafeWrite(
  writeOp: () => Promise<void>,
  operationType: OperationType,
  path: string
): Promise<void> {
  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  const promise = writeOp();

  if (isOffline) {
    promise.catch((err) => {
      console.warn(`Escritura en cola (${path}) falló al sincronizar:`, err);
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    return;
  }

  let settled = false;
  const wrapped = promise
    .then(() => {
      settled = true;
    })
    .catch((err) => {
      settled = true;
      handleFirestoreError(err, operationType, path);
    });

  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (!settled) {
        console.info(
          `Conexión lenta en ${path}; cambio guardado localmente en IndexedDB para sincronizar en segundo plano.`
        );
      }
      resolve();
    }, 2800);
  });

  await Promise.race([wrapped, timeout]);
}

export async function syncPendingWrites(): Promise<void> {
  await waitForPendingWrites(db);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  try {
    let exists = false;
    if (isOffline) {
      try {
        const cached = await getDocFromCache(userRef);
        exists = cached.exists();
      } catch {
        exists = false;
      }
    } else {
      const snap = await getDoc(userRef);
      exists = snap.exists();
    }

    if (!exists) {
      const displayName = clampString(
        user.displayName || user.email?.split('@')[0] || 'Foráneo',
        LIMITS.DISPLAY_NAME_MAX
      );
      const email = clampString(user.email || '', LIMITS.EMAIL_MAX);
      await runOfflineSafeWrite(
        () =>
          setDoc(userRef, {
            uid: user.uid,
            displayName: displayName || 'Foráneo',
            email,
            cityLabel: 'La Ciudad',
            ranchLabel: 'El Rancho',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        OperationType.WRITE,
        userPath
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline') || msg.includes('unavailable')) {
      console.warn('No se pudo verificar perfil en servidor (modo offline).');
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateLocationLabels(
  userId: string,
  cityLabel: string,
  ranchLabel: string
): Promise<void> {
  const path = `users/${userId}`;
  const cleanCity =
    clampString(cityLabel, LIMITS.CITY_RANCH_LABEL_MAX) || 'La Ciudad';
  const cleanRanch =
    clampString(ranchLabel, LIMITS.CITY_RANCH_LABEL_MAX) || 'El Rancho';

  await runOfflineSafeWrite(
    () =>
      updateDoc(doc(db, 'users', userId), {
        cityLabel: cleanCity,
        ranchLabel: cleanRanch,
        updatedAt: serverTimestamp(),
      }),
    OperationType.UPDATE,
    path
  );
}

export async function addGarment(
  userId: string,
  values: GarmentFormValues
): Promise<string> {
  const garmentsCol = collection(db, 'users', userId, 'garments');
  const newRef = doc(garmentsCol);
  const path = `users/${userId}/garments/${newRef.id}`;
  const name = clampString(values.name, LIMITS.NAME_MAX);
  if (!name) {
    throw new Error('El nombre de la prenda es obligatorio.');
  }

  await runOfflineSafeWrite(
    () =>
      setDoc(newRef, {
        ownerId: userId,
        name,
        category: values.category,
        color: clampString(values.color, LIMITS.COLOR_MAX),
        location: values.location,
        targetLocation:
          values.location === 'maleta' ? values.targetLocation : 'ninguno',
        laundryStatus: values.laundryStatus,
        isEssential: Boolean(values.isEssential),
        notes: clampString(values.notes, LIMITS.NOTES_MAX),
        quantity: clampQuantity(values.quantity),
        tripId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    OperationType.CREATE,
    path
  );

  return newRef.id;
}

export async function updateGarment(
  userId: string,
  garmentId: string,
  values: GarmentFormValues,
  tripId: string
): Promise<void> {
  const path = `users/${userId}/garments/${garmentId}`;
  const name = clampString(values.name, LIMITS.NAME_MAX);
  if (!name) {
    throw new Error('El nombre de la prenda es obligatorio.');
  }
  const cleanTarget: TargetLocation =
    values.location === 'maleta' ? values.targetLocation : 'ninguno';

  await runOfflineSafeWrite(
    () =>
      updateDoc(doc(db, 'users', userId, 'garments', garmentId), {
        name,
        category: values.category,
        color: clampString(values.color, LIMITS.COLOR_MAX),
        location: values.location,
        targetLocation: cleanTarget,
        laundryStatus: values.laundryStatus,
        isEssential: Boolean(values.isEssential),
        notes: clampString(values.notes, LIMITS.NOTES_MAX),
        quantity: clampQuantity(values.quantity),
        tripId: values.location === 'maleta' ? clampString(tripId, 128) : '',
        updatedAt: serverTimestamp(),
      }),
    OperationType.UPDATE,
    path
  );
}

export async function moveGarmentDirect(
  userId: string,
  garment: Garment,
  toLocation: GarmentLocation,
  tripTitle = 'Traslado directo'
): Promise<void> {
  if (garment.location === toLocation) return;
  const garmentPath = `users/${userId}/garments/${garment.id}`;

  const batch = writeBatch(db);
  const garmentRef = doc(db, 'users', userId, 'garments', garment.id);
  batch.update(garmentRef, {
    location: toLocation,
    targetLocation: 'ninguno',
    tripId: '',
    updatedAt: serverTimestamp(),
  });

  const movementRef = doc(collection(db, 'users', userId, 'movements'));
  batch.set(movementRef, {
    ownerId: userId,
    garmentId: garment.id,
    garmentName: clampString(garment.name, LIMITS.NAME_MAX),
    fromLocation: garment.location,
    toLocation,
    tripTitle: clampString(tripTitle, LIMITS.TRIP_TITLE_MAX),
    createdAt: serverTimestamp(),
  });

  await runOfflineSafeWrite(
    () => batch.commit(),
    OperationType.WRITE,
    garmentPath
  );
}

export async function toggleLaundryStatus(
  userId: string,
  garment: Garment
): Promise<void> {
  const path = `users/${userId}/garments/${garment.id}`;
  const nextStatus: LaundryStatus =
    garment.laundryStatus === 'limpia' ? 'por_lavar' : 'limpia';

  await runOfflineSafeWrite(
    () =>
      updateDoc(doc(db, 'users', userId, 'garments', garment.id), {
        laundryStatus: nextStatus,
        updatedAt: serverTimestamp(),
      }),
    OperationType.UPDATE,
    path
  );
}

export async function deleteGarment(
  userId: string,
  garmentId: string
): Promise<void> {
  const path = `users/${userId}/garments/${garmentId}`;
  await runOfflineSafeWrite(
    () => deleteDoc(doc(db, 'users', userId, 'garments', garmentId)),
    OperationType.DELETE,
    path
  );
}

export async function seedStarterWardrobe(userId: string): Promise<void> {
  const path = `users/${userId}/garments`;
  const batch = writeBatch(db);
  for (const item of STARTER_GARMENTS) {
    const ref = doc(collection(db, 'users', userId, 'garments'));
    batch.set(ref, {
      ownerId: userId,
      name: clampString(item.name, LIMITS.NAME_MAX),
      category: item.category,
      color: clampString(item.color, LIMITS.COLOR_MAX),
      location: item.location,
      targetLocation: 'ninguno',
      laundryStatus: item.laundryStatus,
      isEssential: item.isEssential,
      notes: clampString(item.notes, LIMITS.NOTES_MAX),
      quantity: clampQuantity(item.quantity),
      tripId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await runOfflineSafeWrite(() => batch.commit(), OperationType.WRITE, path);
}

export async function createTrip(
  userId: string,
  input: {
    title: string;
    origin: TripEndpoint;
    destination: TripEndpoint;
    travelDate: string;
    notes: string;
    initialItemIds?: string[];
  }
): Promise<string> {
  if (input.origin === input.destination) {
    throw new Error('El origen y el destino del viaje deben ser distintos.');
  }
  const title = clampString(input.title, LIMITS.TRIP_TITLE_MAX);
  if (!title) {
    throw new Error('El título del viaje es obligatorio.');
  }

  const tripRef = doc(collection(db, 'users', userId, 'trips'));
  const path = `users/${userId}/trips/${tripRef.id}`;
  const cleanItems = (input.initialItemIds || []).slice(
    0,
    LIMITS.TRIP_ITEMS_MAX
  );

  await runOfflineSafeWrite(
    () =>
      setDoc(tripRef, {
        ownerId: userId,
        title,
        origin: input.origin,
        destination: input.destination,
        status: 'planeando',
        travelDate: clampString(input.travelDate, LIMITS.TRAVEL_DATE_MAX),
        itemIds: cleanItems,
        packedIds: [],
        notes: clampString(input.notes, LIMITS.NOTES_MAX),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    OperationType.CREATE,
    path
  );

  return tripRef.id;
}

export async function addGarmentToTrip(
  userId: string,
  trip: Trip,
  garmentId: string
): Promise<void> {
  if (trip.status === 'completado') return;
  if (trip.itemIds.includes(garmentId)) return;
  if (trip.itemIds.length >= LIMITS.TRIP_ITEMS_MAX) {
    throw new Error(`Máximo ${LIMITS.TRIP_ITEMS_MAX} prendas por maleta.`);
  }
  const path = `users/${userId}/trips/${trip.id}`;

  await runOfflineSafeWrite(
    () =>
      updateDoc(doc(db, 'users', userId, 'trips', trip.id), {
        itemIds: [...trip.itemIds, garmentId],
        updatedAt: serverTimestamp(),
      }),
    OperationType.UPDATE,
    path
  );
}

export async function removeGarmentFromTrip(
  userId: string,
  trip: Trip,
  garment: Garment
): Promise<void> {
  if (trip.status === 'completado') return;
  const path = `users/${userId}/trips/${trip.id}`;
  const batch = writeBatch(db);
  const nextItems = trip.itemIds.filter((id) => id !== garment.id);
  const nextPacked = trip.packedIds.filter((id) => id !== garment.id);
  batch.update(doc(db, 'users', userId, 'trips', trip.id), {
    itemIds: nextItems,
    packedIds: nextPacked,
    status: nextPacked.length > 0 ? 'en_camino' : 'planeando',
    updatedAt: serverTimestamp(),
  });

  if (garment.location === 'maleta' && garment.tripId === trip.id) {
    batch.update(doc(db, 'users', userId, 'garments', garment.id), {
      location: trip.origin,
      targetLocation: 'ninguno',
      tripId: '',
      updatedAt: serverTimestamp(),
    });
  }

  await runOfflineSafeWrite(() => batch.commit(), OperationType.WRITE, path);
}

export async function toggleTripPackedItem(
  userId: string,
  trip: Trip,
  garment: Garment
): Promise<void> {
  if (trip.status === 'completado') return;
  const path = `users/${userId}/trips/${trip.id}`;
  const isCurrentlyPacked = trip.packedIds.includes(garment.id);

  const batch = writeBatch(db);
  const nextPacked = isCurrentlyPacked
    ? trip.packedIds.filter((id) => id !== garment.id)
    : [...trip.packedIds, garment.id].slice(0, LIMITS.TRIP_ITEMS_MAX);

  const nextItems = trip.itemIds.includes(garment.id)
    ? trip.itemIds
    : [...trip.itemIds, garment.id].slice(0, LIMITS.TRIP_ITEMS_MAX);

  batch.update(doc(db, 'users', userId, 'trips', trip.id), {
    itemIds: nextItems,
    packedIds: nextPacked,
    status: nextPacked.length > 0 ? 'en_camino' : 'planeando',
    updatedAt: serverTimestamp(),
  });

  if (!isCurrentlyPacked) {
    batch.update(doc(db, 'users', userId, 'garments', garment.id), {
      location: 'maleta',
      targetLocation: trip.destination,
      tripId: trip.id,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'users', userId, 'garments', garment.id), {
      location: trip.origin,
      targetLocation: 'ninguno',
      tripId: '',
      updatedAt: serverTimestamp(),
    });
  }

  await runOfflineSafeWrite(() => batch.commit(), OperationType.WRITE, path);
}

export async function completeTripAndUnpack(
  userId: string,
  trip: Trip,
  garmentsById: Map<string, Garment>
): Promise<number> {
  if (trip.status === 'completado') return 0;
  const path = `users/${userId}/trips/${trip.id}`;
  const idsToMove = trip.packedIds.length > 0 ? trip.packedIds : trip.itemIds;

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId, 'trips', trip.id), {
    status: 'completado',
    packedIds: idsToMove,
    updatedAt: serverTimestamp(),
  });

  let movedCount = 0;
  for (const id of idsToMove) {
    const garment = garmentsById.get(id);
    if (!garment) continue;

    const garmentRef = doc(db, 'users', userId, 'garments', id);
    batch.update(garmentRef, {
      location: trip.destination,
      targetLocation: 'ninguno',
      tripId: '',
      updatedAt: serverTimestamp(),
    });

    const movementRef = doc(collection(db, 'users', userId, 'movements'));
    batch.set(movementRef, {
      ownerId: userId,
      garmentId: id,
      garmentName: clampString(garment.name, LIMITS.NAME_MAX),
      fromLocation: trip.origin,
      toLocation: trip.destination,
      tripTitle: clampString(trip.title, LIMITS.TRIP_TITLE_MAX),
      createdAt: serverTimestamp(),
    });
    movedCount += 1;
  }

  await runOfflineSafeWrite(() => batch.commit(), OperationType.WRITE, path);
  return movedCount;
}

export async function deleteTrip(
  userId: string,
  trip: Trip,
  garments: Garment[]
): Promise<void> {
  const path = `users/${userId}/trips/${trip.id}`;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', userId, 'trips', trip.id));

  for (const g of garments) {
    if (g.location === 'maleta' && g.tripId === trip.id) {
      batch.update(doc(db, 'users', userId, 'garments', g.id), {
        location: trip.origin,
        targetLocation: 'ninguno',
        tripId: '',
        updatedAt: serverTimestamp(),
      });
    }
  }

  await runOfflineSafeWrite(() => batch.commit(), OperationType.WRITE, path);
}

export async function deleteMovement(
  userId: string,
  movementId: string
): Promise<void> {
  const path = `users/${userId}/movements/${movementId}`;
  await runOfflineSafeWrite(
    () => deleteDoc(doc(db, 'users', userId, 'movements', movementId)),
    OperationType.DELETE,
    path
  );
}

export async function saveSeasonReport(
  userId: string,
  input: {
    title: string;
    monthKey: string;
    monthLabel: string;
    toCityCount: number;
    toRanchCount: number;
    totalMovements: number;
    completedTripsCount: number;
    citySnapshotCount: number;
    ranchSnapshotCount: number;
    bagSnapshotCount: number;
    topMovedNames: string[];
    movedSummaryLines: string[];
    notes: string;
  }
): Promise<string> {
  const title = clampString(input.title, LIMITS.SEASON_TITLE_MAX);
  if (!title) {
    throw new Error('El título de la temporada es obligatorio.');
  }
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) {
    throw new Error('El mes seleccionado no es válido.');
  }
  const monthLabel =
    clampString(input.monthLabel, LIMITS.MONTH_LABEL_MAX) || input.monthKey;

  const topMovedNames = input.topMovedNames
    .map((s) => clampString(s, 100))
    .filter((s) => s.length > 0)
    .slice(0, LIMITS.TOP_MOVED_MAX);

  const movedSummaryLines = input.movedSummaryLines
    .map((s) => clampString(s, LIMITS.SUMMARY_LINE_LEN))
    .filter((s) => s.length > 0)
    .slice(0, LIMITS.SUMMARY_LINES_MAX);

  const seasonRef = doc(collection(db, 'users', userId, 'seasons'));
  const path = `users/${userId}/seasons/${seasonRef.id}`;

  await runOfflineSafeWrite(
    () =>
      setDoc(seasonRef, {
        ownerId: userId,
        title,
        monthKey: input.monthKey,
        monthLabel,
        toCityCount: clampNonNegativeInt(input.toCityCount, 10000),
        toRanchCount: clampNonNegativeInt(input.toRanchCount, 10000),
        totalMovements: clampNonNegativeInt(input.totalMovements, 10000),
        completedTripsCount: clampNonNegativeInt(
          input.completedTripsCount,
          1000
        ),
        citySnapshotCount: clampNonNegativeInt(input.citySnapshotCount, 10000),
        ranchSnapshotCount: clampNonNegativeInt(
          input.ranchSnapshotCount,
          10000
        ),
        bagSnapshotCount: clampNonNegativeInt(input.bagSnapshotCount, 10000),
        topMovedNames,
        movedSummaryLines,
        notes: clampString(input.notes, LIMITS.NOTES_MAX),
        createdAt: serverTimestamp(),
      }),
    OperationType.CREATE,
    path
  );

  return seasonRef.id;
}

export async function deleteSeasonReport(
  userId: string,
  seasonId: string
): Promise<void> {
  const path = `users/${userId}/seasons/${seasonId}`;
  await runOfflineSafeWrite(
    () => deleteDoc(doc(db, 'users', userId, 'seasons', seasonId)),
    OperationType.DELETE,
    path
  );
}
