'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, Coins, UserCircle, 
  CreditCard, Download, 
  Trash2, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, BellRing, Sparkles, Globe, Check, Send, ExternalLink
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';

export default function SettingsPage() {
  const { t, setCurrency, language, setLanguage, availableLanguages } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
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

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        if (!isMounted) return;
        
        const user = res.data;
        const customerId = user.stripe_customer_id || '';
        setIsSimulated(customerId.startsWith('sim_') || customerId.startsWith('test_'));
        
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast({ ...toast, isVisible: false });

    try {
      const fullPhone = `${formData.country_code}${formData.phone_number.replace(/\s/g, '')}`;
      await api.patch('/auth/profile', {
        ...formData,
        phone_number: fullPhone
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

  const handlePortal = async () => {
    if (isSimulated) {
      alert(t.dashboard.settings.simulationMode);
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
      alert(errorMsg || t.dashboard.settings.portalError);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/auth/export-data');
      const dataStr = JSON.stringify(res.data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `finly_export_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      console.error(err);
      alert(t.dashboard.settings.exportError);
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
      alert(t.dashboard.settings.deleteError);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-white"
    >
      <h1 className="text-3xl font-black mb-8 tracking-tighter uppercase tracking-widest text-xs opacity-50">
        {t.dashboard.settings.title}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSave} className="space-y-8">
            {/* Personal Data Section */}
            <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 lg:p-10 relative overflow-hidden group hover:border-slate-700 transition-all shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full -z-10" />
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <h2 className="text-xl font-black tracking-tighter text-white uppercase tracking-widest text-[11px] opacity-60">
                  {t.dashboard.settings.personalData.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Full Name */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">
                    {t.dashboard.settings.personalData.fullName}
                  </label>
                  <div className="relative group/field">
                    <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/field:text-blue-500 transition-colors" />
                    <input 
                      type="text"
                      value={formData.full_name}
                      onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-5 text-sm focus:outline-none focus:border-blue-500 transition-all text-white font-medium"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">
                    {t.dashboard.settings.personalData.gender}
                  </label>
                  <div className="relative group/field">
                    <UserCircle size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/field:text-blue-500 transition-colors pointer-events-none z-10" />
                    <select 
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-10 text-sm focus:outline-none focus:border-blue-500 transition-all text-white font-medium appearance-none cursor-pointer"
                    >
                      <option value="male" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.male}</option>
                      <option value="female" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.female}</option>
                      <option value="other" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.other}</option>
                      <option value="prefer_not_to_say" className="bg-slate-900">{t.dashboard.onboarding.genderOptions.prefer_not_to_say}</option>
                    </select>
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-3 md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">
                    {t.dashboard.settings.personalData.phone}
                  </label>
                  <div className="flex items-center bg-slate-950/50 border border-slate-800 rounded-2xl focus-within:border-emerald-500/50 transition-all group/phone overflow-hidden">
                    <div className="relative flex items-center bg-white/[0.03] border-r border-slate-800/50 min-w-[100px]">
                      <select 
                        value={formData.country_code}
                        onChange={e => setFormData({ ...formData, country_code: e.target.value })}
                        className="w-full bg-transparent pl-4 pr-8 py-4 text-sm text-white font-bold appearance-none cursor-pointer focus:outline-none z-10"
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code} className="bg-[#0f172a] text-white">
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 pointer-events-none text-slate-500 group-focus-within/phone:text-emerald-500 transition-colors">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                    <input 
                      type="tel"
                      value={formData.phone_number}
                      onChange={e => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                      className="flex-1 bg-transparent border-none py-4 px-5 text-base focus:outline-none text-white font-medium placeholder:text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Preferences Section */}
            <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 lg:p-10 relative overflow-hidden group hover:border-slate-700 transition-all shadow-xl">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full -z-10" />
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Coins size={24} />
                </div>
                <h2 className="text-xl font-black tracking-tighter text-white uppercase tracking-widest text-[11px] opacity-60">
                  {t.dashboard.settings.preferences.title}
                </h2>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Currency */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">
                      {t.dashboard.settings.preferences.currency}
                    </label>
                    <div className="relative group/field">
                      <Coins size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/field:text-indigo-500 transition-colors pointer-events-none z-10" />
                      <select 
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-10 text-sm focus:outline-none focus:border-indigo-500 transition-all text-white font-medium appearance-none cursor-pointer"
                      >
                        <option value="EUR" className="bg-slate-900">Euro (€)</option>
                        <option value="BRL" className="bg-slate-900">Real (R$)</option>
                        <option value="USD" className="bg-slate-900">Dollar ($)</option>
                      </select>
                    </div>
                  </div>

                  {/* Language */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">
                      {t.dashboard.settings.preferences.language}
                    </label>
                    <div className="relative group/field">
                      <Globe size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/field:text-indigo-500 transition-colors pointer-events-none z-10" />
                      <select 
                        value={language}
                        onChange={e => setLanguage(e.target.value as any)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-10 text-sm focus:outline-none focus:border-indigo-500 transition-all text-white font-medium appearance-none cursor-pointer"
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

                {/* Marketing */}
                <div 
                  onClick={() => setFormData({ ...formData, marketing_opt_in: !formData.marketing_opt_in })}
                  className="flex items-center gap-4 py-4 px-5 bg-white/[0.02] border border-slate-800 rounded-2xl cursor-pointer group transition-all hover:bg-white/[0.04]"
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                    formData.marketing_opt_in 
                    ? 'bg-blue-600 border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                    : 'border-slate-700 bg-slate-950 group-hover:border-slate-500'
                  }`}>
                    <AnimatePresence>
                      {formData.marketing_opt_in && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Check size={14} className="text-white stroke-[4]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <p className={`text-sm font-bold transition-colors ${formData.marketing_opt_in ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                      {t.dashboard.settings.preferences.marketing}
                    </p>
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                      {t.dashboard.settings.marketingChannels}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            >
              {saving ? <Loader2 size={24} className="animate-spin" /> : (
                <>
                  {t.dashboard.settings.personalData.save} <Sparkles size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sidebar Settings (Billing & Danger Zone) */}
        <div className="space-y-8">
          {/* Telegram Card */}
          <section className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 backdrop-blur-xl border border-blue-500/20 rounded-[32px] p-8 relative overflow-hidden hover:border-blue-500/40 transition-all group shadow-xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[60px] rounded-full -z-10" />
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-white">
                <Send size={20} />
              </div>
              <h2 className="text-lg font-black tracking-tighter text-white uppercase tracking-widest text-[11px]">
                {t.dashboard.settings.telegramCard.title}
              </h2>
            </div>

            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed italic">
              {t.dashboard.settings.telegramCard.description}
            </p>

            <a 
              href="https://t.me/FinanZenApp_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {t.dashboard.settings.telegramCard.link} <ExternalLink size={14} />
            </a>
          </section>

          {/* Billing Card */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 relative overflow-hidden hover:border-slate-700 transition-all group shadow-xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[60px] rounded-full -z-10" />
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <CreditCard size={20} />
              </div>
              <h2 className="text-lg font-black tracking-tighter text-white">
                {t.dashboard.settings.billing.title}
              </h2>
            </div>

            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed italic">
              {t.dashboard.settings.billingCard.description}
            </p>

            <button 
              onClick={handlePortal}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {t.dashboard.settings.billing.portal} <ChevronRight size={14} />
            </button>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-500/[0.03] backdrop-blur-xl border border-red-500/10 rounded-[32px] p-8 relative overflow-hidden hover:border-red-500/20 transition-all group shadow-xl">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/5 blur-[40px] rounded-full -z-10" />
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Trash2 size={20} />
              </div>
              <h2 className="text-lg font-black tracking-tighter text-red-500/60 uppercase tracking-widest text-[11px]">
                {t.dashboard.settings.dangerZone.title}
              </h2>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleExportData}
                disabled={exporting}
                className="w-full py-4 border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> {t.dashboard.settings.dangerZone.export}</>}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 size={14} /> {t.dashboard.settings.dangerZone.delete}
              </button>
            </div>
          </section>

          {/* Support Notice */}
          <div className="p-8 bg-blue-600/5 border border-blue-500/10 rounded-[32px] text-center shadow-xl group hover:bg-blue-600/10 transition-colors">
            <BellRing className="text-blue-500/60 mx-auto mb-4 group-hover:scale-110 transition-transform" size={32} />
            <h4 className="text-white font-black tracking-tight mb-2 uppercase tracking-widest text-[10px] opacity-60">{t.dashboard.settings.needHelp}</h4>
            <p className="text-slate-500 text-xs font-medium italic">{t.dashboard.settings.supportAvailable}</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-slate-900 border border-slate-800 p-8 md:p-10 rounded-[40px] max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-white text-center mb-4 tracking-tighter">
                {t.dashboard.settings.dangerZone.confirmTitle}
              </h3>
              <p className="text-slate-400 text-center mb-8 font-medium italic">
                {t.dashboard.settings.dangerZone.confirmText}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer"
                >
                  {t.dashboard.settings.dangerZone.confirmCancel}
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={18} className="animate-spin mx-auto" /> : t.dashboard.settings.dangerZone.confirmDelete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
