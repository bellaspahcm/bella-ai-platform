'use client';

/**
 * Main Finance Dashboard
 * 
 * REFACTORED: 2026-06-22
 * - Replaced manual fetch with Intelligence Layer hooks for overview metrics
 * - Kept realtime subscription for transaction list
 * - Automatic cache management with proper staleTime
 * - Optimistic UI updates with loading/error states
 */

import { FinancePnLSummary, type PnLData, type ServicePerformance } from '@/components/features/FinancePnLSummary';
import { TransactionModal } from '@/components/features/TransactionModal';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import Link from 'next/link';
import SkeletonLoader,{ SkeletonTable } from '@/components/ui/SkeletonLoader';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { createClient } from '@/lib/supabase-client';
import { confirmTransaction, getFinancialOverview, type MappedTransaction } from '@/services/finance-actions';
import { useMonthlyPnL } from '@/hooks/intelligence';
import { motion } from 'framer-motion';
import {
ArrowDownRight,
ArrowUpRight,
Check,
ChevronDown,
ChevronUp,
CreditCard,
PlusCircle,
RefreshCw,
Search,
TrendingUp,
Wallet
} from 'lucide-react';
import { useCallback,useEffect,useRef,useState,useMemo } from 'react';
import { toast } from 'sonner';

type FinancialOverview = {
  totalBalance: number;
  totalRevenueMonth: number;
  totalExpenseMonth: number;
  transactions: MappedTransaction[];
};
type MonthlyPnL = {
  month: string;
  total_revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  operating_profit: number;
  net_profit: number;
  profit_margin_pct: number;
} | null;
type SortableTransactionKey = keyof MappedTransaction;

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

function isConfirmedFinanceStatus(status: string | null | undefined) {
  return status === 'confirmed' || status === 'approved' || status === 'paid';
}

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.42)]';
const stickyBodyCellClassName =
  'bg-white';

