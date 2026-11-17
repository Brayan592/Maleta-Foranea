import { useMemo, useState } from 'react';
import { ArrowRight, History, Trash2 } from 'lucide-react';
import type {
  Garment,
  Movement,
  SeasonReport,
  Trip,
  UserProfile,
} from '../types';
import {
  formatShortDate,
  getLocationLabel,
  getLocationTextClass,
} from './LocationHelpers';
import { SeasonReportView } from './SeasonReportView';

export type HistorySubTab = 'movimientos' | 'temporada';

interface HistoryViewProps {
  movements: Movement[];
  trips: Trip[];
  garments: Garment[];
  seasons: SeasonReport[];
  profile: UserProfile | null;
  subTab: HistorySubTab;
  onChangeSubTab: (tab: HistorySubTab) => void;
  onDeleteMovement: (movementId: string) => Promise<void>;
  onSaveSeason: (input: {
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
  }) => Promise<string>;
  onDeleteSeason: (seasonId: string) => Promise<void>;
}

export function HistoryView({
  movements,
  trips,
  garments,
  seasons,
  profile,
  subTab,
  onChangeSubTab,
  onDeleteMovement,
  onSaveSeason,
  onDeleteSeason,
}: HistoryViewProps) {
  const [directionFilter, setDirectionFilter] = useState<
    'todos' | 'ciudad' | 'rancho'
  >('todos');

  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const filtered = useMemo(() => {
    if (directionFilter === 'todos') return movements;
    return movements.filter((m) => m.toLocation === directionFilter);
  }, [movements, directionFilter]);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Historial y Temporadas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Consulta cada movimiento de ropa o genera un reporte mensual
            exportable de Temporada.
          </p>
        </div>

        <div className="glass-track flex items-center gap-1 p-1 rounded-xl self-start">
          <button
            type="button"
            onClick={() => onChangeSubTab('movimientos')}
            className={`px-3.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'movimientos'
                ? 'bg-white/90 text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Movimientos
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab('temporada')}
            className={`px-3.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'temporada'
                ? 'bg-white/90 text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reporte Mensual y Temporada
          </button>
        </div>
      </div>

      {subTab === 'temporada' ? (
        <SeasonReportView
          movements={movements}
          trips={trips}
          garments={garments}
          seasons={seasons}
          profile={profile}
          onSaveSeason={onSaveSeason}
          onDeleteSeason={onDeleteSeason}
        />
      ) : (
        <div className="space-y-4">
          <div className="glass-track flex items-center gap-1 p-1 rounded-xl w-fit">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'ciudad', label: `Hacia ${cityLabel}` },
                { id: 'rancho', label: `Hacia ${ranchLabel}` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDirectionFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  directionFilter === tab.id
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center space-y-2">
              <History className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-medium text-slate-900">
                Sin movimientos registrados todavía
              </p>
              <p className="text-xs text-slate-600">
                Cada vez que muevas una prenda o desempaques una maleta
                aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl divide-y divide-white/60 overflow-hidden">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/40 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {m.garmentName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                      <span
                        className={`font-medium ${getLocationTextClass(m.fromLocation)}`}
                      >
                        {getLocationLabel(m.fromLocation, profile)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span
                        className={`font-medium ${getLocationTextClass(m.toLocation)}`}
                      >
                        {getLocationLabel(m.toLocation, profile)}
                      </span>
                      {m.tripTitle && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{m.tripTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                      {formatShortDate(m.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteMovement(m.id)}
                      aria-label="Eliminar registro"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-rose-700 rounded-xl hover:bg-rose-50/70 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
