'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight, Mail, Lock, AlertCircle, ChevronLeft, CheckCircle2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';

function GoogleRegisterButton({ onLoginSuccess, referralCode }: { onLoginSuccess: (token: string) => void; referralCode: string | null }) {
  const { t } = useTranslation();
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onLoginSuccess(tokenResponse.access_token),
    onError: () => console.log('Registo com Google Falhou'),
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

function RegisterPageContent() {
  const { t, language } = useTranslation();
  const { refreshUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return (p.get('ref') || '').trim();
  });
  const [referralCodeValid, setReferralCodeValid] = useState<'idle' | 'valid' | 'invalid' | 'checking'>('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReferralSection, setShowReferralSection] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (ref != null && ref.trim()) {
      setReferralCode(ref.trim());
      setShowReferralSection(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const code = (referralCode || '').trim();
    if (!code || code.length < 2) {
      setReferralCodeValid('idle');
      return;
    }
    setReferralCodeValid('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/auth/referral-code/validate', { params: { code } });
        setReferralCodeValid(res.data?.valid ? 'valid' : 'invalid');
      } catch {
        setReferralCodeValid('invalid');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [referralCode]);

  const validateEmail = (email: string) =>
    String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

  const validatePassword = (password: string): { valid: boolean; error: string } => {
    if (password.length > 72) return { valid: false, error: t.auth.register.passwordTooLong || "Password cannot exceed 72 characters" };
    if (password.length < 8) return { valid: false, error: t.auth.register.passwordMinLength };
    if (!/[A-Z]/.test(password)) return { valid: false, error: t.auth.register.passwordUppercase };
    if (!/[a-z]/.test(password)) return { valid: false, error: t.auth.register.passwordLowercase };
    if (!/\d/.test(password)) return { valid: false, error: t.auth.register.passwordNumber };
    return { valid: true, error: "" };
  };

  const handleSocialLogin = async (token: string, provider: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/social-login', {
        token,
        provider,
        language,
        referral_code: (referralCode || '').trim() || undefined
      });
      const storage = localStorage;
      storage.setItem('token', response.data.access_token);
      if (response.data.refresh_token) storage.setItem('refresh_token', response.data.refresh_token);
      await refreshUser();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#3b82f6', '#ffffff'] });
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Erro ao registar com Google');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError(t.auth.register.invalidEmail);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        language,
        referral_code: (referralCode || '').trim() || undefined
      });
      setSuccess(true);
      const emailFromResponse = response.data?.email || email;
      const devCode = response.data?.dev_code;
      const query = new URLSearchParams({ email: emailFromResponse });
      if (devCode) query.set('dev_code', devCode);
      setTimeout(() => router.push(`/auth/verify-register?${query.toString()}`), 2500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || t.auth.register.error);
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
        {/* Background: igual ao login */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_15%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(1000px_circle_at_85%_10%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_50%_95%,rgba(16,185,129,0.10),transparent_60%)]" />
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)',
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
            {t.auth.register.backToHome}
          </Link>
        </div>

        {/* Main: form card centered - igual ao login */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 lg:py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[400px]"
          >
            {/* Logo + nome Finly (igual à sidebar) */}
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
            <div className="text-center mb-4 sm:mb-5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                {t.auth.register.title}
                <span className="text-blue-400 italic ml-1">{t.auth.register.titleAccent}</span>
              </h1>
              <p className="mt-2 text-slate-400 text-sm sm:text-base">
                {t.auth.register.subtitle}
              </p>
            </div>

            <motion.div
              animate={isShaking ? { x: [-8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`rounded-2xl sm:rounded-3xl border bg-slate-900/70 backdrop-blur-md shadow-2xl overflow-hidden ${error ? 'border-red-500/40' : 'border-slate-700/60'}`}
            >
              <div className="p-5 sm:p-6 md:p-8">
                <AnimatePresence mode="wait">
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{t.auth.verifyRegister?.codeSentTitle ?? 'Código enviado!'} {t.auth.verifyRegister?.codeSentMessage ?? `Enviamos um código para ${email}. A redirecionar...`}</span>
                    </motion.div>
                  )}
                  {error && !success && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} noValidate className={`space-y-4 sm:space-y-5 ${success ? 'pointer-events-none opacity-50' : ''}`}>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.auth.register.emailLabel}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${error && !validateEmail(email) ? 'border-red-500/50' : 'border-slate-700'}`}
                        placeholder={t.auth.register.emailPlaceholder}
                        required
                      />
                      {email && validateEmail(email) && !error && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.auth.register.passwordLabel}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${error && password.length < 8 ? 'border-red-500/50' : 'border-slate-700'}`}
                        placeholder="••••••••"
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Indicador de força da password */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-0.5 flex-1 h-1.5 rounded-full overflow-hidden bg-slate-800">
                        {[1, 2, 3, 4].map((step) => {
                          const hasLength = password.length >= 8;
                          const hasUpper = /[A-Z]/.test(password);
                          const hasLower = /[a-z]/.test(password);
                          const hasNumber = /\d/.test(password);
                          const score = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
                          const filled = step <= score;
                          const color = score <= 1 ? 'bg-red-500' : score <= 2 ? 'bg-amber-500' : score <= 3 ? 'bg-emerald-500/80' : 'bg-emerald-500';
                          return (
                            <div key={step} className={`flex-1 rounded-full transition-all duration-300 ${filled ? color : 'bg-slate-800'}`} />
                          );
                        })}
                      </div>
                      {password.length > 0 && (
                        <span className={`text-[10px] font-semibold shrink-0 ${
                          (() => {
                            const s = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password)].filter(Boolean).length;
                            return s <= 1 ? 'text-red-400' : s === 2 ? 'text-amber-400' : 'text-emerald-400';
                          })()
                        }`}>
                          {(() => {
                            const s = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password)].filter(Boolean).length;
                            if (s <= 1) return t.auth.register.passwordStrengthWeak;
                            if (s === 2) return t.auth.register.passwordStrengthMedium;
                            if (s === 3) return t.auth.register.passwordStrengthGood;
                            return t.auth.register.passwordStrengthStrong;
                          })()}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{t.auth.register.passwordHint}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500">
                      {t.auth.register.termsText}{' '}
                      <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">{t.auth.register.termsLink}</Link>
                      {' '}{t.auth.register.and}{' '}
                      <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">{t.auth.register.privacyLink}</Link>.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        <span>{t.auth.register.loadingCreating}</span>
                      </>
                    ) : (
                      <>{t.auth.register.submit} <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-2">
                    {t.auth.register.trustLine}
                  </p>
                </form>

                <div className="mt-4 pt-4 border-t border-slate-700/60">
                  <button type="button" onClick={() => setShowReferralSection(!showReferralSection)} className="w-full text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-400 py-1 flex justify-between">
                    {t.auth.register.referralCodeLabel ?? 'Código de Referência (Opcional)'} <span className="text-slate-600">{showReferralSection ? '−' : '+'}</span>
                  </button>
                  {showReferralSection && (
                    <div className="mt-2 space-y-1">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode((e.target.value || '').trim().slice(0, 20))}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2 pl-3 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          referralCodeValid === 'valid' ? 'border-emerald-500/50' : referralCodeValid === 'invalid' ? 'border-red-500/50' : 'border-slate-700'
                        }`}
                        placeholder={t.auth.register.referralCodePlaceholder ?? 'Ex: MM2HQR2K'}
                        maxLength={20}
                      />
                      {referralCode && (
                        <p className={`text-[10px] ${referralCodeValid === 'valid' ? 'text-emerald-400' : referralCodeValid === 'invalid' ? 'text-red-400' : 'text-amber-400'}`}>
                          {referralCodeValid === 'checking' ? (t.auth.register.referralCodeChecking ?? 'A verificar...') : referralCodeValid === 'valid' ? (t.auth.register.referralCodeApplied ?? 'Código aplicado') : referralCodeValid === 'invalid' ? (t.auth.register.referralCodeInvalid ?? 'Código inválido') : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 sm:mt-6 pt-5 border-t border-slate-700/60">
                  <p className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{t.auth.login.orContinueWith}</p>
                  <div className="flex justify-center">
                    <GoogleRegisterButton onLoginSuccess={(token) => handleSocialLogin(token, 'google')} referralCode={referralCode} />
                  </div>
                </div>
              </div>
            </motion.div>

            <p className="text-center text-slate-500 text-sm mt-5 sm:mt-6">
              {t.auth.register.alreadyHaveAccount}{' '}
              <Link href="/auth/login" className="text-blue-400 font-semibold hover:text-blue-300">
                {t.auth.register.loginCta}
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

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
