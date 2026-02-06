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
  const [scrollProgress, setScrollProgress] = useState(0);

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

  // Barra de progresso de scroll (0–100%)
  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(100);
        return;
      }
      setScrollProgress((window.scrollY / docHeight) * 100);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Finly",
    "alternateName": ["finlybot", "Finly Bot"],
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
      <div className="min-h-[100dvh] bg-[#020617] text-white selection:bg-blue-500/30 overflow-x-hidden">

        {/* Banner — compacto em mobile; safe-area horizontal */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-blue-600/90 py-2 sm:py-2.5 px-3 sm:px-4 text-center overflow-hidden"
          style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
          <p className="text-[10px] sm:text-xs 3xl:text-sm 4xl:text-base font-bold uppercase tracking-widest text-white/95 relative z-10 truncate">
            {t.banner}
          </p>
        </motion.div>

        {/* Nav — sticky, glass */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 min-h-[64px] sm:min-h-[72px]">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -m-2 p-2 rounded-xl active:scale-[0.98]">
              <img src="/images/logo/logo-semfundo.png" alt="Finly" className="h-9 w-9 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain shrink-0" draggable={false} />
              <span className="text-white font-bold tracking-tight text-lg sm:text-2xl md:text-3xl 3xl:text-4xl 4xl:text-5xl truncate" style={{ fontFamily: 'var(--font-brand), sans-serif' }}>
                Finly
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center gap-1.5 h-10 sm:h-12 min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/40 text-slate-300 hover:text-white transition-all cursor-pointer"
                  aria-label="Language"
                >
                  <img src={FLAG_IMAGE_URLS[language]} alt="" className="w-4 h-3 sm:w-5 sm:h-3.5 3xl:w-6 3xl:h-4 object-cover rounded-sm shrink-0" width={24} height={16} />
                  <span className="text-[9px] sm:text-[10px] 3xl:text-xs font-semibold hidden xs:inline sm:inline">{availableLanguages[language]?.code.toUpperCase()}</span>
                </button>
                <AnimatePresence>
                  {showLanguageMenu && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setShowLanguageMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 top-full mt-2 bg-slate-900/95 border border-slate-700 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden z-50 min-w-[140px] sm:min-w-[160px] backdrop-blur-xl"
                      >
                        {Object.values(availableLanguages)
                          .filter((lang): lang is LanguageConfig => lang != null && lang.code != null)
                          .map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => { setLanguage(lang.code as LanguageCode); setShowLanguageMenu(false); }}
                              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left flex items-center gap-2 sm:gap-3 hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] ${language === lang.code ? 'bg-blue-500/15 text-blue-400' : 'text-slate-300'}`}
                            >
                              <img src={FLAG_IMAGE_URLS[lang.code]} alt="" className="w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-sm shrink-0" width={24} height={16} />
                              <span className="text-xs sm:text-sm font-medium">{lang.nativeName}</span>
                              {language === lang.code && <CheckCircle2 size={14} className="ml-auto text-blue-400 shrink-0" />}
                            </button>
                          ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link href="/auth/login" className="h-9 sm:h-11 3xl:h-12 min-h-[36px] sm:min-h-[44px] flex items-center justify-center bg-white/10 hover:bg-white/15 text-white px-2.5 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px] 3xl:text-xs uppercase tracking-wider border border-white/10 active:scale-[0.98]">
                  {(t.nav as { loginButton?: string })?.loginButton ?? 'Entrar'}
                </Link>
                <Link href="/auth/register" className="h-9 sm:h-11 3xl:h-12 min-h-[36px] sm:min-h-[44px] flex items-center justify-center bg-white text-black px-2.5 sm:px-4 3xl:px-6 py-2 sm:py-2.5 3xl:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] 3xl:text-sm font-black uppercase tracking-wider hover:bg-slate-100 active:scale-[0.98] transition-all shadow-lg">
                  {t.nav.register}
                </Link>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Barra de progresso — no topo, safe area; fina em mobile */}
        <div className="fixed left-0 right-0 z-[60] h-0.5 sm:h-1.5 bg-slate-800/80 overflow-hidden pointer-events-none" style={{ top: 'env(safe-area-inset-top)' }}>
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{ width: `${scrollProgress}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>

        {/* Hero — destaque, título e CTAs; mobile-first; compacto abaixo de 3xl */}
        <section id="hero" className="relative pt-8 sm:pt-16 md:pt-24 3xl:pt-32 pb-10 sm:pb-16 md:pb-20 3xl:pb-24 overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[280px] sm:w-[500px] md:w-[800px] h-[200px] sm:h-[350px] bg-blue-500/10 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent pointer-events-none" />

          <div className="max-w-6xl mx-auto px-2 sm:px-5 lg:px-8 relative z-10 text-center">
            <motion.div {...fadeUp} {...stagger(0)} className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 3xl:px-5 py-1.5 sm:py-2.5 3xl:py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] sm:text-[10px] md:text-xs 3xl:text-sm font-bold uppercase tracking-widest mb-3 sm:mb-6 3xl:mb-8">
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
            <motion.div {...fadeUp} {...stagger(3)} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 max-w-sm sm:max-w-none mx-auto">
              <Link href="/auth/register" className="group w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 sm:px-6 3xl:px-8 4xl:px-10 py-3 sm:py-3.5 3xl:py-4 4xl:py-5 min-h-[44px] 3xl:min-h-[48px] 4xl:min-h-[52px] rounded-xl sm:rounded-2xl text-xs sm:text-sm 3xl:text-base 4xl:text-lg font-black uppercase tracking-wider shadow-lg shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all">
                {t.hero.cta}
                <ArrowRight size={16} className="sm:w-4 sm:h-4 3xl:w-5 3xl:h-5 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
              <Link href="#telegram-simulator" className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-5 sm:px-6 3xl:px-8 4xl:px-10 py-3 sm:py-3.5 3xl:py-4 4xl:py-5 min-h-[44px] 3xl:min-h-[48px] 4xl:min-h-[52px] rounded-xl sm:rounded-2xl text-xs sm:text-sm 3xl:text-base 4xl:text-lg font-bold uppercase tracking-wider border-2 border-slate-600 text-slate-300 hover:border-blue-500/50 hover:text-white hover:bg-blue-500/5 transition-all active:scale-[0.98]">
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
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[16px] sm:rounded-[22px] md:rounded-[32px] 3xl:rounded-[48px] blur opacity-20 group-hover:opacity-30 transition duration-700" />
              <div className="relative bg-slate-950 rounded-[16px] sm:rounded-[20px] md:rounded-[28px] 3xl:rounded-[32px] p-4 sm:p-5 md:p-8 lg:p-10 3xl:p-16 border border-white/5 flex flex-col lg:flex-row items-center gap-5 sm:gap-6 lg:gap-10 3xl:gap-16 overflow-hidden">
                {/* Coluna esquerda: texto + formas de escrever */}
                <div className="flex-1 space-y-3 sm:space-y-5 md:space-y-6 3xl:space-y-8 relative z-10 w-full min-w-0">
                  <div className="inline-flex items-center gap-1.5 sm:gap-3 bg-blue-500/10 border border-blue-500/20 px-2.5 sm:px-3 3xl:px-4 py-1 sm:py-1.5 3xl:py-2 rounded-full text-blue-400 text-[9px] sm:text-[10px] 3xl:text-xs font-black uppercase tracking-widest">
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
                  <div className="bg-slate-900/50 rounded-lg sm:rounded-xl 3xl:rounded-2xl p-2.5 sm:p-3 md:p-4 3xl:p-5 border border-slate-800">
                    <h3 className="text-white font-black text-[10px] sm:text-[11px] md:text-xs 3xl:text-sm 4xl:text-base uppercase tracking-wider mb-1.5 sm:mb-2 md:mb-3 3xl:mb-4 4xl:mb-5">{(t.dashboard?.guide as any)?.waysToWrite ?? 'Formas de escrever:'}</h3>
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
                    <a href="https://t.me/FinanZenApp_bot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] 3xl:min-h-[44px] px-3 sm:px-4 md:px-5 3xl:px-6 py-2 sm:py-2.5 3xl:py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl 3xl:rounded-2xl text-[10px] sm:text-[11px] 3xl:text-xs font-black uppercase tracking-wider shadow-xl shadow-blue-600/20 active:scale-95 transition-all w-full sm:w-auto">
                      <Send size={12} className="3xl:w-3.5 3xl:h-3.5" /> <span className="truncate">{(t.dashboard?.guide as any)?.openTelegramBot ?? 'Abrir bot no Telegram'}</span>
                    </a>
                    <Link href="/auth/register" className="inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] 3xl:min-h-[44px] px-3 sm:px-4 md:px-5 3xl:px-6 py-2 sm:py-2.5 3xl:py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg sm:rounded-xl 3xl:rounded-2xl text-[10px] sm:text-[11px] 3xl:text-xs font-black uppercase tracking-wider active:scale-95 transition-all w-full sm:w-auto">
                      {t.hero.cta}
                    </Link>
                  </div>
                </div>

                {/* Simulador de chat — interativo; em mobile altura limitada e centrado */}
                <div className="w-full max-w-[min(100%,20rem)] sm:max-w-[22rem] lg:max-w-[380px] 3xl:max-w-[420px] shrink-0 mx-auto">
                  <div className="bg-slate-900 rounded-[16px] sm:rounded-[20px] md:rounded-[28px] 3xl:rounded-[32px] border border-white/10 shadow-2xl overflow-hidden aspect-[9/16] max-h-[60vh] sm:max-h-[65vh] md:aspect-auto md:max-h-none md:h-[440px] lg:h-[480px] 3xl:h-[560px] flex flex-col">
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
                    className={`relative rounded-2xl 3xl:rounded-3xl p-5 sm:p-6 3xl:p-8 flex flex-col transition-all duration-300 ${plan.popular ? 'overflow-visible' : 'overflow-hidden'} ${
                      plan.popular
                        ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-blue-400/80 shadow-[0_0_60px_rgba(59,130,246,0.25),0_20px_50px_-15px_rgba(0,0,0,0.5)] md:-mt-2 md:mb-2 md:scale-[1.05] ring-2 ring-blue-400/30'
                        : 'bg-gradient-to-b from-slate-800/90 to-slate-900/90 border-2 border-slate-600/80 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.12)]'
                    }`}
                    whileHover={plan.popular ? { scale: 1.03, boxShadow: '0 0 80px rgba(59,130,246,0.3), 0 25px 60px -15px rgba(0,0,0,0.5)' } : { y: -6, boxShadow: '0 20px 40px -15px rgba(0,0,0,0.4)' }}
                  >
                    {plan.popular && planData.popularLabel && (
                      <div className="absolute -top-2.5 3xl:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 text-white px-3 sm:px-4 3xl:px-5 py-1.5 3xl:py-2 rounded-full text-[9px] sm:text-[10px] 3xl:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 3xl:gap-1.5 text-center shadow-lg shadow-blue-500/40 z-10 min-w-[120px] sm:min-w-0 3xl:min-w-0 whitespace-nowrap">
                        <Trophy size={10} className="sm:w-3.5 sm:h-3.5 3xl:w-4 3xl:h-4 shrink-0" />
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
                      className={`w-full py-3 sm:py-3.5 3xl:py-4 min-h-[42px] 3xl:min-h-[48px] rounded-xl 3xl:rounded-2xl text-[11px] sm:text-xs 3xl:text-sm font-black uppercase tracking-wider transition-all cursor-pointer active:scale-[0.98] ${
                        plan.popular
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50'
                          : 'bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-500 hover:border-blue-500/50'
                      }`}
                    >
                      {planData.buttonText}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Bloco Afiliados — compacto abaixo de 3xl */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8 sm:mt-14 md:mt-20 3xl:mt-24 max-w-4xl mx-auto">
              <div className="relative rounded-2xl 3xl:rounded-3xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 sm:p-6 3xl:p-10 text-center overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.08)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <span className="relative inline-flex items-center justify-center gap-1.5 sm:gap-2 text-amber-400 text-xs sm:text-sm 3xl:text-base 4xl:text-lg font-black uppercase tracking-widest mb-3 sm:mb-4 3xl:mb-5 4xl:mb-6">
                  <Trophy size={10} className="sm:w-3.5 sm:h-3.5 3xl:w-4 3xl:h-4 shrink-0" />
                  {t.pricingSection.affiliate.badge}
                </span>
                <h3 className="relative text-lg sm:text-2xl md:text-3xl 3xl:text-4xl font-black text-white mb-2 sm:mb-3 3xl:mb-4 tracking-tight leading-tight">
                  {t.pricingSection.affiliate.title}
                </h3>
                <p className="relative text-slate-300 text-xs sm:text-sm 3xl:text-lg 4xl:text-xl mb-4 sm:mb-5 3xl:mb-6 4xl:mb-8 max-w-2xl mx-auto leading-relaxed">
                  {t.pricingSection.affiliate.description}
                </p>
                <ul className="relative space-y-1.5 sm:space-y-2 3xl:space-y-3 4xl:space-y-4 mb-4 sm:mb-6 3xl:mb-8 4xl:mb-10 text-slate-200 text-xs sm:text-sm 3xl:text-base 4xl:text-lg flex flex-wrap justify-center gap-x-3 sm:gap-x-4 3xl:gap-x-6 4xl:gap-x-8 gap-y-1.5 3xl:gap-y-2 4xl:gap-y-3">
                  {t.pricingSection.affiliate.benefits.map((b: string, i: number) => (
                    <li key={i} className="flex items-center gap-1.5 3xl:gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0 sm:w-4 sm:h-4 3xl:w-[18px] 3xl:h-[18px]" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="relative rounded-xl 3xl:rounded-2xl bg-slate-800/80 border border-slate-600/80 p-3 sm:p-4 3xl:p-6 text-left shadow-inner">
                  <p className="text-amber-400/90 text-xs sm:text-sm 3xl:text-base 4xl:text-lg font-bold uppercase tracking-widest mb-1.5 sm:mb-2 3xl:mb-3 4xl:mb-4">
                    {t.pricingSection.affiliate.example.title}
                  </p>
                  <p className="text-slate-100 text-xs sm:text-sm 3xl:text-lg 4xl:text-xl font-semibold mb-1 3xl:mb-2 4xl:mb-3 leading-snug">
                    {t.pricingSection.affiliate.example.line1}
                  </p>
                  <p className="text-slate-100 text-xs sm:text-sm 3xl:text-lg 4xl:text-xl font-semibold mb-1.5 sm:mb-2 3xl:mb-3 4xl:mb-4 leading-snug">
                    {t.pricingSection.affiliate.example.line2}
                  </p>
                  <p className="text-slate-500 text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base">{t.pricingSection.affiliate.example.footer}</p>
                </div>
              </div>
            </motion.div>

            {/* Garantias — compacto abaixo de 3xl */}
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 sm:mt-14 3xl:mt-20 pt-8 sm:pt-10 3xl:pt-14 border-t border-white/10">
              <p className="text-center text-slate-400 text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base font-bold uppercase tracking-widest mb-4 sm:mb-6 3xl:mb-8 4xl:mb-10">
                {t.pricingSection.guarantee.title}
              </p>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-8 3xl:gap-12 gap-y-2 3xl:gap-y-3">
                {t.pricingSection.guarantee.items.map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 3xl:gap-2 text-slate-300 text-[11px] sm:text-xs 3xl:text-base leading-snug">
                    <Check size={14} className="text-emerald-400 shrink-0 sm:w-4 sm:h-4 3xl:w-5 3xl:h-5" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats — números sem cards, layout limpo; compacto abaixo de 3xl */}
        <section id="stats" className="py-10 sm:py-16 3xl:py-20 border-y border-white/5" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 3xl:gap-8 text-center sm:divide-x sm:divide-white/10">
              {[
                { value: '180€', label: t.stats.saved },
                { value: '3s', label: t.stats.time },
                { value: '99.9%', label: t.stats.success }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="sm:px-6 3xl:px-8"
                >
                  <p className="text-2xl sm:text-4xl md:text-5xl 3xl:text-6xl 4xl:text-7xl font-black tracking-tighter mb-1.5 3xl:mb-2 4xl:mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-400">
                    {stat.value}
                  </p>
                  <p className="text-[9px] sm:text-[10px] 3xl:text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps — 3 passos com cards destacados; compacto abaixo de 3xl */}
        <section id="steps" className="py-12 sm:py-20 md:py-28 3xl:py-32 relative overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xl sm:text-3xl md:text-4xl 3xl:text-5xl 4xl:text-6xl font-black tracking-tighter text-center mb-8 sm:mb-14 3xl:mb-20 4xl:mb-24">
              {t.steps.title}
              <span className="text-blue-400 italic"> {t.steps.titleAccent}</span>
            </motion.h2>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 3xl:gap-10">
              {/* Linha conectora (desktop) — mais visível */}
              <div className="hidden md:block absolute top-[88px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

              {t.steps.items.map((step: { t: string; d: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className="relative rounded-2xl 3xl:rounded-3xl bg-gradient-to-b from-slate-800/70 to-slate-900/70 border border-slate-600/60 p-4 sm:p-6 3xl:p-8 hover:border-blue-500/50 hover:shadow-[0_0_50px_rgba(59,130,246,0.12),0_20px_40px_-15px_rgba(0,0,0,0.4)] transition-all duration-300 group overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
                  <div className="relative flex items-start gap-3 3xl:gap-4 mb-4 3xl:mb-6">
                    <span className="flex h-11 w-11 3xl:h-14 3xl:w-14 shrink-0 items-center justify-center rounded-xl 3xl:rounded-2xl bg-gradient-to-br from-blue-500/25 to-indigo-500/25 border border-blue-500/40 text-blue-300 font-black text-base 3xl:text-xl group-hover:from-blue-500/35 group-hover:to-indigo-500/35 group-hover:border-blue-400/50 transition-colors shadow-lg shadow-blue-500/10">
                      {i + 1}
                    </span>
                    <div className="w-11 h-11 3xl:w-14 3xl:h-14 rounded-xl 3xl:rounded-2xl bg-slate-700/80 flex items-center justify-center text-blue-400 border border-slate-600/80 group-hover:border-blue-500/40 group-hover:bg-slate-700 transition-colors shrink-0">
                      {i === 0 ? <Phone size={22} className="3xl:w-[26px] 3xl:h-[26px]" /> : i === 1 ? <MessageSquare size={22} className="3xl:w-[26px] 3xl:h-[26px]" /> : <Zap size={22} className="3xl:w-[26px] 3xl:h-[26px]" />}
                    </div>
                  </div>
                  <h3 className="relative text-base sm:text-lg 3xl:text-xl 4xl:text-2xl font-black text-white mb-2 3xl:mb-3 4xl:mb-4 uppercase tracking-tight">{step.t}</h3>
                  <p className="relative text-slate-300 text-xs sm:text-sm 3xl:text-base 4xl:text-lg leading-relaxed">{step.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Resources — tecnologia que trabalha para si; compacto abaixo de 3xl */}
        <section id="resources" className="py-14 sm:py-24 md:py-28 3xl:py-36 relative overflow-hidden bg-[#03081c]" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14 3xl:mb-20">
              <span className="inline-flex items-center gap-1.5 sm:gap-2 text-amber-400 text-[11px] sm:text-xs 3xl:text-sm font-black uppercase tracking-widest mb-3 3xl:mb-5">
                <Zap size={14} className="3xl:w-4 3xl:h-4 shrink-0" />
                {t.resources.badge}
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl 3xl:text-6xl font-black tracking-tighter mb-3 3xl:mb-4">
                {t.resources.title}
                <span className="text-blue-400 italic"> {t.resources.titleAccent}</span>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm md:text-base 3xl:text-lg 4xl:text-xl max-w-2xl mx-auto leading-relaxed">
                {(t.resources as { subtitle?: string }).subtitle ?? 'Tudo o que precisas para dominar as tuas finanças, num só sítio.'}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 3xl:gap-8">
              {t.resources.items.map((item: { t: string; d: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className="group relative rounded-2xl 3xl:rounded-3xl p-4 sm:p-6 3xl:p-8 bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-slate-600/50 hover:border-blue-500/40 hover:shadow-[0_0_50px_rgba(59,130,246,0.12),0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/15 transition-colors pointer-events-none" />
                    <div className="relative flex items-start gap-3 sm:gap-4 3xl:gap-5">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 3xl:w-16 3xl:h-16 rounded-xl 3xl:rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0 group-hover:from-blue-500/40 group-hover:to-indigo-500/40 group-hover:border-blue-400/50 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                        {i === 0 ? <Phone size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" /> : i === 1 ? <BarChart3 size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" /> : i === 2 ? <Globe size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" /> : i === 3 ? <ShieldCheck size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" /> : i === 4 ? <Trophy size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" /> : <Star size={20} className="sm:w-6 sm:h-6 3xl:w-7 3xl:h-7" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-base 3xl:text-lg 4xl:text-xl font-black uppercase tracking-wider text-white mb-1 3xl:mb-2 4xl:mb-3 group-hover:text-blue-100/90 transition-colors">{item.t}</h4>
                        <p className="text-slate-300 text-[11px] sm:text-sm 3xl:text-base 4xl:text-lg leading-relaxed">{item.d}</p>
                      </div>
                    </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials — feedback redesenhado; compacto abaixo de 3xl */}
        <section id="testimonials" className="py-12 sm:py-24 md:py-28 3xl:py-36 relative overflow-hidden" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-[#020617] to-slate-950/80 pointer-events-none" />
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 sm:mb-14 3xl:mb-20">
              <span className="inline-block text-amber-400 text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base font-black uppercase tracking-widest mb-3 3xl:mb-4 4xl:mb-5">
                {(t.testimonials as { badge?: string }).badge ?? 'Opiniões'}
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl 3xl:text-5xl 4xl:text-6xl font-black tracking-tighter">
                {(t.testimonials as { title?: string }).title ?? 'O que dizem '}
                <span className="text-blue-400 italic"> {(t.testimonials as { titleAccent?: string }).titleAccent ?? 'os nossos clientes.'}</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 3xl:gap-8 items-stretch">
              {t.testimonials.items.map((item: { id: number; name: string; role: string; text: string; initial: string }, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={`group relative flex flex-col rounded-2xl 3xl:rounded-3xl p-4 sm:p-6 3xl:p-8 border transition-all duration-300 overflow-hidden ${
                    i === 1
                      ? 'bg-gradient-to-b from-slate-800/80 to-slate-900/80 border-blue-500/40 shadow-[0_0_50px_rgba(59,130,246,0.1)] md:-mt-2 md:mb-2 md:scale-[1.02] ring-1 ring-blue-500/20'
                      : 'bg-slate-800/40 border-slate-600/60 hover:border-blue-500/30 hover:shadow-[0_0_40px_rgba(59,130,246,0.08)]'
                  }`}
                >
                  {i === 1 && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  )}
                  <div className="relative flex items-center gap-3 3xl:gap-4 mb-4 3xl:mb-5">
                    <div className="w-10 h-10 3xl:w-12 3xl:h-12 rounded-xl 3xl:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs 3xl:text-sm shadow-lg shadow-blue-600/30 ring-2 ring-white/10 shrink-0">
                      {item.initial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs sm:text-sm 3xl:text-base 4xl:text-lg truncate">{item.name}</p>
                      <p className="text-slate-400 text-[10px] sm:text-xs 3xl:text-sm 4xl:text-base truncate">{(item.role as string).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3 3xl:mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} className="fill-amber-400 text-amber-400 shrink-0 3xl:w-4 3xl:h-4" />
                    ))}
                  </div>
                  <p className="relative text-slate-200 text-xs sm:text-sm md:text-base 3xl:text-lg 4xl:text-xl leading-relaxed flex-1">
                    <span className="absolute -top-1 -left-1 text-3xl sm:text-4xl font-serif text-blue-500/25 leading-none select-none">&quot;</span>
                    <span className="pl-3 sm:pl-4">{item.text}</span>
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — estático; compacto abaixo de 3xl */}
        <section id="faq" className="py-10 sm:py-20 md:py-24 3xl:py-32 border-t border-white/5" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-5 lg:px-8">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-lg sm:text-3xl 3xl:text-4xl 4xl:text-5xl font-black tracking-tighter text-center mb-6 sm:mb-10 3xl:mb-12 4xl:mb-14">
              {t.faq.title}
              <span className="text-blue-400 italic"> {t.faq.titleAccent}</span>
            </motion.h2>

            <div className="space-y-3 3xl:space-y-4">
              {t.faq.items.map((item: { q: string; a: string }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-xl 3xl:rounded-2xl bg-slate-800/30 border border-slate-700/80 p-3 sm:p-4 3xl:p-6 hover:border-slate-600 hover:bg-slate-800/50 transition-all duration-300"
                >
                  <h4 className="text-[11px] sm:text-xs 3xl:text-sm font-black uppercase tracking-wider text-white mb-1.5 3xl:mb-2 flex items-center gap-1.5 3xl:gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="min-w-0">{item.q}</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base leading-relaxed pl-3 3xl:pl-3.5 4xl:pl-4">{item.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer — compacto abaixo de 3xl */}
        <footer className="relative border-t border-white/5 bg-[#010413] py-8 sm:py-12 3xl:py-16 overflow-hidden" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <div className="max-w-[90rem] mx-auto px-4 sm:px-5 lg:px-8 text-center relative">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 3xl:mb-6">
              <motion.div whileHover={{ scale: 1.05 }} className="shrink-0">
                <img src="/images/logo/logo-semfundo.png" alt="Finly" className="h-8 w-8 sm:h-10 sm:w-10 3xl:h-12 3xl:w-12 4xl:h-14 4xl:w-14 object-contain" draggable={false} loading="lazy" />
              </motion.div>
              <span className="text-base sm:text-lg 3xl:text-xl font-black tracking-tight text-white">Finly</span>
            </div>
            <p className="text-slate-600 text-[9px] sm:text-[10px] 3xl:text-xs 4xl:text-sm font-bold uppercase tracking-[0.3em] mb-4 sm:mb-6 3xl:mb-8 4xl:mb-10">{t.footer.slogan}</p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 3xl:gap-10 mb-4 sm:mb-6 3xl:mb-8">
              {t.footer.links.map((link: string, i: number) => {
                const hrefMap: Record<string, string> = { 'Termos': '/terms', 'Terms': '/terms', 'Privacidade': '/privacy', 'Privacy': '/privacy', 'Cookies': '#' };
                return (
                  <Link key={i} href={hrefMap[link] || '#'} className="inline-flex items-center min-h-[40px] 3xl:min-h-[44px] 4xl:min-h-[48px] text-slate-500 hover:text-white text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base font-bold uppercase tracking-wider transition-colors">
                    {link}
                  </Link>
                );
              })}
            </div>
            <p className="flex items-center justify-center gap-1.5 3xl:gap-2 4xl:gap-3 text-slate-700 text-[9px] sm:text-[10px] 3xl:text-xs 4xl:text-sm font-bold uppercase tracking-widest">
              <CheckCircle2 size={10} className="3xl:w-3 3xl:h-3" />
              {t.footer.badge}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
