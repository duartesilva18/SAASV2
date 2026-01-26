'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  icon
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      iconBorder: 'border-red-500/20',
      buttonBg: 'bg-red-600 hover:bg-red-500',
      buttonShadow: 'shadow-red-600/20',
      blurBg: 'bg-red-600/10'
    },
    warning: {
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      iconBorder: 'border-amber-500/20',
      buttonBg: 'bg-amber-600 hover:bg-amber-500',
      buttonShadow: 'shadow-amber-600/20',
      blurBg: 'bg-amber-600/10'
    },
    info: {
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      iconBorder: 'border-blue-500/20',
      buttonBg: 'bg-blue-600 hover:bg-blue-500',
      buttonShadow: 'shadow-blue-600/20',
      blurBg: 'bg-blue-600/10'
    }
  };

  const styles = variantStyles[variant];

  const defaultIcon = {
    danger: <Trash2 size={32} />,
    warning: <AlertTriangle size={32} />,
    info: <Info size={32} />
  };

  const displayIcon = icon || defaultIcon[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-2xl overflow-hidden text-center"
          >
            {/* Blur Effect */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${styles.blurBg} blur-[40px] rounded-full -z-10`} />

            {/* Icon */}
            <div className={`w-16 h-16 ${styles.iconBg} ${styles.iconColor} rounded-2xl flex items-center justify-center mx-auto mb-6 border ${styles.iconBorder}`}>
              {displayIcon}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-black text-white tracking-tighter mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-slate-400 text-sm font-medium italic mb-8 leading-relaxed">
              {message}
            </p>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-4 border border-slate-800 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-6 py-4 ${styles.buttonBg} text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg ${styles.buttonShadow} transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="opacity-0">...</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

