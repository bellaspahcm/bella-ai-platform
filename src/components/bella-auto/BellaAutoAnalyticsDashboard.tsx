'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { TrendingUp, TrendingDown, DollarSign, Clock, Package, Activity, Calendar } from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { RecognizedSalesDashboard } from '@/modules/bella-auto/services/FinancialReportingService';
import { RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { AutoAnalyticsCharts, type AutoAnalyticsInventory } from './AutoAnalyticsCharts';

const recognizedSalesResponse = z.object({
  summary: z.object({ revenue: z.number().int().safe(), sales: z.number().int().nonnegative(), averageSalePrice: z.number().finite() }),
  timeZone: z.literal('UTC'),
  revenueByMonth: z.array(z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    revenue: z.number().int().safe(), sales: z.number().int().nonnegative(),
  })).length(6),
  topModels: z.array(z.object({
    model: z.string(), sold: z.number().int().nonnegative(), revenue: z.number().int().safe(),
  })).max(5),
});

interface AnalyticsData {
  monthlyTrend: Array<{ month: string; nhap: number; xuat: number; ton: number }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  inventoryValue: {
    total: number;
    byStatus: Array<{ status: string; value: number }>;
  };
  weeklyDeliveries: Array<{ week: string; deliveries: number }>;
}

interface BellaAutoAnalyticsDashboardProps {
  tenantId: string;
  inventory?: AutoAnalyticsInventory;
}

