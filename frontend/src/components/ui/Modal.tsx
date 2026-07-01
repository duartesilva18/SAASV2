'use client';

/**
 * Modal base único (bottom-sheet no mobile / centrado no desktop).
 * Replica o look canónico do TransactionAddModal e centraliza:
 *  - overlay + backdrop (framer-motion), fecho por backdrop, X e Esc
 *  - scroll-lock do body, safe-area (top+bottom), scroll seguro do conteúdo
 *  - z-index centralizado, respeito por prefers-reduced-motion
 * O aspeto é igual ao atual; cores de acento ficam a cargo do conteúdo (children).
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

// Z-index centralizado (acaba com os valores ad-hoc 100/200/300/9998).
export const Z = { MODAL: 100, PRICING: 200, ALERT: 300 } as const;

const SIZE: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZE;
  closeOnBackdrop?: boolean;
  zIndex?: number;
  /** Classes extra para o painel (ex.: cantos/largura específicos). */
  panelClassName?: string;
  /** Esconde o botão X (ex.: modais de aceitação obrigatória). */
  hideClose?: boolean;
  ariaLabel?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  zIndex = Z.MODAL,
  panelClassName = '',
  hideClose = false,
  ariaLabel,
}: ModalProps) {
  const reduce = useReducedMotion();

  // Scroll-lock do body enquanto o modal está aberto.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [isOpen]);

  // Fechar com Esc.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 24 } };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto"
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : ariaLabel}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnBackdrop ? onClose : undefined}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          aria-hidden
        />
        <motion.div
          {...panelMotion}
          transition={{ type: 'tween', duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${SIZE[size]} bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] ${panelClassName}`}
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 min-h-0 overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {(title || !hideClose) && (
              <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2 shrink-0">
                {title ? (
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">{title}</h2>
                ) : <span />}
                {!hideClose && (
                  <button
                    onClick={onClose}
                    type="button"
                    aria-label="Fechar"
                    className="p-2 shrink-0 text-slate-500 hover:text-white transition-colors cursor-pointer rounded-lg -m-2 touch-manipulation"
                  >
                    <X size={22} />
                  </button>
                )}
              </div>
            )}
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-slate-800/60 p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
