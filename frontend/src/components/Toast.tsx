'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number; // Duração em milissegundos, padrão 6000ms (6 segundos)
}

export default function Toast({ message, type, isVisible, onClose, duration = 6000 }: ToastProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
          className="fixed left-1/2 z-[400] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]"
        >
          <div className={`
            relative overflow-hidden
            flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-[24px] 
            backdrop-blur-xl border shadow-2xl min-w-[280px] max-w-[calc(100vw-2rem)]
            ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 
              type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-500/10' :
              type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/10'}
          `}>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              ${type === 'success' ? 'bg-emerald-500/20' : 
                type === 'error' ? 'bg-red-500/20' :
                type === 'warning' ? 'bg-amber-500/20' :
                'bg-blue-500/20'}
            `}>
              {type === 'success' ? <CheckCircle2 size={20} /> : 
               type === 'error' ? <AlertCircle size={20} /> :
               type === 'warning' ? <AlertTriangle size={20} /> :
               <Info size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">
                {type === 'success' ? t.dashboard.sidebar.toastTypes.success : 
                 type === 'error' ? t.dashboard.sidebar.toastTypes.error :
                 type === 'warning' ? t.dashboard.sidebar.toastTypes.warning :
                 t.dashboard.sidebar.toastTypes.info}
              </p>
              <p className="text-xs font-medium opacity-80 italic">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] -m-2 p-2 flex items-center justify-center hover:bg-white/5 rounded-xl transition-colors cursor-pointer active:scale-95"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

