'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, UserCircle, ArrowRight, Check, AlertCircle, Loader2, BellRing, Phone } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

interface OnboardingModalProps {
  onComplete: () => void;
}

const NAME_REGEX = /^[\p{L}\s'\-]+$/u;
const MAX_NAME_LENGTH = 60;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

function capitalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Introduz o teu nome completo.';
  if (trimmed.length > MAX_NAME_LENGTH) return `Nome demasiado longo (máx. ${MAX_NAME_LENGTH} caracteres).`;
  if (!NAME_REGEX.test(trimmed)) return 'O nome só pode conter letras, espaços, hífens e apóstrofos.';
  const parts = trimmed.replace(/\s+/g, ' ').split(' ').filter(p => p.length > 0);
  if (parts.length < 2) return 'Introduz o primeiro e último nome.';
  if (parts.some(p => p.length < 2)) return 'Cada nome deve ter pelo menos 2 letras.';
  return null;
}

function validatePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return 'Introduz o teu número de telefone.';
  if (digits.length < MIN_PHONE_DIGITS) return `Mínimo ${MIN_PHONE_DIGITS} dígitos.`;
  if (digits.length > MAX_PHONE_DIGITS) return `Máximo ${MAX_PHONE_DIGITS} dígitos.`;
  return null;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t, setCurrency } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    full_name: '',
    country_code: '+351',
    phone_number: '',
    currency: 'EUR',
    gender: 'prefer_not_to_say',
    marketing_opt_in: false
  });

  const countries = [
    { code: '+351', flag: '🇵🇹', name: t.dashboard.onboarding.countries.portugal },
    { code: '+34', flag: '🇪🇸', name: t.dashboard.onboarding.countries.spain },
    { code: '+33', flag: '🇫🇷', name: t.dashboard.onboarding.countries.france },
    { code: '+44', flag: '🇬🇧', name: t.dashboard.onboarding.countries.uk },
    { code: '+1', flag: '🇺🇸', name: t.dashboard.onboarding.countries.usa },
    { code: '+55', flag: '🇧🇷', name: t.dashboard.onboarding.countries.brazil },
    { code: '+49', flag: '🇩🇪', name: t.dashboard.onboarding.countries.germany },
    { code: '+41', flag: '🇨🇭', name: t.dashboard.onboarding.countries.switzerland },
    { code: '+352', flag: '🇱🇺', name: t.dashboard.onboarding.countries.luxembourg },
    { code: '+244', flag: '🇦🇴', name: t.dashboard.onboarding.countries.angola },
    { code: '+238', flag: '🇨🇻', name: t.dashboard.onboarding.countries.capeVerde },
    { code: '+258', flag: '🇲🇿', name: t.dashboard.onboarding.countries.mozambique },
  ];

  const nameError = useMemo(() => validateName(formData.full_name), [formData.full_name]);
  const phoneError = useMemo(() => validatePhone(formData.phone_number), [formData.phone_number]);

  const nameOk = touched.full_name && !nameError;
  const phoneOk = touched.phone_number && !phoneError;

  const markTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const handleNameChange = useCallback((val: string) => {
    const cleaned = val.replace(/[^\p{L}\s'\-]/gu, '').slice(0, MAX_NAME_LENGTH);
    setFormData(prev => ({ ...prev, full_name: cleaned }));
    setError('');
  }, []);

  const handlePhoneChange = useCallback((val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
    setFormData(prev => ({ ...prev, phone_number: digits }));
    setError('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({ full_name: true, phone_number: true });

    if (nameError) { setError(nameError); return; }
    if (phoneError) { setError(phoneError); return; }

    setLoading(true);
    try {
      const cleanPhone = formData.phone_number.replace(/\D/g, '');
      const fullPhone = `${formData.country_code}${cleanPhone}`;
      const sanitizedName = capitalizeName(formData.full_name);

      await api.post('/auth/onboarding', {
        ...formData,
        full_name: sanitizedName,
        phone_number: fullPhone
      });

      setCurrency(formData.currency as any);

      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao guardar os teus dados.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = 'w-full bg-slate-950/60 border rounded-xl py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:ring-2 placeholder:text-slate-500 transition-all duration-200';
  const labelBase = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

  const fieldBorder = (ok: boolean, hasError: boolean, isTouched: boolean) => {
    if (!isTouched) return 'border-slate-700 focus-within:ring-blue-500/50';
    if (hasError) return 'border-red-500/50 focus-within:ring-red-500/50';
    if (ok) return 'border-emerald-500/40 focus-within:ring-emerald-500/50';
    return 'border-slate-700 focus-within:ring-blue-500/50';
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[min(32rem,100%)] sm:max-w-[28rem] md:max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-0.5 bg-slate-800 shrink-0">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2 }}
            className="h-full bg-blue-500"
          />
        </div>

        <div className="p-5 sm:p-6 md:p-8 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          <div className="mb-5 sm:mb-6 text-center">
            <img
              src="/images/logo/logo-semfundo.png"
              alt="Finly"
              className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 object-contain select-none"
              draggable={false}
            />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white mb-1.5 sm:mb-2">
              Bem-vindo ao seu <span className="text-blue-400 italic">Novo Eu Financeiro</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Apenas alguns detalhes para começarmos a sua jornada Zen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Nome */}
              <div>
                <label className={labelBase}>
                  Primeiro e Último Nome
                  {nameOk && <Check size={12} className="inline ml-1.5 text-emerald-400" />}
                </label>
                <div className={`relative ${fieldBorder(nameOk, !!nameError && touched.full_name, touched.full_name)}`}>
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={formData.full_name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => markTouched('full_name')}
                    className={`${inputBase} pl-10 pr-3 ${fieldBorder(nameOk, !!nameError && touched.full_name, touched.full_name)}`}
                    placeholder="Ex: Duarte Silva"
                  />
                </div>
                {touched.full_name && nameError && (
                  <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} className="shrink-0" />
                    {nameError}
                  </p>
                )}
              </div>

              {/* Moeda */}
              <div>
                <label className={labelBase}>Moeda Base</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={`${inputBase} pl-10 pr-8 appearance-none cursor-pointer border-slate-700 focus-within:ring-blue-500/50`}
                  >
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dólar ($)</option>
                    <option value="BRL">Real (R$)</option>
                  </select>
                </div>
              </div>

              {/* Telefone */}
              <div className="md:col-span-2">
                <label className={labelBase}>
                  Número de Telegram (para registar despesas)
                  {phoneOk && <Check size={12} className="inline ml-1.5 text-emerald-400" />}
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className={`${inputBase} sm:w-28 shrink-0 px-3 border-slate-700 focus-within:ring-blue-500/50`}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1 min-w-0">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      autoComplete="tel-national"
                      inputMode="numeric"
                      value={formData.phone_number}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => markTouched('phone_number')}
                      className={`${inputBase} pl-10 pr-3 ${fieldBorder(phoneOk, !!phoneError && touched.phone_number, touched.phone_number)}`}
                      placeholder="912 345 678"
                    />
                  </div>
                </div>
                {touched.phone_number && phoneError && (
                  <p className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} className="shrink-0" />
                    {phoneError}
                  </p>
                )}
                {phoneOk && (
                  <p className="mt-1 text-[11px] text-emerald-400/70">
                    {formData.country_code} {formData.phone_number.replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3')}
                  </p>
                )}
              </div>

              {/* Genero */}
              <div className="md:col-span-2">
                <label className={labelBase}>Género (opcional)</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className={`${inputBase} px-4 cursor-pointer border-slate-700 focus-within:ring-blue-500/50`}
                >
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                  <option value="prefer_not_to_say">Prefiro não dizer</option>
                </select>
              </div>

              {/* Marketing */}
              <div className="md:col-span-2">
                <div
                  onClick={() => setFormData({ ...formData, marketing_opt_in: !formData.marketing_opt_in })}
                  className={`flex items-center justify-between gap-3 p-4 sm:p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
                    formData.marketing_opt_in
                      ? 'bg-blue-600/10 border-blue-500/30'
                      : 'bg-slate-950/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${formData.marketing_opt_in ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-800/60'}`}>
                      <BellRing size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold uppercase tracking-wider ${formData.marketing_opt_in ? 'text-white' : 'text-slate-400'}`}>
                        Dicas & Novidades Zen
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Relatórios e insights exclusivos no teu email.
                      </p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors duration-300 ${formData.marketing_opt_in ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <motion.div
                      animate={{ x: formData.marketing_opt_in ? 20 : 0 }}
                      className="w-5 h-5 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs font-medium"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px] group"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin shrink-0" />
              ) : (
                <>
                  Entrar no Ecossistema
                  <ArrowRight size={18} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
