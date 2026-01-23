'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

export default function LoadingIndicator() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Quando o pathname ou searchParams mudam, mostramos o loading por um breve momento
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-blue-600/20 backdrop-blur-md border border-blue-500/30 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl"
        >
          <Loader2 className="animate-spin text-blue-400" size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">
            {t.dashboard.loading.loading}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

