'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from './api';

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  currency: string;
  language?: string;
  gender?: string;
  is_active: boolean;
  is_admin: boolean;
  is_affiliate?: boolean;
  affiliate_requested_at?: string;
  is_email_verified: boolean;
  is_onboarded: boolean;
  marketing_opt_in: boolean;
  subscription_status?: string;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  created_at: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void; // 🔄 Adicionada função de logout global
  isPro: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Preservar consentimento de cookies antes de limpar
    const cookieConsent = localStorage.getItem('cookie-consent');
    const cookieConsentDate = localStorage.getItem('cookie-consent-date');
    
    localStorage.clear();
    sessionStorage.clear();
    
    // Restaurar consentimento de cookies após limpar
    if (cookieConsent) {
      localStorage.setItem('cookie-consent', cookieConsent);
      if (cookieConsentDate) {
        localStorage.setItem('cookie-consent-date', cookieConsentDate);
      }
    }
    
    // Limpar cookies comuns de auth se existirem
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    setUser(null);
    window.location.href = '/auth/login';
  }, []);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.info('[auth] fetchUser token present:', !!token);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      console.info('[auth] fetchUser /auth/me with token len:', token.length);
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      console.warn('[auth] fetchUser failed', err);
      // Token inválido ou expirado
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Considera Pro se estiver ativo, em trial, cancel_at_period_end ou past_due (período de graça)
  // past_due = pagamento falhou mas Stripe ainda está a tentar cobrar – mantém acesso para atualizar o método de pagamento
  // unpaid = sem acesso (subscrição efetivamente em incumprimento)
  // Admins têm sempre acesso Pro
  const isPro = user?.is_admin 
    || user?.subscription_status === 'active' 
    || user?.subscription_status === 'trialing' 
    || user?.subscription_status === 'cancel_at_period_end'
    || user?.subscription_status === 'past_due';

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: fetchUser, logout, isPro }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

