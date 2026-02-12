'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Lock, AlertCircle, ChevronLeft, CheckCircle2, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react';
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
      className="flex items-center justify-center gap-2 sm:gap-2.5 py-3 sm:py-3.5 lg:py-3 xl:py-4 px-5 sm:px-6 lg:px-6 xl:px-8 bg-slate-950 border border-slate-800 rounded-lg xl:rounded-xl hover:bg-slate-900 hover:border-slate-700 transition-all group/btn shadow-lg cursor-pointer w-full max-w-[280px] sm:max-w-[300px]"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 xl:w-5 xl:h-5 fill-current shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.81h2.64c1.55-1.42 2.43-3.5 2.43-5.24z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.64-2.81c-.73.48-1.66.76-2.64.76-2.85 0-5.27-1.92-6.13-4.51H2.18v2.98C3.99 20.24 7.75 23 12 23z" fill="#34A853" />
        <path d="M5.87 13.78c-.22-.65-.35-1.35-.35-2.08s.13-1.43.35-2.08V6.64H2.18C1.43 8.24 1 10.07 1 12s.43 3.76 1.18 5.36l3.69-2.98z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.75 1 3.99 3.76 2.18 7.36l3.69 2.98c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335" />
      </svg>
      <span className="text-xs lg:text-sm font-black uppercase tracking-widest text-slate-500 group-hover/btn:text-white transition-colors">
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
  const [isShaking, setIsShaking] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const { refreshUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get('redirect') || '/dashboard';
  // Prevent open redirect: only allow relative paths starting with /
  const redirectUrl = (rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) ? rawRedirect : '/dashboard';

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
    if (password.length < 8) {
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
      const raw = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : null) ?? '';
      const lower = String(raw).toLowerCase();

      let msg: string;
      if (status === 403 || lower.includes('verif') || lower.includes('confirme') || (lower.includes('confirm') && lower.includes('email'))) {
        msg = t.auth.login.errorNotVerified;
        setShowResendVerification(true);
      } else if (status === 401 && (lower.includes('session') || lower.includes('sessão') || lower.includes('expir') || lower.includes('token'))) {
        msg = t.auth.login.errorSessionExpired;
        setShowResendVerification(false);
      } else if (status === 401 || lower.includes('incorrect') || lower.includes('credential') || lower.includes('password') || lower.includes('email')) {
        msg = t.auth.login.errorWrongCredentials;
        setShowResendVerification(false);
      } else {
        msg = raw || t.auth.login.error;
        setShowResendVerification(!!(status === 403 && lower.includes('confirme')));
      }

      setError(msg);
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
      <div className="min-h-screen min-h-[100dvh] bg-[#020617] text-slate-50 flex flex-col relative overflow-hidden">
        {/* Background: novo look (mesh + grid + decor) */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
        >
          {/* Base gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(1000px_circle_at_85%_10%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_50%_95%,rgba(16,185,129,0.10),transparent_60%)]" />

          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)',
              backgroundSize: '48px 48px'
            }}
          />

        </div>

        {/* Back link */}
        <div className="relative z-20 flex items-center px-4 sm:px-6 pt-4 sm:pt-5 lg:pt-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider"
          >
            <ChevronLeft className="w-4 h-4" />
            {t.auth.login.backToHome}
          </Link>
        </div>

        {/* Main: form card centered */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 lg:py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[400px]"
          >
            {/* Logo + nome Finly (igual à sidebar: ao lado do ícone, mesma fonte) */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-5">
              <img
                src="/images/logo/logo-semfundo.png"
                alt=""
                className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 lg:h-16 lg:w-16 shrink-0 object-contain select-none pointer-events-none"
                draggable={false}
              />
              <span
                className="text-white font-semibold tracking-tight text-2xl sm:text-3xl leading-none whitespace-nowrap"
                style={{ fontFamily: 'var(--font-brand), sans-serif' }}
              >
                Finly
              </span>
            </div>
            {/* Title */}
            <div className="text-center mb-4 sm:mb-5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                {t.auth.login.title}
                <span className="text-blue-400 italic ml-1">{t.auth.login.titleAccent}</span>
              </h1>
              <p className="mt-2 text-slate-400 text-sm sm:text-base">
                {t.auth.login.subtitle}
              </p>
            </div>


            {/* Card */}
            <motion.div
              animate={isShaking ? { x: [-8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`rounded-2xl sm:rounded-3xl border bg-slate-900/70 backdrop-blur-md shadow-2xl overflow-hidden ${error ? 'border-red-500/40' : 'border-slate-700/60'}`}
            >
              <div className="p-5 sm:p-6 md:p-8">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                      {showResendVerification && (
                        <div className="mt-2 pt-2 border-t border-red-500/20">
                          <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={resendLoading}
                            className="text-blue-400 hover:text-blue-300 text-xs font-semibold underline"
                          >
                            {resendLoading ? '...' : t.auth.login.resendVerificationLink}
                          </button>
                          {resendSuccess && <p className="text-emerald-400 text-xs mt-1">{resendSuccess}</p>}
                          {resendError && <p className="text-red-400/90 text-xs mt-1">{resendError}</p>}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t.auth.login.emailLabel}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${error && !validateEmail(email) ? 'border-red-500/50' : 'border-slate-700'}`}
                        placeholder="email@exemplo.com"
                        required
                      />
                      {email && validateEmail(email) && !error && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {t.auth.login.passwordLabel}
                      </label>
                      <Link href="/auth/forgot-password" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                        {t.auth.login.forgotPassword}
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${error && password.length < 4 ? 'border-red-500/50' : 'border-slate-700'}`}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-900/50'}`}>
                      {rememberMe && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-medium text-slate-400">{t.auth.login.rememberMe}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        <span>{t.auth.login.loadingAuthenticating}</span>
                      </>
                    ) : (
                      <>
                        {t.auth.login.submit}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-5 sm:mt-6 pt-5 border-t border-slate-700/60">
                  <p className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    {t.auth.login.orContinueWith}
                  </p>
                  <div className="flex justify-center">
                    <GoogleLoginButton onLoginSuccess={(token) => handleSocialLogin(token, 'google')} />
                  </div>
                </div>
              </div>
            </motion.div>

            <p className="text-center text-slate-500 text-sm mt-5 sm:mt-6">
              {t.auth.login.noAccount}{' '}
              <Link href="/auth/register" className="text-blue-400 font-semibold hover:text-blue-300 inline-flex items-center gap-1">
                {t.auth.login.registerCta}
              </Link>
            </p>
          </motion.div>
        </div>

        <div className="relative z-20 py-3 text-center">
          <p className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            {t.auth.login.sslSecured}
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}










