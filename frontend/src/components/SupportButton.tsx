'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, HelpCircle } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

export default function SupportButton() {
  const { t } = useTranslation();
  const [telegramNumber, setTelegramNumber] = useState("351925989577");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings/public');
        if (res.data && res.data.support_phone) {
          // Remove tudo o que não seja dígito (remove +, espaços, traços, etc)
          const cleanNumber = res.data.support_phone.replace(/\D/g, '');
          console.log('Suporte Telegram carregado:', cleanNumber);
          setTelegramNumber(cleanNumber);
        }
      } catch (err) {
        console.error('Erro ao carregar número de suporte:', err);
      }
    };
    fetchSettings();
  }, []);

  const message = encodeURIComponent(t.dashboard.support.message);
  // Garante que o número final no link está perfeitamente limpo
  const finalNumber = telegramNumber.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${finalNumber}?text=${message}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.5, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      whileHover={{ scale: 1.1, x: -5 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-6 right-6 z-[9999] flex flex-row-reverse items-center gap-3 group"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(16,185,129,0.4)] transition-colors border border-emerald-400/20">
          <MessageCircle size={28} className="fill-white/10" />
        </div>
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg">
          <HelpCircle size={12} className="text-white" />
        </div>
      </div>
    </motion.a>
  );
}
