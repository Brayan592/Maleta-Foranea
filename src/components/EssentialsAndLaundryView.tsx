import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Database,
  Download,
  Droplets,
  MapPin,
  Star,
  Upload,
} from 'lucide-react';
import {
  CATEGORY_LABEL_MAP,
  LIMITS,
  type Garment,
  type GarmentLocation,
  type UserProfile,
} from '../types';
import type { LocalStorageEngine } from '../services/localDatabase';
import {
  getLocationLabel,
  getLocationTextClass,
  LocationIcon,
} from './LocationHelpers';

interface EssentialsAndLaundryViewProps {
  garments: Garment[];
  profile: UserProfile | null;
  storageEngine: LocalStorageEngine;
  tripsCount: number;
  movementsCount: number;
  seasonsCount: number;
  lastSavedIso: string | null;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => Promise<void>;
  onMoveDirect: (garment: Garment, toLocation: GarmentLocation) => Promise<void>;
  onToggleLaundry: (garment: Garment) => Promise<void>;
  onSaveLabels: (cityLabel: string, ranchLabel: string) => Promise<void>;
}

export function EssentialsAndLaundryView({
  garments,
  profile,
  storageEngine,
  tripsCount,
  movementsCount,
  seasonsCount,
  lastSavedIso,
  onExportBackup,
  onImportBackup,
  onMoveDirect,
  onToggleLaundry,
  onSaveLabels,
}: EssentialsAndLaundryViewProps) {
  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const [cityInput, setCityInput] = useState(cityLabel);
  const [ranchInput, setRanchInput] = useState(ranchLabel);
  const [savingLabels, setSavingLabels] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCityInput(cityLabel);
    setRanchInput(ranchLabel);
  }, [cityLabel, ranchLabel]);

  const essentials = useMemo(
    () => garments.filter((g) => g.isEssential),
    [garments]
  );

  const dirtyCity = useMemo(
    () =>
      garments.filter(
        (g) => g.laundryStatus === 'por_lavar' && g.location === 'ciudad'
      ),
    [garments]
  );

  const dirtyRanch = useMemo(
    () =>
      garments.filter(
        (g) => g.laundryStatus === 'por_lavar' && g.location === 'rancho'
      ),
    [garments]
  );

  const dirtyBag = useMemo(
    () =>
      garments.filter(
        (g) => g.laundryStatus === 'por_lavar' && g.location === 'maleta'
      ),
    [garments]
  );

  const handleSaveLabels = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLabels(true);
    setSavedNotice(false);
    try {
      await onSaveLabels(cityInput, ranchInput);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSavingLabels(false);
    }
  };

  const handleExport = () => {
    setBackupError(null);
    onExportBackup();
    setBackupNotice('Respaldo descargado en formato JSON.');
    setTimeout(() => setBackupNotice(null), 3500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setBackupError(null);
    setBackupNotice(null);
    try {
      const text = await file.text();
      await onImportBackup(text);
      setBackupNotice('Respaldo restaurado en la base de datos local.');
      setTimeout(() => setBackupNotice(null), 4000);
    } catch (err) {
      setBackupError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo de respaldo.'
      );
    } finally {
      setImporting(false);
    }
  };

  const storageEngineLabel =
    storageEngine === 'indexeddb'
      ? 'IndexedDB local'
      : storageEngine === 'localstorage'
        ? 'Almacenamiento local (navegador)'
        : 'Memoria temporal';

  const formattedSavedTime = useMemo(() => {
    if (!lastSavedIso) return 'Guardado automático activo';
    try {
      return new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(lastSavedIso));
    } catch {
      return 'Reciente';
    }
  }, [lastSavedIso]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Pendientes y Esenciales
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Ubica de inmediato tus básicos más importantes, revisa ropa por lavar
          y personaliza tus dos casas.
        </p>
      </div>

      {/* Essentials section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-600" />
            <h2 className="font-display text-lg font-semibold text-slate-900">
              ¿Dónde quedaron tus esenciales?
            </h2>
          </div>
          <span className="text-xs text-slate-600 font-mono-tabular">
            {essentials.length} prendas
          </span>
        </div>

        {essentials.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-slate-700">
            No has marcado prendas como esenciales todavía. Edita cualquier
            prenda importante y activa &ldquo;Prenda esencial&rdquo;.
          </div>
        ) : (
          <div className="glass-panel rounded-2xl divide-y divide-white/60 overflow-hidden">
            {essentials.map((g) => {
              const target: GarmentLocation =
                g.location === 'ciudad' ? 'rancho' : 'ciudad';
              return (
                <div
                  key={g.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {g.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {CATEGORY_LABEL_MAP[g.category]}
                      {g.color && ` · ${g.color}`}
                      {g.laundryStatus === 'por_lavar' && ' · Por lavar'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <LocationIcon location={g.location} />
                      <span className={getLocationTextClass(g.location)}>
                        {getLocationLabel(g.location, profile)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onMoveDirect(g, target)}
                      className="glass-subtle inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-800 rounded-xl hover:bg-white/80 whitespace-nowrap cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-600" />
                      <span>
                        Mover a {target === 'ciudad' ? cityLabel : ranchLabel}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Laundry split */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-slate-700" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Ropa pendiente por lavar
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/60 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-700">
                En {cityLabel}
              </span>
              <span className="text-xs text-slate-600 font-mono-tabular">
                {dirtyCity.length}
              </span>
            </div>
            {dirtyCity.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">
                Todo limpio en {cityLabel}.
              </p>
            ) : (
              <div className="divide-y divide-white/60">
                {dirtyCity.map((g) => (
                  <div
                    key={g.id}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {g.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.quantity > 1 ? `${g.quantity} pzas · ` : ''}
                        {CATEGORY_LABEL_MAP[g.category]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleLaundry(g)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-emerald-900 border border-emerald-200/80 bg-emerald-50/75 rounded-xl hover:bg-emerald-100/90 whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Marcar limpia</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/60 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-800">
                En {ranchLabel}
              </span>
              <span className="text-xs text-slate-600 font-mono-tabular">
                {dirtyRanch.length}
              </span>
            </div>
            {dirtyRanch.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">
                Todo limpio en {ranchLabel}.
              </p>
            ) : (
              <div className="divide-y divide-white/60">
                {dirtyRanch.map((g) => (
                  <div
                    key={g.id}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {g.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {g.quantity > 1 ? `${g.quantity} pzas · ` : ''}
                        {CATEGORY_LABEL_MAP[g.category]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleLaundry(g)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-emerald-900 border border-emerald-200/80 bg-emerald-50/75 rounded-xl hover:bg-emerald-100/90 whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Marcar limpia</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {dirtyBag.length > 0 && (
          <div className="glass-panel rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-800">
              Por lavar en la maleta ({dirtyBag.length})
            </p>
            <div className="divide-y divide-white/60">
              {dirtyBag.map((g) => (
                <div
                  key={g.id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-slate-900">{g.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleLaundry(g)}
                    className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
                  >
                    Marcar limpia
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Location Labels, Offline Storage & Account Settings */}
      <section className="pt-6 border-t border-white/60 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Nombres de tus dos lugares
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Personaliza cómo quieres llamar a tu ciudad de estudio o trabajo y a
            tu rancho o pueblo.
          </p>

          <form onSubmit={handleSaveLabels} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="city-label-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Nombre para la Ciudad
                </label>
                <input
                  id="city-label-input"
                  type="text"
                  maxLength={LIMITS.CITY_RANCH_LABEL_MAX}
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="La Ciudad"
                  className="glass-input w-full px-3.5 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="ranch-label-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Nombre para tu Rancho
                </label>
                <input
                  id="ranch-label-input"
                  type="text"
                  maxLength={LIMITS.CITY_RANCH_LABEL_MAX}
                  value={ranchInput}
                  onChange={(e) => setRanchInput(e.target.value)}
                  placeholder="El Rancho"
                  className="glass-input w-full px-3.5 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingLabels}
                className="glass-btn-primary px-4 py-2 min-h-[40px] text-white text-sm font-medium rounded-xl cursor-pointer disabled:opacity-60"
              >
                {savingLabels ? 'Guardando...' : 'Guardar nombres'}
              </button>
              {savedNotice && (
                <span className="text-xs font-medium text-emerald-800">
                  Nombres actualizados
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Base de datos local (IndexedDB)
              </h2>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span>Motor de guardado</span>
                <span className="font-semibold text-emerald-800">
                  {storageEngineLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Prendas guardadas</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {garments.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Maletas, traslados y temporadas</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {tripsCount} · {movementsCount} · {seasonsCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Último guardado local</span>
                <span className="font-mono-tabular text-slate-600">
                  {formattedSavedTime}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Toda tu ropa, viajes y reportes se guardan directamente en este
              dispositivo sin necesidad de internet ni cuentas externas.
            </p>

            {backupNotice && (
              <p className="text-xs font-medium text-emerald-800">
                {backupNotice}
              </p>
            )}
            {backupError && (
              <p className="text-xs font-medium text-rose-700">{backupError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar respaldo (.json)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="glass-subtle inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-slate-800 text-xs font-medium rounded-xl hover:bg-white/80 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {importing ? 'Importando...' : 'Importar respaldo (.json)'}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

