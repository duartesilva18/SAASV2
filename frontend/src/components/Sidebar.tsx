'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Send,
  LayoutDashboard, 
  PieChart, 
  Clock, 
  Receipt, 
  Tag, 
  HelpCircle, 
  CreditCard, 
  Settings, 
  Shield, 
  Landmark, 
  Sparkles, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  Megaphone,
  Bell,
  AlertCircle,
  Activity,
  Ghost,
  Lightbulb,
  Compass,
  Target,
  Lock,
  Trophy,
  Gift
} from 'lucide-react';

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  switch (name) {
    case 'sparkles': return <Sparkles size={size} />;
    case 'clock': return <Clock size={size} />;
    case 'alert-circle': return <AlertCircle size={size} />;
    case 'activity': return <Activity size={size} />;
    case 'ghost': return <Ghost size={size} />;
    case 'lightbulb': return <Lightbulb size={size} />;
    case 'compass': return <Compass size={size} />;
    case 'target': return <Target size={size} />;
    case 'credit-card': return <CreditCard size={size} />;
    case 'send': return <Send size={size} />;
    case 'trophy': return <Trophy size={size} />;
    default: return <Bell size={size} />;
  }
};
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

const menuSections = (t: any) => [
  {
    title: t.dashboard.sidebar.overview || "Visão Geral",
    items: [
      {
        name: t.dashboard.sidebar.dashboard,
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        name: t.dashboard.sidebar.analytics,
        href: '/analytics',
        icon: PieChart,
      }
    ]
  },
  {
    title: t.dashboard.sidebar.savings || "Poupança & Investimento",
    items: [
      {
        name: t.dashboard.sidebar.vault || "Cofre de Reservas",
        href: '/vault',
        icon: Landmark,
      },
      {
        name: t.dashboard.sidebar.goals || "Metas de Poupança",
        href: '/goals',
        icon: Target,
      }
    ]
  },
  {
    title: t.dashboard.sidebar.financial || "Gestão Financeira",
    items: [
      {
        name: t.dashboard.sidebar.transactions,
        href: '/transactions',
        icon: Receipt,
      },
      {
        name: t.dashboard.sidebar.categories,
        href: '/categories',
        icon: Tag,
      },
      {
        name: t.dashboard.sidebar.recurring,
        href: '/recurring',
        icon: Clock,
      }
    ]
  },
  {
    title: t.dashboard.sidebar.tools || "Ferramentas",
    items: [
      {
        name: t.dashboard.sidebar.telegramBot || "Bot Telegram",
        href: 'https://t.me/FinanZenApp_bot',
        icon: Send,
        isExternal: true,
        isBlocked: true
      },
      {
        name: t.dashboard.sidebar.guide,
        href: '/guide',
        icon: HelpCircle,
      },
      {
        name: t.dashboard.sidebar.plans || "Planos",
        href: '/plans',
        icon: Trophy,
      }
    ]
  },
  {
    title: t.dashboard.sidebar.settings || "Configurações",
    items: [
      {
        name: t.dashboard.sidebar.billing,
        href: '/billing',
        icon: CreditCard,
      },
      {
        name: t.dashboard.sidebar.settings,
        href: '/settings',
        icon: Settings,
      }
    ]
  },
  {
    title: "Afiliados",
    isAffiliateSection: true,
    items: [
      {
        name: "Programa de Afiliados",
        href: '/affiliate',
        icon: Trophy
      }
    ]
  },
  {
    title: t.dashboard.sidebar.admin || "Administração",
    isAdminSection: true,
    items: [
      {
        name: t.dashboard.sidebar.adminPanel || "Painel de Comando",
        href: '/admin',
        icon: Shield,
        adminOnly: true
      },
      {
        name: t.dashboard.sidebar.globalTreasury || "Tesouraria Global",
        href: '/admin/finance',
        icon: Landmark,
        adminOnly: true
      },
      {
        name: t.dashboard.sidebar.marketing || "Marketing",
        href: '/admin/marketing',
        icon: Megaphone,
        adminOnly: true
      },
      {
        name: "Gestão de Afiliados",
        href: '/admin/affiliates',
        icon: Sparkles,
        adminOnly: true
      }
    ]
  }
];

const PLAN_BY_PRICE_ID: Record<string, { label: string; variant: 'basic' | 'plus' | 'pro' }> = {
  'price_1SuIypLtWlVpaXrbD7ph1fhf': { label: 'FinLy Basic', variant: 'basic' },
  'price_1SuIzcLtWlVpaXrbLkHE0QbS': { label: 'FinLy Plus', variant: 'plus' },
  'price_1SuJ0GLtWlVpaXrb8BH9HIve': { label: 'FinLy Pro', variant: 'pro' },
};

