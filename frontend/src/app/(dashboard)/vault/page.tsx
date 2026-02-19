'use client';

import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Landmark, Plus, Minus, TrendingUp, TrendingDown,
  ShieldCheck, Target, ArrowUpRight, ArrowDownRight, X, Calendar
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import AlertModal from '@/components/AlertModal';
import PageLoading from '@/components/PageLoading';
import Toast from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

const QUICK_AMOUNTS = [25, 50, 100, 250];

export default function VaultPage() {
  const { t, formatCurrency } = useTranslation();
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vaultModal, setVaultModal] = useState<{ open: boolean; category: any; action: 'add' | 'withdraw' } | null>(null);
  const [vaultAmount, setVaultAmount] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false, title: '', message: '', type: 'error'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '', type: 'success', isVisible: false
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '30D' | '12M' | 'Tudo'>('Tudo');
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();

  // Guardar acesso: apenas utilizadores Pro podem usar /vault
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/dashboard');
      return;
    }
    if (!isPro) {
      setToast({
        message: t.dashboard?.transactions?.proRequiredMessage
          ?? 'Funcionalidade disponível apenas para utilizadores Pro. Atualiza o teu plano para aceder ao Cofre.',
        type: 'error',
        isVisible: true,
      });
      const timeout = setTimeout(() => {
        router.replace('/dashboard');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [userLoading, user, isPro, router, t.dashboard]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const fetchData = async () => {
    try {
      const [transRes, catRes] = await Promise.all([
        api.get('/transactions/'),
        api.get('/categories/')
      ]);
      setTransactions(transRes.data.filter((t: any) => Math.abs(t.amount_cents) !== 1));
      setCategories(catRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVaultTransaction = async () => {
    if (!vaultModal || !vaultAmount || parseFloat(vaultAmount) <= 0) return;
    setVaultLoading(true);
    try {
      const category = vaultModal.category;
      const amount_cents = Math.round(parseFloat(vaultAmount) * 100);
      const finalAmount = vaultModal.action === 'add' ? Math.abs(amount_cents) : -Math.abs(amount_cents);

      if (vaultModal.action === 'withdraw') {
        const vaultTransactions = transactions.filter((t: any) => {
          const cat = categories.find((c: any) => c.id === t.category_id);
          return cat && cat.id === category.id;
        });
        const currentBalance = vaultTransactions.reduce((balance: number, t: any) => {
          return t.amount_cents > 0 ? balance + t.amount_cents : balance - Math.abs(t.amount_cents);
        }, 0);
        if (amount_cents > currentBalance || currentBalance - amount_cents < 0) {
          setAlertModal({
            isOpen: true,
            title: t.dashboard.vault.insufficientBalanceTitle,
            message: `${t.dashboard.vault.insufficientBalance}\n\n${t.dashboard.vault.available} ${formatCurrency(currentBalance / 100)}\n${t.dashboard.vault.attempt} ${formatCurrency(parseFloat(vaultAmount))}\n\n${t.dashboard.vault.cannotBeNegative}`,
            type: 'error'
          });
          setVaultLoading(false);
          return;
        }
      }

      await api.post('/transactions/', {
        amount_cents: finalAmount,
        description: vaultModal.action === 'add' ? `${t.dashboard.vault.depositIn} ${category.name}` : `${t.dashboard.vault.withdrawalFrom} ${category.name}`,
        category_id: category.id,
        transaction_date: new Date().toISOString().split('T')[0],
        is_installment: false
      });
      setToast({
        message: `${vaultModal.action === 'add' ? t.dashboard.vault.depositIn : t.dashboard.vault.withdrawalFrom} ${category.name} - ${formatCurrency(parseFloat(vaultAmount))}`,
        type: 'success', isVisible: true
      });
      setVaultModal(null);
      setVaultAmount('');
      await fetchData();
    } catch (err: any) {
      setToast({ message: err.response?.data?.detail || 'Erro ao processar transação.', type: 'error', isVisible: true });
    } finally {
      setVaultLoading(false);
    }
  };

  const groupByPeriod = (evolution: any[], period: '7D' | '30D' | '12M' | 'Tudo') => {
    if (evolution.length === 0) return evolution;
    const now = new Date();
    let filterDate = new Date();
    let filtered = evolution;
    if (period !== 'Tudo') {
      if (period === '7D') filterDate.setDate(now.getDate() - 7);
      else if (period === '30D') filterDate.setDate(now.getDate() - 30);
      else if (period === '12M') filterDate.setFullYear(now.getFullYear() - 1);
      filtered = evolution.filter((item: any) => new Date(item.date) >= filterDate);
    }
    if (filtered.length === 0) return evolution.length > 0 ? [evolution[evolution.length - 1]] : [];
    const keepLastInGroup = (grouped: Record<string, { date: string; value: number }>) =>
      Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (period === '7D' || period === 'Tudo') {
      const grouped: Record<string, { date: string; value: number }> = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        grouped[dayKey] = { date: item.date, value: item.value };
      });
      return keepLastInGroup(grouped);
    }
    if (period === '30D') {
      const grouped: Record<string, { date: string; value: number }> = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        grouped[weekKey] = { date: item.date, value: item.value };
      });
      return keepLastInGroup(grouped);
    }
    if (period === '12M') {
      const grouped: Record<string, { date: string; value: number }> = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        grouped[monthKey] = { date: item.date, value: item.value };
      });
      return keepLastInGroup(grouped);
    }
    return filtered;
  };

  const vaultData = useMemo(() => {
    const emergencyCategory = categories.find((c: any) => c.vault_type === 'emergency');
    const investmentCategory = categories.find((c: any) => c.vault_type === 'investment');
    let emergencyTotal = 0, investmentTotal = 0;
    const emergencyTransactions: any[] = [], investmentTransactions: any[] = [];
    const emergencyEvolution: any[] = [], investmentEvolution: any[] = [];
    const sorted = [...transactions].sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    let eRun = 0, iRun = 0;

    const firstE = sorted.find((t: any) => categories.find((c: any) => c.id === t.category_id)?.vault_type === 'emergency')?.transaction_date;
    const firstI = sorted.find((t: any) => categories.find((c: any) => c.id === t.category_id)?.vault_type === 'investment')?.transaction_date;
    if (firstE) emergencyEvolution.push({ date: firstE, value: 0 });
    if (firstI) investmentEvolution.push({ date: firstI, value: 0 });

    sorted.forEach((t: any) => {
      const cat = categories.find((c: any) => c.id === t.category_id);
      if (cat?.vault_type === 'emergency') {
        const v = t.amount_cents > 0 ? t.amount_cents / 100 : -Math.abs(t.amount_cents / 100);
        emergencyTotal += v; eRun += v;
        emergencyTransactions.push({ ...t, category: cat });
        emergencyEvolution.push({ date: t.transaction_date, value: eRun });
      }
      if (cat?.vault_type === 'investment') {
        const v = t.amount_cents > 0 ? t.amount_cents / 100 : -Math.abs(t.amount_cents / 100);
        investmentTotal += v; iRun += v;
        investmentTransactions.push({ ...t, category: cat });
        investmentEvolution.push({ date: t.transaction_date, value: iRun });
      }
    });

    const emergencyMonthly: any = {}, investmentMonthly: any = {};
    emergencyTransactions.forEach((t: any) => {
      const month = new Date(t.transaction_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      if (!emergencyMonthly[month]) emergencyMonthly[month] = { month, deposits: 0, withdrawals: 0 };
      if (t.amount_cents > 0) emergencyMonthly[month].deposits += t.amount_cents / 100;
      else emergencyMonthly[month].withdrawals += Math.abs(t.amount_cents / 100);
    });
    investmentTransactions.forEach((t: any) => {
      const month = new Date(t.transaction_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      if (!investmentMonthly[month]) investmentMonthly[month] = { month, deposits: 0, withdrawals: 0 };
      if (t.amount_cents > 0) investmentMonthly[month].deposits += t.amount_cents / 100;
      else investmentMonthly[month].withdrawals += Math.abs(t.amount_cents / 100);
    });

    // Dynamic max for progress rings
    const combinedTotal = emergencyTotal + investmentTotal;
    const dynamicMax = Math.max(combinedTotal * 1.5, 5000);

    return {
      emergencyCategory, investmentCategory, emergencyTotal, investmentTotal,
      emergencyTransactions: emergencyTransactions.sort((a: any, b: any) => new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()),
      investmentTransactions: investmentTransactions.sort((a: any, b: any) => new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()),
      emergencyEvolution: groupByPeriod(emergencyEvolution.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()), selectedPeriod),
      investmentEvolution: groupByPeriod(investmentEvolution.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()), selectedPeriod),
      emergencyMonthly: Object.values(emergencyMonthly),
      investmentMonthly: Object.values(investmentMonthly),
      dynamicMax,
    };
  }, [transactions, categories, selectedPeriod]);

  if (loading || userLoading || !user || !isPro) return <PageLoading />;

  const grandTotal = vaultData.emergencyTotal + vaultData.investmentTotal;

  /* ── Shared chart tooltip ──────────────────────────────────── */
  const ChartTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const val = typeof data.value === 'number' ? data.value : 0;
    return (
      <div className="bg-slate-900/95 border border-slate-700/60 rounded-xl px-3 py-2 shadow-xl">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <p className={`text-sm font-black ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(val)}</p>
      </div>
    );
  };

  const xTickFormatter = (value: string) => {
    const d = new Date(value);
    return selectedPeriod === '12M'
      ? d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  };

  const yTickFormatter = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`;
    if (value <= -1000) return `-${(Math.abs(value) / 1000).toFixed(1)}k€`;
    return `${value.toFixed(0)}€`;
  };

  const yDomain = [
    (dataMin: number) => Math.floor(Math.min(0, dataMin) * 1.05),
    (dataMax: number) => Math.ceil(Math.max(0, dataMax) * 1.05)
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-white pb-20 px-4 sm:px-6 md:px-10 xl:px-14 space-y-8 sm:space-y-12">

      {/* ═══ Header ═══ */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Landmark size={14} /> {t.dashboard.vault.title}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase leading-tight">
              {t.dashboard.vault.title?.split(' ').slice(0, -1).join(' ')} <span className="text-blue-500 italic">{t.dashboard.vault.title?.split(' ').slice(-1)[0]}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl italic text-sm sm:text-base">
              {t.dashboard.vault.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Summary Stats ═══ */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Reservas</p>
          <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight">{formatCurrency(grandTotal)}</p>
          <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mt-2.5 flex">
            <motion.div initial={{ width: 0 }} animate={{ width: grandTotal > 0 ? `${(vaultData.emergencyTotal / grandTotal) * 100}%` : '50%' }}
              transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full bg-blue-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: grandTotal > 0 ? `${(vaultData.investmentTotal / grandTotal) * 100}%` : '50%' }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }} className="h-full bg-emerald-500" />
          </div>
        </div>
        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.vault.emergencyFund}</p>
          </div>
          <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight">{formatCurrency(vaultData.emergencyTotal)}</p>
        </div>
        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{t.dashboard.vault.zenInvestments || t.dashboard.vault.investments}</p>
          </div>
          <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight">{formatCurrency(vaultData.investmentTotal)}</p>
        </div>
      </section>

      {/* ═══ Vault Cards ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Emergency Fund */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/70 backdrop-blur-md border border-blue-500/20 rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl group hover:border-blue-500/40 transition-all duration-300"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/15 rounded-2xl flex items-center justify-center shrink-0 border border-blue-500/20">
              <ShieldCheck size={24} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">{t.dashboard.vault.emergencyFund}</p>
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums truncate">{formatCurrency(vaultData.emergencyTotal)}</p>
            </div>
            {vaultData.emergencyTransactions.length > 0 && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                vaultData.emergencyTransactions[0]?.amount_cents > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {vaultData.emergencyTransactions[0]?.amount_cents > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatCurrency(Math.abs(vaultData.emergencyTransactions[0]?.amount_cents || 0) / 100)}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="h-2.5 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mb-5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (vaultData.emergencyTotal / vaultData.dynamicMax) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
              style={{ boxShadow: '0 0 10px rgba(59,130,246,0.35)' }}
            />
          </div>

          {vaultData.emergencyCategory && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'add' })}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 rounded-xl transition-all cursor-pointer"
              >
                <Plus size={16} className="text-blue-400" />
                <span className="text-xs font-black uppercase tracking-widest text-blue-400">{t.dashboard.vault.add}</span>
              </button>
              <button
                onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'withdraw' })}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer"
              >
                <Minus size={16} className="text-red-400" />
                <span className="text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* Investments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-slate-900/70 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl group hover:border-emerald-500/40 transition-all duration-300"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Target size={24} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5">{t.dashboard.vault.zenInvestments || t.dashboard.vault.investments}</p>
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums truncate">{formatCurrency(vaultData.investmentTotal)}</p>
            </div>
            {vaultData.investmentTransactions.length > 0 && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                vaultData.investmentTransactions[0]?.amount_cents > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {vaultData.investmentTransactions[0]?.amount_cents > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatCurrency(Math.abs(vaultData.investmentTransactions[0]?.amount_cents || 0) / 100)}
              </div>
            )}
          </div>

          <div className="h-2.5 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mb-5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (vaultData.investmentTotal / vaultData.dynamicMax) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ boxShadow: '0 0 10px rgba(16,185,129,0.35)' }}
            />
          </div>

          {vaultData.investmentCategory && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'add' })}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-xl transition-all cursor-pointer"
              >
                <Plus size={16} className="text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">{t.dashboard.vault.add}</span>
              </button>
              <button
                onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'withdraw' })}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer"
              >
                <Minus size={16} className="text-red-400" />
                <span className="text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
              </button>
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══ Period Selector ═══ */}
      <section className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-3 sm:p-4 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Periodo</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {[
            { key: '7D', label: '7 Dias' },
            { key: '30D', label: '30 Dias' },
            { key: '12M', label: '12 Meses' },
            { key: 'Tudo', label: 'Tudo' }
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key as any)}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                selectedPeriod === period.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Evolution Charts ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Emergency Evolution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ShieldCheck size={16} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionEmergency}</h3>
          </div>
          {vaultData.emergencyEvolution.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={vaultData.emergencyEvolution}>
                <defs>
                  <linearGradient id="gradEmergency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={yTickFormatter} domain={yDomain as any} axisLine={false} tickLine={false} />
                <Tooltip content={ChartTooltipContent} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#gradEmergency)" strokeWidth={2.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-xs text-slate-500 italic">{t.dashboard.vault.noTransactions}</p>
            </div>
          )}
        </motion.div>

        {/* Investment Evolution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Target size={16} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionInvestments}</h3>
          </div>
          {vaultData.investmentEvolution.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={vaultData.investmentEvolution}>
                <defs>
                  <linearGradient id="gradInvestment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={yTickFormatter} domain={yDomain as any} axisLine={false} tickLine={false} />
                <Tooltip content={ChartTooltipContent} />
                <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#gradInvestment)" strokeWidth={2.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-xs text-slate-500 italic">{t.dashboard.vault.noTransactions}</p>
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══ Monthly Activity ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Emergency Monthly */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <ShieldCheck size={16} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.vault.emergencyFund}</span>
          </div>
          {vaultData.emergencyMonthly.length > 0 ? (
            <div className="space-y-3">
              {(vaultData.emergencyMonthly as any[]).slice(-6).reverse().map((month: any, idx: number) => {
                const total = month.deposits + month.withdrawals;
                const depositPercent = total > 0 ? (month.deposits / total) * 100 : 0;
                const net = month.deposits - month.withdrawals;
                return (
                  <motion.div key={idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{month.month}</span>
                      <div className="flex items-center gap-3">
                        {month.deposits > 0 && <span className="text-[10px] font-bold text-blue-400">+{formatCurrency(month.deposits)}</span>}
                        {month.withdrawals > 0 && <span className="text-[10px] font-bold text-red-400">-{formatCurrency(month.withdrawals)}</span>}
                        <span className={`text-xs font-black ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</span>
                      </div>
                    </div>
                    <div className="relative w-full h-2.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30 flex">
                      {depositPercent > 0 && (
                        <motion.div initial={{ width: 0 }} animate={{ width: `${depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.06 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ boxShadow: '0 0 6px rgba(59,130,246,0.3)' }} />
                      )}
                      {total - month.deposits > 0 && (
                        <motion.div initial={{ width: 0 }} animate={{ width: `${100 - depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.06 + 0.1 }}
                          className="h-full bg-gradient-to-r from-red-500/60 to-red-400/60" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <p className="text-xs text-slate-500 italic">Sem atividade mensal ainda</p>
            </div>
          )}
        </motion.div>

        {/* Investment Monthly */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Target size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{t.dashboard.vault.investments}</span>
          </div>
          {vaultData.investmentMonthly.length > 0 ? (
            <div className="space-y-3">
              {(vaultData.investmentMonthly as any[]).slice(-6).reverse().map((month: any, idx: number) => {
                const total = month.deposits + month.withdrawals;
                const depositPercent = total > 0 ? (month.deposits / total) * 100 : 0;
                const net = month.deposits - month.withdrawals;
                return (
                  <motion.div key={idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{month.month}</span>
                      <div className="flex items-center gap-3">
                        {month.deposits > 0 && <span className="text-[10px] font-bold text-emerald-400">+{formatCurrency(month.deposits)}</span>}
                        {month.withdrawals > 0 && <span className="text-[10px] font-bold text-red-400">-{formatCurrency(month.withdrawals)}</span>}
                        <span className={`text-xs font-black ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</span>
                      </div>
                    </div>
                    <div className="relative w-full h-2.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30 flex">
                      {depositPercent > 0 && (
                        <motion.div initial={{ width: 0 }} animate={{ width: `${depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.06 }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ boxShadow: '0 0 6px rgba(16,185,129,0.3)' }} />
                      )}
                      {total - month.deposits > 0 && (
                        <motion.div initial={{ width: 0 }} animate={{ width: `${100 - depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.06 + 0.1 }}
                          className="h-full bg-gradient-to-r from-red-500/60 to-red-400/60" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <p className="text-xs text-slate-500 italic">Sem atividade mensal ainda</p>
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══ Transaction History ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Emergency Transactions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ShieldCheck size={16} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.transactionsEmergency}</h3>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {vaultData.emergencyTransactions.length > 0 ? (
              vaultData.emergencyTransactions.map((tx: any, idx: number) => (
                <motion.div key={tx.id || idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.amount_cents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {tx.amount_cents > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{tx.description || t.dashboard.vault.noDescription}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{new Date(tx.transaction_date || tx.created_at).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black tabular-nums shrink-0 ${tx.amount_cents > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount_cents) / 100)}
                  </span>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-slate-500 text-xs italic py-10">{t.dashboard.vault.noTransactions}</p>
            )}
          </div>
        </motion.div>

        {/* Investment Transactions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Target size={16} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.transactionsInvestments}</h3>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {vaultData.investmentTransactions.length > 0 ? (
              vaultData.investmentTransactions.map((tx: any, idx: number) => (
                <motion.div key={tx.id || idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                  className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.amount_cents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {tx.amount_cents > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{tx.description || t.dashboard.vault.noDescription}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{new Date(tx.transaction_date || tx.created_at).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black tabular-nums shrink-0 ${tx.amount_cents > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount_cents) / 100)}
                  </span>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-slate-500 text-xs italic py-10">{t.dashboard.vault.noTransactions}</p>
            )}
          </div>
        </motion.div>
      </section>

      {/* ═══ Vault Transaction Modal ═══ */}
      {(reduceMotion || isMobile) ? (
        vaultModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div role="presentation" onClick={() => !vaultLoading && setVaultModal(null)} className="absolute inset-0 bg-black/70" />
            <div role="dialog" aria-modal onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-900/95 border border-slate-700/60 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    vaultModal.action === 'add'
                      ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {vaultModal.action === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">{vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}</h3>
                    <p className="text-xs text-slate-400 truncate">{vaultModal.category.name}</p>
                  </div>
                </div>
                <button onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer shrink-0 -m-2" disabled={vaultLoading}>
                  <X size={18} />
                </button>
              </div>
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {QUICK_AMOUNTS.map((amt) => (
                  <button key={amt} type="button" onClick={() => setVaultAmount(String(amt))} disabled={vaultLoading}
                    className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      vaultAmount === String(amt)
                        ? (vaultModal.action === 'add'
                            ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'bg-red-600 text-white shadow-lg shadow-red-600/20')
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-700/60 hover:text-white'
                    }`}>
                    {amt}&euro;
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.vault.value}</label>
                  <input type="number" step="0.01" min="0.01" value={vaultAmount} onChange={(e) => setVaultAmount(e.target.value)} placeholder="0.00"
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    disabled={vaultLoading} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && !vaultLoading && vaultAmount && parseFloat(vaultAmount) > 0) handleVaultTransaction(); }} />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }} disabled={vaultLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50">
                    {t.dashboard.vault.cancel}
                  </button>
                  <button type="button" onClick={handleVaultTransaction} disabled={vaultLoading || !vaultAmount || parseFloat(vaultAmount) <= 0}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                      vaultModal.action === 'add'
                        ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}>
                    {vaultLoading ? t.dashboard.vault.processing : vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
      <AnimatePresence>
        {vaultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => !vaultLoading && setVaultModal(null)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()} className="relative bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    vaultModal.action === 'add'
                      ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {vaultModal.action === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">{vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}</h3>
                    <p className="text-xs text-slate-400 truncate">{vaultModal.category.name}</p>
                  </div>
                </div>
                <button onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer shrink-0 -m-2" disabled={vaultLoading}>
                  <X size={18} />
                </button>
              </div>
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {QUICK_AMOUNTS.map((amt) => (
                  <button key={amt} type="button" onClick={() => setVaultAmount(String(amt))} disabled={vaultLoading}
                    className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      vaultAmount === String(amt)
                        ? (vaultModal.action === 'add'
                            ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'bg-red-600 text-white shadow-lg shadow-red-600/20')
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-700/60 hover:text-white'
                    }`}>
                    {amt}&euro;
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.vault.value}</label>
                  <input type="number" step="0.01" min="0.01" value={vaultAmount} onChange={(e) => setVaultAmount(e.target.value)} placeholder="0.00"
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    disabled={vaultLoading} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && !vaultLoading && vaultAmount && parseFloat(vaultAmount) > 0) handleVaultTransaction(); }} />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }} disabled={vaultLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50">
                    {t.dashboard.vault.cancel}
                  </button>
                  <button type="button" onClick={handleVaultTransaction} disabled={vaultLoading || !vaultAmount || parseFloat(vaultAmount) <= 0}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                      vaultModal.action === 'add'
                        ? vaultModal.category.vault_type === 'emergency' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}>
                    {vaultLoading ? t.dashboard.vault.processing : vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      )}

      <AlertModal isOpen={alertModal.isOpen} onClose={() => setAlertModal({ ...alertModal, isOpen: false })} title={alertModal.title} message={alertModal.message} type={alertModal.type} />
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => setToast({ ...toast, isVisible: false })} />
    </motion.div>
  );
}
