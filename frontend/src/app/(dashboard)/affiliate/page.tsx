'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import { 
  Users, TrendingUp, Copy, CheckCircle2, 
  ExternalLink, DollarSign, Calendar, AlertCircle,
  Sparkles, ArrowRight, Loader2, Clock, LineChart as LineChartIcon,
  CreditCard, Info, X, Share2, Gift, Target, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie, Legend
} from 'recharts';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';

interface AffiliateStatus {
  is_affiliate: boolean;
  affiliate_code: string | null;
  affiliate_link: string | null;
  total_referrals: number;
  total_conversions: number;
  total_earnings_cents: number;
  pending_earnings_cents: number;
  stripe_connect_configured: boolean;
  stripe_connect_account_id: string | null;
}

interface AffiliateStats {
  total_referrals: number;
  total_conversions: number;
  conversion_rate: number;
  total_earnings_cents: number;
  pending_earnings_cents: number;
  paid_earnings_cents: number;
  commission_plus_percent?: number;
  commission_pro_percent?: number;
  referrals: Array<{
    id: string;
    referred_user_email: string;
    referred_user_full_name: string | null;
    has_subscribed: boolean;
    subscription_date: string | null;
    created_at: string;
    payment_info: {
      amount_paid_cents: number;
      commission_cents: number;
      commission_percentage: number;
      currency: string;
      paid_at: string | null;
      subscription_status: string;
      plan_name: string | null;
      plan_interval: string | null;
    } | null;
  }>;
  monthly_commissions: Array<{
    month: string;
    revenue_cents: number;
    commission_cents: number;
    conversions: number;
    is_paid: boolean;
    paid_at: string | null;
  }>;
  weekly_revenue: Array<{
    week: string;
    week_label: string;
    revenue_cents: number;
    commission_cents: number;
  }>;
}

