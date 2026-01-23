'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Activity, Shield, Trash2, Edit2, 
  Search, Filter, ArrowUpRight, TrendingUp,
  Mail, Calendar, ShieldCheck, Zap, Lock,
  ChevronRight, Loader2, AlertCircle, CheckCircle2,
  MoreVertical, ShieldAlert, ChevronLeft, ChevronDown, Globe
} from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';

export default function AdminDashboardPage() {
  const { t, formatCurrency } = useTranslation();
  const { user: currentUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [supportPhone, setSupportPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  
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
      const [statsRes, usersRes, settingsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/settings')
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setSupportPhone(settingsRes.data.support_phone || '351925989577');
      fetchAuditLogs(1, 'all');
    } catch (err) {
      console.error('Erro ao carregar dados de admin:', err);
      setToast({ isVisible: true, message: 'Erro ao carregar dados administrativos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchAuditLogs(auditPage, auditFilter);
    }
  }, [auditPage, auditFilter]);

  const handleToggleAdmin = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-admin`);
      setToast({ isVisible: true, message: 'Status de admin atualizado.', type: 'success' });
      fetchData();
    } catch (err) {
      setToast({ isVisible: true, message: 'Erro ao atualizar status.', type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este utilizador permanentemente?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setToast({ isVisible: true, message: 'Utilizador eliminado com sucesso.', type: 'success' });
      fetchData();
    } catch (err) {
      setToast({ isVisible: true, message: 'Erro ao eliminar utilizador.', type: 'error' });
    }
  };

  const handleUpdateSupportPhone = async () => {
    setSavingPhone(true);
    try {
      await api.post('/admin/settings', { support_phone: supportPhone });
      setToast({ isVisible: true, message: 'Número de suporte atualizado.', type: 'success' });
    } catch (err) {
      setToast({ isVisible: true, message: 'Erro ao atualizar suporte.', type: 'error' });
    } finally {
      setSavingPhone(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Acedendo ao Terminal de Comando...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase">
            Painel de <span className="text-blue-500 italic">Comando</span>
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">Controlo total sobre o ecossistema Finly.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-2 rounded-2xl">
          <ShieldAlert className="text-blue-500" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acesso Nível Root: {currentUser?.email}</span>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Utilizadores Totais', value: stats?.total_users, icon: Users, color: 'blue' },
          { label: 'Subscrições Ativas', value: stats?.active_subscriptions, icon: ShieldCheck, color: 'emerald' },
          { label: 'Total de Visitas', value: stats?.total_visits, icon: Activity, color: 'indigo' },
          { label: 'Transações no Sistema', value: stats?.total_transactions, icon: Zap, color: 'amber' }
        ].map((item, i) => (
          <div key={i} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-[32px] group hover:border-blue-500/20 transition-all flex-1">
            <div className="flex items-center justify-between mb-4">
              <item.icon className={`text-${item.color}-500`} size={20} />
              <div className={`px-2 py-1 bg-${item.color}-500/10 rounded-lg text-[8px] font-black text-${item.color}-400 uppercase`}>Métrica Live</div>
            </div>
            <p className="text-3xl font-black text-white mb-1">{item.value}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Telegram Support Config */}
      <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[48px] p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 blur-[100px] rounded-full -z-10" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60 mb-1">Configuração de Suporte</h2>
            <p className="text-xs text-slate-500 italic">Define o número de telemóvel para o botão de Telegram</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input 
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-blue-500 transition-all text-white font-medium"
                placeholder="Ex: 351925989577"
              />
            </div>
            <button
              onClick={handleUpdateSupportPhone}
              disabled={savingPhone}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
            >
              {savingPhone ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
            </button>
          </div>
        </div>
      </section>

      {/* User Management Section */}
      <section className="bg-slate-900/30 backdrop-blur-sm border border-white/5 rounded-[48px] p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -z-10" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest text-[11px] opacity-60 mb-1">Gestão de Operadores</h2>
            <p className="text-xs text-slate-500 italic">Lista completa de utilizadores e permissões</p>
          </div>
          
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Procurar por email ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:border-blue-500 transition-all text-white font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-white/5">
                <th className="pb-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Utilizador</th>
                <th className="pb-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Plano</th>
                <th className="pb-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Permissões</th>
                <th className="pb-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Acessos</th>
                <th className="pb-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${u.is_admin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{u.full_name || 'Utilizador Anon'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      ['active', 'trialing'].includes(u.subscription_status) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-white/5'
                    }`}>
                      {['active', 'trialing'].includes(u.subscription_status) ? 'Pro Plan' : 'Free Plan'}
                    </span>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-2">
                      {u.is_admin ? (
                        <div className="flex items-center gap-1.5 text-blue-400 font-black text-[9px] uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                          <Shield size={10} /> Admin
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Utilizador</span>
                      )}
                    </div>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white">{u.login_count}</span>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-tighter">Logins efetuados</span>
                    </div>
                  </td>
                  <td className="py-6 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggleAdmin(u.id)}
                        className="p-2.5 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        title={u.is_admin ? "Remover Admin" : "Tornar Admin"}
                      >
                        <Shield size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2.5 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Eliminar Utilizador"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Logs Overview */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[40px] p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500" size={20} />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white opacity-50">Auditoria do Sistema</h3>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative group min-w-[180px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-400 transition-colors" size={14} />
              <select
                value={auditFilter}
                onChange={(e) => { setAuditFilter(e.target.value); setAuditPage(1); }}
                className="w-full bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-2xl py-3 pl-10 pr-10 text-[11px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer appearance-none shadow-inner"
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
                className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl hover:bg-white/[0.04] hover:border-blue-500/20 transition-all group/log"
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

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />
    </motion.div>
  );
}

