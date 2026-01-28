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
    "description": "Registe despesas no Telegram em 3 segundos. O Finly elimina a confusão das contas e ajuda-te a alcançar a paz financeira.",
    "featureList": [
      "Registo de despesas via Telegram",
      "Gráficos inteligentes",
      "Categorização automática",
      "Insights de IA",
      "Gestão de orçamento"
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
              className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 select-none pointer-events-none object-contain"
              draggable="false"
            />
            <span
              className="text-white font-semibold tracking-tight text-xl sm:text-3xl leading-none whitespace-nowrap"
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
                {t.nav?.loginButton ?? 'Entrar'}
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

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-32 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/10 blur-[160px] -z-10 rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8"
        >
          <Sparkles size={14} />
          {t.hero.badge}
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9] max-w-5xl mx-auto relative"
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
          className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mx-auto italic mb-12"
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
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <Link href="/auth/register" className="w-full sm:w-auto bg-blue-600 text-white px-12 py-6 rounded-[24px] text-xs font-black uppercase tracking-[0.3em] hover:bg-blue-500 transition-all shadow-blue-600/20 shadow-2xl flex items-center justify-center gap-3">
            {t.hero.cta} 
            <ArrowRight size={20} />
          </Link>
          <Link href="#steps" className="w-full sm:w-auto px-12 py-6 rounded-2xl text-xs font-black uppercase tracking-[0.3em] border border-slate-800 hover:bg-white/5 transition-all">
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
        className="max-w-7xl mx-auto px-6 py-20 md:py-28"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="text-center mb-20 md:mb-28 lg:mb-32">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase"
          >
            Quanto vale ter{' '}
            <span className="text-blue-500 italic block md:inline">controlo total do teu dinheiro</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg md:text-xl lg:text-2xl text-slate-400 mb-6 md:mb-8 max-w-2xl mx-auto"
          >
            A maioria das pessoas não sabe para onde o dinheiro vai.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg md:text-xl lg:text-2xl text-white font-semibold mb-8 md:mb-10 max-w-2xl mx-auto"
          >
            Quem usa a FinLy sabe. E alguns ainda ganham com isso.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {[
            {
              id: 'basic',
              name: 'FinLy Basic',
              tagline: 'Começa hoje. Sem complicações.',
              price: '9,99€',
              priceSuffix: '/ mês',
              priceSecondary: null,
              quote: 'Quero organizar o meu dinheiro antes de pensar em ganhar com isso.',
              features: ['Registo simples de todos os gastos', 'Categorias automáticas', 'Visão clara do teu mês financeiro', 'Relatórios mensais'],
              limitation: 'Programa de afiliados bloqueado nos primeiros 3 meses',
              buttonText: 'Começar agora',
              icon: Zap,
              popular: false,
            },
            {
              id: 'plus',
              name: 'FinLy Plus',
              tagline: 'O plano de quem pensa mais à frente',
              price: '49,99€',
              priceSuffix: '/ 6 meses',
              priceSecondary: '≈ 8,33€ / mês',
              quote: 'Já uso a FinLy e quero que ela comece a trabalhar para mim.',
              features: ['Tudo do FinLy Basic', 'Acesso imediato ao programa de afiliados', '20% de comissão recorrente', 'Dashboard de ganhos em tempo real', 'Link exclusivo para indicações'],
              limitation: null,
              buttonText: 'Quero começar a ganhar com a FinLy',
              icon: Trophy,
              popular: true,
              popularLabel: '🔥 MAIS ESCOLHIDO',
            },
            {
              id: 'pro',
              name: 'FinLy Pro',
              tagline: 'Para quem quer pagar menos, ganhar mais e ficar à frente',
              price: '89,99€',
              priceSuffix: '/ ano',
              priceSecondary: '≈ 7,49€ / mês',
              quote: 'Quero tudo. O menor preço e o maior retorno.',
              features: ['Tudo do FinLy Plus', '25% de comissão recorrente (mais ganhos por indicação)', 'Relatório anual inteligente', 'Insights automáticos de gastos e padrões', 'Acesso antecipado a novas funcionalidades'],
              limitation: null,
              buttonText: 'Quero o plano mais completo',
              icon: Crown,
              popular: false,
            }
          ].map((plan: any, index: number) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-3xl p-8 md:p-9 overflow-visible group transition-all duration-300 flex flex-col ${
                plan.popular 
                  ? 'bg-slate-800/95 border-2 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.15)] hover:border-blue-500/70' 
                  : 'bg-slate-800/80 border border-slate-600/50 hover:border-slate-500/60 hover:bg-slate-800/90'
              } backdrop-blur-sm`}
            >
              {plan.popular && plan.popularLabel && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-6 py-2.5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 z-30 whitespace-nowrap">
                  <Trophy size={16} className="animate-pulse" />
                  <span>{plan.popularLabel}</span>
                </div>
              )}
              
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                    plan.popular 
                      ? 'bg-blue-500/20 border-2 border-blue-500/40' 
                      : 'bg-slate-700/80 border border-slate-600/50'
                  }`}>
                    <plan.icon size={32} style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">{plan.name}</p>
                    <p className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
                      {plan.price}
                    </p>
                    <p className="text-sm text-slate-400 font-semibold mt-0.5">
                      {plan.priceSuffix}
                    </p>
                    {plan.priceSecondary && (
                      <p className="text-base text-emerald-400 font-semibold mt-1.5">{plan.priceSecondary}</p>
                    )}
                  </div>
                </div>

                <p className="text-base md:text-lg text-slate-400 mb-2 font-medium">{plan.tagline}</p>
                <p className="text-base text-slate-500 mb-6 italic">&quot;{plan.quote}&quot;</p>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature: string, fIndex: number) => (
                    <div key={fIndex} className="flex items-start gap-3">
                      <Check size={22} className="text-emerald-400 mt-0.5 shrink-0" />
                      <p className="text-base md:text-lg text-slate-200 font-medium">{feature}</p>
                    </div>
                  ))}
                </div>

                {plan.limitation && (
                  <p className="text-base text-amber-400/90 mb-6 font-medium">🚫 {plan.limitation}</p>
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
                        console.error('Erro ao criar sessão Stripe:', err);
                        router.push(`/pricing?plan=${plan.id}`);
                      }
                    } else {
                      router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}`)}`);
                    }
                  }}
                  className={`mt-auto w-full block text-center px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-black uppercase tracking-[0.2em] transition-all cursor-pointer ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </motion.div>
          ))}
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
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-base font-black uppercase tracking-[0.2em] mb-8">
            💸 Programa de Afiliados FinLy
          </div>
          <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
            Usa. Indica. Ganha.
          </h3>
          <p className="text-slate-400 text-lg md:text-xl mb-10">
            Sempre que alguém entra na FinLy pelo teu link:
          </p>
          <ul className="flex flex-col items-center text-slate-200 text-lg md:text-xl space-y-4 mb-12 font-medium">
            <li className="flex items-center justify-center gap-3">🔁 Recebes comissão todos os meses</li>
            <li className="flex items-center justify-center gap-3">💰 20% (Plus) ou 25% (Pro)</li>
            <li className="flex items-center justify-center gap-3">📊 Tudo transparente no dashboard</li>
            <li className="flex items-center justify-center gap-3">⏳ Ganhas enquanto a pessoa continuar ativa</li>
          </ul>
          <div className="bg-slate-800/90 border border-slate-600/60 rounded-3xl p-6 md:p-8 shadow-xl">
            <p className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">📌 Exemplo simples:</p>
            <p className="text-lg md:text-xl text-slate-200 font-medium mb-1">10 pessoas no plano mensal → ~20€ por mês</p>
            <p className="text-lg md:text-xl text-slate-200 font-medium mb-5">50 pessoas → ~100€ por mês</p>
            <p className="text-base text-slate-500">Sem anúncios. Sem suporte. Sem esforço extra.</p>
          </div>
        </motion.div>

        {/* Sem risco, sem letras pequenas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 pt-16 border-t border-white/5"
        >
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 text-slate-500 text-sm font-black uppercase tracking-[0.2em]">
              🔒 Sem risco, sem letras pequenas
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-12">
            <div className="flex items-center gap-3 text-slate-400 text-base">
              <Check size={20} className="text-emerald-400 shrink-0" />
              Pagamento seguro
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-base">
              <Check size={20} className="text-emerald-400 shrink-0" />
              Cancela quando quiseres
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-base">
              <Check size={20} className="text-emerald-400 shrink-0" />
              Sem fidelização forçada
            </div>
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
                className="text-4xl font-black tracking-tighter mb-2"
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
      <section id="steps" className="max-w-7xl mx-auto px-6 py-32">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase">
            {t.steps.title}
            <span className="text-blue-500 italic block md:inline"> {t.steps.titleAccent}</span>
          </h2>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {t.steps.items.map((step: any, index: number) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-900/50 border border-slate-800 p-12 rounded-[32px] hover:border-blue-500/30 transition-colors group"
              >
                <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-blue-500 mb-8">
                  {index === 0 ? <Phone size={32} /> : index === 1 ? <MessageSquare size={32} /> : <Zap size={32} />}
                </div>
                <h3 className="text-xl font-black tracking-tight mb-4 uppercase relative z-10">{step.t}</h3>
                <p className="text-slate-400 font-medium italic leading-relaxed relative z-10">{step.d}</p>
              </motion.div>
            ))}
          </div>
      </section>

      {/* Resources Grid */}
      <section className="bg-[#03081c] py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              <Zap size={14} />
              {t.resources.badge}
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase">
              {t.resources.title}
              <span className="text-blue-500 italic block md:inline"> {t.resources.titleAccent}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.resources.items.map((resource: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-[32px] bg-slate-900/30 border border-slate-800/50 hover:bg-slate-900/50 transition-all cursor-default relative overflow-hidden group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 mb-6">
                  {index === 0 ? <Phone size={24} /> : index === 1 ? <BarChart3 size={24} /> : index === 2 ? <Globe size={24} /> : index === 3 ? <ShieldCheck size={24} /> : index === 4 ? <Trophy size={24} /> : <Star size={24} />}
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest mb-3 relative z-10">{resource.t}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed italic relative z-10">{resource.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials com animações */}
      <motion.section 
        className="max-w-7xl mx-auto px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {t.testimonials.items.map((item: any, index: number) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative p-12 bg-slate-950 border border-slate-800 rounded-[32px]"
            >
              <div className="absolute -top-6 left-12 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-xl">
                {item.initial}
              </div>
              <p className="text-lg font-medium italic text-slate-300 mb-8 leading-relaxed relative z-10">
                "{item.text}"
              </p>
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-widest text-white">{item.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{item.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ com animações */}
      <motion.section 
        className="max-w-3xl mx-auto px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div 
          className="text-center mb-24"
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-black tracking-tighter mb-6 uppercase">
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
              className="p-8 bg-slate-900/30 border border-slate-800 rounded-[32px] relative overflow-hidden group cursor-pointer"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-500"
              />
              <h4 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-3 relative z-10">
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
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic ml-4 relative z-10">{item.a}</p>
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
        <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center text-center relative z-10">
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
            <Link href="/terms" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors">
              Termos
            </Link>
            <Link href="/privacy" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors">
              Privacidade
            </Link>
            <Link href="#" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors">
              Cookies
            </Link>
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
