'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, Zap, 
  Activity, PieChart as PieChartIcon, Calendar,
  ArrowUpRight, ArrowDownRight, Sparkles, Brain, Info,
  ShieldCheck, Clock, History, Landmark, CheckCircle2, CreditCard,
  Plus, Minus, Wallet, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { DEMO_TRANSACTIONS, DEMO_CATEGORIES, DEMO_INSIGHTS, DEMO_RECURRING } from '@/lib/mockData';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { ChartSkeleton, DashboardSkeleton } from '@/components/LoadingSkeleton';
import AlertModal from '@/components/AlertModal';
import PageLoading from '@/components/PageLoading';
import { hasProAccess } from '@/lib/utils';

export default function AnalyticsPage() {
  const { t, formatCurrency } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [rawData, setRawData] = useState<{ transactions: any[], categories: any[], insights: any, recurring: any[] }>({ transactions: [], categories: [], insights: null, recurring: [] });
  const [processedData, setProcessedData] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const chartPeriods = t.dashboard.analytics?.chartPeriods ?? { '7D': '7D', '30D': '30D', '90D': '90D', '12M': '12M', 'Tudo': 'Tudo' };
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '30D' | '90D' | '12M' | 'Tudo'>('Tudo');
  const [isDistInfoOpen, setIsDistInfoOpen] = useState(false);
  const [isWeeklyInfoOpen, setIsWeeklyInfoOpen] = useState(false);
  const [isTopInfoOpen, setIsTopInfoOpen] = useState(false);
  const [isEvoInfoOpen, setIsEvoInfoOpen] = useState(false);
  const [isVaultInfoOpen, setIsVaultInfoOpen] = useState(false);
  const [vaultModal, setVaultModal] = useState<{ open: boolean; category: any; action: 'add' | 'withdraw' } | null>(null);
  const [vaultAmount, setVaultAmount] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const lastUpdateTimestampRef = useRef<number | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState(true);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  });

  const fetchAnalytics = async (force = false) => {
    try {
      if (!force) {
        const cached = localStorage.getItem('analytics_cache');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isFresh = Date.now() - timestamp < 30000; // 30 segundos de cache "fresca"
          
          setIsPro(hasProAccess(data));
          
          // Se não for Pro, garantir que tem dados mock
          if (!hasProAccess(data)) {
            const dataWithMock = {
              ...data,
              transactions: DEMO_TRANSACTIONS,
              categories: DEMO_CATEGORIES,
              insights: DEMO_INSIGHTS,
              recurring: DEMO_RECURRING
            };
            setRawData(dataWithMock);
          } else {
            setRawData(data);
          }
          
          if (isFresh) {
            setLoading(false);
            return;
          }
        }
      }

      const [profileRes, analyticsRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/insights/composite')
      ]);

      const user = profileRes.data;
      const hasActiveSub = hasProAccess(user);

      // Se a subscrição mudou desde a última cache, ignoramos a cache e atualizamos
      const cached = localStorage.getItem('analytics_cache');
      if (cached) {
        const { data } = JSON.parse(cached);
        // Se na cache era Free e agora é Pro, limpamos a cache
        if (data.subscription_status !== user.subscription_status) {
          localStorage.removeItem('analytics_cache');
        }
      }

      setIsPro(hasActiveSub);

      let compositeData = {
        ...analyticsRes.data,
        subscription_status: user.subscription_status,
        is_admin: user.is_admin
      };

      // Se não for Pro, sempre usar Mock Data para visualização completa
      if (!hasActiveSub) {
        compositeData = {
          ...compositeData,
          transactions: DEMO_TRANSACTIONS,
          categories: DEMO_CATEGORIES,
          insights: DEMO_INSIGHTS,
          recurring: DEMO_RECURRING
        };
      }

      setRawData(compositeData);
      try {
        const goalsRes = await api.get('/goals/');
        setGoals(Array.isArray(goalsRes.data) ? goalsRes.data : []);
      } catch {
        setGoals([]);
      }
      const cacheTimestamp = Date.now();
      lastUpdateTimestampRef.current = cacheTimestamp;
      localStorage.setItem('analytics_cache', JSON.stringify({
        data: compositeData,
        timestamp: cacheTimestamp
      }));
    } catch (err) {
      // Em caso de erro, se não for Pro, usar dados mock como fallback
      try {
        const profileRes = await api.get('/auth/me');
        const user = profileRes.data;
        setIsPro(hasProAccess(user));

        if (!hasProAccess(user)) {
          setRawData({
            transactions: DEMO_TRANSACTIONS,
            categories: DEMO_CATEGORIES,
            insights: DEMO_INSIGHTS,
            recurring: DEMO_RECURRING
          });
        }
      } catch {
        // Fallback silencioso
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Função para verificar se há dados novos
    const checkForNewData = async () => {
      try {
        // Buscar apenas a última transação para verificar se há dados novos
        const [profileRes, transRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/transactions/?limit=1') // Apenas a última transação
        ]);

        const user = profileRes.data;
        if (!hasProAccess(user)) return; // Não verificar se não for Pro

        // Filtrar transações de seed
        const latestTransactions = transRes.data.filter((t: any) => Math.abs(t.amount_cents) !== 1);
        
        if (latestTransactions.length > 0) {
          const latestTransaction = latestTransactions[0];
          const latestCreatedAt = new Date(latestTransaction.created_at || latestTransaction.transaction_date).getTime();
          
          // Obter o timestamp da última atualização do ref ou cache
          const currentTimestamp = lastUpdateTimestampRef.current || (() => {
            const cached = localStorage.getItem('analytics_cache');
            if (cached) {
              const { timestamp } = JSON.parse(cached);
              return timestamp;
            }
            return null;
          })();
          
          // Se a última transação é mais recente que a nossa última atualização, atualizar
          if (!currentTimestamp || latestCreatedAt > currentTimestamp) {
            console.log('Dados novos detetados, atualizando...');
            await fetchAnalytics(true); // Forçar atualização completa
          }
        }
      } catch (err) {
        console.error('Erro ao verificar dados novos:', err);
      }
    };
    
    // Verificar dados novos a cada 10 segundos
    const interval = setInterval(() => {
      checkForNewData();
    }, 10000); // 10 segundos
    
    return () => clearInterval(interval);
  }, []); // Array vazio - só executa uma vez no mount

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

      // Verificar saldo se for resgate - VALIDAÇÃO RIGOROSA
      if (vaultModal.action === 'withdraw') {
        const vaultTransactions = rawData.transactions.filter((t: any) => {
          const cat = rawData.categories.find((c: any) => c.id === t.category_id);
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
        
        // Verificar se o resgate não deixa o saldo negativo
        // Como agora resgate é negativo, subtraímos o valor absoluto
        const balanceAfterWithdrawal = currentBalance - amount_cents;
        
        if (amount_cents > currentBalance || balanceAfterWithdrawal < 0) {
          const available = (currentBalance / 100).toFixed(2);
          setAlertModal({
            isOpen: true,
            title: t.dashboard.analytics.insufficientBalanceTitle,
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
      setVaultModal(null);
      setVaultAmount('');
      await fetchAnalytics(true);
    } catch (err: any) {
      console.error('Erro ao processar transação do cofre:', err);
      const errorMessage = err.response?.data?.detail || (t.dashboard.analytics as any).processVaultTransactionError;
      setAlertModal({
        isOpen: true,
        title: t.dashboard.sidebar.toastTypes.error,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setVaultLoading(false);
    }
  };

  useEffect(() => {
    // Processar sempre, mesmo com dados mock (para visualização completa)
    // Se não houver dados e for Pro sem transações, não processar
    if (!rawData.transactions || rawData.transactions.length === 0) {
      if (isPro) return; // Pro sem transações: não processar
      // Free: continuar com dados mock
    }

    const now = new Date();
    // Resetar horas para início do dia para comparações corretas
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let filterDate = new Date();

    if (selectedPeriod === '7D') {
      filterDate = new Date(todayStart);
      filterDate.setDate(filterDate.getDate() - 7);
    } else if (selectedPeriod === '30D') {
      filterDate = new Date(todayStart);
      filterDate.setDate(filterDate.getDate() - 30);
    } else if (selectedPeriod === '90D') {
      filterDate = new Date(todayStart);
      filterDate.setDate(filterDate.getDate() - 90);
    } else if (selectedPeriod === '12M') {
      filterDate = new Date(todayStart);
      filterDate.setFullYear(filterDate.getFullYear() - 1);
    } else {
      filterDate = new Date(0); // All/Tudo
    }

    const filteredTransactions = rawData.transactions.filter((t: any) => {
      const transDate = new Date(t.transaction_date);
      // Para "Tudo", incluir todas as transações até hoje
      if (selectedPeriod === 'Tudo') {
        return transDate <= todayStart;
      }
      // Para outros períodos, incluir apenas transações no intervalo [filterDate, todayStart]
      return transDate >= filterDate && transDate <= todayStart;
    });

    // Process data for charts
    const monthlyData: any = {};
    const catDistribution: any = {};
    const catExpenseCount: any = {};
    const volumeByMonthData: any = {};
    const dayExpenses: any = {};
    const weekDays = t.dashboard.analytics.weekDays;
    const othersLabel = t.dashboard?.analytics?.others ?? 'Outros';
    const weeklyRhythm: any = { 
      [weekDays.mon]: 0, 
      [weekDays.tue]: 0, 
      [weekDays.wed]: 0, 
      [weekDays.thu]: 0, 
      [weekDays.fri]: 0, 
      [weekDays.sat]: 0, 
      [weekDays.sun]: 0 
    };
    const weekMap: any = { 
      0: weekDays.sun, 
      1: weekDays.mon, 
      2: weekDays.tue, 
      3: weekDays.wed, 
      4: weekDays.thu, 
      5: weekDays.fri, 
      6: weekDays.sat 
    };
    
    const computeTotals = (txs: any[]) => {
      let income = 0;
      let expenses = 0;
      txs.forEach((t: any) => {
        const cat = rawData.categories.find((c: any) => c.id === t.category_id);
        const amount = t.amount_cents / 100;
        if (cat && cat.vault_type !== 'none') return;
        // Backend: amount_cents > 0 = income, amount_cents < 0 = expense
        if (t.amount_cents > 0) {
          income += amount;
        } else if (t.amount_cents < 0) {
          expenses += -amount; // Converte negativo para positivo
        }
      });
      return { income, expenses };
    };

    const computeSavingRate = (income: number, expenses: number) => {
      const MIN_INCOME_THRESHOLD = 100;
      if (income < MIN_INCOME_THRESHOLD) return 0;
      const calculated = ((income - expenses) / income) * 100;
      return Math.max(-100, Math.min(100, calculated));
    };

    const computeHealthScore = (income: number, expenses: number, savingRate: number) => {
      let score = 70;
      if (income > 0) {
        if (expenses > income) {
          score = Math.max(10, 30 - Math.min(20, Math.abs(savingRate) / 5));
        } else if (savingRate > 20) {
          score = 90;
        } else if (savingRate > 10) {
          score = 75;
        } else if (savingRate > 0) {
          score = 60;
        } else {
          score = 50;
        }
      } else if (income === 0 && expenses > 0) {
        score = 20;
      }
      return score;
    };

    let periodIncome = 0;
    let periodExpenses = 0;
    let cumulativeBalance = 0;
    let investmentTotal = 0;
    let emergencyTotal = 0;
    const evolutionData: any[] = [];

    // Filter and Sort for Recent Transactions
    // Ordenar por created_at (quando foi criada) em vez de transaction_date para incluir transações do Telegram
    const recentTransactions = [...rawData.transactions]
      .sort((a: any, b: any) => {
        // Usar created_at se disponível, senão usar transaction_date
        const dateA = new Date(a.created_at || a.transaction_date).getTime();
        const dateB = new Date(b.created_at || b.transaction_date).getTime();
        return dateB - dateA; // Mais recente primeiro
      })
      .slice(0, 5)
      .map(t => ({
        ...t,
        category: rawData.categories.find(c => c.id === t.category_id)
      }));

    // Detect Upcoming (Future dates + Recurring rules)
    const upcomingFromTransactions = rawData.transactions
      .filter(t => {
        const transDate = new Date(t.transaction_date);
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Mostrar apenas transações do FUTURO (amanhã em diante)
        // As de hoje já aparecem na "Atividade Recente"
        return transDate > todayDate; 
      })
      .map(t => ({
        description: t.description,
        amount_cents: t.amount_cents,
        transaction_date: t.transaction_date,
        type: 'manual',
        id: t.id,
        process_automatically: false,
        canConfirm: false,
        alreadyPaid: false
      }));

    const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const effectiveDay = (y: number, m: number, day: number) => Math.min(day, lastDayOfMonth(y, m));

    const upcomingFromRecurring = (rawData.recurring || []).map(r => {
      const today = now.getDate();
      const year = now.getFullYear();
      const month = now.getMonth();
      const currentMonthStart = new Date(year, month, 1);
      const effective = effectiveDay(year, month, r.day_of_month);

      // Já pago: transação este mês com mesma descrição (ou "(R) descrição") e valor
      const alreadyPaidThisMonth = rawData.transactions.some((t: any) => {
        const sameDesc = t.description === r.description || t.description === `(R) ${r.description}`;
        return sameDesc &&
          Math.abs(t.amount_cents) === Math.abs(r.amount_cents) &&
          new Date(t.transaction_date) >= currentMonthStart;
      });

      let nextDate = new Date(year, month, effective);
      if (alreadyPaidThisMonth) {
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(Math.min(r.day_of_month, lastDayOfMonth(nextDate.getFullYear(), nextDate.getMonth())));
      }

      // Mostrar botão "Confirmar" quando já passou o dia (ou é hoje) e ainda não foi pago
      const canConfirm = !alreadyPaidThisMonth && today >= effective;

      return {
        id: r.id,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_date: nextDate.toISOString().split('T')[0],
        type: 'recurring',
        process_automatically: r.process_automatically,
        canConfirm,
        alreadyPaid: alreadyPaidThisMonth
      };
    });

    // Filtrar para mostrar apenas o que ainda não foi pago este mês OU o que vem no futuro
    const upcomingPayments = [...upcomingFromTransactions, ...upcomingFromRecurring]
      .filter(p => {
        if (p.type === 'recurring' && p.alreadyPaid) {
          // Se já pagou, só mostramos se a data projetada for futura (próximo mês)
          return new Date(p.transaction_date) > now;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.transaction_date).getTime();
        const dateB = new Date(b.transaction_date).getTime();
        return dateA - dateB; // Ordem ascendente: mais próximo primeiro
      })
      .slice(0, 5);

    const topExpenses = filteredTransactions
      .filter((t: any) => {
        const cat = rawData.categories.find((c: any) => c.id === t.category_id);
        // Apenas despesas: amount_cents < 0, excluir vault
        return t.amount_cents < 0 && (!cat || cat.vault_type === 'none');
      })
      .sort((a: any, b: any) => Math.abs(a.amount_cents) - Math.abs(b.amount_cents)) // Ordenar por valor absoluto (maiores primeiro)
      .reverse()
      .slice(0, 5)
      .map((tx: any) => ({
        name: tx.description || 'N/A',
        value: Math.abs(tx.amount_cents) / 100
      }));

    // Process all transactions for Evolution (Historical)
    const sortedAll = [...rawData.transactions].sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    sortedAll.forEach((t: any) => {
      const cat = rawData.categories.find((c: any) => c.id === t.category_id);
      const amount = t.amount_cents / 100;
      
      // Calculate Vault totals (all time)
      // IMPORTANTE: amount_cents positivo = depósito (adiciona ao vault), amount_cents negativo = resgate (subtrai do vault)
      if (cat?.vault_type === 'investment') {
        if (t.amount_cents > 0) {
          // Depósito: amount_cents positivo, adicionar valor
          investmentTotal += t.amount_cents / 100;
        } else {
          // Resgate: amount_cents negativo, subtrair valor absoluto
          investmentTotal -= Math.abs(t.amount_cents / 100);
        }
      }
      if (cat?.vault_type === 'emergency') {
        if (t.amount_cents > 0) {
          // Depósito: amount_cents positivo, adicionar valor
          emergencyTotal += t.amount_cents / 100;
        } else {
          // Resgate: amount_cents negativo, subtrair valor absoluto
          emergencyTotal -= Math.abs(t.amount_cents / 100);
        }
      }

      // Património Acumulado: Apenas receitas - despesas de consumo (fluxo de caixa)
      // Vault transactions NÃO são incluídas porque:
      // - Depósito no vault: dinheiro sai do saldo disponível mas fica no vault (património não muda)
      // - Resgate do vault: dinheiro volta ao saldo disponível (património não muda)
      // Backend: amount_cents > 0 = income, amount_cents < 0 = expense
      if (cat?.vault_type === 'none') {
        if (t.amount_cents > 0) {
          cumulativeBalance += amount;
        } else if (t.amount_cents < 0) {
          cumulativeBalance += amount; // amount já é negativo
        }
      }
      // Se for transação de investimento/emergência (vault) ou tipo desconhecido, não altera o cumulativeBalance
      
      evolutionData.push({
        date: t.transaction_date,
        balance: cumulativeBalance
      });
    });

    filteredTransactions.forEach((t: any) => {
      const date = new Date(t.transaction_date);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      const dayName = weekMap[date.getDay()];
      volumeByMonthData[monthYear] = (volumeByMonthData[monthYear] || 0) + 1;

      const cat = rawData.categories.find((c: any) => c.id === t.category_id);
      if (cat && cat.vault_type !== 'none') return;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      }
      const amount = t.amount_cents / 100;

      // Backend: amount_cents > 0 = income, amount_cents < 0 = expense
      if (t.amount_cents > 0) {
        monthlyData[monthYear].income += amount;
        periodIncome += amount;
      } else if (t.amount_cents < 0) {
        const expenseAmount = -amount;
        monthlyData[monthYear].expenses += expenseAmount;
        periodExpenses += expenseAmount;
        const catName = cat?.name ?? othersLabel;
        catDistribution[catName] = (catDistribution[catName] || 0) + expenseAmount;
        catExpenseCount[catName] = (catExpenseCount[catName] || 0) + 1;
        dayExpenses[date.getDate()] = (dayExpenses[date.getDate()] || 0) + expenseAmount;
        weeklyRhythm[dayName] += expenseAmount;
      }
    });

    const savingRate = computeSavingRate(periodIncome, periodExpenses);
    const dynamicScore = computeHealthScore(periodIncome, periodExpenses, savingRate);

    let prevSavingRate: number | null = null;
    let prevHealthScore: number | null = null;
    let prevPeriodIncome = 0;
    let prevPeriodExpenses = 0;
    if (selectedPeriod !== 'Tudo') {
      const periodStart = filterDate;
      const periodEnd = todayStart;
      const deltaMs = periodEnd.getTime() - periodStart.getTime();
      const prevStart = new Date(periodStart.getTime() - deltaMs);
      const prevEnd = periodStart;
      const prevTransactions = rawData.transactions.filter((t: any) => {
        const transDate = new Date(t.transaction_date);
        return transDate >= prevStart && transDate < prevEnd;
      });
      if (prevTransactions.length > 0) {
        const prevTotals = computeTotals(prevTransactions);
        prevPeriodIncome = prevTotals.income;
        prevPeriodExpenses = prevTotals.expenses;
        prevSavingRate = computeSavingRate(prevTotals.income, prevTotals.expenses);
        prevHealthScore = computeHealthScore(prevTotals.income, prevTotals.expenses, prevSavingRate);
      }
    }

    const recurringMonthly = (rawData.recurring || []).map((r: any) => ({
      name: r.description || t.dashboard.analytics.noDescription,
      value: Math.abs(Number(r.amount_cents)) / 100
    }));

    const volumeByMonth = Object.keys(monthlyData).length ? Object.keys(monthlyData).reverse().map((name) => ({ name, value: volumeByMonthData[name] || 0 })) : Object.entries(volumeByMonthData).map(([name, value]) => ({ name, value })).sort((a, b) => {
      try {
        const dA = new Date(a.name + ' 1').getTime();
        const dB = new Date(b.name + ' 1').getTime();
        return dB - dA;
      } catch { return 0; }
    });

    // Despesas por dia do mês (1–31)
    const expensesByDayOfMonth = Array.from({ length: 31 }, (_, i) => i + 1).map((day) => ({ day, value: dayExpenses[day] || 0 }));

    // Taxa de poupança ao longo do tempo (por mês)
    const savingRateOverTime = (Object.values(monthlyData) as { name: string; income: number; expenses: number }[]).map((m) => ({
      name: m.name,
      value: m.income > 0 ? Math.max(-100, Math.min(100, ((m.income - m.expenses) / m.income) * 100)) : 0
    })).reverse();

    // Concentração: % das despesas nas top 2 categorias
    const distEntries = Object.entries(catDistribution).sort((a, b) => (b[1] as number) - (a[1] as number));
    const totalDist = (Object.values(catDistribution) as number[]).reduce((a, x) => a + x, 0);
    const top2 = distEntries.slice(0, 2);
    const concentrationPctTop2 = totalDist > 0 ? (top2.reduce((a, x) => a + (x[1] as number), 0) / totalDist) * 100 : 0;
    const concentrationTop2Names = top2.map((x) => x[0]);

    // Ticket médio por categoria (despesas)
    const ticketMedioByCategory = Object.entries(catDistribution).map(([name, total]) => ({
      name,
      value: (catExpenseCount[name] || 1) > 0 ? (total as number) / (catExpenseCount[name] || 1) : 0
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Recorrentes vs variáveis (€)
    const recurringTotal = recurringMonthly.reduce((a: number, x: { value: number }) => a + x.value, 0);
    const variableTotal = Math.max(0, periodExpenses - recurringTotal);
    const recurringVsVariable = [
      { name: t.dashboard.analytics.recurringLabel, value: recurringTotal },
      { name: t.dashboard.analytics.variableLabel, value: variableTotal }
    ].filter((x) => x.value > 0);

    const periodComparison = {
      current: { income: periodIncome, expenses: periodExpenses, balance: periodIncome - periodExpenses },
      previous: prevPeriodIncome || prevPeriodExpenses ? { income: prevPeriodIncome, expenses: prevPeriodExpenses, balance: prevPeriodIncome - prevPeriodExpenses } : null
    };

    const categoriesAtRisk = (rawData.insights?.predictions?.categories_at_risk || []).slice(0, 5);

    setProcessedData({
      flow: Object.values(monthlyData).reverse(),
      distribution: Object.entries(catDistribution).map(([name, value]) => ({ name, value })),
      weekly: Object.entries(weeklyRhythm).map(([name, value]) => ({ name, value })),
      evolution: evolutionData.slice(-20),
      recentTransactions,
      upcomingPayments,
      topExpenses,
      recurringMonthly,
      healthScore: dynamicScore,
      savingRate: savingRate.toFixed(1),
      prevSavingRate,
      prevHealthScore,
      periodIncome,
      periodExpenses,
      netResult: periodIncome - periodExpenses,
      summary: rawData.insights?.summary || t.dashboard.analytics.subtitle,
      insights: rawData.insights?.insights || [],
      investmentTotal,
      emergencyTotal,
      volumeByMonth,
      expensesByDayOfMonth,
      savingRateOverTime,
      concentrationPctTop2,
      concentrationTop2Names,
      ticketMedioByCategory,
      recurringVsVariable,
      periodComparison,
      categoriesAtRisk
    });
  }, [selectedPeriod, rawData]);

  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

  if (loading || !processedData) {
    return <PageLoading />;
  }

  // Verificar se é Pro e tem menos de 10 transações reais (não mock)
  // IDs mock começam com 'd' ou 'demo', ou são UUIDs que não existem na lista de mock
  const mockIds = new Set(DEMO_TRANSACTIONS.map(t => t.id));
  const realTransactions = isPro 
    ? rawData.transactions.filter((t: any) => !mockIds.has(t.id))
    : [];
  // Mostrar dados se: não for Pro (usa mock) OU tiver pelo menos 1 transação real
  const hasEnoughData = !isPro || realTransactions.length > 0;
  // Baixa confiança: Pro com 1-9 transações
  const hasLowConfidence = isPro && realTransactions.length > 0 && realTransactions.length < 10;
  // Sem dados: Pro com 0 transações
  const hasNoData = isPro && realTransactions.length === 0;

  const savingRateValue = Number(processedData.savingRate) || 0;
  const savingRateBand =
    savingRateValue < 0
      ? { label: 'Critico', color: 'text-red-400', range: '< 0%' }
      : savingRateValue < 10
        ? { label: 'Fraco', color: 'text-amber-400', range: '0-10%' }
        : savingRateValue < 25
          ? { label: 'Saudavel', color: 'text-emerald-400', range: '10-25%' }
          : { label: 'Excelente', color: 'text-blue-400', range: '> 25%' };

  const healthScoreValue = Number(processedData.healthScore) || 0;
  const healthBand =
    healthScoreValue >= 80
      ? { label: 'Excelente', color: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20' }
      : healthScoreValue >= 60
        ? { label: 'Saudavel', color: 'text-blue-400', badge: 'bg-blue-500/10 border-blue-500/20' }
        : healthScoreValue >= 40
          ? { label: t.dashboard.analytics.attentionLabel, color: 'text-amber-400', badge: 'bg-amber-500/10 border-amber-500/20' }
          : { label: 'Critico', color: 'text-red-400', badge: 'bg-red-500/10 border-red-500/20' };

  const healthDelta =
    typeof processedData.prevHealthScore === 'number'
      ? processedData.healthScore - processedData.prevHealthScore
      : null;
  const savingRateDelta =
    typeof processedData.prevSavingRate === 'number'
      ? savingRateValue - processedData.prevSavingRate
      : null;

  const maxWeekly = processedData.weekly.reduce(
    (acc: any, cur: any) => (cur.value > acc.value ? cur : acc),
    { name: 'N/A', value: 0 }
  );
  const topExpense = processedData.topExpenses[0]?.name;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-20 relative"
    >
      {/* Header – compacto para choque visual logo abaixo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white mb-1">
            {t.dashboard.analytics.title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic">
            {t.dashboard.analytics.subtitle}
          </p>
        </div>
        
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-amber-500/10 border border-amber-500/20 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl w-full sm:w-auto"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 truncate">{t.dashboard.page.demoMode}</span>
            </div>
            <Link 
              href="/pricing"
              className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 sm:py-1 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {t.dashboard.page.upgradePro}
            </Link>
          </motion.div>
        )}
      </div>

      {/* Mensagem se não tiver nenhuma transação (Pro) */}
      {hasNoData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/40 backdrop-blur-xl border border-amber-500/20 rounded-[32px] p-12 text-center"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center">
              <Info size={32} className="text-amber-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">
                {t.dashboard.analytics.noTransactionsYet}
              </h3>
              <p className="text-sm text-slate-400 font-medium italic max-w-md">
                {t.dashboard.analytics.addFirstTransaction}
              </p>
            </div>
            <Link
              href="/transactions"
              className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
            >
              {t.dashboard.analytics.addTransactions}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Aviso de baixa confiança estatística */}
      {hasLowConfidence && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/5 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-full" />
          <div className="flex items-start gap-3 sm:gap-4 pl-3">
            <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <Info size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h3 className="text-sm font-black text-white">{t.dashboard.analytics.lowConfidenceTitle}</h3>
                <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded-lg text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  {t.dashboard.analytics.lowConfidenceBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {t.dashboard.analytics.lowConfidenceDescription}
                {' '}{t.dashboard.analytics.lowConfidenceTransactions.replace('{count}', String(realTransactions.length))}
              </p>
              {/* Mini progress toward 10 transactions */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden max-w-[200px]">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (realTransactions.length / 10) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold text-amber-400 tabular-nums">{realTransactions.length}/10</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filtro + 3 cards compactos (estilo dashboard) + grid gráficos choque visual */}
      {hasEnoughData && (
      <>
      {/* Filtro período – topo */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-900/40 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-xl shrink-0">
          <Calendar size={12} className="text-blue-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{t.dashboard.analytics.periodFilters}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {Object.entries(chartPeriods).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedPeriod(key as '7D' | '30D' | '90D' | '12M' | 'Tudo')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border shrink-0 ${
                selectedPeriod === key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 cards compactos: Saúde | Taxa Poupança | Resultado (estilo dashboard) */}
      <section className="mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-2xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                <Activity size={16} />
              </div>
              {healthDelta !== null && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${healthDelta >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {healthDelta >= 0 ? '▲' : '▼'} {Math.abs(healthDelta).toFixed(0)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.analytics.health}</p>
            <p className="text-xl font-black text-white tabular-nums">{processedData.healthScore}%</p>
            <span className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${healthBand.badge} ${healthBand.color}`}>{healthBand.label}</span>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-2xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20">
                <Target size={16} />
              </div>
              {savingRateDelta !== null && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${savingRateDelta >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {savingRateDelta >= 0 ? '▲' : '▼'} {Math.abs(savingRateDelta).toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.analytics.savingsRate}</p>
            <p className="text-xl font-black text-white tabular-nums">{processedData.savingRate}%</p>
            <span className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${savingRateBand.color} bg-white/5`}>{savingRateBand.label}</span>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-2xl sm:col-span-2 md:col-span-1 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${(processedData.netResult || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                <Wallet size={16} />
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Resultado período</p>
            <p className={`text-xl font-black tabular-nums ${(processedData.netResult || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(processedData.netResult || 0)}
            </p>
          </motion.div>
        </div>

        {/* Insight uma linha – compacto */}
        <div className="mt-3 sm:mt-4 bg-slate-900/50 border border-blue-500/15 rounded-xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Sparkles size={12} className="text-blue-400" />
          </div>
          <p className="text-[10px] font-medium text-slate-300 italic truncate">
            {hasLowConfidence || !processedData?.summary || (String(processedData.summary || '').trim() === '') || maxWeekly.name === 'N/A'
              ? (t.dashboard?.analytics?.zenInsightGeneric || "Ainda a aprender com os teus dados. Mais transações = insights mais precisos.")
              : `Saving rate ${processedData.savingRate}%. Maior gasto: ${maxWeekly.name}${topExpense ? ` → ${topExpense}` : ''}. ${(processedData.summary || '').slice(0, 80)}…`}
          </p>
        </div>
      </section>

      {/* Análise Pro – gráficos: estrutura fixa (top 10), cores vivas, tooltip = dashboard */}
      <section className="mb-12 space-y-6">
        {/* Linha 1: 2/3 Evolução do saldo | 1/3 Ritmo mensal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl lg:col-span-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-1">Evolução do saldo</h3>
            <p className="text-xs text-slate-500 font-medium italic mb-4">Património acumulado ao longo do tempo</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processedData.evolution || []} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v) => v ? new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : ''} />
                  <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={56} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => formatCurrency(value ?? 0)} labelFormatter={(label) => label ? new Date(label).toLocaleDateString('pt-PT') : ''} />
                  <Area type="monotone" dataKey="balance" name={t.dashboard.analytics.balanceLabel} stroke="#22c55e" fill="#22c55e" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl lg:col-span-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-1">{t.dashboard.analytics.monthlyRhythm}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic mb-3 sm:mb-4">{t.dashboard.analytics.expensesByWeekday}</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.weekly || []} margin={{ top: 8, right: 8, bottom: 8 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={48} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                    {(processedData.weekly || []).map((_: unknown, i: number) => (
                      <Cell key={i} fill={['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'][i % 7]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Linha 2: 1/3 Categorias em risco | 2/3 Comparação atual anterior */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl lg:col-span-1">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Activity size={14} className="text-red-400" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Categorias em risco</h3>
              {processedData.categoriesAtRisk?.length > 0 && (
                <span className="ml-auto text-[9px] font-bold px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">{processedData.categoriesAtRisk.length}</span>
              )}
            </div>
            {processedData.categoriesAtRisk?.length > 0 ? (
              <div className="space-y-2 mb-3">
                {(processedData.categoriesAtRisk as { category_name?: string; name?: string; risk_level?: string; risk_percent?: number; projected?: number; limit?: number }[]).map((c: any, i: number) => {
                  const name = c.category_name ?? c.name ?? 'Categoria';
                  const pct = c.risk_percent ?? parseFloat(String(c.risk_level || '0').replace('%', ''));
                  const amount = typeof c.projected === 'number' ? c.projected : 0;
                  const limitVal = typeof c.limit === 'number' ? c.limit : 0;
                  const isExceeded = pct >= 100;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded-xl px-3 py-2.5 border ${
                        isExceeded ? 'bg-red-500/5 border-red-500/15' : 'bg-amber-500/5 border-amber-500/15'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isExceeded ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {c.risk_level ?? `${pct.toFixed(0)}%`}
                        </span>
                      </div>
                      {limitVal > 0 && (
                        <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1.5 tabular-nums">
                          <span>{formatCurrency(amount)}</span>
                          <span className="text-slate-600">{formatCurrency(limitVal)} limite</span>
                        </div>
                      )}
                      <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={`h-full rounded-full ${isExceeded ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
                <p className="text-xs text-slate-400">{t.dashboard.analytics.noCategoryAtRisk}</p>
              </div>
            )}
            {processedData.categoriesAtRisk?.length > 0 && (
              <Link
                href="/categories"
                className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowRight size={10} />
                {t.dashboard?.analytics?.adjustLimits ?? 'Ajustar limites'}
              </Link>
            )}
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed border-t border-white/5 pt-3 sm:pt-4">{processedData.summary || t.dashboard.analytics.summaryFallback}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl lg:col-span-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-1">{t.dashboard.analytics.comparisonPeriodTitle}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic mb-3 sm:mb-4">{t.dashboard.analytics.comparisonPeriodSubtitle}</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(() => {
                  const pc = processedData.periodComparison;
                  if (!pc) return [];
                  return [
                    { name: t.dashboard.analytics.income, atual: pc.current.income, anterior: pc.previous?.income ?? 0 },
                    { name: t.dashboard.analytics.expenses, atual: pc.current.expenses, anterior: pc.previous?.expenses ?? 0 },
                    { name: t.dashboard.analytics.balanceLabel, atual: pc.current.balance, anterior: pc.previous?.balance ?? 0 }
                  ];
                })()} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={56} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                  <Line type="monotone" dataKey="atual" name={t.dashboard.analytics.currentPeriodLabel} stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                  <Line type="monotone" dataKey="anterior" name={t.dashboard.analytics.previousPeriodLabel} stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Linha 3: 3/3 Volume por mês */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-1">{t.dashboard.analytics.volumeByMonthTitle}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic mb-3 sm:mb-4">{t.dashboard.analytics.volumeByMonthSubtitle}</p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.volumeByMonth || []} margin={{ top: 8, right: 8, bottom: 8 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => [value ?? 0, t.dashboard.analytics.transactionsLabel]} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#06b6d4' }} cursor="default" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Linha 4: 2/3 Despesas por mês | 1/3 Progresso das metas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl lg:col-span-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-1">{(t.dashboard.analytics as any).expensesByMonth}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic mb-3 sm:mb-4">{(t.dashboard.analytics as any).expensesByMonthSubtitle}</p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData.expensesByDayOfMonth || []} margin={{ top: 4, right: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#475569" fontSize={8} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#475569" fontSize={9} tickFormatter={(v) => formatCurrency(v)} width={48} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => [value != null ? formatCurrency(value) : '', 'Despesas']} labelFormatter={(d) => `Dia ${d}`} />
                  <Line type="monotone" dataKey="value" name={t.dashboard.analytics.expenses} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-xl lg:col-span-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white mb-3 sm:mb-4">{t.dashboard.analytics.goalsProgressTitle}</h3>
            {goals.length > 0 ? (
              <div className="space-y-4">
                {goals.slice(0, 4).map((g: any, idx: number) => {
                  const target = (g.target_amount_cents ?? 0) / 100;
                  const current = (g.current_amount_cents ?? 0) / 100;
                  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                  const barColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];
                  const barColor = barColors[idx % barColors.length];
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-200 truncate font-medium">{g.name}</span>
                        <span className="text-slate-400 tabular-nums shrink-0 ml-2">{formatCurrency(current)} / {formatCurrency(target)}</span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${barColor}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Sem metas definidas.</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Dimensao Cofres */}
      <section className="space-y-4">
        <button
          onClick={() => setIsVaultOpen(!isVaultOpen)}
          className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-[0.4em] text-slate-500"
        >
          <span>{t.dashboard.analytics.vaultDimension}</span>
          {isVaultOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {/* Vault (Reservas e Investimentos) */}
        {isVaultOpen && (
        <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 relative overflow-hidden group">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                <Landmark size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white opacity-50 mb-1">{t.dashboard.analytics.vaultTitle}</h3>
                <p className="text-sm text-slate-500 font-medium italic">{t.dashboard.analytics.vaultSubtitle}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {(() => {
              const emergencyCategory = rawData.categories.find((c: any) => c.vault_type === 'emergency');
              const investmentCategory = rawData.categories.find((c: any) => c.vault_type === 'investment');
              
              return (
                <>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative group"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">{t.dashboard.analytics.emergencyFund}</p>
                    <p className="text-lg font-black text-white text-center mb-3">{formatCurrency(processedData.emergencyTotal)}</p>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden mb-3">
                      <div 
                        className="h-full bg-blue-500" 
                        style={{ width: `${Math.min(100, (processedData.emergencyTotal / (processedData.evolution.slice(-1)[0]?.balance || 1)) * 100)}%` }} 
                      />
                    </div>
                    {emergencyCategory && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setVaultModal({ open: true, category: emergencyCategory, action: 'add' })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl transition-all group/btn cursor-pointer"
                        >
                          <Plus size={14} className="text-blue-400 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{t.dashboard.analytics.add}</span>
                        </button>
                        <button
                          onClick={() => setVaultModal({ open: true, category: emergencyCategory, action: 'withdraw' })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all group/btn cursor-pointer"
                        >
                          <Minus size={14} className="text-red-400 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">{t.dashboard.analytics.withdraw}</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl relative group"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">Investimentos</p>
                    <p className="text-lg font-black text-emerald-400 text-center mb-3">{formatCurrency(processedData.investmentTotal)}</p>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden mb-3">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${Math.min(100, (processedData.investmentTotal / (processedData.evolution.slice(-1)[0]?.balance || 1)) * 100)}%` }} 
                      />
                    </div>
                    {investmentCategory && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setVaultModal({ open: true, category: investmentCategory, action: 'add' })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl transition-all group/btn cursor-pointer"
                        >
                          <Plus size={14} className="text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{t.dashboard.analytics.add}</span>
                        </button>
                        <button
                          onClick={() => setVaultModal({ open: true, category: investmentCategory, action: 'withdraw' })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all group/btn cursor-pointer"
                        >
                          <Minus size={14} className="text-red-400 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">{t.dashboard.analytics.withdraw}</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              );
            })()}
          </div>

          <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{t.dashboard.analytics.freedomRate}</span>
            </div>
            <span className="text-sm font-black text-blue-400">
              {(() => {
                // Taxa de Liberdade = (Investimentos / Patrimônio Total) * 100
                // Se não houver patrimônio, usa receitas líquidas como base
                const netWorth = processedData.evolution?.slice(-1)[0]?.balance || processedData.netResult || 0;
                const baseValue = netWorth > 0 ? netWorth : (processedData.periodIncome - processedData.periodExpenses);
                
                if (baseValue > 0 && processedData.investmentTotal > 0) {
                  return ((processedData.investmentTotal / baseValue) * 100).toFixed(1);
                }
                return '0.0';
              })()}%
            </span>
          </div>
        </section>
        )}
      </section>

      {/* Compromissos futuros */}
      <section className="space-y-4">
      <button
        onClick={() => setIsRecurringOpen(!isRecurringOpen)}
        className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span>{t.dashboard.analytics.futureCommitments}</span>
        {isRecurringOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isRecurringOpen && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Payments */}
        <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Clock size={16} className="text-orange-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.analytics.upcoming}</h3>
          </div>
          <div className="space-y-2">
            {processedData.upcomingPayments.map((p: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-700/30 hover:border-orange-500/20 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[7px] font-bold text-orange-400 uppercase leading-none">{new Date(p.transaction_date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-sm font-black text-white leading-none">{new Date(p.transaction_date).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.description || t.dashboard.analytics.noDescription}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {p.type === 'recurring' ? t.dashboard.analytics.recurringType : t.dashboard.analytics.scheduledType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-red-400 tabular-nums">-{formatCurrency(p.amount_cents / 100)}</span>
                  {p.type === 'recurring' && (
                    <div className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20" title={t.dashboard.analytics.processingAutomatic}>
                      <Zap size={13} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {processedData.upcomingPayments.length === 0 && (
              <p className="text-center text-slate-500 text-xs italic py-10">{t.dashboard.analytics.noUpcomingPayments}</p>
            )}
          </div>
        </section>

        {/* Recent Transactions Feed */}
        <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <History size={16} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.analytics.recentActivity}</h3>
          </div>
          <div className="space-y-2">
            {processedData.recentTransactions.map((tx: any, i: number) => {
              const isVault = tx.category?.vault_type && tx.category.vault_type !== 'none';
              const isIncome = isVault ? tx.amount_cents > 0 : tx.category?.type === 'income';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {isIncome ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{tx.description || 'N/A'}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{new Date(tx.transaction_date).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black tabular-nums shrink-0 ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount_cents) / 100)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>
      )}
      </section>
      </>
      )}

      {/* AI Deep Dive Cards */}
      {hasEnoughData && (
      <section className="space-y-6">
        {/* Section Header with animated gradient */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Brain size={20} className="text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">
              {t.dashboard.analytics.aiInsights}
            </h2>
            <p className="text-[10px] text-slate-500">Powered by AI</p>
          </div>
        </div>

        {/* Previsões Avançadas - 3 Months Forecast */}
        {rawData.insights?.predictions && rawData.insights.predictions.months_ahead && rawData.insights.predictions.months_ahead.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-purple-500/5 to-indigo-600/8" />
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative border border-blue-500/15 rounded-2xl backdrop-blur-sm">
              {/* Header strip */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-blue-500/10 bg-blue-500/5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300">{t.dashboard.analytics.projectionNext3Months}</h3>
                </div>
                {/* Confidence badge inline */}
                {rawData.insights.predictions.confidence != null && (
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className={
                      rawData.insights.predictions.confidence >= 70 ? 'text-emerald-400' :
                      rawData.insights.predictions.confidence >= 50 ? 'text-amber-400' : 'text-slate-400'
                    } />
                    <span className={`text-[10px] font-bold tabular-nums ${
                      rawData.insights.predictions.confidence >= 70 ? 'text-emerald-400' :
                      rawData.insights.predictions.confidence >= 50 ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {rawData.insights.predictions.confidence.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Month cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-800/30">
                {rawData.insights.predictions.months_ahead.map((month: any, idx: number) => {
                  const isNegative = month.balance < 0;
                  const monthName = (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + idx + 1);
                    return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                  })();
                  const total = month.income + month.expenses;
                  const incPct = total > 0 ? (month.income / total) * 100 : 50;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`p-4 sm:p-5 ${idx < 2 ? 'border-b md:border-b-0 md:border-r border-slate-700/30' : ''} bg-slate-900/40`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 capitalize">{monthName}</p>
                      
                      {/* Income / Expense bar visual */}
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-4 flex">
                        <div className="h-full bg-emerald-500/70 rounded-l-full transition-all" style={{ width: `${incPct}%` }} />
                        <div className="h-full bg-red-500/70 rounded-r-full transition-all" style={{ width: `${100 - incPct}%` }} />
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-slate-400">{t.dashboard.analytics.income}</span>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 tabular-nums">+{formatCurrency(month.income)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[10px] text-slate-400">{t.dashboard.analytics.expenses}</span>
                          </div>
                          <span className="text-sm font-bold text-red-400 tabular-nums">-{formatCurrency(month.expenses)}</span>
                        </div>
                      </div>

                      {/* Balance highlight */}
                      <div className={`mt-4 pt-3 border-t flex justify-between items-center ${isNegative ? 'border-red-500/20' : 'border-slate-700/50'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.analytics.projectedBalance}</span>
                        <div className="flex items-center gap-1.5">
                          {isNegative ? <TrendingDown size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-emerald-400" />}
                          <span className={`text-base font-black tabular-nums ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isNegative ? '-' : '+'}{formatCurrency(Math.abs(month.balance))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Bottom confidence bar */}
              {rawData.insights.predictions.confidence != null && (
                <div className="px-4 sm:px-6 py-3 border-t border-slate-700/30 bg-slate-950/30 flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 shrink-0">{t.dashboard.analytics.projectionConfidence ?? 'Confiança'}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(rawData.insights.predictions.confidence, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        rawData.insights.predictions.confidence >= 70 ? 'bg-emerald-500' :
                        rawData.insights.predictions.confidence >= 50 ? 'bg-amber-500' : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 italic shrink-0">
                    {rawData.insights.predictions.confidence >= 70
                      ? (t.dashboard.analytics.confidenceHigh ?? 'Baseado em 6+ meses de histórico.')
                      : rawData.insights.predictions.confidence >= 50
                        ? (t.dashboard.analytics.confidenceMedium ?? 'Mais dados melhoram a precisão.')
                        : (t.dashboard.analytics.confidenceLow ?? 'Histórico limitado.')
                    }
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedData.insights.map((insight: any, index: number) => {
            const typeConfig = {
              warning: { border: 'border-amber-500/25 hover:border-amber-500/40', bg: 'bg-amber-500/8', text: 'text-amber-400', icon: 'bg-amber-500/10 text-amber-400 border-amber-500/20', glow: 'shadow-amber-500/5' },
              danger:  { border: 'border-red-500/25 hover:border-red-500/40', bg: 'bg-red-500/8', text: 'text-red-400', icon: 'bg-red-500/10 text-red-400 border-red-500/20', glow: 'shadow-red-500/5' },
              success: { border: 'border-emerald-500/25 hover:border-emerald-500/40', bg: 'bg-emerald-500/8', text: 'text-emerald-400', icon: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-500/5' },
              info:    { border: 'border-blue-500/25 hover:border-blue-500/40', bg: 'bg-blue-500/8', text: 'text-blue-400', icon: 'bg-blue-500/10 text-blue-400 border-blue-500/20', glow: 'shadow-blue-500/5' },
            } as any;
            const cfg = typeConfig[insight.type] || typeConfig.info;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className={`group bg-slate-900/60 backdrop-blur-sm border rounded-2xl p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden shadow-lg ${cfg.border} ${cfg.glow}`}
              >
                {/* Left accent line */}
                <div className={`absolute top-0 left-0 w-0.5 h-full ${cfg.bg}`} style={{ backgroundColor: cfg.text.includes('amber') ? 'rgb(251 191 36 / 0.4)' : cfg.text.includes('red') ? 'rgb(248 113 113 / 0.4)' : cfg.text.includes('emerald') ? 'rgb(52 211 153 / 0.4)' : 'rgb(96 165 250 / 0.4)' }} />

                <div className="flex items-start gap-3 pl-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.icon}`}>
                    <Activity size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm leading-snug">{insight.title}</h4>
                    {insight.value !== undefined && insight.value !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold tabular-nums ${cfg.text}`}>{insight.value.toFixed(insight.value < 1 ? 1 : 0)}</span>
                        {insight.trend && (
                          <span className={`text-[10px] font-bold ${
                            insight.trend === 'up' ? 'text-emerald-400' : insight.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            {insight.trend === 'up' ? '▲' : insight.trend === 'down' ? '▼' : '●'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-slate-300 text-xs leading-relaxed pl-2 line-clamp-3">
                  {insight.message}
                </p>

                <div className="mt-auto pt-2 pl-2">
                  <button className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors cursor-pointer group/btn">
                    {t.dashboard.analytics.viewDetails}
                    <ArrowUpRight size={10} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
      )}

      {/* Vault Transaction Modal */}
      <AnimatePresence>
        {vaultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!vaultLoading) {
                  setVaultModal(null);
                  setVaultAmount('');
                }
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
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
                      {vaultModal.action === 'add' ? t.dashboard.analytics.add : t.dashboard.analytics.withdraw}
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
                    {t.dashboard.analytics.value}
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
                    {t.dashboard.analytics.cancel}
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
                    {vaultLoading ? t.dashboard.analytics.processing : vaultModal.action === 'add' ? t.dashboard.analytics.add : t.dashboard.analytics.withdraw}
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
    </motion.div>
  );
}

