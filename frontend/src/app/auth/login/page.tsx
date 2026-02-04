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

const MagneticButton = ({ children, className, onClick, disabled, type = "button" }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} className={className}>
    {children}
  </button>
);

function GoogleLoginButton({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
  const { t } = useTranslation();
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onLoginSuccess(tokenResponse.access_token),
    onError: () => console.log('Login com Google Falhou'),
    flow: 'implicit',
    prompt: 'select_account'
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      className="flex items-center justify-center gap-2.5 sm:gap-3 lg:gap-4 2xl:gap-5 py-3.5 sm:py-4 lg:py-5 2xl:py-6 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 px-6 sm:px-8 lg:px-10 2xl:px-12 [@media(max-height:700px)]:px-5 [@media(max-height:600px)]:px-4 bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl 2xl:rounded-3xl hover:bg-slate-900 hover:border-slate-700 transition-all group/btn shadow-lg cursor-pointer w-full max-w-[260px] sm:max-w-[280px] lg:max-w-[300px] 2xl:max-w-[340px]"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 2xl:w-7 2xl:h-7 fill-current shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.81h2.64c1.55-1.42 2.43-3.5 2.43-5.24z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.64-2.81c-.73.48-1.66.76-2.64.76-2.85 0-5.27-1.92-6.13-4.51H2.18v2.98C3.99 20.24 7.75 23 12 23z" fill="#34A853" />
        <path d="M5.87 13.78c-.22-.65-.35-1.35-.35-2.08s.13-1.43.35-2.08V6.64H2.18C1.43 8.24 1 10.07 1 12s.43 3.76 1.18 5.36l3.69-2.98z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.75 1 3.99 3.76 2.18 7.36l3.69 2.98c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335" />
      </svg>
      <span className="text-[10px] sm:text-[11px] lg:text-[11px] 2xl:text-xs font-black uppercase tracking-widest text-slate-500 group-hover/btn:text-white transition-colors">
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
    const interval = setInterval(() => setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length), 6000);
    return () => clearInterval(interval);
  }, [motivationalQuotes.length]);

  const validateEmail = (email: string) =>
    String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

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
      if (response.data.refresh_token) storage.setItem('refresh_token', response.data.refresh_token);
      api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
      await refreshUser();
      const prefetchData = async () => {
        try {
          const [transRes, catRes, insightsRes, invoicesRes] = await Promise.all([
            api.get('/transactions/?limit=100'),
            api.get('/categories/'),
            api.get('/insights/'),
            api.get('/stripe/invoices').catch(() => null)
          ]);
          const userRes = await api.get('/auth/me').catch(() => null);
          if (userRes?.data) {
            const user = userRes.data;
            localStorage.setItem('dashboard_cache', JSON.stringify({
              data: { user, transactions: transRes.data, categories: catRes.data, invoices: invoicesRes?.data || [] },
              timestamp: Date.now()
            }));
            if (hasProAccess(user)) {
              localStorage.setItem('zen_insights_cache', JSON.stringify({ data: insightsRes.data, timestamp: Date.now() }));
            }
          }
        } catch (_) {}
      };
      prefetchData();
      router.push('/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : null) ?? t.auth.login.error;
      setError(msg);
      setShowResendVerification(!!(status === 403 && String(msg).toLowerCase().includes('confirme')));
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
      const response = await api.post('/auth/social-login', { token, provider, language });
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', response.data.access_token);
      if (response.data.refresh_token) storage.setItem('refresh_token', response.data.refresh_token);
      await refreshUser();
      const prefetchData = async () => {
        try {
          const [transRes, catRes, insightsRes, invoicesRes] = await Promise.all([
            api.get('/transactions/?limit=100'),
            api.get('/categories/'),
            api.get('/insights/'),
            api.get('/stripe/invoices').catch(() => null)
          ]);
          const userRes = await api.get('/auth/me').catch(() => null);
          if (userRes?.data) {
            const user = userRes.data;
            localStorage.setItem('dashboard_cache', JSON.stringify({
              data: { user, transactions: transRes.data, categories: catRes.data, invoices: invoicesRes?.data || [] },
              timestamp: Date.now()
            }));
            if (hasProAccess(user)) {
              localStorage.setItem('zen_insights_cache', JSON.stringify({ data: insightsRes.data, timestamp: Date.now() }));
            }
          }
        } catch (_) {}
      };
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
      <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col lg:flex-row relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Painel esquerdo: só desktop (≥1024px) */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-6 lg:p-8 xl:p-20 relative z-10 border-r border-slate-900/50 bg-slate-950/60">
          <Link
            href="/"
            className="absolute top-6 lg:top-8 xl:top-12 left-6 lg:left-8 xl:left-20 flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] lg:tracking-[0.3em] group cursor-pointer"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform lg:w-4 lg:h-4" />
            {t.auth.login.backToHome}
          </Link>
          <div className="relative min-h-[280px] lg:min-h-[320px] xl:min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mt-2 mb-4 lg:mb-6 xl:mb-8 xl:mb-12 rotate-3 flex items-center justify-start">
                  <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 2xl:w-32 2xl:h-32 object-contain" />
                </div>
                <h2 className="text-2xl lg:text-3xl xl:text-5xl 2xl:text-7xl font-black tracking-tighter leading-[0.9] mb-4 lg:mb-6 xl:mb-8">
                  {motivationalQuotes[quoteIndex].title.split(' ').map((word, i) => (
                    <span key={i} className={i % 2 === 1 ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic" : ""}>
                      {word}{' '}
                    </span>
                  ))}
                </h2>
                <p className="text-sm lg:text-base xl:text-xl 2xl:text-2xl text-slate-400 mb-4 lg:mb-6 xl:mb-8 2xl:mb-12 max-w-lg leading-relaxed font-medium italic border-l-4 border-blue-500/30 pl-4 lg:pl-6 xl:pl-8">
                  "{motivationalQuotes[quoteIndex].quote}"
                </p>
                <div className="flex items-center gap-2 lg:gap-4 group cursor-default bg-slate-900/60 border border-slate-800 p-3 lg:p-4 xl:p-6 rounded-xl lg:rounded-2xl w-fit">
                  <div className="p-1.5 lg:p-2 xl:p-3 rounded-lg lg:rounded-xl xl:rounded-2xl bg-blue-500/10 text-blue-500 shadow-inner">
                    <Trophy size={16} className="lg:w-5 lg:h-5 xl:size-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] lg:text-xs xl:text-sm font-black uppercase tracking-widest text-white">
                      {motivationalQuotes[quoteIndex].stat}
                    </span>
                    <span className="text-[7px] lg:text-[8px] xl:text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {t.auth.login.impactMetric}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-1.5 lg:gap-2 mt-6 lg:mt-8 xl:mt-12 2xl:mt-16">
              {motivationalQuotes.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 lg:h-1.5 transition-all duration-700 rounded-full ${i === quoteIndex ? 'w-8 lg:w-12 xl:w-16 bg-blue-500' : 'w-2 lg:w-3 xl:w-4 bg-slate-800'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Painel direito: formulário — sempre visível, centralizado; ecrã grande (2xl) aumenta; ecrã curto reduz paddings */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 2xl:p-16 [@media(max-height:700px)]:py-4 [@media(max-height:600px)]:py-3 relative z-10 bg-[#020617]/95 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Botão Voltar: só mobile/tablet */}
          <div className="lg:hidden absolute top-5 sm:top-6 left-4 sm:left-5 z-20">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.25em] cursor-pointer min-h-[42px] min-w-[42px] -m-2 p-2 rounded-lg active:scale-[0.98]"
              aria-label={t.auth.login.back}
            >
              <ChevronLeft size={14} />
              {t.auth.login.back}
            </Link>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto [@media(max-height:700px)]:min-w-0">
            <div className="mb-5 sm:mb-6 lg:mb-8 xl:mb-12 2xl:mb-14 [@media(max-height:700px)]:mb-4 [@media(max-height:600px)]:mb-3 text-center lg:text-left">
              <div className="lg:hidden w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mx-auto mb-5 sm:mb-6 overflow-hidden bg-slate-800/90 shadow-xl">
                <img src="/images/logo/icon.jpeg" alt="Finly" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-black tracking-tighter mb-2.5 sm:mb-3 lg:mb-4 2xl:mb-5 text-white">
                {t.auth.login.title}
                <span className="text-blue-500 italic ml-1 lg:ml-2 2xl:ml-3">{t.auth.login.titleAccent}</span>
              </h1>
              <p className="text-slate-500 font-medium text-sm sm:text-base lg:text-base xl:text-lg 2xl:text-xl italic">
                {t.auth.login.subtitle}
              </p>
            </div>

            <motion.div
              animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
              className={`bg-slate-900/60 border p-5 sm:p-6 lg:p-8 xl:p-12 2xl:p-14 [@media(max-height:700px)]:p-4 [@media(max-height:600px)]:p-3 rounded-xl lg:rounded-2xl xl:rounded-[28px] 2xl:rounded-3xl relative overflow-hidden transition-colors duration-500 group/card ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
            >
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 lg:mb-6 p-3.5 lg:p-4 bg-red-500/10 border border-red-500/20 rounded-xl lg:rounded-2xl text-red-400 text-xs font-black tracking-tight leading-tight"
                  >
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-6 h-6 lg:w-8 lg:h-8 bg-red-500/20 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0">
                        <AlertCircle size={14} className="lg:w-4 lg:h-4" />
                      </div>
                      <span>{error}</span>
                    </div>
                    {showResendVerification && (
                      <div className="mt-3 pt-3 lg:mt-4 lg:pt-4 border-t border-red-500/20 flex flex-col gap-2">
                        <p className="text-slate-400 text-[10px] font-medium">{t.auth.login.resendVerificationPrompt}</p>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendLoading}
                          className="text-blue-400 hover:text-blue-300 text-[10px] font-black uppercase tracking-widest underline decoration-blue-500/30 underline-offset-2 w-fit cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {resendLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              {t.auth.login.resendVerificationLink}
                            </span>
                          ) : (
                            t.auth.login.resendVerificationLink
                          )}
                        </button>
                        {resendSuccess && <p className="text-emerald-400 text-[10px] font-medium">{resendSuccess}</p>}
                        {resendError && <p className="text-red-400/90 text-[10px] font-medium">{resendError}</p>}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5 lg:space-y-6 xl:space-y-8 2xl:space-y-10 [@media(max-height:700px)]:space-y-3 [@media(max-height:600px)]:space-y-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] text-slate-500 mb-2 lg:mb-3 2xl:mb-4 ml-1.5 lg:ml-2 2xl:ml-3">
                    {t.auth.login.emailLabel}
                  </label>
                  <div className="relative group/input">
                    <div className={`absolute left-3.5 lg:left-5 2xl:left-6 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && !validateEmail(email) ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-blue-500'}`}>
                      <Mail size={15} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) { setError(''); setShowResendVerification(false); setResendSuccess(''); setResendError(''); } }}
                      className={`w-full bg-slate-950/50 border rounded-lg lg:rounded-xl xl:rounded-2xl 2xl:rounded-3xl py-3 sm:py-4 lg:py-5 xl:py-6 2xl:py-7 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 pl-10 lg:pl-14 2xl:pl-16 pr-3 lg:pr-5 2xl:pr-6 text-xs sm:text-sm lg:text-base 2xl:text-lg focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && !validateEmail(email) ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-blue-500'}`}
                      placeholder="o-teu-email@exemplo.com"
                      required
                    />
                    {email && validateEmail(email) && !error && (
                      <div className="absolute right-3 lg:right-5 2xl:right-6 top-1/2 -translate-y-1/2 text-emerald-500">
                        <CheckCircle2 size={12} className="lg:w-[18px] lg:h-[18px] 2xl:w-5 2xl:h-5" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 lg:mb-3 2xl:mb-4 ml-1.5 lg:ml-2 2xl:ml-3">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] text-slate-500">
                      {t.auth.login.passwordLabel}
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors underline decoration-blue-500/20 underline-offset-1 lg:underline-offset-4 2xl:text-[10px] cursor-pointer"
                    >
                      {t.auth.login.forgotPassword}
                    </Link>
                  </div>
                  <div className="relative group/input">
                    <div className={`absolute left-3.5 lg:left-5 2xl:left-6 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && password.length < 4 ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-blue-500'}`}>
                      <Lock size={15} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      className={`w-full bg-slate-950/50 border rounded-lg lg:rounded-xl xl:rounded-2xl 2xl:rounded-3xl py-3 sm:py-4 lg:py-5 xl:py-6 2xl:py-7 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 pl-10 lg:pl-14 2xl:pl-16 pr-9 lg:pr-12 2xl:pr-14 text-xs sm:text-sm lg:text-base 2xl:text-lg focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && password.length < 4 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-blue-500'}`}
                      placeholder="••••••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 lg:right-5 2xl:right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-0.5 cursor-pointer z-10"
                    >
                      {showPassword ? <EyeOff size={12} className="lg:w-[18px] lg:h-[18px] 2xl:w-5 2xl:h-5" /> : <Eye size={12} className="lg:w-[18px] lg:h-[18px] 2xl:w-5 2xl:h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-3 2xl:gap-4 ml-1.5 lg:ml-2 2xl:ml-3 group cursor-pointer w-fit" onClick={() => setRememberMe(!rememberMe)}>
                  <div className={`w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-slate-950/50 border-slate-800'}`}>
                    <AnimatePresence>
                      {rememberMe && (
                        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.15 }}>
                          <Check size={9} className="text-white stroke-[4] lg:w-3.5 lg:h-3.5 2xl:w-4 2xl:h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest 2xl:text-xs transition-colors ${rememberMe ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {t.auth.login.rememberMe}
                  </span>
                </div>

                <MagneticButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-4 lg:py-5 xl:py-7 2xl:py-8 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 min-h-[44px] lg:min-h-[48px] 2xl:min-h-[56px] [@media(max-height:700px)]:min-h-[40px] [@media(max-height:600px)]:min-h-[36px] bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg lg:rounded-2xl xl:rounded-[24px] 2xl:rounded-3xl font-black uppercase tracking-[0.15em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] transition-all shadow-[0_12px_24px_-8px_rgba(37,99,235,0.5)] lg:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98] mt-2 lg:mt-4 2xl:mt-5 flex items-center justify-center gap-2 lg:gap-3 xl:gap-4 2xl:gap-5 text-xs lg:text-sm 2xl:text-base [@media(max-height:600px)]:text-xs relative overflow-hidden cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 lg:w-6 lg:h-6 2xl:w-7 2xl:h-7 border-2 lg:border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {t.auth.login.submit} <ArrowRight size={14} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </>
                  )}
                </MagneticButton>
              </form>

              <div className="mt-6 lg:mt-10 xl:mt-14 2xl:mt-16 [@media(max-height:700px)]:mt-4 [@media(max-height:600px)]:mt-3">
                <div className="relative mb-6 lg:mb-10 2xl:mb-12 [@media(max-height:700px)]:mb-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.25em] lg:tracking-[0.4em] 2xl:text-[10px] 2xl:tracking-[0.5em]">
                    <span className="bg-[#020617] px-3 lg:px-4 2xl:px-5 text-slate-600">{t.auth.login.orContinueWith}</span>
                  </div>
                </div>
                <div className="flex justify-center scale-[0.95] sm:scale-100 2xl:scale-105">
                  <GoogleLoginButton onLoginSuccess={(token) => handleSocialLogin(token, 'google')} />
                </div>
              </div>
            </motion.div>

            <div className="mt-6 lg:mt-10 xl:mt-14 2xl:mt-16 [@media(max-height:700px)]:mt-4 [@media(max-height:600px)]:mt-3 text-center flex flex-col items-center">
              <p className="text-slate-500 font-medium text-sm sm:text-base lg:text-base xl:text-lg 2xl:text-xl mb-3 lg:mb-4 xl:mb-6 2xl:mb-8 [@media(max-height:700px)]:mb-2 [@media(max-height:600px)]:mb-1.5 italic">
                {t.auth.login.noAccount}
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 lg:gap-3 xl:gap-4 2xl:gap-5 bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 px-6 lg:px-8 xl:px-12 2xl:px-14 py-3.5 lg:py-4 xl:py-6 2xl:py-7 [@media(max-height:700px)]:px-5 [@media(max-height:700px)]:py-3 [@media(max-height:600px)]:px-4 [@media(max-height:600px)]:py-2.5 rounded-xl lg:rounded-2xl xl:rounded-[24px] 2xl:rounded-3xl font-black uppercase tracking-[0.15em] lg:tracking-[0.2em] 2xl:tracking-[0.25em] text-[10px] sm:text-xs lg:text-sm 2xl:text-base [@media(max-height:600px)]:text-[10px] text-white transition-all hover:scale-105 active:scale-95 group shadow-xl cursor-pointer"
              >
                {t.auth.login.registerCta}
                <Sparkles size={14} className="text-blue-500 group-hover:rotate-12 transition-transform lg:w-[18px] lg:h-[18px] xl:size-5 2xl:size-6 [@media(max-height:600px)]:w-3.5 [@media(max-height:600px)]:h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 lg:bottom-8 xl:bottom-12 2xl:bottom-16 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 xl:right-12 2xl:right-16 lg:translate-x-0 flex items-center gap-1.5 lg:gap-2 xl:gap-3 2xl:gap-4 text-[7px] lg:text-[8px] xl:text-[10px] 2xl:text-xs [@media(max-height:700px)]:bottom-2 [@media(max-height:600px)]:bottom-1.5 [@media(max-height:600px)]:text-[6px] font-black text-slate-700 uppercase tracking-[0.25em] lg:tracking-[0.4em] xl:tracking-[0.5em] opacity-50 whitespace-nowrap">
          <ShieldCheck size={10} className="lg:w-3 lg:h-3 xl:size-[14px] 2xl:size-4" />
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
        <div className="w-8 h-8 border-[3px] border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
