'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users2, Copy, CheckCircle2, Loader2, Heart, Link2,
  RefreshCw, LogOut, UserMinus, KeyRound, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import PageLoading from '@/components/PageLoading';
import dynamic from 'next/dynamic';
const TransactionAddModal = dynamic(() => import('@/components/TransactionAddModal'), { ssr: false });

interface Member { id: string; name: string; email: string; role: string; joined_at: string | null }
interface SharingState {
  workspace_name: string;
  is_owner: boolean;
  members: Member[];
  member_limit: number;
  invite: { code: string; link: string; expires_at: string | null } | null;
}

const PERSON_COLORS = ['#3b82f6', '#f59e0b'];

export default function SharedPage() {
  const { t, formatCurrency } = useTranslation();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SharingState | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  const sh = (t.dashboard as any).shared ?? {};

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/workspace/sharing');
      setState(res.data);
      api.get('/categories/').then(c => setCategories(c.data || [])).catch(() => {});
      if ((res.data?.members?.length ?? 0) >= 2) {
        try {
          const st = await api.get('/workspace/sharing/stats');
          setStats(st.data);
        } catch { /* stats são bónus */ }
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error(err);
      setToast({ isVisible: true, message: sh.loadError ?? 'Erro ao carregar.', type: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    try {
      await api.post('/workspace/sharing/invite');
      await fetchAll();
      setToast({ isVisible: true, message: sh.inviteCreated ?? 'Link de convite gerado. Válido por 7 dias.', type: 'success' });
    } catch (err: any) {
      setToast({ isVisible: true, message: err?.response?.data?.detail ?? 'Erro ao gerar convite.', type: 'error' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await api.post('/workspace/sharing/join', { code: joinCode.trim() });
      setToast({ isVisible: true, message: (sh.joined ?? 'Juntaste-te ao workspace «{name}»! Tudo o que registarem cai no mesmo sítio.').replace('{name}', res.data?.workspace_name ?? ''), type: 'success' });
      setJoinCode('');
      setTimeout(() => window.location.reload(), 1400);
    } catch (err: any) {
      setToast({ isVisible: true, message: err?.response?.data?.detail ?? 'Código inválido.', type: 'error' });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await api.post('/workspace/sharing/leave');
      setConfirmLeave(false);
      setToast({ isVisible: true, message: sh.left ?? 'Saíste do workspace partilhado. Voltaste ao teu.', type: 'success' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setToast({ isVisible: true, message: err?.response?.data?.detail ?? 'Erro.', type: 'error' });
      setActionLoading(false);
      setConfirmLeave(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setActionLoading(true);
    try {
      await api.delete(`/workspace/sharing/members/${confirmRemove.id}`);
      setToast({ isVisible: true, message: sh.removed ?? 'Membro removido.', type: 'success' });
      setConfirmRemove(null);
      await fetchAll();
    } catch (err: any) {
      setToast({ isVisible: true, message: err?.response?.data?.detail ?? 'Erro.', type: 'error' });
    } finally {
      setActionLoading(false);
      setConfirmRemove(null);
    }
  };

  const copyLink = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  const fmt = (cents: number) => formatCurrency(Math.abs(cents) / 100);

  if (loading) return <PageLoading />;
  if (!state) return null;

  const hasPartner = state.members.length >= 2;
  const me = state.members.find(m => m.id === user?.id);
  const partner = state.members.find(m => m.id !== user?.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-white space-y-5 sm:space-y-6 pb-16"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white flex items-center gap-2.5">
            {sh.title ?? 'Partilhado'}
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-md">NOVO</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic mt-1">
            {hasPartner
              ? (sh.subtitleShared ?? 'O vosso dinheiro, num só sítio.')
              : (sh.subtitleSolo ?? 'Um plano, duas pessoas — convida quem partilha a vida contigo.')}
          </p>
        </div>
        {hasPartner && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer touch-manipulation"
            >
              + {sh.addTransaction ?? 'Adicionar transação'}
            </button>
            <div className="flex items-center -space-x-2">
            {state.members.map((m, i) => (
              <div key={m.id} title={m.name} className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-white border-2 border-slate-900 ${i === 0 ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                {initials(m.name)}
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      {!hasPartner ? (
        /* ── ESTADO CONVITE ─────────────────────────────────────────── */
        <div className="max-w-3xl space-y-5 sm:space-y-6">
          <section className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-6 sm:p-10 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-5">
              <Heart className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              {sh.heroTitle ?? 'O dinheiro é dos dois. A app também.'}
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto mb-1">
              {sh.heroDesc ?? 'Cada um regista do seu Telegram, tudo cai no mesmo sítio — e vês quem gastou o quê.'}
            </p>
            <p className="text-emerald-400 text-xs font-bold mb-7">
              {sh.heroIncluded ?? 'Incluído no teu plano — o teu parceiro não paga nada.'}
            </p>

            {state.is_owner && (
              state.invite ? (
                <div className="max-w-xl mx-auto space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/50 border border-blue-500/20 rounded-2xl p-2.5 pl-4">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Link2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <code className="text-xs text-slate-300 font-mono truncate">{state.invite.link}</code>
                    </div>
                    <button
                      onClick={() => copyLink(state.invite!.link)}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer touch-manipulation"
                    >
                      {copied ? <><CheckCircle2 className="w-4 h-4" /> {sh.copied ?? 'Copiado!'}</> : <><Copy className="w-4 h-4" /> {sh.copyLink ?? 'Copiar link'}</>}
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
                    <span>{(sh.inviteCode ?? 'Código: {code}').replace('{code}', state.invite.code)}</span>
                    {state.invite.expires_at && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {(sh.expiresAt ?? 'expira a {date}').replace('{date}', new Date(state.invite.expires_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }))}</span>
                    )}
                    <button onClick={handleGenerateInvite} disabled={inviteLoading} className="flex items-center gap-1 text-blue-400/80 hover:text-blue-300 cursor-pointer transition-colors">
                      {inviteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {sh.regenerate ?? 'gerar novo'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInvite}
                  disabled={inviteLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 touch-manipulation"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {sh.generateInvite ?? 'Gerar link de convite'}
                </button>
              )
            )}
          </section>

          {/* Tenho um código (contas existentes) */}
          <section className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-2">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-white tracking-tight">{sh.haveCode ?? 'Recebeste um convite?'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {sh.haveCodeDesc ?? 'Cola aqui o código para te juntares ao workspace de quem te convidou. Os teus dados atuais ficam guardados na tua conta.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder={sh.codePlaceholder ?? 'CÓDIGO'}
                maxLength={12}
                className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono tracking-widest uppercase focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-slate-600"
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-5 min-h-[42px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer touch-manipulation"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : (sh.join ?? 'Juntar-me')}
              </button>
            </div>
          </section>
        </div>
      ) : (
        /* ── DASHBOARD DO CASAL ─────────────────────────────────────── */
        <>
          {/* KPIs — 4 cartões estilo dashboard */}
          {stats?.has_partner && (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{sh.kpiCoupleSpend ?? 'Gastos do casal'}</p>
                  <p className="text-xl sm:text-2xl font-black text-white tabular-nums truncate">{fmt(stats.month.total_cents)}</p>
                  {stats.month.prev_month_total_cents > 0 && (
                    <p className={`text-[10px] font-semibold mt-0.5 ${stats.month.total_cents <= stats.month.prev_month_total_cents ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stats.month.total_cents <= stats.month.prev_month_total_cents ? '▼' : '▲'}{' '}
                      {Math.abs(Math.round((stats.month.total_cents - stats.month.prev_month_total_cents) / stats.month.prev_month_total_cents * 100))}% {sh.vsPrev ?? 'vs mês anterior'}
                    </p>
                  )}
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{sh.kpiIncome ?? 'Receitas do casal'}</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums truncate">{fmt(stats.month.income_cents ?? 0)}</p>
                  <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                    {(sh.kpiBalance ?? 'Saldo: {value}').replace('{value}', `${(stats.month.income_cents ?? 0) - stats.month.total_cents >= 0 ? '+' : '−'}${fmt(Math.abs((stats.month.income_cents ?? 0) - stats.month.total_cents))}`)}
                  </p>
                </motion.div>
                {state.members.map((m, i) => {
                  const p = stats.month.by_person[m.id] ?? { expenses_cents: 0, tx_count: 0 };
                  const pct = stats.month.total_cents > 0 ? Math.round((p.expenses_cents / stats.month.total_cents) * 100) : 0;
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PERSON_COLORS[i % 2] }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0]}</p>
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-white tabular-nums truncate">{fmt(p.expenses_cents)}</p>
                      <p className="text-[10px] text-slate-600 font-semibold mt-0.5">{pct}% {sh.ofTotal ?? 'do total'} · {p.tx_count} tx</p>
                    </motion.div>
                  );
                })}
              </section>

              {/* Barra de contribuição a duas cores */}
              {stats.month.total_cents > 0 && (
                <div className="px-0.5">
                  <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-800">
                    {state.members.map((m, i) => {
                      const p = stats.month.by_person[m.id]?.expenses_cents ?? 0;
                      return <div key={m.id} style={{ width: `${(p / stats.month.total_cents) * 100}%`, background: PERSON_COLORS[i % 2] }} />;
                    })}
                  </div>
                </div>
              )}

              {/* Linha 1: gasto diário 30 dias (2/3) + pie de categorias (1/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3 sm:mb-4">{sh.dailyChart ?? 'Gastos diários — últimos 30 dias'}</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={(stats.daily_series ?? []).map((row: any) => ({
                        d: row.date.slice(8) + '/' + row.date.slice(5, 7),
                        ...Object.fromEntries(state.members.map(m => [m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0], Math.round((row.by_person[m.id] ?? 0) / 100)])),
                      }))}
                      margin={{ top: 8, right: 8, bottom: 0 }}
                    >
                      <defs>
                        {PERSON_COLORS.map((c, i) => (
                          <linearGradient key={i} id={`personGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={c} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={c} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="d" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => `${v}€`} axisLine={false} tickLine={false} width={40} />
                      <Tooltip cursor={false} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: '14px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ fontSize: 11, fontWeight: 700 }} formatter={(value: any) => `${value}€`} />
                      {state.members.map((m, i) => (
                        <Area key={m.id} type="monotone" dataKey={m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0]} stroke={PERSON_COLORS[i % 2]} strokeWidth={2} fill={`url(#personGrad${i % 2})`} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    {state.members.map((m, i) => (
                      <span key={m.id} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: PERSON_COLORS[i % 2] }} /> {m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </motion.section>

                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-2">{sh.pieChart ?? 'Onde vai o dinheiro'}</h3>
                  {(stats.category_distribution ?? []).length === 0 ? (
                    <p className="text-xs text-slate-600 italic py-8 text-center">{sh.noSpendYet ?? 'Sem gastos este mês.'}</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={stats.category_distribution.map((c: any) => ({ name: c.category, value: Math.round(c.total_cents / 100) }))}
                               dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                            {stats.category_distribution.map((c: any, i: number) => (
                              <Cell key={i} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: '14px', color: '#f1f5f9', padding: '8px 12px' }} itemStyle={{ fontSize: 11, fontWeight: 700 }} formatter={(value: any) => `${value}€`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2 overflow-y-auto custom-scrollbar max-h-[120px]">
                        {stats.category_distribution.map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="flex items-center gap-1.5 font-bold text-slate-400 truncate">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} /> {c.category}
                            </span>
                            <span className="font-black text-white tabular-nums shrink-0">{fmt(c.total_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.section>
              </div>

              {/* Linha 2: 6 meses por pessoa + top categorias por pessoa */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {stats.monthly_series?.length > 0 && (
                  <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3 sm:mb-4">{sh.chartTitle ?? 'Gastos por pessoa — últimos 6 meses'}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={stats.monthly_series.map((row: any) => ({
                          month: row.month.slice(5) + '/' + row.month.slice(2, 4),
                          ...Object.fromEntries(state.members.map(m => [m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0], Math.round((row.by_person[m.id] ?? 0) / 100)])),
                        }))}
                        margin={{ top: 8, right: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${v}€`} axisLine={false} tickLine={false} width={44} />
                        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.06)' }} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: '14px', color: '#f1f5f9', padding: '10px 14px' }} itemStyle={{ fontSize: 11, fontWeight: 700 }} formatter={(value: any) => `${value}€`} />
                        {state.members.map((m, i) => (
                          <Bar key={m.id} dataKey={m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0]} fill={PERSON_COLORS[i % 2]} radius={[6, 6, 0, 0]} maxBarSize={26} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.section>
                )}

                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-4">{sh.topsTitle ?? 'Top categorias por pessoa'}</h3>
                  <div className="grid grid-cols-2 gap-5">
                    {state.members.map((m, i) => {
                      const tops = stats.top_categories_by_person?.[m.id] ?? [];
                      const maxV = tops[0]?.total_cents ?? 1;
                      return (
                        <div key={m.id}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: PERSON_COLORS[i % 2] }} />
                            {m.id === user?.id ? (sh.you ?? 'Tu') : m.name.split(' ')[0]}
                          </p>
                          {tops.length === 0 ? (
                            <p className="text-[10px] text-slate-600 italic">{sh.noSpendYet ?? 'Sem gastos este mês.'}</p>
                          ) : (
                            <div className="space-y-3">
                              {tops.map((c: any, j: number) => (
                                <div key={j}>
                                  <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="text-slate-300 truncate">{c.category}</span>
                                    <span className="text-white tabular-nums shrink-0 ml-2">{fmt(c.total_cents)}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.max((c.total_cents / maxV) * 100, 6)}%`, background: PERSON_COLORS[i % 2] }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              </div>

              {/* Últimos movimentos */}
              {stats.recent_transactions?.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3">{sh.recentTitle ?? 'Últimos movimentos'}</h3>
                  <div className="divide-y divide-slate-800/70">
                    {stats.recent_transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{tx.description || '—'}</p>
                          <p className="text-[10px] text-slate-500">
                            {tx.date ? new Date(tx.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : ''}
                            {tx.author_name && <span className="text-slate-600"> · {(sh.byAuthor ?? 'por {name}').replace('{name}', tx.author_name.split(' ')[0])}</span>}
                          </p>
                        </div>
                        <span className={`text-xs font-black tabular-nums shrink-0 ${tx.amount_cents > 0 ? 'text-emerald-400' : 'text-white'}`}>
                          {tx.amount_cents > 0 ? '+' : '−'}{fmt(tx.amount_cents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}
            </>
          )}

          {/* Gestão (rodapé discreto) */}
          <section className="border-t border-slate-800/80 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Users2 className="w-4 h-4 text-slate-500 shrink-0" />
                <p className="text-xs text-slate-500 truncate">
                  {state.members.map(m => m.name).join(' + ')} · {state.members.length}/{state.member_limit}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {state.is_owner && partner && (
                  <button
                    onClick={() => setConfirmRemove(partner)}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl text-[10px] font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer touch-manipulation"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> {(sh.removePartner ?? 'Remover {name}').replace('{name}', partner.name.split(' ')[0])}
                  </button>
                )}
                {!state.is_owner && me && (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-colors cursor-pointer touch-manipulation"
                  >
                    <LogOut className="w-3.5 h-3.5" /> {sh.leave ?? 'Sair do workspace'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
        title={sh.leaveTitle ?? 'Sair do workspace partilhado?'}
        message={sh.leaveMessage ?? 'Voltas ao teu workspace pessoal. Os dados do casal ficam com quem te convidou; os teus dados antigos continuam na tua conta.'}
        confirmText={sh.leaveConfirm ?? 'Sim, sair'}
        cancelText={sh.cancel ?? 'Cancelar'}
        variant="warning"
        isLoading={actionLoading}
      />
      <ConfirmModal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={handleRemove}
        title={sh.removeTitle ?? 'Remover do workspace?'}
        message={(sh.removeMessage ?? '{name} deixa de ver e registar neste workspace. As transações já registadas mantêm-se.').replace('{name}', confirmRemove?.name ?? '')}
        confirmText={sh.removeConfirm ?? 'Remover'}
        cancelText={sh.cancel ?? 'Cancelar'}
        variant="danger"
        isLoading={actionLoading}
      />

      <TransactionAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => { setShowAddModal(false); fetchAll(); }}
        categories={categories}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </motion.div>
  );
}
