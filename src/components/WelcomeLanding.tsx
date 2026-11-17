import { useState } from 'react';
import { ArrowRight, Building2, CheckSquare, Luggage, Trees } from 'lucide-react';

interface WelcomeLandingProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  authError: string | null;
}

export function WelcomeLanding({
  onSignIn,
  isSigningIn,
  authError,
}: WelcomeLandingProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-slate-700">
              Para estudiantes y foráneos entre dos casas
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.08] text-balance">
              Controla tu ropa entre la Ciudad y tu Rancho.
            </h1>
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-xl">
              Deja de adivinar si tu chamarra favorita se quedó en el cuarto de
              la Ciudad o en el clóset del Rancho. Registra cada prenda, arma tu
              maleta antes de viajar y confirma qué llegó contigo.
            </p>

            {authError && (
              <p className="text-sm text-rose-800 glass-panel rounded-xl px-4 py-3 border-rose-200/80">
                {authError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn}
                className="glass-btn-primary inline-flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] text-white text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
              >
                <span>
                  {isSigningIn
                    ? 'Iniciando sesión...'
                    : 'Comenzar con Google'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600">
                Sincronizado en la nube · Celular y computadora
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] lg:min-h-[380px] rounded-2xl overflow-hidden glass-panel p-1.5">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/wardrobe_city_ranch_1794894108673.jpg"
                  alt="Maleta de viaje abierta con ropa doblada lista para viajar entre la ciudad y el rancho"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center rounded-[14px] glass-subtle">
                  <Luggage className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="font-display text-lg font-semibold text-slate-900">
                    Tu guardarropa en dos ubicaciones
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    La Ciudad · En Maleta · El Rancho
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          id="como-funciona"
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div
            id="control-ubicacion"
            className="glass-panel rounded-2xl p-5 space-y-2"
          >
            <div className="flex items-center gap-2 text-blue-700">
              <Building2 className="w-5 h-5" />
              <span className="text-sm font-semibold">La Ciudad</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Consulta al instante las playeras, pantalones y ropa formal que
              dejaste en tu cuarto o depa.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800">
              <Trees className="w-5 h-5" />
              <span className="text-sm font-semibold">El Rancho</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Identifica qué ropa dejaste en casa de tu familia para no volver a
              cargar peso de más.
            </p>
          </div>

          <div
            id="armar-maleta"
            className="glass-panel rounded-2xl p-5 space-y-2"
          >
            <div className="flex items-center gap-2 text-amber-700">
              <Luggage className="w-5 h-5" />
              <span className="text-sm font-semibold">Armar maleta</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Crea una lista de viaje, palomea lo que metes a la mochila y
              desempaca todo en un toque al llegar.
            </p>
          </div>

          <div
            id="pendientes-lavado"
            className="glass-panel rounded-2xl p-5 space-y-2"
          >
            <div className="flex items-center gap-2 text-slate-900">
              <CheckSquare className="w-5 h-5" />
              <span className="text-sm font-semibold">Lavado y gráficas</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Revisa qué ropa está por lavar, dónde quedaron tus básicos y
              consulta gráficas de distribución.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
