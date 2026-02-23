'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import api, { fetcher } from '@/lib/api';
import useSWR, { mutate } from 'swr';
import { useDashboardSnapshot } from '@/lib/hooks/useDashboard';
import { ArrowUpCircle, ArrowDownCircle, Wallet, ChevronRight, AlertCircle, Zap, Target, Loader2, ShieldCheck, Sparkles, TrendingUp, TrendingDown, Plus, Calendar, ChevronLeft, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import PricingModal from '@/components/PricingModal';
import TransactionAddModal from '@/components/TransactionAddModal';
import { DEMO_TRANSACTIONS, DEMO_CATEGORIES } from '@/lib/mockData';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Toast from '@/components/Toast';
// canvas-confetti carregado dinamicamente (só quando necessário -- raro)
import { useUser } from '@/lib/UserContext';
import LoadingScreen from '@/components/LoadingScreen';
import { hasProAccess } from '@/lib/utils';

export default function DashboardPage() {
  const { t, formatCurrency } = useTranslation();
  const { refreshUser } = useUser();
  const searchParams = useSearchParams();
  const [isPro, setIsPro] = useState(false);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [stats, setStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0,
    vault: 0,
    dailyAllowance: 0,
    remainingMoney: 0,
    totalBudget: 0,
    vaultEmergency: 0,
    vaultInvestment: 0
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLowData, setHasLowData] = useState(false);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Guardar último valor válido das percentagens para evitar que desapareçam quando dados recalculam
  const lastValidPercentages = useRef<{ vsIncome: any; vsExpenses: any; vsBalance: any } | null>(null);

  // Usar SWR para cache inteligente; viewMonth filtra snapshot por mês (backend month 1-12)
  const { snapshot, collections, isLoading: snapshotLoading, mutate: mutateSnapshot } = useDashboardSnapshot(
    viewMonth.year,
    viewMonth.month + 1
  );
  
  // Buscar snapshot do mês anterior para comparação
  const prevMonth = useMemo(() => {
    if (viewMonth.month === 0) {
      // Se estamos em janeiro (month 0), mês anterior é dezembro do ano anterior
      return { year: viewMonth.year - 1, month: 12 };
    }
    // Caso contrário, mês anterior é o mês atual - 1
    // viewMonth.month é 0-11, então mês anterior é viewMonth.month - 1 (ainda em formato 0-11)
    const prevMonthIndex = viewMonth.month - 1; // 0-11
    return { year: viewMonth.year, month: prevMonthIndex };
  }, [viewMonth]);
  
  const { snapshot: prevSnapshot } = useDashboardSnapshot(
    prevMonth.year,
    prevMonth.month === 12 ? 12 : prevMonth.month + 1 // Converter de 0-11 para 1-12, exceto dezembro que já é 12
  );
  
  // Buscar invoices separadamente (não está no snapshot)
  const { data: invoicesData } = useSWR('/stripe/invoices', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  
  // Buscar user profile para subscription status
  const { data: userData, mutate: mutateUserData } = useSWR('/auth/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  // Dados para gráficos (Evolução 6 meses + Despesas por categoria) e "vs. mês anterior"
  const hasActiveSub = useMemo(() => hasProAccess(userData), [userData]);
  const { data: compositeData } = useSWR(hasActiveSub ? '/insights/composite' : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  
  // Ao carregar o dashboard, forçar recarga de dados (snapshot, user, invoices)
  useEffect(() => {
    mutateSnapshot();
    mutateUserData();
    mutate('/stripe/invoices');
  }, [mutateSnapshot, mutateUserData]);

  // Verificar se voltou do pagamento: aguardar refresh de user/snapshot antes de limpar, para o modo Pro aparecer sem F5
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    const proActivated = sessionStorage.getItem('pro_activated_success');
    
    if (proActivated === 'true') {
      (async () => {
        await refreshUser();
        await mutateUserData();
        await mutate('/stripe/invoices');
        await mutateSnapshot();
        sessionStorage.removeItem('pro_activated_success');
      })();
    }
    if (sessionId) {
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, refreshUser, mutateUserData, mutateSnapshot]);
  
  // Memoizar cálculos pesados (hasActiveSub já definido acima para composite)
  
  // Paywall removido - não mostrar automaticamente para contas free
  // const shouldShowPaywall = useMemo(() => {
  //   return !hasActiveSub && !searchParams.get('session_id');
  // }, [hasActiveSub, searchParams]);

  const fetchData = useCallback(async () => {
      // Se snapshot ainda está a carregar ou faltam dados, não fazer nada (evita loading preso)
      if (snapshotLoading || !snapshot || !collections) {
        return;
      }
      try {
        // Não voltar a setLoading(true) aqui: no refresh/revalidação os dados já estão visíveis,
        // e mostrar loading de novo fazia o conteúdo "desaparecer" à frente do utilizador
        const user = userData;
        const invoices = invoicesData || [];
        
        // Verificar se há faturas não pagas
        const hasUnpaid = invoices.some((inv: any) => 
          inv?.status?.toLowerCase() === 'unpaid' || 
          (inv?.status?.toLowerCase() === 'open' && inv?.amount_due > 0)
        );

        if (hasUnpaid) {
          setToast({
            show: true,
            message: t.dashboard.page.unpaidPaymentsAlert,
            type: 'error'
          });
        }
        
        // Usar hasActiveSub memoizado
        setIsPro(hasActiveSub);
        
        // Paywall removido - contas free vão direto para o dashboard

        // Usar snapshot calculado pelo backend (sem cálculos no frontend!)
        const transactions = collections.recent_transactions || collections.transactions || [];
        const categories = collections.categories || [];
        
        // Verificar se o utilizador está no mês atual para decidir se mostra demo
        const now = new Date();
        const isCurrentMonth = viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth();
        
        // Só mostrar dados demo se: não é Pro, está no mês atual, e não tem transações
        // Para meses futuros/passados sem dados, mostrar zeros (não dados mock)
        const isDemoMode = !hasActiveSub && isCurrentMonth && transactions.length === 0;
        // Admins/Pro nunca veem Modo Demo – têm acesso completo
        const lowData = !hasActiveSub && (transactions.length < 10 || isDemoMode);

        // Se não for Pro e não tiver transações no mês atual, usar demo
        let finalTransactions = transactions;
        let finalCategories = categories;
        if (isDemoMode) {
          finalTransactions = DEMO_TRANSACTIONS;
          finalCategories = DEMO_CATEGORIES;
        }

        // Calcular alertas baseado em categories e snapshot
        const categoryMap = finalCategories.reduce((acc: any, cat: any) => {
          acc[cat.id] = { ...cat, total: 0 };
          return acc;
        }, {});

        // Calcular totais por categoria para alertas
        finalTransactions.forEach((t: any) => {
          const cat = categoryMap[t.category_id];
          if (cat && cat.vault_type === 'none') {
            const amount = Math.abs(Number(t.amount_cents || 0) / 100);
            cat.total += amount;
          }
        });

        // Calcular Alertas
        const newAlerts = finalCategories
          .filter((cat: any) => cat.type === 'expense' && cat.monthly_limit_cents > 0)
          .map((cat: any) => {
            const currentSpent = categoryMap[cat.id]?.total || 0;
            const limit = cat.monthly_limit_cents / 100;
            const progress = (currentSpent / limit) * 100;
            
            if (progress >= 100) {
              const overAmount = currentSpent - limit;
              return {
                type: 'danger',
                title: overAmount > 0 ? t.dashboard.page.limitExceeded : t.dashboard.page.limitReached,
                message: overAmount > 0 
                  ? t.dashboard.page.limitExceededMessage.replace('{amount}', formatCurrency(overAmount)).replace('{category}', cat.name)
                  : t.dashboard.page.limitReachedMessage.replace('{amount}', formatCurrency(limit)).replace('{category}', cat.name),
                category: cat.name,
                icon: 'AlertCircle'
              };
            } else if (progress >= 80) {
              return {
                type: 'warning',
                title: t.dashboard.page.attentionToLimit,
                message: t.dashboard.page.limitProgressMessage.replace('{pct}', String(Math.max(1, Math.round(100 - progress)))).replace('{name}', cat.name),
                category: cat.name,
                icon: 'Zap'
              };
            }
            return null;
          })
          .filter(Boolean);

        setAlerts(newAlerts);
        setHasLowData(lowData);
        
        // Usar dados do snapshot (já calculados pelo backend)
        const totalLimits = finalCategories
          .filter((c: any) => c.type === 'expense')
          .reduce((sum: number, c: any) => sum + (Number(c.monthly_limit_cents || 0) / 100), 0);
        
        const totalBudget = snapshot.income > 0 ? snapshot.income : totalLimits;
        const remainingMoney = Math.max(0, totalBudget - (snapshot.expenses || 0));

        // Usar snapshot do backend (fonte única de verdade)
        setStats({ 
          income: snapshot.income || 0, 
          expenses: snapshot.expenses || 0, 
          balance: (snapshot.income || 0) - (snapshot.expenses || 0), 
          vault: snapshot.vault_total || 0,
          dailyAllowance: snapshot.daily_allowance || 0,
          remainingMoney,
          totalBudget,
          vaultEmergency: snapshot.vault_emergency || 0,
          vaultInvestment: snapshot.vault_investment || 0
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        
        // Prefetch analytics em background (não bloqueia)
        if (isPro) {
          api.get('/insights/composite').catch(() => {
            // Silenciar erros de prefetch
          });
        }
      }
    }, [snapshot, collections, snapshotLoading, userData, invoicesData, hasActiveSub, formatCurrency, isPro, viewMonth.year, viewMonth.month]);
  
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      setIsProcessingUpgrade(true);
      
      // Verificar status da subscrição através do novo endpoint
      const verifyAndActivate = async (retryCount = 0) => {
        try {
          // Verificar a sessão no Stripe e atualizar subscrição
          const verifyRes = await api.get(`/stripe/verify-session/${sessionId}`);
          
          if (verifyRes.data.success && verifyRes.data.is_active) {
            // Subscrição ativa! Recarregar user e caches SWR para o modo demo desaparecer sem F5
            await refreshUser();
            await mutateUserData();
            await mutate('/stripe/invoices');
            await mutateSnapshot();
            
            setIsPro(true);
            setShowPaywall(false);
            setIsProcessingUpgrade(false);
            window.history.replaceState({}, '', '/dashboard');
            import('canvas-confetti').then(mod => mod.default({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#fbbf24', '#ffffff']
            })).catch(() => {});
          } else if (retryCount < 5) {
            // Ainda não está completo, tentar novamente
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            // Máximo de tentativas alcançado
            setIsProcessingUpgrade(false);
            setToast({
              show: true,
              message: t.dashboard.page.paymentProcessing,
              type: 'success'
            });
            window.history.replaceState({}, '', '/dashboard');
          }
        } catch (err: any) {
          console.error('Erro ao verificar sessão:', err);
          
          // Se o erro for 404 ou similar, pode ser que o webhook ainda não processou
          if (retryCount < 5 && err.response?.status !== 403) {
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            setIsProcessingUpgrade(false);
            setToast({
              show: true,
              message: t.dashboard.page.paymentVerifyError,
              type: 'error'
            });
            window.history.replaceState({}, '', '/dashboard');
          }
        }
      };
      
      // Começar verificação após pequeno delay para dar tempo ao webhook
      setTimeout(() => verifyAndActivate(), 2000);
    }
  }, [searchParams, refreshUser, mutateUserData, mutateSnapshot]);

  // Carregar dados quando snapshot estiver pronto; ao mudar viewMonth o hook pede novo mês e snapshot/collections atualizam
  useEffect(() => {
    if (!userData) return;
    if (snapshotLoading || !snapshot || !collections) {
      // Se o snapshot terminou de carregar mas não tem dados (erro), desbloquear loading
      if (!snapshotLoading && !snapshot) setLoading(false);
      return;
    }
    fetchData();
  }, [snapshot, collections, userData, snapshotLoading, fetchData]);

  // Ao mudar o mês nas setas, forçar revalidação do snapshot para esse mês (não no primeiro mount)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    mutateSnapshot();
  }, [viewMonth.year, viewMonth.month, mutateSnapshot]);

  // Prefetch da Análise Pro -- usa SWR mutate para aquecer cache sem duplicar requests
  useEffect(() => {
    if (!loading && isPro) {
      const timer = setTimeout(() => {
        // Revalidar SWR cache em background (sem fetch duplicado)
        mutate('/insights/composite');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loading, isPro]);

  // Dados para gráficos e "vs. mês anterior" (flow últimos 6 meses + distribution)
  const chartProcessed = useMemo(() => {
    // Se for Pro, só usar dados reais quando compositeData estiver disponível
    // Se não for Pro ou compositeData ainda não chegou, usar dados demo
    // Evita mostrar dados demo temporários que depois mudam para dados reais quando for Pro
    const isProWaitingForData = hasActiveSub && !compositeData;
    const shouldUseRealData = hasActiveSub && compositeData && !snapshotLoading && snapshot && collections;
    
    // Se for Pro mas ainda não tem compositeData, usar array vazio para não mostrar dados demo temporários
    // Se não for Pro, usar dados demo normalmente
    const raw = shouldUseRealData
      ? { transactions: compositeData.transactions || [], categories: compositeData.categories || [] }
      : isProWaitingForData
        ? { transactions: [], categories: [] } // Pro aguardando dados - não mostrar demo temporário que depois muda
        : { transactions: DEMO_TRANSACTIONS, categories: DEMO_CATEGORIES }; // Não Pro - dados demo são intencionais
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
    const monthlyData: Record<string, { name: string; income: number; expenses: number }> = {};
    const catDistribution: Record<string, number> = {};
    const monthOrder = (s: string) => {
      const [m, y] = s.split(' ');
      const months: Record<string, number> = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };
      return new Date(parseInt(y, 10), ((months[m?.toLowerCase() ?? ''] ?? 1) - 1), 1).getTime();
    };

    raw.transactions
      .filter((t: any) => Math.abs((t.amount_cents || 0)) !== 1)
      .forEach((t: any) => {
        const date = new Date(t.transaction_date);
        if (date < sixMonthsAgo || date > todayStart) return;
        const monthYear = `${date.toLocaleString('pt-PT', { month: 'short' })} ${date.getFullYear()}`;
        const cat = raw.categories.find((c: any) => c.id === t.category_id);
        if (cat?.vault_type && cat.vault_type !== 'none') return;
        if (!monthlyData[monthYear]) monthlyData[monthYear] = { name: monthYear, income: 0, expenses: 0 };
        const amount = (t.amount_cents || 0) / 100;
        if (cat?.type === 'income') {
          monthlyData[monthYear].income += amount;
        } else {
          const exp = amount < 0 ? -amount : amount;
          monthlyData[monthYear].expenses += exp;
          const catName = cat?.name || 'Outros';
          catDistribution[catName] = (catDistribution[catName] || 0) + exp;
        }
      });

    const flow6 = Object.values(monthlyData).sort((a, b) => monthOrder(a.name) - monthOrder(b.name)).slice(-6);
    const distribution = Object.entries(catDistribution).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Fundos por mês (Emergência + Investimentos) – saldo acumulado por mês para gráfico de linhas
    const vaultMonthlyMap: Record<string, { name: string; emergency: number; investment: number }> = {};
    const vaultTxs = raw.transactions
      .filter((t: any) => Math.abs((t.amount_cents || 0)) !== 1)
      .map((t: any) => ({ ...t, cat: raw.categories.find((c: any) => c.id === t.category_id) }))
      .filter((t: any) => t.cat && (t.cat.vault_type === 'emergency' || t.cat.vault_type === 'investment'))
      .sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    vaultTxs.forEach((t: any) => {
      const date = new Date(t.transaction_date);
      if (date < sixMonthsAgo || date > todayStart) return;
      const monthYear = `${date.toLocaleString('pt-PT', { month: 'short' })} ${date.getFullYear()}`;
      if (!vaultMonthlyMap[monthYear]) vaultMonthlyMap[monthYear] = { name: monthYear, emergency: 0, investment: 0 };
      const amt = (t.amount_cents || 0) / 100;
      if (t.cat.vault_type === 'emergency') vaultMonthlyMap[monthYear].emergency += amt;
      else vaultMonthlyMap[monthYear].investment += amt;
    });
    // Acumular por ordem de mês
    const vaultMonthlySorted = Object.values(vaultMonthlyMap).sort((a, b) => monthOrder(a.name) - monthOrder(b.name)).slice(-6);
    let cumE = 0, cumI = 0;
    const vaultByMonth = vaultMonthlySorted.map((m) => {
      cumE += m.emergency;
      cumI += m.investment;
      return { name: m.name, Emergência: cumE, Investimentos: cumI };
    });

    // Calcular percentagens comparando mês atual com mês anterior
    // Usar snapshot do mês anterior se disponível, senão usar dados do flow6
    // Não mostrar durante loading inicial para evitar valores incorretos temporários
    // Guardar último valor válido para não desaparecer quando dados recalculam temporariamente
    const hasCurrentData = !loading && !snapshotLoading && snapshot && collections;
    
    // Tentar usar snapshot do mês anterior primeiro (mais preciso)
    const prevIncomeFromSnapshot = prevSnapshot?.income ?? null;
    const prevExpensesFromSnapshot = prevSnapshot?.expenses ?? null;
    const prevBalanceFromSnapshot = prevIncomeFromSnapshot !== null && prevExpensesFromSnapshot !== null 
      ? prevIncomeFromSnapshot - prevExpensesFromSnapshot 
      : null;
    
    // Se não tiver snapshot anterior, tentar usar dados do flow6
    const prevFromFlow6 = flow6.length >= 2 ? flow6[flow6.length - 2] : null;
    const prevIncome = prevIncomeFromSnapshot !== null ? prevIncomeFromSnapshot : (prevFromFlow6?.income ?? null);
    const prevExpenses = prevExpensesFromSnapshot !== null ? prevExpensesFromSnapshot : (prevFromFlow6?.expenses ?? null);
    const prevBalance = prevBalanceFromSnapshot !== null ? prevBalanceFromSnapshot : (prevFromFlow6 ? prevFromFlow6.income - prevFromFlow6.expenses : null);
    
    // Sempre calcular percentagens quando temos dados do mês atual
    // Se não tivermos dados do mês anterior, comparar com 0 (primeiro mês)
    const canCalculatePercentages = hasCurrentData;
    
    let vsIncome, vsExpenses, vsBalance;
    
    if (canCalculatePercentages) {
      // Calcular novas percentagens comparando mês atual com anterior
      // Só calcular se tivermos dados do mês anterior (não usar 0 como fallback)
      
      // Para receitas e despesas, verificar se temos dados anteriores
      if (prevIncome === null) {
        vsIncome = { pct: null, label: '—' };
      } else if (prevIncome === 0) {
        vsIncome = stats.income > 0 
          ? { pct: Infinity, label: t.dashboard.page.newLabel }
          : { pct: 0, label: '0%' };
      } else {
        const incomeChange = ((stats.income - prevIncome) / prevIncome) * 100;
        vsIncome = { 
          pct: incomeChange, 
          label: incomeChange >= 0 ? `+${incomeChange.toFixed(1)}%` : `${incomeChange.toFixed(1)}%` 
        };
      }
      
      if (prevExpenses === null) {
        vsExpenses = { pct: null, label: '—' };
      } else if (prevExpenses === 0) {
        vsExpenses = stats.expenses > 0 
          ? { pct: Infinity, label: t.dashboard.page.newLabel }
          : { pct: 0, label: '0%' };
      } else {
        const expensesChange = ((stats.expenses - prevExpenses) / prevExpenses) * 100;
        vsExpenses = { 
          pct: expensesChange, 
          label: expensesChange >= 0 ? `+${expensesChange.toFixed(1)}%` : `${expensesChange.toFixed(1)}%` 
        };
      }
      
      // Para balance, verificar se temos dados válidos do mês anterior
      if (prevBalance === null) {
        vsBalance = { pct: null, label: '—' };
      } else if (prevBalance === 0) {
        // Se o saldo anterior era realmente 0, calcular percentagem corretamente
        // Se o saldo atual é positivo, é um aumento infinito (de 0 para X)
        // Se o saldo atual é negativo, é uma diminuição infinita (de 0 para -X)
        vsBalance = stats.balance !== 0
          ? { pct: stats.balance > 0 ? Infinity : -Infinity, label: t.dashboard.page.newLabel }
          : { pct: 0, label: '0%' };
      } else {
        // Calcular percentagem normalmente quando temos valores válidos
        const balanceChange = ((stats.balance - prevBalance) / Math.abs(prevBalance)) * 100;
        vsBalance = { 
          pct: balanceChange, 
          label: balanceChange >= 0 ? `+${balanceChange.toFixed(1)}%` : `${balanceChange.toFixed(1)}%` 
        };
      }
      
      // Guardar valores válidos apenas se calculámos percentagens válidas
      if (vsIncome.pct !== null || vsExpenses.pct !== null || vsBalance.pct !== null) {
        lastValidPercentages.current = { vsIncome, vsExpenses, vsBalance };
      }
    } else {
      // Usar último valor válido se existir, senão mostrar '—'
      if (lastValidPercentages.current) {
        vsIncome = lastValidPercentages.current.vsIncome;
        vsExpenses = lastValidPercentages.current.vsExpenses;
        vsBalance = lastValidPercentages.current.vsBalance;
      } else {
        vsIncome = { pct: null, label: '—' };
        vsExpenses = { pct: null, label: '—' };
        vsBalance = { pct: null, label: '—' };
      }
    }

    return { flow6, distribution, vsIncome, vsExpenses, vsBalance, vaultByMonth };
  }, [hasActiveSub, compositeData, stats.income, stats.expenses, stats.balance, snapshotLoading, snapshot, collections, loading, prevSnapshot, prevMonth]);

  const defaultName = t.dashboard.page.defaultUserName;
  const userName = (userData?.full_name || (userData?.email || '').split('@')[0] || defaultName).trim() || defaultName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.dashboard.page.greetingMorning : hour < 18 ? t.dashboard.page.greetingAfternoon : t.dashboard.page.greetingEvening;
  const filterMonthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const visibleAlerts = alerts.slice(0, 2);
  const hasMoreAlerts = alerts.length > 2;
  const budgetUsage = stats.totalBudget > 0 ? (stats.expenses / stats.totalBudget) * 100 : 0;
  const quickInsights = hasLowData
    ? [
        t.dashboard.page.insightStartWell,
        t.dashboard.page.insightFewRecords,
        t.dashboard.page.insightTip
      ]
    : [
        stats.dailyAllowance > 0
          ? t.dashboard.page.insightDailyAllowance.replace('{amount}', formatCurrency(stats.dailyAllowance))
          : t.dashboard.page.insightNoBudget,
        stats.balance >= 0
          ? t.dashboard.page.positiveBalance
          : t.dashboard.page.negativeBalance,
        stats.totalBudget > 0
          ? t.dashboard.page.insightBudgetUsed.replace('{pct}', String(Math.min(100, Math.round(budgetUsage))))
          : t.dashboard.page.insightNoMonthlyBudget
      ];

  if (loading) {
    return <LoadingScreen />;
  }

  const motionOpts = isMobile
    ? { initial: { opacity: 1 } as const, animate: { opacity: 1 } as const, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 20 } as const, animate: { opacity: 1, y: 0 } as const, transition: { duration: 0.5 } };

  return (
    <motion.div
      {...motionOpts}
      className="text-white pb-20 -mt-4"
    >
      {/* Cabeçalho: saudação + resumo | Modo Demo + Upgrade Pro */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 mt-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
            {greeting}, {userName}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic mt-1">{t.dashboard.page.headerSubtitle}</p>
        </div>
        {!isPro && (
          <motion.div
            data-onboarding-target="upgrade-pro"
            initial={isMobile ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={isMobile ? { duration: 0 } : undefined}
            className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-amber-500/10 border border-amber-500/20 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl w-full sm:w-auto shrink-0"
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

      {/* Filtros (esquerda) | Nova transação (direita) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.page.filters}</span>
          <div className="flex items-center gap-0.5 bg-slate-900/70 border border-slate-700/60 rounded-lg px-2 py-1.5">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <button
              type="button"
              disabled={snapshotLoading}
              onClick={() => setViewMonth((p: { year: number; month: number }) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }))}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t.dashboard.page.previousMonth}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-white min-w-[100px] sm:min-w-[130px] text-center capitalize flex items-center justify-center gap-1.5">
              {snapshotLoading ? <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" /> : null}
              {filterMonthLabel}
            </span>
            <button
              type="button"
              disabled={snapshotLoading}
              onClick={() => setViewMonth((p: { year: number; month: number }) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }))}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t.dashboard.page.nextMonth}
            >
              <ChevronRight size={16} />
            </button>
            {(() => {
              const now = new Date();
              const isCurrentMonth = viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth();
              if (isCurrentMonth) return null;
              return (
                <button
                  type="button"
                  onClick={() => setViewMonth({ year: now.getFullYear(), month: now.getMonth() })}
                  className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t.dashboard.page.currentMonth}
                </button>
              );
            })()}
          </div>
        </div>
        {hasActiveSub && (
          <button
            type="button"
            onClick={() => setShowAddTransactionModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 w-full sm:w-auto"
          >
            <Plus size={16} className="shrink-0" />
            <span>{t.dashboard.page.newTransaction}</span>
          </button>
        )}
      </div>

      {/* 3 cards: Receitas | Despesas | Saldo */}
      <section className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <motion.div
            whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 rounded-2xl border border-slate-700/60 shadow-2xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                <ArrowUpCircle size={14} />
              </div>
              {chartProcessed.vsIncome.label && chartProcessed.vsIncome.label !== '—' && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${(chartProcessed.vsIncome.pct ?? 0) >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {(chartProcessed.vsIncome.pct ?? 0) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {chartProcessed.vsIncome.label}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.page.income}</p>
            <p className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums truncate" title={formatCurrency(stats.income)}>{formatCurrency(stats.income)}</p>
          </motion.div>

          <motion.div
            whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 rounded-2xl border border-slate-700/60 shadow-2xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center justify-center shrink-0">
                <ArrowDownCircle size={14} />
              </div>
              {chartProcessed.vsExpenses.label && chartProcessed.vsExpenses.label !== '—' && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${(chartProcessed.vsExpenses.pct ?? 0) <= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {(chartProcessed.vsExpenses.pct ?? 0) <= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                  {chartProcessed.vsExpenses.label}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.page.expenses}</p>
            <p className="text-lg sm:text-xl font-black text-red-400 tabular-nums truncate" title={formatCurrency(stats.expenses)}>{formatCurrency(stats.expenses)}</p>
          </motion.div>

          <motion.div
            whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="bg-slate-900/70 backdrop-blur-md p-4 rounded-2xl border border-slate-700/60 shadow-2xl group sm:col-span-2 md:col-span-1"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${stats.balance >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <Wallet size={14} />
              </div>
              {chartProcessed.vsBalance.label && chartProcessed.vsBalance.label !== '—' && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${(chartProcessed.vsBalance.pct ?? 0) >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {(chartProcessed.vsBalance.pct ?? 0) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {chartProcessed.vsBalance.label}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{t.dashboard.page.balance}</p>
            <p className={`text-lg sm:text-xl font-black tabular-nums truncate ${stats.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`} title={formatCurrency(stats.balance)}>
              {formatCurrency(stats.balance)}
            </p>
          </motion.div>
        </div>
      </section>

      {/* 4 quadrados: [Evolução] [Analytics donut]; [Fundos] — scroll-section no mobile para content-visibility */}
      <section className="scroll-section mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Activity size={13} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.page.charts}</h2>
          </div>
          {isPro && (
            <Link href="/analytics" className="text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors">
              {t.dashboard.page.viewFullAnalysis}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quadrado 1: Evolução Financeira – ocupa 2/3 */}
          <motion.div
            initial={isMobile ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0 } : {}}
            className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl lg:col-span-2"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-0.5">{t.dashboard.page.financialEvolution}</h3>
            <p className="text-[10px] text-slate-500 font-medium italic mb-3">{t.dashboard.page.last6Months}</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartProcessed.flow6} margin={{ top: 10, right: 10, left: 0, bottom: isMobile ? 5 : 0 }}>
                  <defs>
                    <linearGradient id="dashIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={isMobile ? 9 : 10} 
                    fontWeight="bold" 
                    interval={0}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                    height={isMobile ? 50 : 30}
                  />
                  <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={72} />
                  <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                  <Area type="monotone" dataKey="income" name={t.dashboard.page.income} stroke="#10b981" fill="url(#dashIncome)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name={t.dashboard.page.expenses} stroke="#ef4444" fill="url(#dashExpenses)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-end gap-6 mt-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="text-emerald-400">● {t.dashboard.page.incomeLabel}</span>
              <span className="text-red-400">● {t.dashboard.page.expenseLabel}</span>
            </div>
          </motion.div>

          {/* Quadrado 2+4: Analytics – coluna direita 1/3 */}
          <motion.div
            initial={isMobile ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={isMobile ? { duration: 0 } : { delay: 0.05 }}
            className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:col-span-1 lg:row-span-2 min-h-[420px] lg:min-h-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Activity size={14} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">{t.dashboard.page.analyticsTitle}</h3>
                <p className="text-[10px] text-slate-500 font-medium">{t.dashboard.page.expensesByCategory}</p>
              </div>
            </div>
            <div className="relative flex-1 min-h-[280px] w-full flex items-center justify-center">
              {chartProcessed.distribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartProcessed.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius="45%"
                        outerRadius="70%"
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={false}
                      >
                        {chartProcessed.distribution.map((_, i) => (
                          <Cell key={i} fill={['#38bdf8','#2dd4bf','#a78bfa','#f472b6','#facc15','#fdba74','#34d399','#22d3ee'][i % 8]} stroke="rgba(15,23,42,0.6)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value ?? 0), name ?? '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-black text-white">
                        {chartProcessed.distribution.length > 0
                          ? `${((chartProcessed.distribution[0].value / chartProcessed.distribution.reduce((s, x) => s + x.value, 0)) * 100).toFixed(0)}%`
                          : '—'}
                      </p>
                      <p className="text-sm font-bold text-white/90 mt-0.5 capitalize">
                        {chartProcessed.distribution[0]?.name ?? '—'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-sm italic">{t.dashboard.page.noExpensesByCategory}</p>
              )}
            </div>
            {chartProcessed.distribution.length > 0 && (
              <>
                <div className="mt-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-700/60 flex flex-row items-center justify-between gap-4 shrink-0">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</p>
                    <p className="text-lg font-black text-white">
                      {formatCurrency(chartProcessed.distribution.reduce((s, x) => s + x.value, 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.page.biggestExpense}</p>
                    <p className="text-lg font-black text-violet-400 capitalize">
                      {chartProcessed.distribution[0]?.name ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-700/60 space-y-2 shrink-0 overflow-auto max-h-[180px]">
                  {chartProcessed.distribution.map((entry, i) => {
                    const total = chartProcessed.distribution.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                    const color = ['#38bdf8','#2dd4bf','#a78bfa','#f472b6','#facc15','#fdba74','#34d399','#22d3ee'][i % 8];
                    return (
                      <div key={`dist-${i}-${entry.name}`} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-300 font-medium truncate capitalize">{entry.name}</span>
                        </div>
                        <span className="text-white font-bold shrink-0 ml-2">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* Metade esquerda (2/3 da linha): dentro, Fundos 1/3 + Distribuição 2/3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:col-span-2">
            {/* Fundos · Investimentos e Emergência – 1/3 da metade */}
            <motion.div
              initial={isMobile ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={isMobile ? { duration: 0 } : { delay: 0.08 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:col-span-1"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">{t.dashboard.page.fundsInvestmentsEmergency}</h3>
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900/70 border border-slate-700/60 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{t.dashboard.vault.emergencyFund}</p>
                      <p className="text-sm font-black text-white truncate">{formatCurrency(stats.vaultEmergency)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full sm:w-14 sm:shrink-0 sm:min-w-[3.5rem] bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-amber-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (stats.vaultEmergency / Math.max(1, stats.vaultEmergency + stats.vaultInvestment)) * 100)}%` }}
                      transition={{ duration: isMobile ? 0 : 0.5 }}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900/70 border border-slate-700/60 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Target size={16} />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{t.dashboard.vault.investments}</p>
                      <p className="text-sm font-black text-white truncate">{formatCurrency(stats.vaultInvestment)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full sm:w-14 sm:shrink-0 sm:min-w-[3.5rem] bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (stats.vaultInvestment / Math.max(1, stats.vaultEmergency + stats.vaultInvestment)) * 100)}%` }}
                      transition={{ duration: isMobile ? 0 : 0.5 }}
                    />
                  </div>
                </div>
                <div className="py-2 px-3 rounded-xl bg-slate-900/70 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.page.totalFunds}</span>
                  <span className="text-sm font-black text-white">{formatCurrency(stats.vaultEmergency + stats.vaultInvestment)}</span>
                </div>
              </div>
              {isPro && (
                <Link href="/vault" className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
                  {t.dashboard.page.viewVaults} <ChevronRight size={12} />
                </Link>
              )}
            </motion.div>

            {/* Distribuição de fundos por mês – 2/3 da metade */}
            <motion.div
              initial={isMobile ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={isMobile ? { duration: 0 } : { delay: 0.1 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:col-span-2"
            >
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">{t.dashboard.page.fundsDistributionByMonth}</h3>
            <div className="flex-1 min-h-[180px] flex items-center justify-center">
              {chartProcessed.vaultByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartProcessed.vaultByMonth} margin={{ top: 10, right: 10, left: 0, bottom: isMobile ? 5 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={isMobile ? 9 : 10} 
                      fontWeight="bold" 
                      interval={0}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      height={isMobile ? 50 : 30}
                    />
                    <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={56} />
                    <Tooltip contentStyle={{ backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '12px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                    <Line type="monotone" dataKey="Emergência" name={t.dashboard.page.emergency} stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                    <Line type="monotone" dataKey="Investimentos" name={t.dashboard.page.investments} stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-500 text-sm italic text-center">{t.dashboard.page.noVaultData}</p>
              )}
            </div>
            {chartProcessed.vaultByMonth.length > 0 && (
              <div className="flex items-center justify-end gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-amber-400">— {t.dashboard.page.emergency}</span>
                <span className="text-blue-400">— {t.dashboard.page.investments}</span>
              </div>
            )}
          </motion.div>
          </div>
        </div>
      </section>

      <section className="scroll-section mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Sparkles size={13} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.page.quickInsightsTitle}</h2>
          </div>
          {isPro && (
            <Link href="/analytics" className="text-[9px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors">
              {t.dashboard.page.viewDetails}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {quickInsights.map((insight, index) => (
            <div
              key={index}
              className="bg-slate-900/70 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/60 shadow-xl text-xs text-slate-300 font-medium italic flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles size={12} />
              </div>
              <span className="line-clamp-2">{insight}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Financial Health Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mb-8 space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={13} className="text-red-400" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">{t.dashboard.page.alerts}</h2>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md text-red-400">{alerts.length}</span>
              </div>
              {hasMoreAlerts && (
                <Link href="/categories" className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors">
                  {t.dashboard.page.viewMoreAlerts}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleAlerts.map((alert, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`relative overflow-hidden p-3.5 rounded-2xl border flex items-center gap-3 transition-all group ${
                    alert.type === 'danger' 
                      ? 'bg-red-500/[0.03] border-red-500/20 hover:border-red-500/35' 
                      : 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/35'
                  }`}
                >
                  <div className={`absolute top-0 left-0 w-0.5 h-full ${alert.type === 'danger' ? 'bg-red-500/50' : 'bg-amber-500/50'}`} />
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    alert.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {alert.icon === 'AlertCircle' ? <AlertCircle size={16} /> : <Zap size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-xs font-bold mb-0.5 ${alert.type === 'danger' ? 'text-red-400' : 'text-amber-400'}`}>
                      {alert.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium italic truncate">{alert.message}</p>
                  </div>
                  <Link 
                    href="/categories" 
                    className={`p-2 rounded-lg transition-all shrink-0 ${
                      alert.type === 'danger' ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    <ChevronRight size={16} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Overlay de Transição do Stripe */}
      <AnimatePresence>
        {isProcessingUpgrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-[#020617] flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            <div className="text-center space-y-2 relative z-10">
              <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] animate-pulse">
                {t.dashboard.loading.processingUpgrade} <span className="text-blue-500">{t.dashboard.page.upgradePro}</span>...
              </h2>
              <p className="text-slate-500 text-sm font-black uppercase tracking-widest italic">
                {t.dashboard.loading.preparingEcosystem}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <TransactionAddModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
        onSuccess={() => {
          setToast({ show: true, message: t.dashboard.transactions.success, type: 'success' });
          mutateSnapshot();
        }}
        categories={collections?.categories ?? []}
      />

      <PricingModal 
        isVisible={showPaywall} 
        onClose={() => setShowPaywall(false)} 
      />

      <Toast 
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </motion.div>
  );
}
