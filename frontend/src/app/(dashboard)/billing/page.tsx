'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import {
  Calendar, Clock, CheckCircle2,
  AlertCircle, ExternalLink, Download, ArrowRight,
  ShieldCheck, Wallet, FileText,
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
  cancel_at_period_end?: boolean;
  plan_name?: string;
}

interface PaymentFailureInfo {
  code?: string;
  message?: string;
  failedAt?: string;
}

const DECLINE_MESSAGES: Record<'pt' | 'en', Record<string, string>> = {
  pt: {
    card_velocity_exceeded: 'O banco recusou por demasiadas tentativas num curto período. Aguarda alguns minutos e tenta novamente, ou usa outro cartão.',
    insufficient_funds: 'Pagamento recusado por saldo insuficiente. Atualiza o método de pagamento ou usa outro cartão.',
    do_not_honor: 'Pagamento recusado pelo banco. Contacta o teu banco ou usa outro cartão.',
    generic_decline: 'Pagamento recusado pelo banco. Atualiza o método de pagamento para manter o plano ativo.',
  },
  en: {
    card_velocity_exceeded: 'Your bank declined due to too many attempts in a short period. Wait a few minutes and try again, or use another card.',
    insufficient_funds: 'Payment declined due to insufficient funds. Update your payment method or use another card.',
    do_not_honor: 'Payment declined by your bank. Contact your bank or use another card.',
    generic_decline: 'Payment declined by your bank. Update your payment method to keep your plan active.',
  },
};
function declineMessage(code: string, isEn: boolean): string | undefined {
  return DECLINE_MESSAGES[isEn ? 'en' : 'pt'][code];
}

// Strings locais do aviso de falha e do próximo pagamento (o resto vem de t.dashboard.billing)
const LOCAL_STRINGS = {
  pt: {
    paymentFailedTitle: 'Falha na cobrança automática',
    paymentFailedDefault: 'A cobrança automática falhou. Atualiza o cartão para evitar interrupção do plano.',
    updateCard: 'Atualizar cartão',
    bankCode: 'Código do banco',
    renewsOn: 'Renova a',
    endsOn: 'Termina a',
    accessUntil: 'Sem renovação — manténs acesso até esta data',
  },
  en: {
    paymentFailedTitle: 'Automatic payment failed',
    paymentFailedDefault: 'The automatic charge failed. Update your card to avoid plan interruption.',
    updateCard: 'Update card',
    bankCode: 'Bank code',
    renewsOn: 'Renews on',
    endsOn: 'Ends on',
    accessUntil: 'No renewal — you keep access until this date',
  },
  fr: {
    paymentFailedTitle: 'Échec du paiement automatique',
    paymentFailedDefault: 'Le prélèvement automatique a échoué. Mettez à jour votre carte pour éviter toute interruption.',
    updateCard: 'Mettre à jour la carte',
    bankCode: 'Code banque',
    renewsOn: 'Renouvelée le',
    endsOn: 'Se termine le',
    accessUntil: 'Sans renouvellement — accès maintenu jusqu\'à cette date',
  },
} as const;

