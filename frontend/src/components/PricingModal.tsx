'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Star, Zap, Crown, ShieldCheck, 
  ArrowRight, Sparkles, Trophy, CreditCard, X,
  Rocket, Gift, Lock
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8">
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
            className="relative w-full max-w-[1600px] h-[92vh] bg-[#0f172a] border border-white/10 rounded-[64px] overflow-hidden shadow-[0_0_150px_-20px_rgba(59,130,246,0.3)] flex flex-col lg:flex-row z-10"
          >
            {/* Left Side - Visual Marketing */}
            <div className="lg:w-[35%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-12 md:p-24 flex flex-col justify-between relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 blur-[130px] rounded-full -mr-64 -mt-64" />
              
              <div className="relative z-10 text-white">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-24 h-24 bg-white/20 backdrop-blur-2xl rounded-[36px] flex items-center justify-center mb-16 shadow-2xl border border-white/20"
                >
                  <Rocket size={48} className="text-white" />
                </motion.div>
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-10 leading-[0.8]">
                  A tua <br />
                  <span className="text-blue-200 italic">Nova Era</span> <br />
                  Financeira.
                </h2>
                <p className="text-blue-100 font-medium italic text-2xl leading-relaxed mb-16 max-w-lg">
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
            <div className="flex-1 p-12 md:p-20 lg:p-32 flex flex-col overflow-y-auto no-scrollbar relative bg-[#020617]">
              <button 
                onClick={onClose}
                className="absolute top-12 right-12 p-4 hover:bg-white/5 rounded-full text-slate-500 transition-colors cursor-pointer z-20"
              >
                <X size={32} />
              </button>

              <div className="text-center mb-20">
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-10">
                  <Gift size={18} />
                  Oferta de Boas-Vindas
                </div>
                <h3 className="text-5xl font-black text-white tracking-tighter uppercase mb-4">Escolhe o teu plano</h3>
                <p className="text-slate-500 text-lg font-medium italic">A tua liberdade financeira começa com um clique.</p>
                
                {/* Billing Toggle */}
                <div className="mt-12 flex items-center justify-center gap-10">
                  <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Faturação Mensal</span>
                  <button 
                    onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                    className="w-20 h-10 bg-slate-800 rounded-full relative p-1.5 transition-all hover:bg-slate-700"
                  >
                    <motion.div 
                      animate={{ x: billingCycle === 'monthly' ? 0 : 40 }}
                      className="w-7 h-7 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                    />
                  </button>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>Faturação Anual</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                      -25% OFF
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto w-full">
                {plans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`relative group rounded-[48px] border transition-all duration-500 flex flex-col ${
                      plan.popular 
                      ? 'bg-blue-600/5 border-blue-500/30 p-10 shadow-2xl scale-105 z-10' 
                      : 'bg-slate-950/50 border-slate-800 p-10'
                    } hover:-translate-y-2 hover:border-blue-500/50`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-2">
                        <Trophy size={12} /> Recomendado
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-8">
                      <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-transform group-hover:scale-110 ${plan.popular ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                        <plan.icon size={32} />
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">{plan.name}</p>
                        <p className="text-5xl font-black text-white tracking-tighter">
                          {formatCurrency(billingCycle === 'yearly' && plan.id === 'yearly' ? plan.price : (plan.id === 'yearly' ? 9.99 : plan.price))}
                        </p>
                        <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">/ {billingCycle === 'monthly' ? 'Mês' : 'Ano'}</p>
                      </div>
                    </div>

                    <div className="space-y-5 mb-10 flex-grow">
                      {plan.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-4 text-sm text-slate-400 font-medium group/feat">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                            <Check size={12} strokeWidth={4} />
                          </div>
                          <span className="group-hover/feat:text-slate-200 transition-colors">{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loading !== null}
                      className={`w-full py-6 rounded-[24px] font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3 cursor-pointer ${
                        plan.popular 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] active:scale-95' 
                        : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 active:scale-95'
                      }`}
                    >
                      {loading === plan.priceId ? <Loader2 size={20} className="animate-spin" /> : <>Ativar Plano Pro <ArrowRight size={18} /></>}
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-10 text-center text-[10px] text-slate-600 font-medium italic">
                Podes cancelar a tua subscrição a qualquer momento no portal de faturação.
              </p>
            </div>
          </motion.div>
        </div>
      )}
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

