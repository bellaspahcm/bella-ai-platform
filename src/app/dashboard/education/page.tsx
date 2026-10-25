'use client';

/**
 * Bella Education — Preschool Dashboard Page
 * 
 * High-fidelity redesign matching reference layout:
 * - Top Viewport Header with Pill Search Bar & User Controls
 * - Preschool Welcome Banner with cute illustrations, badges & date widget
 * - 5 KPI Summary Cards (Total Students, Classes, Teachers, Attendance %, Parents)
 * - Student Headcount Bar Chart per class with color coding
 * - Age Distribution Donut Chart (Nhà trẻ, Mầm non, Chồi, Lá)
 * - Recent Activities timeline feed
 * - Monthly Revenue Bar Chart with hover tooltip
 * - Weekly Nutrition Menu (T2 - T6)
 * - School Announcements
 * - Preschool Footer Branding
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { clearDashboardClientContextCache } from '@/lib/dashboard-client-context';
import { useUser } from '@/lib/user-context';
import { parseAnalyticsResponse, vietnamDate } from '@/products/bella-education/analytics/domain/analytics-response';
import type { 
  ExecutiveDashboardDTO, 
  PreschoolActivityCategory, 
  PreschoolActivityItemDTO,
  PreschoolNoticeItemDTO,
  PreschoolWeeklyMenuDTO,
  PreschoolWeeklyMenuDayDTO
} from '@/products/bella-education/analytics/domain/preschool-analytics.types';
import { 
  Search,
  Bell,
  MessageSquare,
  ChevronDown,
  Calendar,
  CalendarCheck,
  Sparkles,
  Users,
  Baby,
  GraduationCap,
  Heart,
  TrendingUp,
  ArrowRight,
  Utensils,
  Megaphone,
  FileText,
  Clock,
  CheckCircle,
  Sprout,
  CreditCard,
  CalendarDays,
  UserCheck,
  ChevronRight,
  Settings,
  User,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Send,
  Check,
  X,
  BookOpen,
  Info,
  Activity,
  Filter,
  Loader2,
} from 'lucide-react';

let executiveMessageSequence = 0;
function createExecutiveMessage(sender: 'user' | 'copilot', text: string) {
  executiveMessageSequence += 1;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    id: `EXEC-${sender.toUpperCase()}-${executiveMessageSequence}`,
    sender,
    text,
    time: timeStr,
  };
}

async function readCopilotResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: string } | null;
  if (!response.ok || !result?.success || !result.data) {
    const errors: Record<string, string> = {
      COPILOT_UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để dùng Copilot.',
      FORBIDDEN: 'Tài khoản chưa có quyền sử dụng chức năng Copilot này.',
      COPILOT_PRODUCT_ACCESS_DENIED: 'Chức năng điều hành yêu cầu tài khoản thuộc tenant Preschool đang hoạt động.',
      COPILOT_IDENTITY_UNAVAILABLE: 'Chưa xác minh được tenant Preschool. Vui lòng thử lại sau.',
      TENANT_ISOLATION_VIOLATION: 'Tenant của yêu cầu không khớp tài khoản đăng nhập. Vui lòng tải lại trang.',
    };
    throw new Error(errors[result?.error ?? ''] ?? 'Không thể xử lý yêu cầu Copilot. Vui lòng tải lại dữ liệu và thử lại.');
  }
  return result.data;
}

export default function EducationDashboardPage() {
  const { user, product, isLoading } = useUser();
  if (isLoading) return <p role="status">Đang xác minh tài khoản…</p>;
  if (!user?.tenant_id || product?.productKey !== 'bella_preschool') return <p role="alert">Không có quyền xem Tổng quan Preschool.</p>;
  return <PreschoolDashboard key={`${user.id}:${user.tenant_id}`} tenantId={user.tenant_id} displayName={user.full_name || user.email} userRole={user.role} />;
}

function PreschoolDashboard({ tenantId, displayName, userRole }: { tenantId: string; displayName: string; userRole: string }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRevenueMonth, setHoveredRevenueMonth] = useState<string | null>('Tháng 10');

  // Interactive Header Popover & Date States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // School Activities Timeline Drawer & Filter States
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<PreschoolActivityCategory>('ALL');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  // School Notice Detail Modal & Weekly Nutrition Menu Drawer States
  const [selectedNoticeModal, setSelectedNoticeModal] = useState<PreschoolNoticeItemDTO | null>(null);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Format date into Vietnamese display string (e.g. "Thứ Tư, 9 tháng 9, 2026")
  const formatVietnameseDate = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long',
      day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  // Close popovers on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsActivityDrawerOpen(false);
        setSelectedNoticeModal(null);
        setIsMenuDrawerOpen(false);
        setIsProfileOpen(false);
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    try {
      clearDashboardClientContextCache();
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  // Live Executive Dashboard Analytics
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardDTO | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedDateStr = vietnamDate(selectedDate);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoadingDashboard(true);
    setDashboardData(null);
    setAnalyticsError(null);
    const params = new URLSearchParams({ date: selectedDateStr });
    if (selectedBranchId) params.set('branchId', selectedBranchId);
    void (async () => {
      try {
        const res = await fetch(`/api/education/analytics?${params}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(`ANALYTICS_HTTP_${res.status}`);
        const data = parseAnalyticsResponse(await res.json(), tenantId, selectedBranchId);
        if (!active) return;
        setBranches(data.branches);
        setSelectedBranchId(data.selectedBranchId);
        setDashboardData(data.dashboard);
      } catch (error) {
        if (active) setAnalyticsError(error instanceof Error ? error.message : 'ANALYTICS_UNAVAILABLE');
      } finally {
        if (active) setLoadingDashboard(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [selectedDateStr, selectedBranchId, tenantId, refreshKey]);

  // Distinct students are supplied by the canonical API; class counts can overlap.
  const totalKidsCount = dashboardData?.enrollment.totalEnrolledStudents ?? null;
  const totalClassesCount = dashboardData?.enrollment.totalClassrooms ?? null;
  const totalTeachersCount = dashboardData?.enrollment.totalTeachers ?? null;
  const presentCount = dashboardData?.attendance.todayPresentCount ?? null;
  const attendanceRate = dashboardData?.attendance.presentVsEnrolledRate ?? null;
  const totalParentsCount = dashboardData?.commandCenter?.totalParentsCount ?? null;
  const metric = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${value}${suffix}`;

  // Command Center Live Counts
  const unmarkedAttendance = dashboardData?.commandCenter?.unmarkedAttendanceCount;
  const leaveRequests = dashboardData?.commandCenter?.leaveRequestsCount;
  const overdueInvoices = dashboardData?.commandCenter?.overdueInvoicesCount;
  const healthIncidents = dashboardData?.commandCenter?.healthIncidentsCount;
  const parentRequests = dashboardData?.commandCenter?.parentRequestsCount;
  const attentionCounts = [unmarkedAttendance, leaveRequests, overdueInvoices, healthIncidents, parentRequests];
  const totalAttentionItems = attentionCounts.every(count => count != null)
    ? attentionCounts.filter(count => count !== null && count !== undefined && count > 0).length : null;

  // Dynamic KPI Cards Data
  const kpiStats = [
    {
      id: 'total-kids',
      label: 'Tổng số trẻ',
      value: metric(totalKidsCount),
      icon: <Users className="w-5 h-5 text-rose-500" />,
      iconBg: 'bg-rose-100 dark:bg-rose-950/50',
    },
    {
      id: 'total-classes',
      label: 'Số lớp học',
      value: metric(totalClassesCount),
      icon: <Users className="w-5 h-5 text-sky-500" />,
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
    },
    {
      id: 'total-teachers',
      label: 'Tổng nhân sự',
      note: 'Gồm GV, bảo mẫu & hỗ trợ',
      tooltip: 'Bao gồm giáo viên, bảo mẫu và nhân viên hỗ trợ toàn trường',
      value: metric(totalTeachersCount),
      icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    },
    {
      id: 'attendance-rate',
      label: 'Tỷ lệ chuyên cần',
      value: metric(attendanceRate, '%'),
      icon: <CalendarCheck className="w-5 h-5 text-amber-500" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
    },
    {
      id: 'total-parents',
      label: 'Phụ huynh',
      value: metric(totalParentsCount),
      icon: <Heart className="w-5 h-5 text-pink-500" />,
      iconBg: 'bg-pink-100 dark:bg-pink-950/50',
    },
  ];

  // Dynamic Class Headcount Bar Chart Data with live counts

  const classHeadcounts = useMemo(() => {
    if (!dashboardData?.enrollment?.classroomUtilization?.length) {
      return [];
    }
    const colorPalette = ['#FBBF24', '#34D399', '#F472B6', '#60A5FA', '#22D3EE', '#A3E635', '#C084FC', '#FB923C'];

    const getRank = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('nhà trẻ')) return 10 + (lower.includes('1') ? 1 : 2);
      if (lower.includes('mầm')) return 20 + (lower.includes('1') ? 1 : 2);
      if (lower.includes('chồi')) return 30 + (lower.includes('1') ? 1 : 2);
      if (lower.includes('lá')) return 40 + (lower.includes('1') ? 1 : 2);
      return 50;
    };

    const query = searchQuery.trim().toLocaleLowerCase('vi-VN');
    const sorted = dashboardData.enrollment.classroomUtilization.filter(item => !query || item.className.toLocaleLowerCase('vi-VN').includes(query)).sort((a, b) => {
      return getRank(a.className) - getRank(b.className);
    });

    return sorted.map((c, idx) => ({
      classId: c.classId,
      name: c.className.replace(/^Lớp\s+/, '').replace(/\s+—\s+.*$/, ''),
      count: c.currentEnrollment,
      color: colorPalette[idx % colorPalette.length],
    }));
  }, [dashboardData, searchQuery]);

  // Class names do not prove a child's age. This API has no canonical age projection.
  const ageDistribution: { label: string; count: number; percentage: number; color: string }[] = [];

  // Visual Styling Mapping for Activity Feed Items
  const getActivityVisuals = (category: PreschoolActivityCategory) => {
    switch (category) {
      case 'ATTENDANCE':
        return {
          icon: <Baby className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'LEARNING':
        return {
          icon: <Sprout className="w-4 h-4 text-green-600 dark:text-green-400" />,
          iconBg: 'bg-green-100 dark:bg-green-950/60',
          badgeBg: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
        };
      case 'PARENT_COMM':
        return {
          icon: <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          iconBg: 'bg-purple-100 dark:bg-purple-950/60',
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
        };
      case 'FINANCE':
        return {
          icon: <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          iconBg: 'bg-amber-100 dark:bg-amber-950/60',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
      case 'CARE_NUTRITION':
      default:
        return {
          icon: <Utensils className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          iconBg: 'bg-sky-100 dark:bg-sky-950/60',
          badgeBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
        };
    }
  };

  // Dynamic School Activities Feed: Real-time aggregated stream from real DB events
  const allActivities: PreschoolActivityItemDTO[] = useMemo(() => {
    return dashboardData?.recentActivities ?? [];
  }, [dashboardData]);

  // Top 5 activities for preview on dashboard widget
  const previewActivities = useMemo(() => {
    return allActivities.slice(0, 5);
  }, [allActivities]);

  // Filtered Activities for the slide-over Drawer
  const filteredDrawerActivities = useMemo(() => {
    return allActivities.filter((act) => {
      const matchCategory = activityCategoryFilter === 'ALL' || act.category === activityCategoryFilter;
      const query = activitySearchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        act.title.toLowerCase().includes(query) || 
        act.description.toLowerCase().includes(query) ||
        (act.actorRole && act.actorRole.toLowerCase().includes(query)) ||
        (act.categoryLabel && act.categoryLabel.toLowerCase().includes(query));
      return matchCategory && matchSearch;
    });
  }, [allActivities, activityCategoryFilter, activitySearchQuery]);

  const activityCategoryCounts = useMemo(() => {
    const counts: Record<PreschoolActivityCategory, number> = {
      ALL: allActivities.length,
      ATTENDANCE: 0,
      LEARNING: 0,
      CARE_NUTRITION: 0,
      PARENT_COMM: 0,
      FINANCE: 0,
    };
    allActivities.forEach((act) => {
      if (counts[act.category] !== undefined) {
        counts[act.category]++;
      }
    });
    return counts;
  }, [allActivities]);

  const categoryFilterTabs: Array<{ id: PreschoolActivityCategory; label: string }> = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'ATTENDANCE', label: 'Điểm danh & Đón trả' },
    { id: 'LEARNING', label: 'Học tập & Trải nghiệm' },
    { id: 'CARE_NUTRITION', label: 'Chăm sóc & Dinh dưỡng' },
    { id: 'PARENT_COMM', label: 'Tương tác phụ huynh' },
    { id: 'FINANCE', label: 'Tài chính & Học phí' },
  ];

  // Render only the canonical projection, without claiming an unsupported period.
  const monthlyRevenue = useMemo(() => dashboardData?.finance.monthlyRevenue ?? [], [dashboardData]);

  // Dynamic Weekly Nutrition Menu (P4.3) with real-time DB integration
  const weeklyMenuData: PreschoolWeeklyMenuDTO | null = useMemo(() => {
    return dashboardData?.weeklyMenu ?? null;
  }, [dashboardData]);

  const weeklyMenuDays = useMemo(() => {
    return weeklyMenuData?.days ?? [];
  }, [weeklyMenuData]);

  // Dynamic School Announcements (P6.1) with real-time DB integration
  const announcements: PreschoolNoticeItemDTO[] = useMemo(() => {
    return dashboardData?.notices ?? [];
  }, [dashboardData]);

  // ── 0. EXECUTIVE AI COPILOT STATES & HANDLERS (PHASE 4) ──
  const [isAiBriefingLoading] = useState(false);
  const [executiveBriefing] = useState<{
    executiveSummary: string;
    attendanceRate: number;
    criticalAlerts: readonly string[];
    actionableRecommendations: readonly string[];
    generatedAt: string;
  } | null>(null);

  const isComplianceAuditLoading = false;
  const [copilotNotice, setCopilotNotice] = useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [complianceResult] = useState<{
    compliant: boolean;
    complianceScore: number;
    violations: readonly string[];
    warnings: readonly string[];
    inspectedClassesCount: number;
  } | null>(null);

  const [activeCopilotTab, setActiveCopilotTab] = useState<'briefing' | 'compliance' | 'qa'>('briefing');
  const [executiveQuestion, setExecutiveQuestion] = useState('');
  const [isExecutiveAsking, setIsExecutiveAsking] = useState(false);
  const [executiveQnAMessages, setExecutiveQnAMessages] = useState<
    Array<{ id: string; sender: 'user' | 'copilot'; text: string; time: string }>
  >([
    {
      id: 'EXEC-WELCOME',
      sender: 'copilot',
      text: 'Kính chào Ban Giám Hiệu! Em là Trợ lý Điều hành AI Bella Preschool. Em có thể hỗ trợ Quý Thầy Cô: tổng hợp điểm tin toàn trường, rà soát chuẩn định mức Thông tư 52, hoặc soạn thảo thông báo gửi phụ huynh.',
      time: 'Hôm nay',
    },
  ]);

  const copilotScope = useRef(0);
  useEffect(() => {
    copilotScope.current += 1;
    setExecutiveQnAMessages(messages => messages.slice(0, 1));
    setExecutiveQuestion('');
    setIsExecutiveAsking(false);
    setCopilotNotice(null);
    setCopilotError(null);
  }, [selectedBranchId, selectedDateStr]);

  const handleGenerateBriefing = async () => {
    // The existing briefing contract requires health/finance/parent counts that
    // this branch-scoped read does not provide. Do not substitute sample/zero data.
    setCopilotNotice('Chưa đủ dữ liệu chuẩn về sức khỏe, học phí và yêu cầu phụ huynh để tạo điểm tin điều hành.');
  };

  const handleRunComplianceAudit = async () => {
    setCopilotNotice('Chưa có dữ liệu độ tuổi và nhân sự chuẩn để kiểm tra định mức.');
  };

  const handleSendExecutiveQuestion = async (presetQuestion?: string) => {
    const q = (presetQuestion || executiveQuestion).trim();
    if (!q || isExecutiveAsking) return;
    if (!dashboardData || loadingDashboard || analyticsError) {
      setCopilotNotice('Chọn cơ sở và tải dữ liệu chuẩn trước khi hỏi trợ lý điều hành.');
      return;
    }
    const requestScope = copilotScope.current;

    const userMsg = createExecutiveMessage('user', q);
    setExecutiveQnAMessages((prev) => [...prev, userMsg]);
    setExecutiveQuestion('');
    setIsExecutiveAsking(true);
    setCopilotError(null);

    try {
      const res = await fetch('/api/education/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_copilot',
          question: q,
          contextData: {
            branchId: selectedBranchId,
            schoolDay: selectedDateStr,
            totalKidsCount,
            presentCount,
            attendanceRate,
            healthIncidents,
          },
        }),
      });
      const data = await readCopilotResponse<{ answer: string; source: string }>(res);
      if (requestScope !== copilotScope.current) return;
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('Chưa nhận được câu trả lời hợp lệ từ Copilot.');
      const reply = data.source === 'preschool_ai_pack_rules'
        ? `Hướng dẫn theo quy tắc (chưa kết nối mô hình AI):\n${data.answer}`
        : data.answer;

      setExecutiveQnAMessages((prev) => [
        ...prev,
        createExecutiveMessage('copilot', reply),
      ]);
    } catch (error) {
      if (requestScope !== copilotScope.current) return;
      setCopilotError(error instanceof Error ? error.message : 'Có lỗi kết nối trợ lý AI.');
    } finally {
      if (requestScope === copilotScope.current) setIsExecutiveAsking(false);
    }
  };

  return (
    <div className="preschool-ui min-h-screen bg-background p-4 sm:p-6 lg:p-7 space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      
      <section aria-label="Phạm vi Tổng quan" className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">Cơ sở
          <select aria-label="Chọn cơ sở Tổng quan" value={selectedBranchId ?? ''} onChange={event => {
            setDashboardData(null); setAnalyticsError(null); setLoadingDashboard(true); setCopilotNotice(null);
            setSelectedBranchId(event.target.value || null);
          }} className="ml-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3 py-2">
            <option value="">Chọn cơ sở</option>
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <span className="text-sm text-slate-500">Dữ liệu ngày {selectedDateStr}, trong cơ sở đang chọn.</span>
        {analyticsError && <p role="alert">Không tải được Tổng quan: {analyticsError}. <button type="button" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</button></p>}
        {!loadingDashboard && !analyticsError && !selectedBranchId && <p role="status">Chọn cơ sở để xem dữ liệu được cấp quyền.</p>}
      </section>
      {copilotNotice && <p role="status" className="rounded-xl border border-amber-200 p-3 text-sm">{copilotNotice}</p>}
      {copilotError && <p role="alert" className="rounded-xl border border-rose-200 p-3 text-sm">{copilotError}</p>}

      {/* ── 1. TOP VIEWPORT HEADER (Search bar + User Tools) ── */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-transparent pb-1">
        {/* Search Bar Input */}
        <div className="relative w-full md:w-[480px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Lọc lớp trong cơ sở đang chọn"
            placeholder="Lọc lớp trong cơ sở đang chọn"
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>

        {/* User Profile & Notification Controls */}
        <div className="flex items-center gap-3.5 self-end md:self-auto relative">
          
          <Link href="/dashboard/education/communication?tab=announcements" title="Bảng tin chung" aria-label="Bảng tin chung" className="p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <Bell className="w-4 h-4" />
          </Link>

          {/* ── User Profile Badge with Interactive Dropdown ── */}
          <div className="relative border-l border-slate-200 dark:border-slate-800 pl-2" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 p-1 rounded-full hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all cursor-pointer group"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-sky-300 dark:border-sky-700 shrink-0 bg-sky-100 group-hover:scale-105 transition-transform">
                <span className="flex h-full items-center justify-center font-bold text-sky-900" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="hidden sm:block text-left">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  {displayName}
                </h4>
                <p className="text-[11px] font-bold text-[var(--education-brand-ink)]">
                  {userRole}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
            </button>

            {/* Profile Dropdown Popover Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Profile Header Info */}
                <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-slate-900 dark:to-slate-850 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-sky-400 shrink-0 bg-sky-100">
                      <span className="flex h-full items-center justify-center font-bold text-sky-900" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {displayName}
                      </h4>
                      <p className="text-xs font-bold text-[var(--education-brand-ink)] truncate">
                        {userRole}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full mt-1">
                        <CheckCircle className="w-3 h-3" /> Tài khoản hoạt động
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown Action Links */}
                <div className="p-2 space-y-1">
                  <Link
                    href="/dashboard/education/my-class"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    <Baby className="w-4 h-4 text-emerald-600" />
                    Không gian GVCN (Lớp của tôi)
                  </Link>

                  <Link
                    href="/dashboard/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    Cài đặt hệ thống & Giao diện
                  </Link>

                  <Link
                    href="/dashboard/education/teachers"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    Quản lý danh sách Giáo viên
                  </Link>

                  <Link
                    href="/dashboard/education/enrollments"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Baby className="w-4 h-4 text-slate-500" />
                    Quản lý danh sách Trẻ
                  </Link>

                  <Link
                    href="/dashboard/education/courses"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    Quản lý Lớp học & Chương trình
                  </Link>
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất tài khoản
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. PRESCHOOL WELCOME BANNER CARD ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-background to-accent/10 border border-primary/20 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        {/* Background decorative illustrations */}
        <div className="absolute top-2 right-44 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-60 h-60 rounded-full bg-primary/15 blur-2xl pointer-events-none" />

        {/* Date picker widget on top right corner */}
        <div className="absolute top-5 right-5 z-20" ref={datePickerRef}>
          <button 
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900 transition-all cursor-pointer active:scale-95"
            title="Bấm để chọn ngày xem lịch học"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>{formatVietnameseDate(selectedDate)}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Interactive Date Picker Dropdown Popover */}
          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Chọn ngày xem lịch học
                </span>
                <button 
                  onClick={() => { setSelectedDate(new Date()); setIsDatePickerOpen(false); }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>

              <input
                type="date"
                aria-label="Ngày Tổng quan"
                value={selectedDateStr}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value));
                    setIsDatePickerOpen(false);
                  }
                }}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ring font-medium cursor-pointer"
              />

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Đã chọn: <strong className="text-[var(--education-brand-ink)] font-bold">{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(selectedDate)}</strong></span>
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="px-3 py-1 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-[10px] transition-colors cursor-pointer shadow-xs"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Text content */}
          <div className="space-y-3 max-w-xl text-left">
            <div className="flex items-center gap-2">
              <span className="text-2xl">☀️</span>
              <h1 className="preschool-brand-heading text-3xl sm:text-4xl font-extrabold text-[var(--education-brand-ink)] tracking-tight font-handwriting">
                Chào mừng bạn trở lại!
              </h1>
            </div>
            <p className="text-slate-700 dark:text-slate-200 text-sm sm:text-base font-semibold leading-relaxed">
              Cùng nhau kiến tạo một môi trường hạnh phúc cho trẻ tại Bella Preschool
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium italic">
              &ldquo;Mỗi ngày đến trường là một ngày vui&rdquo;
            </p>
          </div>

          {/* Right Illustrations & Cute Badges */}
          <div className="relative flex items-center justify-center gap-4 shrink-0 pr-0 lg:pr-12">
            {/* Cute Badge 1: Small Steps Big Dreams */}
            <div className="hidden sm:flex flex-col items-center justify-center w-24 h-24 rounded-full bg-amber-400/90 text-white font-bold text-center text-xs p-2 shadow-md transform -rotate-6 border-2 border-white animate-bounce-slow">
              <span className="text-[11px] leading-tight uppercase font-extrabold">Small<br />Steps<br />Big<br />Dreams</span>
            </div>

            {/* Banner Child Image */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl bg-gradient-to-tr from-primary/15 to-primary/15">
              <Image
                src="/images/preschool_banner_kid.png"
                alt="Bella Preschool Child"
                fill
                className="object-cover"
              />
            </div>

            {/* Cute Badge 2: A Brighter Kinder Future */}
            <div className="hidden lg:flex flex-col items-center justify-center px-4 py-3 rounded-2xl bg-emerald-500/90 text-white font-bold text-center text-xs shadow-md transform rotate-6 border-2 border-white">
              <span className="text-[11px] font-extrabold">A<br />Brighter<br />Kinder<br />Future ♡</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2.3 EXECUTIVE AI COPILOT HUB (TRỢ LÝ ĐIỀU HÀNH BAN GIÁM HIỆU) ── */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-xl border border-violet-500/30 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-violet-600/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    Trợ lý Điều hành AI — Ban Giám Hiệu
                  </h2>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-200 border border-violet-400/30 tracking-wide">
                    Executive Copilot
                  </span>
                </div>
                <p className="text-xs text-violet-200/80 mt-0.5 font-medium">
                  Điểm tin cơ sở đang chọn, rà soát tuân thủ định mức Thông tư 52 & hỏi đáp nghiệp vụ quản lý
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveCopilotTab('briefing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeCopilotTab === 'briefing'
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : 'text-violet-200 hover:text-white hover:bg-white/10'
                }`}
              >
                Điểm tin AI
              </button>
              <button
                type="button"
                onClick={() => setActiveCopilotTab('compliance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeCopilotTab === 'compliance'
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : 'text-violet-200 hover:text-white hover:bg-white/10'
                }`}
              >
                Rà soát TT52
              </button>
              <button
                type="button"
                onClick={() => setActiveCopilotTab('qa')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeCopilotTab === 'qa'
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : 'text-violet-200 hover:text-white hover:bg-white/10'
                }`}
              >
                Hỏi đáp BGH
              </button>
            </div>
          </div>

          {/* TAB 1: EXECUTIVE BRIEFING */}
          {activeCopilotTab === 'briefing' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-violet-200 uppercase tracking-wide">
                    Tình hình tổng quan hôm nay
                  </p>
                  <p className="text-sm font-semibold text-white/90">
                    Sĩ số cơ sở: <span className="font-black text-amber-300">{metric(totalKidsCount)}</span> trẻ •
                    Có mặt: <span className="font-black text-emerald-300">{metric(presentCount)}</span> trẻ ({metric(attendanceRate, '%')} chuyên cần) •
                    Ca sốt/y tế: <span className="font-black text-rose-300">{metric(healthIncidents)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateBriefing}
                  disabled={isAiBriefingLoading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 inline-flex items-center gap-2"
                >
                  {isAiBriefingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tổng hợp...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{executiveBriefing ? 'Cập nhật điểm tin' : 'Tạo điểm tin đầu ngày'}</span>
                    </>
                  )}
                </button>
              </div>

              {executiveBriefing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Summary Box */}
                  <div className="md:col-span-2 p-4 rounded-2xl bg-white/10 border border-white/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Điểm tin tổng kết
                      </span>
                      <span className="text-[10px] text-violet-300">
                        {new Date(executiveBriefing.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-medium">
                      {executiveBriefing.executiveSummary}
                    </p>

                    {/* Actionable recommendations */}
                    {executiveBriefing.actionableRecommendations.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-1.5">
                        <p className="text-[11px] font-bold text-violet-200">Khuyến nghị hành động:</p>
                        {executiveBriefing.actionableRecommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-white/90">
                            <span className="text-amber-400 shrink-0">▸</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alerts Box */}
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/15 space-y-3">
                    <span className="text-xs font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Cảnh báo điều hành
                    </span>
                    {executiveBriefing.criticalAlerts.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-300 py-4">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>Không có cảnh báo nguy cấp. Vận hành ổn định.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {executiveBriefing.criticalAlerts.map((alert, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-medium leading-relaxed">
                            {alert}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPLIANCE & SAFETY SENTINEL */}
          {activeCopilotTab === 'compliance' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
                <div>
                  <p className="text-xs font-bold text-violet-200 uppercase tracking-wide">
                    Kiểm định định mức mầm non (Thông tư 52/2020/TT-BGDĐT)
                  </p>
                  <p className="text-xs text-white/80 mt-1">
                    Chưa có nguồn chuẩn về độ tuổi, nhân sự và định mức để kết luận tuân thủ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunComplianceAudit}
                  disabled={isComplianceAuditLoading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 inline-flex items-center gap-2"
                >
                  {isComplianceAuditLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang rà soát...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{complianceResult ? 'Quét lại' : 'Quét an toàn & sĩ số'}</span>
                    </>
                  )}
                </button>
              </div>

              {complianceResult && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/15 flex items-center gap-4">
                    <div className="text-3xl font-black text-amber-300">
                      {complianceResult.complianceScore}<span className="text-sm text-violet-200">/100</span>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-white">Điểm chuẩn TT52</p>
                      <p className="text-[11px] text-violet-200 mt-0.5">
                        {complianceResult.compliant ? 'Đạt chuẩn 100%' : 'Có điểm cần điều chỉnh'}
                      </p>
                    </div>
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-2xl bg-white/10 border border-white/15 space-y-2">
                    <p className="text-xs font-black uppercase text-violet-200">Kết quả rà soát {complianceResult.inspectedClassesCount} lớp:</p>
                    {complianceResult.violations.length === 0 && complianceResult.warnings.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>Tất cả các lớp học đều tuân thủ đúng định mức sĩ số và tỷ lệ giáo viên của Bộ GD&ĐT.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {complianceResult.violations.map((v, i) => (
                          <div key={i} className="text-xs text-rose-300 font-medium flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold shrink-0">✕</span>
                            <span>{v}</span>
                          </div>
                        ))}
                        {complianceResult.warnings.map((w, i) => (
                          <div key={i} className="text-xs text-amber-300 font-medium flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold shrink-0">⚠</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXECUTIVE Q&A */}
          {activeCopilotTab === 'qa' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Messages list */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {executiveQnAMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender === 'copilot' && (
                      <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-black">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'bg-white/10 text-white border border-white/10 whitespace-pre-line'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className="text-[9px] opacity-60 block mt-1 text-right">{msg.time}</span>
                    </div>
                  </div>
                ))}
                {isExecutiveAsking && (
                  <div className="flex items-center gap-2 text-xs text-violet-300 p-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Copilot đang phân tích số liệu quản trị mầm non...</span>
                  </div>
                )}
              </div>

              {/* Preset quick questions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Soạn thông báo gửi phụ huynh về lịch khám sức khỏe',
                  'Quy định sĩ số tối đa theo Thông tư 52 cho các lớp mầm non',
                  'Tình hình chuyên cần và số ca sốt toàn trường hôm nay',
                  'Giải pháp nhắc đóng học phí tự động qua VietQR',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void handleSendExecutiveQuestion(q)}
                    disabled={isExecutiveAsking}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-violet-200 text-[10px] font-bold border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendExecutiveQuestion();
                }}
                className="flex items-center gap-2 pt-2"
              >
                <input
                  type="text"
                  value={executiveQuestion}
                  onChange={(e) => setExecutiveQuestion(e.target.value)}
                  placeholder="Đặt câu hỏi điều hành (VD: Soạn thư cảm ơn phụ huynh, rà soát sĩ số lớp Chồi)..."
                  disabled={isExecutiveAsking}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-violet-300/60 outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!executiveQuestion.trim() || isExecutiveAsking}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-500 font-bold text-xs disabled:opacity-40 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── 2.5 LAYER 1 — NOW: OPERATIONAL COMMAND CENTER (Cần xử lý hôm nay) ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>Cần xử lý hôm nay</span>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-200/60 dark:border-rose-900 px-2.5 py-0.5 rounded-full lowercase flex items-center gap-1.5">
                {loadingDashboard ? (
                  <>
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>Đang tải</span>
                  </>
                ) : totalAttentionItems === null ? (
                  'Chưa có dữ liệu'
                ) : (
                  `${totalAttentionItems} mục cần chú ý`
                )}
              </span>
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden sm:inline-flex items-center gap-1.5">
            {loadingDashboard ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Đang tải số liệu</span>
              </>
            ) : dashboardData?.commandCenter ? (
              'Dữ liệu tại lần tải gần nhất'
            ) : (
              'Không tải được số liệu cảnh báo'
            )}
          </span>
        </div>

        {loadingDashboard ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Link
              href="/dashboard/education/attendance"
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 hover:bg-amber-100/90 dark:hover:bg-amber-900/60 transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-950 dark:text-amber-200 truncate">{metric(unmarkedAttendance)} trẻ chưa điểm danh</p>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 group-hover:underline">Điểm danh ngay →</span>
              </div>
            </Link>

            <Link
              href="/dashboard/education/work-queue?view=absences"
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900/60 hover:bg-sky-100/90 dark:hover:bg-sky-900/60 transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-sky-950 dark:text-sky-200 truncate">{metric(leaveRequests)} đơn nghỉ chờ duyệt</p>
                <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 group-hover:underline">Duyệt ngay →</span>
              </div>
            </Link>

            <Link
              href="/dashboard/education/finance?tab=debts"
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 hover:bg-rose-100/90 dark:hover:bg-rose-900/60 transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-rose-950 dark:text-rose-200 truncate">{metric(overdueInvoices)} học phí quá hạn</p>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 group-hover:underline">Xem công nợ →</span>
              </div>
            </Link>

            <Link
              href="/dashboard/education/work-queue?view=health"
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/60 hover:bg-red-100/90 dark:hover:bg-red-900/60 transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Heart className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-red-950 dark:text-red-200 truncate">{metric(healthIncidents)} sự cố sức khỏe</p>
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400 group-hover:underline">Theo dõi bé →</span>
              </div>
            </Link>

            <Link
              href="/dashboard/education/work-queue?view=parents"
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900/60 hover:bg-purple-100/90 dark:hover:bg-purple-900/60 transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-purple-950 dark:text-purple-200 truncate">{metric(parentRequests)} yêu cầu phụ huynh</p>
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 group-hover:underline">Xem yêu cầu →</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ── 3. ROW OF 5 KPI SUMMARY CARDS (LAYER 2: HEALTH) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiStats.map((kpi) => (
          <div 
            key={kpi.id}
            title={kpi.tooltip}
            className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {kpi.label}
                  </span>
                  {kpi.tooltip && (
                    <span 
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-help inline-flex"
                      title={kpi.tooltip}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                {loadingDashboard ? (
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse my-0.5" />
                ) : (
                  <h3 data-testid={`metric-${kpi.id}`} className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {kpi.value}
                  </h3>
                )}
                {kpi.note && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-tight">
                    {kpi.note}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-2xl shrink-0 ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">Chưa có dữ liệu so sánh kỳ trước.</p>
          </div>
        ))}
      </div>

      {/* ── 4. MIDDLE SECTION (2 COLUMNS / 3 PANELS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Panel 1: Sĩ số học sinh theo lớp (Bar Chart - 6/12 cols) */}
        <div className="lg:col-span-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Sĩ số học sinh theo lớp</span>
              {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <span className="text-xs text-slate-500">Hiện tại</span>
          </div>

          {/* Bar Chart Graphic */}
          {loadingDashboard ? (
            <div className="pt-4 space-y-2 animate-pulse">
              <div className="h-44 w-full grid grid-cols-8 gap-2 px-2 border-b border-slate-200 dark:border-slate-800 items-end">
                {[65, 55, 45, 40, 75, 60, 50, 55].map((h, i) => (
                  <div key={i} className="flex flex-col items-center h-full justify-end">
                    <div className="w-full max-w-[28px] rounded-t-lg bg-slate-200 dark:bg-slate-800" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-8 gap-2 px-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-3 bg-slate-200 dark:bg-slate-800 rounded mx-auto w-8" />
                ))}
              </div>
            </div>
          ) : classHeadcounts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 border-b border-slate-200 dark:border-slate-800">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-400 font-medium">Chưa có thông tin lớp học</p>
            </div>
          ) : (
            <div className="pt-4 space-y-2">
              <div className="h-44 w-full grid grid-cols-8 gap-2 px-2 border-b border-slate-200 dark:border-slate-800">
                {classHeadcounts.map((item) => {
                  const heightPercentage = Math.round((item.count / 40) * 100);
                  return (
                    <div key={item.classId} className="flex flex-col items-center gap-1 group h-full justify-end">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 opacity-80 group-hover:opacity-100 transition-opacity">
                        {item.count}
                      </span>
                      <div 
                        className="w-full max-w-[28px] rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-sm"
                        style={{ 
                          height: `${heightPercentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Class Labels Grid - 100% pixel aligned with bars */}
              <div className="grid grid-cols-8 gap-2 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {classHeadcounts.map((item) => (
                  <span key={item.classId} className="text-center truncate" title={item.name}>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Tỷ lệ độ tuổi (Donut Chart - 3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Tỷ lệ độ tuổi</span>
            {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </h3>

          {loadingDashboard ? (
            <div className="flex flex-col items-center justify-center space-y-4 pt-1 animate-pulse">
              <div className="w-36 h-36 rounded-full border-8 border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900" />
              </div>
              <div className="w-full space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                ))}
              </div>
            </div>
          ) : ageDistribution.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Baby className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-400 font-medium">Chưa có dữ liệu độ tuổi</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 pt-1">
              {/* Donut Chart SVG */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {(() => {
                    let accumulated = 0;
                    return ageDistribution.map((seg) => {
                      const offset = accumulated;
                      accumulated += seg.percentage;
                      return (
                        <circle
                          key={seg.label}
                          cx="18"
                          cy="18"
                          r="14.5"
                          pathLength="100"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="4.5"
                          strokeDasharray={`${seg.percentage} ${100 - seg.percentage}`}
                          strokeDashoffset={-offset}
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Inner Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                    {totalKidsCount}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    học sinh
                  </span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="w-full space-y-1.5 text-xs">
                {ageDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel 3: Hoạt động gần đây (Timeline Feed - 3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Hoạt động gần đây</span>
              {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <button 
              type="button"
              onClick={() => setIsActivityDrawerOpen(true)}
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loadingDashboard ? (
            <div className="space-y-3 pt-1 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : previewActivities.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Chưa có nguồn nhật ký hoạt động trong Tổng quan.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {previewActivities.map((act) => {
                const visuals = getActivityVisuals(act.category);
                return (
                  <div key={act.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-full shrink-0 ${visuals.iconBg}`}>
                        {visuals.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">
                          {act.title}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                          {act.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">
                      {act.displayTime}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── 5. BOTTOM SECTION (3 PANELS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Panel 4: Doanh thu theo tháng (Bar Chart - 5/12 cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Doanh thu theo tháng</span>
              {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            {/* Period Selector */}
            <div className="relative">
              <select
                value=""
                disabled
                aria-label="Kỳ doanh thu chưa khả dụng"
                className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 pr-7 focus:outline-none cursor-pointer"
              >
                <option value="">Chưa có dữ liệu doanh thu theo kỳ</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {loadingDashboard ? (
            <div className="pt-2 space-y-2 animate-pulse">
              <div className="h-44 w-full grid grid-cols-6 gap-2 px-2 border-b border-slate-200 dark:border-slate-800 items-end">
                {[40, 60, 50, 75, 85, 90].map((h, i) => (
                  <div key={i} className="flex flex-col items-center h-full justify-end">
                    <div className="w-full max-w-[32px] rounded-t-lg bg-slate-200 dark:bg-slate-800" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2 px-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-3 bg-slate-200 dark:bg-slate-800 rounded mx-auto w-8" />
                ))}
              </div>
            </div>
          ) : monthlyRevenue.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 border-b border-slate-200 dark:border-slate-800">
              <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-400 font-medium">Chưa có dữ liệu doanh thu kỳ này</p>
            </div>
          ) : (
            <div className="pt-2 space-y-2">
              {/* Bars Grid */}
              <div className={`h-44 w-full grid ${monthlyRevenue.length === 12 ? 'grid-cols-12 gap-1' : 'grid-cols-6 gap-2'} px-2 border-b border-slate-200 dark:border-slate-800 relative`}>
                {monthlyRevenue.map((item) => {
                  const heightPercentage = Math.round((item.value / 400) * 100);
                  const isHovered = hoveredRevenueMonth === item.month;

                  return (
                    <div 
                      key={item.month} 
                      onMouseEnter={() => setHoveredRevenueMonth(item.month)}
                      className="flex flex-col items-center group h-full justify-end relative cursor-pointer"
                    >
                      <div 
                        className={`w-full max-w-[32px] rounded-t-lg transition-all duration-300 relative ${
                          item.highlighted || isHovered 
                            ? 'bg-emerald-500 shadow-md scale-105' 
                            : 'bg-emerald-400/80 dark:bg-emerald-600/80 hover:bg-emerald-500'
                        }`}
                        style={{ height: `${heightPercentage}%` }}
                      >
                        {/* Tooltip directly 8px above top of this specific bar */}
                        {isHovered && (
                          <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-30 bg-[#0B0F19] text-white px-3.5 py-1.5 rounded-full border border-slate-800/80 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none text-center flex flex-col items-center justify-center [box-shadow:0_4px_16px_rgba(0,0,0,0.5)]">
                            <span className="text-xs font-extrabold text-white leading-tight">{item.month}</span>
                            <span className="text-xs font-black text-emerald-400 leading-tight">{item.tooltip || `${item.value} triệu VNĐ`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Month Labels Grid - 100% pixel aligned with bars */}
              <div className={`grid ${monthlyRevenue.length === 12 ? 'grid-cols-12 gap-1 text-[10px]' : 'grid-cols-6 gap-2 text-[11px]'} px-2 font-semibold text-slate-500 dark:text-slate-400`}>
                {monthlyRevenue.map((item) => (
                  <span key={item.month} className="text-center truncate">
                    {item.month}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel 5: Thực đơn tuần này (3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Thực đơn tuần này</span>
              {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <button 
              type="button"
              onClick={() => setIsMenuDrawerOpen(true)} 
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5 cursor-pointer"
              title="Xem chi tiết thực đơn dinh dưỡng 5 ngày"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loadingDashboard ? (
            <div className="space-y-2 pt-1 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-1.5 -mx-1.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : weeklyMenuDays.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
              <Utensils className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Chưa có thực đơn tuần này</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {weeklyMenuDays.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setIsMenuDrawerOpen(true)}
                  className="flex items-center gap-3 text-xs p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  title={`Nhấn xem thực đơn ${item.dayLabel}: ${item.summaryDishes}`}
                >
                  <span className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs group-hover:scale-105 transition-transform ${item.badgeColor || 'bg-emerald-500 text-white'}`}>
                    {item.dayKey}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate group-hover:text-[var(--education-brand-ink)] transition-colors">
                    {item.summaryDishes}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 6: Thông báo (4/12 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Thông báo</span>
              {loadingDashboard && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </h3>
            <Link 
              href="/dashboard/education/communication?tab=announcements" 
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5"
              title="Đến trang quản lý thông báo toàn trường"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loadingDashboard ? (
            <div className="space-y-2.5 pt-1 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-1.5 -mx-1.5">
                  <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
              <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Xem thông báo chung tại Bảng tin nhà trường.</p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {announcements.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedNoticeModal(item)}
                  className="flex items-center justify-between gap-3 text-xs p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  title="Nhấn để xem toàn văn thông báo"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Megaphone className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${item.iconColor || 'text-sky-500'}`} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-[var(--education-brand-ink)] transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    {item.displayDate || item.date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── 6. PRESCHOOL FOOTER BRANDING ── */}
      <footer className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>Nuôi dưỡng những giá trị tốt đẹp từ những năm tháng đầu đời</span>
          <span className="text-[var(--education-brand-ink)]">♡</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold text-slate-700 dark:text-slate-300">Bella Preschool</span>
          <span>|</span>
          <span>Yêu thương • Tôn trọng • Đồng hành • Phát triển</span>
          <span className="text-emerald-500">🌱</span>
        </div>
      </footer>

      {/* ── 7. SCHOOL ACTIVITIES TIMELINE DRAWER / MODAL ── */}
      {isActivityDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsActivityDrawerOpen(false)}
            aria-label="Đóng nhật ký hoạt động"
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/70 via-sky-50/40 to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-[#0e5c43] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Nhật ký hoạt động toàn trường
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {allActivities.length} sự kiện
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Dòng sự kiện thời gian thực tổng hợp đa phân hệ ({formatVietnameseDate(selectedDate)})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActivityDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar inside Drawer */}
              <div className="relative mt-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh, lớp, loại hoạt động..."
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
                {activitySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setActivitySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {/* Category Filter Pills Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 -mx-1 px-1">
                {categoryFilterTabs.map((tab) => {
                  const isActive = activityCategoryFilter === tab.id;
                  const count = activityCategoryCounts[tab.id] ?? 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivityCategoryFilter(tab.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#0e5c43] text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activities Timeline Scrollable List */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {filteredDrawerActivities.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Không tìm thấy hoạt động nào phù hợp
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Hãy thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 space-y-4">
                  {filteredDrawerActivities.map((act) => {
                    const visuals = getActivityVisuals(act.category);
                    return (
                      <div key={act.id} className="relative group">
                        {/* Timeline Node Dot */}
                        <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-[#0e5c43] group-hover:scale-110 transition-all">
                          <div className="w-2 h-2 rounded-full bg-[#0e5c43]" />
                        </div>

                        {/* Event Card */}
                        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-xs hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${visuals.badgeBg}`}>
                                {act.categoryLabel}
                              </span>
                              {act.actorRole && (
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  • {act.actorRole}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                              {act.displayTime}
                            </span>
                          </div>

                          <div className="mt-2 flex items-start gap-3">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${visuals.iconBg}`}>
                              {visuals.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                                {act.title}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                {act.description}
                              </p>
                              {act.status && (
                                <div className="mt-2.5 flex items-center gap-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Trạng thái: {act.status}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer with Quick Action Links */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">
                Nguồn: Tổng hợp hoạt động thời gian thực (P1–P9)
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/education/learning"
                  className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Học tập & Hoạt động</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. NOTICE DETAIL MODAL ── */}
      {selectedNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 cursor-pointer" 
            onClick={() => setSelectedNoticeModal(null)}
            aria-label="Đóng chi tiết thông báo"
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-4 z-10 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60">
                  {selectedNoticeModal.category}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedNoticeModal.priority === 'URGENT' || selectedNoticeModal.priority === 'HIGH'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  Độ ưu tiên: {selectedNoticeModal.priority}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Date */}
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                {selectedNoticeModal.title}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-medium mt-1.5">
                <span>Ngày ban hành: <strong className="text-slate-600 dark:text-slate-300">{selectedNoticeModal.displayDate}</strong></span>
                {selectedNoticeModal.dueAt && (
                  <span>• Hạn: <strong className="text-amber-600 dark:text-amber-400">{selectedNoticeModal.dueAt.slice(0, 10)}</strong></span>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
              <p>{selectedNoticeModal.bodyText}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">
                Nguồn: edu_comm_notices (P6.1)
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/education/communication?tab=announcements"
                  onClick={() => setSelectedNoticeModal(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0c513f] text-white text-xs font-bold hover:bg-[#083b2e] transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>Mở trong Truyền thông</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. WEEKLY NUTRITION MENU DRAWER ── */}
      {isMenuDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsMenuDrawerOpen(false)}
            aria-label="Đóng thực đơn dinh dưỡng"
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/70 via-sky-50/40 to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-[#0e5c43] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Thực đơn dinh dưỡng tuần này
                      {weeklyMenuData && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          {weeklyMenuData.status === 'PUBLISHED' ? 'Đã ban hành' : 'Dự thảo'}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {weeklyMenuData ? `Tuần ${weeklyMenuData.weekNumber} (${weeklyMenuData.startDate} – ${weeklyMenuData.endDate}) • Đảm bảo chuẩn Kcal học đường` : 'Đang cập nhật thực đơn dinh dưỡng'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Đóng thực đơn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body: 5 Days Breakdown */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {weeklyMenuDays.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Chưa có thực đơn tuần này
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Thực đơn dinh dưỡng chưa được ban hành hoặc đang trong quá trình phê duyệt.
                  </p>
                </div>
              ) : (
                weeklyMenuDays.map((day) => (
                  <div 
                    key={day.dayKey} 
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs shadow-xs ${day.badgeColor}`}>
                          {day.dayKey}
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {day.dayLabel} • {day.dateStr}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {day.summaryDishes}
                          </span>
                        </div>
                      </div>
                      {day.caloriesKcal && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60">
                          {day.caloriesKcal} Kcal
                        </span>
                      )}
                    </div>

                    {/* Meals Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                      {day.meals && day.meals.length > 0 ? (
                        day.meals.map((meal, mIdx) => (
                          <div key={mIdx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                              {meal.mealTypeLabel}
                            </span>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {meal.dishes.join(', ')}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 col-span-2 text-slate-600 dark:text-slate-300">
                          {day.summaryDishes}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">
                Lá chắn dị ứng: P4.1 Allergy Shield
              </span>
              <Link
                href="/dashboard/education/care"
                onClick={() => setIsMenuDrawerOpen(false)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
              >
                <span>Chuyển tới Chăm sóc & Điểm danh suất ăn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
