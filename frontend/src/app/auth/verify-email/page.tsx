'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useUser } from '@/lib/UserContext';
import { useTranslation } from '@/lib/LanguageContext';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useUser();
  const { t } = useTranslation();
  const token = searchParams.get('token');
  const ref = searchParams.get('ref');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(t.auth.verifyEmail?.processing ?? 'A validar o seu acesso...');
    const verify = async () => {
      const existingToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (existingToken) {
        router.replace('/dashboard');
        return;
      }

      if (!token) {
        router.replace('/auth/login');
        return;
      }

      try {
        const params = new URLSearchParams({ token });
        if (ref) params.set('ref', ref);
        const response = await api.get(`/auth/verify-email?${params.toString()}`);
        
        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;

        if (!accessToken) {
          setStatus('error');
          setMessage(t.auth.verifyEmail?.loginError ?? 'Erro ao iniciar sessão após a verificação. Tenta novamente.');
          return;
        }

        // Guardar tokens se vierem na resposta
        localStorage.setItem('token', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }
        localStorage.removeItem('pending_verification_expires_at');

        // Notificar outras abas
        const channel = new BroadcastChannel('email-verification');
        channel.postMessage({ 
          status: 'verified', 
          access_token: accessToken,
          refresh_token: refreshToken
        });
        channel.close();

        // Atualizar o contexto do utilizador antes de redirecionar
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        try {
          await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } catch (err: any) {
          setStatus('error');
          setMessage(err.response?.data?.detail || (t.auth as any).verifyEmail?.loginError || 'Erro ao iniciar sessão após a verificação.');
          return;
        }

        await refreshUser();

        setStatus('success');
        setMessage(t.auth.verifyEmail?.successMessage ?? 'Email verificado com sucesso!');
        
        import('canvas-confetti').then((mod) => {
          mod.default({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#10b981', '#ffffff']
          });
        });

        // Redirecionar após um pequeno delay para garantir que tudo está atualizado
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        const d = err.response?.data?.detail;
        const msg = typeof d === 'string' ? d : Array.isArray(d) ? (d[0]?.msg || String(d)) : ((t.auth as any).verifyEmail?.verifyError || 'Erro ao verificar o email.');
        setMessage(msg);
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[520px] text-center"
      >
        <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3 ring-4 ${
          status === 'loading' ? 'bg-blue-600/10 text-blue-500 ring-blue-500/10' :
          status === 'success' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/10' :
          'bg-red-500/10 text-red-500 ring-red-500/10'
        }`}>
          {status === 'loading' ? <Loader2 size={40} className="animate-spin" /> :
           status === 'success' ? <CheckCircle2 size={40} /> :
           <AlertCircle size={40} />}
        </div>

        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-white mb-4">
          {status === 'loading' ? (t.auth.verifyEmail?.processing ?? 'A Processar...') :
           status === 'success' ? (t.auth.verifyEmail?.emailVerified ?? 'Email Verificado') :
           (t.auth.verifyEmail?.verificationError ?? 'Erro na Verificação')}
        </h1>

        <p className="text-slate-400 text-lg lg:text-xl font-medium leading-relaxed italic mb-8">
          {message}
        </p>

        {status === 'error' && (
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
          >
            {t.auth.forgotPassword?.backToLogin ?? 'Voltar ao Login'}
          </button>
        )}
      </motion.div>

      <div className="relative z-20 py-3 text-center">
        <p className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          {t.auth.login?.sslSecured ?? 'SSL Secured'}
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

