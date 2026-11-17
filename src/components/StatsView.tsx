import { useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calendar,
  Droplets,
  Luggage,
  PieChart as PieChartIcon,
  Plus,
  Trees,
} from 'lucide-react';
import {
  CATEGORY_LABEL_MAP,
  CATEGORY_OPTIONS,
  type Garment,
  type GarmentCategory,
  type GarmentLocation,
  type Movement,
  type Trip,
  type UserProfile,
} from '../types';

interface StatsViewProps {
  garments: Garment[];
  trips: Trip[];
  movements: Movement[];
  profile: UserProfile | null;
  onAddNew: () => void;
  onOpenSeasonReport: () => void;
}

type CountMode = 'prendas' | 'piezas';
type BarLayoutMode = 'agrupadas' | 'apiladas';

interface PieSlice {
  id: GarmentLocation;
  label: string;
  value: number;
  pieces: number;
  items: number;
  percent: number;
  color: string;
  trackColor: string;
  textClass: string;
}

const SHORT_CATEGORY_LABELS: Record<GarmentCategory, string> = {
  playeras: 'Playeras',
  pantalones: 'Pantalones',
  chamarras: 'Chamarras',
  calzado: 'Calzado',
  formal: 'Formal',
  interior: 'Interior',
  accesorios: 'Accesorios',
  otros: 'Otros',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describePieSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const delta = endAngle - startAngle;
  if (delta >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = delta <= 180 ? '0' : '1';
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

export function StatsView({
  garments,
  trips,
  movements,
  profile,
  onAddNew,
  onOpenSeasonReport,
}: StatsViewProps) {
  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const [countMode, setCountMode] = useState<CountMode>('prendas');
  const [includeBagInPie, setIncludeBagInPie] = useState(true);
  const [activeSlice, setActiveSlice] = useState<GarmentLocation | null>(null);
  const [barMode, setBarMode] = useState<BarLayoutMode>('agrupadas');
  const [hoveredCat, setHoveredCat] = useState<GarmentCategory | null>(null);

  const summary = useMemo(() => {
    let totalItems = garments.length;
    let totalPieces = 0;
    let cleanItems = 0;
    let essentialItems = 0;

    const byLoc: Record<GarmentLocation, { items: number; pieces: number }> = {
      ciudad: { items: 0, pieces: 0 },
      rancho: { items: 0, pieces: 0 },
      maleta: { items: 0, pieces: 0 },
    };

    for (const g of garments) {
      const qty = g.quantity || 1;
      totalPieces += qty;
      byLoc[g.location].items += 1;
      byLoc[g.location].pieces += qty;
      if (g.laundryStatus === 'limpia') cleanItems += 1;
      if (g.isEssential) essentialItems += 1;
    }

    const completedTrips = trips.filter((t) => t.status === 'completado').length;

    return {
      totalItems,
      totalPieces,
      cleanItems,
      cleanPercent: totalItems > 0 ? Math.round((cleanItems / totalItems) * 100) : 0,
      essentialItems,
      byLoc,
      completedTrips,
      totalMovements: movements.length,
    };
  }, [garments, trips, movements]);

  const pieSlices = useMemo<PieSlice[]>(() => {
    const getVal = (loc: GarmentLocation) =>
      countMode === 'prendas' ? summary.byLoc[loc].items : summary.byLoc[loc].pieces;

    const candidates: {
      id: GarmentLocation;
      label: string;
      color: string;
      trackColor: string;
      textClass: string;
    }[] = [
      {
        id: 'ciudad',
        label: cityLabel,
        color: '#1d4ed8',
        trackColor: 'bg-blue-700',
        textClass: 'text-blue-800',
      },
      {
        id: 'rancho',
        label: ranchLabel,
        color: '#15803d',
        trackColor: 'bg-emerald-700',
        textClass: 'text-emerald-800',
      },
    ];

    if (includeBagInPie && getVal('maleta') > 0) {
      candidates.push({
        id: 'maleta',
        label: 'En Maleta',
        color: '#b45309',
        trackColor: 'bg-amber-600',
        textClass: 'text-amber-800',
      });
    }

    const total = candidates.reduce((acc, c) => acc + getVal(c.id), 0);

    return candidates.map((c) => {
      const value = getVal(c.id);
      return {
        ...c,
        value,
        items: summary.byLoc[c.id].items,
        pieces: summary.byLoc[c.id].pieces,
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      };
    });
  }, [summary, countMode, includeBagInPie, cityLabel, ranchLabel]);

  const pieGeometry = useMemo(() => {
    const total = pieSlices.reduce((acc, s) => acc + s.value, 0);
    if (total === 0) return [];
    let currentAngle = 0;
    return pieSlices
      .filter((s) => s.value > 0)
      .map((slice) => {
        const sweep = (slice.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sweep;
        const midAngle = startAngle + sweep / 2;
        currentAngle = endAngle;
        return {
          ...slice,
          startAngle,
          endAngle,
          midAngle,
          path: describePieSlice(110, 110, 92, startAngle, endAngle),
        };
      });
  }, [pieSlices]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      GarmentCategory,
      { ciudad: number; rancho: number; maleta: number; total: number }
    >();

    for (const opt of CATEGORY_OPTIONS) {
      map.set(opt.value, { ciudad: 0, rancho: 0, maleta: 0, total: 0 });
    }

    for (const g of garments) {
      const bucket = map.get(g.category);
      if (!bucket) continue;
      const weight = countMode === 'prendas' ? 1 : g.quantity || 1;
      bucket[g.location] += weight;
      bucket.total += weight;
    }

    return CATEGORY_OPTIONS.map((opt) => {
      const counts = map.get(opt.value)!;
      return {
        category: opt.value,
        label: CATEGORY_LABEL_MAP[opt.value],
        shortLabel: SHORT_CATEGORY_LABELS[opt.value],
        ...counts,
      };
    });
  }, [garments, countMode]);

  const maxBarValue = useMemo(() => {
    let max = 1;
    for (const row of categoryBreakdown) {
      if (barMode === 'apiladas') {
        max = Math.max(max, row.total);
      } else {
        max = Math.max(max, row.ciudad, row.rancho, row.maleta);
      }
    }
    return max;
  }, [categoryBreakdown, barMode]);

  const highlightedSlice =
    pieSlices.find((s) => s.id === activeSlice) || pieSlices[0];

  const hoveredCategoryData =
    categoryBreakdown.find((c) => c.category === hoveredCat) || null;

  if (garments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Estadísticas del Guardarropa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualiza cómo se reparte tu ropa entre {cityLabel} y {ranchLabel}.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl glass-subtle text-slate-700 flex items-center justify-center mx-auto">
            <PieChartIcon className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Aún no hay prendas para graficar
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Agrega tus prendas en Inventario para ver el gráfico de torta entre{' '}
            {cityLabel} y {ranchLabel} y el desglose por categorías.
          </p>
          <button
            type="button"
            onClick={onAddNew}
            className="glass-btn-primary inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] text-white text-sm font-medium rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar primera prenda</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header + Unit Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Estadísticas del Guardarropa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Distribución orgánica de tu ropa entre {cityLabel}, {ranchLabel} y tu
            maleta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={onOpenSeasonReport}
            className="glass-subtle inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-800 rounded-xl hover:bg-white/80 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>Reporte de Temporada</span>
          </button>

          <div
            role="group"
            aria-label="Modo de conteo"
            className="glass-track p-1 rounded-xl flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => setCountMode('prendas')}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                countMode === 'prendas'
                  ? 'bg-white/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por registros
            </button>
            <button
              type="button"
              onClick={() => setCountMode('piezas')}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                countMode === 'piezas'
                  ? 'bg-white/90 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por piezas totales
            </button>
          </div>
        </div>
      </div>

      {/* Organic 4-card overview grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold truncate">{cityLabel}</span>
            <Building2 className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
            {countMode === 'prendas'
              ? summary.byLoc.ciudad.items
              : summary.byLoc.ciudad.pieces}
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
            {summary.totalItems > 0
              ? Math.round(
                  ((countMode === 'prendas'
                    ? summary.byLoc.ciudad.items
                    : summary.byLoc.ciudad.pieces) /
                    (countMode === 'prendas'
                      ? summary.totalItems
                      : summary.totalPieces)) *
                    100
                )
              : 0}
            % del total
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-semibold truncate">{ranchLabel}</span>
            <Trees className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
            {countMode === 'prendas'
              ? summary.byLoc.rancho.items
              : summary.byLoc.rancho.pieces}
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
            {summary.totalItems > 0
              ? Math.round(
                  ((countMode === 'prendas'
                    ? summary.byLoc.rancho.items
                    : summary.byLoc.rancho.pieces) /
                    (countMode === 'prendas'
                      ? summary.totalItems
                      : summary.totalPieces)) *
                    100
                )
              : 0}
            % del total
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold truncate">Ropa limpia</span>
            <Droplets className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
            {summary.cleanPercent}%
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
            {summary.cleanItems} de {summary.totalItems} listas
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold truncate">Traslados</span>
            <Luggage className="w-4 h-4 shrink-0" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
            {summary.totalMovements}
          </p>
          <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
            {summary.completedTrips}{' '}
            {summary.completedTrips === 1 ? 'viaje cerrado' : 'viajes cerrados'}
          </p>
        </div>
      </div>

      {/* Main Responsive Charts Grid (adapts 1-col mobile/tablet -> 12-col split on desktop) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* PIE CHART (Gráfico de Torta): Distribución Ciudad vs Rancho */}
        <section className="xl:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-800">
                <PieChartIcon className="w-4 h-4 shrink-0" />
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Distribución por ubicación
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Proporción de {countMode === 'prendas' ? 'prendas' : 'piezas'}{' '}
                entre {cityLabel} y {ranchLabel}.
              </p>
            </div>

            {summary.byLoc.maleta.items > 0 && (
              <button
                type="button"
                onClick={() => setIncludeBagInPie(!includeBagInPie)}
                className="glass-subtle px-3 py-1.5 text-xs font-medium text-slate-700 rounded-lg hover:bg-white/75 transition-colors cursor-pointer whitespace-nowrap"
              >
                {includeBagInPie ? 'Ocultar maleta' : 'Incluir maleta'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            <div className="sm:col-span-6 flex justify-center">
              {pieGeometry.length === 0 ? (
                <div className="w-48 h-48 rounded-full glass-subtle flex items-center justify-center text-xs text-slate-500 text-center p-4">
                  Sin datos visibles con el filtro actual
                </div>
              ) : (
                <svg
                  viewBox="0 0 220 220"
                  className="w-48 h-48 sm:w-52 sm:h-52 overflow-visible drop-shadow-sm"
                  role="img"
                  aria-label={`Gráfico de torta mostrando distribución entre ${cityLabel} y ${ranchLabel}`}
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="98"
                    fill="rgba(255,255,255,0.35)"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="1.5"
                  />
                  {pieGeometry.map((slice) => {
                    const isActive =
                      activeSlice === slice.id ||
                      (!activeSlice && highlightedSlice?.id === slice.id);
                    const offsetRad = ((slice.midAngle - 90) * Math.PI) / 180;
                    const tx = isActive ? Math.cos(offsetRad) * 5 : 0;
                    const ty = isActive ? Math.sin(offsetRad) * 5 : 0;

                    return (
                      <path
                        key={slice.id}
                        d={slice.path}
                        fill={slice.color}
                        fillOpacity={isActive ? 0.94 : 0.8}
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2.5"
                        transform={`translate(${tx.toFixed(2)}, ${ty.toFixed(2)})`}
                        onMouseEnter={() => setActiveSlice(slice.id)}
                        onMouseLeave={() => setActiveSlice(null)}
                        onClick={() =>
                          setActiveSlice(
                            activeSlice === slice.id ? null : slice.id
                          )
                        }
                        className="transition-transform duration-200 cursor-pointer"
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="sm:col-span-6 space-y-3">
              {pieSlices.map((slice) => {
                const isHighlighted = highlightedSlice?.id === slice.id;
                return (
                  <button
                    key={slice.id}
                    type="button"
                    onMouseEnter={() => setActiveSlice(slice.id)}
                    onMouseLeave={() => setActiveSlice(null)}
                    onClick={() =>
                      setActiveSlice(activeSlice === slice.id ? null : slice.id)
                    }
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isHighlighted
                        ? 'bg-white/80 border border-white shadow-xs'
                        : 'glass-subtle hover:bg-white/65'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-3 h-3 rounded-sm shrink-0 ${slice.trackColor}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {slice.label}
                        </p>
                        <p className="text-xs text-slate-600 font-mono-tabular">
                          {slice.items}{' '}
                          {slice.items === 1 ? 'prenda' : 'prendas'} ·{' '}
                          {slice.pieces}{' '}
                          {slice.pieces === 1 ? 'pieza' : 'piezas'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-base font-bold font-mono-tabular shrink-0 ${slice.textClass}`}
                    >
                      {slice.percent}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-white/60 flex items-center justify-between text-xs text-slate-600">
            <span>Toca o pasa el cursor sobre un sector para inspeccionar</span>
            <span className="font-mono-tabular font-semibold text-slate-900">
              Total:{' '}
              {countMode === 'prendas'
                ? `${summary.totalItems} prendas`
                : `${summary.totalPieces} piezas`}
            </span>
          </div>
        </section>

        {/* BAR CHART (Gráfico de Barras): Categorías por Ubicación */}
        <section className="xl:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-800">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Categorías por ubicación
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Comparativa de camisas, pantalones, chamarras y más en cada
                lugar.
              </p>
            </div>

            <div className="glass-track p-1 rounded-xl flex items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBarMode('agrupadas')}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  barMode === 'agrupadas'
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Agrupadas
              </button>
              <button
                type="button"
                onClick={() => setBarMode('apiladas')}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  barMode === 'apiladas'
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Apiladas
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-700" />
                {cityLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700" />
                {ranchLabel}
              </span>
              {summary.byLoc.maleta.items > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
                  En Maleta
                </span>
              )}
            </div>

            {hoveredCategoryData && (
              <span className="text-xs font-medium text-slate-700 font-mono-tabular">
                {hoveredCategoryData.label}: {hoveredCategoryData.ciudad} Ciudad ·{' '}
                {hoveredCategoryData.rancho} Rancho
                {hoveredCategoryData.maleta > 0
                  ? ` · ${hoveredCategoryData.maleta} Maleta`
                  : ''}
              </span>
            )}
          </div>

          {/* DESKTOP / TABLET: Organic Vertical Column Bar Chart (md+) */}
          <div className="hidden md:block">
            <div className="glass-subtle rounded-xl p-4 sm:p-5">
              <div className="relative h-60 flex items-end justify-between gap-3 pt-6 pb-1 border-b border-slate-300/60">
                {/* Horizontal Reference Lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => (
                  <div
                    key={ratio}
                    style={{ bottom: `${ratio * 100}%` }}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-300/50 pointer-events-none"
                  >
                    <span className="text-[10px] font-mono-tabular text-slate-400 -top-2.5 left-0 absolute bg-white/40 px-1 rounded">
                      {Math.round(maxBarValue * ratio)}
                    </span>
                  </div>
                ))}

                {categoryBreakdown.map((row) => {
                  const isHovered = hoveredCat === row.category;
                  const cityPct = (row.ciudad / maxBarValue) * 100;
                  const ranchPct = (row.rancho / maxBarValue) * 100;
                  const bagPct = (row.maleta / maxBarValue) * 100;

                  return (
                    <button
                      key={row.category}
                      type="button"
                      onMouseEnter={() => setHoveredCat(row.category)}
                      onMouseLeave={() => setHoveredCat(null)}
                      onFocus={() => setHoveredCat(row.category)}
                      className={`flex-1 h-full flex flex-col justify-end items-center group cursor-pointer rounded-lg px-1 transition-colors ${
                        isHovered ? 'bg-white/45' : ''
                      }`}
                    >
                      {barMode === 'agrupadas' ? (
                        <div className="w-full h-full flex items-end justify-center gap-1">
                          <div className="w-3.5 lg:w-4 h-full flex items-end">
                            <div
                              style={{
                                height: row.ciudad > 0 ? `${Math.max(6, cityPct)}%` : '0%',
                              }}
                              title={`${cityLabel}: ${row.ciudad}`}
                              className="w-full bg-blue-700/90 group-hover:bg-blue-700 rounded-t-md transition-all duration-300"
                            />
                          </div>
                          <div className="w-3.5 lg:w-4 h-full flex items-end">
                            <div
                              style={{
                                height: row.rancho > 0 ? `${Math.max(6, ranchPct)}%` : '0%',
                              }}
                              title={`${ranchLabel}: ${row.rancho}`}
                              className="w-full bg-emerald-700/90 group-hover:bg-emerald-700 rounded-t-md transition-all duration-300"
                            />
                          </div>
                          {summary.byLoc.maleta.items > 0 && (
                            <div className="w-2.5 lg:w-3 h-full flex items-end">
                              <div
                                style={{
                                  height: row.maleta > 0 ? `${Math.max(6, bagPct)}%` : '0%',
                                }}
                                title={`En Maleta: ${row.maleta}`}
                                className="w-full bg-amber-600/90 group-hover:bg-amber-600 rounded-t-md transition-all duration-300"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-7 lg:w-9 h-full flex flex-col justify-end">
                          {row.maleta > 0 && (
                            <div
                              style={{ height: `${Math.max(5, bagPct)}%` }}
                              className="w-full bg-amber-600/90 rounded-t-md"
                            />
                          )}
                          {row.rancho > 0 && (
                            <div
                              style={{ height: `${Math.max(5, ranchPct)}%` }}
                              className={`w-full bg-emerald-700/90 ${
                                row.maleta === 0 ? 'rounded-t-md' : ''
                              }`}
                            />
                          )}
                          {row.ciudad > 0 && (
                            <div
                              style={{ height: `${Math.max(5, cityPct)}%` }}
                              className={`w-full bg-blue-700/90 ${
                                row.maleta === 0 && row.rancho === 0
                                  ? 'rounded-t-md'
                                  : ''
                              }`}
                            />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex items-start justify-between gap-3 pt-2.5">
                {categoryBreakdown.map((row) => (
                  <div
                    key={row.category}
                    className="flex-1 text-center min-w-0"
                  >
                    <p className="text-[11px] font-medium text-slate-700 truncate">
                      {row.shortLabel}
                    </p>
                    <p className="text-[11px] font-mono-tabular text-slate-500">
                      {row.total}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MOBILE: Organic Horizontal Proportional Bars (< md) */}
          <div className="md:hidden space-y-3">
            {categoryBreakdown.map((row) => {
              const cityW = (row.ciudad / maxBarValue) * 100;
              const ranchW = (row.rancho / maxBarValue) * 100;
              const bagW = (row.maleta / maxBarValue) * 100;

              return (
                <div
                  key={row.category}
                  className="glass-subtle rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {row.shortLabel}
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-600">
                      {row.ciudad} {cityLabel} · {row.rancho} {ranchLabel}
                      {row.maleta > 0 ? ` · ${row.maleta} Maleta` : ''}
                    </span>
                  </div>

                  {barMode === 'agrupadas' ? (
                    <div className="space-y-1.5">
                      <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: row.ciudad > 0 ? `${Math.max(4, cityW)}%` : '0%',
                          }}
                          className="h-full bg-blue-700 rounded-full transition-all duration-300"
                        />
                      </div>
                      <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: row.rancho > 0 ? `${Math.max(4, ranchW)}%` : '0%',
                          }}
                          className="h-full bg-emerald-700 rounded-full transition-all duration-300"
                        />
                      </div>
                      {row.maleta > 0 && (
                        <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.max(4, bagW)}%` }}
                            className="h-full bg-amber-600 rounded-full transition-all duration-300"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden flex">
                      {row.ciudad > 0 && (
                        <div
                          style={{ width: `${cityW}%` }}
                          className="h-full bg-blue-700"
                        />
                      )}
                      {row.rancho > 0 && (
                        <div
                          style={{ width: `${ranchW}%` }}
                          className="h-full bg-emerald-700"
                        />
                      )}
                      {row.maleta > 0 && (
                        <div
                          style={{ width: `${bagW}%` }}
                          className="h-full bg-amber-600"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
