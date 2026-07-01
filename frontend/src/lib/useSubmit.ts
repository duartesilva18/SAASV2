/**
 * Hook de submissão padronizado: estado de loading + GUARDA anti-duplo-submit
 * (ignora chamadas enquanto já está a submeter) + extração consistente da mensagem de erro.
 */
import { useCallback, useRef, useState } from 'react';

/** Extrai uma mensagem legível de um erro de axios/fetch. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  const detail = anyErr?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  // Pydantic 422 devolve uma lista de erros — mostrar o primeiro de forma amigável.
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (first?.msg) return String(first.msg);
  }
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message;
  return fallback;
}

export function useSubmit<TArgs extends any[]>(
  fn: (...args: TArgs) => Promise<void>,
) {
  const [submitting, setSubmitting] = useState(false);
  // Ref para travar imediatamente (antes do re-render) cliques duplicados.
  const inFlight = useRef(false);

  const run = useCallback(async (...args: TArgs) => {
    if (inFlight.current) return; // já a submeter -> ignora o segundo clique
    inFlight.current = true;
    setSubmitting(true);
    try {
      await fn(...args);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [fn]);

  return { submitting, run };
}
