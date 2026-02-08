'use client';

import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  Landmark, Plus, Minus, TrendingUp, TrendingDown, Wallet,
  ShieldCheck, Target, ArrowUpRight, ArrowDownRight, X, Calendar
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { ChartSkeleton } from '@/components/LoadingSkeleton';
import AlertModal from '@/components/AlertModal';
import PageLoading from '@/components/PageLoading';
import Toast from '@/components/Toast';

export default function VaultPage() {
  const { t, formatCurrency } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vaultModal, setVaultModal] = useState<{ open: boolean; category: any; action: 'add' | 'withdraw' } | null>(null);
  const [vaultAmount, setVaultAmount] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '30D' | '12M' | 'Tudo'>('Tudo');
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    fetchData();
  }, []);

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
      
      const allTransactions = transRes.data.filter((t: any) => Math.abs(t.amount_cents) !== 1);
      setTransactions(allTransactions);
      setCategories(catRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVaultTransaction = async () => {
    if (!vaultModal || !vaultAmount || parseFloat(vaultAmount) <= 0) {
      return;
    }

    setVaultLoading(true);
    try {
      const category = vaultModal.category;
      const amount_cents = Math.round(parseFloat(vaultAmount) * 100);
      // Se é adicionar: amount positivo (depósito/poupança)
      // Se é retirar: amount negativo (resgate/despesa)
      const finalAmount = vaultModal.action === 'add' ? Math.abs(amount_cents) : -Math.abs(amount_cents);

      // Verificar saldo se for resgate
      if (vaultModal.action === 'withdraw') {
        const vaultTransactions = transactions.filter((t: any) => {
          const cat = categories.find((c: any) => c.id === t.category_id);
          return cat && cat.id === category.id;
        });
        
        // Calcular saldo atual: depósitos (positivos) aumentam, resgates (negativos) diminuem
        const currentBalance = vaultTransactions.reduce((balance: number, t: any) => {
          if (t.amount_cents > 0) {
            // Depósito: adicionar valor
            return balance + t.amount_cents;
          } else {
            // Resgate: subtrair valor absoluto
            return balance - Math.abs(t.amount_cents);
          }
        }, 0);
        
        const balanceAfterWithdrawal = currentBalance - amount_cents;
        
        if (amount_cents > currentBalance || balanceAfterWithdrawal < 0) {
          const available = (currentBalance / 100).toFixed(2);
          setAlertModal({
            isOpen: true,
            title: t.dashboard.vault.insufficientBalanceTitle,
            message: `${t.dashboard.vault.insufficientBalance}\n\n${t.dashboard.vault.available} ${formatCurrency(parseFloat(available))}\n${t.dashboard.vault.attempt} ${formatCurrency(parseFloat(vaultAmount))}\n\n${t.dashboard.vault.cannotBeNegative}`,
            type: 'error'
          });
          setVaultLoading(false);
          return;
        }
      }

      const payload = {
        amount_cents: finalAmount,
        description: vaultModal.action === 'add' ? `${t.dashboard.vault.depositIn} ${category.name}` : `${t.dashboard.vault.withdrawalFrom} ${category.name}`,
        category_id: category.id,
        transaction_date: new Date().toISOString().split('T')[0],
        is_installment: false
      };

      await api.post('/transactions/', payload);
      const successMessage = vaultModal.action === 'add' 
        ? `${t.dashboard.vault.depositIn} ${category.name} - ${formatCurrency(parseFloat(vaultAmount))}`
        : `${t.dashboard.vault.withdrawalFrom} ${category.name} - ${formatCurrency(parseFloat(vaultAmount))}`;
      setToast({ 
        message: successMessage, 
        type: 'success', 
        isVisible: true 
      });
      setVaultModal(null);
      setVaultAmount('');
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao processar transação do cofre:', err);
      const errorMessage = err.response?.data?.detail || 'Erro ao processar transação.';
      setToast({
        message: errorMessage,
        type: 'error',
        isVisible: true
      });
    } finally {
      setVaultLoading(false);
    }
  };

  // Função para agrupar dados por período (um ponto por dia/semana/mês = saldo no fim do período)
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

    // Manter sempre o último valor do período (saldo após a última transação do dia/semana/mês)
    const keepLastInGroup = (grouped: Record<string, { date: string; value: number }>) => {
      return Object.values(grouped).sort((a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    };

    // Por dia (7D ou Tudo com muitos dias)
    if (period === '7D' || period === 'Tudo') {
      const grouped: Record<string, { date: string; value: number }> = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        grouped[dayKey] = { date: item.date, value: item.value };
      });
      return keepLastInGroup(grouped);
    }

    // Por semana (30D)
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

    // Por mês (12M)
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

  // Processar dados dos cofres
  const vaultData = useMemo(() => {
    const emergencyCategory = categories.find((c: any) => c.vault_type === 'emergency');
    const investmentCategory = categories.find((c: any) => c.vault_type === 'investment');

    let emergencyTotal = 0;
    let investmentTotal = 0;
    const emergencyTransactions: any[] = [];
    const investmentTransactions: any[] = [];
    const emergencyEvolution: any[] = [];
    const investmentEvolution: any[] = [];

    // Calcular totais e evolução
    const sortedTransactions = [...transactions].sort((a: any, b: any) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    let emergencyRunning = 0;
    let investmentRunning = 0;

    // Adicionar ponto inicial (0) se houver transações
    const firstEmergencyDate = sortedTransactions.find((t: any) => {
      const cat = categories.find((c: any) => c.id === t.category_id);
      return cat?.vault_type === 'emergency';
    })?.transaction_date;

    const firstInvestmentDate = sortedTransactions.find((t: any) => {
      const cat = categories.find((c: any) => c.id === t.category_id);
      return cat?.vault_type === 'investment';
    })?.transaction_date;

    if (firstEmergencyDate) {
      emergencyEvolution.push({
        date: firstEmergencyDate,
        value: 0
      });
    }

    if (firstInvestmentDate) {
      investmentEvolution.push({
        date: firstInvestmentDate,
        value: 0
      });
    }

    sortedTransactions.forEach((t: any) => {
      const cat = categories.find((c: any) => c.id === t.category_id);
      
      if (cat?.vault_type === 'emergency') {
        if (t.amount_cents > 0) {
          // Depósito: positivo aumenta o vault
          emergencyTotal += t.amount_cents / 100;
          emergencyRunning += t.amount_cents / 100;
        } else {
          // Resgate: negativo diminui o vault
          emergencyTotal -= Math.abs(t.amount_cents / 100);
          emergencyRunning -= Math.abs(t.amount_cents / 100);
        }
        emergencyTransactions.push({ ...t, category: cat });
        emergencyEvolution.push({
          date: t.transaction_date,
          value: emergencyRunning
        });
      }
      
      if (cat?.vault_type === 'investment') {
        if (t.amount_cents > 0) {
          // Depósito: positivo aumenta o vault
          investmentTotal += t.amount_cents / 100;
          investmentRunning += t.amount_cents / 100;
        } else {
          // Resgate: negativo diminui o vault
          investmentTotal -= Math.abs(t.amount_cents / 100);
          investmentRunning -= Math.abs(t.amount_cents / 100);
        }
        investmentTransactions.push({ ...t, category: cat });
        investmentEvolution.push({
          date: t.transaction_date,
          value: investmentRunning
        });
      }
    });

    // Agrupar por mês para gráficos
    const emergencyMonthly: any = {};
    const investmentMonthly: any = {};

    emergencyTransactions.forEach((t: any) => {
      const month = new Date(t.transaction_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      if (!emergencyMonthly[month]) {
        emergencyMonthly[month] = { month, deposits: 0, withdrawals: 0 };
      }
      if (t.amount_cents > 0) {
        emergencyMonthly[month].deposits += t.amount_cents / 100;
      } else {
        emergencyMonthly[month].withdrawals += Math.abs(t.amount_cents / 100);
      }
    });

    investmentTransactions.forEach((t: any) => {
      const month = new Date(t.transaction_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      if (!investmentMonthly[month]) {
        investmentMonthly[month] = { month, deposits: 0, withdrawals: 0 };
      }
      if (t.amount_cents > 0) {
        investmentMonthly[month].deposits += t.amount_cents / 100;
      } else {
        investmentMonthly[month].withdrawals += Math.abs(t.amount_cents / 100);
      }
    });

    return {
      emergencyCategory,
      investmentCategory,
      emergencyTotal,
      investmentTotal,
      emergencyTransactions: emergencyTransactions.sort((a: any, b: any) => 
        new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()
      ),
      investmentTransactions: investmentTransactions.sort((a: any, b: any) => 
        new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime()
      ),
      emergencyEvolution: groupByPeriod(
        emergencyEvolution.sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        selectedPeriod
      ),
      investmentEvolution: groupByPeriod(
        investmentEvolution.sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        selectedPeriod
      ),
      emergencyMonthly: Object.values(emergencyMonthly),
      investmentMonthly: Object.values(investmentMonthly)
    };
  }, [transactions, categories, selectedPeriod]);

  if (loading) {
    return <PageLoading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-white pb-20"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 md:mb-12">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
            <Landmark size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white truncate">{t.dashboard.vault.title}</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{t.dashboard.vault.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Vault Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
        {/* Fundo de Emergência */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          className="bg-slate-900/70 backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1 sm:mb-2">{t.dashboard.vault.emergencyFund}</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate" title={formatCurrency(vaultData.emergencyTotal)}>{formatCurrency(vaultData.emergencyTotal)}</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck size={24} className="sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden mb-4 sm:mb-6">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (vaultData.emergencyTotal / 10000) * 100)}%` }}
              />
            </div>

            {vaultData.emergencyCategory && (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'add' })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl transition-all group/btn cursor-pointer"
                >
                  <Plus size={16} className="text-blue-400 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest text-blue-400">{t.dashboard.vault.add}</span>
                </button>
                <button
                  onClick={() => setVaultModal({ open: true, category: vaultData.emergencyCategory, action: 'withdraw' })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all group/btn cursor-pointer"
                >
                  <Minus size={16} className="text-red-400 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Investimentos Zen */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="bg-slate-900/70 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1 sm:mb-2">{t.dashboard.vault.zenInvestments}</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-400 truncate" title={formatCurrency(vaultData.investmentTotal)}>{formatCurrency(vaultData.investmentTotal)}</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <Target size={24} className="sm:w-7 sm:h-7 md:w-8 md:h-8 text-emerald-400" />
              </div>
            </div>
            
            <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden mb-4 sm:mb-6">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (vaultData.investmentTotal / 10000) * 100)}%` }}
              />
            </div>

            {vaultData.investmentCategory && (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'add' })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl transition-all group/btn cursor-pointer"
                >
                  <Plus size={16} className="text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-400">{t.dashboard.vault.add}</span>
                </button>
                <button
                  onClick={() => setVaultModal({ open: true, category: vaultData.investmentCategory, action: 'withdraw' })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all group/btn cursor-pointer"
                >
                  <Minus size={16} className="text-red-400 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest text-red-400">{t.dashboard.vault.withdraw}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Período</span>
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
              className={`px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border shrink-0 ${
                selectedPeriod === period.key
                  ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* Evolução Fundo de Emergência */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <ShieldCheck className="text-blue-400 shrink-0" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionEmergency}</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={vaultData.emergencyEvolution.length > 0 ? vaultData.emergencyEvolution : [{ date: new Date().toISOString().split('T')[0], value: 0 }]}>
              <defs>
                <linearGradient id="colorEmergency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  const d = new Date(value);
                  if (selectedPeriod === '12M') {
                    return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
                  }
                  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`;
                  if (value <= -1000) return `-${(Math.abs(value) / 1000).toFixed(1)}k€`;
                  return `${value.toFixed(0)}€`;
                }}
                domain={[
                  (dataMin: number) => Math.floor(Math.min(0, dataMin) * 1.05),
                  (dataMax: number) => Math.ceil(Math.max(0, dataMax) * 1.05)
                ]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '12px'
                }}
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    const val = typeof data.value === 'number' ? data.value : 0;
                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(val)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorEmergency)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Evolução Investimentos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Target className="text-emerald-400" size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.evolutionInvestments}</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={vaultData.investmentEvolution.length > 0 ? vaultData.investmentEvolution : [{ date: new Date().toISOString().split('T')[0], value: 0 }]}>
              <defs>
                <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  const d = new Date(value);
                  if (selectedPeriod === '12M') {
                    return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
                  }
                  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`;
                  if (value <= -1000) return `-${(Math.abs(value) / 1000).toFixed(1)}k€`;
                  return `${value.toFixed(0)}€`;
                }}
                domain={[
                  (dataMin: number) => Math.floor(Math.min(0, dataMin) * 1.05),
                  (dataMax: number) => Math.ceil(Math.max(0, dataMax) * 1.05)
                ]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '12px'
                }}
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    const val = typeof data.value === 'number' ? data.value : 0;
                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(val)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorInvestment)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Monthly Activity Charts - Novo Design */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* Fundo de Emergência - Atividade Mensal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-blue-400" size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">{t.dashboard.vault.emergencyFund}</span>
          </div>
          
          {vaultData.emergencyMonthly.length > 0 ? (
            <div className="space-y-4">
              {vaultData.emergencyMonthly.slice(-6).reverse().map((month: any, idx: number) => {
                const total = month.deposits + month.withdrawals;
                const depositPercent = total > 0 ? (month.deposits / total) * 100 : 0;
                const withdrawalPercent = total > 0 ? (month.withdrawals / total) * 100 : 0;
                const net = month.deposits - month.withdrawals;
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{month.month}</span>
                      <div className="flex items-center gap-3">
                        {month.deposits > 0 && (
                          <span className="text-[10px] font-black text-blue-400">
                            +{formatCurrency(month.deposits)}
                          </span>
                        )}
                        {month.withdrawals > 0 && (
                          <span className="text-[10px] font-black text-red-400">
                            -{formatCurrency(month.withdrawals)}
                          </span>
                        )}
                        <span className={`text-xs font-black ${
                          net >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {net >= 0 ? '+' : ''}{formatCurrency(net)}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-8 bg-slate-800/60 rounded-xl overflow-hidden">
                      {depositPercent > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${depositPercent}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600"
                        />
                      )}
                      {withdrawalPercent > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${withdrawalPercent}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-500 to-red-600"
                        />
                      )}
                      {total === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[8px] font-black text-slate-600 uppercase">Sem atividade</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-xs text-slate-500 italic">Sem atividade mensal ainda</p>
            </div>
          )}
        </motion.div>

        {/* Investimentos - Atividade Mensal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <Target className="text-emerald-400" size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{t.dashboard.vault.investments}</span>
          </div>
          
          {vaultData.investmentMonthly.length > 0 ? (
            <div className="space-y-4">
              {vaultData.investmentMonthly.slice(-6).reverse().map((month: any, idx: number) => {
                const total = month.deposits + month.withdrawals;
                const depositPercent = total > 0 ? (month.deposits / total) * 100 : 0;
                const withdrawalPercent = total > 0 ? (month.withdrawals / total) * 100 : 0;
                const net = month.deposits - month.withdrawals;
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{month.month}</span>
                      <div className="flex items-center gap-3">
                        {month.deposits > 0 && (
                          <span className="text-[10px] font-black text-emerald-400">
                            +{formatCurrency(month.deposits)}
                          </span>
                        )}
                        {month.withdrawals > 0 && (
                          <span className="text-[10px] font-black text-red-400">
                            -{formatCurrency(month.withdrawals)}
                          </span>
                        )}
                        <span className={`text-xs font-black ${
                          net >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {net >= 0 ? '+' : ''}{formatCurrency(net)}
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-8 bg-slate-800/60 rounded-xl overflow-hidden">
                      {depositPercent > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${depositPercent}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                        />
                      )}
                      {withdrawalPercent > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${withdrawalPercent}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-500 to-red-600"
                        />
                      )}
                      {total === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[8px] font-black text-slate-600 uppercase">Sem atividade</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-xs text-slate-500 italic">Sem atividade mensal ainda</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Transactions History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fundo de Emergência Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <ShieldCheck className="text-blue-400" size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.transactionsEmergency}</h3>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {vaultData.emergencyTransactions.length > 0 ? (
              vaultData.emergencyTransactions.map((t: any, idx: number) => (
                <motion.div
                  key={t.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-slate-700/40 hover:border-slate-600/60 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      t.amount_cents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {t.amount_cents > 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{t.description || t.dashboard.vault.noDescription}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                        {new Date(t.transaction_date || t.created_at).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${
                    t.amount_cents > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {t.amount_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount_cents) / 100)}
                  </span>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-slate-500 text-xs italic py-10">{t.dashboard.vault.noTransactions}</p>
            )}
          </div>
        </motion.div>

        {/* Investimentos Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Target className="text-emerald-400" size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.vault.transactionsInvestments}</h3>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {vaultData.investmentTransactions.length > 0 ? (
              vaultData.investmentTransactions.map((t: any, idx: number) => (
                <motion.div
                  key={t.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-slate-700/40 hover:border-slate-600/60 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      t.amount_cents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {t.amount_cents > 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{t.description || t.dashboard.vault.noDescription}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                        {new Date(t.transaction_date || t.created_at).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${
                    t.amount_cents > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {t.amount_cents > 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount_cents) / 100)}
                  </span>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-slate-500 text-xs italic py-10">{t.dashboard.vault.noTransactions}</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Vault Transaction Modal — sem animação no mobile para evitar lag */}
      {(reduceMotion || isMobile) ? (
        vaultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              role="presentation"
              onClick={() => !vaultLoading && setVaultModal(null)}
              className="absolute inset-0 bg-black/70"
            />
            <div
              role="dialog"
              aria-modal
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-900/95 border border-slate-700/60 rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    vaultModal.action === 'add' 
                      ? vaultModal.category.vault_type === 'emergency' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {vaultModal.action === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">
                      {vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{vaultModal.category.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer shrink-0 -m-2"
                  disabled={vaultLoading}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.vault.value}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={vaultAmount}
                    onChange={(e) => setVaultAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    disabled={vaultLoading}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !vaultLoading && vaultAmount && parseFloat(vaultAmount) > 0) {
                        handleVaultTransaction();
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }}
                    disabled={vaultLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t.dashboard.vault.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleVaultTransaction}
                    disabled={vaultLoading || !vaultAmount || parseFloat(vaultAmount) <= 0}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                      vaultModal.action === 'add'
                        ? vaultModal.category.vault_type === 'emergency'
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !vaultLoading && setVaultModal(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    vaultModal.action === 'add' 
                      ? vaultModal.category.vault_type === 'emergency' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {vaultModal.action === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider truncate">
                      {vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{vaultModal.category.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer shrink-0 -m-2"
                  disabled={vaultLoading}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.vault.value}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={vaultAmount}
                    onChange={(e) => setVaultAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 sm:py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    disabled={vaultLoading}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !vaultLoading && vaultAmount && parseFloat(vaultAmount) > 0) {
                        handleVaultTransaction();
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { if (!vaultLoading) { setVaultModal(null); setVaultAmount(''); } }}
                    disabled={vaultLoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-wider hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t.dashboard.vault.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleVaultTransaction}
                    disabled={vaultLoading || !vaultAmount || parseFloat(vaultAmount) <= 0}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                      vaultModal.action === 'add'
                        ? vaultModal.category.vault_type === 'emergency'
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {vaultLoading ? t.dashboard.vault.processing : vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </motion.div>
  );
}

