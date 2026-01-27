'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { Zap, Trophy, Crown, Check, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import { useState, useEffect } from 'react';

export default function PlansPage() {
  const { t, formatCurrency } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const [currentPlanPriceId, setCurrentPlanPriceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Mapeamento de price_ids para planos
  const priceIdMap: { [key: string]: string } = {
    'price_1SrkUWLtWlVpaXrb8zFq6OvW': 'monthly',
    'price_1Stb4lLtWlVpaXrbdoI7hHDx': '3months',
    'price_1SrkUrLtWlVpaXrb8zFq6OvW': 'yearly'
  };

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Se não tem subscrição ativa, não precisa buscar
      if (!user.subscription_status || !['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status)) {
        setLoading(false);
        return;
      }

      // Tentar usar cache local para evitar atraso visual
      const cachedPriceId = localStorage.getItem('current_plan_price_id');
      const cachedAt = localStorage.getItem('current_plan_updated_at');
      if (cachedPriceId && cachedAt) {
        const ageMs = Date.now() - Number(cachedAt);
        if (!Number.isNaN(ageMs) && ageMs < 60 * 60 * 1000) { // 1 hora
          setCurrentPlanPriceId(cachedPriceId);
          setLoading(false);
        }
      }

      try {
        // Buscar detalhes da subscrição diretamente
        const subRes = await api.get('/stripe/subscription-details');
        const subscriptionData = subRes.data;
        
        if (subscriptionData.has_subscription && subscriptionData.price_id) {
          setCurrentPlanPriceId(subscriptionData.price_id);
          localStorage.setItem('current_plan_price_id', subscriptionData.price_id);
          localStorage.setItem('current_plan_updated_at', Date.now().toString());
        }
      } catch (err) {
        console.error('Erro ao buscar plano atual:', err);
        // Fallback: tentar buscar através das invoices
        try {
          const invRes = await api.get('/stripe/invoices');
          const invoices = invRes.data;
          
          if (invoices && invoices.length > 0) {
            const latestInvoice = invoices[0];
            if (latestInvoice.lines?.data?.[0]?.price?.id) {
              const priceId = latestInvoice.lines.data[0].price.id;
              setCurrentPlanPriceId(priceId);
              localStorage.setItem('current_plan_price_id', priceId);
              localStorage.setItem('current_plan_updated_at', Date.now().toString());
            }
          }
        } catch (invoiceErr) {
          console.error('Erro ao buscar através de invoices:', invoiceErr);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentPlan();
  }, [user]);

  const plans = [
    {
      id: 'monthly',
      name: 'Plano Básico',
      price: 9.99,
      priceId: 'price_1SrkUWLtWlVpaXrb8zFq6OvW',
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
      priceId: 'price_1Stb4lLtWlVpaXrbdoI7hHDx',
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
      priceId: 'price_1SrkUrLtWlVpaXrb8zFq6OvW',
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
  ];

  const isCurrentPlan = (planPriceId: string) => {
    return currentPlanPriceId === planPriceId && 
           user?.subscription_status && 
           ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status);
  };

  const handlePlanSelect = async (planPriceId: string) => {
    // Se já tem este plano, não fazer nada
    if (isCurrentPlan(planPriceId)) {
      return;
    }

    if (user) {
      try {
        const res = await api.post('/stripe/create-checkout-session', null, {
          params: { price_id: planPriceId }
        });
        window.location.href = res.data.url;
      } catch (err: any) {
        console.error('Erro ao criar sessão Stripe:', err);
        const planId = priceIdMap[planPriceId];
        if (planId) {
          router.push(`/pricing?plan=${planId}`);
        }
      }
    } else {
      const planId = priceIdMap[planPriceId];
      if (planId) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${planId}`)}`);
      }
    }
  };

  return (
    <div className="space-y-20 pb-20 px-4 md:px-8 pt-10">
      {/* Header Section */}
      <section className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest"
        >
          <Trophy size={14} /> Planos e Preços
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-8xl font-black tracking-tighter text-white leading-tight uppercase"
        >
          Investe na tua <span className="text-blue-500 italic">Liberdade Financeira</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto"
        >
          Escolhe o plano que melhor se adapta às tuas necessidades e começa a transformar a tua relação com o dinheiro.
        </motion.p>
      </section>

      {/* Plans Grid - Larger Cards */}
      <section className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`relative bg-slate-900/40 backdrop-blur-xl border rounded-[32px] p-10 lg:p-12 shadow-2xl overflow-visible group transition-all ${
                plan.popular 
                  ? 'border-blue-500/30 shadow-[0_0_60px_rgba(59,130,246,0.2)] lg:scale-105' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              {plan.popular && !isCurrentPlan(plan.priceId) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-2 z-30 whitespace-nowrap"
                >
                  <Trophy size={14} className="animate-pulse" />
                  <span>Recomendado</span>
                </motion.div>
              )}
              
              {isCurrentPlan(plan.priceId) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-2 z-30 whitespace-nowrap"
                >
                  <CheckCircle2 size={14} className="animate-pulse" />
                  <span>Já tem este pack</span>
                </motion.div>
              )}
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-20 h-20 bg-gradient-to-br rounded-3xl flex items-center justify-center border ${
                    plan.popular 
                      ? 'from-blue-500/30 to-indigo-500/30 border-blue-500/40' 
                      : 'from-slate-800/50 to-slate-900/50 border-slate-700/50'
                  }`}>
                    <plan.icon size={36} style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500 mb-2">{plan.name}</p>
                    <p className="text-5xl lg:text-6xl font-black text-white tracking-tighter">
                      {plan.price.toFixed(2)}€
                    </p>
                    <p className="text-sm text-slate-500 font-black uppercase tracking-widest mt-2">
                      / {plan.id === 'yearly' ? 'Ano' : plan.id === '3months' ? '3 Meses' : 'Mês'}
                    </p>
                  </div>
                </div>

                <p className="text-lg text-slate-400 mb-6 italic">{plan.description}</p>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature: string, fIndex: number) => (
                    <div key={fIndex} className="flex items-start gap-3">
                      <Check size={20} className="text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-base text-slate-300 font-medium">{feature}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlanSelect(plan.priceId)}
                  disabled={isCurrentPlan(plan.priceId)}
                  className={`w-full block text-center px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.3em] transition-all ${
                    isCurrentPlan(plan.priceId)
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 cursor-pointer'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer'
                  }`}
                >
                  {isCurrentPlan(plan.priceId) ? 'Plano Ativo' : 'Escolher Plano'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

