'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, Loader2, User, Trash2, Lock, BarChart3,
  BotMessageSquare, Headphones, ChevronRight, ImagePlus,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import { hasProAccess } from '@/lib/utils';
import api from '@/lib/api';
import dynamic from 'next/dynamic';

const PricingModal = dynamic(() => import('@/components/PricingModal'), { ssr: false });

// ── Types ──

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'comparison';
  title: string;
  data: { label: string; value: number; color?: string }[];
}

interface SupportMsg {
  id: string;
  sender_type: 'user' | 'admin';
  content: string;
  image_url?: string | null;
  is_read: boolean;
  created_at: string;
}

// ── AI Chart helpers (reused from assistant page) ──

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

function getDisplayText(raw: string): string {
  const openIdx = raw.lastIndexOf('[CHART]');
  if (openIdx === -1) return raw;
  const closeIdx = raw.indexOf('[/CHART]', openIdx);
  if (closeIdx !== -1) return raw;
  return raw.slice(0, openIdx);
}

function parseCharts(text: string): (string | ChartData)[] {
  const parts: (string | ChartData)[] = [];
  const regex = /\[CHART\]([\s\S]*?)\[\/CHART\]/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const txt = text.slice(lastIdx, match.index).trim();
      if (txt) parts.push(txt);
    }
    try {
      const chart = JSON.parse(match[1].trim()) as ChartData;
      if (chart.type && chart.data) parts.push(chart);
    } catch {}
    lastIdx = match.index + match[0].length;
  }
  const remaining = text.slice(lastIdx).trim();
  if (remaining) parts.push(remaining);
  return parts;
}

function InlineChart({ chart }: { chart: ChartData }) {
  const dataWithColors = chart.data.map((d, i) => ({ ...d, fill: d.color || CHART_COLORS[i % CHART_COLORS.length] }));
  return (
    <div className="my-2 p-3 bg-slate-900/70 border border-slate-700/40 rounded-xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <BarChart3 size={11} className="text-blue-400" />
        {chart.title}
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={dataWithColors} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={55} innerRadius={22} strokeWidth={0} paddingAngle={2}>
                {dataWithColors.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px' }} itemStyle={{ color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
            </PieChart>
          ) : chart.type === 'line' ? (
            <LineChart data={dataWithColors}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px' }} itemStyle={{ color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={dataWithColors} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#475569' }} angle={-15} textAnchor="end" height={40} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px' }} itemStyle={{ color: '#e2e8f0' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {dataWithColors.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        let processed = line
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-slate-900/60 px-1 py-0.5 rounded text-blue-300 text-[11px]">$1</code>');
        const bulletMatch = line.match(/^(\s*)[-•]\s+(.*)/);
        if (bulletMatch) {
          const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
          return (
            <div key={i} className="flex gap-1.5 items-start" style={{ paddingLeft: `${indent * 12}px` }}>
              <span className="text-blue-400/80 mt-[2px] shrink-0 text-[9px]">●</span>
              <span dangerouslySetInnerHTML={{ __html: processed.replace(/^(\s*)[-•]\s+/, '') }} className="text-[12px] leading-relaxed text-slate-300" />
            </div>
          );
        }
        const headerMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const cls = level === 1 ? 'text-[13px] font-bold text-white mt-2 mb-0.5' : level === 2 ? 'text-[12px] font-bold text-white mt-1.5' : 'text-[12px] font-semibold text-slate-200 mt-1';
          return <p key={i} className={cls} dangerouslySetInnerHTML={{ __html: headerMatch[2] }} />;
        }
        return <p key={i} className="text-[12px] leading-relaxed text-slate-300" dangerouslySetInnerHTML={{ __html: processed }} />;
      })}
    </div>
  );
}

// ── Main Component ──

