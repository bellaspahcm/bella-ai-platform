'use client';

/**
 * Workforce Analytics Dashboard
 * 
 * Comprehensive HR workforce analysis showing:
 * 1. Headcount trends (current/new hires/terminations)
 * 2. Turnover rate and retention metrics
 * 3. Employee tenure distribution
 * 4. Role distribution and department breakdown
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserMinus,
  Calendar,
  RefreshCw,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { cn } from '@/lib/utils';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { WorkforceAnalytics } from '@/services/intelligence/hr/queries';
import {
  HeadcountTrendChart,
  TurnoverRateChart,
  RoleDistributionChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PeriodType = 'month' | 'quarter' | 'year';
const WORKFORCE_PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'month', label: 'Tháng gần đây' },
  { value: 'quarter', label: 'Quý gần đây' },
  { value: 'year', label: 'Năm gần đây' },
];

type WorkforceDataPayload = WorkforceAnalytics[] | {
  departmentBreakdown?: Array<{ department?: string | null; employeeCount?: number | null }>;
  totalEmployees?: number;
  activeEmployees?: number;
  turnoverRate?: number;
  avgWorkingDaysPerMonth?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkforceAnalyticsDashboard() {
  const router = useRouter();
  const vocab = useModuleVocabulary();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state (can be array or single object depending on simplified query service)
  const [workforceData, setWorkforceData] = useState<IntelligenceResponse<WorkforceDataPayload> | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant and check authorization
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

      // Check if user has admin role
      if (profile.role !== 'admin') {
        toast.error('Bạn không có quyền truy cập trang này');
        router.push('/dashboard');
        return;
      }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch workforce analytics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchWorkforceAnalytics = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({
        tenantId,
        period,
      });

      const response = await fetch(`/api/intelligence/hr/workforce-analytics?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setWorkforceData(data);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch workforce analytics:', error);
      toast.error('Không thể tải dữ liệu phân tích nhân sự');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, period]);

  useEffect(() => {
    if (tenantId) {
      fetchWorkforceAnalytics();
    }
  }, [tenantId, fetchWorkforceAnalytics]);

  // ───────────────────────────────────────────────────────────────────────────
  // Helper functions
  // ───────────────────────────────────────────────────────────────────────────

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value: number, decimals = 1) => {
    return `${formatNumber(value, decimals)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate normalized data to prevent API type discrepancy crashes
  // ───────────────────────────────────────────────────────────────────────────

  const getNormalizedData = (): WorkforceAnalytics[] => {
    if (!workforceData || !workforceData.data) return [];
    if (Array.isArray(workforceData.data)) {
      return workforceData.data;
    }
    
    // Single object format returned by simplified queries-simple
    const s = workforceData.data as {
      departmentBreakdown?: Array<{ department?: string | null; employeeCount?: number | null }>;
      totalEmployees?: number;
      activeEmployees?: number;
      turnoverRate?: number;
      avgWorkingDaysPerMonth?: number;
    };
    const deptList = s.departmentBreakdown || [];
    
    if (deptList.length > 0) {
      return deptList.map((d: { department?: string | null; employeeCount?: number | null }) => ({
        tenantId: tenantId || '',
        month: new Date().toISOString().slice(0, 7),
        role: d.department || 'Staff',
        newHires: 0,
        terminations: 0,
        currentHeadcount: d.employeeCount || 0,
        totalEverHired: s.totalEmployees || 0,
        turnoverRatePct: s.turnoverRate || 0,
        avgTenureMonths: s.avgWorkingDaysPerMonth || 0,
        roleDistributionPct: s.totalEmployees && s.totalEmployees > 0 ? (Number(d.employeeCount || 0) / s.totalEmployees) * 100 : 0,
        computedAt: new Date().toISOString(),
      }));
    }

    return [{
      tenantId: tenantId || '',
      month: new Date().toISOString().slice(0, 7),
      role: 'Staff',
      newHires: 0,
      terminations: 0,
      currentHeadcount: s.totalEmployees || s.activeEmployees || 0,
      totalEverHired: s.totalEmployees || s.activeEmployees || 0,
      turnoverRatePct: s.turnoverRate || 0,
      avgTenureMonths: s.avgWorkingDaysPerMonth || 0,
      roleDistributionPct: 100,
      computedAt: new Date().toISOString(),
    }];
  };

  const dataArray = getNormalizedData();

  const getCurrentMetrics = () => {
    if (dataArray.length === 0) return null;
    
    // If it was a single object, aggregate dataArray to represent current metrics
    if (!Array.isArray(workforceData?.data)) {
      const s = workforceData?.data as {
        totalEmployees?: number;
        activeEmployees?: number;
        turnoverRate?: number;
        avgWorkingDaysPerMonth?: number;
      };
      return {
        month: new Date().toISOString().slice(0, 7),
        currentHeadcount: s.totalEmployees || s.activeEmployees || 0,
        newHires: 0,
        terminations: 0,
        turnoverRatePct: s.turnoverRate || 0,
        avgTenureMonths: s.avgWorkingDaysPerMonth || 0,
      };
    }
    return dataArray[0]; // Latest month
  };

  const currentMetrics = getCurrentMetrics();

  const getHeadcountTrendData = () => {
    if (dataArray.length === 0) return [];

    return dataArray
      .slice()
      .reverse() // Show oldest to newest
      .map(item => ({
        month: item.month.substring(5, 7) + '/' + item.month.substring(0, 4), // MM/YYYY
        headcount: item.currentHeadcount,
        newHires: item.newHires,
        terminations: item.terminations,
      }));
  };

  const getTurnoverRateData = () => {
    if (dataArray.length === 0) return [];

    return dataArray
      .slice()
      .reverse()
      .map(item => ({
        month: item.month.substring(5, 7) + '/' + item.month.substring(0, 4),
        turnoverRate: item.turnoverRatePct,
      }));
  };

  const getRoleDistributionData = () => {
    if (dataArray.length === 0) return [];

    // Group by role and sum current headcount
    const roleMap = new Map<string, { count: number; percentage: number }>();
    
    dataArray.forEach(item => {
      if (!roleMap.has(item.role)) {
        roleMap.set(item.role, {
          count: item.currentHeadcount,
          percentage: item.roleDistributionPct,
        });
      }
    });

    return Array.from(roleMap.entries()).map(([role, data]) => ({
      role,
      count: data.count,
      percentage: data.percentage,
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const calculateHeadcountChange = () => {
    if (!Array.isArray(workforceData?.data) || dataArray.length < 2) return 0;

    const current = dataArray[0].currentHeadcount;
    const previous = dataArray[1].currentHeadcount;

    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getAverageTenure = () => {
    const current = currentMetrics;
    if (!current) return 0;
    return current.avgTenureMonths;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-9 w-64 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
              <div className="h-5 w-96 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-11 w-48 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-11 w-32 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-slate-200 dark:border-zinc-800 h-32 animate-pulse flex items-center justify-between shadow-sm">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-28 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-20 bg-slate-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="w-12 h-12 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-slate-200 dark:border-zinc-800 h-[400px] animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
                  <div className="h-6 w-48 bg-slate-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="h-64 w-full bg-slate-100 dark:bg-zinc-800/40 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-12 h-12 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-slate-200/60 text-slate-600 hover:text-primary hover:border-primary/30 active:scale-95 transition-all shadow-sm shrink-0"
            title="Quay lại trang trước"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter sm:text-4xl font-heading uppercase">
              Phân Tích Nhân Sự
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Theo dõi quy mô nhân sự, tỷ lệ nghỉ việc và phân bố {vocab.worker.plural.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Period Selector */}
          <PremiumSelect
            value={period}
            onChange={(value) => setPeriod(value as PeriodType)}
            options={WORKFORCE_PERIOD_OPTIONS}
            ariaLabel="Chọn kỳ phân tích nhân sự"
            className="w-44 space-y-0"
            buttonClassName="h-12 rounded-2xl border-border bg-white/85 px-4 py-3 font-bold shadow-sm hover:border-primary/30"
            dropdownClassName="min-w-44"
          />

          {/* Refresh Button */}
          <button
            onClick={() => fetchWorkforceAnalytics(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-primary/20 dark:shadow-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Current Headcount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng Nhân Sự</p>
              <p className="text-3xl font-black text-slate-900 mt-2">
                {currentMetrics ? formatNumber(currentMetrics.currentHeadcount) : '--'}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {calculateHeadcountChange() >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-bold",
                  calculateHeadcountChange() >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {calculateHeadcountChange() >= 0 ? '+' : ''}{formatNumber(calculateHeadcountChange(), 1)}%
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">so với tháng trước</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 2: New Hires */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tuyển Mới</p>
              <p className="text-3xl font-black text-green-600 mt-2">
                {currentMetrics ? formatNumber(currentMetrics.newHires) : '--'}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                người trong tháng này
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl">
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 3: Terminations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nghỉ Việc</p>
              <p className="text-3xl font-black text-red-600 mt-2">
                {currentMetrics ? formatNumber(currentMetrics.terminations) : '--'}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                người trong tháng này
              </p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl">
              <UserMinus className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </motion.div>

        {/* Metric 4: Turnover Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tỷ Lệ Nghỉ Việc</p>
              <p className="text-3xl font-black text-orange-600 mt-2">
                {currentMetrics ? formatPercent(currentMetrics.turnoverRatePct) : '--'}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                Thời gian làm TB: {getAverageTenure()} tháng
              </p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl">
              <TrendingDown className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Headcount Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Xu Hướng Nhân Sự</h3>
            </div>
            {workforceData?.metadata.cacheHit && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Cache</span>
            )}
          </div>

          {dataArray.length > 0 ? (
            <HeadcountTrendChart data={getHeadcountTrendData()} height={300} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 2: Turnover Rate Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Tỷ Lệ Nghỉ Việc</h3>
            </div>
          </div>

          {dataArray.length > 0 ? (
            <TurnoverRateChart data={getTurnoverRateData()} height={300} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 3: Tenure Distribution - Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Thâm Niên Trung Bình</h3>
            </div>
          </div>

          {currentMetrics ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-6xl font-black text-purple-600 mb-2">
                  {formatNumber(currentMetrics.avgTenureMonths, 1)}
                </div>
                <p className="text-lg font-bold text-slate-600">tháng</p>
                <p className="text-sm font-semibold text-slate-500 mt-4">
                  Thời gian làm việc trung bình của nhân viên
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Chart 4: Role Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl">
                <PieChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Phân Bố Vai Trò</h3>
            </div>
          </div>

          {currentMetrics && getRoleDistributionData().length > 0 ? (
            <>
              <RoleDistributionChart data={getRoleDistributionData()} height={250} />
              
              {/* Role Summary Table */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  {getRoleDistributionData().slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-semibold">{item.role}</span>
                      <div className="flex items-center gap-3 font-bold">
                        <span className="text-slate-900">{item.count} người</span>
                        <span className="text-slate-500">({formatPercent(item.percentage)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Cache Info Footer */}
      {workforceData && (
        <div className="text-center text-sm text-slate-500">
          <p className="font-medium">
            Dữ liệu được tạo lúc {new Date(workforceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({workforceData.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'})
            {' '}- Query time: {workforceData.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
