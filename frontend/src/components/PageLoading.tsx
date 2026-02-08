'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

interface PageLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
}

export default function PageLoading({ 
  message, 
  size = 'md',
  variant = 'default' 
}: PageLoadingProps) {
  const { t } = useTranslation();
  const displayMessage = message || t.dashboard.loading.loading;

  const sizeClasses = {
    sm: { spinner: 'w-8 h-8', text: 'text-xs', icon: 16 },
    md: { spinner: 'w-12 h-12', text: 'text-[10px]', icon: 20 },
    lg: { spinner: 'w-16 h-16', text: 'text-sm', icon: 24 }
  };

  const currentSize = sizeClasses[size];

  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className={`${currentSize.spinner} border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin`} />
          {displayMessage && (
            <p className={`${currentSize.text} font-black uppercase tracking-widest text-slate-500`}>
              {displayMessage}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
      {/* Spinner Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Dual Spinner */}
        <div className="relative">
          <div className={`${currentSize.spinner} border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin`} />
          <div className={`absolute inset-0 ${currentSize.spinner} border-4 border-transparent border-r-indigo-500 rounded-full animate-spin`} 
            style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} 
          />
          <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse rounded-full" />
        </div>

        {/* Loading Text */}
        {displayMessage && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${currentSize.text} font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse`}
          >
            {displayMessage}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

