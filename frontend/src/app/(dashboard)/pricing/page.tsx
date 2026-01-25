'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Check, Zap, Crown, ShieldCheck, 
  ArrowRight, Sparkles, Trophy, CreditCard, Lock
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';

export default function PricingPage() {
  const { t, formatCurrency } = useTranslation();
  const { isPro, refreshUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Verificar se voltou do Stripe com session_id
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (sessionId) {
      setIsProcessingPayment(true);
      
      const verifyAndActivate = async (retryCount = 0) => {
        try {
          const verifyRes = await api.get(`/stripe/verify-session/${sessionId}`);
          
          if (verifyRes.data.success && verifyRes.data.is_active) {
            // Atualizar contexto do usuário
            await refreshUser();
            
            // Limpar URL
            window.history.replaceState({}, '', '/pricing');
            
            // Confetti
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#fbbf24', '#ffffff']
            });
            
            setIsProcessingPayment(false);
            setToast({
              isVisible: true,
              message: 'Parabéns! Agora és Pro! 🎉',
              type: 'success'
            });
            
            // Redirecionar para dashboard após 2 segundos
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          } else if (retryCount < 5) {
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            setIsProcessingPayment(false);
            setToast({
              isVisible: true,
              message: 'O pagamento está a ser processado. A subscrição será ativada em breve.',
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
              message: 'Erro ao verificar pagamento. Por favor, recarrega a página.',
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
        message: err?.response?.data?.detail || 'Erro ao processar pagamento',
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
      priceId: 'price_1SrkUWLtWlVpaXrb8zFq6OvW',
      description: t.dashboard.pricing.monthlyPlan.description,
      features: t.dashboard.pricing.monthlyPlan.features,
      icon: Zap,
    },
    {
      id: 'yearly',
      name: t.dashboard.pricing.yearlyPlan.name,
      price: 89.90,
      priceId: 'price_1SrkUrLtWlVpaXrb8zFq6OvW',
      description: t.dashboard.pricing.yearlyPlan.description,
      features: t.dashboard.pricing.yearlyPlan.features,
      icon: Crown,
      popular: true,
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 min-h-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xl border border-white/5 rounded-[32px] sm:rounded-[40px] p-4 sm:p-6 lg:p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -z-10" />
        
        <div className="relative z-10 text-center space-y-4 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg"
          >
            <Sparkles size={14} className="animate-pulse" />
            Escolhe o teu plano
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tighter leading-tight"
          >
            Investe na tua <span className="text-blue-400 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Liberdade Financeira</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-xs font-medium max-w-xl mx-auto leading-relaxed"
          >
            A tua liberdade financeira começa com um clique. Desbloqueia ferramentas de elite que os bancos não querem que uses.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6"
          >
            <span className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors duration-300 ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>
              Mensal
            </span>
            <button 
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="w-16 sm:w-20 h-8 sm:h-10 bg-slate-800/80 rounded-full relative p-1 transition-all hover:bg-slate-700/80 border border-slate-700/50 cursor-pointer"
            >
              <motion.div 
                animate={{ x: billingCycle === 'monthly' ? 0 : 32 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]"
              />
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors duration-300 ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
                Anual
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 sm:px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg">
                -25% OFF
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.01 }}
            className={`relative bg-slate-900/40 backdrop-blur-xl border rounded-[24px] sm:rounded-[32px] p-4 sm:p-5 lg:p-6 shadow-xl overflow-visible group transition-all duration-500 flex flex-col ${
              plan.popular 
                ? 'border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.1)]' 
                : 'border-white/5 hover:border-white/10'
            }`}
          >
            <div className={`absolute top-0 right-0 w-64 h-64 ${
              plan.popular ? 'bg-blue-600/10' : 'bg-slate-800/20'
            } blur-[100px] rounded-full transition-opacity duration-500 group-hover:opacity-80`} />
            <div className={`absolute bottom-0 left-0 w-48 h-48 ${
              plan.popular ? 'bg-indigo-600/5' : 'bg-transparent'
            } blur-[80px] rounded-full`} />
            
            {plan.popular && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center gap-1.5 sm:gap-2 z-30 whitespace-nowrap"
              >
                <Trophy size={10} className="sm:w-3 sm:h-3 animate-pulse shrink-0" />
                <span>Recomendado</span>
              </motion.div>
            )}
            
            <div className="relative z-10 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${
                    plan.popular 
                      ? 'from-blue-500/30 to-indigo-500/30' 
                      : 'from-slate-800/50 to-slate-900/50'
                  } rounded-xl sm:rounded-2xl flex items-center justify-center border ${
                    plan.popular ? 'border-blue-500/40' : 'border-slate-700/50'
                  } shadow-lg transition-all duration-300 shrink-0`}
                >
                  <plan.icon size={20} className="sm:w-6 sm:h-6" style={{ color: plan.popular ? '#60a5fa' : '#94a3b8' }} />
                </motion.div>
                <div className="text-right min-w-0 flex-shrink ml-2">
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5 truncate">{plan.name}</p>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-none">
                    {billingCycle === 'yearly' && plan.id === 'yearly' 
                      ? formatCurrency(plan.price) 
                      : formatCurrency(plan.id === 'yearly' ? 9.99 : plan.price)}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                    / {billingCycle === 'monthly' ? 'Mês' : 'Ano'}
                  </p>
                </div>
              </div>

              {billingCycle === 'yearly' && plan.id === 'yearly' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 sm:p-2 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 shrink-0"
                >
                  <ShieldCheck size={11} className="sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                  <p className="text-emerald-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                    Equivale a {formatCurrency(plan.price / 12)}/mês
                  </p>
                </motion.div>
              )}

              {/* Features */}
              <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                {plan.features.map((feature: string, fIndex: number) => (
                  <motion.div
                    key={fIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + fIndex * 0.05 }}
                    className="flex items-start gap-2 group/feature"
                  >
                    <div className={`mt-0.5 p-0.5 rounded-full shrink-0 transition-all duration-300 ${
                      plan.popular 
                        ? 'bg-blue-500/20 text-blue-400 group-hover/feature:bg-blue-500/30' 
                        : 'bg-slate-800 text-slate-500 group-hover/feature:bg-slate-700'
                    }`}>
                      <Check size={8} className="sm:w-3 sm:h-3" strokeWidth={4} />
                    </div>
                    <span className="text-slate-300 text-[10px] sm:text-xs font-medium group-hover/feature:text-white transition-colors duration-300 leading-snug">
                      {feature}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading !== null || isPro}
                onClick={() => handleSubscribe(plan.priceId)}
                className={`w-full py-2.5 sm:py-3.5 rounded-[16px] sm:rounded-[18px] font-black uppercase tracking-[0.2em] text-[9px] sm:text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden shrink-0 ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:from-blue-500 hover:to-indigo-500' 
                    : 'bg-white/5 text-slate-300 border border-slate-800 hover:bg-white/10 hover:border-slate-700'
                } ${isPro ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                )}
                {loading === plan.priceId ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPro ? (
                  <>
                    <Check size={16} />
                    Já és Pro
                  </>
                ) : (
                  <>
                    Ativar Agora
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trust Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12"
      >
        {[
          { icon: ShieldCheck, title: 'Segurança Bancária', desc: 'Dados encriptados com tecnologia militar.', color: 'blue' },
          { icon: CreditCard, title: 'Cancelamento Fácil', desc: 'Cancela quando quiseres, sem perguntas.', color: 'emerald' },
          { icon: Trophy, title: 'Garantia Zen', desc: 'Satisfeito ou o teu dinheiro de volta em 7 dias.', color: 'amber' }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            whileHover={{ y: -3 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 text-center hover:border-white/10 transition-all duration-300 group"
          >
            <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${
              item.color === 'blue' ? 'from-blue-500/20 to-indigo-500/20' :
              item.color === 'emerald' ? 'from-emerald-500/20 to-green-500/20' :
              'from-amber-500/20 to-orange-500/20'
            } rounded-xl sm:rounded-2xl flex items-center justify-center ${
              item.color === 'blue' ? 'text-blue-400' :
              item.color === 'emerald' ? 'text-emerald-400' :
              'text-amber-400'
            } mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300 border ${
              item.color === 'blue' ? 'border-blue-500/30' :
              item.color === 'emerald' ? 'border-emerald-500/30' :
              'border-amber-500/30'
            }`}>
              <item.icon size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest mb-1 sm:mb-2">{item.title}</h4>
            <p className="text-slate-400 text-[10px] sm:text-xs font-medium leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>

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
