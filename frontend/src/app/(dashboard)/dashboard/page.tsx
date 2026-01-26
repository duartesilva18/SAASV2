'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import api, { fetcher } from '@/lib/api';
import useSWR, { mutate } from 'swr';
import { useDashboardSnapshot } from '@/lib/hooks/useDashboard';
// Lazy loading de charts para reduzir bundle inicial
import { 
  LazyBarChart, LazyBar, LazyAreaChart, LazyArea,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from '@/components/charts/LazyCharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Info, Lock, ArrowRight, ChevronRight, AlertCircle, Zap, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import ZenInsights from '@/components/ZenInsights';
import PricingModal from '@/components/PricingModal';
import { DEMO_TRANSACTIONS, DEMO_CATEGORIES } from '@/lib/mockData';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Toast from '@/components/Toast';
import confetti from 'canvas-confetti';
import { Check, Sparkles as SparklesIcon, Zap as ZapIcon, ArrowRightCircle, X, Loader2 } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import LoadingScreen from '@/components/LoadingScreen';
import PageLoading from '@/components/PageLoading';

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
    totalLimits: 0,
    dailyAllowance: 0,
    efficiencyScore: 0
  });
  const [chartData, setChartData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  // Usar SWR para cache inteligente e deduplicação
  const { snapshot, collections, isLoading: snapshotLoading, mutate: mutateSnapshot } = useDashboardSnapshot();
  
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
  
  // Verificar se voltou do pagamento e invalidar cache
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    const proActivated = sessionStorage.getItem('pro_activated_success');
    
    if (sessionId || proActivated === 'true') {
      // Invalidar cache do SWR para forçar refresh
      mutate('/auth/me');
      mutate('/stripe/invoices');
      mutateUserData();
      refreshUser();
      
      // Limpar sessionStorage e URL
      if (proActivated === 'true') {
        sessionStorage.removeItem('pro_activated_success');
      }
      if (sessionId) {
        window.history.replaceState({}, '', '/dashboard');
      }
    }
  }, [searchParams, refreshUser, mutateUserData]);
  
  // Memoizar cálculos pesados
  const hasActiveSub = useMemo(() => {
    return userData ? ['active', 'trialing', 'cancel_at_period_end'].includes(userData.subscription_status) : false;
  }, [userData]);
  
  // Paywall removido - não mostrar automaticamente para contas free
  // const shouldShowPaywall = useMemo(() => {
  //   return !hasActiveSub && !searchParams.get('session_id');
  // }, [hasActiveSub, searchParams]);

  const fetchData = useCallback(async () => {
      try {
        setLoading(true);
        
        // Se snapshot ainda está a carregar, esperar
        if (snapshotLoading || !snapshot || !collections) {
          return;
        }

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
            message: 'Atenção: Tens pagamentos em atraso. Verifica a tua faturação.',
            type: 'error'
          });
        }
        
        // Usar hasActiveSub memoizado
        setIsPro(hasActiveSub);
        
        // Paywall removido - contas free vão direto para o dashboard

        // Usar snapshot calculado pelo backend (sem cálculos no frontend!)
        const transactions = collections.recent_transactions || [];
        const categories = collections.categories || [];

        // Se não for Pro e não tiver transações, usar demo
        let finalTransactions = transactions;
        let finalCategories = categories;
        if (!hasActiveSub && transactions.length === 0) {
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
                title: overAmount > 0 ? 'Limite Excedido!' : 'Limite Atingido!',
                message: overAmount > 0 
                  ? `Gastaste mais ${formatCurrency(overAmount)} em ${cat.name} do que o planeado.`
                  : `Atingiste o teu limite planeado de ${formatCurrency(limit)} em ${cat.name}.`,
                category: cat.name,
                icon: 'AlertCircle'
              };
            } else if (progress >= 80) {
              return {
                type: 'warning',
                title: 'Atenção ao Limite',
                message: `Estás a ${Math.max(1, Math.round(100 - progress))}% de atingir o limite em ${cat.name}.`,
                category: cat.name,
                icon: 'Zap'
              };
            }
            return null;
          })
          .filter(Boolean);

        setAlerts(newAlerts);
        
        // Usar dados do snapshot (já calculados pelo backend)
        const totalLimits = finalCategories
          .filter((c: any) => c.type === 'expense')
          .reduce((sum: number, c: any) => sum + (Number(c.monthly_limit_cents || 0) / 100), 0);
        
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const daysLeft = Math.max(1, daysInMonth - daysPassed);
        
        // Processamento para o gráfico de Ritmo Diário
        const dailySpending: any = {};
        for (let i = 1; i <= daysInMonth; i++) {
          dailySpending[i] = 0;
        }

        finalTransactions.forEach((t: any) => {
          const tDate = new Date(t.transaction_date);
          if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) {
            const cat = categoryMap[t.category_id];
            if (cat && cat.type === 'expense' && cat.vault_type === 'none') {
              dailySpending[tDate.getDate()] += Math.abs(Number(t.amount_cents || 0) / 100);
            }
          }
        });

        const formattedTrendData = Object.entries(dailySpending).map(([day, amount]) => ({
          day: `${day}`,
          amount: Number(amount),
          limit: snapshot.daily_allowance > 0 ? snapshot.daily_allowance : null
        }));

        setTrendData(formattedTrendData as any);

        // Usar snapshot do backend (fonte única de verdade)
        setStats({ 
          income: snapshot.income || 0, 
          expenses: snapshot.expenses || 0, 
          balance: (snapshot.income || 0) - (snapshot.expenses || 0), 
          vault: snapshot.vault_total || 0,
          totalLimits: snapshot.income > 0 ? snapshot.income : totalLimits,
          dailyAllowance: snapshot.daily_allowance || 0,
          efficiencyScore: snapshot.saving_rate || 0
        });
        setChartData(Object.values(categoryMap).filter((c: any) => c.total > 0) as any);
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
    }, [snapshot, collections, snapshotLoading, userData, invoicesData, hasActiveSub, formatCurrency, isPro]);
  
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
            // Subscrição ativa! Recarregar dados do utilizador
            await refreshUser();
            const profileRes = await api.get('/auth/me');
            const user = profileRes.data;
            
            // Atualizar estado para remover modo demo e banners
            setIsPro(true);
            setShowPaywall(false); // Fechar paywall se estiver aberto
            setIsProcessingUpgrade(false);
            
            // Limpar a URL sem recarregar a página
            window.history.replaceState({}, '', '/dashboard');
            
            // Confetti de celebração
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#fbbf24', '#ffffff']
            });
            
            // Invalidar cache SWR para recarregar dados
            mutateSnapshot();
          } else if (retryCount < 5) {
            // Ainda não está completo, tentar novamente
            setTimeout(() => verifyAndActivate(retryCount + 1), 1500);
          } else {
            // Máximo de tentativas alcançado
            setIsProcessingUpgrade(false);
            setToast({
              show: true,
              message: 'O pagamento está a ser processado. A subscrição será ativada em breve.',
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
              message: 'Erro ao verificar pagamento. Por favor, recarrega a página.',
              type: 'error'
            });
            window.history.replaceState({}, '', '/dashboard');
          }
        }
      };
      
      // Começar verificação após pequeno delay para dar tempo ao webhook
      setTimeout(() => verifyAndActivate(), 2000);
    }
  }, [searchParams, refreshUser, mutateSnapshot]);

  // Carregar dados quando snapshot estiver pronto
  useEffect(() => {
    if (snapshot && collections && userData && !snapshotLoading) {
      fetchData();
    }
  }, [snapshot, collections, userData, snapshotLoading, fetchData]);

  // Prefetch dos dados da Análise Pro quando o dashboard já está carregado
  useEffect(() => {
    if (!loading && isPro) {
      // Aguardar 2 segundos após o dashboard carregar antes de fazer prefetch
      const timer = setTimeout(() => {
        const prefetchAnalytics = async () => {
          try {
            // Verificar se já existe cache recente (menos de 30 segundos)
            const cached = localStorage.getItem('analytics_cache');
            if (cached) {
              const { timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < 30000) {
                return; // Cache ainda fresca, não precisa atualizar
              }
            }
            
            const [profileRes, analyticsRes] = await Promise.all([
              api.get('/auth/me'),
              api.get('/insights/composite')
            ]);
            
            const user = profileRes.data;
            const hasActiveSub = ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status);
            
            if (!hasActiveSub) return; // Só prefetch se for Pro
            
            let compositeData = {
              ...analyticsRes.data,
              subscription_status: user.subscription_status
            };
            
            // Guardar no cache para uso imediato na página de analytics
            localStorage.setItem('analytics_cache', JSON.stringify({
              data: compositeData,
              timestamp: Date.now()
            }));
          } catch (err) {
            // Silenciar erros de prefetch - não é crítico
            console.log('Prefetch analytics em background falhou (não crítico)');
          }
        };
        
        prefetchAnalytics();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [loading, isPro]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-white pb-20"
    >
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-black tracking-tighter text-white">{t.dashboard.page.title}</h1>
        
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{t.dashboard.page.demoMode}</span>
            <Link 
              href="/pricing"
              className="ml-2 bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-colors"
            >
              {t.dashboard.page.upgradePro}
            </Link>
          </motion.div>
        )}
      </div>
      
      <div className="relative mb-12">
        <ZenInsights />
        {!isPro && (
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-[32px] border border-white/5 pointer-events-none">
            {/* Overlay contents are handled within components or removed for cleaner look if preferred */}
          </div>
        )}
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center space-x-6">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpCircle size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t.dashboard.page.income}</p>
              <p className="text-3xl font-black text-white tracking-tighter">
                {formatCurrency(stats.income)}
                <span className="text-emerald-400 ml-2 text-2xl">↑</span>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center space-x-6">
            <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownCircle size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t.dashboard.page.expenses}</p>
              <p className="text-3xl font-black text-white tracking-tighter">
                {formatCurrency(stats.expenses)}
                <span className="text-red-400 ml-2 text-2xl">↓</span>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center space-x-6">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t.dashboard.page.invested}</p>
              <p className="text-3xl font-black text-white tracking-tighter">
                {formatCurrency(stats.vault)}
                <span className="text-blue-400 ml-2 text-2xl">💎</span>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
        >
          <div className="flex items-center space-x-6">
            <div className="w-12 h-12 bg-slate-800/50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t.dashboard.page.balance}</p>
              <p className="text-3xl font-black text-white tracking-tighter">
                {formatCurrency(stats.balance)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Zen Projections & Unique Dashboard Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 p-10 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-blue-500 mb-2">{t.dashboard.page.monthlyCashFlow}</h3>
                <p className="text-3xl font-black text-white tracking-tighter">
                  {formatCurrency(stats.expenses)} <span className="text-slate-600 text-xl font-medium">/ {formatCurrency(stats.totalLimits || 0)}</span>
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>{t.dashboard.page.consumptionVsIncome}</span>
                  <span>{stats.totalLimits > 0 ? Math.round((stats.expenses / stats.totalLimits) * 100) : 0}% {t.dashboard.page.used}</span>
                </div>
                <div className="h-4 w-full bg-white/5 rounded-2xl p-1 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, stats.totalLimits > 0 ? (stats.expenses / stats.totalLimits) * 100 : 0)}%` }}
                    className={`h-full rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-colors duration-500 ${
                      (stats.expenses / stats.totalLimits) > 0.9 ? 'bg-red-500' : 
                      (stats.expenses / stats.totalLimits) > 0.7 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="w-px h-24 bg-white/5 hidden md:block" />

            <div className="space-y-2 text-center md:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{t.dashboard.page.dailyAllowance}</p>
              <p className={`text-4xl font-black tracking-tighter ${stats.dailyAllowance > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatCurrency(stats.dailyAllowance || 0)}
              </p>
              <p className="text-[9px] font-bold text-slate-600 uppercase italic">{t.dashboard.page.dailyAllowanceDesc}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-900/40 backdrop-blur-xl p-10 rounded-[32px] border border-white/5 shadow-2xl flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 text-center">{t.dashboard.page.efficiency}</h3>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Zap size={16} />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative flex items-center justify-center">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/5"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.4}
                  initial={{ strokeDashoffset: 364.4 }}
                  animate={{ strokeDashoffset: 364.4 - (364.4 * Math.max(0, Math.min(100, stats.efficiencyScore))) / 100 }}
                  className="text-emerald-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white leading-none">{Math.round(stats.efficiencyScore || 0)}%</span>
                <span className="text-[8px] font-black uppercase text-slate-500 mt-1">{t.dashboard.page.score}</span>
              </div>
            </div>
            
            <p className="text-center text-xs text-slate-400 font-medium italic mt-2 px-4 leading-relaxed">
              {stats.efficiencyScore > 30 ? t.dashboard.page.efficiencyMessages.excellent : 
               stats.efficiencyScore > 10 ? t.dashboard.page.efficiencyMessages.good :
               t.dashboard.page.efficiencyMessages.focus}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Telegram Promo Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-[32px] p-8 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <ArrowRightCircle size={80} className="text-blue-500 -rotate-45" />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-16 h-16 bg-blue-500 rounded-[24px] flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <ZapIcon size={32} className="text-white fill-white" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h3 className="text-xl font-black uppercase tracking-tight text-white">{t.dashboard.page.telegramBot}</h3>
            <p className="text-sm text-slate-400 font-medium italic">{t.dashboard.page.telegramDesc}</p>
          </div>
          <a 
            href="https://t.me/FinanZenApp_bot" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] whitespace-nowrap"
          >
            {t.dashboard.page.associateTelegram}
          </a>
        </div>
      </motion.div>

      {/* Financial Health Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-12 space-y-4"
          >
            <div className="flex items-center gap-3 px-2 mb-4">
              <AlertCircle size={18} className="text-red-500" />
              <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase">{t.dashboard.page.alerts}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative overflow-hidden p-6 rounded-[32px] border flex items-center gap-6 transition-all group ${
                    alert.type === 'danger' 
                      ? 'bg-red-500/[0.03] border-red-500/20 hover:border-red-500/40 shadow-[0_0_30px_-10px_rgba(239,68,68,0.1)]' 
                      : 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/40 shadow-[0_0_30px_-10px_rgba(245,158,11,0.1)]'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    alert.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {alert.icon === 'AlertCircle' ? <AlertCircle size={28} /> : <Zap size={28} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-black uppercase tracking-tight mb-1 ${
                      alert.type === 'danger' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {alert.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium italic truncate">
                      {alert.message}
                    </p>
                  </div>
                  <Link 
                    href="/categories" 
                    className={`p-3 rounded-xl transition-all ${
                      alert.type === 'danger' ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    <ChevronRight size={20} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="bg-slate-900/30 backdrop-blur-sm p-10 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden group/chart">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
          <div>
            <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase mb-1">{t.dashboard.page.dailyConsumption}</h2>
            <p className="text-xs text-slate-400 font-medium italic">{t.dashboard.page.dailyConsumptionDesc}</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{t.dashboard.page.spending}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-px border-t border-dashed border-red-500/50" />
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{t.dashboard.page.dailyLimit}</span>
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LazyAreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis 
                dataKey="day" 
                stroke="#475569" 
                fontSize={9} 
                tick={{ fontWeight: '900', letterSpacing: '0.05em' }}
                axisLine={false}
                tickLine={false}
                dy={15}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis 
                hide 
                domain={[
                  0, 
                  (dataMax: number) => {
                    const maxSpending = dataMax || 0;
                    const dailyLimit = stats.dailyAllowance || 0;
                    // Garantir que o domínio sempre inclui o limite diário com margem
                    return Math.max(maxSpending * 1.1, dailyLimit * 1.2, 10);
                  }
                ]} 
              />
              <Tooltip 
                cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
                contentStyle={{ 
                  backgroundColor: '#020617', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '24px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  padding: '16px 24px'
                }}
                itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '12px' }}
                formatter={(value: number | undefined) => {
                  if (value === undefined) return ['', ''];
                  return [formatCurrency(value), t.dashboard.page.chartSpent];
                }}
                labelFormatter={(label) => `${t.dashboard.page.chartDay} ${label}`}
              />
              {/* ReferenceLine ANTES do Area para garantir que está visível */}
              {stats.dailyAllowance > 0 && (
                <ReferenceLine 
                  y={stats.dailyAllowance} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeOpacity={0.9}
                  strokeWidth={2}
                  label={{ 
                    position: 'insideTopRight' as any, 
                    value: `${t.dashboard.page.chartLimit}: ${formatCurrency(stats.dailyAllowance)}`, 
                    fill: '#ef4444', 
                    fontSize: 9, 
                    fontWeight: '900',
                    offset: 10
                  }} 
                />
              )}
              <LazyArea 
                type="monotone" 
                dataKey="amount" 
                stroke="#3b82f6" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorSpend)" 
                animationDuration={2000}
              />
            </LazyAreaChart>
          </ResponsiveContainer>
        </div>
      </div>

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
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">
                {t.dashboard.loading.preparingEcosystem}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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
