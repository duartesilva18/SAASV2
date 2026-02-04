'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, Mail, Lock, AlertCircle, ChevronLeft, CheckCircle2, ShieldCheck, Zap, Trophy, Heart, Star, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';

const MagneticButton = ({ children, className, onClick, disabled, type = "button" }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} className={className}>
    {children}
  </button>
);

function GoogleRegisterButton({ onLoginSuccess, referralCode }: { onLoginSuccess: (token: string) => void; referralCode: string | null }) {
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
      className="flex items-center justify-center gap-2.5 sm:gap-3 lg:gap-4 py-3.5 sm:py-4 lg:py-5 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 px-6 sm:px-8 lg:px-10 [@media(max-height:700px)]:px-5 [@media(max-height:600px)]:px-4 bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl hover:bg-slate-900 hover:border-slate-700 transition-all group/btn shadow-lg cursor-pointer w-full max-w-[260px] sm:max-w-[280px] lg:max-w-[300px]"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 fill-current shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.81h2.64c1.55-1.42 2.43-3.5 2.43-5.24z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.64-2.81c-.73.48-1.66.76-2.64.76-2.85 0-5.27-1.92-6.13-4.51H2.18v2.98C3.99 20.24 7.75 23 12 23z" fill="#34A853" />
        <path d="M5.87 13.78c-.22-.65-.35-1.35-.35-2.08s.13-1.43.35-2.08V6.64H2.18C1.43 8.24 1 10.07 1 12s.43 3.76 1.18 5.36l3.69-2.98z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.75 1 3.99 3.76 2.18 7.36l3.69 2.98c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335" />
      </svg>
      <span className="text-[10px] sm:text-[11px] lg:text-[11px] 2xl:text-xs font-black uppercase tracking-widest text-slate-500 group-hover/btn:text-white transition-colors">
        Continuar com Google
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
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (ref != null && ref.trim()) setReferralCode(ref.trim());
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

  const registerBenefits = t.auth.register.registerBenefits;

  useEffect(() => {
    const interval = setInterval(() => setBenefitIndex((prev) => (prev + 1) % registerBenefits.length), 7000);
    return () => clearInterval(interval);
  }, [registerBenefits.length]);

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
      <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col lg:flex-row relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Painel esquerdo: só desktop (≥1024px) */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-6 lg:p-8 xl:p-20 relative z-10 border-r border-slate-900/50 bg-slate-950/60">
          <Link
            href="/"
            className="absolute top-6 lg:top-8 xl:top-12 left-6 lg:left-8 xl:left-20 flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] lg:tracking-[0.3em] group cursor-pointer"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform lg:w-4 lg:h-4" />
            {t.auth.register.backToHome}
          </Link>

          <div className="relative min-h-[280px] lg:min-h-[320px] xl:min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={benefitIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mt-2 mb-4 lg:mb-6 xl:mb-8 2xl:mb-12 rotate-3 flex items-center justify-start">
                  <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 2xl:w-32 2xl:h-32 object-contain" />
                </div>
                <h2 className="text-2xl lg:text-3xl xl:text-5xl 2xl:text-7xl font-black tracking-tighter leading-[0.9] mb-4 lg:mb-6 xl:mb-8">
                  {registerBenefits[benefitIndex].title.split(' ').map((word: string, i: number) => (
                    <span key={i} className={i % 2 === 1 ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 italic font-black" : ""}>
                      {word}{' '}
                    </span>
                  ))}
                </h2>
                <p className="text-sm lg:text-base xl:text-xl 2xl:text-2xl text-slate-400 mb-4 lg:mb-6 xl:mb-8 2xl:mb-12 max-w-lg leading-relaxed font-medium italic border-l-4 border-emerald-500/30 pl-4 lg:pl-6 xl:pl-8">
                  "{registerBenefits[benefitIndex].quote}"
                </p>
                <div className="grid grid-cols-2 gap-2 lg:gap-4 xl:gap-6 mb-4 lg:mb-6 xl:mb-8 2xl:mb-12">
                  {[
                    { i: Zap, t: t.auth.register.benefits.instant, c: "text-amber-500" },
                    { i: Heart, t: t.auth.register.benefits.noStress, c: "text-rose-500" },
                    { i: ShieldCheck, t: t.auth.register.benefits.privacy, c: "text-blue-500" },
                    { i: Star, t: t.auth.register.benefits.guarantee, c: "text-emerald-500" }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-900/60 border border-slate-800 p-3 lg:p-4 xl:p-6 rounded-xl lg:rounded-2xl xl:rounded-[28px] group hover:border-emerald-500/30 transition-all">
                      <item.i size={16} className={`${item.c} mb-2 lg:mb-3 xl:mb-4 lg:w-5 lg:h-5 xl:size-6`} />
                      <div className="text-[9px] lg:text-[10px] xl:text-sm font-black uppercase tracking-widest text-white">{item.t}</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 lg:p-4 xl:p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-xl lg:rounded-2xl xl:rounded-[28px] max-w-md flex items-center gap-3 lg:gap-4 xl:gap-6">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 bg-emerald-500/10 rounded-lg lg:rounded-xl xl:rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                    <Trophy size={20} className="lg:size-6 xl:size-7" />
                  </div>
                  <p className="text-[9px] lg:text-[10px] xl:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80 leading-relaxed">
                    {registerBenefits[benefitIndex].stat}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-1.5 lg:gap-2 mt-6 lg:mt-8 xl:mt-12 2xl:mt-16">
              {registerBenefits.map((_: any, i: number) => (
                <div
                  key={i}
                  className={`h-1 lg:h-1.5 transition-all duration-700 rounded-full ${i === benefitIndex ? 'w-8 lg:w-12 xl:w-16 bg-emerald-500' : 'w-2 lg:w-3 xl:w-4 bg-slate-800'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Painel direito: scrollável se não couber; compacto em ecrãs curtos */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-3 sm:p-4 lg:p-6 xl:p-10 2xl:p-16 [@media(max-height:1400px)]:py-5 [@media(max-height:1200px)]:py-5 [@media(max-height:1080px)]:py-5 [@media(max-height:1000px)]:py-4 [@media(max-height:900px)]:py-3 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 [@media(max-height:600px)]:py-2 relative z-10 bg-[#020617]/95 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="lg:hidden absolute top-5 sm:top-6 left-4 sm:left-5 z-20">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.25em] cursor-pointer min-h-[42px] min-w-[42px] -m-2 p-2 rounded-lg active:scale-[0.98]"
              aria-label={t.auth.register.back}
            >
              <ChevronLeft size={14} />
              {t.auth.register.back}
            </Link>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto my-2 [@media(max-height:700px)]:min-w-0 [@media(max-height:1400px)]:my-1.5 [@media(max-height:1200px)]:my-1.5 [@media(max-height:1080px)]:my-1.5 [@media(max-height:1000px)]:my-1 [@media(max-height:900px)]:my-1 [@media(max-height:800px)]:my-1">
            <div className="mb-2 sm:mb-3 lg:mb-4 xl:mb-6 2xl:mb-8 [@media(max-height:1400px)]:mb-3 [@media(max-height:1200px)]:mb-3 [@media(max-height:1080px)]:mb-3 [@media(max-height:1000px)]:mb-2.5 [@media(max-height:900px)]:mb-2 [@media(max-height:800px)]:mb-1.5 [@media(max-height:700px)]:mb-1.5 [@media(max-height:600px)]:mb-1 text-center lg:text-left">
              <div className="lg:hidden w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 [@media(max-height:1400px)]:mb-2 [@media(max-height:1200px)]:mb-2 [@media(max-height:1080px)]:mb-2 [@media(max-height:800px)]:mb-1.5 overflow-hidden bg-slate-800/90 shadow-xl">
                <img src="/images/logo/icon.jpeg" alt="Finly" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-6xl font-black tracking-tighter mb-1 sm:mb-1.5 lg:mb-2 xl:mb-3 2xl:mb-5 [@media(max-height:1400px)]:mb-1.5 [@media(max-height:1200px)]:mb-1.5 [@media(max-height:1080px)]:mb-1.5 [@media(max-height:1000px)]:mb-1 [@media(max-height:900px)]:mb-1 [@media(max-height:800px)]:mb-1 [@media(max-height:700px)]:mb-1 text-white">
                {t.auth.register.title}
                <span className="text-emerald-500 italic font-black ml-1 lg:ml-2 2xl:ml-3">{t.auth.register.titleAccent}</span>
              </h1>
              <p className="text-slate-500 font-medium text-xs sm:text-sm lg:text-base xl:text-lg 2xl:text-xl italic">
                {t.auth.register.subtitle}
              </p>
            </div>

            <motion.div
              animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
              className={`bg-slate-900/60 border p-6 sm:p-8 lg:p-10 xl:p-14 2xl:p-20 [@media(max-height:1400px)]:p-8 [@media(max-height:1200px)]:p-8 [@media(max-height:1080px)]:p-8 [@media(max-height:1000px)]:p-7 [@media(max-height:900px)]:p-6 [@media(max-height:800px)]:p-5 [@media(max-height:700px)]:p-5 [@media(max-height:600px)]:p-4 rounded-xl lg:rounded-2xl xl:rounded-[28px] 2xl:rounded-3xl relative overflow-hidden transition-all duration-500 ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
            >
              <AnimatePresence mode="wait">
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 lg:mb-6 p-3 lg:p-4 xl:p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg lg:rounded-2xl flex items-start gap-2 lg:gap-4 text-emerald-400 shadow-lg shadow-emerald-500/10"
                  >
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-emerald-500/20 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} className="lg:size-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] lg:text-sm font-black uppercase tracking-widest mb-0.5 lg:mb-1 text-emerald-400">
                        {t.auth.verifyRegister?.codeSentTitle ?? 'Código enviado!'}
                      </p>
                      <p className="text-[10px] lg:text-xs font-medium opacity-90 leading-relaxed">
                        {t.auth.verifyRegister?.codeSentMessage ?? `Enviamos um código de verificação para ${email}. A redirecionar...`}
                      </p>
                    </div>
                  </motion.div>
                )}
                {error && !success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 lg:mb-6 p-2.5 lg:p-4 bg-red-500/10 border border-red-500/20 rounded-lg lg:rounded-2xl flex items-center gap-1.5 lg:gap-3 text-red-400 text-[9px] lg:text-xs font-black tracking-tight leading-tight"
                  >
                    <div className="w-6 h-6 lg:w-8 lg:h-8 bg-red-500/20 rounded lg:rounded-xl flex items-center justify-center shrink-0">
                      <AlertCircle size={12} className="lg:size-4" />
                    </div>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} noValidate className={`space-y-5 sm:space-y-6 lg:space-y-7 xl:space-y-9 2xl:space-y-12 [@media(max-height:1400px)]:space-y-5 [@media(max-height:1200px)]:space-y-5 [@media(max-height:1080px)]:space-y-5 [@media(max-height:1000px)]:space-y-4 [@media(max-height:900px)]:space-y-4 [@media(max-height:800px)]:space-y-3 [@media(max-height:700px)]:space-y-2.5 [@media(max-height:600px)]:space-y-2 ${success ? 'pointer-events-none opacity-50' : ''}`}>
                <div>
                  <label className="block text-[8px] lg:text-[10px] 2xl:text-xs font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] text-slate-500 mb-1 lg:mb-2 2xl:mb-3 [@media(max-height:700px)]:mb-1 ml-3 lg:ml-4 2xl:ml-5">
                    {t.auth.register.emailLabel}
                  </label>
                  <div className="relative group/input">
                    <div className={`absolute left-3 lg:left-5 2xl:left-6 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && !validateEmail(email) ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-emerald-500'}`}>
                      <Mail size={14} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      className={`w-full bg-slate-950/50 border rounded-lg lg:rounded-xl xl:rounded-2xl 2xl:rounded-3xl py-2 sm:py-2.5 lg:py-4 xl:py-5 2xl:py-7 [@media(max-height:1400px)]:py-2 [@media(max-height:1200px)]:py-2 [@media(max-height:1080px)]:py-2 [@media(max-height:1000px)]:py-1.5 [@media(max-height:900px)]:py-1.5 [@media(max-height:800px)]:py-1.5 [@media(max-height:700px)]:py-1.5 [@media(max-height:600px)]:py-1 pl-9 lg:pl-14 2xl:pl-16 pr-3 lg:pr-5 2xl:pr-6 text-[11px] sm:text-sm lg:text-base 2xl:text-lg focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && !validateEmail(email) ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-emerald-500'}`}
                      placeholder={t.auth.register.emailPlaceholder}
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
                  <label className="block text-[8px] lg:text-[10px] 2xl:text-xs font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] text-slate-500 mb-1 lg:mb-2 2xl:mb-3 [@media(max-height:700px)]:mb-1 ml-3 lg:ml-4 2xl:ml-5">
                    {t.auth.register.passwordLabel}
                  </label>
                  <div className="relative group/input mb-1.5 lg:mb-3 2xl:mb-4 [@media(max-height:700px)]:mb-1">
                    <div className={`absolute left-3 lg:left-5 2xl:left-6 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && password.length < 6 ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-emerald-500'}`}>
                      <Lock size={14} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      className={`w-full bg-slate-950/50 border rounded-lg lg:rounded-xl xl:rounded-2xl 2xl:rounded-3xl py-2 sm:py-2.5 lg:py-4 xl:py-5 2xl:py-7 [@media(max-height:1400px)]:py-2 [@media(max-height:1200px)]:py-2 [@media(max-height:1080px)]:py-2 [@media(max-height:1000px)]:py-1.5 [@media(max-height:900px)]:py-1.5 [@media(max-height:800px)]:py-1.5 [@media(max-height:700px)]:py-1.5 [@media(max-height:600px)]:py-1 pl-9 lg:pl-14 2xl:pl-16 pr-9 lg:pr-12 2xl:pr-14 text-[11px] sm:text-sm lg:text-base 2xl:text-lg focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && password.length < 6 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-emerald-500'}`}
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
                  <div className="px-2 lg:px-4 space-y-1.5 lg:space-y-3">
                    <div className="flex gap-1.5 lg:gap-2 h-1.5">
                      {[1, 2, 3, 4].map((step) => {
                        const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : password.length < 14 ? 3 : 4;
                        return (
                          <div
                            key={step}
                            className={`flex-1 rounded-full transition-all duration-500 ${step <= strength ? strength <= 1 ? 'bg-red-500' : strength <= 2 ? 'bg-amber-500' : 'bg-emerald-500' : 'bg-slate-800'}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 lg:gap-2 transition-all duration-300">
                      <div className={`w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full flex items-center justify-center transition-colors ${password.length >= 6 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-600'}`}>
                        <CheckCircle2 size={10} strokeWidth={4} className="text-white shrink-0" />
                      </div>
                      <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest transition-colors ${password.length >= 6 ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {t.auth.register.passwordHint}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 lg:gap-3 2xl:gap-4 px-1.5 lg:px-2 2xl:px-3 py-1 lg:py-2 2xl:py-2.5">
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5 lg:size-5 2xl:size-6" />
                  <p className="text-[8px] lg:text-[10px] 2xl:text-xs text-slate-500 leading-relaxed uppercase font-black tracking-widest">
                    {t.auth.register.termsText}{' '}
                    <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">{t.auth.register.termsLink}</Link>
                    {' '}{t.auth.register.and}{' '}
                    <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">{t.auth.register.privacyLink}</Link>.
                  </p>
                </div>

                <MagneticButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 sm:py-2.5 lg:py-3 xl:py-5 2xl:py-7 [@media(max-height:1400px)]:py-2 [@media(max-height:1200px)]:py-2 [@media(max-height:1080px)]:py-2 [@media(max-height:1000px)]:py-1.5 [@media(max-height:900px)]:py-1.5 [@media(max-height:800px)]:py-1.5 [@media(max-height:700px)]:py-1.5 [@media(max-height:600px)]:py-1 min-h-[34px] lg:min-h-[38px] 2xl:min-h-[52px] [@media(max-height:1400px)]:min-h-[36px] [@media(max-height:1200px)]:min-h-[36px] [@media(max-height:1080px)]:min-h-[36px] [@media(max-height:1000px)]:min-h-[34px] [@media(max-height:900px)]:min-h-[32px] [@media(max-height:800px)]:min-h-[30px] [@media(max-height:700px)]:min-h-[30px] [@media(max-height:600px)]:min-h-[28px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-lg lg:rounded-2xl xl:rounded-[24px] 2xl:rounded-3xl font-black uppercase tracking-[0.15em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] transition-all shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] lg:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] active:scale-[0.98] mt-1.5 lg:mt-3 2xl:mt-4 [@media(max-height:700px)]:mt-1 flex items-center justify-center gap-1.5 lg:gap-4 2xl:gap-5 text-[9px] lg:text-xs xl:text-sm 2xl:text-base [@media(max-height:600px)]:text-[9px] relative overflow-hidden cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 lg:w-6 lg:h-6 2xl:w-7 2xl:h-7 border-2 lg:border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {t.auth.register.submit} <ArrowRight size={14} className="lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                    </>
                  )}
                </MagneticButton>
              </form>

              <div className="mt-2.5 lg:mt-4 xl:mt-5 2xl:mt-8 [@media(max-height:1400px)]:mt-3 [@media(max-height:1200px)]:mt-3 [@media(max-height:1080px)]:mt-3 [@media(max-height:1000px)]:mt-2.5 [@media(max-height:900px)]:mt-2 [@media(max-height:800px)]:mt-1.5 [@media(max-height:700px)]:mt-1.5 [@media(max-height:600px)]:mt-1 pt-2.5 lg:pt-3 2xl:pt-6 [@media(max-height:1400px)]:pt-2.5 [@media(max-height:1200px)]:pt-2.5 [@media(max-height:1080px)]:pt-2.5 [@media(max-height:900px)]:pt-2 [@media(max-height:800px)]:pt-1.5 [@media(max-height:600px)]:pt-1 border-t border-slate-800">
                <label className="block text-[8px] lg:text-[10px] 2xl:text-xs font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] 2xl:tracking-[0.35em] text-slate-500 mb-1 lg:mb-2 2xl:mb-3 [@media(max-height:700px)]:mb-1 ml-3 lg:ml-4 2xl:ml-5">
                  {t.auth.register.referralCodeLabel ?? 'Código de Referência (Opcional)'}
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode((e.target.value || '').trim().slice(0, 20))}
                  className={`w-full bg-slate-950/50 border rounded-lg lg:rounded-xl xl:rounded-2xl 2xl:rounded-3xl py-2.5 lg:py-4 2xl:py-5 [@media(max-height:700px)]:py-2 [@media(max-height:600px)]:py-1.5 pl-3 lg:pl-5 2xl:pl-6 pr-3 lg:pr-5 2xl:pr-6 text-[11px] lg:text-sm 2xl:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${
                    referralCodeValid === 'valid' ? 'border-emerald-500/50 focus:border-emerald-500' :
                    referralCodeValid === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
                    'border-slate-800 focus:border-amber-500'
                  }`}
                  placeholder={t.auth.register.referralCodePlaceholder ?? 'Ex: MM2HQR2K'}
                  maxLength={20}
                />
                {referralCode && (
                  <p className={`text-[10px] lg:text-xs 2xl:text-sm mt-1 lg:mt-2 2xl:mt-3 ml-1.5 lg:ml-2 2xl:ml-3 font-medium ${
                    referralCodeValid === 'valid' ? 'text-emerald-400' :
                    referralCodeValid === 'invalid' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {referralCodeValid === 'checking'
                      ? (t.auth.register.referralCodeChecking ?? 'A verificar...')
                      : referralCodeValid === 'valid'
                        ? `${t.auth.register.referralCodeApplied ?? 'Código aplicado'}: ${referralCode}`
                        : referralCodeValid === 'invalid'
                          ? (t.auth.register.referralCodeInvalid ?? 'Código de afiliado inválido')
                          : `${t.auth.register.referralCodeApplied ?? 'Código aplicado'}: ${referralCode}`}
                  </p>
                )}
              </div>

              <div className="mt-2.5 lg:mt-4 xl:mt-5 2xl:mt-8 [@media(max-height:1400px)]:mt-3 [@media(max-height:1200px)]:mt-3 [@media(max-height:1080px)]:mt-3 [@media(max-height:1000px)]:mt-2.5 [@media(max-height:900px)]:mt-2 [@media(max-height:800px)]:mt-1.5 [@media(max-height:700px)]:mt-1.5 [@media(max-height:600px)]:mt-1">
                <div className="relative mb-2.5 lg:mb-4 2xl:mb-8 [@media(max-height:1400px)]:mb-3 [@media(max-height:1200px)]:mb-3 [@media(max-height:1400px)]:mb-3 [@media(max-height:1200px)]:mb-3 [@media(max-height:1080px)]:mb-3 [@media(max-height:1000px)]:mb-2.5 [@media(max-height:900px)]:mb-2 [@media(max-height:800px)]:mb-1.5 [@media(max-height:700px)]:mb-1.5 [@media(max-height:600px)]:mb-1 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[7px] lg:text-[9px] 2xl:text-[10px] font-black uppercase tracking-[0.25em] lg:tracking-[0.4em] 2xl:tracking-[0.5em]">
                    <span className="bg-[#020617] px-2 lg:px-4 2xl:px-5 text-slate-600">ou</span>
                  </div>
                </div>
                <div className="flex justify-center scale-[0.9] sm:scale-95 lg:scale-100 2xl:scale-105">
                  <GoogleRegisterButton onLoginSuccess={(token) => handleSocialLogin(token, 'google')} referralCode={referralCode} />
                </div>
              </div>
            </motion.div>

            <div className="mt-2.5 lg:mt-4 xl:mt-5 2xl:mt-8 [@media(max-height:1400px)]:mt-3 [@media(max-height:1200px)]:mt-3 [@media(max-height:1080px)]:mt-3 [@media(max-height:1000px)]:mt-2.5 [@media(max-height:900px)]:mt-2 [@media(max-height:800px)]:mt-1.5 [@media(max-height:700px)]:mt-1.5 [@media(max-height:600px)]:mt-1 text-center flex flex-col items-center">
              <p className="text-slate-500 font-medium text-xs sm:text-sm lg:text-base xl:text-lg 2xl:text-xl mb-1.5 lg:mb-2 xl:mb-4 2xl:mb-6 [@media(max-height:1400px)]:mb-1.5 [@media(max-height:1200px)]:mb-1.5 [@media(max-height:1080px)]:mb-1.5 [@media(max-height:1000px)]:mb-1 [@media(max-height:900px)]:mb-1 [@media(max-height:800px)]:mb-1 [@media(max-height:700px)]:mb-1 [@media(max-height:600px)]:mb-0.5 italic">
                {t.auth.register.alreadyHaveAccount}
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 lg:gap-3 xl:gap-4 2xl:gap-5 bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 px-5 lg:px-8 xl:px-12 2xl:px-14 py-3 lg:py-4 xl:py-6 2xl:py-7 [@media(max-height:700px)]:px-5 [@media(max-height:700px)]:py-3 [@media(max-height:600px)]:px-4 [@media(max-height:600px)]:py-2.5 rounded-xl lg:rounded-2xl xl:rounded-[24px] 2xl:rounded-3xl font-black uppercase tracking-[0.15em] lg:tracking-[0.2em] 2xl:tracking-[0.25em] text-[9px] lg:text-[10px] xl:text-sm 2xl:text-base [@media(max-height:600px)]:text-[9px] text-white transition-all hover:scale-105 active:scale-95 group shadow-xl cursor-pointer"
              >
                {t.auth.register.loginCta}
                <ArrowRight size={12} className="text-emerald-500 group-hover:translate-x-1 transition-transform lg:w-[18px] lg:h-[18px] xl:size-5 2xl:size-6 [@media(max-height:600px)]:w-3.5 [@media(max-height:600px)]:h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 lg:bottom-8 xl:bottom-12 2xl:bottom-16 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 xl:right-12 2xl:right-16 lg:translate-x-0 flex items-center gap-1.5 lg:gap-2 xl:gap-3 2xl:gap-4 text-[7px] lg:text-[8px] xl:text-[10px] 2xl:text-xs [@media(max-height:700px)]:bottom-2 [@media(max-height:600px)]:bottom-1.5 [@media(max-height:600px)]:text-[6px] font-black text-slate-700 uppercase tracking-[0.25em] lg:tracking-[0.4em] xl:tracking-[0.5em] opacity-50 whitespace-nowrap">
          <ShieldCheck size={10} className="lg:w-3 lg:h-3 xl:size-[14px] 2xl:size-4" />
          {t.auth.register.securePrivate}
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
