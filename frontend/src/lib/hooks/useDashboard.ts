/**
 * SWR hook para dashboard snapshot
 * Cache inteligente, deduplicação automática
 */
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export function useDashboardSnapshot() {
  const { data, error, isLoading, mutate } = useSWR(
    '/dashboard/snapshot',
    fetcher,
    {
      revalidateOnFocus: false, // Não refetch ao focar na janela
      revalidateOnReconnect: true, // Refetch se reconectar
      dedupingInterval: 60000, // 1 minuto - deduplicar requests
      refreshInterval: 0, // Não auto-refresh
      keepPreviousData: true, // Manter dados anteriores durante refetch
    }
  );

  return {
    snapshot: data?.snapshot,
    collections: data?.collections,
    currency: data?.currency,
    isLoading,
    isError: error,
    mutate, // Para invalidar cache manualmente
  };
}

