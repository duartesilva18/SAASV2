'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Mail, Lock, AlertCircle, ChevronLeft, CheckCircle2, Trophy, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import { hasProAccess } from '@/lib/utils';

// Reusable Simplified Button Component
const MagneticButton = ({ children, className, onClick, disabled, type = "button" }: any) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
};

// motivationalQuotes agora vem das traduções

function GoogleLoginButton({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
  const { t } = useTranslation();
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onLoginSuccess(tokenResponse.access_token),
    onError: () => console.log('Login com Google Falhou'),
    flow: 'implicit',
    prompt: 'select_account' // 🔄 Força a escolha da conta Google sempre
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      className="flex items-center justify-center gap-2.5 3xl:gap-4 py-3.5 3xl:py-5 px-6 3xl:px-10 bg-slate-950 border border-slate-800 rounded-xl 3xl:rounded-2xl hover:bg-slate-900 hover:border-slate-700 transition-all group/btn shadow-lg cursor-pointer w-full max-w-[260px] sm:max-w-[280px] 3xl:max-w-[300px]"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 3xl:w-6 3xl:h-6 fill-current">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.81h2.64c1.55-1.42 2.43-3.5 2.43-5.24z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.64-2.81c-.73.48-1.66.76-2.64.76-2.85 0-5.27-1.92-6.13-4.51H2.18v2.98C3.99 20.24 7.75 23 12 23z" fill="#34A853" />
        <path d="M5.87 13.78c-.22-.65-.35-1.35-.35-2.08s.13-1.43.35-2.08V6.64H2.18C1.43 8.24 1 10.07 1 12s.43 3.76 1.18 5.36l3.69-2.98z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.75 1 3.99 3.76 2.18 7.36l3.69 2.98c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335" />
      </svg>
      <span className="text-[10px] sm:text-[11px] 3xl:text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover/btn:text-white transition-colors">
        {t.auth.login.googleLogin}
      </span>
    </button>
  );
}

