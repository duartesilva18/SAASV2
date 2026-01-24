import { translations } from './translations';
import { DEFAULT_LANGUAGE, LanguageCode } from './languages';

// Função helper para obter o idioma atual do localStorage
function getCurrentLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const savedLang = localStorage.getItem('language');
  return (savedLang as LanguageCode) || DEFAULT_LANGUAGE;
}

// Função para obter dados mock traduzidos
export function getDemoTransactions(language?: LanguageCode) {
  const lang = language || getCurrentLanguage();
  const demoData = translations[lang]?.dashboard?.zenInsights?.demo;
  if (demoData?.transactions) {
    return demoData.transactions;
  }
  // Fallback para português se não houver traduções
  return translations['pt']?.dashboard?.zenInsights?.demo?.transactions || [];
}

export function getDemoCategories(language?: LanguageCode) {
  const lang = language || getCurrentLanguage();
  const demoData = translations[lang]?.dashboard?.zenInsights?.demo;
  if (demoData?.categories) {
    return demoData.categories;
  }
  // Fallback para português se não houver traduções
  return translations['pt']?.dashboard?.zenInsights?.demo?.categories || [];
}

export function getDemoInsights(language?: LanguageCode) {
  const lang = language || getCurrentLanguage();
  const demoData = translations[lang]?.dashboard?.zenInsights?.demo;
  if (demoData?.insights && demoData?.summary !== undefined && demoData?.health_score !== undefined) {
    return {
      insights: demoData.insights,
      summary: demoData.summary,
      health_score: demoData.health_score,
    };
  }
  // Fallback para português se não houver traduções
  const ptDemo = translations['pt']?.dashboard?.zenInsights?.demo;
  if (ptDemo?.insights && ptDemo?.summary !== undefined && ptDemo?.health_score !== undefined) {
    return {
      insights: ptDemo.insights,
      summary: ptDemo.summary,
      health_score: ptDemo.health_score,
    };
  }
  return null;
}

export function getDemoRecurring(language?: LanguageCode) {
  const lang = language || getCurrentLanguage();
  const demoData = translations[lang]?.dashboard?.zenInsights?.demo;
  if (demoData?.recurring) {
    return demoData.recurring;
  }
  // Fallback para português se não houver traduções
  return translations['pt']?.dashboard?.zenInsights?.demo?.recurring || [];
}

// Mantém as exportações antigas para compatibilidade (usando português como padrão)
export const DEMO_TRANSACTIONS = getDemoTransactions('pt');
export const DEMO_CATEGORIES = getDemoCategories('pt');
export const DEMO_INSIGHTS = getDemoInsights('pt') || {
  insights: [],
  summary: '',
  health_score: 0,
};
export const DEMO_RECURRING = getDemoRecurring('pt');

