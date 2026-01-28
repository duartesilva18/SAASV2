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
  Bell,
  AlertCircle,
  Activity,
  Ghost,
  Lightbulb,
  Compass,
  Target,
  Lock,
  Trophy,
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

// Menu principal da sidebar: apenas páginas de alto nível (lista plana, sem grupos)
const getMainMenu = (t: any) => [
  { name: t.dashboard.sidebar.dashboard, href: '/dashboard', icon: LayoutDashboard, activePaths: ['/dashboard'] },
  { name: t.dashboard.sidebar.transactions, href: '/transactions', icon: Receipt, activePaths: ['/transactions', '/categories', '/recurring'] },
  { name: t.dashboard.sidebar.analytics, href: '/analytics', icon: PieChart, activePaths: ['/analytics'] },
  { name: 'Cofre e Reservas', href: '/vault', icon: Landmark, activePaths: ['/vault', '/goals'] },
  { name: 'Afiliados', href: '/affiliate', icon: Trophy, isAffiliateSection: true, activePaths: ['/affiliate'] },
  { name: t.dashboard.sidebar.settings, href: '/settings', icon: Settings, activePaths: ['/settings', '/billing', '/plans'] },
  { name: t.dashboard.sidebar.admin, href: '/admin', icon: Shield, adminOnly: true, activePaths: ['/admin'] },
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

        // 1. Insights Reais -> dashboard (danger, warning e info)
        insightsRes.data?.insights?.forEach((ins: any) => {
          if (ins.type === 'danger' || ins.type === 'warning' || ins.type === 'info') {
            if (ins.type === 'danger') criticalFound = true;
            newNotifications.push({
              id: `ins-${ins.title}-${ins.message?.slice(0, 8) || ''}`,
              title: ins.title,
              message: ins.message,
              type: ins.type,
              icon: ins.icon,
              date: t.dashboard.sidebar.now,
              section: '/dashboard'
            });
          }
        });

        // 2. Próximos Vencimentos -> transactions (janela 0–7 dias)
        const today = new Date().getDate();
        recurringRes.data?.forEach((rec: any) => {
          const diff = rec.day_of_month - today;
          if (diff >= 0 && diff <= 7) {
            newNotifications.push({
              id: `rec-${rec.id}`,
              title: diff === 0 ? t.dashboard.sidebar.dueToday : t.dashboard.sidebar.dueInDays.replace('{days}', diff.toString()),
              message: t.dashboard.sidebar.subscriptionDue.replace('{description}', rec.description).replace('{amount}', formatPrice(rec.amount_cents/100)),
              type: diff <= 1 ? 'warning' : 'info',
              icon: 'clock',
              date: t.dashboard.sidebar.next,
              section: '/transactions'
            });
          }
        });

        // 3. Faturas em Aberto -> settings
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
            date: t.dashboard.sidebar.urgent,
            section: '/settings'
          });
        }

        // 4. Metas Concluídas -> vault
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
            date: t.dashboard.sidebar.now,
            section: '/vault'
          });
        });

        // 5. Metas quase atingidas (80%–99%) -> vault
        const s = t.dashboard.sidebar;
        (goalsRes.data || []).forEach((goal: any) => {
          if (!goal.target_amount_cents || goal.target_amount_cents <= 0) return;
          const pct = Math.round((goal.current_amount_cents / goal.target_amount_cents) * 100);
          if (pct >= 80 && pct < 100 && !completedGoals?.some((g: any) => g.id === goal.id)) {
            newNotifications.push({
              id: `goal-almost-${goal.id}`,
              title: s.goalAlmostReached || 'Meta quase atingida',
              message: (s.goalAlmostReachedMessage || '{name} está a {pct}% do objetivo.')
                .replace('{name}', goal.name || '')
                .replace('{pct}', String(pct)),
              type: 'info',
              icon: 'target',
              date: s.next,
              section: '/vault'
            });
          }
        });

        // Se não houver nada, adicionar boas-vindas (sem section = não mostra dot)
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

  const allowedHrefsFree = ['/dashboard', '/analytics', '/settings', '/billing', '/affiliate', '/plans'];
  const notificationsBySection = (item: any) => {
    const paths = item.adminOnly ? [item.href] : (item.activePaths || [item.href]);
    return notifications.filter((n: any) => n.section && paths.some((p: string) => n.section === p || (item.adminOnly && n.section?.startsWith?.(p))));
  };
  const badgeForItem = (item: any): { show: boolean; type: 'danger' | 'warning' | 'info' | 'success' } => {
    const rel = notificationsBySection(item);
    if (rel.length === 0) return { show: false, type: 'info' };
    const hasDanger = rel.some((n: any) => n.type === 'danger');
    const hasWarning = rel.some((n: any) => n.type === 'warning');
    if (hasDanger) return { show: true, type: 'danger' };
    if (hasWarning) return { show: true, type: 'warning' };
    if (rel.some((n: any) => n.type === 'success')) return { show: true, type: 'success' };
    return { show: true, type: 'info' };
  };

  const mainMenu = getMainMenu(t)
    .filter((item: any) => !item.adminOnly || user?.is_admin)
    .map((item: any) => ({
      ...item,
      isBlocked: !isPro && !item.adminOnly && !item.isAffiliateSection && !allowedHrefsFree.includes(item.href),
    }));

  const sidebarContent = (
    <div className="flex flex-col h-full relative overflow-visible min-h-0 -mt-3">
      <div className={`flex items-center gap-4 px-4 pt-8 pb-5 select-none min-h-[5rem] ${isCollapsed ? 'lg:justify-center lg:px-2 lg:min-h-0 lg:pt-8' : ''}`}>
        <img
          src="/images/logo/logo-semfundo.png"
          alt="Finly"
          className={`shrink-0 m-0 p-0 select-none pointer-events-none object-contain self-center ${isCollapsed && !isMobileOpen ? 'h-20 w-20' : 'h-16 w-16'}`}
          draggable="false"
        />
        {(!isCollapsed || isMobileOpen) && (
          <span
            className="text-white font-semibold tracking-tight text-3xl leading-none self-center whitespace-nowrap"
            style={{ fontFamily: 'var(--font-brand), sans-serif' }}
          >
            Finly
          </span>
        )}
      </div>

      <nav className="flex-1 px-4 pt-4 space-y-1 overflow-y-auto no-scrollbar">
        {mainMenu.map((item: any) => {
          const Icon = item.icon;
          const isActive = item.adminOnly ? (pathname?.startsWith(item.href)) : (item.activePaths || [item.href]).includes(pathname);
          const isAdminItem = item.adminOnly;
          const isAffiliateItem = item.isAffiliateSection;
          const isBlocked = item.isBlocked;

          const badge = badgeForItem(item);
          const dotClasses = {
            danger: 'bg-red-500 notification-dot-blink',
            warning: 'bg-amber-500 notification-dot-blink',
            success: 'bg-emerald-500 notification-dot-blink',
            info: 'bg-blue-500 notification-dot-blink',
          };

          if (isBlocked) {
            return (
              <div
                key={item.href}
                onClick={() => router.push('/plans')}
                className={`flex items-center gap-2 xl:gap-2.5 p-2 xl:p-2.5 rounded-2xl transition-all relative group cursor-pointer opacity-50 hover:opacity-70 ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
              >
                <div className="relative shrink-0">
                  <Icon size={20} className="xl:w-5 xl:h-5 text-slate-600" />
                  <Lock size={12} className="xl:w-3 xl:h-3 absolute -top-0.5 -right-0.5 text-amber-400" />
                  {badge.show && (
                    <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] ${dotClasses[badge.type]}`} aria-hidden />
                  )}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <span className="text-[11px] xl:text-[13px] font-semibold text-slate-600">
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
              className={`flex items-center gap-2 xl:gap-2.5 p-2.5 xl:p-3 rounded-2xl transition-all relative group cursor-pointer ${isActive ? (isAdminItem ? 'bg-amber-500/10 text-amber-400' : isAffiliateItem ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-600/10 text-blue-400') : (isAdminItem ? 'text-amber-500/60 hover:bg-amber-500/5 hover:text-amber-400' : isAffiliateItem ? 'text-amber-500/70 hover:bg-amber-500/5 hover:text-amber-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')} ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
            >
              <div className="relative shrink-0">
                <Icon size={20} className={`xl:w-5 xl:h-5 ${isActive ? (isAdminItem ? 'text-amber-500' : isAffiliateItem ? 'text-amber-400' : 'text-blue-500') : (isAffiliateItem ? 'text-amber-500/70' : '')}`} />
                {badge.show && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] ${dotClasses[badge.type]}`} aria-hidden />
                )}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <span className="text-[11px] xl:text-[13px] font-semibold text-inherit truncate">
                  {item.name}
                </span>
              )}
              {isActive && (
                <div className={`absolute left-0 w-1 h-6 rounded-r-full ${isAdminItem ? 'bg-amber-500' : isAffiliateItem ? 'bg-amber-500' : 'bg-blue-500'}`} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 p-3 pt-4 pb-3 border-t border-white/5 space-y-2.5 bg-white/[0.01] relative overflow-visible">
        {user && (
          <div className={`group flex items-center gap-2 xl:gap-3 transition-all duration-300 overflow-visible ${(isCollapsed && !isMobileOpen) ? 'lg:justify-center lg:px-1' : 'px-2.5 xl:px-3 py-2 xl:py-2.5 hover:bg-white/[0.03] rounded-xl cursor-default border border-transparent hover:border-white/5 min-w-0'}`}>
            <div className="relative overflow-visible shrink-0">
              <div className={`relative shrink-0 flex items-center justify-center font-black text-white rounded-xl border shadow-2xl transition-all duration-500 group-hover:scale-110 ${
                user.is_admin 
                  ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-300/30' 
                  : isPro 
                    ? (currentPlan?.variant === 'basic' ? 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-slate-400/30' : currentPlan?.variant === 'plus' ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 border-blue-300/30' : 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 border-emerald-300/30')
                    : 'bg-gradient-to-br from-slate-600 to-slate-800 border-slate-500/30'
              } w-8 h-8 xl:w-9 xl:h-9 text-[7px] max-[1300px]:text-[8px] xl:text-[10px]`}>
                {user.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : user.email[0].toUpperCase()}
                
                {(user.is_admin || isPro) && (
                  <div className={`absolute -inset-1 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition-opacity ${user.is_admin ? 'bg-amber-500' : currentPlan?.variant === 'basic' ? 'bg-slate-500' : currentPlan?.variant === 'plus' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                )}
              </div>

              {/* Bell only when collapsed */}
              {(isCollapsed && !isMobileOpen) && (
                <div className="absolute -top-1 -right-1 z-30">
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
                  className="absolute bottom-0 left-full ml-4 w-[320px] max-w-[90vw] bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-[0_10px_100px_-10px_rgba(0,0,0,0.9)] z-[200] p-5 notification-card"
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">{t.dashboard.sidebar.notifications}</h4>
                      {notifications.length > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button 
                          onClick={handleClearAll}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {t.dashboard.sidebar.clearAll}
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white cursor-pointer p-1">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center space-y-3">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto text-slate-700">
                          <Bell size={22} />
                        </div>
                        <p className="text-[11px] text-slate-600 font-black uppercase tracking-[0.2em] italic">{t.dashboard.sidebar.nothingToReport}</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`flex gap-3 items-start p-4 rounded-xl border transition-colors group/notif min-h-[4.5rem] ${
                            notif.type === 'danger' ? 'bg-red-500/10 border-red-500/20' : 
                            notif.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 
                            notif.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                            'bg-white/5 border-white/5'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            notif.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                            notif.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            notif.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            <IconComponent name={notif.icon} size={18} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex justify-between items-center gap-2 mb-0.5">
                              <p 
                                className={`text-[11px] font-black uppercase tracking-tight leading-tight truncate ${
                                  notif.type === 'danger' ? 'text-red-400' : 
                                  notif.type === 'warning' ? 'text-amber-400' : 
                                  notif.type === 'success' ? 'text-emerald-400' : 
                                  'text-white'
                                }`}
                                title={notif.title}
                              >
                                {notif.title}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{notif.date}</span>
                                <button 
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="opacity-0 group-hover/notif:opacity-100 p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all cursor-pointer"
                                  title={t.dashboard.sidebar.markAsRead}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                            <p 
                              className="text-[11px] text-slate-400 leading-snug font-medium italic line-clamp-2 break-words"
                              title={notif.message}
                            >
                              "{notif.message}"
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {notifications.length > 0 && (
                      <p className="text-[9px] text-slate-600 text-center py-3 font-black uppercase tracking-[0.4em] italic">
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
          className={`w-full flex items-center gap-2 xl:gap-2.5 p-2 xl:p-2.5 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all group cursor-pointer border border-transparent hover:border-red-500/10 overflow-visible ${(isCollapsed && !isMobileOpen) ? 'lg:justify-center' : ''}`}
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center group-hover:-translate-x-1 transition-transform shrink-0">
            <LogOut size={11} className="xl:w-3 xl:h-3" />
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <span className="text-[6px] max-[1300px]:text-[7px] xl:text-[9px] font-black uppercase tracking-wide whitespace-nowrap shrink-0">
              {t.dashboard.sidebar.logout}
            </span>
          )}
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
              className="fixed left-0 top-0 h-screen w-64 bg-[#020617] border-r border-slate-800 z-[70] flex flex-col overflow-visible lg:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside 
        className={`fixed left-0 top-0 h-screen bg-[#020617] border-r border-slate-800 transition-all duration-500 ease-[0.16,1,0.3,1] z-50 hidden lg:flex flex-col overflow-visible ${isCollapsed ? 'w-24' : 'w-64'}`}
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
