'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Star, Zap, Crown, ShieldCheck, 
  ArrowRight, Sparkles, Trophy, CreditCard, X,
  Rocket, Gift, Lock
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import AlertModal from '@/components/AlertModal';
import { STRIPE_PRICE_IDS } from '@/lib/stripePrices';

interface PricingModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function PricingModal({ isVisible, onClose }: PricingModalProps) {
  const { t, formatCurrency } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  });

  // Prevenir scroll horizontal quando modal está aberto
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflowX = 'hidden';
      document.documentElement.style.overflowX = 'hidden';
    } else {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    }
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, [isVisible]);

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId);
      const res = await api.post('/stripe/create-checkout-session', null, {
        params: { price_id: priceId }
      });
      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: t.dashboard.sidebar.toastTypes.error,
        message: t.dashboard.pricing.monthlyPlan.error,
        type: 'error'
      });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'monthly',
      name: t.dashboard.pricing.monthlyPlan.name,
      price: 9.99,
      priceId: STRIPE_PRICE_IDS.basic,
      description: t.dashboard.pricing.monthlyPlan.description,
      features: t.dashboard.pricing.monthlyPlan.features,
      icon: Zap,
      color: 'blue'
    },
    {
      id: 'yearly',
      name: t.dashboard.pricing.yearlyPlan.name,
      price: 89.90, // ~7.49/mês
      priceId: STRIPE_PRICE_IDS.pro,
      description: t.dashboard.pricing.yearlyPlan.description,
      features: t.dashboard.pricing.yearlyPlan.features,
      icon: Crown,
      popular: true,
      color: 'indigo'
    }
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-2 lg:p-4 overflow-y-auto overflow-x-hidden max-w-full">
          {/* Backdrop - Independent Full Screen */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl transition-all duration-300"
            style={{ willChange: 'backdrop-filter' }}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            className="relative w-full max-w-full lg:max-w-[1600px] min-h-[85dvh] sm:min-h-[92vh] max-h-[95dvh] sm:max-h-[95vh] my-0 sm:my-4 bg-[#0f172a] border border-white/10 rounded-t-3xl sm:rounded-[32px] overflow-hidden shadow-[0_0_150px_-20px_rgba(59,130,246,0.3)] flex flex-col lg:flex-row z-10 min-w-0"
          >
            {/* Left Side - Visual Marketing */}
            <div className="w-full lg:w-[35%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-6 sm:p-12 md:p-16 lg:p-24 flex flex-col justify-between relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-[300px] sm:w-[400px] lg:w-[600px] h-[300px] sm:h-[400px] lg:h-[600px] bg-white/10 blur-[130px] rounded-full -mr-32 sm:-mr-48 lg:-mr-64 -mt-32 sm:-mt-48 lg:-mt-64" />
              
              <div className="relative z-10 text-white">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-24 h-24 bg-white/20 backdrop-blur-2xl rounded-[36px] flex items-center justify-center mb-16 shadow-2xl border border-white/20"
                >
                  <Rocket size={48} className="text-white" />
                </motion.div>
                <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-6 sm:mb-10 leading-[0.8]">
                  A tua <br />
                  <span className="text-blue-200 italic">{t.pricing.newEra}</span> <br />
                  Financeira.
                </h2>
                <p className="text-blue-100 font-medium italic text-lg sm:text-xl md:text-2xl leading-relaxed mb-8 sm:mb-16 max-w-lg">
                  Desbloqueia ferramentas de elite que os bancos não querem que uses. IA, automação e clareza total.
                </p>
                
                <div className="space-y-8">
                  <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl p-6 rounded-[32px] border border-white/10 shadow-xl">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                      <Lock size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">Poder Ilimitado</p>
                      <p className="text-xs text-blue-200">Sem limites de despesas ou categorias para sempre.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl p-6 rounded-[32px] border border-white/10 shadow-xl">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-white/10 shrink-0">
                      <Sparkles size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">Cérebro de IA</p>
                      <p className="text-xs text-blue-200">Conselhos de poupança gerados por algoritmos avançados.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-16 relative z-10 flex items-center gap-4 text-blue-200/60 font-black uppercase tracking-[0.4em] text-[11px]">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Pagamento Seguro & Encriptado
              </div>
            </div>

            {/* Right Side - Pricing Options */}
            <div className="flex-1 w-full min-w-0 p-4 sm:p-8 md:p-12 lg:p-20 xl:p-32 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col overflow-y-auto no-scrollbar relative bg-[#020617]">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 lg:top-12 lg:right-12 p-2 sm:p-4 hover:bg-white/5 rounded-full text-slate-500 transition-colors cursor-pointer z-20"
              >
                <X size={24} className="sm:w-8 sm:h-8" />
              </button>

              <div className="text-center mb-8 sm:mb-12 lg:mb-20">
                <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-10">
                  <Gift size={14} className="sm:w-[18px] sm:h-[18px]" />
                  Oferta de Boas-Vindas
                </div>
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter uppercase mb-2 sm:mb-4">Escolhe o teu plano</h3>
                <p className="text-slate-500 text-sm sm:text-base lg:text-lg font-medium italic">A tua liberdade financeira começa com um clique.</p>
                
                {/* Billing Toggle */}
                <div className="mt-6 sm:mt-8 lg:mt-12 flex items-center justify-center gap-4 sm:gap-6 lg:gap-10 flex-wrap">
                  <span className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Faturação Mensal</span>
                  <button 
                    onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                    className="w-16 sm:w-20 h-8 sm:h-10 bg-slate-800 rounded-full relative p-1 transition-all hover:bg-slate-700"
                  >
                    <motion.div 
                      animate={{ x: billingCycle === 'monthly' ? 0 : 32 }}
                      className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                    />
                  </button>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>Faturação Anual</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 sm:px-4 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest animate-pulse">
                      -25% OFF
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 max-w-5xl mx-auto w-full px-2 sm:px-0 min-w-0">
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`relative group rounded-[24px] sm:rounded-[32px] border transition-all duration-500 flex flex-col ${
                      plan.popular 
                      ? 'bg-blue-600/5 border-blue-500/30 p-6 sm:p-8 lg:p-10 shadow-2xl md:scale-105 z-10' 
                      : 'bg-slate-950/50 border-slate-800 p-6 sm:p-8 lg:p-10'
                    } hover:-translate-y-2 hover:border-blue-500/50`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 sm:-top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-1 sm:gap-2">
                        <Trophy size={10} className="sm:w-3 sm:h-3" /> Recomendado
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-6 sm:mb-8">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-[16px] sm:rounded-[20px] lg:rounded-[24px] flex items-center justify-center transition-transform group-hover:scale-110 ${plan.popular ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                        <plan.icon size={24} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                      </div>
                      <div className="text-right min-w-0 flex-shrink">
                        <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1 truncate">{plan.name}</p>
                        <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter break-words">
                          {formatCurrency(billingCycle === 'yearly' && plan.id === 'yearly' ? plan.price : (plan.id === 'yearly' ? 9.99 : plan.price))}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold uppercase mt-1">/ {billingCycle === 'monthly' ? t.pricing.yearly.periodMonth : t.pricing.yearly.periodYear}</p>
                      </div>
                    </div>

                    <div className="space-y-3 sm:space-y-4 lg:space-y-5 mb-6 sm:mb-8 lg:mb-10 flex-grow">
                      {plan.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400 font-medium group/feat">
                          <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 ${plan.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                            <Check size={10} className="sm:w-3 sm:h-3" strokeWidth={4} />
                          </div>
                          <span className="group-hover/feat:text-slate-200 transition-colors">{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loading !== null}
                      className={`w-full py-4 sm:py-5 lg:py-6 rounded-[16px] sm:rounded-[20px] lg:rounded-[24px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-2 sm:gap-3 cursor-pointer ${
                        plan.popular 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] active:scale-95' 
                        : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 active:scale-95'
                      }`}
                    >
                      {loading === plan.priceId ? <Loader2 size={18} className="sm:w-5 sm:h-5 animate-spin" /> : <>Ativar Plano Pro <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px]" /></>}
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-10 text-center text-[10px] text-slate-600 font-medium italic">
                {t.pricing.cancelSubscription}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </AnimatePresence>
  );
}

const Loader2 = ({ size, className }: { size: number, className: string }) => (
  <svg 
    className={className} 
    width={size} height={size} 
    viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" 
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

