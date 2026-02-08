'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, AlertCircle, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) =>
    String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError(t.auth.login.invalidEmail);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email });
      setSuccess(true);
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || t.auth.forgotPassword.errorMessage);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
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
          href="/auth/login"
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider"
        >
          <ChevronLeft className="w-4 h-4" />
          {t.auth.forgotPassword.backToLogin}
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
              {t.auth.forgotPassword.title}
              <span className="text-blue-400 italic ml-1">{t.auth.forgotPassword.titleAccent}</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm sm:text-base">
              {t.auth.forgotPassword.subtitle}
            </p>
          </div>

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
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{t.auth.forgotPassword.successMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!success && (
                <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t.auth.forgotPassword.emailLabel}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                        className={`w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${error && !validateEmail(email) ? 'border-red-500/50' : 'border-slate-700'}`}
                        placeholder={t.auth.forgotPassword.emailPlaceholder}
                        required
                      />
                      {email && validateEmail(email) && !error && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        <span>{t.auth.forgotPassword.loadingSending}</span>
                      </>
                    ) : (
                      <>
                        {t.auth.forgotPassword.submit}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="relative z-20 py-3 text-center">
        <p className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          {t.auth.login.sslSecured}
        </p>
      </div>
    </div>
  );
}
