import {
  LIMITS,
  STARTER_GARMENTS,
  type Garment,
  type GarmentFormValues,
  type GarmentLocation,
  type LaundryStatus,
  type Movement,
  type SeasonReport,
  type TargetLocation,
  type Trip,
  type TripEndpoint,
} from '../types';
import { timestampToMillis } from '../components/LocationHelpers';
import type { LocalWardrobeState } from './localDatabase';

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

function createLocalId(prefix = 'id'): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sortByUpdatedDesc(garments: Garment[]): Garment[] {
  return [...garments].sort(
    (a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt)
  );
}

function sortByCreatedDesc<T extends { createdAt: Garment['createdAt'] }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
  );
}

export function updateLocationLabels(
  state: LocalWardrobeState,
  cityLabel: string,
  ranchLabel: string
): LocalWardrobeState {
  const cleanCity =
    clampString(cityLabel, LIMITS.CITY_RANCH_LABEL_MAX) || 'La Ciudad';
  const cleanRanch =
    clampString(ranchLabel, LIMITS.CITY_RANCH_LABEL_MAX) || 'El Rancho';

  return {
    ...state,
    profile: {
      ...state.profile,
      cityLabel: cleanCity,
      ranchLabel: cleanRanch,
      updatedAt: Date.now(),
    },
  };
}

export function addGarment(
  state: LocalWardrobeState,
  values: GarmentFormValues
): { nextState: LocalWardrobeState; garmentId: string } {
  const name = clampString(values.name, LIMITS.NAME_MAX);
  if (!name) {
    throw new Error('El nombre de la prenda es obligatorio.');
  }

  const now = Date.now();
  const garmentId = createLocalId('g');
  const newGarment: Garment = {
    id: garmentId,
    ownerId: state.profile.uid || 'local-user',
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
    createdAt: now,
    updatedAt: now,
  };

  return {
    garmentId,
    nextState: {
      ...state,
      garments: sortByUpdatedDesc([newGarment, ...state.garments]),
    },
  };
}

export function updateGarment(
  state: LocalWardrobeState,
  garmentId: string,
  values: GarmentFormValues,
  tripId: string
): LocalWardrobeState {
  const name = clampString(values.name, LIMITS.NAME_MAX);
  if (!name) {
    throw new Error('El nombre de la prenda es obligatorio.');
  }
  const cleanTarget: TargetLocation =
    values.location === 'maleta' ? values.targetLocation : 'ninguno';
  const now = Date.now();

  const nextGarments = state.garments.map((g) => {
    if (g.id !== garmentId) return g;
    return {
      ...g,
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
      updatedAt: now,
    };
  });

  return {
    ...state,
    garments: sortByUpdatedDesc(nextGarments),
  };
}

export function moveGarmentDirect(
  state: LocalWardrobeState,
  garment: Garment,
  toLocation: GarmentLocation,
  tripTitle = 'Traslado directo'
): LocalWardrobeState {
  if (garment.location === toLocation) return state;
  const now = Date.now();

  const nextGarments = state.garments.map((g) => {
    if (g.id !== garment.id) return g;
    return {
      ...g,
      location: toLocation,
      targetLocation: 'ninguno' as TargetLocation,
      tripId: '',
      updatedAt: now,
    };
  });

  const movement: Movement = {
    id: createLocalId('mov'),
    ownerId: state.profile.uid || 'local-user',
    garmentId: garment.id,
    garmentName: clampString(garment.name, LIMITS.NAME_MAX),
    fromLocation: garment.location,
    toLocation,
    tripTitle: clampString(tripTitle, LIMITS.TRIP_TITLE_MAX),
    createdAt: now,
  };

  return {
    ...state,
    garments: sortByUpdatedDesc(nextGarments),
    movements: sortByCreatedDesc([movement, ...state.movements]),
  };
}

export function toggleLaundryStatus(
  state: LocalWardrobeState,
  garment: Garment
): LocalWardrobeState {
  const nextStatus: LaundryStatus =
    garment.laundryStatus === 'limpia' ? 'por_lavar' : 'limpia';
  const now = Date.now();

  const nextGarments = state.garments.map((g) =>
    g.id === garment.id
      ? {
          ...g,
          laundryStatus: nextStatus,
          updatedAt: now,
        }
      : g
  );

  return {
    ...state,
    garments: sortByUpdatedDesc(nextGarments),
  };
}

export function deleteGarment(
  state: LocalWardrobeState,
  garmentId: string
): LocalWardrobeState {
  const now = Date.now();
  const nextGarments = state.garments.filter((g) => g.id !== garmentId);
  const nextTrips = state.trips.map((trip) => {
    if (trip.status === 'completado') return trip;
    if (!trip.itemIds.includes(garmentId) && !trip.packedIds.includes(garmentId)) {
      return trip;
    }
    const nextItems = trip.itemIds.filter((id) => id !== garmentId);
    const nextPacked = trip.packedIds.filter((id) => id !== garmentId);
    return {
      ...trip,
      itemIds: nextItems,
      packedIds: nextPacked,
      status: nextPacked.length > 0 ? ('en_camino' as const) : ('planeando' as const),
      updatedAt: now,
    };
  });

  return {
    ...state,
    garments: nextGarments,
    trips: nextTrips,
  };
}

