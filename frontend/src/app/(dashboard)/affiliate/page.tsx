'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { 
  Link2, Copy, Check, Users, TrendingUp, DollarSign, 
  Calendar, Award, ExternalLink, Share2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import Toast from '@/components/Toast';

interface AffiliateData {
  id: string;
  code: string;
  commission_percentage: number;
  total_referrals: number;
  total_conversions: number;
  total_earnings_cents: number;
  total_paid_cents: number;
}

interface AffiliateStats {
  total_referrals: number;
  total_conversions: number;
  conversion_rate: number;
  total_earnings_cents: number;
  total_paid_cents: number;
  pending_earnings_cents: number;
  monthly_stats: Array<{
    month: number;
    year: number;
    referrals: number;
    conversions: number;
    earnings_cents: number;
  }>;
}

interface Referral {
  id: string;
  referred_user_email: string;
  referred_user_name: string;
  has_converted: boolean;
  conversion_date: string | null;
  conversion_amount_cents: number | null;
  created_at: string;
}

export default function AffiliatePage() {
  const { t, formatCurrency } = useTranslation();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [affiliateLink, setAffiliateLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [affiliateRes, statsRes, referralsRes, linkRes] = await Promise.all([
        api.get('/affiliates/me'),
        api.get('/affiliates/me/stats'),
        api.get('/affiliates/me/referrals'),
        api.get('/affiliates/me/link')
      ]);

      setAffiliate(affiliateRes.data);
      setStats(statsRes.data);
      setReferrals(referralsRes.data);
      setAffiliateLink(linkRes.data.link);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setToast({
          show: true,
          message: 'Não és afiliado. Contacta o administrador.',
          type: 'error'
        });
      } else {
        setToast({
          show: true,
          message: 'Erro ao carregar dados de afiliado',
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setToast({
        show: true,
        message: 'Link copiado para a área de transferência!',
        type: 'success'
      });
    } catch (err) {
      setToast({
        show: true,
        message: 'Erro ao copiar link',
        type: 'error'
      });
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Junta-te ao Finly!',
          text: 'Experimenta o Finly, a melhor ferramenta de gestão financeira pessoal!',
          url: affiliateLink
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Não és afiliado. Contacta o administrador.</p>
      </div>
    );
  }

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-white pb-20"
    >
      <div className="mb-12">
        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Programa de Afiliados</h1>
        <p className="text-slate-400">Ganha comissões ao partilhares o Finly</p>
      </div>

      {/* Link de Afiliado */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <Link2 size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">O Teu Link de Afiliado</h2>
            <p className="text-sm text-slate-400">Partilha este link e ganha comissões</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <Link2 size={20} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={affiliateLink}
              readOnly
              className="flex-1 bg-transparent text-white text-sm font-mono outline-none"
            />
          </div>
          <button
            onClick={copyToClipboard}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={16} />
                Copiado!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copiar
              </>
            )}
          </button>
          <button
            onClick={shareLink}
            className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 size={16} />
            Partilhar
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-sm text-blue-300">
            <strong>Como funciona:</strong> Quando alguém se regista através do teu link e paga Pro, recebes {affiliate.commission_percentage}% de comissão.
          </p>
        </div>
      </div>

      {/* Estatísticas Principais */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Referências</p>
                <p className="text-2xl font-black text-white">{stats.total_referrals}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Conversões</p>
                <p className="text-2xl font-black text-white">{stats.total_conversions}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Taxa: {stats.conversion_rate}%</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <DollarSign size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Total Ganho</p>
                <p className="text-2xl font-black text-white">{formatCurrency(stats.total_earnings_cents / 100)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Award size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Pendente</p>
                <p className="text-2xl font-black text-white">{formatCurrency(stats.pending_earnings_cents / 100)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Utilizadores Referidos */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-8">
        <h2 className="text-2xl font-black text-white mb-6">Utilizadores Referidos</h2>
        
        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Ainda não tens referências</p>
          </div>
        ) : (
          <div className="space-y-4">
            {referrals.map((ref) => (
              <div
                key={ref.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    ref.has_converted ? 'bg-emerald-500/20' : 'bg-slate-800'
                  }`}>
                    {ref.has_converted ? (
                      <Check size={24} className="text-emerald-400" />
                    ) : (
                      <Users size={24} className="text-slate-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-white">
                      {ref.referred_user_name || ref.referred_user_email}
                    </p>
                    <p className="text-sm text-slate-400">
                      {new Date(ref.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {ref.has_converted ? (
                    <>
                      <p className="text-emerald-400 font-black">
                        {formatCurrency((ref.conversion_amount_cents || 0) / 100)}
                      </p>
                      <p className="text-xs text-slate-500">Convertido</p>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">Aguardando conversão</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estatísticas Mensais */}
      {stats && stats.monthly_stats.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <h2 className="text-2xl font-black text-white mb-6">Histórico Mensal</h2>
          <div className="space-y-4">
            {stats.monthly_stats.map((month, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar size={20} className="text-slate-500" />
                    <p className="font-black text-white">
                      {monthNames[month.month - 1]} {month.year}
                    </p>
                  </div>
                  <p className="text-lg font-black text-emerald-400">
                    {formatCurrency(month.earnings_cents / 100)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Referências</p>
                    <p className="font-black text-white">{month.referrals}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Conversões</p>
                    <p className="font-black text-white">{month.conversions}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Taxa</p>
                    <p className="font-black text-white">
                      {month.referrals > 0 
                        ? ((month.conversions / month.referrals) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
        type={toast.type}
        isVisible={toast.show}
      />
    </motion.div>
  );
}

