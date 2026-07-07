'use client';

/**
 * Analytics (PostHog EU) carregado APENAS com consentimento de cookies.
 *
 * - Sem NEXT_PUBLIC_POSTHOG_KEY definida → no-op total (seguro fazer deploy sem conta PostHog).
 * - Só injeta o script quando canLoadAnalytics() === true ('cookie-consent' = 'all').
 * - Se o utilizador mudar para "Apenas Essenciais", faz opt-out imediato.
 * - Pageviews manuais no App Router + eventos explícitos via track() — sem autocapture
 *   (menos ruído, menos dados, mais privacidade).
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { canLoadAnalytics } from '@/components/CookieBanner';

declare global {
  interface Window { posthog?: any }
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
const POSTHOG_ASSETS = 'https://eu-assets.i.posthog.com/static/array.js';

let scriptRequested = false;
let ready = false;

function initPosthog() {
  if (ready || !window.posthog?.init) return;
  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,      // pageviews manuais (App Router)
    autocapture: false,           // só eventos explícitos — menos ruído/PII
    person_profiles: 'identified_only',
    respect_dnt: true,
    loaded: () => { ready = true; window.posthog?.capture('$pageview'); },
  });
}

function ensureLoaded() {
  if (!POSTHOG_KEY || typeof window === 'undefined') return;
  if (!canLoadAnalytics()) return;
  if (window.posthog?.__loaded || ready) {
    window.posthog?.opt_in_capturing?.();
    return;
  }
  if (scriptRequested) return;
  scriptRequested = true;
  const s = document.createElement('script');
  s.src = POSTHOG_ASSETS;
  s.async = true;
  s.onload = initPosthog;
  s.onerror = () => { scriptRequested = false; };
  document.head.appendChild(s);
}

/** Evento de produto. No-op se não houver chave ou consentimento. */
export function track(event: string, props?: Record<string, unknown>) {
  try {
    if (ready && canLoadAnalytics()) window.posthog?.capture(event, props);
  } catch { /* nunca partir a app por causa de analytics */ }
}

export default function AnalyticsLoader() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // Carregar no arranque (se já houver consentimento) e reagir a mudanças de consentimento
  useEffect(() => {
    ensureLoaded();
    const onConsent = () => {
      if (canLoadAnalytics()) {
        ensureLoaded();
      } else {
        try { window.posthog?.opt_out_capturing?.(); } catch { /* noop */ }
      }
    };
    window.addEventListener('finly:consent-changed', onConsent);
    // Identificação opcional (id interno, sem email/PII) vinda do UserContext
    const onIdentify = (e: Event) => {
      const d = (e as CustomEvent).detail;
      try {
        if (ready && canLoadAnalytics() && d?.id) window.posthog?.identify(String(d.id), d.props || {});
      } catch { /* noop */ }
    };
    window.addEventListener('finly:identify', onIdentify);
    return () => {
      window.removeEventListener('finly:consent-changed', onConsent);
      window.removeEventListener('finly:identify', onIdentify);
    };
  }, []);

  // Pageview por mudança de rota
  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    try {
      if (ready && canLoadAnalytics()) window.posthog?.capture('$pageview');
    } catch { /* noop */ }
  }, [pathname]);

  return null;
}
