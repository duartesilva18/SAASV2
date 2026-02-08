'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '@/lib/api';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
      return;
    }
    router.replace('/auth/login');
  }, [email, router]);

  const handleSuccess = () => {
    setIsVerified(true);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      <Link
        href="/auth/register"
        className="absolute top-12 left-12 lg:left-20 flex items-center gap-2 text-slate-500 hover:text-white transition-all text-xs font-black uppercase tracking-[0.3em] group cursor-pointer"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Voltar
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[520px] text-center"
      >
        <AnimatePresence mode="wait">
          {!isVerified ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="space-y-8"
            >
              <div className="w-24 h-24 bg-blue-600/10 rounded-[32px] flex items-center justify-center text-blue-500 mx-auto mb-8 shadow-2xl shadow-blue-600/20 rotate-3 ring-4 ring-blue-500/10">
                <Mail size={40} className="animate-pulse" />
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-white mb-4">
                Verifique o seu <span className="text-blue-500 italic">Email</span>
              </h1>
              
              <p className="text-slate-400 text-lg lg:text-xl font-medium leading-relaxed italic">
                Enviámos um link de ativação para <br />
                <span className="text-white font-black not-italic ml-1">{email}</span>
              </p>

              <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[32px] space-y-6">
                <div className="flex items-center justify-center gap-4 text-slate-500">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">A aguardar ativação...</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Não recebeu? Verifique a pasta de spam ou <br /> 
                  <button className="text-blue-500 hover:text-blue-400 font-black uppercase tracking-widest mt-2">re-enviar email</button>
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-center gap-4 text-emerald-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">A redirecionar...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="absolute bottom-8 lg:bottom-12 right-12 text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] opacity-50 flex items-center gap-3">
        <Sparkles size={14} />
        Finly Portugal 2026
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckEmailContent />
    </Suspense>
  );
}

