'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { translations } from './translations';
import { 
  LanguageCode, 
  CurrencyCode, 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_CURRENCIES,
  DEFAULT_LANGUAGE,
  getBrowserLanguage,
  isLanguageSupported,
  getLanguageConfig,
  LANGUAGE_CONFIGS,
  LanguageConfig,
} from './languages';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currency: CurrencyCode;
  setCurrency: (curr: CurrencyCode) => void;
  t: typeof translations[LanguageCode];
  formatCurrency: (amount: number) => string;
  availableLanguages: Record<LanguageCode, LanguageConfig>;
  availableCurrencies: typeof SUPPORTED_CURRENCIES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [currency, setCurrencyState] = useState<CurrencyCode>('EUR');

  useEffect(() => {
    // Carregar idioma salvo ou detectar do browser
    const savedLang = localStorage.getItem('language');
    if (savedLang && isLanguageSupported(savedLang)) {
      setLanguageState(savedLang);
    } else {
      const browserLang = getBrowserLanguage();
      setLanguageState(browserLang);
      localStorage.setItem('language', browserLang);
    }

    // Carregar moeda salva ou usar padrão do idioma
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency && SUPPORTED_CURRENCIES.includes(savedCurrency as CurrencyCode)) {
      setCurrencyState(savedCurrency as CurrencyCode);
    } else {
      // Usar moeda padrão do idioma selecionado
      const langConfig = getLanguageConfig(language);
      if (langConfig) {
        setCurrencyState(langConfig.currency as CurrencyCode);
      }
    }
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (!isLanguageSupported(lang)) {
      console.warn(`Idioma não suportado: ${lang}`);
      return;
    }
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    
    // Atualizar moeda para o padrão do novo idioma (opcional)
    const langConfig = getLanguageConfig(lang);
    if (langConfig) {
      const currentCurrency = localStorage.getItem('currency');
      // Só atualiza se o utilizador não tiver uma moeda salva
      if (!currentCurrency) {
        setCurrencyState(langConfig.currency as CurrencyCode);
      }
    }
  }, []);

  const setCurrency = useCallback((curr: CurrencyCode) => {
    if (!SUPPORTED_CURRENCIES.includes(curr)) {
      console.warn(`Moeda não suportada: ${curr}`);
      return;
    }
    setCurrencyState(curr);
    localStorage.setItem('currency', curr);
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    const langConfig = getLanguageConfig(language);
    const locale = langConfig?.locale || 'pt-PT';
    
    // Para Real, usamos pt-BR para garantir o símbolo R$ e formatação brasileira
    const finalLocale = currency === 'BRL' ? 'pt-BR' : locale;
    
    return new Intl.NumberFormat(finalLocale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }, [language, currency]);

  // Garantir que sempre temos traduções válidas
  const t = useMemo(() => {
    if (translations[language]) {
      return translations[language];
    }
    // Fallback para idioma padrão se traduções não existirem
    console.warn(`Traduções não encontradas para ${language}, usando ${DEFAULT_LANGUAGE}`);
    return translations[DEFAULT_LANGUAGE];
  }, [language]);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      currency, 
      setCurrency, 
      t, 
      formatCurrency,
      availableLanguages: LANGUAGE_CONFIGS,
      availableCurrencies: SUPPORTED_CURRENCIES,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
