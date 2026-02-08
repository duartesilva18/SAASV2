'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, X, CreditCard, Clock, Target, Trophy, Sparkles, AlertCircle, Activity, Ghost, Lightbulb, Compass } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { useNotifications } from '@/lib/NotificationsContext';
import { motion, AnimatePresence } from 'framer-motion';

const IconComponent = ({ name, size = 20 }: { name: string; size?: number }) => {
  switch (name) {
    case 'sparkles': return <Sparkles size={size} />;
    case 'clock': return <Clock size={size} />;
    case 'alert-circle': return <AlertCircle size={size} />;
    case 'activity': return <Activity size={size} />;
    case 'ghost': return <Ghost size={size} />;
    case 'lightbulb': return <Lightbulb size={size} />;
    case 'compass': return <Compass size={size} />;
    case 'target': return <Target size={size} />;
    case 'credit-card': return <CreditCard size={size} />;
    case 'trophy': return <Trophy size={size} />;
    default: return <Bell size={size} />;
  }
};

export default function NotificationsPanel({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const {
    notifications,
    showNotifications,
    setShowNotifications,
    handleMarkAsRead,
    handleClearAll,
  } = useNotifications();

  if (!showNotifications) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -8 }}
        className={`w-full max-w-[320px] bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl z-[200] p-5 notification-card ${className}`}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">{t.dashboard.sidebar.notifications}</h4>
            {notifications.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-lg font-bold">
                {notifications.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                {t.dashboard.sidebar.clearAll}
              </button>
            )}
            <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
          {notifications.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-center mx-auto text-slate-500">
                <Bell size={22} />
              </div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider italic">{t.dashboard.sidebar.nothingToReport}</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const content = (
                <>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'danger' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                    notif.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                    notif.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/20'
                  }`}>
                    <IconComponent name={notif.icon} size={18} />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-center gap-2 mb-0.5">
                      <p
                        className={`text-[11px] font-black uppercase tracking-tight leading-tight truncate ${
                          notif.type === 'danger' ? 'text-red-400' :
                          notif.type === 'warning' ? 'text-amber-400' :
                          notif.type === 'success' ? 'text-emerald-400' :
                          'text-white'
                        }`}
                        title={notif.title}
                      >
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{notif.date}</span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notif.id); }}
                          className="opacity-0 group-hover/notif:opacity-100 p-1 hover:bg-slate-700/50 rounded-lg text-slate-500 hover:text-white transition-all cursor-pointer"
                          title={t.dashboard.sidebar.markAsRead}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                    <p
                      className="text-[11px] text-slate-400 leading-snug font-medium italic line-clamp-2 break-words"
                      title={notif.message}
                    >
                      "{notif.message}"
                    </p>
                  </div>
                </>
              );
              const wrapperClass = `flex gap-3 items-start p-4 rounded-xl border transition-colors group/notif min-h-[4.5rem] ${
                notif.section ? 'cursor-pointer hover:bg-slate-800/50' : ''
              } ${
                notif.type === 'danger' ? 'bg-red-500/10 border-red-500/20' :
                notif.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                notif.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' :
                'bg-slate-800/50 border-slate-700/60'
              }`;
              return notif.section ? (
                <Link
                  key={notif.id}
                  href={notif.section}
                  onClick={() => setShowNotifications(false)}
                  className={wrapperClass}
                >
                  {content}
                </Link>
              ) : (
                <div key={notif.id} className={wrapperClass}>
                  {content}
                </div>
              );
            })
          )}
          {notifications.length > 0 && (
            <p className="text-[9px] text-slate-500 text-center py-3 font-bold uppercase tracking-wider italic">
              {t.dashboard.sidebar.zenCommandCenter}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
