'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, Loader2, User, Headphones, CheckCircle2,
  X, Mail, Clock, ChevronLeft, Archive, Trash2, Sparkles, Zap, UserCheck, Check, CheckCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useUser } from '@/lib/UserContext';
import { useRouter } from 'next/navigation';

interface Assignee {
  id: string;
  name: string;
  email?: string;
}

interface Conversation {
  id: string;
  subject: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_message: string | null;
  user_email: string;
  user_name: string | null;
  assigned_to: Assignee | null;
}

interface Message {
  id: string;
  sender_type: 'user' | 'admin';
  content: string;
  image_url?: string | null;
  is_read: boolean;
  is_auto?: boolean;
  created_at: string;
}

export default function AdminSupportPage() {
  const { user } = useUser();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [convoMeta, setConvoMeta] = useState<{ user_email: string; user_name: string; subject: string | null; status: string; assigned_to?: Assignee | null } | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyLoading, setAutoReplyLoading] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => {
    api.get('/admin/support/auto-reply').then(r => setAutoReply(r.data?.enabled || false)).catch(() => {});
  }, []);

  const toggleAutoReply = async () => {
    setAutoReplyLoading(true);
    try {
      const res = await api.post('/admin/support/auto-reply', { enabled: !autoReply });
      setAutoReply(res.data?.enabled || false);
    } catch {} finally { setAutoReplyLoading(false); }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const params = filter === 'all' ? '' : `?status_filter=${filter}`;
      const res = await api.get(`/admin/support/conversations${params}`);
      setConversations(res.data || []);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Auto-refresh list every 20s (skip when tab hidden)
  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) fetchConversations(); }, 20000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setMsgsLoading(true);
    try {
      const res = await api.get(`/admin/support/conversations/${id}/messages`);
      setMessages(res.data?.messages || []);
      setConvoMeta(res.data?.conversation || null);
      fetchConversations();
    } catch {} finally { setMsgsLoading(false); }
  };

  // Typing indicator
  const [userTyping, setUserTyping] = useState(false);
  const adminTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendAdminTypingPing = useCallback(() => {
    if (!selectedId) return;
    if (adminTypingTimer.current) clearTimeout(adminTypingTimer.current);
    adminTypingTimer.current = setTimeout(() => {
      api.post(`/admin/support/conversations/${selectedId}/typing`).catch(() => {});
    }, 300);
  }, [selectedId]);

  // Poll messages + typing when conversation open (skip when tab hidden)
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const [msgRes, typRes] = await Promise.all([
          api.get(`/admin/support/conversations/${selectedId}/messages`),
          api.get(`/admin/support/conversations/${selectedId}/typing`),
        ]);
        setMessages(prev => {
          const newMsgs = msgRes.data?.messages || [];
          if (prev.length === newMsgs.length && prev[prev.length - 1]?.id === newMsgs[newMsgs.length - 1]?.id) return prev;
          return newMsgs;
        });
        setUserTyping(typRes.data?.typing || false);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const [replyError, setReplyError] = useState<string | null>(null);

  const sendReply = async () => {
    if (!reply.trim() || sending || !selectedId) return;
    setSending(true);
    setReplyError(null);
    try {
      await api.post(`/admin/support/conversations/${selectedId}/reply`, { content: reply.trim() });
      setReply('');
      const res = await api.get(`/admin/support/conversations/${selectedId}/messages`);
      setMessages(res.data?.messages || []);
      setConvoMeta(res.data?.conversation || null);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setReplyError(err.response.data?.detail || 'Conversa atribuída a outro admin.');
      }
    } finally { setSending(false); }
  };

  const claimConversation = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/admin/support/conversations/${selectedId}/assign`);
      setReplyError(null);
      setConvoMeta(prev => prev ? { ...prev, assigned_to: { id: user?.id || '', name: user?.full_name || user?.email || '' } } : prev);
      fetchConversations();
    } catch {}
  };

  const closeConversation = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/admin/support/conversations/${selectedId}/close`);
      setConvoMeta(prev => prev ? { ...prev, status: 'closed' } : null);
      fetchConversations();
    } catch {}
  };

  const deleteConversation = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Apagar esta conversa permanentemente?')) return;
    try {
      await api.delete(`/admin/support/conversations/${id}`);
      if (selectedId === id) { setSelectedId(null); setMessages([]); setConvoMeta(null); }
      fetchConversations();
    } catch {}
  };

  const [aiLoading, setAiLoading] = useState(false);
  const generateAISuggestion = async () => {
    if (!selectedId || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post(`/admin/support/conversations/${selectedId}/ai-suggest`);
      if (res.data?.suggestion) setReply(res.data.suggestion);
    } catch {} finally { setAiLoading(false); }
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Headphones size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Chat de Suporte
              {totalUnread > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-full">
                  {totalUnread} não lida{totalUnread !== 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">Gere as conversas de suporte dos utilizadores</p>
          </div>
        </div>

        {/* Auto-reply toggle */}
        <button
          onClick={toggleAutoReply}
          disabled={autoReplyLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
            autoReply
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 hover:bg-violet-500/25'
              : 'bg-slate-800/40 text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600/50'
          }`}
        >
          {autoReplyLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Auto-reply IA
          <div className={`w-8 h-4 rounded-full transition-all relative ${autoReply ? 'bg-violet-500' : 'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoReply ? 'left-[18px]' : 'left-0.5'}`} />
          </div>
        </button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Conversations list */}
        <div className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 shrink-0 bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden`}>
          {/* Filters */}
          <div className="flex items-center gap-1 p-3 border-b border-slate-800/40 shrink-0">
            {(['all', 'open', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'open' ? 'Abertas' : 'Fechadas'}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-slate-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
                <MessageCircle size={32} className="text-slate-600" />
                <p className="text-sm text-slate-500 font-medium">Sem conversas</p>
              </div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`group/item relative w-full text-left p-4 border-b border-slate-800/30 hover:bg-slate-800/30 transition-all cursor-pointer ${
                    selectedId === c.id ? 'bg-slate-800/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === 'open' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      <p className="text-[12px] font-bold text-white truncate">{c.user_name || c.user_email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.unread_count > 0 && (
                        <span className="w-5 h-5 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      )}
                      {c.status === 'closed' && (
                        <button
                          onClick={(e) => deleteConversation(c.id, e)}
                          className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                          title="Apagar conversa"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mb-1">{c.user_email}</p>
                  {c.assigned_to && (
                    <p className="text-[9px] text-violet-400/80 truncate mb-0.5 flex items-center gap-1">
                      <UserCheck size={9} />
                      {c.assigned_to.name}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 truncate">{c.last_message || c.subject || '...'}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{new Date(c.updated_at).toLocaleDateString()} {new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden min-w-0`}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Mail size={40} className="text-slate-700" />
              <p className="text-sm text-slate-500 font-medium">Seleciona uma conversa</p>
            </div>
          ) : msgsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-slate-500" />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/40 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedId(null)} className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{convoMeta?.user_name || convoMeta?.user_email}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {convoMeta?.user_email} · {convoMeta?.status === 'open' ? '🟢 Aberta' : '⚪ Fechada'}
                      {convoMeta?.assigned_to && (
                        <span className="text-violet-400/80 ml-1">· <UserCheck size={9} className="inline -mt-0.5" /> {convoMeta.assigned_to.name}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {convoMeta?.status === 'open' && convoMeta?.assigned_to?.id !== user?.id && (
                    <button
                      onClick={claimConversation}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/25 rounded-xl text-[10px] font-bold text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all cursor-pointer"
                    >
                      <UserCheck size={12} />
                      Assumir
                    </button>
                  )}
                  {convoMeta?.status === 'open' && (
                    <button
                      onClick={closeConversation}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-xl text-[10px] font-bold text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <Archive size={12} />
                      Fechar
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 p-4 min-h-0">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.sender_type === 'admin' ? 'justify-end pl-8' : 'justify-start pr-8'}`}>
                    {msg.sender_type === 'user' && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-slate-700/80 flex items-center justify-center mt-0.5 border border-slate-600/40">
                        <User size={12} className="text-slate-300" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.sender_type === 'admin'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-800/60 text-slate-200 border border-slate-700/40 rounded-bl-md'
                    }`}>
                      {msg.sender_type === 'admin' && msg.is_auto && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-cyan-200/90 mb-1">✨ Resposta automática (IA)</span>
                      )}
                      {msg.image_url && (
                        <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${msg.image_url}`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${msg.image_url}`}
                            alt=""
                            className="rounded-lg max-w-[240px] max-h-48 object-cover mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {msg.content !== '📷 Imagem' && (
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[9px] opacity-50">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender_type === 'admin' && (
                          msg.is_read
                            ? <CheckCheck size={12} className="text-blue-400" />
                            : <Check size={12} className="opacity-40" />
                        )}
                      </div>
                    </div>
                    {msg.sender_type === 'admin' && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mt-0.5">
                        <Headphones size={12} className="text-blue-400" />
                      </div>
                    )}
                  </div>
                ))}
                {userTyping && (
                  <div className="flex gap-2 justify-start pr-8">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-slate-700/80 flex items-center justify-center mt-0.5 border border-slate-600/40">
                      <User size={12} className="text-slate-300" />
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl rounded-bl-md px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={msgEndRef} />
              </div>

              {/* Reply input */}
              {convoMeta?.status === 'open' && (
                <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="shrink-0 p-3 border-t border-slate-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={generateAISuggestion}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/25 rounded-xl text-[10px] font-bold text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Gerar resposta IA
                    </button>
                    {aiLoading && <span className="text-[10px] text-slate-500">A pensar...</span>}
                  </div>
                  {replyError && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-xl">
                      <p className="text-[11px] text-red-400 flex-1">{replyError}</p>
                      <button onClick={claimConversation} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 underline cursor-pointer whitespace-nowrap">
                        Assumir conversa
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2 bg-slate-800/30 border border-slate-700/50 rounded-xl p-1.5 focus-within:border-blue-500/30 transition-all">
                    <textarea
                      value={reply}
                      onChange={e => { setReply(e.target.value); sendAdminTypingPing(); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Escreve a tua resposta..."
                      rows={1}
                      disabled={sending}
                      className="flex-1 bg-transparent text-[13px] text-white placeholder:text-slate-600 resize-none outline-none px-2 py-2 max-h-28 min-h-[40px] disabled:opacity-50"
                      style={{ fieldSizing: 'content' } as any}
                    />
                    <button type="submit" disabled={!reply.trim() || sending} className="shrink-0 w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700/50 disabled:text-slate-600 text-white flex items-center justify-center transition-all cursor-pointer">
                      {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
