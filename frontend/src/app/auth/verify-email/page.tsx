'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import confetti from 'canvas-confetti';
import { useUser } from '@/lib/UserContext';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useUser();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('A validar o seu acesso...');

  useEffect(() => {
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
        const response = await api.get(`/auth/verify-email?token=${token}`);
        
        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;

        if (!accessToken) {
          setStatus('error');
          setMessage('Erro ao iniciar sessão após a verificação. Tenta novamente.');
          return;
        }

        // Guardar tokens se vierem na resposta
        localStorage.setItem('token', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }
        localStorage.removeItem('pending_verification_expires_at');

        // Notificar outras abas (como a check-email)
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
          setMessage(err.response?.data?.detail || 'Erro ao validar a sessão após a verificação.');
          return;
        }

        await refreshUser();

        setStatus('success');
        setMessage('Email verificado com sucesso!');
        
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#ffffff']
        });

        // Redirecionar após um pequeno delay para garantir que tudo está atualizado
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Erro ao verificar o email.');
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

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
          {status === 'loading' ? 'A Processar...' :
           status === 'success' ? 'Email Verificado' :
           'Erro na Verificação'}
        </h1>

        <p className="text-slate-400 text-lg lg:text-xl font-medium leading-relaxed italic mb-8">
          {message}
        </p>

        {status === 'error' && (
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
          >
            Voltar ao Login
          </button>
        )}
      </motion.div>

      <div className="absolute bottom-8 lg:bottom-12 right-12 text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] opacity-50 flex items-center gap-3">
        <Sparkles size={14} />
        Finly Portugal 2026
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

