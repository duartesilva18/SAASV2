'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, AlertCircle, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';

function VerifyRegisterContent() {
  const { t } = useTranslation();
  const { refreshUser } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const devCodeParam = searchParams.get('dev_code');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
    if (devCodeParam && /^\d{6}$/.test(devCodeParam)) setCode(devCodeParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError(t.auth.verifyRegister?.codeError ?? 'O código deve ter 6 dígitos.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register/confirm', { email, code });
      const accessToken = response.data?.access_token;
      const refreshToken = response.data?.refresh_token;
      if (accessToken) {
        localStorage.setItem('token', accessToken);
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      }
      await refreshUser();
      setSuccess(true);

      import('canvas-confetti').then((mod) => {
        const confetti = mod.default;
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#ffffff'],
        });
      });

      setTimeout(() => {
        router.replace('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? (t.auth.verifyRegister?.invalidCode ?? 'Código inválido ou expirado.'));
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const vr = t.auth?.verifyRegister ?? {};
  const title = vr.title ?? 'Verificar ';
  const titleAccent = vr.titleAccent ?? 'Registo';
  const subtitle = (vr.subtitle ?? 'Introduz o código de 6 dígitos enviado para {email}.').replace('{email}', email);
  const back = vr.back ?? 'Voltar ao Registo';
  const codeLabel = vr.codeLabel ?? 'Código de 6 dígitos';
  const codePlaceholder = vr.codePlaceholder ?? '000000';
  const submit = vr.submit ?? 'Confirmar e Entrar';
  const successMessage = vr.successMessage ?? 'Conta ativada! A redirecionar para o dashboard...';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#020617] text-slate-50 flex flex-col relative overflow-hidden">
      {/* Background: igual ao login/registo */}
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
          href="/auth/register"
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-semibold uppercase tracking-wider"
        >
          <ChevronLeft className="w-4 h-4" />
          {back}
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
              {title}
              <span className="text-blue-400 italic ml-1">{titleAccent}</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm sm:text-base">
              {subtitle}
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
                    <span>{successMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!success && (
                <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {codeLabel}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                      className={`w-full bg-slate-950/60 border rounded-xl py-3 sm:py-3.5 px-4 text-center text-xl tracking-[0.4em] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-600 ${error ? 'border-red-500/50' : 'border-slate-700'}`}
                      placeholder={codePlaceholder}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        <span>{vr.loadingConfirming ?? 'A confirmar…'}</span>
                      </>
                    ) : (
                      <>
                        {submit}
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

export default function VerifyRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <VerifyRegisterContent />
    </Suspense>
  );
}
