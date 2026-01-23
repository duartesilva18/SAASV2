'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, Coins, UserCircle, ArrowRight, Check, AlertCircle, Loader2, BellRing } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t, setCurrency } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    country_code: '+351',
    phone_number: '',
    currency: 'EUR',
    gender: 'prefer_not_to_say',
    marketing_opt_in: false
  });

  const countries = [
    { code: '+351', flag: '🇵🇹', name: 'Portugal' },
    { code: '+34', flag: '🇪🇸', name: 'Espanha' },
    { code: '+33', flag: '🇫🇷', name: 'França' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+55', flag: '🇧🇷', name: 'Brasil' },
    { code: '+49', flag: '🇩🇪', name: 'Alemanha' },
    { code: '+41', flag: '🇨🇭', name: 'Suíça' },
    { code: '+352', flag: '🇱🇺', name: 'Luxemburgo' },
    { code: '+244', flag: '🇦🇴', name: 'Angola' },
    { code: '+238', flag: '🇨🇻', name: 'Cabo Verde' },
    { code: '+258', flag: '🇲🇿', name: 'Moçambique' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validação de Nome (Pelo menos dois nomes)
    const nameParts = formData.full_name.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setError('Por favor, introduz o teu primeiro e último nome.');
      return;
    }

    // Validação de Telefone (Mínimo de 7 dígitos além do código do país)
    const cleanPhone = formData.phone_number.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      setError('Por favor, introduz um número de telefone válido.');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `${formData.country_code}${cleanPhone}`;
      await api.post('/auth/onboarding', {
        ...formData,
        full_name: formData.full_name.trim(),
        phone_number: fullPhone
      });

      setCurrency(formData.currency as any);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#ffffff']
      });

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao guardar os teus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-[#020617] border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-900">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2 }}
            className="h-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          />
        </div>

        <div className="p-8 lg:p-12">
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-6">
              <Sparkles size={32} />
            </div>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-white mb-3">
              Bem-vindo ao seu <span className="text-blue-500 italic">Novo Eu Financeiro</span>
            </h2>
            <p className="text-slate-400 font-medium italic">
              Apenas alguns detalhes para começarmos a sua jornada Zen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  Primeiro e Último Nome
                </label>
                <div className="relative group">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                    placeholder="Ex: Duarte Silva"
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  Moeda Base
                </label>
                <div className="relative group">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                  >
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dólar ($)</option>
                    <option value="BRL">Real (R$)</option>
                  </select>
                </div>
              </div>

              {/* Phone Number */}
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  Número de Telegram (para registar despesas)
                </label>
                <div className="flex gap-3">
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none w-32 shrink-0"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                    placeholder="912 345 678"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  Gênero (opcional)
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                >
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                  <option value="prefer_not_to_say">Prefiro não dizer</option>
                </select>
              </div>

              {/* Marketing Opt-in */}
              <div className="md:col-span-2">
                <div 
                  onClick={() => setFormData({ ...formData, marketing_opt_in: !formData.marketing_opt_in })}
                  className={`group flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    formData.marketing_opt_in 
                    ? 'bg-blue-600/5 border-blue-500/30' 
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl transition-colors ${
                      formData.marketing_opt_in ? 'text-blue-400 bg-blue-400/10' : 'text-slate-600 bg-slate-900'
                    }`}>
                      <BellRing size={18} />
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest transition-colors ${
                        formData.marketing_opt_in ? 'text-white' : 'text-slate-500'
                      }`}>
                        Dicas & Novidades Zen
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium italic">
                        Relatórios e insights exclusivos no teu email.
                      </p>
                    </div>
                  </div>
                  
                  {/* Minimal Toggle */}
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative ${
                    formData.marketing_opt_in ? 'bg-blue-600' : 'bg-slate-800'
                  }`}>
                    <motion.div 
                      animate={{ x: formData.marketing_opt_in ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-black tracking-tight"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-4 text-sm group cursor-pointer"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Entrar no Ecossistema <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

