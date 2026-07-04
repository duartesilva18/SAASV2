'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Activity, Shield, Trash2, Edit2, 
  Search, Filter, ArrowUpRight, TrendingUp,
  Mail, Calendar, ShieldCheck, Zap, Lock, CreditCard,
  ChevronRight, Loader2, AlertCircle, CheckCircle2,
  MoreVertical, ShieldAlert, ChevronLeft, ChevronDown, Globe, Gift, X, BotMessageSquare
} from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
import ConfirmModal from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const { t, formatCurrency } = useTranslation();
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Grant Pro modal
  const [userToGrantPro, setUserToGrantPro] = useState<{ id: string; name: string } | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantMonths, setGrantMonths] = useState<number>(3);
  const [grantingPro, setGrantingPro] = useState(false);
  // User logs modal
  const [showUserLogsModal, setShowUserLogsModal] = useState(false);
  const [selectedUserForLogs, setSelectedUserForLogs] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState<any[]>([]);
  const [loadingUserLogs, setLoadingUserLogs] = useState(false);
  const [userLogsPage, setUserLogsPage] = useState(1);
  const [userLogsTotalPages, setUserLogsTotalPages] = useState(1);
  const [userLogsFilter, setUserLogsFilter] = useState('all');
  const [userLogsSearch, setUserLogsSearch] = useState('');
  // Ficha de utilizador (drawer)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [detailUserRow, setDetailUserRow] = useState<any | null>(null);
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditFilter, setAuditFilter] = useState('all');
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchAuditLogs = async (page: number, action: string) => {
    setLoadingAudit(true);
    try {
      const res = await api.get(`/admin/audit-logs?page=${page}&limit=10&action=${action}`);
      setAuditLogs(res.data.logs);
      setAuditTotalPages(res.data.pages);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users')
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      fetchAuditLogs(1, 'all');
    } catch (err) {
      console.error('Erro ao carregar dados de admin:', err);
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.loadError, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !currentUser.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    if (!loading) {
      fetchAuditLogs(auditPage, auditFilter);
    }
  }, [auditPage, auditFilter]);

  const handleToggleAdmin = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-admin`);
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.adminStatusUpdated, type: 'success' });
      fetchData();
      refreshDetailIfOpen();
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.adminStatusError, type: 'error' });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/admin/users/${userToDelete}`);
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.userDeleted, type: 'success' });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      setShowDetailDrawer(false);
      fetchData();
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.deleteUserError, type: 'error' });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
  };

  const openGrantModal = (u: { id: string; full_name?: string; email: string }) => {
    setUserToGrantPro({ id: u.id, name: u.full_name || u.email });
    setShowGrantModal(true);
    setGrantMonths(3);
  };

  const handleGrantPro = async () => {
    if (!userToGrantPro) return;
    setGrantingPro(true);
    try {
      await api.post(`/admin/users/${userToGrantPro.id}/grant-pro`, { months: grantMonths });
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.grantProSuccess, type: 'success' });
      setShowGrantModal(false);
      setUserToGrantPro(null);
      fetchData();
      refreshDetailIfOpen();
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.grantProError, type: 'error' });
    } finally {
      setGrantingPro(false);
    }
  };

  const handleRevokePro = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/revoke-pro`);
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.revokeProSuccess, type: 'success' });
      fetchData();
      refreshDetailIfOpen();
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.revokeProError, type: 'error' });
    }
  };

  const fetchUserLogs = async (userId: string, page: number, action: string, search: string) => {
    setLoadingUserLogs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      params.set('action', action || 'all');
      if (search.trim()) params.set('q', search.trim());
      const res = await api.get(`/admin/users/${userId}/logs?${params.toString()}`);
      setSelectedUserLogs(res.data?.logs || []);
      setUserLogsTotalPages(res.data?.pages || 1);
    } catch (err) {
      setSelectedUserLogs([]);
      setToast({ isVisible: true, message: 'Erro ao carregar logs do utilizador.', type: 'error' });
    } finally {
      setLoadingUserLogs(false);
    }
  };

  const openUserLogs = async (u: { id: string; email: string; full_name?: string }) => {
    setSelectedUserForLogs({ id: u.id, email: u.email, name: u.full_name });
    setShowUserLogsModal(true);
    setUserLogsPage(1);
    setUserLogsFilter('all');
    setUserLogsSearch('');
    await fetchUserLogs(u.id, 1, 'all', '');
  };

  useEffect(() => {
    if (!showUserLogsModal || !selectedUserForLogs) return;
    fetchUserLogs(selectedUserForLogs.id, userLogsPage, userLogsFilter, userLogsSearch);
  }, [userLogsPage, userLogsFilter]);

  const openUserDetail = async (u: any) => {
    setDetailUserRow(u);
    setShowDetailDrawer(true);
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await api.get(`/admin/users/${u.id}`);
      setDetailUser(res.data);
    } catch (err) {
      setToast({ isVisible: true, message: 'Erro ao carregar a ficha do utilizador.', type: 'error' });
      setShowDetailDrawer(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetailIfOpen = () => {
    if (showDetailDrawer && detailUserRow) openUserDetail(detailUserRow);
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtTs = (ts?: number | null) =>
    ts ? new Date(ts * 1000).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const daysAgo = (iso?: string | null) => {
    if (!iso) return null;
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d}d`;
  };

  const isProGranted = (u: { pro_granted_until?: string | null }) => {
    if (!u.pro_granted_until) return false;
    return new Date(u.pro_granted_until) > new Date();
  };

  const formatProUntil = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <PageLoading message="Acedendo ao Terminal de Comando..." />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 px-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white mb-2 uppercase leading-tight">
            Painel de <span className="text-blue-500 italic">Comando</span>
          </h1>
          <p className="text-slate-500 font-medium italic text-xs sm:text-sm">Controlo total sobre o ecossistema Finly.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 bg-slate-900/50 border border-slate-800 p-2 rounded-xl sm:rounded-2xl shrink-0">
          <ShieldAlert className="text-blue-500 shrink-0" size={18} />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Nível Root: {currentUser?.email}</span>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {[
          { label: t.dashboard.admin.dashboard.totalUsers, value: stats?.total_users, icon: Users, color: 'blue' },
          { label: t.dashboard.admin.dashboard.activeSubscriptions, value: stats?.active_subscriptions, icon: ShieldCheck, color: 'emerald' },
          { label: t.dashboard.admin.dashboard.totalVisits, value: stats?.total_visits, icon: Activity, color: 'indigo' },
          { label: t.dashboard.admin.dashboard.transactionsInSystem, value: stats?.total_transactions, icon: Zap, color: 'amber' }
        ].map((item, i) => (
          <div key={i} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[32px] group hover:border-blue-500/20 transition-all flex-1">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <item.icon className={`text-${item.color}-500`} size={18} />
              <div className={`px-1.5 sm:px-2 py-0.5 sm:py-1 bg-${item.color}-500/10 rounded-lg text-[7px] sm:text-[8px] font-black text-${item.color}-400 uppercase whitespace-nowrap`}>Métrica</div>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1">{item.value}</p>
            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{item.label}</p>
          </div>
        ))}
      </div>

      {/* User Management Section */}
      <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 lg:p-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-10">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60 mb-1">Gestão de Operadores</h2>
            <p className="text-xs text-slate-500 italic">Lista completa de utilizadores e permissões</p>
          </div>
          
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Procurar por email ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-12 sm:pl-14 pr-4 sm:pr-6 text-sm focus:outline-none focus:border-blue-500 transition-all text-white font-medium min-h-[48px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[1100px] px-4 sm:px-0">
            <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-white/5">
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Utilizador</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Plano</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Estado</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Permissões</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Acessos</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Telegram</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Copiloto IA</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Último Acesso</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${u.is_admin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-white truncate">
                          {u.full_name || t.dashboard.admin.dashboard.userAnon}
                          {u.is_affiliate && <span className="ml-1.5 text-[8px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md align-middle">AFILIADO</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{u.email}</p>
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">desde {fmtDate(u.created_at)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 sm:px-3 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest border whitespace-nowrap inline-flex w-fit ${
                          ['active', 'trialing'].includes(u.subscription_status) || isProGranted(u) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-white/5'
                        }`}>
                          {['active', 'trialing'].includes(u.subscription_status) ? 'Pro Plan' : isProGranted(u) ? t.dashboard.admin.dashboard.proUntil.replace('{date}', formatProUntil(u.pro_granted_until!)) : 'Free Plan'}
                        </span>
                        {(u.subscription_status === 'canceled' || u.subscription_status === 'cancel_at_period_end') && !isProGranted(u) && (
                          <span className="px-2 sm:px-2.5 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex w-fit bg-orange-500/10 text-orange-400 border-orange-500/20" title="Plano cancelado ou a terminar">
                            Cancelado
                          </span>
                        )}
                        {u.had_refund === true && (
                          <span className="px-2 sm:px-2.5 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex w-fit bg-amber-500/10 text-amber-400 border-amber-500/20" title="Reembolso dado">
                            Reembolso
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex flex-col gap-1">
                      {/* Linha 1: pode ser cobrado? (o que interessa ao negócio) */}
                      {u.has_payment_method ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex items-center gap-1 w-fit bg-emerald-500/10 text-emerald-400 border-emerald-500/20" title="Tem cartão guardado no Stripe — as cobranças vão funcionar.">
                          <CreditCard size={9} className="shrink-0" /> Pode ser cobrado ✓
                        </span>
                      ) : u.subscription_status === 'trialing' && u.has_stripe_customer ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex items-center gap-1 w-fit bg-orange-500/10 text-orange-400 border-orange-500/20" title="Está em trial mas não guardou cartão — quando o trial acabar, a cobrança vai falhar.">
                          <CreditCard size={9} className="shrink-0" /> ⚠ Trial vai falhar (sem cartão)
                        </span>
                      ) : u.has_stripe_customer ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex items-center gap-1 w-fit bg-amber-500/10 text-amber-400 border-amber-500/20" title="Chegou ao checkout do Stripe mas nunca guardou um cartão.">
                          <CreditCard size={9} className="shrink-0" /> Desistiu no checkout
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex items-center gap-1 w-fit bg-slate-800 text-slate-500 border-white/5" title="Nunca abriu o checkout — ainda não tentou pagar nada.">
                          <CreditCard size={9} className="shrink-0" /> Nunca tentou pagar
                        </span>
                      )}
                      {/* Linha 2: situação do trial (só quando é relevante) */}
                      {u.subscription_status === 'trialing' ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex w-fit bg-cyan-500/10 text-cyan-400 border-cyan-500/20" title="Está neste momento no período de teste gratuito.">
                          Em trial agora
                        </span>
                      ) : u.had_trial ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap inline-flex w-fit bg-slate-800 text-slate-500 border-white/5" title="Já gastou o trial gratuito — não pode usá-lo outra vez.">
                          Trial já gasto
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex items-center gap-2">
                      {u.is_admin ? (
                        <div className="flex items-center gap-1.5 text-blue-400 font-black text-[8px] sm:text-[9px] uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 whitespace-nowrap">
                          <Shield size={10} /> Admin
                        </div>
                      ) : (
                        <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-600 tracking-widest whitespace-nowrap">Utilizador</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white">{u.login_count}</span>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter whitespace-nowrap">Logins</span>
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    {u.phone_number ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 size={10} className="shrink-0" /> Ligado
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">{u.bot_transactions_count ?? 0} tx{u.last_bot_tx_at ? ` · ${daysAgo(u.last_bot_tx_at)}` : ''}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider whitespace-nowrap">Não ligado</span>
                    )}
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      <BotMessageSquare size={12} className="text-violet-400 shrink-0" />
                      <span className={`text-xs font-black ${(u.copilot_messages_count ?? 0) > 0 ? 'text-violet-400' : 'text-slate-600'}`}>{u.copilot_messages_count ?? 0}</span>
                    </div>
                    <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter whitespace-nowrap">Msgs</span>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4">
                    <div className="flex flex-col">
                      {u.last_login ? (
                        <>
                          <span className="text-[11px] font-bold text-white whitespace-nowrap">
                            {new Date(u.last_login).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                            {new Date(u.last_login).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-600 italic">Nunca</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 sm:py-6 px-2 sm:px-4 text-right">
                    <button
                      onClick={() => openUserDetail(u)}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white rounded-xl transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider touch-manipulation"
                    >
                      Ver detalhes <ChevronRight size={13} className="shrink-0" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Audit Logs Overview */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <Activity className="text-blue-500 shrink-0" size={18} />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white opacity-50">Auditoria do Sistema</h3>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none md:min-w-[180px]">
              <Filter className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-400 transition-colors" size={14} />
              <select
                value={auditFilter}
                onChange={(e) => { setAuditFilter(e.target.value); setAuditPage(1); }}
                className="w-full bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-8 sm:pr-10 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer appearance-none shadow-inner min-h-[44px]"
              >
                <option value="all" className="bg-slate-900">Todas as Ações</option>
                <option value="login" className="bg-slate-900">Logins</option>
                <option value="register" className="bg-slate-900">Registos</option>
                <option value="delete" className="bg-slate-900">Eliminações</option>
                <option value="update" className="bg-slate-900">Atualizações</option>
                <option value="password" className="bg-slate-900">Password Reset</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
            </div>
          </div>
        </div>

        <div className="space-y-3 min-h-[400px]">
          {loadingAudit ? (
            <div className="flex items-center justify-center h-64">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse rounded-full" />
              </div>
            </div>
          ) : auditLogs.length > 0 ? (
            auditLogs.map((log: any, i: number) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                key={i} 
                className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.04] hover:border-blue-500/20 transition-all group/log"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover/log:scale-110 ${
                    log.severity === 'critical' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    log.severity === 'warning' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  }`}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight group-hover/log:text-blue-400 transition-colors">{log.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-500 font-medium italic">{log.details}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                        log.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        log.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {String(log.severity || 'info').toUpperCase()}
                      </span>
                      {log.user && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-bold border border-blue-500/10">
                          por {log.user.full_name || log.user.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{new Date(log.created_at).toLocaleString()}</p>
                  {log.ip_address && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950 rounded-lg border border-white/5">
                      <Globe size={8} className="text-slate-600" />
                      <span className="text-[9px] text-slate-600 font-bold tracking-tighter">{log.ip_address}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600">
              <Activity size={48} className="mb-4 opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] italic opacity-40">Nenhum registo de atividade</p>
            </div>
          )}
        </div>

        {/* Audit Pagination */}
        {auditTotalPages > 1 && (
          <div className="flex items-center justify-center gap-6 mt-12 py-6 border-t border-white/[0.03]">
            <button
              onClick={() => setAuditPage(prev => Math.max(1, prev - 1))}
              disabled={auditPage === 1 || loadingAudit}
              className="group p-3 bg-slate-900/50 hover:bg-blue-600 disabled:opacity-20 disabled:hover:bg-slate-900/50 text-slate-400 hover:text-white border border-slate-800 hover:border-blue-500 rounded-2xl transition-all cursor-pointer shadow-xl active:scale-90"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            
            <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-800 px-6 py-3 rounded-2xl">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Página</span>
              <div className="flex items-center gap-2">
                <span className="w-10 h-10 bg-blue-600 shadow-lg shadow-blue-600/30 flex items-center justify-center rounded-xl text-sm font-black text-white transform -rotate-3 border border-blue-400/30">
                  {auditPage}
                </span>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mx-1">de</span>
                <span className="text-sm font-black text-slate-400">{auditTotalPages}</span>
              </div>
            </div>

            <button
              onClick={() => setAuditPage(prev => Math.min(auditTotalPages, prev + 1))}
              disabled={auditPage === auditTotalPages || loadingAudit}
              className="group p-3 bg-slate-900/50 hover:bg-blue-600 disabled:opacity-20 disabled:hover:bg-slate-900/50 text-slate-400 hover:text-white border border-slate-800 hover:border-blue-500 rounded-2xl transition-all cursor-pointer shadow-xl active:scale-90"
            >
              <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </section>

      {/* Drawer: Ficha do utilizador */}
      <AnimatePresence>
        {showDetailDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDetailDrawer(false)}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-slate-900 border-l border-slate-700/60 shadow-2xl overflow-y-auto custom-scrollbar"
            >
              {detailLoading || !detailUser ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="p-5 sm:p-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${detailUser.is_admin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        {detailUser.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{detailUser.full_name || 'Sem nome'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{detailUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowDetailDrawer(false)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Badges de estado */}
                  <div className="flex flex-wrap gap-1.5">
                    {(['active', 'trialing'].includes(detailUser.subscription_status) || (detailUser.pro_granted_until && new Date(detailUser.pro_granted_until) > new Date())) ? (
                      <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Pro</span>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-slate-800 text-slate-500 border border-white/5">Free</span>
                    )}
                    {(detailUser.subscription_status === 'canceled' || detailUser.subscription_status === 'cancel_at_period_end') && (
                      <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">Cancelou</span>
                    )}
                    {detailUser.had_refund && <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Reembolso</span>}
                    {detailUser.is_admin && <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">Admin</span>}
                    {detailUser.is_affiliate && <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Afiliado</span>}
                    {detailUser.telegram_linked && <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Telegram ✓</span>}
                    {detailUser.last_payment_failure_code && <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">Falha pagamento</span>}
                  </div>

                  {/* Subscrição */}
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1.5"><CreditCard size={12} /> Subscrição</h4>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl divide-y divide-slate-800/70 text-xs">
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Estado local</span><span className="text-white font-bold">{detailUser.subscription_status}</span></div>
                      {detailUser.stripe?.status && <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Estado Stripe</span><span className="text-white font-bold">{detailUser.stripe.status}{detailUser.stripe.cancel_at_period_end ? ' (termina no fim do período)' : ''}</span></div>}
                      {detailUser.stripe?.current_period_end && <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">{detailUser.stripe.cancel_at_period_end ? 'Acesso até' : 'Renova a'}</span><span className="text-white font-bold">{fmtTs(detailUser.stripe.current_period_end)}</span></div>}
                      {detailUser.stripe?.canceled_at && <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Cancelou a</span><span className="text-orange-400 font-bold">{fmtTs(detailUser.stripe.canceled_at)}</span></div>}
                      {detailUser.pro_granted_until && <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Pro oferecido até</span><span className="text-emerald-400 font-bold">{fmtDate(detailUser.pro_granted_until)}</span></div>}
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Cartão</span><span className="text-white font-bold">{detailUser.stripe?.card_last4 ? `${detailUser.stripe.card_brand ?? 'card'} •••• ${detailUser.stripe.card_last4}` : detailUser.has_payment_method ? 'Guardado' : 'Sem cartão'}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Trial</span><span className="text-white font-bold">{detailUser.subscription_status === 'trialing' ? `Ativo até ${fmtDate(detailUser.trial_ends_at)}` : detailUser.had_trial ? 'Já usou' : 'Nunca usou'}</span></div>
                      {detailUser.last_payment_failure_code && (
                        <div className="px-3.5 py-2.5">
                          <span className="text-red-400 font-bold block">Última falha: {detailUser.last_payment_failure_code}</span>
                          <span className="text-slate-500 text-[10px]">{detailUser.last_payment_failure_message} · {fmtDateTime(detailUser.last_payment_failed_at)}</span>
                        </div>
                      )}
                      {(detailUser.stripe?.invoices?.length ?? 0) > 0 && (
                        <div className="px-3.5 py-2.5">
                          <span className="text-slate-500 block mb-1.5">Últimas faturas</span>
                          <div className="space-y-1">
                            {detailUser.stripe.invoices.map((inv: any, i: number) => (
                              <div key={i} className="flex justify-between gap-2 text-[11px]">
                                <span className="text-slate-400 tabular-nums">{fmtTs(inv.created)}</span>
                                <span className={`font-bold ${inv.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {formatCurrency((inv.status === 'paid' ? inv.amount_paid_cents : inv.amount_due_cents) / 100)} · {inv.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Telegram & Bot */}
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5"><BotMessageSquare size={12} /> Telegram & Bot</h4>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl divide-y divide-slate-800/70 text-xs">
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Ligado</span><span className={`font-bold ${detailUser.telegram_linked ? 'text-emerald-400' : 'text-slate-500'}`}>{detailUser.telegram_linked ? 'Sim' : 'Não'}</span></div>
                      {detailUser.telegram_linked && (
                        <>
                          <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Transações via bot</span><span className="text-white font-bold">{detailUser.bot_transactions_count}</span></div>
                          <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Última utilização</span><span className="text-white font-bold">{detailUser.last_bot_tx_at ? `${fmtDate(detailUser.last_bot_tx_at)} (${daysAgo(detailUser.last_bot_tx_at)})` : 'Nunca registou'}</span></div>
                          <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Pendentes por confirmar</span><span className="text-white font-bold">{detailUser.telegram_pending_count}</span></div>
                          <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Auto-confirmar</span><span className="text-white font-bold">{detailUser.telegram_auto_confirm ? 'Ativo' : 'Desativado'}</span></div>
                        </>
                      )}
                    </div>
                  </section>

                  {/* Utilização */}
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-1.5"><Activity size={12} /> Utilização</h4>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl divide-y divide-slate-800/70 text-xs">
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Transações (total)</span><span className="text-white font-bold">{detailUser.total_transactions}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Primeira / última</span><span className="text-white font-bold">{fmtDate(detailUser.first_tx_at)} → {fmtDate(detailUser.last_tx_at)}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Logins</span><span className="text-white font-bold">{detailUser.login_count} · último {fmtDateTime(detailUser.last_login)}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Copiloto IA</span><span className="text-white font-bold">{detailUser.copilot_messages_count} mensagens</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Workspaces / Categorias / Metas</span><span className="text-white font-bold">{detailUser.workspaces_count} / {detailUser.categories_count} / {detailUser.goals_count}</span></div>
                    </div>
                  </section>

                  {/* Afiliado */}
                  {(detailUser.is_affiliate || detailUser.referred_by_email) && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5"><Gift size={12} /> Afiliado</h4>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-xl divide-y divide-slate-800/70 text-xs">
                        {detailUser.is_affiliate && (
                          <>
                            <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Código</span><span className="text-amber-400 font-black font-mono">{detailUser.affiliate_code}</span></div>
                            <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Referências</span><span className="text-white font-bold">{detailUser.referrals_count} ({detailUser.referrals_converted} converteram)</span></div>
                            <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Comissões</span><span className="text-white font-bold">{formatCurrency(detailUser.commissions_total_cents / 100)} total · {formatCurrency(detailUser.commissions_pending_cents / 100)} pendente</span></div>
                            <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Stripe Connect</span><span className="text-white font-bold">{detailUser.stripe_connect_status ?? 'Não configurado'}</span></div>
                          </>
                        )}
                        {detailUser.referred_by_email && (
                          <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Veio pelo afiliado</span><span className="text-white font-bold truncate">{detailUser.referred_by_email}</span></div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Conta */}
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Users size={12} /> Conta</h4>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl divide-y divide-slate-800/70 text-xs">
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Criada</span><span className="text-white font-bold">{fmtDate(detailUser.created_at)}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Idioma / Moeda</span><span className="text-white font-bold uppercase">{detailUser.language ?? '—'} / {detailUser.currency ?? '—'}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Email verificado</span><span className={`font-bold ${detailUser.is_email_verified ? 'text-emerald-400' : 'text-red-400'}`}>{detailUser.is_email_verified ? 'Sim' : 'Não'}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Onboarding</span><span className="text-white font-bold">{detailUser.is_onboarded ? 'Completo' : 'Incompleto'}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Login</span><span className="text-white font-bold">{detailUser.has_google_login ? 'Google' : ''}{detailUser.has_google_login && detailUser.has_password ? ' + ' : ''}{detailUser.has_password ? 'Password' : ''}</span></div>
                      <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">Marketing</span><span className="text-white font-bold">{detailUser.marketing_opt_in ? 'Aceita' : 'Não aceita'}</span></div>
                    </div>
                  </section>

                  {/* Ações — botões com rótulo completo */}
                  <section className="pt-2 border-t border-slate-800 space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ações</h4>
                    {!detailUser.is_admin && (
                      (detailUser.pro_granted_until && new Date(detailUser.pro_granted_until) > new Date()) ? (
                        <button onClick={() => handleRevokePro(detailUser.id)} className="w-full min-h-[42px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors">
                          <X size={14} /> Retirar Pro oferecido
                        </button>
                      ) : (
                        <button onClick={() => openGrantModal(detailUser)} className="w-full min-h-[42px] rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors">
                          <Gift size={14} /> Oferecer Pro
                        </button>
                      )
                    )}
                    <button onClick={() => handleToggleAdmin(detailUser.id)} className="w-full min-h-[42px] rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      <Shield size={14} /> {detailUser.is_admin ? 'Remover permissões de admin' : 'Tornar administrador'}
                    </button>
                    <button onClick={() => openUserLogs(detailUser)} className="w-full min-h-[42px] rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      <Activity size={14} /> Ver histórico de atividade
                    </button>
                    <button onClick={() => handleDeleteClick(detailUser.id)} className="w-full min-h-[42px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      <Trash2 size={14} /> Eliminar conta permanentemente
                    </button>
                  </section>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title={t.dashboard.admin.dashboard.deleteUser}
        message={t.dashboard.admin.dashboard.deleteUserConfirmMessage}
        confirmText={t.dashboard.admin.dashboard.confirmDelete}
        cancelText={t.dashboard.admin.dashboard.cancel}
        variant="danger"
      />

      {/* Grant Pro modal */}
      <AnimatePresence>
        {showGrantModal && userToGrantPro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !grantingPro && (setShowGrantModal(false), setUserToGrantPro(null))}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-black text-white mb-2">{t.dashboard.admin.dashboard.grantProTitle}</h3>
              <p className="text-sm text-slate-400 mb-4">{userToGrantPro.name}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{t.dashboard.admin.dashboard.grantProDuration}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGrantMonths(m)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                      grantMonths === m ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {m === 1 ? t.dashboard.admin.dashboard.grantPro1Month : m === 3 ? t.dashboard.admin.dashboard.grantPro3Months : m === 6 ? t.dashboard.admin.dashboard.grantPro6Months : t.dashboard.admin.dashboard.grantPro1Year}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowGrantModal(false); setUserToGrantPro(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-sm cursor-pointer"
                >
                  {t.dashboard.admin.dashboard.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleGrantPro}
                  disabled={grantingPro}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {grantingPro ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t.dashboard.admin.dashboard.grantPro}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User logs modal */}
      <AnimatePresence>
        {showUserLogsModal && selectedUserForLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowUserLogsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">Logs do utilizador</h3>
                  <p className="text-xs text-slate-400">{selectedUserForLogs.name || selectedUserForLogs.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUserLogsModal(false)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                <input
                  type="text"
                  value={userLogsSearch}
                  onChange={(e) => setUserLogsSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedUserForLogs) {
                      setUserLogsPage(1);
                      fetchUserLogs(selectedUserForLogs.id, 1, userLogsFilter, (e.target as HTMLInputElement).value);
                    }
                  }}
                  placeholder="Pesquisar ação, detalhe, IP..."
                  className="md:col-span-2 bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                />
                <select
                  value={userLogsFilter}
                  onChange={(e) => { setUserLogsFilter(e.target.value); setUserLogsPage(1); }}
                  className="bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white cursor-pointer"
                >
                  <option value="all">Todas ações</option>
                  <option value="login">Login</option>
                  <option value="register">Registo</option>
                  <option value="stripe">Stripe</option>
                  <option value="support">Suporte</option>
                  <option value="admin">Admin</option>
                  <option value="password">Password</option>
                </select>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1">
                {loadingUserLogs ? (
                  <div className="py-10 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-blue-400" />
                  </div>
                ) : selectedUserLogs.length > 0 ? (
                  selectedUserLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-white uppercase tracking-wide">{log.action}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                          log.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          log.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {String(log.severity || 'info').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{log.details || 'Sem detalhes'}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-8 text-center">Sem logs para este utilizador.</p>
                )}
              </div>

              {userLogsTotalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    disabled={userLogsPage === 1 || loadingUserLogs}
                    onClick={() => setUserLogsPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-500">Página {userLogsPage} / {userLogsTotalPages}</span>
                  <button
                    type="button"
                    disabled={userLogsPage === userLogsTotalPages || loadingUserLogs}
                    onClick={() => setUserLogsPage((p) => Math.min(userLogsTotalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                  >
                    Seguinte
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </motion.div>
  );
}

