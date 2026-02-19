'use client';

import { useState, useEffect } from 'react';
// Force HMR update - recharts removed
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/lib/UserContext';
import { 
  Plus, Trash2, Calendar, CreditCard, 
  Sparkles, AlertCircle, CheckCircle2,
  ChevronRight, ArrowRight, Check, TrendingUp,
  Bell, Info, Wallet, PieChart as PieChartIcon,
  Zap, CalendarDays, MousePointer2, ChevronDown,
  Activity, X, ArrowUpCircle, ArrowDownCircle, Tag
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface RecurringTransaction {
  id: string;
  description: string;
  amount_cents: number;
  day_of_month: number;
  category_id?: string;
  is_active: boolean;
  process_automatically: boolean;
}

export default function RecurringPage() {
  const { t, formatCurrency, currency } = useTranslation();
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]); // NEW: Store all categories
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense'); // NEW: Main Tab
  const [errors, setErrors] = useState<Record<string, string>>({}); 
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    day_of_month: 1,
    category_id: '',
    process_automatically: true,
    type: 'expense' as 'income' | 'expense'
  });

  // Função de validação: nome, valor, categoria e dia obrigatórios
  function validate() {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) newErrors.description = t.dashboard.recurring.validation.nameRequired;
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = t.dashboard.recurring.validation.positiveAmount;
    if (!formData.category_id || !String(formData.category_id).trim()) newErrors.category_id = t.dashboard.recurring.validation.categoryRequired;
    if (!formData.day_of_month || formData.day_of_month < 1 || formData.day_of_month > 31) {
      newErrors.day_of_month = t.dashboard.recurring.validation.validDay;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const res = await api.get('/insights/composite');
      const data = res.data;
      setRecurring(data.recurring || []);
      setAllCategories(data.categories || []);
      // As categorias serão filtradas automaticamente pelo useEffect abaixo
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Guardar acesso: apenas utilizadores Pro podem usar /recurring
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/dashboard');
      return;
    }
    if (!isPro) {
      setToastInfo({
        message: t.dashboard?.transactions?.proRequiredMessage
          ?? 'Funcionalidade disponível apenas para utilizadores Pro. Atualiza o teu plano para gerir subscrições.',
        type: 'error',
        isVisible: true,
      });
      const timeout = setTimeout(() => {
        router.replace('/dashboard');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [userLoading, user, isPro, router, t.dashboard]);

  useEffect(() => {
    fetchData();
  }, []);

  // Sincronizar categorias com base no tipo (Receita/Despesa); não auto-selecionar — obrigar a escolher
  useEffect(() => {
    const targetType = editingId ? formData.type : activeTab;
    const filtered = allCategories.filter(c => c.type === targetType);
    setCategories(filtered);
    // Ao mudar de tipo, limpar categoria se a atual não pertencer ao tipo (obrigar a escolher de novo)
    if (formData.category_id && filtered.length > 0 && !filtered.find(c => c.id === formData.category_id)) {
      setFormData(prev => ({ ...prev, category_id: '' }));
    }
  }, [activeTab, allCategories, formData.type, editingId]);

  const handleEditClick = (item: RecurringTransaction) => {
    const cat = allCategories.find(c => c.id === item.category_id);
    const type = cat?.type || 'expense';
    
    setEditingId(item.id);
    setFormData({
      description: item.description,
      amount: (item.amount_cents / 100).toString(),
      day_of_month: item.day_of_month,
      category_id: item.category_id || '',
      process_automatically: true,
      type: type as 'income' | 'expense'
    });
    setActiveTab(type as 'income' | 'expense');
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      const baseAmount = Math.round(parseFloat(formData.amount) * 100);
      const selectedCat = allCategories.find(c => c.id === formData.category_id);
      // Cofre (investimento/emergência): depósito mensal = positivo (adiciona ao cofre)
      // Regulares: despesa = negativo, receita = positivo
      let amount_cents: number;
      if (selectedCat?.vault_type && selectedCat.vault_type !== 'none') {
        amount_cents = Math.abs(baseAmount); // Depósito no cofre sempre positivo
      } else {
        amount_cents = formData.type === 'expense' ? -Math.abs(baseAmount) : Math.abs(baseAmount);
      }
      
      const payload = {
        description: formData.description,
        amount_cents: amount_cents,
        day_of_month: formData.day_of_month,
        category_id: formData.category_id || null,
        process_automatically: true
      };

      let response: { data: any };
      if (editingId) {
        response = await api.patch(`/recurring/${editingId}`, payload);
        setToastInfo({ message: t.dashboard.recurring.cycleUpdated, type: "success", isVisible: true });
        
        // Atualizar item existente no estado sem reload
        setRecurring(prev => prev.map(item => item.id === editingId ? response.data : item));
      } else {
        response = await api.post('/recurring/', payload);
        setToastInfo({ message: t.dashboard.recurring.successMessage, type: "success", isVisible: true });
        
        // Adicionar novo item ao estado sem reload
        setRecurring(prev => [...prev, response.data]);
      }

      setShowAddModal(false);
      setEditingId(null);
      setFormData({ 
        description: '', 
        amount: '', 
        day_of_month: 1, 
        category_id: '', 
        process_automatically: true,
        type: activeTab 
      });
      
      // Atualizar dados em background sem mostrar loading
      fetchData(false).catch(err => console.error('Erro ao atualizar dados em background:', err));
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || t.dashboard.recurring.saveError;
      setToastInfo({ message: errorMessage, type: "error", isVisible: true });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/recurring/${id}`);
      setToastInfo({ message: t.dashboard.recurring.cycleRemoved, type: "success", isVisible: true });
      fetchData();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || t.dashboard.recurring.removeError;
      setToastInfo({ message: errorMessage, type: "error", isVisible: true });
    }
  };

  // Incluir todas as subscrições (regulares + cofre): investimento e fundo de emergência são "despesas" mensais (dinheiro que sai da conta principal)
  const recurringIncomes = recurring.filter(r => {
    const cat = allCategories.find(c => c.id === r.category_id);
    if (!cat) return r.amount_cents > 0;
    return cat.type === 'income';
  });

  const recurringExpenses = recurring.filter(r => {
    const cat = allCategories.find(c => c.id === r.category_id);
    if (!cat) return r.amount_cents < 0;
    return cat.type === 'expense';
  });

  // Receitas: amount_cents deve ser positivo, usar valor absoluto para segurança
  // Despesas: amount_cents pode ser negativo, usar valor absoluto
  const totalIncomes = recurringIncomes.reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents), 0);
  const totalExpenses = recurringExpenses.reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents), 0);
  const netZen = totalIncomes - totalExpenses;

  const now = new Date();
  const today = now.getDate();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filter for the list based on active tab
  const currentList = activeTab === 'expense' ? recurringExpenses : recurringIncomes;
  const sortedByDay = [...currentList].sort((a: any, b: any) => a.day_of_month - b.day_of_month);

  const pendingItems: RecurringTransaction[] = [];

  const weeklyPressure = [
    { name: 'Sem 1', value: Math.abs(currentList.filter(r => r.day_of_month <= 7).reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents) / 100, 0)) },
    { name: 'Sem 2', value: Math.abs(currentList.filter(r => r.day_of_month > 7 && r.day_of_month <= 14).reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents) / 100, 0)) },
    { name: 'Sem 3', value: Math.abs(currentList.filter(r => r.day_of_month > 14 && r.day_of_month <= 21).reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents) / 100, 0)) },
    { name: 'Sem 4', value: Math.abs(currentList.filter(r => r.day_of_month > 21).reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents) / 100, 0)) },
  ];

  // Dados para gráfico de pizza - Proporção Receitas vs Despesas
  const pieData = [
    { name: 'Receitas', value: totalIncomes / 100, color: '#10b981' },
    { name: 'Despesas', value: totalExpenses / 100, color: '#ef4444' }
  ].filter(item => item.value > 0);

  // Dados para gráfico de barras - Distribuição por categoria
  const categoryData: any = {};
  [...recurringIncomes, ...recurringExpenses].forEach((item) => {
    const cat = allCategories.find(c => c.id === item.category_id);
    const categoryName = cat?.name || t.dashboard.recurring.noCategory;
    if (!categoryData[categoryName]) {
      categoryData[categoryName] = 0;
    }
    categoryData[categoryName] += Math.abs(item.amount_cents) / 100;
  });
  const barData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // Top 8 categorias

  const filteredRecurring = currentList.filter(item => {
    if (activeFilter === 'all') return true;
    const alreadyPaid = transactions.some(t =>
      (t.description === item.description || t.description === `(R) ${item.description}`) &&
      Math.abs(t.amount_cents) === Math.abs(item.amount_cents) &&
      new Date(t.transaction_date) >= currentMonthStart
    );
    if (activeFilter === 'paid') return alreadyPaid;
    if (activeFilter === 'pending') return !alreadyPaid;
    return true;
  });

  const nextPaymentInfo = (() => {
    if (currentList.length === 0) return null;
    const nextThisMonth = sortedByDay.find(r => {
      const alreadyPaid = transactions.some(t => 
        t.description === r.description && 
        Math.abs(t.amount_cents) === Math.abs(r.amount_cents) &&
        new Date(t.transaction_date) >= currentMonthStart
      );
      return r.day_of_month >= today && !alreadyPaid;
    });
    if (nextThisMonth) return { day: nextThisMonth.day_of_month, month: now.toLocaleString('pt-PT', { month: 'short' }).replace('.', '') };
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { day: sortedByDay[0]?.day_of_month, month: nextMonthDate.toLocaleString('pt-PT', { month: 'short' }).replace('.', '') };
  })();

  if (loading || userLoading || !user || !isPro) {
    return <PageLoading message="Sincronizando Ciclos..." />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20 px-4 md:px-8">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { height: 0px; background: transparent; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <section className="space-y-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg mb-3">
              <CreditCard size={12} className="text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.recurring.title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white mb-1">
              {t.dashboard.recurring.mySubscriptions}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium italic">{t.dashboard.recurring.subscriptionsAccent}</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ description: '', amount: '', day_of_month: 1, category_id: '', process_automatically: true, type: activeTab });
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} className="shrink-0" />
            <span>{activeTab === 'expense' ? t.dashboard.recurring.addNew : t.dashboard.recurring.newIncome}</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpCircle size={14} className="text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.recurring.fixedIncome}</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums">{formatCurrency(totalIncomes / 100)}</p>
          </div>
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center">
                <ArrowDownCircle size={14} className="text-red-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.recurring.fixedExpenses}</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-red-400 tabular-nums">{formatCurrency(totalExpenses / 100)}</p>
          </div>
          <div className={`backdrop-blur-md border p-4 rounded-2xl shadow-2xl ${netZen >= 0 ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${netZen >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <Sparkles size={14} className={netZen >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.recurring.netZenBalance}</span>
            </div>
            <p className={`text-lg sm:text-xl font-black tabular-nums ${netZen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netZen >= 0 ? '+' : ''}{formatCurrency(netZen / 100)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-900/70 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 flex gap-1">
            <button
              onClick={() => setActiveTab('income')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                activeTab === 'income' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ArrowUpCircle size={14} />
              {t.dashboard.recurring.fixedIncomes}
            </button>
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                activeTab === 'expense' 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ArrowDownCircle size={14} />
              {t.dashboard.recurring.fixedExpenses}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
              <CalendarDays size={14} className="text-blue-400" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Fluxo de Pressão</h2>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5 bg-slate-800/60 border border-slate-700/50 rounded-md">
            {activeTab === 'expense' ? t.dashboard.recurring.fixedExpenses : t.dashboard.recurring.fixedIncomes}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {weeklyPressure.map((week, index) => (
            <div key={index} className="bg-slate-950/50 border border-slate-700/40 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{week.name}</span>
                <span className={`text-sm font-black tabular-nums ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatCurrency(Math.abs(week.value))}
                </span>
              </div>
              <div className="space-y-1.5">
                {currentList
                  .filter(r => {
                    if (index === 0) return r.day_of_month <= 7;
                    if (index === 1) return r.day_of_month > 7 && r.day_of_month <= 14;
                    if (index === 2) return r.day_of_month > 14 && r.day_of_month <= 21;
                    return r.day_of_month > 21;
                  })
                  .map((item) => {
                    const alreadyPaid = transactions.some(t => 
                      t.description === item.description && 
                      Math.abs(t.amount_cents) === Math.abs(item.amount_cents) &&
                      new Date(t.transaction_date) >= currentMonthStart
                    );
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => handleEditClick(item)}
                        className={`p-2.5 border rounded-lg cursor-pointer transition-all ${
                          alreadyPaid
                            ? 'border-slate-700/40 bg-slate-900/40 opacity-60'
                            : activeTab === 'expense'
                              ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                              : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] font-bold text-slate-500">Dia {item.day_of_month}</span>
                          {alreadyPaid && <CheckCircle2 size={10} className="text-emerald-400" />}
                        </div>
                        <p className="text-[10px] font-bold text-white truncate">{item.description}</p>
                        <p className={`text-xs font-black tabular-nums mt-0.5 ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {formatCurrency(Math.abs(item.amount_cents) / 100)}
                        </p>
                      </div>
                    );
                  })}
                {currentList.filter(r => {
                  if (index === 0) return r.day_of_month <= 7;
                  if (index === 1) return r.day_of_month > 7 && r.day_of_month <= 14;
                  if (index === 2) return r.day_of_month > 14 && r.day_of_month <= 21;
                  return r.day_of_month > 21;
                }).length === 0 && (
                  <p className="text-[9px] text-slate-600 italic text-center py-3">Sem subscrições</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos de Análise */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
              <PieChartIcon size={14} className="text-blue-400" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Proporção Mensal</h2>
          </div>
          <div className="h-[250px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: number | undefined) => value === undefined ? '' : formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-600 italic">Sem dados</p></div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[9px] font-bold text-slate-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-400" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Por Categoria</h2>
          </div>
          <div className="h-[250px] w-full">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                  <XAxis type="number" stroke="#475569" fontSize={10} fontWeight="bold" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={9} fontWeight="bold" width={90} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: number | undefined) => value === undefined ? '' : formatCurrency(value)}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-xs text-slate-600 italic">Sem dados</p></div>
            )}
          </div>
        </div>
      </section>

      {/* Subscription Cards */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Zap size={13} className="text-blue-400" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">{activeTab === 'expense' ? t.dashboard.recurring.fixedExpenses : t.dashboard.recurring.fixedIncomes}</h2>
          <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 border border-slate-700/50 rounded-md text-slate-400">{filteredRecurring.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence>
            {filteredRecurring.map((item, i) => {
              const cat = allCategories.find((c: any) => c.id === item.category_id);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleEditClick(item)}
                  className={`group bg-slate-900/70 backdrop-blur-md border rounded-2xl p-4 cursor-pointer transition-all hover:border-blue-500/40 ${
                    activeTab === 'expense' ? 'border-slate-700/60' : 'border-slate-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        activeTab === 'expense' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`} style={cat?.color_hex ? { backgroundColor: `${cat.color_hex}15`, color: cat.color_hex } : {}}>
                        <Zap size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{item.description}</h3>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Dia {item.day_of_month} {item.process_automatically ? '• Auto' : ''}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={(e) => handleDelete(e, item.id)} className="flex items-center gap-1.5 px-2 py-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0 border border-transparent hover:border-red-500/30" aria-label={t.dashboard.recurring.cycleRemoved || 'Eliminar subscrição'}>
                      <Trash2 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Eliminar</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-lg font-black tabular-nums ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {activeTab === 'expense' ? '-' : '+'}{formatCurrency(Math.abs(item.amount_cents) / 100)}
                    </p>
                    {cat && <span className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-800/60 border border-slate-700/40 rounded-md text-slate-400 truncate max-w-[80px]">{cat.name}</span>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-5 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center gap-3 mb-5 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight min-w-0 truncate">{editingId ? t.dashboard.recurring.editSubscription : t.dashboard.recurring.newSubscription} {t.dashboard.recurring.subscriptionLabel}</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'expense'})}
                    className={`py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      formData.type === 'expense' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-950/60 border border-slate-700 text-slate-500'
                    }`}
                  >
                    <ArrowDownCircle size={14} /> Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'income'})}
                    className={`py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      formData.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950/60 border border-slate-700 text-slate-500'
                    }`}
                  >
                    <ArrowUpCircle size={14} /> Receita
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">NOME DE SUBSCRIÇÃO <span className="text-red-500">*</span></label>
                  <motion.div animate={errors.description ? { x: [-2, 2, -2, 2, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input 
                      required 
                      type="text" 
                      value={formData.description} 
                      onChange={e => { setFormData({...formData, description: e.target.value}); if (errors.description) setErrors({...errors, description: ''}); }} 
                      placeholder={t.dashboard.recurring.descriptionPlaceholder} 
                      className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 ${
                        errors.description ? 'border-red-500' : 'border-slate-700'
                      }`} 
                    />
                  </motion.div>
                  {errors.description && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                      <AlertCircle size={10} /> {errors.description}
                    </motion.p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">VALOR <span className="text-red-500">*</span></label>
                    <motion.div animate={errors.amount ? { x: [-2, 2, -2, 2, 0] } : {}} transition={{ duration: 0.4 }}>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={formData.amount} 
                        onChange={e => { setFormData({...formData, amount: e.target.value}); if (errors.amount) setErrors({...errors, amount: ''}); }} 
                        placeholder="0.00" 
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500 ${
                          errors.amount ? 'border-red-500' : 'border-slate-700'
                        }`} 
                      />
                    </motion.div>
                    {errors.amount && (
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.amount}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">DIA <span className="text-red-500">*</span></label>
                    <motion.div animate={errors.day_of_month ? { x: [-2, 2, -2, 2, 0] } : {}} transition={{ duration: 0.4 }}>
                      <input 
                        required 
                        type="number" 
                        min="1" 
                        max="31" 
                        value={formData.day_of_month || ''} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          setFormData({...formData, day_of_month: val});
                          if (errors.day_of_month) setErrors({...errors, day_of_month: ''});
                        }} 
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          errors.day_of_month ? 'border-red-500' : 'border-slate-700'
                        }`} 
                      />
                    </motion.div>
                    {errors.day_of_month && (
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.day_of_month}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">CATEGORIA <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => { setFormData({ ...formData, category_id: e.target.value }); if (errors.category_id) setErrors(prev => ({ ...prev, category_id: '' })); }}
                      className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-8 text-sm text-white appearance-none outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer ${
                        errors.category_id ? 'border-red-500' : 'border-slate-700'
                      }`}
                    >
                      <option value="">{t.dashboard.recurring.selectCategory}</option>
                      {(() => {
                        const vaultCats = categories.filter((c: any) => c.vault_type && c.vault_type !== 'none');
                        const regularCats = categories.filter((c: any) => !c.vault_type || c.vault_type === 'none');
                        const regularLabel = activeTab === 'expense' ? (t.dashboard?.transactions?.filters?.expense ?? 'Despesas') : (t.dashboard?.transactions?.filters?.income ?? 'Receitas');
                        const vaultLabel = t.dashboard?.transactions?.investmentsAndSavings ?? 'Cofre (Investimentos e Poupança)';
                        return (
                          <>
                            {regularCats.length > 0 && (
                              <optgroup label={regularLabel} className="bg-slate-900">
                                {regularCats.map((c: any) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {vaultCats.length > 0 && (
                              <optgroup label={vaultLabel} className="bg-slate-900">
                                {vaultCats.map((c: any) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                  {errors.category_id && (
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><AlertCircle size={10} /> {errors.category_id}</p>
                  )}
                </div>

                <button type="submit" className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer">Guardar</button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingId && (typeof window !== 'undefined' && window.confirm('Eliminar esta subscrição? Esta ação não pode ser desfeita.'))) {
                        handleDelete({ stopPropagation: () => {} } as React.MouseEvent, editingId);
                        setShowAddModal(false);
                        setEditingId(null);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Eliminar subscrição
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast message={toastInfo.message} type={toastInfo.type} isVisible={toastInfo.isVisible} onClose={() => setToastInfo({...toastInfo, isVisible: false})} />
    </motion.div>
  );
}
