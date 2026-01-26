'use client';

import Sidebar from '@/components/Sidebar';
import OnboardingModal from '@/components/OnboardingModal';
import TermsAcceptanceModal from '@/components/TermsAcceptanceModal';
import SupportButton from '@/components/SupportButton';
import LoadingIndicator from '@/components/LoadingIndicator';
import LoadingScreen from '@/components/LoadingScreen';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import { Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSelector from '@/components/LanguageSelector';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTermsAcceptance, setShowTermsAcceptance] = useState(false);
  const pathname = usePathname();
  const { setCurrency, setLanguage } = useTranslation();
  const { user, loading, refreshUser } = useUser();
  const router = useRouter();

  const isAdminPage = pathname?.startsWith('/admin');

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

      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center select-none">
            <img
              src="/images/logo/logo.png"
              alt="Finly"
              className="h-36 w-auto m-0 p-0 select-none pointer-events-none"
              draggable="false"
            />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-end p-4 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-40">
          <LanguageSelector />
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
    </div>
  );
}
