'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Target, Zap, ShieldCheck, Rocket } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

const iconMap: Record<string, typeof Sparkles> = {
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  ShieldCheck,
  Rocket
};

export default function LoadingScreen() {
  const { t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  const motivationalQuotes = t.dashboard.loading.motivationalQuotes.map((q: any, idx: number) => {
    const icons = [Sparkles, TrendingUp, Target, Zap, ShieldCheck, Rocket];
    const colors = [
      "from-blue-500 to-indigo-500",
      "from-emerald-500 to-teal-500",
      "from-purple-500 to-pink-500",
      "from-amber-500 to-orange-500",
      "from-cyan-500 to-blue-500",
      "from-rose-500 to-red-500"
    ];
    return {
      ...q,
      icon: icons[idx],
      color: colors[idx]
    };
  });

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length);
    }, 3000); // Muda de frase a cada 3 segundos
    return () => clearInterval(interval);
  }, []);

  const currentQuote = motivationalQuotes[quoteIndex];

  return (
    <div className="fixed inset-0 bg-[#020617] z-[9999] flex items-center justify-center overflow-hidden p-4" role="status" aria-live="polite" aria-label="A carregar">
      {/* Fundo com cores do site: azul/índigo */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-slate-900/80 to-[#020617]" />
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/15 blur-[140px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center max-w-2xl px-8 text-center">
        {/* Logo Finly */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="mb-10"
        >
          <img
            src="/images/logo/logo-semfundo.png"
            alt="Finly"
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-2xl"
            draggable={false}
          />
        </motion.div>

        {/* Loading Spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 sm:mb-12 relative"
          aria-hidden
        >
          <div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-indigo-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </motion.div>

        {/* Motivational Quote */}
        <AnimatePresence mode="wait">
          <motion.div
            key={quoteIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-black tracking-tighter text-white mb-4"
            >
              {currentQuote.title.split(' ').map((word: string, i: number) => (
                <span
                  key={i}
                  className={i % 2 === 1 ? `text-transparent bg-clip-text bg-gradient-to-r ${currentQuote.color} italic` : ''}
                >
                  {word}{' '}
                </span>
              ))}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-slate-400 font-medium italic leading-relaxed max-w-lg mx-auto"
            >
              "{currentQuote.quote}"
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Progress Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-2 mt-12"
        >
          {motivationalQuotes.map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{
                scale: i === quoteIndex ? 1.2 : 0.8,
                opacity: i === quoteIndex ? 1 : 0.3,
                width: i === quoteIndex ? 32 : 8
              }}
              transition={{ duration: 0.3 }}
              className={`h-2 rounded-full ${
                i === quoteIndex
                  ? `bg-gradient-to-r ${currentQuote.color}`
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </motion.div>

        {/* Loading Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-slate-600"
        >
          {t.dashboard.loading.loadingEcosystem}
        </motion.p>
      </div>

      {/* Floating Particles */}
      {mounted && [...Array(6)].map((_, i) => {
        // Usar valores fixos baseados no índice para evitar diferenças entre servidor e cliente
        const baseX = (i % 3) * 200 - 200;
        const baseY = Math.floor(i / 3) * 200 - 200;
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500/20 rounded-full"
            initial={{
              x: baseX,
              y: baseY,
              opacity: 0
            }}
            animate={{
              x: [baseX, baseX + 100, baseX - 100, baseX],
              y: [baseY, baseY - 100, baseY - 200, baseY],
              opacity: [0, 0.5, 0.5, 0],
              scale: [0.5, 1, 1, 0.5]
            }}
            transition={{
              duration: 3 + (i * 0.3),
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeOut"
            }}
          />
        );
      })}
    </div>
  );
}

