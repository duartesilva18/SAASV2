'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const FLOATING_DISMISSED_KEY = 'support_floating_dismissed';

function getFloatingDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(FLOATING_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface SupportContextValue {
  openSupport: () => void;
  isFloatingDismissed: boolean;
  dismissFloating: () => void;
  restoreFloating: () => void;
  isSupportOpen: boolean;
  setSupportOpen: (open: boolean) => void;
}

const SupportContext = createContext<SupportContextValue | null>(null);

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [isFloatingDismissed, setIsFloatingDismissed] = useState(false);
  const [isSupportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    setIsFloatingDismissed(getFloatingDismissed());
  }, []);

  const dismissFloating = useCallback(() => {
    setIsFloatingDismissed(true);
    try {
      localStorage.setItem(FLOATING_DISMISSED_KEY, 'true');
    } catch {}
  }, []);

  const restoreFloating = useCallback(() => {
    setIsFloatingDismissed(false);
    try {
      localStorage.removeItem(FLOATING_DISMISSED_KEY);
    } catch {}
  }, []);

  const openSupport = useCallback(() => {
    setSupportOpen(true);
  }, []);

  return (
    <SupportContext.Provider
      value={{
        openSupport,
        isFloatingDismissed,
        dismissFloating,
        restoreFloating,
        isSupportOpen,
        setSupportOpen,
      }}
    >
      {children}
    </SupportContext.Provider>
  );
}

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) {
    return {
      openSupport: () => {},
      isFloatingDismissed: false,
      dismissFloating: () => {},
      restoreFloating: () => {},
      isSupportOpen: false,
      setSupportOpen: () => {},
    };
  }
  return ctx;
}
