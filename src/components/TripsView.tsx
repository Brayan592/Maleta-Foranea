import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Luggage,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABEL_MAP,
  LIMITS,
  type Garment,
  type Trip,
  type TripEndpoint,
  type UserProfile,
} from '../types';
import { formatShortDate } from './LocationHelpers';

interface TripsViewProps {
  trips: Trip[];
  garments: Garment[];
  profile: UserProfile | null;
  prefilledTripDraft: { itemIds: string[]; origin: TripEndpoint } | null;
  onClearPrefill: () => void;
  onCreateTrip: (input: {
    title: string;
    origin: TripEndpoint;
    destination: TripEndpoint;
    travelDate: string;
    notes: string;
    initialItemIds?: string[];
  }) => Promise<string>;
  onAddGarmentToTrip: (trip: Trip, garmentId: string) => Promise<void>;
  onRemoveGarmentFromTrip: (trip: Trip, garment: Garment) => Promise<void>;
  onTogglePacked: (trip: Trip, garment: Garment) => Promise<void>;
  onCompleteTrip: (trip: Trip) => Promise<number>;
  onDeleteTrip: (trip: Trip) => Promise<void>;
}

export function TripsView({
  trips,
  garments,
  profile,
  prefilledTripDraft,
  onClearPrefill,
  onCreateTrip,
  onAddGarmentToTrip,
  onRemoveGarmentFromTrip,
  onTogglePacked,
  onCompleteTrip,
  onDeleteTrip,
}: TripsViewProps) {
  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const [showNewForm, setShowNewForm] = useState(false);
  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState<TripEndpoint>('ciudad');
  const [travelDate, setTravelDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const destination: TripEndpoint = origin === 'ciudad' ? 'rancho' : 'ciudad';

  useEffect(() => {
    if (prefilledTripDraft) {
      setOrigin(prefilledTripDraft.origin);
      setTitle(
        prefilledTripDraft.origin === 'ciudad'
          ? `Viaje a ${ranchLabel}`
          : `Regreso a ${cityLabel}`
      );
      setShowNewForm(true);
    }
  }, [prefilledTripDraft, cityLabel, ranchLabel]);

  const activeTrips = useMemo(
    () => trips.filter((t) => t.status !== 'completado'),
    [trips]
  );
  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === 'completado'),
    [trips]
  );

  const currentTrip = useMemo(() => {
    if (selectedTripId) {
      const found = trips.find((t) => t.id === selectedTripId);
      if (found) return found;
    }
    return activeTrips[0] || null;
  }, [selectedTripId, trips, activeTrips]);

  const garmentsById = useMemo(() => {
    const map = new Map<string, Garment>();
    for (const g of garments) {
      map.set(g.id, g);
    }
    return map;
  }, [garments]);

  const availableOriginGarments = useMemo(() => {
    if (!currentTrip) return [];
    return garments.filter(
      (g) =>
        g.location === currentTrip.origin &&
        !currentTrip.itemIds.includes(g.id)
    );
  }, [garments, currentTrip]);

  const tripItems = useMemo(() => {
    if (!currentTrip) return [];
    return currentTrip.itemIds
      .map((id) => garmentsById.get(id))
      .filter((g): g is Garment => Boolean(g));
  }, [currentTrip, garmentsById]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Escribe un título para tu viaje.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const newId = await onCreateTrip({
        title,
        origin,
        destination,
        travelDate,
        notes,
        initialItemIds: prefilledTripDraft?.itemIds,
      });
      setTitle('');
      setNotes('');
      setShowNewForm(false);
      onClearPrefill();
      setSelectedTripId(newId);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo crear el viaje.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (trip: Trip) => {
    setBusyAction(true);
    try {
      await onCompleteTrip(trip);
      setConfirmCompleteId(null);
    } finally {
      setBusyAction(false);
    }
  };

  const getEndpointLabel = (ep: TripEndpoint) =>
    ep === 'ciudad' ? cityLabel : ranchLabel;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Viajes y Maletas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Arma tu lista de equipaje, marca lo que ya metiste a la mochila y desempaca al llegar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowNewForm(!showNewForm);
            if (showNewForm) onClearPrefill();
          }}
          className="glass-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {showNewForm ? (
            <>
              <X className="w-4 h-4" />
              <span>Cerrar formulario</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Nueva maleta</span>
            </>
          )}
        </button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Preparar nuevo viaje
            </h2>
            {prefilledTripDraft && prefilledTripDraft.itemIds.length > 0 && (
              <span className="text-xs font-medium text-blue-700 font-mono-tabular">
                {prefilledTripDraft.itemIds.length} prendas preseleccionadas
              </span>
            )}
          </div>

          {formError && (
            <p className="text-sm text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label
                htmlFor="trip-title"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nombre del viaje
              </label>
              <input
                id="trip-title"
                type="text"
                required
                maxLength={LIMITS.TRIP_TITLE_MAX}
                placeholder={`Ej. Puente de noviembre a ${ranchLabel}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="trip-date"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Fecha de salida
              </label>
              <input
                id="trip-date"
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="glass-input w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              Dirección del viaje
            </span>
            <div className="glass-track grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-xl max-w-xl">
              <button
                type="button"
                onClick={() => setOrigin('ciudad')}
                className={`py-2.5 px-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  origin === 'ciudad'
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{cityLabel}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{ranchLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setOrigin('rancho')}
                className={`py-2.5 px-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  origin === 'rancho'
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{ranchLabel}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{cityLabel}</span>
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="trip-notes"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Notas del viaje (opcional)
            </label>
            <input
              id="trip-notes"
              type="text"
              maxLength={LIMITS.NOTES_MAX}
              placeholder="Ej. Llevo mochila chica porque voy en camión"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                onClearPrefill();
              }}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white/60 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="glass-btn-primary px-5 py-2.5 text-white text-sm font-medium rounded-xl cursor-pointer disabled:opacity-60"
            >
              {creating ? 'Creando...' : 'Crear maleta'}
            </button>
          </div>
        </form>
      )}

      {/* Active Trips Selector */}
      {activeTrips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeTrips.map((trip) => {
            const isSelected = currentTrip?.id === trip.id;
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => setSelectedTripId(trip.id)}
                className={`px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'glass-btn-primary text-white'
                    : 'glass-panel text-slate-800 hover:bg-white/80'
                }`}
              >
                {trip.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Trip Workspace */}
      {currentTrip && currentTrip.status !== 'completado' ? (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-600">
                <span>{getEndpointLabel(currentTrip.origin)}</span>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{getEndpointLabel(currentTrip.destination)}</span>
                {currentTrip.travelDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {currentTrip.travelDate}
                    </span>
                  </>
                )}
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {currentTrip.title}
              </h2>
              {currentTrip.notes && (
                <p className="text-sm text-slate-600">{currentTrip.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {confirmCompleteId === currentTrip.id ? (
                <div className="flex items-center gap-2 bg-emerald-50/90 backdrop-blur-md border border-emerald-200 rounded-xl p-1.5">
                  <span className="text-xs font-medium text-emerald-900 px-2">
                    ¿Llegaste a {getEndpointLabel(currentTrip.destination)}?
                  </span>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => handleComplete(currentTrip)}
                    className="px-3 py-1.5 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
                  >
                    Sí, desempacar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCompleteId(null)}
                    className="px-2 py-1.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={tripItems.length === 0 || busyAction}
                  onClick={() => setConfirmCompleteId(currentTrip.id)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-800/95 text-white text-sm font-medium rounded-xl hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirmar llegada a {getEndpointLabel(currentTrip.destination)}
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={busyAction}
                onClick={() => onDeleteTrip(currentTrip)}
                aria-label="Eliminar viaje"
                className="glass-subtle min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50/80 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Packing Checklist */}
            <div className="lg:col-span-7 glass-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Lista en tu maleta
                </h3>
                <span className="text-xs font-medium text-slate-700 font-mono-tabular">
                  {currentTrip.packedIds.length} / {tripItems.length} empacadas
                </span>
              </div>

              {tripItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  Aún no agregas prendas a esta maleta. Elige ropa de la columna derecha.
                </div>
              ) : (
                <div className="divide-y divide-white/60">
                  {tripItems.map((garment) => {
                    const isPacked = currentTrip.packedIds.includes(garment.id);
                    return (
                      <div
                        key={garment.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-white/45 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onTogglePacked(currentTrip, garment)}
                          className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer min-h-[40px]"
                        >
                          <span
                            className={`w-6 h-6 min-w-[24px] rounded-lg border flex items-center justify-center transition-colors ${
                              isPacked
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white/75 border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isPacked
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {garment.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {CATEGORY_LABEL_MAP[garment.category]}
                              {garment.laundryStatus === 'por_lavar' &&
                                ' · Por lavar'}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onRemoveGarmentFromTrip(currentTrip, garment)
                          }
                          aria-label={`Quitar ${garment.name} de la maleta`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-rose-700 rounded-xl hover:bg-rose-50/70 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Available at Origin */}
            <div className="lg:col-span-5 glass-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Disponibles en {getEndpointLabel(currentTrip.origin)}
                </h3>
                <span className="text-xs text-slate-600 font-mono-tabular">
                  {availableOriginGarments.length}
                </span>
              </div>

              {availableOriginGarments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  No quedan más prendas disponibles en{' '}
                  {getEndpointLabel(currentTrip.origin)}.
                </div>
              ) : (
                <div className="divide-y divide-white/60 max-h-[460px] overflow-y-auto">
                  {availableOriginGarments.map((garment) => (
                    <div
                      key={garment.id}
                      className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {garment.name}
                        </p>
                        <p className="text-xs text-slate-600">
                          {CATEGORY_LABEL_MAP[garment.category]}
                          {garment.isEssential && ' · Esencial'}
                          {garment.laundryStatus === 'por_lavar' &&
                            ' · Por lavar'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onAddGarmentToTrip(currentTrip, garment.id)
                        }
                        className="glass-subtle inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-800 rounded-xl hover:bg-white/80 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Incluir</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-8 sm:p-10 text-center space-y-3">
          <Luggage className="w-9 h-9 text-slate-600 mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No tienes una maleta abierta en este momento
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Cuando vayas a viajar entre {cityLabel} y {ranchLabel}, crea una
            nueva maleta para no olvidar ninguna prenda.
          </p>
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-white text-sm font-medium rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Armar mi primera maleta</span>
          </button>
        </div>
      )}

      {/* Completed Trips Archive */}
      {completedTrips.length > 0 && (
        <div className="pt-4 border-t border-white/60 space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Viajes completados
          </h3>
          <div className="glass-panel rounded-2xl divide-y divide-white/60 overflow-hidden">
            {completedTrips.map((trip) => (
              <div
                key={trip.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {trip.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {getEndpointLabel(trip.origin)} →{' '}
                    {getEndpointLabel(trip.destination)} ·{' '}
                    <span className="font-mono-tabular">
                      {trip.packedIds.length} prendas trasladadas
                    </span>{' '}
                    · {formatShortDate(trip.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteTrip(trip)}
                  className="text-xs text-slate-600 hover:text-rose-700 self-start sm:self-center cursor-pointer"
                >
                  Eliminar registro
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
