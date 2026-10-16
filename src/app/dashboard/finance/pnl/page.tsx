'use client';

/**
 * P&L (Profit & Loss) Dashboard
 * 
 * Comprehensive financial analysis dashboard showing:
 * 1. Monthly P&L Statement
 * 2. Revenue Breakdown
 * 3. Profitability Trends
 * 4. Expense Breakdown
 * 
 * Data flows through Intelligence Layer with automatic caching via React Query hooks.
 * 
 * REFACTORED: 2026-06-22
 * - Replaced fetch() calls with React Query hooks
 * - Automatic cache management with proper staleTime
 * - Optimistic UI updates with loading/error states
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import {
  useMonthlyPnL,
  useRevenueBreakdown,
  useExpenseBreakdown,
  useProfitabilityTrends,
  useRefreshFinanceData,
} from '@/hooks/intelligence';
import {
  PnLStatementChart,
  RevenueBreakdownChart,
  ExpenseBreakdownChart,
  ProfitabilityTrendChart,
} from '@/components/finance/charts';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'current_month' | 'last_month' | 'custom';
const PNL_PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'current_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PnLDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('current_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const tenantContext = useTenantContext();
  const tenantId = tenantContext?.tenantId || 'dev-tenant';

  // Calculate month/year based on period
  const { month, year } = useMemo(() => {
    const now = new Date();
    if (period === 'last_month') {
      now.setMonth(now.getMonth() - 1);
    }
    return {
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
    };
  }, [period]);

  const formattedMonth = `${year}-${month}`;

  // Custom date range configuration for custom period
  const customRange = useMemo(() => {
    if (period === 'custom' && startDate && endDate) {
      return { startDate, endDate };
    }
    return undefined;
  }, [period, startDate, endDate]);

  // Fetch data using Intelligence Layer hooks (with customRange support)
  const monthlyPnL = useMonthlyPnL(month, year, customRange);
  const revenueBreakdown = useRevenueBreakdown(tenantId, formattedMonth, customRange);
  const expenseBreakdown = useExpenseBreakdown(tenantId, formattedMonth, customRange);
  const profitabilityTrends = useProfitabilityTrends(month, year, customRange);

  // Manual refresh mutation
  const { mutate: refreshData, isPending: isRefreshing } = useRefreshFinanceData();

  // Combined loading state
  const isLoading =
    monthlyPnL.isLoading ||
    revenueBreakdown.isLoading ||
    expenseBreakdown.isLoading;

  // Handle manual refresh
  const handleRefresh = () => {
    refreshData('all', {
      onSuccess: () => {
        toast.success('Dữ liệu tài chính đã được làm mới');
      },
      onError: (error: Error) => {
        toast.error(`Lỗi làm mới: ${error.message}`);
      },
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Helper functions
  // ───────────────────────────────────────────────────────────────────────────

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const _formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data from API responses
  // ───────────────────────────────────────────────────────────────────────────

  const getCurrentMonthPnL = () => {
    if (!monthlyPnL.data || !monthlyPnL.data.data || monthlyPnL.data.data.length === 0) return null;
    return monthlyPnL.data.data[0]; // Latest month
  };

  const getProfitabilityTrendData = () => {
    if (!profitabilityTrends.data?.data?.monthlyTrends) return [];
    return profitabilityTrends.data.data.monthlyTrends.map((trend) => ({
      date: trend.month.substring(5, 7) + '/' + trend.month.substring(0, 4),
      revenue: trend.totalRevenue ?? 0,
      expenses: trend.totalExpense ?? 0,
      profit: trend.netProfit ?? 0,
    }));
  };

  const calculateMoMGrowth = () => {
    const trends = profitabilityTrends.data?.data?.monthlyTrends;
    if (!trends || trends.length < 2) return 0;
    const current = trends[trends.length - 1].netProfit ?? 0;
    const previous = trends[trends.length - 2].netProfit ?? 0;
    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const calculateYoYGrowth = () => {
    const trends = profitabilityTrends.data?.data?.monthlyTrends;
    if (!trends || trends.length < 12) return 0;
    const current = trends[trends.length - 1].netProfit ?? 0;
    const lastYear = trends[trends.length - 12].netProfit ?? 0;
    if (lastYear === 0) return 0;
    return ((current - lastYear) / Math.abs(lastYear)) * 100;
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  const getRevenueBreakdownData = () => {
    if (!revenueBreakdown.data || !Array.isArray(revenueBreakdown.data.data)) return [];

    // TODO: API returns RevenueBreakdownData[] array but code expects nested object with byType
    // Transform array directly (assume each element is already correct format)
    return revenueBreakdown.data.data.map(item => ({
      source: item.source,
      revenue: item.amount,
      percentage: item.percentage,
    }));
  };

  const getExpenseBreakdownData = () => {
    if (!expenseBreakdown.data || !Array.isArray(expenseBreakdown.data.data)) return [];

    // TODO: API returns ExpenseBreakdownData[] array but code expects nested object with byCategory
    // Transform array directly (assume each element is already correct format)
    return expenseBreakdown.data.data.map(item => ({
      category: item.category,
      expense: item.amount,
      percentage: item.percentage,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate growth percentages
  // ───────────────────────────────────────────────────────────────────────────


  // ───────────────────────────────────────────────────────────────────────────
  // Render loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const currentPnL = getCurrentMonthPnL();

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Tabs */}
      <div className="flex w-full overflow-x-auto items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm sm:w-fit">
        <Link 
          href="/dashboard/finance"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Sổ nhật ký
        </Link>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
        <Link 
          href="/dashboard/finance/pnl"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-primary text-primary-foreground shadow-md "
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Báo Cáo Lãi/Lỗ</h1>
          <p className="text-slate-600 mt-1">Phân tích lợi nhuận và hiệu suất tài chính</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <PremiumSelect
            value={period}
            onChange={(value) => setPeriod(value as PeriodType)}
            options={PNL_PERIOD_OPTIONS}
            ariaLabel="Chọn kỳ báo cáo lãi lỗ"
            className="w-40 space-y-0"
            buttonClassName="h-11 rounded-xl border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:border-primary/30"
            dropdownClassName="min-w-40"
          />

          {/* Custom Date Range (shown when period is 'custom') */}
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-slate-600">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Đang làm mới...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Monthly P&L Statement (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Báo Cáo P&L Tháng</h3>
            </div>
            {monthlyPnL.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {currentPnL ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Tổng doanh thu</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(currentPnL.totalRevenue)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tổng chi phí</p>
                  <p className="text-xl font-bold text-red-600">
                    {/* totalExpense = salaries + operating expenses */}
                    {formatCurrency(currentPnL.totalExpense)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Lợi nhuận ròng</p>
                  <p className={`text-xl font-bold ${currentPnL.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(currentPnL.netProfit)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Biên lợi nhuận</p>
                  <p className={`text-xl font-bold ${currentPnL.netMarginPct >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatNumber(currentPnL.netMarginPct, 1)}%
                  </p>
                </div>
              </div>

              {/* P&L Waterfall Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Biểu đồ P&L</p>
                <PnLStatementChart
                  data={{
                    totalRevenue: currentPnL.totalRevenue,
                    totalExpenses: currentPnL.totalExpense,
                    netProfit: currentPnL.netProfit,
                    profitMargin: currentPnL.netMarginPct,
                  }}
                  height={250}
                />
              </div>

              {/* Revenue & Expense Summary */}
              <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Top 3 nguồn doanh thu:</p>
                  {/* TODO: revenueBreakdown.data.data is array, not nested object with byType */}
                  {(revenueBreakdown.data?.data || []).slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.source}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Top 3 danh mục chi phí:</p>
                  {/* TODO: expenseBreakdown.data.data is array, not nested object with byCategory */}
                  {(expenseBreakdown.data?.data || []).slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.category}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Revenue Breakdown (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <PieChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Doanh Thu</h3>
            </div>
            {revenueBreakdown.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {revenueBreakdown.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng doanh thu</p>
                <p className="text-2xl font-bold text-slate-900">
                  {/* TODO: revenueBreakdown.data.data is array, calculate sum or use mock */}
                  {formatCurrency(
                    (Array.isArray(revenueBreakdown.data.data) ? revenueBreakdown.data.data : []).reduce(
                      (sum, item) => sum + (item.amount || 0),
                      0
                    )
                  )}
                </p>
              </div>

              {/* Revenue Breakdown Chart */}
              <RevenueBreakdownChart data={getRevenueBreakdownData()} height={250} />

              {/* Top Sources */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Nguồn thu hàng đầu:</p>
                {/* TODO: revenueBreakdown.data.data is array, not nested object with byType */}
                {(Array.isArray(revenueBreakdown.data.data) ? revenueBreakdown.data.data : []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{item.source}</span>
                    <span className="font-medium text-green-600">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Profitability Trends (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <LineChart className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Xu Hướng Lợi Nhuận (6 tháng)</h3>
            </div>
            {profitabilityTrends.data?.metadata?.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {profitabilityTrends.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : profitabilityTrends.data?.data?.monthlyTrends && profitabilityTrends.data.data.monthlyTrends.length > 0 ? (
            <>
              <ProfitabilityTrendChart data={getProfitabilityTrendData()} height={250} />

              <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm text-slate-600">Tăng trưởng MoM</p>
                  <p className={`text-xl font-bold mt-1 ${
                    calculateMoMGrowth() >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(calculateMoMGrowth())}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tăng trưởng YoY</p>
                  <p className={`text-xl font-bold mt-1 ${
                    calculateYoYGrowth() >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(calculateYoYGrowth())}
                    {profitabilityTrends.data.data.monthlyTrends.length < 12 && (
                      <span className="text-xs font-normal text-slate-400 ml-1">(Chưa đủ 12 tháng)</span>
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-500 ml-2">Chưa có dữ liệu xu hướng</p>
            </div>
          )}
        </motion.div>

        {/* Card 4: Expense Breakdown (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <PieChart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Chi Phí</h3>
            </div>
            {expenseBreakdown.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {expenseBreakdown.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng chi phí</p>
                <p className="text-2xl font-bold text-slate-900">
                  {/* TODO: expenseBreakdown.data.data is array, calculate sum or use mock */}
                  {formatCurrency(
                    (Array.isArray(expenseBreakdown.data.data) ? expenseBreakdown.data.data : []).reduce(
                      (sum, item) => sum + (item.amount || 0),
                      0
                    )
                  )}
                </p>
              </div>

              {/* Expense Breakdown Chart */}
              <ExpenseBreakdownChart data={getExpenseBreakdownData()} height={250} />

              {/* Top Categories */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Danh mục chi phí hàng đầu:</p>
                {/* TODO: expenseBreakdown.data.data is array, not nested object with byCategory */}
                {(Array.isArray(expenseBreakdown.data.data) ? expenseBreakdown.data.data : []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{item.category}</span>
                    <span className="font-medium text-red-600">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Cache Info Footer */}
      {monthlyPnL.data && (
        <div className="text-center text-sm text-slate-500">
          <p>
            {/* TODO: Metadata doesn't have computedAt field, need to add timestamp to API response */}
            Dữ liệu được tạo lúc {new Date().toLocaleTimeString('vi-VN')}
            {' '}({monthlyPnL.data.metadata.cached ? 'Từ cache' : 'Truy vấn mới'})
            {monthlyPnL.data.metadata.execution_time_ms && ` - Query time: ${monthlyPnL.data.metadata.execution_time_ms}ms`}
          </p>
        </div>
      )}
    </div>
  );
}
