'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  isVisible: boolean;
  onClose: () => void;
}

export default function Toast({ message, type, isVisible, onClose }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
          className="fixed bottom-10 left-1/2 z-[400]"
        >
          <div className={`
            relative overflow-hidden
            flex items-center gap-4 px-6 py-4 rounded-[24px] 
            backdrop-blur-xl border shadow-2xl min-w-[300px]
            ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-500/10'}
          `}>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              ${type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}
            `}>
              {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">
                {type === 'success' ? 'Sucesso' : 'Erro'}
              </p>
              <p className="text-xs font-medium opacity-80 italic">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

