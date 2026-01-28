/**
 * SWR hook para dashboard snapshot
 * Cache inteligente, deduplicação automática.
 * year/month opcionais: se fornecidos (month 1-12), o snapshot e collections são do mês indicado.
 */
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

function snapshotKey(year?: number, month?: number): string {
  if (year != null && month != null && month >= 1 && month <= 12) {
    return `/dashboard/snapshot?include_collections=true&year=${year}&month=${month}`;
  }
  return '/dashboard/snapshot?include_collections=true';
}

export function useDashboardSnapshot(year?: number, month?: number) {
  const key = snapshotKey(year, month);
  const { data, error, isLoading, mutate } = useSWR(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 0, // ao mudar de mês (key diferente) fazer fetch imediato
      refreshInterval: 0,
      keepPreviousData: true, // enquanto carrega o novo mês, manter dados do mês anterior na UI
    }
  );

  return {
    snapshot: data?.snapshot,
    collections: data?.collections,
    currency: data?.currency,
    isLoading,
    isError: error,
    mutate,
  };
}

