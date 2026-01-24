'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Star, Zap, Crown, ShieldCheck, 
  ArrowRight, Sparkles, Trophy, CreditCard, X,
  Rocket, Gift, Lock, Loader2
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

interface PricingModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function PricingModal({ isVisible, onClose }: PricingModalProps) {
  const { t, formatCurrency } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId);
      const res = await api.post('/stripe/create-checkout-session', null, {
        params: { price_id: priceId }
      });
      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      alert(t.dashboard.pricing.monthlyPlan.error);
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'monthly',
      name: t.dashboard.pricing.monthlyPlan.name,
      price: 9.99,
      priceId: 'price_1SrkUWLtWlVpaXrb8zFq6OvW',
      description: t.dashboard.pricing.monthlyPlan.description,
      features: t.dashboard.pricing.monthlyPlan.features,
      icon: Zap,
      color: 'blue'
    },
    {
      id: 'yearly',
      name: t.dashboard.pricing.yearlyPlan.name,
      price: 89.90, // ~7.49/mês
      priceId: 'price_1SrkUrLtWlVpaXrb8zFq6OvW',
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 lg:p-8 overflow-y-auto">
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[1600px] min-h-[100vh] sm:min-h-0 sm:h-auto sm:max-h-[95vh] md:h-[92vh] bg-[#0f172a] border border-white/10 rounded-2xl sm:rounded-3xl md:rounded-[64px] overflow-hidden shadow-[0_0_150px_-20px_rgba(59,130,246,0.3)] flex flex-col lg:flex-row z-10 my-2 sm:my-0"
          >
            {/* Left Side - Visual Marketing */}
            <div className="lg:w-[35%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-4 sm:p-6 md:p-12 lg:p-16 xl:p-24 flex flex-col justify-between relative overflow-hidden shrink-0 min-h-[250px] sm:min-h-[300px] md:min-h-auto">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] md:w-[600px] md:h-[600px] bg-white/10 blur-[130px] rounded-full -mr-16 sm:-mr-32 md:-mr-64 -mt-16 sm:-mt-32 md:-mt-64" />
              
              <div className="relative z-10 text-white">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 bg-white/20 backdrop-blur-2xl rounded-xl sm:rounded-2xl md:rounded-[36px] flex items-center justify-center mb-4 sm:mb-8 md:mb-16 shadow-2xl border border-white/20"
                >
                  <Rocket size={24} className="sm:w-8 sm:h-8 md:w-12 md:h-12 text-white" />
                </motion.div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-8xl font-black tracking-tighter mb-4 sm:mb-6 md:mb-10 leading-[0.95] sm:leading-[0.9] md:leading-[0.8]">
                  {t.dashboard.pricing.leftSide.title} <br />
                  <span className="text-blue-200 italic">{t.dashboard.pricing.leftSide.titleAccent}</span> <br />
                  {t.dashboard.pricing.leftSide.titleEnd}
                </h2>
                <p className="text-blue-100 font-medium italic text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl leading-relaxed mb-6 sm:mb-8 md:mb-16 max-w-lg">
                  {t.dashboard.pricing.leftSide.description}
                </p>
                
                <div className="space-y-3 sm:space-y-4 md:space-y-8">
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-6 bg-white/10 backdrop-blur-xl p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl md:rounded-[32px] border border-white/10 shadow-xl">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg sm:rounded-xl md:rounded-2xl bg-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                      <Lock size={16} className="sm:w-5 sm:h-5 md:w-7 md:h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest leading-none mb-0.5 sm:mb-1">{t.dashboard.pricing.leftSide.unlimitedPower}</p>
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-blue-200 leading-tight">{t.dashboard.pricing.leftSide.unlimitedPowerDesc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-6 bg-white/10 backdrop-blur-xl p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl md:rounded-[32px] border border-white/10 shadow-xl">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg sm:rounded-xl md:rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-white/10 shrink-0">
                      <Sparkles size={16} className="sm:w-5 sm:h-5 md:w-7 md:h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest leading-none mb-0.5 sm:mb-1">{t.dashboard.pricing.leftSide.aiBrain}</p>
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-blue-200 leading-tight">{t.dashboard.pricing.leftSide.aiBrainDesc}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 md:mt-16 relative z-10 flex items-center gap-1.5 sm:gap-2 md:gap-4 text-blue-200/60 font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.4em] text-[8px] sm:text-[9px] md:text-[11px]">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                {t.dashboard.pricing.leftSide.securePayment}
              </div>
            </div>

            {/* Right Side - Pricing Options */}
            <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12 xl:p-20 2xl:p-32 flex flex-col overflow-y-auto no-scrollbar relative bg-[#020617]">
              <button 
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 md:top-6 md:right-6 lg:top-12 lg:right-12 p-1.5 sm:p-2 md:p-4 hover:bg-white/5 rounded-full text-slate-500 transition-colors cursor-pointer z-20"
              >
                <X size={20} className="sm:w-6 sm:h-6 md:w-8 md:h-8" />
              </button>

              <div className="text-center mb-6 sm:mb-8 md:mb-10 lg:mb-20">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] mb-4 sm:mb-6 md:mb-10">
                  <Gift size={12} className="sm:w-3.5 sm:h-3.5 md:w-[18px] md:h-[18px]" />
                  {t.dashboard.pricing.modal.welcomeOffer}
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-2 sm:mb-3 md:mb-4 px-2 sm:px-4">{t.dashboard.pricing.modal.choosePlan}</h3>
                <p className="text-slate-500 text-xs sm:text-sm md:text-base lg:text-lg font-medium italic px-2 sm:px-4">{t.dashboard.pricing.modal.subtitle}</p>
                
                {/* Billing Toggle */}
                <div className="mt-6 sm:mt-8 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-10 px-2 sm:px-4">
                  <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>{t.dashboard.pricing.modal.monthlyBilling}</span>
                  <button 
                    onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                    className="w-14 h-7 sm:w-16 sm:h-8 md:w-20 md:h-10 bg-slate-800 rounded-full relative p-0.5 sm:p-1 md:p-1.5 transition-all hover:bg-slate-700 cursor-pointer"
                  >
                    <div 
                      className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out ${
                        billingCycle === 'monthly' 
                          ? 'left-0.5 sm:left-1 md:left-1.5' 
                          : 'left-[calc(100%-1.375rem)] sm:left-[calc(100%-1.75rem)] md:left-[calc(100%-2.125rem)]'
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
                    <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>{t.dashboard.pricing.modal.yearlyBilling}</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 rounded-md sm:rounded-lg md:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">
                      {t.dashboard.pricing.modal.discount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 lg:gap-12 max-w-5xl mx-auto w-full">
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`relative group rounded-2xl sm:rounded-3xl md:rounded-[48px] border transition-all duration-500 flex flex-col ${
                      plan.popular 
                      ? 'bg-blue-600/5 border-blue-500/30 p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl sm:scale-105 z-10' 
                      : 'bg-slate-950/50 border-slate-800 p-4 sm:p-6 md:p-8 lg:p-10'
                    } hover:-translate-y-1 md:hover:-translate-y-2 hover:border-blue-500/50`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 sm:-top-4 md:-top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 sm:px-4 md:px-6 py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl md:rounded-2xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] shadow-xl flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <Trophy size={8} className="sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" /> {t.dashboard.pricing.modal.recommended}
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-4 sm:mb-6 md:mb-8">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-xl sm:rounded-2xl md:rounded-[24px] flex items-center justify-center transition-transform group-hover:scale-110 ${plan.popular ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                        <plan.icon size={20} className="sm:w-6 sm:h-6 md:w-8 md:h-8" />
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-0.5 sm:mb-1">{plan.name}</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter">
                          {formatCurrency(billingCycle === 'yearly' && plan.id === 'yearly' ? plan.price : (plan.id === 'yearly' ? 9.99 : plan.price))}
                        </p>
                        <p className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-600 font-bold uppercase mt-0.5 sm:mt-1">/ {billingCycle === 'monthly' ? t.dashboard.pricing.modal.month : t.dashboard.pricing.modal.year}</p>
                      </div>
                    </div>

                    <div className="space-y-2 sm:space-y-3 md:space-y-5 mb-4 sm:mb-6 md:mb-10 flex-grow">
                      {plan.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 sm:gap-3 md:gap-4 text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium group/feat">
                          <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${plan.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                            <Check size={8} className="sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" strokeWidth={4} />
                          </div>
                          <span className="group-hover/feat:text-slate-200 transition-colors leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loading !== null}
                      className={`w-full py-3 sm:py-4 md:py-5 lg:py-6 rounded-xl sm:rounded-2xl md:rounded-[24px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-[9px] sm:text-[10px] md:text-[11px] transition-all flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3 cursor-pointer ${
                        plan.popular 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] active:scale-95' 
                        : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 active:scale-95'
                      }`}
                    >
                      {loading === plan.priceId ? <Loader2 size={16} className="sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 animate-spin" /> : <>{t.dashboard.pricing.modal.activatePro} <ArrowRight size={14} className="sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" /></>}
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-4 sm:mt-6 md:mt-10 text-center text-[8px] sm:text-[9px] md:text-[10px] text-slate-600 font-medium italic px-2 sm:px-4">
                {t.dashboard.pricing.modal.cancelInfo}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


