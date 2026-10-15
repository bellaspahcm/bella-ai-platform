'use client';

/**
 * Employee Performance Dashboard
 * 
 * Comprehensive KTV performance analysis showing:
 * 1. Overall performance scores and rankings
 * 2. KPI achievement trends
 * 3. Customer satisfaction (star ratings)
 * 4. Productivity metrics (sessions completed, revenue contribution)
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Award,
  TrendingUp,
  Star,
  Target,
  RefreshCw,
  AlertCircle,
  Users,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { cn } from '@/lib/utils';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { EmployeePerformance } from '@/services/intelligence/hr/queries';
import {
  PerformanceScoreChart,
  KpiTrendChart,
  RatingDistributionChart,
  ProductivityComparisonChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'overview' | 'kpi' | 'rating' | 'productivity';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeePerformanceDashboard() {
  const router = useRouter();
  const vocab = useModuleVocabulary();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response state
  const [performanceData, setPerformanceData] = useState<IntelligenceResponse<EmployeePerformance[]> | null>(null);

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
  // Fetch performance metrics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchPerformanceMetrics = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ 
        tenantId, 
        month 
      });

      const response = await fetch(`/api/intelligence/hr/employee-performance?${params}`);
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setPerformanceData(data);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, month]);

  useEffect(() => {
    if (tenantId) {
      fetchPerformanceMetrics();
    }
  }, [tenantId, fetchPerformanceMetrics]);

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
  // Calculate aggregate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const getAggregateMetrics = () => {
    if (!performanceData || !performanceData.data || performanceData.data.length === 0) {
      return {
        avgPerformanceScore: 0,
        avgKpiScore: 0,
        avgRating: 0,
        totalSessionsCompleted: 0,
        totalRevenueContribution: 0,
        topPerformers: [],
      };
    }

    const data = performanceData.data;
    const total = data.length;

    // Calculate averages
    const avgPerformanceScore = data.reduce((sum, ktv) => sum + ktv.overallPerformanceScore, 0) / total;
    const avgKpiScore = data.reduce((sum, ktv) => sum + ktv.kpiScore, 0) / total;
    const avgRating = data.reduce((sum, ktv) => sum + ktv.avgStarRating, 0) / total;
    const totalSessionsCompleted = data.reduce((sum, ktv) => sum + ktv.totalSessionsCompleted, 0);
    const totalRevenueContribution = data.reduce((sum, ktv) => sum + ktv.totalRevenueContributed, 0);

    // Get top 3 performers
    const topPerformers = [...data]
      .sort((a, b) => b.overallPerformanceScore - a.overallPerformanceScore)
      .slice(0, 3);

    return {
      avgPerformanceScore,
      avgKpiScore,
      avgRating,
      totalSessionsCompleted,
      totalRevenueContribution,
      topPerformers,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="h-9 w-64 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-5 w-96 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-11 w-80 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-11 w-32 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
            <div className="h-11 w-28 bg-slate-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
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

  const metrics = getAggregateMetrics();

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
              Hiệu Suất {vocab.worker.short}
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Đánh giá tổng hợp hiệu suất làm việc của {vocab.worker.plural.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex bg-white/60 p-1.5 rounded-2xl border border-slate-100 gap-1.5 backdrop-blur-md shadow-sm">
            {(['overview', 'kpi', 'rating', 'productivity'] as const).map((mode) => {
              const labelMap = {
                overview: 'Tổng quan',
                kpi: 'KPI',
                rating: 'Đánh giá',
                productivity: 'Năng suất',
              };
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  {labelMap[mode]}
                </button>
              );
            })}
          </div>

          {/* Month Selector */}
          <div className="relative group">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-4 py-3 bg-white/85 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm font-bold text-slate-800"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchPerformanceMetrics(true)}
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
        {/* Average Performance Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Điểm Hiệu Suất TB</p>
              <p className="text-3xl font-black text-purple-600 mt-2">
                {formatNumber(metrics.avgPerformanceScore, 1)}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                trên thang 100
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl">
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </motion.div>

        {/* Average KPI Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Điểm KPI TB</p>
              <p className="text-3xl font-black text-blue-600 mt-2">
                {formatNumber(metrics.avgKpiScore, 1)}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                chỉ tiêu tháng
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </motion.div>

        {/* Average Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đánh Giá TB</p>
              <p className="text-3xl font-black text-yellow-600 mt-2">
                {formatNumber(metrics.avgRating, 1)} ⭐
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2">
                từ khách hàng
              </p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-2xl">
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </motion.div>

        {/* Total Sessions Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Tổng {vocab.workUnit.singular.toLowerCase()} hoàn thành
              </p>
              <p className="text-3xl font-black text-green-600 mt-2">
                {formatNumber(metrics.totalSessionsCompleted)}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-2 truncate">
                Doanh thu: {formatCurrency(metrics.totalRevenueContribution)}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl shrink-0">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top Performers Banner */}
      {metrics.topPerformers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="luxury-card-pink relative overflow-hidden rounded-[2rem] p-6 shadow-lg text-white"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-6 w-6" />
              <h3 className="text-lg font-black uppercase tracking-wider">
                Top 3 {vocab.worker.short} Xuất Sắc Tháng Này
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics.topPerformers.map((ktv, index) => (
                <div key={ktv.ktvId} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full font-bold shadow-inner border border-white/20",
                      index === 0 ? 'bg-yellow-400 text-yellow-950' :
                      index === 1 ? 'bg-slate-200 text-slate-900' :
                      'bg-amber-600 text-white'
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold">{ktv.ktvName}</p>
                      <p className="text-xs opacity-90 font-semibold">
                        Điểm: {formatNumber(ktv.overallPerformanceScore, 1)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <div>
                      <p className="opacity-75">KPI</p>
                      <p className="font-bold">{formatNumber(ktv.kpiScore, 1)}</p>
                    </div>
                    <div>
                      <p className="opacity-75">Đánh giá</p>
                      <p className="font-bold">{formatNumber(ktv.avgStarRating, 1)} ⭐</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </motion.div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Performance Score Distribution */}
        {(viewMode === 'overview' || viewMode === 'kpi') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Phân Bổ Điểm Hiệu Suất
                </h3>
              </div>
              {performanceData.metadata.cacheHit && (
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Cache</span>
              )}
            </div>

            {performanceData.data.length > 0 ? (
              <PerformanceScoreChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 2: KPI Trend */}
        {(viewMode === 'overview' || viewMode === 'kpi') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Top 10 Đạt KPI Cao Nhất
                </h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <KpiTrendChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 3: Rating Distribution */}
        {(viewMode === 'overview' || viewMode === 'rating') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-2xl">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Phân Bổ Đánh Giá Sao
                </h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <RatingDistributionChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chart 4: Productivity Comparison */}
        {(viewMode === 'overview' || viewMode === 'productivity') && performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  So Sánh Năng Suất
                </h3>
              </div>
            </div>

            {performanceData.data.length > 0 ? (
              <ProductivityComparisonChart data={performanceData.data} />
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Cache Info Footer */}
      {performanceData && (
        <div className="text-center text-sm text-slate-500">
          <p className="font-medium">
            Dữ liệu được tạo lúc {new Date(performanceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}({performanceData.metadata.cacheHit ? 'Cache' : 'Mới'})
          </p>
        </div>
      )}
    </div>
  );
}
