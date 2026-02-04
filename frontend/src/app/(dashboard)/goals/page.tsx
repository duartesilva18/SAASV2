'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Plus, Trash2, Edit2, X, Check, 
  Calendar, Trophy, TrendingUp, Sparkles,
  ArrowRight, Heart, Star, Zap, Plane, Car, Home, Wallet, ChevronDown
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import PageLoading from '@/components/PageLoading';

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

export default function GoalsPage() {
  const { t, formatCurrency } = useTranslation();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowNotifications] = useState(false);
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
  const [categories, setCategories] = useState<any[]>([]);
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

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchCategories();
  }, []);

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
      // Converter valores de euros para cêntimos antes de enviar ao backend
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
      setShowNotifications(false);
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
      target_amount_cents: goal.target_amount_cents / 100, // Converter de cêntimos para euros
      target_date: goal.target_date,
      icon: goal.icon,
      color_hex: goal.color_hex
    });
    setShowNotifications(true);
  };

  if (loading) {
    return <PageLoading message={t.dashboard.goals.loading} />;
  }

  const goalsByType = [
    { name: t.dashboard.goals.typeExpense, value: goals.filter(g => g.goal_type !== 'income').length, color: '#3B82F6' },
    { name: t.dashboard.goals.typeIncome, value: goals.filter(g => g.goal_type === 'income').length, color: '#10B981' }
  ];

  const topGoalsByValue = [...goals]
    .sort((a, b) => b.target_amount_cents - a.target_amount_cents)
    .slice(0, 5)
    .map(goal => ({
      name: goal.name,
      value: Math.round(goal.target_amount_cents / 100)
    }));

  return (
    <div className="w-full max-w-none min-w-0 space-y-8 sm:space-y-12 pb-20 px-4 sm:px-6 md:px-10 xl:px-14">
      {/* Header */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <Trophy size={14} /> {t.dashboard.goals.badge}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter text-white uppercase leading-tight break-words">
              {t.dashboard.goals.title.split(' ').slice(0, -1).join(' ')} <span className="text-blue-500 italic">{t.dashboard.goals.title.split(' ').slice(-1)[0]}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl italic text-sm sm:text-base md:text-lg">
              "{t.dashboard.goals.subtitle}" - {t.dashboard.goals.subtitleQuote}
            </p>
          </div>

          <button 
            onClick={() => {
              setEditingGoal(null);
              setFormData({
                name: '',
                goal_type: 'expense',
                target_amount_cents: 0,
                target_date: getTomorrowDate(),
                icon: 'Target',
                color_hex: '#3B82F6'
              });
              setShowNotifications(true);
            }}
            className="group flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            {t.dashboard.goals.newGoal} <Plus size={18} />
          </button>
        </div>
      </section>

      {/* Grid de Metas — cards iguais, responsivo: 1→2→3→4 colunas conforme ecrã */}
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
              className="group relative flex flex-col min-h-[320px] w-full bg-gradient-to-b from-slate-900/70 to-slate-950/80 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all hover:shadow-lg hover:shadow-blue-500/5"
            >
              {/* Blur decorativo */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full -mr-12 -mt-12 pointer-events-none" aria-hidden />

              <div className="relative z-10 flex flex-col flex-1 min-h-0 p-4 md:p-5">
                {/* Linha 1: ícone + badge + ações */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${goal.color_hex}25`, color: goal.color_hex }}
                    >
                      <Icon size={20} />
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        goal.goal_type === 'income'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                          : 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                      }`}
                    >
                      {goal.goal_type === 'income' ? t.dashboard.goals.typeIncome : t.dashboard.goals.typeExpense}
                    </span>
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

                {/* Nome + data */}
                <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate mb-0.5" title={goal.name}>
                  {goal.name}
                </h3>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 flex-shrink-0">
                  <Calendar size={10} className="inline mr-1 align-middle" />
                  {new Date(goal.target_date).toLocaleDateString('pt-PT')} · {daysLeft > 0 ? `${daysLeft} ${t.dashboard.goals.daysRemaining}` : t.dashboard.goals.dateReached}
                </p>

                {/* Valores + barra — ocupa espaço intermédio */}
                <div className="flex-1 min-h-0 flex flex-col gap-3">
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

                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full rounded-full transition-all duration-700"
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

                {/* Botões sempre no fundo, 2 colunas iguais */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setGoalForDeposit(goal); setDepositAmount(''); }}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span>{t.dashboard.goals?.addMoney ?? 'Adicionar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGoalToClose(goal); setShowCloseConfirm(true); }}
                    className="py-2.5 px-3 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center"
                  >
                    {t.dashboard.goals?.finishGoal ?? 'Terminar meta'}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-full py-32 text-center space-y-6 bg-slate-900/20 rounded-[64px] border border-dashed border-white/5">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-700">
              <Target size={40} />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.emptyMap}</p>
              <p className="text-slate-500 font-medium">{t.dashboard.goals.emptyMapSubtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* Insights de Metas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-10 md:mt-12 sm:mt-0 min-w-0">
        <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/70 border border-white/5 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.goals.chartTypesLabel}</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.chartTypesTitle}</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={goalsByType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {goalsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`${value}`, t.dashboard.goals.chartCount]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {goalsByType.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/70 border border-white/5 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.goals.chartTopLabel}</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.chartTopTitle}</h3>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topGoalsByValue} layout="vertical" margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="goalsBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 12)}…` : value}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), t.dashboard.goals.target]}
                  cursor={{ fill: 'rgba(37,99,235,0.08)' }}
                  contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="value" fill="url(#goalsBar)" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Modal Nova/Editar Meta */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl max-h-[90dvh] sm:max-h-[90vh] bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-white/10 rounded-t-2xl sm:rounded-2xl sm:rounded-[28px] p-4 sm:p-8 md:p-10 shadow-[0_25px_80px_-40px_rgba(59,130,246,0.35)] overflow-y-auto overflow-x-hidden flex flex-col min-h-0"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
              
              <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-tight">
                    {editingGoal ? t.dashboard.goals.edit : t.dashboard.goals.new} <span className="text-blue-500 italic">{t.dashboard.goals.goal}</span>
                  </h2>
                  <p className="text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-1 sm:mt-2">{t.dashboard.goals.drawYourFuture}</p>
                </div>
                <button onClick={() => setShowNotifications(false)} className="p-2 sm:p-3 hover:bg-white/10 rounded-full text-slate-400 transition-colors cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2">
                  <X size={22} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="required-label text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.goalName}</label>
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      className={`w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-sm sm:text-base text-white font-black uppercase tracking-widest focus:border-blue-500 focus:bg-white/10 outline-none transition-all placeholder:text-slate-700 min-h-[48px] ${errors.name ? 'field-error' : ''}`}
                      placeholder={t.dashboard.goals.goalNamePlaceholder}
                    />
                    {errors.name && <p className="field-error-message">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="required-label text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.targetAmount}</label>
                    <div className="relative">
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
                        className={`w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-5 pr-10 sm:pr-12 text-sm sm:text-base text-white font-black focus:border-blue-500 focus:bg-white/10 outline-none transition-all min-h-[48px] ${errors.amount ? 'field-error' : ''}`}
                        placeholder="0.00"
                      />
                      <span className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-white font-black text-sm sm:text-base">€</span>
                    </div>
                    {errors.amount && <p className="field-error-message">{errors.amount}</p>}
                  </div>

                  <div>
                    <label className="required-label text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.goalType}</label>
                    <div className="relative">
                      <select
                        value={formData.goal_type}
                        onChange={(e) => {
                          setFormData({ ...formData, goal_type: e.target.value });
                          if (errors.type) setErrors(prev => ({ ...prev, type: undefined }));
                        }}
                        className={`goal-type-select w-full appearance-none border border-white/10 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-5 pr-10 sm:pr-12 text-sm sm:text-base text-white font-black focus:border-blue-500 focus:bg-white/10 outline-none transition-all cursor-pointer min-h-[48px] ${errors.type ? 'field-error' : ''} ${
                          formData.goal_type === 'expense' ? 'bg-blue-950/60' : 'bg-white/5'
                        }`}
                      >
                        <option value="expense">{t.dashboard.goals.typeExpense}</option>
                        <option value="income">{t.dashboard.goals.typeIncome}</option>
                      </select>
                      <ChevronDown size={18} className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {errors.type && <p className="field-error-message">{errors.type}</p>}
                  </div>

                  <div>
                    <label className="required-label text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.deadline}</label>
                    <input 
                      type="date"
                      value={formData.target_date}
                      onChange={(e) => {
                        setFormData({ ...formData, target_date: e.target.value });
                        if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
                      }}
                      className={`w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-sm sm:text-base text-white font-black focus:border-blue-500 focus:bg-white/10 outline-none transition-all min-h-[48px] ${errors.date ? 'field-error' : ''}`}
                    />
                    {errors.date && <p className="field-error-message">{errors.date}</p>}
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 mb-2 sm:mb-3 block ml-2">{t.dashboard.goals.color ?? 'Cor'}</label>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {COLORS.map((color) => (
                        <button
                          key={color} type="button"
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
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[22px] font-black uppercase tracking-[0.3em] text-xs transition-all shadow-[0_15px_40px_-20px_rgba(37,99,235,0.6)] active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {editingGoal ? t.dashboard.goals.saveChanges : t.dashboard.goals.activateGoal} <Check size={18} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {showCloseConfirm && goalToClose && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl"
          >
            <h3 className="text-lg font-black text-white mb-1">{t.dashboard.goals?.finishGoal ?? 'Terminar meta'}</h3>
            <p className="text-slate-400 text-sm mb-4">{goalToClose.name} · {formatCurrency((goalToClose.current_amount_cents || 0) / 100)}</p>
            <p className="text-slate-400 text-xs mb-3">{t.dashboard.goals?.closeCreateTransactionQuestion ?? 'Queres criar uma transação automaticamente?'}</p>
            <div className="space-y-2 mb-6">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-blue-500/50">
                <input type="radio" name="closeTx" checked={closeTransactionChoice === 'income'} onChange={() => setCloseTransactionChoice('income')} className="text-blue-500" />
                <span className="text-sm font-bold text-white">{t.dashboard.goals?.asIncome ?? 'Como receita'}</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-blue-500/50">
                <input type="radio" name="closeTx" checked={closeTransactionChoice === 'expense'} onChange={() => setCloseTransactionChoice('expense')} className="text-blue-500" />
                <span className="text-sm font-bold text-white">{t.dashboard.goals?.asExpense ?? 'Como despesa'}</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-blue-500/50">
                <input type="radio" name="closeTx" checked={closeTransactionChoice === 'none'} onChange={() => setCloseTransactionChoice('none')} className="text-blue-500" />
                <span className="text-sm font-bold text-white">{t.dashboard.goals?.noTransaction ?? 'Não criar transação'}</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowCloseConfirm(false); setGoalToClose(null); }} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 font-bold text-sm cursor-pointer">
                {t.dashboard.goals.cancel}
              </button>
              <button type="button" onClick={handleCloseGoal} disabled={!!closingGoal} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm cursor-pointer">
                {closingGoal ? '...' : (t.dashboard.goals?.confirmClose ?? 'Terminar')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {goalForDeposit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl"
          >
            <h3 className="text-lg font-black text-white mb-1">{t.dashboard.goals?.addMoney ?? 'Adicionar à meta'}</h3>
            <p className="text-slate-400 text-sm mb-4">{goalForDeposit.name}</p>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value.replace(',', '.'))}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-bold text-lg mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setGoalForDeposit(null); setDepositAmount(''); }}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 font-bold text-sm cursor-pointer"
              >
                {t.dashboard.goals.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeposit}
                disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {depositLoading ? '...' : (t.dashboard.goals?.addMoney ?? 'Adicionar')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Toast 
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
}

