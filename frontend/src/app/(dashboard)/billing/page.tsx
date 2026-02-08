'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import { 
  CreditCard, Calendar, Clock, CheckCircle2, 
  AlertCircle, ExternalLink, Download, ArrowRight,
  ShieldCheck, Wallet, Sparkles, FileText, ChevronRight,
  X, Trash2
} from 'lucide-react';
import Toast from '@/components/Toast';
import AlertModal from '@/components/AlertModal';
import PageLoading from '@/components/PageLoading';

interface Invoice {
  id: string;
  amount_paid: number;
  amount_due?: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf: string | null;
  number: string;
}

interface SubscriptionData {
  status: string;
  current_period_end?: number;
  plan_name?: string;
}

export default function BillingPage() {
  const { t, formatCurrency } = useTranslation();
  const b = t.dashboard.billing;
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, userRes] = await Promise.all([
          api.get('/stripe/invoices'),
          api.get('/auth/me')
        ]);
        
        setInvoices(invRes.data);
        const userStatus = userRes.data.subscription_status;
        const customerId = userRes.data.stripe_customer_id || '';
        
        setIsSimulated(customerId.startsWith('sim_') || customerId.startsWith('test_'));
        // Usar valores diretos das traduções para evitar dependências
        const proPlan = t.dashboard.billing.proPlan;
        const basePlan = t.dashboard.billing.basePlan;
        setSubData({
          status: userStatus,
          plan_name: ['active', 'trialing'].includes(userStatus) ? proPlan : basePlan
        });
      } catch (err) {
        console.error("Erro ao carregar dados de faturação:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vazio - só executa uma vez no mount

  const handlePortal = async () => {
    if (isSimulated) {
      setAlertModal({ isOpen: true, title: t.dashboard.settings.simulationModeTitle, message: b.simulationMode, type: 'info' });
      return;
    }
    try {
      const res = await api.post('/stripe/portal');
      window.location.href = res.data.url;
    } catch (err) {
      setAlertModal({ isOpen: true, title: t.dashboard.sidebar.toastTypes.error, message: b.portalError, type: 'error' });
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const res = await api.post('/stripe/cancel-subscription');
      setShowCancelModal(false);
      setToast({
        isVisible: true,
        message: res.data?.message ?? b.cancelSuccess,
        type: 'success'
      });
      // F5 na página para atualizar estado (user context, sidebar, etc.)
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err.response?.data?.detail || b.cancelError,
        type: 'error'
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'open': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'unpaid': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'void': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default: return 'text-red-400 bg-red-500/10 border-red-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return b.paid;
      case 'open': return b.pending;
      case 'unpaid': return b.unpaid;
      case 'void': return b.void;
      default: return status.toUpperCase();
    }
  };

  if (loading) {
    return <PageLoading message={b.loadingHistory} />;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 sm:space-y-12 pb-20 px-4 md:px-8">
      {/* Header */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={14} /> {b.secureBilling}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-white uppercase leading-tight">
              {b.title}<span className="text-blue-500 italic">{b.titleAccent}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl text-sm sm:text-base">{b.subtitle}</p>
          </div>

          <button 
            onClick={handlePortal}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0 w-full sm:w-auto"
          >
            <ExternalLink size={16} className="shrink-0" />
            <span>{b.manage}</span>
          </button>
        </div>
      </section>

      {/* Subscription Card */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col justify-between shadow-2xl"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{b.currentPlan}</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tighter truncate">{subData?.plan_name}</h3>
          </div>
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-xl text-blue-400 text-xs font-bold">
              <Sparkles size={12} /> {b.activeBenefits}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col justify-between shadow-2xl"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{b.status}</p>
            <div className={`inline-flex items-center gap-2 text-xl font-black uppercase tracking-tighter px-4 py-2 rounded-2xl ${
              subData?.status === 'active' || subData?.status === 'trialing' 
                ? 'text-emerald-400 bg-emerald-500/10' 
                : subData?.status === 'cancel_at_period_end'
                ? 'text-red-400 bg-red-500/10'
                : 'text-amber-400 bg-amber-500/10'
            }`}>
              {subData?.status === 'active' || subData?.status === 'trialing' ? (
                <CheckCircle2 size={18} />
              ) : subData?.status === 'cancel_at_period_end' ? (
                <AlertCircle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              {subData?.status === 'cancel_at_period_end' 
                ? b.states.cancel_at_period_end
                : b.states[subData?.status as keyof typeof b.states] || subData?.status}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 sm:p-6 md:p-8 rounded-2xl flex flex-col justify-between shadow-2xl"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{b.nextPayment}</p>
            <div className="flex items-center gap-3 text-white font-black text-xl tracking-tighter uppercase">
              <Calendar size={20} className="text-blue-500" />
              {isSimulated ? b.demoMode : b.viewInPortal}
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-4 uppercase tracking-wider">
            {isSimulated ? b.noRealRenewal : b.autoRenewalActive}
          </p>
        </motion.div>
      </section>

      {/* Invoices Table */}
      <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 sm:p-8 md:p-10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-6 flex items-center gap-2">
            <FileText size={14} /> {b.stripeHistory}
          </h2>

          {invoices.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
              <Clock size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-500 font-medium">{b.noInvoices}</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar -mx-4 md:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/40">
                        <th className="py-4 px-4 sm:px-6 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/60">{b.table.date}</th>
                        <th className="py-4 px-4 sm:px-6 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/60">{b.table.amount}</th>
                        <th className="py-4 px-4 sm:px-6 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/60">{b.table.status}</th>
                        <th className="py-4 px-4 sm:px-6 text-right text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/60">{b.table.invoice}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40 text-sm bg-slate-900/30">
                      {invoices.map((inv, idx) => (
                        <motion.tr 
                          key={inv.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group hover:bg-white/[0.03] transition-all"
                        >
                          <td className="py-4 px-4 sm:px-6 font-medium text-slate-300">
                            <div className="flex items-center gap-3">
                              <Calendar size={14} className="text-blue-500/50" />
                              <span className="tabular-nums">
                                {new Date(inv.created * 1000).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 sm:px-6 font-bold text-white text-base tracking-tight">
                            {formatCurrency(
                              (inv.status === 'open' || inv.status === 'unpaid') && inv.amount_due
                                ? inv.amount_due / 100
                                : inv.amount_paid / 100
                            )}
                          </td>
                          <td className="py-4 px-4 sm:px-6">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${getStatusColor(inv.status)}`}>
                              {getStatusLabel(inv.status)}
                            </span>
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-right">
                            {inv.invoice_pdf ? (
                              <a 
                                href={inv.invoice_pdf} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-950/60 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-slate-400 hover:text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-wider"
                              >
                                PDF <Download size={12} />
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-2 bg-slate-950/60 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-700/60 cursor-not-allowed">
                                PDF <Download size={12} />
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cancel Subscription Button - Outside Table */}
      {['active', 'trialing'].includes(subData?.status || '') && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-sm text-slate-400 hover:text-red-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Trash2 size={16} />
            Cancelar Subscrição
          </button>
        </div>
      )}

      {/* Info Banner */}
      <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 sm:gap-6 shadow-2xl">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
          <ShieldCheck size={24} />
        </div>
        <p className="text-slate-400 text-sm font-medium flex-1">
          {b.stripeInfo}
        </p>
      </section>

      {/* Cancel Subscription Modal — estilo login */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCanceling && setShowCancelModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-6 md:p-8">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <h2 className="text-lg font-black text-white tracking-tight">
                      {b.cancelSubscription}
                    </h2>
                  </div>
                  {!isCanceling && (
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {b.cancelConfirm}
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs text-amber-400 font-medium">
                      {(b as Record<string, unknown>).cancelInfo7Days as string || 'Se subscreveste há menos de 7 dias, a subscrição termina agora. Caso contrário, termina no fim do período e não serás cobrado no próximo mês.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={isCanceling}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 text-white font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {b.keepSubscription}
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isCanceling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {b.processing}
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        {b.confirmCancel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
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

