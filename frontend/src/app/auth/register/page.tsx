'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, Mail, Lock, AlertCircle, ChevronLeft, CheckCircle2, ShieldCheck, Zap, Trophy, Heart, Star, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';

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

// registerBenefits agora vem das traduções

export default function RegisterPage() {
  const { t, language } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const router = useRouter();

  const registerBenefits = t.auth.register.registerBenefits;

  useEffect(() => {
    const interval = setInterval(() => {
      setBenefitIndex((prev) => (prev + 1) % registerBenefits.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [registerBenefits.length]);

  const validateEmail = (email: string) => {
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
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
    if (password.length < 6) {
      setError(t.auth.register.passwordHint);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        email,
        password,
        language
      });
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#ffffff']
      });

      setTimeout(() => {
        router.push(`/auth/check-email?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || t.auth.register.error);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col md:flex-row relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="hidden lg:flex md:w-1/2 flex-col justify-center p-12 lg:p-20 relative z-10 border-r border-slate-900/50 bg-slate-950/60">
        <Link
          href="/"
          className="absolute top-12 left-12 lg:left-20 flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-black uppercase tracking-[0.3em] group cursor-pointer"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          {t.auth.register.backToHome}
        </Link>

        <div className="relative min-h-[400px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={benefitIndex}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-[24px] lg:rounded-[28px] flex items-center justify-center text-white mb-8 lg:mb-12 -rotate-3 ring-1 ring-emerald-500/20">
                <Sparkles size={32} className="lg:size-[40px]" />
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[0.9] mb-6 lg:mb-8">
                {registerBenefits[benefitIndex].title.split(' ').map((word: string, i: number) => (
                  <span key={i} className={i % 2 === 1 ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 italic font-black" : ""}>
                    {word}{' '}
                  </span>
                ))}
              </h2>
              <p className="text-xl lg:text-2xl text-slate-400 mb-8 lg:mb-12 max-w-lg leading-relaxed font-medium italic border-l-4 border-emerald-500/30 pl-6 lg:pl-8">
                "{registerBenefits[benefitIndex].quote}"
              </p>
              <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-8 lg:mb-12">
                {[
                  { i: Zap, t: t.auth.register.benefits.instant, c: "text-amber-500" },
                  { i: Heart, t: t.auth.register.benefits.noStress, c: "text-rose-500" },
                  { i: ShieldCheck, t: t.auth.register.benefits.privacy, c: "text-blue-500" },
                  { i: Star, t: t.auth.register.benefits.guarantee, c: "text-emerald-500" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-800 p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] group hover:border-emerald-500/30 transition-all">
                    <item.i size={20} className={`${item.c} mb-3 lg:mb-4 lg:size-[24px]`} />
                    <div className="text-[10px] lg:text-sm font-black uppercase tracking-widest text-white">{item.t}</div>
                  </div>
                ))}
              </div>
              <div className="p-6 lg:p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-[24px] lg:rounded-[32px] max-w-md flex items-center gap-4 lg:gap-6">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-emerald-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                  <Trophy size={24} className="lg:size-[28px]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80 leading-relaxed">
                  {registerBenefits[benefitIndex].stat}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-2 mt-12 lg:mt-16">
            {registerBenefits.map((_: any, i: number) => (
              <div
                key={i}
                className={`h-1.5 transition-all duration-700 rounded-full ${i === benefitIndex ? 'w-12 lg:w-16 bg-emerald-500' : 'w-3 lg:w-4 bg-slate-800'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24 relative z-10 bg-[#020617]">
        <div className="lg:hidden absolute top-6 sm:top-8 left-6 sm:left-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] cursor-pointer"
          >
            <ChevronLeft size={14} />
            {t.auth.register.back}
          </Link>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-[520px]">
          <div className="mb-8 lg:mb-12 text-center lg:text-left">
            <div className="lg:hidden w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-6 shadow-emerald-600/30">
              <Sparkles size={24} />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-3 lg:mb-4 text-white">
              {t.auth.register.title}
              <span className="text-emerald-500 italic font-black ml-2">{t.auth.register.titleAccent}</span>
            </h1>
            <p className="text-slate-500 font-medium text-base lg:text-lg italic">
              {t.auth.register.subtitle}
            </p>
          </div>

          <motion.div
            animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
            className={`bg-slate-900/60 border p-8 sm:p-10 lg:p-12 rounded-[40px] lg:rounded-[56px] relative overflow-hidden transition-all duration-500 ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
          >
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-black tracking-tight leading-tight"
                >
                  <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle size={16} />
                  </div>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} noValidate className="space-y-6 lg:space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 ml-2">
                  {t.auth.register.emailLabel}
                </label>
                <div className="relative group/input">
                  <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && !validateEmail(email) ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-emerald-500'}`}>
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    className={`w-full bg-slate-950/50 border rounded-[24px] py-5 lg:py-6 pl-14 pr-5 text-sm lg:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && !validateEmail(email) ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-emerald-500'}`}
                    placeholder={t.auth.register.emailPlaceholder}
                    required
                  />
                  {email && validateEmail(email) && !error && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500">
                      <CheckCircle2 size={18} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 ml-2">
                  {t.auth.register.passwordLabel}
                </label>
                <div className="relative group/input mb-4">
                  <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error && password.length < 6 ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-emerald-500'}`}>
                    <Lock size={20} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    className={`w-full bg-slate-950/50 border rounded-[28px] py-6 pl-16 pr-14 text-sm lg:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error && password.length < 6 ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-emerald-500'}`}
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-1 cursor-pointer z-10"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="px-4 space-y-3">
                  <div className="flex gap-2 h-1.5">
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
                  <div className="flex items-center gap-2 transition-all duration-300">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${password.length >= 6 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-600'}`}>
                      <CheckCircle2 size={10} strokeWidth={4} />
                    </div>
                    <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-colors ${password.length >= 6 ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {t.auth.register.passwordHint}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 px-2 py-2">
                <ShieldCheck size={18} className="text-emerald-500 shrink-0 mt-0.5 lg:size-[20px]" />
                <p className="text-[9px] lg:text-[10px] text-slate-500 leading-relaxed uppercase font-black tracking-widest">
                  {t.auth.register.termsText}{' '}
                  <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">
                    {t.auth.register.termsLink}
                  </Link>
                  {' '}{t.auth.register.and}{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    {t.auth.register.privacyLink}
                  </Link>.
                </p>
              </div>

              <MagneticButton
                type="submit"
                disabled={loading}
                className="w-full py-5 lg:py-7 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 lg:gap-4 text-xs lg:text-sm relative overflow-hidden cursor-pointer"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {t.auth.register.submit} <ArrowRight size={20} />
                  </>
                )}
              </MagneticButton>
            </form>
          </motion.div>

          <div className="mt-10 lg:mt-14 text-center">
            <p className="text-slate-500 font-medium text-base lg:text-lg mb-4 lg:mb-6 italic">
              {t.auth.register.alreadyHaveAccount}
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-3 lg:gap-4 bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 px-8 lg:px-12 py-4 lg:py-6 rounded-[28px] lg:rounded-[32px] font-black uppercase tracking-[0.2em] text-[10px] lg:text-sm text-white transition-all hover:scale-105 active:scale-95 group shadow-xl cursor-pointer"
            >
              {t.auth.register.loginCta}
              <ArrowRight size={18} className="text-emerald-500 group-hover:translate-x-1 transition-transform lg:size-[20px]" />
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-8 lg:bottom-12 right-12 text-[8px] lg:text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] lg:tracking-[0.5em] opacity-50 flex items-center gap-2 lg:gap-3 whitespace-nowrap">
        <ShieldCheck size={12} className="lg:size-[14px]" />
        {t.auth.register.securePrivate}
      </div>
    </div>
  );
}

