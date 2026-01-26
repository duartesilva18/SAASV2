'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, TrendingUp, Wallet, Flame, ArrowRight, 
  Info, ShieldCheck, LineChart, PieChart, Sparkles,
  RefreshCw, Target, HelpCircle, ChevronRight,
  TrendingDown, Shield, Lightbulb, Rocket, Activity
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import PageLoading from '@/components/PageLoading';
import { 
  LineChart as ReLineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';

export default function FIREPage() {
  const { t, formatCurrency } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sim' | 'learn'>('sim');
  const [stats, setStats] = useState({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    netWorth: 0,
    savingRate: 0
  });

  const [simParams, setSimParams] = useState({
    expectedReturn: 7, 
    withdrawalRate: 4,  
    currentAge: 30,
    currentNetWorth: 0 // Novo parâmetro
  });

  const [fireData, setFireData] = useState<any[]>([]);
  const [fireResult, setFireResult] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, transRes, catRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/transactions/'),
          api.get('/categories/')
        ]);

        const categories = catRes.data;
        // Filtrar transações de seed (1 cêntimo) - não devem aparecer nem ser contabilizadas
        const transactions = transRes.data.filter((t: any) => Math.abs(t.amount_cents) !== 1);
        
        const now = new Date();
        const thisMonthTxs = transactions.filter((t: any) => {
          const d = new Date(t.transaction_date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const catMap = categories.reduce((acc: any, c: any) => ({ ...acc, [c.id]: c }), {});
        
        let income = 0;
        let expenses = 0;
        let totalVault = 0;

        // Calcular total real do cofre (Investimentos + Emergência)
        // IMPORTANTE: amount_cents positivo = depósito (aumenta), negativo = resgate (diminui)
        transactions.forEach((t: any) => {
          const cat = catMap[t.category_id];
          if (cat && cat.vault_type !== 'none') {
            if (t.amount_cents > 0) {
              // Depósito: adicionar valor
              totalVault += t.amount_cents / 100;
            } else {
              // Resgate: subtrair valor absoluto
              totalVault -= Math.abs(t.amount_cents / 100);
            }
          }
        });

        thisMonthTxs.forEach((t: any) => {
          const cat = catMap[t.category_id];
          if (cat) {
            // Backend garante sinais corretos:
            // income: amount_cents > 0
            // expense: amount_cents < 0
            // Frontend confia nos sinais (sem Math.abs())
            if (cat.type === 'income' && cat.vault_type === 'none') {
              income += t.amount_cents / 100; // Já é positivo
            } else if (cat.type === 'expense' && cat.vault_type === 'none') {
              expenses += -t.amount_cents / 100; // Converte negativo para positivo
            }
          }
        });

        // Calcular saving rate com clamp e threshold
        const MIN_INCOME_THRESHOLD = 100; // 1€ mínimo para calcular saving rate
        let savingRate = 0;
        if (income >= MIN_INCOME_THRESHOLD) {
          const calculated = ((income - expenses) / income) * 100;
          savingRate = Math.max(-100, Math.min(100, calculated)); // Clamp entre -100% e 100%
        }
        // Se income < threshold, savingRate = 0 (não representativo)

        // Net Worth = Vault + Cash disponível
        // Cash disponível = opening balance + income - expenses
        // NOTA: Por enquanto, opening_balance não está disponível no frontend
        // Quando implementado: availableCash = openingBalance + income - expenses
        const availableCash = Math.max(0, income - expenses); // Cash disponível este mês (temporário)
        const netWorth = totalVault + availableCash;
        
        // TODO: Implementar opening_balance quando disponível
        // const openingBalance = workspace.opening_balance_cents / 100 || 0;
        // const availableCash = Math.max(0, openingBalance + income - expenses);

        setStats({
          monthlyIncome: income,
          monthlyExpenses: expenses,
          netWorth: netWorth, // Vault + Cash disponível
          savingRate: savingRate
        });

        // Inicializar o património atual com vault + cash disponível
        setSimParams(prev => ({ ...prev, currentNetWorth: netWorth }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (stats.monthlyIncome === 0 && simParams.currentNetWorth === 0) return;

    const monthlySaving = stats.monthlyIncome - stats.monthlyExpenses;
    const annualExpenses = stats.monthlyExpenses * 12;
    const fireTarget = annualExpenses / (simParams.withdrawalRate / 100);
    
    let currentWealth = simParams.currentNetWorth;
    const data = [];
    let years = 0;
    const maxYears = 60;
    const currentYear = new Date().getFullYear();

    while (currentWealth < fireTarget && years < maxYears) {
      data.push({
        year: years + simParams.currentAge,
        calendarYear: currentYear + years,
        wealth: Math.round(currentWealth),
        target: Math.round(fireTarget)
      });
      
      currentWealth = (currentWealth * (1 + simParams.expectedReturn / 100)) + (monthlySaving * 12);
      years++;
    }

    data.push({
      year: years + simParams.currentAge,
      calendarYear: currentYear + years,
      wealth: Math.round(currentWealth),
      target: Math.round(fireTarget)
    });

    const fireAge = years + simParams.currentAge;
    const yearsSaved = Math.max(0, 65 - fireAge);

    setFireData(data);
    setFireResult({
      yearsToFire: years,
      fireAge: fireAge,
      yearsSaved: yearsSaved,
      target: fireTarget,
      monthlyFireIncome: (fireTarget * (simParams.withdrawalRate / 100)) / 12
    });
  }, [stats, simParams]);

  if (loading) {
    return <PageLoading message={t.dashboard.fire.processing} />;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20 px-4 md:px-8">
      {/* Header Futurista */}
      <section className="relative overflow-hidden p-12 md:p-20 bg-slate-900/40 rounded-[64px] border border-white/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 blur-[120px] rounded-full -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-500/5 blur-[100px] rounded-full -ml-24 -mb-24" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-12">
          <div className="space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-orange-400 text-[10px] font-black uppercase tracking-widest">
              <Flame size={14} className="animate-pulse" /> {t.dashboard.fire.badge}
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase leading-[0.8]">
              {t.dashboard.fire.title} <br /><span className="text-orange-500 italic">{t.dashboard.fire.titleAccent}</span>
            </h1>
            <p className="text-slate-400 font-medium text-xl leading-relaxed">
              {t.dashboard.fire.description}
            </p>
          </div>

          <div className="flex bg-slate-950/50 p-1.5 rounded-[24px] border border-white/5">
            <button 
              onClick={() => setActiveTab('sim')}
              className={`px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'sim' ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
            >
              {t.dashboard.fire.simulator}
            </button>
            <button 
              onClick={() => setActiveTab('learn')}
              className={`px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'learn' ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
            >
              {t.dashboard.fire.learn}
            </button>
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {activeTab === 'sim' ? (
          <motion.div 
            key="sim" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Controlos e Dados Reais */}
            <div className="space-y-8">
              {/* Card de Dados Reais - Agora mais visual */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-10 rounded-[32px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={64} className="text-orange-500" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8 flex items-center gap-2">
                  <Rocket size={14} className="text-orange-500" /> {t.dashboard.fire.yourCurrentEngine}
                </h3>
                
                <div className="space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-600 mb-1">{t.dashboard.fire.monthlyFlow}</p>
                      <p className="text-3xl font-black text-white tracking-tighter">
                        {formatCurrency(stats.monthlyIncome - stats.monthlyExpenses)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-600 mb-1">{t.dashboard.fire.savingRate}</p>
                      <p className="text-3xl font-black text-orange-500 tracking-tighter">{Math.round(stats.savingRate)}%</p>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${Math.max(0, stats.savingRate)}%` }}
                      className="h-full bg-gradient-to-r from-orange-600 to-red-500"
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium italic">
                    💡 <span className="text-slate-300">{t.dashboard.fire.tip}</span> {t.dashboard.fire.tipText}
                  </p>
                </div>
              </div>

              {/* Ajustes Finos */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-10 rounded-[32px] space-y-10">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{t.dashboard.fire.marketParams}</h3>
                
                <div className="space-y-10">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 group cursor-help">
                        <label className="text-[10px] font-black uppercase text-slate-400">{t.dashboard.fire.marketReturn}</label>
                        <Info size={12} className="text-slate-600 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <span className="text-sm font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">{simParams.expectedReturn}%</span>
                    </div>
                    <input 
                      type="range" min="1" max="15" step="0.5"
                      value={simParams.expectedReturn}
                      onChange={(e) => setSimParams({...simParams, expectedReturn: Number(e.target.value)})}
                      className="w-full accent-orange-500 cursor-pointer h-1.5 bg-white/5 rounded-full appearance-none"
                    />
                    <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{t.dashboard.fire.marketReturnNote}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 group cursor-help">
                        <label className="text-[10px] font-black uppercase text-slate-400">{t.dashboard.fire.withdrawalRate}</label>
                        <Info size={12} className="text-slate-600 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <span className="text-sm font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">{simParams.withdrawalRate}%</span>
                    </div>
                    <input 
                      type="range" min="2" max="6" step="0.1"
                      value={simParams.withdrawalRate}
                      onChange={(e) => setSimParams({...simParams, withdrawalRate: Number(e.target.value)})}
                      className="w-full accent-orange-500 cursor-pointer h-1.5 bg-white/5 rounded-full appearance-none"
                    />
                    <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{t.dashboard.fire.withdrawalRateNote}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-slate-400">{t.dashboard.fire.accumulatedWealth}</label>
                      <span className="text-sm font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">{formatCurrency(simParams.currentNetWorth)}</span>
                    </div>
                    <input 
                      type="range" min="0" max="500000" step="500"
                      value={simParams.currentNetWorth}
                      onChange={(e) => setSimParams({...simParams, currentNetWorth: Number(e.target.value)})}
                      className="w-full accent-orange-500 cursor-pointer h-1.5 bg-white/5 rounded-full appearance-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-slate-400">{t.dashboard.fire.yourCurrentAge}</label>
                      <span className="text-sm font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">{simParams.currentAge} {t.dashboard.fire.years}</span>
                    </div>
                    <input 
                      type="range" min="18" max="70"
                      value={simParams.currentAge}
                      onChange={(e) => setSimParams({...simParams, currentAge: Number(e.target.value)})}
                      className="w-full accent-orange-500 cursor-pointer h-1.5 bg-white/5 rounded-full appearance-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Visualização de Resultados */}
            <div className="lg:col-span-2 space-y-8">
              {/* Card de Resultado Principal */}
              <motion.div 
                layout
                className="bg-gradient-to-br from-orange-600 via-orange-600 to-red-600 p-12 rounded-[32px] shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-black/10 blur-3xl rounded-full" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                  <div className="text-center md:text-left space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60">{t.dashboard.fire.estimatedRetirementAge}</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-4">
                      <h2 className="text-8xl md:text-9xl font-black text-white tracking-tighter leading-none">
                        {fireResult?.fireAge}
                      </h2>
                      <span className="text-2xl font-black text-white/40 uppercase tracking-widest italic">{t.dashboard.fire.years}</span>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
                      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
                        <ShieldCheck size={16} className="text-white" />
                        <p className="text-xs font-black text-white uppercase tracking-widest">
                          {t.dashboard.fire.yearsLeft} {fireResult?.yearsToFire} {t.dashboard.fire.yearsLeftText}
                        </p>
                      </div>
                      {fireResult?.yearsSaved > 0 && (
                        <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md px-6 py-2 rounded-full border border-emerald-500/20">
                          <Sparkles size={16} className="text-emerald-400" />
                          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                            {t.dashboard.fire.gainedYears} {fireResult?.yearsSaved} {t.dashboard.fire.gainedYearsText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4 w-full md:w-auto">
                    <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 text-center md:text-right min-w-[280px]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">{t.dashboard.fire.fireNumber}</p>
                      <p className="text-4xl font-black text-white tracking-tighter leading-none">
                        {formatCurrency(fireResult?.target)}
                      </p>
                      <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center md:items-end">
                        <p className="text-[10px] font-black uppercase text-white/40">{t.dashboard.fire.monthlyPerpetualIncome}</p>
                        <p className="text-xl font-black text-white">{formatCurrency(fireResult?.monthlyFireIncome)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Gráfico de Evolução de Riqueza */}
              <div className="bg-slate-900/40 backdrop-blur-sm p-12 rounded-[32px] border border-white/5 h-[550px] relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-1">{t.dashboard.fire.accumulationCurve}</h3>
                    <p className="text-xs text-slate-400 font-medium italic">{t.dashboard.fire.accumulationCurveSubtitle}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{t.dashboard.fire.wealth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-px border-t border-dashed border-white/30" />
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{t.dashboard.fire.fireTarget}</span>
                    </div>
                  </div>
                </div>

                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fireData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <defs>
                        <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#475569" 
                        fontSize={9} 
                        tick={{ fontWeight: '900', letterSpacing: '0.05em' }}
                        axisLine={false}
                        tickLine={false}
                        dy={15}
                        interval="preserveStartEnd"
                        minTickGap={30}
                      />
                      <YAxis hide domain={[0, (dataMax: any) => dataMax * 1.1]} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#020617', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '24px',
                          padding: '16px 24px',
                          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '12px' }}
                        formatter={(value: number | undefined) => {
                          if (value === undefined) return ['', ''];
                          return [formatCurrency(value), t.dashboard.fire.wealth];
                        }}
                        labelFormatter={(label) => `${t.dashboard.fire.age} ${label} ${t.dashboard.fire.yearsOld}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="wealth" 
                        stroke="#f97316" 
                        strokeWidth={5}
                        fillOpacity={1} 
                        fill="url(#colorWealth)" 
                        animationDuration={2000}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="target" 
                        stroke="rgba(255,255,255,0.15)" 
                        strokeDasharray="8 8" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="learn" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              {
                title: t.dashboard.fire.whatIsFire,
                icon: Flame,
                color: "text-orange-500",
                desc: t.dashboard.fire.whatIsFireDesc
              },
              {
                title: t.dashboard.fire.fireNumberTitle,
                icon: Target,
                color: "text-blue-500",
                desc: t.dashboard.fire.fireNumberDesc
              },
              {
                title: t.dashboard.fire.fourPercentRule,
                icon: Shield,
                color: "text-emerald-500",
                desc: t.dashboard.fire.fourPercentRuleDesc
              },
              {
                title: t.dashboard.fire.biggestLeverage,
                icon: TrendingUp,
                color: "text-purple-500",
                desc: t.dashboard.fire.biggestLeverageDesc
              },
              {
                title: t.dashboard.fire.compoundInterest,
                icon: Sparkles,
                color: "text-amber-500",
                desc: t.dashboard.fire.compoundInterestDesc
              },
              {
                title: t.dashboard.fire.turningPoint,
                icon: Zap,
                color: "text-red-500",
                desc: t.dashboard.fire.turningPointDesc
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-slate-900/40 border border-white/5 p-10 rounded-[32px] space-y-6 hover:bg-slate-900/60 transition-all"
              >
                <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${item.color}`}>
                  <item.icon size={28} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{item.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed italic">"{item.desc}"</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info Box */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-orange-600/5 border border-orange-500/10 rounded-[32px] p-10 flex flex-col md:flex-row items-center gap-8"
      >
        <div className="w-16 h-16 bg-orange-500/10 rounded-[24px] flex items-center justify-center text-orange-500 shrink-0">
          <Lightbulb size={32} />
        </div>
        <div className="space-y-2 flex-1">
          <h4 className="text-sm font-black uppercase tracking-widest text-white">{t.dashboard.fire.importantNote}</h4>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            {t.dashboard.fire.importantNoteText}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
