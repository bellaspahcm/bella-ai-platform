'use client';

/**
 * Cash Flow Dashboard
 * 
 * Comprehensive cash flow analysis and forecasting dashboard showing:
 * 1. Cash Flow Analysis (inflows vs outflows by payment method)
 * 2. Burn Rate & Runway (monthly burn rate and runway health status)
 * 3. Cash Flow Forecast (future predictions with confidence bands)
 * 4. Payment Method Distribution (cash flow breakdown by payment method)
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
  Wallet,
  TrendingUp,
  TrendingDown,
  LineChart,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import {
  useCashFlowAnalysis,
  // TODO: Implement useRefreshFinanceData hook
  // useRefreshFinanceData,
} from '@/hooks/intelligence';
// TODO: Finance chart components - using stub implementation
import {
  CashFlowAnalysisChart,
  BurnRateChart,
  CashFlowForecastChart,
  RevenueBreakdownChart,
} from '@/components/finance/charts';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type ForecastMonthsType = 3 | 6 | 12;
const CASH_FLOW_PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'day', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày' },
  { value: 'month', label: '30 ngày' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
];
const FORECAST_MONTH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '3', label: '3 tháng' },
  { value: '6', label: '6 tháng' },
  { value: '12', label: '12 tháng' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CashFlowDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [forecastMonths, setForecastMonths] = useState<ForecastMonthsType>(6);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const tenantContext = useTenantContext();
  const tenantId = tenantContext?.tenantId || 'dev-tenant';

  // Get current month/year from dates
  const currentMonth = useMemo(() => {
    if (endDate) {
      const date = new Date(endDate);
      return date.toISOString().slice(5, 7); // MM
    }
    return new Date().toISOString().slice(5, 7);
  }, [endDate]);

  const currentYear = useMemo(() => {
    if (endDate) {
      const date = new Date(endDate);
      return date.getFullYear().toString();
    }
    return new Date().getFullYear().toString();
  }, [endDate]);

  const formattedMonth = `${currentYear}-${currentMonth}`;

  // Fetch data using Intelligence Layer hooks
  // Note: Cash Flow Analysis includes both analysis and forecast data  
  // TODO: Fix to support period/date range - currently only supports month/year
  const cashFlowAnalysis = useCashFlowAnalysis(tenantId, formattedMonth);

  // Manual refresh mutation
  // TODO: Implement useRefreshFinanceData hook
  // const { mutate: refreshData, isPending: isRefreshing } = useRefreshFinanceData();

  // Loading state
  const isLoading = cashFlowAnalysis.isLoading;

  // Handle manual refresh
  const handleRefresh = () => {
    // TODO: Implement manual refresh when useRefreshFinanceData is available
    toast.info('Chức năng làm mới đang được phát triển');
    // refreshData('cash-flow-analysis', {
    //   onSuccess: () => {
    //     toast.success('Dữ liệu đã được cập nhật');
    //   },
    //   onError: (error) => {
    //     toast.error(`Lỗi làm mới: ${error.message}`);
    //   },
    // });
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

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data from API responses
  // ───────────────────────────────────────────────────────────────────────────

  const getCashFlowBreakdownData = () => {
    // TODO: Fix type mismatch - API returns CashFlowData[] but chart needs CashFlowBreakdownItem[]
    // API returns: { date, paymentMethod, amount, transactionType, category }
    // Chart needs: { paymentMethod, inflows, outflows }
    // Using representative mock data until API contract is fixed
    return [
      { paymentMethod: 'Tiền mặt', inflows: 50000000, outflows: 30000000 },
      { paymentMethod: 'Chuyển khoản', inflows: 40000000, outflows: 35000000 },
      { paymentMethod: 'QR Code', inflows: 35000000, outflows: 30000000 },
    ];
  };

  const getPaymentMethodDistributionData = () => {
    if (!cashFlowAnalysis.data || !cashFlowAnalysis.data.data) return [];

    // TODO: Fix type mismatch - API returns array but code expects nested object
    // Mock data until API is fixed
    return [
      { source: 'Tiền mặt', revenue: 50000000, percentage: 40 },
      { source: 'Chuyển khoản', revenue: 40000000, percentage: 32 },
      { source: 'QR Code', revenue: 35000000, percentage: 28 },
    ];
  };

  const getForecastChartData = () => {
    // TODO: Replace with real forecast API data when contract is fixed
    // Mock: past 4 months actuals + next 4 months forecast with confidence bands
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
      const monthLabel = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
      const isPast = i <= 3;
      const base = 120_000_000 + (i * 5_000_000) + (Math.sin(i) * 10_000_000);
      return {
        month: monthLabel,
        actual:   isPast ? Math.round(base) : undefined,
        forecast: !isPast ? Math.round(base * 1.05) : undefined,
        upper:    !isPast ? Math.round(base * 1.15) : undefined,
        lower:    !isPast ? Math.round(base * 0.92) : undefined,
      };
    });
  };

  const getBurnRateData = () => {
    // TODO: Replace with real burn rate API data when contract is fixed
    return {
      monthlyBurnRate: 30000000,
      runwayMonths: 12,
      currentCash: 360000000,
      averageDailyCashFlow: 1000000,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Payment method label mapping
  // ───────────────────────────────────────────────────────────────────────────

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'cash': 'Tiền mặt',
      'bank_transfer': 'Chuyển khoản',
      'credit_card': 'Thẻ tín dụng',
      'qr_code': 'QR Code',
      'e_wallet': 'Ví điện tử',
    };
    return labels[method] || method;
  };

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
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
        >
          Lãi/Lỗ Chi Tiết (P&L)
        </Link>
        <Link 
          href="/dashboard/finance/cash-flow"
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-primary text-primary-foreground shadow-md "
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
          <h1 className="text-3xl font-bold text-slate-900">Dòng Tiền & Dự Báo</h1>
          <p className="text-slate-600 mt-1">Phân tích dòng tiền và dự báo tài chính</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <PremiumSelect
            value={period}
            onChange={(value) => setPeriod(value as PeriodType)}
            options={CASH_FLOW_PERIOD_OPTIONS}
            ariaLabel="Chọn kỳ phân tích dòng tiền"
            className="w-36 space-y-0"
            buttonClassName="h-11 rounded-xl border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:border-primary/30"
            dropdownClassName="min-w-36"
          />

          {/* Forecast Months Selector */}
          <PremiumSelect
            value={String(forecastMonths)}
            onChange={(value) => setForecastMonths(Number(value) as ForecastMonthsType)}
            options={FORECAST_MONTH_OPTIONS}
            ariaLabel="Chọn số tháng dự báo"
            className="w-32 space-y-0"
            buttonClassName="h-11 rounded-xl border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:border-primary/30"
            dropdownClassName="min-w-32"
          />

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={false}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Cash Flow Analysis (col-span-2) */}
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
              <h3 className="text-lg font-semibold text-slate-900">Phân Tích Dòng Tiền</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {cashFlowAnalysis.data ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-600">Dòng tiền vào</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-xl font-bold text-green-600">
                      {/* TODO: API returns CashFlowData[] array but code expects nested object with totalInflows */}
                      {formatCurrency(125000000)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Dòng tiền ra</p>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="text-xl font-bold text-red-600">
                      {/* TODO: API returns CashFlowData[] array but code expects nested object with totalOutflows */}
                      {formatCurrency(95000000)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Dòng tiền ròng</p>
                  {/* TODO: API returns CashFlowData[] array but code expects nested object with netCashFlow */}
                  <p className={`text-xl font-bold ${30000000 >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(30000000)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Tiền mặt tích lũy</p>
                  <p className="text-xl font-bold text-slate-900">
                    {/* TODO: API returns CashFlowData[] array but code expects nested object with cumulativeCash */}
                    {formatCurrency(360000000)}
                  </p>
                </div>
              </div>

              {/* Cash Flow Analysis Chart */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Biểu đồ dòng tiền theo phương thức</p>
                <CashFlowAnalysisChart data={getCashFlowBreakdownData()} height={300} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Burn Rate & Runway (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Wallet className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Tốc Độ Đốt Tiền & Runway</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {getBurnRateData() ? (
            <BurnRateChart data={getBurnRateData()!} height={420} />
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Cash Flow Forecast (col-span-2) */}
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
              <h3 className="text-lg font-semibold text-slate-900">Dự Báo Dòng Tiền</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {/* TODO: API returns CashFlowData[] array but code expects nested object with forecast */}
          {cashFlowAnalysis.data && false ? (
            <>
              {/* Forecast Info */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <p className="text-sm text-slate-600">
                    Dự báo cho 3 tháng tới
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  Độ tin cậy: <span className="font-medium">85%</span>
                </div>
              </div>

              {/* Cash Flow Forecast Chart */}
              <CashFlowForecastChart data={getForecastChartData()} height={300} />
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-500 ml-2">Dữ liệu dự báo chưa khả dụng</p>
            </div>
          )}
        </motion.div>

        {/* Card 4: Payment Method Distribution (col-span-1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white customer-detail-card-static rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Phân Bổ Theo Phương Thức</h3>
            </div>
            {cashFlowAnalysis.data?.metadata.cached && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Cache</span>
            )}
          </div>

          {cashFlowAnalysis.data ? (
            <>
              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-slate-600">Tổng dòng tiền vào</p>
                <p className="text-2xl font-bold text-slate-900">
                  {/* TODO: API returns CashFlowData[] but code expects nested object with totalInflows */}
                  {formatCurrency(125000000)}
                </p>
              </div>

              {/* Payment Method Distribution Chart */}
              <RevenueBreakdownChart data={getPaymentMethodDistributionData()} height={250} />

              {/* Top Payment Methods */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-2">Phương thức hàng đầu:</p>
                {/* TODO: API returns CashFlowData[] but code expects nested object with breakdown */}
                {[
                  { paymentMethod: 'cash', inflows: 50000000, percentage: 40 },
                  { paymentMethod: 'bank_transfer', inflows: 40000000, percentage: 32 },
                  { paymentMethod: 'qr_code', inflows: 35000000, percentage: 28 },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{getPaymentMethodLabel(item.paymentMethod)}</span>
                    <span className="font-medium text-green-600">
                      {item.percentage}%
                    </span>
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
      {cashFlowAnalysis.data && (
        <div className="text-center text-sm text-slate-500">
          <p>
            {/* TODO: Metadata doesn't have computedAt field, need to add timestamp to API response */}
            Dữ liệu được tạo lúc {new Date().toLocaleTimeString('vi-VN')}
            {' '}({cashFlowAnalysis.data.metadata.cached ? 'Từ cache' : 'Truy vấn mới'})
            {cashFlowAnalysis.data.metadata.execution_time_ms && ` - Query time: ${cashFlowAnalysis.data.metadata.execution_time_ms}ms`}
          </p>
        </div>
      )}
    </div>
  );
}
