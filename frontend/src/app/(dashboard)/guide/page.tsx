'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import Link from 'next/link';
import { 
  Sparkles, Clock, PieChart, Zap, 
  CheckCircle2, ArrowRight, ShieldCheck, 
  MessageSquare, LayoutDashboard, TrendingUp,
  Wallet, HelpCircle, Phone, Send, User
} from 'lucide-react';

export default function GuidePage() {
  const { t } = useTranslation();
  const guide = t.dashboard.guide as any;

  const sectionRoutes = [
    'https://t.me/FinanZenApp_bot', // Telegram bot
    '/dashboard', // Telegram (mostra dashboard)
    '/dashboard',
    '/recurring',
    '/analytics'
  ];

  const icons = [
    <Send size={24} />,
    <MessageSquare size={24} />,
    <LayoutDashboard size={24} />,
    <Clock size={24} />,
    <TrendingUp size={24} />
  ];

  const handleSupportClick = () => {
    const phone = "925989577"; // Número de suporte definido anteriormente
    const message = encodeURIComponent(t.dashboard.support.message);
    window.open(`https://wa.me/351${phone}?text=${message}`, '_blank');
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } }
  };

  return (
    <div className="space-y-20 pb-20 px-4 md:px-8 pt-10">
      {/* Header Section */}
      <section className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest"
        >
          <HelpCircle size={14} /> {(guide.title || 'Guia do ')}{guide.titleAccent || 'Mestre'}
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-8xl font-black tracking-tighter text-white leading-tight uppercase"
        >
          {guide.title}<span className="text-blue-500 italic">{guide.titleAccent || 'Mestre'}</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto"
        >
          {guide.subtitle}
        </motion.p>
      </section>

      {/* Telegram Special Section */}
      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[60px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-950 rounded-[32px] p-8 md:p-16 border border-white/5 flex flex-col xl:flex-row items-center gap-16 overflow-hidden">
          
          <div className="flex-1 space-y-10 relative z-10">
            <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-5 py-2 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest">
              <Send size={16} /> {guide.telegramBot}
            </div>
            
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">
              {guide.registerInTelegram} <span className="text-blue-500 italic">{guide.registerInTelegramAccent}</span> {guide.registerInTelegramSeconds}
            </h2>
            
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed max-w-xl">
              {guide.multipleWays}
            </p>

            {/* Formas de Escrever */}
            <div className="space-y-4 pt-4">
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
                <h3 className="text-white font-black text-sm uppercase tracking-wider mb-4">{guide.waysToWrite}</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <div>
                      <p className="text-white font-bold text-xs mb-1">{guide.simpleFormat}</p>
                      <p className="text-slate-400 text-xs font-mono">{guide.simpleFormatExample}</p>
                      <p className="text-slate-500 text-[10px] mt-1">{guide.aiCategorizes}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <div>
                      <p className="text-white font-bold text-xs mb-1">{guide.withCategory}</p>
                      <p className="text-slate-400 text-xs font-mono">{guide.withCategoryExample}</p>
                      <p className="text-slate-500 text-[10px] mt-1">{guide.specifyCategory}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <div>
                      <p className="text-white font-bold text-xs mb-1">{guide.keywords}</p>
                      <p className="text-slate-400 text-xs font-mono">{guide.keywordsExample}</p>
                      <p className="text-slate-500 text-[10px] mt-1">{guide.recognizesUber}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <div>
                      <p className="text-white font-bold text-xs mb-1">{guide.income}</p>
                      <p className="text-slate-400 text-xs font-mono">{guide.incomeExample}</p>
                      <p className="text-slate-500 text-[10px] mt-1">{guide.recognizesIncome}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <a 
                href="https://t.me/FinanZenApp_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Send size={14} /> {guide.openTelegramBot}
              </a>
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 cursor-pointer">
                  {guide.goToDashboard}
                </button>
              </Link>
            </div>
          </div>

          {/* Telegram Chat Simulation */}
          <div className="w-full xl:w-[450px] shrink-0">
            <div className="bg-[#212121] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden aspect-[9/16] md:aspect-auto md:h-[600px] flex flex-col">
              {/* Telegram Header */}
              <div className="bg-[#2b2b2b] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <Send size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">{guide.finlyBot}</h4>
                  <p className="text-blue-400 text-[10px] font-medium tracking-wider uppercase">{guide.onlineAlwaysReady}</p>
                </div>
              </div>

              {/* Chat Content */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar bg-gradient-to-b from-[#0e1621] to-[#1a2332]">
                {guide.sections[0].howTo.map((msg: any, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.5 }}
                      className="flex justify-end"
                    >
                      <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm shadow-md">
                        {msg.user}
                      </div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.5 + 0.3 }}
                      className="flex justify-start"
                    >
                      <div className="bg-[#2b2b2b] text-white p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm shadow-md border border-white/5 whitespace-pre-line">
                        {msg.bot}
                        {idx === 0 && (
                          <div className="mt-3 flex gap-2">
                            <button className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                              {guide.confirm}
                            </button>
                            <button className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                              {guide.cancel}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>

              {/* Fake Input */}
              <div className="p-4 bg-[#2b2b2b] flex items-center gap-3">
                <div className="flex-1 bg-[#1e1e1e] rounded-full h-10 flex items-center px-4 text-slate-400 text-xs">
                  {guide.writeExample}
                </div>
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                  <Send size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary Sections */}
      <div className="space-y-12">
        <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-center text-slate-600">{guide.otherFeatures}</h3>
        
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {guide.sections.slice(1).map((section: any, idx: number) => {
            const route = sectionRoutes[idx + 1];
            const isExternal = route.startsWith('http');
            
            const content = (
              <motion.div 
                variants={itemAnim}
                className="group h-full bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 hover:border-blue-500/30 transition-all shadow-xl cursor-pointer active:scale-[0.98]"
              >
                <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform duration-500">
                  {icons[idx + 1]}
                </div>
                
                <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-4">
                  {section.title}
                </h4>
                
                <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                  {section.description}
                </p>
                
                <div className="space-y-3 mb-8">
                  {section.features.map((feature: string, fidx: number) => (
                    <div key={fidx} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500/60 group-hover:text-blue-500 transition-colors">
                  <span>{guide.exploreFeature}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
            
            return isExternal ? (
              <a key={idx} href={route} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <Link key={idx} href={route}>
                {content}
              </Link>
            );
          })}
        </motion.div>
      </div>

      {/* Security Banner */}
      <section>
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-blue-600/20 to-indigo-700/20 rounded-[32px] border border-white/5 p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 text-center md:text-left shadow-2xl backdrop-blur-sm"
        >
          <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <ShieldCheck size={40} />
          </div>
          
          <div className="flex-1 space-y-4">
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">
              {guide.privacyFirst} <span className="text-blue-500 italic">{guide.privacyFirstAccent}</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-2xl">
              {guide.privacyDescription}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleSupportClick}
              className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/20 active:scale-95 cursor-pointer shrink-0"
            >
              {guide.contactSupport}
            </button>
            <Link href="/settings">
              <button className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 cursor-pointer shrink-0">
                {guide.configureProfile}
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Final Footer */}
      <footer className="text-center pt-10 border-t border-white/5">
        <p className="text-slate-600 text-sm font-black uppercase tracking-[0.4em]">
          {guide.footer}
        </p>
      </footer>
    </div>
  );
}
