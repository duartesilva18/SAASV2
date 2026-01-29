'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Share, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<{ outcome: string }> };

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export default function AddToHomePage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios] = useState(() => typeof window !== 'undefined' && isIOS());
  const [standalone] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const { outcome } = await deferredPrompt.prompt();
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  if (standalone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md mx-auto py-12 px-4"
      >
        <div className="rounded-3xl bg-slate-800/40 border border-slate-700/60 p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Já estás na app</h1>
          <p className="text-slate-400 text-sm mb-6">Abriste o Finly a partir do ícone no telemóvel.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-slate-200 font-medium text-sm hover:bg-slate-600 transition-colors"
          >
            Ir para o dashboard
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-lg mx-auto py-6 sm:py-10 px-4"
    >
      {/* Hero */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 mb-6">
          <Smartphone className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
          Finly no telemóvel
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          Adiciona o ícone ao ecrã inicial e abre o Finly como app num toque.
        </p>
      </div>

      {/* Info strip */}
      <p className="text-slate-500 text-sm text-center mb-6 px-2">
        <span className="text-slate-400">Android:</span> o botão em baixo abre o diálogo do sistema. <span className="text-slate-400">iPhone:</span> Partilhar → Adicionar ao Ecrã Inicial.
      </p>

      {/* Main card */}
      <div className="rounded-3xl bg-slate-800/40 border border-slate-700/60 p-6 sm:p-8 shadow-xl space-y-6">
        {(deferredPrompt && !installed) && (
          <button
            type="button"
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 sm:py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-colors shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            Adicionar ao ecrã inicial
          </button>
        )}

        {ios && !deferredPrompt && (
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/50 p-5 sm:p-6 space-y-4">
            <p className="text-slate-300 font-semibold flex items-center gap-2 text-sm">
              <Share className="w-4 h-4 text-blue-400 shrink-0" />
              Passos no Safari
            </p>
            <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside leading-relaxed">
              <li>Carrega no botão <strong className="text-slate-300">Partilhar</strong> (quadrado com seta para cima).</li>
              <li>Escolhe <strong className="text-slate-300">Adicionar ao Ecrã Inicial</strong>.</li>
              <li>Carrega em <strong className="text-slate-300">Adicionar</strong>.</li>
            </ol>
          </div>
        )}

        {!deferredPrompt && !ios && !installed && (
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/50 p-5 sm:p-6 text-center">
            <p className="text-slate-400 text-sm leading-relaxed">
              Abre esta página no <strong className="text-slate-300">telemóvel</strong> (Chrome no Android ou Safari no iPhone) para adicionar o Finly ao ecrã inicial.
            </p>
            <p className="text-slate-500 text-xs mt-3">
              Android: Menu (⋮) → &quot;Adicionar ao ecrã inicial&quot; ou &quot;Instalar app&quot;.
            </p>
          </div>
        )}

        {installed && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">Ícone adicionado. Procura o Finly no ecrã inicial.</span>
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao dashboard
        </Link>
      </div>
    </motion.div>
  );
}
