'use client';

/**
 * Dashboard Core-SPA Boundary Refactor - Phase 1 Complete
 *
 * Widget classification complete. Actual extraction to src/core/ and
 * src/modules/spa/ deferred to Phase 3 per roadmap.
 *
 * @see docs/plans/core-platform-extraction-roadmap.md
 */

import { KtvPerformanceTable } from '@/components/features/dashboard/KtvPerformanceTable';
import { RevenueChart } from '@/components/features/dashboard/RevenueChart';
import { StatsGrid } from '@/components/features/dashboard/StatsGrid';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { DashboardRouteLoading } from '@/components/layout/DashboardLoadingShell';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { createClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';
import { completeSession, saveSessionNote } from '@/core/services/order';
import {
getDashboardPrimaryData,
getMonthlyPerformance,
} from '@/core/services/analytics/dashboard-actions';
import {
  getBeautyDashboardCustomerRatingDistribution,
  getBeautyDashboardTopTechnicians,
  type CustomerRatingDistributionViewModel,
} from '@/app/dashboard/beauty-dashboard-rating-actions';
import { getDashboardWidgetAlerts } from '@/components/common/dashboard-widget-actions';
import type {
  DashboardStatsViewModel,
  DashboardSessionViewModel,
  KtvPerformanceViewModel,
  PerformanceDataPointViewModel,
  InventorySummaryViewModel,
  DashboardAlert,
} from '@/core/services/analytics/dashboard-actions';
import { markNotificationAsRead } from '@/core/services/notification/notification-actions';
import AdminNotificationBell from '@/components/common/AdminNotificationBell';
import { AnimatePresence,motion } from 'framer-motion';
import {
AlertTriangle,
ArrowRight,
Bell,
Calendar,
CheckCircle2,
ChevronRight,
Clock,
Lightbulb,
Loader2,
MessageSquare,
Package,
PlusCircle,
Search,
Sparkles as SparklesIcon,
TrendingUp,
User,
X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback,useEffect,useRef,useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { resolveDashboardPresentation, isHaircutProductPresentation, replaceDashboardProductDocument, resolveProductPresentationModule } from '@/lib/business-rules/product-presentation-routing';

// Heavy modals — lazy-loaded so they don't bloat the dashboard's initial JS bundle.
// BookingModal (~715 LOC + form deps) only opens on user click.
// OnboardingTour (~276 LOC) only shows for first-time users.
const BookingModal = dynamic(
  () => import('@/components/features/BookingModal').then(m => ({ default: m.BookingModal })),
  { ssr: false }
);
const OnboardingTour = dynamic(
  () => import('@/components/features/dashboard/OnboardingTour'),
  { ssr: false }
);
const HaircutDashboardView = dynamic(
  () => import('@/app/dashboard/components/HaircutDashboardView').then(m => ({ default: m.HaircutDashboardView })),
  { ssr: false }
);
const BeautySpaV2DashboardView = dynamic(
  () => import('@/app/dashboard/components/BeautySpaV2DashboardView').then(m => ({ default: m.BeautySpaV2DashboardView })),
  { ssr: false }
);

function StandardDashboardPage() {
  const router = useRouter();
  const { tenantModuleKey, isTenantModuleLoading, tenantModuleError } = useTenantModuleKey({ forceFresh: true });
  const [stats, setStats] = useState<DashboardStatsViewModel[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionViewModel[]>([]);
  const [topKTVs, setTopKTVs] = useState<KtvPerformanceViewModel[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceDataPointViewModel[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryViewModel>({ totalItems: 0, lowStockCount: 0, totalValue: 0 });
  const [customerRatingDistribution, setCustomerRatingDistribution] = useState<CustomerRatingDistributionViewModel[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAllNotificationsOpen, setIsAllNotificationsOpen] = useState(false);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifTab, setNotifTab] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [quickNoteId, setQuickNoteId] = useState<string | null>(null);
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'ktv' | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const sessionsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardAlertsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const vocab = useModuleVocabulary();
  const { user: profile, product, tenantSettings } = useUser();
  const expectedModule = product && tenantSettings ? resolveProductPresentationModule(product, tenantSettings.enabled_modules) : null;
  const isPresentationReady = Boolean(!isTenantModuleLoading && !tenantModuleError && tenantModuleKey && tenantModuleKey === expectedModule && profile?.tenant_id === tenantSettings?.id);

  // Use generic greeting until tenant data loads to avoid confusing flash of wrong business type
  const businessLabel = product?.displayName ?? 'Hệ thống';

  // Don't show role-specific greeting until tenant data is fully loaded
  const greetingText = !product || userRole === null
    ? 'Chào buổi sáng!'  // Generic greeting while loading - no business name or role
    : userRole === 'admin'
      ? `Chào buổi sáng, ${businessLabel} admin!`
      : `Chào buổi sáng, ${businessLabel} ${vocab.worker.short}!`;

  const todayScheduleSubtitle = tenantModuleKey === null
    ? 'Lịch dịch vụ hôm nay'
    : tenantModuleKey === 'beauty_spa'
    ? 'Lịch dịch vụ & liệu trình hôm nay'
    : tenantModuleKey === 'industrial_cleaning'
    ? 'Lịch làm việc hôm nay'
    : tenantModuleKey === 'real_estate'
    ? 'Lịch làm việc hôm nay'
    : 'Lịch trình liệu trình trực tuyến';

  useEffect(() => {
    if (!isPresentationReady) return;
    if (!profile) return;
    setTenantId(profile.tenant_id || null);
    const role = profile.role?.toLowerCase();
    if (role === 'ktv') {
      router.replace('/ktv/dashboard');
      return;
    }
    setUserRole(role === 'admin' ? 'admin' : 'ktv');
  }, [profile, router, isPresentationReady]);

  const getMonthRange = (month: number, year: number) => {
    // Manually construct YYYY-MM-DD to avoid timezone shifts from .toISOString()
    const startMonth = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${startMonth}-01`;

    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${startMonth}-${String(lastDay).padStart(2, '0')}`;

    return { startDate, endDate };
  };

  const buildDashboardStats = useCallback((statsData: Awaited<ReturnType<typeof getDashboardPrimaryData>>['statsData']) => {
    /**
     * @widget-type core
     *
     * Core business metrics: customer count, bookings count, revenue tracking.
     * These KPIs are industry-neutral and reusable across different business types.
     */
    return [
      { label: 'Tổng khách hàng', value: String(statsData.totalCustomers?.value || '0'), trend: Number(statsData.totalCustomers?.trend || 0), iconName: 'Users' as const, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Lịch hẹn hôm nay', value: String(statsData.todayBookings?.value || '0'), trend: Number(statsData.todayBookings?.trend || 0), iconName: 'Calendar' as const, color: 'text-rose-600', bg: 'bg-rose-50' },
      ...(userRole === 'admin' ? [{ label: 'Doanh thu tháng', value: String(statsData.totalRevenue?.value || '0M'), trend: Number(statsData.totalRevenue?.trend || 0), iconName: 'DollarSign' as const, color: 'text-emerald-600', bg: 'bg-emerald-50' }] : []),
      /**
       * @widget-type spa
       *
       * KTV composite rating (60% customer satisfaction + 40% discipline score).
       * This metric is specific to spa/babycare KTV performance evaluation.
       */
      { label: `Đánh giá ${vocab.worker.short}`, value: String(statsData.avgRating?.value || '5.0'), trend: Number(statsData.avgRating?.trend || 0), iconName: 'Star' as const, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
  }, [userRole, vocab.worker.short]);

  const fetchPrimaryData = useCallback(async () => {
    if (!isPresentationReady || tenantId !== profile?.tenant_id) return;
    if (userRole === null) return; // Wait for role to be identified
    if (!tenantId) return;

    setIsRefreshing(true);
    try {
      const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const [
        { statsData, sessionsData, inventorySummary: nextInventorySummary },
        nextRatingDistribution,
      ] = await Promise.all([
        getDashboardPrimaryData(startDate, endDate, localToday),
        getBeautyDashboardCustomerRatingDistribution(startDate, endDate),
      ]);

      setStats(buildDashboardStats(statsData));
      setSessions(sessionsData || []);
      setInventorySummary(nextInventorySummary || { totalItems: 0, lowStockCount: 0, totalValue: 0 });
      setCustomerRatingDistribution(nextRatingDistribution || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard primary data:', error);
      toast.error('Lỗi cập nhật dữ liệu');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [buildDashboardStats, selectedMonth, selectedYear, tenantId, userRole, isPresentationReady, profile?.tenant_id]);

  const fetchSecondaryData = useCallback(async () => {
    if (!isPresentationReady || tenantId !== profile?.tenant_id) return;
    if (userRole === null) return;
    if (!tenantId) return;

    setIsSecondaryLoading(true);
    try {
      const [ktvsData, perfData, alertsData] = await Promise.all([
        getBeautyDashboardTopTechnicians(),
        getMonthlyPerformance(),
        getDashboardWidgetAlerts(),
      ]);
      setTopKTVs(ktvsData || []);
      setPerformanceData(perfData || []);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error fetching dashboard secondary data:', error);
      toast.error('Không thể tải dữ liệu phân tích dashboard');
    } finally {
      setIsSecondaryLoading(false);
    }
  }, [tenantId, userRole, isPresentationReady, profile?.tenant_id]);

  const fetchAlertsData = useCallback(async () => {
    if (!isPresentationReady || tenantId !== profile?.tenant_id) return;
    if (userRole === null) return;
    if (!tenantId) return;

    try {
      const alertsData = await getDashboardWidgetAlerts();
      setAlerts(alertsData || []);
    } catch (error) {
      console.warn('Dashboard alerts are temporarily unavailable:', error);
      setAlerts([]);
    }
  }, [tenantId, userRole, isPresentationReady, profile?.tenant_id]);

  // fetchData = manual refresh (e.g. realtime trigger) — runs both phases in parallel
  const fetchData = useCallback(async () => {
    setIsSecondaryLoading(true);
    await Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
  }, [fetchPrimaryData, fetchSecondaryData]);

  usePageRefresh(fetchData);

  useEffect(() => {
    if (!isPresentationReady) return;
    // ── Progressive initial load ─────────────────────────────────────
    // Phase 1: today's schedule (sessions + stats) — clears the main spinner
    // Phase 2: KTV leaderboard + alerts — deferred 200ms so it never races
    // NOTE: guard is inside fetchPrimaryData/fetchSecondaryData (userRole check)
    //       so we do NOT include userRole here — that was causing a double-fetch.
    void fetchPrimaryData();
    const t = setTimeout(() => { void fetchSecondaryData(); }, 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isPresentationReady]); // re-run only if tenant changes, not on every userRole update

  const scheduleDashboardRefresh = useCallback(() => {
    if (dashboardRefreshTimerRef.current) {
      clearTimeout(dashboardRefreshTimerRef.current);
    }

    dashboardRefreshTimerRef.current = setTimeout(() => {
      dashboardRefreshTimerRef.current = null;
      void Promise.all([fetchPrimaryData(), fetchSecondaryData()]);
    }, 500);
  }, [fetchPrimaryData, fetchSecondaryData]);

  const scheduleDashboardAlertsRefresh = useCallback(() => {
    if (dashboardAlertsRefreshTimerRef.current) {
      clearTimeout(dashboardAlertsRefreshTimerRef.current);
    }

    dashboardAlertsRefreshTimerRef.current = setTimeout(() => {
      dashboardAlertsRefreshTimerRef.current = null;
      void fetchAlertsData();
    }, 500);
  }, [fetchAlertsData]);

  useEffect(() => {
    if (!isPresentationReady) return;
    // REALTIME SUBSCRIPTION
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        scheduleDashboardRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        scheduleDashboardRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue' }, () => {
        scheduleDashboardRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_reviews' }, () => {
        scheduleDashboardRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => {
        scheduleDashboardAlertsRefresh();
      })
      .subscribe();

    return () => {
      if (dashboardRefreshTimerRef.current) {
        clearTimeout(dashboardRefreshTimerRef.current);
      }
      if (dashboardAlertsRefreshTimerRef.current) {
        clearTimeout(dashboardAlertsRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [scheduleDashboardAlertsRefresh, scheduleDashboardRefresh, isPresentationReady]);

  // Now perform conditional early returns safe from Rule of Hooks violation
  if (isTenantModuleLoading) {
    return (
      <div className="flex-1 p-8 space-y-6 animate-pulse bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />
      </div>
    );
  }

  if (!isPresentationReady || !product) {
    return <div role="alert" className="flex-1 bg-background p-8 text-foreground">Không thể tải cấu hình sản phẩm của chi nhánh.</div>;
  }

  const handleCompleteSession = async (sessionId: string, bookingId: string, note: string) => {
    setUpdatingId(sessionId);
    try {
      if (note.trim()) {
        await saveSessionNote(sessionId, note);
      }
      const result = await completeSession(sessionId, bookingId);
      if (result.success) {
        toast.success('Đã cập nhật tiến độ buổi liệu trình!');
        fetchData();
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Cập nhật thất bại');
    } finally {
      setUpdatingId(null);
      setQuickNoteId(null);
      setQuickNoteValue('');
    }
  };

  if (tenantModuleKey === 'beauty_spa' || tenantModuleKey === 'babycare' || product.productKey === 'bella_spa') {
    return (
      <>
        <BeautySpaV2DashboardView
          stats={stats}
          sessions={sessions}
          topKTVs={topKTVs}
          alerts={alerts}
          performanceData={performanceData}
          customerRatingDistribution={customerRatingDistribution}
          inventorySummary={inventorySummary}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isLoading={isLoading}
          isSecondaryLoading={isSecondaryLoading}
          onOpenBookingModal={() => setIsBookingModalOpen(true)}
          userRole={userRole}
          handleCompleteSession={handleCompleteSession}
          updatingId={updatingId}
        />
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
        />
        <OnboardingTour brandName={businessLabel} tenantModuleKey={tenantModuleKey} />
      </>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
        <AnimatePresence>
          {isRefreshing && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-[100]"
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 items-center md:items-start text-center md:text-left">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">Dashboard</h1>
            <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2 justify-center md:justify-start">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              {greetingText}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 w-full md:w-auto">
            {/**
             * @widget-type core
             * Month/Year Selector
             *
             * Month/year selector là dashboard control trung lập ngành nghề.
             * Time range filtering is an industry-neutral UX pattern for dashboard data.
             */}
            <div className="flex items-center bg-white/80 border border-border p-1 rounded-2xl shadow-sm gap-2">
              <PremiumSelect
                value={selectedMonth.toString()}
                options={['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'].map((m, i) => ({
                  value: i.toString(),
                  label: m
                }))}
                onChange={(val) => setSelectedMonth(parseInt(val))}
                className="w-40"
              />
              <PremiumSelect
                value={selectedYear.toString()}
                options={[2024, 2025, 2026].map(y => ({
                  value: y.toString(),
                  label: y.toString()
                }))}
                onChange={(val) => setSelectedYear(parseInt(val))}
                className="w-32"
              />
            </div>

            {/**
             * @widget-type core
             * Search Input
             *
             * Quick search filtering là UX pattern trung lập ngành nghề.
             * Instant search/filter is a common dashboard control pattern across all industries.
             */}
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm nhanh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white/80 border border-border rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all w-60 shadow-sm font-medium"
              />
            </div>

            {/**
             * @widget-type mixed
             * Alerts/Notifications Panel
             *
             * Core: Bell icon, popover shell, read/unread state.
             * Mixed alert types - Core: Generic app_notifications, low inventory.
             * Spa: KTV checkout, session overdue, booking near end, leave requests.
             * Future: Core notification system với module-specific alert providers.
             */}
            <AdminNotificationBell position="bottom" className="hidden md:block shrink-0" />

            {/**
             * @widget-type spa
             * "Tạo Booking" button - Opens spa-specific BookingModal.
             * Core platform sẽ cung cấp generic 'Create Order' action mà spa module customizes thành 'Tạo Booking'.
             */}
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-primary/20 dark:shadow-none active:scale-95 uppercase tracking-wider"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Tạo Booking</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <StatsGrid stats={stats} isLoading={isLoading} />

        {/* Bento Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Schedule - Large Span */}
          {/**
           * @widget-type mixed
           *
           * Today's Schedule Widget Classification:
           * - Core: Scrollable list shell, loading states, search filter
           * - Spa: Session card content với package progress, KTV assignment, session multipliers
           *
           * Future extraction: Tách core scheduling shell khỏi spa session renderer.
           * The shell (container, loading skeletons, search/filter) can be reused across industries.
           * The session card content (package completion progress, KTV assignment, spa-specific actions
           * like "Hoàn thành buổi" and "Lưu ghi chú nhanh") is spa/babycare-specific.
           */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 glass-pink luxury-box-hover rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-white/50 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary/20 via-rose-300/30 to-primary/20" />

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 relative gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-pink-200/50 dark:shadow-none transform -rotate-3 hover:rotate-0 transition-transform">
                  <SparklesIcon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground uppercase tracking-tighter">Sắp tới trong hôm nay</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {todayScheduleSubtitle}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/bookings"
                className="px-8 py-4 bg-white/80 backdrop-blur-md text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-lg shadow-primary/20 dark:shadow-none flex items-center gap-3 group/link"
              >
                Xem tất cả <ChevronRight className="w-5 h-5 group-hover/link:translate-x-1.5 transition-transform" />
              </Link>
            </div>

            <div className="dashboard-schedule-list max-h-[1150px] overflow-y-auto overflow-x-hidden custom-scrollbar space-y-6">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="dashboard-schedule-card bg-white/80 p-6 md:p-7 rounded-[2.5rem] border border-white/60 shadow-md shadow-pink-100/20 relative mb-5 flex flex-col justify-between gap-6 md:gap-8 backdrop-blur-md animate-pulse dark:bg-slate-900/70 dark:border-white/5"
                  >
                    <div className="flex flex-1 items-start gap-5 md:gap-7">
                      <SkeletonLoader variant="circular" width={80} height={80} className="shrink-0" />
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <SkeletonLoader variant="text" width={100} height={12} className="rounded" />
                          <SkeletonLoader variant="text" width="60%" height={24} className="rounded-md" />
                        </div>
                        <div className="flex items-center gap-3">
                          <SkeletonLoader variant="text" width={40} height={14} className="rounded" />
                          <SkeletonLoader variant="text" width={120} height={14} />
                        </div>
                        <SkeletonLoader variant="rectangular" width={140} height={24} className="rounded-xl" />
                        <div className="space-y-2 max-w-[320px]">
                          <SkeletonLoader variant="text" width={80} height={10} />
                          <SkeletonLoader variant="rectangular" width="100%" height={10} className="rounded-full" />
                        </div>
                      </div>
                    </div>
                    <div className="dashboard-schedule-actions grid w-full grid-cols-1 gap-3 2xl:grid-cols-3">
                      <SkeletonLoader variant="rectangular" width="100%" height={44} className="rounded-2xl" />
                      <SkeletonLoader variant="rectangular" width="100%" height={48} className="rounded-[1.25rem]" />
                      <SkeletonLoader variant="rectangular" width="100%" height={56} className="rounded-[1.25rem]" />
                    </div>
                  </div>
                ))
              ) : (() => {
                const filteredSessions = sessions.filter(session => {
                  const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
                  const customerName = booking?.customers?.name_mother || '';
                  const packageName = booking?.packages?.name || booking?.package_name || '';
                  const isNotCompleted = session.status !== 'completed';
                  const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                       packageName.toLowerCase().includes(searchQuery.toLowerCase());
                  return isNotCompleted && matchesSearch;
                });

                if (filteredSessions.length > 0) {
                  return filteredSessions.map((session) => {
                    const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
                    const customerName = booking?.customers?.name_mother || customerLabels.customerPrefix;
                    const secondaryName = booking?.customers?.name_baby;
                    const babyName = secondaryName;
                    const technicianName = booking?.assigned_ktv?.full_name || 'Chưa phân công';

                    return (
                      <div
                        key={session.id}
                        className="dashboard-schedule-card group bg-white/80 hover:bg-white p-6 md:p-7 rounded-[2.5rem] transition-all border border-white/60 hover:border-primary/20 shadow-md shadow-pink-100/20 hover:shadow-2xl hover:shadow-pink-100/40 dark:bg-slate-900/70 dark:hover:bg-slate-900 dark:border-white/5 relative mb-5 last:mb-0 backdrop-blur-md"
                      >
                        <div className="flex flex-col justify-between gap-6 md:gap-8">
                          <div className="flex flex-1 items-start gap-3 md:gap-7">
                            {/* Avatar Section */}
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 md:w-20 md:h-20 rounded-full bg-white shadow-inner flex items-center justify-center text-primary font-black text-sm md:text-2xl border-2 border-pink-50 relative group-hover:scale-105 transition-transform duration-500">
                                {customerName.charAt(0)}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 md:w-6 md:h-6 bg-emerald-500 rounded-full border border-white flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="w-2 h-2 md:w-3 md:h-3 text-white" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex flex-col mb-2 md:mb-4">
                                <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Khách hàng</span>
                                <h3 className="font-bold text-sm md:text-2xl text-foreground group-hover:text-primary transition-colors tracking-tight leading-snug break-words">
                                  Khách: {customerName}
                                </h3>
                                {babyName && (
                                  <p className="mt-1 text-xs md:text-sm font-semibold text-primary/80 leading-relaxed break-words">
                                    {customerLabels.secondaryPrefix}: {babyName}
                                  </p>
                                )}
                              </div>
                                <div className="mt-1 flex items-center gap-2 md:gap-3">
                                  <span className="text-[8px] md:text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                                    KTV
                                  </span>
                                  <span className={cn(
                                    "text-xs md:text-sm font-bold truncate",
                                    booking?.assigned_ktv?.full_name ? "text-slate-500" : "text-amber-600 italic"
                                  )}>
                                    {technicianName}
                                  </span>
                                </div>

                              {/* Badge Row - Cleaned up */}
                              <div className="flex flex-wrap items-center gap-2 mt-2 mb-4 md:mb-6">
                                <div className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[9px] md:text-[11px] font-bold transition-all border shadow-sm",
                                  (session.assigned_time || booking?.preferred_time)
                                    ? "bg-slate-50/50 text-slate-600 border-slate-100"
                                    : "bg-amber-50/80 text-amber-700 border-amber-100/50 animate-pulse"
                                )}>
                                  <Clock className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-amber-500" />
                                  {session.assigned_time || booking?.preferred_time || 'Chưa có giờ'}
                                </div>
                              </div>

                              {!session.assigned_time && !booking?.preferred_time && (
                                <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50/80 to-orange-50/80 backdrop-blur-sm border border-amber-100/50 rounded-xl text-[8px] md:text-[10px] font-bold text-amber-800 uppercase tracking-widest shadow-sm">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Xác nhận giờ đặt lịch</span>
                                </div>
                              )}

                              {/* Progress Section - Refined labels */}
                              <div className="max-w-[320px]">
                                <div className="flex items-center justify-between mb-1.5 px-1">
                                  <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến độ liệu trình</span>
                                  <span className="text-[8px] md:text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full border border-primary/10">
                                    {booking?.completed_sessions || 0} / {booking?.total_sessions || 15} Buổi
                                  </span>
                                </div>
                                <div className="dashboard-schedule-progress-track h-2 md:h-3 w-full rounded-full overflow-hidden p-0.5">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((booking?.completed_sessions || 0) / (booking?.total_sessions || 15)) * 100}%` }}
                                    className="dashboard-schedule-progress-fill h-full rounded-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="w-full min-w-0">
                            <div className="dashboard-schedule-actions grid w-full grid-cols-1 gap-3 2xl:grid-cols-3">
                              {/* Action Buttons - Detail moved here */}
                                <Link
                                  href={`/dashboard/customers/${booking?.customers?.id}?bookingId=${booking?.id}`}
                                  className="min-h-12 w-full px-4 py-3.5 bg-white border-2 border-slate-100 hover:border-primary/20 text-slate-600 hover:text-primary rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-3 group/detail"
                                >
                                  <User className="w-4 h-4 text-slate-400 group-hover/detail:text-primary transition-colors" />
                                  Xem chi tiết
                                  <ChevronRight className="w-4 h-4 group-hover/detail:translate-x-1 transition-transform" />
                                </Link>

                              <AnimatePresence>
                                {quickNoteId === session.id ? (
                                  <motion.div
                                    key={`note-input-${session.id}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative min-w-0"
                                  >
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder="Thêm ghi chú buổi..."
                                      className="w-full pl-4 pr-12 py-4 bg-white border-2 border-primary/20 rounded-[1.25rem] text-sm font-bold focus:border-primary outline-none shadow-xl shadow-pink-100/20 dark:shadow-none"
                                      value={quickNoteValue}
                                      onChange={(e) => setQuickNoteValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCompleteSession(session.id, session.booking_id, quickNoteValue);
                                        if (e.key === 'Escape') setQuickNoteId(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => handleCompleteSession(session.id, session.booking_id, quickNoteValue)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-primary-foreground rounded-xl shadow-lg hover:scale-105 transition-transform"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  </motion.div>
                                ) : (
                                  <button
                                    key={`note-button-${session.id}`}
                                    onClick={() => {
                                      setQuickNoteId(session.id);
                                      setQuickNoteValue('');
                                    }}
                                    className="min-h-12 flex items-center justify-center gap-3 px-4 py-4 bg-white/50 hover:bg-white text-slate-500 hover:text-primary border-2 border-dashed border-slate-200 hover:border-primary/40 rounded-[1.25rem] transition-all text-xs font-black uppercase tracking-widest group/note shadow-sm hover:shadow-lg"
                                  >
                                    <MessageSquare className="w-4 h-4 group-hover/note:scale-125 transition-transform duration-300" />
                                    Thêm ghi chú
                                  </button>
                                )}
                              </AnimatePresence>

                              <button
                                onClick={() => handleCompleteSession(session.id, session.booking_id, quickNoteValue)}
                                disabled={updatingId === session.id}
                                className="min-h-12 w-full px-4 py-4 bg-primary hover:bg-primary-hover text-primary-foreground rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.15em] hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 relative overflow-hidden group/btn"
                              >
                                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
                                {updatingId === session.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                    <span className="leading-tight text-center">Hoàn thành buổi {(booking?.completed_sessions || 0) + 1}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                }

                return (
                  <div className="py-20 text-center">
                    <Calendar className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-bold italic">
                      {searchQuery ? `Không tìm thấy kết quả cho "${searchQuery}"` : 'Không có lịch hẹn sắp tới'}
                    </p>
                  </div>
                );
              })()}
            </div>
          </motion.div>

          {/* Sidebar Analytics Stack */}
          {/**
           * @widget-type core
           *
           * Monthly performance metrics (revenue, expense, customers) là KPIs trung lập ngành nghề.
           * Note: Rating dimension dùng spa KTV metrics nhưng có thể thay bằng generic service quality cho industries khác.
           */}
          <RevenueChart performanceData={performanceData} userRole={userRole} isLoading={isSecondaryLoading} />
        </div>

        {/* New Sections: Top KTV & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mt-12">
          {/**
           * @widget-type spa
           *
           * KTV Performance Table
           *
           * KTV leaderboard với session multipliers, composite ratings, và KPI bonuses
           * là spa/babycare-specific. Industries khác cần different technician performance widgets.
           *
           * Requirements: 6.1-6.5
           */}
          {/* Top KTV Xuất Sắc */}
          <KtvPerformanceTable topKTVs={topKTVs} isLoading={isSecondaryLoading} />

          {/* Cảnh báo quan trọng */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="beauty-dashboard-panel beauty-alerts-panel glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-rose-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Cảnh báo quan trọng</h2>
            </div>

            <div className="space-y-4">
              {isSecondaryLoading ? (
                [1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-3xl border border-white/40 bg-white/30"
                  />
                ))
              ) : alerts.slice(0, 5).map((alert, idx) => (
                <div
                  key={idx}
                  onClick={async () => {
                    if (alert.isAppNotification && alert.id) {
                      const result = await markNotificationAsRead(alert.id);
                      if (!result.success) {
                        toast.error(result.error);
                        return;
                      }
                    }
                    if (alert.link) {
                      router.push(alert.link);
                    }
                  }}
                  data-alert-tone={alert.type}
                  className={`beauty-alert-item p-6 rounded-3xl flex items-center gap-6 border cursor-pointer hover:scale-[1.01] transition-all hover:shadow-md ${
                    alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                    alert.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className={`beauty-alert-icon w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                    alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                    alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {alert.icon === 'alert' ? <AlertTriangle className="w-6 h-6" /> :
                     alert.icon === 'checkCircle' ? <CheckCircle2 className="w-6 h-6" /> :
                     <Lightbulb className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`beauty-alert-title font-bold text-lg ${
                      alert.type === 'warning' ? 'text-amber-900' :
                      alert.type === 'success' ? 'text-emerald-900' :
                      'text-blue-900'
                    }`}>
                      {alert.title}
                    </h3>
                    <p className={`beauty-alert-message font-semibold opacity-80 ${
                      alert.type === 'warning' ? 'text-amber-800' :
                      alert.type === 'success' ? 'text-emerald-800' :
                      'text-blue-800'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Inventory Quick Status */}
        {/**
         * @widget-type core
         *
         * Inventory metrics (total items, low stock count, total value) là supply chain
         * KPIs trung lập ngành nghề. Note: Item categories và usage tracking là module-specific.
         *
         * Requirements: 8.1-8.5
         */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden mt-12"
        >
           <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400/30 via-orange-300/30 to-amber-400/30" />
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-amber-500" />
                 </div>
                 <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Vật Tư & Tồn Kho</h2>
              </div>
              <Link href="/dashboard/inventory" className="px-6 py-3 bg-white/50 hover:bg-white text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 group/inv">
                 Quản lý kho <ArrowRight className="w-4 h-4 group-hover/inv:translate-x-1 transition-transform" />
              </Link>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/50 p-6 rounded-3xl border border-white/50 flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${inventorySummary.lowStockCount > 0 ? 'bg-amber-50 text-amber-500 animate-pulse' : 'bg-emerald-50 text-emerald-500'}`}>
                    <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mặt hàng sắp hết</p>
                    <p className="text-2xl font-black text-slate-900">{inventorySummary.lowStockCount} <span className="text-sm text-slate-400 font-medium">sản phẩm</span></p>
                 </div>
              </div>
              <div className="bg-white/50 p-6 rounded-3xl border border-white/50 flex items-center gap-4">
                 <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
                    <Package className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng mặt hàng</p>
                    <p className="text-2xl font-black text-slate-900">{inventorySummary.totalItems} <span className="text-sm text-slate-400 font-medium">loại</span></p>
                 </div>
              </div>
              <div className="bg-white/50 p-6 rounded-3xl border border-white/50 flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                    <TrendingUp className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giá trị tồn kho</p>
                    <p className="text-2xl font-black text-slate-900">
                      {inventorySummary.totalValue > 0 ? (inventorySummary.totalValue / 1_000_000).toFixed(1) + 'M' : '0M'} <span className="text-sm text-slate-400 font-medium">VND</span>
                    </p>
                 </div>
              </div>
           </div>

        </motion.div>

        {/* Modals */}
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
        />

        {/* Xem tất cả thông báo Modal */}
        <AnimatePresence>
          {isAllNotificationsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAllNotificationsOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] shadow-2xl border border-pink-100 p-8 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative z-10"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Tất cả thông báo</h2>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">Tìm kiếm và đối soát nhanh các sự kiện</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAllNotificationsOpen(false)}
                    className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar & Tabs */}
                <div className="space-y-4 mb-6 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nội dung thông báo..."
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: 'success', label: 'Hoàn thành ca' },
                      { id: 'warning', label: 'Buổi quá hạn' },
                      { id: 'info', label: 'Gói sắp hết' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifTab(tab.id)}
                        className={cn(
                          "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 border",
                          notifTab === tab.id
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 dark:shadow-none"
                            : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification list (Scrollable) */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-2">
                  {alerts.filter(alert => {
                    const matchesSearch = (alert.title + ' ' + alert.message).toLowerCase().includes(notifSearch.toLowerCase());
                    const matchesTab = notifTab === 'all' || alert.type === notifTab;
                    return matchesSearch && matchesTab;
                  }).length > 0 ? (
                    alerts.filter(alert => {
                      const matchesSearch = (alert.title + ' ' + alert.message).toLowerCase().includes(notifSearch.toLowerCase());
                      const matchesTab = notifTab === 'all' || alert.type === notifTab;
                      return matchesSearch && matchesTab;
                    }).map((alert, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (alert.link) {
                            router.push(alert.link);
                            setIsAllNotificationsOpen(false);
                          }
                        }}
                        className={cn(
                          "p-5 rounded-3xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex gap-4 hover:shadow-md",
                          alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200' :
                          alert.type === 'success' ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200' :
                          'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                          alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                          alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-blue-100 text-blue-600'
                        )}>
                          {alert.icon === 'alert' ? <AlertTriangle className="w-6 h-6" /> :
                           alert.icon === 'checkCircle' ? <CheckCircle2 className="w-6 h-6" /> :
                           <Lightbulb className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <h4 className="font-extrabold text-sm text-foreground truncate">{alert.title}</h4>
                            {alert.timestamp && alert.timestamp > 0 && (
                              <span className="text-[10px] text-muted-foreground shrink-0 font-bold italic">
                                {new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                                {new Date(alert.timestamp).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed font-semibold">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center">
                      <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4 animate-bounce" />
                      <p className="text-slate-400 font-extrabold italic text-sm">Không tìm thấy thông báo nào</p>
                      <p className="text-slate-300 text-xs mt-1">Vui lòng thay đổi từ khóa hoặc bộ lọc</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Premium Interactive Onboarding Tour */}
        <OnboardingTour brandName={businessLabel} tenantModuleKey={tenantModuleKey} />
      </div>
    );
}

export default function DashboardPage() {
  const pathname = usePathname();
  const { product, user, tenantSettings, isLoading } = useUser();
  const isHaircut = isHaircutProductPresentation(product);
  const presentation = tenantSettings ? resolveDashboardPresentation(tenantSettings, product) : null;
  const isIdentityReady = !isLoading && Boolean(presentation && tenantSettings && user?.tenant_id === tenantSettings.id);
  const destination = isIdentityReady && presentation?.defaultRoute && pathname.replace(/\/+$/, '') !== presentation.defaultRoute.replace(/\/+$/, '')
    ? presentation.defaultRoute
    : null;
  const hasProductDestination = Boolean(presentation?.defaultRoute);

  useEffect(() => {
    // A product switch leaves the root dashboard. Replace the document so a
    // pending App Router transition cannot keep the outgoing skeleton mounted.
    if (destination) replaceDashboardProductDocument(destination);
  }, [destination]);

  // Keep the outgoing root neutral even if pathname updates before this page
  // unmounts; only the destination page should mount that product's actions.
  if (isLoading || (isIdentityReady && hasProductDestination)) return <DashboardRouteLoading />;
  if (!isIdentityReady) {
    return <div role="alert" className="flex-1 bg-background p-8 text-foreground">Không thể xác định sản phẩm của chi nhánh.</div>;
  }

  if (product && tenantSettings && !resolveProductPresentationModule(product, tenantSettings.enabled_modules)) {
    return <div role="alert" className="flex-1 bg-background p-8 text-foreground">Không thể tải cấu hình sản phẩm của chi nhánh.</div>;
  }

  if (isHaircut) {
    return <HaircutDashboardView />;
  }

  return <StandardDashboardPage />;
}
