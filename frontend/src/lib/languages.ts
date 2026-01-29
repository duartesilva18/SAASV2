// Tipos de idiomas e moedas suportados
export type LanguageCode = 'pt' | 'en' | 'fr';
export type CurrencyCode = 'EUR' | 'USD' | 'BRL' | 'GBP';

// Idiomas suportados
export const SUPPORTED_LANGUAGES: LanguageCode[] = ['pt', 'en', 'fr'];

// Moedas suportadas
export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'BRL', 'GBP'];

// Idioma padrão
export const DEFAULT_LANGUAGE: LanguageCode = 'pt';

// URLs de bandeiras (imagens) — emoji de bandeira não aparece em muitos Windows
const FLAG_CDN = 'https://flagcdn.com';
export const FLAG_IMAGE_URLS: Record<LanguageCode, string> = {
  pt: `${FLAG_CDN}/w80/pt.png`,
  en: `${FLAG_CDN}/w80/gb.png`,
  fr: `${FLAG_CDN}/w80/fr.png`,
};

// Configuração de idiomas
export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  locale: string;
  currency: CurrencyCode;
}

export const LANGUAGE_CONFIGS: Record<LanguageCode, LanguageConfig> = {
  pt: {
    code: 'pt',
    name: 'Português',
    nativeName: 'Português',
    flag: '🇵🇹',
    locale: 'pt-PT',
    currency: 'EUR',
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    locale: 'en-US',
    currency: 'USD',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    locale: 'fr-FR',
    currency: 'EUR',
  },
};

// Detectar idioma do browser
export function getBrowserLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const browserLang = navigator.language || (navigator as any).userLanguage;
  
  // Extrair código de idioma (ex: 'pt-PT' -> 'pt')
  const langCode = browserLang.split('-')[0].toLowerCase();
  
  // Verificar se é suportado (pt, en ou fr)
  if (langCode === 'pt' || langCode === 'en' || langCode === 'fr') {
    return langCode as LanguageCode;
  }
  
  // Fallback para idioma padrão
  return DEFAULT_LANGUAGE;
}

// Verificar se idioma é suportado
export function isLanguageSupported(lang: string): lang is LanguageCode {
  return SUPPORTED_LANGUAGES.includes(lang as LanguageCode);
}

// Obter configuração de idioma
export function getLanguageConfig(lang: LanguageCode): LanguageConfig | undefined {
  return LANGUAGE_CONFIGS[lang];
}