export default function Sidebar({ 
  isCollapsed, 
  onToggle, 
  isMobileOpen, 
  onMobileClose 
}: { 
  isCollapsed: boolean, 
  onToggle: () => void,
  isMobileOpen: boolean,
  onMobileClose: () => void
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, isPro, logout } = useUser();
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasCritical, setHasCritical] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<{ label: string; variant: 'basic' | 'plus' | 'pro' } | null>(null);
  const router = useRouter();

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
    setHasCritical(false);
  };

  useEffect(() => {
    if (!user || !isPro) {
      setCurrentPlan(null);
      return;
    }
    const fetchPlan = async () => {
      try {
        const res = await api.get('/stripe/subscription-details');
        const priceId = res.data?.price_id;
        if (priceId && PLAN_BY_PRICE_ID[priceId]) {
          setCurrentPlan(PLAN_BY_PRICE_ID[priceId]);
        } else {
          setCurrentPlan({ label: 'FinLy Pro', variant: 'pro' });
        }
      } catch {
        setCurrentPlan({ label: 'FinLy Pro', variant: 'pro' });
      }
    };
    fetchPlan();
  }, [user, isPro]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      
      // Verificar se há token antes de fazer chamadas
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        return; // Sem token, não fazer chamadas
      }
      
      try {
        const [insightsRes, recurringRes, invoicesRes, goalsRes] = await Promise.all([
          api.get('/insights/'),
          api.get('/recurring/'),
          api.get('/stripe/invoices'),
          api.get('/goals/').catch(() => ({ data: [] })) // Se falhar, usar array vazio
        ]);

        const newNotifications: any[] = [];
        let criticalFound = false;

        // 1. Insights Reais
        insightsRes.data?.insights?.forEach((ins: any) => {
          if (ins.type === 'danger' || ins.type === 'warning') {
            if (ins.type === 'danger') criticalFound = true;
            newNotifications.push({
              id: `ins-${ins.title}`,
              title: ins.title,
              message: ins.message,
              type: ins.type,
              icon: ins.icon,
              date: t.dashboard.sidebar.now
            });
          }
        });

        // 2. Próximos Vencimentos (nos próximos 3 dias)
        const today = new Date().getDate();
        recurringRes.data?.forEach((rec: any) => {
          const diff = rec.day_of_month - today;
          if (diff >= 0 && diff <= 3) {
            newNotifications.push({
              id: `rec-${rec.id}`,
              title: diff === 0 ? t.dashboard.sidebar.dueToday : t.dashboard.sidebar.dueInDays.replace('{days}', diff.toString()),
              message: t.dashboard.sidebar.subscriptionDue.replace('{description}', rec.description).replace('{amount}', formatPrice(rec.amount_cents/100)),
              type: 'info',
              icon: 'clock',
              date: t.dashboard.sidebar.next
            });
          }
        });

        // 3. Faturas em Aberto
        const hasUnpaid = invoicesRes.data?.some((inv: any) => 
          inv.status.toLowerCase() === 'unpaid' || 
          (inv.status.toLowerCase() === 'open' && inv.amount_due > 0)
        ) || false;
        if (hasUnpaid) {
          criticalFound = true;
          newNotifications.push({
            id: 'stripe-unpaid',
            title: t.dashboard.sidebar.paymentFailed,
            message: t.dashboard.sidebar.unpaidInvoice,
            type: 'danger',
            icon: 'credit-card',
            date: t.dashboard.sidebar.urgent
          });
        }

        // 4. Metas Concluídas
        const completedGoals = goalsRes.data?.filter((goal: any) => 
          goal.current_amount_cents >= goal.target_amount_cents && goal.target_amount_cents > 0
        ) || [];
        completedGoals.forEach((goal: any) => {
          newNotifications.push({
            id: `goal-completed-${goal.id}`,
            title: '🎯 Meta Concluída!',
            message: `Parabéns! Atingiste a meta "${goal.name}" de ${formatPrice(goal.target_amount_cents / 100)}`,
            type: 'success',
            icon: 'trophy',
            date: t.dashboard.sidebar.now
          });
        });

        // Se não houver nada, adicionar boas-vindas
        if (newNotifications.length === 0) {
          newNotifications.push({
            id: 'welcome',
            title: t.dashboard.sidebar.systemOperational,
            message: t.dashboard.sidebar.zenHarmony,
            type: 'success',
            icon: 'sparkles',
            date: t.dashboard.sidebar.now
          });
        }

        setNotifications(newNotifications);
        setHasCritical(criticalFound);
      } catch (err: any) {
        // Se for erro 401 (não autorizado), não fazer nada (token pode ter expirado)
        if (err?.response?.status === 401) {
          // Token expirado ou inválido - o interceptor do api.ts vai lidar com isso
          return;
        }
        console.error("Erro ao carregar notificações:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [user]);

  // Helper para formatar preço
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: user?.currency || 'EUR' }).format(val);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMobileOpen) {
      onMobileClose();
    }
    setShowNotifications(false);
  }, [pathname]);

  useEffect(() => {
    if (!showNotifications) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-card') && !target.closest('.notification-trigger')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  if (!mounted) return null;

  // Para free users: mostrar todos os itens mas marcar como bloqueados
  const sections = menuSections(t).map((section) => ({
    ...section,
    items: section.items.map((item: any) => {
      // Se já tiver isBlocked definido, manter. Caso contrário, marcar como bloqueado se for free user e não for dashboard/analytics
      if (!isPro && !item.adminOnly && !section.isAffiliateSection && !item.affiliateOnly && item.isBlocked === undefined) {
        const isAllowed = item.href === '/dashboard' || item.href === '/analytics' || item.href === '/settings' || item.href === '/billing' || item.href === '/guide' || item.href === '/affiliate' || item.href === '/plans';
        return { ...item, isBlocked: !isAllowed };
      }
      return item;
    }).filter((item: any) => {
      if (item.adminOnly) return user?.is_admin === true;
      if (section.isAffiliateSection) return true;
      if (item.affiliateOnly) return user?.is_affiliate === true;
      return true; // Mostrar todos os itens agora
    })
  })).filter((section) => section.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      <div className={`flex items-center mb-0 px-4 py-0 select-none ${isCollapsed ? 'lg:justify-center' : ''}`}>
        <img
          src="/images/logo/logo.png"
          alt="Finly"
          className={`${isCollapsed && !isMobileOpen ? 'h-36 w-36' : 'h-40 w-auto'} shrink-0 m-0 p-0 select-none pointer-events-none`}
          draggable="false"
        />
      </div>

      <nav className="flex-1 px-4 -mt-4 space-y-6 xl:space-y-8 overflow-y-auto no-scrollbar">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            {(!isCollapsed || isMobileOpen) && (
              <h3 className={`px-4 text-[7px] max-[1300px]:text-[8px] xl:text-[10px] font-black uppercase tracking-[0.3em] ${section.isAffiliateSection ? 'text-amber-500/60' : 'text-slate-600'}`}>
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item: any) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const isAdminItem = section.isAdminSection;
                const isAffiliateItem = section.isAffiliateSection;
                const isBlocked = item.isBlocked && !isPro;
                
                if (item.isExternal) {
                  const isExternalBlocked = item.isBlocked && !isPro;
                  
                  if (isExternalBlocked) {
                    return (
                      <div
                        key={item.href}
                        onClick={() => router.push('/pricing')}
                        className={`flex items-center gap-3 xl:gap-4 p-3 xl:p-3.5 rounded-2xl transition-all relative group cursor-pointer opacity-50 hover:opacity-70 ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
                      >
                    <div className="relative">
                      <Icon size={16} className="xl:w-5 xl:h-5 text-slate-600" />
                      <Lock size={10} className="xl:w-3 xl:h-3 absolute -top-1 -right-1 text-amber-400" />
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <span className="text-[8px] max-[1300px]:text-[9px] xl:text-xs font-black uppercase tracking-widest text-slate-600">
                        {item.name}
                      </span>
                    )}
                      </div>
                    );
                  }
                  
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 xl:gap-4 p-3 xl:p-3.5 rounded-2xl transition-all relative group cursor-pointer border border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/40 ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
                    >
                      <Icon size={16} className="xl:w-5 xl:h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      {(!isCollapsed || isMobileOpen) && (
                        <span className="text-[8px] max-[1300px]:text-[9px] xl:text-xs font-black uppercase tracking-widest text-inherit">
                          {item.name}
                        </span>
                      )}
                      <div className="absolute -top-1 -right-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                      </div>
                    </a>
                  );
                }
                
                // Se estiver bloqueado, usar div com onClick para redirecionar para pricing
                if (isBlocked) {
                  return (
                    <div
                      key={item.href}
                      onClick={() => router.push('/pricing')}
                      className={`flex items-center gap-3 xl:gap-4 p-3 xl:p-3.5 rounded-2xl transition-all relative group cursor-pointer opacity-50 hover:opacity-70 ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
                    >
                      <div className="relative">
                        <Icon size={16} className="xl:w-5 xl:h-5 text-slate-600" />
                        <Lock size={10} className="xl:w-3 xl:h-3 absolute -top-1 -right-1 text-amber-400" />
                      </div>
                      {(!isCollapsed || isMobileOpen) && (
                        <span className="text-[8px] max-[1300px]:text-[9px] xl:text-xs font-black uppercase tracking-widest text-slate-600">
                          {item.name}
                        </span>
                      )}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => { if (item.href.startsWith('/')) router.prefetch(item.href); }}
                    className={`flex items-center gap-3 xl:gap-4 p-3 xl:p-3.5 rounded-2xl transition-all relative group cursor-pointer ${isActive ? (isAdminItem ? 'bg-amber-500/10 text-amber-400' : isAffiliateItem ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-blue-600/10 text-blue-400') : (isAdminItem ? 'text-amber-500/60 hover:bg-amber-500/5 hover:text-amber-400' : isAffiliateItem ? 'text-amber-500/70 hover:bg-amber-500/5 hover:text-amber-400 border border-amber-500/10 hover:border-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300')} ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''} ${isAdminItem ? 'border border-amber-500/10' : isAffiliateItem ? '' : ''}`}
                  >
                    <div className="relative">
                      <Icon size={16} className={`xl:w-5 xl:h-5 ${isActive ? (isAdminItem ? 'text-amber-500' : isAffiliateItem ? 'text-amber-400' : 'text-blue-500') : (isAffiliateItem ? 'text-amber-500/70' : '')}`} />
                      {isAffiliateItem && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`w-5 h-5 xl:w-6 xl:h-6 rounded-full ${isActive ? 'bg-amber-500/20 animate-pulse' : 'bg-amber-500/10 group-hover:bg-amber-500/15'} blur-sm transition-all`} />
                        </div>
                      )}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <span className="text-[9px] xl:text-xs font-black uppercase tracking-widest text-inherit">
                        {item.name}
                      </span>
                    )}
                    {isActive && (
                      <div className={`absolute left-0 w-1 h-6 rounded-r-full ${isAdminItem ? 'bg-amber-500' : isAffiliateItem ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-4 bg-white/[0.01] relative">
        {user && (
          <div className={`group flex items-center gap-3 xl:gap-4 transition-all duration-300 ${(isCollapsed && !isMobileOpen) ? 'lg:justify-center' : 'px-3 xl:px-4 py-2.5 xl:py-3 hover:bg-white/[0.03] rounded-2xl cursor-default border border-transparent hover:border-white/5'}`}>
            <div className="relative">
              <div className={`relative shrink-0 flex items-center justify-center font-black text-white rounded-2xl border shadow-2xl transition-all duration-500 group-hover:scale-110 ${
                user.is_admin 
                  ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-300/30' 
                  : isPro 
                    ? (currentPlan?.variant === 'basic' ? 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-slate-400/30' : currentPlan?.variant === 'plus' ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 border-blue-300/30' : 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 border-emerald-300/30')
                    : 'bg-gradient-to-br from-slate-600 to-slate-800 border-slate-500/30'
              } w-9 h-9 xl:w-11 xl:h-11 text-[8px] max-[1300px]:text-[9px] xl:text-xs`}>
                {user.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : user.email[0].toUpperCase()}
                
                {(user.is_admin || isPro) && (
                  <div className={`absolute -inset-1 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition-opacity ${user.is_admin ? 'bg-amber-500' : currentPlan?.variant === 'basic' ? 'bg-slate-500' : currentPlan?.variant === 'plus' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                )}
              </div>

              {/* Bell only when collapsed */}
              {(isCollapsed && !isMobileOpen) && (
                <div className="absolute -top-2 -right-2 z-30">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifications(!showNotifications);
                    }}
                    className={`p-1.5 bg-[#020617] border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all relative notification-trigger cursor-pointer ${hasCritical ? 'animate-pulse text-red-400 border-red-500/50' : ''}`}
                  >
                    <Bell size={16} />
                    <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full border border-[#020617] ${hasCritical ? 'bg-red-500' : 'bg-blue-500'}`} />
                  </button>
                </div>
              )}
            </div>
            
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] max-[1300px]:text-[10px] xl:text-sm font-black text-white truncate tracking-tighter">
                    {user.full_name || user.email.split('@')[0]}
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifications(!showNotifications);
                    }}
                    className={`p-1.5 xl:p-2 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all relative notification-trigger cursor-pointer shrink-0 ${hasCritical ? 'animate-pulse text-red-400' : ''}`}
                  >
                    <Bell size={18} className="xl:w-6 xl:h-6" />
                    <div className={`absolute top-1.5 right-1.5 xl:top-2 xl:right-2 w-2 h-2 xl:w-2.5 xl:h-2.5 rounded-full border-2 border-[#020617] transition-colors ${hasCritical ? 'bg-red-500 shadow-[0_0_12px_#ef4444]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[5px] max-[1300px]:text-[6px] xl:text-[8px] font-black uppercase px-1.5 xl:px-2 py-0.5 rounded-full border tracking-widest ${
                    user.is_admin 
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                      : isPro 
                        ? (currentPlan?.variant === 'basic' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : currentPlan?.variant === 'plus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                        : 'bg-slate-800 text-slate-500 border-white/5'
                  }`}>
                    {user.is_admin ? t.dashboard.sidebar.rootAdmin : isPro ? (currentPlan?.label ?? t.dashboard.sidebar.planPro) : t.dashboard.sidebar.planFree}
                  </span>
                </div>
              </div>
            )}

            {/* Main Notification Card */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -20 }}
                  className="absolute bottom-0 left-full ml-4 w-[420px] bg-[#0a0f1d] border border-white/10 rounded-[32px] shadow-[0_10px_100px_-10px_rgba(0,0,0,0.9)] z-[200] p-8 notification-card"
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">{t.dashboard.sidebar.notifications}</h4>
                      {notifications.length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {notifications.length > 0 && (
                        <button 
                          onClick={handleClearAll}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {t.dashboard.sidebar.clearAll}
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white cursor-pointer p-1">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-5 max-h-[450px] overflow-y-auto no-scrollbar pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-16 text-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mx-auto text-slate-700">
                          <Bell size={28} />
                        </div>
                        <p className="text-xs text-slate-600 font-black uppercase tracking-[0.2em] italic">{t.dashboard.sidebar.nothingToReport}</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`flex gap-4 items-start p-5 rounded-[24px] border transition-all hover:scale-[1.02] group/notif ${
                            notif.type === 'danger' ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_30px_-10px_#ef4444]' : 
                            notif.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 
                            notif.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_30px_-10px_#10b981]' : 
                            'bg-white/5 border-white/5'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            notif.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                            notif.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            notif.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            <IconComponent name={notif.icon} size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                              <p className={`text-xs font-black uppercase tracking-tight leading-tight ${
                                notif.type === 'danger' ? 'text-red-400' : 
                                notif.type === 'warning' ? 'text-amber-400' : 
                                notif.type === 'success' ? 'text-emerald-400' : 
                                'text-white'
                              }`}>{notif.title}</p>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{notif.date}</span>
                                <button 
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="opacity-0 group-hover/notif:opacity-100 p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all cursor-pointer"
                                  title={t.dashboard.sidebar.markAsRead}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed font-medium italic">"{notif.message}"</p>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {notifications.length > 0 && (
                      <p className="text-[9px] text-slate-600 text-center py-4 font-black uppercase tracking-[0.4em] italic">
                        {t.dashboard.sidebar.zenCommandCenter}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 xl:gap-4 p-3 xl:p-4 rounded-2xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all group cursor-pointer border border-transparent hover:border-red-500/10 ${(isCollapsed && !isMobileOpen) ? 'lg:justify-center' : ''}`}
        >
          <div className="w-4 h-4 xl:w-5 xl:h-5 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
            <LogOut size={14} className="xl:w-[18px] xl:h-[18px]" />
          </div>
          {(!isCollapsed || isMobileOpen) && <span className="text-[7px] max-[1300px]:text-[8px] xl:text-[10px] font-black uppercase tracking-[0.2em]">{t.dashboard.sidebar.logout}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring' as const, damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-72 bg-[#020617] border-r border-slate-800 z-[70] flex flex-col lg:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside 
        className={`fixed left-0 top-0 h-screen bg-[#020617] border-r border-slate-800 transition-all duration-500 ease-[0.16,1,0.3,1] z-50 hidden lg:flex flex-col ${isCollapsed ? 'w-24' : 'w-72'}`}
      >
        {sidebarContent}
        <button 
          onClick={onToggle}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors z-50 shadow-xl"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
    </>
  );
}
