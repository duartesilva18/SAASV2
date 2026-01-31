'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { useTranslation } from '@/lib/LanguageContext';

interface Transaction {
  id: string;
  amount_cents: number;
  description: string;
  category_id: string;
  transaction_date: string;
  is_installment: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  vault_type: string;
  color_hex: string;
}

interface TransactionChartsPanelProps {
  transactions: Transaction[];
  categories: Category[];
  evolutionPeriod: 'weekly' | 'daily';
  setEvolutionPeriod: (p: 'weekly' | 'daily') => void;
  formatCurrency: (n: number) => string;
  noDataChart: string;
  valueLabel: string;
  incomeLabel: string;
  expensesLabel: string;
}

export default function TransactionChartsPanel({
  transactions,
  categories,
  evolutionPeriod,
  setEvolutionPeriod,
  formatCurrency,
  noDataChart,
  valueLabel,
  incomeLabel,
  expensesLabel,
}: TransactionChartsPanelProps) {
  const { t } = useTranslation();
  const categoryData = transactions.reduce((acc: Record<string, { name: string; value: number; color: string }>, tx) => {
    const cat = categories.find(c => c.id === tx.category_id);
    if (!cat || cat.vault_type !== 'none' || cat.type !== 'expense') return acc;
    if (tx.amount_cents >= 0) return acc; // Backend: despesas são sempre negativas
    const key = cat.id;
    if (!acc[key]) {
      acc[key] = { name: cat.name, value: 0, color: cat.color_hex };
    }
    acc[key].value += Math.abs(tx.amount_cents) / 100;
    return acc;
  }, {});

  const topChartData = Object.values(categoryData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reverse();

  // Parse date string como YYYY-MM-DD para evitar timezone shift (new Date("2025-12-15") = UTC midnight)
  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = (dateStr.split('T')[0] || dateStr).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const getISOWeekKey = (date: Date): string => {
    const dayNum = date.getDay() || 7; // ISO: Mon=1, Sun=7
    const d = new Date(date);
    d.setDate(d.getDate() + 4 - dayNum); // Mover para quinta-feira da semana
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const periodData = transactions.reduce((acc: Record<string, { period: string; income: number; expenses: number }>, tx) => {
    const date = parseLocalDate(tx.transaction_date);
    let periodKey: string;
    if (evolutionPeriod === 'weekly') {
      periodKey = getISOWeekKey(date);
    } else {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    if (!acc[periodKey]) {
      acc[periodKey] = { period: periodKey, income: 0, expenses: 0 };
    }
    const cat = categories.find(c => c.id === tx.category_id);
    if (cat && cat.vault_type !== 'none') return acc; // Excluir vault (investimento/emergência)
    // Backend: income = amount_cents > 0, expense = amount_cents < 0
    const amountEur = Math.abs(tx.amount_cents) / 100;
    if (tx.amount_cents > 0) {
      acc[periodKey].income += amountEur;
    } else if (tx.amount_cents < 0) {
      acc[periodKey].expenses += amountEur;
    }
    return acc;
  }, {});

  const evolutionChartData = Object.values(periodData)
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-(evolutionPeriod === 'weekly' ? 8 : 14))
    .map((item) => {
      if (evolutionPeriod === 'weekly') {
        const [year, week] = item.period.split('-W');
        const yearShort = year ? `'${year.slice(-2)}` : '';
        return { ...item, label: `Sem ${parseInt(week || '0', 10)} ${yearShort}`.trim() };
      }
      const date = parseLocalDate(item.period);
      return {
        ...item,
        label: date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }),
      };
    });

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="mb-4 sm:mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Top</p>
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">Categorias</h3>
        </div>
        {topChartData.length > 0 ? (
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                  itemStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8' }}
                  cursor={{ fill: 'transparent' }}
                  formatter={(value: unknown) => [formatCurrency(Number(value)), valueLabel]}
                />
                <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} activeBar={{ fill: '#475569', opacity: 0.85 }}>
                  {topChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600">
            <p className="text-xs font-black uppercase">{noDataChart}</p>
          </div>
        )}
      </section>

      <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Evolução</p>
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {evolutionPeriod === 'weekly' ? t.dashboard.analytics.periods.weekly : t.dashboard.analytics.periods.daily}
            </h3>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 rounded-xl p-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setEvolutionPeriod('weekly')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                evolutionPeriod === 'weekly' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Semanal
            </button>
            <button
              type="button"
              onClick={() => setEvolutionPeriod('daily')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                evolutionPeriod === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Diária
            </button>
          </div>
        </div>
        {evolutionChartData.length > 0 ? (
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionChartData}>
                <defs>
                  <linearGradient id="tx-colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tx-colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                  formatter={(value: unknown) => formatCurrency(Number(value))}
                />
                <Area type="monotone" dataKey="income" name={incomeLabel} stroke="#10b981" fillOpacity={1} fill="url(#tx-colorIncome)" />
                <Area type="monotone" dataKey="expenses" name={expensesLabel} stroke="#ef4444" fillOpacity={1} fill="url(#tx-colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600">
            <p className="text-xs font-black uppercase">{noDataChart}</p>
          </div>
        )}
      </section>
    </div>
  );
}
