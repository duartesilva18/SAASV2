'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { 
  Tag, Plus, Trash2, Edit2, Check, X,
  ShoppingBag, Coffee, Car, Home, 
  Smartphone, Utensils, Heart, Briefcase,
  Gamepad, Plane, Zap, Layers, PieChart,
  BarChart3, Target, Sparkles, Filter, AlertCircle,
  Landmark, ShieldCheck, TrendingUp, ChevronDown, ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, 
  Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  vault_type: 'none' | 'investment' | 'emergency';
  monthly_limit_cents: number;
  color_hex: string;
  icon: string;
  is_default: boolean;
}

interface CategoryStats {
  category_id: string;
  name: string;
  total_spent_cents: number;
  count: number;
  percentage: number;
  color: string;
  icon: string;
}

const AVAILABLE_ICONS = [
  { name: 'Tag', icon: Tag },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Coffee', icon: Coffee },
  { name: 'Car', icon: Car },
  { name: 'Home', icon: Home },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Utensils', icon: Utensils },
  { name: 'Heart', icon: Heart },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Gamepad', icon: Gamepad },
  { name: 'Plane', icon: Plane },
  { name: 'Zap', icon: Zap },
  { name: 'Layers', icon: Layers },
  { name: 'Landmark', icon: Landmark },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'TrendingUp', icon: TrendingUp }
];

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#14B8A6', '#6366F1'
];

