import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application UI:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Algo no salió como esperábamos</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ocurrió un inconveniente temporal en la interfaz. Hemos aislado la falla para proteger la estabilidad de la plataforma.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-left overflow-x-auto max-h-32">
                <code className="text-[10px] text-zinc-500 font-mono break-all">
                  {this.state.error.message || 'Error de renderizado de componente'}
                </code>
              </div>
            )}

            <div className="flex items-center gap-3 w-full pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white transition flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Carga</span>
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-bold text-xs text-zinc-300 hover:text-white transition flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
