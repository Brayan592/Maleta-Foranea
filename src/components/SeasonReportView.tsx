import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  Building2,
  Calendar,
  Check,
  Copy,
  Download,
  FileText,
  Luggage,
  Printer,
  Trash2,
  Trees,
} from 'lucide-react';
import {
  LIMITS,
  type Garment,
  type Movement,
  type SeasonReport,
  type Trip,
  type UserProfile,
} from '../types';
import {
  formatShortDate,
  getLocationLabel,
  timestampToDate,
} from './LocationHelpers';

interface SeasonReportViewProps {
  movements: Movement[];
  trips: Trip[];
  garments: Garment[];
  seasons: SeasonReport[];
  profile: UserProfile | null;
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

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const monthName = MONTH_NAMES_ES[monthIdx] || parts[1];
  return `${monthName} ${year}`;
}

function getMonthKeyFromTimestamp(ts: Movement['createdAt']): string {
  const d = timestampToDate(ts) ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SeasonReportView({
  movements,
  trips,
  garments,
  seasons,
  profile,
  onSaveSeason,
  onDeleteSeason,
}: SeasonReportViewProps) {
  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | 'live'>('live');
  const [copied, setCopied] = useState(false);

  const monthLabel = useMemo(
    () => formatMonthLabel(selectedMonth),
    [selectedMonth]
  );

  // Live report computation for selected month
  const liveDraft = useMemo(() => {
    const monthMovements = movements.filter(
      (m) => getMonthKeyFromTimestamp(m.createdAt) === selectedMonth
    );

    const monthTrips = trips.filter((t) => {
      if (t.status !== 'completado') return false;
      if (t.travelDate && t.travelDate.startsWith(selectedMonth)) return true;
      if (t.updatedAt && getMonthKeyFromTimestamp(t.updatedAt) === selectedMonth) {
        return true;
      }
      return false;
    });

    let toCityCount = 0;
    let toRanchCount = 0;
    const freq = new Map<string, number>();

    for (const m of monthMovements) {
      if (m.toLocation === 'ciudad') toCityCount += 1;
      if (m.toLocation === 'rancho') toRanchCount += 1;
      freq.set(m.garmentName, (freq.get(m.garmentName) || 0) + 1);
    }

    const topMovedNames = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, LIMITS.TOP_MOVED_MAX)
      .map(([name, count]) =>
        count > 1 ? `${name} (${count} traslados)` : name
      );

    const movedSummaryLines = monthMovements
      .slice(0, LIMITS.SUMMARY_LINES_MAX)
      .map((m) => {
        const fromName = getLocationLabel(m.fromLocation, profile);
        const toName = getLocationLabel(m.toLocation, profile);
        const via = m.tripTitle ? ` · ${m.tripTitle}` : '';
        return `${m.garmentName}: ${fromName} → ${toName}${via}`;
      });

    let citySnapshotCount = 0;
    let ranchSnapshotCount = 0;
    let bagSnapshotCount = 0;
    for (const g of garments) {
      if (g.location === 'ciudad') citySnapshotCount += 1;
      else if (g.location === 'rancho') ranchSnapshotCount += 1;
      else bagSnapshotCount += 1;
    }

    return {
      title: customTitle.trim() || `Temporada ${monthLabel}`,
      monthKey: selectedMonth,
      monthLabel,
      toCityCount,
      toRanchCount,
      totalMovements: monthMovements.length,
      completedTripsCount: monthTrips.length,
      citySnapshotCount,
      ranchSnapshotCount,
      bagSnapshotCount,
      topMovedNames,
      movedSummaryLines,
      notes: notes.trim(),
      rawMovements: monthMovements,
    };
  }, [movements, trips, garments, selectedMonth, monthLabel, customTitle, notes, profile]);

  const displayedSeason = useMemo(() => {
    if (activeSeasonId === 'live') {
      return {
        isSaved: false,
        id: 'live',
        createdAt: null as SeasonReport['createdAt'],
        ...liveDraft,
      };
    }
    const found = seasons.find((s) => s.id === activeSeasonId);
    if (!found) {
      return {
        isSaved: false,
        id: 'live',
        createdAt: null as SeasonReport['createdAt'],
        ...liveDraft,
      };
    }
    return {
      isSaved: true,
      ...found,
    };
  }, [activeSeasonId, seasons, liveDraft]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const id = await onSaveSeason({
        title: liveDraft.title,
        monthKey: liveDraft.monthKey,
        monthLabel: liveDraft.monthLabel,
        toCityCount: liveDraft.toCityCount,
        toRanchCount: liveDraft.toRanchCount,
        totalMovements: liveDraft.totalMovements,
        completedTripsCount: liveDraft.completedTripsCount,
        citySnapshotCount: liveDraft.citySnapshotCount,
        ranchSnapshotCount: liveDraft.ranchSnapshotCount,
        bagSnapshotCount: liveDraft.bagSnapshotCount,
        topMovedNames: liveDraft.topMovedNames,
        movedSummaryLines: liveDraft.movedSummaryLines,
        notes: liveDraft.notes,
      });
      setActiveSeasonId(id);
      setCustomTitle('');
      setNotes('');
      setSaveFeedback('Resumen de Temporada guardado en tu cuenta.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const buildPlainSummaryText = () => {
    const lines = [
      `RESUMEN DE TEMPORADA — ${displayedSeason.title}`,
      `Periodo: ${displayedSeason.monthLabel} (${cityLabel} ↔ ${ranchLabel})`,
      '',
      `• Movimientos totales: ${displayedSeason.totalMovements}`,
      `• Llevadas hacia ${cityLabel}: ${displayedSeason.toCityCount}`,
      `• Traídas hacia ${ranchLabel}: ${displayedSeason.toRanchCount}`,
      `• Viajes completados: ${displayedSeason.completedTripsCount}`,
      '',
      `Estado del guardarropa:`,
      `• En ${cityLabel}: ${displayedSeason.citySnapshotCount} prendas`,
      `• En ${ranchLabel}: ${displayedSeason.ranchSnapshotCount} prendas`,
      `• En Maleta: ${displayedSeason.bagSnapshotCount} prendas`,
    ];
    if (displayedSeason.topMovedNames.length > 0) {
      lines.push('', 'Prendas más movidas:');
      for (const item of displayedSeason.topMovedNames) {
        lines.push(`- ${item}`);
      }
    }
    if (displayedSeason.movedSummaryLines.length > 0) {
      lines.push('', 'Bitácora de traslados:');
      for (const item of displayedSeason.movedSummaryLines) {
        lines.push(`- ${item}`);
      }
    }
    if (displayedSeason.notes) {
      lines.push('', `Notas: ${displayedSeason.notes}`);
    }
    return lines.join('\n');
  };

  const handleExportMarkdown = () => {
    const md = [
      `# ${displayedSeason.title}`,
      `**Periodo:** ${displayedSeason.monthLabel}  `,
      `**Ruta:** ${cityLabel} ↔ ${ranchLabel}`,
      '',
      '## Resumen de movimientos',
      `- **Total de traslados:** ${displayedSeason.totalMovements}`,
      `- **Hacia ${cityLabel}:** ${displayedSeason.toCityCount}`,
      `- **Hacia ${ranchLabel}:** ${displayedSeason.toRanchCount}`,
      `- **Viajes cerrados:** ${displayedSeason.completedTripsCount}`,
      '',
      '## Balance de guardarropa',
      `- **${cityLabel}:** ${displayedSeason.citySnapshotCount} prendas`,
      `- **${ranchLabel}:** ${displayedSeason.ranchSnapshotCount} prendas`,
      `- **En Maleta:** ${displayedSeason.bagSnapshotCount} prendas`,
      '',
      ...(displayedSeason.topMovedNames.length > 0
        ? [
            '## Prendas protagonistas',
            ...displayedSeason.topMovedNames.map((n) => `- ${n}`),
            '',
          ]
        : []),
      ...(displayedSeason.movedSummaryLines.length > 0
        ? [
            '## Desglose de movimientos',
            ...displayedSeason.movedSummaryLines.map((l) => `- ${l}`),
            '',
          ]
        : []),
      ...(displayedSeason.notes ? [`> ${displayedSeason.notes}`] : []),
    ].join('\n');

    triggerDownload(
      `temporada-${displayedSeason.monthKey}.md`,
      md,
      'text/markdown;charset=utf-8'
    );
  };

  const handleExportCsv = () => {
    const rows =
      displayedSeason.movedSummaryLines.length > 0
        ? displayedSeason.movedSummaryLines
            .map((line) => `"${line.replace(/"/g, '""')}"`)
            .map((escaped, idx) => `${idx + 1},${escaped}`)
            .join('\n')
        : '0,"Sin movimientos registrados en este mes"';

    const csv = `Indice,Movimiento\n${rows}\n`;
    triggerDownload(
      `movimientos-${displayedSeason.monthKey}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const totalDirectional =
    displayedSeason.toCityCount + displayedSeason.toRanchCount;
  const toCityPercent =
    totalDirectional > 0
      ? Math.round((displayedSeason.toCityCount / totalDirectional) * 100)
      : 50;
  const toRanchPercent = totalDirectional > 0 ? 100 - toCityPercent : 50;

  return (
    <div className="space-y-8">
      {/* Generator Form (hidden on print) */}
      <form
        onSubmit={handleSave}
        className="no-print glass-panel rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Generar reporte mensual de Temporada
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Resume tus movimientos de un mes y guárdalo como vista de
              Temporada exportable.
            </p>
          </div>
          {saveFeedback && (
            <span className="text-xs font-medium text-emerald-800">
              {saveFeedback}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="season-month"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Mes del reporte
            </label>
            <input
              id="season-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value || currentMonthKey);
                setActiveSeasonId('live');
              }}
              className="glass-input w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="season-title"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Nombre de la Temporada (opcional)
            </label>
            <input
              id="season-title"
              type="text"
              maxLength={LIMITS.SEASON_TITLE_MAX}
              placeholder={`Temporada ${monthLabel}`}
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                setActiveSeasonId('live');
              }}
              className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="glass-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-white text-sm font-medium rounded-xl cursor-pointer disabled:opacity-60"
            >
              <BookmarkCheck className="w-4 h-4 shrink-0" />
              <span>{saving ? 'Guardando...' : 'Guardar Temporada'}</span>
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="season-notes"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Nota de cierre (opcional)
          </label>
          <input
            id="season-notes"
            type="text"
            maxLength={LIMITS.NOTES_MAX}
            placeholder="Ej. Mes de lluvias, dejé el abrigo grueso en la Ciudad y me traje botas."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setActiveSeasonId('live');
            }}
            className="glass-input w-full px-3.5 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </form>

      {/* Selector between Live Preview and Saved Seasons (hidden on print) */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSeasonId('live')}
          className={`px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer ${
            activeSeasonId === 'live'
              ? 'glass-btn-primary text-white'
              : 'glass-panel text-slate-800 hover:bg-white/80'
          }`}
        >
          Vista previa: {monthLabel}
        </button>

        {seasons.map((s) => (
          <div key={s.id} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSeasonId(s.id)}
              className={`px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer ${
                activeSeasonId === s.id
                  ? 'glass-btn-primary text-white'
                  : 'glass-panel text-slate-800 hover:bg-white/80'
              }`}
            >
              {s.title}
            </button>
          </div>
        ))}
      </div>

      {/* EXPORTABLE SEASON SUMMARY SHEET ("Vista de Resumen de Temporada") */}
      <article
        id="season-export-sheet"
        className="print-sheet glass-panel rounded-3xl p-5 sm:p-8 space-y-8"
      >
        {/* Sheet Header + Export Actions */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 pb-6 border-b border-white/70">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <Calendar className="w-3.5 h-3.5" />
              <span>Vista de resumen de Temporada</span>
              <span aria-hidden="true">·</span>
              <span>{displayedSeason.monthLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {cityLabel} ↔ {ranchLabel}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              {displayedSeason.title}
            </h2>
            {displayedSeason.isSaved && displayedSeason.createdAt && (
              <p className="text-xs text-slate-600">
                Guardado el {formatShortDate(displayedSeason.createdAt)}
              </p>
            )}
            {displayedSeason.notes && (
              <p className="text-sm text-slate-700 pt-1 max-w-2xl">
                {displayedSeason.notes}
              </p>
            )}
          </div>

          {/* Export Toolbar */}
          <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-white text-xs font-medium rounded-xl cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="glass-subtle inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-slate-800 text-xs font-medium rounded-xl hover:bg-white/80 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar .md</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="glass-subtle inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-slate-800 text-xs font-medium rounded-xl hover:bg-white/80 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="glass-subtle inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-slate-800 text-xs font-medium rounded-xl hover:bg-white/80 cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-800">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
            {displayedSeason.isSaved && (
              <button
                type="button"
                onClick={async () => {
                  await onDeleteSeason(displayedSeason.id);
                  setActiveSeasonId('live');
                }}
                aria-label="Eliminar reporte guardado"
                className="glass-subtle min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-rose-700 rounded-xl hover:bg-rose-50/80 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4-Card Flow Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-xs font-semibold truncate">
                Hacia {cityLabel}
              </span>
              <Building2 className="w-4 h-4 shrink-0" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
              {displayedSeason.toCityCount}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">prendas llevadas</p>
          </div>

          <div className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-xs font-semibold truncate">
                Hacia {ranchLabel}
              </span>
              <Trees className="w-4 h-4 shrink-0" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
              {displayedSeason.toRanchCount}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">prendas traídas</p>
          </div>

          <div className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-semibold truncate">
                Viajes cerrados
              </span>
              <Luggage className="w-4 h-4 shrink-0" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
              {displayedSeason.completedTripsCount}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">maletas completadas</p>
          </div>

          <div className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold truncate">
                Total traslados
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
              {displayedSeason.totalMovements}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">en {displayedSeason.monthLabel}</p>
          </div>
        </div>

        {/* Directional Flow Bar + Wardrobe Snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-subtle rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Flujo de la temporada
              </h3>
              <span className="text-xs font-mono-tabular text-slate-600">
                {totalDirectional} movimientos direccionales
              </span>
            </div>

            {totalDirectional === 0 ? (
              <p className="text-sm text-slate-600">
                No hubo traslados registrados en {displayedSeason.monthLabel}.
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className="h-4 w-full rounded-full overflow-hidden bg-white/60 flex">
                  {displayedSeason.toCityCount > 0 && (
                    <div
                      style={{ width: `${toCityPercent}%` }}
                      className="h-full bg-blue-700 transition-all"
                    />
                  )}
                  {displayedSeason.toRanchCount > 0 && (
                    <div
                      style={{ width: `${toRanchPercent}%` }}
                      className="h-full bg-emerald-700 transition-all"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-blue-800 font-mono-tabular">
                    {toCityPercent}% rumbo a {cityLabel}
                  </span>
                  <span className="text-emerald-800 font-mono-tabular">
                    {toRanchPercent}% rumbo a {ranchLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-white/60 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-600 truncate">En {cityLabel}</p>
                <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                  {displayedSeason.citySnapshotCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 truncate">En {ranchLabel}</p>
                <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                  {displayedSeason.ranchSnapshotCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 truncate">En Maleta</p>
                <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                  {displayedSeason.bagSnapshotCount}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 glass-subtle rounded-2xl p-5 space-y-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Prendas protagonistas del mes
            </h3>
            {displayedSeason.topMovedNames.length === 0 ? (
              <p className="text-sm text-slate-600">
                Mueve prendas o desempaca una maleta para ver aquí las prendas
                que más viajaron contigo.
              </p>
            ) : (
              <ul className="space-y-2">
                {displayedSeason.topMovedNames.map((name, idx) => (
                  <li
                    key={`${name}-${idx}`}
                    className="flex items-baseline gap-2.5 text-sm text-slate-800"
                  >
                    <span className="text-xs font-mono-tabular text-slate-500 w-5 shrink-0">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span className="font-medium">{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detailed Movements Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Bitácora resumida de {displayedSeason.monthLabel}
            </h3>
            <span className="text-xs font-mono-tabular text-slate-600">
              {displayedSeason.movedSummaryLines.length} registros
            </span>
          </div>

          {displayedSeason.movedSummaryLines.length === 0 ? (
            <div className="glass-subtle rounded-2xl p-6 text-sm text-slate-600">
              Sin movimientos registrados para {displayedSeason.monthLabel}.
            </div>
          ) : (
            <div className="glass-subtle rounded-2xl divide-y divide-white/60">
              {displayedSeason.movedSummaryLines.map((line, idx) => (
                <div key={`${line}-${idx}`} className="px-4 py-2.5 text-sm text-slate-800">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
