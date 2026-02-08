'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';

export default function LoadingScreen() {
  const { t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const motivationalQuotes = t.dashboard?.loading?.motivationalQuotes ?? [];
  const loadingText = t.dashboard?.loading?.loadingEcosystem ?? 'A carregar...';

  useEffect(() => {
    if (motivationalQuotes.length <= 1) return;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [motivationalQuotes.length]);

  const quote = motivationalQuotes[quoteIndex];

  return (
    <div
      className="fixed inset-0 bg-[#020617] text-slate-50 z-[9999] flex items-center justify-center overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="A carregar"
      suppressHydrationWarning
    >
      {/* Background: mesh + grid (sem orbs) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(1000px_circle_at_85%_10%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_50%_95%,rgba(16,185,129,0.10),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] px-4"
      >
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md shadow-2xl p-8 sm:p-10 flex flex-col items-center text-center">
          {/* Logo + nome */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img
              src="/images/logo/logo-semfundo.png"
              alt=""
              className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 object-contain select-none pointer-events-none"
              draggable={false}
            />
            <span
              className="text-white font-semibold tracking-tight text-2xl sm:text-3xl leading-none whitespace-nowrap"
              style={{ fontFamily: 'var(--font-brand), sans-serif' }}
            >
              Finly
            </span>
          </div>

          {/* Spinner */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin shrink-0 mb-6"
            aria-hidden
          />

          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {loadingText}
          </p>

          {quote && (quote.title || quote.quote) && (
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 pt-4 border-t border-slate-700/60 w-full"
              >
                {quote.title && (
                  <p className="text-sm font-semibold text-slate-300 mb-0.5">
                    {quote.title}
                  </p>
                )}
                {quote.quote && (
                  <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                    "{quote.quote}"
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Dots indicadores */}
          {motivationalQuotes.length > 1 && (
            <div className="flex gap-1.5 mt-5" aria-hidden>
              {motivationalQuotes.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === quoteIndex ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