export function seedStarterWardrobe(
  state: LocalWardrobeState
): LocalWardrobeState {
  const baseTime = Date.now();
  const ownerId = state.profile.uid || 'local-user';
  const starterItems: Garment[] = STARTER_GARMENTS.map((item, idx) => ({
    id: createLocalId(`seed_${idx}`),
    ownerId,
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
    createdAt: baseTime - idx,
    updatedAt: baseTime - idx,
  }));

  return {
    ...state,
    garments: sortByUpdatedDesc([...starterItems, ...state.garments]),
  };
}

export function createTrip(
  state: LocalWardrobeState,
  input: {
    title: string;
    origin: TripEndpoint;
    destination: TripEndpoint;
    travelDate: string;
    notes: string;
    initialItemIds?: string[];
  }
): { nextState: LocalWardrobeState; tripId: string } {
  if (input.origin === input.destination) {
    throw new Error('El origen y el destino del viaje deben ser distintos.');
  }
  const title = clampString(input.title, LIMITS.TRIP_TITLE_MAX);
  if (!title) {
    throw new Error('El título del viaje es obligatorio.');
  }

  const now = Date.now();
  const tripId = createLocalId('trip');
  const cleanItems = (input.initialItemIds || []).slice(
    0,
    LIMITS.TRIP_ITEMS_MAX
  );

  const newTrip: Trip = {
    id: tripId,
    ownerId: state.profile.uid || 'local-user',
    title,
    origin: input.origin,
    destination: input.destination,
    status: 'planeando',
    travelDate: clampString(input.travelDate, LIMITS.TRAVEL_DATE_MAX),
    itemIds: cleanItems,
    packedIds: [],
    notes: clampString(input.notes, LIMITS.NOTES_MAX),
    createdAt: now,
    updatedAt: now,
  };

  return {
    tripId,
    nextState: {
      ...state,
      trips: sortByCreatedDesc([newTrip, ...state.trips]),
    },
  };
}

export function addGarmentToTrip(
  state: LocalWardrobeState,
  trip: Trip,
  garmentId: string
): LocalWardrobeState {
  if (trip.status === 'completado') return state;
  if (trip.itemIds.includes(garmentId)) return state;
  if (trip.itemIds.length >= LIMITS.TRIP_ITEMS_MAX) {
    throw new Error(`Máximo ${LIMITS.TRIP_ITEMS_MAX} prendas por maleta.`);
  }

  const now = Date.now();
  const nextTrips = state.trips.map((t) =>
    t.id === trip.id
      ? {
          ...t,
          itemIds: [...t.itemIds, garmentId],
          updatedAt: now,
        }
      : t
  );

  return {
    ...state,
    trips: nextTrips,
  };
}

export function removeGarmentFromTrip(
  state: LocalWardrobeState,
  trip: Trip,
  garment: Garment
): LocalWardrobeState {
  if (trip.status === 'completado') return state;
  const now = Date.now();

  const nextTrips = state.trips.map((t) => {
    if (t.id !== trip.id) return t;
    const nextItems = t.itemIds.filter((id) => id !== garment.id);
    const nextPacked = t.packedIds.filter((id) => id !== garment.id);
    return {
      ...t,
      itemIds: nextItems,
      packedIds: nextPacked,
      status: nextPacked.length > 0 ? ('en_camino' as const) : ('planeando' as const),
      updatedAt: now,
    };
  });

  const shouldRestoreGarment =
    garment.location === 'maleta' && garment.tripId === trip.id;

  const nextGarments = shouldRestoreGarment
    ? sortByUpdatedDesc(
        state.garments.map((g) =>
          g.id === garment.id
            ? {
                ...g,
                location: trip.origin,
                targetLocation: 'ninguno' as TargetLocation,
                tripId: '',
                updatedAt: now,
              }
            : g
        )
      )
    : state.garments;

  return {
    ...state,
    trips: nextTrips,
    garments: nextGarments,
  };
}

