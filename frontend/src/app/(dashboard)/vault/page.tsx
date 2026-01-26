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
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    fetchData();
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
            title: 'Saldo Insuficiente',
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

  // Função para agrupar dados por período
  const groupByPeriod = (evolution: any[], period: '7D' | '30D' | '12M' | 'Tudo') => {
    if (period === 'Tudo' || evolution.length === 0) return evolution;

    const now = new Date();
    let filterDate = new Date();
    
    if (period === '7D') filterDate.setDate(now.getDate() - 7);
    else if (period === '30D') filterDate.setDate(now.getDate() - 30);
    else if (period === '12M') filterDate.setFullYear(now.getFullYear() - 1);

    // Filtrar transações dentro do período
    const filtered = evolution.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= filterDate;
    });

    // Se não há dados no período, retornar array vazio
    if (filtered.length === 0) return [];

    // Para 7D: agrupar por dia (mostrar o valor final de cada dia)
    if (period === '7D') {
      const grouped: any = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!grouped[dayKey]) {
          grouped[dayKey] = { date: item.date, value: item.value };
        } else {
          // Manter o valor mais recente (e maior) do dia
          const currentDate = new Date(item.date);
          const existingDate = new Date(grouped[dayKey].date);
          if (currentDate > existingDate || (currentDate.getTime() === existingDate.getTime() && item.value > grouped[dayKey].value)) {
            grouped[dayKey] = { date: item.date, value: item.value };
          }
        }
      });
      
      const result = Object.values(grouped).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      return result;
    }

    // Para 30D: agrupar por semana
    if (period === '30D') {
      const grouped: any = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        // Calcular início da semana (domingo)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        
        if (!grouped[weekKey]) {
          grouped[weekKey] = { date: item.date, value: item.value };
        } else {
          // Manter o valor mais recente (e maior) da semana
          const currentDate = new Date(item.date);
          const existingDate = new Date(grouped[weekKey].date);
          if (currentDate > existingDate || (currentDate.getTime() === existingDate.getTime() && item.value > grouped[weekKey].value)) {
            grouped[weekKey] = { date: item.date, value: item.value };
          }
        }
      });
      
      return Object.values(grouped).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }

    // Para 12M: agrupar por mês
    if (period === '12M') {
      const grouped: any = {};
      filtered.forEach((item: any) => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!grouped[monthKey]) {
          grouped[monthKey] = { date: item.date, value: item.value };
        } else {
          // Manter o valor mais recente (e maior) do mês
          const currentDate = new Date(item.date);
          const existingDate = new Date(grouped[monthKey].date);
          if (currentDate > existingDate || (currentDate.getTime() === existingDate.getTime() && item.value > grouped[monthKey].value)) {
            grouped[monthKey] = { date: item.date, value: item.value };
          }
        }
      });

      return Object.values(grouped).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
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
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">{t.dashboard.vault.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{t.dashboard.vault.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Vault Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Fundo de Emergência */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-slate-900/40 backdrop-blur-xl border border-blue-500/20 rounded-[32px] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">{t.dashboard.vault.emergencyFund}</p>
                <p className="text-3xl font-black text-white">{formatCurrency(vaultData.emergencyTotal)}</p>
              </div>
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <ShieldCheck size={32} className="text-blue-400" />
              </div>
            </div>
            
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (vaultData.emergencyTotal / 10000) * 100)}%` }}
              />
            </div>

            {vaultData.emergencyCategory && (
              <div className="flex gap-2">
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
          className="bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-slate-900/40 backdrop-blur-xl border border-emerald-500/20 rounded-[32px] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">{t.dashboard.vault.zenInvestments}</p>
                <p className="text-3xl font-black text-emerald-400">{formatCurrency(vaultData.investmentTotal)}</p>
              </div>
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                <Target size={32} className="text-emerald-400" />
              </div>
            </div>
            
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (vaultData.investmentTotal / 10000) * 100)}%` }}
              />
            </div>

            {vaultData.investmentCategory && (
              <div className="flex gap-2">
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
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-4 rounded-[24px] mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Período</span>
        </div>
        
        <div className="flex items-center gap-2">
          {[
            { key: '7D', label: '7 Dias' },
            { key: '30D', label: '30 Dias' },
            { key: '12M', label: '12 Meses' },
            { key: 'Tudo', label: 'Tudo' }
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key as any)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                selectedPeriod === period.key
                  ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
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
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="text-blue-400" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.evolutionEmergency}</h3>
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
                  const date = new Date(value);
                  if (selectedPeriod === '7D') {
                    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                  } else if (selectedPeriod === '30D') {
                    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                  } else if (selectedPeriod === '12M') {
                    return date.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
                  }
                  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}k€`;
                  }
                  return `${value.toFixed(0)}€`;
                }}
                domain={[
                  (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)),
                  (dataMax: number) => Math.ceil(dataMax * 1.1)
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
                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {formatCurrency(data.value || 0)}
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
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Evolução Investimentos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-emerald-400" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.evolutionInvestments}</h3>
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
                  const date = new Date(value);
                  if (selectedPeriod === '7D') {
                    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                  } else if (selectedPeriod === '30D') {
                    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                  } else if (selectedPeriod === '12M') {
                    return date.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
                  }
                  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
                }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}k€`;
                  }
                  return `${value.toFixed(0)}€`;
                }}
                domain={[
                  (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)),
                  (dataMax: number) => Math.ceil(dataMax * 1.1)
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
                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          {new Date(data.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {formatCurrency(data.value || 0)}
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
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-blue-400" size={18} />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{t.dashboard.vault.emergencyFund}</span>
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
                    <div className="relative w-full h-8 bg-slate-800 rounded-xl overflow-hidden">
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
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="text-emerald-400" size={18} />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.monthlyActivity}</h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">{t.dashboard.vault.investments}</span>
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
                    <div className="relative w-full h-8 bg-slate-800 rounded-xl overflow-hidden">
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
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="text-blue-400" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.transactionsEmergency}</h3>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {vaultData.emergencyTransactions.length > 0 ? (
              vaultData.emergencyTransactions.map((t: any, idx: number) => (
                <motion.div
                  key={t.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/[0.05] transition-all"
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
          className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-emerald-400" size={20} />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.vault.transactionsInvestments}</h3>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {vaultData.investmentTransactions.length > 0 ? (
              vaultData.investmentTransactions.map((t: any, idx: number) => (
                <motion.div
                  key={t.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/[0.05] transition-all"
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

      {/* Vault Transaction Modal */}
      <AnimatePresence>
        {vaultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !vaultLoading && setVaultModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-[32px] p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    vaultModal.action === 'add' 
                      ? vaultModal.category.vault_type === 'emergency' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {vaultModal.action === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">
                      {vaultModal.action === 'add' ? t.dashboard.vault.add : t.dashboard.vault.withdraw}
                    </h3>
                    <p className="text-xs text-slate-400">{vaultModal.category.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!vaultLoading) {
                      setVaultModal(null);
                      setVaultAmount('');
                    }
                  }}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                  disabled={vaultLoading}
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    {t.dashboard.vault.value}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={vaultAmount}
                    onChange={(e) => setVaultAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-black text-lg focus:outline-none focus:border-blue-500/50 transition-colors"
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
                    onClick={() => {
                      if (!vaultLoading) {
                        setVaultModal(null);
                        setVaultAmount('');
                      }
                    }}
                    disabled={vaultLoading}
                    className="flex-1 px-4 py-3 border border-slate-700 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t.dashboard.vault.cancel}
                  </button>
                  <button
                    onClick={handleVaultTransaction}
                    disabled={vaultLoading || !vaultAmount || parseFloat(vaultAmount) <= 0}
                    className={`flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer disabled:opacity-50 ${
                      vaultModal.action === 'add'
                        ? vaultModal.category.vault_type === 'emergency'
                          ? 'bg-blue-500 hover:bg-blue-400 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                        : 'bg-red-500 hover:bg-red-400 text-white'
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

