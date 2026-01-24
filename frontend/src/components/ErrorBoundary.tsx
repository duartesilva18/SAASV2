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
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: any): State {
    // Converter qualquer tipo de erro para string de forma segura
    let errorMessage = '';
    let errorObj: Error | null = null;
    
    if (error instanceof Error) {
      errorObj = error;
      errorMessage = error.message || error.toString();
    } else if (typeof error === 'object' && error !== null) {
      // Se for um objeto (ex: erro de validação do Pydantic)
      try {
        errorMessage = JSON.stringify(error, null, 2);
      } catch {
        errorMessage = String(error);
      }
      errorObj = new Error(errorMessage);
    } else {
      errorMessage = String(error);
      errorObj = new Error(errorMessage);
    }
    
    return {
      hasError: true,
      error: errorObj,
      errorMessage,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorMessage: '',
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/60 border border-red-500/20 rounded-[32px] p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500" size={32} />
            </div>
            
            <h1 className="text-2xl font-black text-white mb-3">
              Oops! Algo correu mal
            </h1>
            
            <p className="text-slate-400 mb-6 text-sm">
              Ocorreu um erro inesperado. Por favor, tenta novamente.
            </p>

            {this.state.errorMessage && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-slate-500 cursor-pointer mb-2">
                  Detalhes técnicos
                </summary>
                <pre className="text-[10px] text-red-400 bg-slate-950 p-3 rounded-lg overflow-auto max-h-32">
                  {this.state.errorMessage}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
              >
                <RefreshCw size={16} />
                Tentar Novamente
              </button>
              
              <Link
                href="/dashboard"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
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