export function toggleTripPackedItem(
  state: LocalWardrobeState,
  trip: Trip,
  garment: Garment
): LocalWardrobeState {
  if (trip.status === 'completado') return state;
  const now = Date.now();
  const isCurrentlyPacked = trip.packedIds.includes(garment.id);

  const nextTrips = state.trips.map((t) => {
    if (t.id !== trip.id) return t;
    const nextPacked = isCurrentlyPacked
      ? t.packedIds.filter((id) => id !== garment.id)
      : [...t.packedIds, garment.id].slice(0, LIMITS.TRIP_ITEMS_MAX);

    const nextItems = t.itemIds.includes(garment.id)
      ? t.itemIds
      : [...t.itemIds, garment.id].slice(0, LIMITS.TRIP_ITEMS_MAX);

    return {
      ...t,
      itemIds: nextItems,
      packedIds: nextPacked,
      status: nextPacked.length > 0 ? ('en_camino' as const) : ('planeando' as const),
      updatedAt: now,
    };
  });

  const nextGarments = sortByUpdatedDesc(
    state.garments.map((g) => {
      if (g.id !== garment.id) return g;
      if (!isCurrentlyPacked) {
        return {
          ...g,
          location: 'maleta' as GarmentLocation,
          targetLocation: trip.destination,
          tripId: trip.id,
          updatedAt: now,
        };
      }
      return {
        ...g,
        location: trip.origin,
        targetLocation: 'ninguno' as TargetLocation,
        tripId: '',
        updatedAt: now,
      };
    })
  );

  return {
    ...state,
    trips: nextTrips,
    garments: nextGarments,
  };
}

export function completeTripAndUnpack(
  state: LocalWardrobeState,
  trip: Trip
): { nextState: LocalWardrobeState; movedCount: number } {
  if (trip.status === 'completado') {
    return { nextState: state, movedCount: 0 };
  }

  const now = Date.now();
  const idsToMove = trip.packedIds.length > 0 ? trip.packedIds : trip.itemIds;
  const moveSet = new Set(idsToMove);
  const ownerId = state.profile.uid || 'local-user';

  const nextTrips = state.trips.map((t) =>
    t.id === trip.id
      ? {
          ...t,
          status: 'completado' as const,
          packedIds: idsToMove,
          updatedAt: now,
        }
      : t
  );

  const newMovements: Movement[] = [];
  let movedCount = 0;

  const nextGarments = state.garments.map((g) => {
    if (!moveSet.has(g.id)) return g;
    movedCount += 1;
    newMovements.push({
      id: createLocalId(`mov_${movedCount}`),
      ownerId,
      garmentId: g.id,
      garmentName: clampString(g.name, LIMITS.NAME_MAX),
      fromLocation: trip.origin,
      toLocation: trip.destination,
      tripTitle: clampString(trip.title, LIMITS.TRIP_TITLE_MAX),
      createdAt: now + movedCount,
    });
    return {
      ...g,
      location: trip.destination,
      targetLocation: 'ninguno' as TargetLocation,
      tripId: '',
      updatedAt: now,
    };
  });

  return {
    movedCount,
    nextState: {
      ...state,
      trips: nextTrips,
      garments: sortByUpdatedDesc(nextGarments),
      movements: sortByCreatedDesc([...newMovements, ...state.movements]),
    },
  };
}

export function deleteTrip(
  state: LocalWardrobeState,
  trip: Trip
): LocalWardrobeState {
  const now = Date.now();
  const nextTrips = state.trips.filter((t) => t.id !== trip.id);
  const nextGarments = sortByUpdatedDesc(
    state.garments.map((g) => {
      if (g.location === 'maleta' && g.tripId === trip.id) {
        return {
          ...g,
          location: trip.origin,
          targetLocation: 'ninguno' as TargetLocation,
          tripId: '',
          updatedAt: now,
        };
      }
      return g;
    })
  );

  return {
    ...state,
    trips: nextTrips,
    garments: nextGarments,
  };
}

export function deleteMovement(
  state: LocalWardrobeState,
  movementId: string
): LocalWardrobeState {
  return {
    ...state,
    movements: state.movements.filter((m) => m.id !== movementId),
  };
}

export function saveSeasonReport(
  state: LocalWardrobeState,
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
): { nextState: LocalWardrobeState; seasonId: string } {
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

  const seasonId = createLocalId('season');
  const season: SeasonReport = {
    id: seasonId,
    ownerId: state.profile.uid || 'local-user',
    title,
    monthKey: input.monthKey,
    monthLabel,
    toCityCount: clampNonNegativeInt(input.toCityCount, 10000),
    toRanchCount: clampNonNegativeInt(input.toRanchCount, 10000),
    totalMovements: clampNonNegativeInt(input.totalMovements, 10000),
    completedTripsCount: clampNonNegativeInt(input.completedTripsCount, 1000),
    citySnapshotCount: clampNonNegativeInt(input.citySnapshotCount, 10000),
    ranchSnapshotCount: clampNonNegativeInt(input.ranchSnapshotCount, 10000),
    bagSnapshotCount: clampNonNegativeInt(input.bagSnapshotCount, 10000),
    topMovedNames,
    movedSummaryLines,
    notes: clampString(input.notes, LIMITS.NOTES_MAX),
    createdAt: Date.now(),
  };

  return {
    seasonId,
    nextState: {
      ...state,
      seasons: sortByCreatedDesc([season, ...state.seasons]),
    },
  };
}

export function deleteSeasonReport(
  state: LocalWardrobeState,
  seasonId: string
): LocalWardrobeState {
  return {
    ...state,
    seasons: state.seasons.filter((s) => s.id !== seasonId),
  };
}
