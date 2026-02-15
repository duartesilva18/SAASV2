'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Activity, Shield, Trash2, Edit2, 
  Search, Filter, ArrowUpRight, TrendingUp,
  Mail, Calendar, ShieldCheck, Zap, Lock,
  ChevronRight, Loader2, AlertCircle, CheckCircle2,
  MoreVertical, ShieldAlert, ChevronLeft, ChevronDown, Globe, Gift, X
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
    } catch (err) {
      setToast({ isVisible: true, message: t.dashboard.admin.dashboard.revokeProError, type: 'error' });
    }
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
          <div className="min-w-[640px] px-4 sm:px-0">
            <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-white/5">
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Utilizador</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Plano</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Permissões</th>
                <th className="pb-4 sm:pb-6 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-600">Acessos</th>
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
                        <p className="text-xs sm:text-sm font-black text-white truncate">{u.full_name || t.dashboard.admin.dashboard.userAnon}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{u.email}</p>
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
                  <td className="py-4 sm:py-6 px-2 sm:px-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!u.is_admin && (
                        isProGranted(u) ? (
                          <button 
                            onClick={() => handleRevokePro(u.id)}
                            className="p-2 sm:p-2.5 bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                            title={t.dashboard.admin.dashboard.revokePro}
                          >
                            <X size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => openGrantModal(u)}
                            className="p-2 sm:p-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                            title={t.dashboard.admin.dashboard.grantPro}
                          >
                            <Gift size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        )
                      )}
                      <button 
                        onClick={() => handleToggleAdmin(u.id)}
                        className="p-2 sm:p-2.5 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                        title={u.is_admin ? t.dashboard.admin.dashboard.removeAdmin : t.dashboard.admin.dashboard.makeAdmin}
                      >
                        <Shield size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(u.id)}
                        className="p-2 sm:p-2.5 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg sm:rounded-xl transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                        title={t.dashboard.admin.dashboard.deleteUser}
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
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
                    log.action.includes('delete') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                    log.action.includes('login') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                    'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  }`}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight group-hover/log:text-blue-400 transition-colors">{log.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-500 font-medium italic">{log.details}</p>
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-sm"
                >
                  {t.dashboard.admin.dashboard.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleGrantPro}
                  disabled={grantingPro}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {grantingPro ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t.dashboard.admin.dashboard.grantPro}
                </button>
              </div>
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

