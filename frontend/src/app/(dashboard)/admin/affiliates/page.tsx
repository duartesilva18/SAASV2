'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { 
  Users, TrendingUp, DollarSign, Settings, Plus, 
  Crown, Search, Filter, Mail, Copy, Check, Link2, ExternalLink, X, Trash2, UserPlus, Sparkles, LineChart
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import Toast from '@/components/Toast';

interface Affiliate {
  id: string;
  affiliate_id: string;
  code: string;
  commission_percentage: number;
  is_active: boolean;
  total_referrals: number;
  total_conversions: number;
  total_earnings_cents: number;
  total_paid_cents: number;
  affiliate_email?: string;
  affiliate_name?: string;
  affiliate_link?: string;
}

interface AffiliateSettings {
  default_commission_percentage: number;
  admin_email: string | null;
  is_system_active: boolean;
  min_payout_cents: number;
}

interface SystemStats {
  total_affiliates: number;
  total_referrals: number;
  total_conversions: number;
  total_earnings_cents: number;
  total_paid_cents: number;
  pending_payments_cents: number;
  conversion_rate: number;
}

export default function AdminAffiliatesPage() {
  const { t, formatCurrency } = useTranslation();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [topAffiliates, setTopAffiliates] = useState<Affiliate[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);

  // Form states
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteCommission, setPromoteCommission] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    default_commission_percentage: '',
    admin_email: '',
    is_system_active: true,
    min_payout_cents: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [affiliatesRes, topRes, settingsRes, statsRes, revenueRes] = await Promise.all([
        api.get('/affiliates/admin/all'),
        api.get('/affiliates/admin/top?limit=3'),
        api.get('/affiliates/admin/settings'),
        api.get('/affiliates/admin/stats'),
        api.get('/affiliates/admin/revenue-comparison').catch(() => ({ data: [] }))
      ]);

      setAffiliates(affiliatesRes.data);
      setTopAffiliates(topRes.data);
      setSettings(settingsRes.data);
      setSystemStats(statsRes.data);
      setRevenueData(revenueRes.data || []);

      // Preencher formulário de settings
      if (settingsRes.data) {
        setSettingsForm({
          default_commission_percentage: settingsRes.data.default_commission_percentage.toString(),
          admin_email: settingsRes.data.admin_email || '',
          is_system_active: settingsRes.data.is_system_active,
          min_payout_cents: (settingsRes.data.min_payout_cents / 100).toString()
        });
      }
    } catch (err) {
      setToast({
        show: true,
        message: 'Erro ao carregar dados',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(searchTerm)}&limit=10`);
      setUserSearchResults(res.data);
    } catch (err) {
      setUserSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (showPromoteModal) {
      // Reset quando o modal abre
      setUserSearch('');
      setSelectedUser(null);
      setPromoteUserId('');
      setUserSearchResults([]);
    }
  }, [showPromoteModal]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (userSearch && !selectedUser) {
        searchUsers(userSearch);
      } else {
        setUserSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch, selectedUser]);

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setPromoteUserId(user.id);
    setUserSearch(user.email || user.full_name || '');
    setUserSearchResults([]);
  };

  const handlePromote = async () => {
    if (!promoteUserId) {
      setToast({
        show: true,
        message: 'Por favor, seleciona um utilizador',
        type: 'error'
      });
      return;
    }

    try {
      await api.post('/affiliates/admin/promote', {
        user_id: promoteUserId,
        commission_percentage: promoteCommission ? parseFloat(promoteCommission) : undefined
      });

      setToast({
        show: true,
        message: 'Utilizador promovido a afiliado com sucesso!',
        type: 'success'
      });

      setShowPromoteModal(false);
      setPromoteUserId('');
      setPromoteCommission('');
      setUserSearch('');
      setSelectedUser(null);
      setUserSearchResults([]);
      fetchData();
    } catch (err: any) {
      setToast({
        show: true,
        message: err.response?.data?.detail || 'Erro ao promover utilizador',
        type: 'error'
      });
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await api.put('/affiliates/admin/settings', {
        default_commission_percentage: settingsForm.default_commission_percentage ? parseFloat(settingsForm.default_commission_percentage) : undefined,
        admin_email: settingsForm.admin_email || undefined,
        is_system_active: settingsForm.is_system_active,
        min_payout_cents: settingsForm.min_payout_cents ? Math.round(parseFloat(settingsForm.min_payout_cents) * 100) : undefined
      });

      setToast({
        show: true,
        message: 'Configurações atualizadas com sucesso!',
        type: 'success'
      });

      setShowSettingsModal(false);
      fetchData();
    } catch (err: any) {
      setToast({
        show: true,
        message: err.response?.data?.detail || 'Erro ao atualizar configurações',
        type: 'error'
      });
    }
  };

  const toggleAffiliateActive = async (affiliateId: string) => {
    try {
      await api.post(`/affiliates/admin/${affiliateId}/toggle-active`);
      fetchData();
      setToast({
        show: true,
        message: 'Estado do afiliado atualizado!',
        type: 'success'
      });
    } catch (err) {
      setToast({
        show: true,
        message: 'Erro ao alterar estado do afiliado',
        type: 'error'
      });
    }
  };

  const removeAffiliate = async (affiliateId: string, affiliateName: string) => {
    if (!confirm(`Tens a certeza que queres remover o afiliado "${affiliateName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await api.delete(`/affiliates/admin/${affiliateId}/remove`);
      fetchData();
      setToast({
        show: true,
        message: 'Afiliado removido com sucesso!',
        type: 'success'
      });
    } catch (err: any) {
      setToast({
        show: true,
        message: err.response?.data?.detail || 'Erro ao remover afiliado',
        type: 'error'
      });
    }
  };

  const filteredAffiliates = affiliates.filter(aff => 
    aff.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aff.affiliate_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aff.affiliate_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-white pb-20"
    >
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Gestão de Afiliados</h1>
          <p className="text-slate-400">Gere o programa de afiliados</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings size={16} />
            Configurações
          </button>
          <button
            onClick={() => setShowPromoteModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            Promover Afiliado
          </button>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      {systemStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users size={24} className="text-blue-400" />
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Total Afiliados</p>
                <p className="text-2xl font-black text-white">{systemStats.total_affiliates}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={24} className="text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Total Referências</p>
                <p className="text-2xl font-black text-white">{systemStats.total_referrals}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Taxa: {systemStats.conversion_rate}%</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign size={24} className="text-amber-400" />
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Total de Comissões</p>
                <p className="text-2xl font-black text-white">{formatCurrency(systemStats.total_earnings_cents / 100)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Comissões geradas</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign size={24} className="text-purple-400" />
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Pendente de Pagamento</p>
                <p className="text-2xl font-black text-white">{formatCurrency(systemStats.pending_payments_cents / 100)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Ainda não pago</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Afiliados */}
      {topAffiliates.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Crown size={24} className="text-amber-400" />
            <h2 className="text-2xl font-black text-white">Top 3 Afiliados</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topAffiliates.map((aff, idx) => (
              <div
                key={aff.id}
                className={`bg-slate-950 border rounded-2xl p-6 ${
                  idx === 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {idx === 0 && <Crown size={20} className="text-amber-400" />}
                    <div className="flex-1">
                      <p className="font-black text-white">{aff.affiliate_name || aff.affiliate_email || 'Sem nome'}</p>
                      <p className="text-xs text-slate-400">{aff.affiliate_email}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Código: {aff.code}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-slate-600">#{idx + 1}</span>
                </div>
                <div className="space-y-2">
                  {aff.affiliate_link && (
                    <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg">
                      <Link2 size={12} className="text-blue-400 shrink-0" />
                      <input
                        type="text"
                        value={aff.affiliate_link}
                        readOnly
                        className="flex-1 bg-transparent text-[10px] text-slate-300 font-mono truncate outline-none"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(aff.affiliate_link!);
                            setCopiedLink(aff.id);
                            setTimeout(() => setCopiedLink(null), 2000);
                          } catch (err) {}
                        }}
                        className="shrink-0 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      >
                        {copiedLink === aff.id ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Conversões</span>
                    <span className="font-black text-white">{aff.total_conversions}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2">Utilizadores que pagaram Pro</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Comissões Geradas</span>
                    <span className="font-black text-emerald-400">{formatCurrency(aff.total_earnings_cents / 100)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2">Total que o afiliado vai receber</div>
                  {aff.total_paid_cents > 0 && (
                    <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
                      <span className="text-slate-500">Já Pago</span>
                      <span className="text-slate-400">{formatCurrency(aff.total_paid_cents / 100)}</span>
                    </div>
                  )}
                  {aff.total_paid_cents > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-slate-500">Já Pago</span>
                      <span className="text-slate-400">{formatCurrency(aff.total_paid_cents / 100)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Afiliados */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">Todos os Afiliados</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredAffiliates.map((aff) => (
            <div
              key={aff.id}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-6"
            >
              <div className="space-y-4">
                {/* Informações principais */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      aff.is_active ? 'bg-emerald-500/20' : 'bg-slate-800'
                    }`}>
                      <Users size={24} className={aff.is_active ? 'text-emerald-400' : 'text-slate-500'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-white text-lg">{aff.affiliate_name || 'Sem nome'}</p>
                      <p className="text-sm text-slate-400">{aff.affiliate_email}</p>
                      <p className="text-xs text-slate-500 mt-1">Código: {aff.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAffiliateActive(aff.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                        aff.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {aff.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => removeAffiliate(aff.id, aff.affiliate_name || aff.affiliate_email || aff.code)}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
                      title="Remover afiliado"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                </div>

                {/* Link de afiliado */}
                {aff.affiliate_link && (
                  <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <Link2 size={16} className="text-blue-400 shrink-0" />
                    <input
                      type="text"
                      value={aff.affiliate_link}
                      readOnly
                      className="flex-1 bg-transparent text-xs text-slate-300 font-mono truncate outline-none"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(aff.affiliate_link!);
                          setCopiedLink(aff.id);
                          setTimeout(() => setCopiedLink(null), 2000);
                          setToast({
                            show: true,
                            message: 'Link copiado!',
                            type: 'success'
                          });
                        } catch (err) {
                          setToast({
                            show: true,
                            message: 'Erro ao copiar link',
                            type: 'error'
                          });
                        }
                      }}
                      className="shrink-0 p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Copiar link"
                    >
                      {copiedLink === aff.id ? (
                        <Check size={16} className="text-emerald-400" />
                      ) : (
                        <Copy size={16} className="text-slate-400" />
                      )}
                    </button>
                    <a
                      href={aff.affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Abrir link"
                    >
                      <ExternalLink size={16} className="text-blue-400" />
                    </a>
                  </div>
                )}

                {/* Estatísticas */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-800">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Taxa de Comissão</p>
                    <p className="font-black text-white">{aff.commission_percentage}%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Por conversão</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Utilizadores Referidos</p>
                    <p className="font-black text-white">{aff.total_referrals}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Total registados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Conversões</p>
                    <p className="font-black text-emerald-400">{aff.total_conversions}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Que pagaram Pro</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Comissões Geradas</p>
                    <p className="font-black text-white">{formatCurrency(aff.total_earnings_cents / 100)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {aff.total_paid_cents > 0 ? (
                        <>Pago: {formatCurrency(aff.total_paid_cents / 100)}</>
                      ) : (
                        <>A receber</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico de Comparação de Faturamento */}
      {revenueData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <LineChart size={24} className="text-blue-400" />
            <div>
              <h2 className="text-2xl font-black text-white">Comparação de Faturamento</h2>
              <p className="text-xs text-slate-400">Faturamento com e sem programa de afiliados</p>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={revenueData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCurrency(value / 100)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => formatCurrency(value / 100)}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="revenue_without_affiliates_cents"
                  name="Sem Afiliados"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue_with_affiliates_cents"
                  name="Com Afiliados"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-xs text-slate-400">Faturamento Sem Afiliados</p>
                <p className="text-sm font-black text-white">
                  {formatCurrency(
                    revenueData.reduce((sum, item) => sum + item.revenue_without_affiliates_cents, 0) / 100
                  )}
                </p>
                <p className="text-[10px] text-slate-500">Faturamento + Comissões pagas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-xs text-slate-400">Faturamento Com Afiliados</p>
                <p className="text-sm font-black text-white">
                  {formatCurrency(
                    revenueData.reduce((sum, item) => sum + item.revenue_with_affiliates_cents, 0) / 100
                  )}
                </p>
                <p className="text-[10px] text-slate-500">Faturamento real (após comissões)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Comparação de Faturamento */}
      {revenueData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <LineChart size={24} className="text-blue-400" />
            <div>
              <h2 className="text-2xl font-black text-white">Comparação de Faturamento</h2>
              <p className="text-xs text-slate-400">Faturamento com e sem programa de afiliados</p>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={revenueData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCurrency(value / 100)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => formatCurrency(value / 100)}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="revenue_without_affiliates_cents"
                  name="Sem Afiliados"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue_with_affiliates_cents"
                  name="Com Afiliados"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-xs text-slate-400">Faturamento Sem Afiliados</p>
                <p className="text-sm font-black text-white">
                  {formatCurrency(
                    revenueData.reduce((sum, item) => sum + item.revenue_without_affiliates_cents, 0) / 100
                  )}
                </p>
                <p className="text-[10px] text-slate-500">Faturamento + Comissões pagas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-xs text-slate-400">Faturamento Com Afiliados</p>
                <p className="text-sm font-black text-white">
                  {formatCurrency(
                    revenueData.reduce((sum, item) => sum + item.revenue_with_affiliates_cents, 0) / 100
                  )}
                </p>
                <p className="text-[10px] text-slate-500">Faturamento real (após comissões)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Promover Afiliado */}
      <AnimatePresence>
        {showPromoteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPromoteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-black text-white mb-6">Promover a Afiliado</h3>
              
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block flex items-center gap-2">
                    <Search size={14} />
                    Email ou Nome do Utilizador
                  </label>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setSelectedUser(null);
                        setPromoteUserId('');
                      }}
                      placeholder="Digita o email ou nome do utilizador..."
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 transition-colors"
                    />
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  {/* Lista de resultados */}
                  {userSearchResults.length > 0 && !selectedUser && (
                    <div className="absolute z-10 w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl max-h-60 overflow-y-auto shadow-2xl">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-900 transition-colors border-b border-slate-800 last:border-b-0 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{user.full_name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </div>
                            {user.is_affiliate && (
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                                Já é afiliado
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Utilizador selecionado */}
                  {selectedUser && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Users size={18} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-black">{selectedUser.full_name || 'Sem nome'}</p>
                            <p className="text-xs text-slate-400">{selectedUser.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedUser(null);
                            setPromoteUserId('');
                            setUserSearch('');
                          }}
                          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <X size={16} className="text-slate-400" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block flex items-center gap-2">
                    <DollarSign size={14} />
                    Percentagem de Comissão (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={promoteCommission}
                      onChange={(e) => setPromoteCommission(e.target.value)}
                      placeholder={settings?.default_commission_percentage.toString() || '10'}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 transition-colors pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Sparkles size={12} />
                    Se vazio, usa o padrão ({settings?.default_commission_percentage}%)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={() => setShowPromoteModal(false)}
                  className="flex-1 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <X size={16} />
                  Cancelar
                </button>
                <button
                  onClick={handlePromote}
                  disabled={!promoteUserId}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                  <UserPlus size={16} />
                  Promover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Configurações */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-black text-white mb-6">Configurações de Afiliados</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Comissão Padrão (%)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.default_commission_percentage}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_commission_percentage: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Email do Admin (para relatórios mensais)
                  </label>
                  <input
                    type="email"
                    value={settingsForm.admin_email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, admin_email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Mínimo para Pagamento (€)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.min_payout_cents}
                    onChange={(e) => setSettingsForm({ ...settingsForm, min_payout_cents: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settingsForm.is_system_active}
                    onChange={(e) => setSettingsForm({ ...settingsForm, is_system_active: e.target.checked })}
                    className="w-5 h-5 rounded bg-slate-950 border-slate-800"
                  />
                  <label className="text-sm text-white">Sistema de afiliados ativo</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateSettings}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
        type={toast.type}
        isVisible={toast.show}
      />
    </motion.div>
  );
}

