'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, AlertCircle, ChevronLeft, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
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

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#ffffff'],
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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 sm:p-12">
      <div className="absolute top-6 sm:top-8 left-6 sm:left-8">
        <Link
          href="/auth/register"
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] cursor-pointer"
        >
          <ChevronLeft size={14} />
          {back}
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[520px]">
        <div className="mb-8 lg:mb-12 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-6 shadow-emerald-600/30">
            <Mail size={24} />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-3 lg:mb-4 text-white">
            {title}<span className="text-emerald-500 italic">{titleAccent}</span>
          </h1>
          <p className="text-slate-500 font-medium text-base lg:text-lg italic">
            {subtitle}
          </p>
        </div>

        <motion.div
          animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          className={`bg-slate-900/60 border p-8 sm:p-10 lg:p-12 rounded-[32px] relative overflow-hidden transition-colors duration-500 ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
        >
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-black tracking-tight"
              >
                <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertCircle size={16} />
                </div>
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-black tracking-tight"
              >
                <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <form onSubmit={handleSubmit} noValidate className="space-y-6 lg:space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 ml-2">
                  {codeLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  className={`w-full bg-slate-950/50 border rounded-[24px] py-5 lg:py-6 px-6 text-center text-2xl tracking-[0.5em] focus:outline-none transition-all placeholder:text-slate-800 font-bold ${error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-emerald-500'}`}
                  placeholder={codePlaceholder}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 lg:py-7 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 text-xs lg:text-sm cursor-pointer"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {submit} <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function VerifyRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <VerifyRegisterContent />
    </Suspense>
  );
}
