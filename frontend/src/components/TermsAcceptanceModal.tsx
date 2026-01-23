'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useUser } from '@/lib/UserContext';

interface TermsAcceptanceModalProps {
  onAccept: () => void;
}

export default function TermsAcceptanceModal({ onAccept }: TermsAcceptanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const { refreshUser } = useUser();

  const handleAccept = async () => {
    if (!accepted) {
      setError('Por favor, aceita os Termos e Condições para continuar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/accept-terms');
      await refreshUser();
      onAccept();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao aceitar os termos. Tenta novamente.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
        >
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full -z-10" />
          
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
              <FileText size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white mb-2">
                Aceitar Termos e Condições
              </h2>
              <p className="text-slate-400 text-sm">
                Para continuar a utilizar o Finly, precisas de aceitar os nossos Termos e Condições e Política de Privacidade.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Ao continuar, confirmas que:
              </p>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li className="flex items-start gap-2">
                  <Check size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Leste e compreendeste os nossos <Link href="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1">Termos e Condições <ExternalLink size={12} /></Link></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Leste e compreendeste a nossa <Link href="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1">Política de Privacidade <ExternalLink size={12} /></Link></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Concordas em cumprir todas as regras e políticas do Finly</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>Entendes que os teus dados serão tratados conforme descrito na Política de Privacidade</span>
                </li>
              </ul>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-slate-900/30 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-colors">
              <input
                type="checkbox"
                id="accept-terms"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  setError('');
                }}
                className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="accept-terms" className="flex-1 text-slate-300 text-sm cursor-pointer">
                <span className="font-semibold">Confirmo que li e aceito</span> os{' '}
                <Link href="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                  Termos e Condições
                </Link>
                {' '}e a{' '}
                <Link href="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                  Política de Privacidade
                </Link>
                {' '}do Finly.
              </label>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2"
              >
                <X size={16} />
                {error}
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAccept}
              disabled={loading || !accepted}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed cursor-pointer text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Aceitar e Continuar
                </>
              )}
            </motion.button>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-slate-500 mt-6">
            Ao clicar em "Aceitar e Continuar", concordas com todos os termos acima.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

