'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import api, { fetcher } from './api';
import { useUser } from './UserContext';
import { DEMO_CATEGORIES } from './mockData';
import { hasProAccess } from './utils';

/** Debounce valor para reduzir cálculos em pesquisas/filtros (ex.: 300ms) */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * Filtra transações de seed (1 cêntimo) que são apenas para treinar o Telegram
 * Estas transações não devem aparecer nem ser contabilizadas no frontend
 */
export function filterSeedTransactions(transactions: any[]): any[] {
  if (!transactions || !Array.isArray(transactions)) return [];
  return transactions.filter(t => Math.abs(t.amount_cents) !== 1);
}

export function useCategories() {
  const { user } = useUser();
  const { data, error, isLoading, mutate } = useSWR('/categories/', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const hasActiveSub = hasProAccess(user);
  // Se não for Pro e não houver dados, retorna Mock Categories
  const categories = !hasActiveSub && (!data || data.length === 0) ? DEMO_CATEGORIES : data || [];

  return {
    categories,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useTransactions() {
  // limit=500 (máximo do backend): o default de 100 fazia os totais de
  // receitas/despesas/saldo da página de transações serem calculados sobre dados parciais.
  const { data, error, isLoading, mutate } = useSWR('/transactions/?limit=500', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  // Filtrar transações de seed (1 cêntimo)
  const transactions = filterSeedTransactions(data || []);

  return {
    transactions,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Totais acumulados (lifetime) somados em SQL no backend.
 * Fonte de verdade para saldos de cofre e resumos de receitas/despesas — não depende
 * de listas paginadas de transações.
 */
export function useLifetimeTotals() {
  const { data, error, isLoading, mutate } = useSWR('/dashboard/totals', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  return {
    totals: data as {
      income: number;
      expenses: number;
      balance: number;
      vault_emergency: number;
      vault_investment: number;
      vault_total: number;
      available_cash: number;
      net_worth: number;
      currency: string;
    } | undefined,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useZenInsights() {
  const { data, error, isLoading, mutate } = useSWR('/insights/', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  return {
    data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useInsights() {
  const { data, error, isLoading, mutate } = useSWR('/insights/composite', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return {
    insights: data,
    isLoading,
    isError: error,
    mutate,
  };
}
