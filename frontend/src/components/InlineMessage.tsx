'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

interface InlineMessageProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export default function InlineMessage({
  type,
  title,
  message,
  onClose,
  className = ''
}: InlineMessageProps) {
  const typeStyles = {
    success: {
      container: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      icon: <CheckCircle2 size={20} />
    },
    error: {
      container: 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-500/10',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      icon: <AlertCircle size={20} />
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      icon: <AlertTriangle size={20} />
    },
    info: {
      container: 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/10',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      icon: <Info size={20} />
    }
  };

  const styles = typeStyles[type];
  const { t } = useTranslation();
  const defaultTitle = {
    success: t.dashboard.sidebar.toastTypes.success,
    error: t.dashboard.sidebar.toastTypes.error,
    warning: t.dashboard.sidebar.toastTypes.warning,
    info: t.dashboard.sidebar.toastTypes.info
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`p-5 ${styles.container} border rounded-2xl flex items-start gap-4 shadow-lg ${className}`}
    >
      <div className={`w-10 h-10 ${styles.iconBg} ${styles.iconColor} rounded-xl flex items-center justify-center shrink-0`}>
        {styles.icon}
      </div>
      <div className="flex-1">
        {title && (
          <p className={`text-sm font-black uppercase tracking-widest mb-1 ${styles.iconColor}`}>
            {title}
          </p>
        )}
        <p className="text-xs font-medium opacity-90 leading-relaxed">
          {message}
        </p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/5 rounded-lg transition-colors shrink-0"
        >
          <X size={16} className={styles.iconColor} />
        </button>
      )}
    </motion.div>
  );
}

