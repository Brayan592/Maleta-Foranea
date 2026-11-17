import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const friendlyMessage =
        this.state.message ||
        'Tuvimos un problema inesperado al cargar tus datos locales. Por favor recarga la aplicación.';

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                Algo salió mal
              </h1>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="glass-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recargar aplicación</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
