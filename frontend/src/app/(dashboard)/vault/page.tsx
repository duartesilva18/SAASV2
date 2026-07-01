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
import AnimatedNumber from '@/components/AnimatedNumber';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

const QUICK_AMOUNTS = [25, 50, 100, 250];

export default function VaultPage() {
  const { t, formatCurrency } = useTranslation();
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  // Totais lifetime (SQL) — saldos de cofre autoritativos, independentes da lista paginada.
  const [vaultTotals, setVaultTotals] = useState<{ vault_emergency: number; vault_investment: number } | null>(null);
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
      const [transRes, catRes, totalsRes] = await Promise.all([
        // limit=500 para o histórico/gráficos; os SALDOS vêm de /dashboard/totals (SQL lifetime).
        api.get('/transactions/?limit=500'),
        api.get('/categories/'),
        api.get('/dashboard/totals'),
      ]);
      setTransactions(transRes.data.filter((t: any) => Math.abs(t.amount_cents) !== 1));
      setCategories(catRes.data);
      setVaultTotals({
        vault_emergency: totalsRes.data?.vault_emergency ?? 0,
        vault_investment: totalsRes.data?.vault_investment ?? 0,
      });
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
        // Saldo autoritativo (lifetime, SQL) para a categoria de cofre em causa; só usamos
        // a soma das linhas como fallback enquanto os totais não chegaram.
        let currentBalance: number;
        if (vaultTotals && category.vault_type === 'emergency') {
          currentBalance = Math.round(vaultTotals.vault_emergency * 100);
        } else if (vaultTotals && category.vault_type === 'investment') {
          currentBalance = Math.round(vaultTotals.vault_investment * 100);
        } else {
          const vaultTransactions = transactions.filter((t: any) => {
            const cat = categories.find((c: any) => c.id === t.category_id);
            return cat && cat.id === category.id;
          });
          currentBalance = vaultTransactions.reduce((balance: number, t: any) => {
            return t.amount_cents > 0 ? balance + t.amount_cents : balance - Math.abs(t.amount_cents);
          }, 0);
        }
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

    // SALDOS autoritativos: totais lifetime (SQL) quando disponíveis; senão, soma das linhas
    // carregadas (fallback durante o load). Evita saldos parciais com >500 transações.
    const finalEmergencyTotal = vaultTotals ? vaultTotals.vault_emergency : emergencyTotal;
    const finalInvestmentTotal = vaultTotals ? vaultTotals.vault_investment : investmentTotal;

    // Dynamic max for progress rings
    const combinedTotal = finalEmergencyTotal + finalInvestmentTotal;
    const dynamicMax = Math.max(combinedTotal * 1.5, 5000);

    return {
      emergencyCategory, investmentCategory,
      emergencyTotal: finalEmergencyTotal, investmentTotal: finalInvestmentTotal,
      emergencyTransactions: emergencyTransactions.sort((a: any, b: any) => new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()),
      investmentTransactions: investmentTransactions.sort((a: any, b: any) => new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()),
      emergencyEvolution: groupByPeriod(emergencyEvolution.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()), selectedPeriod),
      investmentEvolution: groupByPeriod(investmentEvolution.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()), selectedPeriod),
      emergencyMonthly: Object.values(emergencyMonthly),
      investmentMonthly: Object.values(investmentMonthly),
      dynamicMax,
    };
  }, [transactions, categories, selectedPeriod, vaultTotals]);

  if (loading || userLoading || !user || !isPro) return <PageLoading />;

  const grandTotal = vaultData.emergencyTotal + vaultData.investmentTotal;

  /* ── Shared chart tooltip ──────────────────────────────────── */
  const ChartTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const val = typeof data.value === 'number' ? data.value : 0;
    return (
      <div style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '8px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <p style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <p style={{ fontSize: 14, fontWeight: 900, color: val >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(val)}</p>
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-white pb-20 space-y-6 sm:space-y-8 -mt-2">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
            {t.dashboard.vault.title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic mt-1">{t.dashboard.vault.subtitle}</p>
        </div>
        <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider text-slate-600 bg-slate-800/60 px-2 py-0.5 rounded-md shrink-0 mt-2">
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* ═══ Hero Card — Total Reservas ═══ */}
      <motion.section
        initial={isMobile ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-500/[0.04] to-emerald-500/[0.04] bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-5 sm:gap-6">
          {/* Left: Total */}
          <div className="flex items-center gap-4 min-w-0 lg:flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Landmark size={22} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Reservas</p>
              <AnimatedNumber value={grandTotal} formatFn={formatCurrency} className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tabular-nums block truncate" />
            </div>
          </div>

          {/* Center: Distribution bar */}
          <div className="lg:flex-1 min-w-0">
            <div className="h-3 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 flex">
              <motion.div initial={{ width: 0 }} animate={{ width: grandTotal > 0 ? `${(vaultData.emergencyTotal / grandTotal) * 100}%` : '50%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full bg-gradient-to-r from-blue-600 to-blue-400" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.3)' }} />
              <motion.div initial={{ width: 0 }} animate={{ width: grandTotal > 0 ? `${(vaultData.investmentTotal / grandTotal) * 100}%` : '50%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ boxShadow: '0 0 8px rgba(16,185,129,0.3)' }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.vault.emergencyFund}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.vault.zenInvestments || t.dashboard.vault.investments}</span>
              </div>
            </div>
          </div>

          {/* Right: Mini cards */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3 lg:w-auto shrink-0">
            <div className="bg-slate-900/70 border border-slate-700/40 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck size={11} className="text-blue-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.vault.emergencyFund}</span>
              </div>
              <AnimatedNumber value={vaultData.emergencyTotal} formatFn={formatCurrency} className="text-sm sm:text-base font-black text-white tabular-nums block" />
            </div>
            <div className="bg-slate-900/70 border border-slate-700/40 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target size={11} className="text-emerald-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">{t.dashboard.vault.zenInvestments || t.dashboard.vault.investments}</span>
              </div>
              <AnimatedNumber value={vaultData.investmentTotal} formatFn={formatCurrency} className="text-sm sm:text-base font-black text-white tabular-nums block" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ Vault Cards ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Emergency Fund */}
        <motion.div
          initial={isMobile ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2 } }}
          className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-2xl group hover:border-blue-500/40 hover:shadow-blue-500/[0.06] transition-all duration-300"
        >
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth="3" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.min(100, (vaultData.emergencyTotal / vaultData.dynamicMax) * 100) * 1.257} 125.7`} className="transition-all duration-700" />
              </svg>
              <ShieldCheck size={18} className="text-blue-400 relative z-10" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">{t.dashboard.vault.emergencyFund}</p>
              <AnimatedNumber value={vaultData.emergencyTotal} formatFn={formatCurrency} className="text-xl sm:text-2xl font-black text-white tabular-nums truncate block" />
            </div>
            {vaultData.emergencyTransactions.length > 0 && (
              <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                vaultData.emergencyTransactions[0]?.amount_cents > 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'
              }`}>
                {vaultData.emergencyTransactions[0]?.amount_cents > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {formatCurrency(Math.abs(vaultData.emergencyTransactions[0]?.amount_cents || 0) / 100)}
              </div>
            )}
          </div>

          <div className="h-3 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mb-4 sm:mb-5">
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
              <motion.button
                whileHover={isMobile ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'add' })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 rounded-xl transition-colors cursor-pointer"
              >
                <Plus size={15} className="text-blue-400" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-400">{t.dashboard.vault.add}</span>
              </motion.button>
              <motion.button
                whileHover={isMobile ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'withdraw' })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors cursor-pointer"
              >
                <Minus size={15} className="text-red-400" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Investments */}
        <motion.div
          initial={isMobile ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2 } }}
          className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-2xl group hover:border-emerald-500/40 hover:shadow-emerald-500/[0.06] transition-all duration-300"
        >
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth="3" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.min(100, (vaultData.investmentTotal / vaultData.dynamicMax) * 100) * 1.257} 125.7`} className="transition-all duration-700" />
              </svg>
              <Target size={18} className="text-emerald-400 relative z-10" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5">{t.dashboard.vault.zenInvestments || t.dashboard.vault.investments}</p>
              <AnimatedNumber value={vaultData.investmentTotal} formatFn={formatCurrency} className="text-xl sm:text-2xl font-black text-white tabular-nums truncate block" />
            </div>
            {vaultData.investmentTransactions.length > 0 && (
              <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                vaultData.investmentTransactions[0]?.amount_cents > 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'
              }`}>
                {vaultData.investmentTransactions[0]?.amount_cents > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {formatCurrency(Math.abs(vaultData.investmentTransactions[0]?.amount_cents || 0) / 100)}
              </div>
            )}
          </div>

          <div className="h-3 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mb-4 sm:mb-5">
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
              <motion.button
                whileHover={isMobile ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'add' })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-xl transition-colors cursor-pointer"
              >
                <Plus size={15} className="text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-400">{t.dashboard.vault.add}</span>
              </motion.button>
              <motion.button
                whileHover={isMobile ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'withdraw' })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors cursor-pointer"
              >
                <Minus size={15} className="text-red-400" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
              </motion.button>
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══ Evolution Charts (with integrated period selector) ═══ */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Calendar size={13} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Evolução</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { key: '7D', label: '7D' },
              { key: '30D', label: '30D' },
              { key: '12M', label: '12M' },
              { key: 'Tudo', label: 'Tudo' }
            ].map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key as any)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  selectedPeriod === period.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                    : 'bg-transparent text-slate-500 border-slate-700/60 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <motion.div initial={isMobile ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <ShieldCheck size={13} className="text-blue-400" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionEmergency}</h3>
            </div>
            {vaultData.emergencyEvolution.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={vaultData.emergencyEvolution}>
                  <defs>
                    <linearGradient id="gradEmergency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={yTickFormatter} domain={yDomain as any} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={false} content={ChartTooltipContent} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#gradEmergency)" strokeWidth={2.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-xs text-slate-500 italic">{t.dashboard.vault.noTransactions}</p>
              </div>
            )}
          </motion.div>

          <motion.div initial={isMobile ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Target size={13} className="text-emerald-400" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionInvestments}</h3>
            </div>
            {vaultData.investmentEvolution.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={vaultData.investmentEvolution}>
                  <defs>
                    <linearGradient id="gradInvestment" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={yTickFormatter} domain={yDomain as any} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={false} content={ChartTooltipContent} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#gradInvestment)" strokeWidth={2.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-xs text-slate-500 italic">{t.dashboard.vault.noTransactions}</p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ═══ Monthly Activity ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[
          { data: vaultData.emergencyMonthly, label: t.dashboard.vault.emergencyFund, icon: <ShieldCheck size={13} className="text-blue-400" />, iconBg: 'bg-blue-500/10 border-blue-500/20', labelColor: 'text-blue-400', barColor: 'from-blue-500 to-blue-400', barGlow: 'rgba(59,130,246,0.3)', accentLine: 'bg-blue-400/40', delay: 0.2 },
          { data: vaultData.investmentMonthly, label: t.dashboard.vault.investments, icon: <Target size={13} className="text-emerald-400" />, iconBg: 'bg-emerald-500/10 border-emerald-500/20', labelColor: 'text-emerald-400', barColor: 'from-emerald-500 to-emerald-400', barGlow: 'rgba(16,185,129,0.3)', accentLine: 'bg-emerald-400/40', delay: 0.26 },
        ].map((cfg, si) => (
          <motion.div key={si} initial={isMobile ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: cfg.delay }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${cfg.iconBg}`}>
                  {cfg.icon}
                </div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.monthlyActivity}</h3>
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${cfg.labelColor}`}>{cfg.label}</span>
            </div>
            {(cfg.data as any[]).length > 0 ? (
              <div className="space-y-1.5">
                {(cfg.data as any[]).slice(-6).reverse().map((month: any, idx: number) => {
                  const total = month.deposits + month.withdrawals;
                  const depositPercent = total > 0 ? (month.deposits / total) * 100 : 0;
                  const net = month.deposits - month.withdrawals;
                  return (
                    <motion.div key={idx} initial={isMobile ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="relative p-2 sm:p-2.5 rounded-xl hover:bg-slate-800/30 transition-colors group/row">
                      <div className={`absolute top-0 left-0 w-0.5 h-full rounded-full ${cfg.accentLine} opacity-0 group-hover/row:opacity-100 transition-opacity`} />
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{month.month}</span>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {month.deposits > 0 && <span className={`text-[9px] sm:text-[10px] font-bold ${cfg.labelColor}`}>+{formatCurrency(month.deposits)}</span>}
                          {month.withdrawals > 0 && <span className="text-[9px] sm:text-[10px] font-bold text-red-400">-{formatCurrency(month.withdrawals)}</span>}
                          <span className={`text-[10px] sm:text-xs font-black ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{net >= 0 ? '+' : ''}{formatCurrency(net)}</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30 flex">
                        {depositPercent > 0 && (
                          <motion.div initial={{ width: 0 }} animate={{ width: `${depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.05 }}
                            className={`h-full rounded-full bg-gradient-to-r ${cfg.barColor}`} style={{ boxShadow: `0 0 6px ${cfg.barGlow}` }} />
                        )}
                        {total - month.deposits > 0 && (
                          <motion.div initial={{ width: 0 }} animate={{ width: `${100 - depositPercent}%` }} transition={{ duration: 0.6, delay: idx * 0.05 + 0.1 }}
                            className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-red-400/60" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[11px] text-slate-500 italic">Sem atividade mensal ainda</p>
              </div>
            )}
          </motion.div>
        ))}
      </section>

      {/* ═══ Transaction History ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[
          { txs: vaultData.emergencyTransactions, title: t.dashboard.vault.transactionsEmergency, icon: <ShieldCheck size={13} className="text-blue-400" />, iconBg: 'bg-blue-500/10 border-blue-500/20', delay: 0.3 },
          { txs: vaultData.investmentTransactions, title: t.dashboard.vault.transactionsInvestments, icon: <Target size={13} className="text-emerald-400" />, iconBg: 'bg-emerald-500/10 border-emerald-500/20', delay: 0.36 },
        ].map((cfg, si) => (
          <motion.div key={si} initial={isMobile ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: cfg.delay }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${cfg.iconBg}`}>
                {cfg.icon}
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{cfg.title}</h3>
              {cfg.txs.length > 0 && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded-md">{cfg.txs.length}</span>
              )}
            </div>
            <div className="space-y-1.5 sm:space-y-2 max-h-[320px] sm:max-h-[360px] overflow-y-auto">
              {cfg.txs.length > 0 ? (
                cfg.txs.map((tx: any, idx: number) => (
                  <motion.div key={tx.id || idx}
                    initial={isMobile ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    whileHover={isMobile ? undefined : { y: -1, transition: { duration: 0.15 } }}
                    className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-950/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.amount_cents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {tx.amount_cents > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] sm:text-xs font-bold text-white truncate">{tx.description || t.dashboard.vault.noDescription}</p>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 bg-slate-800/40 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          {new Date(tx.transaction_date || tx.created_at).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[11px] sm:text-sm font-black tabular-nums shrink-0 ml-2 ${tx.amount_cents > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.amount_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount_cents) / 100)}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-center">
                    <Landmark size={18} className="text-slate-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 italic">{t.dashboard.vault.noTransactions}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
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
