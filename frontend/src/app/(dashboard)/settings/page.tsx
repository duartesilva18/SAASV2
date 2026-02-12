'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, Coins, UserCircle, 
  CreditCard, Download, Upload,
  Trash2, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, BellRing, Globe, Check, Send, ExternalLink,
  Lock, Mail, X
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
  const [isSimulated, setIsSimulated] = useState(false);
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
        const customerId = user.stripe_customer_id || '';
        setIsSimulated(customerId.startsWith('sim_') || customerId.startsWith('test_'));
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

  const handlePortal = async () => {
    if (isSimulated) {
      setAlertModal({ isOpen: true, title: t.dashboard.settings.simulationModeTitle, message: t.dashboard.settings.simulationMode, type: 'info' });
      return;
    }
    try {
      const res = await api.post('/stripe/portal');
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('URL do portal não retornada');
      }
    } catch (err: any) {
      console.error('Erro ao abrir portal Stripe:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Erro ao abrir portal de faturação.';
      setAlertModal({ isOpen: true, title: t.dashboard.sidebar.toastTypes.error, message: errorMsg || t.dashboard.settings.portalError, type: 'error' });
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
        swrMutate('/transactions/'),
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
      window.location.href = '/dashboard';
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
      <h1 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 sm:mb-6 md:mb-8">
        {t.dashboard.settings.title}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSave} className="space-y-8">
            {/* Personal Data Section — estilo login */}
            <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                  <User size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t.dashboard.settings.personalData.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Email (read-only) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {(t.dashboard.settings as any).accountSecurity?.emailLabel ?? t.dashboard.settings.personalData?.email ?? 'Email'}
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input 
                      type="email"
                      value={userEmail}
                      readOnly
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.fullName}
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input 
                      type="text"
                      value={formData.full_name}
                      onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.gender}
                  </label>
                  <div className="relative">
                    <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                    <select 
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                    >
                      <option value="male" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.male}</option>
                      <option value="female" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.female}</option>
                      <option value="other" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.other}</option>
                      <option value="prefer_not_to_say" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.prefer_not_to_say}</option>
                    </select>
                  </div>
                </div>

                {/* Phone */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.dashboard.settings.personalData.phone}
                  </label>
                  <div className="flex items-center bg-slate-950/60 border border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50">
                    <div className="relative flex items-center border-r border-slate-700 min-w-[100px]">
                      <select 
                        value={formData.country_code}
                        onChange={e => setFormData({ ...formData, country_code: e.target.value })}
                        className="w-full bg-transparent pl-4 pr-8 py-2.5 sm:py-3 text-sm text-white font-bold appearance-none cursor-pointer focus:outline-none z-10"
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code} className="bg-[#0f172a] text-white">
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <ChevronRight size={16} className="absolute right-3 rotate-90 text-slate-500 pointer-events-none" />
                    </div>
                    <input 
                      type="tel"
                      value={formData.phone_number}
                      onChange={e => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                      className="flex-1 bg-transparent border-none py-2.5 sm:py-3 px-4 text-sm focus:outline-none text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Preferências + Alterar password */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <section className="md:col-span-2 rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md p-5 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    <Coins size={20} />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t.dashboard.settings.preferences.title}
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {t.dashboard.settings.preferences.currency}
                      </label>
                      <div className="relative">
                        <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                        <select 
                          value={formData.currency}
                          onChange={e => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                          <option value="EUR" className="bg-slate-900">Euro (€)</option>
                          <option value="BRL" className="bg-slate-900">Real (R$)</option>
                          <option value="USD" className="bg-slate-900">Dollar ($)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {t.dashboard.settings.preferences.language}
                      </label>
                      <div className="relative">
                        <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                        <select 
                          value={language}
                          onChange={e => setLanguage(e.target.value as any)}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                          {Object.values(availableLanguages).map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-slate-900">
                              {lang.flag} {lang.nativeName} ({lang.locale})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div 
                    onClick={() => setFormData({ ...formData, marketing_opt_in: !formData.marketing_opt_in })}
                    className="flex items-center gap-3 py-3 px-4 bg-slate-950/60 border border-slate-700 rounded-xl cursor-pointer hover:bg-slate-950/80 transition-colors"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      formData.marketing_opt_in ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-950'
                    }`}>
                      {formData.marketing_opt_in && <Check size={12} className="text-white stroke-[3]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{t.dashboard.settings.preferences.marketing}</p>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{t.dashboard.settings.marketingChannels}</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="md:col-span-1 p-5 rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md shadow-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Lock size={20} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {(t.dashboard.settings as any).accountSecurity?.changePasswordTitle ?? t.dashboard.settings.personalData.changePassword}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  {(t.dashboard.settings as any).accountSecurity?.changePasswordDescCode ?? 'Enviaremos um código de 6 dígitos para o teu email. Usa-o no modal para definir a nova password.'}
                </p>
                <button
                  type="button"
                  onClick={handleRequestPasswordCode}
                  disabled={sendingCode || !userEmail}
                  className="h-10 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all w-fit"
                >
                  {sendingCode ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={14} /> {t.dashboard.settings.personalData.changePassword}</>}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    {t.dashboard.settings.personalData.save}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0 text-slate-300">
                <Download size={20} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                {(t.dashboard.settings as any).exportImportTitle ?? 'Exportar e importar dados'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {(t.dashboard.settings as any).exportImportDescription ?? 'Backup ou restauro da tua conta em ficheiro JSON.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleExportData}
                disabled={exporting}
                className="flex-1 min-h-[48px] sm:h-11 px-4 py-3 sm:py-0 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors touch-manipulation"
              >
                {exporting ? <Loader2 size={16} className="animate-spin shrink-0" /> : <><Download size={16} className="shrink-0" /> <span>{t.dashboard.settings.dangerZone.export}</span></>}
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportData}
                disabled={importing}
              />
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importing}
                className="flex-1 min-h-[48px] sm:h-11 px-4 py-3 sm:py-0 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors touch-manipulation"
              >
                {importing ? <Loader2 size={16} className="animate-spin shrink-0" /> : <><Upload size={16} className="shrink-0" /> <span>{(t.dashboard.settings as any).importButton ?? 'Importar'}</span></>}
              </button>
            </div>
          </section>

          <section className="bg-red-500/[0.03] backdrop-blur-md border border-red-500/20 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-500/80 min-w-0 truncate">
                {t.dashboard.settings.dangerZone.title}
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <button 
                onClick={() => setShowPurgeConfirm(true)}
                className="w-full min-h-[44px] py-3 sm:py-4 px-4 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all border border-amber-500/20 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                <Trash2 size={14} className="shrink-0" /> <span className="truncate">{t.dashboard.settings.dangerZone.purge}</span>
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full min-h-[44px] py-3 sm:py-4 px-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all border border-red-500/20 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                <Trash2 size={14} className="shrink-0" /> <span className="truncate">{t.dashboard.settings.dangerZone.delete}</span>
              </button>
            </div>
          </section>

          <div className="p-4 sm:p-6 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl text-center shadow-2xl">
            <BellRing className="text-blue-500/60 mx-auto mb-3" size={28} />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t.dashboard.settings.needHelp}</h4>
            <p className="text-slate-500 text-xs font-medium italic">{t.dashboard.settings.supportAvailable}</p>
          </div>
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
