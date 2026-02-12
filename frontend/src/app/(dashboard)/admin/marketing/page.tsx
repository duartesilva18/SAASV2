'use client';

import { useState, useEffect } from 'react';
import { 
  Megaphone, Send, Users, Mail, 
  MessageSquare, Sparkles, Loader2, 
  AlertCircle, CheckCircle2, History,
  Layout, Globe, Eye, X, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import Toast from '@/components/Toast';
import PageLoading from '@/components/PageLoading';
import { useUser } from '@/lib/UserContext';
import { useRouter } from 'next/navigation';

export default function MarketingAdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({
    optInCount: 0
  });
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    if (user && !user.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const [usersRes, historyRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/audit-logs?action=marketing_broadcast&limit=50')
      ]);
      
      const users = usersRes.data;
      const optedIn = users.filter((u: any) => u.marketing_opt_in);
      
      setStats({
        optInCount: optedIn.length
      });

      setCampaignHistory(historyRes.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!subject || !message) return;
    setShowConfirm(false);
    setSending(true);
    try {
      const res = await api.post('/admin/marketing/broadcast', { subject, message });
      setToast({
        isVisible: true,
        message: `Sucesso! Campanha disparada por email para ${res.data.sent} utilizadores.`,
        type: 'success'
      });
      setSubject('');
      setMessage('');
      fetchStats(); // Atualizar stats e histórico
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err.response?.data?.detail || 'Erro ao enviar broadcast.',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const parseLogDetails = (details: string) => {
    try {
      return JSON.parse(details);
    } catch (e) {
      // Fallback para logs antigos que eram apenas string
      const subjectMatch = details.match(/Broadcast: "(.*?)"/);
      const countMatch = details.match(/enviado para (\d+) utilizadores/);
      return {
        subject: subjectMatch ? subjectMatch[1] : 'Campanha sem Assunto',
        message: details, // Nos antigos não guardávamos a mensagem separada
        sent_count: countMatch ? countMatch[1] : '?'
      };
    }
  };
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setShowConfirm(true);
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[32px] bg-slate-900 border border-white/5 p-10 md:p-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl shadow-lg shadow-blue-600/10">
              <Megaphone size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Centro de Marketing</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-[0.9]">
            Broadcast de <span className="text-blue-500">Publicidade</span>.
          </h1>
          <p className="text-slate-400 text-lg font-medium italic max-w-xl">
            Comunica diretamente com os teus utilizadores via Email. O sistema dispara automaticamente para todos os utilizadores que autorizaram marketing.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Público Alvo</p>
                <p className="text-3xl font-black text-white">{stats.optInCount} <span className="text-xs text-slate-600 font-bold uppercase tracking-widest ml-1">Utilizadores</span></p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-white/5 shadow-xl relative overflow-hidden group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Método de Envio</p>
                <p className="text-3xl font-black text-white">Email <span className="text-xs text-slate-600 font-bold uppercase tracking-widest ml-1">Principal</span></p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Broadcast Form */}
        <div className="lg:col-span-2">
          <section className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -z-10" />
            
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Configurar Campanha</h3>
                <p className="text-xs text-slate-500 italic">Personaliza o conteúdo do disparo</p>
              </div>
              <button 
                onClick={() => setShowPreview(true)}
                disabled={!subject || !message}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-20 cursor-pointer"
              >
                <Eye size={14} /> Preview Email
              </button>
            </div>

            <form onSubmit={onFormSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Assunto da Campanha (Para Email)</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex: Nova Funcionalidade Zen..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 px-8 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Mensagem Publicitária</label>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Escreve aqui a tua publicidade... Lembra-te de ser Zen."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-6 px-8 text-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-6 p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl italic text-sm text-slate-400">
                <AlertCircle size={24} className="text-blue-500 shrink-0" />
                <p>Esta mensagem será enviada individualmente para cada utilizador. Certifica-te que o conteúdo é relevante e não abusivo.</p>
              </div>

              <button
                type="submit"
                disabled={sending || !subject || !message}
                className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:opacity-50 text-white rounded-[24px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
              >
                {sending ? <Loader2 size={24} className="animate-spin" /> : (
                  <>
                    Disparar Campanha <Send size={20} />
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full translate-x-10 -translate-y-10" />
            <Sparkles className="mb-6 opacity-80" size={32} />
            <h3 className="text-2xl font-black tracking-tighter mb-4 leading-none uppercase">Regras de Ouro</h3>
            <ul className="space-y-4 text-blue-100 font-medium italic text-sm leading-tight">
              <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1.5 shrink-0" /> Sê conciso e direto.</li>
              <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1.5 shrink-0" /> Usa emojis com moderação.</li>
              <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1.5 shrink-0" /> Oferece valor real no início.</li>
            </ul>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -z-10" />
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <History size={14} />
                Últimas Campanhas
              </h4>
              {campaignHistory.length > 0 && (
                <button 
                  onClick={() => setShowAllCampaigns(true)}
                  className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer border border-blue-500/10 active:scale-95"
                >
                  Ver Todas
                </button>
              )}
            </div>
            <div className="space-y-4">
              {campaignHistory.length > 0 ? (
                campaignHistory.slice(0, 4).map((log: any, i: number) => {
                  const data = parseLogDetails(log.details);
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedCampaign(log)}
                      className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/20 hover:bg-white/[0.08] transition-all cursor-pointer group/item"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-black text-white uppercase tracking-tighter group-hover/item:text-blue-400 transition-colors line-clamp-1 flex-1 mr-4">
                          {data.subject}
                        </p>
                        <ChevronRight size={12} className="text-slate-600 group-hover/item:translate-x-1 transition-all shrink-0" />
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold mb-2">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[8px] font-bold border border-blue-500/10">
                          {data.sent_count} alvos
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-30 italic">
                  <History size={32} className="mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhuma campanha enviada</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      {/* Selected Campaign Details Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCampaign(null)}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[32px] p-8 md:p-10 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full -z-10" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Detalhes do Envio</h3>
                    <p className="text-[10px] text-slate-500 font-bold">{new Date(selectedCampaign.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCampaign(null)}
                  className="p-2 hover:bg-white/5 text-slate-500 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {(() => {
                  const data = parseLogDetails(selectedCampaign.details);
                  return (
                    <>
                      {/* Card de Assunto */}
                      <div className="bg-white/[0.03] border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Mail size={40} className="text-blue-500" />
                        </div>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">Assunto do Email</p>
                        <h4 className="text-xl font-black text-white tracking-tight leading-tight">
                          {data.subject}
                        </h4>
                      </div>

                      {/* Card de Conteúdo */}
                      <div className="bg-slate-950/40 border border-white/5 rounded-[32px] p-8 relative">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
                          <MessageSquare size={12} />
                          Conteúdo Enviado
                        </p>
                        <div className="text-slate-400 font-medium italic leading-relaxed whitespace-pre-wrap text-sm border-l-2 border-blue-500/30 pl-6">
                          {data.message || 'Sem conteúdo disponível'}
                        </div>
                      </div>

                      {/* Info Técnica em Grelha */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                          <Users size={16} className="text-blue-400 mb-2 opacity-50" />
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total de Alvos</p>
                          <p className="text-sm font-black text-white">{data.sent_count} <span className="text-[9px] text-slate-600">users</span></p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                          <Globe size={16} className="text-indigo-400 mb-2 opacity-50" />
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">IP de Origem</p>
                          <p className="text-sm font-bold text-slate-300">{selectedCampaign.ip_address || '127.0.0.1'}</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() => setSelectedCampaign(null)}
                className="w-full mt-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* All Campaigns Modal */}
      <AnimatePresence>
        {showAllCampaigns && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllCampaigns(false)}
              className="absolute inset-0 bg-[#020617]/95 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-slate-900 border border-white/10 rounded-[32px] shadow-3xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Histórico Completo</h3>
                    <p className="text-[10px] text-slate-500 font-medium italic">Lista de todos os broadcasts de marketing</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAllCampaigns(false)}
                  className="p-3 hover:bg-white/5 text-slate-500 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* List Content */}
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaignHistory.map((log: any, i: number) => {
                    const data = parseLogDetails(log.details);
                    return (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => setSelectedCampaign(log)}
                        className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-[32px] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all cursor-pointer group/card"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/10">
                            {data.sent_count} alvos
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white uppercase tracking-tighter mb-2 line-clamp-1 group-hover/card:text-blue-400 transition-colors">
                          {data.subject}
                        </p>
                        <p className="text-[10px] text-slate-500 italic mb-4">
                          Enviado às {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                        <div className="flex items-center gap-2 text-blue-500/50 group-hover/card:text-blue-500 transition-colors">
                          <span className="text-[9px] font-black uppercase tracking-widest">Ver Mensagem Completa</span>
                          <ChevronRight size={12} className="group-hover/card:translate-x-1 transition-transform" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-white/5 bg-slate-900/50 flex items-center justify-center">
                <button 
                  onClick={() => setShowAllCampaigns(false)}
                  className="px-12 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  Fechar Histórico
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#020617] border border-white/[0.08] rounded-[32px] p-10 md:p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Background Accents */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full" />
              
              <div className="relative z-10">
                <div className="relative w-24 h-24 mx-auto mb-10">
                  <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse" />
                  <div className="relative w-full h-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[32px] flex items-center justify-center shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Megaphone size={40} className="text-blue-500 relative z-10" />
                  </div>
                </div>
                
                <div className="text-center space-y-4 mb-12">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] mb-2">Confirmação de Lançamento</h3>
                  <h2 className="text-3xl font-black text-white tracking-tighter leading-none">
                    Disparar Campanha?
                  </h2>
                  <p className="text-slate-400 font-medium italic text-base leading-relaxed max-w-xs mx-auto">
                    Estás prestes a enviar esta publicidade por email para <span className="text-white font-black px-2 py-0.5 bg-blue-600/20 rounded-lg">{stats.optInCount} utilizadores</span> selecionados.
                  </p>
                </div>

                {/* Campaign Preview Summary */}
                <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-6 mb-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 border border-white/5">
                      <Layout size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Assunto</p>
                      <p className="text-xs font-bold text-white truncate">{subject}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 border border-white/5 shrink-0">
                      <MessageSquare size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Mensagem</p>
                      <p className="text-xs font-medium text-slate-400 line-clamp-2 italic leading-relaxed">"{message}"</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleBroadcast}
                    className="group relative w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-xs transition-all active:scale-[0.98] overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      Sim, Disparar Agora <Send size={18} />
                    </span>
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="w-full py-6 bg-transparent hover:bg-white/5 text-slate-500 hover:text-slate-300 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all border border-transparent hover:border-white/5 cursor-pointer"
                  >
                    Cancelar Operação
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="absolute inset-0 bg-[#020617]/95 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-slate-900 border border-white/10 rounded-[32px] shadow-3xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Visualização do Email</h3>
                    <p className="text-[10px] text-slate-500 font-medium italic">Simulação de como o utilizador verá a notícia</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-3 hover:bg-white/5 text-slate-500 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Email Client Wrapper */}
              <div className="flex-1 overflow-y-auto bg-[#020617]/50 p-6 md:p-12 no-scrollbar">
                {/* Simulated Email Envelope */}
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Metadata */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="text-slate-600">De:</span> Finly Portugal <span className="text-blue-500/50 font-medium italic">&lt;noreply@finly.pt&gt;</span>
                    </p>
                    <p className="text-sm font-black text-white">
                      <span className="text-slate-500 text-[10px] uppercase tracking-widest mr-2">Assunto:</span> {subject}
                    </p>
                  </div>

                  {/* Real Content Preview */}
                  <div className="bg-[#020617] border border-[#1e293b] rounded-[24px] overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-[#020617] p-10 text-center border-b border-[#1e293b]">
                      <div className="text-2xl font-black text-white tracking-tighter">
                        Finly
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-12 text-[#94a3b8] leading-relaxed text-center">
                      <h2 className="text-2xl font-black text-white mt-0 mb-6 leading-tight">{subject}</h2>
                      <p className="text-lg whitespace-pre-wrap leading-relaxed italic">{message}</p>
                      
                      <div className="mt-12 pt-10 border-t border-[#1e293b]">
                        <p className="text-[10px] text-[#475569] uppercase font-black tracking-[3px]">
                          Recebeu este email porque aceitou as comunicações de marketing do Finly.
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-[#020617] p-8 text-center text-[#475569] text-[10px] font-black uppercase tracking-[3px] border-t border-[#1e293b]">
                      Finly Portugal © 2026
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-8 border-t border-white/5 bg-slate-900/50 flex items-center justify-center gap-4">
                <button 
                  onClick={() => { setShowPreview(false); onFormSubmit(new Event('submit') as any); }}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
                >
                  Confirmar e Disparar <Send size={14} />
                </button>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  Voltar à Edição
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

