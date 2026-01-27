'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import api, { fetcher } from '@/lib/api';
import useSWR, { mutate } from 'swr';
import { useDashboardSnapshot } from '@/lib/hooks/useDashboard';
import { ArrowUpCircle, ArrowDownCircle, Wallet, ChevronRight, AlertCircle, Zap, Target, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import PricingModal from '@/components/PricingModal';
import { DEMO_TRANSACTIONS, DEMO_CATEGORIES } from '@/lib/mockData';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Toast from '@/components/Toast';
import confetti from 'canvas-confetti';
import { useUser } from '@/lib/UserContext';
import LoadingScreen from '@/components/LoadingScreen';

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
        const lowData = transactions.length < 10;

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
            // Subscrição ativa! Recarregar user e caches SWR para o modo demo desaparecer sem F5
            await refreshUser();
            await mutateUserData();
            await mutate('/stripe/invoices');
            await mutateSnapshot();
            
            setIsPro(true);
            setShowPaywall(false);
            setIsProcessingUpgrade(false);
            window.history.replaceState({}, '', '/dashboard');
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#fbbf24', '#ffffff']
            });
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
  }, [searchParams, refreshUser, mutateUserData, mutateSnapshot]);

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

  const visibleAlerts = alerts.slice(0, 2);
  const hasMoreAlerts = alerts.length > 2;
  const budgetUsage = stats.totalBudget > 0 ? (stats.expenses / stats.totalBudget) * 100 : 0;
  const quickInsights = hasLowData
    ? [
        'Estás a começar bem. Cada pequena ação conta para criar bons hábitos.',
        'Ainda tens poucos registos, por isso as leituras podem variar bastante.',
        'Dica rápida: adiciona pelo menos 10 transações para teres insights mais fiáveis.'
      ]
    : [
        stats.dailyAllowance > 0
          ? `Podes gastar cerca de ${formatCurrency(stats.dailyAllowance)} por dia sem ultrapassar o orçamento.`
          : 'Ainda não tens um orçamento diário definido para este mês.',
        stats.balance >= 0
          ? 'Saldo mensal positivo. Estás a gastar abaixo das receitas.'
          : 'Saldo mensal negativo. Atenção ao ritmo de despesas.',
        stats.totalBudget > 0
          ? `Já usaste ${Math.min(100, Math.round(budgetUsage))}% do orçamento deste mês.`
          : 'Sem orçamento mensal definido nas categorias.'
      ];

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-white pb-20 -mt-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-12 -mt-4 gap-4">
        <h1 className="text-4xl font-black tracking-tighter text-white">{t.dashboard.page.title}</h1>
        
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl w-fit"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{t.dashboard.page.demoMode}</span>
            <Link 
              href="/pricing"
              className="ml-2 bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer"
            >
              {t.dashboard.page.upgradePro}
            </Link>
          </motion.div>
        )}
      </div>
      
      {/* Bloco 1 - Hoje */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase">Hoje</h2>
          {isPro && (
            <Link
              href="/analytics"
              className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver análise completa
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center">
                <Zap size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
                  {t.dashboard.page.dailyAllowance}
                </p>
                <p className={`text-4xl font-black tracking-tighter ${stats.dailyAllowance > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {formatCurrency(stats.dailyAllowance || 0)}
                </p>
                <p className="text-sm text-slate-500 font-medium italic mt-2">
                  {t.dashboard.page.dailyAllowanceDesc}
                </p>
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-3">
                  Baseado no orçamento do mês (não inclui saldo inicial)
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-[32px] border border-white/5 shadow-xl flex flex-col justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800/60 text-slate-300 rounded-2xl flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">
                  Restante este mês
                </p>
                <p className="text-3xl font-black text-white tracking-tighter">
                  {formatCurrency(stats.remainingMoney || 0)}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium italic mt-4">
              Orçamento disponível até ao final do mês
            </p>
          </motion.div>
        </div>
      </section>

      {/* Bloco 2 - Este mês */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase">Este mês</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="mt-6 bg-slate-900/30 backdrop-blur-sm p-6 rounded-[24px] border border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Resumo do mês</p>
              <p className="text-sm text-slate-400 font-medium italic">Consumo do orçamento atual</p>
            </div>
            <div className="text-sm font-black text-white">
              {formatCurrency(stats.expenses)} / {formatCurrency(stats.totalBudget || 0)}
            </div>
          </div>
          <div className="mt-4 h-3 w-full bg-white/5 rounded-2xl p-1 border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, budgetUsage)}%` }}
              className={`h-full rounded-xl transition-colors duration-500 ${
                budgetUsage > 90 ? 'bg-red-500' : budgetUsage > 70 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
            />
          </div>
        </div>
      </section>

      {/* Bloco 3 - Futuro */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase">Futuro</h2>
          {isPro && (
            <Link
              href="/vault"
              className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver cofres
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
          >
            <div className="flex items-center space-x-6">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Fundo de Emergência</p>
                <p className="text-3xl font-black text-white tracking-tighter">
                  {formatCurrency(stats.vaultEmergency)}
                </p>
                <p className="text-sm text-slate-500 font-medium italic mt-2">
                  Reserva de segurança para imprevistos
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
                  {formatCurrency(stats.vaultInvestment)}
                  <span className="text-blue-400 ml-2 text-2xl">💎</span>
                </p>
                <p className="text-sm text-slate-500 font-medium italic mt-2">
                  Dinheiro guardado (não usado no dia a dia)
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase">Insights rápidos</h2>
          {isPro && (
            <Link
              href="/analytics"
              className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver detalhes
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickInsights.map((insight, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-sm p-5 rounded-[24px] border border-white/10 shadow-[0_0_30px_-15px_rgba(59,130,246,0.25)] text-sm text-slate-200 font-medium italic flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles size={14} />
              </div>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </section>

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
              {visibleAlerts.map((alert, idx) => (
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
                    <p className="text-sm text-slate-400 font-medium italic truncate">
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
            {hasMoreAlerts && (
              <div className="flex justify-end">
                <Link
                  href="/categories"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Ver mais alertas
                </Link>
              </div>
            )}
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
