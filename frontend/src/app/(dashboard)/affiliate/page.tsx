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
  CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie, Legend
} from 'recharts';
import Toast from '@/components/Toast';

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
  const { user } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [errorInfo, setErrorInfo] = useState<{ months: number; monthsNeeded: number; isPlanBased?: boolean } | null>(null);
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
          message: err?.response?.data?.detail || 'Erro ao carregar dados',
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
        
        // Atualizar user context se disponível
        if (user) {
          user.is_affiliate = true;
        }
        
        setToast({
          isVisible: true,
          message: 'Parabéns! Agora és afiliado!',
          type: 'success'
        });
      } else {
        setToast({
          isVisible: true,
          message: 'Solicitação enviada! Aguarda aprovação do administrador.',
          type: 'success'
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 'Erro ao solicitar afiliação';
      
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (cents: number) => formatCurrency(cents / 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
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
          className="relative bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xl border border-white/5 rounded-[48px] p-12 md:p-16 shadow-2xl overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full -z-10" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -z-10" />
          
          <div className="relative z-10 text-center space-y-8">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            >
              <Sparkles className="w-12 h-12 text-blue-400" />
            </motion.div>
            
            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                Programa de <span className="text-blue-400">Afiliados</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Ganha comissões ao referir novos utilizadores! Quando alguém se regista através do teu link e subscreve Pro, recebes uma comissão.
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto my-8">
              {[
                { icon: Users, text: 'Comissões Mensais', colorClass: 'text-blue-400' },
                { icon: TrendingUp, text: 'Sem Limites', colorClass: 'text-emerald-400' },
                { icon: DollarSign, text: 'Pagamentos Rápidos', colorClass: 'text-amber-400' }
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
                  <span className="text-lg font-black uppercase tracking-wider">A pensar...</span>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  A verificar se a tua conta tem mais de 5 meses...
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
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-3 mx-auto shadow-[0_0_30px_rgba(59,130,246,0.4)]"
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
                    Ainda não tens acesso aos afiliados
                  </p>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Tens <span className="text-amber-400 font-black">{errorInfo.months}</span> {errorInfo.months === 1 ? 'mês' : 'meses'} {errorInfo.months === 1 ? 'pago' : 'pagos'} no plano básico. 
                    Precisas de <span className="text-amber-400 font-black">{errorInfo.monthsNeeded}</span> meses consecutivos pagos para teres acesso ao programa de afiliados.
                    {errorInfo.monthsNeeded - errorInfo.months > 0 && (
                      <> Faltam <span className="text-amber-400 font-black">{errorInfo.monthsNeeded - errorInfo.months}</span> {errorInfo.monthsNeeded - errorInfo.months === 1 ? 'mês' : 'meses'}.</>
                    )}
                  </p>
                  <p className="text-xs text-amber-400/80 font-medium leading-relaxed mt-2">
                    💡 Dica: Considera fazer upgrade para o plano de 3 meses ou anual para teres acesso imediato aos afiliados!
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

  return (
    <div className="w-full h-full px-6 py-8 space-y-6 overflow-y-auto">
      {/* Header Compact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-6 pb-4 border-b border-white/5"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/30">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter">
              Programa de <span className="text-amber-400">Afiliados</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Ganha comissões ao referir novos utilizadores</p>
          </div>
        </div>
        {status.affiliate_code && (
          <div className="flex items-center gap-3 bg-slate-900/50 border border-amber-500/20 rounded-xl px-4 py-2">
            <code className="text-lg font-black text-amber-400 tracking-tighter">{status.affiliate_code}</code>
            <button
              onClick={() => copyToClipboard(status.affiliate_code!)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 hover:text-amber-400" />
              )}
            </button>
          </div>
        )}
      </motion.div>

      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-amber-400" />
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total de Referências</p>
          <p className="text-3xl font-black text-white tracking-tighter">{status.total_referrals}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Conversões</p>
          <p className="text-3xl font-black text-white tracking-tighter">{status.total_conversions}</p>
          {stats && (
            <p className="text-xs text-slate-400 mt-2">Taxa: {stats.conversion_rate.toFixed(1)}%</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-blue-400" />
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Ganho</p>
          <p className="text-3xl font-black text-white tracking-tighter">{formatPrice(status.total_earnings_cents)}</p>
          {stats && (
            <p className="text-xs text-slate-400 mt-2">Pago: {formatPrice(stats.paid_earnings_cents)}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-amber-400" />
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Pendente</p>
          <p className="text-3xl font-black text-white tracking-tighter">{formatPrice(status.pending_earnings_cents)}</p>
        </motion.div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue & Commission Chart */}
          {chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                <LineChartIcon className="w-5 h-5 text-amber-400" />
                Receita e Comissões Mensais
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorComissao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '12px'
                    }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '';
                      return formatPrice(value * 100);
                    }}
                  />
                  <Area type="monotone" dataKey="receita" stroke="#f59e0b" fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="comissão" stroke="#3b82f6" fillOpacity={1} fill="url(#colorComissao)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Weekly Revenue Chart */}
          {weeklyChartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  Faturamento Semanal
                </h3>
                {trend && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
                    trend === 'up' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    trend === 'down' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                  }`}>
                    {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                    {trend === 'down' && <TrendingUp className="w-4 h-4 rotate-180" />}
                    {trend === 'stable' && <TrendingUp className="w-4 h-4 rotate-90" />}
                    {trend === 'up' ? 'Aumentando' : trend === 'down' ? 'Diminuindo' : 'Estável'}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weeklyChartData}>
                  <defs>
                    <linearGradient id="colorWeeklyReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWeeklyComissao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '12px'
                    }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '';
                      return formatPrice(value * 100);
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="receita" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorWeeklyReceita)" 
                    name="Receita"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="comissão" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorWeeklyComissao)" 
                    name="Comissão"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Referrals Timeline Chart */}
          {referralsChartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                <LineChartIcon className="w-5 h-5 text-amber-400" />
                Referências e Conversões (Últimos 6 Meses)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={referralsChartData}>
                  <defs>
                    <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '12px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="referrals" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#colorReferrals)"
                    name="Referências"
                    dot={{ fill: '#3b82f6', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="url(#colorConversions)"
                    name="Conversões"
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Referrals List */}
          {stats && stats.referrals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Referências ({stats.referrals.length})
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {stats.referrals.map((ref) => (
                  <motion.div
                    key={ref.id}
                    whileHover={{ scale: 1.01 }}
                    className="p-4 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/5 hover:border-amber-500/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-sm mb-1">{ref.referred_user_email}</p>
                        <p className="text-xs text-slate-400 font-medium">
                          {new Date(ref.created_at).toLocaleDateString('pt-PT', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      {ref.has_subscribed ? (
                        <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-black uppercase tracking-wider border border-green-500/30 shrink-0">
                          Convertido
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-slate-700/50 text-slate-400 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-600/30 shrink-0">
                          Pendente
                        </span>
                      )}
                    </div>
                    {ref.payment_info && (
                      <div className="flex items-center gap-4 pt-3 border-t border-white/5">
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Valor Pago</p>
                          <p className="text-sm font-black text-white">{formatPrice(ref.payment_info.amount_paid_cents)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Comissão</p>
                          <p className="text-sm font-black text-amber-400">{formatPrice(ref.payment_info.commission_cents)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Percentagem</p>
                          <p className="text-sm font-black text-blue-400">{ref.payment_info.commission_percentage}%</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
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
            className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                Pagamentos Automáticos
              </h3>
              {/* Status Badge */}
              {status && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  status.stripe_connect_configured
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                }`}>
                  {status.stripe_connect_configured ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Configurado
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      Não Configurado
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mb-4 leading-relaxed">
              {status?.stripe_connect_configured
                ? 'A tua conta Stripe está conectada. Receberás comissões automaticamente quando alguém subscrever Pro através do teu link.'
                : 'Conecta a tua conta Stripe para receberes comissões automaticamente.'}
            </p>
            <button
              onClick={async () => {
                try {
                  if (status?.stripe_connect_configured) {
                    // Se já está configurado, abrir dashboard do Stripe
                    const res = await api.get('/affiliate/stripe-connect/dashboard');
                    if (res.data.dashboard_url) {
                      window.open(res.data.dashboard_url, '_blank');
                    }
                  } else {
                    // Se não está configurado, iniciar onboarding
                    const res = await api.get('/affiliate/stripe-connect/onboard');
                    if (res.data.onboard_url) {
                      window.location.href = res.data.onboard_url;
                    }
                  }
                } catch (err: any) {
                  setToast({
                    isVisible: true,
                    message: err?.response?.data?.detail || 'Erro ao aceder ao Stripe',
                    type: 'error'
                  });
                }
              }}
              className={`w-full px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${
                status?.stripe_connect_configured
                  ? 'bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white border border-slate-500/50'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black'
              }`}
            >
              {status?.stripe_connect_configured ? (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Abrir Dashboard Stripe
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Configurar Stripe Connect
                </>
              )}
            </button>
          </motion.div>

          {/* Affiliate Link */}
          {status.affiliate_link && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-amber-400" />
                Link de Afiliado
              </h3>
              <div className="space-y-3">
                <div className="bg-slate-800/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                  <code className="text-xs text-slate-300 break-all font-mono block">{status.affiliate_link}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(status.affiliate_link!)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Link
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Monthly Commissions */}
          {stats && stats.monthly_commissions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Comissões Mensais
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {stats.monthly_commissions.map((comm, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-black text-white text-sm">{new Date(comm.month + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</p>
                      {comm.is_paid ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-[10px] font-black uppercase border border-green-500/30">
                          Pago
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase border border-amber-500/30">
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-black text-amber-400 mb-1">{formatPrice(comm.commission_cents)}</p>
                    <p className="text-xs text-slate-400">
                      {comm.conversions} conversões • {formatPrice(comm.revenue_cents)} receita
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>


      <Toast {...toast} onClose={() => setToast({ ...toast, isVisible: false })} />
    </div>
  );
}

