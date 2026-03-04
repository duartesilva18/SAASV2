'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { 
  Plus, Search, ArrowUpRight, ArrowDownRight, 
  Calendar, Tag, History, Check, X, Wallet, 
  ChevronDown, Sparkles, Activity, CreditCard,
  Edit2, Trash2, Info, Filter, SearchX,
  ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { TransactionSkeleton } from '@/components/LoadingSkeleton';
import PageLoading from '@/components/PageLoading';
import { useTransactions, useCategories, useDebouncedValue } from '@/lib/hooks';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/LoadingSkeleton';

const TransactionChartsPanel = dynamic(
  () => import('@/components/TransactionChartsPanel'),
  { ssr: false, loading: () => <div className="space-y-6 lg:space-y-8"><ChartSkeleton /><ChartSkeleton /></div> }
);

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

function TransactionsPageContent() {
  const { t, formatCurrency, currency } = useTranslation();
  const router = useRouter();
  const { user, isPro, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const { transactions: transactionsFromHook, isLoading: transactionsLoading, mutate: mutateTransactions } = useTransactions();
  const { categories: categoriesFromHook, isLoading: categoriesLoading, mutate: mutateCategories } = useCategories();
  const transactions = (transactionsFromHook as Transaction[] | undefined) ?? [];
  const categories = (categoriesFromHook as Category[] | undefined) ?? [];
  const loading = transactionsLoading || categoriesLoading;

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [evolutionPeriod, setEvolutionPeriod] = useState<'weekly' | 'daily'>('weekly');
  const itemsPerPage = 13;
  
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
 
  const [formData, setFormData] = useState({
    transaction_type: '' as '' | 'income' | 'expense',
    amount: '',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const refetchData = useMemo(() => () => {
    mutateTransactions();
    mutateCategories();
  }, [mutateTransactions, mutateCategories]);

  // Guardar acesso: apenas utilizadores Pro podem usar /transactions
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      // Sem sessão → manda para login/dashboard conforme fluxo global
      router.replace('/dashboard');
      return;
    }
    if (!isPro) {
      // Mostrar alerta bonito e redirecionar para o dashboard
      setToastInfo({
        message: t.dashboard?.transactions?.proRequiredMessage 
          ?? 'Funcionalidade disponível apenas para utilizadores Pro. Atualiza o teu plano para aceder às transações.',
        type: 'error',
        isVisible: true,
      });
      const timeout = setTimeout(() => {
        router.replace('/dashboard');
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [userLoading, user, isPro, router]);

  // Atualizar dados a cada 60s apenas quando o separador está visível
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refetchData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [refetchData]);

  // Refetch quando se navega para esta página pelo header/sidebar (corrige conteúdo em branco)
  useEffect(() => {
    const onRouteChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pathname?: string };
      if (detail?.pathname === '/transactions') refetchData();
    };
    window.addEventListener('dashboard-route-change', onRouteChange);
    return () => window.removeEventListener('dashboard-route-change', onRouteChange);
  }, [refetchData]);

  // Verificar parâmetros de URL: ?add=1 abre o modal de inserção (ex.: vindo do dashboard "Nova transação")
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setShowAddModal(true);
      setEditingTransaction(null);
      setFormData({ transaction_type: '' as '' | 'income' | 'expense', amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
      window.history.replaceState({}, '', '/transactions');
      return;
    }
  }, [searchParams]);

  // Verificar parâmetros de URL para abrir modal de cofre
  useEffect(() => {
    const action = searchParams.get('action');
    const categoryId = searchParams.get('category');
    const type = searchParams.get('type');
    
    if (action && categoryId && type === 'vault' && categories.length > 0) {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        setFormData(prev => ({
          ...prev,
          transaction_type: category.type as 'income' | 'expense',
          category_id: categoryId,
          description: action === 'add' ? `${t.dashboard.transactions.depositIn} ${category.name}` : `${t.dashboard.transactions.withdrawalFrom} ${category.name}`
        }));
        setShowAddModal(true);
        // Limpar URL
        window.history.replaceState({}, '', '/transactions');
      }
    }
  }, [searchParams, categories, t.dashboard.transactions.depositIn, t.dashboard.transactions.withdrawalFrom]);

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => {
        const cat = categories.find(c => c.id === tx.category_id);
        const matchesSearch = tx.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        
        let transactionType: 'income' | 'expense' | null = null;
        if (cat) transactionType = cat.type;
        else transactionType = tx.amount_cents > 0 ? 'income' : 'expense';
        
        const matchesTab = activeTab === 'all' || transactionType === activeTab;
        const matchesCategory = selectedCategory === 'all' || tx.category_id === selectedCategory;
        return matchesSearch && matchesTab && matchesCategory;
      });
  }, [transactions, categories, debouncedSearchTerm, activeTab, selectedCategory]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, activeTab, selectedCategory]);

  const stats = useMemo(() => {
    // Backend garante sinais corretos: income > 0, expense < 0
    // Se não houver categoria, usar sinal do amount_cents
    // Calcular com TODAS as transações (não apenas filtradas)
    const income = transactions
      .filter(t => {
        const cat = categories.find(c => c.id === t.category_id);
        if (cat) {
          return cat.type === 'income' && cat.vault_type === 'none'; // Excluir vault
        } else {
          // Sem categoria: usar sinal do amount_cents
          return t.amount_cents > 0;
        }
      })
      .reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents), 0) / 100; // Usar valor absoluto para segurança
    
    // Despesas são negativas, converter para positivo
    const expenses = transactions
      .filter(t => {
        const cat = categories.find(c => c.id === t.category_id);
        if (cat) {
          return cat.type === 'expense' && cat.vault_type === 'none'; // Excluir vault
        } else {
          // Sem categoria: usar sinal do amount_cents
          return t.amount_cents < 0;
        }
      })
      .reduce((acc: number, curr: any) => acc + Math.abs(curr.amount_cents), 0) / 100; // Usar valor absoluto
    
    return { income, expenses, balance: income - expenses };
  }, [transactions, categories]);

  const categoriesByType = useMemo(() => {
    if (formData.transaction_type === 'income') {
      return categories.filter(c => c.type === 'income' || (c.type === 'expense' && c.vault_type !== 'none'));
    }
    if (formData.transaction_type === 'expense') {
      return categories.filter(c => c.type === 'expense');
    }
    return [];
  }, [formData.transaction_type, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Normalizar valor para suportar vírgula e ponto
      const normalizedAmount = formData.amount.replace(',', '.');
      const parsedAmount = parseFloat(normalizedAmount);

      // Validar que o valor foi inserido
      if (!formData.amount || formData.amount.trim() === '' || isNaN(parsedAmount) || parsedAmount <= 0) {
        setToastInfo({ message: t.dashboard.transactions.validation.invalidAmount, type: 'error', isVisible: true });
        return;
      }

      // Validar que o tipo foi selecionado (receita vs despesa)
      if (!formData.transaction_type) {
        setToastInfo({ message: (t.dashboard.transactions.validation as any)?.noType ?? 'Seleciona o tipo (receita ou despesa).', type: 'error', isVisible: true });
        return;
      }

      // Validar que uma categoria foi selecionada
      if (!formData.category_id || formData.category_id === '') {
        setToastInfo({ message: t.dashboard.transactions.validation.noCategory, type: 'error', isVisible: true });
        return;
      }

      const selectedDate = new Date(formData.transaction_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate > today) {
        setToastInfo({ message: t.dashboard.transactions.validation.invalidDate, type: 'error', isVisible: true });
        return;
      }

      // Verificar se a categoria selecionada existe
      const selectedCategory = categories.find(c => c.id === formData.category_id);
      if (!selectedCategory) {
        setToastInfo({ message: t.dashboard.transactions.validation.invalidCategory, type: 'error', isVisible: true });
        return;
      }

      // Debug: verificar categoria selecionada
      console.log('Categoria selecionada:', selectedCategory.name, 'Tipo:', selectedCategory.type, 'ID:', formData.category_id);

      // REGRA ÚNICA DE SINAIS (respeitando validação do backend):
      // income regular → amount_cents > 0 (OBRIGATÓRIO)
      // expense regular → amount_cents < 0 (OBRIGATÓRIO)
      // vault deposit → amount_cents > 0 (independente do type)
      // vault withdraw → amount_cents < 0 (independente do type)
      
      let amount_cents = Math.round(parsedAmount * 100);
      const isVaultCategory = selectedCategory.vault_type !== 'none';
      
      // Determinar sinal baseado no tipo da categoria
      if (isVaultCategory) {
        // Para vault: o sinal determina depósito (positivo) vs resgate (negativo)
        // Por padrão: type='expense' = depósito (positivo), type='income' = resgate (negativo)
        if (selectedCategory.type === 'income') {
          // Resgate de vault: negativo
          amount_cents = -Math.abs(amount_cents);
        } else {
          // Depósito em vault: positivo
          amount_cents = Math.abs(amount_cents);
        }
      } else if (selectedCategory.type === 'income') {
        // Receita regular: sempre positiva
        amount_cents = Math.abs(amount_cents);
      } else if (selectedCategory.type === 'expense') {
        // Despesa regular: sempre negativa
        amount_cents = -Math.abs(amount_cents);
      }
      
      // Se é resgate de vault (amount negativo e categoria de vault), verificar saldo disponível
      // REGRA: depósito = amount_cents > 0, resgate = amount_cents < 0
      if (isVaultCategory && amount_cents < 0) {
        // Calcular saldo atual do vault
        const vaultTransactions = transactions.filter(t => {
          const cat = categories.find(c => c.id === t.category_id);
          return cat && cat.id === selectedCategory.id;
        });
        
        // Calcular saldo: depósitos (positivos) aumentam, resgates (negativos) diminuem
        const vaultBalance = vaultTransactions.reduce((balance: number, t: any) => {
          if (t.amount_cents > 0) {
            return balance + t.amount_cents; // Depósito (já é positivo)
          } else {
            return balance - Math.abs(t.amount_cents); // Resgate (subtrair valor absoluto)
          }
        }, 0);
        
        const withdrawalAmount = Math.abs(amount_cents);
        if (withdrawalAmount > vaultBalance) {
          const available = (vaultBalance / 100).toFixed(2);
          setToastInfo({ 
            message: `${t.dashboard.vault.insufficientBalance}\n\n${t.dashboard.vault.available} ${formatCurrency(parseFloat(available))}`, 
            type: 'error', 
            isVisible: true 
          });
          return;
        }
      }

      // Garantir que category_id é null se vazio, e validar formato
      const categoryId = formData.category_id && formData.category_id.trim() !== '' 
        ? formData.category_id 
        : null;

      // Validar que amount_cents não é zero
      if (amount_cents === 0) {
        setToastInfo({ message: t.dashboard.transactions.zeroAmount, type: 'error', isVisible: true });
        return;
      }

      // Validar formato da data
      if (!formData.transaction_date) {
        setToastInfo({ message: t.dashboard.transactions.validation.noDate, type: 'error', isVisible: true });
        return;
      }

      const payload = {
        amount_cents: amount_cents,
        description: formData.description || null,
        category_id: categoryId,
        transaction_date: formData.transaction_date,
        is_installment: false
      };

      console.log('Payload enviado:', payload);

      if (editingTransaction) {
        await api.patch(`/transactions/${editingTransaction.id}`, payload);
        setToastInfo({ message: t.dashboard.transactions.updateSuccess, type: 'success', isVisible: true });
      } else {
        await api.post('/transactions/', payload);
        setToastInfo({ message: t.dashboard.transactions.success, type: 'success', isVisible: true });
      }

      setShowAddModal(false);
      setEditingTransaction(null);
      setSelectedTransaction(null); // Reset selection
      setFormData({
        transaction_type: '' as '' | 'income' | 'expense',
        amount: '',
        description: '',
        category_id: '',
        transaction_date: new Date().toISOString().split('T')[0]
      });
      // Atualizar dados imediatamente após criar/editar
      refetchData();
    } catch (err: any) {
      console.error('Erro ao processar transação:', err);
      console.error('Resposta do erro:', err.response?.data);
      
      // Extrair mensagem de erro mais específica
      let errorMessage = "Erro ao processar transação.";
      
      if (err.response?.status === 422) {
        // Erro de validação - tentar extrair detalhes
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          // Pydantic retorna array de erros
          const firstError = detail[0];
          if (firstError?.loc && firstError?.msg) {
            const field = firstError.loc[firstError.loc.length - 1];
            errorMessage = `Erro no campo ${field}: ${firstError.msg}`;
          } else {
            errorMessage = detail.map((e: any) => e.msg || e).join(', ');
          }
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (detail) {
          errorMessage = JSON.stringify(detail);
        }
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.detail || t.dashboard.transactions.error;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }
      
      setToastInfo({ message: errorMessage, type: 'error', isVisible: true });
    }
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const transactionId = String(transactionToDelete).trim();
      await api.delete(`/transactions/${transactionId}`);
      setSelectedTransaction(null);
      refetchData();
      setToastInfo({ message: t.dashboard.transactions.deleteSuccess, type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Erro ao eliminar transação:', err);
      const errorMessage = err.response?.data?.detail || err.message || t.dashboard.transactions.deleteError;
      setToastInfo({ message: errorMessage, type: 'error', isVisible: true });
    } finally {
      setIsDeleting(false);
      setTransactionToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await api.post('/transactions/bulk-delete', { ids });
      setSelectedIds(new Set());
      refetchData();
      const msg = (t.dashboard.transactions as any).bulkDeleteSuccess
        ?? `${ids.length} transações eliminadas.`;
      setToastInfo({ message: msg, type: 'success', isVisible: true });
    } catch (err: any) {
      console.error('Erro ao eliminar transações em massa:', err);
      const errorMessage = err.response?.data?.detail || err.message || t.dashboard.transactions.deleteError;
      setToastInfo({ message: errorMessage, type: 'error', isVisible: true });
    } finally {
      setIsDeleting(false);
      setBulkDeleteConfirm(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedTransactions.map(tx => tx.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    const category = categories.find(c => c.id === t.category_id);
    const transactionType: '' | 'income' | 'expense' = category
      ? category.type
      : (t.amount_cents >= 0 ? 'income' : 'expense');
    setFormData({
      transaction_type: transactionType,
      amount: Math.abs(t.amount_cents / 100).toString(),
      description: t.description,
      category_id: t.category_id,
      transaction_date: t.transaction_date
    });
    setSelectedTransaction(null); // FECHAR O MODAL DE DETALHES
    setShowAddModal(true);
  };

  if (loading || userLoading || !user || !isPro) {
    return <PageLoading />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="w-full space-y-12 pb-20 px-4 md:px-6 lg:px-8"
    >
      {/* Hero Header */}
      <section className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg mb-3">
              <Sparkles size={12} className="text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t.dashboard.transactions.yourAbundanceDiary}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white mb-1">
              {t.dashboard.transactions.activityRecord}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium italic">{t.dashboard.transactions.activity}</p>
          </div>
          <button
            onClick={() => {
              setEditingTransaction(null);
              setFormData({ transaction_type: '' as '' | 'income' | 'expense', amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-blue-600/20 shrink-0 w-full sm:w-auto"
          >
            <Plus size={16} className="shrink-0" />
            <span>{t.dashboard.transactions.addNew}</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight size={14} className="text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.totalIncome}</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums truncate">{formatCurrency(stats.income)}</p>
          </div>
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ArrowDownRight size={14} className="text-red-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.totalExpenses}</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-red-400 tabular-nums truncate">{formatCurrency(stats.expenses)}</p>
          </div>
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl shadow-2xl col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${(stats.income - stats.expenses) >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <Wallet size={14} className={(stats.income - stats.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Balanço</span>
            </div>
            <p className={`text-lg sm:text-xl font-black tabular-nums truncate ${(stats.income - stats.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(stats.income - stats.expenses) >= 0 ? '+' : ''}{formatCurrency(stats.income - stats.expenses)}
            </p>
          </div>
        </div>
      </section>

      {/* Filters & Search */}
      <section className="bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-slate-950/60 border border-slate-700/50 rounded-xl p-1 shrink-0">
            {(['all', 'income', 'expense'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab 
                  ? tab === 'income' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : tab === 'expense' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'all' ? t.dashboard.transactions.filters.allLabel : tab === 'income' ? t.dashboard.transactions.filters.income : t.dashboard.transactions.filters.expense}
              </button>
            ))}
          </div>

          {/* Search & Category filter */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 group">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder={t.dashboard.transactions.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-blue-500/40 transition-all outline-none font-medium text-sm"
              />
            </div>
            <div className="relative sm:min-w-[180px]">
              <Tag size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-8 text-sm text-white appearance-none focus:border-blue-500/40 transition-all outline-none font-medium cursor-pointer"
              >
                <option value="all">{t.dashboard.transactions.allCategories}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-lg w-fit">
          <Info size={12} className="text-blue-400 shrink-0" />
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {t.dashboard.transactions.zenTip} <span className="text-blue-400">{t.dashboard.transactions.zenTipText.split('Clica em qualquer linha')[0]}</span>{t.dashboard.transactions.zenTipText.split('Clica em qualquer linha')[1]}
          </p>
        </div>
      </section>

      {/* Transactions List & Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 items-start">
        {/* Left: Transactions Table (desktop) / Cards (mobile) */}
        <section className="xl:col-span-2 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl h-fit">

        {/* Bulk action bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
                <span className="text-xs font-bold text-red-400">
                  {selectedIds.size} {(t.dashboard.transactions as any).selectedCount ?? 'selecionadas'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition-colors cursor-pointer"
                  >
                    {(t.dashboard.transactions as any).clearSelection ?? 'Limpar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-white bg-red-500/20 hover:bg-red-600 border border-red-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    {(t.dashboard.transactions as any).deleteSelected ?? 'Eliminar selecionadas'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile: card list */}
        <div className="md:hidden px-3 py-3 space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-slate-800/80 rounded-xl flex items-center justify-center mb-4 border border-slate-700/50">
                <SearchX size={24} className="text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{t.dashboard.transactions.noResultsTitle}</h3>
              <p className="text-slate-500 text-xs font-medium italic max-w-xs mx-auto">{t.dashboard.transactions.noResultsHint}</p>
            </div>
          ) : (
            <>
              {paginatedTransactions.map((transaction, i) => {
                const cat = categories.find(c => c.id === transaction.category_id);
                const isIncome = cat && cat.vault_type !== 'none'
                  ? transaction.amount_cents > 0
                  : (cat ? cat.type === 'income' : transaction.amount_cents > 0);
                const isChecked = selectedIds.has(transaction.id);
                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`flex items-center gap-2 bg-slate-950/50 hover:bg-slate-800/60 border rounded-xl p-3 transition-all touch-manipulation ${isChecked ? 'border-red-500/40 bg-red-500/5' : 'border-slate-700/30 hover:border-slate-600/50'}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelectId(transaction.id)}
                      className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isChecked ? 'bg-red-500 border-red-500 text-white' : 'border-slate-600 hover:border-slate-400'}`}
                    >
                      {isChecked && <Check size={12} strokeWidth={3} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTransaction(transaction)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{transaction.description}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] font-bold text-slate-500">
                                {new Date(transaction.transaction_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="text-slate-700">·</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                                <span className="text-[9px] font-bold text-slate-500 truncate">{cat?.name || t.dashboard.transactions.noCategory}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className={`text-sm font-black shrink-0 tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount_cents) / 100)}
                        </span>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
              {filteredTransactions.length > itemsPerPage && (
                <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-700/30">
                  <p className="text-[9px] font-bold text-slate-500 tabular-nums">
                    {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} / {filteredTransactions.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1.5 rounded-lg border border-slate-700/50 text-slate-500 hover:text-white disabled:opacity-30 transition-all cursor-pointer touch-manipulation">
                      <ChevronDown size={14} className="rotate-90" />
                    </button>
                    <span className="text-[10px] font-bold text-white px-2 tabular-nums">{currentPage}/{totalPages}</span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="p-1.5 rounded-lg border border-slate-700/50 text-slate-500 hover:text-white disabled:opacity-30 transition-all cursor-pointer touch-manipulation">
                      <ChevronDown size={14} className="-rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop: tabela com paginação */}
        <div className="hidden md:block overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700/40">
                  <th className="pl-4 pr-1 py-3 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                        paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id))
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id)) && <Check size={12} strokeWidth={3} />}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.table.date}</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.table.description}</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">{t.dashboard.transactions.table.category}</th>
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 text-right">{t.dashboard.transactions.table.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/20">
                <AnimatePresence mode="popLayout">
                  {paginatedTransactions.map((transaction, index) => {
                    const cat = categories.find(c => c.id === transaction.category_id);
                    const isIncome = cat && cat.vault_type !== 'none'
                      ? transaction.amount_cents > 0
                      : (cat ? cat.type === 'income' : transaction.amount_cents > 0);
                    const isChecked = selectedIds.has(transaction.id);
                    return (
                      <motion.tr 
                        key={transaction.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group hover:bg-white/[0.03] transition-colors cursor-pointer ${isChecked ? 'bg-red-500/5' : ''}`}
                      >
                        <td className="pl-4 pr-1 py-3.5 w-10">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelectId(transaction.id); }}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${isChecked ? 'bg-red-500 border-red-500 text-white' : 'border-slate-600 hover:border-slate-400'}`}
                          >
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </button>
                        </td>
                        <td className="px-5 py-3.5" onClick={() => setSelectedTransaction(transaction)}>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white tabular-nums">{new Date(transaction.transaction_date).getDate()}</span>
                            <span className="text-[9px] font-bold uppercase text-slate-500">
                              {new Date(transaction.transaction_date).toLocaleString('default', { month: 'short' })} {new Date(transaction.transaction_date).getFullYear()}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5" onClick={() => setSelectedTransaction(transaction)}>
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate max-w-[250px]">{transaction.description}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell" onClick={() => setSelectedTransaction(transaction)}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                            <span className="text-[10px] font-bold text-slate-400">{cat?.name || t.dashboard.transactions.noCategory}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={() => setSelectedTransaction(transaction)}>
                          <span className={`text-sm font-black tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount_cents) / 100)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          
          {filteredTransactions.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-slate-800/80 rounded-xl flex items-center justify-center mb-4 border border-slate-700/50">
                <SearchX size={24} className="text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{t.dashboard.transactions.noResultsTitle}</h3>
              <p className="text-slate-500 text-xs italic max-w-xs mx-auto">{t.dashboard.transactions.noResultsHint}</p>
            </div>
          )}
          </div>
        </div>

        {/* Pagination Controls (desktop) */}
        {filteredTransactions.length > itemsPerPage && (
          <div className="hidden md:flex px-5 py-3 border-t border-slate-700/30 items-center justify-between gap-4 bg-slate-950/20">
            <p className="text-[9px] font-bold text-slate-500 tabular-nums">
              {t.dashboard.transactions.paginationShowing} {(currentPage - 1) * itemsPerPage + 1} {t.dashboard.transactions.paginationTo} {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} {t.dashboard.transactions.paginationOf} {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1.5 rounded-lg border border-slate-700/50 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 transition-all cursor-pointer">
                <ChevronDown size={14} className="rotate-90" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                .map((page, index, array) => (
                  <div key={page} className="flex items-center gap-1">
                    {index > 0 && array[index - 1] !== page - 1 && <span className="text-slate-700 px-0.5 text-xs">…</span>}
                    <button onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${currentPage === page ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{page}</button>
                  </div>
                ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="p-1.5 rounded-lg border border-slate-700/50 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 transition-all cursor-pointer">
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}
        </section>

        {/* Right: Charts — ocupa 1/3 no xl; em ecrãs menores fica abaixo da tabela */}
        <TransactionChartsPanel
          transactions={transactions}
          categories={categories}
          evolutionPeriod={evolutionPeriod}
          setEvolutionPeriod={setEvolutionPeriod}
          formatCurrency={formatCurrency}
          noDataChart={t.dashboard.transactions.noDataChart}
          valueLabel={t.dashboard.transactions.value}
          incomeLabel={t.dashboard.analytics.income}
          expensesLabel={t.dashboard.analytics.expenses}
        />
      </div>

      {/* Add/Edit Modal — estilo alinhado ao login/dashboard */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-center mb-5 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                    {editingTransaction ? t.dashboard.transactions.editRecord : t.dashboard.transactions.newRecord}
                  </h2>
                  <button onClick={() => {
                    setShowAddModal(false);
                    setEditingTransaction(null);
                  }} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer -m-2">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t.dashboard.transactions.type ?? 'Tipo'}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, transaction_type: 'income', category_id: '' }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                          formData.transaction_type === 'income'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        <ArrowUpCircle size={18} className="shrink-0" />
                        {t.dashboard.transactions.filters?.income ?? 'Receitas'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, transaction_type: 'expense', category_id: '' }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                          formData.transaction_type === 'expense'
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        <ArrowDownCircle size={18} className="shrink-0" />
                        {t.dashboard.transactions.filters?.expense ?? 'Despesas'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.table.description}</label>
                    <div className="relative">
                      <Activity size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        required
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={t.dashboard.transactions.descriptionPlaceholder}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.value}</label>
                      <div className="relative">
                        <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          required
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.date}</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          required
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={formData.transaction_date}
                          onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t.dashboard.transactions.category}</label>
                    <div className="relative">
                      <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <select
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        disabled={!formData.transaction_type}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl py-2.5 sm:py-3 pl-10 pr-10 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {formData.transaction_type
                            ? t.dashboard.transactions.selectCategory
                            : (t.dashboard.transactions.selectTypeFirst ?? 'Seleciona primeiro o tipo acima')}
                        </option>
                        {formData.transaction_type === 'income' && (
                          <>
                            {categoriesByType.filter(c => c.type === 'income').map((c) => (
                              <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                            ))}
                            {categoriesByType.filter(c => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                              <option key={c.id} value={c.id} className="bg-slate-900">
                                {c.name} (Resgate)
                              </option>
                            ))}
                          </>
                        )}
                        {formData.transaction_type === 'expense' && (
                          <>
                            {categoriesByType.filter(c => c.vault_type === 'none').map((c) => (
                              <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                            ))}
                            {categoriesByType.filter(c => c.vault_type !== 'none').length > 0 && (
                              <optgroup label={t.dashboard.transactions.investmentsAndSavings} className="bg-slate-900">
                                {categoriesByType.filter(c => c.vault_type !== 'none').map((c) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        )}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    {/* Mostrar tipo da categoria selecionada para confirmação */}
                    {formData.category_id && (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const selectedCat = categories.find(c => c.id === formData.category_id);
                            if (selectedCat) {
                              const isIncomeOrResgate = selectedCat.type === 'income' || selectedCat.vault_type !== 'none';
                              
                              return (
                                <>
                                  <span className="text-slate-500">{t.dashboard.transactions.typeLabel}</span>
                                  <span className={`font-black uppercase tracking-widest ${
                                    isIncomeOrResgate ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {isIncomeOrResgate ? t.dashboard.categories.income : t.dashboard.categories.expense}
                                  </span>
                                  {selectedCat.vault_type !== 'none' && (
                                    <>
                                      <span className="text-slate-500">•</span>
                                      <span className="text-amber-400 font-black uppercase tracking-widest">
                                        {selectedCat.vault_type === 'investment' ? t.dashboard.vault.zenInvestments : t.dashboard.vault.emergencyFund}
                                      </span>
                                    </>
                                  )}
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {(() => {
                          const selectedCat = categories.find(c => c.id === formData.category_id);
                          if (selectedCat && selectedCat.vault_type === 'emergency') {
                            return (
                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-blue-400 text-[10px] font-medium">
                                💡 <strong>{t.dashboard.transactions.vaultTip}</strong> {t.dashboard.transactions.vaultTipText}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {editingTransaction ? t.dashboard.transactions.saveChanges : t.dashboard.transactions.registerTransaction}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransaction(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative w-full max-w-sm bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              {(() => {
                const cat = categories.find(c => c.id === selectedTransaction.category_id);
                const isIncome = cat && cat.vault_type !== 'none'
                  ? selectedTransaction.amount_cents > 0
                  : (cat ? cat.type === 'income' : selectedTransaction.amount_cents > 0);
                return (
                  <>
                    {/* Colored top strip */}
                    <div className={`h-1 w-full ${isIncome ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    
                    <div className="p-5">
                      {/* Close button */}
                      <button onClick={() => setSelectedTransaction(null)} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <X size={16} />
                      </button>

                      {/* Header */}
                      <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isIncome ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-bold text-white truncate">{selectedTransaction.description}</h2>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.dashboard.transactions.table.description}</p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3 bg-slate-950/50 border border-slate-700/30 rounded-xl p-4 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.value}</span>
                          <span className={`text-lg font-black tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(Math.abs(selectedTransaction.amount_cents) / 100)}
                          </span>
                        </div>
                        <div className="h-px bg-slate-700/30" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.date}</span>
                          <span className="text-sm font-bold text-white">{new Date(selectedTransaction.transaction_date).toLocaleDateString('pt-PT')}</span>
                        </div>
                        <div className="h-px bg-slate-700/30" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.dashboard.transactions.category}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                            <span className="text-sm font-bold text-white">{cat?.name || t.dashboard.transactions.noCategory}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleEdit(selectedTransaction)}
                          className="px-4 py-3 bg-slate-800/60 border border-slate-700/50 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-slate-700/60 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Edit2 size={13} /> {t.dashboard.transactions.editButton}
                        </button>
                        <button
                          onClick={() => setTransactionToDelete(selectedTransaction.id)}
                          className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Trash2 size={13} /> {t.dashboard.transactions.deleteButton}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal (single) */}
      <ConfirmModal
        isOpen={!!transactionToDelete}
        onClose={() => { if (!isDeleting) setTransactionToDelete(null); }}
        onConfirm={handleDelete}
        title={t.dashboard.transactions.deleteConfirm}
        message={t.dashboard.transactions.deleteConfirmText}
        confirmText={t.dashboard.transactions.delete}
        cancelText={t.dashboard.analytics.cancel}
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Confirm Bulk Delete Modal */}
      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        onClose={() => { if (!isDeleting) setBulkDeleteConfirm(false); }}
        onConfirm={handleBulkDelete}
        title={(t.dashboard.transactions as any).bulkDeleteConfirm ?? 'Eliminar várias transações?'}
        message={`${(t.dashboard.transactions as any).bulkDeleteConfirmText ?? 'Vais eliminar'} ${selectedIds.size} ${(t.dashboard.transactions as any).bulkDeleteConfirmSuffix ?? 'transações. Esta ação não pode ser desfeita.'}`}
        confirmText={`${(t.dashboard.transactions as any).bulkDeleteButton ?? 'Eliminar'} (${selectedIds.size})`}
        cancelText={t.dashboard.analytics.cancel}
        variant="danger"
        isLoading={isDeleting}
      />

      <Toast 
        message={toastInfo.message}
        type={toastInfo.type}
        isVisible={toastInfo.isVisible}
        onClose={() => setToastInfo({ ...toastInfo, isVisible: false })}
      />
    </motion.div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionSkeleton />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
