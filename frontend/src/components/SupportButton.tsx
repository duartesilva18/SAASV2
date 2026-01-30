'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, HelpCircle, Loader2, X, Paperclip } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { useSupport } from '@/lib/SupportContext';
import api from '@/lib/api';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILES = 3;
const POSITION_KEY = 'support_floating_position';
const LONG_PRESS_MS = 800;
const BUTTON_SIZE = 56;

function getStoredPosition(): { left: number; top: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left: number; top: number };
    if (typeof p?.left === 'number' && typeof p?.top === 'number') return p;
    return null;
  } catch {
    return null;
  }
}

function getDefaultPosition(): { left: number; top: number } {
  if (typeof window === 'undefined') return { left: 24, top: 24 };
  const right = 16;
  const bottom = 24;
  return {
    left: Math.max(0, window.innerWidth - right - BUTTON_SIZE),
    top: Math.max(0, window.innerHeight - bottom - BUTTON_SIZE),
  };
}

export default function SupportButton() {
  const { t } = useTranslation();
  const { isSupportOpen, setSupportOpen, isFloatingDismissed, dismissFloating } = useSupport();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [position, setPosition] = useState<{ left: number; top: number }>(() => getStoredPosition() ?? getDefaultPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [showDismissX, setShowDismissX] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const stored = getStoredPosition();
    if (stored) setPosition(stored);
    else setPosition(getDefaultPosition());
  }, []);

  const savePosition = useCallback((left: number, top: number) => {
    const safeLeft = Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, left));
    const safeTop = Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, top));
    setPosition({ left: safeLeft, top: safeTop });
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ left: safeLeft, top: safeTop }));
    } catch {}
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (showDismissX || isDismissing) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const left = position.left + e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left - BUTTON_SIZE / 2;
      const top = position.top + e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top - BUTTON_SIZE / 2;
      dragStartRef.current = { x: e.clientX, y: e.clientY, left: position.left, top: position.top };
      setIsDragging(false);
      didDragRef.current = false;
      setShowDismissX(false);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setShowDismissX(true);
      }, LONG_PRESS_MS);
    },
    [position, showDismissX, isDismissing]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current || showDismissX) return;
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
        if (dx > 6 || dy > 6) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        didDragRef.current = true;
        setIsDragging(true);
        const newLeft = dragStartRef.current.left + (e.clientX - dragStartRef.current.x);
        const newTop = dragStartRef.current.top + (e.clientY - dragStartRef.current.y);
        savePosition(newLeft, newTop);
      }
    },
    [showDismissX, savePosition]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    dragStartRef.current = null;
    setIsDragging(false);
    setTimeout(() => { didDragRef.current = false; }, 0);
  }, []);

  const handleFloatingClick = useCallback(
    (e: React.MouseEvent) => {
      if (showDismissX) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!didDragRef.current) setSupportOpen(true);
    },
    [showDismissX, setSupportOpen]
  );

  const handleDismissClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowDismissX(false);
      setIsDismissing(true);
      setTimeout(() => {
        dismissFloating();
        setIsDismissing(false);
      }, 400);
    },
    [dismissFloating]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid: File[] = [];
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    for (const f of selected) {
      if (valid.length >= MAX_FILES) break;
      if (f.size <= maxBytes) valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setToast(null);
    try {
      const formData = new FormData();
      formData.append('message', trimmed);
      files.forEach((f) => formData.append('files', f));
      await api.post('/api/support/contact', formData);
      setToast({ type: 'success', text: t.dashboard?.support?.contactSuccess ?? 'Mensagem enviada. Obrigado!' });
      setMessage('');
      setFiles([]);
      setTimeout(() => {
        setSupportOpen(false);
        setToast(null);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? t.dashboard?.support?.contactError ?? 'Não foi possível enviar. Tenta novamente.';
      setToast({ type: 'error', text: typeof msg === 'string' ? msg : 'Erro ao enviar.' });
    } finally {
      setSending(false);
    }
  };

  const open = isSupportOpen;

  return (
    <>
      {!isFloatingDismissed && (
        <motion.div
          role="button"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={handleFloatingClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!showDismissX) setSupportOpen(true);
            }
          }}
          aria-label={t.dashboard?.support?.tooltip ?? 'Contactar suporte'}
          aria-expanded={open}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: isDismissing ? 0.5 : 1, scale: isDismissing ? 0.9 : 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[9999] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            left: position.left,
            top: position.top,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 rounded-2xl animate-ping opacity-20 transition-opacity group-hover:opacity-40" />
            <div className="relative w-14 h-14 min-w-[56px] min-h-[56px] bg-blue-500 hover:bg-blue-400 text-white rounded-2xl flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-colors border border-blue-400/20 active:scale-95 pointer-events-none">
              <Mail size={28} className="fill-white/10" />
            </div>
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-700 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg pointer-events-none">
              <HelpCircle size={12} className="text-white" />
            </div>
            <AnimatePresence>
              {showDismissX && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={handleDismissClick}
                  className="absolute -top-1 -right-1 z-10 w-7 h-7 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 cursor-pointer touch-manipulation"
                  aria-label="Remover botão flutuante"
                >
                  <X size={14} strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, y: 8 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed z-[10001] flex flex-col rounded-2xl md:rounded-3xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-md shadow-2xl
              left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)]
              w-[auto] max-h-[min(88vh,900px)] min-h-[260px]
              md:left-auto md:right-[max(1rem,env(safe-area-inset-right))] md:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4rem)] md:w-[min(560px,calc(100vw-2rem))] md:min-h-0
              pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white opacity-90 truncate pr-2">
                  {t.dashboard?.support?.contactTitle ?? 'Enviar mensagem ao suporte'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSupportOpen(false)}
                  aria-label="Fechar"
                  className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer shrink-0 touch-manipulation"
                >
                  <X size={22} className="shrink-0" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.dashboard?.support?.contactPlaceholder ?? 'Escreve a tua mensagem...'}
                  rows={5}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl md:rounded-2xl py-3 px-4 sm:py-4 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none min-h-[140px] sm:min-h-[180px] md:min-h-[200px] touch-manipulation"
                  disabled={sending}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || files.length >= MAX_FILES}
                    className="inline-flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-sm font-medium border border-slate-600 cursor-pointer touch-manipulation"
                  >
                    <Paperclip size={18} className="shrink-0" />
                    {t.dashboard?.support?.contactAttach ?? 'Anexar ficheiro'}
                  </button>
                  {files.length > 0 && (
                    <span className="text-xs text-slate-500">
                      (máx. {MAX_FILES}, {MAX_FILE_SIZE_MB} MB)
                    </span>
                  )}
                </div>
                {files.length > 0 && (
                  <ul className="space-y-1.5 max-h-28 sm:max-h-32 overflow-y-auto overscroll-contain">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 py-2.5 px-3 bg-slate-800/50 rounded-xl text-sm text-slate-300 min-h-[44px]">
                        <span className="truncate min-w-0">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          disabled={sending}
                          className="shrink-0 text-slate-500 hover:text-red-400 cursor-pointer disabled:opacity-50 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation -mr-1"
                          aria-label={t.dashboard?.support?.contactRemoveFile ?? 'Remover'}
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {toast && (
                  <p className={`text-sm font-medium ${toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {toast.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] cursor-pointer touch-manipulation"
                >
                  {sending ? <Loader2 size={20} className="animate-spin" /> : (t.dashboard?.support?.contactSend ?? 'Enviar')}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
