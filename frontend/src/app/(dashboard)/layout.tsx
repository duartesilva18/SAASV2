'use client';

import Sidebar from '@/components/Sidebar';
import OnboardingModal from '@/components/OnboardingModal';
import TermsAcceptanceModal from '@/components/TermsAcceptanceModal';
import SupportButton from '@/components/SupportButton';
import LoadingIndicator from '@/components/LoadingIndicator';
import LoadingScreen from '@/components/LoadingScreen';
import AlertModal from '@/components/AlertModal';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import { Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSelector from '@/components/LanguageSelector';
import Toast from '@/components/Toast';
import api from '@/lib/api';

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
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<Date | null>(null);
  const [verificationTimeLeft, setVerificationTimeLeft] = useState('');
  const [isVerificationExpired, setIsVerificationExpired] = useState(false);
  const [verificationRefreshing, setVerificationRefreshing] = useState(false);
  const [verificationToast, setVerificationToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
  const pathname = usePathname();
  const { t, setCurrency, setLanguage } = useTranslation();
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();

  const isAdminPage = pathname?.startsWith('/admin');

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
      if (user.language && (user.language === 'pt' || user.language === 'en')) {
        setLanguage(user.language as 'pt' | 'en');
      }
    }
  }, [user, loading, router, setCurrency, setLanguage, refreshUser]);

  useEffect(() => {
    if (!user || user.is_email_verified) {
      setVerificationExpiresAt(null);
      return;
    }
    const storedExpiry = localStorage.getItem('pending_verification_expires_at');
    if (storedExpiry) {
      setVerificationExpiresAt(new Date(storedExpiry));
      return;
    }
    api.get(`/auth/verification-status/${encodeURIComponent(user.email)}`)
      .then((res) => {
        if (res.data?.verification_expires_at) {
          const expiry = new Date(res.data.verification_expires_at);
          setVerificationExpiresAt(expiry);
          localStorage.setItem('pending_verification_expires_at', res.data.verification_expires_at);
        }
      })
      .catch(() => null);
  }, [user]);

  useEffect(() => {
    if (!verificationExpiresAt) return;
    const tick = () => {
      const diffMs = verificationExpiresAt.getTime() - Date.now();
      if (diffMs <= 0) {
        setVerificationTimeLeft('00:00');
        setIsVerificationExpired(true);
        return;
      }
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setVerificationTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      setIsVerificationExpired(false);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [verificationExpiresAt]);

  const handleVerifyClick = async () => {
    setVerificationRefreshing(true);
    setVerificationToast((t) => ({ ...t, isVisible: false }));
    try {
      const res = await api.get('/auth/me');
      const nowVerified = res.data?.is_email_verified === true;
      await refreshUser();
      if (nowVerified) {
        setVerificationToast({ message: t.dashboard.settings.verificationBanner.toastSuccess, type: 'success', isVisible: true });
      } else {
        setVerificationToast({ message: t.dashboard.settings.verificationBanner.toastError, type: 'error', isVisible: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || t.dashboard.settings.verificationBanner.toastError;
      setVerificationToast({ message: typeof msg === 'string' ? msg : t.dashboard.settings.verificationBanner.toastError, type: 'error', isVisible: true });
    } finally {
      setVerificationRefreshing(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) return null;

  return (
    <div className="flex bg-[#020617] min-h-screen relative overflow-hidden selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

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
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex flex-col gap-3 p-4 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center select-none min-w-0 shrink">
              <img
                src="/images/logo/logo.png"
                alt="Finly"
                className="h-36 w-auto m-0 p-0 select-none pointer-events-none"
                draggable="false"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageSelector />
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
          {user && !user.is_email_verified && (
            <div className="w-full flex justify-center">
              <div className="inline-flex items-center gap-3 bg-red-500/10 border-2 border-red-500/50 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-200 shadow-lg shadow-red-500/20">
                {isVerificationExpired ? (
                  <span>{t.dashboard.settings.verificationBanner.expired}</span>
                ) : (
                  <>
                    <span>{t.dashboard.settings.verificationBanner.timeLeft} <span className="text-white tabular-nums font-black">{verificationTimeLeft || '00:00'}</span></span>
                    <button
                      type="button"
                      onClick={handleVerifyClick}
                      disabled={verificationRefreshing}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 border border-red-400/60 rounded-xl font-black uppercase tracking-wider text-white disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {verificationRefreshing ? '...' : t.dashboard.settings.verificationBanner.verifyButton}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex flex-col gap-3 p-4 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center w-full">
            <div className="flex-1 min-w-0" />
            {user && !user.is_email_verified ? (
              <div className="flex justify-center flex-1">
                <div className="inline-flex items-center gap-3 bg-red-500/10 border-2 border-red-500/50 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-200 shadow-lg shadow-red-500/20">
                  {isVerificationExpired ? (
                    <span>{t.dashboard.settings.verificationBanner.expired}</span>
                  ) : (
                    <>
                      <span>{t.dashboard.settings.verificationBanner.timeLeft} <span className="text-white tabular-nums font-black">{verificationTimeLeft || '00:00'}</span></span>
                      <button
                        type="button"
                        onClick={handleVerifyClick}
                        disabled={verificationRefreshing}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 border border-red-400/60 rounded-xl font-black uppercase tracking-wider text-white disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {verificationRefreshing ? '...' : t.dashboard.settings.verificationBanner.verifyButton}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <div className="flex-1 flex justify-end">
              <LanguageSelector />
            </div>
          </div>
        </header>

        <main className={`flex-1 transition-all duration-500 ease-[0.16,1,0.3,1] ${isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-72'} relative z-10 overflow-y-auto`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SupportButton />
      <LoadingIndicator />
      <Toast
        message={verificationToast.message}
        type={verificationToast.type}
        isVisible={verificationToast.isVisible}
        onClose={() => setVerificationToast((t) => ({ ...t, isVisible: false }))}
      />
    </div>
  );
}
