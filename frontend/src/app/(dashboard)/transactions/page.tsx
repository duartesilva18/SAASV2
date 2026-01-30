'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { 
  Plus, Search, ArrowUpRight, ArrowDownRight, 
  Calendar, Tag, History, Check, X, Wallet, 
  ChevronDown, Sparkles, Activity, CreditCard,
  Edit2, Trash2, Info, Filter, SearchX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { TransactionSkeleton } from '@/components/LoadingSkeleton';
import PageLoading from '@/components/PageLoading';
import { useTransactions, useCategories, useDebouncedValue } from '@/lib/hooks';
import dynamic from 'next/dynamic';
import { List } from 'react-window';
import { ChartSkeleton } from '@/components/LoadingSkeleton';

const TransactionChartsPanel = dynamic(
  () => import('@/components/TransactionChartsPanel'),
  { ssr: false, loading: () => <div className="space-y-6 lg:space-y-8"><ChartSkeleton /><ChartSkeleton /></div> }
);

const VIRTUALIZE_THRESHOLD = 30;
const ROW_HEIGHT = 72;
const VIRTUAL_LIST_HEIGHT = 400;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [evolutionPeriod, setEvolutionPeriod] = useState<'weekly' | 'daily'>('weekly');
  const itemsPerPage = 10;
  
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const refetchData = useMemo(() => () => {
    mutateTransactions();
    mutateCategories();
  }, [mutateTransactions, mutateCategories]);

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
      setFormData({ amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validar que o valor foi inserido
      if (!formData.amount || formData.amount.trim() === '' || parseFloat(formData.amount) <= 0) {
        setToastInfo({ message: t.dashboard.transactions.validation.invalidAmount, type: 'error', isVisible: true });
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
      
      let amount_cents = Math.round(parseFloat(formData.amount) * 100);
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
      // Garantir que o ID está no formato correto
      const transactionId = String(transactionToDelete).trim();
      console.log('Eliminando transação com ID:', transactionId);
      
      await api.delete(`/transactions/${transactionId}`);
      setToastInfo({ message: t.dashboard.transactions.deleteSuccess, type: 'success', isVisible: true });
      setTransactionToDelete(null);
      setSelectedTransaction(null);
      // Atualizar dados imediatamente após eliminar
      refetchData();
    } catch (err: any) {
      console.error('Erro ao eliminar transação:', err);
      console.error('ID da transação:', transactionToDelete);
      console.error('Resposta do erro:', err.response?.data);
      const errorMessage = err.response?.data?.detail || err.message || t.dashboard.transactions.deleteError;
      setToastInfo({ message: errorMessage, type: 'error', isVisible: true });
    } finally {
      setIsDeleting(false);
      setTransactionToDelete(null);
    }
  };

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setFormData({
      amount: (t.amount_cents / 100).toString(),
      description: t.description,
      category_id: t.category_id,
      transaction_date: t.transaction_date
    });
    setSelectedTransaction(null); // FECHAR O MODAL DE DETALHES
    setShowAddModal(true);
  };

  if (loading) {
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
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-6">
              <Sparkles size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{t.dashboard.transactions.yourAbundanceDiary}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-white leading-none">
              {t.dashboard.transactions.activityRecord} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic">{t.dashboard.transactions.activity}</span>
            </h1>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-3 sm:p-6 rounded-2xl sm:rounded-[32px] min-w-0 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/5 blur-[40px] rounded-full" />
              <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-2 text-slate-500">
                <ArrowUpRight size={14} className="text-emerald-500 shrink-0 sm:w-4 sm:h-4" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{t.dashboard.transactions.totalIncome}</span>
              </div>
              <p className="text-lg sm:text-3xl font-black text-white truncate" title={formatCurrency(stats.income)}>{formatCurrency(stats.income)}</p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-3 sm:p-6 rounded-2xl sm:rounded-[32px] min-w-0 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-red-500/5 blur-[40px] rounded-full" />
              <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-2 text-slate-500">
                <ArrowDownRight size={14} className="text-red-500 shrink-0 sm:w-4 sm:h-4" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{t.dashboard.transactions.totalExpenses}</span>
              </div>
              <p className="text-lg sm:text-3xl font-black text-white truncate" title={formatCurrency(stats.expenses)}>{formatCurrency(stats.expenses)}</p>
            </div>
            
            <button
              onClick={() => {
                setEditingTransaction(null);
                // Não pré-selecionar categoria - deixar o utilizador escolher
                setFormData({ amount: '', description: '', category_id: '', transaction_date: new Date().toISOString().split('T')[0] });
                setShowAddModal(true);
              }}
              className="flex items-center justify-center gap-3 px-6 sm:px-8 py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/30 group active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              {t.dashboard.transactions.addNew}
            </button>
          </div>
        </div>
      </section>

      {/* Filters & Search */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] p-4 sm:p-6 md:p-8">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-950/50 border border-slate-800 rounded-2xl p-1.5 w-full">
            {(['all', 'income', 'expense'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activeTab === tab 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'all' ? t.dashboard.transactions.filters.allLabel : tab === 'income' ? t.dashboard.transactions.filters.income : t.dashboard.transactions.filters.expense}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder={t.dashboard.transactions.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 sm:py-4 pl-14 pr-5 text-white placeholder:text-slate-800 focus:border-blue-500/50 transition-all outline-none font-medium text-sm"
              />
            </div>

            <div className="relative group w-full sm:min-w-[200px] sm:w-auto">
              <Tag size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 sm:py-4 pl-14 pr-10 text-white appearance-none focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer text-sm"
              >
                <option value="all">{t.dashboard.transactions.allCategories}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl w-fit">
          <Info size={14} className="text-blue-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t.dashboard.transactions.zenTip} <span className="text-blue-400">{t.dashboard.transactions.zenTipText.split('Clica em qualquer linha')[0]}</span>{t.dashboard.transactions.zenTipText.split('Clica em qualquer linha')[1]}
          </p>
        </div>
      </section>

      {/* Transactions List & Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Left: Transactions Table (desktop) / Cards (mobile) */}
        <section className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
        {/* Mobile: card list */}
        <div className="md:hidden px-4 py-4 space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-800">
                <SearchX size={28} className="text-slate-700 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">{t.dashboard.transactions.noResultsTitle}</h3>
              <p className="text-slate-500 text-xs font-medium italic max-w-xs mx-auto">
                {t.dashboard.transactions.noResultsHint}
              </p>
            </div>
          ) : (
            <>
              {paginatedTransactions.map((transaction) => {
                const cat = categories.find(c => c.id === transaction.category_id);
                const isIncome = cat && cat.vault_type !== 'none'
                  ? transaction.amount_cents > 0
                  : (cat ? cat.type === 'income' : transaction.amount_cents > 0);
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => setSelectedTransaction(transaction)}
                    className="w-full text-left bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 active:scale-[0.99] transition-all touch-manipulation"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            {new Date(transaction.transaction_date).getDate()} {new Date(transaction.transaction_date).toLocaleString('default', { month: 'short' })} {new Date(transaction.transaction_date).getFullYear()}
                          </span>
                          <span className="text-slate-600">·</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{cat?.name || t.dashboard.transactions.noCategory}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount_cents) / 100)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredTransactions.length > itemsPerPage && (
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center sm:text-left">
                    {t.dashboard.transactions.paginationShowing} <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}</span> {t.dashboard.transactions.paginationTo} <span className="text-white">{Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</span> {t.dashboard.transactions.paginationOf} <span className="text-white">{filteredTransactions.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer touch-manipulation"
                    >
                      <ChevronDown size={18} className="rotate-90" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                        .map((page, index, array) => (
                          <div key={page} className="flex items-center gap-1">
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="text-slate-700 px-1">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all cursor-pointer touch-manipulation ${
                                currentPage === page ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        ))}
                    </div>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer touch-manipulation"
                    >
                      <ChevronDown size={18} className="-rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop: table or virtualized list */}
        <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-4 sm:px-0">
            {filteredTransactions.length > VIRTUALIZE_THRESHOLD ? (
              <>
                <div className="grid grid-cols-[minmax(80px,1fr)_2fr_minmax(100px,1fr)_minmax(80px,1fr)] min-w-[600px] px-4 sm:px-6 md:px-8 py-4 border-b border-slate-800/50 bg-slate-900/20 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  <span>{t.dashboard.transactions.table.date}</span>
                  <span>{t.dashboard.transactions.table.description}</span>
                  <span className="hidden sm:inline">{t.dashboard.transactions.table.category}</span>
                  <span className="text-right">{t.dashboard.transactions.table.amount}</span>
                </div>
                <List
                  rowCount={filteredTransactions.length}
                  rowHeight={ROW_HEIGHT}
                  rowProps={{
                    transactions: filteredTransactions,
                    categories,
                    formatCurrency,
                    setSelectedTransaction,
                    noCategory: t.dashboard.transactions.noCategory,
                  }}
                  rowComponent={({ index, style, transactions: txList, categories: catList, formatCurrency: fmt, setSelectedTransaction: setSel, noCategory: noCat }) => {
                    const transaction = txList[index];
                    const cat = catList.find(c => c.id === transaction.category_id);
                    const isIncome = cat && cat.vault_type !== 'none'
                      ? transaction.amount_cents > 0
                      : (cat ? cat.type === 'income' : transaction.amount_cents > 0);
                    return (
                      <div
                        role="row"
                        style={style as React.CSSProperties}
                        onClick={() => setSel(transaction)}
                        className="grid grid-cols-[minmax(80px,1fr)_2fr_minmax(100px,1fr)_minmax(80px,1fr)] min-w-[600px] px-4 sm:px-6 md:px-8 py-4 border-b border-slate-800/30 cursor-pointer hover:bg-white/[0.02] transition-colors items-center gap-2"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white">{new Date(transaction.transaction_date).getDate()}</span>
                          <span className="text-[9px] font-black uppercase text-slate-600 tracking-tighter">
                            {new Date(transaction.transaction_date).toLocaleString('default', { month: 'short' })} {new Date(transaction.transaction_date).getFullYear()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{transaction.description}</p>
                          <div className="flex items-center gap-2 sm:hidden">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{cat?.name || noCat}</span>
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{cat?.name || noCat}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-black ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
                            {isIncome ? '+' : '-'}{fmt(Math.abs(transaction.amount_cents) / 100)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                  style={{ height: VIRTUAL_LIST_HEIGHT }}
                />
              </>
            ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{t.dashboard.transactions.table.date}</th>
                  <th className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{t.dashboard.transactions.table.description}</th>
                  <th className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hidden sm:table-cell">{t.dashboard.transactions.table.category}</th>
                  <th className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-right">{t.dashboard.transactions.table.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                <AnimatePresence mode="popLayout">
                  {paginatedTransactions.map((transaction, index) => {
                    const cat = categories.find(c => c.id === transaction.category_id);
                    return (
                      <motion.tr 
                        key={transaction.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <td className="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white">{new Date(transaction.transaction_date).getDate()}</span>
                            <span className="text-[9px] font-black uppercase text-slate-600 tracking-tighter">
                              {new Date(transaction.transaction_date).toLocaleString('default', { month: 'short' })} {new Date(transaction.transaction_date).getFullYear()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{transaction.description}</p>
                            <div className="flex items-center gap-2 sm:hidden">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{cat?.name || t.dashboard.transactions.noCategory}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 hidden sm:table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color_hex || '#3b82f6' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cat?.name || t.dashboard.transactions.noCategory}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-right">
                          {(() => {
                            const isIncome = cat && cat.vault_type !== 'none'
                              ? transaction.amount_cents > 0
                              : (cat ? cat.type === 'income' : transaction.amount_cents > 0);
                            return (
                              <span className={`text-sm font-black ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
                                {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount_cents) / 100)}
                              </span>
                            );
                          })()}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            )}
          
          {filteredTransactions.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-slate-800 shadow-2xl">
                <SearchX size={32} className="text-slate-700 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">{t.dashboard.transactions.noResultsTitle}</h3>
              <p className="text-slate-500 text-sm font-medium italic max-w-xs mx-auto">
                {t.dashboard.transactions.noResultsHint}
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Pagination Controls (desktop table) — apenas quando não virtualizado e há mais de uma página */}
        {filteredTransactions.length <= VIRTUALIZE_THRESHOLD && filteredTransactions.length > itemsPerPage && (
          <div className="hidden md:flex px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-t border-slate-800/50 flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center sm:text-left">
              {t.dashboard.transactions.paginationShowing} <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}</span> {t.dashboard.transactions.paginationTo} <span className="text-white">{Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</span> {t.dashboard.transactions.paginationOf} <span className="text-white">{filteredTransactions.length}</span>
            </p>
            
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronDown size={18} className="rotate-90" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Mostrar primeira, última, e páginas ao redor da atual
                    return page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                  })
                  .map((page, index, array) => (
                    <div key={page} className="flex items-center gap-1">
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="text-slate-700 px-1">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          currentPage === page 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  ))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronDown size={18} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}
        </section>

        {/* Right: Charts — lazy-loaded para reduzir bundle inicial */}
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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full -z-10" />
              
              <div className="p-8 lg:p-12">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-black text-white tracking-tighter">
                    {editingTransaction ? t.dashboard.transactions.editRecord : t.dashboard.transactions.newRecord}
                  </h2>
                  <button onClick={() => {
                    setShowAddModal(false);
                    setEditingTransaction(null);
                  }} className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.table.description}</label>
                    <div className="relative group">
                      <Activity size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        required
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={t.dashboard.transactions.descriptionPlaceholder}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white placeholder:text-slate-800 focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.value}</label>
                      <div className="relative group">
                        <Wallet size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.date}</label>
                      <div className="relative group">
                        <Calendar size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                        <input
                          required
                          type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={formData.transaction_date}
                          onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-5 text-white focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">{t.dashboard.transactions.category}</label>
                    <div className="relative group">
                      <Tag size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                      <select
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-5 pl-14 pr-10 text-white appearance-none focus:border-blue-500/50 transition-all outline-none font-medium cursor-pointer"
                      >
                        <option value="">{t.dashboard.transactions.selectCategory}</option>
                        {/* Separar receitas e despesas para facilitar seleção */}
                        <optgroup label={t.dashboard.transactions.filters.income} className="bg-slate-900">
                          {categories.filter(c => c.type === 'income').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                          ))}
                          {/* Permitir resgates de Fundo de Emergência e Investimentos como receita */}
                          {categories.filter(c => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">
                              {c.name} {c.vault_type === 'emergency' ? '(Resgate)' : '(Resgate)'}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={t.dashboard.transactions.filters.expense} className="bg-slate-900">
                          {categories.filter(c => c.type === 'expense' && c.vault_type === 'none').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label={t.dashboard.transactions.investmentsAndSavings} className="bg-slate-900">
                          {categories.filter(c => c.type === 'expense' && c.vault_type !== 'none').map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
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
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98] cursor-pointer"
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
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full -z-10" />
              
              <div className="flex flex-col items-center text-center gap-6">
                {(() => {
                  const cat = categories.find(c => c.id === selectedTransaction.category_id);
                  const isIncome = cat && cat.vault_type !== 'none'
                    ? selectedTransaction.amount_cents > 0
                    : (cat ? cat.type === 'income' : selectedTransaction.amount_cents > 0);
                  return (
                    <>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        isIncome 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        <CreditCard size={32} />
                      </div>
                      
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter mb-1">
                          {selectedTransaction.description}
                        </h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {t.dashboard.transactions.table.description}
                        </p>
                      </div>

                      <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.transactions.value}</span>
                          <span className={`text-xl font-black ${
                            isIncome 
                            ? 'text-emerald-400' 
                            : 'text-white'
                          }`}>
                            {isIncome ? '+' : '-'}{formatCurrency(Math.abs(selectedTransaction.amount_cents) / 100)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.transactions.date}</span>
                          <span className="text-sm font-bold text-white">
                            {new Date(selectedTransaction.transaction_date).toLocaleDateString('pt-PT')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dashboard.transactions.category}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories.find(c => c.id === selectedTransaction.category_id)?.color_hex || '#3b82f6' }} />
                            <span className="text-sm font-bold text-white">
                              {categories.find(c => c.id === selectedTransaction.category_id)?.name || t.dashboard.transactions.noCategory}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="w-full grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleEdit(selectedTransaction)}
                    className="px-6 py-4 bg-white/5 border border-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Edit2 size={14} /> {t.dashboard.transactions.editButton}
                  </button>
                  <button
                    onClick={() => setTransactionToDelete(selectedTransaction.id)}
                    className="px-6 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> {t.dashboard.transactions.deleteButton}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-colors"
                >
                  {t.dashboard.transactions.closeDetails}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        onConfirm={handleDelete}
        title={t.dashboard.transactions.deleteConfirm}
        message={t.dashboard.transactions.deleteConfirmText}
        confirmText={t.dashboard.transactions.delete}
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
