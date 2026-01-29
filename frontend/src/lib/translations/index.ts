import { pt } from './pt';
import { en } from './en';
import { fr } from './fr';

export const translations = { pt, en, fr };

/** Tipo de um locale de tradução (ex.: pt ou en). Usar em vez de `as any` ao aceder a t. */
export type TranslationLocale = typeof translations.pt;
/** Tipo das chaves da secção dashboard.transactions. */
export type DashboardTransactionsT = TranslationLocale['dashboard']['transactions'];
/** Tipo das chaves da secção dashboard.guide. */
export type DashboardGuideT = TranslationLocale['dashboard']['guide'];
