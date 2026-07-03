'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Upload, Loader2,
  ChevronRight, BellRing,
  Lock, X
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import { mutate as swrMutate } from 'swr';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import PageLoading from '@/components/PageLoading';

export default function SettingsPage() {
  const { t, setCurrency, language, setLanguage, availableLanguages } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    country_code: '+351',
    phone_number: '',
    currency: 'EUR',
    gender: 'prefer_not_to_say',
    marketing_opt_in: false
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [hasPassword, setHasPassword] = useState(true);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordCode, setPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const countries = [
    { code: '+351', flag: '🇵🇹', name: language === 'pt' ? 'Portugal' : 'Portugal' },
    { code: '+34', flag: '🇪🇸', name: language === 'pt' ? 'Espanha' : 'Spain' },
    { code: '+33', flag: '🇫🇷', name: language === 'pt' ? 'França' : 'France' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+55', flag: '🇧🇷', name: language === 'pt' ? 'Brasil' : 'Brazil' },
    { code: '+49', flag: '🇩🇪', name: language === 'pt' ? 'Alemanha' : 'Germany' },
    { code: '+41', flag: '🇨🇭', name: language === 'pt' ? 'Suíça' : 'Switzerland' },
    { code: '+352', flag: '🇱🇺', name: language === 'pt' ? 'Luxemburgo' : 'Luxembourg' },
    { code: '+244', flag: '🇦🇴', name: language === 'pt' ? 'Angola' : 'Angola' },
    { code: '+238', flag: '🇨🇻', name: language === 'pt' ? 'Cabo Verde' : 'Cape Verde' },
    { code: '+258', flag: '🇲🇿', name: language === 'pt' ? 'Moçambique' : 'Mozambique' },
  ];

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        if (!isMounted) return;
        
        const user = res.data;
        setUserEmail(user.email || '');
        setHasPassword(user.has_password !== false);
        
        // Parse phone number to extract country code if possible
        let extractedCode = '+351';
        let extractedNumber = user.phone_number || '';
        
        for (const country of countries) {
          if (extractedNumber.startsWith(country.code)) {
            extractedCode = country.code;
            extractedNumber = extractedNumber.substring(country.code.length);
            break;
          }
        }

        setFormData({
          full_name: user.full_name || '',
          country_code: extractedCode,
          phone_number: extractedNumber,
          currency: user.currency || 'EUR',
          gender: user.gender || 'prefer_not_to_say',
          marketing_opt_in: user.marketing_opt_in || false
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast({ ...toast, isVisible: false });

    try {
      const fullPhone = `${formData.country_code}${formData.phone_number.replace(/\s/g, '')}`;
      await api.patch('/auth/profile', {
        full_name: formData.full_name,
        phone_number: fullPhone,
        currency: formData.currency,
        gender: formData.gender,
        marketing_opt_in: formData.marketing_opt_in,
      });
      
      setCurrency(formData.currency as 'EUR' | 'USD' | 'BRL');
      setToast({
        message: t.dashboard.settings.success,
        type: 'success',
        isVisible: true
      });
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || t.dashboard.settings.error,
        type: 'error',
        isVisible: true
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordCode = async () => {
    if (!userEmail) return;
    setSendingCode(true);
    setToast({ ...toast, isVisible: false });
    try {
      await api.post('/auth/password-reset/request', { email: userEmail });
      setPasswordCode('');
      setNewPassword('');
      setConfirmPassword('');
      setShowChangePasswordModal(true);
      setToast({
        message: (t.dashboard.settings as any).accountSecurity?.codeSentMessage ?? 'Código enviado. Verifica o teu email.',
        type: 'success',
        isVisible: true
      });
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || t.dashboard.settings.error,
        type: 'error',
        isVisible: true
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordCode.length !== 6) {
      setToast({
        message: (t.auth as any).resetPassword?.codeError ?? 'O código deve ter 6 dígitos.',
        type: 'error',
        isVisible: true
      });
      return;
    }
    if (newPassword.length < 8) {
      setToast({
        message: (t.dashboard.settings as any).accountSecurity?.changePasswordDesc ?? 'Mínimo 8 caracteres, com maiúscula, minúscula e número.',
        type: 'error',
        isVisible: true
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({
        message: (t.dashboard.settings as any).passwordMismatch ?? 'As passwords não coincidem.',
        type: 'error',
        isVisible: true
      });
      return;
    }
    setSavingPassword(true);
    setToast({ ...toast, isVisible: false });
    try {
      await api.post('/auth/password-reset/confirm', {
        email: userEmail,
        code: passwordCode,
        new_password: newPassword
      });
      setShowChangePasswordModal(false);
      setPasswordCode('');
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
      setToast({
        message: (t.dashboard.settings as any).accountSecurity?.passwordSuccess ?? 'Password alterada com sucesso.',
        type: 'success',
        isVisible: true
      });
    } catch (err: any) {
      setToast({
        message: (err.response?.data?.detail || (t.auth as any).resetPassword?.invalidCode) ?? 'Código inválido ou expirado.',
        type: 'error',
        isVisible: true
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setToast({ ...toast, isVisible: false });
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await api.post('/auth/import-data', data);
      const imp = res.data?.imported || {};
      const msg = (t.dashboard.settings as any).importSuccess ?? 'Dados importados.';
      const detail = [imp.workspaces && `${imp.workspaces} workspace(s)`, imp.categories && `${imp.categories} categorias`, imp.transactions && `${imp.transactions} transações`, imp.recurring && `${imp.recurring} recorrentes`, imp.goals && `${imp.goals} metas`].filter(Boolean).join(', ');
      setToast({ isVisible: true, message: detail ? `${msg} ${detail}` : msg, type: 'success' });
      // Invalidar cache para Transações, Categorias, Recorrentes e Metas aparecerem atualizados
      await Promise.all([
        swrMutate((key) => typeof key === 'string' && key.startsWith('/transactions/')),
        swrMutate('/dashboard/totals'),
        swrMutate('/categories/'),
        swrMutate('/recurring/'),
        swrMutate('/goals/'),
        swrMutate('/insights/'),
      ]);
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? (t.dashboard.settings as any).importError ?? 'Erro ao importar. Usa um ficheiro exportado pelo Finly.';
      setToast({ isVisible: true, message, type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    setToast({ ...toast, isVisible: false });
    try {
      const res = await api.get('/auth/export-data');
      const dataStr = JSON.stringify(res.data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `finly_export_${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      setToast({
        isVisible: true,
        message: (t.dashboard.settings as any).exportSuccess ?? 'Ficheiro descarregado. Guarda-o em segurança para backup ou para usar noutra conta.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail ?? t.dashboard.settings.exportError;
      setAlertModal({ isOpen: true, title: 'Erro', message: typeof detail === 'string' ? detail : t.dashboard.settings.exportError, type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      setAlertModal({ isOpen: true, title: t.dashboard.sidebar.toastTypes.error, message: t.dashboard.settings.deleteError, type: 'error' });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePurgeData = async () => {
    setPurging(true);
    try {
      await api.post('/auth/purge-data');
      setToast({
        message: t.dashboard.settings.dangerZone.purgeSuccess,
        type: 'success',
        isVisible: true
      });
      setShowPurgeConfirm(false);
      // Dar tempo ao toast antes de recarregar (redirect imediato escondia a confirmação)
      setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
    } catch (err) {
      console.error(err);
      setAlertModal({ isOpen: true, title: t.dashboard.sidebar.toastTypes.error, message: t.dashboard.settings.dangerZone.purgeError, type: 'error' });
      setPurging(false);
      setShowPurgeConfirm(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-white"
    >
      <div className="max-w-5xl">
        {/* Cabeçalho de perfil: avatar + nome + email, sem caixa */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg sm:text-xl shrink-0 shadow-lg shadow-blue-600/20 select-none">
            {(formData.full_name || userEmail || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-white truncate">
              {formData.full_name || t.dashboard.settings.title}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm truncate">{userEmail}</p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* ── Perfil ── */}
          <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-2 md:gap-14 lg:gap-20 py-7 sm:py-9 border-b border-slate-800/80">
            <div className="mb-2 md:mb-0">
              <h2 className="text-sm font-bold text-white tracking-tight">{t.dashboard.settings.personalData.title}</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed hidden md:block">
                {(t.dashboard.settings as any).personalDataDescription ?? 'Como apareces na app e onde o bot te encontra.'}
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.fullName}
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.gender}
                  </label>
                  <div className="relative">
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-sm text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="male" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.male}</option>
                      <option value="female" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.female}</option>
                      <option value="other" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.other}</option>
                      <option value="prefer_not_to_say" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.prefer_not_to_say}</option>
                    </select>
                    <ChevronRight size={15} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-600 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t.dashboard.settings.personalData.phone}
                </label>
                <div className="flex items-center bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 transition-colors">
                  <div className="relative flex items-center border-r border-slate-800 min-w-[100px]">
                    <select
                      value={formData.country_code}
                      onChange={e => setFormData({ ...formData, country_code: e.target.value })}
                      className="w-full bg-transparent pl-3.5 pr-8 py-2.5 text-sm text-white font-bold appearance-none cursor-pointer focus:outline-none z-10"
                    >
                      {countries.map(c => (
                        <option key={c.code} value={c.code} className="bg-[#0f172a] text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={15} className="absolute right-2.5 rotate-90 text-slate-600 pointer-events-none" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={e => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                    className="flex-1 bg-transparent border-none py-2.5 px-3.5 text-sm focus:outline-none text-white placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Preferências ── */}
          <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-2 md:gap-14 lg:gap-20 py-7 sm:py-9 border-b border-slate-800/80">
            <div className="mb-2 md:mb-0">
              <h2 className="text-sm font-bold text-white tracking-tight">{t.dashboard.settings.preferences.title}</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed hidden md:block">
                {(t.dashboard.settings as any).preferencesDescription ?? 'Moeda, idioma e comunicações.'}
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.preferences.currency}
                  </label>
                  <div className="relative">
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-sm text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="EUR" className="bg-slate-900">Euro (€)</option>
                      <option value="BRL" className="bg-slate-900">Real (R$)</option>
                      <option value="USD" className="bg-slate-900">Dollar ($)</option>
                    </select>
                    <ChevronRight size={15} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-600 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.preferences.language}
                  </label>
                  <div className="relative">
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value as any)}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-9 text-sm text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer transition-colors"
                    >
                      {Object.values(availableLanguages).map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-slate-900">
                          {lang.flag} {lang.nativeName} ({lang.locale})
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={15} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-600 pointer-events-none" />
                  </div>
                </div>
              </div>
              {/* Toggle de marketing — switch a sério, não checkbox disfarçado */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{t.dashboard.settings.preferences.marketing}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.dashboard.settings.marketingChannels}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.marketing_opt_in}
                  onClick={() => setFormData({ ...formData, marketing_opt_in: !formData.marketing_opt_in })}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer touch-manipulation ${
                    formData.marketing_opt_in ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    formData.marketing_opt_in ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
            </div>
          </section>

          {/* Guardar — discreto, alinhado à direita da grelha */}
          <div className="flex justify-end py-5 border-b border-slate-800/80">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 min-h-[42px] px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 touch-manipulation"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : t.dashboard.settings.personalData.save}
            </button>
          </div>
        </form>

        {/* ── Segurança ── */}
        <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-2 md:gap-14 lg:gap-20 py-7 sm:py-9 border-b border-slate-800/80">
          <div className="mb-2 md:mb-0">
            <h2 className="text-sm font-bold text-white tracking-tight">
              {(t.dashboard.settings as any).accountSecurity?.title ?? 'Segurança'}
            </h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">
                {(t.dashboard.settings as any).accountSecurity?.changePasswordTitle ?? t.dashboard.settings.personalData.changePassword}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                {(t.dashboard.settings as any).accountSecurity?.changePasswordDescCode ?? 'Enviamos um código de 6 dígitos para o teu email.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestPasswordCode}
              disabled={sendingCode || !userEmail}
              className="shrink-0 min-h-[38px] px-4 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-200 transition-colors touch-manipulation"
            >
              {sendingCode ? <Loader2 size={14} className="animate-spin" /> : <><Lock size={13} /> {(t.dashboard.settings.dangerZone as any).changeAction ?? 'Alterar'}</>}
            </button>
          </div>
        </section>

        {/* ── Os teus dados ── */}
        <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-2 md:gap-14 lg:gap-20 py-7 sm:py-9 border-b border-slate-800/80">
          <div className="mb-2 md:mb-0">
            <h2 className="text-sm font-bold text-white tracking-tight">
              {(t.dashboard.settings as any).exportImportTitle ?? 'Os teus dados'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed hidden md:block">
              {(t.dashboard.settings as any).exportImportDescription ?? 'Backup ou restauro em ficheiro JSON.'}
            </p>
          </div>
          <div className="divide-y divide-slate-800/80">
            <div className="flex items-center justify-between gap-4 pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Download size={15} className="text-slate-500 shrink-0" />
                <p className="text-xs font-bold text-white truncate">{t.dashboard.settings.dangerZone.export}</p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                disabled={exporting}
                className="shrink-0 min-h-[38px] px-4 rounded-xl border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-200 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer touch-manipulation"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : ((t.dashboard.settings.dangerZone as any).exportAction ?? 'Descarregar')}
              </button>
            </div>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportData}
              disabled={importing}
            />
            <div className="flex items-center justify-between gap-4 pt-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Upload size={15} className="text-slate-500 shrink-0" />
                <p className="text-xs font-bold text-white truncate">{(t.dashboard.settings as any).importButton ?? 'Importar dados'}</p>
              </div>
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importing}
                className="shrink-0 min-h-[38px] px-4 rounded-xl border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-200 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer touch-manipulation"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : ((t.dashboard.settings.dangerZone as any).importAction ?? 'Escolher ficheiro')}
              </button>
            </div>
          </div>
        </section>

        {/* ── Zona de perigo ── */}
        <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-2 md:gap-14 lg:gap-20 py-7 sm:py-9">
          <div className="mb-2 md:mb-0">
            <h2 className="text-sm font-bold text-red-400/90 tracking-tight">
              {t.dashboard.settings.dangerZone.title}
            </h2>
          </div>
          <div className="divide-y divide-slate-800/80">
            <div className="flex items-center justify-between gap-4 pb-3.5">
              <p className="text-xs font-semibold text-slate-300 min-w-0">{t.dashboard.settings.dangerZone.purge}</p>
              <button
                onClick={() => setShowPurgeConfirm(true)}
                className="shrink-0 min-h-[38px] px-4 rounded-xl text-[11px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/25 bg-transparent hover:bg-amber-500/10 transition-colors cursor-pointer touch-manipulation"
              >
                {(t.dashboard.settings.dangerZone as any).purgeAction ?? 'Apagar'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 pt-3.5">
              <p className="text-xs font-semibold text-slate-300 min-w-0">{t.dashboard.settings.dangerZone.delete}</p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 min-h-[38px] px-4 rounded-xl text-[11px] font-bold uppercase tracking-wider text-red-400 border border-red-500/25 bg-transparent hover:bg-red-500/10 transition-colors cursor-pointer touch-manipulation"
              >
                {(t.dashboard.settings.dangerZone as any).deleteAction ?? 'Eliminar'}
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2.5 pt-2 pb-4">
          <BellRing className="text-blue-500/60 shrink-0 mt-0.5" size={14} />
          <p className="text-slate-600 text-[11px] font-medium">
            <span className="text-slate-500 font-bold">{t.dashboard.settings.needHelp}</span>{' '}
            — {t.dashboard.settings.supportAvailable}
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title={t.dashboard.settings.dangerZone.confirmTitle}
        message={t.dashboard.settings.dangerZone.confirmText}
        confirmText={t.dashboard.settings.dangerZone.confirmDelete}
        cancelText={t.dashboard.settings.dangerZone.confirmCancel}
        variant="danger"
        isLoading={deleting}
      />
      <ConfirmModal
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        onConfirm={handlePurgeData}
        title={t.dashboard.settings.dangerZone.purgeConfirmTitle}
        message={t.dashboard.settings.dangerZone.purgeConfirmText}
        confirmText={t.dashboard.settings.dangerZone.purgeConfirm}
        cancelText={t.dashboard.settings.dangerZone.confirmCancel}
        variant="warning"
        isLoading={purging}
      />

      {/* Modal Alterar Password — estilo login */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-5 sm:p-6 md:p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center gap-3 mb-4">
                <h3 className="text-lg font-black text-white tracking-tight min-w-0 truncate">
                  {(t.dashboard.settings as any).accountSecurity?.changePasswordTitle ?? 'Alterar password'}
                </h3>
                <button onClick={() => setShowChangePasswordModal(false)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2">
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {(t.auth as any).resetPassword?.subtitle?.replace('{email}', userEmail) ?? `Introduz o código enviado para ${userEmail}`}
              </p>
              <form onSubmit={handleConfirmPasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {(t.auth as any).resetPassword?.codeLabel ?? 'Código de 6 dígitos'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={passwordCode}
                    onChange={e => setPasswordCode(e.target.value.replace(/\D/g, ''))}
                    placeholder={(t.auth as any).resetPassword?.codePlaceholder ?? '000000'}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 px-4 text-center text-lg tracking-[0.3em] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {(t.auth as any).resetPassword?.passwordLabel ?? 'Nova password'}
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder={(t.auth as any).resetPassword?.passwordPlaceholder ?? '••••••••••••'}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.confirmPassword}
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder={t.dashboard.settings.personalData.confirmPassword}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingPassword || passwordCode.length !== 6 || !newPassword || !confirmPassword}
                  className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {savingPassword ? <Loader2 size={18} className="animate-spin" /> : ((t.auth as any).resetPassword?.submit ?? 'Confirmar nova password')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Global Toast */}
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </motion.div>
  );
}
