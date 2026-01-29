'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type BeforeInstallPromptEvent = Event & { prompt: () => Promise<{ outcome: string }> };

type InstallPromptContextValue = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Chamar após prompt() para limpar (ex.: após instalação aceite). */
  clearPrompt: () => void;
};

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const clearPrompt = useCallback(() => setDeferredPrompt(null), []);

  return (
    <InstallPromptContext.Provider value={{ deferredPrompt, clearPrompt }}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt(): InstallPromptContextValue {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) {
    return { deferredPrompt: null, clearPrompt: () => {} };
  }
  return ctx;
}
