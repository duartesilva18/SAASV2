'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'OK'
}: AlertModalProps) {
  const typeStyles = {
    success: {
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      iconBorder: 'border-emerald-500/20',
      blurBg: 'bg-emerald-500/10',
      icon: <CheckCircle2 size={32} />
    },
    error: {
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      iconBorder: 'border-red-500/20',
      blurBg: 'bg-red-500/10',
      icon: <AlertCircle size={32} />
    },
    warning: {
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      iconBorder: 'border-amber-500/20',
      blurBg: 'bg-amber-500/10',
      icon: <AlertTriangle size={32} />
    },
    info: {
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      iconBorder: 'border-blue-500/20',
      blurBg: 'bg-blue-500/10',
      icon: <Info size={32} />
    }
  };

  const styles = typeStyles[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-[32px] p-5 sm:p-8 shadow-2xl overflow-hidden text-center pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            {/* Blur Effect */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${styles.blurBg} blur-[40px] rounded-full -z-10`} />

            {/* Icon */}
            <div className={`w-14 h-14 sm:w-16 sm:h-16 ${styles.iconBg} ${styles.iconColor} rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 border ${styles.iconBorder}`}>
              {styles.icon}
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tighter mb-1 sm:mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-slate-400 text-sm font-medium italic mb-6 sm:mb-8 leading-relaxed whitespace-pre-line">
              {message}
            </p>

            {/* Button */}
            <button
              onClick={onClose}
              className={`w-full px-6 py-3.5 sm:py-4 ${type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : type === 'error' ? 'bg-red-600 hover:bg-red-500' : type === 'warning' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'} text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all cursor-pointer min-h-[48px]`}
            >
              {buttonText}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

