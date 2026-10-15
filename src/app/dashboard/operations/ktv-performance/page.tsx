'use client';

/**
 * KTV Performance Dashboard - Operations Manager Intelligence
 * 
 * Operational metrics for KTV management:
 * 1. KTV Leaderboard (Top performers ranked by revenue/sessions/rating)
 * 2. Individual KTV Detail Panel (Sessions, ratings, revenue, attendance)
 * 3. Performance Trends (Weekly/monthly comparisons)
 * 4. Attendance Summary
 * 
 * Data flows through Operational Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Star,
  Users, 
  BarChart3,
  RefreshCw,
  Award,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';

// Types
interface KtvLeaderboardEntry {
  rank: number;
  ktvId: string;
  ktvName: string;
  metricValue: number;
  totalSessionsCompleted: number;
  avgRating: number;
  totalRevenue: number;
  attendanceRatePct: number;
}

interface RawKtvLeaderboardEntry {
  rank?: number;
  id?: string;
  ktvId?: string;
  ktvName?: string;
  full_name?: string;
  metricValue?: number;
  totalSessionsCompleted?: number;
  totalSessions?: number;
  avgRating?: number;
  totalRevenue?: number;
  attendanceRatePct?: number;
  customerSatisfactionScore?: number;
  performanceScore?: number;
}

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
type LeaderboardMetric = 'revenue' | 'sessions' | 'rating';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function KtvPerformanceDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [metric, setMetric] = useState<LeaderboardMetric>('revenue');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedKtvId, setSelectedKtvId] = useState<string | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<IntelligenceResponse<KtvLeaderboardEntry[]> | null>(null);

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

      // Check if user has operations manager or admin role
      if (!['admin', 'manager'].includes(profile.role)) {
        toast.error('Bạn không có quyền truy cập trang này');
        router.push('/dashboard');
        return;
      }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  const fetchLeaderboard = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    const cleanLeaderboardData = (data: RawKtvLeaderboardEntry[]): KtvLeaderboardEntry[] => {
      return (data || []).map((item, index) => {
        const totalSessionsCompleted = item.totalSessionsCompleted ?? item.totalSessions ?? 0;
        const avgRating = item.avgRating ?? 0;
        const totalRevenue = item.totalRevenue ?? 0;
        const attendanceRatePct = item.attendanceRatePct ?? item.customerSatisfactionScore ?? item.performanceScore ?? 100;
        
        let metricValue = item.metricValue;
        if (metricValue === undefined || metricValue === null || isNaN(Number(metricValue))) {
          if (metric === 'revenue') metricValue = totalRevenue;
          else if (metric === 'sessions') metricValue = totalSessionsCompleted;
          else if (metric === 'rating') metricValue = avgRating;
        }

        return {
          rank: item.rank ?? (index + 1),
          ktvId: item.ktvId || item.id || `ktv-${index}`,
          ktvName: item.ktvName || item.full_name || 'Kỹ thuật viên',
          metricValue: Number(metricValue),
          totalSessionsCompleted: Number(totalSessionsCompleted),
          avgRating: Number(avgRating),
          totalRevenue: Number(totalRevenue),
          attendanceRatePct: Number(attendanceRatePct),
        };
      });
    };

    try {
      const params = new URLSearchParams({ 
        tenantId, 
        period, 
        metric,
        limit: '10'
      });

      const response = await fetch(`/api/intelligence/operational/ktv-leaderboard?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data && Array.isArray(data.data)) {
        data.data = cleanLeaderboardData(data.data);
      }
      setLeaderboard(data);
      
      if (refresh) {
        toast.success('Đã làm mới dữ liệu');
      }
    } catch (error) {
      console.error('Failed to fetch KTV leaderboard:', error);
      toast.error('Không thể tải dữ liệu KTV');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, period, metric]);

  useEffect(() => {
    if (tenantId) {
      fetchLeaderboard();
    }
  }, [tenantId, fetchLeaderboard]);

  const handleRefresh = () => {
    fetchLeaderboard(true);
  };

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  const handleMetricChange = (newMetric: LeaderboardMetric) => {
    setMetric(newMetric);
  };

  const handleKtvClick = (ktvId: string) => {
    setSelectedKtvId(selectedKtvId === ktvId ? null : ktvId);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(value));
  };

  const formatNumber = (value: number | null | undefined, decimals = 0) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '0';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(value));
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-400/20';
    if (rank === 2) return 'bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-400/20';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-sm shadow-orange-400/20';
    return 'bg-slate-100 text-slate-600';
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Award className="h-3.5 w-3.5" />;
    return null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render Loading State
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-slate-600">Đang tải dữ liệu KTV...</p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 pb-16 md:pb-24 space-y-8">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <Link href="/dashboard" className="hover:text-emerald-800 transition-colors">
            Tổng quan
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <Link href="/dashboard/operations" className="hover:text-emerald-800 transition-colors">
            Phân tích vận hành
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-emerald-800 font-bold">Bảng Xếp Hạng KTV</span>
        </div>
        
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-800/30 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          <span>Trở về trang gần nhất</span>
        </button>
      </div>

      {/* Header & Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
            Báo cáo vận hành
          </span>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Bảng Xếp Hạng KTV
          </h1>
          <p className="text-sm text-slate-600 font-medium max-w-xl">
            Top 10 kỹ thuật viên có hoạt động xuất sắc nhất theo doanh thu, số ca hoàn thành hoặc đánh giá
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-2xl border border-slate-200/20">
            {(['week', 'month', 'quarter'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {p === 'week' && 'Tuần này'}
                {p === 'month' && 'Tháng này'}
                {p === 'quarter' && 'Quý này'}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-2xl border border-slate-200/20">
            {(['revenue', 'sessions', 'rating'] as LeaderboardMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => handleMetricChange(m)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  metric === m
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {m === 'revenue' && 'Doanh thu'}
                {m === 'sessions' && 'Số ca'}
                {m === 'rating' && 'Đánh giá'}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cache Status */}
      {leaderboard?.metadata && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50/50 border border-emerald-100/50 px-5 py-3 text-xs font-medium text-emerald-800 backdrop-blur-sm shadow-sm shadow-emerald-50/10">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {leaderboard.metadata.cacheHit ? '✓ Dữ liệu được tải từ bộ nhớ đệm (Cache Hit)' : '⚡ Dữ liệu mới được tổng hợp thời gian thực'}
            </span>
          </div>
          <div className="opacity-80">
            Thời gian phản hồi: <span className="font-bold">{leaderboard.metadata.queryTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {leaderboard && leaderboard.data.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Top Performer Card */}
          <div className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 shadow-sm shadow-amber-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">KTV Xuất Sắc Nhất</p>
                <p className="font-heading mt-3 text-2xl font-extrabold text-amber-900">
                  {leaderboard.data[0].ktvName}
                </p>
                <p className="text-sm font-semibold text-amber-800 mt-1">
                  {metric === 'revenue' && formatCurrency(leaderboard.data[0].metricValue)}
                  {metric === 'sessions' && `${formatNumber(leaderboard.data[0].metricValue)} ca`}
                  {metric === 'rating' && `${formatNumber(leaderboard.data[0].metricValue, 1)} ⭐`}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/25 transition-transform group-hover:scale-110">
                <Award className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Average Performance Card */}
          <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trung Bình</p>
                <p className="font-heading mt-3 text-2xl font-extrabold text-slate-900">
                  {metric === 'revenue' && formatCurrency(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length
                  )}
                  {metric === 'sessions' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length
                  )} ca`}
                  {metric === 'rating' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0) / leaderboard.data.length, 1
                  )} ⭐`}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-110">
                <BarChart3 className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Total Card */}
          <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200/50 p-6 shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Cộng</p>
                <p className="font-heading mt-3 text-2xl font-extrabold text-slate-900">
                  {metric === 'revenue' && formatCurrency(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0)
                  )}
                  {metric === 'sessions' && `${formatNumber(
                    leaderboard.data.reduce((sum, ktv) => sum + ktv.metricValue, 0)
                  )} ca`}
                  {metric === 'rating' && `${leaderboard.data.length} KTV`}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition-transform group-hover:scale-110">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table Container */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white shadow-sm shadow-slate-100/50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Hạng
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Tên KTV
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Số ca
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Đánh giá TB
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Doanh thu
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Điểm danh
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-emerald-800 uppercase tracking-widest bg-emerald-50/20">
                  {metric === 'revenue' && 'Doanh thu'}
                  {metric === 'sessions' && 'Số ca'}
                  {metric === 'rating' && 'Đánh giá'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {leaderboard?.data.map((ktv) => (
                <motion.tr
                  key={ktv.ktvId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => handleKtvClick(ktv.ktvId)}
                  className={`cursor-pointer transition-all duration-200 hover:bg-slate-50/60 ${
                    selectedKtvId === ktv.ktvId ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${getRankBadgeColor(ktv.rank)}`}>
                      {getRankIcon(ktv.rank)}
                      #{ktv.rank}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {ktv.ktvName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{ktv.ktvName}</div>
                      </div>
                    </div>
                  </td>

                  {/* Sessions */}
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-850">
                      {formatNumber(ktv.totalSessionsCompleted)}
                    </span>
                  </td>

                  {/* Rating */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < Math.round(ktv.avgRating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-slate-850">
                        {formatNumber(ktv.avgRating, 1)}
                      </span>
                    </div>
                  </td>

                  {/* Revenue */}
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-850">
                      {formatCurrency(ktv.totalRevenue)}
                    </span>
                  </td>

                  {/* Attendance */}
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${
                      ktv.attendanceRatePct >= 90 ? 'text-emerald-600' : 'text-slate-700'
                    }`}>
                      {formatNumber(ktv.attendanceRatePct, 0)}%
                    </span>
                  </td>

                  {/* Metric Value (Highlighted Column) */}
                  <td className="px-6 py-4 text-right bg-emerald-50/20">
                    <div className="font-bold text-emerald-800">
                      {metric === 'revenue' && formatCurrency(ktv.metricValue)}
                      {metric === 'sessions' && `${formatNumber(ktv.metricValue)} ca`}
                      {metric === 'rating' && `${formatNumber(ktv.metricValue, 1)} ⭐`}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {leaderboard && leaderboard.data.length === 0 && (
          <div className="py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-350" />
            <p className="mt-4 text-slate-500 font-medium">Không có dữ liệu KTV</p>
          </div>
        )}
      </div>
      
      {/* Spacer to prevent scroll clipping next to browser viewport / taskbar */}
      <div className="h-16 md:h-24" />
    </div>
  );
}