// Interactive Header Actions for Premium look
const CardHeaderActions = () => {
  const [timeRange, setTimeRange] = useState('6_months');
  
  const timeRangeOptions = [
    { value: '6_months', label: '6 tháng qua', icon: <Calendar className="w-4 h-4" /> },
    { value: '30_days', label: '30 ngày qua', icon: <Calendar className="w-4 h-4" /> },
    { value: 'this_year', label: 'Năm nay', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-1.5 animate-fade-in">
      <div className="w-40">
        <PremiumSelect
          value={timeRange}
          onChange={setTimeRange}
          options={timeRangeOptions}
          placeholder="Chọn khoảng thời gian"
        />
      </div>
      <button 
        title="Tải báo cáo"
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
};

// Custom Glassmorphic Tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    fill?: string;
  }>;
  label?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, valueFormatter }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-lg dark:shadow-2xl transition-all duration-200">
        <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <span 
                className="w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-950 shadow-sm" 
                style={{ backgroundColor: item.color || item.fill }} 
              />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {item.name}:
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white ml-auto">
                {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Create client outside component to avoid recreating on every render
const supabase = createClient();

export default function BellaAutoAnalyticsDashboard({ tenantId, inventory }: BellaAutoAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sales, setSales] = useState<RecognizedSalesDashboard | null>(null);
  const [salesError, setSalesError] = useState(false);
  const [salesAttempt, setSalesAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSales(null);
    setSalesError(false);
    void fetch('/api/bella-auto/analytics/recognized-sales', {
      cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Recognized sales read failed');
      const data = recognizedSalesResponse.parse(await response.json());
      if (!controller.signal.aborted) setSales(data);
    }).catch(() => { if (!controller.signal.aborted) setSalesError(true); });
    return () => controller.abort();
  }, [tenantId, salesAttempt]);

  // Wait for component to mount before rendering charts
  useEffect(() => {
    // Delay mounting to ensure parent containers have computed dimensions
    const timer = setTimeout(() => {
      setMounted(true);
    }, 300); // Increased delay for container sizing
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        console.log('[BellaAuto] Starting analytics load for tenant:', tenantId);
        
        // ✅ Call real RPCs — SECURITY DEFINER bypass RLS, DB timeout = 30s
        const [trendResult, deliveriesResult] = await Promise.all([
          supabase.rpc('get_auto_inventory_trend', { p_tenant_id: tenantId }),
          supabase.rpc('get_auto_weekly_deliveries', { p_tenant_id: tenantId }),
        ]);
      
      console.log('[BellaAuto] RPCs completed');

      // Check for errors - log details for debugging
      if (trendResult.error) {
        console.error('[BellaAuto] Trend RPC error:', trendResult.error);
        console.error('[BellaAuto] Trend error details:', {
          message: trendResult.error.message,
          code: trendResult.error.code,
          details: trendResult.error.details,
          hint: trendResult.error.hint,
        });
      }
      if (deliveriesResult.error) {
        console.error('[BellaAuto] Deliveries RPC error:', deliveriesResult.error);
        console.error('[BellaAuto] Deliveries error details:', {
          message: deliveriesResult.error.message,
          code: deliveriesResult.error.code,
          details: deliveriesResult.error.details,
          hint: deliveriesResult.error.hint,
        });
      }

      // Dùng RPC get_auto_inventory_stats thay vì fetch toàn bộ rows
      // RPC trả về GROUP BY status với COUNT + SUM(list_price) → 1 query, indexed
      const { data: statsRows, error: statsError } = await supabase
        .rpc('get_auto_inventory_stats', { p_tenant_id: tenantId });

      if (statsError) throw statsError;

      const statsList = statsRows || [];

      // Build status distribution từ aggregated data
      const statusDistribution = [
        { name: 'Showroom',         value: 0, color: '#06b6d4' },
        { name: 'Kho',              value: 0, color: '#64748b' },
        { name: 'Đã phân bổ',      value: 0, color: '#f59e0b' },
        { name: 'Đang vận chuyển', value: 0, color: '#6366f1' },
        { name: 'Đã bàn giao',     value: 0, color: '#10b981' },
      ];

      let totalInventoryValue = 0;
      const byStatus: Array<{ status: string; value: number }> = [];

      for (const row of statsList) {
        const cnt   = Number(row.cnt ?? 0);
        const val   = Number(row.total_value ?? 0);
        totalInventoryValue += val;

        const label =
          row.status === 'showroom'   ? 'Showroom' :
          row.status === 'warehouse'  ? 'Kho' :
          row.status === 'allocated'  ? 'Đã phân bổ' :
          row.status === 'in_transit' ? 'Đang vận chuyển' : 'Đã bàn giao';

        byStatus.push({ status: label, value: val });

        const dist = statusDistribution.find(d => d.name === label);
        if (dist) dist.value = cnt;
      }

      const inventoryValue = {
        total: totalInventoryValue,
        byStatus,
      };

      // ✅ Use RPC data with proper null handling
      setAnalytics({
        monthlyTrend: trendResult.data || [],
        statusDistribution: statusDistribution.filter(item => item.value > 0),
        inventoryValue,
        weeklyDeliveries: deliveriesResult.data || [],
      });

      // Log data summary for debugging
      console.log('[BellaAuto] Analytics loaded successfully:', {
        monthlyTrend: (trendResult.data || []).length,
        weeklyDeliveries: (deliveriesResult.data || []).length,
        statusDistribution: statusDistribution.length,
      });
    } catch (error) {
      console.error('[BellaAuto] Error loading analytics:', error);
      // Set empty data on error to prevent crash
      setAnalytics({
        monthlyTrend: [],
        statusDistribution: [],
        inventoryValue: { total: 0, byStatus: [] },
        weeklyDeliveries: [],
      });
    } finally {
      console.log('[BellaAuto] Loading complete, setting loading=false');
      setLoading(false);
    }
    };

    loadAnalytics();
  }, [tenantId]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} Tỷ`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)} Tr`;
    }
    return value.toLocaleString('vi-VN');
  };

  const formatTopModelTooltip = (value: unknown, name: unknown): [string, string] => {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (name === 'revenue') {
      return [`${formatCurrency(Number.isFinite(numericValue) ? numericValue : 0)} VNĐ`, 'Doanh thu'];
    }

    return [String(value), 'Số lượng'];
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('vi-VN');
  };

  const salesReadState = salesError ? (
    <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 text-red-600 dark:text-red-400">
      <p>Không thể tải dữ liệu bán xe đã ghi nhận.</p>
      <button type="button" onClick={() => setSalesAttempt(value => value + 1)}
        className="inline-flex items-center gap-2 rounded border border-current px-3 py-2" title="Thử tải lại">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />Thử lại
      </button>
    </div>
  ) : !sales ? (
    <p role="status" className="flex h-64 items-center justify-center text-slate-500">Đang tải dữ liệu bán xe…</p>
  ) : null;

  if (loading || !mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inventory && <AutoAnalyticsCharts {...inventory} recognizedSales={sales} salesError={salesError} />}
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Giá trị tồn kho"
          value={formatCurrency(analytics.inventoryValue.total)}
          suffix="VNĐ"
          icon={<DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
          trend={{ value: 12.5, isPositive: true }}
          color="cyan"
        />
        <MetricCard
          title="Thời gian tồn TB"
          value="Chưa có dữ liệu"
          suffix=""
          icon={<Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          color="amber"
        />
        <MetricCard
          title="Xe trong kho"
          value={formatNumber(analytics.statusDistribution.reduce((sum, item) => sum + item.value, 0))}
          suffix="xe"
          icon={<Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
          trend={{ value: 5.8, isPositive: true }}
          color="slate"
        />
        <MetricCard
          title="Bàn giao tuần này"
          value={formatNumber(analytics.weeklyDeliveries.length > 0 
            ? analytics.weeklyDeliveries[analytics.weeklyDeliveries.length - 1].deliveries 
            : 0
          )}
          suffix="xe"
          icon={<Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          trend={{ value: 15.3, isPositive: true }}
          color="emerald"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Monthly Inventory Trend */}
        <ChartCard 
          title="Xu hướng nhập/xuất kho" 
          subtitle="Biểu đồ phân tích lượng xe luân chuyển trong 6 tháng qua"
          icon={<TrendingUp className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="mt-4" style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyTrend} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNhap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorXuat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorTon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="nhap" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorNhap)" name="Nhập kho" />
                <Area type="monotone" dataKey="xuat" stroke="#10b981" strokeWidth={2.5} fill="url(#colorXuat)" name="Xuất kho" />
                <Area type="monotone" dataKey="ton" stroke="#f59e0b" strokeWidth={3} fill="url(#colorTon)" name="Tồn kho" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Custom Horizontal Legend for Clean Look */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100/50 dark:border-slate-800/40">
            {[
              { label: 'Nhập kho', color: '#06b6d4' },
              { label: 'Xuất kho', color: '#10b981' },
              { label: 'Tồn kho', color: '#f59e0b' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Status Distribution (Doughnut Chart with Center Label) */}
        <ChartCard 
          title="Phân bố trạng thái xe" 
          subtitle="Tỷ lệ cơ cấu trạng thái của xe trong hệ thống"
          icon={<Package className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="flex flex-col justify-between" style={{ minHeight: 300 }}>
            <div className="mt-4 relative" style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={92}
                    paddingAngle={4}
                    cornerRadius={5}
                    dataKey="value"
                  >
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  {/* Center Text inside PieChart */}
                  <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 dark:fill-slate-500 font-bold text-[10px] tracking-widest uppercase">
                    Tổng xe
                  </text>
                  <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 dark:fill-slate-100 font-extrabold text-2xl tracking-tight">
                    {formatNumber(analytics.statusDistribution.reduce((sum, item) => sum + item.value, 0))}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Grid Legend with values & percentages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-4 border-t border-slate-100/50 dark:border-slate-800/40">
              {analytics.statusDistribution.map((item, index) => {
                const total = analytics.statusDistribution.reduce((sum, i) => sum + i.value, 0);
                const percentage = ((item.value / total) * 100).toFixed(0);
                return (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100/50 dark:border-slate-800/30">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate leading-none mb-0.5 uppercase tracking-wider">{item.name}</p>
                      <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 leading-none">
                        {formatNumber(item.value)} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({percentage}%)</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>

        {/* Top Models by Sales */}
        <ChartCard 
          title="Top 5 mẫu xe bán chạy" 
          subtitle="Số giao dịch đã ghi nhận · Toàn thời gian"
          icon={<TrendingUp className="w-4 h-4" />}
        >
          {salesReadState || (sales && sales.topModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 dark:text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold">Chưa có dữ liệu bán hàng</p>
              <p className="text-xs text-center max-w-xs">Chưa có giao dịch bán xe được ghi nhận</p>
            </div>
          ) : (
            <div className="mt-4" style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales?.topModels} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barModelGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="model" type="category" stroke="#cbd5e1" tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} dx={-4} width={110} />
                  <Tooltip content={<CustomTooltip />} formatter={formatTopModelTooltip} />
                  <Bar dataKey="sold" fill="url(#barModelGradient)" name="Đã bán" radius={[0, 6, 6, 0]} barSize={12} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </ChartCard>

        {/* Revenue Trend (LineChart styled as Area) */}
        <ChartCard 
          title="Doanh thu theo tháng" 
          subtitle="Doanh thu đã ghi nhận · 6 tháng · UTC"
          icon={<DollarSign className="w-4 h-4" />}
        >
          {sales && (
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2" data-testid="recognized-sales-current-month">
              <span className="text-sm text-slate-500">{sales.revenueByMonth[5].month}</span>
              <strong className="text-base text-slate-900 dark:text-white">
                {sales.revenueByMonth[5].revenue.toLocaleString('vi-VN')} VNĐ
              </strong>
            </div>
          )}
          {salesReadState || (sales && sales.revenueByMonth.every(m => m.sales === 0) ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 dark:text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <DollarSign className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold">Chưa có dữ liệu doanh thu</p>
              <p className="text-xs text-center max-w-xs">Chưa có doanh thu được ghi nhận trong kỳ</p>
            </div>
          ) : (
          <div className="mt-4" style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales?.revenueByMonth} margin={{ top: 10, right: 10, left: 58, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatCurrency}
                  width={55}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  isAnimationActive={false}
                  stroke="#10b981" 
                  strokeWidth={3.5}
                  fill="url(#revenueGradient)"
                  name="Doanh thu"
                  dot={{ fill: '#10b981', r: 4, strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          ))}
        </ChartCard>

        {/* Weekly Deliveries */}
        <ChartCard 
          title="Bàn giao xe theo tuần" 
          subtitle="Số lượng bàn giao hoàn tất cho khách hàng"
          icon={<Activity className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="mt-4" style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.weeklyDeliveries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="week" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  allowDecimals={false}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deliveries" fill="url(#deliveryGradient)" name="Xe bàn giao" radius={[5, 5, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Inventory Value by Status */}
        <ChartCard 
          title="Giá trị tồn kho theo trạng thái" 
          subtitle="Phân bổ tổng giá trị xe (VNĐ) theo từng hiện trạng"
          icon={<DollarSign className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="mt-4" style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.inventoryValue.byStatus} margin={{ top: 10, right: 10, left: 58, bottom: 0 }}>
                <defs>
                  <linearGradient id="valueStatusGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="status" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatCurrency}
                  width={55}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
                <Bar dataKey="value" fill="url(#valueStatusGradient)" name="Giá trị" radius={[5, 5, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// Premium Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  suffix: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: 'cyan' | 'amber' | 'slate' | 'emerald';
}

function MetricCard({ title, value, suffix, icon, trend, color }: MetricCardProps) {
  const colorClasses = {
    cyan: 'bg-gradient-to-br from-cyan-50/70 to-cyan-100/20 dark:from-cyan-950/30 dark:to-cyan-900/15 border-cyan-300/80 dark:border-cyan-800/60 shadow-[0_4px_20px_rgba(6,182,212,0.12),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(6,182,212,0.22)]',
    amber: 'bg-gradient-to-br from-amber-50/70 to-amber-100/20 dark:from-amber-950/30 dark:to-amber-900/15 border-amber-300/80 dark:border-amber-800/60 shadow-[0_4px_20px_rgba(245,158,11,0.12),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(245,158,11,0.22)]',
    slate: 'bg-gradient-to-br from-slate-50/70 to-slate-100/20 dark:from-slate-900/40 dark:to-slate-850/20 border-slate-300/80 dark:border-slate-700/60 shadow-[0_4px_20px_rgba(15,23,42,0.08),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.15)]',
    emerald: 'bg-gradient-to-br from-emerald-50/70 to-emerald-100/20 dark:from-emerald-950/30 dark:to-emerald-900/15 border-emerald-300/80 dark:border-emerald-800/60 shadow-[0_4px_20px_rgba(16,185,129,0.12),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.22)]',
  };

  const iconColorClasses = {
    cyan: 'text-cyan-600 dark:text-cyan-400 bg-white/90 dark:bg-slate-950/70 border-cyan-200/60 dark:border-cyan-900/40',
    amber: 'text-amber-600 dark:text-amber-400 bg-white/90 dark:bg-slate-950/70 border-amber-200/60 dark:border-amber-900/40',
    slate: 'text-slate-600 dark:text-slate-400 bg-white/90 dark:bg-slate-950/70 border-slate-200/60 dark:border-slate-800/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-white/90 dark:bg-slate-950/70 border-emerald-200/60 dark:border-emerald-900/40',
  };

  return (
    <div className={`p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">{title}</p>
        <div className={`p-2.5 rounded-2xl shadow-xs border ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{suffix}</span>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-850/60">
          <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
            trend.isPositive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
          }`}>
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            {trend.value}%
          </div>
          <span className="text-[10px] text-slate-400 font-semibold">so với tháng trước</span>
        </div>
      )}
    </div>
  );
}

// Premium Chart Card Component
interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}

function ChartCard({ title, subtitle, icon, children, extra }: ChartCardProps) {
  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 shadow-[0_6px_24px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.6)] transition-all duration-300">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200/60 dark:border-cyan-900/40 text-cyan-600 dark:text-cyan-400 shadow-xs shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-wide">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
      {/* Fix Recharts width(-1) height(-1) warning by ensuring minimum dimensions */}
      <div className="w-full" style={{ minWidth: 300, minHeight: 320 }}>
        {children}
      </div>
    </div>
  );
}
