'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Wallet, Calendar, Tag, ChevronDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';

export interface TransactionAddModalCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  vault_type: string;
  color_hex?: string;
}

interface TransactionAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: TransactionAddModalCategory[];
  transactions?: { category_id: string; amount_cents: number }[];
}

export default function TransactionAddModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  transactions = [],
}: TransactionAddModalProps) {
  const { t, formatCurrency } = useTranslation();
  const [formData, setFormData] = useState({
    transaction_type: '' as '' | 'income' | 'expense',
    amount: '',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedAmount = formData.amount.replace(',', '.');
      const parsedAmount = parseFloat(normalizedAmount);

      if (!formData.amount?.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
        setToast({ message: t.dashboard.transactions.validation.invalidAmount, type: 'error', visible: true });
        return;
      }
      if (!formData.transaction_type) {
        setToast({ message: (t.dashboard.transactions.validation as any)?.noType ?? 'Seleciona o tipo (receita ou despesa).', type: 'error', visible: true });
        return;
      }
      if (!formData.category_id?.trim()) {
        setToast({ message: t.dashboard.transactions.validation.noCategory, type: 'error', visible: true });
        return;
      }
      const selectedDate = new Date(formData.transaction_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        setToast({ message: t.dashboard.transactions.validation.invalidDate, type: 'error', visible: true });
        return;
      }
      const selectedCategory = categories.find((c) => c.id === formData.category_id);
      if (!selectedCategory) {
        setToast({ message: t.dashboard.transactions.validation.invalidCategory, type: 'error', visible: true });
        return;
      }

      let amount_cents = Math.round(parsedAmount * 100);
      const isVaultCategory = selectedCategory.vault_type !== 'none';
      if (isVaultCategory) {
        amount_cents = selectedCategory.type === 'income' ? -Math.abs(amount_cents) : Math.abs(amount_cents);
      } else if (selectedCategory.type === 'income') {
        amount_cents = Math.abs(amount_cents);
      } else {
        amount_cents = -Math.abs(amount_cents);
      }

      if (isVaultCategory && amount_cents < 0 && transactions.length > 0) {
        const vaultTransactions = transactions.filter((t) => {
          const cat = categories.find((c) => c.id === t.category_id);
          return cat?.id === selectedCategory.id;
        });
        const vaultBalance = vaultTransactions.reduce((acc: number, t) => acc + t.amount_cents, 0);
        if (Math.abs(amount_cents) > vaultBalance) {
          setToast({
            message: `${t.dashboard.vault.insufficientBalance}\n\n${t.dashboard.vault.available} ${formatCurrency(vaultBalance / 100)}`,
            type: 'error',
            visible: true,
          });
          return;
        }
      }

      if (amount_cents === 0) {
        setToast({ message: t.dashboard.transactions.validation.zeroAmount, type: 'error', visible: true });
        return;
      }

      await api.post('/transactions/', {
        amount_cents,
        description: formData.description || null,
        category_id: formData.category_id,
        transaction_date: formData.transaction_date,
        is_installment: false,
      });
      setToast({ message: t.dashboard.transactions.success, type: 'success', visible: true });
      setFormData({ transaction_type: '', amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || t.dashboard.transactions.error;
      setToast({ message: typeof msg === 'string' ? msg : t.dashboard.transactions.registerError, type: 'error', visible: true });
    }
  };

  // Bloquear scroll do body no mobile quando o modal está aberto
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // Categorias filtradas pelo tipo selecionado (receita vs despesa)
  const categoriesByType = formData.transaction_type === 'income'
    ? categories.filter((c) => c.type === 'income' || (c.type === 'expense' && c.vault_type !== 'none'))
    : formData.transaction_type === 'expense'
      ? categories.filter((c) => c.type === 'expense')
      : [];

  const setTransactionType = (type: 'income' | 'expense') => {
    setFormData((prev) => ({ ...prev, transaction_type: type, category_id: '' }));
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden sm:overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] min-h-[65dvh] sm:min-h-0"
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 min-h-0 overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2 shrink-0">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">{t.dashboard.transactions.newRecord}</h2>
                <button onClick={onClose} className="p-2 shrink-0 text-slate-500 hover:text-white transition-colors cursor-pointer rounded-lg -m-2 touch-manipulation" type="button" aria-label="Fechar">
                  <X size={22} />
                </button>
              </div>
              <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.type ?? 'Tipo'}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionType('income')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-colors cursor-pointer min-h-[48px] ${
                        formData.transaction_type === 'income'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <ArrowUpCircle size={20} className="shrink-0" />
                      {t.dashboard.transactions.filters?.income ?? 'Receitas'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionType('expense')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-colors cursor-pointer min-h-[48px] ${
                        formData.transaction_type === 'expense'
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <ArrowDownCircle size={20} className="shrink-0" />
                      {t.dashboard.transactions.filters?.expense ?? 'Despesas'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.table.description}</label>
                  <div className="relative">
                    <Activity size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0" />
                    <input
                      required
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t.dashboard.transactions.descriptionPlaceholder}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-11 pr-3 text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[48px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.value}</label>
                    <div className="relative">
                      <Wallet size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0" />
                      <input
                        required
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-11 pr-3 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[48px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.date}</label>
                    <div className="relative">
                      <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0" />
                      <input
                        required
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-11 pr-3 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[48px] [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.category}</label>
                  <div className="relative">
                    <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0 z-10" />
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      disabled={!formData.transaction_type}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-3 pl-11 pr-10 text-base sm:text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
                    >
                      <option value="">
                        {formData.transaction_type
                          ? t.dashboard.transactions.selectCategory
                          : (t.dashboard.transactions.selectTypeFirst ?? 'Seleciona primeiro o tipo acima')}
                      </option>
                      {formData.transaction_type === 'income' && (
                        <>
                          {categoriesByType.filter((c) => c.type === 'income').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                          ))}
                          {categoriesByType.filter((c) => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name} (Resgate)</option>
                          ))}
                        </>
                      )}
                      {formData.transaction_type === 'expense' && (
                        <>
                          {categoriesByType.filter((c) => c.vault_type === 'none').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                          ))}
                          {categoriesByType.filter((c) => c.vault_type !== 'none').length > 0 && (
                            <optgroup label={t.dashboard.transactions.investmentsAndSavings} className="bg-slate-900">
                              {categoriesByType.filter((c) => c.vault_type !== 'none').map((c) => (
                                <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      )}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0" />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer touch-manipulation min-h-[48px]"
                >
                  {t.dashboard.transactions.registerTransaction}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
      <Toast message={toast.message} type={toast.type} isVisible={toast.visible} onClose={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}
