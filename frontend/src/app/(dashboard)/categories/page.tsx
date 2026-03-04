'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/LanguageContext';
import { 
  Tag, Plus, Trash2, Edit2, Check, X, Lock,
  Home, Utensils, Heart,
  Zap, Layers, PieChart,
  Target, Sparkles, Filter, AlertCircle,
  Landmark, ShieldCheck, TrendingUp, ChevronDown, ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, 
  Tooltip
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import PageLoading from '@/components/PageLoading';

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
  { name: 'Home', icon: Home },
  { name: 'Utensils', icon: Utensils },
  { name: 'Heart', icon: Heart },
  { name: 'TrendingUp', icon: TrendingUp }
];

const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B'];

// Salário e Despesas gerais (e equivalentes PT/EN/FR) — não podem ser editadas nem apagadas
const PROTECTED_SYSTEM_CATEGORY_NAMES = new Set([
  'Salário', 'Salary', 'Salaire',
  'Despesas gerais', 'General expenses', 'Dépenses générales',
]);
function isProtectedSystemCategory(name: string): boolean {
  return PROTECTED_SYSTEM_CATEGORY_NAMES.has((name || '').trim());
}

export default function CategoriesPage() {
  const { t, currency, formatCurrency } = useTranslation();
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
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
  const retriedOnce = useRef(false);

  // Filtrar stats para remover fundos de emergência e investimentos
  const filteredStats = stats.filter((stat) => {
    const category = categories.find(c => c.id === stat.category_id);
    return category && category.vault_type === 'none';
  });
  const sortedStats = [...filteredStats].sort(
    (a, b) => Math.abs(b.percentage) - Math.abs(a.percentage)
  );

  // Guardar acesso: apenas utilizadores Pro podem usar /categories
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/dashboard');
      return;
    }
    if (!isPro) {
      setToastMsg(
        t.dashboard?.transactions?.proRequiredMessage
          ?? 'Funcionalidade disponível apenas para utilizadores Pro. Atualiza o teu plano para gerir categorias.',
      );
      setToastType('error');
      setShowToast(true);
      const timeout = setTimeout(() => {
        router.replace('/dashboard');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [userLoading, user, isPro, router, t.dashboard]);

  useEffect(() => {
    fetchData();
  }, []);

  // Refetch quando o separador fica visível (resolve dados em branco no mobile ao navegar)
  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Refetch quando se navega para esta página pelo header/sidebar (corrige conteúdo em branco)
  useEffect(() => {
    const onRouteChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pathname?: string };
      if (detail?.pathname === '/categories') fetchData();
    };
    window.addEventListener('dashboard-route-change', onRouteChange);
    return () => window.removeEventListener('dashboard-route-change', onRouteChange);
  }, []);

  // Se ainda não temos dados e não estamos a carregar (ex.: primeiro paint atrasado no mobile), tentar refetch uma vez
  useEffect(() => {
    if (!loading && categories.length === 0 && stats.length === 0 && !retriedOnce.current) {
      retriedOnce.current = true;
      const t = setTimeout(() => fetchData(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, categories.length, stats.length]);

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

  if ((loading && categories.length === 0) || userLoading || !user || !isPro) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg mb-3">
            <Layers size={12} className="text-blue-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.categories.title}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white mb-1">
            {t.dashboard.categories.title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium italic">
            {t.dashboard.categories.subtitle}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setFormData({ name: '', nature: 'expense', monthly_limit: '', color_hex: COLORS[0], icon: 'Tag' });
            setShowAddModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0 w-full sm:w-auto"
        >
          <Plus size={16} className="shrink-0" />
          <span>{t.dashboard.categories.addNew}</span>
        </button>
      </div>

      {/* Vault Info Header */}
      <AnimatePresence>
        {categories.some(c => c.vault_type !== 'none') && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 sm:p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center shrink-0">
              <Landmark size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-white mb-0.5">{t.dashboard.categories.activeVault}</h3>
              <p className="text-[10px] text-slate-400 font-medium italic truncate">{t.dashboard.categories.activeVaultText}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* Left: Charts & Stats */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 md:space-y-8">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <PieChart size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {t.dashboard.categories.statsTitle}
              </h3>
            </div>

            {filteredStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center">
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
        </div>

        {/* Right: Zen Tips & Legend */}
        <div className="space-y-4">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Sparkles size={14} className="text-blue-400" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t.dashboard.categories.masterTip}</h3>
            </div>
            <p className="text-slate-300 font-medium italic text-xs leading-relaxed">
              "{t.dashboard.categories.masterTipText}"
            </p>
          </div>

          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Target size={13} className="text-amber-400" />
              </div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Alvos este Mês
              </h4>
            </div>
            <div className="space-y-3">
              {stats.filter((s) => {
                const category = categories.find(c => c.id === s.category_id);
                return category && category.vault_type === 'none';
              }).slice(0, 3).map((s) => (
                <div key={s.category_id} className="flex items-center gap-3 p-2 bg-slate-950/40 rounded-lg border border-slate-700/20">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${s.color}15`, color: s.color }}
                  >
                    {(() => {
                      const Icon = getIconComponent(s.icon);
                      return <Icon size={16} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{s.name}</p>
                    <p className="text-[9px] text-slate-500 font-bold">{s.count} {t.dashboard.categories.transactions}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Minhas Gavetas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Tag size={13} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Minhas Gavetas</h3>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 border border-slate-700/50 rounded-md text-slate-400">{categories.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode && selectedIds.length > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-600/20 cursor-pointer"
              >
                {isBulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                ({selectedIds.length})
              </button>
            )}
            <button
              onClick={toggleSelectionMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 border cursor-pointer ${
                isSelectionMode 
                  ? 'bg-blue-600 border-blue-500 text-white' 
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {isSelectionMode ? <X size={12} /> : <Check size={12} />}
              {isSelectionMode ? t.dashboard.categories.cancelSelection : t.dashboard.categories.selectCategories}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((cat, catIdx) => {
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
              
              const isProtected = cat.is_default || isProtectedSystemCategory(cat.name) ||
                (cat.vault_type === 'investment' && ['INVESTIMENTO', 'INVESTIMENTOS'].includes(cat.name.toUpperCase())) ||
                (cat.vault_type === 'emergency' && ['FUNDO DE EMERGÊNCIA', 'FUNDO DE EMERGENCIA'].includes(cat.name.toUpperCase()));
              const isSystemLocked = isProtectedSystemCategory(cat.name);
              
              const isSelected = selectedIds.includes(cat.id);

              return (
                <motion.div
                  key={cat.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIdx * 0.02 }}
                  onClick={() => toggleSelect(cat.id, isProtected)}
                  className={`group relative bg-slate-900/70 backdrop-blur-md border rounded-2xl p-4 transition-all ${
                    isSelectionMode && !isProtected ? 'cursor-pointer hover:border-blue-500/40' : ''
                  } ${
                    isSelected ? 'border-blue-500 bg-blue-500/[0.05] ring-1 ring-blue-500/20' : 
                    isDanger 
                      ? 'border-red-500/40 bg-red-500/[0.02]' 
                      : 'border-slate-700/60 hover:border-slate-600/80 shadow-xl'
                  } ${isSelectionMode && isProtected ? 'opacity-40 grayscale-[0.5]' : ''}`}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md z-20">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  {isDanger && (
                    <div className="absolute -top-2 right-4 bg-red-600 text-white text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md">
                      {isExceeded ? t.dashboard.categories.dangerLimitExceeded : t.dashboard.categories.warningLimitReached}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105"
                        style={{ backgroundColor: cat.color_hex }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                          {cat.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {cat.vault_type === 'none' && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${cat.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {cat.type === 'expense' ? t.dashboard.categories.expense : t.dashboard.categories.income}
                            </span>
                          )}
                          {cat.vault_type !== 'none' && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                              {cat.vault_type === 'investment' ? t.dashboard.categories.investment : t.dashboard.categories.emergencyFundLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isSelectionMode && (
                        <>
                          {isSystemLocked ? (
                            <span className="p-1.5 text-slate-500 rounded-lg" title={t.dashboard.categories.protectedCategoryTooltip}>
                              <Lock size={14} />
                            </span>
                          ) : (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                              className="p-1.5 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                              aria-label={t.dashboard.categories.edit}
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {!isProtected ? (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); }}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-500/30"
                              aria-label={t.dashboard.categories.deleteConfirm ?? 'Eliminar categoria'}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : isSystemLocked ? (
                            <span className="p-1.5 text-slate-500 rounded-lg" title={t.dashboard.categories.protectedCategoryTooltip}>
                              <Lock size={14} />
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {cat.type === 'expense' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">{t.dashboard.categories.spent}</span>
                        <span className="text-white tabular-nums">{formatCurrency(Math.abs(stat?.total_spent_cents || 0) / 100)}</span>
                      </div>
                      
                      {cat.monthly_limit_cents > 0 && (
                        <>
                          <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(progress, 100)}%` }}
                              className={`h-full rounded-full ${
                                isDanger ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                                isWarning ? 'bg-gradient-to-r from-orange-500 to-amber-400' : 
                                'bg-gradient-to-r from-blue-500 to-blue-400'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-bold">
                            <div className="flex items-center gap-1">
                              {isDanger && <AlertCircle size={9} className="text-red-500" />}
                              <span className={isDanger ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-slate-500'}>
                                {Math.round(progress)}% {isExceeded ? t.dashboard.categories.limitExceeded : isAtLimit ? t.dashboard.categories.limitReached : t.dashboard.categories.ofLimit}
                              </span>
                            </div>
                            <span className="text-slate-500 tabular-nums">{formatCurrency(cat.monthly_limit_cents / 100)}</span>
                          </div>

                          {isDanger && (
                            <motion.p 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[9px] font-bold text-red-400 italic pt-1.5 border-t border-red-500/10 flex justify-between items-center"
                            >
                              <span>{isExceeded ? t.dashboard.categories.budgetExceeded : t.dashboard.categories.budgetReached}</span>
                              {isExceeded && <span className="text-xs font-black tabular-nums">{formatCurrency(overAmount / 100)}</span>}
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

      {/* Add/Edit Modal — estilo alinhado ao login/dashboard */}
      <AnimatePresence>
        {showAddModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 pt-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] sm:pt-4"
            style={{
              paddingLeft: 'max(1rem, env(safe-area-inset-left))',
              paddingRight: 'max(1rem, env(safe-area-inset-right))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative w-full max-w-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 md:p-8 relative z-10">
                <div className="flex justify-between items-center mb-5 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                    {editingCategory ? t.dashboard.categories.edit : t.dashboard.categories.addNew}
                  </h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                  {/* Icon Selection - 5 ícones */}
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Escolhe o ícone</label>
                    <div className="flex gap-4">
                      {AVAILABLE_ICONS.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: item.name })}
                          className={`group p-4 rounded-xl transition-all cursor-pointer relative overflow-hidden ${
                            formData.icon === item.name 
                              ? 'bg-blue-600 text-white shadow-lg scale-110' 
                              : 'bg-slate-950/60 text-slate-500 border border-slate-700 hover:border-slate-600 hover:text-slate-300'
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

                  <div className="space-y-6 sm:space-y-8">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.categories.name}</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                        placeholder={t.dashboard.categories.namePlaceholder || "Category name"}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.categories.nature}</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'expense', label: t.dashboard.categories.expense, icon: TrendingUp, color: 'text-red-400' },
                          { id: 'income', label: t.dashboard.categories.income, icon: Landmark, color: 'text-emerald-400' },
                        ].map((nature) => (
                          <button
                            key={nature.id}
                            type="button"
                            disabled={editingCategory ? (editingCategory.vault_type !== 'none') : false}
                            onClick={() => setFormData({ ...formData, nature: nature.id as any })}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                              formData.nature === nature.id 
                                ? 'bg-slate-800/60 border-blue-500/50' 
                                : 'bg-slate-950/60 border-slate-700 hover:border-slate-600 opacity-60 hover:opacity-100'
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

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.categories.limit} (Opcional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                          {currency === 'EUR' ? '€' : currency === 'BRL' ? 'R$' : '$'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.monthly_limit}
                          onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-8 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Color Selection - 5 cores (+ cor atual ao editar) */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.categories.color}</label>
                      <div className="flex flex-wrap gap-4">
                        {(() => {
                          const colorsToShow = [...COLORS];
                          if (editingCategory?.color_hex && !colorsToShow.includes(editingCategory.color_hex)) {
                            colorsToShow.unshift(editingCategory.color_hex);
                          }
                          return colorsToShow;
                        })().map((c) => (
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
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {editingCategory ? t.dashboard.categories.saveChanges : t.dashboard.categories.createNew}
                    <ArrowRight size={18} />
                  </button>
                  {editingCategory && !isProtectedSystemCategory(editingCategory.name) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryToDelete(editingCategory);
                        setShowAddModal(false);
                        setEditingCategory(null);
                      }}
                      className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Eliminar categoria
                    </button>
                  )}
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
