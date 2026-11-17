import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Check,
  Droplets,
  Luggage,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Trees,
} from 'lucide-react';
import {
  CATEGORY_LABEL_MAP,
  CATEGORY_OPTIONS,
  type Garment,
  type GarmentCategory,
  type GarmentLocation,
  type LaundryStatus,
  type UserProfile,
} from '../types';
import {
  CategoryIcon,
  getLocationLabel,
  getLocationTextClass,
  LocationIcon,
} from './LocationHelpers';

interface InventoryViewProps {
  garments: Garment[];
  profile: UserProfile | null;
  loading: boolean;
  pendingIds?: Set<string>;
  onAddNew: () => void;
  onEdit: (garment: Garment) => void;
  onMoveDirect: (garment: Garment, toLocation: GarmentLocation) => Promise<void>;
  onToggleLaundry: (garment: Garment) => Promise<void>;
  onDelete: (garmentId: string) => Promise<void>;
  onSeedStarter: () => Promise<void>;
  onStartTripWithItems: (itemIds: string[], origin: 'ciudad' | 'rancho') => void;
}

export function InventoryView({
  garments,
  profile,
  loading,
  pendingIds,
  onAddNew,
  onEdit,
  onMoveDirect,
  onToggleLaundry,
  onDelete,
  onSeedStarter,
  onStartTripWithItems,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<'todas' | GarmentLocation>('todas');
  const [categoryFilter, setCategoryFilter] = useState<'todas' | GarmentCategory>('todas');
  const [laundryFilter, setLaundryFilter] = useState<'todas' | LaundryStatus>('todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const stats = useMemo(() => {
    let cityItems = 0;
    let cityPieces = 0;
    let ranchItems = 0;
    let ranchPieces = 0;
    let bagItems = 0;
    let bagPieces = 0;
    let dirtyItems = 0;

    for (const g of garments) {
      const qty = g.quantity || 1;
      if (g.location === 'ciudad') {
        cityItems += 1;
        cityPieces += qty;
      } else if (g.location === 'rancho') {
        ranchItems += 1;
        ranchPieces += qty;
      } else {
        bagItems += 1;
        bagPieces += qty;
      }
      if (g.laundryStatus === 'por_lavar') {
        dirtyItems += 1;
      }
    }

    return {
      cityItems,
      cityPieces,
      ranchItems,
      ranchPieces,
      bagItems,
      bagPieces,
      dirtyItems,
    };
  }, [garments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return garments.filter((g) => {
      if (locationFilter !== 'todas' && g.location !== locationFilter) return false;
      if (categoryFilter !== 'todas' && g.category !== categoryFilter) return false;
      if (laundryFilter !== 'todas' && g.laundryStatus !== laundryFilter) return false;
      if (q) {
        const hay = `${g.name} ${g.color} ${g.notes} ${CATEGORY_LABEL_MAP[g.category]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [garments, search, locationFilter, categoryFilter, laundryFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedOrigin = useMemo<'ciudad' | 'rancho' | null>(() => {
    if (selectedIds.length === 0) return null;
    const first = garments.find((g) => g.id === selectedIds[0]);
    if (!first || first.location === 'maleta') return 'ciudad';
    return first.location;
  }, [selectedIds, garments]);

  const handleMove = async (g: Garment, dest: GarmentLocation) => {
    setBusyId(g.id);
    try {
      await onMoveDirect(g, dest);
    } finally {
      setBusyId(null);
    }
  };

  const handleLaundry = async (g: Garment) => {
    setBusyId(g.id);
    try {
      await onToggleLaundry(g);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedStarter();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Mi Guardarropa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Controla qué dejaste en {cityLabel}, qué está en {ranchLabel} y qué llevas en la maleta.
          </p>
        </div>
        {selectedIds.length > 0 && selectedOrigin && (
          <div className="flex items-center gap-3 glass-panel rounded-xl px-3.5 py-2">
            <span className="text-sm font-medium text-slate-900 font-mono-tabular">
              {selectedIds.length} seleccionadas
            </span>
            <button
              type="button"
              onClick={() => {
                onStartTripWithItems(selectedIds, selectedOrigin);
                setSelectedIds([]);
              }}
              className="glass-btn-primary px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Armar maleta
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Summary 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            setLocationFilter(locationFilter === 'ciudad' ? 'todas' : 'ciudad')
          }
          className={`text-left p-4 rounded-2xl transition-all cursor-pointer ${
            locationFilter === 'ciudad'
              ? 'bg-blue-50/80 backdrop-blur-xl border border-blue-300 shadow-sm'
              : 'glass-panel hover:bg-white/75'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold truncate">{cityLabel}</span>
            <Building2 className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {stats.cityItems}
          </p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono-tabular">
            {stats.cityPieces} {stats.cityPieces === 1 ? 'pieza' : 'piezas'}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setLocationFilter(locationFilter === 'rancho' ? 'todas' : 'rancho')
          }
          className={`text-left p-4 rounded-2xl transition-all cursor-pointer ${
            locationFilter === 'rancho'
              ? 'bg-emerald-50/80 backdrop-blur-xl border border-emerald-300 shadow-sm'
              : 'glass-panel hover:bg-white/75'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-semibold truncate">{ranchLabel}</span>
            <Trees className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {stats.ranchItems}
          </p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono-tabular">
            {stats.ranchPieces} {stats.ranchPieces === 1 ? 'pieza' : 'piezas'}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setLocationFilter(locationFilter === 'maleta' ? 'todas' : 'maleta')
          }
          className={`text-left p-4 rounded-2xl transition-all cursor-pointer ${
            locationFilter === 'maleta'
              ? 'bg-amber-50/80 backdrop-blur-xl border border-amber-300 shadow-sm'
              : 'glass-panel hover:bg-white/75'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold truncate">En Maleta</span>
            <Luggage className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {stats.bagItems}
          </p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono-tabular">
            {stats.bagPieces} {stats.bagPieces === 1 ? 'pieza' : 'piezas'}
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setLaundryFilter(laundryFilter === 'por_lavar' ? 'todas' : 'por_lavar')
          }
          className={`text-left p-4 rounded-2xl transition-all cursor-pointer ${
            laundryFilter === 'por_lavar'
              ? 'bg-white/85 backdrop-blur-xl border border-slate-400 shadow-sm'
              : 'glass-panel hover:bg-white/75'
          }`}
        >
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold truncate">Por lavar</span>
            <Droplets className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {stats.dirtyItems}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {stats.dirtyItems === 1 ? 'prenda pendiente' : 'prendas pendientes'}
          </p>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar playera, tenis, color o nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="glass-track flex items-center gap-1 p-1 rounded-xl overflow-x-auto max-w-full">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'ciudad', label: cityLabel },
                  { id: 'rancho', label: ranchLabel },
                  { id: 'maleta', label: 'Maleta' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLocationFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    locationFilter === tab.id
                      ? 'bg-white/90 text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filtrar por categoría"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as 'todas' | GarmentCategory)
              }
              className="glass-input px-3 py-2 text-xs sm:text-sm rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="todas">Todas las categorías</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por estado de lavado"
              value={laundryFilter}
              onChange={(e) =>
                setLaundryFilter(e.target.value as 'todas' | LaundryStatus)
              }
              className="glass-input px-3 py-2 text-xs sm:text-sm rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="todas">Limpia y por lavar</option>
              <option value="limpia">Solo limpia</option>
              <option value="por_lavar">Solo por lavar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading / Empty / Data List */}
      {loading ? (
        <div className="glass-panel rounded-2xl divide-y divide-white/60">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-white/70 rounded" />
                <div className="h-3 w-72 bg-white/50 rounded" />
              </div>
              <div className="h-9 w-28 bg-white/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : garments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl glass-subtle text-slate-700 flex items-center justify-center mx-auto">
            <Luggage className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Tu guardarropa está vacío
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Empieza registrando las prendas que tienes en {cityLabel} y en{' '}
            {ranchLabel}, o carga una lista base de ejemplo para probar cómo se
            mueven entre ambos lugares.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onAddNew}
              className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar primera prenda</span>
            </button>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="glass-subtle inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-slate-800 text-sm font-medium rounded-xl hover:bg-white/75 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {seeding
                  ? 'Cargando prendas...'
                  : 'Cargar 12 prendas de ejemplo'}
              </span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            No hay prendas que coincidan con esos filtros.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setLocationFilter('todas');
              setCategoryFilter('todas');
              setLaundryFilter('todas');
            }}
            className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900 cursor-pointer"
          >
            Mostrar todas las prendas
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl divide-y divide-white/60 overflow-hidden">
          {filtered.map((garment) => {
            const isSelected = selectedIds.includes(garment.id);
            const isBusy = busyId === garment.id;
            const quickTarget: GarmentLocation =
              garment.location === 'ciudad' ? 'rancho' : 'ciudad';
            const quickTargetName =
              quickTarget === 'ciudad' ? cityLabel : ranchLabel;

            return (
              <div
                key={garment.id}
                className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/45 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label={`Seleccionar ${garment.name} para maleta`}
                    onClick={() => toggleSelect(garment.id)}
                    className={`mt-0.5 w-6 h-6 min-w-[24px] rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white/75 border-slate-300 text-transparent hover:border-slate-500'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-9 h-9 rounded-xl glass-subtle text-slate-700 flex items-center justify-center shrink-0">
                    <CategoryIcon category={garment.category} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-900 truncate max-w-full">
                        {garment.name}
                      </span>
                      {garment.isEssential && (
                        <span className="text-xs font-medium text-amber-800">
                          Esencial
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1">
                      <span>{CATEGORY_LABEL_MAP[garment.category]}</span>
                      {garment.color && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{garment.color}</span>
                        </>
                      )}
                      {garment.quantity > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {garment.quantity} pzas
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          garment.laundryStatus === 'por_lavar'
                            ? 'text-amber-800 font-medium'
                            : 'text-slate-700'
                        }
                      >
                        {garment.laundryStatus === 'limpia'
                          ? 'Limpia'
                          : 'Por lavar'}
                      </span>
                      {garment.notes && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-xs text-slate-600">
                            {garment.notes}
                          </span>
                        </>
                      )}
                      {pendingIds?.has(garment.id) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700 font-medium">
                            Pendiente de sincronizar
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3 pl-9 lg:pl-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold min-w-[115px]">
                    <LocationIcon location={garment.location} />
                    <span className={getLocationTextClass(garment.location)}>
                      {getLocationLabel(garment.location, profile)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMove(garment, quickTarget)}
                      className="glass-subtle inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-800 rounded-xl hover:bg-white/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-600" />
                      <span>Mover a {quickTargetName}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleLaundry(garment)}
                      title={
                        garment.laundryStatus === 'limpia'
                          ? 'Marcar por lavar'
                          : 'Marcar como limpia'
                      }
                      aria-label={
                        garment.laundryStatus === 'limpia'
                          ? `Marcar ${garment.name} por lavar`
                          : `Marcar ${garment.name} como limpia`
                      }
                      className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer disabled:opacity-50 ${
                        garment.laundryStatus === 'por_lavar'
                          ? 'border-amber-300 bg-amber-50/80 text-amber-800 hover:bg-amber-100/90'
                          : 'glass-subtle text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                    >
                      <Droplets className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(garment)}
                      aria-label={`Editar ${garment.name}`}
                      className="glass-subtle min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {confirmDeleteId === garment.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(garment.id)}
                          className="px-2.5 py-2 min-h-[40px] text-xs font-medium bg-rose-700 text-white rounded-xl hover:bg-rose-800 cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-2 min-h-[40px] text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(garment.id)}
                        aria-label={`Eliminar ${garment.name}`}
                        className="glass-subtle min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50/80 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
