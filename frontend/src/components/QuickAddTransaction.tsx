'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Sparkles, Plus, Calendar, Tag, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { useUser } from '@/lib/UserContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';

export default function QuickAddTransaction() {
  const { t, currency } = useTranslation();
  const { logout } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense'
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
      if (res.data.length > 0 && !formData.category_id) {
        setFormData((prev) => ({
          ...prev,
          category_id: res.data[0].id
        }));
      }
    } catch (err: any) {
      console.error("Erro ao carregar categorias:", err);
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDate = new Date(formData.transaction_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      setToastMsg("A jornada Zen só regista o presente ou o passado. Escolha uma data válida.");
      setToastType('error');
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      await api.post('/transactions/', {
        amount_cents: Math.round(parseFloat(formData.amount) * 100) * (formData.type === 'expense' ? -1 : 1),
        description: formData.description,
        category_id: formData.category_id,
        transaction_date: formData.transaction_date
      });
      setToastMsg("Transação registada com sucesso!");
      setToastType('success');
      setShowToast(true);
      setIsOpen(false);
      setFormData({
        amount: '',
        description: '',
        category_id: categories[0]?.id || '',
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense'
      });
      window.dispatchEvent(new Event('transaction-added'));
    } catch (err) {
      setToastMsg("Erro ao registar transação.");
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9998] flex flex-col items-center"
      >
        <AnimatePresence mode="wait">
          {!isOpen ? (
            <motion.button
              key="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="h-12 px-10 bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-3 cursor-pointer group hover:border-blue-500/50 transition-all"
            >
              <Zap size={16} className="text-blue-400 fill-blue-400/20 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                Registo Rápido Transação
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="mb-4 w-[90vw] max-w-md bg-slate-900 border border-white/5 rounded-[40px] shadow-2xl overflow-hidden relative"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                        Registo Rápido
                      </h2>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 italic">A tua jornada Zen</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                      className={`py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer ${formData.type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-800/50 text-slate-500'}`}
                    >
                      <ArrowDownCircle size={14} />
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                      className={`py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer ${formData.type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-500'}`}
                    >
                      <ArrowUpCircle size={14} />
                      Receita
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">
                        {currency === 'EUR' ? '€' : currency === 'BRL' ? 'R$' : '$'}
                      </div>
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full bg-slate-950/50 border border-slate-700 focus:border-blue-500 rounded-2xl pl-14 pr-6 py-5 text-3xl font-black text-white focus:outline-none transition-all placeholder:text-slate-800"
                      />
                    </div>

                    <input
                      required
                      type="text"
                      placeholder="Descrição (ex: Almoço Zen)"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-700 focus:border-blue-500 rounded-2xl px-6 py-4 text-sm font-medium text-white focus:outline-none transition-all"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={formData.transaction_date}
                          onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                          className="w-full bg-slate-950/50 border border-slate-700 focus:border-blue-500 rounded-2xl pl-12 pr-4 py-4 text-[10px] font-bold text-white focus:outline-none appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <select
                          value={formData.category_id}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-[10px] font-bold text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                        >
                          {categories.filter((c) => c.type === formData.type).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={loading || !formData.amount || !formData.description}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-[0.98] shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Confirmar Registo
                        <Plus size={18} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Toast
        message={toastMsg}
        onClose={() => setShowToast(false)}
        type={toastType}
        isVisible={showToast}
      />
    </>
  );
}
