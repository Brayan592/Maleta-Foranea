import { BarChart3, History, ListChecks, Luggage, Plus, Shirt } from 'lucide-react';

export type AppTab = 'inventario' | 'maletas' | 'estadisticas' | 'pendientes' | 'historial';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onPrimaryAction: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'inventario', label: 'Inventario' },
  { id: 'maletas', label: 'Maletas' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'historial', label: 'Historial' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onPrimaryAction,
}: TopBarProps) {
  return (
    <>
      <header className="no-print glass-header border-b md:sticky md:top-0 md:z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('inventario')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
          >
            Maleta Foránea
          </button>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-6 lg:gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    active
                      ? 'text-slate-900 border-slate-900'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-400/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="glass-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-white text-sm font-medium rounded-xl active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Agregar prenda</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navegación móvil"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 glass-header border-t grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => onSelectTab('inventario')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
            activeTab === 'inventario' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <Shirt className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
            Inventario
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('maletas')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
            activeTab === 'maletas' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <Luggage className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
            Maletas
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('estadisticas')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
            activeTab === 'estadisticas' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
            Estadísticas
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('pendientes')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
            activeTab === 'pendientes' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
            Pendientes
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('historial')}
          className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
            activeTab === 'historial' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <History className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
            Historial
          </span>
        </button>
      </nav>
    </>
  );
}
