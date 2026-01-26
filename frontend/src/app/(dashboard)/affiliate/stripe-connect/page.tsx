'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import { 
  CreditCard, CheckCircle2, XCircle, Loader2, 
  ExternalLink, AlertCircle, ArrowRight, ShieldCheck
} from 'lucide-react';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';

interface StripeConnectStatus {
  connected: boolean;
  account_id?: string;
  status?: string;
  onboarding_completed?: boolean;
  payout_enabled?: boolean;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  error?: string;
}

export default function StripeConnectPage() {
  const { user } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    if (user && !user.is_affiliate) {
      router.push('/affiliate');
      return;
    }
    // Verificar apenas uma vez
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/affiliate/stripe-connect/status');
      setStatus(res.data);
      
      // Se o onboarding foi completado e está ativo, redirecionar para a página de afiliado
      if (res.data.onboarding_completed && res.data.payout_enabled && res.data.status === 'active') {
        // Redirecionar imediatamente
        router.push('/affiliate');
      }
    } catch (err: any) {
      console.error('Erro ao buscar status:', err);
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || 'Erro ao carregar status',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOnboard = async () => {
    setOnboarding(true);
    try {
      const res = await api.get('/affiliate/stripe-connect/onboard');
      if (res.data.onboard_url) {
        window.location.href = res.data.onboard_url;
      }
    } catch (err: any) {
      console.error('Erro ao iniciar onboarding:', err);
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || 'Erro ao iniciar onboarding',
        type: 'error'
      });
      setOnboarding(false);
    }
  };

  const handleDashboard = async () => {
    try {
      const res = await api.get('/affiliate/stripe-connect/dashboard');
      if (res.data.dashboard_url) {
        window.open(res.data.dashboard_url, '_blank');
      }
    } catch (err: any) {
      console.error('Erro ao aceder ao dashboard:', err);
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || 'Erro ao aceder ao dashboard',
        type: 'error'
      });
    }
  };

  if (loading) {
    return <PageLoading variant="minimal" size="sm" />;
  }

  const isActive = status?.status === 'active' && status?.payout_enabled;
  const isPending = status?.status === 'pending' || (status?.connected && !status?.onboarding_completed);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
            <CreditCard className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">
            Stripe Connect
          </h1>
          <p className="text-slate-400 text-sm font-medium max-w-xl mx-auto">
            Conecta a tua conta Stripe para receberes comissões automaticamente quando alguém subscreve Pro através do teu link.
          </p>
        </div>

        {/* Status Card */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-slate-900/40 backdrop-blur-xl border rounded-2xl p-8 shadow-xl ${
              isActive ? 'border-green-500/30' : isPending ? 'border-amber-500/30' : 'border-white/5'
            }`}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-xl font-black text-white mb-2">Estado da Conta</h2>
                <div className="flex items-center gap-3 mb-4">
                  {isActive ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                      <span className="text-green-400 font-black uppercase tracking-wider text-sm">Conta Ativa</span>
                    </>
                  ) : isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                      <span className="text-amber-400 font-black uppercase tracking-wider text-sm">Onboarding Pendente</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-slate-500" />
                      <span className="text-slate-500 font-black uppercase tracking-wider text-sm">Não Conectado</span>
                    </>
                  )}
                </div>
                {status.account_id && (
                  <p className="text-xs text-slate-400 font-mono mb-2">
                    Account ID: {status.account_id}
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <span className="text-sm text-slate-400">Onboarding Completo</span>
                <span className={`text-sm font-black ${status.onboarding_completed ? 'text-green-400' : 'text-slate-500'}`}>
                  {status.onboarding_completed ? 'Sim' : 'Não'}
                </span>
              </div>
              {status.charges_enabled !== undefined && (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-sm text-slate-400">Pagamentos Ativados</span>
                  <span className={`text-sm font-black ${status.charges_enabled ? 'text-green-400' : 'text-slate-500'}`}>
                    {status.charges_enabled ? 'Sim' : 'Não'}
                  </span>
                </div>
              )}
              {status.payouts_enabled !== undefined && (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-sm text-slate-400">Payouts Ativados</span>
                  <span className={`text-sm font-black ${status.payouts_enabled ? 'text-green-400' : 'text-slate-500'}`}>
                    {status.payouts_enabled ? 'Sim' : 'Não'}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              {!status.connected ? (
                <button
                  onClick={handleOnboard}
                  disabled={onboarding}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {onboarding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      A redirecionar...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Conectar Conta Stripe
                    </>
                  )}
                </button>
              ) : isPending ? (
                <button
                  onClick={handleOnboard}
                  disabled={onboarding}
                  className="flex-1 px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {onboarding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      A redirecionar...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      Completar Onboarding
                    </>
                  )}
                </button>
              ) : isActive ? (
                <button
                  onClick={handleDashboard}
                  className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir Dashboard Stripe
                </button>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6"
          >
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Seguro e Confiável</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              O Stripe gerencia toda a segurança e compliance. Os teus dados bancários são protegidos pelo Stripe.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6"
          >
            <div className="w-12 h-12 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Pagamentos Automáticos</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              Quando alguém subscreve Pro através do teu link, a comissão é transferida automaticamente para a tua conta Stripe.
            </p>
          </motion.div>
        </div>

        <Toast {...toast} onClose={() => setToast({ ...toast, isVisible: false })} />
      </motion.div>
    </div>
  );
}

