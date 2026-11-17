import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar, type AppTab } from './components/TopBar';
import { InventoryView } from './components/InventoryView';
import { TripsView } from './components/TripsView';
import { StatsView } from './components/StatsView';
import { EssentialsAndLaundryView } from './components/EssentialsAndLaundryView';
import { HistoryView, type HistorySubTab } from './components/HistoryView';
import { GarmentModal } from './components/GarmentModal';
import {
  createEmptyWardrobeState,
  loadLocalDatabase,
  parseImportedBackup,
  saveLocalDatabase,
  type LocalStorageEngine,
  type LocalWardrobeState,
} from './services/localDatabase';
import {
  addGarment,
  addGarmentToTrip,
  completeTripAndUnpack,
  createTrip,
  deleteGarment,
  deleteMovement,
  deleteSeasonReport,
  deleteTrip,
  moveGarmentDirect,
  removeGarmentFromTrip,
  saveSeasonReport,
  seedStarterWardrobe,
  toggleLaundryStatus,
  toggleTripPackedItem,
  updateGarment,
  updateLocationLabels,
} from './services/wardrobeService';
import type {
  Garment,
  GarmentFormValues,
  TripEndpoint,
} from './types';

function WardrobeApp() {
  const [wardrobeState, setWardrobeState] = useState<LocalWardrobeState>(() =>
    createEmptyWardrobeState()
  );
  const [storageEngine, setStorageEngine] =
    useState<LocalStorageEngine>('indexeddb');
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

  const stateRef = useRef<LocalWardrobeState>(wardrobeState);
  stateRef.current = wardrobeState;

  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadLocalDatabase()
      .then(({ state, engine }) => {
        if (!active) return;
        stateRef.current = state;
        setWardrobeState(state);
        setStorageEngine(engine);
        setDataLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setStorageEngine('memory');
        setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const commitTransition = useCallback(
    async <T,>(
      updater: (current: LocalWardrobeState) => {
        nextState: LocalWardrobeState;
        result: T;
      }
    ): Promise<T> => {
      const { nextState, result } = updater(stateRef.current);
      const stampedState: LocalWardrobeState = {
        ...nextState,
        updatedAtIso: new Date().toISOString(),
      };
      stateRef.current = stampedState;
      setWardrobeState(stampedState);

      const writeOp = writeQueueRef.current.then(async () => {
        const engine = await saveLocalDatabase(stampedState);
        setStorageEngine(engine);
      });
      writeQueueRef.current = writeOp.catch(() => undefined);
      await writeOp;
      return result;
    },
    []
  );

  const commitState = useCallback(
    async (
      updater: (current: LocalWardrobeState) => LocalWardrobeState
    ): Promise<void> => {
      await commitTransition((current) => ({
        nextState: updater(current),
        result: undefined,
      }));
    },
    [commitTransition]
  );

  const handleSaveGarment = async (
    values: GarmentFormValues,
    existing: Garment | null
  ) => {
    if (existing) {
      await commitState((s) =>
        updateGarment(s, existing.id, values, existing.tripId)
      );
    } else {
      await commitTransition((s) => {
        const { nextState, garmentId } = addGarment(s, values);
        return { nextState, result: garmentId };
      });
    }
  };

  const handleExportBackup = () => {
    const payload = JSON.stringify(stateRef.current, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maleta-foranea-respaldo-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (jsonText: string) => {
    const parsed = parseImportedBackup(jsonText);
    await commitState(() => parsed);
  };

  const { profile, garments, trips, movements, seasons, updatedAtIso } =
    wardrobeState;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrimaryAction={() => {
          setEditingGarment(null);
          setModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12 space-y-6">
        {activeTab === 'inventario' && (
          <InventoryView
            garments={garments}
            profile={profile}
            loading={dataLoading}
            onAddNew={() => {
              setEditingGarment(null);
              setModalOpen(true);
            }}
            onEdit={(garment) => {
              setEditingGarment(garment);
              setModalOpen(true);
            }}
            onMoveDirect={(g, dest) =>
              commitState((s) => moveGarmentDirect(s, g, dest))
            }
            onToggleLaundry={(g) =>
              commitState((s) => toggleLaundryStatus(s, g))
            }
            onDelete={(id) => commitState((s) => deleteGarment(s, id))}
            onSeedStarter={() => commitState((s) => seedStarterWardrobe(s))}
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
            onCreateTrip={(input) =>
              commitTransition((s) => {
                const { nextState, tripId } = createTrip(s, input);
                return { nextState, result: tripId };
              })
            }
            onAddGarmentToTrip={(trip, garmentId) =>
              commitState((s) => addGarmentToTrip(s, trip, garmentId))
            }
            onRemoveGarmentFromTrip={(trip, garment) =>
              commitState((s) => removeGarmentFromTrip(s, trip, garment))
            }
            onTogglePacked={(trip, garment) =>
              commitState((s) => toggleTripPackedItem(s, trip, garment))
            }
            onCompleteTrip={(trip) =>
              commitTransition((s) => {
                const { nextState, movedCount } = completeTripAndUnpack(s, trip);
                return { nextState, result: movedCount };
              })
            }
            onDeleteTrip={(trip) => commitState((s) => deleteTrip(s, trip))}
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
            storageEngine={storageEngine}
            tripsCount={trips.length}
            movementsCount={movements.length}
            seasonsCount={seasons.length}
            lastSavedIso={updatedAtIso}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onMoveDirect={(g, dest) =>
              commitState((s) => moveGarmentDirect(s, g, dest))
            }
            onToggleLaundry={(g) =>
              commitState((s) => toggleLaundryStatus(s, g))
            }
            onSaveLabels={(cityLabel, ranchLabel) =>
              commitState((s) => updateLocationLabels(s, cityLabel, ranchLabel))
            }
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
            onDeleteMovement={(id) =>
              commitState((s) => deleteMovement(s, id))
            }
            onSaveSeason={(input) =>
              commitTransition((s) => {
                const { nextState, seasonId } = saveSeasonReport(s, input);
                return { nextState, result: seasonId };
              })
            }
            onDeleteSeason={(id) =>
              commitState((s) => deleteSeasonReport(s, id))
            }
          />
        )}
      </main>

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