export default function ChatPanel() {
  const { t } = useTranslation();
  const { user } = useUser();
  const isPro = user ? hasProAccess(user) : false;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'support'>('ai');
  const [showPaywall, setShowPaywall] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (dockRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Support unread count (only poll when tab/page is visible)
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      if (document.hidden) return;
      api.get('/api/support/unread-count').then(r => setSupportUnread(r.data?.unread || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // ── AI State ──
  const [aiMessages, setAiMessages] = useState<ChatMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load messages from DB on mount
  useEffect(() => {
    if (!isPro) return;
    api.get('/assistant/messages').then(r => {
      if (r.data?.messages?.length) setAiMessages(r.data.messages);
    }).catch(() => {});
  }, [isPro]);

  // Debounced save to DB when messages change
  useEffect(() => {
    if (!isPro || aiMessages.length === 0 || aiStreaming) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.post('/assistant/messages', { messages: aiMessages.slice(-100) }).catch(() => {});
    }, 5000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [aiMessages, isPro, aiStreaming]);

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);
  useEffect(() => {
    if (!isPro) return;
    api.get('/assistant/suggestions').then(r => setSuggestions(r.data?.suggestions || [])).catch(() => {});
  }, [isPro]);

  const sendAIMessage = useCallback(async (text: string) => {
    if (!text.trim() || aiStreaming) return;
    const userMsg: ChatMsg = { role: 'user', content: text.trim() };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput('');
    setAiStreaming(true);
    setAiMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const language = localStorage.getItem('language') || 'pt';
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Accept-Language': language },
        body: JSON.stringify({ message: text.trim(), history: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })) }),
        signal: controller.signal,
      });
      if (!response.ok) { const err = await response.json().catch(() => null); throw new Error(err?.detail || `Error ${response.status}`); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'token') {
              accumulated += data.content;
              setAiMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
            } else if (data.type === 'error') {
              accumulated += `\n\n⚠️ ${data.content}`;
              setAiMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setAiMessages(prev => {
        const u = [...prev];
        if (u[u.length - 1]?.role === 'assistant' && !u[u.length - 1].content) u[u.length - 1] = { role: 'assistant', content: '⚠️ Ocorreu um erro. Tenta novamente.' };
        return u;
      });
    } finally { setAiStreaming(false); aiAbortRef.current = null; }
  }, [aiMessages, aiStreaming]);

  const clearAIChat = () => {
    if (aiStreaming) aiAbortRef.current?.abort();
    setAiMessages([]);
    setAiStreaming(false);
    api.delete('/assistant/messages').catch(() => {});
  };

  // ── Support State ──
  const [supportMessages, setSupportMessages] = useState<SupportMsg[]>([]);
  const [supportInput, setSupportInput] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportConvoId, setSupportConvoId] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const supportEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { supportEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [supportMessages]);

  const loadSupportChat = useCallback(async () => {
    if (!user) return;
    setSupportLoading(true);
    try {
      const res = await api.get('/api/support/conversations');
      const convos = res.data || [];
      const openConvo = convos.find((c: any) => c.status === 'open');
      if (openConvo) {
        setSupportConvoId(openConvo.id);
        try {
          const msgRes = await api.get(`/api/support/conversations/${openConvo.id}/messages`);
          setSupportMessages(msgRes.data || []);
          setSupportUnread(0);
        } catch {
          setSupportMessages([]);
        }
      } else {
        setSupportConvoId(null);
        setSupportMessages([]);
      }
    } catch {
      setSupportConvoId(null);
      setSupportMessages([]);
    } finally { setSupportLoading(false); }
  }, [user]);

  useEffect(() => {
    if (isOpen && activeTab === 'support') loadSupportChat();
  }, [isOpen, activeTab, loadSupportChat]);

  // Poll for new messages when support tab open (skip when tab is hidden)
  useEffect(() => {
    if (!isOpen || activeTab !== 'support' || !supportConvoId) return;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await api.get(`/api/support/conversations/${supportConvoId}/messages`);
        const newMsgs = res.data || [];
        setSupportMessages(prev => {
          if (prev.length === newMsgs.length && prev[prev.length - 1]?.id === newMsgs[newMsgs.length - 1]?.id) return prev;
          return newMsgs;
        });
      } catch {}
    };
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, supportConvoId]);

  const sendSupportMessage = async (imageFile?: File) => {
    if (!supportInput.trim() && !imageFile) return;
    if (supportSending) return;
    setSupportSending(true);
    try {
      const fd = new FormData();
      fd.append('content', supportInput.trim() || '📷 Imagem');
      if (imageFile) fd.append('image', imageFile);
      const res = await api.post('/api/support/conversations', fd);
      const convoId = res.data?.conversation_id;
      if (convoId) {
        setSupportConvoId(convoId);
        const msgRes = await api.get(`/api/support/conversations/${convoId}/messages`);
        setSupportMessages(msgRes.data || []);
      }
      setSupportInput('');
    } catch {} finally { setSupportSending(false); }
  };

  // ── Texts ──
  const cp = (t as any)?.dashboard?.chatPanel;
  const at = (t as any)?.dashboard?.assistant;

  return (
    <>
      {/* ── Floating Trigger: vertical dock fixed on the right edge ── */}
      <div ref={dockRef} className="fixed right-0 top-1/2 z-[9998]" style={{ transform: 'translateY(-50%)' }}>
        <div
          className="flex flex-col items-center gap-2 rounded-l-2xl py-3 px-2"
          style={{ background: '#1a2236', borderLeft: '1px solid rgba(100,116,139,0.35)', borderTop: '1px solid rgba(100,116,139,0.35)', borderBottom: '1px solid rgba(100,116,139,0.35)', boxShadow: '-4px 0 24px rgba(0,0,0,0.5)', minWidth: '48px' }}
        >
          <button
            data-onboarding-target="dock-copilot"
            onClick={() => { if (!isPro) { setShowPaywall(true); return; } setActiveTab('ai'); setIsOpen(!isOpen || activeTab !== 'ai'); }}
            className="cursor-pointer"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: isOpen && activeTab === 'ai' ? 'rgba(139,92,246,0.25)' : 'transparent', color: isOpen && activeTab === 'ai' ? '#c4b5fd' : '#cbd5e1', position: 'relative' }}
            title={at?.title || 'Copiloto IA'}
          >
            <BotMessageSquare size={20} />
            {!isPro && <Lock size={9} style={{ position: 'absolute', top: -1, right: -1, color: '#fbbf24' }} />}
          </button>

          <div style={{ width: 20, height: 1, background: 'rgba(100,116,139,0.3)' }} />

          <button
            data-onboarding-target="dock-support"
            onClick={() => { setActiveTab('support'); setIsOpen(!isOpen || activeTab !== 'support'); }}
            className="cursor-pointer"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: isOpen && activeTab === 'support' ? 'rgba(59,130,246,0.25)' : 'transparent', color: isOpen && activeTab === 'support' ? '#93c5fd' : '#cbd5e1', position: 'relative' }}
            title={cp?.supportTab || 'Suporte'}
          >
            <Headphones size={20} />
            {supportUnread > 0 && (
              <span style={{ position: 'absolute', top: -4, left: -4, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', fontSize: 8, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a2236' }}>
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Slide-in Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[9999] bg-black/40 sm:hidden"
            />

            <motion.div
              ref={panelRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[420px] md:w-[440px] z-[10000] bg-slate-950/98 backdrop-blur-2xl border-l border-slate-700/60 shadow-[-20px_0_60px_rgba(0,0,0,0.5)] flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Panel header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {activeTab === 'ai' ? (
                    <>
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60 shrink-0">
                        <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-full h-full object-contain p-0.5" draggable={false} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                          {at?.title || 'Copiloto IA'}
                          <span className="text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-[2px] bg-gradient-to-r from-blue-500/15 to-violet-500/15 text-blue-400 border border-blue-500/25 rounded-full">AI</span>
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate">{at?.subtitle || 'Pergunta qualquer coisa sobre as tuas finanças'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                        <Headphones size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{cp?.supportTitle || 'Suporte'}</h3>
                        <p className="text-[10px] text-slate-500 truncate">{cp?.supportSubtitle || 'Envia-nos uma mensagem'}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activeTab === 'ai' && aiMessages.length > 0 && (
                    <button onClick={clearAIChat} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer" title={at?.clearChat || 'Limpar'}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800/40 shrink-0">
                <button
                  onClick={() => { if (!isPro) { setShowPaywall(true); return; } setActiveTab('ai'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'ai' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <BotMessageSquare size={13} />
                  {at?.title || 'Copiloto IA'}
                </button>
                <button
                  onClick={() => setActiveTab('support')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                    activeTab === 'support' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <Headphones size={13} />
                  {cp?.supportTab || 'Suporte'}
                  {supportUnread > 0 && (
                    <span className="w-4 h-4 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">{supportUnread > 9 ? '9+' : supportUnread}</span>
                  )}
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {activeTab === 'ai' ? (
                  <AITab
                    messages={aiMessages}
                    input={aiInput}
                    setInput={setAiInput}
                    isStreaming={aiStreaming}
                    suggestions={suggestions}
                    sendMessage={sendAIMessage}
                    endRef={aiEndRef}
                    t={at}
                    isPro={isPro}
                    onShowPaywall={() => setShowPaywall(true)}
                  />
                ) : (
                  <SupportTab
                    messages={supportMessages}
                    input={supportInput}
                    setInput={setSupportInput}
                    sending={supportSending}
                    loading={supportLoading}
                    sendMessage={sendSupportMessage}
                    endRef={supportEndRef}
                    t={cp}
                    conversationId={supportConvoId}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showPaywall && <PricingModal isVisible={showPaywall} onClose={() => setShowPaywall(false)} />}
    </>
  );
}

// ── AI Tab ──

function AITab({
  messages, input, setInput, isStreaming, suggestions, sendMessage, endRef, t, isPro, onShowPaywall,
}: {
  messages: ChatMsg[];
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  suggestions: string[];
  sendMessage: (text: string) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
  t: any;
  isPro: boolean;
  onShowPaywall: () => void;
}) {
  if (!isPro) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center">
          <Lock size={24} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">{t?.title || 'Copiloto IA'}</h3>
          <p className="text-xs text-slate-400">{t?.proRequired || 'Disponível nos planos Pro.'}</p>
        </div>
        <button onClick={onShowPaywall} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer">
          {t?.upgrade || 'Ver Planos'}
        </button>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-6">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800/60 border border-slate-700/40 p-0.5">
              <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-full h-full object-contain" draggable={false} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white">{t?.emptyTitle || 'Olá! Sou o teu copiloto financeiro.'}</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">{t?.emptySubtitle || 'Pergunta o que quiseres.'}</p>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 px-2">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} className="px-3 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all cursor-pointer text-left">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => <AIBubble key={i} msg={msg} isLast={i === messages.length - 1} isStreaming={isStreaming} />)
        )}
        {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !getDisplayText(messages[messages.length - 1]?.content || '') && (
          <div className="flex gap-2 items-center">
            <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60">
              <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-full h-full object-contain p-0.5" draggable={false} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[11px] text-slate-500 ml-1">{t?.thinking || 'A pensar...'}</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="shrink-0 p-3 border-t border-slate-800/40">
        <div className="flex items-end gap-2 bg-slate-800/30 border border-slate-700/50 rounded-xl p-1.5 focus-within:border-blue-500/30 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t?.placeholder || 'Pergunta algo...'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-slate-600 resize-none outline-none px-2 py-2 max-h-24 min-h-[36px] disabled:opacity-50"
            style={{ fieldSizing: 'content' } as any}
          />
          <button type="submit" disabled={!input.trim() || isStreaming} className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700/50 disabled:text-slate-600 text-white flex items-center justify-center transition-all cursor-pointer">
            {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[9px] text-slate-600/80 text-center mt-1.5">{t?.disclaimer || 'Respostas geradas por IA.'}</p>
      </form>
    </>
  );
}

const AIBubble = memo(function AIBubble({ msg, isLast, isStreaming }: { msg: ChatMsg; isLast: boolean; isStreaming?: boolean }) {
  const isUser = msg.role === 'user';
  const displayContent = useMemo(() => {
    if (isUser) return msg.content;
    if (isStreaming && isLast) return getDisplayText(msg.content);
    return msg.content;
  }, [msg.content, isUser, isStreaming, isLast]);

  const parts = useMemo(() => {
    if (isUser) return [displayContent];
    return parseCharts(displayContent);
  }, [displayContent, isUser]);

  if (!isUser && !displayContent && isStreaming) return null;

  return (
    <motion.div
      initial={isLast ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? 'justify-end pl-8' : 'justify-start pr-8'}`}
    >
      {!isUser && (
        <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60 mt-0.5">
          <img src="/images/logo/logo-semfundo.png" alt="Finly" className="w-full h-full object-contain p-0.5" draggable={false} />
        </div>
      )}
      <div className={`max-w-full rounded-xl ${isUser ? 'bg-blue-600 text-white px-3 py-2 rounded-br-md' : 'text-slate-200'}`}>
        {parts.map((part, i) =>
          typeof part === 'string'
            ? isUser ? <p key={i} className="text-[12px] leading-relaxed">{part}</p> : <MarkdownText key={i} text={part} />
            : <InlineChart key={i} chart={part} />
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-6 h-6 rounded-full bg-slate-700/80 flex items-center justify-center mt-0.5 border border-slate-600/40">
          <User size={11} className="text-slate-300" />
        </div>
      )}
    </motion.div>
  );
});

// ── Support Tab ──

function SupportTab({
  messages, input, setInput, sending, loading, sendMessage, endRef, t, conversationId,
}: {
  messages: SupportMsg[];
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  loading: boolean;
  sendMessage: (imageFile?: File) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
  t: any;
  conversationId: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendMessage(file);
    e.target.value = '';
  };
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 p-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
              <Headphones size={24} className="text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white">{t?.supportEmptyTitle || 'Precisas de ajuda?'}</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">{t?.supportEmptySubtitle || 'Envia uma mensagem e respondemos o mais rápido possível.'}</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.sender_type === 'user' ? 'justify-end pl-8' : 'justify-start pr-8'}`}>
              {msg.sender_type === 'admin' && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mt-0.5">
                  <Headphones size={11} className="text-blue-400" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.sender_type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-slate-800/60 text-slate-200 border border-slate-700/40 rounded-bl-md'
              }`}>
                {msg.image_url && (
                  <a href={`${apiBase}${msg.image_url}`} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`${apiBase}${msg.image_url}`}
                      alt=""
                      className="rounded-lg max-w-full max-h-40 object-cover mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                )}
                {msg.content !== '📷 Imagem' && (
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className="text-[9px] mt-1 opacity-50">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {msg.sender_type === 'user' && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-slate-700/80 flex items-center justify-center mt-0.5 border border-slate-600/40">
                  <User size={11} className="text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="shrink-0 p-3 border-t border-slate-800/40">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageSelect} className="hidden" />
        <div className="flex items-end gap-1.5 bg-slate-800/30 border border-slate-700/50 rounded-xl p-1.5 focus-within:border-blue-500/30 transition-all">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            className="shrink-0 w-8 h-8 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800/60 disabled:opacity-40 flex items-center justify-center transition-all cursor-pointer"
            title="Enviar imagem"
          >
            <ImagePlus size={16} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t?.supportPlaceholder || 'Escreve a tua mensagem...'}
            rows={1}
            disabled={sending}
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-slate-600 resize-none outline-none px-1 py-2 max-h-24 min-h-[36px] disabled:opacity-50"
            style={{ fieldSizing: 'content' } as any}
          />
          <button type="submit" disabled={!input.trim() || sending} className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700/50 disabled:text-slate-600 text-white flex items-center justify-center transition-all cursor-pointer">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </form>
    </>
  );
}
