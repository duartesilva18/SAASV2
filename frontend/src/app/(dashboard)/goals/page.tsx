'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Plus, Trash2, Edit2, X, Check, 
  Calendar, Trophy, Sparkles,
  Heart, Star, Zap, Plane, Car, Home, Wallet, ChevronDown,
  PiggyBank, Flame
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import PageLoading from '@/components/PageLoading';
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

/* ── SVG Circular Progress Ring ─────────────────────────────────── */
function ProgressRing({ progress, color, size = 64, strokeWidth = 5, completed = false }: {
  progress: number; color: string; size?: number; strokeWidth?: number; completed?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Glow when completed */}
      {completed && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ boxShadow: `0 0 18px ${color}40, 0 0 6px ${color}30` }}
        />
      )}
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {completed ? (
          <Check size={size * 0.35} className="text-emerald-400" />
        ) : (
          <span className="text-[10px] font-black text-white tabular-nums">{Math.round(progress)}%</span>
        )}
      </div>
    </div>
  );
}

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

  /* ── Handlers ───────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="w-full max-w-none min-w-0 space-y-8 sm:space-y-12 pb-20 px-4 sm:px-6 md:px-10 xl:px-14">
      {/* ═══ Header ═══ */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Trophy size={14} /> {t.dashboard.goals.badge}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter text-white uppercase leading-tight break-words">
              {t.dashboard.goals.title.split(' ').slice(0, -1).join(' ')} <span className="text-blue-500 italic">{t.dashboard.goals.title.split(' ').slice(-1)[0]}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl italic text-sm sm:text-base md:text-lg">
              &ldquo;{t.dashboard.goals.subtitle}&rdquo; &mdash; {t.dashboard.goals.subtitleQuote}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 w-full sm:w-auto"
          >
            <Plus size={18} className="shrink-0" />
            <span>{t.dashboard.goals.newGoal}</span>
          </button>
        </div>
      </section>

      {/* ═══ Summary Stat Cards ═══ */}
      {goals.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: t.dashboard.goals.totalGoals ?? 'Total Metas', value: `${goals.length}`, icon: Target, accent: 'blue' },
            { label: t.dashboard.goals.totalSaved ?? 'Total Poupado', value: formatCurrency(stats.totalSavedCents / 100), icon: PiggyBank, accent: 'emerald' },
            { label: t.dashboard.goals.totalTarget ?? 'Objetivo Total', value: formatCurrency(stats.totalTargetCents / 100), icon: Trophy, accent: 'amber' },
            { label: t.dashboard.goals.globalProgress ?? 'Progresso Global', value: `${Math.round(stats.globalProgress)}%`, icon: Flame, accent: 'violet' },
          ].map((card, i) => {
            const accentMap: Record<string, string> = {
              blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 border ${accentMap[card.accent]}`}>
                  <card.icon size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{card.label}</p>
                <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight">{card.value}</p>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* ═══ Goals Grid ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5 min-w-0 w-full">
        {goals.map((goal) => {
          const targetAmountEuros = goal.target_amount_cents / 100;
          const currentAmountEuros = (goal.current_amount_cents || 0) / 100;
          const progress = targetAmountEuros > 0 ? Math.min(100, (currentAmountEuros / targetAmountEuros) * 100) : 0;
          const Icon = ICONS.find(i => i.name === goal.icon)?.icon || Target;
          const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          const canComplete = currentAmountEuros >= targetAmountEuros;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative flex flex-col w-full bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer"
              style={{
                boxShadow: canComplete
                  ? `0 0 24px ${goal.color_hex}15, 0 4px 32px rgba(0,0,0,0.3)`
                  : undefined,
              }}
              whileHover={{ borderColor: `${goal.color_hex}40` }}
            >
              <div className="relative z-10 flex flex-col flex-1 min-h-0 p-4 md:p-5">
                {/* Row 1: ring + info + actions */}
                <div className="flex items-start gap-3 mb-3">
                  <ProgressRing
                    progress={progress}
                    color={goal.color_hex}
                    size={60}
                    strokeWidth={5}
                    completed={canComplete}
                  />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${goal.color_hex}20`, color: goal.color_hex }}
                      >
                        <Icon size={14} />
                      </div>
                      {canComplete ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {t.dashboard.goals.goalCompleted ?? 'Concluida'}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            goal.goal_type === 'income'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                          }`}
                        >
                          {goal.goal_type === 'income' ? t.dashboard.goals.typeIncome : t.dashboard.goals.typeExpense}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate" title={goal.name}>
                      {goal.name}
                    </h3>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                      <Calendar size={10} className="inline mr-1 align-middle" />
                      {new Date(goal.target_date).toLocaleDateString('pt-PT')} · {daysLeft > 0 ? `${daysLeft} ${t.dashboard.goals.daysRemaining}` : t.dashboard.goals.dateReached}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button type="button" onClick={() => openEdit(goal)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" aria-label="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button type="button" onClick={() => handleDeleteClick(goal.id)} className="p-1.5 hover:bg-red-500/15 rounded-lg text-slate-400 hover:text-red-400 transition-colors" aria-label="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Row 2: amounts + progress bar */}
                <div className="flex-1 min-h-0 flex flex-col gap-2.5 mt-1">
                  <div className="flex justify-between items-baseline gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.goals.accumulated}</p>
                      <p className="text-base font-bold text-white tabular-nums truncate">{formatCurrency(currentAmountEuros)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.goals.target}</p>
                      <p className="text-sm font-bold text-slate-400 tabular-nums">{formatCurrency(targetAmountEuros)}</p>
                    </div>
                  </div>

                  {/* Flat bar as secondary indicator */}
                  <div className="h-2 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: goal.color_hex }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span style={{ color: goal.color_hex }}>{Math.round(progress)}%</span>
                    {canComplete ? (
                      <span className="text-emerald-400">{formatCurrency(currentAmountEuros - targetAmountEuros)} {t.dashboard.goals.exceeded || 'EXCEDIDO'}</span>
                    ) : (
                      <span className="text-slate-500">{formatCurrency(targetAmountEuros - currentAmountEuros)} {t.dashboard.goals.remaining}</span>
                    )}
                  </div>
                </div>

                {/* Row 3: action buttons */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700/60 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setGoalForDeposit(goal); setDepositAmount(''); }}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span>{t.dashboard.goals?.addMoney ?? 'Adicionar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGoalToClose(goal); setShowCloseConfirm(true); }}
                    className="py-2.5 px-3 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center cursor-pointer"
                  >
                    {t.dashboard.goals?.finishGoal ?? 'Terminar meta'}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* ═══ Empty State ═══ */}
        {goals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full py-20 sm:py-32 text-center space-y-6 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-dashed border-slate-700/60"
          >
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              <div className="relative w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-blue-400">
                <Target size={40} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.emptyMap}</p>
              <p className="text-slate-500 font-medium max-w-md mx-auto">
                {t.dashboard.goals.startByDefining ?? 'Comeca por definir um objetivo e dar o primeiro passo.'}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Plus size={18} />
              {t.dashboard.goals.createFirstGoal ?? 'Criar Primeira Meta'}
            </button>
          </motion.div>
        )}
      </div>

      {/* ═══ Insights Section ═══ */}
      {goals.length >= 2 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">

          {/* ── Card 1: Goal Progress Leaderboard ── */}
          <div className="lg:col-span-2 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl">
            <div className="mb-5 sm:mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.dashboard.goals.chartTopLabel}</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.chartTopTitle}</h3>
            </div>
            <div className="space-y-4">
              {goalsForChart.map((g, i) => {
                const GoalIcon = ICONS.find(ic => ic.name === g.icon)?.icon || Target;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="group/bar"
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${g.color}20`, color: g.color }}
                      >
                        <GoalIcon size={14} />
                      </div>
                      <span className="text-xs font-bold text-white uppercase tracking-tight truncate flex-1">{g.name}</span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: g.color }}>{Math.round(g.progress)}%</span>
                      <span className="text-[10px] font-bold text-slate-500 tabular-nums">{formatCurrency(g.current)} / {formatCurrency(g.target)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${g.progress}%` }}
                        transition={{ duration: 0.9, delay: i * 0.07, ease: 'easeOut' }}
                        className="h-full rounded-full relative"
                        style={{
                          background: `linear-gradient(90deg, ${g.color}, ${g.color}cc)`,
                          boxShadow: `0 0 12px ${g.color}40`,
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Card 2: Type Donut + Zen Tip ── */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl flex flex-col">
            {/* Custom SVG donut */}
            <div className="mb-5 sm:mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.dashboard.goals.chartTypesLabel}</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.chartTypesTitle}</h3>
            </div>
            <div className="flex items-center justify-center mb-5">
              <div className="relative" style={{ width: 140, height: 140 }}>
                <svg width={140} height={140} viewBox="0 0 140 140">
                  <defs>
                    <linearGradient id="donutExpense" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#818CF8" />
                    </linearGradient>
                    <linearGradient id="donutIncome" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                  </defs>
                  {/* Background track */}
                  <circle cx={70} cy={70} r={55} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={16} />
                  {/* Expense arc */}
                  {typeBreakdown.expenseCount > 0 && (
                    <motion.circle
                      cx={70} cy={70} r={55}
                      fill="none" stroke="url(#donutExpense)" strokeWidth={16}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 55}
                      initial={{ strokeDashoffset: 2 * Math.PI * 55 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 55 * (1 - typeBreakdown.expenseCount / typeBreakdown.total) }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
                    />
                  )}
                  {/* Income arc */}
                  {typeBreakdown.incomeCount > 0 && (
                    <motion.circle
                      cx={70} cy={70} r={55}
                      fill="none" stroke="url(#donutIncome)" strokeWidth={16}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 55}
                      initial={{ strokeDashoffset: 2 * Math.PI * 55 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 55 * (1 - typeBreakdown.incomeCount / typeBreakdown.total) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
                      style={{
                        transform: `rotate(${-90 + (typeBreakdown.expenseCount / typeBreakdown.total) * 360}deg)`,
                        transformOrigin: '70px 70px',
                      }}
                    />
                  )}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white">{goals.length}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.goals.totalGoals ?? 'metas'}</span>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-indigo-400" />
                <span className="text-xs font-bold text-slate-400">{t.dashboard.goals.typeExpense} ({typeBreakdown.expenseCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-300" />
                <span className="text-xs font-bold text-slate-400">{t.dashboard.goals.typeIncome} ({typeBreakdown.incomeCount})</span>
              </div>
            </div>

            {/* Zen Tip below */}
            <div className="mt-auto pt-5 border-t border-slate-700/40">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Zen Tip</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed italic">
                &ldquo;{t.dashboard.goals.zenTip ?? 'Dividir grandes objetivos em metas menores torna tudo mais alcancavel. Celebra cada conquista.'}&rdquo;
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mt-4">
                <span className="text-slate-500">{t.dashboard.goals.completed ?? 'Concluido'}</span>
                <span className="text-emerald-400">{stats.completedCount} / {goals.length}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/40 mt-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goals.length > 0 ? (stats.completedCount / goals.length) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Zen tip when only 1 goal */}
      {goals.length === 1 && (
        <section className="min-w-0">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 shadow-2xl flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles size={18} />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed italic">
              &ldquo;{t.dashboard.goals.zenTip ?? 'Dividir grandes objetivos em metas menores torna tudo mais alcancavel. Celebra cada conquista.'}&rdquo;
            </p>
          </div>
        </section>
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
                  className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
    </div>
  );
}
