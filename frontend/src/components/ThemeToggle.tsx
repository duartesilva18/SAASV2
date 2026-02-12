'use client';

import { useTheme } from '@/lib/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer ${
        isDark
          ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/50'
          : 'text-slate-500 hover:text-blue-600 hover:bg-slate-200/60'
      } ${className}`}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo escuro'}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -30, opacity: 0, scale: 0.8 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </motion.div>
    </button>
  );
}
