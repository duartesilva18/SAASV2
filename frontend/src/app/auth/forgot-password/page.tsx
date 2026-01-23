'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Mail, AlertCircle, ChevronLeft, CheckCircle2 } from 'lucide-react';
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

  const validateEmail = (email: string) => {
    return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 sm:p-12">
      <div className="absolute top-6 sm:top-8 left-6 sm:left-8">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] cursor-pointer"
        >
          <ChevronLeft size={14} />
          {t.auth.forgotPassword.backToLogin}
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[520px]">
        <div className="mb-8 lg:mb-12 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white mx-auto mb-6 shadow-blue-600/30">
            <Sparkles size={24} />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-3 lg:mb-4 text-white">
            {t.auth.forgotPassword.title}<span className="text-blue-500 italic">{t.auth.forgotPassword.titleAccent}</span>
          </h1>
          <p className="text-slate-500 font-medium text-base lg:text-lg italic">
            {t.auth.forgotPassword.subtitle}
          </p>
        </div>

        <motion.div
          animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          className={`bg-slate-900/60 border p-8 sm:p-10 lg:p-12 rounded-[40px] lg:rounded-[56px] relative overflow-hidden transition-colors duration-500 group/card ${error ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}
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
                {t.auth.forgotPassword.successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <form onSubmit={handleSubmit} noValidate className="space-y-6 lg:space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 ml-2">
                  {t.auth.forgotPassword.emailLabel}
                </label>
                <div className="relative group/input">
                  <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error ? 'text-red-500' : 'text-slate-500 group-focus-within/input:text-blue-500'}`}>
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    className={`w-full bg-slate-950/50 border rounded-[24px] py-5 lg:py-6 pl-14 pr-5 text-sm lg:text-base focus:outline-none transition-all placeholder:text-slate-800 font-medium ${error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 focus:border-blue-500'}`}
                    placeholder={t.auth.forgotPassword.emailPlaceholder}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 lg:py-7 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 text-xs lg:text-sm cursor-pointer"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {t.auth.forgotPassword.submit} <ArrowRight size={20} />
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
