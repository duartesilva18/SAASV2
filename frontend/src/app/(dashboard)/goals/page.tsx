'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Plus, Trash2, Edit2, X, Check, 
  Calendar, Trophy, TrendingUp, Sparkles,
  ArrowRight, Heart, Star, Zap, Plane, Car, Home, Wallet
} from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import api from '@/lib/api';
import Toast from '@/components/Toast';

const ICONS = [
  { name: 'Target', icon: Target },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Plane', icon: Plane },
  { name: 'Car', icon: Car },
  { name: 'Home', icon: Home },
  { name: 'Wallet', icon: Wallet },
  { name: 'Trophy', icon: Trophy }
];

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

export default function GoalsPage() {
  const { t, formatCurrency } = useTranslation();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowNotifications] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState({
    name: '',
    target_amount_cents: 0,
    current_amount_cents: 0,
    target_date: new Date().toISOString().split('T')[0],
    icon: 'Target',
    color_hex: '#3B82F6'
  });

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals/');
      setGoals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGoal) {
        await api.patch(`/goals/${editingGoal.id}`, formData);
        setToast({ show: true, message: t.dashboard.goals.updateSuccess, type: 'success' });
      } else {
        await api.post('/goals/', formData);
        setToast({ show: true, message: t.dashboard.goals.createSuccess, type: 'success' });
      }
      setShowNotifications(false);
      setEditingGoal(null);
      fetchGoals();
    } catch (err) {
      setToast({ show: true, message: t.dashboard.goals.saveError, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.dashboard.goals.deleteConfirm)) return;
    try {
      await api.delete(`/goals/${id}`);
      setToast({ show: true, message: t.dashboard.goals.deleteSuccess, type: 'success' });
      fetchGoals();
    } catch (err) {
      setToast({ show: true, message: t.dashboard.goals.deleteError, type: 'error' });
    }
  };

  const openEdit = (goal: any) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      target_amount_cents: goal.target_amount_cents,
      current_amount_cents: goal.current_amount_cents,
      target_date: goal.target_date,
      icon: goal.icon,
      color_hex: goal.color_hex
    });
    setShowNotifications(true);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.goals.loading}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20 px-4 md:px-8">
      {/* Header */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <Trophy size={14} /> {t.dashboard.goals.badge}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase leading-none">
              {t.dashboard.goals.title.split(' ').slice(0, -1).join(' ')} <span className="text-blue-500 italic">{t.dashboard.goals.title.split(' ').slice(-1)[0]}</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-xl italic text-lg">
              "{t.dashboard.goals.subtitle}" - {t.dashboard.goals.subtitleQuote}
            </p>
          </div>

          <button 
            onClick={() => {
              setEditingGoal(null);
              setFormData({
                name: '',
                target_amount_cents: 0,
                current_amount_cents: 0,
                target_date: new Date().toISOString().split('T')[0],
                icon: 'Target',
                color_hex: '#3B82F6'
              });
              setShowNotifications(true);
            }}
            className="group flex items-center gap-3 px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            {t.dashboard.goals.newGoal} <Plus size={18} />
          </button>
        </div>
      </section>

      {/* Grid de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {goals.map((goal) => {
          const progress = Math.min(100, (goal.current_amount_cents / goal.target_amount_cents) * 100) || 0;
          const Icon = ICONS.find(i => i.name === goal.icon)?.icon || Target;
          const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

          return (
            <motion.div 
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[48px] relative overflow-hidden hover:border-blue-500/20 transition-all hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
              
              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: `${goal.color_hex}20`, color: goal.color_hex }}
                  >
                    <Icon size={28} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(goal)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all cursor-pointer">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(goal.id)} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-all cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">{goal.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <Calendar size={12} /> {new Date(goal.target_date).toLocaleDateString('pt-PT')} • {daysLeft > 0 ? `${daysLeft} ${t.dashboard.goals.daysRemaining}` : t.dashboard.goals.dateReached}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t.dashboard.goals.accumulated}</p>
                      <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(goal.current_amount_cents / 100)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t.dashboard.goals.target}</p>
                      <p className="text-sm font-black text-slate-400">{formatCurrency(goal.target_amount_cents / 100)}</p>
                    </div>
                  </div>

                  <div className="h-4 w-full bg-white/5 rounded-2xl p-1 border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-1000"
                      style={{ backgroundColor: goal.color_hex }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span style={{ color: goal.color_hex }}>{Math.round(progress)}% {t.dashboard.goals.completed}</span>
                    <span className="text-slate-600">{formatCurrency((goal.target_amount_cents - goal.current_amount_cents) / 100)} {t.dashboard.goals.remaining}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-full py-32 text-center space-y-6 bg-slate-900/20 rounded-[64px] border border-dashed border-white/5">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-700">
              <Target size={40} />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black text-white uppercase tracking-tight">{t.dashboard.goals.emptyMap}</p>
              <p className="text-slate-500 font-medium">{t.dashboard.goals.emptyMapSubtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova/Editar Meta */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[48px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
              
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    {editingGoal ? t.dashboard.goals.edit : t.dashboard.goals.new} <span className="text-blue-500 italic">{t.dashboard.goals.goal}</span>
                  </h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">{t.dashboard.goals.drawYourFuture}</p>
                </div>
                <button onClick={() => setShowNotifications(false)} className="p-3 hover:bg-white/5 rounded-full text-slate-500 transition-colors cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.goalName}</label>
                    <input 
                      type="text" required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase tracking-widest focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                      placeholder={t.dashboard.goals.goalNamePlaceholder}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.targetAmount}</label>
                      <input 
                        type="number" required
                        value={formData.target_amount_cents}
                        onChange={(e) => setFormData({ ...formData, target_amount_cents: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.alreadySaved}</label>
                      <input 
                        type="number" required
                        value={formData.current_amount_cents}
                        onChange={(e) => setFormData({ ...formData, current_amount_cents: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">{t.dashboard.goals.deadline}</label>
                    <input 
                      type="date" required
                      value={formData.target_date}
                      onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block ml-2">{t.dashboard.goals.iconAndColor}</label>
                    <div className="flex flex-wrap gap-3 mb-6">
                      {ICONS.map((item) => (
                        <button
                          key={item.name} type="button"
                          onClick={() => setFormData({ ...formData, icon: item.name })}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer ${formData.icon === item.name ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30' : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                        >
                          <item.icon size={20} />
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {COLORS.map((color) => (
                        <button
                          key={color} type="button"
                          onClick={() => setFormData({ ...formData, color_hex: color })}
                          className={`w-10 h-10 rounded-full border-2 transition-all cursor-pointer ${formData.color_hex === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-xs transition-all shadow-2xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {editingGoal ? t.dashboard.goals.saveChanges : t.dashboard.goals.activateGoal} <Check size={18} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
}

