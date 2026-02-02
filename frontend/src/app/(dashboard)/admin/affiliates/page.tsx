'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, TrendingUp, DollarSign, Search, 
  CheckCircle2, X, Loader2, Sparkles, Trophy,
  Eye, ArrowUpRight, Calendar, Copy, Plus,
  AlertCircle, CheckCircle, BarChart3, LineChart,
  PieChart, Activity, UserPlus, Crown, Edit
} from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import PageLoading from '@/components/PageLoading';
import { useRouter } from 'next/navigation';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie, Legend
} from 'recharts';

interface Affiliate {
  user_id: string;
  email: string;
  full_name: string | null;
  affiliate_code: string | null;
  is_affiliate: boolean;
  total_referrals: number;
  total_conversions: number;
  total_earnings_cents: number;
  created_at: string;
}

interface RevenueData {
  month: string;
  month_label: string;
  revenue_cents: number;
  commission_cents: number;
  commissions_count: number;
}

interface AffiliateRevenue {
  user_id: string;
  email: string;
  full_name: string | null;
  affiliate_code: string | null;
  total_revenue_cents: number;
  total_commission_cents: number;
  months_active: number;
  last_month: string | null;
}

export default function AdminAffiliatesPage() {
  const { t, formatCurrency } = useTranslation();
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [revenueTimeline, setRevenueTimeline] = useState<RevenueData[]>([]);
  const [revenueByAffiliate, setRevenueByAffiliate] = useState<AffiliateRevenue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [usersToPromote, setUsersToPromote] = useState<any[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' as 'success' | 'error' });
  const [promoting, setPromoting] = useState<string | null>(null);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [referralsPage, setReferralsPage] = useState(1);
  const [referralsPerPage] = useState(10);
  const [commissionPlus, setCommissionPlus] = useState<number>(20.0);
  const [commissionPro, setCommissionPro] = useState<number>(25.0);
  const [editingCommission, setEditingCommission] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [affiliatesRes, statsRes, timelineRes, revenueRes, commissionRes] = await Promise.all([
        api.get('/admin/affiliates'),
        api.get('/admin/affiliates/stats').catch(() => ({ data: null })),
        api.get('/admin/affiliates/revenue-timeline').catch(() => ({ data: { timeline: [] } })),
        api.get('/admin/affiliates/revenue-by-affiliate').catch(() => ({ data: { affiliates: [] } })),
        api.get('/admin/affiliates/commission-percentage').catch(() => ({ data: { plus: 20.0, pro: 25.0 } }))
      ]);
      setAffiliates(affiliatesRes.data);
      if (statsRes?.data) {
        setStats(statsRes.data);
      }
      if (timelineRes?.data?.timeline) {
        setRevenueTimeline(timelineRes.data.timeline.reverse());
      }
      if (revenueRes?.data?.affiliates) {
        setRevenueByAffiliate(revenueRes.data.affiliates);
      }
      if (commissionRes?.data?.plus != null) setCommissionPlus(Number(commissionRes.data.plus));
      if (commissionRes?.data?.pro != null) setCommissionPro(Number(commissionRes.data.pro));
    } catch (err: any) {
      console.error('Error loading affiliates:', err);
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.admin.affiliates.loadError,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommission = async () => {
    if (commissionPlus < 0 || commissionPlus > 100 || commissionPro < 0 || commissionPro > 100) {
      setToast({
        isVisible: true,
        message: t.dashboard.admin.affiliates.percentageRangeError,
        type: 'error'
      });
      return;
    }
    setSavingCommission(true);
    try {
      await api.post('/admin/affiliates/commission-percentage', { plus: commissionPlus, pro: commissionPro });
      setEditingCommission(false);
      setToast({
        isVisible: true,
        message: t.dashboard.admin.affiliates.percentageUpdated?.replace('{percentage}', `Plus ${commissionPlus}%, Pro ${commissionPro}%`) || 'Comissões atualizadas.',
        type: 'success'
      });
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.admin.affiliates.updatePercentageError,
        type: 'error'
      });
    } finally {
      setSavingCommission(false);
    }
  };

  const fetchUsersToPromote = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/admin/affiliates/users', {
        params: { search: searchUserTerm || undefined }
      });
      setUsersToPromote(res.data);
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.admin.affiliates.loadUsersError,
        type: 'error'
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (showPromoteModal) {
      fetchUsersToPromote();
    }
  }, [showPromoteModal, searchUserTerm]);

  const fetchAffiliateDetail = async (userId: string) => {
    setLoadingDetail(true);
    setReferralsPage(1); // Reset pagination when opening modal
    try {
      const res = await api.get(`/admin/affiliates/${userId}`);
      setDetailData(res.data);
      setShowDetailModal(true);
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.admin.affiliates.loadDetailsError,
        type: 'error'
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePromoteToAffiliate = async () => {
    if (!promoting) return;
    
    try {
      await api.post('/admin/affiliates/promote', { user_id: promoting });
      setToast({
        isVisible: true,
        message: t.dashboard.admin.affiliates.promoteSuccess,
        type: 'success'
      });
      setShowPromoteModal(false);
      setShowPromoteConfirm(false);
      setPromoting(null);
      fetchData();
      fetchUsersToPromote();
    } catch (err: any) {
      setToast({
        isVisible: true,
        message: err?.response?.data?.detail || t.dashboard.admin.affiliates.promoteError,
        type: 'error'
      });
      setShowPromoteConfirm(false);
      setPromoting(null);
    }
  };

  const handlePromoteClick = (userId: string) => {
    setPromoting(userId);
    setShowPromoteConfirm(true);
  };

  // Formatar sempre em EUR para esta página
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(cents / 100);
  };

  const filteredAffiliates = affiliates.filter(aff =>
    aff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (aff.full_name && aff.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (aff.affiliate_code && aff.affiliate_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Preparar dados para gráficos
  const chartData = revenueTimeline.map(item => ({
    month: item.month_label,
    receita: item.revenue_cents / 100,
    comissão: item.commission_cents / 100
  }));

  const pieData = revenueByAffiliate.slice(0, 5).map(aff => ({
    name: aff.full_name || aff.email.split('@')[0],
    value: aff.total_revenue_cents / 100
  }));

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  if (loading) {
    return <PageLoading message={t.dashboard.admin.affiliates.loadingAffiliates} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 px-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white mb-1 sm:mb-2 uppercase flex flex-wrap items-center gap-2 sm:gap-3">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
            <span className="leading-tight">{t.dashboard.admin.affiliates.manageTitle.split(' ')[0]} de <span className="text-amber-400 italic">{t.dashboard.admin.affiliates.manageTitle.split(' ').slice(1).join(' ')}</span></span>
          </h1>
          <p className="text-slate-500 font-medium italic text-xs sm:text-sm">{t.dashboard.admin.affiliates.manageSubtitle}</p>
        </div>
        <button
          onClick={() => setShowPromoteModal(true)}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95 w-full sm:w-auto min-h-[44px]"
        >
          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          Promover Utilizador
        </button>
      </header>

      {/* Commission Percentage Setting - Discreet */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/50 rounded-xl p-4 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">{t.dashboard.admin.affiliates.commissionPercentage}</div>
            {editingCommission ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">Plus</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionPlus}
                    onChange={(e) => setCommissionPlus(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-800/50 border border-amber-500/30 rounded-lg px-2 py-1.5 text-white font-black text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-sm font-black text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">Pro</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionPro}
                    onChange={(e) => setCommissionPro(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-800/50 border border-amber-500/30 rounded-lg px-2 py-1.5 text-white font-black text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-sm font-black text-slate-400">%</span>
                </div>
                <button
                  onClick={handleSaveCommission}
                  disabled={savingCommission}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCommission ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  {t.dashboard.admin.affiliates.save}
                </button>
                <button
                  onClick={() => {
                    setEditingCommission(false);
                    fetchData();
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-amber-400/80">Plus {commissionPlus}% · Pro {commissionPro}%</span>
                <button
                  onClick={() => setEditingCommission(true)}
                  className="p-1.5 hover:bg-slate-800/50 text-slate-400 hover:text-amber-400 rounded-lg transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="text-[10px] text-slate-500 italic ml-auto">
              {t.dashboard.admin.affiliates.appliesToFuture}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Overview */}
      {stats && stats.total_affiliates !== undefined && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-amber-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-amber-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1 truncate">{stats.total_affiliates}</p>
            <p className="text-[10px] sm:text-sm text-slate-400 truncate">{t.dashboard.admin.affiliates.totalAffiliates}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-blue-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 shrink-0" />
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1 truncate">{formatPrice(stats.total_revenue_cents || 0)}</p>
            <p className="text-[10px] sm:text-sm text-slate-400 truncate">{t.dashboard.admin.affiliates.totalRevenueLabel}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-green-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-green-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 shrink-0" />
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1 truncate">{stats.total_conversions}</p>
            <p className="text-[10px] sm:text-sm text-slate-400 truncate">{t.dashboard.admin.affiliates.conversionsLabel}</p>
            <p className="text-[9px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate">{t.dashboard.admin.affiliates.rate}: {stats.conversion_rate?.toFixed(1) || 0}%</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-amber-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-amber-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-0.5 sm:mb-1 truncate">{formatPrice(stats.total_paid_earnings_cents || stats.total_earnings_cents || 0)}</p>
            <p className="text-[10px] sm:text-sm text-slate-400 truncate">{t.dashboard.admin.affiliates.paidCommissions}</p>
          </motion.div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <LineChart className="w-5 h-5 text-amber-400" />
              Timeline de Faturamento
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorComissao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '12px'
                  }}
                  formatter={(value: number | undefined) => {
                    if (value === undefined) return '';
                    return formatPrice(value * 100);
                  }}
                />
                <Area type="monotone" dataKey="receita" stroke="#f59e0b" fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="comissão" stroke="#3b82f6" fillOpacity={1} fill="url(#colorComissao)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              <p>{t.dashboard.admin.affiliates.noData}</p>
            </div>
          )}
        </motion.div>

        {/* Top Affiliates Podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Top 5 Afiliados
            </h3>
          </div>
          {revenueByAffiliate.length > 0 ? (
            <div className="space-y-4">
              {/* Podium */}
              <div className="flex items-end justify-center gap-3 h-[200px]">
                {/* 2nd Place */}
                {revenueByAffiliate[1] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
                  >
                    <div className="w-full bg-gradient-to-b from-slate-700 to-slate-800 rounded-t-xl border border-slate-600/50 p-4 flex flex-col items-center gap-2" style={{ height: '60%' }}>
                      <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-black text-lg">
                        2
                      </div>
                      <p className="text-xs font-black text-white text-center truncate w-full">
                        {revenueByAffiliate[1].full_name || revenueByAffiliate[1].email.split('@')[0]}
                      </p>
                      <p className="text-[10px] font-black text-amber-400">
                        {formatPrice(revenueByAffiliate[1].total_revenue_cents)}
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* 1st Place */}
                {revenueByAffiliate[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col items-center gap-2 flex-1 max-w-[140px]"
                  >
                    <div className="w-full bg-gradient-to-b from-amber-500/30 to-amber-600/20 rounded-t-xl border border-amber-500/50 p-4 flex flex-col items-center gap-2 relative" style={{ height: '100%' }}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Crown className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-amber-500/50 mt-2">
                        1
                      </div>
                      <p className="text-sm font-black text-white text-center truncate w-full">
                        {revenueByAffiliate[0].full_name || revenueByAffiliate[0].email.split('@')[0]}
                      </p>
                      <p className="text-xs font-black text-amber-400">
                        {formatPrice(revenueByAffiliate[0].total_revenue_cents)}
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* 3rd Place */}
                {revenueByAffiliate[2] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
                  >
                    <div className="w-full bg-gradient-to-b from-amber-600/20 to-amber-700/10 rounded-t-xl border border-amber-600/30 p-4 flex flex-col items-center gap-2" style={{ height: '40%' }}>
                      <div className="w-12 h-12 rounded-full bg-amber-600/30 flex items-center justify-center text-amber-400 font-black text-lg border border-amber-500/50">
                        3
                      </div>
                      <p className="text-xs font-black text-white text-center truncate w-full">
                        {revenueByAffiliate[2].full_name || revenueByAffiliate[2].email.split('@')[0]}
                      </p>
                      <p className="text-[10px] font-black text-amber-400">
                        {formatPrice(revenueByAffiliate[2].total_revenue_cents)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* Rest of Top 5 */}
              {revenueByAffiliate.length > 3 && (
                <div className="space-y-2 pt-4 border-t border-white/5">
                  {revenueByAffiliate.slice(3, 5).map((aff, index) => (
                    <motion.div
                      key={aff.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-black text-xs">
                          {index + 4}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">
                            {aff.full_name || aff.email.split('@')[0]}
                          </p>
                          <p className="text-xs text-slate-500">{aff.email}</p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-amber-400">
                        {formatPrice(aff.total_revenue_cents)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              <p>{t.dashboard.admin.affiliates.noData}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Revenue by Affiliate Table */}
      {revenueByAffiliate.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl"
        >
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            {t.dashboard.admin.affiliates.revenuePerAffiliate}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{t.dashboard.admin.affiliates.affiliate}</th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Receita Total</th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{t.dashboard.admin.affiliates.commission}</th>
                  <th className="text-center py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{t.dashboard.admin.affiliates.activeMonths}</th>
                  <th className="text-center py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{t.dashboard.admin.affiliates.lastMonth}</th>
                </tr>
              </thead>
              <tbody>
                {revenueByAffiliate.map((aff) => (
                  <tr key={aff.user_id} className="border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-black text-white">{aff.full_name || aff.email}</p>
                        <p className="text-xs text-slate-500">{aff.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-black text-amber-400">{formatPrice(aff.total_revenue_cents)}</p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-black text-blue-400">{formatPrice(aff.total_commission_cents)}</p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <p className="font-black text-white">{aff.months_active}</p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <p className="text-xs text-slate-400">{aff.last_month || 'N/A'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl hover:border-white/10 transition-all">
        <div className="flex items-center gap-2 sm:gap-3">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={t.dashboard.admin.affiliates.searchPlaceholder || "Search by email, name or code..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 outline-none focus:text-white transition-colors min-h-[44px]"
          />
        </div>
      </div>

      {/* Affiliates List */}
      <div className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-xl border border-white/5 rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-white/10">
          <h2 className="text-base sm:text-xl font-black text-white">Afiliados ({filteredAffiliates.length})</h2>
        </div>
        <div className="divide-y divide-white/5">
          {filteredAffiliates.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">{t.dashboard.admin.affiliates.noAffiliatesFound}</p>
            </div>
          ) : (
            filteredAffiliates.map((aff) => (
              <motion.div
                key={aff.user_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 sm:p-6 hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-black text-white truncate max-w-full">{aff.full_name || aff.email}</h3>
                      {aff.is_affiliate && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] sm:text-xs font-black uppercase shrink-0">
                          Afiliado
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mb-3 truncate">{aff.email}</p>
                    {aff.affiliate_code && (
                      <div className="flex flex-col gap-2 sm:gap-2 mb-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs sm:text-sm font-mono text-amber-400 bg-slate-900/50 px-2 py-1 rounded border border-amber-500/20 break-all sm:break-normal shrink-0">
                            {aff.affiliate_code}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!aff.affiliate_code) return;
                              navigator.clipboard.writeText(aff.affiliate_code);
                              setToast({
                                isVisible: true,
                                message: t.dashboard.admin.affiliates.codeCopied,
                                type: 'success'
                              });
                            }}
                            className="p-1.5 sm:p-1 hover:bg-white/10 rounded transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title={t.dashboard.admin.affiliates.copyCode || "Copy code"}
                          >
                            <Copy className="w-4 h-4 text-slate-400 hover:text-amber-400 transition-colors" />
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full">
                          <code className="text-[10px] sm:text-xs font-mono text-blue-400 bg-slate-900/50 px-2 py-1.5 sm:py-1 rounded border border-blue-500/20 break-all w-full min-w-0">
                            {typeof window !== 'undefined' && aff.affiliate_code
                              ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.finlybot.com'}/auth/register?ref=${encodeURIComponent(aff.affiliate_code)}`
                              : ''}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!aff.affiliate_code) return;
                              const baseUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.finlybot.com') : 'https://app.finlybot.com';
                              const fullLink = `${baseUrl}/auth/register?ref=${encodeURIComponent(aff.affiliate_code)}`;
                              navigator.clipboard.writeText(fullLink);
                              setToast({
                                isVisible: true,
                                message: t.dashboard.admin.affiliates.linkCopied,
                                type: 'success'
                              });
                            }}
                            className="p-1.5 sm:p-1 hover:bg-white/10 rounded transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center self-start sm:self-auto"
                            title={t.dashboard.admin.affiliates.copyFullLinkTitle}
                          >
                            <Copy className="w-4 h-4 text-blue-400 hover:text-blue-300 transition-colors" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                      <div>
                        <p className="text-slate-500 text-[10px] sm:text-xs">{t.dashboard.admin.affiliates.referralsLabel}</p>
                        <p className="font-black text-white">{aff.total_referrals}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] sm:text-xs">{t.dashboard.admin.affiliates.conversionsLabel}</p>
                        <p className="font-black text-green-400">{aff.total_conversions}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] sm:text-xs">{t.dashboard.admin.affiliates.earningsLabel}</p>
                        <p className="font-black text-amber-400 truncate">{formatPrice(aff.total_earnings_cents)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] sm:text-xs">{t.dashboard.admin.affiliates.sinceLabel}</p>
                        <p className="font-black text-slate-400 text-[10px] sm:text-xs">
                          {new Date(aff.created_at).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center sm:ml-0 shrink-0">
                    {aff.is_affiliate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); fetchAffiliateDetail(aff.user_id); }}
                        className="px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-amber-600/20 min-h-[44px]"
                      >
                        <Eye className="w-4 h-4 shrink-0" />
                        Ver Detalhes
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Promote Modal */}
      <AnimatePresence>
        {showPromoteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPromoteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-slate-700 rounded-[32px] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-amber-400" />
                  Promover Utilizador a Afiliado
                </h2>
                <button
                  onClick={() => setShowPromoteModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer hover:scale-110 active:scale-95"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-3">
                  <Search className="w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por email ou nome..."
                    value={searchUserTerm}
                    onChange={(e) => setSearchUserTerm(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  </div>
                ) : usersToPromote.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>{t.dashboard.admin.affiliates.noUsersFound}</p>
                  </div>
                ) : (
                  usersToPromote.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900/70 transition-colors"
                    >
                      <div>
                        <p className="font-black text-white">{u.full_name || u.email}</p>
                        <p className="text-sm text-slate-400">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handlePromoteClick(u.user_id)}
                        disabled={promoting === u.user_id}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-amber-600/20"
                      >
                        {promoting === u.user_id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            A processar...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Promover
                          </>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && detailData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-slate-700 rounded-[32px] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white">Detalhes do Afiliado</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer hover:scale-110 active:scale-95"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info */}
                  <div className="bg-slate-900/50 rounded-2xl p-6">
                    <h3 className="text-lg font-black text-white mb-4">Informações</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Email</p>
                        <p className="font-black text-white">{detailData.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Código</p>
                        <p className="font-black text-amber-400">{detailData.affiliate_code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Referências</p>
                        <p className="font-black text-white">{detailData.total_referrals}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Conversões</p>
                        <p className="font-black text-green-400">{detailData.total_conversions}</p>
                      </div>
                    </div>
                  </div>

                  {/* Referrals */}
                  {detailData.referrals && detailData.referrals.length > 0 && (() => {
                    const totalReferrals = detailData.referrals.length;
                    const paidCount = detailData.referrals.filter((r: any) => r.has_subscribed).length;
                    const startIndex = 0;
                    const endIndex = referralsPage * referralsPerPage;
                    const displayedReferrals = detailData.referrals.slice(startIndex, endIndex);
                    const hasMore = endIndex < totalReferrals;
                    
                    return (
                      <div className="bg-slate-900/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-black text-white">{t.dashboard.admin.affiliates.whoPaidWithLink}</h3>
                          <span className="text-xs text-slate-500">
                            {t.dashboard.admin.affiliates.paidFromReferrals.replace('{paid}', paidCount.toString()).replace('{total}', totalReferrals.toString())}
                          </span>
                        </div>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {displayedReferrals.map((ref: any) => (
                          <div
                            key={ref.id}
                            className={`p-4 rounded-xl border transition-all ${
                              ref.has_subscribed 
                                ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/20' 
                                : 'bg-slate-800/50 border-slate-700/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="font-black text-white">{ref.referred_user_full_name || ref.referred_user_email}</p>
                                  {ref.has_subscribed ? (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-black uppercase">
                                      Pago
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full text-[10px] font-black uppercase">
                                      Pendente
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mb-2">{ref.referred_user_email}</p>
                                <div className="flex items-center gap-4 text-xs">
                                  <div>
                                    <p className="text-slate-500">{t.dashboard.admin.affiliates.registered}</p>
                                    <p className="text-slate-300 font-medium">
                                      {new Date(ref.created_at).toLocaleDateString('pt-PT', { 
                                        day: 'numeric', 
                                        month: 'short', 
                                        year: 'numeric' 
                                      })}
                                    </p>
                                  </div>
                                  {ref.subscription_date && (
                                    <div>
                                      <p className="text-slate-500">{t.dashboard.admin.affiliates.paidOn}</p>
                                      <p className="text-green-400 font-black">
                                        {new Date(ref.subscription_date).toLocaleDateString('pt-PT', { 
                                          day: 'numeric', 
                                          month: 'short', 
                                          year: 'numeric' 
                                        })}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {ref.has_subscribed && (
                                <div className="text-right min-w-[140px]">
                                  {ref.payment_info ? (
                                    <>
                                      <p className="text-lg font-black text-amber-400 mb-1">
                                        {formatPrice(ref.payment_info.amount_paid_cents)}
                                      </p>
                                      {ref.payment_info.plan_name && (
                                        <p className="text-xs text-slate-400 mb-1">
                                          {ref.payment_info.plan_name}
                                        </p>
                                      )}
                                      {ref.payment_info.plan_interval && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                          {ref.payment_info.plan_interval === 'month' ? 'Mensal' : 'Anual'}
                                        </p>
                                      )}
                                      {ref.payment_info.paid_at && (
                                        <p className="text-[10px] text-slate-500 mt-1">
                                          {new Date(ref.payment_info.paid_at).toLocaleDateString('pt-PT', { 
                                            day: 'numeric', 
                                            month: 'short' 
                                          })}
                                        </p>
                                      )}
                                      <div className="mt-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                          ref.payment_info.subscription_status === 'active' 
                                            ? 'bg-green-500/20 text-green-400'
                                            : ref.payment_info.subscription_status === 'trialing'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-slate-700/50 text-slate-400'
                                        }`}>
                                          {ref.payment_info.subscription_status}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm font-black text-green-400 mb-1">
                                        {t.dashboard.admin.affiliates.paidLabel}
                                      </p>
                                      {ref.subscription_date && (
                                        <p className="text-xs text-slate-400">
                                          {new Date(ref.subscription_date).toLocaleDateString('pt-PT', { 
                                            day: 'numeric', 
                                            month: 'short',
                                            year: 'numeric'
                                          })}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                        {hasMore && (
                          <div className="mt-4 flex justify-center">
                            <button
                              onClick={() => setReferralsPage(prev => prev + 1)}
                              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-slate-700 hover:border-slate-600"
                            >
                              Carregar Mais ({totalReferrals - endIndex} restantes)
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {referralsPage > 1 && (
                          <div className="mt-2 text-center">
                            <button
                              onClick={() => setReferralsPage(1)}
                              className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
                            >
                              Mostrar menos
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Commissions */}
                  {detailData.commissions && detailData.commissions.length > 0 && (
                    <div className="bg-slate-900/50 rounded-2xl p-6">
                      <h3 className="text-lg font-black text-white mb-4">{t.dashboard.admin.affiliates.commissions || "Comissões"}</h3>
                      <div className="space-y-3">
                        {detailData.commissions.map((comm: any) => (
                          <div
                            key={comm.id}
                            className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl"
                          >
                            <div>
                              <p className="font-black text-white">{comm.month}</p>
                              <p className="text-sm text-slate-400">
                                {comm.conversions_count} {t.dashboard.admin.affiliates.conversions} • {formatPrice(comm.total_revenue_cents)} {t.dashboard.admin.affiliates.revenue}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-xl font-black text-amber-400">{formatPrice(comm.commission_amount_cents)}</p>
                              {comm.is_paid ? (
                                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-black uppercase">
                                  Pago
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-black uppercase">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showPromoteConfirm}
        onClose={() => {
          setShowPromoteConfirm(false);
          setPromoting(null);
        }}
        onConfirm={handlePromoteToAffiliate}
        title={t.dashboard.admin.affiliates.promoteTitle}
        message={t.dashboard.admin.affiliates.promoteConfirmMessage}
        confirmText={t.dashboard.admin.affiliates.promoteConfirm}
        cancelText={t.dashboard.admin.affiliates.cancel}
        variant="info"
      />

      <Toast {...toast} onClose={() => setToast({ ...toast, isVisible: false })} />
    </motion.div>
  );
}