export default function AffiliatePage() {
  const { t, formatCurrency } = useTranslation();
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [errorInfo, setErrorInfo] = useState<{ months: number; monthsNeeded: number; isPlanBased?: boolean } | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDisconnectStripeModal, setShowDisconnectStripeModal] = useState(false);
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false);
  const [disconnectStripeLoading, setDisconnectStripeLoading] = useState(false);
  const hasLoadedData = useRef(false); // Flag para garantir que só carrega uma vez

  useEffect(() => {
    // Garantir que só carrega uma vez, mesmo com React Strict Mode
    if (hasLoadedData.current) {
      return;
    }
    hasLoadedData.current = true;

    const loadData = async () => {
      try {
        const statusRes = await api.get('/affiliate/status');
        setStatus(statusRes.data);
        
        // Se é afiliado, carregar stats
        if (statusRes.data.is_affiliate) {
          try {
            const statsRes = await api.get('/affiliate/stats');
            setStats(statsRes.data);
          } catch (err) {
            console.warn('Erro ao carregar stats:', err);
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados de afiliado:', err);
        setToast({
          isVisible: true,
          message: err?.response?.data?.detail || (t.dashboard.affiliate as any).loadError,
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequestAffiliate = async () => {
    if (requesting) return; // Evitar múltiplos cliques
    
    setRequesting(true);
    setErrorInfo(null); // Limpar erro anterior
    try {
      const response = await api.post('/affiliate/request');
      const newStatus = response.data;
      setStatus(newStatus);
      
      // Se foi aprovado, carregar stats
      if (newStatus.is_affiliate) {
        try {
          const statsRes = await api.get('/affiliate/stats');
          setStats(statsRes.data);
        } catch (err) {
          console.warn('Erro ao carregar stats:', err);
        }
        
        // Atualizar user context via refresh (não mutar diretamente)
        await refreshUser();
        
        setToast({
          isVisible: true,
          message: t.dashboard.affiliate.congratulations,
          type: 'success'
        });
      } else {
        setToast({
          isVisible: true,
          message: t.dashboard.affiliate.requestSent,
          type: 'success'
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || (t.dashboard.affiliate as any).requestError;
      
      // Extrair informações sobre meses se disponível (para plano básico)
      // Procura por "Tens X mês(es) pago(s)" ou "Tens X mês(es) consecutivo(s) pago(s)"
      const monthsMatch = errorMessage.match(/Tens (\d+)\s*mês(?:es)?(?:\s+(?:pago|consecutivo))?/i);
      if (monthsMatch) {
        const currentMonths = parseInt(monthsMatch[1]);
        setErrorInfo({
          months: currentMonths,
          monthsNeeded: 3,
          isPlanBased: true
        });
      } else {
        // Se não for erro de meses, apenas mostrar mensagem genérica
        setErrorInfo(null);
        setToast({
          isVisible: true,
          message: errorMessage,
          type: 'error'
        });
      }
    } finally {
      setRequesting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para browsers sem Clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatPrice = (cents: number) => formatCurrency(cents / 100);

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/affiliate/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `afiliado_${status?.affiliate_code || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast({ isVisible: true, message: (t.dashboard.affiliate as any).exportError ?? 'Erro ao exportar CSV.', type: 'error' });
    }
  };

  if (loading) {
    return <PageLoading variant="minimal" size="sm" />;
  }

  if (!status && !loading) {
    return null;
  }
  
  if (loading || !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Se não é afiliado e não solicitou
  if (!status?.is_affiliate && !user?.is_affiliate) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xl border border-white/5 rounded-2xl sm:rounded-[32px] p-6 sm:p-10 md:p-12 lg:p-16 shadow-2xl overflow-hidden"
        >
          <div className="relative z-10 text-center space-y-4 sm:space-y-6 md:space-y-8">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            >
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-blue-400" />
            </motion.div>
            
            {/* Title */}
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight">
                Programa de <span className="text-blue-400">Afiliados</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                Ganha comissões ao referir novos utilizadores! Quando alguém se regista através do teu link e subscreve Pro, recebes uma comissão.
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto my-4 sm:my-6 md:my-8">
              {[
                { icon: Users, text: t.dashboard.affiliate.monthlyCommissionsLabel, colorClass: 'text-blue-400' },
                { icon: TrendingUp, text: t.dashboard.affiliate.noLimits, colorClass: 'text-emerald-400' },
                { icon: DollarSign, text: t.dashboard.affiliate.fastPayments, colorClass: 'text-amber-400' }
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="bg-slate-800/50 border border-white/5 rounded-2xl p-4"
                >
                  <feature.icon className={`w-6 h-6 ${feature.colorClass} mx-auto mb-2`} />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{feature.text}</p>
                </motion.div>
              ))}
            </div>
            
            {/* CTA Button */}
            {requesting ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-3 text-blue-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-lg font-black uppercase tracking-wider">{(t.dashboard?.affiliate as any)?.thinking || 'A pensar...'}</span>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {(t.dashboard?.affiliate as any)?.verifyingAccount || 'A verificar se a tua conta tem mais de 3 meses...'}
                </p>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRequestAffiliate}
                disabled={requesting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 sm:px-8 md:px-10 py-4 sm:py-5 rounded-xl sm:rounded-[24px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-xs sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 sm:gap-3 mx-auto shadow-[0_0_30px_rgba(59,130,246,0.4)] w-full sm:w-auto justify-center"
              >
                Quer ser afiliado?
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            )}
            
            {user?.affiliate_requested_at && !requesting && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-amber-400 mt-6 flex items-center justify-center gap-2 font-medium"
              >
                <AlertCircle className="w-4 h-4" />
                Solicitação pendente de aprovação
              </motion.p>
            )}
            
            {/* Error Display - Clean & Simple */}
            {errorInfo && errorInfo.isPlanBased && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-[24px] p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-black text-amber-400 uppercase tracking-wider">
                    {t.dashboard.affiliate.noAccessTitle}
                  </p>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {t.dashboard.affiliate.noAccessMessage
                      .replace('{months}', String(errorInfo.months))
                      .replace('{monthsLabel}', errorInfo.months === 1 ? t.dashboard.affiliate.monthsPaid : t.dashboard.affiliate.monthsPaidPlural)
                      .replace('{needed}', String(errorInfo.monthsNeeded))}
                    {errorInfo.monthsNeeded - errorInfo.months > 0 && (
                      <> {t.dashboard.affiliate.monthsRemaining
                        .replace('{remaining}', String(errorInfo.monthsNeeded - errorInfo.months))
                        .replace('{remainingLabel}', (errorInfo.monthsNeeded - errorInfo.months === 1 ? t.dashboard.affiliate.month : t.dashboard.affiliate.months))}.</>
                    )}
                  </p>
                  <p className="text-xs text-amber-400/80 font-medium leading-relaxed mt-2">
                    {(t.dashboard?.affiliate as any)?.upgradeTip || '💡 Dica: Considera fazer upgrade para o plano de 3 meses ou anual para teres acesso imediato aos afiliados!'}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
        <Toast {...toast} duration={8000} onClose={() => {
          setToast({ ...toast, isVisible: false });
          setErrorInfo(null);
        }} />
      </div>
    );
  }

  // Se é afiliado - Dashboard Completo
  const chartData = stats?.monthly_commissions.map(comm => ({
    month: new Date(comm.month + '-01').toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }),
    receita: comm.revenue_cents / 100,
    comissão: comm.commission_cents / 100
  })) || [];

  const referralsChartData = stats?.referrals.reduce((acc: any, ref) => {
    const month = new Date(ref.created_at).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
    const existing = acc.find((item: any) => item.month === month);
    if (existing) {
      existing.referrals += 1;
      if (ref.has_subscribed) existing.conversions += 1;
    } else {
      acc.push({
        month,
        referrals: 1,
        conversions: ref.has_subscribed ? 1 : 0
      });
    }
    return acc;
  }, []).slice(-6) || [];

  // Dados semanais para gráfico de faturamento
  const weeklyChartData = stats?.weekly_revenue.map(week => ({
    week: week.week_label,
    receita: week.revenue_cents / 100,
    comissão: week.commission_cents / 100
  })) || [];

  // Calcular tendência (aumentando ou diminuindo)
  const getTrend = () => {
    if (weeklyChartData.length < 2) return null;
    const last = weeklyChartData[weeklyChartData.length - 1];
    const previous = weeklyChartData[weeklyChartData.length - 2];
    if (last.receita > previous.receita) return 'up';
    if (last.receita < previous.receita) return 'down';
    return 'stable';
  };
  const trend = getTrend();

  // Estimativa de comissão recorrente mensal: subscrições ativas dos referidos,
  // normalizadas ao mês (anual ÷ 12). É uma estimativa — pode variar com cancelamentos.
  const monthlyRecurringCents = (stats?.referrals ?? []).reduce((sum, r) => {
    const p = r.payment_info;
    if (!p || p.subscription_status !== 'active') return sum;
    if (p.plan_interval === 'year') return sum + p.commission_cents / 12;
    return sum + p.commission_cents; // mensal (inclui plano de 6 meses ÷ período seguinte)
  }, 0);

  const activeReferrals = (stats?.referrals ?? []).filter(r => r.payment_info?.subscription_status === 'active').length;

  const chartTooltipStyle = {
    backgroundColor: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(71,85,105,0.4)', borderRadius: '14px', color: '#f1f5f9',
    padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  } as const;

  return (
    <div className="w-full h-full px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6 overflow-y-auto">
      {/* Header compacto, alinhado com o resto da app */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
            {t.dashboard?.affiliate?.title ?? 'Afiliados'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic mt-1">
            {(t.dashboard?.affiliate as any)?.subtitle ?? 'Ganha comissões recorrentes por cada pessoa que trouxeres.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stats && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <Sparkles className="w-3 h-3" />
              Plus {stats.commission_plus_percent ?? 20}% · Pro {stats.commission_pro_percent ?? 25}%
            </span>
          )}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer touch-manipulation"
            title="Exportar CSV"
          >
            <ExternalLink className="w-3.5 h-3.5 rotate-90" /> CSV
          </button>
        </div>
      </div>

      {/* Link de afiliado — barra única com copiar */}
      {status.affiliate_link && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-amber-500/20 rounded-2xl p-2.5 pl-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
            <code className="text-xs text-slate-300 font-mono truncate">{status.affiliate_link}</code>
          </div>
          <button
            onClick={() => copyToClipboard(status.affiliate_link!)}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer touch-manipulation"
          >
            {copied ? <><CheckCircle2 className="w-4 h-4" /> {t.dashboard?.affiliate?.copied || 'Copiado!'}</> : <><Copy className="w-4 h-4" /> {t.dashboard?.affiliate?.copyLink || 'Copiar link'}</>}
          </button>
        </div>
      )}

      {/* KPIs — faixa única com divisórias (sem cartões clone) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-4 lg:divide-x divide-slate-700/50">
          <div className="lg:pr-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total ganho</p>
            <p className="text-xl sm:text-2xl font-black text-white tabular-nums truncate">{formatPrice(status.total_earnings_cents)}</p>
            {stats && <p className="text-[10px] text-emerald-400/90 font-semibold mt-0.5">Pago: {formatPrice(stats.paid_earnings_cents)}</p>}
          </div>
          <div className="lg:px-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pendente</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums truncate">{formatPrice(status.pending_earnings_cents)}</p>
            <p className="text-[10px] text-slate-600 font-semibold mt-0.5">Pago no fecho do mês</p>
          </div>
          <div className="lg:px-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Recorrente / mês</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums truncate">≈ {formatPrice(Math.round(monthlyRecurringCents))}</p>
            <p className="text-[10px] text-slate-600 font-semibold mt-0.5">{activeReferrals} subscrição(ões) ativa(s)</p>
          </div>
          <div className="lg:pl-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Conversões</p>
            <p className="text-xl sm:text-2xl font-black text-white tabular-nums">
              {status.total_conversions}<span className="text-sm text-slate-500 font-bold"> / {status.total_referrals}</span>
            </p>
            {stats && <p className="text-[10px] text-blue-400/90 font-semibold mt-0.5">Taxa de conversão: {stats.conversion_rate.toFixed(1)}%</p>}
          </div>
        </div>
      </motion.section>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receita e comissões mensais */}
          {chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <LineChartIcon className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">Receita e comissões mensais</h3>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic mb-3 sm:mb-4">O que os teus referidos pagaram vs. o que ganhaste</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorComissao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${v}€`} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    cursor={false}
                    contentStyle={chartTooltipStyle as any}
                    itemStyle={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700 }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' as const }}
                    formatter={(value: number | undefined) => value === undefined ? '' : formatPrice(value * 100)}
                  />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="comissão" name="Comissão" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorComissao)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Linha 2: Semanal + Referências/Conversões lado a lado */}
          {(weeklyChartData.length > 0 || referralsChartData.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {weeklyChartData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">Comissões por semana</h3>
                    {trend && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                        trend === 'up' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        trend === 'down' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-slate-800/60 text-slate-500 border-slate-700/50'
                      }`}>
                        <TrendingUp className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : trend === 'stable' ? 'rotate-90' : ''}`} />
                        {trend === 'up' ? t.dashboard.affiliate.trendUp : trend === 'down' ? t.dashboard.affiliate.trendDown : t.dashboard.affiliate.trendStable}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={weeklyChartData} margin={{ top: 8, right: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWeeklyComissao" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="week" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => `${v}€`} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        cursor={false}
                        contentStyle={chartTooltipStyle as any}
                        itemStyle={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700 }}
                        formatter={(value: number | undefined) => value === undefined ? '' : formatPrice(value * 100)}
                      />
                      <Area type="monotone" dataKey="comissão" name="Comissão" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorWeeklyComissao)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {referralsChartData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
                >
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3 sm:mb-4">Referências vs conversões</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={referralsChartData} margin={{ top: 8, right: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="month" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                      <Tooltip cursor={false} contentStyle={chartTooltipStyle as any} itemStyle={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700 }} />
                      <Line type="monotone" dataKey="referrals" name="Referências" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3.5 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="conversions" name="Conversões" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3.5 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500" /> Referências</span>
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Conversões</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Referências — tabela compacta */}
          {stats && stats.referrals.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                    {t.dashboard?.affiliate?.referrals || "Referências"}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded-md">{stats.referrals.length}</span>
                </div>
                <button
                  onClick={() => setShowTutorialModal(true)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  {t.dashboard?.affiliate?.howItWorks || "Como funciona"}
                </button>
              </div>
              <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0">
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="py-2.5 px-4 sm:px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Utilizador</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Registo</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Estado</th>
                      <th className="py-2.5 px-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard?.affiliate?.amountPaid || "Pago"}</th>
                      <th className="py-2.5 px-3 sm:pr-1 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard?.affiliate?.commission || "Comissão"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {stats.referrals.map((ref) => (
                      <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 sm:px-3 max-w-[200px]">
                          <p className="text-xs font-bold text-white truncate">{ref.referred_user_full_name || ref.referred_user_email}</p>
                          {ref.referred_user_full_name && <p className="text-[10px] text-slate-500 truncate">{ref.referred_user_email}</p>}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                          {new Date(ref.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3">
                          {ref.has_subscribed ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[9px] font-bold uppercase tracking-wider border border-emerald-500/20 whitespace-nowrap">
                              {ref.payment_info?.subscription_status === 'active'
                                ? (t.dashboard?.affiliate?.converted || "Ativo")
                                : (ref.payment_info?.subscription_status ?? (t.dashboard?.affiliate?.converted || "Convertido"))}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-800/60 text-slate-500 rounded-md text-[9px] font-bold uppercase tracking-wider border border-slate-700/50 whitespace-nowrap">
                              {t.dashboard?.affiliate?.pending || "Pendente"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-bold text-white tabular-nums whitespace-nowrap">
                          {ref.payment_info ? formatPrice(ref.payment_info.amount_paid_cents) : '—'}
                        </td>
                        <td className="py-3 px-3 sm:pr-1 text-right whitespace-nowrap">
                          {ref.payment_info ? (
                            <span className="text-xs font-black text-amber-400 tabular-nums">
                              {formatPrice(ref.payment_info.commission_cents)}
                              <span className="text-[9px] text-slate-600 font-bold ml-1">({ref.payment_info.commission_percentage}%)</span>
                            </span>
                          ) : <span className="text-xs text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : status?.is_affiliate && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 shadow-xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                  <Share2 className="w-10 h-10 text-amber-400" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-white">
                    {t.dashboard?.affiliate?.howItWorksTitle || "Como Funciona o Programa de Afiliados"}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium italic max-w-md">
                    {t.dashboard?.affiliate?.howItWorksDescription || "Partilha o teu link único e ganha comissões quando alguém subscrever Pro através dele."}
                  </p>
                </div>

                <div className="w-full space-y-4 max-w-lg">
                  <div className="flex gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Share2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white mb-1.5 leading-tight">{t.dashboard?.affiliate?.step1Title || "1. Partilha o Teu Link"}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {t.dashboard?.affiliate?.step1Description || "Usa o teu link único de afiliado para partilhar a plataforma. Podes partilhá-lo em redes sociais, blog, email, etc."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white mb-1.5 leading-tight">{t.dashboard?.affiliate?.step2Title || "2. Alguém se Regista"}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {t.dashboard?.affiliate?.step2Description || "Quando alguém se regista através do teu link, fica associado à tua conta de afiliado."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Gift className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white mb-1.5 leading-tight">{t.dashboard?.affiliate?.step3Title || "3. Recebe Comissões"}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {t.dashboard?.affiliate?.step3Description || "Quando o utilizador referido subscrever o plano Pro, recebes uma comissão automaticamente na tua conta Stripe."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Target className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white mb-1.5 leading-tight">{t.dashboard?.affiliate?.step4Title || "4. Acompanha os Resultados"}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {t.dashboard?.affiliate?.step4Description || "Vê quantas pessoas referiste, quantas converteram e quanto ganhaste em comissões."}
                      </p>
                    </div>
                  </div>
                </div>

                {status.affiliate_link && (
                  <div className="w-full max-w-lg space-y-3">
                    <div className="bg-slate-800/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t.dashboard?.affiliate?.yourAffiliateLink || "O Teu Link de Afiliado"}</p>
                      <code className="text-xs text-slate-300 break-all font-mono block">{status.affiliate_link}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(status.affiliate_link!)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          {t.dashboard?.affiliate?.linkCopied || "Link Copiado!"}
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          {t.dashboard?.affiliate?.copyLink || "Copiar Link"}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column - Side Info */}
        <div className="space-y-6">
          {/* Stripe Connect Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                {t.dashboard?.affiliate?.automaticPayments || "Pagamentos Automáticos"}
              </h3>
              {status && (
                <span className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  status.stripe_connect_configured ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/60 text-slate-400'
                }`}>
                  {status.stripe_connect_configured ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {status.stripe_connect_configured ? (t.dashboard?.affiliate?.configured || "Configurado") : (t.dashboard?.affiliate?.notConfigured || "Não configurado")}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {status?.stripe_connect_configured
                ? (t.dashboard?.affiliate?.stripeConnected || "A tua conta Stripe está conectada. Receberás comissões automaticamente.")
                : (t.dashboard?.affiliate?.stripeNotConnected || "Conecta a tua conta Stripe para receberes comissões automaticamente.")}
            </p>
            <button
              disabled={stripeConnectLoading}
              onClick={async () => {
                setStripeConnectLoading(true);
                try {
                  if (status?.stripe_connect_configured) {
                    const res = await api.get('/affiliate/stripe-connect/dashboard');
                    if (res.data.dashboard_url) window.open(res.data.dashboard_url, '_blank');
                  } else {
                    const res = await api.get('/affiliate/stripe-connect/onboard');
                    if (res.data.onboard_url) {
                      window.location.href = res.data.onboard_url;
                      return;
                    }
                  }
                } catch (err: any) {
                  setToast({ isVisible: true, message: err?.response?.data?.detail || (t.dashboard.affiliate as any).stripeError, type: 'error' });
                } finally {
                  setStripeConnectLoading(false);
                }
              }}
              className={`w-full h-11 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors ${
                status?.stripe_connect_configured
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-black'
              }`}
            >
              {stripeConnectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {stripeConnectLoading ? (t.dashboard?.affiliate?.loading ?? "A abrir...") : status?.stripe_connect_configured ? (t.dashboard?.affiliate?.openStripeDashboard || "Abrir Dashboard Stripe") : (t.dashboard?.affiliate?.configureStripeConnect || "Configurar Stripe Connect")}
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <button type="button" onClick={() => setShowWithdrawModal(true)} className="text-slate-500 hover:text-amber-400 flex items-center gap-1.5 cursor-pointer">
                <Info className="w-3.5 h-3.5" />
                {t.dashboard?.affiliate?.howToWithdraw ?? "Como levantar o dinheiro?"}
              </button>
              {(status?.stripe_connect_configured || status?.stripe_connect_account_id) && (
                <button type="button" onClick={() => setShowDisconnectStripeModal(true)} className="text-red-400/90 hover:text-red-400 flex items-center gap-1.5 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                  {(t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeButton'] ?? "Desligar conta Stripe"}
                </button>
              )}
            </div>
          </motion.div>

          {/* Comissões mensais — linhas compactas */}
          {stats && stats.monthly_commissions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  {t.dashboard?.affiliate?.monthlyCommissions || "Comissões mensais"}
                </h3>
              </div>
              <div className="divide-y divide-slate-800/70 max-h-[340px] overflow-y-auto custom-scrollbar">
                {stats.monthly_commissions.map((comm, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white capitalize truncate">
                        {new Date(comm.month + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {comm.conversions} conv. · {formatPrice(comm.revenue_cents)} receita
                        {comm.is_paid && comm.paid_at && (
                          <span className="text-emerald-400/80"> · pago {new Date(comm.paid_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-amber-400 tabular-nums">{formatPrice(comm.commission_cents)}</span>
                      <span className={`w-2 h-2 rounded-full ${comm.is_paid ? 'bg-emerald-400' : 'bg-amber-400'}`} title={comm.is_paid ? (t.dashboard?.affiliate?.paid || 'Pago') : (t.dashboard?.affiliate?.pending || 'Pendente')} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-800/70">
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {t.dashboard?.affiliate?.paid || 'Pago'}</span>
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t.dashboard?.affiliate?.pending || 'Pendente'}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>


      {/* Modal Tutorial */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Info className="w-6 h-6 text-amber-400" />
                {t.dashboard?.affiliate?.howItWorksTitle || "Como Funciona o Programa de Afiliados"}
              </h2>
              <button
                onClick={() => setShowTutorialModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-xl border border-blue-500/20">
                <p className="text-sm text-slate-300 font-medium italic leading-relaxed">
                  {t.dashboard?.affiliate?.modalDescription || "Partilha o teu link único e ganha comissões quando alguém subscrever Pro através dele."}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-5 bg-slate-800/40 rounded-xl border border-white/5">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Share2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-white mb-2">{t.dashboard?.affiliate?.modalStep1Title || "1. Partilha o Teu Link"}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {t.dashboard?.affiliate?.modalStep1Description || "Usa o teu link único de afiliado para partilhar a plataforma. Podes partilhá-lo em redes sociais, blog, email, ou qualquer outro canal."}
                    </p>
                    {status?.affiliate_link && (
                      <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-white/5">
                        <code className="text-xs text-slate-300 break-all font-mono">{status.affiliate_link}</code>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-slate-800/40 rounded-xl border border-white/5">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-white mb-2">{t.dashboard?.affiliate?.modalStep2Title || "2. Alguém se Regista"}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {t.dashboard?.affiliate?.modalStep2Description || "Quando alguém se regista através do teu link, fica automaticamente associado à tua conta de afiliado. Podes ver todas as referências na secção \"Referências\"."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-slate-800/40 rounded-xl border border-white/5">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Gift className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-white mb-2">{t.dashboard?.affiliate?.modalStep3Title || "3. Recebe Comissões"}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {t.dashboard?.affiliate?.modalStep3Description || "Quando o utilizador referido subscrever o plano Pro, recebes uma comissão automaticamente na tua conta Stripe Connect (se configurada). A comissão é calculada como uma percentagem do valor pago."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-slate-800/40 rounded-xl border border-white/5">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-white mb-2">{t.dashboard?.affiliate?.modalStep4Title || "4. Acompanha os Resultados"}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {t.dashboard?.affiliate?.modalStep4Description || "Na página de afiliados podes ver:"}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-400 list-disc list-inside">
                      <li>{t.dashboard?.affiliate?.modalStep4List1 || "Total de referências e conversões"}</li>
                      <li>{t.dashboard?.affiliate?.modalStep4List2 || "Ganhos totais e pendentes"}</li>
                      <li>{t.dashboard?.affiliate?.modalStep4List3 || "Gráficos de evolução"}</li>
                      <li>{t.dashboard?.affiliate?.modalStep4List4 || "Lista detalhada de cada referência"}</li>
                      <li>{t.dashboard?.affiliate?.modalStep4List5 || "Comissões mensais"}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 font-medium">
                  {t.dashboard?.affiliate?.modalTip || "💡 Dica: Configura o Stripe Connect para receberes as comissões automaticamente na tua conta bancária."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTutorialModal(false)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer"
              >
                {t.dashboard?.affiliate?.modalUnderstand || "Entendi"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Como levantar o dinheiro */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowWithdrawModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-amber-400" />
                {(t.dashboard?.affiliate as Record<string, string>)?.['withdrawModalTitle'] ?? "Como levantar o dinheiro das comissões?"}
              </h2>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-400 leading-relaxed">
                {(t.dashboard?.affiliate as Record<string, string>)?.['withdrawStep1'] ?? "1. As comissões entram na tua conta Stripe Connect (não vão diretamente para o banco)."}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {(t.dashboard?.affiliate as Record<string, string>)?.['withdrawStep2'] ?? "2. O Stripe envia o dinheiro para a tua conta bancária automaticamente, conforme o calendário de payouts (ex.: diário ou semanal)."}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {(t.dashboard?.affiliate as Record<string, string>)?.['withdrawStep3'] ?? "3. Se ainda não adicionaste uma conta bancária, faz login no Dashboard Stripe e completa o onboarding."}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {(t.dashboard?.affiliate as Record<string, string>)?.['withdrawStep4'] ?? "4. No Dashboard Stripe podes ver o saldo, o histórico de payouts e alterar a frequência dos envios."}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer"
              >
                {t.dashboard?.affiliate?.modalUnderstand || "Entendi"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Trocar conta Stripe (desligar e permitir associar outra) */}
      {showDisconnectStripeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !disconnectStripeLoading && setShowDisconnectStripeModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-amber-400" />
                {(t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeTitle'] ?? "Trocar conta Stripe?"}
              </h2>
              <button
                onClick={() => !disconnectStripeLoading && setShowDisconnectStripeModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                disabled={disconnectStripeLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              {(t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeMessage'] ?? "Vais desligar a conta Stripe atual. As comissões já geradas não são afetadas. Depois podes configurar outra conta Stripe quando quiseres."}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectStripeModal(false)}
                disabled={disconnectStripeLoading}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {(t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeCancel'] ?? "Cancelar"}
              </button>
              <button
                onClick={async () => {
                  setDisconnectStripeLoading(true);
                  try {
                    await api.post('/affiliate/stripe-connect/disconnect');
                    setShowDisconnectStripeModal(false);
                    const statusRes = await api.get('/affiliate/status');
                    setStatus(statusRes.data);
                    setToast({
                      isVisible: true,
                      message: (t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeSuccess'] ?? "Conta desligada. Podes configurar outra quando quiseres.",
                      type: 'success'
                    });
                  } catch (err: any) {
                    setToast({
                      isVisible: true,
                      message: err?.response?.data?.detail ?? (t.dashboard?.affiliate as Record<string, string>)?.['stripeError'] ?? "Erro ao desligar conta.",
                      type: 'error'
                    });
                  } finally {
                    setDisconnectStripeLoading(false);
                  }
                }}
                disabled={disconnectStripeLoading}
                className="px-6 py-3 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {disconnectStripeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {(t.dashboard?.affiliate as Record<string, string>)?.['loading'] ?? "A processar..."}
                  </>
                ) : (
                  (t.dashboard?.affiliate as Record<string, string>)?.['disconnectStripeConfirm'] ?? "Desligar conta"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Toast {...toast} onClose={() => setToast({ ...toast, isVisible: false })} />
    </div>
  );
}

