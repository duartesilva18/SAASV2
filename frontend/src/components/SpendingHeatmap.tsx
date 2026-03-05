'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, ArrowDownRight } from 'lucide-react';

interface DayData {
  date: Date;
  dateStr: string;
  value: number;
}

interface SpendingHeatmapProps {
  dailySpending: Record<string, number>;
  transactions: any[];
  categories: any[];
  formatCurrency: (v: number) => string;
}

const HEAT_COLORS = ['#1e293b40', '#14532d', '#a16207', '#c2410c', '#dc2626'];

export default function SpendingHeatmap({
  dailySpending,
  transactions,
  categories,
  formatCurrency,
}: SpendingHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { weeks, monthLabels, getColor } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    const dow = start.getDay();
    start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));

    const weeksArr: (DayData | null)[][] = [];
    let week: (DayData | null)[] = new Array(7).fill(null);
    const cur = new Date(start);

    while (cur <= today) {
      const jsDay = cur.getDay();
      const gridRow = jsDay === 0 ? 6 : jsDay - 1;
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      week[gridRow] = { date: new Date(cur), dateStr, value: dailySpending[dateStr] || 0 };

      if (jsDay === 0) {
        weeksArr.push(week);
        week = new Array(7).fill(null);
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.some((d) => d !== null)) weeksArr.push(week);

    const labels: { label: string; colIdx: number }[] = [];
    let lastMonth = -1;
    weeksArr.forEach((w, wi) => {
      const firstDay = w.find((d) => d !== null);
      if (firstDay && firstDay.date.getMonth() !== lastMonth) {
        lastMonth = firstDay.date.getMonth();
        labels.push({
          label: firstDay.date.toLocaleDateString('pt-PT', { month: 'short' }),
          colIdx: wi,
        });
      }
    });

    const nonZero = Object.values(dailySpending)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const len = nonZero.length;
    const q1 = len > 0 ? nonZero[Math.floor(len * 0.25)] : 1;
    const q2 = len > 0 ? nonZero[Math.floor(len * 0.5)] : 1;
    const q3 = len > 0 ? nonZero[Math.floor(len * 0.75)] : 1;

    const colorFn = (value: number): string => {
      if (value === 0) return HEAT_COLORS[0];
      if (value <= q1) return HEAT_COLORS[1];
      if (value <= q2) return HEAT_COLORS[2];
      if (value <= q3) return HEAT_COLORS[3];
      return HEAT_COLORS[4];
    };

    return { weeks: weeksArr, monthLabels: labels, getColor: colorFn };
  }, [dailySpending]);

  const totalCols = weeks.length;

  const { cell, gap, labelW, dayLabels, fontSize } = useMemo(() => {
    if (containerWidth <= 0) return { cell: 16, gap: 3, labelW: 30, dayLabels: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], fontSize: '9px' };

    const labelBase = 28;
    const available = containerWidth - labelBase - 8;
    const maxCell = Math.floor(available / totalCols) - 2;
    const c = Math.max(6, Math.min(16, maxCell));
    const g = c >= 12 ? 3 : 2;

    const fullLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const shortLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
    const lbl = c >= 10 ? fullLabels : shortLabels;
    const lw = c >= 10 ? 30 : 18;
    const fs = c >= 10 ? '10px' : '8px';

    return { cell: c, gap: g, labelW: lw, dayLabels: lbl, fontSize: fs };
  }, [containerWidth, totalCols]);

  const step = cell + gap;

  const handleCellClick = useCallback(
    (dateStr: string) => {
      setSelectedDay((prev) => (prev === dateStr ? null : dateStr));
    },
    [],
  );

  const selectedDayTxs = useMemo(() => {
    if (!selectedDay) return [];
    return transactions
      .filter((tx: any) => {
        const cat = categories.find((c: any) => c.id === tx.category_id);
        if (!cat || cat.vault_type !== 'none') return false;
        if (cat.type !== 'expense' && tx.amount_cents >= 0) return false;
        return tx.transaction_date === selectedDay;
      })
      .sort((a: any, b: any) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents))
      .map((tx: any) => ({
        ...tx,
        category: categories.find((c: any) => c.id === tx.category_id),
      }));
  }, [selectedDay, transactions, categories]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 sm:p-4 lg:p-6 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Calendar size={14} className="text-violet-400 sm:hidden" />
            <Calendar size={16} className="text-violet-400 hidden sm:block" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider text-white truncate">
              Mapa de Gastos
            </h3>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium italic truncate">
              Despesas diárias — 12 meses
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[9px] lg:text-[10px] text-slate-500 shrink-0">
          <span>Menos</span>
          {HEAT_COLORS.map((c, i) => (
            <div
              key={i}
              className="w-[12px] h-[12px] lg:w-[14px] lg:h-[14px] rounded-[2px]"
              style={{ backgroundColor: c }}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>

      {/* Hover info bar */}
      <div className="h-4 sm:h-5 flex items-center mb-1" style={{ marginLeft: `${labelW}px` }}>
        {hoveredDay ? (
          <span className="text-[9px] sm:text-[10px] text-slate-400 truncate">
            <span className="font-bold text-white">
              {hoveredDay.date.toLocaleDateString('pt-PT', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
            {' — '}
            {hoveredDay.value > 0 ? (
              <span className="text-red-400 font-bold">
                {formatCurrency(hoveredDay.value / 100)}
              </span>
            ) : (
              <span className="text-slate-600">Sem despesas</span>
            )}
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] text-slate-600 italic truncate">
            Passa o rato sobre um dia para ver detalhes
          </span>
        )}
      </div>

      {/* Heatmap grid */}
      {containerWidth > 0 && (
        <div className="overflow-hidden">
          {/* Month labels */}
          <div className="relative h-3 sm:h-4 mb-1" style={{ marginLeft: `${labelW}px` }}>
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="absolute text-slate-500 font-bold uppercase tracking-wider"
                style={{ left: `${m.colIdx * step}px`, fontSize }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid rows */}
          <div className="flex" style={{ gap: `${gap}px` }}>
            {/* Day labels */}
            <div
              className="flex flex-col shrink-0"
              style={{ gap: `${gap}px`, width: `${labelW - 2}px` }}
            >
              {dayLabels.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-end pr-0.5"
                  style={{ height: `${cell}px` }}
                >
                  <span className="text-slate-600 font-medium leading-none" style={{ fontSize }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: `${gap}px` }}>
                {week.map((day, di) => {
                  if (!day) {
                    return (
                      <div key={di} style={{ width: cell, height: cell }} />
                    );
                  }
                  const isSelected = selectedDay === day.dateStr;
                  return (
                    <div
                      key={di}
                      className="rounded-[2px] cursor-pointer transition-all duration-100"
                      style={{
                        width: cell,
                        height: cell,
                        backgroundColor: getColor(day.value),
                        outline: isSelected ? '2px solid #a78bfa' : 'none',
                        outlineOffset: '-1px',
                      }}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => handleCellClick(day.dateStr)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile legend */}
      <div className="flex sm:hidden items-center justify-center gap-1.5 text-[9px] text-slate-500 mt-2">
        <span>Menos</span>
        {HEAT_COLORS.map((c, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>Mais</span>
      </div>

      {/* Selected day transactions panel */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="text-[11px] sm:text-xs font-bold text-white capitalize truncate">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-PT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h4>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-800/60 px-1.5 sm:px-2 py-0.5 rounded-md shrink-0">
                    {selectedDayTxs.length}{' '}
                    {selectedDayTxs.length === 1 ? 'despesa' : 'despesas'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} className="text-slate-500" />
                </button>
              </div>

              {selectedDayTxs.length > 0 ? (
                <div className="space-y-1 sm:space-y-1.5 max-h-[140px] sm:max-h-[160px] overflow-y-auto">
                  {selectedDayTxs.map((tx: any, i: number) => (
                    <div
                      key={tx.id || i}
                      className="flex items-center justify-between p-2 sm:p-2.5 bg-slate-950/50 rounded-lg sm:rounded-xl border border-slate-700/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                          <ArrowDownRight size={11} className="text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-bold text-white truncate">
                            {tx.description || 'N/A'}
                          </p>
                          <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium truncate">
                            {tx.category?.name || ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-black text-red-400 tabular-nums shrink-0 ml-2">
                        -{formatCurrency(Math.abs(tx.amount_cents) / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs text-slate-500 italic text-center py-3 sm:py-4">
                  Sem despesas neste dia
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
