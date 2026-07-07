'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/LanguageContext';

// Helper para verificar consentimento (exportada para uso global)
export function getCookieConsent(): 'all' | 'essential' | null {
  if (typeof window === 'undefined') return null;
  const consent = localStorage.getItem('cookie-consent');
  return consent as 'all' | 'essential' | null;
}

// True se o utilizador consentiu analytics — QUALQUER script de análise deve
// verificar isto antes de carregar (hoje ainda não usamos nenhum).
export function canLoadAnalytics(): boolean {
  return getCookieConsent() === 'all';
}

// Reabrir o painel de cookies a partir de qualquer página (footer, /privacy, definições)
export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('finly:cookie-settings'));
  }
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Toggle REAL de analytics no painel (o antigo era decorativo e aceitava tudo)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  const ck = (t as any).cookies ?? {};

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Reabrir a partir de qualquer sítio (link "Cookies" no footer, /privacy, definições)
  useEffect(() => {
    const open = () => {
      setAnalyticsEnabled(getCookieConsent() !== 'essential');
      setShowSettings(true);
      setIsVisible(true);
    };
    window.addEventListener('finly:cookie-settings', open);
    return () => window.removeEventListener('finly:cookie-settings', open);
  }, []);

  const persist = useCallback((consent: 'all' | 'essential') => {
    localStorage.setItem('cookie-consent', consent);
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
    setShowSettings(false);
    // Notificar AnalyticsLoader sobre mudança de consentimento
    window.dispatchEvent(new CustomEvent('finly:consent-changed', { detail: { consent } }));
  }, []);

  const handleAcceptAll = () => persist('all');
  const handleEssentialOnly = () => persist('essential');
  const handleSaveSettings = () => persist(analyticsEnabled ? 'all' : 'essential');

  const handleClose = () => {
    setIsVisible(false);
    setShowSettings(false);
    // Fechar sem escolher = só essenciais (a opção mais conservadora)
    if (!localStorage.getItem('cookie-consent')) {
      persist('essential');
    }
  };

  if (!isVisible) return null;

  const Toggle = ({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick?: () => void }) => (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      aria-checked={on}
      role="switch"
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${locked ? 'bg-blue-600/60 cursor-not-allowed' : on ? 'bg-blue-600 cursor-pointer' : 'bg-slate-700 cursor-pointer'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-4 md:left-auto md:right-8 md:max-w-md z-[200]"
        >
          <div className="bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] rounded-full -z-10" />
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
                <Cookie size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight mb-1">
                  {ck.title ?? 'Respeitamos a sua privacidade 🍪'}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {ck.description ?? 'Utilizamos cookies para melhorar a sua experiência. Alguns são essenciais para o Finly funcionar.'}{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    {ck.privacyPolicy ?? 'Política de Privacidade'}
                  </Link>.
                </p>
              </div>
            </div>

            {!showSettings ? (
              <div className="flex flex-col gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAcceptAll}
                  className="w-full py-3.5 sm:py-4 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  <ShieldCheck size={18} />
                  {ck.acceptAll ?? 'Aceitar Todos'}
                </motion.button>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={handleEssentialOnly}
                    className="py-3 px-4 min-h-[44px] border border-slate-800 text-slate-400 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all hover:text-white cursor-pointer active:scale-[0.98]"
                  >
                    {ck.declineAll ?? 'Apenas Essenciais'}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={() => { setAnalyticsEnabled(getCookieConsent() !== 'essential'); setShowSettings(true); }}
                    className="py-3 px-4 min-h-[44px] border border-slate-800 text-slate-400 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all hover:text-white flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                  >
                    {ck.settings ?? 'Definições'}
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold text-sm">{ck.settingsTitle ?? 'Definições de Cookies'}</h4>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="min-w-[44px] min-h-[44px] -m-2 p-2 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer rounded-xl active:scale-95"
                    aria-label="Fechar definições"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold mb-1">{ck.essentialTitle ?? 'Essenciais'}</p>
                      <p className="text-slate-400 text-[10px]">{ck.essentialDesc ?? 'Sessão e segurança da conta. Sem estes, o Finly não funciona.'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Toggle on locked />
                      <span className="text-[8px] font-bold uppercase text-slate-600">{ck.alwaysOn ?? 'Sempre ativos'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold mb-1">{ck.functionalTitle ?? 'Preferências'}</p>
                      <p className="text-slate-400 text-[10px]">{ck.functionalDesc ?? 'Guardam o idioma, a moeda e o tema que escolheste.'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Toggle on locked />
                      <span className="text-[8px] font-bold uppercase text-slate-600">{ck.alwaysOn ?? 'Sempre ativos'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold mb-1">{ck.analyticsTitle ?? 'Analytics'}</p>
                      <p className="text-slate-400 text-[10px]">{ck.analyticsDesc ?? 'Estatísticas anónimas de utilização. Neste momento não usamos nenhum serviço — se um dia ativarmos, só corre com o teu OK aqui.'}</p>
                    </div>
                    <Toggle on={analyticsEnabled} onClick={() => setAnalyticsEnabled(v => !v)} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveSettings}
                    className="flex-1 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {ck.savePreferences ?? 'Guardar Preferências'}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={handleEssentialOnly}
                    className="flex-1 py-3 min-h-[44px] border border-slate-800 text-slate-400 rounded-xl font-bold text-xs transition-all hover:text-white cursor-pointer active:scale-[0.98]"
                  >
                    {ck.declineAll ?? 'Apenas Essenciais'}
                  </motion.button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 min-w-[44px] min-h-[44px] -m-2 p-2 flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer rounded-xl active:scale-95"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
