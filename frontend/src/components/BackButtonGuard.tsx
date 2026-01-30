'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WAS_ON_LANDING_KEY = 'finly_was_on_landing';
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password'];

/** Quando o utilizador está na landing e carrega "voltar" nativo (telemóvel), evita ir para login. */
export default function BackButtonGuard() {
  const router = useRouter();

  useEffect(() => {
    const onPopState = () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (AUTH_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
        try {
          if (sessionStorage.getItem(WAS_ON_LANDING_KEY) === '1') {
            sessionStorage.removeItem(WAS_ON_LANDING_KEY);
            router.replace('/');
          }
        } catch {}
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [router]);

  return null;
}

export function setWasOnLanding(value: boolean) {
  try {
    if (value) sessionStorage.setItem(WAS_ON_LANDING_KEY, '1');
    else sessionStorage.removeItem(WAS_ON_LANDING_KEY);
  } catch {}
}
