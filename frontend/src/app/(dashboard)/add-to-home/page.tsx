'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Share, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/LanguageContext';
import { useInstallPrompt } from '@/lib/InstallPromptContext';

/** Detecta iPhone, iPad ou iPod (inclui iPadOS 13+ que reporta como Mac com touch). */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ no Safari pode reportar platform "MacIntel" com multi-touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
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
  const { t } = useTranslation();
  const { deferredPrompt, clearPrompt } = useInstallPrompt();
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  // Deteção no cliente após mount (evita SSR dar sempre false no iPhone)
  useEffect(() => {
    setIos(isIOS());
    setStandalone(isStandalone());
  }, []);

  const addToHome = t?.dashboard?.addToHome;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const { outcome } = await deferredPrompt.prompt();
    if (outcome === 'accepted') setInstalled(true);
    clearPrompt();
  };

  if (standalone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md mx-auto py-12 px-4"
      >
        <div className="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mb-2">{addToHome?.alreadyInApp ?? 'Já estás na app'}</h1>
          <p className="text-slate-400 text-sm mb-6">{addToHome?.alreadyInAppDesc ?? 'Abriste o Finly a partir do ícone no telemóvel.'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20"
          >
            {addToHome?.goToDashboard ?? 'Ir para o dashboard'}
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
          <Smartphone className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          {addToHome?.title ?? 'Finly no telemóvel'}
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          {addToHome?.subtitle ?? 'Adiciona o ícone ao ecrã inicial e abre o Finly como app num toque.'}
        </p>
      </div>

      {/* Info strip */}
      <p className="text-slate-500 text-sm text-center mb-6 px-2">
        {addToHome?.infoStrip ?? 'Android: o botão em baixo abre o diálogo do sistema. iPhone: Partilhar → Adicionar ao Ecrã Inicial.'}
      </p>

      {/* Main card */}
      <div className="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-6 sm:p-8 shadow-2xl space-y-6">
        {(deferredPrompt && !installed) && (
          <button
            type="button"
            onClick={handleInstall}
            className="w-full inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            {addToHome?.button ?? 'Adicionar ao ecrã inicial'}
          </button>
        )}

        {ios && !deferredPrompt && (
          <div className="rounded-2xl bg-slate-950/60 border border-slate-700/60 p-5 sm:p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Share className="w-4 h-4 text-blue-400 shrink-0" />
              {addToHome?.stepsSafari ?? 'Passos no Safari'}
            </p>
            <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside leading-relaxed">
              <li>{addToHome?.step1 ?? 'Carrega no botão Partilhar (quadrado com seta para cima).'}</li>
              <li>{addToHome?.step2 ?? 'Escolhe Adicionar ao Ecrã Inicial.'}</li>
              <li>{addToHome?.step3 ?? 'Carrega em Adicionar.'}</li>
            </ol>
          </div>
        )}

        {!deferredPrompt && !ios && !installed && (
          <div className="rounded-2xl bg-slate-950/60 border border-slate-700/60 p-5 sm:p-6 text-center">
            <p className="text-slate-400 text-sm leading-relaxed">
              {addToHome?.openOnMobile ?? 'Abre esta página no telemóvel (Chrome no Android ou Safari no iPhone) para adicionar o Finly ao ecrã inicial.'}
            </p>
            <p className="text-slate-500 text-xs mt-3 uppercase tracking-wider font-medium">
              {addToHome?.androidManual ?? 'Android: Menu (⋮) → "Adicionar ao ecrã inicial" ou "Instalar app".'}
            </p>
          </div>
        )}

        {installed && (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">{addToHome?.installed ?? 'Ícone adicionado. Procura o Finly no ecrã inicial.'}</span>
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
          {addToHome?.backToDashboard ?? 'Voltar ao dashboard'}
        </Link>
      </div>
    </motion.div>
  );
}
