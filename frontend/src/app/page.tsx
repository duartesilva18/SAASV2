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

      {/* Navbar com animação */}
      <motion.nav 
        className="max-w-7xl mx-auto px-6 py-0 flex items-center justify-between border-b border-white/5 relative z-40"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
      >
        <motion.div 
          className="flex items-center select-none p-0 m-0"
          whileHover={{ scale: 1.05 }}
        >
          <motion.img
            src="/images/logo/logo.png"
            alt="Finly"
            className="h-64 w-auto m-0 p-0 select-none pointer-events-none"
            whileHover={{ scale: 1.1 }}
            draggable="false"
          />
        </motion.div>
        
        <div className="flex items-center gap-4 md:gap-8">
          {/* Language Selector */}
          <div className="relative">
            <motion.button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition-all text-slate-300 hover:text-white cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Globe size={18} />
              <span className="text-xs font-bold hidden sm:inline">
                {availableLanguages[language]?.flag} {availableLanguages[language]?.code.toUpperCase()}
              </span>
              <span className="text-xs font-bold sm:hidden">
                {availableLanguages[language]?.flag}
              </span>
            </motion.button>

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
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-800 transition-colors cursor-pointer ${
                            language === lang.code ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'
                          }`}
                        >
                          <span className="text-lg">{lang.flag}</span>
                          <div className="flex-1">
                            <div className="text-sm font-bold">{lang.nativeName}</div>
                            <div className="text-xs text-slate-500">{lang.name}</div>
                          </div>
                          {language === lang.code && (
                            <CheckCircle2 size={16} className="text-blue-400" />
                          )}
                        </button>
                      ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <Link href="/auth/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors hidden md:block">
            {t.nav.login}
          </Link>
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/auth/register" className="bg-white text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-50 transition-all shadow-xl">
              {t.nav.register}
            </Link>
          </motion.div>
        </div>
      </motion.nav>

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
          <Link href="/auth/register" className="w-full sm:w-auto bg-blue-600 text-white px-12 py-6 rounded-3xl text-xs font-black uppercase tracking-[0.3em] hover:bg-blue-500 transition-all shadow-blue-600/20 shadow-2xl flex items-center justify-center gap-3">
            {t.hero.cta} 
            <ArrowRight size={20} />
          </Link>
          <Link href="#steps" className="w-full sm:w-auto px-12 py-6 rounded-3xl text-xs font-black uppercase tracking-[0.3em] border border-slate-800 hover:bg-white/5 hover:rounded-3xl transition-all">
            {t.hero.seeHow}
          </Link>
        </motion.div>
      </section>

      {/* Pricing Section */}
      <motion.section 
        className="max-w-7xl mx-auto px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8"
          >
            <Sparkles size={14} />
            Escolhe o teu plano
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black tracking-tighter mb-6"
          >
            Investe na tua <span className="text-blue-400">Liberdade Financeira</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              id: 'monthly',
              name: 'Plano Básico',
              price: 9.99,
              description: 'Acesso ao dashboard',
              features: [
                'Dashboard completo',
                'Registo de despesas',
                'Gráficos básicos',
                'Suporte por email'
              ],
              icon: Zap,
            },
            {
              id: '3months',
              name: 'Plano 3 Meses',
              price: 24.99,
              description: 'Acesso completo + Programa de Afiliados',
              features: [
                'Dashboard completo',
                'Programa de Afiliados',
                'Todas as funcionalidades Pro',
                'Suporte prioritário'
              ],
              icon: Trophy,
              popular: true,
            },
            {
              id: 'yearly',
              name: 'Plano Anual',
              price: 89.90,
              description: 'Acesso completo + Programa de Afiliados',
              features: [
                'Dashboard completo',
                'Programa de Afiliados',
                'Todas as funcionalidades Pro',
                'Suporte prioritário',
                'Economiza 25%'
              ],
              icon: Crown,
            }
          ].map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-slate-900/40 backdrop-blur-xl border rounded-[32px] p-8 shadow-xl overflow-visible group transition-all ${
                plan.popular 
                  ? 'border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.1)]' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-2 z-30 whitespace-nowrap">
                  <Trophy size={12} className="animate-pulse" />
                  <span>Recomendado</span>
                </div>
              )}
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${
                    plan.popular 
                      ? 'from-blue-500/30 to-indigo-500/30' 
                      : 'from-slate-800/50 to-slate-900/50'
                  } rounded-2xl flex items-center justify-center border ${
                    plan.popular ? 'border-blue-500/40' : 'border-slate-700/50'
                  }`}>
                    <plan.icon size={28} style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">{plan.name}</p>
                    <p className="text-4xl font-black text-white tracking-tighter">
                      {plan.price.toFixed(2)}€
                    </p>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-1">
                      / {plan.id === 'yearly' ? 'Ano' : plan.id === '3months' ? '3 Meses' : 'Mês'}
                    </p>
                  </div>
                </div>

                <p className="text-base text-slate-400 mb-4 italic">{plan.description}</p>

                <div className="space-y-2 mb-6">
                  {plan.features.map((feature: string, fIndex: number) => (
                    <div key={fIndex} className="flex items-start gap-2">
                      <Check size={18} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-300 font-medium">{feature}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={async () => {
                    if (user) {
                      // Se o utilizador está autenticado, criar sessão Stripe diretamente
                      try {
                        const priceIdMap: { [key: string]: string } = {
                          'monthly': 'price_1SrkUWLtWlVpaXrb8zFq6OvW',
                          '3months': 'price_1Stb4lLtWlVpaXrbdoI7hHDx',
                          'yearly': 'price_1SrkUrLtWlVpaXrb8zFq6OvW'
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
                        // Se falhar, redirecionar para pricing como fallback
                        router.push(`/pricing?plan=${plan.id}`);
                      }
                    } else {
                      // Se não está autenticado, redirecionar para login com redirect para pricing
                      router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}`)}`);
                    }
                  }}
                  className={`w-full block text-center px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all cursor-pointer ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  Escolher Plano
                </button>
              </div>
            </motion.div>
          ))}
        </div>
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
                className="bg-slate-900/50 border border-slate-800 p-12 rounded-[48px] hover:border-blue-500/30 transition-colors group"
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
              className="relative p-12 bg-slate-950 border border-slate-800 rounded-[48px]"
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
