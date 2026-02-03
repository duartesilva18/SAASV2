'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Trophy } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import { STRIPE_PRICE_IDS } from '@/lib/stripePrices';

export default function PricingPage() {
  const { t } = useTranslation();
  const { isPro, refreshUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Verificar se há mensagem de sucesso após refresh
  useEffect(() => {
    const successActivated = sessionStorage.getItem('pro_activated_success');
    if (successActivated === 'true') {
      sessionStorage.removeItem('pro_activated_success');
      setToast({
        isVisible: true,
        message: t.dashboard.pricing.proActivated,
        type: 'success'
      });
    }
  }, []);

  // Verificar se voltou do Stripe com session_id
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (sessionId) {
      setIsProcessingPayment(true);
      
      const verifyAndActivate = async (retryCount = 0) => {
        try {
          const verifyRes = await api.get(`/stripe/verify-session/${sessionId}`);
          
          if (verifyRes.data.success && verifyRes.data.is_active) {
            // Invalidar cache do SWR para forçar refresh
            await mutate('/auth/me');
            await mutate('/stripe/invoices');
            
            // Atualizar contexto do usuário
            await refreshUser();
            
            // Guardar mensagem de sucesso no sessionStorage para mostrar após refresh
            sessionStorage.setItem('pro_activated_success', 'true');
            
            // Limpar URL e redirecionar para dashboard (que vai recarregar com dados atualizados)
            window.history.replaceState({}, '', '/dashboard');
            window.location.reload();
          } else if (retryCount < 5) {
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            setIsProcessingPayment(false);
            setToast({
              isVisible: true,
              message: t.dashboard.pricing.paymentProcessing,
              type: 'success'
            });
            window.history.replaceState({}, '', '/pricing');
          }
        } catch (err: any) {
          if (retryCount < 5 && err.response?.status !== 403) {
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            setIsProcessingPayment(false);
            setToast({
              isVisible: true,
              message: t.dashboard.pricing.paymentVerifyError,
              type: 'error'
            });
            window.history.replaceState({}, '', '/pricing');
          }
        }
      };
      
      setTimeout(() => verifyAndActivate(), 2000);
    }
  }, [searchParams, refreshUser, router]);

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId);
      const res = await api.post('/stripe/create-checkout-session', null, {
        params: { price_id: priceId }
      });
      window.location.href = res.data.url;
    } catch (err: any) {
      console.error(err);
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.pricing.paymentError,
        type: 'error'
      });
    } finally {
      setLoading(null);
    }
  };

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

  // Verificar se há parâmetro plan na URL e iniciar checkout automaticamente
  useEffect(() => {
    const planParam = searchParams?.get('plan');
    if (planParam && !loading && !isProcessingPayment && !isPro) {
      const selectedPlan = plans.find(p => p.id === planParam);
      if (selectedPlan) {
        // Pequeno delay para garantir que a página carregou completamente
        const timer = setTimeout(() => {
          handleSubscribe(selectedPlan.priceId);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isPro, loading, isProcessingPayment]);

  return (
    <div className="space-y-20 pb-20 px-4 md:px-8 pt-10 max-w-7xl mx-auto">
      {/* Header Section — igual à plans */}
      <section className="text-center mb-20 md:mb-28 lg:mb-32">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase"
        >
          Quanto vale ter{' '}
          <span className="text-blue-500 italic block md:inline">controlo total do teu dinheiro</span>?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl lg:text-2xl text-slate-400 mb-6 md:mb-8 max-w-2xl mx-auto"
        >
          A maioria das pessoas não sabe para onde o dinheiro vai.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-lg md:text-xl lg:text-2xl text-white font-semibold mb-8 md:mb-10 max-w-2xl mx-auto"
        >
          Quem usa a FinLy sabe. E alguns ainda ganham com isso.
        </motion.p>
      </section>

      {/* Plans Grid — cards iguais à plans */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan: any, index: number) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
                      <p className="text-sm text-slate-400 font-semibold mt-0.5">{plan.priceSuffix}</p>
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
                  type="button"
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={loading !== null || isPro}
                  className={`mt-auto w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-black uppercase tracking-[0.2em] transition-all cursor-pointer ${
                    isPro
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                  }`}
                >
                  {loading === plan.priceId ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isPro ? (
                    'Já és Pro'
                  ) : (
                    plan.buttonText
                  )}
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

      {/* Programa de Afiliados FinLy */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto text-center mt-16 mb-16"
      >
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-base font-black uppercase tracking-[0.2em] mb-8">
          {(t as any).pricingSection?.affiliate?.badge}
        </div>
        <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
          {(t as any).pricingSection?.affiliate?.title}
        </h3>
        <p className="text-slate-400 text-lg md:text-xl mb-10">
          {(t as any).pricingSection?.affiliate?.description}
        </p>
        <ul className="flex flex-col items-center text-slate-200 text-lg md:text-xl space-y-4 mb-12 font-medium">
          {((t as any).pricingSection?.affiliate?.benefits || []).map((benefit: string, idx: number) => (
            <li key={idx} className="flex items-center justify-center gap-3">{benefit}</li>
          ))}
        </ul>
        <div className="bg-slate-800/90 border border-slate-600/60 rounded-3xl p-6 md:p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">{(t as any).pricingSection?.affiliate?.example?.title}</p>
          <p className="text-lg md:text-xl text-slate-200 font-medium mb-1">{(t as any).pricingSection?.affiliate?.example?.line1}</p>
          <p className="text-lg md:text-xl text-slate-200 font-medium mb-5">{(t as any).pricingSection?.affiliate?.example?.line2}</p>
          <p className="text-base text-slate-500">{(t as any).pricingSection?.affiliate?.example?.footer}</p>
        </div>
      </motion.section>

      {/* Sem risco, sem letras pequenas */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-16 border-t border-white/5"
      >
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 text-slate-500 text-sm font-black uppercase tracking-[0.2em]">
            Sem risco, sem letras pequenas
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
      </motion.section>

      {isProcessingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-blue-500/20 rounded-2xl p-8 text-center max-w-md mx-4"
          >
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-black text-white mb-2">A processar pagamento...</h3>
            <p className="text-slate-400 text-sm">Aguarda enquanto verificamos a tua subscrição</p>
          </motion.div>
        </div>
      )}

      <Toast 
        message={toast.message} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
        type={toast.type} 
        isVisible={toast.isVisible}
      />
    </div>
  );
}
