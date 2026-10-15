'use client';

/**
 * Attendance & Payroll Dashboard
 * 
 * Comprehensive HR attendance and payroll analysis showing:
 * 1. Attendance rates and on-time metrics by KTV
 * 2. Salary breakdown and top earners
 * 3. Bonus distribution and deductions
 * 4. KTV performance leaderboard
 * 
 * Data flows through HR Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Users,
  BarChart3,
  CalendarDays,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { cn } from '@/lib/utils';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { 
  AttendanceReport, 
  PayrollSummary 
} from '@/services/intelligence/hr/queries';
import {
  AttendanceRateChart,
  SalaryDistributionChart,
  TopEarnersChart,
} from '@/components/intelligence/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'attendance' | 'payroll' | 'combined';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AttendancePayrollDashboard() {
  const router = useRouter();
  const vocab = useModuleVocabulary();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Response states
  const [attendanceData, setAttendanceData] = useState<IntelligenceResponse<AttendanceReport[]> | null>(null);
  const [payrollData, setPayrollData] = useState<IntelligenceResponse<PayrollSummary[]> | null>(null);

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
  // Fetch all metrics
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAllMetrics = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const baseUrl = `/api/intelligence/hr`;
      
      // Convert month (YYYY-MM) to date range for custom period
      const startDate = `${month}-01`;
      const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      
      const attendanceParams = new URLSearchParams({ 
        tenantId,
        period: 'custom',
        startDate,
        endDate
      });
      const payrollParams = new URLSearchParams({ 
        tenantId, 
        month 
      });

      const [attendance, payroll] = await Promise.all([
        fetch(`${baseUrl}/attendance-report?${attendanceParams}`).then(r => r.json()),
        fetch(`${baseUrl}/payroll-summary?${payrollParams}`).then(r => r.json()),
      ]);

      // Check for errors
      if (attendance.error) throw new Error(attendance.error);
      if (payroll.error) throw new Error(payroll.error);

      setAttendanceData(attendance);
      setPayrollData(payroll);

      if (refresh) {
        toast.success('Dữ liệu đã được cập nhật');
      }
    } catch (error) {
      console.error('Failed to fetch attendance/payroll metrics:', error);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, month]);

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

  const formatPercent = (value: number, decimals = 1) => {
    return `${formatNumber(value, decimals)}%`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Calculate aggregate metrics
  // ───────────────────────────────────────────────────────────────────────────

  const getAggregateAttendance = () => {
    if (!attendanceData || !attendanceData.data || attendanceData.data.length === 0) {
      return {
        avgAttendanceRate: 0,
        avgOnTimeRate: 0,
        totalAbsences: 0,
        totalLate: 0,
      };
    }

    const total = attendanceData.data.length;
    return {
      avgAttendanceRate: attendanceData.data.reduce((sum, ktv) => sum + ktv.attendanceRatePct, 0) / total,
      avgOnTimeRate: attendanceData.data.reduce((sum, ktv) => sum + ktv.onTimeRatePct, 0) / total,
      totalAbsences: attendanceData.data.reduce((sum, ktv) => sum + ktv.daysAbsent, 0),
      totalLate: attendanceData.data.reduce((sum, ktv) => sum + ktv.daysLate, 0),
    };
  };

  const getAggregatePayroll = () => {
    if (!payrollData || !payrollData.data || payrollData.data.length === 0) {
      return {
        totalSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
        avgSalary: 0,
        ktvCount: 0,
      };
    }

    const data = payrollData.data;
    const totalSalary = data.reduce((sum, ktv) => sum + ktv.totalSalary, 0);
    const totalBonus = data.reduce((sum, ktv) => sum + ktv.sessionBonus + ktv.kpiBonus + ktv.ratingBonus, 0);
    const totalDeductions = data.reduce((sum, ktv) => sum + ktv.violationsDeduction, 0);

    return {
      totalSalary,
      totalBonus,
      totalDeductions,
      avgSalary: totalSalary / data.length,
      ktvCount: data.length,
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Generate chart data
  // ───────────────────────────────────────────────────────────────────────────

  const getAttendanceRateData = () => {
    if (!attendanceData || !attendanceData.data) return [];

    return attendanceData.data
      .sort((a, b) => b.attendanceRatePct - a.attendanceRatePct)
      .slice(0, 10)
      .map(ktv => ({
        name: ktv.ktvName,
        attendanceRate: ktv.attendanceRatePct,
        onTimeRate: ktv.onTimeRatePct,
      }));
  };

  const attendanceMetrics = getAggregateAttendance();
  const payrollMetrics = getAggregatePayroll();

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
              Chấm Công & Lương
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Theo dõi chấm công, tính lương và hiệu suất {vocab.worker.short}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex bg-white/60 p-1.5 rounded-2xl border border-slate-100 gap-1.5 backdrop-blur-md shadow-sm">
            {(['attendance', 'payroll', 'combined'] as const).map((mode) => {
              const labelMap = {
                attendance: 'Chấm công',
                payroll: 'Lương',
                combined: 'Tổng hợp',
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

          {/* Leave Requests Link */}
          <Link
            href="/dashboard/hr/leave-requests"
            className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl hover:bg-rose-100 font-bold transition-all shadow-sm active:scale-95 text-xs uppercase tracking-wider"
          >
            <CalendarDays className="h-4 w-4" />
            Duyệt nghỉ phép
          </Link>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAllMetrics(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-primary/20 dark:shadow-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {(viewMode === 'combined' || viewMode === 'attendance') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Attendance Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tỷ Lệ Đi Làm TB</p>
                <p className="text-3xl font-black text-green-600 mt-2">
                  {formatPercent(attendanceMetrics.avgAttendanceRate)}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-2">
                  {payrollMetrics.ktvCount} {vocab.worker.short}
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </motion.div>

          {/* On-Time Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tỷ Lệ Đúng Giờ TB</p>
                <p className="text-3xl font-black text-blue-600 mt-2">
                  {formatPercent(attendanceMetrics.avgOnTimeRate)}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-2">
                  {attendanceMetrics.totalLate} lượt muộn
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          {/* Total Absences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng Ngày Nghỉ</p>
                <p className="text-3xl font-black text-orange-600 mt-2">
                  {formatNumber(attendanceMetrics.totalAbsences)}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-2">
                  ngày trong tháng
                </p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </motion.div>

          {/* Average Salary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lương TB/{vocab.worker.short}</p>
                <p className="text-2xl font-black text-purple-600 mt-2 truncate">
                  {formatCurrency(payrollMetrics.avgSalary)}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-2 truncate">
                  Tổng: {formatCurrency(payrollMetrics.totalSalary)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl shrink-0">
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Top 10 Attendance Performance */}
        {(viewMode === 'combined' || viewMode === 'attendance') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-2xl">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Top 10 Chấm Công Tốt Nhất
                </h3>
              </div>
              {attendanceData?.metadata.cacheHit && (
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Cache</span>
              )}
            </div>

            {attendanceData && attendanceData.data.length > 0 ? (
              <AttendanceRateChart data={getAttendanceRateData()} />
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

        {/* Chart 2: Top 10 Earners */}
        {(viewMode === 'combined' || viewMode === 'payroll') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Top 10 Thu Nhập Cao Nhất
                </h3>
              </div>
              {payrollData?.metadata.cacheHit && (
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Cache</span>
              )}
            </div>

            {payrollData && payrollData.data.length > 0 ? (
              <TopEarnersChart data={payrollData.data} />
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

        {/* Chart 3: Salary Distribution */}
        {(viewMode === 'combined' || viewMode === 'payroll') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="luxury-card-white bg-white/85 backdrop-blur-md rounded-[2rem] p-6 border border-slate-200 shadow-sm lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Phân Bổ Quỹ Lương
                </h3>
              </div>
            </div>

            {payrollData && payrollData.data.length > 0 ? (
              <>
                <SalaryDistributionChart data={payrollData.data} />
                
                {/* Summary Table */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-600">Lương cơ bản</p>
                    <p className="text-lg font-black text-blue-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.baseSalary, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100">
                    <p className="text-xs font-bold text-green-600">Hoa hồng {vocab.workUnit.singular.toLowerCase()}</p>
                    <p className="text-lg font-black text-green-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.sessionBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <p className="text-xs font-bold text-amber-600">Thưởng KPI</p>
                    <p className="text-lg font-black text-amber-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.kpiBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                    <p className="text-xs font-bold text-purple-600">Thưởng sao</p>
                    <p className="text-lg font-black text-purple-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.ratingBonus, 0))}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                    <p className="text-xs font-bold text-red-600">Trừ vi phạm</p>
                    <p className="text-lg font-black text-red-900 mt-1">
                      {formatCurrency(payrollData.data.reduce((sum, ktv) => sum + ktv.violationsDeduction, 0))}
                    </p>
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
        )}
      </div>

      {/* Cache Info Footer */}
      {attendanceData && payrollData && (
        <div className="text-center text-sm text-slate-500">
          <p className="font-medium">
            Dữ liệu được tạo lúc {new Date(attendanceData.metadata.generatedAt).toLocaleTimeString('vi-VN')}
            {' '}(Chấm công: {attendanceData.metadata.cacheHit ? 'Cache' : 'Mới'}, 
            {' '}Lương: {payrollData.metadata.cacheHit ? 'Cache' : 'Mới'})
          </p>
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function AttendancePayrollDashboardWrapper() {
  return (
    <ErrorBoundary>
      <AttendancePayrollDashboard />
    </ErrorBoundary>
  );
}
