/**
 * Stripe Price IDs por plano (Live).
 */
export const STRIPE_PRICE_IDS = {
  basic: 'price_1SvKuoLtWlVpaXrbf1krzn1r',
  plus: 'price_1SvKumLtWlVpaXrbh45T3Vez',
  pro: 'price_1SvKujLtWlVpaXrbGlU70upk',
};

export const STRIPE_PRICE_BASIC = STRIPE_PRICE_IDS.basic;
export const STRIPE_PRICE_PLUS = STRIPE_PRICE_IDS.plus;
export const STRIPE_PRICE_PRO = STRIPE_PRICE_IDS.pro;

/** Mapa price_id -> plano (para sidebar, plans page, etc.) */
export const PLAN_BY_PRICE_ID: Record<string, { label: string; variant: 'basic' | 'plus' | 'pro' }> = {
  [STRIPE_PRICE_IDS.basic]: { label: 'FinLy Basic', variant: 'basic' },
  [STRIPE_PRICE_IDS.plus]: { label: 'FinLy Plus', variant: 'plus' },
  [STRIPE_PRICE_IDS.pro]: { label: 'FinLy Pro', variant: 'pro' },
};

/** Mapa price_id -> slug do plano */
export const PLAN_SLUG_BY_PRICE_ID: Record<string, string> = {
  [STRIPE_PRICE_IDS.basic]: 'basic',
  [STRIPE_PRICE_IDS.plus]: 'plus',
  [STRIPE_PRICE_IDS.pro]: 'pro',
};
