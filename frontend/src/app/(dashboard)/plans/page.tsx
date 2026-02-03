'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { Zap, Trophy, Crown, Check, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { useState, useEffect } from 'react';
import { PLAN_SLUG_BY_PRICE_ID, STRIPE_PRICE_IDS } from '@/lib/stripePrices';

export default function PlansPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const [currentPlanPriceId, setCurrentPlanPriceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [changePlanModal, setChangePlanModal] = useState<{ isOpen: boolean; priceId: string | null }>({ isOpen: false, priceId: null });
  const [changePlanLoading, setChangePlanLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const priceIdMap = PLAN_SLUG_BY_PRICE_ID;

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
      priceId: STRIPE_PRICE_IDS.basic,
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
      priceId: STRIPE_PRICE_IDS.plus,
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
      priceId: STRIPE_PRICE_IDS.pro,
      icon: Crown,
      popular: false,
    }
  ];

  const isCurrentPlan = (planPriceId: string): boolean => {
    return !!(currentPlanPriceId === planPriceId &&
      user?.subscription_status &&
      ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status));
  };

  const hasActiveSubscription = !!(
    user?.subscription_status &&
    ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status)
  );

  const handlePlanSelect = async (planPriceId: string) => {
    if (isCurrentPlan(planPriceId)) return;

    if (!user) {
      const planId = priceIdMap[planPriceId];
      if (planId) router.push(`/auth/login?redirect=${encodeURIComponent(`/pricing?plan=${planId}`)}`);
      return;
    }

    if (hasActiveSubscription) {
      setChangePlanModal({ isOpen: true, priceId: planPriceId });
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await api.post('/stripe/create-checkout-session', null, {
        params: { price_id: planPriceId }
      });
      window.location.href = res.data.url;
    } catch (err: any) {
      setCheckoutLoading(false);
      console.error('Erro Stripe:', err);
      const msg = err?.response?.data?.detail;
      const detail = typeof msg === 'string' ? msg : (Array.isArray(msg) ? msg.map((x: any) => x?.msg ?? JSON.stringify(x)).join(', ') : 'Erro. Tenta novamente ou abre o portal de faturação nas Definições.');
      setToast({ isVisible: true, message: detail, type: 'error' });
    }
  };

  const handleConfirmChangePlan = async () => {
    const priceId = changePlanModal.priceId;
    if (!priceId) return;
    setChangePlanLoading(true);
    try {
      const res = await api.post('/stripe/change-plan', null, { params: { price_id: priceId } });
      setChangePlanModal({ isOpen: false, priceId: null });
      setCurrentPlanPriceId(priceId);
      localStorage.setItem('current_plan_price_id', priceId);
      localStorage.setItem('current_plan_updated_at', Date.now().toString());
      await refreshUser();
      setToast({ isVisible: true, message: res.data?.message || 'Plano alterado.', type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      const detail = typeof msg === 'string' ? msg : (Array.isArray(msg) ? msg.map((x: any) => x?.msg ?? JSON.stringify(x)).join(', ') : 'Erro ao alterar plano.');
      setToast({ isVisible: true, message: detail, type: 'error' });
    } finally {
      setChangePlanLoading(false);
    }
  };

  return (
    <div className="space-y-8 3xl:space-y-16 3xl:md:space-y-20 pb-20 3xl:pb-20 px-3 sm:px-4 md:px-8 3xl:pt-10 pt-4 sm:pt-6 max-w-7xl mx-auto">
      {/* Modal de loading ao abrir Stripe Checkout */}
      <AnimatePresence>
        {checkoutLoading && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-[24px] p-8 shadow-2xl text-center"
            >
              <div className="w-14 h-14 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white font-black uppercase tracking-widest text-sm mb-1">A abrir Stripe</p>
              <p className="text-slate-500 text-xs font-medium">Aguarda um momento...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header — compacto abaixo de 1600px; tamanho grande a partir de 1600px */}
      <section className="text-center mb-6 3xl:mb-12 3xl:md:mb-20 3xl:lg:mb-28">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl 3xl:text-5xl 3xl:lg:text-6xl font-black tracking-tighter mb-3 3xl:mb-6 uppercase leading-tight"
        >
          Quanto vale ter{' '}
          <span className="text-blue-500 italic block 3xl:md:inline">controlo total do teu dinheiro</span>?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-sm sm:text-base 3xl:text-base 3xl:md:text-lg 3xl:lg:text-2xl text-slate-400 mb-3 3xl:mb-6 3xl:md:mb-8 max-w-2xl mx-auto"
        >
          A maioria das pessoas não sabe para onde o dinheiro vai.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm sm:text-base 3xl:text-base 3xl:md:text-lg 3xl:lg:text-2xl text-white font-semibold mb-5 3xl:mb-8 3xl:md:mb-10 max-w-2xl mx-auto"
        >
          Quem usa a FinLy sabe. E alguns ainda ganham com isso.
        </motion.p>
      </section>

      {/* Plans Grid — compacto abaixo de 1600px; cards grandes a partir de 1600px */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 3xl:gap-6 3xl:lg:gap-8 items-stretch">
          {plans.map((plan: any, index: number) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-xl 3xl:rounded-3xl p-5 sm:p-6 3xl:p-6 3xl:md:p-8 3xl:lg:p-9 overflow-visible group transition-all duration-300 flex flex-col ${
                plan.popular 
                  ? 'bg-slate-800/95 border-2 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.15)] hover:border-blue-500/70' 
                  : 'bg-slate-800/80 border border-slate-600/50 hover:border-slate-500/60 hover:bg-slate-800/90'
              } backdrop-blur-sm`}
            >
              {isCurrentPlan(plan.priceId) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-2.5 3xl:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white px-4 py-2 3xl:px-6 3xl:py-2.5 rounded-xl 3xl:rounded-2xl text-sm 3xl:text-sm font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em] shadow-lg flex items-center gap-1.5 3xl:gap-2 z-30 whitespace-nowrap"
                >
                  <CheckCircle2 size={14} className="animate-pulse 3xl:w-4 3xl:h-4" />
                  <span>Plano ativo</span>
                </motion.div>
              )}
              {plan.popular && plan.popularLabel && !isCurrentPlan(plan.priceId) && (
                <div className="absolute -top-2.5 3xl:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-4 py-2 3xl:px-6 3xl:py-2.5 rounded-xl 3xl:rounded-2xl text-sm 3xl:text-sm font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em] shadow-lg flex items-center gap-1.5 3xl:gap-2 z-30 whitespace-nowrap">
                  <Trophy size={14} className="animate-pulse 3xl:w-4 3xl:h-4" />
                  <span>{plan.popularLabel}</span>
                </div>
              )}

              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4 3xl:mb-5">
                    <div className={`w-14 h-14 3xl:w-16 3xl:h-16 rounded-xl 3xl:rounded-2xl flex items-center justify-center shrink-0 ${
                      plan.popular 
                        ? 'bg-blue-500/20 border-2 border-blue-500/40' 
                        : 'bg-slate-700/80 border border-slate-600/50'
                    }`}>
                      <plan.icon className="w-7 h-7 3xl:w-8 3xl:h-8" style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-xs 3xl:text-sm font-black uppercase tracking-widest text-slate-400 mb-1 3xl:mb-1 truncate">{plan.name}</p>
                      <p className="text-2xl sm:text-3xl 3xl:text-4xl 3xl:md:text-5xl font-black text-white tracking-tighter leading-none">
                        {plan.price}
                      </p>
                      <p className="text-xs 3xl:text-sm text-slate-400 font-semibold mt-0.5">{plan.priceSuffix}</p>
                      {plan.priceSecondary && (
                        <p className="text-sm 3xl:text-base text-emerald-400 font-semibold mt-1 3xl:mt-1.5">{plan.priceSecondary}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm 3xl:text-base 3xl:md:text-lg text-slate-400 mb-2 3xl:mb-2 font-medium line-clamp-2 3xl:line-clamp-none">{plan.tagline}</p>
                  <p className="text-sm 3xl:text-base text-slate-500 mb-5 3xl:mb-6 italic line-clamp-2 3xl:line-clamp-none">&quot;{plan.quote}&quot;</p>

                  <div className="space-y-2.5 3xl:space-y-3 mb-5 3xl:mb-6">
                    {plan.features.map((feature: string, fIndex: number) => (
                      <div key={fIndex} className="flex items-start gap-2.5 3xl:gap-3">
                        <Check size={18} className="text-emerald-400 mt-0.5 shrink-0 3xl:w-[22px] 3xl:h-[22px]" />
                        <p className="text-sm 3xl:text-base 3xl:md:text-lg text-slate-200 font-medium">{feature}</p>
                      </div>
                    ))}
                  </div>

                  {plan.limitation && (
                    <p className="text-sm 3xl:text-base text-amber-400/90 mb-5 3xl:mb-6 font-medium">🚫 {plan.limitation}</p>
                  )}
                </div>

                <button
                  onClick={() => handlePlanSelect(plan.priceId)}
                  disabled={isCurrentPlan(plan.priceId)}
                  className={`mt-auto w-full block text-center px-4 3xl:px-6 py-3.5 3xl:py-4 rounded-xl 3xl:rounded-2xl text-sm 3xl:text-base font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em] transition-all cursor-pointer ${
                    isCurrentPlan(plan.priceId)
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                  }`}
                >
                  {isCurrentPlan(plan.priceId) ? t.dashboard.pricing.activePlan : plan.buttonText}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Linha separadora */}
      <div className="max-w-3xl mx-auto" aria-hidden="true">
        <hr className="border-t border-white/10" />
      </div>

      {/* Programa de Afiliados — compacto abaixo de 1600px; grande a partir de 1600px */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto text-center mt-10 3xl:mt-16 mb-10 3xl:mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2.5 3xl:px-6 3xl:py-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm 3xl:text-base font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em] mb-5 3xl:mb-8">
          Programa de Afiliados FinLy
        </div>
        <h3 className="text-2xl sm:text-3xl 3xl:text-4xl 3xl:md:text-5xl font-black text-white tracking-tight mb-4 3xl:mb-6 leading-tight">
          Usa. Indica. Ganha.
        </h3>
        <p className="text-slate-400 text-sm 3xl:text-lg 3xl:md:text-xl mb-5 3xl:mb-10">
          Sempre que alguém entra na FinLy pelo teu link:
        </p>
        <ul className="flex flex-col items-center text-slate-200 text-sm 3xl:text-lg 3xl:md:text-xl space-y-3 3xl:space-y-4 mb-8 3xl:mb-12 font-medium">
          <li className="flex items-center justify-center gap-2 3xl:gap-3">🔁 Recebes comissão todos os meses</li>
          <li className="flex items-center justify-center gap-2 3xl:gap-3">💰 20% (Plus) ou 25% (Pro)</li>
          <li className="flex items-center justify-center gap-2 3xl:gap-3">📊 Tudo transparente no dashboard</li>
          <li className="flex items-center justify-center gap-2 3xl:gap-3">⏳ Ganhas enquanto a pessoa continuar ativa</li>
        </ul>
        <div className="bg-slate-800/90 border border-slate-600/60 rounded-2xl 3xl:rounded-3xl p-5 3xl:p-6 3xl:md:p-8 shadow-xl">
          <p className="text-xs 3xl:text-sm font-black uppercase tracking-widest text-slate-400 mb-3 3xl:mb-4">Exemplo simples:</p>
          <p className="text-sm 3xl:text-lg 3xl:md:text-xl text-slate-200 font-medium mb-1.5 3xl:mb-1">10 pessoas no plano mensal → ~20€ por mês</p>
          <p className="text-sm 3xl:text-lg 3xl:md:text-xl text-slate-200 font-medium mb-4 3xl:mb-5">50 pessoas → ~100€ por mês</p>
          <p className="text-sm 3xl:text-base text-slate-500">Sem anúncios. Sem suporte. Sem esforço extra.</p>
        </div>
      </motion.section>

      {/* Sem risco — compacto abaixo de 1600px */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-10 3xl:pt-16 border-t border-white/5"
      >
        <div className="text-center mb-5 3xl:mb-8">
          <span className="inline-flex items-center gap-2 text-slate-500 text-sm 3xl:text-sm font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em]">
            Sem risco, sem letras pequenas
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 3xl:gap-12">
          <div className="flex items-center gap-2 3xl:gap-3 text-slate-400 text-sm 3xl:text-base">
            <Check size={16} className="text-emerald-400 shrink-0 3xl:w-5 3xl:h-5" />
            Pagamento seguro
          </div>
          <div className="flex items-center gap-2 3xl:gap-3 text-slate-400 text-sm 3xl:text-base">
            <Check size={16} className="text-emerald-400 shrink-0 3xl:w-5 3xl:h-5" />
            Cancela quando quiseres
          </div>
          <div className="flex items-center gap-2 3xl:gap-3 text-slate-400 text-sm 3xl:text-base">
            <Check size={16} className="text-emerald-400 shrink-0 3xl:w-5 3xl:h-5" />
            Sem fidelização forçada
          </div>
        </div>
      </motion.section>

      <ConfirmModal
        isOpen={changePlanModal.isOpen}
        onClose={() => setChangePlanModal({ isOpen: false, priceId: null })}
        onConfirm={handleConfirmChangePlan}
        title="Deseja alterar plano?"
        message="A tua subscrição passará para o novo plano. Se fores para um plano mais caro, serás cobrado na tua forma de pagamento guardada pela diferença do período em falta. Se fores para um mais barato, o ajuste aparece a teu favor na próxima fatura."
        confirmText="Sim, alterar"
        cancelText="Cancelar"
        variant="info"
        isLoading={changePlanLoading}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}

