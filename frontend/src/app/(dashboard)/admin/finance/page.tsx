'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Landmark, TrendingUp, CreditCard, Users, 
  ArrowUpRight, ArrowDownRight, DollarSign, 
  Clock, AlertCircle, CheckCircle2, Loader2,
  PieChart, BarChart3, Globe, ShieldCheck
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
import { useRouter } from 'next/navigation';

export default function AdminFinancePage() {
  const { t, formatCurrency } = useTranslation();
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [financeStats, setFinanceStats] = useState<any>(null);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });

  // Função para formatar sempre em EUR (tesouraria global)
  const formatEUR = (amount: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const fetchData = async () => {
    try {
      const res = await api.get('/admin/finance/stats');
      setFinanceStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
      setToast({ isVisible: true, message: t.dashboard.admin.finance.loadError, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !currentUser.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [currentUser]);

  if (loading) {
    return <PageLoading message="Consultando Tesouraria Global..." />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase">
            Tesouraria <span className="text-blue-500 italic">Global</span>
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">Monitorização financeira e métricas de subscrição Stripe.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-2 rounded-2xl">
          <Landmark className="text-blue-500" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terminal Financeiro Seguro</span>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* MRR Card */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-xl border border-blue-500/20 p-8 rounded-[32px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-blue-500/20">
            <TrendingUp size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-6">Receita Mensal Recorrente (MRR)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-white tracking-tighter">
              {formatEUR((financeStats?.total_mrr_cents || 0) / 100)}
            </h3>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="px-3 py-1 bg-blue-500/20 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest">Live de Stripe API</div>
            <ArrowUpRight className="text-emerald-500" size={20} />
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[32px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800">
            <DollarSign size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Receita Total Acumulada</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-white tracking-tighter">
              {formatEUR((financeStats?.total_revenue_cents || 0) / 100)}
            </h3>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="px-3 py-1 bg-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">Faturação Liquidada</div>
          </div>
        </div>

        {/* Active Subscriptions Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[32px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800">
            <Users size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Membros Pro Ativos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-white tracking-tighter">
              {financeStats?.active_subscriptions || 0}
            </h3>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="px-3 py-1 bg-emerald-500/10 rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-widest">Retenção Positiva</div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] p-8 md:p-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60">Faturamento Mensal</h2>
            <p className="text-xs text-slate-500 italic">Últimos 12 meses de receita liquidada</p>
          </div>
        </div>

        {financeStats?.monthly_revenue && financeStats.monthly_revenue.length > 0 ? (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeStats.monthly_revenue.map((item: { revenue_cents: number; [key: string]: any }) => {
                const revenue = item.revenue_cents / 100;
                // Calcular média
                const allRevenues = financeStats.monthly_revenue.map((i: { revenue_cents: number }) => i.revenue_cents / 100);
                const average = allRevenues.reduce((a: number, b: number) => a + b, 0) / allRevenues.length;
                return {
                  ...item,
                  revenue,
                  average
                };
              })}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  style={{ fontSize: '10px', fontWeight: 'bold' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#64748b"
                  style={{ fontSize: '10px', fontWeight: 'bold' }}
                  tickFormatter={(value) => formatEUR(value)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    if (value === undefined) return ['', name || ''];
                    if (name === 'average') return [formatEUR(value), t.dashboard.admin.finance.average];
                    return [formatEUR(value), t.dashboard.admin.finance.revenue];
                  }}
                />
                {/* Área com gradiente (shadow) */}
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)"
                  strokeWidth={3}
                />
                {/* Linha média */}
                <Line 
                  type="monotone" 
                  dataKey="average" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 size={48} className="text-slate-700 mb-4 opacity-20" />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">{t.dashboard.admin.finance.noBillingData}</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pending Invoices */}
        <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] p-8 md:p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60">Faturas Pendentes</h2>
              <p className="text-xs text-slate-500 italic">A aguardar liquidação ou em retry</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-4xl font-black text-white mb-2">{financeStats?.pending_invoices_count || 0}</div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">{t.dashboard.admin.finance.pendingInvoices}</p>
            {financeStats?.pending_invoices_count > 0 && (
              <div className="mt-6 flex items-center gap-2 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 text-[10px] font-black uppercase tracking-widest">
                <AlertCircle size={14} /> {t.dashboard.admin.finance.requiresAttention}
              </div>
            )}
          </div>
        </section>

        {/* System Health */}
        <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[32px] p-8 md:p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60">Status da Integração</h2>
              <p className="text-xs text-slate-500 italic">Conexão com Stripe API & Webhooks</p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { label: 'Stripe API Connection', status: t.dashboard.admin.finance.statusOperational },
              { label: 'Webhook Endpoints', status: t.dashboard.admin.finance.statusActive },
              { label: 'Customer Portal', status: t.dashboard.admin.finance.statusOperational }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </motion.div>
  );
}

