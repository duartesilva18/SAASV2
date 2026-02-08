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
  const guide = t.dashboard.guide;

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
    <div className="space-y-12 sm:space-y-16 md:space-y-20 pb-12 sm:pb-16 md:pb-20 px-3 sm:px-4 md:px-8 pt-6 sm:pt-8 md:pt-10">
      {/* Header Section */}
      <section className="text-center space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-4 py-1.5 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider"
        >
          <HelpCircle size={14} /> {(guide.title || 'Guia do ')}{guide.titleAccent || 'Mestre'}
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-tight uppercase px-1"
        >
          {guide.title}<span className="text-blue-500 italic">{guide.titleAccent || 'Mestre'}</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 text-base sm:text-lg md:text-xl font-medium max-w-2xl mx-auto px-1"
        >
          {guide.subtitle}
        </motion.p>
      </section>

      {/* Telegram Special Section */}
      <section className="relative">
        <div className="relative bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16 shadow-2xl flex flex-col xl:flex-row items-center gap-8 sm:gap-10 md:gap-12 xl:gap-16 overflow-hidden">
          <div className="flex-1 space-y-6 sm:space-y-8 md:space-y-10 w-full xl:w-auto order-1">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-blue-500/10 border border-blue-500/20 px-3 sm:px-5 py-2 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Send size={14} className="sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{guide.telegramBot}</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white uppercase tracking-tighter leading-tight">
              {guide.registerInTelegram} <span className="text-blue-500 italic">{guide.registerInTelegramAccent}</span> {guide.registerInTelegramSeconds}
            </h2>
            
            <p className="text-slate-400 text-sm sm:text-base md:text-lg lg:text-xl font-medium leading-relaxed max-w-xl">
              {guide.multipleWays}
            </p>

            {/* Formas de Escrever */}
            <div className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
              <div className="bg-slate-950/60 rounded-2xl p-4 sm:p-5 md:p-6 border border-slate-700/60">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider text-slate-300 mb-3 sm:mb-4">{guide.waysToWrite}</h3>
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

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-3 sm:pt-4">
              <a 
                href="https://t.me/FinanZenApp_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20 cursor-pointer w-full sm:w-auto"
              >
                <Send size={14} /> <span className="truncate">{guide.openTelegramBot}</span>
              </a>
              <Link href="/dashboard" className="block w-full sm:w-auto">
                <button type="button" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer">
                  {guide.goToDashboard}
                </button>
              </Link>
            </div>
          </div>

          {/* Telegram Chat Simulation */}
          <div className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[420px] xl:max-w-[450px] xl:w-[450px] shrink-0 order-2 mx-auto">
            <div className="bg-[#212121] rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden aspect-[9/16] max-h-[55vh] sm:max-h-[420px] md:aspect-auto md:max-h-none md:h-[600px] flex flex-col">
              {/* Telegram Header */}
              <div className="bg-[#2b2b2b] p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                  <Send size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-white font-bold text-xs sm:text-sm truncate">{guide.finlyBot}</h4>
                  <p className="text-blue-400 text-[10px] font-medium tracking-wider uppercase truncate">{guide.onlineAlwaysReady}</p>
                </div>
              </div>

              {/* Chat Content */}
              <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto no-scrollbar bg-gradient-to-b from-[#0e1621] to-[#1a2332] min-h-0">
                {(guide.sections?.[0]?.howTo ?? []).map((msg: { user: string; bot: string }, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.5 }}
                      className="flex justify-end"
                    >
                      <div className="bg-blue-600 text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tr-none max-w-[85%] sm:max-w-[80%] text-xs sm:text-sm shadow-md">
                        {msg.user}
                      </div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.5 + 0.3 }}
                      className="flex justify-start"
                    >
                      <div className="bg-[#2b2b2b] text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none max-w-[85%] sm:max-w-[80%] text-xs sm:text-sm shadow-md border border-white/5 whitespace-pre-line">
                        {msg.bot}
                        {idx === 0 && (
                          <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
                            <button className="flex-1 min-h-[36px] bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-colors cursor-pointer">
                              {guide.confirm}
                            </button>
                            <button className="flex-1 min-h-[36px] bg-red-600 hover:bg-red-500 text-white px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-colors cursor-pointer">
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
              <div className="p-3 sm:p-4 bg-[#2b2b2b] flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="flex-1 min-w-0 bg-[#1e1e1e] rounded-full h-9 sm:h-10 flex items-center px-3 sm:px-4 text-slate-400 text-[10px] sm:text-xs truncate">
                  {guide.writeExample}
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                  <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary Sections */}
      <div className="space-y-8 sm:space-y-12">
        <h3 className="text-xs font-bold uppercase tracking-wider text-center text-slate-500 px-2">{guide.otherFeatures}</h3>
        
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8"
        >
          {guide.sections.slice(1).map((section: any, idx: number) => {
            const route = sectionRoutes[idx + 1];
            const isExternal = route.startsWith('http');
            
            const content = (
              <motion.div 
                variants={itemAnim}
                className="group h-full bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 sm:p-6 md:p-8 hover:border-blue-500/30 transition-all shadow-2xl cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-500 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500 shrink-0">
                  {icons[idx + 1]}
                </div>
                
                <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter mb-3 sm:mb-4">
                  {section.title}
                </h4>
                
                <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mb-4 sm:mb-6">
                  {section.description}
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {section.features.map((feature: string, fidx: number) => (
                    <div key={fidx} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500/60 group-hover:text-blue-500 transition-colors">
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
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-6 sm:p-8 md:p-10 lg:p-16 flex flex-col md:flex-row items-center gap-6 sm:gap-8 md:gap-12 text-center md:text-left shadow-2xl"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
            <ShieldCheck size={32} className="sm:w-10 sm:h-10" />
          </div>
          
          <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">
              {guide.privacyFirst} <span className="text-blue-500 italic">{guide.privacyFirstAccent}</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base md:text-lg font-medium leading-relaxed max-w-2xl mx-auto md:mx-0">
              {guide.privacyDescription}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={handleSupportClick}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              {guide.contactSupport}
            </button>
            <Link href="/settings" className="w-full sm:w-auto block">
              <button type="button" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-slate-600 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer">
                {guide.configureProfile}
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Final Footer */}
      <footer className="text-center pt-8 sm:pt-10 border-t border-slate-700/60">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider px-2">
          {guide.footer}
        </p>
      </footer>
    </div>
  );
}
