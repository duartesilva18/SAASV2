'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Trophy, 
  MessageSquare,
  BarChart3,
  Globe,
  Star,
  CheckCircle2,
  ChevronRight,
  Phone,
  Crown,
  Check
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { LanguageCode, LanguageConfig } from '@/lib/languages';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';

// Componente simplificado para a palavra Telegram
function AnimatedTelegram() {
  return (
    <span className="inline-block relative mx-1 font-black text-blue-400">
      Telegram
    </span>
  );
}

// Componente de partículas flutuantes removido para melhor performance

export default function LandingPage() {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { user } = useUser();
  const router = useRouter();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  // Structured Data para SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Finly",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web, Telegram",
    "offers": {
      "@type": "Offer",
      "price": "9.99",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "2800"
    },
    "description": t.hero.description,
    "featureList": [
      t.resources.items[0].d.split('.')[0],
      t.resources.items[1].d.split('.')[0],
      t.resources.items[2].d.split('.')[0],
      t.resources.items[3].d.split('.')[0],
      t.resources.items[4].d.split('.')[0]
    ]
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  // Removido mouse tracking para melhor performance

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 overflow-x-hidden relative">

      {/* Banner com animação */}
      <motion.div 
        className="bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4 text-center relative overflow-hidden"
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] relative z-10">
          {t.banner}
        </p>
      </motion.div>

      {/* Navbar: logo, nome e botões numa linha, alinhados. Sem motion no header para evitar hydration mismatch. */}
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 py-3 border-b border-white/5 relative z-40"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 min-h-[56px]">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 select-none min-h-[44px] w-fit -m-2 p-2 rounded-xl active:scale-[0.98] shrink-0"
          >
            <img
              src="/images/logo/logo-semfundo.png"
              alt="Finly"
              className="h-9 w-9 sm:h-14 sm:w-14 shrink-0 select-none pointer-events-none object-contain"
              draggable="false"
            />
            <span
              className="text-white font-semibold tracking-tight text-lg sm:text-3xl leading-none whitespace-nowrap"
              style={{ fontFamily: 'var(--font-brand), sans-serif' }}
            >
              Finly
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-8 shrink-0">
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 min-w-[44px] px-3 sm:px-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer touch-manipulation"
                aria-label={t.nav?.login ? "Idioma" : "Language"}
              >
                <Globe size={20} className="sm:w-5 sm:h-5" />
                <span className="text-xs font-bold hidden sm:inline">
                  {availableLanguages[language]?.flag} {availableLanguages[language]?.code.toUpperCase()}
                </span>
                <span className="text-xs font-bold sm:hidden">
                  {availableLanguages[language]?.flag}
                </span>
              </button>

              <AnimatePresence mode="wait">
                {showLanguageMenu && (
                  <>
                    <motion.div
                      key="language-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setShowLanguageMenu(false)}
                    />
                    <motion.div
                      key="language-menu"
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 min-w-[180px]"
                    >
                      {Object.values(availableLanguages)
                        .filter((lang): lang is LanguageConfig => lang !== null && lang !== undefined && lang.code !== undefined)
                        .map((lang) => (
                          <button
                            key={`lang-${lang.code}`}
                            onClick={() => {
                              setLanguage(lang.code as LanguageCode);
                              setShowLanguageMenu(false);
                            }}
                            className={`w-full px-4 py-3.5 min-h-[48px] text-left flex items-center gap-3 hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer touch-manipulation ${
                              language === lang.code ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'
                            }`}
                          >
                            <span className="text-lg">{lang.flag}</span>
                            <div className="flex-1">
                              <div className="text-sm font-bold">{lang.nativeName}</div>
                              <div className="text-xs text-slate-500">{lang.name}</div>
                            </div>
                            {language === lang.code && (
                              <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
                            )}
                          </button>
                        ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile: um só botão de login — mesma altura que o seletor de idioma para alinhar */}
            <Link
              href="/auth/login"
              className="sm:hidden h-11 flex items-center justify-center bg-white px-5 rounded-2xl shadow-xl touch-manipulation shrink-0 hover:bg-blue-50 active:scale-[0.98] transition-all"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
                {(t.nav as { loginButton?: string })?.loginButton ?? 'Entrar'}
              </span>
            </Link>
            {/* Desktop: Já tenho conta + Começar Grátis */}
            <Link
              href="/auth/login"
              className="hidden sm:flex text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors min-h-[44px] items-center px-2 shrink-0"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/auth/register"
              className="hidden sm:flex bg-white text-black px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-50 active:scale-[0.98] transition-all shadow-xl min-h-[44px] items-center justify-center touch-manipulation shrink-0"
            >
              {t.nav.register}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section — mobile: texto/botões mais pequenos; desktop: como antes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-28 md:pt-32 pb-20 sm:pb-32 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/10 blur-[160px] -z-10 rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] sm:text-[10px] font-black uppercase tracking-[0.3em] mb-4 sm:mb-8"
        >
          <Sparkles size={14} />
          {t.hero.badge}
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-5xl md:text-8xl font-black tracking-tighter mb-4 sm:mb-8 leading-[0.9] max-w-5xl mx-auto relative"
        >
          {t.hero.title1}
          <span className="text-blue-500 italic block md:inline">
            {' '}{t.hero.titleAccent}
          </span>
          {t.hero.title2}
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-400 text-sm sm:text-lg md:text-xl font-medium max-w-xl sm:max-w-2xl mx-auto italic mb-8 sm:mb-12"
        >
          {t.hero.description.split('Telegram').map((part, index, array) => {
            if (index === array.length - 1) return <span key={`desc-part-${index}`}>{part}</span>;
            return (
              <React.Fragment key={`desc-fragment-${index}`}>
                <span>{part}</span>
                <AnimatedTelegram key={`telegram-${index}`} />
              </React.Fragment>
            );
          })}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6"
        >
          <Link href="/auth/register" className="w-auto sm:w-auto bg-blue-600 text-white px-2 py-2 sm:px-12 sm:py-6 rounded-md sm:rounded-[24px] text-[8px] sm:text-xs font-black uppercase tracking-[0.1em] sm:tracking-[0.3em] hover:bg-blue-500 transition-all shadow-blue-600/20 shadow-lg sm:shadow-2xl flex items-center justify-center gap-1 sm:gap-3 touch-manipulation shrink-0">
            {t.hero.cta} 
            <ArrowRight size={12} className="sm:w-5 sm:h-5 shrink-0" />
          </Link>
          <Link href="#steps" className="w-auto sm:w-auto px-2 py-2 sm:px-12 sm:py-6 rounded-md sm:rounded-2xl text-[8px] sm:text-xs font-black uppercase tracking-[0.1em] sm:tracking-[0.3em] border border-slate-800 hover:bg-white/5 transition-all touch-manipulation shrink-0">
            {t.hero.seeHow}
          </Link>
        </motion.div>
      </section>

      {/* Linha separadora acima da secção de preços */}
      <div className="max-w-7xl mx-auto px-6" aria-hidden="true">
        <hr className="border-t border-white/10" />
      </div>

      {/* Pricing Section */}
      <motion.section 
        className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="text-center mb-12 sm:mb-20 md:mb-28 lg:mb-32">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-4 sm:mb-6 uppercase"
          >
            {t.pricingSection.title}
            <span className="text-blue-500 italic block md:inline">{' '}{t.pricingSection.titleAccent}</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm sm:text-lg md:text-xl lg:text-2xl text-slate-400 mb-4 sm:mb-6 md:mb-8 max-w-2xl mx-auto"
          >
            {t.pricingSection.subtitle1}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm sm:text-lg md:text-xl lg:text-2xl text-white font-semibold mb-6 sm:mb-8 md:mb-10 max-w-2xl mx-auto"
          >
            {t.pricingSection.subtitle2}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-stretch">
          {[
            {
              id: 'basic',
              planData: t.pricingSection.plans.basic,
              icon: Zap,
              popular: false,
            },
            {
              id: 'plus',
              planData: t.pricingSection.plans.plus,
              icon: Trophy,
              popular: true,
            },
            {
              id: 'pro',
              planData: t.pricingSection.plans.pro,
              icon: Crown,
              popular: false,
            }
          ].map((plan: any, index: number) => {
            const planData = plan.planData;
            return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-xl sm:rounded-3xl px-3 py-5 sm:p-8 md:p-9 overflow-visible group transition-all duration-300 flex flex-col ${
                plan.popular 
                  ? 'bg-slate-800/95 border-2 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.15)] hover:border-blue-500/70' 
                  : 'bg-slate-800/80 border border-slate-600/50 hover:border-slate-500/60 hover:bg-slate-800/90'
              } backdrop-blur-sm`}
            >
              {plan.popular && planData.popularLabel && (
                <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-2 py-1 sm:px-6 sm:py-2.5 rounded-md sm:rounded-2xl text-[8px] sm:text-sm font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-lg flex items-center gap-1 sm:gap-2 z-30 whitespace-nowrap">
                  <Trophy size={10} className="animate-pulse shrink-0 sm:w-4 sm:h-4" />
                  <span>{planData.popularLabel}</span>
                </div>
              )}
              
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-5">
                  <div className={`w-8 h-8 sm:w-16 sm:h-16 rounded-md sm:rounded-2xl flex items-center justify-center ${
                    plan.popular 
                      ? 'bg-blue-500/20 border-2 border-blue-500/40' 
                      : 'bg-slate-700/80 border border-slate-600/50'
                  }`}>
                    <plan.icon size={16} className="sm:w-8 sm:h-8 shrink-0" style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] sm:text-sm font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">{planData.name}</p>
                    <p className="text-lg sm:text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
                      {planData.price}
                    </p>
                    <p className="text-[9px] sm:text-sm text-slate-400 font-semibold mt-0.5">
                      {planData.priceSuffix}
                    </p>
                    {planData.priceSecondary && (
                      <p className="text-xs sm:text-base text-emerald-400 font-semibold mt-1 sm:mt-1.5">{planData.priceSecondary}</p>
                    )}
                  </div>
                </div>

                <p className="text-[10px] sm:text-base md:text-lg text-slate-400 mb-2 sm:mb-2 font-medium">{planData.tagline}</p>
                <p className="text-[10px] sm:text-base text-slate-500 mb-3 sm:mb-6 italic line-clamp-2 sm:line-clamp-none">&quot;{planData.quote}&quot;</p>

                <div className="space-y-1.5 sm:space-y-3 mb-3 sm:mb-6">
                  {planData.features.map((feature: string, fIndex: number) => (
                    <div key={fIndex} className="flex items-start gap-1 sm:gap-3">
                      <Check size={12} className="text-emerald-400 mt-0.5 shrink-0 sm:w-[22px] sm:h-[22px]" />
                      <p className="text-[10px] sm:text-base md:text-lg text-slate-200 font-medium">{feature}</p>
                    </div>
                  ))}
                </div>

                {planData.limitation && (
                  <p className="text-[10px] sm:text-base text-amber-400/90 mb-3 sm:mb-6 font-medium">🚫 {planData.limitation}</p>
                )}
                </div>

                <button
                  onClick={async () => {
                    if (user) {
                      try {
                        const priceIdMap: { [key: string]: string } = {
                          basic: 'price_1SuIypLtWlVpaXrbD7ph1fhf',
                          plus: 'price_1SuIzcLtWlVpaXrbLkHE0QbS',
                          pro: 'price_1SuJ0GLtWlVpaXrb8BH9HIve'
                        };
                        const priceId = priceIdMap[plan.id];
                        if (priceId) {
                          const res = await api.post('/stripe/create-checkout-session', null, {
                            params: { price_id: priceId }
                          });
                          window.location.href = res.data.url;
                        }
                      } catch (err: any) {
                        console.error('Error creating Stripe session:', err);
                        router.push(`/pricing?plan=${plan.id}`);
                      }
                    } else {
                      router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}`)}`);
                    }
                  }}
                  className={`mt-auto w-full block text-center px-2 py-1.5 sm:px-6 sm:py-4 rounded-md sm:rounded-2xl text-[9px] sm:text-base font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] transition-all cursor-pointer touch-manipulation ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                  }`}
                >
                  {planData.buttonText}
                </button>
              </div>
            </motion.div>
            );
          })}
        </div>

        {/* Linha separadora antes do Programa de Afiliados */}
        <div className="mt-28 mb-16 max-w-3xl mx-auto" aria-hidden="true">
          <hr className="border-t border-white/10" />
        </div>

        {/* Programa de Afiliados FinLy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs sm:text-base font-black uppercase tracking-[0.2em] mb-6 sm:mb-8">
            {t.pricingSection.affiliate.badge}
          </div>
          <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight mb-4 sm:mb-6 leading-tight">
            {t.pricingSection.affiliate.title}
          </h3>
          <p className="text-slate-400 text-sm sm:text-lg md:text-xl mb-6 sm:mb-10">
            {t.pricingSection.affiliate.description}
          </p>
          <ul className="flex flex-col items-center text-slate-200 text-sm sm:text-lg md:text-xl space-y-3 sm:space-y-4 mb-8 sm:mb-12 font-medium">
            {t.pricingSection.affiliate.benefits.map((benefit: string, index: number) => (
              <li key={index} className="flex items-center justify-center gap-3">{benefit}</li>
            ))}
          </ul>
          <div className="bg-slate-800/90 border border-slate-600/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl">
            <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400 mb-3 sm:mb-4">{t.pricingSection.affiliate.example.title}</p>
            <p className="text-sm sm:text-lg md:text-xl text-slate-200 font-medium mb-1">{t.pricingSection.affiliate.example.line1}</p>
            <p className="text-sm sm:text-lg md:text-xl text-slate-200 font-medium mb-4 sm:mb-5">{t.pricingSection.affiliate.example.line2}</p>
            <p className="text-xs sm:text-base text-slate-500">{t.pricingSection.affiliate.example.footer}</p>
          </div>
        </motion.div>

        {/* Sem risco, sem letras pequenas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 sm:mt-16 pt-12 sm:pt-16 border-t border-white/5"
        >
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-flex items-center gap-2 text-slate-500 text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
              {t.pricingSection.guarantee.title}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-12">
            {t.pricingSection.guarantee.items.map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-2 sm:gap-3 text-slate-400 text-xs sm:text-base">
                <Check size={16} className="text-emerald-400 shrink-0 sm:w-5 sm:h-5" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* Stats Section com animações */}
      <motion.section 
        className="border-y border-white/5 bg-slate-950/50 backdrop-blur-sm relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div 
          className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12"
          initial={{ y: 50 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {[
            { value: '180€', label: t.stats.saved },
            { value: '3s', label: t.stats.time },
            { value: '99.9%', label: t.stats.success }
          ].map((stat, index) => (
            <motion.div
              key={index}
              className={`text-center ${index === 1 ? 'border-y md:border-y-0 md:border-x border-white/5 py-8 md:py-0' : ''}`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              whileHover={{ scale: 1.1, y: -5 }}
            >
              <motion.p 
                className="text-3xl sm:text-4xl font-black tracking-tighter mb-2"
                animate={{
                  textShadow: [
                    '0 0 10px rgba(59, 130, 246, 0.3)',
                    '0 0 20px rgba(59, 130, 246, 0.5)',
                    '0 0 10px rgba(59, 130, 246, 0.3)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {stat.value}
              </motion.p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* Steps Section */}
      <section id="steps" className="max-w-7xl mx-auto px-6 py-20 sm:py-32">
        <div className="text-center mb-16 sm:mb-24">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-4 sm:mb-6 uppercase">
            {t.steps.title}
            <span className="text-blue-500 italic block md:inline"> {t.steps.titleAccent}</span>
          </h2>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {t.steps.items.map((step: any, index: number) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-900/50 border border-slate-800 p-6 sm:p-12 rounded-2xl sm:rounded-[32px] hover:border-blue-500/30 transition-colors group"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-500 mb-5 sm:mb-8">
                  {index === 0 ? <Phone size={24} className="sm:w-8 sm:h-8" /> : index === 1 ? <MessageSquare size={24} className="sm:w-8 sm:h-8" /> : <Zap size={24} className="sm:w-8 sm:h-8" />}
                </div>
                <h3 className="text-base sm:text-xl font-black tracking-tight mb-3 sm:mb-4 uppercase relative z-10">{step.t}</h3>
                <p className="text-sm sm:text-base text-slate-400 font-medium italic leading-relaxed relative z-10">{step.d}</p>
              </motion.div>
            ))}
          </div>
      </section>

      {/* Resources Grid */}
      <section className="bg-[#03081c] py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 sm:mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 sm:mb-8">
              <Zap size={14} />
              {t.resources.badge}
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-4 sm:mb-6 uppercase">
              {t.resources.title}
              <span className="text-blue-500 italic block md:inline"> {t.resources.titleAccent}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {t.resources.items.map((resource: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-5 sm:p-8 rounded-2xl sm:rounded-[32px] bg-slate-900/30 border border-slate-800/50 hover:bg-slate-900/50 transition-all cursor-default relative overflow-hidden group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 mb-4 sm:mb-6">
                  {index === 0 ? <Phone size={24} /> : index === 1 ? <BarChart3 size={24} /> : index === 2 ? <Globe size={24} /> : index === 3 ? <ShieldCheck size={24} /> : index === 4 ? <Trophy size={24} /> : <Star size={24} />}
                </div>
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-2 sm:mb-3 relative z-10">{resource.t}</h4>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed italic relative z-10">{resource.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials com animações */}
      <motion.section 
        className="max-w-7xl mx-auto px-6 py-20 sm:py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {t.testimonials.items.map((item: any, index: number) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative p-6 sm:p-12 bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-[32px]"
            >
              <div className="absolute -top-4 left-6 sm:-top-6 sm:left-12 w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-xl font-black shadow-xl">
                {item.initial}
              </div>
              <p className="text-sm sm:text-lg font-medium italic text-slate-300 mb-6 sm:mb-8 leading-relaxed relative z-10">
                "{item.text}"
              </p>
              <div className="relative z-10">
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">{item.name}</p>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-600">{item.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ com animações */}
      <motion.section 
        className="max-w-3xl mx-auto px-6 py-20 sm:py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div 
          className="text-center mb-16 sm:mb-24"
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl font-black tracking-tighter mb-4 sm:mb-6 uppercase">
            {t.faq.title}
            <motion.span 
              className="text-blue-500 italic block md:inline"
              animate={{
                textShadow: [
                  '0 0 20px rgba(59, 130, 246, 0.5)',
                  '0 0 40px rgba(59, 130, 246, 0.8)',
                  '0 0 20px rgba(59, 130, 246, 0.5)'
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {' '}{t.faq.titleAccent}
            </motion.span>
          </h2>
        </motion.div>

        <div className="space-y-6">
          {t.faq.items.map((item: any, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ 
                x: 10,
                scale: 1.02,
                boxShadow: '0 20px 40px rgba(59, 130, 246, 0.15)'
              }}
              className="p-5 sm:p-8 bg-slate-900/30 border border-slate-800 rounded-2xl sm:rounded-[32px] relative overflow-hidden group cursor-pointer"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-500"
              />
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3 relative z-10">
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-blue-500"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.7, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {item.q}
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed italic ml-4 relative z-10">{item.a}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer com animações */}
      <motion.footer 
        className="border-t border-white/5 bg-[#010413] relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent"
          animate={{
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center relative z-10">
          <motion.div 
            className="flex items-center gap-3 mb-8"
            whileHover={{ scale: 1.1 }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={16} />
            </div>
            <motion.span 
              className="text-xl font-black tracking-tighter uppercase"
              animate={{
                textShadow: [
                  '0 0 10px rgba(59, 130, 246, 0.3)',
                  '0 0 20px rgba(59, 130, 246, 0.5)',
                  '0 0 10px rgba(59, 130, 246, 0.3)'
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              Finly
            </motion.span>
          </motion.div>
          
          <motion.p 
            className="text-xs font-black uppercase tracking-[0.5em] text-slate-700 mb-12"
            animate={{
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {t.footer.slogan}
          </motion.p>

          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-16">
            {t.footer.links.map((link: string, index: number) => {
              const hrefMap: { [key: string]: string } = {
                'Termos': '/terms',
                'Terms': '/terms',
                'Privacidade': '/privacy',
                'Privacy': '/privacy',
                'Cookies': '#'
              };
              return (
                <Link 
                  key={index}
                  href={hrefMap[link] || '#'} 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors"
                >
                  {link}
                </Link>
              );
            })}
          </div>

          <motion.div 
            className="flex items-center gap-2 text-[8px] font-black text-slate-800 uppercase tracking-[0.4em]"
            animate={{
              opacity: [0.6, 1, 0.6]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div>
              <CheckCircle2 size={12} />
            </div>
            {t.footer.badge}
          </motion.div>
        </div>
      </motion.footer>
    </div>
    </>
  );
}
