'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, HelpCircle, Loader2, X, Paperclip } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILES = 3;

export default function SupportButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setOpen(false);
        setToast(null);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? t.dashboard?.support?.contactError ?? 'Não foi possível enviar. Tenta novamente.';
      setToast({ type: 'error', text: typeof msg === 'string' ? msg : 'Erro ao enviar.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t.dashboard?.support?.tooltip ?? 'Contactar suporte'}
        aria-expanded={open}
        initial={{ opacity: 0, scale: 0.5, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        whileHover={{ scale: 1.1, x: -5 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[9999] flex flex-row-reverse items-center gap-3 group cursor-pointer"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative w-14 h-14 min-w-[56px] min-h-[56px] bg-blue-500 hover:bg-blue-400 text-white rounded-2xl flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(59,130,246,0.4)] transition-colors border border-blue-400/20 active:scale-95">
            <Mail size={28} className="fill-white/10" />
          </div>
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-slate-700 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg">
            <HelpCircle size={12} className="text-white" />
          </div>
        </div>
      </motion.button>

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
                    onClick={() => setOpen(false)}
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
