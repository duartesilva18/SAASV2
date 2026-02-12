'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, Plus, Trash2, Calculator, Users, 
  Divide, Loader2, Calendar, PieChart as PieIcon, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, 
  Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

interface ProjectExpense {
  id: string;
  description: string;
  amount_cents: number;
  date: string;
  created_at: string;
}

export default function AdminExpensesPage() {
  const { t, formatCurrency } = useTranslation();
  const { user } = useUser();
  const router = useRouter();
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [divideBy, setDivideBy] = useState('');
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await api.get<ProjectExpense[]>('/admin/project-expenses');
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.adminExpenses.loadError, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !user.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchExpenses();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    const value = parseFloat(amount.replace(',', '.'));
    if (!trimmed || isNaN(value) || value <= 0) {
      setToast({ isVisible: true, message: t.dashboard.adminExpenses.descriptionRequired, type: 'error' });
      return;
    }
    const amountCents = Math.round(value * 100);
    setSaving(true);
    try {
      await api.post('/admin/project-expenses', {
        description: trimmed,
        amount_cents: amountCents,
        date: date || new Date().toISOString().split('T')[0],
      });
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setToast({ isVisible: true, message: t.dashboard.adminExpenses.expenseAdded, type: 'success' });
      fetchExpenses();
    } catch (err: any) {
      setToast({ isVisible: true, message: err.response?.data?.detail || t.dashboard.adminExpenses.addError, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/project-expenses/${id}`);
      setDeleteId(null);
      setToast({ isVisible: true, message: t.dashboard.adminExpenses.expenseRemoved, type: 'success' });
      fetchExpenses();
    } catch (err: any) {
      setToast({ isVisible: true, message: err.response?.data?.detail || 'Erro ao remover.', type: 'error' });
    }
  };

  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const totalEur = totalCents / 100;
  const numPeople = parseInt(divideBy, 10) || 0;
  const perPersonEur = numPeople > 0 ? totalEur / numPeople : 0;

  // Dados para gráfico de pizza: por descrição
  const pieData = useMemo(() => {
    const byDesc: Record<string, number> = {};
    expenses.forEach((e) => {
      const key = e.description.trim() || 'Sem descrição';
      byDesc[key] = (byDesc[key] || 0) + e.amount_cents / 100;
    });
    return Object.entries(byDesc).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }));
  }, [expenses]);

  // Dados para gráfico de barras: por mês
  const barData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    expenses.forEach((e) => {
      const month = (e.date || e.created_at || '').slice(0, 7);
      if (month) byMonth[month] = (byMonth[month] || 0) + e.amount_cents / 100;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month: new Date(month + '-01').toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
        valor: value
      }));
  }, [expenses]);

  const te = (t.dashboard as any)?.adminExpenses || {};

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">{te.loading || 'A carregar...'}</p>
      </div>
    );
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
            {te.title || 'Despesas do'} <span className="text-blue-500 italic">{te.titleHighlight || 'Projeto'}</span>
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">
            {te.subtitle || 'Regista despesas de manutenção e projeto. Usa a calculadora para dividir pelo número de pessoas.'}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-2 rounded-2xl">
          <Receipt className="text-blue-500" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{te.internalExpenses || 'Despesas Internas'}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lista e formulário */}
        <div className="space-y-6">
          <form onSubmit={handleAdd} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Plus size={20} className="text-blue-500" />
              Adicionar despesa
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Domínio anual, hosting, ferramentas..."
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.-]/g, ''))}
                  placeholder="0.00"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {saving ? 'A guardar...' : 'Adicionar'}
            </button>
          </form>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            <h2 className="p-4 text-lg font-black text-white uppercase tracking-wider border-b border-slate-800">
              Lista de despesas
            </h2>
            <div className="max-h-[320px] overflow-y-auto">
              {expenses.length === 0 ? (
                <p className="p-8 text-center text-slate-500 font-medium italic">Nenhuma despesa registada.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  <AnimatePresence>
                    {expenses.map((exp) => (
                      <motion.li
                        key={exp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-between gap-4 p-4 hover:bg-slate-800/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-semibold truncate">{exp.description}</p>
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                            <Calendar size={12} />
                            {new Date(exp.date).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                        <span className="text-emerald-400 font-black shrink-0">{formatCurrency(exp.amount_cents / 100)}</span>
                        <button
                          type="button"
                          onClick={() => setDeleteId(exp.id)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                          aria-label="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Calculadora */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-xl border border-blue-500/20 p-8 rounded-[32px] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 text-blue-500/20">
            <Calculator size={100} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <Divide size={24} className="text-blue-400" />
            Calculadora de divisão
          </h2>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total das despesas</p>
              <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(totalEur)}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Dividir por quantas pessoas?
              </label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={divideBy}
                  onChange={(e) => setDivideBy(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 2"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white text-xl font-black placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {numPeople > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 border-t border-slate-700/50"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">
                  Valor por pessoa
                </p>
                <p className="text-3xl font-black text-blue-400 tracking-tighter">
                  {formatCurrency(perPersonEur)}
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  {numPeople} {numPeople === 1 ? 'pessoa' : 'pessoas'} × {formatCurrency(perPersonEur)} ≈ {formatCurrency(totalEur)}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl">
          <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <PieIcon size={22} className="text-blue-500" />
            Distribuição por descrição
          </h2>
          {pieData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-500 italic">Sem dados para o gráfico.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl">
          <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-500" />
            Despesas por mês
          </h2>
          {barData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-500 italic">Sem dados para o gráfico.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Valor']}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="valor" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} activeDot={{ r: 6 }} name="Valor" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Remover despesa"
        message="Tens a certeza que queres remover esta despesa?"
        confirmText="Remover"
        variant="danger"
      />
    </motion.div>
  );
}
