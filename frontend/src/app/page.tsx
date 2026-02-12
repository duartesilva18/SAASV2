'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ArrowRight, ShieldCheck, Zap, Trophy, MessageSquare,
  BarChart3, Globe, Star, CheckCircle2, Phone, Crown, Check, Send
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { LanguageCode, LanguageConfig, FLAG_IMAGE_URLS } from '@/lib/languages';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import { STRIPE_PRICE_IDS } from '@/lib/stripePrices';

function AnimatedTelegram() {
  return <span className="inline-block mx-1 font-black text-blue-400">Telegram</span>;
}

const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };
const stagger = (i: number) => ({ transition: { delay: i * 0.08 } });

export default function LandingPage() {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { user } = useUser();
  const router = useRouter();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const scrollProgressRef = useRef<HTMLDivElement>(null);

  // Simulador Telegram: resultado da primeira mensagem (Confirmar/Cancelar) e mensagens dinâmicas
  const defaultSimMessages: { user: string; bot: string; outcome?: 'confirmed' | 'cancelled' }[] = [
    { user: 'Biscoitos 10€', bot: 'Nova transação\n📝 Biscoitos\n💰 €10.00\n🏷️ Alimentação\n\nConfirmar?' },
    { user: 'Uber - Transporte 15€', bot: 'Nova transação\n📝 Uber\n💰 €15.00\n🏷️ Transporte\n\nConfirmar?' },
    { user: 'Salário 1500€', bot: 'Nova transação\n📝 Salário\n💰 €1.500,00\n🏷️ Receita\n\nConfirmar?' },
  ];
  const [simMessages, setSimMessages] = useState(defaultSimMessages);
  const [simInput, setSimInput] = useState('');
  const simConfirmLabel = (t.dashboard?.guide as any)?.confirm ?? '✓ Confirmar';
  const simCancelLabel = (t.dashboard?.guide as any)?.cancel ?? '✗ Cancelar';
  const simAddedLabel = (t.dashboard?.guide as any)?.added ?? '✓ Adicionada!';
  const simCancelledLabel = (t.dashboard?.guide as any)?.cancelled ?? 'Cancelada.';
  const simChatScrollRef = useRef<HTMLDivElement>(null);

  // Scroll do simulador para baixo quando chega nova mensagem do bot
  useEffect(() => {
    if (simChatScrollRef.current && simMessages.length > 3) {
      simChatScrollRef.current.scrollTo({ top: simChatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [simMessages.length]);

  // Barra de progresso de scroll -- manipulação direta do DOM (sem re-render)
  useEffect(() => {
    const onScroll = () => {
      if (!scrollProgressRef.current) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 100;
      scrollProgressRef.current.style.width = `${pct}%`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Finly",
    "alternateName": ["Finly Bot", "finlybot"],
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web, Telegram",
    "offers": { "@type": "Offer", "price": "9.99", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "2800" },
    "description": t.hero.description,
    "featureList": t.resources.items.slice(0, 5).map((r: { d: string }) => r.d.split('.')[0])
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="min-h-[100dvh] bg-[#020617] text-white selection:bg-blue-500/30 overflow-x-hidden relative">
        {/* Background: igual ao login (mesh + grid, sem orbs) */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_20%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(1000px_circle_at_85%_10%,rgba(99,102,241,0.10),transparent_55%),radial-gradient(900px_circle_at_50%_95%,rgba(16,185,129,0.06),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        {/* Banner — pill compacta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative flex justify-center px-4 pt-3 sm:pt-4"
          style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
        >
          <p className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/40 px-3 py-1.5 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-slate-400">
            <Sparkles className="h-3 w-3 text-amber-400/80" aria-hidden />
            {t.banner}
          </p>
        </motion.div>

        {/* Nav — sticky; compacto no mobile, proporcional no desktop */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="sticky top-0 z-50 mx-2 sm:mx-6 lg:mx-8 mt-2 sm:mt-3 rounded-xl sm:rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-black/20"
          style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))', marginLeft: 'max(0.5rem, env(safe-area-inset-left))', marginRight: 'max(0.5rem, env(safe-area-inset-right))' }}
        >
          <div className="max-w-[90rem] mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 min-h-[44px] sm:min-h-0">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 min-w-0 rounded-lg py-1 pr-1 -ml-1 active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 touch-manipulation"
            >
              <img src="/images/logo/logo-semfundo.png" alt="Finly" className="h-8 w-8 sm:h-11 sm:w-11 object-contain shrink-0" draggable={false} />
              <span className="text-white font-bold tracking-tight text-xl sm:text-3xl truncate" style={{ fontFamily: 'var(--font-brand), sans-serif' }}>
                Finly
              </span>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center justify-center h-10 w-10 sm:h-10 sm:w-auto sm:min-w-[36px] sm:px-3 rounded-lg border border-slate-600/60 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 touch-manipulation"
                  aria-label="Language"
                >
                  <img src={FLAG_IMAGE_URLS[language]} alt="" className="w-4 h-3 sm:w-[18px] sm:h-3.5 object-cover rounded-sm shrink-0" width={24} height={16} />
                  <span className="text-[10px] sm:text-xs font-medium hidden sm:inline ml-1.5">{availableLanguages[language]?.code.toUpperCase()}</span>
                </button>
                <AnimatePresence>
                  {showLanguageMenu && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setShowLanguageMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-xl overflow-hidden z-50 min-w-[140px] sm:min-w-[160px]"
                      >
                        {Object.values(availableLanguages)
                          .filter((lang): lang is LanguageConfig => lang != null && lang.code != null)
                          .map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => { setLanguage(lang.code as LanguageCode); setShowLanguageMenu(false); }}
                              className={`w-full px-3 sm:px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-white/5 transition-colors cursor-pointer touch-manipulation ${language === lang.code ? 'bg-blue-500/15 text-blue-400' : 'text-slate-300'}`}
                            >
                              <img src={FLAG_IMAGE_URLS[lang.code]} alt="" className="w-5 h-3.5 object-cover rounded-sm shrink-0" width={24} height={16} />
                              <span className="text-sm font-medium">{lang.nativeName}</span>
                              {language === lang.code && <CheckCircle2 size={14} className="ml-auto text-blue-400 shrink-0" />}
                            </button>
                          ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/auth/login"
                  className="h-10 min-h-[44px] flex items-center justify-center px-3 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm text-slate-300 hover:text-white border border-slate-600/60 hover:border-slate-500/60 hover:bg-slate-700/40 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 touch-manipulation shrink-0"
                >
                  {(t.nav as { loginButton?: string })?.loginButton ?? 'Entrar'}
                </Link>
                <Link
                  href="/auth/register"
                  className="h-10 min-h-[44px] flex items-center justify-center px-3 sm:px-4 rounded-lg font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-900/30 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 touch-manipulation shrink-0"
                >
                  {t.nav.register}
                </Link>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Barra de progresso — no topo, safe area; fina em mobile; manipulada via ref (sem re-render) */}
        <div className="fixed left-0 right-0 z-[60] h-0.5 sm:h-1.5 bg-slate-800/80 overflow-hidden pointer-events-none" style={{ top: 'env(safe-area-inset-top)' }}>
          <div
            ref={scrollProgressRef}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-[width] duration-150 ease-out"
            style={{ width: '0%' }}
          />
        </div>

        {/* Hero — destaque, título e CTAs; mobile-first; compacto abaixo de 3xl */}
        <section id="hero" className="relative pt-8 sm:pt-16 md:pt-24 3xl:pt-32 pb-10 sm:pb-16 md:pb-20 3xl:pb-24 overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent pointer-events-none" />

          <div className="max-w-6xl mx-auto px-2 sm:px-5 lg:px-8 relative z-10 text-center">
            <motion.div {...fadeUp} {...stagger(0)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-700/60 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">
              <Sparkles size={12} className="sm:w-4 sm:h-4 3xl:w-[18px] 3xl:h-[18px] shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-none">{t.hero.badge}</span>
            </motion.div>
            <motion.h1 {...fadeUp} {...stagger(1)} className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl 3xl:text-7xl 4xl:text-8xl font-black tracking-tighter leading-[1.08] max-w-5xl mx-auto mb-3 sm:mb-5 3xl:mb-7 4xl:mb-9 px-1">
              {t.hero.title1}
              <span className="italic bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">{' '}{t.hero.titleAccent}</span>
              {t.hero.title2}
            </motion.h1>
            <motion.p {...fadeUp} {...stagger(2)} className="text-slate-400 text-xs sm:text-sm md:text-base 3xl:text-lg 4xl:text-xl max-w-2xl mx-auto mb-4 sm:mb-8 3xl:mb-10 4xl:mb-12 px-1 leading-relaxed">
              {t.hero.description.split('Telegram').map((part, i, arr) => (
                <React.Fragment key={i}>{part}{i < arr.length - 1 && <AnimatedTelegram />}</React.Fragment>
              ))}
            </motion.p>
            <motion.div {...fadeUp} {...stagger(3)} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-sm sm:max-w-none mx-auto">
              <Link href="/auth/register" className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 min-h-[44px] rounded-xl text-sm font-black uppercase tracking-wider active:scale-[0.98] transition-all">
                {t.hero.cta}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
              <Link href="#telegram-simulator" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[44px] rounded-xl text-sm font-bold uppercase tracking-wider border border-slate-700/60 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all active:scale-[0.98]">
                {t.hero.seeHow}
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Secção com simulador de Telegram — em mobile espaço abaixo para o botão não ficar cortado */}
        <section id="telegram-simulator" className="relative px-3 sm:px-4 md:px-5 py-6 sm:py-10 md:py-14 3xl:py-24 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-10 md:pb-14 3xl:pb-24">
          <div className="max-w-[90rem] mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              className="relative"
            >
              <div className="relative bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col lg:flex-row items-center gap-6 lg:gap-10 overflow-hidden">
                {/* Coluna esquerda: texto + formas de escrever */}
                <div className="flex-1 space-y-3 sm:space-y-5 md:space-y-6 3xl:space-y-8 relative z-10 w-full min-w-0">
                  <div className="inline-flex items-center gap-2 bg-slate-900/50 border border-slate-700/60 px-3 py-1.5 rounded-full text-blue-400 text-xs font-bold uppercase tracking-widest">
                    <Send size={11} className="sm:w-3.5 sm:h-3.5 3xl:w-4 3xl:h-4 shrink-0" />
                    <span className="truncate">{(t.dashboard?.guide as any)?.telegramBot ?? 'Bot Telegram'}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl 3xl:text-5xl 4xl:text-6xl font-black text-white uppercase tracking-tighter leading-tight">
                    {(t.dashboard?.guide as any)?.registerInTelegram ?? 'Regista em '}
                    <span className="text-blue-400 italic">{(t.dashboard?.guide as any)?.registerInTelegramAccent ?? 'Telegram'}</span>
                    {' '}{(t.dashboard?.guide as any)?.registerInTelegramSeconds ?? 'em segundos.'}
                  </h2>
                  <p className="text-slate-400 text-[11px] sm:text-xs md:text-sm 3xl:text-lg leading-relaxed max-w-xl">
                    {(t.dashboard?.guide as any)?.multipleWays ?? 'Múltiplas formas de escrever. Especifica a categoria com um hífen ou deixa a IA categorizar.'}
                  </p>
                  <div className="bg-slate-950/60 border border-slate-700/60 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{(t.dashboard?.guide as any)?.waysToWrite ?? 'Formas de escrever:'}</h3>
                    <ul className="space-y-1 sm:space-y-1.5 md:space-y-2 3xl:space-y-3 4xl:space-y-4 text-slate-400 text-[10px] sm:text-[11px] md:text-xs 3xl:text-sm 4xl:text-base leading-snug">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <span><strong className="text-slate-200">{(t.dashboard?.guide as any)?.simpleFormat ?? 'Simples'}:</strong> {(t.dashboard?.guide as any)?.simpleFormatExample ?? 'Biscoitos 10€'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <span><strong className="text-slate-200">{(t.dashboard?.guide as any)?.withCategory ?? 'Com categoria'}:</strong> {(t.dashboard?.guide as any)?.withCategoryExample ?? 'Iogurte - Alimentação 5€'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <span><strong className="text-slate-200">{(t.dashboard?.guide as any)?.keywords ?? 'Palavras-chave'}:</strong> {(t.dashboard?.guide as any)?.keywordsExample ?? 'Uber 15€'}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-1.5 sm:gap-3">
                    <a href="https://t.me/FinanZenApp_bot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all w-full sm:w-auto">
                      <Send size={14} /> <span className="truncate">{(t.dashboard?.guide as any)?.openTelegramBot ?? 'Abrir bot no Telegram'}</span>
                    </a>
                    <Link href="/auth/register" className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-slate-900/70 border border-slate-700/60 hover:bg-slate-700/50 text-white rounded-xl text-xs font-bold uppercase tracking-wider active:scale-95 transition-all w-full sm:w-auto">
                      {t.hero.cta}
                    </Link>
                  </div>
                </div>

                {/* Simulador de chat — interativo; em mobile altura limitada e centrado */}
                <div className="w-full max-w-[min(100%,20rem)] sm:max-w-[22rem] lg:max-w-[380px] shrink-0 mx-auto">
                  <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden aspect-[9/16] max-h-[60vh] sm:max-h-[65vh] md:aspect-auto md:max-h-none md:h-[440px] lg:h-[480px] flex flex-col">
                    <div className="bg-slate-800 border-b border-white/5 p-2.5 sm:p-3 3xl:p-4 flex items-center gap-1.5 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 3xl:w-10 3xl:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <Send size={16} className="sm:w-4 sm:h-4 3xl:w-5 3xl:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-bold text-[11px] sm:text-xs 3xl:text-sm truncate">{(t.dashboard?.guide as any)?.finlyBot ?? 'Finly Bot'}</h4>
                        <p className="text-blue-400 text-[8px] sm:text-[9px] 3xl:text-[10px] font-medium tracking-wider uppercase">{(t.dashboard?.guide as any)?.onlineAlwaysReady ?? 'Online • Sempre pronto'}</p>
                      </div>
                    </div>
                    <div ref={simChatScrollRef} className="flex-1 p-3 sm:p-4 3xl:p-5 space-y-3 sm:space-y-4 3xl:space-y-5 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900">
                      {simMessages.map((msg, idx) => {
                        const botDisplay = msg.outcome === 'confirmed'
                          ? msg.bot.replace(/\n\n[^\n]+$/, '\n\n' + simAddedLabel)
                          : msg.outcome === 'cancelled'
                            ? msg.bot.replace(/\n\n[^\n]+$/, '\n\n' + simCancelledLabel)
                            : msg.bot;
                        const showButtons = !msg.outcome;
                        return (
                          <div key={idx} className="space-y-2 sm:space-y-3 3xl:space-y-4">
                            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="flex justify-end">
                              <div className="bg-blue-600 text-white p-2 sm:p-2.5 3xl:p-3 rounded-lg sm:rounded-xl 3xl:rounded-2xl rounded-tr-none max-w-[85%] text-[11px] sm:text-xs 3xl:text-sm shadow-md">
                                {msg.user}
                              </div>
                            </motion.div>
                            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 + 0.08 }} className="flex justify-start">
                              <div className="bg-slate-800 text-white p-2 sm:p-2.5 3xl:p-3 rounded-lg sm:rounded-xl 3xl:rounded-2xl rounded-tl-none max-w-[85%] text-[11px] sm:text-xs 3xl:text-sm shadow-md border border-white/5 whitespace-pre-line">
                                {botDisplay}
                                {showButtons && (
                                  <div className="mt-1.5 sm:mt-2 3xl:mt-3 flex gap-1.5 3xl:gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSimMessages(prev => prev.map((m, i) => i === idx ? { ...m, outcome: 'confirmed' as const } : m))}
                                      className="flex-1 min-h-[38px] 3xl:min-h-[44px] bg-emerald-600/90 hover:bg-emerald-500/90 text-white px-2.5 py-2 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] 3xl:text-xs font-bold text-center cursor-pointer transition-colors active:scale-[0.98]"
                                    >
                                      {simConfirmLabel}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSimMessages(prev => prev.map((m, i) => i === idx ? { ...m, outcome: 'cancelled' as const } : m))}
                                      className="flex-1 min-h-[38px] 3xl:min-h-[44px] bg-red-600/80 hover:bg-red-500/80 text-white px-2.5 py-2 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] 3xl:text-xs font-bold text-center cursor-pointer transition-colors active:scale-[0.98]"
                                    >
                                      {simCancelLabel}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="p-2.5 sm:p-3 3xl:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-3 3xl:pb-4 pr-[max(0.5rem,env(safe-area-inset-right))] sm:pr-3 3xl:pr-4 bg-slate-800 border-t border-white/5 flex items-center gap-1.5 sm:gap-3 min-h-[48px] sm:min-h-0 min-w-0 overflow-hidden"
                    >
                      <input
                        type="text"
                        value={simInput}
                        onChange={(e) => setSimInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const text = simInput.trim() || 'Biscoitos 10€';
                            if (text) {
                              const desc = text.split(/[\s-]/)[0] || 'Item';
                              const amount = text.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') || '0';
                              setSimMessages(prev => [...prev, { user: text, bot: `Nova transação\n📝 ${desc}\n💰 €${amount}\n🏷️ —\n\nConfirmar?` }]);
                              setSimInput('');
                            }
                          }
                        }}
                        placeholder={(t.dashboard?.guide as any)?.writeExample ?? 'Escreve "Biscoitos 10€" ou "Iogurte - Alimentação 5€"...'}
                        className="flex-1 min-w-0 min-h-[40px] sm:min-h-0 h-10 sm:h-10 bg-slate-900 rounded-full px-3 sm:px-4 text-white text-[9px] sm:text-[10px] 3xl:text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const text = simInput.trim() || 'Biscoitos 10€';
                          const desc = text.split(/[\s-]/)[0] || 'Item';
                          const amount = text.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') || '0';
                          setSimMessages(prev => [...prev, { user: text, bot: `Nova transação\n📝 ${desc}\n💰 €${amount}\n🏷️ —\n\nConfirmar?` }]);
                          setSimInput('');
                        }}
                        className="min-w-[40px] min-h-[40px] w-10 h-10 sm:min-w-0 sm:min-h-0 bg-blue-500 hover:bg-blue-400 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors active:scale-95"
                        aria-label="Enviar"
                      >
                        <Send size={14} className="sm:w-4 sm:h-4 3xl:w-[18px] 3xl:h-[18px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </section>

        {/* Pricing — destaque visual nos planos; overflow-visible para o badge "Mais escolhido"; compacto abaixo de 3xl */}
        <section id="pricing" className="py-10 sm:py-20 md:py-24 3xl:py-32 relative overflow-visible" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent pointer-events-none" />
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-6 sm:mb-12 md:mb-16 3xl:mb-20 4xl:mb-24">
              <h2 className="text-lg sm:text-3xl md:text-4xl 3xl:text-5xl 4xl:text-6xl font-black tracking-tighter mb-2 sm:mb-3 3xl:mb-4 4xl:mb-5 leading-tight">
                {t.pricingSection.title}
                <span className="text-blue-400 italic"> {t.pricingSection.titleAccent}</span>?
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm md:text-base 3xl:text-lg 4xl:text-xl max-w-2xl mx-auto mb-1 sm:mb-2 4xl:mb-3 leading-relaxed">{t.pricingSection.subtitle1}</p>
              <p className="text-white font-semibold text-xs sm:text-sm md:text-base 3xl:text-lg 4xl:text-xl leading-snug">{t.pricingSection.subtitle2}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 3xl:gap-8 items-stretch max-w-5xl md:max-w-none mx-auto">
              {[
                { id: 'basic', planData: t.pricingSection.plans.basic, icon: Zap, popular: false },
                { id: 'plus', planData: t.pricingSection.plans.plus, icon: Trophy, popular: true },
                { id: 'pro', planData: t.pricingSection.plans.pro, icon: Crown, popular: false }
              ].map((plan: any, index: number) => {
                const planData = plan.planData;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                    transition={{ delay: index * 0.08, duration: 0.35 }}
                    className={`relative rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col transition-all duration-300 ${plan.popular ? 'overflow-visible' : 'overflow-hidden'} ${
                      plan.popular
                        ? 'bg-slate-900/70 backdrop-blur-md border-2 border-blue-500/50 md:-mt-2 md:mb-2 md:scale-[1.02]'
                        : 'bg-slate-900/70 backdrop-blur-md border border-slate-700/60 hover:border-blue-500/40'
                    }`}
                    whileHover={plan.popular ? undefined : { y: -4 }}
                  >
                    {plan.popular && planData.popularLabel && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 z-10">
                        <Trophy size={12} className="shrink-0" />
                        {planData.popularLabel}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 3xl:gap-3 mb-3 sm:mb-4 3xl:mb-6">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 3xl:w-16 3xl:h-16 rounded-xl 3xl:rounded-2xl flex items-center justify-center shrink-0 ${plan.popular ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30 ring-1 ring-blue-400/30' : 'bg-slate-700/90 ring-1 ring-slate-600/50'}`}>
                        <plan.icon size={20} className={`sm:w-6 sm:h-6 3xl:w-7 3xl:h-7 ${plan.popular ? 'text-blue-300' : 'text-slate-300'}`} />
                      </div>
                      <div className="text-right min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[10px] 3xl:text-xs 4xl:text-sm font-bold uppercase tracking-widest text-slate-400 truncate">{planData.name}</p>
                        <p className="text-xl sm:text-3xl md:text-4xl 3xl:text-5xl 4xl:text-6xl font-black text-white tracking-tight drop-shadow-sm whitespace-nowrap tabular-nums">{planData.price}</p>
                        <p className="text-[10px] sm:text-xs 3xl:text-sm 4xl:text-base text-slate-400">{planData.priceSuffix}</p>
                        {planData.priceSecondary && <p className="text-[11px] sm:text-sm text-emerald-400 font-semibold mt-0.5">{planData.priceSecondary}</p>}
                      </div>
                    </div>

                    <p className="text-slate-200 text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base font-semibold mb-0.5 sm:mb-1 4xl:mb-2 leading-snug">{planData.tagline}</p>
                    <p className="text-slate-400 text-[10px] sm:text-xs 3xl:text-sm 4xl:text-base italic mb-2 sm:mb-4 3xl:mb-6 4xl:mb-8 leading-relaxed">&quot;{planData.quote}&quot;</p>

                    <ul className="space-y-1.5 sm:space-y-2 3xl:space-y-3 mb-3 sm:mb-4 3xl:mb-6 flex-1 min-h-0">
                      {planData.features.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 sm:gap-2 3xl:gap-3">
                          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5 sm:w-4 sm:h-4 3xl:w-[18px] 3xl:h-[18px]" />
                          <span className="text-slate-200 text-[11px] sm:text-xs 3xl:text-base 4xl:text-lg leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {planData.limitation && <p className="text-amber-400/90 text-[10px] sm:text-xs 3xl:text-sm mb-2 sm:mb-3 3xl:mb-4 font-medium leading-snug">🚫 {planData.limitation}</p>}

                    <button
                      onClick={async () => {
                        if (user) {
                          try {
                            const priceIdMap: Record<string, string> = { basic: STRIPE_PRICE_IDS.basic, plus: STRIPE_PRICE_IDS.plus, pro: STRIPE_PRICE_IDS.pro };
                            const res = await api.post('/stripe/create-checkout-session', null, { params: { price_id: priceIdMap[plan.id] } });
                            window.location.href = res.data.url;
                          } catch {
                            router.push(`/pricing?plan=${plan.id}`);
                          }
                        } else {
                          router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}`)}`);
                        }
                      }}
                      className={`w-full py-3.5 min-h-[44px] rounded-xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer active:scale-[0.98] ${
                        plan.popular
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60 hover:border-blue-500/40'
                      }`}
                    >
                      {planData.buttonText}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Bloco Afiliados — card premium com destaque */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-10 sm:mt-16 max-w-4xl mx-auto">
              <div className="relative rounded-2xl sm:rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900/90 to-slate-900/70 backdrop-blur-md p-6 sm:p-8 lg:p-10 text-center overflow-hidden shadow-xl shadow-amber-900/10">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />
                <span className="relative inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-amber-400 text-xs sm:text-sm font-bold uppercase tracking-widest mb-4 sm:mb-5">
                  <Trophy size={14} className="shrink-0" />
                  {t.pricingSection.affiliate.badge}
                </span>
                <h3 className="relative text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white mb-3 sm:mb-4 tracking-tight leading-tight">
                  {t.pricingSection.affiliate.title}
                </h3>
                <p className="relative text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed">
                  {t.pricingSection.affiliate.description}
                </p>
                <ul className="relative flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3 mb-6 sm:mb-8 text-slate-200 text-sm sm:text-base">
                  {t.pricingSection.affiliate.benefits.map((b: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="relative rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-700/60 p-4 sm:p-6 text-left">
                  <p className="text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">
                    {t.pricingSection.affiliate.example.title}
                  </p>
                  <p className="text-slate-100 text-sm sm:text-base font-semibold mb-1 leading-snug">
                    {t.pricingSection.affiliate.example.line1}
                  </p>
                  <p className="text-slate-100 text-sm sm:text-base font-semibold mb-2 sm:mb-3 leading-snug">
                    {t.pricingSection.affiliate.example.line2}
                  </p>
                  <p className="text-slate-500 text-xs sm:text-sm">{t.pricingSection.affiliate.example.footer}</p>
                </div>
              </div>
            </motion.div>

            {/* Garantias — pills com ícone */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-10 sm:mt-14 pt-8 sm:pt-12 border-t border-slate-700/60">
              <p className="text-center text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-widest mb-6 sm:mb-8">
                {t.pricingSection.guarantee.title}
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {t.pricingSection.guarantee.items.map((item: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-slate-300 text-xs sm:text-sm leading-snug">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats — números em destaque com fundo suave */}
        <section id="stats" className="py-12 sm:py-20 border-y border-slate-700/60" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
              {[
                { value: '180€', label: t.stats.saved },
                { value: '3s', label: t.stats.time },
                { value: '99.9%', label: t.stats.success }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm py-6 sm:py-8 px-4 sm:px-6"
                >
                  <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-400">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps — 3 passos com cards e linha conectora */}
        <section id="steps" className="py-14 sm:py-20 md:py-24 relative overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-center mb-10 sm:mb-14">
              {t.steps.title}
              <span className="text-blue-400 italic"> {t.steps.titleAccent}</span>
            </motion.h2>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="hidden md:block absolute top-[100px] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

              {t.steps.items.map((step: { t: string; d: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="relative rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-5 sm:p-6 hover:border-blue-500/40 transition-all duration-300 group overflow-hidden"
                >
                  <div className="relative flex items-center gap-4 mb-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/40 text-blue-300 font-black text-lg group-hover:border-blue-400/50 transition-colors">
                      {i + 1}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-slate-700/80 flex items-center justify-center text-blue-400 border border-slate-600/80 group-hover:border-blue-500/40 shrink-0">
                      {i === 0 ? <Phone size={24} /> : i === 1 ? <MessageSquare size={24} /> : <Zap size={24} />}
                    </div>
                  </div>
                  <h3 className="relative text-lg sm:text-xl font-black text-white mb-2 uppercase tracking-tight">{step.t}</h3>
                  <p className="relative text-slate-300 text-sm sm:text-base leading-relaxed">{step.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Resources — tecnologia que trabalha para si */}
        <section id="resources" className="py-14 sm:py-20 relative overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Zap size={14} className="shrink-0" />
                {t.resources.badge}
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter mb-3">
                {t.resources.title}
                <span className="text-blue-400 italic"> {t.resources.titleAccent}</span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                {(t.resources as { subtitle?: string }).subtitle ?? 'Tudo o que precisas para dominar as tuas finanças, num só sítio.'}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {t.resources.items.map((item: { t: string; d: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  whileHover={{ y: -4 }}
                  className="group relative rounded-2xl p-5 sm:p-6 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 hover:border-blue-500/40 transition-all duration-300 overflow-hidden"
                >
                  <div className="relative flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0 group-hover:border-blue-400/50 group-hover:shadow-lg group-hover:shadow-blue-500/15 transition-all">
                      {i === 0 ? <Phone size={22} /> : i === 1 ? <BarChart3 size={22} /> : i === 2 ? <Globe size={22} /> : i === 3 ? <ShieldCheck size={22} /> : i === 4 ? <Trophy size={22} /> : <Star size={22} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mb-1.5 group-hover:text-blue-100/90 transition-colors">{item.t}</h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials — feedback com destaque no do meio */}
        <section id="testimonials" className="py-14 sm:py-20 relative overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">
                {(t.testimonials as { badge?: string }).badge ?? 'Opiniões'}
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter">
                {(t.testimonials as { title?: string }).title ?? 'O que dizem '}
                <span className="text-blue-400 italic"> {(t.testimonials as { titleAccent?: string }).titleAccent ?? 'os nossos clientes.'}</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch">
              {t.testimonials.items.map((item: { id: number; name: string; role: string; text: string; initial: string }, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`group relative flex flex-col rounded-2xl p-5 sm:p-6 border transition-all duration-300 overflow-hidden ${
                    i === 1
                      ? 'bg-slate-900/80 backdrop-blur-md border-blue-500/50 md:-mt-1 md:mb-1 md:scale-[1.02] shadow-lg shadow-blue-900/20'
                      : 'bg-slate-900/70 backdrop-blur-md border-slate-700/60 hover:border-blue-500/30'
                  }`}
                >
                  <div className="relative flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-600/25 ring-2 ring-white/10 shrink-0">
                      {item.initial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{item.name}</p>
                      <p className="text-slate-400 text-xs truncate uppercase tracking-wider">{(item.role as string)}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                    ))}
                  </div>
                  <p className="relative text-slate-200 text-sm sm:text-base leading-relaxed flex-1">
                    <span className="absolute -top-0.5 -left-0.5 text-2xl sm:text-3xl font-serif text-blue-500/20 leading-none select-none">&quot;</span>
                    <span className="pl-4">{item.text}</span>
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — cards claros com ícone */}
        <section id="faq" className="py-12 sm:py-20 border-t border-slate-700/60" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-5 lg:px-8">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-center mb-8 sm:mb-10">
              {t.faq.title}
              <span className="text-blue-400 italic"> {t.faq.titleAccent}</span>
            </motion.h2>

            <div className="space-y-3 sm:space-y-4">
              {t.faq.items.map((item: { q: string; a: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 sm:p-5 hover:border-slate-600/80 transition-all duration-300"
                >
                  <h4 className="text-sm sm:text-base font-bold text-white mb-2 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span className="min-w-0">{item.q}</span>
                  </h4>
                  <p className="text-slate-400 text-sm leading-relaxed pl-4">{item.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer — estrutura clara com logo, links e badge */}
        <footer className="relative border-t border-slate-700/60 bg-slate-950/90 py-10 sm:py-14 overflow-hidden" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 text-center relative">
            <div className="flex items-center justify-center gap-2 mb-3">
              <motion.div whileHover={{ scale: 1.05 }} className="shrink-0">
                <img src="/images/logo/logo-semfundo.png" alt="Finly" className="h-9 w-9 sm:h-10 sm:w-10 object-contain" draggable={false} loading="lazy" />
              </motion.div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white">Finly</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-6">{t.footer.slogan}</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6">
              {t.footer.links.map((link: string, i: number) => {
                const hrefMap: Record<string, string> = { 'Termos': '/terms', 'Terms': '/terms', 'Privacidade': '/privacy', 'Privacy': '/privacy', 'Cookies': '#' };
                return (
                  <Link key={i} href={hrefMap[link] || '#'} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
                    {link}
                  </Link>
                );
              })}
            </div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/40 px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-widest">
              <CheckCircle2 size={12} className="text-emerald-500/80 shrink-0" />
              {t.footer.badge}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
