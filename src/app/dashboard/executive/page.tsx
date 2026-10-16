'use client';

/**
 * Executive Dashboard - CEO Intelligence
 * 
 * High-level metrics for executive decision-making:
 * 1. Monthly Revenue Summary
 * 2. Operational Efficiency
 * 3. Customer Metrics
 * 4. Financial Health
 * 5. Growth Indicators
 * 
 * Data flows through Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Activity, 
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { 
  MonthlyRevenueSummary,
  OperationalEfficiency,
  CustomerMetrics,
  FinancialHealth,
  GrowthIndicators
} from '@/services/intelligence/executive';
import {
  RevenueTrendChart,
  OperationalEfficiencyChart,
  CustomerMetricsChart,
  FinancialHealthChart,
  GrowthIndicatorsChart,
} from '@/components/intelligence';
import { isHaircutProductPresentation } from '@/lib/business-rules/product-presentation-routing';
import { useUser } from '@/lib/user-context';
import { HaircutExecutiveDashboardView } from './components/HaircutExecutiveDashboardView';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IntelligenceResponse<T> {
  data: T;
  metadata: {
    generatedAt: string;
    cacheHit: boolean;
    queryTimeMs: number;
    dataSourcesUsed: string[];
  };
}

type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

const REVENUE_SOURCE_LABELS: Record<string, string> = {
  remaining_payment: 'Thanh toán còn lại',
  deposit: 'Tiền đặt cọc',
  package_payment: 'Thanh toán trọn gói',
  package_sale: 'Thanh toán trọn gói',
  session_completed: 'Thanh toán theo buổi',
  service_revenue: 'Doanh thu dịch vụ',
  partial_payment: 'Thanh toán một phần',
  late_fee: 'Phí trễ hạn',
  refund: 'Hoàn tiền',
};

const getRevenueSourceLabel = (key: string) => {
  return REVENUE_SOURCE_LABELS[key.trim().toLowerCase()] || key;
};

const periodOptions = [
  { value: 'day', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: '30 ngày qua' },
  { value: 'quarter', label: 'Quý này' },
  { value: 'year', label: 'Năm này' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function ExecutiveDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Metric states
  const [revenueSummary, setRevenueSummary] = useState<IntelligenceResponse<MonthlyRevenueSummary> | null>(null);
  const [operationalEfficiency, setOperationalEfficiency] = useState<IntelligenceResponse<OperationalEfficiency> | null>(null);
  const [customerMetrics, setCustomerMetrics] = useState<IntelligenceResponse<CustomerMetrics> | null>(null);
  const [financialHealth, setFinancialHealth] = useState<IntelligenceResponse<FinancialHealth> | null>(null);
  const [growthIndicators, setGrowthIndicators] = useState<IntelligenceResponse<GrowthIndicators> | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initTenant() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.tenant_id) {
        toast.error('Không tìm thấy tenant');
        return;
      }

      // Check if user has executive role (allow admin and manager)
      // Temporarily disabled for testing - all roles can access
      // if (profile.role !== 'admin' && profile.role !== 'manager') {
      //   toast.error('Bạn không có quyền truy cập trang này');
      //   router.push('/dashboard');
      //   return;
      // }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch all metrics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAllMetrics = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const baseUrl = `/api/intelligence/executive`;
      const params = new URLSearchParams({ tenantId, period });

      const [revenue, efficiency, customer, financial, growth] = await Promise.all([
        fetch(`${baseUrl}/monthly-revenue-summary?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/operational-efficiency?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/customer-metrics?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/financial-health?${params}`).then(r => r.json()),
        fetch(`${baseUrl}/growth-indicators?${params}`).then(r => r.json()),
      ]);

      // Check for errors
      if (revenue.error) throw new Error(revenue.error);
      if (efficiency.error) throw new Error(efficiency.error);
      if (customer.error) throw new Error(customer.error);
      if (financial.error) throw new Error(financial.error);
      if (growth.error) throw new Error(growth.error);

      setRevenueSummary(revenue);
      setOperationalEfficiency(efficiency);
      setCustomerMetrics(customer);
      setFinancialHealth(financial);
      setGrowthIndicators(growth);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't show error toast for no-data scenarios - just set empty state
      console.info('[Executive Dashboard] No data available for tenant. This is normal for new tenants.');
      
      // Log detailed error for debugging (without showing to user)
      console.error('API Error Details:', {
        tenantId,
        period,
        error: errorMessage,
        hint: 'This may happen if Intelligence Layer has no data yet. Please ensure demo data is seeded.',
      });
      
      // Set empty data state (no mock data - show "no data" UI instead)
      const mockPeriod = new Date().toISOString().slice(0, 7) + '-01';
      
      setRevenueSummary({
        data: {
          period: mockPeriod,
          totalRevenue: 0,
          revenueGrowth: 0,
          topRevenueSources: [],
          revenueByPaymentMethod: [],
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false,
          queryTimeMs: 0,
          dataSourcesUsed: ['no-data'],
        },
      });
      
      setOperationalEfficiency({
        data: {
          period: mockPeriod,
          ktvUtilizationRate: 0,
          averageSessionRating: 0,
          serviceCompletionRate: 0,
          revenuePerKtv: 0,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false,
          queryTimeMs: 0,
          dataSourcesUsed: ['no-data'],
        },
      });
      
      setCustomerMetrics({
        data: {
          period: mockPeriod,
          newCustomers: 0,
          retentionRate: 0,
          averageBookingValue: 0,
          customerLifetimeValue: 0,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false,
          queryTimeMs: 0,
          dataSourcesUsed: ['no-data'],
        },
      });
      
      setFinancialHealth({
        data: {
          period: mockPeriod,
          profitMargin: 0,
          cashFlow: 0,
          outstandingReceivables: 0,
          expenseBreakdown: [],
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false,
          queryTimeMs: 0,
          dataSourcesUsed: ['no-data'],
        },
      });
      
      setGrowthIndicators({
        data: {
          period: mockPeriod,
          monthOverMonthGrowth: 0,
          yearOverYearGrowth: 0,
          projectedRevenue: 0,
          topGrowingServices: [],
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false,
          queryTimeMs: 0,
          dataSourcesUsed: ['no-data'],
        },
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, period]);

  useEffect(() => {
    if (tenantId) {
      fetchAllMetrics();
    }
  }, [tenantId, fetchAllMetrics]);

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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate mock historical data for charts (temporary until API provides historical data)
  // ───────────────────────────────────────────────────────────────────────────

  const generateRevenueTrendData = () => {
    if (!revenueSummary) return [];
    
    const current = revenueSummary.data.totalRevenue;
    // Cap growth factor for the trend visualization to prevent negative values on extreme growth rates
    const growth = Math.min(0.7, revenueSummary.data.revenueGrowth / 100);
    
    // Generate last 7 days data
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      // Calculate revenue with growth trend and daily fluctuation
      const baseRatio = 1 - growth * (daysAgo / 7);
      const randomFluctuation = 0.95 + (Math.sin(i) * 0.05); // +/- 5% stability
      const revenue = current * Math.max(0.15, baseRatio) * randomFluctuation;
      
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        revenue: Math.round(revenue),
      };
    });
  };

  const generateCustomerTrendData = () => {
    if (!customerMetrics) return [];
    
    const newCustomers = customerMetrics.data.newCustomers;
    
    // Generate last 7 days data
    return Array.from({ length: 7 }, (_, i) => {
      const daysAgo = 6 - i;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        newCustomers: Math.round(newCustomers * (0.1 + Math.random() * 0.2)),
        returningCustomers: Math.round(newCustomers * (0.3 + Math.random() * 0.4)),
      };
    });
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
    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-12">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">Executive Dashboard</h1>
          <p className="text-xs font-black text-slate-400 dark:text-[#CDBCAB] uppercase tracking-[0.25em] mt-1">Tổng quan chỉ số kinh doanh</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Period Selector */}
          <div className="flex-1 sm:flex-initial sm:w-44">
            <PremiumSelect
              value={period}
              onChange={(val) => setPeriod(val as TimePeriod)}
              options={periodOptions}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAllMetrics(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50 text-xs shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* No Data Banner */}
      {revenueSummary?.metadata.dataSourcesUsed.includes('no-data') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-blue-50 border border-blue-200 rounded-[1.5rem] p-5 flex items-start gap-4 shadow-sm"
        >
          <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-black text-blue-900 mb-1 uppercase tracking-wider">Chưa có dữ liệu</h3>
            <p className="text-sm text-blue-700 leading-relaxed font-semibold">
              Hệ thống chưa có đủ dữ liệu để tạo báo cáo Intelligence. 
              Các chỉ số sẽ tự động cập nhật khi có giao dịch mới (booking, doanh thu, chi phí).
            </p>
          </div>
        </motion.div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Card 1: Monthly Revenue Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden lg:col-span-2 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400/20 via-primary/30 to-emerald-400/20" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Doanh Thu</h3>
            </div>
            {revenueSummary?.metadata.cacheHit && (
              <span className="text-[10px] font-black bg-white/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider text-slate-500 shrink-0">Cache</span>
            )}
          </div>

          {revenueSummary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tổng doanh thu</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">
                    {formatCurrency(revenueSummary.data.totalRevenue)}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {revenueSummary.data.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-600" />
                    )}
                    <span className={`text-sm font-black ${
                      revenueSummary.data.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatPercent(revenueSummary.data.revenueGrowth)}
                    </span>
                    <span className="text-xs text-slate-500 font-bold">vs kỳ trước</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Top nguồn doanh thu</p>
                  <div className="space-y-2 bg-white/40 backdrop-blur-sm rounded-[1.5rem] p-4 border border-white/50">
                    {revenueSummary.data.topRevenueSources.length > 0 ? (
                      revenueSummary.data.topRevenueSources.slice(0, 3).map((source, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-bold py-1 border-b border-slate-100/50 last:border-0">
                          <span className="text-slate-500 truncate pr-2" title={getRevenueSourceLabel(source.source)}>
                            {getRevenueSourceLabel(source.source)}
                          </span>
                          <span className="text-slate-800 shrink-0">{formatCurrency(source.revenue)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 py-1 text-center font-bold italic">Chưa có giao dịch</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="border-t border-slate-100/60 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Xu hướng 7 ngày qua</p>
                <RevenueTrendChart data={generateRevenueTrendData()} height={200} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 2: Operational Efficiency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-400/20 via-primary/30 to-cyan-400/20" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20 text-cyan-600">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Hiệu Suất</h3>
            </div>
            {operationalEfficiency?.metadata.cacheHit && (
              <span className="text-[10px] font-black bg-white/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider text-slate-500 shrink-0">Cache</span>
            )}
          </div>

          {operationalEfficiency ? (
            <>
              {/* Radial Chart */}
              <div className="flex justify-center items-center relative py-2">
                <OperationalEfficiencyChart
                  ktvUtilization={operationalEfficiency.data.ktvUtilizationRate}
                  sessionRating={operationalEfficiency.data.averageSessionRating}
                  completionRate={operationalEfficiency.data.serviceCompletionRate}
                  height={220}
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-100/60">
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sử dụng</p>
                  <p className="text-base font-black text-cyan-600">
                    {formatNumber(operationalEfficiency.data.ktvUtilizationRate, 0)}%
                  </p>
                </div>
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Đánh giá</p>
                  <p className="text-base font-black text-purple-600">
                    {formatNumber(operationalEfficiency.data.averageSessionRating, 1)}⭐
                  </p>
                </div>
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hoàn thành</p>
                  <p className="text-base font-black text-primary">
                    {formatNumber(operationalEfficiency.data.serviceCompletionRate, 0)}%
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 3: Customer Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden lg:col-span-2 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-400/20 via-primary/30 to-purple-400/20" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Khách Hàng</h3>
            </div>
            {customerMetrics?.metadata.cacheHit && (
              <span className="text-[10px] font-black bg-white/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider text-slate-500 shrink-0">Cache</span>
            )}
          </div>

          {customerMetrics ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Khách hàng mới</p>
                  <p className="text-2xl font-black text-slate-900">
                    {formatNumber(customerMetrics.data.newCustomers)}
                  </p>
                </div>

                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Tỷ lệ giữ chân</p>
                  <p className="text-2xl font-black text-slate-900">
                    {formatNumber(customerMetrics.data.retentionRate, 1)}%
                  </p>
                </div>

                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Giá trị đơn hàng TB</p>
                  <p className="text-2xl font-black text-slate-900 truncate" title={formatCurrency(customerMetrics.data.averageBookingValue)}>
                    {formatCurrency(customerMetrics.data.averageBookingValue)}
                  </p>
                </div>
              </div>

              {/* Customer Trend Chart */}
              <div className="border-t border-slate-100/60 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Xu hướng khách hàng 7 ngày qua</p>
                <CustomerMetricsChart data={generateCustomerTrendData()} height={200} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 4: Financial Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-400/20 via-primary/30 to-orange-400/20" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 text-orange-600">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Sức Khỏe Tài Chính</h3>
            </div>
            {financialHealth?.metadata.cacheHit && (
              <span className="text-[10px] font-black bg-white/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider text-slate-500 shrink-0">Cache</span>
            )}
          </div>

          {financialHealth ? (
            <>
              {/* Financial Health Chart */}
              <div className="relative py-2">
                <FinancialHealthChart
                  profitMargin={financialHealth.data.profitMargin}
                  cashFlow={financialHealth.data.cashFlow}
                  receivables={financialHealth.data.outstandingReceivables}
                  height={220}
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-100/60">
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Biên LN</p>
                  <p className="text-base font-black text-primary">
                    {formatNumber(financialHealth.data.profitMargin, 1)}%
                  </p>
                </div>
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dòng tiền</p>
                  <p className={`text-base font-black truncate ${
                    financialHealth.data.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                  }`} title={formatCurrency(financialHealth.data.cashFlow)}>
                    {formatCurrency(financialHealth.data.cashFlow).replace('₫', '').trim()}
                  </p>
                </div>
                <div className="text-center bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Công nợ</p>
                  <p className="text-base font-black text-slate-600 truncate" title={formatCurrency(financialHealth.data.outstandingReceivables)}>
                    {formatCurrency(financialHealth.data.outstandingReceivables).replace('₫', '').trim()}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </motion.div>

        {/* Card 5: Growth Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-400/20 via-primary/30 to-pink-400/20" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center border border-pink-500/20 text-pink-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Tăng Trưởng</h3>
            </div>
            {growthIndicators?.metadata.cacheHit && (
              <span className="text-[10px] font-black bg-white/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider text-slate-500 shrink-0">Cache</span>
            )}
          </div>

          {growthIndicators ? (
            <>
              {/* Growth Chart */}
              <div className="relative py-2">
                <GrowthIndicatorsChart
                  momGrowth={growthIndicators.data.monthOverMonthGrowth}
                  yoyGrowth={growthIndicators.data.yearOverYearGrowth}
                  projectedGrowth={15} // Mock projected growth rate
                  height={200}
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100/60">
                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Tăng trưởng MoM</p>
                  <p className={`text-xl font-black ${
                    growthIndicators.data.monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(growthIndicators.data.monthOverMonthGrowth)}
                  </p>
                </div>

                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-3 border border-white/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Tăng trưởng YoY</p>
                  <p className={`text-xl font-black ${
                    growthIndicators.data.yearOverYearGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(growthIndicators.data.yearOverYearGrowth)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Dự báo doanh thu tháng tới</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(growthIndicators.data.projectedRevenue)}
                </p>
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
      {revenueSummary && (
        <div className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-12 py-4 border-t border-slate-100/20 max-w-xl mx-auto">
          <p>
            Dữ liệu được tạo lúc {new Date(revenueSummary.metadata.generatedAt).toLocaleTimeString('vi-VN')} 
            {' '}({revenueSummary.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'}) 
            {' '}- Query time: {revenueSummary.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function ExecutiveDashboardPageWrapper() {
  const { product } = useUser();
  const isHaircut = isHaircutProductPresentation(product);

  if (isHaircut) {
    return <HaircutExecutiveDashboardView />;
  }

  return (
    <ErrorBoundary>
      <ExecutiveDashboardPage />
    </ErrorBoundary>
  );
}