export default function BillingPage() {
  const { t, language, formatCurrency } = useTranslation();
  const isEn = (language || 'pt').toLowerCase().startsWith('en');
  const langKey = ((language || 'pt').slice(0, 2) as 'pt' | 'en' | 'fr');
  const L = LOCAL_STRINGS[langKey] ?? LOCAL_STRINGS.pt;
  const dateLocale = langKey === 'en' ? 'en-GB' : langKey === 'fr' ? 'fr-FR' : 'pt-PT';
  const b = t.dashboard.billing;
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [paymentFailure, setPaymentFailure] = useState<PaymentFailureInfo | null>(null);
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
        const [invRes, userRes, subRes] = await Promise.all([
          api.get('/stripe/invoices'),
          api.get('/auth/me'),
          // Detalhes da subscrição (data de renovação/fim) — tolerante a falha
          api.get('/stripe/subscription-details').catch(() => null),
        ]);

        setInvoices(invRes.data);
        const userStatus = userRes.data.subscription_status;
        const customerId = userRes.data.stripe_customer_id || '';
        const failureCode = (userRes.data?.last_payment_failure_code || '').toLowerCase();
        const fallbackMessage = userRes.data?.last_payment_failure_message || '';
        const mappedMessage = declineMessage(failureCode, isEn) || fallbackMessage;
        setPaymentFailure(failureCode ? {
          code: failureCode,
          message: mappedMessage,
          failedAt: userRes.data?.last_payment_failed_at,
        } : null);

        setIsSimulated(customerId.startsWith('sim_') || customerId.startsWith('test_'));
        // Usar valores diretos das traduções para evitar dependências
        const proPlan = t.dashboard.billing.proPlan;
        const basePlan = t.dashboard.billing.basePlan;
        setSubData({
          status: userStatus,
          // cancel_at_period_end mantém acesso Pro até ao fim do período — continua a ser o plano Pro
          plan_name: userRes.data?.is_shared_member
            ? ((t.dashboard as any).shared?.planBadge ?? 'Plano Partilhado')
            : ['active', 'trialing', 'cancel_at_period_end'].includes(userStatus) ? proPlan : basePlan,
          current_period_end: subRes?.data?.current_period_end,
          cancel_at_period_end: subRes?.data?.cancel_at_period_end,
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

  const periodEndDate = subData?.current_period_end
    ? new Date(subData.current_period_end * 1000).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const isCancelScheduled = subData?.status === 'cancel_at_period_end' || subData?.cancel_at_period_end;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 pb-20 px-4 md:px-8">
      {/* Header compacto, alinhado com o resto da app */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
            {b.title}{b.titleAccent}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic mt-1">{b.subtitle}</p>
        </div>
        <button
          onClick={handlePortal}
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0 touch-manipulation"
        >
          <ExternalLink size={14} className="shrink-0" />
          <span>{b.manage}</span>
        </button>
      </div>

      {/* Aviso de falha na cobrança automática */}
      {paymentFailure && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                {L.paymentFailedTitle}
              </p>
              <p className="text-sm text-slate-200 font-medium">
                {paymentFailure.message || L.paymentFailedDefault}
              </p>
              {paymentFailure.code && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {L.bankCode}: <span className="font-semibold">{paymentFailure.code}</span>
                </p>
              )}
            </div>
            <button
              onClick={handlePortal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0 touch-manipulation"
            >
              {L.updateCard}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}

      {/* Resumo da subscrição — faixa única com divisórias (sem 3 caixas clone) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-700/50">
          {/* Plano */}
          <div className="py-3 md:py-1 md:pr-6 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Wallet size={17} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{b.currentPlan}</p>
              <p className="text-lg font-black text-white tracking-tight truncate">{subData?.plan_name}</p>
            </div>
          </div>
          {/* Estado */}
          <div className="py-3 md:py-1 md:px-6 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              subData?.status === 'active' || subData?.status === 'trialing'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : isCancelScheduled
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {subData?.status === 'active' || subData?.status === 'trialing' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{b.status}</p>
              <p className={`text-lg font-black tracking-tight truncate ${
                subData?.status === 'active' || subData?.status === 'trialing'
                  ? 'text-emerald-400'
                  : isCancelScheduled ? 'text-red-400' : 'text-amber-400'
              }`}>
                {subData?.status === 'cancel_at_period_end'
                  ? b.states.cancel_at_period_end
                  : b.states[subData?.status as keyof typeof b.states] || subData?.status}
              </p>
            </div>
          </div>
          {/* Próximo pagamento — data real quando disponível */}
          <div className="py-3 md:py-1 md:pl-6 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Calendar size={17} className="text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                {isCancelScheduled && periodEndDate ? L.endsOn : b.nextPayment}
              </p>
              <p className="text-lg font-black text-white tracking-tight truncate tabular-nums">
                {isSimulated ? b.demoMode : (periodEndDate ?? b.viewInPortal)}
              </p>
              <p className="text-[10px] font-medium text-slate-600 truncate">
                {isSimulated ? b.noRealRenewal : isCancelScheduled ? L.accessUntil : b.autoRenewalActive}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Invoices Table */}
      <section className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileText size={13} className="text-blue-400" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{b.stripeHistory}</h2>
          </div>

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
                                {new Date(inv.created * 1000).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}
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

      {/* Info: sem caixa — linha discreta com ícone */}
      <div className="flex items-start sm:items-center gap-3 px-1">
        <ShieldCheck size={16} className="text-blue-500/70 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-slate-500 text-xs sm:text-sm font-medium flex-1">
          {b.stripeInfo}
        </p>
      </div>

      {/* Cancel Subscription Button - Centered below info banner */}
      {['active', 'trialing'].includes(subData?.status || '') && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-sm text-slate-400 hover:text-red-400 font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Trash2 size={16} />
            {b.cancelSubscription}
          </button>
        </div>
      )}

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

