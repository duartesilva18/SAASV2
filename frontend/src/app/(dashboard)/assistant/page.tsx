'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import { hasProAccess } from '@/lib/utils';
import api from '@/lib/api';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Send, User, Loader2, Trash2, Lock, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const PricingModal = dynamic(() => import('@/components/PricingModal'), { ssr: false });

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'comparison';
  title: string;
  data: { label: string; value: number; color?: string }[];
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

/**
 * Strips incomplete [CHART] blocks that haven't closed yet (during streaming).
 * Returns only the "safe" text to display.
 */
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
  const dataWithColors = chart.data.map((d, i) => ({
    ...d,
    fill: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="my-3 p-4 bg-slate-900/70 border border-slate-700/40 rounded-2xl"
    >
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <BarChart3 size={13} className="text-blue-400" />
        {chart.title}
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={dataWithColors} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={75} innerRadius={30} strokeWidth={0} paddingAngle={2}>
                {dataWithColors.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            </PieChart>
          ) : chart.type === 'line' ? (
            <LineChart data={dataWithColors}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: '#3B82F6', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <BarChart data={dataWithColors} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} angle={-15} textAnchor="end" height={45} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {dataWithColors.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;

        let processed = line
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-slate-900/60 px-1.5 py-0.5 rounded text-blue-300 text-[12px]">$1</code>');

        const bulletMatch = line.match(/^(\s*)[-•]\s+(.*)/);
        if (bulletMatch) {
          const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
          return (
            <div key={i} className="flex gap-2 items-start" style={{ paddingLeft: `${indent * 14}px` }}>
              <span className="text-blue-400/80 mt-[3px] shrink-0 text-[10px]">●</span>
              <span dangerouslySetInnerHTML={{ __html: processed.replace(/^(\s*)[-•]\s+/, '') }} className="text-[13px] leading-relaxed text-slate-300" />
            </div>
          );
        }

        const headerMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const cls = level === 1
            ? 'text-[15px] font-bold text-white mt-3 mb-1'
            : level === 2
              ? 'text-[14px] font-bold text-white mt-2.5 mb-0.5'
              : 'text-[13px] font-semibold text-slate-200 mt-2';
          return <p key={i} className={cls} dangerouslySetInnerHTML={{ __html: headerMatch[2] }} />;
        }

        return <p key={i} className="text-[13px] leading-relaxed text-slate-300" dangerouslySetInnerHTML={{ __html: processed }} />;
      })}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60 mt-0.5">
      <img
        src="/images/logo/logo-semfundo.png"
        alt="Finly"
        className="w-full h-full object-contain p-0.5"
        draggable={false}
      />
    </div>
  );
}

function MessageBubble({ msg, isLast, isStreaming }: { msg: ChatMsg; isLast: boolean; isStreaming?: boolean }) {
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
      initial={isLast ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`flex gap-2.5 ${isUser ? 'justify-end pl-12' : 'justify-start pr-12'}`}
    >
      {!isUser && <AssistantAvatar />}
      <div className={`max-w-full rounded-2xl ${
        isUser
          ? 'bg-blue-600 text-white px-4 py-2.5 rounded-br-lg'
          : 'text-slate-200'
      }`}>
        {parts.map((part, i) =>
          typeof part === 'string' ? (
            isUser ? (
              <p key={i} className="text-[13px] leading-relaxed">{part}</p>
            ) : (
              <MarkdownText key={i} text={part} />
            )
          ) : (
            <InlineChart key={i} chart={part} />
          )
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-slate-700/80 flex items-center justify-center mt-0.5 border border-slate-600/40">
          <User size={14} className="text-slate-300" />
        </div>
      )}
    </motion.div>
  );
}

const STORAGE_KEY = 'finly_assistant_messages';

function loadMessages(): ChatMsg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function saveMessages(msgs: ChatMsg[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {}
}

export default function AssistantPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadMessages());
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const isPro = user ? hasProAccess(user) : false;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isPro) return;
    api.get('/assistant/suggestions').then(r => {
      setSuggestions(r.data?.suggestions || []);
    }).catch(() => {});
  }, [isPro]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMsg = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const language = localStorage.getItem('language') || 'pt';
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${baseUrl}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept-Language': language,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'token') {
              accumulated += data.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            } else if (data.type === 'error') {
              accumulated += `\n\n⚠️ ${data.content}`;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content) {
          updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Ocorreu um erro. Tenta novamente.' };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setIsStreaming(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  if (!isPro) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center">
            <Lock size={32} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t?.dashboard?.assistant?.title || 'Copiloto IA'}
            </h2>
            <p className="text-slate-400 max-w-md">
              {t?.dashboard?.assistant?.proRequired || 'O Copiloto IA está disponível nos planos Pro. Faz upgrade para desbloquear.'}
            </p>
          </div>
          <button
            onClick={() => setShowPaywall(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
          >
            {t?.dashboard?.assistant?.upgrade || 'Ver Planos'}
          </button>
        </div>
        {showPaywall && <PricingModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60 shrink-0">
            <img
              src="/images/logo/logo-semfundo.png"
              alt="Finly"
              className="w-full h-full object-contain p-0.5"
              draggable={false}
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {t?.dashboard?.assistant?.title || 'Copiloto IA'}
              <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-[3px] bg-gradient-to-r from-blue-500/15 to-violet-500/15 text-blue-400 border border-blue-500/25 rounded-full">
                AI
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t?.dashboard?.assistant?.subtitle || 'Pergunta qualquer coisa sobre as tuas finanças'}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
            title={t?.dashboard?.assistant?.clearChat || 'Limpar conversa'}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 py-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800/60 border border-slate-700/40 mx-auto p-1">
                <img
                  src="/images/logo/logo-semfundo.png"
                  alt="Finly"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t?.dashboard?.assistant?.emptyTitle || 'Olá! Sou o teu copiloto financeiro.'}
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  {t?.dashboard?.assistant?.emptySubtitle || 'Tenho acesso aos teus dados reais. Pergunta o que quiseres.'}
                </p>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-xl px-4">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="px-3.5 py-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-[13px] text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-600/60 transition-all text-left cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming}
            />
          ))
        )}

        {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !getDisplayText(messages[messages.length - 1]?.content || '') && (
          <div className="flex gap-2.5 items-start">
            <AssistantAvatar />
            <div className="flex items-center gap-2 text-slate-500 pt-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[12px] text-slate-600">{t?.dashboard?.assistant?.thinking || 'A pensar...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 pt-3 border-t border-slate-800/40">
        <div className="flex items-end gap-2 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-2 focus-within:border-blue-500/30 focus-within:bg-slate-800/40 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t?.dashboard?.assistant?.placeholder || 'Pergunta algo sobre as tuas finanças...'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-slate-600 resize-none outline-none px-2 py-2 max-h-32 min-h-[40px] disabled:opacity-50"
            style={{ fieldSizing: 'content' } as any}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700/50 disabled:text-slate-600 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-600/80 text-center mt-2">
          {t?.dashboard?.assistant?.disclaimer || 'O Copiloto IA usa os teus dados reais. As respostas são geradas por IA e podem não ser 100% precisas.'}
        </p>
      </form>
    </div>
  );
}
