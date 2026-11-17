import { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { CloudOff, RefreshCw } from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isIndexedDbPersistenceActive,
  OperationType,
} from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar, type AppTab } from './components/TopBar';
import { WelcomeLanding } from './components/WelcomeLanding';
import { InventoryView } from './components/InventoryView';
import { TripsView } from './components/TripsView';
import { StatsView } from './components/StatsView';
import { EssentialsAndLaundryView } from './components/EssentialsAndLaundryView';
import { HistoryView, type HistorySubTab } from './components/HistoryView';
import { GarmentModal } from './components/GarmentModal';
import { timestampToMillis } from './components/LocationHelpers';
import {
  loadOfflineSnapshot,
  saveOfflineSnapshot,
} from './services/offlineCache';
import {
  addGarment,
  addGarmentToTrip,
  completeTripAndUnpack,
  createTrip,
  deleteGarment,
  deleteMovement,
  deleteSeasonReport,
  deleteTrip,
  ensureUserProfile,
  moveGarmentDirect,
  removeGarmentFromTrip,
  saveSeasonReport,
  seedStarterWardrobe,
  syncPendingWrites,
  toggleLaundryStatus,
  toggleTripPackedItem,
  updateGarment,
  updateLocationLabels,
} from './services/wardrobeService';
import type {
  Garment,
  GarmentFormValues,
  Movement,
  SeasonReport,
  Trip,
  TripEndpoint,
  UserProfile,
} from './types';

function WardrobeApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastBackupIso, setLastBackupIso] = useState<string | null>(null);
  const [pendingGarmentIds, setPendingGarmentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [seasons, setSeasons] = useState<SeasonReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<AppTab>('inventario');
  const [historySubTab, setHistorySubTab] =
    useState<HistorySubTab>('movimientos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null);
  const [prefilledTripDraft, setPrefilledTripDraft] = useState<{
    itemIds: string[];
    origin: TripEndpoint;
  } | null>(null);

  // Track latest snapshot state for clean IndexedDB mirror persistence
  const snapshotRef = useRef<{
    profile: UserProfile | null;
    garments: Garment[];
    trips: Trip[];
    movements: Movement[];
    seasons: SeasonReport[];
  }>({
    profile: null,
    garments: [],
    trips: [],
    movements: [],
    seasons: [],
  });

  const pendingSourcesRef = useRef({
    profile: false,
    garments: false,
    trips: false,
    movements: false,
    seasons: false,
  });

  const syncPendingFlag = () => {
    const p = pendingSourcesRef.current;
    setHasPendingSync(
      p.profile || p.garments || p.trips || p.movements || p.seasons
    );
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        // Hydrate instantaneously from custom IndexedDB mirror before network/Firestore warms up
        const cached = await loadOfflineSnapshot(nextUser.uid);
        if (cached) {
          setProfile(cached.profile);
          setGarments(cached.garments);
          setTrips(cached.trips);
          setMovements(cached.movements);
          setSeasons(cached.seasons);
          setLastBackupIso(cached.savedAtIso);
          snapshotRef.current = {
            profile: cached.profile,
            garments: cached.garments,
            trips: cached.trips,
            movements: cached.movements,
            seasons: cached.seasons,
          };
          setDataLoading(false);
        }

        try {
          await ensureUserProfile(nextUser);
        } catch (err) {
          console.error('Error ensuring user profile:', err);
        }
      } else {
        setProfile(null);
        setGarments([]);
        setTrips([]);
        setMovements([]);
        setSeasons([]);
        snapshotRef.current = {
          profile: null,
          garments: [],
          trips: [],
          movements: [],
          seasons: [],
        };
        pendingSourcesRef.current = {
          profile: false,
          garments: false,
          trips: false,
          movements: false,
          seasons: false,
        };
        setPendingGarmentIds(new Set());
        setHasPendingSync(false);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const persistMirror = () => {
      const nowIso = new Date().toISOString();
      setLastBackupIso(nowIso);
      void saveOfflineSnapshot({
        userId: uid,
        ...snapshotRef.current,
      });
    };

    const userPath = `users/${uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          const nextProfile = snap.data() as UserProfile;
          setProfile(nextProfile);
          snapshotRef.current.profile = nextProfile;
          persistMirror();
        }
        pendingSourcesRef.current.profile = snap.metadata.hasPendingWrites;
        syncPendingFlag();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const garmentsPath = `users/${uid}/garments`;
    const garmentsQuery = query(
      collection(db, 'users', uid, 'garments'),
      where('ownerId', '==', uid)
    );
    const unsubGarments = onSnapshot(
      garmentsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const nextPending = new Set<string>();
        const list: Garment[] = snap.docs.map((d) => {
          if (d.metadata.hasPendingWrites) {
            nextPending.add(d.id);
          }
          return {
            id: d.id,
            ...(d.data() as Omit<Garment, 'id'>),
          };
        });
        list.sort(
          (a, b) =>
            timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt)
        );
        setGarments(list);
        setPendingGarmentIds(nextPending);
        pendingSourcesRef.current.garments =
          snap.metadata.hasPendingWrites || nextPending.size > 0;
        syncPendingFlag();
        snapshotRef.current.garments = list;
        setDataLoading(false);
        persistMirror();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, garmentsPath);
      }
    );

    const tripsPath = `users/${uid}/trips`;
    const tripsQuery = query(
      collection(db, 'users', uid, 'trips'),
      where('ownerId', '==', uid)
    );
    const unsubTrips = onSnapshot(
      tripsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const list: Trip[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Trip, 'id'>),
        }));
        list.sort(
          (a, b) =>
            timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
        );
        setTrips(list);
        pendingSourcesRef.current.trips = snap.metadata.hasPendingWrites;
        syncPendingFlag();
        snapshotRef.current.trips = list;
        persistMirror();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, tripsPath);
      }
    );

    const movementsPath = `users/${uid}/movements`;
    const movementsQuery = query(
      collection(db, 'users', uid, 'movements'),
      where('ownerId', '==', uid)
    );
    const unsubMovements = onSnapshot(
      movementsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const list: Movement[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Movement, 'id'>),
        }));
        list.sort(
          (a, b) =>
            timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
        );
        setMovements(list);
        pendingSourcesRef.current.movements = snap.metadata.hasPendingWrites;
        syncPendingFlag();
        snapshotRef.current.movements = list;
        persistMirror();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, movementsPath);
      }
    );

    const seasonsPath = `users/${uid}/seasons`;
    const seasonsQuery = query(
      collection(db, 'users', uid, 'seasons'),
      where('ownerId', '==', uid)
    );
    const unsubSeasons = onSnapshot(
      seasonsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const list: SeasonReport[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SeasonReport, 'id'>),
        }));
        list.sort(
          (a, b) =>
            timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
        );
        setSeasons(list);
        pendingSourcesRef.current.seasons = snap.metadata.hasPendingWrites;
        syncPendingFlag();
        snapshotRef.current.seasons = list;
        persistMirror();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, seasonsPath);
      }
    );

    return () => {
      unsubProfile();
      unsubGarments();
      unsubTrips();
      unsubMovements();
      unsubSeasons();
    };
  }, [authReady, user]);

  const garmentsById = useMemo(() => {
    const map = new Map<string, Garment>();
    for (const g of garments) map.set(g.id, g);
    return map;
  }, [garments]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(
          'No pudimos abrir el inicio de sesión con Google. Revisa si tu navegador bloqueó la ventana emergente.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveTab('inventario');
  };

  const handleSaveGarment = async (
    values: GarmentFormValues,
    existing: Garment | null
  ) => {
    if (!user) return;
    if (existing) {
      await updateGarment(user.uid, existing.id, values, existing.tripId);
    } else {
      await addGarment(user.uid, values);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel rounded-2xl px-6 py-4">
          <p className="text-sm text-slate-700 font-medium">
            Cargando tu maleta...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isAuthenticated={Boolean(user)}
        isSigningIn={isSigningIn}
        onPrimaryAction={() => {
          if (user) {
            setEditingGarment(null);
            setModalOpen(true);
          } else {
            void handleSignIn();
          }
        }}
      />

      {!user ? (
        <main className="flex-1">
          <WelcomeLanding
            onSignIn={handleSignIn}
            isSigningIn={isSigningIn}
            authError={authError}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
          {/* Authentic Offline / Pending-Sync Notice (shown ONLY when offline or syncing local changes) */}
          {(!isOnline || hasPendingSync) && (
            <div
              role="status"
              className="no-print glass-panel rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-amber-200/80"
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-800">
                {!isOnline ? (
                  <>
                    <CloudOff className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong className="font-semibold">
                        Modo sin conexión (en tránsito):
                      </strong>{' '}
                      puedes consultar, agregar y mover prendas. Todo se guarda
                      en IndexedDB y se sincronizará al volver la señal.
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
                    <span>
                      Sincronizando cambios locales guardados en tránsito con la
                      nube...
                    </span>
                  </>
                )}
              </div>
              {pendingGarmentIds.size > 0 && (
                <span className="text-xs font-mono-tabular font-semibold text-amber-800 whitespace-nowrap pl-6 sm:pl-0">
                  {pendingGarmentIds.size}{' '}
                  {pendingGarmentIds.size === 1
                    ? 'prenda en cola'
                    : 'prendas en cola'}
                </span>
              )}
            </div>
          )}

          {activeTab === 'inventario' && (
            <InventoryView
              garments={garments}
              profile={profile}
              loading={dataLoading}
              pendingIds={pendingGarmentIds}
              onAddNew={() => {
                setEditingGarment(null);
                setModalOpen(true);
              }}
              onEdit={(garment) => {
                setEditingGarment(garment);
                setModalOpen(true);
              }}
              onMoveDirect={(g, dest) => moveGarmentDirect(user.uid, g, dest)}
              onToggleLaundry={(g) => toggleLaundryStatus(user.uid, g)}
              onDelete={(id) => deleteGarment(user.uid, id)}
              onSeedStarter={() => seedStarterWardrobe(user.uid)}
              onStartTripWithItems={(itemIds, origin) => {
                setPrefilledTripDraft({ itemIds, origin });
                setActiveTab('maletas');
              }}
            />
          )}

          {activeTab === 'maletas' && (
            <TripsView
              trips={trips}
              garments={garments}
              profile={profile}
              prefilledTripDraft={prefilledTripDraft}
              onClearPrefill={() => setPrefilledTripDraft(null)}
              onCreateTrip={(input) => createTrip(user.uid, input)}
              onAddGarmentToTrip={(trip, garmentId) =>
                addGarmentToTrip(user.uid, trip, garmentId)
              }
              onRemoveGarmentFromTrip={(trip, garment) =>
                removeGarmentFromTrip(user.uid, trip, garment)
              }
              onTogglePacked={(trip, garment) =>
                toggleTripPackedItem(user.uid, trip, garment)
              }
              onCompleteTrip={(trip) =>
                completeTripAndUnpack(user.uid, trip, garmentsById)
              }
              onDeleteTrip={(trip) => deleteTrip(user.uid, trip, garments)}
            />
          )}

          {activeTab === 'estadisticas' && (
            <StatsView
              garments={garments}
              trips={trips}
              movements={movements}
              profile={profile}
              onAddNew={() => {
                setEditingGarment(null);
                setModalOpen(true);
              }}
              onOpenSeasonReport={() => {
                setHistorySubTab('temporada');
                setActiveTab('historial');
              }}
            />
          )}

          {activeTab === 'pendientes' && (
            <EssentialsAndLaundryView
              garments={garments}
              profile={profile}
              userEmail={user.email || ''}
              isOnline={isOnline}
              indexedDbActive={isIndexedDbPersistenceActive}
              pendingSyncCount={pendingGarmentIds.size}
              lastBackupIso={lastBackupIso}
              onSyncNow={syncPendingWrites}
              onMoveDirect={(g, dest) => moveGarmentDirect(user.uid, g, dest)}
              onToggleLaundry={(g) => toggleLaundryStatus(user.uid, g)}
              onSaveLabels={(cityLabel, ranchLabel) =>
                updateLocationLabels(user.uid, cityLabel, ranchLabel)
              }
              onSignOut={handleSignOut}
            />
          )}

          {activeTab === 'historial' && (
            <HistoryView
              movements={movements}
              trips={trips}
              garments={garments}
              seasons={seasons}
              profile={profile}
              subTab={historySubTab}
              onChangeSubTab={setHistorySubTab}
              onDeleteMovement={(id) => deleteMovement(user.uid, id)}
              onSaveSeason={(input) => saveSeasonReport(user.uid, input)}
              onDeleteSeason={(id) => deleteSeasonReport(user.uid, id)}
            />
          )}
        </main>
      )}

      <GarmentModal
        isOpen={modalOpen}
        editingGarment={editingGarment}
        profile={profile}
        onClose={() => {
          setModalOpen(false);
          setEditingGarment(null);
        }}
        onSave={handleSaveGarment}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WardrobeApp />
    </ErrorBoundary>
  );
}
