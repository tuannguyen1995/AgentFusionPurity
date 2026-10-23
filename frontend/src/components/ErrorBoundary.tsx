import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-6">
          <div className="bg-[#0D081B] border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-space text-white mb-2">Reactor Telemetry Render Error</h3>
            <p className="text-slate-400 text-sm mb-6">
              {this.state.error?.message || 'An unexpected error occurred while rendering the nuclear plasma radar.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-violet-500 transition shadow-lg shadow-cyan-500/20"
            >
              <RefreshCw className="w-4 h-4" /> Reload System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
