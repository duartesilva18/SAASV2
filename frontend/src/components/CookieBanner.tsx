'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/LanguageContext';

// Helper function para verificar consentimento (exportada para uso global)
export function getCookieConsent(): 'all' | 'essential' | null {
  if (typeof window === 'undefined') return null;
  const consent = localStorage.getItem('cookie-consent');
  return consent as 'all' | 'essential' | null;
}

// Helper function para verificar se analytics podem ser carregados
export function canLoadAnalytics(): boolean {
  const consent = getCookieConsent();
  return consent === 'all';
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', 'all');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
    // Aqui podes carregar scripts de analytics se necessário
    if (canLoadAnalytics()) {
      // Exemplo: carregar Google Analytics, etc.
      console.log('Analytics cookies ativados');
    }
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('cookie-consent', 'essential');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
    // Não carregar analytics
    console.log('Apenas cookies essenciais ativados');
  };

  const handleDeclineAll = () => {
    localStorage.setItem('cookie-consent', 'essential');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    // Guardar como "essential" se fechar sem escolher
    if (!localStorage.getItem('cookie-consent')) {
      localStorage.setItem('cookie-consent', 'essential');
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-md z-[200]"
        >
          <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-slate-800 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] rounded-full -z-10" />
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
                <Cookie size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight mb-1">
                  {t.cookies.title}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Utilizamos cookies para melhorar a sua experiência, analisar o tráfego e personalizar conteúdos. Alguns são essenciais para o Finly funcionar.{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    Política de Privacidade
                  </Link>.
                </p>
              </div>
            </div>

            {!showSettings ? (
              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAcceptAll}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  <ShieldCheck size={18} />
                  {t.cookies.acceptAll}
                </motion.button>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={handleAcceptEssential}
                    className="py-3 px-4 border border-slate-800 text-slate-400 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all hover:text-white cursor-pointer"
                  >
                    {t.cookies.declineAll}
                  </motion.button>
                  <motion.button
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={() => setShowSettings(true)}
                    className="py-3 px-4 border border-slate-800 text-slate-400 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all hover:text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {t.cookies.settings}
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold text-sm">Definições de Cookies</h4>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl">
                    <div>
                      <p className="text-white text-xs font-bold mb-1">Cookies Essenciais</p>
                      <p className="text-slate-400 text-[10px]">Necessários para o funcionamento do site</p>
                    </div>
                    <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1">
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl">
                    <div>
                      <p className="text-white text-xs font-bold mb-1">Cookies de Analytics</p>
                      <p className="text-slate-400 text-[10px]">Para melhorar a experiência</p>
                    </div>
                    <button
                      onClick={handleAcceptAll}
                      className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1 cursor-pointer"
                    >
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAcceptAll}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Guardar Preferências
                  </motion.button>
                  <motion.button
                    whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    onClick={handleDeclineAll}
                    className="flex-1 py-3 border border-slate-800 text-slate-400 rounded-xl font-bold text-xs transition-all hover:text-white cursor-pointer"
                  >
                    Apenas Essenciais
                  </motion.button>
                </div>
              </div>
            )}
            
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer"
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

