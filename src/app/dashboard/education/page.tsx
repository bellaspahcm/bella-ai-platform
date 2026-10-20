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
  Check,
  X,
  BookOpen,
  Info,
  Activity,
  Filter,
} from 'lucide-react';

// Static default fallback data (module-level to avoid useMemo dep issues)
const defaultClassHeadcounts = [
  { classId: 'mam-non-1', name: 'Mầm non 1', count: 28, color: '#F472B6' },
  { classId: 'mam-non-2', name: 'Mầm non 2', count: 24, color: '#60A5FA' },
  { classId: 'nha-tre-1', name: 'Nhà trẻ 1', count: 18, color: '#FBBF24' },
  { classId: 'nha-tre-2', name: 'Nhà trẻ 2', count: 16, color: '#34D399' },
  { classId: 'la-1',      name: 'Lá 1',      count: 32, color: '#C084FC' },
  { classId: 'la-2',      name: 'Lá 2',      count: 26, color: '#FB923C' },
  { classId: 'choi-1',    name: 'Chồi 1',    count: 20, color: '#22D3EE' },
  { classId: 'choi-2',    name: 'Chồi 2',    count: 22, color: '#A3E635' },
];

export default function EducationDashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('Năm học 2026 - 2027');
  const [selectedRevenuePeriod, setSelectedRevenuePeriod] = useState('6 tháng gần nhất');
  const [hoveredRevenueMonth, setHoveredRevenueMonth] = useState<string | null>('Tháng 10');

  // Interactive Header Popover & Date States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
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
  const notificationRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Format date into Vietnamese display string (e.g. "Thứ Tư, 9 tháng 9, 2026")
  const formatVietnameseDate = (date: Date) => {
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${dayName}, ${day} tháng ${month}, ${year}`;
  };

  // Close popovers on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
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
        setIsNotificationsOpen(false);
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

  const selectedDateStr = useMemo(() => {
    return selectedDate.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      try {
        setLoadingDashboard(true);
        setDashboardData(null);
        const res = await fetch(`/api/education/analytics?date=${selectedDateStr}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && data.dashboard) {
          setDashboardData(data.dashboard);
        }
      } catch (err) {
        console.warn('Failed to load real-time preschool analytics:', err);
      } finally {
        if (isMounted) setLoadingDashboard(false);
      }
    }
    fetchAnalytics();
    return () => { isMounted = false; };
  }, [selectedDateStr]);

  // Derived Dynamic Metrics with Seeded Fallbacks
  const totalKidsCount = dashboardData?.enrollment?.classroomUtilization
    ? dashboardData.enrollment.classroomUtilization.reduce((sum, c) => sum + c.currentEnrollment, 0)
    : 186;
  const totalClassesCount = dashboardData?.enrollment?.totalClassrooms ?? 8;
  const totalTeachersCount = dashboardData?.enrollment?.totalTeachers ?? 24;
  const presentCount = dashboardData?.attendance?.todayPresentCount ?? 150;
  const attendanceRate = totalKidsCount > 0 ? Math.round((presentCount / totalKidsCount) * 100) : 96;
  const totalParentsCount = dashboardData?.commandCenter?.totalParentsCount ?? 142;

  // Command Center Live Counts
  const unmarkedAttendance = dashboardData?.commandCenter?.unmarkedAttendanceCount;
  const leaveRequests = dashboardData?.commandCenter?.leaveRequestsCount;
  const overdueInvoices = dashboardData?.commandCenter?.overdueInvoicesCount;
  const healthIncidents = dashboardData?.commandCenter?.healthIncidentsCount;
  const parentRequests = dashboardData?.commandCenter?.parentRequestsCount;
  const totalAttentionItems = dashboardData?.commandCenter
    ? [unmarkedAttendance, leaveRequests, overdueInvoices, healthIncidents, parentRequests].filter(count => count !== undefined && count > 0).length
    : null;

  // Dynamic KPI Cards Data
  const kpiStats = [
    {
      id: 'total-kids',
      label: 'Tổng số trẻ',
      value: String(totalKidsCount),
      change: '+12%',
      comparison: 'so với tháng trước',
      icon: <Users className="w-5 h-5 text-rose-500" />,
      iconBg: 'bg-rose-100 dark:bg-rose-950/50',
    },
    {
      id: 'total-classes',
      label: 'Số lớp học',
      value: String(totalClassesCount),
      change: '+1 lớp',
      comparison: 'so với kỳ trước',
      icon: <Users className="w-5 h-5 text-sky-500" />,
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
    },
    {
      id: 'total-teachers',
      label: 'Tổng nhân sự',
      note: 'Gồm GV, bảo mẫu & hỗ trợ',
      tooltip: 'Bao gồm giáo viên, bảo mẫu và nhân viên hỗ trợ toàn trường',
      value: String(totalTeachersCount),
      change: '+2',
      comparison: 'so với tháng trước',
      icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    },
    {
      id: 'attendance-rate',
      label: 'Tỷ lệ chuyên cần',
      value: `${attendanceRate}%`,
      change: '+3%',
      comparison: 'so với tháng trước',
      icon: <CalendarCheck className="w-5 h-5 text-amber-500" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
    },
    {
      id: 'total-parents',
      label: 'Phụ huynh',
      value: String(totalParentsCount),
      change: '+10%',
      comparison: 'so với tháng trước',
      icon: <Heart className="w-5 h-5 text-pink-500" />,
      iconBg: 'bg-pink-100 dark:bg-pink-950/50',
    },
  ];

  // Dynamic Class Headcount Bar Chart Data with live counts

  const classHeadcounts = useMemo(() => {
    if (!dashboardData?.enrollment?.classroomUtilization?.length) {
      return defaultClassHeadcounts;
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

    const sorted = [...dashboardData.enrollment.classroomUtilization].sort((a, b) => {
      return getRank(a.className) - getRank(b.className);
    });

    return sorted.map((c, idx) => ({
      classId: c.classId,
      name: c.className.replace(/^Lớp\s+/, '').replace(/\s+—\s+.*$/, ''),
      count: c.currentEnrollment,
      color: colorPalette[idx % colorPalette.length],
    }));
  }, [dashboardData]);

  // Dynamic Age Distribution Donut Chart Data derived from actual classroom enrollments
  const ageDistribution = useMemo(() => {
    const classrooms = dashboardData?.enrollment?.classroomUtilization ?? [];
    let nhaTre = 0;
    let mam = 0;
    let choi = 0;
    let la = 0;

    if (classrooms.length > 0) {
      classrooms.forEach((c) => {
        const name = c.className.toLowerCase();
        if (name.includes('nhà trẻ')) nhaTre += c.currentEnrollment;
        else if (name.includes('mầm')) mam += c.currentEnrollment;
        else if (name.includes('chồi')) choi += c.currentEnrollment;
        else if (name.includes('lá')) la += c.currentEnrollment;
      });
    } else {
      nhaTre = 34;
      mam = 52;
      choi = 42;
      la = 58;
    }

    const total = nhaTre + mam + choi + la || 186;
    const pNhaTre = Math.round((nhaTre / total) * 100);
    const pMam = Math.round((mam / total) * 100);
    const pChoi = Math.round((choi / total) * 100);
    const pLa = 100 - pNhaTre - pMam - pChoi; // Guarantees exact 100%

    return [
      { label: 'Nhà trẻ (1-2 tuổi)', count: nhaTre, percentage: pNhaTre, color: '#F97316' },
      { label: 'Mầm non (3-4 tuổi)', count: mam,    percentage: pMam,    color: '#F59E0B' },
      { label: 'Chồi (4-5 tuổi)',    count: choi,   percentage: pChoi,   color: '#3B82F6' },
      { label: 'Lá (5-6 tuổi)',      count: la,     percentage: pLa,     color: '#A855F7' },
    ];
  }, [dashboardData]);

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

  // Seeded fallback activities matching layout
  const defaultRecentActivities: PreschoolActivityItemDTO[] = useMemo(() => [
    {
      id: 'mock-1',
      category: 'ATTENDANCE',
      categoryLabel: 'Điểm danh & Đón trả',
      title: 'Nguyễn Minh Anh',
      description: 'Đã đến trường — Cô Lan đón vào lớp',
      timestamp: `${selectedDateStr}T07:32:00Z`,
      displayTime: '07:32',
      actorRole: 'Học sinh',
      status: 'Đã đến',
    },
    {
      id: 'mock-2',
      category: 'LEARNING',
      categoryLabel: 'Học tập & Trải nghiệm',
      title: 'Lớp Lá 1',
      description: 'Hoàn thành hoạt động: Bé trồng cây & khám phá thiên nhiên',
      timestamp: `${selectedDateStr}T10:15:00Z`,
      displayTime: '10:15',
      actorRole: 'Giáo viên',
      status: 'Hoàn thành',
    },
    {
      id: 'mock-3',
      category: 'PARENT_COMM',
      categoryLabel: 'Tương tác phụ huynh',
      title: 'Trần Thị Mai',
      description: 'Đã gửi phản hồi và dặn dò chế độ ăn cho giáo viên',
      timestamp: `${selectedDateStr}T11:20:00Z`,
      displayTime: '11:20',
      actorRole: 'Phụ huynh',
      status: 'Đã nhận',
    },
    {
      id: 'mock-4',
      category: 'FINANCE',
      categoryLabel: 'Tài chính & Học phí',
      title: 'Phụ huynh Lê Hoàng',
      description: 'Đã thanh toán học phí Tháng 10 qua cổng VietQR',
      timestamp: `${selectedDateStr}T14:08:00Z`,
      displayTime: '14:08',
      actorRole: 'Phụ huynh',
      status: 'Đã thanh toán',
    },
    {
      id: 'mock-5',
      category: 'CARE_NUTRITION',
      categoryLabel: 'Chăm sóc & Dinh dưỡng',
      title: 'Lớp Chồi 2',
      description: 'Cập nhật thực đơn tuần mới: Phở bò, Sữa tươi, Chuối tiêu',
      timestamp: `${selectedDateStr}T15:30:00Z`,
      displayTime: '15:30',
      actorRole: 'Dinh dưỡng',
      status: 'Đã duyệt',
    },
    {
      id: 'mock-6',
      category: 'ATTENDANCE',
      categoryLabel: 'Điểm danh & Đón trả',
      title: 'Trần Gia Bảo',
      description: 'Bàn giao phụ huynh đón về an toàn lúc tan trường',
      timestamp: `${selectedDateStr}T16:45:00Z`,
      displayTime: '16:45',
      actorRole: 'Học sinh',
      status: 'Đã đón',
    },
  ], [selectedDateStr]);

  // Dynamic School Activities Feed: Real-time aggregated stream with graceful fallback
  const allActivities: PreschoolActivityItemDTO[] = useMemo(() => {
    if (dashboardData?.recentActivities && dashboardData.recentActivities.length > 0) {
      return dashboardData.recentActivities;
    }
    return defaultRecentActivities;
  }, [dashboardData, defaultRecentActivities]);

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

  // Monthly Revenue Chart Data responsive to selected period
  const monthlyRevenue = useMemo(() => {
    if (selectedRevenuePeriod === '12 tháng qua') {
      return [
        { month: 'T11/25', value: 250 },
        { month: 'T12/25', value: 255 },
        { month: 'T1/26',  value: 230 },
        { month: 'T2/26',  value: 210 },
        { month: 'T3/26',  value: 245 },
        { month: 'T4/26',  value: 260 },
        { month: 'T5/26',  value: 260 },
        { month: 'T6/26',  value: 270 },
        { month: 'T7/26',  value: 240 },
        { month: 'T8/26',  value: 290 },
        { month: 'T9/26',  value: 310 },
        { month: 'T10/26', value: 320, highlighted: true, tooltip: '320 triệu VNĐ' },
      ];
    }
    return [
      { month: 'Tháng 5', value: 260 },
      { month: 'Tháng 6', value: 270 },
      { month: 'Tháng 7', value: 240 },
      { month: 'Tháng 8', value: 290 },
      { month: 'Tháng 9', value: 310 },
      { month: 'Tháng 10', value: 320, highlighted: true, tooltip: '320 triệu VNĐ' },
    ];
  }, [selectedRevenuePeriod]);

  // Dynamic Weekly Nutrition Menu (P4.3) with real-time DB integration & graceful fallback
  const defaultWeeklyMenuData: PreschoolWeeklyMenuDTO = useMemo(() => ({
    menuId: 'menu-default',
    weekNumber: 43,
    year: 2026,
    startDate: '2026-10-19',
    endDate: '2026-10-23',
    status: 'PUBLISHED',
    days: [
      {
        dayKey: 'T2',
        dayLabel: 'Thứ Hai',
        dateStr: '19/10/2026',
        badgeColor: 'bg-sky-400 text-white',
        summaryDishes: 'Phở bò, Sữa tươi, Chuối',
        caloriesKcal: 680,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò Hà Nội'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi thanh trùng 150ml'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm dẻo', 'Thịt heo rim nước dừa', 'Canh bí đao nấu tôm'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Chuối tiêu chín', 'Bánh bông lan'] },
        ],
      },
      {
        dayKey: 'T3',
        dayLabel: 'Thứ Ba',
        dateStr: '20/10/2026',
        badgeColor: 'bg-rose-400 text-white',
        summaryDishes: 'Cơm gà, Canh rau củ, Sữa chua',
        caloriesKcal: 710,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Cháo gà hạt sen'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa đậu nành hữu cơ'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm gà xé phay', 'Canh củ dền xương heo'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Sữa chua hoa quả dầm'] },
        ],
      },
      {
        dayKey: 'T4',
        dayLabel: 'Thứ Tư',
        dateStr: '21/10/2026',
        badgeColor: 'bg-emerald-400 text-white',
        summaryDishes: 'Bún cá, Rau hấp, Dưa hấu',
        caloriesKcal: 670,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Bún cá rô đồng'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Nước ép táo nguyên chất'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm trắng', 'Cá hồi áp chảo sốt bơ tỏi', 'Rau củ hấp', 'Canh rau ngót'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Dưa hấu tươi', 'Sữa hạt sen'] },
        ],
      },
      {
        dayKey: 'T5',
        dayLabel: 'Thứ Năm',
        dateStr: '22/10/2026',
        badgeColor: 'bg-blue-400 text-white',
        summaryDishes: 'Cơm thịt kho, Canh bí đỏ, Sữa tươi',
        caloriesKcal: 720,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Hủ tiếu Nam Vang thịt bằm'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi Vinamilk 180ml'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm thơm', 'Thịt ba chỉ kho trứng cút', 'Canh bí đỏ đậu phộng'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Bánh flan caramen', 'Thanh long ruột đỏ'] },
        ],
      },
      {
        dayKey: 'T6',
        dayLabel: 'Thứ Sáu',
        dateStr: '23/10/2026',
        badgeColor: 'bg-purple-400 text-white',
        summaryDishes: 'Mì trứng, Trứng hấp, Thanh long',
        caloriesKcal: 690,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Mì trứng xào thịt bò rau cải'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa bắp non ngọt dịu'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm tấm mềm', 'Trứng hấp thịt bằm mộc nhĩ', 'Canh chua cá bông lau'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Thanh long trắng', 'Bánh quy bơ'] },
        ],
      },
    ],
  }), []);

  const weeklyMenuData: PreschoolWeeklyMenuDTO = useMemo(() => {
    if (dashboardData?.weeklyMenu) {
      return dashboardData.weeklyMenu;
    }
    return defaultWeeklyMenuData;
  }, [dashboardData, defaultWeeklyMenuData]);

  const weeklyMenuDays = weeklyMenuData.days;

  // Dynamic School Announcements (P6.1) with real-time DB integration & fallback
  const defaultAnnouncements: PreschoolNoticeItemDTO[] = useMemo(() => [
    { 
      id: 'n-1', 
      title: 'Kế hoạch tổ chức Ngày Phụ nữ VN 20/10', 
      bodyText: 'Nhà trường phát động chuỗi hoạt động làm thiệp và gửi lời chúc yêu thương của các bé đến bà và mẹ nhân ngày 20/10. Kính mời phụ huynh cùng tham gia triển lãm tranh tại sảnh trường.',
      category: 'HOẠT ĐỘNG',
      priority: 'HIGH',
      date: '2026-10-15', 
      displayDate: '15/10/2026', 
      iconColor: 'text-rose-500' 
    },
    { 
      id: 'n-2', 
      title: 'Lịch khám sức khỏe & nha khoa định kỳ HK1', 
      bodyText: 'Đoàn bác sĩ chuyên khoa Nhi & Răng Hàm Mặt sẽ tiến hành khám sức khỏe tổng quát và tầm soát răng miệng cho toàn bộ học sinh các khối Mầm, Chồi, Lá.',
      category: 'Y TẾ',
      priority: 'HIGH',
      date: '2026-10-12', 
      displayDate: '12/10/2026', 
      iconColor: 'text-sky-500' 
    },
    { 
      id: 'n-3', 
      title: 'Lễ hội Hóa trang Halloween & Buffet bé yêu', 
      bodyText: 'Chương trình hóa trang các nhân vật cổ tích và tiệc buffet dinh dưỡng với hơn 15 món ăn ngon miệng, hấp dẫn dành riêng cho bé diễn ra vào thứ Sáu cuối tháng.',
      category: 'SỰ KIỆN',
      priority: 'NORMAL',
      date: '2026-10-08', 
      displayDate: '08/10/2026', 
      iconColor: 'text-purple-500' 
    },
    { 
      id: 'n-4', 
      title: 'Thông báo thu học phí & tiền ăn Tháng 10', 
      bodyText: 'Kế toán gửi thông báo biểu phí học tập, tiền ăn và các câu lạc bộ ngoại khóa Tháng 10/2026. Hạn hoàn tất đối soát học phí đến hết ngày 15/10/2026.',
      category: 'TÀI CHÍNH',
      priority: 'NORMAL',
      date: '2026-10-01', 
      displayDate: '01/10/2026', 
      iconColor: 'text-amber-500' 
    },
  ], []);

  const announcements: PreschoolNoticeItemDTO[] = useMemo(() => {
    if (dashboardData?.notices && dashboardData.notices.length > 0) {
      return dashboardData.notices;
    }
    return defaultAnnouncements;
  }, [dashboardData, defaultAnnouncements]);

  return (
    <div className="preschool-ui min-h-screen bg-background p-4 sm:p-6 lg:p-7 space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* ── 1. TOP VIEWPORT HEADER (Search bar + User Tools) ── */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-transparent pb-1">
        {/* Search Bar Input */}
        <div className="relative w-full md:w-[480px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm học sinh, lớp học, giáo viên, ..."
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>

        {/* User Profile & Notification Controls */}
        <div className="flex items-center gap-3.5 self-end md:self-auto relative">
          
          {/* ── Notification Bell with Interactive Popover ── */}
          <div className="relative" ref={notificationRef}>
            <button 
              type="button"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Thông báo"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Thông báo trường học</h3>
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => setUnreadCount(0)}
                      className="text-[11px] font-bold text-[var(--education-brand-ink)] hover:underline cursor-pointer"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-80 overflow-y-auto">
                  <div className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Baby className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Nguyễn Minh Anh đã đến trường</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Đã được điểm danh check-in lúc 07:32 bởi Cô Lan</p>
                      <span className="text-[10px] text-slate-400 block mt-1">10 phút trước</span>
                    </div>
                  </div>

                  <div className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Đóng học phí thành công</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Phụ huynh Lê Hoàng đã đóng học phí Tháng 10 (3.200.000đ)</p>
                      <span className="text-[10px] text-slate-400 block mt-1">1 giờ trước</span>
                    </div>
                  </div>

                  <div className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Cập nhật thực đơn mới</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Lớp Chồi 2 vừa cập nhật thực đơn dinh dưỡng tuần tới</p>
                      <span className="text-[10px] text-slate-400 block mt-1">2 giờ trước</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 text-center border-t border-slate-100 dark:border-slate-800">
                  <Link 
                    href="/dashboard/education/communication" 
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-xs font-extrabold text-[var(--education-brand-ink)] hover:underline inline-flex items-center gap-1"
                  >
                    Xem tất cả thông báo
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Chat Messages Icon (Navigates to Communication) ── */}
          <Link 
            href="/dashboard/education/communication"
            className="p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
            title="Truyền thông & Tin nhắn"
          >
            <MessageSquare className="w-4 h-4" />
          </Link>

          {/* ── User Profile Badge with Interactive Dropdown ── */}
          <div className="relative border-l border-slate-200 dark:border-slate-800 pl-2" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 p-1 rounded-full hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all cursor-pointer group"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-sky-300 dark:border-sky-700 shrink-0 bg-sky-100 group-hover:scale-105 transition-transform">
                <Image
                  src="/images/preschool_banner_kid.png"
                  alt="Nguyễn Thị Lan"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="hidden sm:block text-left">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  Nguyễn Thị Lan
                </h4>
                <p className="text-[11px] font-bold text-[var(--education-brand-ink)]">
                  Quản trị viên
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
                      <Image
                        src="/images/preschool_banner_kid.png"
                        alt="Nguyễn Thị Lan"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        Nguyễn Thị Lan
                      </h4>
                      <p className="text-xs font-bold text-[var(--education-brand-ink)] truncate">
                        Quản trị viên Preschool
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
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value));
                    setIsDatePickerOpen(false);
                  }
                }}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ring font-medium cursor-pointer"
              />

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Đã chọn: <strong className="text-[var(--education-brand-ink)] font-bold">{selectedDate.toLocaleDateString('vi-VN')}</strong></span>
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
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-200/60 dark:border-rose-900 px-2.5 py-0.5 rounded-full lowercase">
                {totalAttentionItems === null ? (loadingDashboard ? 'Đang tải' : 'Chưa có dữ liệu') : `${totalAttentionItems} mục cần chú ý`}
              </span>
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden sm:inline-block">
            {loadingDashboard ? 'Đang tải số liệu' : dashboardData?.commandCenter ? 'Dữ liệu tại lần tải gần nhất' : 'Không tải được số liệu cảnh báo'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Link
            href="/dashboard/education/attendance"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 hover:bg-amber-100/90 dark:hover:bg-amber-900/60 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-amber-950 dark:text-amber-200 truncate">{unmarkedAttendance ?? '—'} trẻ chưa điểm danh</p>
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
              <p className="text-xs font-black text-sky-950 dark:text-sky-200 truncate">{leaveRequests ?? '—'} đơn xin nghỉ học chờ duyệt</p>
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
              <p className="text-xs font-black text-rose-950 dark:text-rose-200 truncate">{overdueInvoices ?? '—'} học phí quá hạn</p>
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
              <p className="text-xs font-black text-red-950 dark:text-red-200 truncate">{healthIncidents ?? '—'} sự cố sức khỏe</p>
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
              <p className="text-xs font-black text-purple-950 dark:text-purple-200 truncate">{parentRequests ?? '—'} yêu cầu phụ huynh</p>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 group-hover:underline">Xem yêu cầu →</span>
            </div>
          </Link>
        </div>
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
              <div>
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
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {kpi.value}
                </h3>
                {kpi.note && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-tight">
                    {kpi.note}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-2xl ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5 inline" />
                {kpi.change}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold truncate">
                {kpi.comparison}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. MIDDLE SECTION (2 COLUMNS / 3 PANELS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Panel 1: Sĩ số học sinh theo lớp (Bar Chart - 6/12 cols) */}
        <div className="lg:col-span-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Sĩ số học sinh theo lớp
            </h3>
            {/* Year Selector */}
            <div className="relative">
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 pr-7 focus:outline-none cursor-pointer"
              >
                <option>Năm học 2026 - 2027</option>
                <option>Năm học 2025 - 2026</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Bar Chart Graphic */}
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
        </div>

        {/* Panel 2: Tỷ lệ độ tuổi (Donut Chart - 3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Tỷ lệ độ tuổi
          </h3>

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
        </div>

        {/* Panel 3: Hoạt động gần đây (Timeline Feed - 3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Hoạt động gần đây
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
        </div>

      </div>

      {/* ── 5. BOTTOM SECTION (3 PANELS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Panel 4: Doanh thu theo tháng (Bar Chart - 5/12 cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Doanh thu theo tháng
            </h3>
            {/* Period Selector */}
            <div className="relative">
              <select
                value={selectedRevenuePeriod}
                onChange={(e) => setSelectedRevenuePeriod(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 pr-7 focus:outline-none cursor-pointer"
              >
                <option>6 tháng gần nhất</option>
                <option>12 tháng qua</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

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
                          <span className="text-xs font-black text-emerald-400 leading-tight">{item.value} triệu VNĐ</span>
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
        </div>

        {/* Panel 5: Thực đơn tuần này (3/12 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Thực đơn tuần này
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

          <div className="space-y-2 pt-1">
            {weeklyMenuDays.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => setIsMenuDrawerOpen(true)}
                className="flex items-center gap-3 text-xs p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title={`Nhấn xem thực đơn ${item.dayLabel}: ${item.summaryDishes}`}
              >
                <span className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs group-hover:scale-105 transition-transform ${item.badgeColor}`}>
                  {item.dayKey}
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate group-hover:text-[var(--education-brand-ink)] transition-colors">
                  {item.summaryDishes}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 6: Thông báo (4/12 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Thông báo
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
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {weeklyMenuData.status === 'PUBLISHED' ? 'Đã ban hành' : 'Dự thảo'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tuần {weeklyMenuData.weekNumber} ({weeklyMenuData.startDate} – {weeklyMenuData.endDate}) • Đảm bảo chuẩn Kcal học đường
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
              {weeklyMenuDays.map((day) => (
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
              ))}
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
