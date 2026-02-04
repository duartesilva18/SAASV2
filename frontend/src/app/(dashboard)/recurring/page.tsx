'use client';

import { useState, useEffect } from 'react';
// Force HMR update - recharts removed
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
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

  if (loading) {
    return <PageLoading message="Sincronizando Ciclos..." />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 pb-20 px-4 md:px-8">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { height: 0px; background: transparent; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8 relative z-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full mb-4 sm:mb-6 text-blue-400 text-[10px] font-black uppercase tracking-widest">
              {t.dashboard.recurring.title}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-white leading-tight uppercase">
              {t.dashboard.recurring.mySubscriptions} <span className="text-blue-500 italic">{t.dashboard.recurring.subscriptionsAccent}</span>
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 min-w-0">
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 text-slate-500">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-emerald-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                    <ArrowUpCircle size={18} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{t.dashboard.recurring.fixedIncome}</span>
                </div>
                <p className="text-2xl md:text-4xl font-black text-white tracking-tighter">{formatCurrency(totalIncomes / 100)}</p>
                <div className="mt-auto pt-1.5 md:pt-2 h-0.5 md:h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-emerald-500/50" />
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 text-slate-500">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-red-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-red-500 shrink-0">
                    <ArrowDownCircle size={18} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{t.dashboard.recurring.fixedExpenses}</span>
                </div>
                <p className="text-2xl md:text-4xl font-black text-white tracking-tighter">{formatCurrency(totalExpenses / 100)}</p>
                <div className="mt-auto pt-1.5 md:pt-2 h-0.5 md:h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-red-500/50" />
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-blue-600/10 border border-blue-500/20 p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-[0_20px_50px_rgba(59,130,246,0.15)] relative overflow-hidden group h-full flex flex-col"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full -mr-16 -mt-16 pointer-events-none" />
                <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 text-blue-400">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-500/20 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{t.dashboard.recurring.netZenBalance}</span>
                </div>
                <p className={`text-2xl md:text-4xl font-black tracking-tighter ${netZen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(netZen / 100)}
                </p>
                <div className="mt-auto pt-2 md:pt-3 flex items-center gap-2">
                  <div className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full ${netZen >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {netZen >= 0 ? t.dashboard.recurring.zenEquilibrium : t.dashboard.recurring.criticalAttention}
                  </div>
                </div>
              </motion.div>
            </div>
            
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({ description: '', amount: '', day_of_month: 1, category_id: '', process_automatically: true, type: activeTab });
                setShowAddModal(true);
              }}
              className="self-center sm:self-end shrink-0 flex items-center gap-3 px-6 py-4 md:px-8 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/30 group active:scale-95 cursor-pointer h-fit"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              {activeTab === 'expense' ? t.dashboard.recurring.addNew : t.dashboard.recurring.newIncome}
            </button>
          </div>
        </div>

        {/* Main Selection Tabs */}
        <div className="flex justify-center mt-8 sm:mt-12 overflow-x-auto">
          <div className="bg-slate-900/50 p-2 rounded-xl sm:rounded-[24px] border border-slate-800 flex gap-2 min-w-0 shrink-0">
            <button
              onClick={() => setActiveTab('income')}
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-10 py-3 sm:py-4 rounded-xl sm:rounded-[22px] font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all cursor-pointer shrink-0 ${
                activeTab === 'income' 
                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <ArrowUpCircle size={18} />
              {t.dashboard.recurring.fixedIncomes}
            </button>
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-10 py-3 sm:py-4 rounded-xl sm:rounded-[22px] font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all cursor-pointer shrink-0 ${
                activeTab === 'expense' 
                  ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <ArrowDownCircle size={18} />
              {t.dashboard.recurring.fixedExpenses}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
              <PieChartIcon size={16} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Fluxo de Pressão</h2>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {activeTab === 'expense' ? t.dashboard.recurring.fixedExpenses : t.dashboard.recurring.fixedIncomes}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          {weeklyPressure.map((week, index) => (
            <div key={index} className="bg-slate-950/50 border border-slate-800 rounded-[24px] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{week.name}</span>
                <span className={`text-lg font-black ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatCurrency(Math.abs(week.value))}
                </span>
              </div>
              <div className="space-y-2">
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
                        className={`p-3 bg-white/5 border-2 rounded-xl cursor-pointer transition-all ${
                          activeTab === 'expense'
                            ? alreadyPaid
                              ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'
                              : 'border-red-500 bg-red-500/10 hover:border-red-500/90'
                            : alreadyPaid
                              ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500/70'
                              : 'border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-500/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black text-slate-400">Dia {item.day_of_month}</span>
                          {alreadyPaid && (
                            <CheckCircle2 size={12} className="text-emerald-400" />
                          )}
                        </div>
                        <p className="text-xs font-black text-white uppercase truncate mb-1">{item.description}</p>
                        <p className={`text-sm font-black ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
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
                  <p className="text-[10px] text-slate-600 font-medium italic text-center py-4">Sem subscrições</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos de Análise */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Proporção Receitas vs Despesas */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 lg:p-12">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 md:mb-8">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500/10 rounded-lg sm:rounded-xl flex items-center justify-center text-blue-500 shrink-0">
              <PieChartIcon size={16} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Proporção Mensal</h2>
          </div>
          <div className="h-[300px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '';
                      return formatCurrency(value);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                <p className="text-xs font-black uppercase tracking-widest">Sem dados</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-6">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Categoria */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 lg:p-12">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 md:mb-8">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500/10 rounded-lg sm:rounded-xl flex items-center justify-center text-blue-500 shrink-0">
              <TrendingUp size={16} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Por Categoria</h2>
          </div>
          <div className="h-[300px] w-full">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                  <XAxis type="number" stroke="#475569" fontSize={10} fontWeight="900" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={9} 
                    fontWeight="900"
                    width={100}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '';
                      return formatCurrency(value);
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                <p className="text-xs font-black uppercase tracking-widest">Sem dados</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <AnimatePresence>
          {filteredRecurring.map((item) => (
            <motion.div key={item.id} layout onClick={() => handleEditClick(item)} className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 cursor-pointer hover:border-blue-500/50 transition-all">
              <div className="flex justify-between mb-4 sm:mb-6 md:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
                  <Zap size={20} className="sm:w-6 sm:h-6" />
                </div>
                <button onClick={(e) => handleDelete(e, item.id)} className="p-2 text-slate-700 hover:text-red-500 cursor-pointer">
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-lg font-black text-white uppercase truncate mb-1">{item.description}</h3>
              <p className={`text-2xl font-black mb-4 ${activeTab === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(Math.abs(item.amount_cents) / 100)}</p>
              <span className="text-[10px] font-black uppercase text-slate-600">Dia {item.day_of_month} • Auto</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[32px] p-5 sm:p-8 md:p-12 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between gap-3 mb-6 sm:mb-8 md:mb-10">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white uppercase tracking-tighter min-w-0">{editingId ? t.dashboard.recurring.editSubscription : t.dashboard.recurring.newSubscription} {t.dashboard.recurring.subscriptionLabel}</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-500 cursor-pointer"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* Modal Type Selector */}
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'expense'})}
                    className={`py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer ${
                      formData.type === 'expense' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-950 border border-slate-800 text-slate-600 grayscale'
                    }`}
                  >
                    <ArrowDownCircle size={14} /> Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'income'})}
                    className={`py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer ${
                      formData.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950 border border-slate-800 text-slate-600 grayscale'
                    }`}
                  >
                    <ArrowUpCircle size={14} /> Receita
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">NOME DE SUBSCRIÇÃO <span className="text-red-500">*</span></label>
                  <motion.div
                    animate={errors.description ? { x: [-2, 2, -2, 2, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <input 
                      required 
                      type="text" 
                      value={formData.description} 
                      onChange={e => {
                        setFormData({...formData, description: e.target.value});
                        if (errors.description) setErrors({...errors, description: ''});
                      }} 
                      placeholder={t.dashboard.recurring.descriptionPlaceholder} 
                      className={`w-full bg-slate-950 border rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-white outline-none transition-all cursor-pointer min-h-[48px] ${
                        errors.description ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-slate-800 focus:border-blue-500'
                      }`} 
                    />
                  </motion.div>
                  {errors.description && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold uppercase tracking-widest ml-2 flex items-center gap-1">
                      <AlertCircle size={10} /> {errors.description}
                    </motion.p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 ml-2">VALOR <span className="text-red-500">*</span></label>
                    <motion.div
                      animate={errors.amount ? { x: [-2, 2, -2, 2, 0] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={formData.amount} 
                        onChange={e => {
                          setFormData({...formData, amount: e.target.value});
                          if (errors.amount) setErrors({...errors, amount: ''});
                        }} 
                        placeholder="0.00" 
                        className={`w-full bg-slate-950 border rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-white outline-none transition-all cursor-pointer min-h-[48px] ${
                          errors.amount ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-slate-800 focus:border-blue-500'
                        }`} 
                      />
                    </motion.div>
                    {errors.amount && (
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest ml-2 flex items-center gap-1">
                        <AlertCircle size={10} /> {errors.amount}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 ml-2">DIA <span className="text-red-500">*</span></label>
                    <motion.div
                      animate={errors.day_of_month ? { x: [-2, 2, -2, 2, 0] } : {}}
                      transition={{ duration: 0.4 }}
                    >
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
                        className={`w-full bg-slate-950 border rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-white outline-none transition-all cursor-pointer min-h-[48px] ${
                          errors.day_of_month ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-slate-800 focus:border-blue-500'
                        }`} 
                      />
                    </motion.div>
                    {errors.day_of_month && (
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest ml-2 flex items-center gap-1">
                        <AlertCircle size={10} /> {errors.day_of_month}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 ml-2">CATEGORIA <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <Tag size={18} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => {
                        setFormData({ ...formData, category_id: e.target.value });
                        if (errors.category_id) setErrors(prev => ({ ...prev, category_id: '' }));
                      }}
                      className={`w-full bg-slate-950/50 border rounded-xl sm:rounded-2xl py-4 sm:py-5 pl-12 sm:pl-14 pr-8 sm:pr-10 text-sm sm:text-base text-white appearance-none focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer min-h-[48px] ${
                        errors.category_id ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-slate-800'
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
                    <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                  {errors.category_id && (
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest ml-2 flex items-center gap-1">
                      <AlertCircle size={10} /> {errors.category_id}
                    </p>
                  )}
                </div>

                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all cursor-pointer">Guardar</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast message={toastInfo.message} type={toastInfo.type} isVisible={toastInfo.isVisible} onClose={() => setToastInfo({...toastInfo, isVisible: false})} />
    </motion.div>
  );
}
