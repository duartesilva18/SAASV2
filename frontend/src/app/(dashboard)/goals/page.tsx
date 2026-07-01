'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, Edit2, X, Check,
  Calendar, Trophy, Sparkles, Clock,
  Heart, Star, Zap, Plane, Car, Home, Wallet, ChevronDown,
  PiggyBank, Flame, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  Tooltip as RTooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import { useSubmit } from '@/lib/useSubmit';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import PageLoading from '@/components/PageLoading';
import AnimatedNumber from '@/components/AnimatedNumber';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

const ICONS = [
  { name: 'Target', icon: Target },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Plane', icon: Plane },
  { name: 'Car', icon: Car },
  { name: 'Home', icon: Home },
  { name: 'Wallet', icon: Wallet },
  { name: 'Trophy', icon: Trophy }
];

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
const QUICK_AMOUNTS = [10, 25, 50, 100];

export default function GoalsPage() {
  const { t, formatCurrency } = useTranslation();
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [goalToClose, setGoalToClose] = useState<any | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeTransactionChoice, setCloseTransactionChoice] = useState<'income' | 'expense' | 'none'>('income');
  const [closingGoal, setClosingGoal] = useState<string | null>(null);
  const [goalForDeposit, setGoalForDeposit] = useState<any | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; type?: string; date?: string }>({});
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    name: '',
    goal_type: 'expense',
    target_amount_cents: 0,
    target_date: getTomorrowDate(),
    icon: 'Target',
    color_hex: '#3B82F6'
  });

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals/');
      setGoals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Guardar acesso: apenas utilizadores Pro podem usar /goals
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/dashboard');
      return;
    }
    if (!isPro) {
      setToast({
        show: true,
        message: t.dashboard?.transactions?.proRequiredMessage
          ?? 'Funcionalidade disponível apenas para utilizadores Pro. Atualiza o teu plano para aceder às Metas.',
        type: 'error',
      });
      const timeout = setTimeout(() => {
        router.replace('/dashboard');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [userLoading, user, isPro, router, t.dashboard]);

  useEffect(() => {
    fetchGoals();
  }, []);

  /* ── Derived stats ──────────────────────────────────────────── */
  const VIVID_COLORS = ['#3B82F6', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6'];

  const stats = useMemo(() => {
    const totalSavedCents = goals.reduce((sum, g) => sum + (g.current_amount_cents || 0), 0);
    const totalTargetCents = goals.reduce((sum, g) => sum + g.target_amount_cents, 0);
    const globalProgress = totalTargetCents > 0 ? (totalSavedCents / totalTargetCents) * 100 : 0;
    const completedCount = goals.filter(g => (g.current_amount_cents || 0) >= g.target_amount_cents).length;
    return { totalSavedCents, totalTargetCents, globalProgress, completedCount };
  }, [goals]);

  const goalsForChart = useMemo(() => {
    return [...goals]
      .sort((a, b) => b.target_amount_cents - a.target_amount_cents)
      .slice(0, 6)
      .map((g, i) => ({
        name: g.name,
        target: g.target_amount_cents / 100,
        current: (g.current_amount_cents || 0) / 100,
        progress: g.target_amount_cents > 0 ? Math.min(100, ((g.current_amount_cents || 0) / g.target_amount_cents) * 100) : 0,
        color: g.color_hex || VIVID_COLORS[i % VIVID_COLORS.length],
        icon: g.icon,
      }));
  }, [goals]);

  const typeBreakdown = useMemo(() => {
    const expenseCount = goals.filter(g => g.goal_type !== 'income').length;
    const incomeCount = goals.filter(g => g.goal_type === 'income').length;
    const total = goals.length || 1;
    return { expenseCount, incomeCount, total };
  }, [goals]);

  const pieData = useMemo(() => {
    return goals.map((g, i) => ({
      name: g.name,
      value: g.target_amount_cents / 100,
      color: g.color_hex || VIVID_COLORS[i % VIVID_COLORS.length],
    }));
  }, [goals]);

  const timelineGoals = useMemo(() => {
    return [...goals].sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
  }, [goals]);

  const nextDeadline = useMemo(() => {
    const now = new Date();
    const upcoming = goals
      .filter(g => new Date(g.target_date) > now && (g.current_amount_cents || 0) < g.target_amount_cents)
      .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
    return upcoming[0] || null;
  }, [goals]);

  const nextDeadlineDays = nextDeadline
    ? Math.ceil((new Date(nextDeadline.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  /* ── Handlers ───────────────────────────────────────────────── */
  const submitGoal = async () => {
    try {
      const payload = {
        name: formData.name,
        goal_type: formData.goal_type,
        target_amount_cents: Math.round(formData.target_amount_cents * 100),
        current_amount_cents: editingGoal ? editingGoal.current_amount_cents : 0,
        target_date: formData.target_date,
        icon: formData.icon,
        color_hex: formData.color_hex
      };
      if (editingGoal) {
        await api.patch(`/goals/${editingGoal.id}`, payload);
        setToast({ show: true, message: t.dashboard.goals.updateSuccess, type: 'success' });
      } else {
        await api.post('/goals/', payload);
        setToast({ show: true, message: t.dashboard.goals.createSuccess, type: 'success' });
      }
      setShowModal(false);
      setEditingGoal(null);
      fetchGoals();
    } catch (err) {
      setToast({ show: true, message: t.dashboard.goals.saveError, type: 'error' });
    }
  };

  const { submitting, run: runGoalSubmit } = useSubmit(submitGoal);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; amount?: string; type?: string; date?: string } = {};
    if (!formData.name.trim()) newErrors.name = t.dashboard.goals.validation.required;
    if (!formData.target_amount_cents || formData.target_amount_cents <= 0) newErrors.amount = t.dashboard.goals.validation.amountPositive;
    if (!formData.goal_type) newErrors.type = t.dashboard.goals.validation.required;
    if (!formData.target_date) newErrors.date = t.dashboard.goals.validation.required;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    runGoalSubmit();
  };

  const handleDelete = async () => {
    if (!goalToDelete) return;
    try {
      await api.delete(`/goals/${goalToDelete}`);
      setToast({ show: true, message: t.dashboard.goals.deleteSuccess, type: 'success' });
      setShowDeleteConfirm(false);
      setGoalToDelete(null);
      fetchGoals();
    } catch (err) {
      setToast({ show: true, message: t.dashboard.goals.deleteError, type: 'error' });
      setShowDeleteConfirm(false);
      setGoalToDelete(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setGoalToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleDeposit = async () => {
    if (!goalForDeposit || !depositAmount || parseFloat(depositAmount) <= 0) return;
    setDepositLoading(true);
    try {
      const amount_cents = Math.round(parseFloat(depositAmount) * 100);
      await api.post(`/goals/${goalForDeposit.id}/deposit`, { amount_cents });
      setToast({ show: true, message: t.dashboard.goals?.depositSuccess ?? 'Valor adicionado à meta.', type: 'success' });
      setGoalForDeposit(null);
      setDepositAmount('');
      fetchGoals();
    } catch (err: any) {
      setToast({ show: true, message: err.response?.data?.detail || (t.dashboard.goals?.depositError ?? 'Erro ao adicionar.'), type: 'error' });
    } finally {
      setDepositLoading(false);
    }
  };

  const handleCloseGoal = async () => {
    if (!goalToClose) return;
    setClosingGoal(goalToClose.id);
    try {
      const createTransaction = closeTransactionChoice !== 'none';
      const transactionType = closeTransactionChoice === 'none' ? 'income' : closeTransactionChoice;
      await api.post(`/goals/${goalToClose.id}/close`, {
        create_transaction: createTransaction,
        transaction_type: transactionType,
      });
      setToast({ show: true, message: t.dashboard.goals?.closeSuccess ?? 'Meta terminada.', type: 'success' });
      setGoalToClose(null);
      setShowCloseConfirm(false);
      fetchGoals();
    } catch (err: any) {
      setToast({ show: true, message: err.response?.data?.detail || (t.dashboard.goals?.closeError ?? 'Erro ao terminar meta.'), type: 'error' });
    } finally {
      setClosingGoal(null);
    }
  };

  const openEdit = (goal: any) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      goal_type: goal.goal_type || 'expense',
      target_amount_cents: goal.target_amount_cents / 100,
      target_date: goal.target_date,
      icon: goal.icon,
      color_hex: goal.color_hex
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingGoal(null);
    setFormData({
      name: '',
      goal_type: 'expense',
      target_amount_cents: 0,
      target_date: getTomorrowDate(),
      icon: 'Target',
      color_hex: '#3B82F6'
    });
    setShowModal(true);
  };

  if (loading || userLoading || !user || !isPro) {
    return <PageLoading message={t.dashboard.goals.loading} />;
  }

  const barTooltipStyle = { background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '8px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-none min-w-0 space-y-5 sm:space-y-6 pb-20 -mt-2">

      {/* ═══ 1. Header + Stats ═══ */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-white truncate">{t.dashboard.goals.title}</h1>
        <motion.button whileTap={{ scale: 0.96 }} onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0">
          <Plus size={14} /> {t.dashboard.goals.newGoal}
        </motion.button>
      </div>

      {goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Stat: Total Metas */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2">
              <Target size={15} className="text-blue-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.goals.totalGoals ?? 'Total Metas'}</p>
            <AnimatedNumber value={goals.length} className="text-lg sm:text-xl font-black text-white tabular-nums" />
          </motion.div>
          {/* Stat: Total Poupado */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
              <PiggyBank size={15} className="text-emerald-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.goals.totalSaved ?? 'Total Poupado'}</p>
            <AnimatedNumber value={stats.totalSavedCents / 100} formatFn={formatCurrency} className="text-lg sm:text-xl font-black text-white tabular-nums" />
            <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden mt-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${stats.globalProgress}%` }} transition={{ duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            </div>
          </motion.div>
          {/* Stat: Progresso Global */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-10 h-10 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="19" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${Math.min(100, stats.globalProgress) * 1.194} 119.4`} className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-black text-white tabular-nums">{Math.round(stats.globalProgress)}%</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.goals.globalProgress ?? 'Progresso'}</p>
            <span className="text-xs font-bold text-emerald-400">{stats.completedCount}/{goals.length} {t.dashboard.goals.completed ?? 'concluidas'}</span>
          </motion.div>
          {/* Stat: Proxima Deadline */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Clock size={15} className="text-amber-400" />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.goals.deadline ?? 'Deadline'}</p>
            {nextDeadline ? (
              <>
                <span className={`text-lg sm:text-xl font-black tabular-nums ${nextDeadlineDays != null && nextDeadlineDays <= 7 ? 'text-amber-400' : 'text-white'}`}>
                  {nextDeadlineDays}d
                </span>
                <p className="text-[9px] font-bold text-slate-500 truncate mt-0.5">{nextDeadline.name}</p>
              </>
            ) : (
              <span className="text-sm font-bold text-slate-500 italic">--</span>
            )}
          </motion.div>
        </div>
      )}

      {/* ═══ 2. Bar Chart — Target vs Poupado ═══ */}
      {goalsForChart.length > 0 && (
        <motion.section initial={isMobile ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <TrendingUp size={13} className="text-blue-400" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.goals.chartTopTitle}</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={goalsForChart} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v: number) => formatCurrency(v)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={80} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <RTooltip
                cursor={false}
                contentStyle={barTooltipStyle}
                itemStyle={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700 }}
                labelStyle={{ color: '#94a3b8', fontWeight: 800, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                formatter={(value: any, name: any) => [formatCurrency(Number(value ?? 0)), name === 'target' ? 'Objetivo' : 'Poupado']}
              />
              <Bar dataKey="target" name="target" fill="#334155" radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey="current" name="current" radius={[0, 4, 4, 0]} barSize={10}>
                {goalsForChart.map((g, i) => (
                  <Cell key={i} fill={g.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-3">
            <div className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-slate-700" /><span className="text-[9px] sm:text-[10px] font-bold text-slate-500">Objetivo</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-blue-500" /><span className="text-[9px] sm:text-[10px] font-bold text-slate-500">Poupado</span></div>
          </div>
        </motion.section>
      )}

      {/* ═══ 3. Goals Grid ═══ */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0">
          {goals.map((goal, gi) => {
            const targetAmountEuros = goal.target_amount_cents / 100;
            const currentAmountEuros = (goal.current_amount_cents || 0) / 100;
            const progress = targetAmountEuros > 0 ? Math.min(100, (currentAmountEuros / targetAmountEuros) * 100) : 0;
            const Icon = ICONS.find(i => i.name === goal.icon)?.icon || Target;
            const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const canComplete = currentAmountEuros >= targetAmountEuros;
            const isUrgent = daysLeft <= 7 && daysLeft > 0 && !canComplete;

            return (
              <motion.div
                key={goal.id}
                initial={isMobile ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
                whileHover={isMobile ? undefined : { y: -2, transition: { duration: 0.15 } }}
                className="group relative flex flex-col bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200"
                style={{ borderColor: canComplete ? `${goal.color_hex}30` : undefined }}
              >
                <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${goal.color_hex}, ${goal.color_hex}60)` }} />

                <div className="flex flex-col flex-1 p-4 sm:p-5">
                  {/* Top: ring + name + actions */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth="3" />
                        <motion.circle cx="22" cy="22" r="18" fill="none" stroke={goal.color_hex} strokeWidth="3" strokeLinecap="round"
                          strokeDasharray="113.1"
                          initial={{ strokeDashoffset: 113.1 }}
                          animate={{ strokeDashoffset: 113.1 - (Math.min(progress, 100) / 100) * 113.1 }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                      </svg>
                      {canComplete ? <Check size={15} className="text-emerald-400 relative z-10" /> : <Icon size={15} className="relative z-10" style={{ color: goal.color_hex }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">{goal.name}</h3>
                        {canComplete && <span className="px-1.5 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">{t.dashboard.goals.goalCompleted ?? 'Concluida'}</span>}
                        {isUrgent && <span className="px-1.5 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0 animate-pulse">{daysLeft}d</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className={goal.goal_type === 'income' ? 'text-emerald-500' : 'text-blue-500'}>
                          {goal.goal_type === 'income' ? t.dashboard.goals.typeIncome : t.dashboard.goals.typeExpense}
                        </span>
                        <span className="text-slate-700">·</span>
                        <Calendar size={9} className="shrink-0" />
                        <span className={daysLeft <= 0 ? 'text-red-400' : ''}>{daysLeft > 0 ? `${daysLeft}d` : t.dashboard.goals.dateReached}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button type="button" onClick={() => openEdit(goal)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-600 hover:text-white transition-colors"><Edit2 size={12} /></button>
                      <button type="button" onClick={() => handleDeleteClick(goal.id)} className="p-1.5 hover:bg-red-500/15 rounded-lg text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {/* Amount + bar */}
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <AnimatedNumber value={currentAmountEuros} formatFn={formatCurrency} className="text-base sm:text-lg font-black text-white tabular-nums" />
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0">/ {formatCurrency(targetAmountEuros)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mb-1.5">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }}
                      className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${goal.color_hex}, ${goal.color_hex}cc)`, boxShadow: `0 0 8px ${goal.color_hex}40` }} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-bold tabular-nums" style={{ color: goal.color_hex }}>{Math.round(progress)}%</span>
                    {canComplete
                      ? <span className="text-[9px] font-bold text-emerald-400">+{formatCurrency(currentAmountEuros - targetAmountEuros)}</span>
                      : <span className="text-[9px] font-bold text-slate-600">{formatCurrency(targetAmountEuros - currentAmountEuros)} {t.dashboard.goals.remaining}</span>
                    }
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-slate-700/40">
                    <motion.button type="button" whileTap={{ scale: 0.97 }}
                      onClick={() => { setGoalForDeposit(goal); setDepositAmount(''); }}
                      className="py-2 px-2 rounded-xl font-bold uppercase tracking-wider text-[9px] sm:text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      style={{ backgroundColor: `${goal.color_hex}12`, color: goal.color_hex, border: `1px solid ${goal.color_hex}20` }}>
                      <Plus size={13} /> {t.dashboard.goals?.addMoney ?? 'Adicionar'}
                    </motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.97 }}
                      onClick={() => { setGoalToClose(goal); setShowCloseConfirm(true); }}
                      className="py-2 px-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl font-bold uppercase tracking-wider text-[9px] sm:text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer border border-slate-700/40">
                      <Check size={13} /> {t.dashboard.goals?.finishGoal ?? 'Terminar'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="py-16 sm:py-24 text-center space-y-5 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md rounded-2xl border border-dashed border-slate-700/40">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full opacity-20 animate-ping" style={{ backgroundColor: '#3b82f6', animationDuration: '3s' }} />
            <div className="relative w-full h-full bg-slate-800/60 border border-slate-700/40 rounded-full flex items-center justify-center">
              <Target size={28} className="text-blue-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-black text-white">{t.dashboard.goals.emptyMap}</p>
            <p className="text-slate-500 text-xs font-medium max-w-sm mx-auto">{t.dashboard.goals.startByDefining ?? 'Comeca por definir um objetivo e dar o primeiro passo.'}</p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20 cursor-pointer">
            <Plus size={15} /> {t.dashboard.goals.createFirstGoal ?? 'Criar Primeira Meta'}
          </motion.button>
        </motion.div>
      )}

      {/* ═══ 4. Insights: Pie Chart + Timeline ═══ */}
      {goals.length >= 2 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 min-w-0">
          {/* Pie Chart */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <PiggyBank size={13} className="text-violet-400" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.goals.chartTypesTitle ?? 'Distribuicao'}</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative shrink-0">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <RTooltip
                      cursor={false}
                      contentStyle={barTooltipStyle}
                      itemStyle={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700 }}
                      formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'Objetivo']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <AnimatedNumber value={stats.totalSavedCents / 100} formatFn={formatCurrency} className="text-sm sm:text-base font-black text-white tabular-nums" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">poupado</span>
                </div>
              </div>
              <div className="flex flex-wrap sm:flex-col gap-2 sm:gap-1.5 justify-center">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 truncate max-w-[120px]">{entry.name}</span>
                    <span className="text-[9px] font-bold text-slate-600 tabular-nums">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Timeline */}
          <motion.div initial={isMobile ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="lg:col-span-1 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Calendar size={13} className="text-amber-400" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">Timeline</h3>
            </div>
            <div className="relative flex-1 space-y-0 overflow-y-auto max-h-[280px]">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-700/60" />
              {timelineGoals.map((g, i) => {
                const dl = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const done = (g.current_amount_cents || 0) >= g.target_amount_cents;
                const pct = g.target_amount_cents > 0 ? Math.min(100, ((g.current_amount_cents || 0) / g.target_amount_cents) * 100) : 0;
                return (
                  <div key={g.id || i} className="relative pl-7 py-2 group/tl">
                    <div className="absolute left-[5px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-2 z-10"
                      style={{ borderColor: g.color_hex, backgroundColor: done ? g.color_hex : '#0f172a' }} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-[10px] sm:text-xs font-bold truncate ${done ? 'text-slate-500 line-through' : 'text-white'}`}>{g.name}</p>
                        <p className="text-[8px] sm:text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                          {new Date(g.target_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-bold tabular-nums" style={{ color: g.color_hex }}>{Math.round(pct)}%</span>
                        <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          done ? 'bg-emerald-500/15 text-emerald-400' : dl <= 0 ? 'bg-red-500/15 text-red-400' : dl <= 7 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800/60 text-slate-500'
                        }`}>
                          {done ? 'OK' : dl <= 0 ? 'Vencida' : `${dl}d`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Zen Tip */}
            <div className="mt-auto pt-3 border-t border-slate-700/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={11} className="text-amber-400" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">Zen Tip</span>
              </div>
              <p className="text-slate-500 text-[10px] leading-relaxed italic">
                &ldquo;{t.dashboard.goals.zenTip ?? 'Dividir grandes objetivos em metas menores torna tudo mais alcancavel.'}&rdquo;
              </p>
            </div>
          </motion.div>
        </section>
      )}

      {goals.length === 1 && (
        <div className="flex items-start gap-2.5 bg-slate-900 lg:bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 sm:p-4">
          <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-slate-500 text-[10px] sm:text-xs leading-relaxed italic">
            {t.dashboard.goals.zenTip ?? 'Dividir grandes objetivos em metas menores torna tudo mais alcancavel. Celebra cada conquista.'}
          </p>
        </div>
      )}

      {/* ═══ Modal Create/Edit ═══ */}
      <AnimatePresence>
        {showModal && (
          <div
            className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative w-full max-w-xl max-h-[90dvh] sm:max-h-[90vh] bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-t-2xl sm:rounded-2xl p-3 sm:p-6 md:p-8 shadow-2xl overflow-y-auto overflow-x-hidden flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-6 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-black text-white tracking-tight leading-tight truncate">
                    {editingGoal ? t.dashboard.goals.edit : t.dashboard.goals.new} <span className="text-blue-500 italic">{t.dashboard.goals.goal}</span>
                  </h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5 sm:mt-1 hidden sm:block">{t.dashboard.goals.drawYourFuture}</p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2 shrink-0 touch-manipulation" aria-label={t.dashboard.goals.cancel}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
                <div className="space-y-3 sm:space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.goalName}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 ${errors.name ? 'border-red-500' : 'border-slate-700'}`}
                      placeholder={t.dashboard.goals.goalNamePlaceholder}
                    />
                    {errors.name && <p className="text-[10px] text-red-400 mt-1">{errors.name}</p>}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.targetAmount}</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">&euro;</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.target_amount_cents}
                        onChange={(e) => {
                          setFormData({ ...formData, target_amount_cents: Number(e.target.value) });
                          if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined }));
                        }}
                        onFocus={(e) => {
                          if (e.currentTarget.value === '0' || e.currentTarget.value === '0.00') {
                            e.currentTarget.select();
                          }
                        }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 ${errors.amount ? 'border-red-500' : 'border-slate-700'}`}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.amount && <p className="text-[10px] text-red-400 mt-1">{errors.amount}</p>}
                  </div>

                  {/* Type + Date row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.goalType}</label>
                      <div className="relative">
                        <select
                          value={formData.goal_type}
                          onChange={(e) => {
                            setFormData({ ...formData, goal_type: e.target.value });
                            if (errors.type) setErrors(prev => ({ ...prev, type: undefined }));
                          }}
                          className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer ${errors.type ? 'border-red-500' : 'border-slate-700'}`}
                        >
                          <option value="expense">{t.dashboard.goals.typeExpense}</option>
                          <option value="income">{t.dashboard.goals.typeIncome}</option>
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                      {errors.type && <p className="text-[10px] text-red-400 mt-1">{errors.type}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.deadline}</label>
                      <input
                        type="date"
                        value={formData.target_date}
                        onChange={(e) => {
                          setFormData({ ...formData, target_date: e.target.value });
                          if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
                        }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${errors.date ? 'border-red-500' : 'border-slate-700'}`}
                      />
                      {errors.date && <p className="text-[10px] text-red-400 mt-1">{errors.date}</p>}
                    </div>
                  </div>

                  {/* Icon Picker */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.icon ?? 'Icone'}</label>
                    <div className="grid grid-cols-9 sm:flex sm:flex-wrap gap-2">
                      {ICONS.map((item) => {
                        const IconComp = item.icon;
                        const isSelected = formData.icon === item.name;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setFormData({ ...formData, icon: item.name })}
                            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer shrink-0 ${
                              isSelected
                                ? 'border-white scale-110 bg-white/10 text-white'
                                : 'border-transparent bg-slate-800/60 text-slate-400 opacity-50 hover:opacity-100 hover:text-white'
                            }`}
                            aria-label={item.name}
                          >
                            <IconComp size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Picker */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.color ?? 'Cor'}</label>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color_hex: color })}
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all cursor-pointer shrink-0 ${formData.color_hex === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                          style={{ backgroundColor: color }}
                          aria-label={t.dashboard.goals.color ?? 'Cor'}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {editingGoal ? t.dashboard.goals.saveChanges : t.dashboard.goals.activateGoal} <Check size={18} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Delete Confirm ═══ */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setGoalToDelete(null);
        }}
        onConfirm={handleDelete}
        title={t.dashboard.goals.deleteConfirm}
        message={t.dashboard.goals.deleteConfirmText || 'Tens a certeza que desejas eliminar esta meta? Esta ação não pode ser desfeita.'}
        confirmText={t.dashboard.goals.confirmDelete}
        cancelText={t.dashboard.goals.cancel}
        variant="danger"
      />

      {/* ═══ Close Goal Modal ═══ */}
      <AnimatePresence>
        {showCloseConfirm && goalToClose && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { setShowCloseConfirm(false); setGoalToClose(null); }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-black text-white mb-1">{t.dashboard.goals?.finishGoal ?? 'Terminar meta'}</h3>
              <p className="text-slate-400 text-sm mb-4">{goalToClose.name} · {formatCurrency((goalToClose.current_amount_cents || 0) / 100)}</p>
              <p className="text-slate-500 text-xs mb-3">{t.dashboard.goals?.closeCreateTransactionQuestion ?? 'Queres criar uma transação automaticamente?'}</p>
              <div className="space-y-2 mb-6">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-700 cursor-pointer hover:border-slate-600">
                  <input type="radio" name="closeTx" checked={closeTransactionChoice === 'income'} onChange={() => setCloseTransactionChoice('income')} className="text-blue-500" />
                  <span className="text-sm font-bold text-white">{t.dashboard.goals?.asIncome ?? 'Como receita'}</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-700 cursor-pointer hover:border-slate-600">
                  <input type="radio" name="closeTx" checked={closeTransactionChoice === 'expense'} onChange={() => setCloseTransactionChoice('expense')} className="text-blue-500" />
                  <span className="text-sm font-bold text-white">{t.dashboard.goals?.asExpense ?? 'Como despesa'}</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-700 cursor-pointer hover:border-slate-600">
                  <input type="radio" name="closeTx" checked={closeTransactionChoice === 'none'} onChange={() => setCloseTransactionChoice('none')} className="text-blue-500" />
                  <span className="text-sm font-bold text-white">{t.dashboard.goals?.noTransaction ?? 'Não criar transação'}</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowCloseConfirm(false); setGoalToClose(null); }} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 cursor-pointer">
                  {t.dashboard.goals.cancel}
                </button>
                <button type="button" onClick={handleCloseGoal} disabled={!!closingGoal} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wider cursor-pointer">
                  {closingGoal ? '...' : (t.dashboard.goals?.confirmClose ?? 'Terminar')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Deposit Modal ═══ */}
      <AnimatePresence>
        {goalForDeposit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { setGoalForDeposit(null); setDepositAmount(''); }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-black text-white mb-1">{t.dashboard.goals?.addMoney ?? 'Adicionar à meta'}</h3>
              <p className="text-slate-400 text-sm mb-4">{goalForDeposit.name}</p>

              {/* Quick amount buttons */}
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t.dashboard.goals.quickAmounts ?? 'Valor rapido'}</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      depositAmount === String(amt)
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-700/60 hover:text-white'
                    }`}
                  >
                    {amt}&euro;
                  </button>
                ))}
              </div>

              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.goals.depositValue ?? 'Valor'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value.replace(',', '.'))}
                className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setGoalForDeposit(null); setDepositAmount(''); }}
                  className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 cursor-pointer"
                >
                  {t.dashboard.goals.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                >
                  {depositLoading ? '...' : (t.dashboard.goals?.addMoney ?? 'Adicionar')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </motion.div>
  );
}
