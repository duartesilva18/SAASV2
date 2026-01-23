'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { 
  Check, Star, Zap, Crown, ShieldCheck, 
  ArrowRight, Sparkles, Trophy, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import Toast from '@/components/Toast';

export default function PricingPage() {
  const { t, formatCurrency } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-12 px-4 md:px-0"
    >
      {/* Header Section */}
      <div className="text-center mb-16 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] -z-10" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6"
        >
          <Sparkles size={14} />
          Investimento na tua Liberdade
        </motion.div>
        
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-none">
          Escolhe o teu <span className="text-blue-500">Ritmo de Sucesso</span>
        </h1>
        <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto italic">
          "O preço é o que pagas, o valor é o que recebes." Começa hoje a tua jornada para a paz financeira plena.
        </p>

        {/* Billing Toggle */}
        <div className="mt-12 flex items-center justify-center gap-6">
          <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Mensal</span>
          <button 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-16 h-8 bg-slate-800 rounded-full relative p-1 transition-all hover:bg-slate-700"
          >
            <motion.div 
              animate={{ x: billingCycle === 'monthly' ? 0 : 32 }}
              className="w-6 h-6 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            />
          </button>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>Anual</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse">
              -25% OFF
            </span>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={`relative group h-full`}
          >
            {/* Background Glow */}
            <div className={`absolute inset-0 bg-gradient-to-b ${plan.popular ? 'from-blue-600/10 to-indigo-600/10' : 'from-slate-800/20 to-transparent'} rounded-[48px] blur-2xl transition-all group-hover:blur-3xl`} />
            
            <div className={`relative h-full bg-[#0f172a]/80 backdrop-blur-xl border ${plan.popular ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.1)]' : 'border-slate-800'} rounded-[48px] p-8 md:p-12 flex flex-col transition-all duration-500 hover:-translate-y-2`}>
              
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-2">
                  <Trophy size={14} />
                  Melhor Valor
                </div>
              )}

              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">{plan.name}</h2>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-[200px]">
                    {plan.description}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${plan.popular ? 'text-blue-400' : 'text-slate-500'}`}>
                  <plan.icon size={28} />
                </div>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter">
                    {billingCycle === 'yearly' && plan.id === 'yearly' 
                      ? formatCurrency(plan.price) 
                      : formatCurrency(plan.id === 'yearly' ? 9.99 : plan.price)}
                  </span>
                  <span className="text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    / {billingCycle === 'monthly' ? 'Mês' : 'Ano'}
                  </span>
                </div>
                {billingCycle === 'yearly' && plan.id === 'yearly' && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-emerald-400 text-[11px] font-black uppercase tracking-widest mt-2 flex items-center gap-2"
                  >
                    <ShieldCheck size={14} />
                    Equivale a {formatCurrency(plan.price / 12)}/mês
                  </motion.p>
                )}
                {billingCycle === 'monthly' && plan.id === 'yearly' && (
                  <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mt-2">
                    Economiza {formatCurrency((9.99 * 12) - 89.90)} por ano no Anual
                  </p>
                )}
              </div>

              <div className="space-y-5 mb-12 flex-grow">
                {plan.features.map((feature: string, fIndex: number) => (
                  <div key={fIndex} className="flex items-start gap-4 group/item">
                    <div className={`mt-1 p-0.5 rounded-full ${plan.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Check size={14} strokeWidth={4} />
                    </div>
                    <span className="text-slate-300 text-sm font-medium group-hover/item:text-white transition-colors">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                disabled={loading !== null}
                onClick={() => handleSubscribe(plan.priceId)}
                className={`w-full py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 cursor-pointer ${
                  plan.popular 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-95' 
                    : 'bg-white/5 text-slate-300 border border-slate-800 hover:bg-white/10 active:scale-95'
                }`}
              >
                {loading === plan.priceId ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Ativar Agora
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        {[
          { icon: ShieldCheck, title: 'Segurança Bancária', desc: 'Dados encriptados com tecnologia militar.' },
          { icon: CreditCard, title: 'Cancelamento Fácil', desc: 'Cancela quando quiseres, sem perguntas.' },
          { icon: Trophy, title: 'Garantia Zen', desc: 'Satisfeito ou o teu dinheiro de volta em 7 dias.' }
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500">
              <item.icon size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">{item.title}</h4>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Toast 
        message={toastMsg} 
        onClose={() => setShowToast(false)} 
        type={toastMsg.includes('Erro') ? 'error' : 'success'} 
        isVisible={showToast}
      />
    </motion.div>
  );
}
