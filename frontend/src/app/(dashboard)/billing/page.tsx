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
      alert(b.simulationMode);
      return;
    }
    try {
      const res = await api.post('/stripe/portal');
      window.location.href = res.data.url;
    } catch (err) {
      alert(b.portalError);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const res = await api.post('/stripe/cancel-subscription');
      setShowCancelModal(false);
      setToast({
        isVisible: true,
        message: b.cancelSuccess,
        type: 'success'
      });
      // Recarregar dados do utilizador
      const userRes = await api.get('/auth/me');
      // Usar valores diretos das traduções para evitar dependências
      const proPlan = t.dashboard.billing.proPlan;
      const basePlan = t.dashboard.billing.basePlan;
      setSubData({
        status: userRes.data.subscription_status,
        plan_name: ['active', 'trialing'].includes(userRes.data.subscription_status) ? proPlan : basePlan
      });
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
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{b.loadingHistory}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20 px-4 md:px-8">
      {/* Header */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={14} /> {b.secureBilling}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase leading-none">
              {b.title}<span className="text-blue-500 italic">{b.titleAccent}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl">{b.subtitle}</p>
          </div>

          <button 
            onClick={handlePortal}
            className="group flex items-center gap-3 px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            {b.manage}
            <ExternalLink size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Subscription Card */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[40px] flex flex-col justify-between group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full -mr-16 -mt-16" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{b.currentPlan}</p>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{subData?.plan_name}</h3>
          </div>
          <div className="mt-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full text-blue-400 text-[10px] font-bold">
              <Sparkles size={12} /> {b.activeBenefits}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[40px] flex flex-col justify-between group overflow-hidden relative"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{b.status}</p>
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
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[40px] flex flex-col justify-between group overflow-hidden relative"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{b.nextPayment}</p>
            <div className="flex items-center gap-3 text-white font-black text-xl tracking-tighter uppercase">
              <Calendar size={20} className="text-blue-500" />
              {isSimulated ? b.demoMode : b.viewInPortal}
            </div>
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-4 uppercase">
            {isSimulated ? b.noRealRenewal : b.autoRenewalActive}
          </p>
        </motion.div>
      </section>

      {/* Invoices Table */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[48px] overflow-hidden shadow-2xl">
        <div className="p-8 md:p-12">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-8 flex items-center gap-2">
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
                <div className="border border-slate-800/50 rounded-[32px] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/30">
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50">{b.table.date}</th>
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50">{b.table.amount}</th>
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50">{b.table.status}</th>
                        <th className="py-5 px-8 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50">{b.table.invoice}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-sm bg-slate-900/20">
                      {invoices.map((inv, idx) => (
                        <motion.tr 
                          key={inv.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group hover:bg-white/[0.03] transition-all"
                        >
                          <td className="py-6 px-8 font-medium text-slate-300">
                            <div className="flex items-center gap-3">
                              <Calendar size={14} className="text-blue-500/50" />
                              <span className="tabular-nums">
                                {new Date(inv.created * 1000).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </td>
                          <td className="py-6 px-8 font-black text-white text-base tracking-tighter">
                            {formatCurrency(
                              (inv.status === 'open' || inv.status === 'unpaid') && inv.amount_due
                                ? inv.amount_due / 100
                                : inv.amount_paid / 100
                            )}
                          </td>
                          <td className="py-6 px-8">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${getStatusColor(inv.status)}`}>
                              {getStatusLabel(inv.status)}
                            </span>
                          </td>
                          <td className="py-6 px-8 text-right">
                            {inv.invoice_pdf ? (
                              <a 
                                href={inv.invoice_pdf} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl transition-all font-black text-[9px] uppercase tracking-widest group/link border border-white/5"
                              >
                                PDF <Download size={12} className="group-hover/link:translate-y-0.5 transition-transform" />
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest border border-white/5 cursor-not-allowed">
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
      <section className="bg-blue-600/5 border border-blue-500/10 rounded-[40px] p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
          <ShieldCheck size={24} />
        </div>
        <p className="text-slate-400 text-sm font-medium flex-1">
          {b.stripeInfo}
        </p>
      </section>

      {/* Cancel Subscription Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCanceling && setShowCancelModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[48px] overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[80px] rounded-full -z-10" />
              
              <div className="p-8 lg:p-12">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                      {b.cancelSubscription}
                    </h2>
                  </div>
                  {!isCanceling && (
                    <button
                      onClick={() => setShowCancelModal(false)}
                      className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="space-y-6 mb-8">
                  <p className="text-slate-300 font-medium leading-relaxed">
                    {b.cancelConfirm}
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-sm text-amber-400 font-medium">
                      {b.cancelWarning}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={isCanceling}
                    className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {b.keepSubscription}
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
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

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </div>
  );
}

