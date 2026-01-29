'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Wallet, Calendar, Tag, ChevronDown } from 'lucide-react';
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
      if (!formData.amount?.trim() || parseFloat(formData.amount) <= 0) {
        setToast({ message: t.dashboard.transactions.validation.invalidAmount, type: 'error', visible: true });
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

      let amount_cents = Math.round(parseFloat(formData.amount) * 100);
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
      setFormData({ amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || t.dashboard.transactions.error;
      setToast({ message: typeof msg === 'string' ? msg : t.dashboard.transactions.registerError, type: 'error', visible: true });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="relative w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full -z-10" />
            <div className="p-4 sm:p-6 lg:p-12 overflow-y-auto flex-1 min-h-0 pb-[env(safe-area-inset-bottom)]">
              <div className="flex justify-between items-center mb-6 sm:mb-10 gap-2">
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tighter truncate">{t.dashboard.transactions.newRecord}</h2>
                <button onClick={onClose} className="p-2.5 shrink-0 text-slate-500 hover:text-white transition-colors cursor-pointer rounded-xl -m-2.5" type="button" aria-label="Fechar">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.table.description}</label>
                  <div className="relative group">
                    <Activity size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                    <input
                      required
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t.dashboard.transactions.descriptionPlaceholder}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white placeholder:text-slate-800 focus:border-blue-500/50 transition-all outline-none font-medium"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.value}</label>
                    <div className="relative group">
                      <Wallet size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white focus:border-blue-500/50 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.date}</label>
                    <div className="relative group">
                      <Calendar size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        required
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white focus:border-blue-500/50 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.category}</label>
                  <div className="relative group">
                    <Tag size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-10 text-white appearance-none focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer"
                    >
                      <option value="">{t.dashboard.transactions.selectCategory}</option>
                      <optgroup label={t.dashboard.transactions.filters.income} className="bg-slate-900">
                        {categories.filter((c) => c.type === 'income').map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                        ))}
                        {categories.filter((c) => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">{c.name} (Resgate)</option>
                        ))}
                      </optgroup>
                      <optgroup label={t.dashboard.transactions.filters.expense} className="bg-slate-900">
                        {categories.filter((c) => c.type === 'expense' && c.vault_type === 'none').map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label={t.dashboard.transactions.investmentsAndSavings} className="bg-slate-900">
                        {categories.filter((c) => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 sm:py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl sm:rounded-[24px] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98] cursor-pointer min-h-[48px]"
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
