// Tipos de idiomas e moedas suportados
export type LanguageCode = 'pt' | 'en';
export type CurrencyCode = 'EUR' | 'USD' | 'BRL' | 'GBP';

// Idiomas suportados
export const SUPPORTED_LANGUAGES: LanguageCode[] = ['pt', 'en'];

// Moedas suportadas
export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'BRL', 'GBP'];

// Idioma padrão
export const DEFAULT_LANGUAGE: LanguageCode = 'pt';

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
};

// Detectar idioma do browser
export function getBrowserLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const browserLang = navigator.language || (navigator as any).userLanguage;
  
  // Extrair código de idioma (ex: 'pt-PT' -> 'pt')
  const langCode = browserLang.split('-')[0].toLowerCase();
  
  // Verificar se é suportado (apenas pt ou en)
  if (langCode === 'pt' || langCode === 'en') {
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

