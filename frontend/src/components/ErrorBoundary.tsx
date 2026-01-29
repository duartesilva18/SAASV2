'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md w-full bg-slate-900/60 border border-red-500/20 rounded-2xl sm:rounded-[32px] p-5 sm:p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500" size={32} />
            </div>
            
            <h1 className="text-2xl font-black text-white mb-3">
              Oops! Algo correu mal
            </h1>
            
            <p className="text-slate-400 mb-6 text-sm">
              Ocorreu um erro inesperado. Por favor, tenta novamente.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-slate-500 cursor-pointer mb-2">
                  Detalhes técnicos
                </summary>
                <pre className="text-[10px] text-red-400 bg-slate-950 p-3 rounded-lg overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer active:scale-[0.98]"
              >
                <RefreshCw size={16} />
                Tentar Novamente
              </button>
              <Link
                href="/dashboard"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer active:scale-[0.98]"
              >
                <Home size={16} />
                Início
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

