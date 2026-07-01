'use client';

/**
 * Botão de submissão padronizado: fica desativado + spinner enquanto `submitting`,
 * impedindo duplo-submit. Mantém o visual atual (botão azul, full-width, min-h-48).
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  submitting?: boolean;
  loadingText?: string;
  /** Classe do botão (permite acentos diferentes por modal). */
  className?: string;
}

export default function SubmitButton({
  submitting = false,
  loadingText,
  disabled,
  className = '',
  children,
  ...props
}: SubmitButtonProps) {
  const base = 'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed';
  const accent = className || 'bg-blue-600 hover:bg-blue-500 text-white';
  return (
    <button type="submit" disabled={submitting || disabled} className={`${base} ${accent}`} {...props}>
      {submitting && <Loader2 size={16} className="animate-spin" />}
      {submitting ? (loadingText || children) : children}
    </button>
  );
}
