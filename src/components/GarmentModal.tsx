import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  CATEGORY_OPTIONS,
  LIMITS,
  type Garment,
  type GarmentFormValues,
  type GarmentLocation,
  type LaundryStatus,
  type UserProfile,
} from '../types';

interface GarmentModalProps {
  isOpen: boolean;
  editingGarment: Garment | null;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (values: GarmentFormValues, existingGarment: Garment | null) => Promise<void>;
}

const DEFAULT_FORM: GarmentFormValues = {
  name: '',
  category: 'playeras',
  color: '',
  location: 'ciudad',
  targetLocation: 'ninguno',
  laundryStatus: 'limpia',
  isEssential: false,
  notes: '',
  quantity: 1,
};

export function GarmentModal({
  isOpen,
  editingGarment,
  profile,
  onClose,
  onSave,
}: GarmentModalProps) {
  const [form, setForm] = useState<GarmentFormValues>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityLabel = profile?.cityLabel || 'La Ciudad';
  const ranchLabel = profile?.ranchLabel || 'El Rancho';

  useEffect(() => {
    if (editingGarment) {
      setForm({
        name: editingGarment.name,
        category: editingGarment.category,
        color: editingGarment.color,
        location: editingGarment.location,
        targetLocation: editingGarment.targetLocation,
        laundryStatus: editingGarment.laundryStatus,
        isEssential: editingGarment.isEssential,
        notes: editingGarment.notes,
        quantity: editingGarment.quantity,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [editingGarment, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Escribe el nombre de la prenda.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form, editingGarment);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la prenda.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/35 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="garment-modal-title"
    >
      <div className="bg-white/85 backdrop-blur-2xl border border-white/80 shadow-2xl w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/70 sticky top-0 bg-white/70 backdrop-blur-xl z-10">
          <h2
            id="garment-modal-title"
            className="font-display text-lg font-semibold text-slate-900"
          >
            {editingGarment ? 'Editar prenda' : 'Agregar prenda'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white/70 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <p className="text-sm text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="garment-name"
              className="block text-sm font-medium text-slate-800 mb-1.5"
            >
              Nombre de la prenda
            </label>
            <input
              id="garment-name"
              type="text"
              required
              maxLength={LIMITS.NAME_MAX}
              placeholder="Ej. Chamarra negra impermeable"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="garment-category"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Categoría
              </label>
              <select
                id="garment-category"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as GarmentFormValues['category'],
                  })
                }
                className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="garment-color"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Color o detalle
              </label>
              <input
                id="garment-color"
                type="text"
                maxLength={LIMITS.COLOR_MAX}
                placeholder="Ej. Azul marino"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="glass-input w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-800 mb-1.5">
              ¿Dónde está ahorita?
            </span>
            <div className="glass-track grid grid-cols-3 gap-2 p-1 rounded-xl">
              {(
                [
                  { value: 'ciudad', label: cityLabel },
                  { value: 'rancho', label: ranchLabel },
                  { value: 'maleta', label: 'En Maleta' },
                ] as { value: GarmentLocation; label: string }[]
              ).map((loc) => (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      location: loc.value,
                      targetLocation:
                        loc.value === 'maleta'
                          ? form.targetLocation === 'ninguno'
                            ? 'ciudad'
                            : form.targetLocation
                          : 'ninguno',
                    })
                  }
                  className={`py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors truncate cursor-pointer ${
                    form.location === loc.value
                      ? 'bg-white/95 text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          {form.location === 'maleta' && (
            <div>
              <span className="block text-sm font-medium text-slate-800 mb-1.5">
                ¿Hacia dónde la llevas?
              </span>
              <div className="glass-track grid grid-cols-2 gap-2 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, targetLocation: 'ciudad' })}
                  className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    form.targetLocation === 'ciudad'
                      ? 'bg-white/95 text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rumbo a {cityLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, targetLocation: 'rancho' })}
                  className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    form.targetLocation === 'rancho'
                      ? 'bg-white/95 text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rumbo a {ranchLabel}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-800 mb-1.5">
                Estado de lavado
              </span>
              <div className="glass-track grid grid-cols-2 gap-2 p-1 rounded-xl">
                {(
                  [
                    { value: 'limpia', label: 'Limpia' },
                    { value: 'por_lavar', label: 'Por lavar' },
                  ] as { value: LaundryStatus; label: string }[]
                ).map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setForm({ ...form, laundryStatus: st.value })}
                    className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      form.laundryStatus === st.value
                        ? 'bg-white/95 text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="garment-qty"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Cantidad (piezas o pares)
              </label>
              <input
                id="garment-qty"
                type="number"
                min={LIMITS.QUANTITY_MIN}
                max={LIMITS.QUANTITY_MAX}
                value={form.quantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quantity: Math.max(
                      1,
                      Math.min(99, Number(e.target.value) || 1)
                    ),
                  })
                }
                className="glass-input w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="garment-notes"
              className="block text-sm font-medium text-slate-800 mb-1.5"
            >
              Nota rápida (opcional)
            </label>
            <textarea
              id="garment-notes"
              rows={2}
              maxLength={LIMITS.NOTES_MAX}
              placeholder="Ej. Guardada en el cajón de abajo o prestada a mi hermano"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="glass-input w-full px-3.5 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>

          <label className="glass-subtle flex items-start gap-3 p-3.5 rounded-xl cursor-pointer hover:bg-white/75 transition-colors">
            <input
              type="checkbox"
              checked={form.isEssential}
              onChange={(e) =>
                setForm({ ...form, isEssential: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <div>
              <span className="block text-sm font-medium text-slate-900">
                Prenda esencial (siempre ubicar)
              </span>
              <span className="block text-xs text-slate-600 mt-0.5">
                Aparecerá destacada en Pendientes para no olvidarla antes de
                viajar.
              </span>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-white/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="glass-btn-primary px-5 py-2.5 min-h-[40px] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving
                ? 'Guardando...'
                : editingGarment
                  ? 'Guardar cambios'
                  : 'Guardar prenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
