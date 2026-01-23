'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Zap, TrendingUp, AlertCircle, ChevronRight, 
  Target, ShieldCheck, Activity, Ghost, Lightbulb, Compass 
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import { DEMO_INSIGHTS } from '@/lib/mockData';
import { useRouter } from 'next/navigation';

const InsightIcon = ({ name, size = 20 }: { name: string, size?: number }) => {
  switch (name) {
    case 'sparkles': return <Sparkles size={size} />;
    case 'zap': return <Zap size={size} />;
    case 'trending-up': return <TrendingUp size={size} />;
    case 'alert-circle': return <AlertCircle size={size} />;
    case 'target': return <Target size={size} />;
    case 'shield-check': return <ShieldCheck size={size} />;
    case 'activity': return <Activity size={size} />;
    case 'ghost': return <Ghost size={size} />;
    case 'lightbulb': return <Lightbulb size={size} />;
    case 'compass': return <Compass size={size} />;
    default: return <Sparkles size={size} />;
  }
};

export default function ZenInsights() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        // Verificar cache primeiro (5 minutos)
        const cacheKey = `zen_insights_cache_${language}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const isFresh = Date.now() - timestamp < 300000; // 5 minutos
          if (isFresh) {
            setData(cachedData);
            setLoading(false);
            return;
          }
        }

        const [profileRes, insightsRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/insights/')
        ]);
        const user = profileRes.data;
        // Inclui 'cancel_at_period_end' para manter acesso até ao fim do período
        const hasActiveSub = ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status);
        if (!hasActiveSub) {
          const translatedDemo = t?.dashboard?.zenInsights?.demo;
          setData(translatedDemo?.insights ? translatedDemo : DEMO_INSIGHTS);
        } else {
          const insightsData = insightsRes.data;
          setData(insightsData);
          // Guardar no cache
          localStorage.setItem(cacheKey, JSON.stringify({
            data: insightsData,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('Erro ao procurar insights:', err);
        setData(DEMO_INSIGHTS);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-900/50 rounded-[32px] animate-pulse mb-8" />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 mb-12">
      {/* Top Banner - Blue Accent */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-600 rounded-[32px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-blue-600/20 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex items-center gap-8 relative z-10 flex-1">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-lg"
          >
            <Sparkles size={32} className="text-white animate-pulse" />
          </motion.div>
          <div className="flex-1">
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mb-3"
            >
              Zen Insight
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight"
            >
              "{data.summary}"
            </motion.h2>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="mt-8 md:mt-0 flex items-center gap-8 bg-white/10 backdrop-blur-md px-10 py-6 rounded-[24px] border border-white/10 relative z-10"
        >
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-white/10" />
              <motion.circle 
                cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="5" fill="transparent" 
                strokeDasharray={201}
                initial={{ strokeDashoffset: 201 }}
                animate={{ strokeDashoffset: 201 - (201 * (data.health_score || 0)) / 100 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="text-white"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-lg font-black text-white"
              >
                {data.health_score}%
              </motion.span>
            </div>
          </div>
          <div className="text-left">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/50 mb-1">
              {t.dashboard.zenInsights.financialPeace}
            </p>
            <p className="text-sm font-black uppercase tracking-widest text-white">
              {data.health_score > 80 ? t.dashboard.zenInsights.fullHarmony : t.dashboard.zenInsights.needsFocus}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Insights Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.insights?.slice(0, 3).map((insight: any, idx: number) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: idx * 0.15 + 0.6, type: "spring", stiffness: 100 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className={`p-10 rounded-[32px] bg-slate-900/40 border border-white/5 hover:bg-slate-900/60 transition-all group relative overflow-hidden backdrop-blur-sm ${
              insight.type === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 
              insight.type === 'danger' ? 'border-red-500/20 bg-red-500/5' : ''
            }`}
          >
            {(insight.type === 'warning' || insight.type === 'danger') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.15 + 0.8 }}
                className={`absolute top-0 right-0 w-40 h-40 ${insight.type === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10'} blur-[60px] -z-10 rounded-full`} 
              />
            )}
            
            <div className="flex items-start gap-4 mb-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.15 + 0.7, type: "spring" }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  insight.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                  insight.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                  insight.type === 'danger' ? 'bg-red-500/10 text-red-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}
              >
                <InsightIcon name={insight.icon} size={22} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-1 leading-tight">
                  {insight.title}
                </h4>
                {insight.type === 'danger' && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.15 + 0.9, type: "spring" }}
                    className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_12px_#ef4444] mt-2"
                  />
                )}
              </div>
            </div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.15 + 0.8 }}
              className="text-sm font-medium text-slate-300 italic mb-8 leading-relaxed min-h-[70px]"
            >
              "{insight.message}"
            </motion.p>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${
                insight.type === 'danger' ? 'text-red-400' : 
                insight.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {insight.type === 'danger'
                  ? t.dashboard.zenInsights.actionRequired
                  : insight.type === 'warning'
                    ? t.dashboard.zenInsights.attention
                    : t.dashboard.zenInsights.zenAnalytics}
              </span>
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="flex justify-center pt-6"
      >
        <motion.button 
          onClick={() => router.push('/analytics')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 cursor-pointer"
        >
          {t.dashboard.zenInsights.viewDetailedAnalysis}
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronRight size={14} />
          </motion.div>
        </motion.button>
      </motion.div>
    </div>
  );
}
