'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Database, CreditCard, Mail, Sparkles, MessageCircle, AlertCircle, CheckCircle2, 
  XCircle, Loader2, RefreshCw, Trash2, Clock
} from 'lucide-react';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/lib/UserContext';
import { useRouter } from 'next/navigation';

interface Integration {
  name: string;
  status: 'ok' | 'error' | 'skipped';
  message: string;
  icon: string;
}

interface RecentError {
  path: string;
  message: string;
  exc_type: string;
  at: string;
}

export default function AdminHealthPage() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });

  const fetchHealth = async () => {
    try {
      const res = await api.get('/admin/health');
      setIntegrations(res.data.integrations || []);
      setRecentErrors(res.data.recent_errors || []);
    } catch (err) {
      setToast({ isVisible: true, message: 'Erro ao carregar dashboard de saúde.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !user.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchHealth();
  }, [user]);

  const handleClearErrors = async () => {
    try {
      await api.post('/admin/health/clear-errors');
      setRecentErrors([]);
      setToast({ isVisible: true, message: 'Erros limpos.', type: 'success' });
    } catch (err: any) {
      setToast({ isVisible: true, message: err.response?.data?.detail || 'Erro ao limpar.', type: 'error' });
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-PT');
    } catch (_) {
      return iso;
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok') return <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />;
    if (status === 'error') return <XCircle size={24} className="text-red-500 shrink-0" />;
    return <AlertCircle size={24} className="text-slate-500 shrink-0" />;
  };

  if (loading) {
    return <PageLoading message="A verificar estado do sistema..." />;
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
            Dashboard de <span className="text-blue-500 italic">Saúde</span>
          </h1>
          <p className="text-slate-500 font-medium italic text-sm">
            Estado das integrações e últimos erros críticos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); fetchHealth(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>
          <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 p-2 rounded-2xl">
            <Activity className="text-blue-500" size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monitorização</span>
          </div>
        </div>
      </header>

      {/* Estado das integrações */}
      <section className="space-y-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Activity size={22} className="text-blue-500" />
          Estado das integrações
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((int, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-6 ${
                int.status === 'ok' 
                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                  : int.status === 'error'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {int.icon === 'database' && <Database size={28} className="text-slate-400 shrink-0" />}
                  {int.icon === 'stripe' && <CreditCard size={28} className="text-slate-400 shrink-0" />}
                  {int.icon === 'mail' && <Mail size={28} className="text-slate-400 shrink-0" />}
                  {(int.icon === 'gemini' || int.icon === 'openai') && <Sparkles size={28} className="text-slate-400 shrink-0" />}
                  {int.icon === 'telegram' && <MessageCircle size={28} className="text-slate-400 shrink-0" />}
                  {!['database','stripe','mail','gemini','openai','telegram'].includes(int.icon) && <Activity size={28} className="text-slate-400 shrink-0" />}
                  <div>
                    <p className="font-bold text-white">{int.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{int.message}</p>
                  </div>
                </div>
                <StatusIcon status={int.status} />
              </div>
              <div className="mt-4">
                <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                  int.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
                  int.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {int.status === 'ok' ? 'Operacional' : int.status === 'error' ? 'Erro' : 'Não configurado'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Últimos erros */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
            <AlertCircle size={22} className="text-amber-500" />
            Últimos erros críticos
          </h2>
          {recentErrors.length > 0 && (
            <button
              onClick={handleClearErrors}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors"
            >
              <Trash2 size={16} />
              Limpar erros
            </button>
          )}
        </div>
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
          {recentErrors.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500/50 mb-4" />
              <p className="text-slate-500 font-medium italic">Nenhum erro crítico registado.</p>
              <p className="text-slate-600 text-sm mt-1">Os erros não tratados são capturados automaticamente.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
              {recentErrors.map((err, i) => (
                <div key={i} className="p-4 hover:bg-slate-800/30">
                  <div className="flex items-start gap-3">
                    <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-mono text-sm truncate" title={err.path}>{err.path}</p>
                      <p className="text-slate-400 text-sm mt-1">{err.message}</p>
                      <p className="text-slate-600 text-xs mt-2 flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(err.at)} · {err.exc_type}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />
    </motion.div>
  );
}