export default function FinancePage() {
  const [data, setData] = useState<FinancialOverview>({
    totalBalance: 0,
    totalRevenueMonth: 0,
    totalExpenseMonth: 0,
    transactions: []
  });
  const [activeTab, setActiveTab] = useState<'transactions' | 'analysis'>('transactions');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all');

  const [sortConfig, setSortConfig] = useState<{ key: SortableTransactionKey, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [isConfirmingId, setIsConfirmingId] = useState<string | null>(null);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Calculate month/year from selectedMonth for Intelligence hooks
  const { month, year } = useMemo(() => {
    const date = new Date(selectedMonth);
    return {
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: String(date.getFullYear()),
    };
  }, [selectedMonth]);

  // Fetch P&L data from Intelligence Layer (cached, no tenant ID needed - middleware handles it)
  const monthlyPnLQuery = useMonthlyPnL(month, year);
  
  // Transform Intelligence Layer MonthlyPnL to component's expected PnLData format
  const pnlData = useMemo<PnLData | null>(() => {
    if (!monthlyPnLQuery.data?.data?.[0]) return null;
    const pnl = monthlyPnLQuery.data.data[0];
    
    // Service returns camelCase (totalRevenue, netProfit, operatingExpense)
    // Component expects snake_case PnLData fields
    return {
      month_year: `${year}-${month}`,
      total_revenue: pnl.totalRevenue ?? 0,
      total_operating_expenses: (pnl.operatingExpense ?? 0) + (pnl.salaryExpense ?? 0),
      total_ktv_salaries: pnl.salaryExpense ?? 0,
      net_profit: pnl.netProfit ?? 0,
      total_bookings: 0,  // Not in mv_monthly_pnl
      total_sessions_completed: 0,  // Not in mv_monthly_pnl
      is_locked: false,  // Not tracked in materialized view
    };
  }, [monthlyPnLQuery.data, month, year]);

  const fetchData = useCallback(async (month = selectedMonth, options: { force?: boolean } = {}) => {
    setIsRefreshing(true);
    try {
      const overview = await getFinancialOverview(month);
      setData({
        totalBalance: overview.totalBalance,
        totalRevenueMonth: overview.totalRevenueMonth,
        totalExpenseMonth: overview.totalExpenseMonth,
        transactions: overview.transactions,
      });
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error(getErrorMessage(error, 'Không thể tải dữ liệu tài chính. Vui lòng thử lại.'));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [selectedMonth]);


  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    setCurrentPage(1);
  };

  usePageRefresh(() => fetchData(selectedMonth, { force: true }));

  const handleConfirm = async (tx: MappedTransaction) => {
    if (!tx.dbId) {
      toast.info('Đây là giao dịch mẫu (Demo), không thể xác nhận vào Database thật.');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận giao dịch "${tx.category}" trị giá ${tx.amount} không?\nSau khi xác nhận, số tiền này sẽ được tính vào tổng doanh thu/chi phí.`)) {
      return;
    }

    setIsConfirmingId(tx.id);
    try {
      const result = await confirmTransaction(tx.dbId, tx.type);
      if (!result.success) {
        toast.error(result.error || 'Không thể xác nhận giao dịch');
        return;
      }

      toast.success('Giao dịch đã được xác nhận thành công');
      fetchData(selectedMonth, { force: true });
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error(getErrorMessage(error, 'Lỗi khi xác nhận giao dịch. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.'));
    } finally {
      setIsConfirmingId(null);
    }
  };

  const sortData = (key: SortableTransactionKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedTransactions = [...data.transactions].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      
      if (key === 'amount') {
        valA = a.amountNum || 0;
        valB = b.amountNum || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setData({ ...data, transactions: sortedTransactions });
  };

  useEffect(() => {
    fetchData();

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = setTimeout(() => {
        void fetchData(selectedMonth, { force: true });
      }, 500);
    };

    // REALTIME SUBSCRIPTION
    const supabase = createClient();
    const channel = supabase
      .channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => {
        scheduleRealtimeRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        scheduleRealtimeRefresh();
      })
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchData, selectedMonth]);



  const { totalBalance, totalRevenueMonth, totalExpenseMonth, transactions } = data;
  
  // Filtering & Search
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = searchTerm === '' || 
      tx.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const currentTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative">
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-primary/20 z-[100]">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-full bg-primary"
          />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tài chính</h1>
          <p className="text-slate-500 font-medium mt-1">Theo dõi dòng tiền và hiệu quả kinh doanh</p>
        </div>
        <div className="bella-toolbar flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-32">
              <PremiumSelect
                value={String(parseInt(selectedMonth.split('-')[1]) - 1)}
                options={['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'].map((m, i) => ({ value: String(i), label: m }))}
                onChange={(val) => {
                  const year = selectedMonth.split('-')[0];
                  const month = String(parseInt(val) + 1).padStart(2, '0');
                  handleMonthChange(`${year}-${month}-01`);
                }}
              />
            </div>
            <div className="w-full sm:w-28">
              <PremiumSelect
                value={selectedMonth.split('-')[0]}
                options={Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return { value: String(y), label: String(y) };
                })}
                onChange={(val) => {
                  const month = selectedMonth.split('-')[1];
                  handleMonthChange(`${val}-${month}-01`);
                }}
              />
            </div>
          </div>
          <PremiumExportButton />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-primary/20 dark:shadow-none uppercase tracking-widest text-xs active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Ghi nhận thu chi</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full overflow-x-auto items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm sm:w-fit mb-8">
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'transactions' ? 'bg-primary text-primary-foreground shadow-md ' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
          }`}
        >
          Sổ nhật ký
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'analysis' ? 'bg-primary text-primary-foreground shadow-md ' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
          }`}
        >
          Khóa tháng & P&L
        </button>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
        <Link 
          href="/dashboard/finance/pnl"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Lãi/Lỗ Chi Tiết (P&L)
        </Link>
        <Link 
          href="/dashboard/finance/cash-flow"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Dòng tiền & Dự báo
        </Link>
        <Link 
          href="/dashboard/finance/budget"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Ngân sách
        </Link>
        <Link 
          href="/dashboard/finance/reconciliation"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Đối soát công nợ
        </Link>
      </div>

      {activeTab === 'analysis' ? (
      <FinancePnLSummary 
          pnl={pnlData} 
          performance={[]} 
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onRefresh={() => fetchData(selectedMonth, { force: true })}
        />
      ) : (
        <div className="space-y-10">
          {/* Financial Overview */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <SkeletonLoader variant="card" className="w-full h-48 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-emerald-200/20 animate-pulse" />
          <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40 animate-pulse" />
          <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <motion.div 
            whileHover={{ y: -5 }}
            className="luxury-card-pink p-6 sm:p-8 rounded-3xl sm:rounded-[40px] relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-black text-white/90 uppercase tracking-widest mb-2">Số dư hiện tại</p>
              <h3 className="text-4xl font-black mb-4 text-white">{totalBalance.toLocaleString()}đ</h3>
              <div className="flex items-center gap-2 text-white/90 font-black text-sm">
                <TrendingUp className="w-4 h-4" />
                +12.5% so với tháng trước
              </div>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card-white p-6 sm:p-8 rounded-3xl sm:rounded-[40px] flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                <ArrowUpRight className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng thu tháng</p>
                <h4 className="text-2xl font-black text-slate-900">{(totalRevenueMonth / 1000000).toFixed(1)}M</h4>
              </div>
            </div>
            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[70%] rounded-full"></div>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-3">Đạt 70% mục tiêu tháng</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card-white p-6 sm:p-8 rounded-3xl sm:rounded-[40px] flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng chi tháng</p>
                <h4 className="text-2xl font-black text-slate-900">{(totalExpenseMonth / 1000000).toFixed(1)}M</h4>
              </div>
            </div>
            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full w-[35%] rounded-full"></div>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-3">Giảm 5% so với tháng trước</p>
          </motion.div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white customer-detail-card-static rounded-3xl sm:rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
            <CreditCard className="w-6 h-6 text-rose-500" />
            Giao dịch gần đây
          </h2>
          <div className="bella-toolbar flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center md:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm giao dịch..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/10 w-full sm:w-64 transition-all"
              />
            </div>
            <PremiumSelect
              value={filterType}
              onChange={(val) => { setFilterType(val === 'revenue' || val === 'expense' ? val : 'all'); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'revenue', label: 'Thu vào' },
                { value: 'expense', label: 'Chi ra' }
              ]}
              className="w-full sm:w-32"
            />
          </div>
        </div>

        <div className={tableWrapperClassName}>
          {isLoading ? (
            <div className="p-8">
              <SkeletonTable />
            </div>
          ) : (
            <table className="bella-data-table min-w-[86rem]">
              <colgroup>
                <col className="w-[15rem]" />
                <col className="w-[24rem]" />
                <col className="w-[10rem]" />
                <col className="w-[11rem]" />
                <col className="w-[12rem]" />
                <col className="w-[14rem]" />
              </colgroup>
              <thead>
                <tr className="text-left bg-slate-50/50">
                  <th 
                    onClick={() => sortData('category')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Danh mục
                      {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => sortData('details')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Chi tiết nghiệp vụ
                      {sortConfig?.key === 'details' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => sortData('timestamp')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Ngày
                      {sortConfig?.key === 'timestamp' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Phương thức</th>
                  <th 
                    onClick={() => sortData('amount')}
                    className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      Số tiền
                      {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                    data-testid="finance-transaction-row"
                    data-transaction-id={tx.id}
                  >
                    <td className={`${stickyBodyCellClassName} px-8 py-5 whitespace-nowrap`} data-testid="finance-transaction-category">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === 'revenue' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        } shrink-0`}>
                          {tx.type === 'revenue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <span className="block font-bold text-slate-900" title={tx.category}>{tx.category}</span>
                      </div>
                    </td>
                    <td className="min-w-[28rem] px-8 py-5 whitespace-nowrap" data-testid="finance-transaction-details">
                      <p className="block text-sm font-bold text-slate-700" title={tx.details || 'N/A'}>{tx.details || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 whitespace-nowrap">{tx.method}</td>
                    <td className="px-8 py-5 font-black text-slate-900 whitespace-nowrap" data-testid="finance-transaction-amount">{tx.amount}</td>
                    <td className="px-8 py-5 whitespace-nowrap" data-testid="finance-transaction-status">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                          isConfirmedFinanceStatus(tx.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isConfirmedFinanceStatus(tx.status) ? 'Đã xác nhận' : 'Đang chờ'}
                        </span>
                        {!isConfirmedFinanceStatus(tx.status) && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleConfirm(tx)}
                            disabled={isConfirmingId === tx.id}
                            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-sm shadow-slate-200 disabled:opacity-50"
                          >
                            {isConfirmingId === tx.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Duyệt thu chi
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 sm:p-8 border-t border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
          <p className="text-xs font-bold text-slate-500">
            Hiển thị <span className="text-slate-900">{currentTransactions.length}</span> trên <span className="text-slate-900">{filteredTransactions.length}</span> giao dịch
          </p>
          
          <div className="bella-pagination sm:w-auto">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Trải về
            </button>
            
            <div className="flex shrink-0 items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                    currentPage === i + 1 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 dark:shadow-none' 
                      : 'text-slate-400 hover:bg-white hover:text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Tiếp theo
            </button>
          </div>
        </div>
      </div>
    </div>
      )}
      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => fetchData(selectedMonth, { force: true })}
      />
    </div>
  );
}