function LoginPageContent() {
  const { t, language } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const { refreshUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get('redirect') || '/dashboard';

  const motivationalQuotes = t.auth.login.motivationalQuotes;

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [motivationalQuotes.length]);

  const validateEmail = (email: string) => {
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  };

  const handleResendVerification = async () => {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !validateEmail(emailNorm)) {
      setResendError(t.auth.login.invalidEmail);
      return;
    }
    setResendError('');
    setResendSuccess('');
    setResendLoading(true);
    try {
      await api.post('/auth/resend-verification', { email: emailNorm });
      setResendSuccess(t.auth.login.resendVerificationSuccess);
    } catch (err: any) {
      const d = err.response?.data?.detail;
      const msg = typeof d === 'string' ? d : (Array.isArray(d) ? d[0]?.msg : null) ?? t.auth.login.error;
      setResendError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError(t.auth.login.invalidEmail);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    if (password.length < 4) {
      setError(t.auth.login.shortPassword);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', response.data.access_token);
      if (response.data.refresh_token) {
        storage.setItem('refresh_token', response.data.refresh_token);
      }
      api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
      await refreshUser();
      
      // Prefetch dos dados principais em background para otimizar carregamento
      const prefetchData = async () => {
        try {
          const [transRes, catRes, insightsRes, invoicesRes] = await Promise.all([
            api.get('/transactions/?limit=100'),
            api.get('/categories/'),
            api.get('/insights/'),
            api.get('/stripe/invoices').catch(() => null) // Opcional, não bloquear se falhar
          ]);
          
          // Guardar no cache imediatamente para uso no dashboard
          const userRes = await api.get('/auth/me').catch(() => null);
          if (userRes?.data) {
            const user = userRes.data;
            // Cache do dashboard
            localStorage.setItem('dashboard_cache', JSON.stringify({
              data: {
                user,
                transactions: transRes.data,
                categories: catRes.data,
                invoices: invoicesRes?.data || []
              },
              timestamp: Date.now()
            }));
            
            // Cache dos insights
            if (hasProAccess(user)) {
              localStorage.setItem('zen_insights_cache', JSON.stringify({
                data: insightsRes.data,
                timestamp: Date.now()
              }));
            }
          }
        } catch (err) {
          // Silenciar erros de prefetch - não é crítico
          console.log('Prefetch opcional falhou (não crítico)');
        }
      };
      
      // Iniciar prefetch mas não esperar - redirecionar imediatamente
      prefetchData();
      
      router.push('/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : null) ?? t.auth.login.error;
      setError(msg);
      const isEmailNotConfirmed = status === 403 && String(msg).toLowerCase().includes('confirme');
      setShowResendVerification(!!isEmailNotConfirmed);
      setResendSuccess('');
      setResendError('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (token: string, provider: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/social-login', {
        token,
        provider,
        language
      });
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', response.data.access_token);
      if (response.data.refresh_token) {
        storage.setItem('refresh_token', response.data.refresh_token);
      }
      await refreshUser();
      
      // Prefetch dos dados principais em background para otimizar carregamento
      const prefetchData = async () => {
        try {
          const [transRes, catRes, insightsRes, invoicesRes] = await Promise.all([
            api.get('/transactions/?limit=100'),
            api.get('/categories/'),
            api.get('/insights/'),
            api.get('/stripe/invoices').catch(() => null) // Opcional, não bloquear se falhar
          ]);
          
          // Guardar no cache imediatamente para uso no dashboard
          const userRes = await api.get('/auth/me').catch(() => null);
          if (userRes?.data) {
            const user = userRes.data;
            // Cache do dashboard
            localStorage.setItem('dashboard_cache', JSON.stringify({
              data: {
                user,
                transactions: transRes.data,
                categories: catRes.data,
                invoices: invoicesRes?.data || []
              },
              timestamp: Date.now()
            }));
            
            // Cache dos insights
            if (hasProAccess(user)) {
              localStorage.setItem('zen_insights_cache', JSON.stringify({
                data: insightsRes.data,
                timestamp: Date.now()
              }));
            }
          }
        } catch (err) {
          // Silenciar erros de prefetch - não é crítico
          console.log('Prefetch opcional falhou (não crítico)');
        }
      };
      
      // Iniciar prefetch mas não esperar - redirecionar imediatamente
      prefetchData();
      
      router.push(redirectUrl);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || t.auth.login.googleError);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "168035889326-q6bstt3rkcg40o6u9ijgar0uh6h179j8.apps.googleusercontent.com";
  
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col md:flex-row relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="hidden lg:flex md:w-1/2 flex-col justify-center p-6 lg:p-8 3xl:p-12 3xl:lg:p-20 relative z-10 border-r border-slate-900/50 bg-slate-950/60">
          <Link
            href="/"
            className="absolute top-6 3xl:top-12 left-6 3xl:left-12 3xl:lg:left-20 flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] 3xl:text-xs font-black uppercase tracking-[0.25em] 3xl:tracking-[0.3em] group cursor-pointer"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform 3xl:w-4 3xl:h-4" />
            {t.auth.login.backToHome}
          </Link>

          <div className="relative min-h-[280px] 3xl:min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mt-2 mb-4 3xl:mb-8 3xl:lg:mb-12 rotate-3 flex items-center justify-start">
                  <img 
                    src="/images/logo/logo-semfundo.png" 
                    alt="Finly" 
                    className="w-16 h-16 lg:w-20 lg:h-20 3xl:w-24 3xl:h-24 3xl:lg:w-32 3xl:lg:h-32 object-contain"
                  />
                </div>
                <h2 className="text-2xl lg:text-3xl 3xl:text-5xl 3xl:lg:text-7xl font-black tracking-tighter leading-[0.9] mb-4 3xl:mb-6 3xl:lg:mb-8">
                  {motivationalQuotes[quoteIndex].title.split(' ').map((word, i) => (
                    <span key={i} className={i % 2 === 1 ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic" : ""}>
                      {word}{' '}
                    </span>
                  ))}
                </h2>
                <p className="text-sm lg:text-base 3xl:text-xl 3xl:lg:text-2xl text-slate-400 mb-4 3xl:mb-8 3xl:lg:mb-12 max-w-lg leading-relaxed font-medium italic border-l-4 border-blue-500/30 pl-4 3xl:pl-6 3xl:lg:pl-8">
                  "{motivationalQuotes[quoteIndex].quote}"
                </p>
                <div className="flex items-center gap-2 3xl:gap-4 group cursor-default bg-slate-900/60 border border-slate-800 p-3 3xl:p-4 3xl:lg:p-6 rounded-xl 3xl:rounded-2xl w-fit">
                  <div className="p-1.5 3xl:p-2 3xl:lg:p-3 rounded-lg 3xl:rounded-xl 3xl:lg:rounded-2xl bg-blue-500/10 text-blue-500 shadow-inner">
                    <Trophy size={16} className="3xl:w-5 3xl:h-5 3xl:lg:size-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] 3xl:text-xs 3xl:lg:text-sm font-black uppercase tracking-widest text-white">
                      {motivationalQuotes[quoteIndex].stat}
                    </span>
                    <span className="text-[7px] 3xl:text-[8px] 3xl:lg:text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {t.auth.login.impactMetric}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-1.5 3xl:gap-2 mt-6 3xl:mt-12 3xl:lg:mt-16">
              {motivationalQuotes.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 3xl:h-1.5 transition-all duration-700 rounded-full ${i === quoteIndex ? 'w-8 3xl:w-12 3xl:lg:w-16 bg-blue-500' : 'w-2 3xl:w-3 3xl:lg:w-4 bg-slate-800'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-5 lg:p-8 3xl:p-12 3xl:xl:p-24 relative z-10 bg-[#020617]/95 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="lg:hidden absolute top-5 sm:top-6 left-4 sm:left-5">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] 3xl:text-[10px] font-black uppercase tracking-[0.25em] 3xl:tracking-[0.3em] cursor-pointer min-h-[42px] min-w-[42px] -m-2 p-2 rounded-lg 3xl:rounded-xl active:scale-[0.98]"
              aria-label={t.auth.login.back}
            >
              <ChevronLeft size={14} className="3xl:w-3.5 3xl:h-3.5" />
              {t.auth.login.back}
            </Link>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-[360px] sm:max-w-[400px] 3xl:max-w-[520px]">
            <div className="mb-4 3xl:mb-8 3xl:lg:mb-12 text-center lg:text-left">
              <div className="lg:hidden w-11 h-11 3xl:w-14 3xl:h-14 rounded-xl 3xl:rounded-xl flex items-center justify-center mx-auto mb-4 3xl:mb-6 overflow-hidden bg-slate-800/90 shadow-xl">
                <img src="/images/logo/icon.jpeg" alt="Finly" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl 3xl:text-4xl 3xl:lg:text-5xl font-black tracking-tighter mb-2 3xl:mb-3 3xl:lg:mb-4 text-white">
                {t.auth.login.title}
                <span className="text-blue-500 italic ml-1 3xl:ml-2">{t.auth.login.titleAccent}</span>
              </h1>
              <p className="text-slate-500 font-medium text-xs sm:text-sm 3xl:text-base 3xl:lg:text-lg italic">
                {t.auth.login.subtitle}
              </p>
            </div>

            <motion.div
              animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
              className={`bg-slate-900/60 border p-5 sm:p-6 3xl:p-8 3xl:sm:p-10 3xl:lg:p-12 rounded-xl 3xl:rounded-[32px] relative overflow-hidden transition-colors duration-500 group/card ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
            >
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 3xl:mb-8 p-3 3xl:p-4 bg-red-500/10 border border-red-500/20 rounded-xl 3xl:rounded-2xl text-red-400 text-[10px] 3xl:text-xs font-black tracking-tight leading-tight"
                  >
                    <div className="flex items-center gap-2 3xl:gap-3">
                      <div className="w-6 h-6 3xl:w-8 3xl:h-8 bg-red-500/20 rounded-lg 3xl:rounded-xl flex items-center justify-center shrink-0">
                        <AlertCircle size={14} className="3xl:w-4 3xl:h-4" />
                      </div>
                      <span>{error}</span>
                    </div>
                    {showResendVerification && (
                      <div className="mt-3 pt-3 3xl:mt-4 3xl:pt-4 border-t border-red-500/20 flex flex-col gap-2 3xl:gap-2">
                        <p className="text-slate-400 text-[10px] 3xl:text-[10px] font-medium">{t.auth.login.resendVerificationPrompt}</p>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading}
                          className="text-blue-400 hover:text-blue-300 text-[10px] 3xl:text-[10px] font-black uppercase tracking-widest underline decoration-blue-500/30 underline-offset-2 w-fit cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {resendLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 3xl:w-3 3xl:h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              {t.auth.login.resendVerificationLink}
                            </span>
                          ) : (
                            t.auth.login.resendVerificationLink
                          )}
                        </button>
                        {resendSuccess && <p className="text-emerald-400 text-[10px] 3xl:text-[10px] font-medium">{resendSuccess}</p>}
                        {resendError && <p className="text-red-400/90 text-[10px] 3xl:text-[10px] font-medium">{resendError}</p>}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} noValidate className="space-y-3 3xl:space-y-6 3xl:lg:space-y-8">
                <div>
                  <label className="block text-[8px] 3xl:text-[10px] font-black uppercase tracking-[0.2em] 3xl:tracking-[0.3em] text-slate-500 mb-1.5 3xl:mb-3 ml-1.5 3xl:ml-2">
                    {t.auth.login.emailLabel}
                  </label>
                  <div className="relative group/input">
                    <div className={`absolute left-3 3xl:left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && !validateEmail(email) ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-blue-500'}`}>
                      <Mail size={14} className="3xl:w-5 3xl:h-5" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) { setError(''); setShowResendVerification(false); setResendSuccess(''); setResendError(''); } }}
                      className={`w-full bg-slate-950/50 border rounded-lg 3xl:rounded-[24px] py-2.5 3xl:py-5 3xl:lg:py-6 pl-9 3xl:pl-14 pr-3 3xl:pr-5 text-[11px] 3xl:text-sm 3xl:lg:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && !validateEmail(email) ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-blue-500'}`}
                      placeholder="o-teu-email@exemplo.com"
                      required
                    />
                    {email && validateEmail(email) && !error && (
                      <div className="absolute right-3 3xl:right-5 top-1/2 -translate-y-1/2 text-emerald-500">
                        <CheckCircle2 size={12} className="3xl:w-[18px] 3xl:h-[18px]" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 3xl:mb-3 ml-1.5 3xl:ml-2">
                    <label className="block text-[8px] 3xl:text-[10px] font-black uppercase tracking-[0.2em] 3xl:tracking-[0.3em] text-slate-500">
                      {t.auth.login.passwordLabel}
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-[7px] 3xl:text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors underline decoration-blue-500/20 underline-offset-1 3xl:underline-offset-4 cursor-pointer"
                    >
                      {t.auth.login.forgotPassword}
                    </Link>
                  </div>
                  <div className="relative group/input">
                    <div className={`absolute left-3 3xl:left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && password.length < 4 ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-blue-500'}`}>
                      <Lock size={14} className="3xl:w-5 3xl:h-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      className={`w-full bg-slate-950/50 border rounded-lg 3xl:rounded-[24px] py-2.5 3xl:py-5 3xl:lg:py-6 pl-9 3xl:pl-14 pr-9 3xl:pr-12 text-[11px] 3xl:text-sm 3xl:lg:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && password.length < 4 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-blue-500'}`}
                      placeholder="••••••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 3xl:right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-0.5 cursor-pointer z-10"
                    >
                      {showPassword ? <EyeOff size={12} className="3xl:w-[18px] 3xl:h-[18px]" /> : <Eye size={12} className="3xl:w-[18px] 3xl:h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 3xl:gap-3 ml-1.5 3xl:ml-2 group cursor-pointer w-fit" onClick={() => setRememberMe(!rememberMe)}>
                  <div className={`w-3.5 h-3.5 3xl:w-5 3xl:h-5 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-slate-950/50 border-slate-800'}`}>
                    <AnimatePresence>
                      {rememberMe && (
                        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.15 }}>
                          <Check size={8} className="text-white stroke-[4] 3xl:w-3.5 3xl:h-3.5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={`text-[8px] 3xl:text-[10px] font-black uppercase tracking-widest transition-colors ${rememberMe ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {t.auth.login.rememberMe}
                  </span>
                </div>

                <MagneticButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 3xl:py-5 3xl:lg:py-7 min-h-[38px] 3xl:min-h-[48px] bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg 3xl:rounded-2xl 3xl:lg:rounded-[24px] font-black uppercase tracking-[0.15em] 3xl:tracking-[0.3em] transition-all shadow-[0_12px_24px_-8px_rgba(37,99,235,0.5)] 3xl:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98] mt-2 3xl:mt-4 flex items-center justify-center gap-1.5 3xl:gap-3 3xl:lg:gap-4 text-[9px] 3xl:text-xs 3xl:lg:text-sm relative overflow-hidden cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 3xl:w-6 3xl:h-6 border-2 3xl:border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {t.auth.login.submit} <ArrowRight size={14} className="3xl:w-5 3xl:h-5" />
                    </>
                  )}
                </MagneticButton>
              </form>

              <div className="mt-5 3xl:mt-10 3xl:lg:mt-14">
                <div className="relative mb-5 3xl:mb-10 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[8px] 3xl:text-[9px] font-black uppercase tracking-[0.25em] 3xl:tracking-[0.4em]">
                    <span className="bg-[#020617] px-2.5 3xl:px-4 text-slate-600">{t.auth.login.orContinueWith}</span>
                  </div>
                </div>
                <div className="flex justify-center scale-[0.9] sm:scale-95 3xl:scale-100">
                  <GoogleLoginButton onLoginSuccess={(token) => handleSocialLogin(token, 'google')} />
                </div>
              </div>
            </motion.div>

            <div className="mt-5 3xl:mt-10 3xl:lg:mt-14 text-center">
              <p className="text-slate-500 font-medium text-xs sm:text-sm 3xl:text-base 3xl:lg:text-lg mb-3 3xl:mb-4 3xl:lg:mb-6 italic">
                {t.auth.login.noAccount}
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 3xl:gap-3 3xl:lg:gap-4 bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 px-5 3xl:px-8 3xl:lg:px-12 py-3 3xl:py-4 3xl:lg:py-6 rounded-xl 3xl:rounded-[24px] font-black uppercase tracking-[0.15em] 3xl:tracking-[0.2em] text-[9px] 3xl:text-[10px] 3xl:lg:text-sm text-white transition-all hover:scale-105 active:scale-95 group shadow-xl cursor-pointer"
              >
                {t.auth.login.registerCta}
                <Sparkles size={14} className="text-blue-500 group-hover:rotate-12 transition-transform 3xl:w-[18px] 3xl:h-[18px] 3xl:lg:size-5" />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 3xl:bottom-8 3xl:lg:bottom-12 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 3xl:lg:right-12 lg:translate-x-0 flex items-center gap-1.5 3xl:gap-2 3xl:lg:gap-3 text-[7px] 3xl:text-[8px] 3xl:lg:text-[10px] font-black text-slate-700 uppercase tracking-[0.25em] 3xl:tracking-[0.4em] 3xl:lg:tracking-[0.5em] opacity-50 whitespace-nowrap">
          <ShieldCheck size={10} className="3xl:w-3 3xl:h-3 3xl:lg:size-[14px]" />
          {t.auth.login.sslSecured}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
