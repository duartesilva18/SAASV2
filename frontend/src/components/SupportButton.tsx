'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { Mail, HelpCircle, Loader2, X, Paperclip } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILES = 3;
const POSITION_KEY = 'supportButtonPosition';
export const SUPPORT_HIDDEN_KEY = 'supportButtonHidden';

/** Tipo da secção support nas traduções (evita erro de union em t.dashboard.support). */
type SupportT = {
  tooltip?: string;
  message?: string;
  contactTitle?: string;
  contactPlaceholder?: string;
  contactAttach?: string;
  contactRemoveFile?: string;
  contactSend?: string;
  contactSuccess?: string;
  contactError?: string;
};

function loadPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const s = localStorage.getItem(POSITION_KEY);
    if (s) {
      const p = JSON.parse(s) as { x: number; y: number };
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    }
  } catch (_) {}
  return { x: 0, y: 0 };
}

function loadHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SUPPORT_HIDDEN_KEY) === '1';
  } catch (_) {}
  return false;
}

export default function SupportButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hidden, setHidden] = useState(loadHidden);
  const [showRemoveX, setShowRemoveX] = useState(false);
  const [initialPos] = useState(loadPosition);
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);
  const didDragRef = useRef(false);

  useEffect(() => {
    setHidden(loadHidden());
  }, []);

  useEffect(() => {
    const onOpen = () => {
      didDragRef.current = false;
      setHidden(false);
      setShowRemoveX(false);
      setOpen(true);
    };
    const onRestore = () => {
      try {
        localStorage.removeItem(POSITION_KEY);
      } catch (_) {}
      x.set(0);
      y.set(0);
      setHidden(false);
      setShowRemoveX(false);
    };
    window.addEventListener('open-support', onOpen);
    window.addEventListener('support-restore', onRestore);
    return () => {
      window.removeEventListener('open-support', onOpen);
      window.removeEventListener('support-restore', onRestore);
    };
  }, [x, y]);

  const savePosition = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ x: x.get(), y: y.get() }));
    } catch (_) {}
  };

  const hideButton = () => {
    setShowRemoveX(false);
    setHidden(true);
    try {
      localStorage.setItem(SUPPORT_HIDDEN_KEY, '1');
      window.dispatchEvent(new CustomEvent('support-hidden'));
    } catch (_) {}
  };

  const showButton = () => {
    setHidden(false);
    try {
      localStorage.removeItem(SUPPORT_HIDDEN_KEY);
    } catch (_) {}
  };

  const handleClick = (e?: React.MouseEvent) => {
    if (e?.target && (e.target as HTMLElement).closest('[data-support-remove]')) return;
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleDragStart = () => {
    didDragRef.current = true;
  };

  const handleDragEnd = () => {
    savePosition();
    setShowRemoveX(true);
  };

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
      setToast({ type: 'success', text: (t.dashboard?.support as SupportT | undefined)?.contactSuccess ?? 'Mensagem enviada. Obrigado!' });
      setMessage('');
      setFiles([]);
      setTimeout(() => {
        setOpen(false);
        setToast(null);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? (t.dashboard?.support as SupportT | undefined)?.contactError ?? 'Não foi possível enviar. Tenta novamente.';
      setToast({ type: 'error', text: typeof msg === 'string' ? msg : 'Erro ao enviar.' });
    } finally {
      setSending(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      <motion.button
        type="button"
        data-onboarding-target="support"
        drag
        dragMomentum={false}
        dragElastic={0.05}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x, y }}
        onClick={() => handleClick()}
        aria-label={(t.dashboard?.support as SupportT | undefined)?.tooltip ?? 'Contactar suporte (arrastar para mover; depois do arraste aparece X para esconder)'}
        aria-expanded={open}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-[max(1rem,env(safe-area-inset-right))] z-[9999] flex flex-row-reverse items-center gap-3 group cursor-grab active:cursor-grabbing touch-none"
      >
        {showRemoveX && (
          <button
            type="button"
            data-support-remove
            onClick={(e) => { e.stopPropagation(); hideButton(); }}
            aria-label="Esconder ícone de suporte"
            className="absolute -top-1 -right-1 z-10 w-7 h-7 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-lg cursor-pointer border-2 border-slate-900"
          >
            <X size={14} />
          </button>
        )}
        <div className="relative pointer-events-none">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 min-w-[48px] min-h-[48px] sm:min-w-[56px] sm:min-h-[56px] bg-blue-500 hover:bg-blue-400 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-colors border border-blue-400/20">
            <Mail size={24} className="sm:w-7 sm:h-7 fill-white/10" />
          </div>
          <div className="absolute -top-1 sm:-top-2 -left-1 sm:-left-2 w-5 h-5 sm:w-6 sm:h-6 bg-slate-700 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg">
            <HelpCircle size={10} className="sm:w-3 sm:h-3 text-white" />
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[10001] flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-md shadow-2xl
                left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)]
                w-[auto] max-h-[min(88vh,900px)] min-h-[260px]
                md:left-auto md:right-[max(1rem,env(safe-area-inset-right))] md:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4rem)] md:w-[min(560px,calc(100vw-2rem))] md:min-h-0
                pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                  <h3 className="text-sm font-black text-white tracking-tight truncate pr-2">
                    {(t.dashboard?.support as SupportT | undefined)?.contactTitle ?? 'Enviar mensagem ao suporte'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X size={20} className="shrink-0" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {(t.dashboard?.support as SupportT | undefined)?.message ?? 'Mensagem'}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={(t.dashboard?.support as SupportT | undefined)?.contactPlaceholder ?? 'Escreve a tua mensagem...'}
                      rows={5}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none min-h-[140px] sm:min-h-[160px]"
                      disabled={sending}
                    />
                  </div>
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
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <Paperclip size={16} className="shrink-0" />
                      {(t.dashboard?.support as SupportT | undefined)?.contactAttach ?? 'Anexar ficheiro'}
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
                        <li key={i} className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-950/60 border border-slate-700/60 rounded-xl text-sm text-slate-300 min-h-[40px]">
                          <span className="truncate min-w-0">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            disabled={sending}
                            className="shrink-0 text-slate-500 hover:text-red-400 cursor-pointer disabled:opacity-50 p-2 rounded-lg -mr-1"
                            aria-label={(t.dashboard?.support as SupportT | undefined)?.contactRemoveFile ?? 'Remover'}
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
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : ((t.dashboard?.support as SupportT | undefined)?.contactSend ?? 'Enviar')}
                  </button>
                </form>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