export default function CategoriesPage() {
  const { t, currency, formatCurrency } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    nature: 'expense' as 'expense' | 'income' | 'investment' | 'emergency',
    monthly_limit: '',
    color_hex: COLORS[0],
    icon: 'Tag'
  });

  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Filtrar stats para remover fundos de emergência e investimentos
  const filteredStats = stats.filter((stat) => {
    const category = categories.find(c => c.id === stat.category_id);
    return category && category.vault_type === 'none';
  });
  const sortedStats = [...filteredStats].sort(
    (a, b) => Math.abs(b.percentage) - Math.abs(a.percentage)
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsRes, statsRes] = await Promise.all([
        api.get('/categories/'),
        api.get('/categories/stats')
      ]);
      setCategories(catsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(t.dashboard.categories.error.load, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Mapear Natureza para Type e VaultType
      const type = formData.nature === 'income' ? 'income' : 'expense';
      const vault_type = 
        formData.nature === 'investment' ? 'investment' : 
        formData.nature === 'emergency' ? 'emergency' : 'none';

      const payload = {
        name: formData.name,
        type,
        vault_type,
        color_hex: formData.color_hex,
        icon: formData.icon,
        monthly_limit_cents: formData.monthly_limit ? Math.round(parseFloat(formData.monthly_limit) * 100) : 0
      };

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
        setToastMsg(t.dashboard.categories.successEdit);
      } else {
        await api.post('/categories/', payload);
        setToastMsg(t.dashboard.categories.successAdd);
      }

      setToastType('success');
      setShowToast(true);
      setShowAddModal(false);
      setEditingCategory(null);
      setFormData({ name: '', nature: 'expense', monthly_limit: '', color_hex: COLORS[0], icon: 'Tag' });
      fetchData();
    } catch (err: any) {
      setToastMsg(err.response?.data?.detail || t.dashboard.categories.error.save);
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    
    try {
      setIsDeleting(true);
      await api.delete(`/categories/${categoryToDelete.id}`);
      setToastMsg(t.dashboard.categories.successDelete);
      setToastType('success');
      setShowToast(true);
      setCategoryToDelete(null);
      fetchData();
    } catch (err: any) {
      setToastMsg(err.response?.data?.detail || t.dashboard.categories.error.delete);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      const res = await api.post('/categories/bulk-delete', selectedIds);
      
      if (res.data.errors && res.data.errors.length > 0) {
        setToastMsg(`${res.data.message} Algumas não puderam ser eliminadas.`);
        setToastType('error');
      } else {
        setToastMsg(res.data.message);
        setToastType('success');
      }
      
      setShowToast(true);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      setIsSelectionMode(false);
      fetchData();
    } catch (err: any) {
      setToastMsg(err.response?.data?.detail || t.dashboard.categories.error.bulkDelete);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string, isProtected: boolean) => {
    if (!isSelectionMode || isProtected) return;
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]);
  };

  const openEdit = (cat: Category) => {
    // Mapear Type e VaultType de volta para Natureza
    let nature: any = cat.type;
    if (cat.vault_type === 'investment') nature = 'investment';
    else if (cat.vault_type === 'emergency') nature = 'emergency';

    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      nature,
      monthly_limit: cat.monthly_limit_cents ? (cat.monthly_limit_cents / 100).toString() : '',
      color_hex: cat.color_hex,
      icon: cat.icon || 'Tag'
    });
    setShowAddModal(true);
  };

  const getIconComponent = (iconName: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === iconName);
    return found ? found.icon : Tag;
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mb-4"
        />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">{t.dashboard.categories.harmonizing}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[28px] bg-slate-900 border border-slate-800 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Layers size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                Gestão de Identidade
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
              {t.dashboard.categories.title}
            </h1>
            <p className="text-slate-400 font-medium max-w-xl italic">
              {t.dashboard.categories.subtitle}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({ name: '', nature: 'expense', monthly_limit: '', color_hex: COLORS[0], icon: 'Tag' });
                setShowAddModal(true);
              }}
              className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Plus size={18} />
              {t.dashboard.categories.addNew}
            </button>
          </div>
        </div>
      </div>

      {/* Vault Info Header */}
      <AnimatePresence>
        {categories.some(c => c.vault_type !== 'none') && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-600/10 border border-blue-500/20 rounded-[32px] p-6 flex items-center gap-6"
          >
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Landmark size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">{t.dashboard.categories.activeVault}</h3>
              <p className="text-xs text-blue-200/70 font-medium italic">{t.dashboard.categories.activeVaultText}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Charts & Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <PieChart size={18} />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  {t.dashboard.categories.statsTitle}
                </h3>
              </div>
            </div>

            {filteredStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={sortedStats.map(stat => ({
                            ...stat,
                            total_spent_cents: Math.abs(stat.total_spent_cents),
                            percentage: Math.abs(stat.percentage)
                          })) as any}
                          dataKey="total_spent_cents"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          stroke="none"
                        >
                          {sortedStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                          formatter={(value: number | undefined) => {
                            if (value === undefined) return '';
                            return formatCurrency(Math.abs(value) / 100);
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    {sortedStats.slice(0, 5).map((stat) => (
                      <div key={stat.category_id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stat.color }}
                            />
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                              {stat.name}
                            </span>
                          </div>
                          <span className="text-xs font-black text-white">
                            {Math.abs(stat.percentage).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.abs(stat.percentage)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: stat.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-600">
                  <Filter size={48} className="mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{t.dashboard.categories.noDataThisMonth}</p>
                </div>
            )}
          </div>

          {/* Detailed Category Cards */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Tag size={18} className="text-blue-400" />
              Minhas Gavetas
            </h3>
            <div className="flex items-center gap-3">
              {isSelectionMode && selectedIds.length > 0 && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Apagar Selecionadas ({selectedIds.length})
                </button>
              )}
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border cursor-pointer ${
                  isSelectionMode 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {isSelectionMode ? <X size={14} /> : <Check size={14} />}
                {isSelectionMode ? t.dashboard.categories.cancelSelection : t.dashboard.categories.selectCategories}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const stat = stats.find(s => s.category_id === cat.id);
              const Icon = getIconComponent(cat.icon);
              const progress = cat.monthly_limit_cents > 0 
                ? Math.abs(stat?.total_spent_cents || 0) / cat.monthly_limit_cents * 100 
                : 0;

              const isExceeded = progress > 100;
              const isAtLimit = Math.abs(progress - 100) < 0.01;
              const isDanger = progress >= 100;
              const isWarning = progress >= 80 && progress < 100;
              const overAmount = isExceeded ? Math.abs(stat?.total_spent_cents || 0) - cat.monthly_limit_cents : 0;
              
              const isProtected = cat.is_default || 
                (cat.vault_type === 'investment' && ['INVESTIMENTO', 'INVESTIMENTOS'].includes(cat.name.toUpperCase())) ||
                (cat.vault_type === 'emergency' && ['FUNDO DE EMERGÊNCIA', 'FUNDO DE EMERGENCIA'].includes(cat.name.toUpperCase()));
              
              const isSelected = selectedIds.includes(cat.id);

              return (
                <motion.div
                  key={cat.id}
                  layout
                  onClick={() => toggleSelect(cat.id, isProtected)}
                  className={`group relative bg-slate-900/50 backdrop-blur-xl border rounded-[32px] p-6 transition-all duration-500 ${
                    isSelectionMode && !isProtected ? 'cursor-pointer hover:border-blue-500/50' : ''
                  } ${
                    isSelected ? 'border-blue-500 bg-blue-500/[0.05] ring-2 ring-blue-500/20' : 
                    isDanger 
                      ? 'border-red-500/50 bg-red-500/[0.03] shadow-[0_0_40px_-10px_rgba(239,68,68,0.2)]' 
                      : 'border-slate-800 hover:border-blue-500/30 shadow-xl'
                  } ${isSelectionMode && isProtected ? 'opacity-40 grayscale-[0.5]' : ''}`}
                >
                  {isSelected && (
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg z-20">
                      <Check size={16} strokeWidth={4} />
                    </div>
                  )}
                  {isDanger && (
                    <div className="absolute -top-3 right-6 bg-red-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg shadow-red-600/40 animate-bounce">
                      {isExceeded ? t.dashboard.categories.dangerLimitExceeded : t.dashboard.categories.warningLimitReached}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110"
                        style={{ backgroundColor: cat.color_hex }}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-white uppercase tracking-tighter group-hover:text-blue-400 transition-colors">
                          {cat.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          {cat.vault_type === 'none' && (
                            <span className={`text-[10px] font-black uppercase tracking-widest ${cat.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {cat.type === 'expense' ? t.dashboard.categories.expense : t.dashboard.categories.income}
                            </span>
                          )}
                          {cat.vault_type !== 'none' && (
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                              {cat.vault_type === 'investment' ? t.dashboard.categories.investment : t.dashboard.categories.emergencyFundLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isSelectionMode && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                            className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-xl transition-colors cursor-pointer"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!isProtected && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); }}
                              className="p-2 hover:bg-red-500/10 text-red-400 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {cat.type === 'expense' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">{t.dashboard.categories.spent}</span>
                        <span className="text-white">{formatCurrency(Math.abs(stat?.total_spent_cents || 0) / 100)}</span>
                      </div>
                      
                      {cat.monthly_limit_cents > 0 && (
                        <>
                          <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(progress, 100)}%` }}
                              className={`h-full rounded-full transition-colors duration-500 ${
                                isDanger ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 
                                isWarning ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 
                                'bg-blue-500'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.15em]">
                            <div className="flex items-center gap-1.5">
                              {isDanger && <AlertCircle size={10} className="text-red-500 animate-pulse" />}
                              <span className={isDanger ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-slate-600'}>
                                {Math.round(progress)}% {isExceeded ? t.dashboard.categories.limitExceeded : isAtLimit ? t.dashboard.categories.limitReached : t.dashboard.categories.ofLimit}
                              </span>
                            </div>
                            <span className="text-slate-400 font-bold">{formatCurrency(cat.monthly_limit_cents / 100)}</span>
                          </div>

                          {isDanger && (
                            <motion.p 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[10px] font-bold text-red-500 italic mt-2 border-t border-red-500/10 pt-2 flex justify-between items-center"
                            >
                              <span>{isExceeded ? t.dashboard.categories.budgetExceeded : t.dashboard.categories.budgetReached}</span>
                              {isExceeded && <span className="text-sm font-black">{formatCurrency(overAmount / 100)}</span>}
                            </motion.p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: Zen Tips & Legend */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full translate-x-10 -translate-y-10" />
            <Sparkles className="mb-6 opacity-80" size={32} />
            <h3 className="text-2xl font-black tracking-tighter mb-4 leading-none uppercase">{t.dashboard.categories.masterTip}</h3>
            <p className="text-blue-100 font-medium italic text-sm leading-relaxed">
              "{t.dashboard.categories.masterTipText}"
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <Target size={14} />
              Alvos este Mês
            </h4>
            <div className="space-y-6">
              {stats.filter((s) => {
                const category = categories.find(c => c.id === s.category_id);
                return category && category.vault_type === 'none';
              }).slice(0, 3).map((s) => (
                <div key={s.category_id} className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${s.color}20`, color: s.color }}
                  >
                    {(() => {
                      const Icon = getIconComponent(s.icon);
                      return <Icon size={20} />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-white uppercase tracking-tighter">{s.name}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{s.count} {t.dashboard.categories.transactions}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-2xl will-change-transform"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring' as const, damping: 25, stiffness: 300 }}
              className="relative w-full max-w-xl bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full" />

              <div className="p-10 md:p-14 relative z-10">
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Configuração de Gaveta</span>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                      {editingCategory ? t.dashboard.categories.edit : t.dashboard.categories.addNew}
                    </h2>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/5">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                  {/* Icon Selection */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1 block">Escolhe a Identidade Visual</label>
                    <div className="grid grid-cols-6 gap-4">
                      {AVAILABLE_ICONS.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: item.name })}
                          className={`group p-4 rounded-2xl transition-all cursor-pointer relative overflow-hidden ${
                            formData.icon === item.name 
                              ? 'bg-blue-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] scale-110' 
                              : 'bg-slate-950/50 text-slate-500 border border-white/5 hover:border-white/10 hover:text-slate-300'
                          }`}
                        >
                          <item.icon size={22} className="relative z-10 group-hover:scale-110 transition-transform" />
                          {formData.icon === item.name && (
                            <motion.div layoutId="iconGlow" className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="relative group">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4 mb-2 block group-focus-within:text-blue-500 transition-colors">
                        {t.dashboard.categories.name}
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-8 py-5 text-white focus:outline-none focus:border-blue-500/50 focus:bg-slate-950 transition-all placeholder:text-slate-700 font-medium"
                        placeholder={t.dashboard.categories.namePlaceholder || "Category name"}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4 block">
                        {t.dashboard.categories.nature}
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'expense', label: t.dashboard.categories.expense, icon: TrendingUp, color: 'text-red-400' },
                          { id: 'income', label: t.dashboard.categories.income, icon: Landmark, color: 'text-emerald-400' },
                        ].map((nature) => (
                          <button
                            key={nature.id}
                            type="button"
                            disabled={editingCategory ? (editingCategory.vault_type !== 'none') : false}
                            onClick={() => setFormData({ ...formData, nature: nature.id as any })}
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all cursor-pointer ${
                              formData.nature === nature.id 
                                ? 'bg-slate-950 border-blue-500/50 shadow-lg shadow-blue-500/10' 
                                : 'bg-slate-950/30 border-white/5 hover:border-white/10 opacity-60 hover:opacity-100'
                            } ${editingCategory ? (editingCategory.vault_type !== 'none' ? 'opacity-50 cursor-not-allowed' : '') : ''}`}
                          >
                            <nature.icon size={16} className={nature.color} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${formData.nature === nature.id ? 'text-white' : 'text-slate-500'}`}>
                              {nature.label}
                            </span>
                            {formData.nature === nature.id && (
                              <motion.div layoutId="natureActive" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                          </button>
                        ))}
                      </div>
                      {editingCategory && (editingCategory.vault_type !== 'none') && (
                        <p className="text-[10px] text-blue-400 font-bold italic ml-4 mt-2">
                          * As categorias de Cofre têm uma natureza fixa.
                        </p>
                      )}
                    </div>

                    <div className="relative group">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4 mb-2 block group-focus-within:text-blue-500 transition-colors">
                        {t.dashboard.categories.limit} (Opcional)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.monthly_limit}
                          onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                          className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-8 py-5 text-white focus:outline-none focus:border-blue-500/50 focus:bg-slate-950 transition-all pl-16 font-black text-xl tracking-tighter"
                          placeholder="0.00"
                        />
                        <span className="absolute left-8 top-1/2 -translate-y-1/2 text-blue-500 font-black text-lg">
                          {currency === 'EUR' ? '€' : currency === 'BRL' ? 'R$' : '$'}
                        </span>
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4 block">
                        {t.dashboard.categories.color}
                      </label>
                      <div className="flex flex-wrap gap-4 px-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormData({ ...formData, color_hex: c })}
                            className={`w-11 h-11 rounded-2xl transition-all cursor-pointer flex items-center justify-center relative ${
                              formData.color_hex === c ? 'scale-125 ring-2 ring-white/50 ring-offset-4 ring-offset-slate-950 shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                          >
                            {formData.color_hex === c && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Check size={18} className="text-white stroke-[4]" />
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="group relative w-full py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-[32px] font-black uppercase tracking-[0.3em] text-sm transition-all active:scale-[0.98] shadow-2xl shadow-blue-600/30 overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {editingCategory ? t.dashboard.categories.saveChanges : t.dashboard.categories.createNew}
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleDelete}
        title={t.dashboard.categories.deleteConfirm}
        message={
          <>
            {t.dashboard.categories.deleteConfirmText} <span className="text-white font-black px-2 py-0.5 bg-white/5 rounded-lg">"{categoryToDelete?.name}"</span>.<br />
            <span className="text-red-400/80 text-xs">{t.dashboard.categories.deleteWarning}</span>
          </>
        }
        confirmText={t.dashboard.categories.confirmDeleteText}
        cancelText={t.dashboard.categories.cancel}
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={t.dashboard.categories.deleteMultiple}
        message={
          <>
            {t.dashboard.categories.deleteMultipleText} <span className="text-white font-black px-2 py-0.5 bg-white/5 rounded-lg">{selectedIds.length}</span> {t.dashboard.categories.deleteMultipleCategories}<br />
            <span className="text-red-400/80 text-xs">{t.dashboard.categories.deleteWarning}</span>
          </>
        }
        confirmText={t.dashboard.categories.confirmBulkDeleteText}
        cancelText={t.dashboard.categories.cancel}
        variant="danger"
        isLoading={isBulkDeleting}
      />

      <Toast 
        message={toastMsg} 
        onClose={() => setShowToast(false)} 
        type={toastType} 
        isVisible={showToast}
      />
    </div>
  );
}
