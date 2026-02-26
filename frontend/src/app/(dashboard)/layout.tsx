'use client';

import Sidebar from '@/components/Sidebar';
import OnboardingModal from '@/components/OnboardingModal';
import OnboardingSpotlight, { type OnboardingStep } from '@/components/OnboardingSpotlight';
import api from '@/lib/api';
import TermsAcceptanceModal from '@/components/TermsAcceptanceModal';
import SupportButton, { SUPPORT_HIDDEN_KEY } from '@/components/SupportButton';
import LoadingIndicator from '@/components/LoadingIndicator';
import LoadingScreen from '@/components/LoadingScreen';
import AlertModal from '@/components/AlertModal';
import NotificationsPanel from '@/components/NotificationsPanel';
import { NotificationsProvider, useNotifications } from '@/lib/NotificationsContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import { Menu, AlertTriangle, CreditCard, HelpCircle, Bell, Smartphone, Settings, Mail } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import LanguageSelector from '@/components/LanguageSelector';

/** Uma única lista: no desktop aparecem os da sidebar (visível); no mobile avança até bot/mobile/support. */
const ONBOARDING_STEPS: OnboardingStep[] = [
  { target: 'sidebar-dashboard', message: 'A tua visão geral. Totais do mês e atalhos rápidos.' },
  { target: 'sidebar-transactions', message: 'Transações, categorias e subscrições. É aqui que registas e organizas tudo.' },
  { target: 'sidebar-analytics', message: 'Gráficos e números para perceberes para onde vai o dinheiro.' },
  { target: 'sidebar-vault', message: 'Cofre e metas. Para guardar e definir objetivos de poupança.' },
  { target: 'sidebar-affiliate', message: 'Programa de afiliados. Convida amigos e ganha recompensas.' },
  { target: 'sidebar-settings', message: 'Definições, faturação e plano. Para alterar a tua conta.' },
  { target: 'upgrade-pro', message: 'O teu plano atual. Clica aqui para subscrever e ver os teus dados reais.' },
  { target: 'sidebar-admin', message: 'Painel de administração.' },
  { target: 'bot', message: 'Regista despesas em segundos pelo Telegram. Texto, voz ou foto.' },
  { target: 'mobile', message: 'Queres a app no telemóvel? Adiciona ao ecrã inicial por aqui.' },
  { target: 'support', message: 'Sugestões ou encontaste um erro? Escreve aqui.' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTermsAcceptance, setShowTermsAcceptance] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [showBotSpotlight, setShowBotSpotlight] = useState(false);
  // Inicializar sempre false para evitar hydration mismatch (server não tem localStorage)
  const [supportHidden, setSupportHidden] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const supportRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportDidRestoreRef = useRef(false);
  const SUPPORT_HOLD_MS = 600;

  useEffect(() => {
    setSupportHidden(localStorage.getItem(SUPPORT_HIDDEN_KEY) === '1');
    const onHidden = () => setSupportHidden(true);
    window.addEventListener('support-hidden', onHidden);
    return () => window.removeEventListener('support-hidden', onHidden);
  }, []);

  // Durante o onboarding, abrir a sidebar no mobile para os alvos (planos, etc.) estarem visíveis
  useEffect(() => {
    if (showBotSpotlight && isMobileViewport) setIsMobileSidebarOpen(true);
  }, [showBotSpotlight, isMobileViewport]);

  // Mobile viewport: desativar animações de transição de página (reduz lag)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const openSupport = useCallback(() => {
    try {
      localStorage.removeItem(SUPPORT_HIDDEN_KEY);
    } catch (_) {}
    setSupportHidden(false);
    window.dispatchEvent(new CustomEvent('open-support'));
  }, []);

  const restoreSupport = useCallback(() => {
    try {
      localStorage.removeItem(SUPPORT_HIDDEN_KEY);
    } catch (_) {}
    setSupportHidden(false);
    window.dispatchEvent(new CustomEvent('support-restore'));
  }, []);
  const { t, setCurrency, setLanguage } = useTranslation();
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();

  const isAdminPage = pathname?.startsWith('/admin');

  // Menu secundário no header: tabs contextuais conforme a página
  const secondaryTabs = (() => {
    const s = t?.dashboard?.sidebar;
    if (!s) return null;
    if (['/transactions', '/categories', '/recurring'].includes(pathname || '')) {
      return [
        { label: s.transactions, href: '/transactions' },
        { label: s.categories, href: '/categories' },
        { label: s.recurring, href: '/recurring' },
      ];
    }
    if (['/vault', '/goals'].includes(pathname || '')) {
      return [
        { label: s.vault, href: '/vault' },
        { label: s.goals, href: '/goals' },
      ];
    }
    if (['/settings', '/billing', '/plans'].includes(pathname || '')) {
      return [
        { label: s.settings, href: '/settings' },
        { label: s.billing, href: '/billing' },
        { label: s.plans, href: '/plans' },
      ];
    }
    if (pathname?.startsWith('/admin')) {
      return [
        { label: s.adminPanel, href: '/admin' },
        { label: s.globalTreasury, href: '/admin/finance' },
        { label: s.projectExpenses ?? 'Despesas Projeto', href: '/admin/expenses' },
        { label: s.healthDashboard ?? 'Dashboard Saúde', href: '/admin/health' },
        { label: s.marketing, href: '/admin/marketing' },
        { label: s.affiliatesManagement, href: '/admin/affiliates' },
      ];
    }
    return null;
  })();

  // Ao mudar de rota (nav do header/sidebar): scroll ao topo e evento para páginas refetcharem
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.dispatchEvent(new CustomEvent('dashboard-route-change', { detail: { pathname } }));
  }, [pathname]);

  // Listener para token expirado
  useEffect(() => {
    const handleTokenExpired = () => {
      setShowSessionExpired(true);
    };

    window.addEventListener('token-expired', handleTokenExpired);
    return () => {
      window.removeEventListener('token-expired', handleTokenExpired);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        console.info('[auth] layout no user. token present:', !!token);
        if (token) {
          refreshUser();
          return;
        }
        router.push('/auth/login');
        return;
      }
      
      // Verificar se precisa aceitar termos (após onboarding)
      // Verificar se is_onboarded existe e é false (não undefined/null)
      if (user.is_onboarded === true) {
        // Se já completou onboarding, garantir que o modal não aparece
        setShowOnboarding(false);
        if (!user.terms_accepted) {
          setShowTermsAcceptance(true);
        } else {
          setShowTermsAcceptance(false);
        }
      } else if (user.is_onboarded === false) {
        setShowOnboarding(true);
        setShowTermsAcceptance(false);
      } else {
        // Se is_onboarded for undefined/null, não mostrar nada (pode ser um problema de carregamento)
        setShowOnboarding(false);
        setShowTermsAcceptance(false);
      }
      
      if (user.currency && (user.currency === 'EUR' || user.currency === 'USD' || user.currency === 'BRL')) {
        setCurrency(user.currency as 'EUR' | 'USD' | 'BRL');
      }
      if (user.language && (user.language === 'pt' || user.language === 'en' || user.language === 'fr')) {
        setLanguage(user.language as 'pt' | 'en' | 'fr');
      }
      // Spotlight do bot: só para contas criadas há pouco tempo (14 dias), após onboarding e termos, uma vez por utilizador
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
      const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      const isRecentAccount = daysSinceCreation <= 14;
      if (user.is_onboarded && user.terms_accepted && !showOnboarding && !showTermsAcceptance && isRecentAccount && !user.onboarding_spotlight_seen) {
        const t = setTimeout(() => setShowBotSpotlight(true), 500);
        return () => clearTimeout(t);
      }
    }
  }, [user, loading, router, setCurrency, setLanguage, refreshUser, showOnboarding, showTermsAcceptance]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) return null;

  return (
    <NotificationsProvider>
    <div className="flex bg-[#020617] text-slate-50 min-h-screen min-h-[100dvh] relative overflow-hidden selection:bg-blue-500/30">
      {/* Background: grid apenas (sem círculos em gradiente) */}
      <div className="fixed inset-0 pointer-events-none select-none" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.18] hidden lg:block"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
      </div>

      {showOnboarding && (
        <OnboardingModal onComplete={async () => {
          setShowOnboarding(false);
          // Atualizar dados do utilizador após completar onboarding
          await refreshUser();
        }} />
      )}

      {showTermsAcceptance && (
        <TermsAcceptanceModal onAccept={() => setShowTermsAcceptance(false)} />
      )}

      {showBotSpotlight && (
        <OnboardingSpotlight
          onComplete={async () => {
            try {
              await api.post('/auth/spotlight-seen');
              await refreshUser();
            } catch (_) {}
            setShowBotSpotlight(false);
          }}
          steps={ONBOARDING_STEPS}
        />
      )}

      {showSessionExpired && (
        <AlertModal
          isOpen={showSessionExpired}
          onClose={() => {
            setShowSessionExpired(false);
            window.location.href = '/auth/login';
          }}
          title={t.dashboard.settings.sessionExpired.title}
          message={t.dashboard.settings.sessionExpired.message}
          type="warning"
          buttonText={t.dashboard.settings.sessionExpired.button}
        />
      )}

      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-[0.16,1,0.3,1] ${isSidebarCollapsed ? 'lg:ml-24 2xl:ml-20' : 'lg:ml-72 2xl:ml-60'}`}>
        {/* Mobile Header – sino abre só o card de notificações (não a sidebar) */}
        <MobileHeaderWithNotifications
          t={t}
          pathname={pathname}
          secondaryTabs={secondaryTabs}
          onOpenMenu={() => setIsMobileSidebarOpen(true)}
          supportHidden={supportHidden}
          onOpenSupport={openSupport}
          onRestoreSupport={restoreSupport}
        />

        {/* Desktop Header – menu secundário (tabs) ao centro só quando existir; Bot Telegram, Guia, idioma à direita */}
        <header className={`hidden lg:flex flex-col gap-3 p-4 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40 ${secondaryTabs && secondaryTabs.length > 0 ? 'border-b border-slate-700/60' : ''}`}>
          <div className="flex items-center w-full">
            <div className="flex-1 min-w-0" />
            {secondaryTabs && secondaryTabs.length > 0 ? (
              <nav className="flex items-center justify-center gap-1 shrink-0 px-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl py-1.5" aria-label="Menu secundário">
                {secondaryTabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${pathname === tab.href ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="flex-1 flex justify-end items-center gap-2 shrink-0">
              {supportHidden && (
                <button
                  type="button"
                  onPointerDown={() => {
                    supportDidRestoreRef.current = false;
                    supportRestoreTimerRef.current = setTimeout(() => {
                      supportDidRestoreRef.current = true;
                      restoreSupport();
                      supportRestoreTimerRef.current = null;
                    }, SUPPORT_HOLD_MS);
                  }}
                  onPointerUp={() => {
                    if (supportRestoreTimerRef.current) {
                      clearTimeout(supportRestoreTimerRef.current);
                      supportRestoreTimerRef.current = null;
                    }
                  }}
                  onPointerLeave={() => {
                    if (supportRestoreTimerRef.current) {
                      clearTimeout(supportRestoreTimerRef.current);
                      supportRestoreTimerRef.current = null;
                    }
                  }}
                  onClick={() => {
                    if (supportDidRestoreRef.current) {
                      supportDidRestoreRef.current = false;
                      return;
                    }
                    openSupport();
                  }}
                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors rounded-xl hover:bg-slate-700/50 shrink-0"
                  title="Suporte (clique abre; segurar devolve o ícone ao canto)"
                  aria-label="Suporte"
                >
                  <Mail size={18} />
                </button>
              )}
              <a href="https://t.me/FinanZenApp_bot" target="_blank" rel="noopener noreferrer" data-onboarding-target="bot" className="flex items-center justify-center w-9 h-9 rounded-full bg-[#0088cc] text-white hover:bg-[#006699] transition-colors shrink-0" title={t.dashboard?.sidebar?.telegramBot || 'Bot Telegram'} aria-label="Bot Telegram">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                </svg>
              </a>
              <Link href="/add-to-home" data-onboarding-target="mobile" className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-xl hover:bg-slate-700/50 shrink-0" title="App no telemóvel" aria-label="App no telemóvel">
                <Smartphone className="w-5 h-5" />
              </Link>
              <Link href="/guide" className="p-2 text-slate-400 hover:text-amber-400 transition-colors rounded-xl hover:bg-slate-700/50" title={t.dashboard?.sidebar?.guide || 'Guia do Mestre'} aria-label="Guia do Mestre">
                <HelpCircle size={18} />
              </Link>
              <LanguageSelector />
            </div>
          </div>
        </header>

        {/* Aviso quando o pagamento falhou (past_due) – período de graça */}
        {user?.subscription_status === 'past_due' && (
          <div className="sticky top-0 z-30 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-center">
            <AlertTriangle size={20} className="text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-200">
              O teu último pagamento falhou. Atualiza o método de pagamento para manter o acesso.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 font-semibold text-sm transition-colors"
            >
              <CreditCard size={16} />
              Ir para Definições
            </Link>
          </div>
        )}

        <main ref={mainRef} className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden">
          {(reduceMotion || isMobileViewport) ? (
            <div
              key={pathname}
              className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              {children}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <SupportButton />
      <LoadingIndicator />
    </div>
    </NotificationsProvider>
  );
}

/** Mobile header: sino abre apenas o card de notificações (não a sidebar). Usa NotificationsContext. */
function MobileHeaderWithNotifications({
  t,
  pathname,
  secondaryTabs,
  onOpenMenu,
  supportHidden,
  onOpenSupport,
  onRestoreSupport,
}: {
  t: any;
  pathname: string | null;
  secondaryTabs: { label: string; href: string }[] | null;
  onOpenMenu: () => void;
  supportHidden?: boolean;
  onOpenSupport?: () => void;
  onRestoreSupport?: () => void;
}) {
  const { setShowNotifications, showNotifications } = useNotifications();
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const supportHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportDidRestoreRef = useRef(false);
  const SUPPORT_HOLD_MS = 600;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    if (toolsOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [toolsOpen]);

  return (
    <>
      <header className={`lg:hidden flex flex-col gap-3 px-4 py-3 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40 ${secondaryTabs && secondaryTabs.length > 0 ? 'border-b border-slate-700/60' : ''}`} style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-3 min-h-[56px]">
          <Link href="/dashboard" className="flex items-center gap-2 select-none min-h-[44px] w-fit -m-2 p-2 rounded-xl active:scale-[0.98] shrink-0">
            <img
              src="/images/logo/logo-semfundo.png"
              alt="Finly"
              className="h-10 w-10 shrink-0 select-none pointer-events-none object-contain"
              draggable="false"
            />
            <span className="text-white font-semibold tracking-tight text-xl leading-none whitespace-nowrap" style={{ fontFamily: 'var(--font-brand), sans-serif' }}>Finly</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setToolsOpen((o) => !o); }}
                className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-700/50 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                title="Acesso rápido"
                aria-label="Acesso rápido"
                aria-expanded={toolsOpen}
              >
                <Settings className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {toolsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 p-1.5"
                  >
                    <div className="flex items-center gap-0.5">
                      {supportHidden && onOpenSupport && (
                        <button
                          type="button"
                          onPointerDown={() => {
                            supportDidRestoreRef.current = false;
                            supportHoldTimerRef.current = setTimeout(() => {
                              supportDidRestoreRef.current = true;
                              onRestoreSupport?.();
                              setToolsOpen(false);
                              supportHoldTimerRef.current = null;
                            }, SUPPORT_HOLD_MS);
                          }}
                          onPointerUp={() => {
                            if (supportHoldTimerRef.current) {
                              clearTimeout(supportHoldTimerRef.current);
                              supportHoldTimerRef.current = null;
                            }
                          }}
                          onPointerLeave={() => {
                            if (supportHoldTimerRef.current) {
                              clearTimeout(supportHoldTimerRef.current);
                              supportHoldTimerRef.current = null;
                            }
                          }}
                          onClick={() => {
                            if (supportDidRestoreRef.current) {
                              supportDidRestoreRef.current = false;
                              return;
                            }
                            onOpenSupport();
                            setToolsOpen(false);
                          }}
                          className="flex items-center justify-center w-11 h-11 rounded-xl text-blue-400 hover:bg-blue-500/15 active:scale-95 transition-all cursor-pointer min-w-[44px] min-h-[44px]"
                          title="Suporte (clique abre; segurar devolve o ícone ao canto)"
                          aria-label="Suporte"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                      )}
                      <a
                        href="https://t.me/FinanZenApp_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-onboarding-target="bot"
                        className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer active:scale-95 transition-transform"
                        title={t.dashboard?.sidebar?.telegramBot || 'Bot Telegram'}
                        onClick={() => setToolsOpen(false)}
                      >
                        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#0088cc] text-white hover:bg-[#006699] transition-colors rotate-[-4deg]">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current rotate-[4deg]" aria-hidden>
                            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                          </svg>
                        </span>
                      </a>
                      <Link
                        href="/add-to-home"
                        data-onboarding-target="mobile"
                        className="flex items-center justify-center w-11 h-11 rounded-xl text-blue-400 hover:bg-blue-500/15 active:scale-95 transition-all cursor-pointer min-w-[44px] min-h-[44px]"
                        title="App no telemóvel"
                        onClick={() => setToolsOpen(false)}
                      >
                        <Smartphone className="w-5 h-5" />
                      </Link>
                      <Link
                        href="/guide"
                        className="flex items-center justify-center w-11 h-11 rounded-xl text-amber-400 hover:bg-amber-500/15 active:scale-95 transition-all cursor-pointer min-w-[44px] min-h-[44px]"
                        title={t.dashboard?.sidebar?.guide || 'Guia do Mestre'}
                        onClick={() => setToolsOpen(false)}
                      >
                        <HelpCircle className="w-5 h-5" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setShowNotifications(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-slate-700/50 min-w-[44px] min-h-[44px] flex items-center justify-center relative notification-trigger"
              title={t.dashboard?.sidebar?.notifications || 'Notificações'}
              aria-label="Notificações"
            >
              <Bell size={20} />
            </button>
            <LanguageSelector />
            <button
              onClick={onOpenMenu}
              className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-slate-700/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
        {secondaryTabs && secondaryTabs.length > 0 && (
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1" aria-label="Menu secundário">
            {secondaryTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-2.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[44px] flex items-center touch-manipulation ${pathname === tab.href ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {/* Card de notificações no mobile: fixo abaixo do header, só quando aberto pelo sino */}
      {showNotifications && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-[199] bg-black/50"
            style={{ top: 'max(56px, calc(env(safe-area-inset-top) + 3rem))' }}
            onClick={() => setShowNotifications(false)}
            aria-hidden
          />
          <div className="lg:hidden fixed left-4 right-4 z-[200] px-0" style={{ top: 'max(60px, calc(env(safe-area-inset-top) + 3.5rem))' }}>
            <NotificationsPanel />
          </div>
        </>
      )}
    </>
  );
}
