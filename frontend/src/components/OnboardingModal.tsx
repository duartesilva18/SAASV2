'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, Coins, UserCircle, ArrowRight, Check, AlertCircle, Loader2, BellRing } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { DEFAULT_LANGUAGE, LanguageCode } from '@/lib/languages';
import api from '@/lib/api';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t, setCurrency, setLanguage, availableLanguages, language: currentLanguage, currency: currentCurrency } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Carregar idioma e moeda do localStorage (ou usar os valores atuais do contexto)
  const getInitialLanguage = (): LanguageCode => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language');
      if (savedLang && (savedLang === 'pt' || savedLang === 'en')) {
        return savedLang as LanguageCode;
      }
    }
    return currentLanguage || DEFAULT_LANGUAGE;
  };

  const getInitialCurrency = (): string => {
    if (typeof window !== 'undefined') {
      const savedCurrency = localStorage.getItem('currency');
      if (savedCurrency && ['EUR', 'USD', 'BRL', 'GBP'].includes(savedCurrency)) {
        return savedCurrency;
      }
    }
    return currentCurrency || 'EUR';
  };

  const [formData, setFormData] = useState({
    full_name: '',
    country_code: '+351',
    phone_number: '',
    currency: getInitialCurrency(),
    language: getInitialLanguage(),
    gender: '',
    marketing_opt_in: false
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Atualizar o idioma do contexto quando o utilizador muda o idioma no formulário
  useEffect(() => {
    if (formData.language && formData.language !== currentLanguage) {
      setLanguage(formData.language);
    }
  }, [formData.language, currentLanguage, setLanguage]);

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

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'full_name':
        if (!value || value.trim() === '') {
          return t.dashboard.onboarding.validation?.fullNameEmpty || 'O nome completo é obrigatório.';
        }
        const nameParts = value.trim().split(/\s+/);
        if (nameParts.length < 2) {
          return t.dashboard.onboarding.validation?.fullName || 'Por favor, introduz o teu primeiro e último nome.';
        }
        return '';
      case 'phone_number':
        if (!value || value.trim() === '') {
          return t.dashboard.onboarding.validation?.phoneEmpty || 'O número de telefone é obrigatório.';
        }
        const cleanPhone = value.replace(/\D/g, '');
        if (cleanPhone.length < 7) {
          return t.dashboard.onboarding.validation?.phone || 'Por favor, introduz um número de telefone válido (mínimo 7 dígitos).';
        }
        return '';
      case 'gender':
        if (!value || value === '') {
          return t.dashboard.onboarding.validation?.gender || 'Por favor, seleciona o teu gênero.';
        }
        return '';
      case 'language':
        if (!value || value === '') {
          return t.dashboard.onboarding.validation?.language || 'Por favor, seleciona o idioma.';
        }
        return '';
      default:
        return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validar todos os campos
    const errors: Record<string, string> = {};
    const nameError = validateField('full_name', formData.full_name);
    if (nameError) errors.full_name = nameError;

    const phoneError = validateField('phone_number', formData.phone_number);
    if (phoneError) errors.phone_number = phoneError;

    const genderError = validateField('gender', formData.gender);
    if (genderError) errors.gender = genderError;

    const languageError = validateField('language', formData.language);
    if (languageError) errors.language = languageError;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Mostrar o primeiro erro como mensagem geral
      setError(Object.values(errors)[0]);
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = formData.phone_number.replace(/\D/g, '');
      const fullPhone = `${formData.country_code}${cleanPhone}`;
      
      // Preparar dados para enviar (remover country_code que não é necessário no backend)
      const { country_code, ...dataToSend } = formData;
      
      await api.post('/auth/onboarding', {
        ...dataToSend,
        full_name: formData.full_name.trim(),
        phone_number: fullPhone
      });

      setCurrency(formData.currency as any);
      setLanguage(formData.language as any);

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
      console.error('Erro ao guardar dados de onboarding:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Erro ao guardar os teus dados. Por favor, tenta novamente.';
      setError(errorMessage);
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
              {t.dashboard.onboarding.title}{' '}
              <span className="text-blue-500 italic">{t.dashboard.onboarding.titleAccent}</span>
            </h2>
            <p className="text-slate-400 font-medium italic">
              {t.dashboard.onboarding.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  {t.dashboard.onboarding.fullName} *
                </label>
                <div className="relative group">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => {
                      setFormData({ ...formData, full_name: e.target.value });
                      if (fieldErrors.full_name) {
                        const error = validateField('full_name', e.target.value);
                        if (error) {
                          setFieldErrors({ ...fieldErrors, full_name: error });
                        } else {
                          const newErrors = { ...fieldErrors };
                          delete newErrors.full_name;
                          setFieldErrors(newErrors);
                        }
                      }
                    }}
                    onBlur={() => {
                      const error = validateField('full_name', formData.full_name);
                      if (error) {
                        setFieldErrors({ ...fieldErrors, full_name: error });
                      } else {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.full_name;
                        setFieldErrors(newErrors);
                      }
                    }}
                    onInvalid={(e) => {
                      e.preventDefault();
                    }}
                    className={`w-full bg-slate-950 border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none transition-all font-medium ${
                      fieldErrors.full_name 
                        ? 'border-orange-500 focus:border-orange-500' 
                        : 'border-slate-800 focus:border-blue-500'
                    }`}
                    placeholder={t.dashboard.onboarding.fullNamePlaceholder || "Ex: Duarte Silva"}
                  />
                </div>
                {fieldErrors.full_name && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-orange-400 text-xs font-medium"
                  >
                    <AlertCircle size={14} />
                    <span>{fieldErrors.full_name}</span>
                  </motion.div>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  {t.dashboard.onboarding.currency} *
                </label>
                <div className="relative group">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    onInvalid={(e) => {
                      e.preventDefault();
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                  >
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dólar ($)</option>
                    <option value="BRL">Real (R$)</option>
                    <option value="GBP">Libra (£)</option>
                  </select>
                </div>
              </div>

              {/* Phone Number */}
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  {t.dashboard.onboarding.phone} *
                </label>
                <div className="flex gap-3">
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    onInvalid={(e) => {
                      e.preventDefault();
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none w-32 shrink-0 cursor-pointer"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => {
                      setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') });
                      if (fieldErrors.phone_number) {
                        const error = validateField('phone_number', e.target.value.replace(/\D/g, ''));
                        if (error) {
                          setFieldErrors({ ...fieldErrors, phone_number: error });
                        } else {
                          const newErrors = { ...fieldErrors };
                          delete newErrors.phone_number;
                          setFieldErrors(newErrors);
                        }
                      }
                    }}
                    onBlur={() => {
                      const error = validateField('phone_number', formData.phone_number);
                      if (error) {
                        setFieldErrors({ ...fieldErrors, phone_number: error });
                      } else {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.phone_number;
                        setFieldErrors(newErrors);
                      }
                    }}
                    onInvalid={(e) => {
                      e.preventDefault();
                    }}
                    className={`flex-1 bg-slate-950 border rounded-2xl py-4 px-6 text-white focus:outline-none transition-all font-medium ${
                      fieldErrors.phone_number 
                        ? 'border-orange-500 focus:border-orange-500' 
                        : 'border-slate-800 focus:border-blue-500'
                    }`}
                    placeholder={t.dashboard.onboarding.phonePlaceholder || "912 345 678"}
                  />
                </div>
                {fieldErrors.phone_number && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-orange-400 text-xs font-medium"
                  >
                    <AlertCircle size={14} />
                    <span>{fieldErrors.phone_number}</span>
                  </motion.div>
                )}
              </div>

              {/* Language */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  {t.dashboard.onboarding.language || 'Idioma'} *
                </label>
                <div className="relative group">
                  <select
                    value={formData.language}
                    onChange={(e) => {
                      setFormData({ ...formData, language: e.target.value });
                      if (fieldErrors.language) {
                        const newErrors = { ...fieldErrors };
                        delete newErrors.language;
                        setFieldErrors(newErrors);
                      }
                    }}
                    onInvalid={(e) => {
                      e.preventDefault();
                    }}
                    className={`w-full bg-slate-950 border rounded-2xl py-4 px-6 text-white focus:outline-none transition-all font-medium appearance-none cursor-pointer ${
                      fieldErrors.language 
                        ? 'border-orange-500 focus:border-orange-500' 
                        : 'border-slate-800 focus:border-blue-500'
                    }`}
                  >
                    {Object.values(availableLanguages).map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldErrors.language && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-orange-400 text-xs font-medium"
                  >
                    <AlertCircle size={14} />
                    <span>{fieldErrors.language}</span>
                  </motion.div>
                )}
              </div>

              {/* Gender */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                  {t.dashboard.onboarding.gender} *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => {
                    setFormData({ ...formData, gender: e.target.value });
                    if (fieldErrors.gender) {
                      const newErrors = { ...fieldErrors };
                      delete newErrors.gender;
                      setFieldErrors(newErrors);
                    }
                  }}
                  onInvalid={(e) => {
                    e.preventDefault();
                  }}
                  className={`w-full bg-slate-950 border rounded-2xl py-4 px-6 text-white focus:outline-none transition-all font-medium appearance-none cursor-pointer ${
                    fieldErrors.gender 
                      ? 'border-orange-500 focus:border-orange-500' 
                      : 'border-slate-800 focus:border-blue-500'
                  }`}
                >
                  <option value="">{t.dashboard.onboarding.genderPlaceholder || 'Seleciona...'}</option>
                  <option value="male">{t.dashboard.onboarding.genderOptions.male}</option>
                  <option value="female">{t.dashboard.onboarding.genderOptions.female}</option>
                  <option value="other">{t.dashboard.onboarding.genderOptions.other}</option>
                  <option value="prefer_not_to_say">{t.dashboard.onboarding.genderOptions.prefer_not_to_say}</option>
                </select>
                {fieldErrors.gender && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-orange-400 text-xs font-medium"
                  >
                    <AlertCircle size={14} />
                    <span>{fieldErrors.gender}</span>
                  </motion.div>
                )}
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
                        {t.dashboard.onboarding.marketingOptIn || 'Dicas & Novidades Zen'}
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium italic">
                        {t.dashboard.onboarding.marketingOptInDescription || 'Relatórios e insights exclusivos no teu email.'}
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
              {error && Object.keys(fieldErrors).length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium"
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
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
                  {t.dashboard.onboarding.submit || 'Entrar no Ecossistema'} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

