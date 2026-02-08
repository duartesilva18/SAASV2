'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { LanguageCode, FLAG_IMAGE_URLS } from '@/lib/languages';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useUser } from '@/lib/UserContext';
import AlertModal from '@/components/AlertModal';

export default function LanguageSelector() {
  const { language, setLanguage, availableLanguages } = useTranslation();
  const { user, refreshUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert availableLanguages object to array
  const languagesArray = useMemo(() => {
    return Object.values(availableLanguages);
  }, [availableLanguages]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === language || isSaving) return;

    setIsSaving(true);
    try {
      // Update language in context and localStorage
      setLanguage(langCode as any);
      
      // Save to database if user is logged in
      if (user) {
        await api.patch('/auth/language', { language: langCode });
        // Refresh user data to get updated language
        await refreshUser();
      }
    } catch (error) {
      console.error('Erro ao atualizar idioma:', error);
    } finally {
      setIsSaving(false);
      setIsOpen(false);
    }
  };

  const currentLanguage = languagesArray.find(lang => lang.code === language);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 min-h-[44px] min-w-[44px] rounded-xl sm:rounded-lg bg-slate-900/70 border border-slate-700/60 hover:bg-slate-800/80 transition-all text-slate-300 hover:text-white cursor-pointer active:scale-[0.98]"
        disabled={isSaving}
        aria-label={currentLanguage?.nativeName || language}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe size={18} className="shrink-0" />
        <img src={FLAG_IMAGE_URLS[language as LanguageCode]} alt="" className="w-6 h-4 object-cover rounded-sm shrink-0" width={24} height={16} />
        <span className="text-xs font-medium hidden sm:inline">
          {currentLanguage?.nativeName || language.toUpperCase()}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 min-w-[200px] bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden z-50"
            role="listbox"
          >
            <div className="p-2">
              {languagesArray.map((lang) => {
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl transition-all text-left cursor-pointer active:scale-[0.98] ${
                      language === lang.code
                        ? 'bg-blue-600/20 text-white border border-slate-700/60'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                    disabled={isSaving}
                    role="option"
                    aria-selected={language === lang.code}
                  >
                    <img src={FLAG_IMAGE_URLS[lang.code]} alt="" className="w-6 h-4 object-cover rounded-sm shrink-0" width={24} height={16} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {lang.nativeName}
                      </div>
                      <div className="text-xs text-slate-400">{lang.name}</div>
                    </div>
                    {language === lang.code && (
                      <Check size={16} className="text-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

