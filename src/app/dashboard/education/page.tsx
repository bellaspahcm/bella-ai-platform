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
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';
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
} from 'lucide-react';

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

  // Close popovers on outside click
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
  const unmarkedAttendance = dashboardData?.commandCenter?.unmarkedAttendanceCount ?? 3;
  const leaveRequests = dashboardData?.commandCenter?.leaveRequestsCount ?? 2;
  const overdueInvoices = dashboardData?.commandCenter?.overdueInvoicesCount ?? 1;
  const healthIncidents = dashboardData?.commandCenter?.healthIncidentsCount ?? 2;
  const parentRequests = dashboardData?.commandCenter?.parentRequestsCount ?? 4;
  const totalAttentionItems = (unmarkedAttendance > 0 ? 1 : 0) +
    (leaveRequests > 0 ? 1 : 0) +
    (overdueInvoices > 0 ? 1 : 0) +
    (healthIncidents > 0 ? 1 : 0) +
    (parentRequests > 0 ? 1 : 0);

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
      label: 'Giáo viên',
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
  const defaultClassHeadcounts = [
    { classId: 'mam-non-1', name: 'Mầm non 1', count: 28, color: '#F472B6' },
    { classId: 'mam-non-2', name: 'Mầm non 2', count: 24, color: '#60A5FA' },
    { classId: 'nha-tre-1', name: 'Nhà trẻ 1', count: 18, color: '#FBBF24' },
    { classId: 'nha-tre-2', name: 'Nhà trẻ 2', count: 16, color: '#34D399' },
    { classId: 'la-1',        name: 'Lá 1',      count: 32, color: '#C084FC' },
    { classId: 'la-2',        name: 'Lá 2',      count: 26, color: '#FB923C' },
    { classId: 'choi-1',      name: 'Chồi 1',    count: 20, color: '#22D3EE' },
    { classId: 'choi-2',      name: 'Chồi 2',    count: 22, color: '#A3E635' },
  ];

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

  // Recent Activities Data
  const recentActivities = [
    {
      id: 1,
      name: 'Nguyễn Minh Anh',
      action: 'Đã đến trường',
      time: '07:32',
      icon: <Baby className="w-4 h-4 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    },
    {
      id: 2,
      name: 'Lớp Lá 1',
      action: 'Hoàn thành hoạt động: Bé trồng cây',
      time: '10:15',
      icon: <Sprout className="w-4 h-4 text-green-600" />,
      iconBg: 'bg-green-100 dark:bg-green-950/60',
    },
    {
      id: 3,
      name: 'Trần Thị Mai',
      action: 'Đã gửi phản hồi cho giáo viên',
      time: '11:20',
      icon: <MessageSquare className="w-4 h-4 text-purple-600" />,
      iconBg: 'bg-purple-100 dark:bg-purple-950/60',
    },
    {
      id: 4,
      name: 'Phụ huynh Lê Hoàng',
      action: 'Đã thanh toán học phí Tháng 10',
      time: '14:08',
      icon: <CreditCard className="w-4 h-4 text-amber-600" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    },
    {
      id: 5,
      name: 'Lớp Chồi 2',
      action: 'Cập nhật thực đơn tuần mới',
      time: '15:30',
      icon: <CalendarDays className="w-4 h-4 text-indigo-600" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/60',
    },
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

  // Weekly Nutrition Menu
  const weeklyMenu = [
    { day: 'T2', color: 'bg-sky-400 text-white', dishes: 'Phở bò, Sữa tươi, Chuối' },
    { day: 'T3', color: 'bg-rose-400 text-white', dishes: 'Cơm gà, Canh rau củ, Sữa chua' },
    { day: 'T4', color: 'bg-emerald-400 text-white', dishes: 'Bún cá, Rau hấp, Dưa hấu' },
    { day: 'T5', color: 'bg-blue-400 text-white', dishes: 'Cơm thịt kho, Canh bí đỏ, Sữa tươi' },
    { day: 'T6', color: 'bg-purple-400 text-white', dishes: 'Mì trứng, Trứng hấp, Thanh long' },
  ];

  // Announcements Data (Synchronized to October 2026 operations)
  const announcements = [
    { id: 1, title: 'Kế hoạch tổ chức Ngày Phụ nữ VN 20/10', date: '15/10/2026', iconColor: 'text-rose-500' },
    { id: 2, title: 'Lịch khám sức khỏe & nha khoa định kỳ HK1', date: '12/10/2026', iconColor: 'text-sky-500' },
    { id: 3, title: 'Lễ hội Hóa trang Halloween & Buffet bé yêu', date: '08/10/2026', iconColor: 'text-purple-500' },
    { id: 4, title: 'Thông báo thu học phí & tiền ăn Tháng 10', date: '01/10/2026', iconColor: 'text-amber-500' },
  ];

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
                {totalAttentionItems} mục cần chú ý
              </span>
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden sm:inline-block">
            Lớp 1: Command Center • Cập nhật realtime
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
              <p className="text-xs font-black text-amber-950 dark:text-amber-200 truncate">{unmarkedAttendance} trẻ chưa điểm danh</p>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 group-hover:underline">Điểm danh ngay →</span>
            </div>
          </Link>

          <Link
            href="/dashboard/education/care"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900/60 hover:bg-sky-100/90 dark:hover:bg-sky-900/60 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-sky-950 dark:text-sky-200 truncate">{leaveRequests} đơn nghỉ chờ duyệt</p>
              <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 group-hover:underline">Duyệt ngay →</span>
            </div>
          </Link>

          <Link
            href="/dashboard/education/finance"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 hover:bg-rose-100/90 dark:hover:bg-rose-900/60 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-rose-950 dark:text-rose-200 truncate">{overdueInvoices} học phí quá hạn</p>
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 group-hover:underline">Gửi nhắc phí →</span>
            </div>
          </Link>

          <Link
            href="/dashboard/education/care"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/60 hover:bg-red-100/90 dark:hover:bg-red-900/60 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Heart className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-red-950 dark:text-red-200 truncate">{healthIncidents} sự cố sức khỏe</p>
              <span className="text-[11px] font-bold text-red-700 dark:text-red-400 group-hover:underline">Theo dõi bé →</span>
            </div>
          </Link>

          <Link
            href="/dashboard/education/communication"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900/60 hover:bg-purple-100/90 dark:hover:bg-purple-900/60 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-purple-950 dark:text-purple-200 truncate">{parentRequests} yêu cầu phụ huynh</p>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 group-hover:underline">Phản hồi →</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 3. ROW OF 5 KPI SUMMARY CARDS (LAYER 2: HEALTH) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiStats.map((kpi) => (
          <div 
            key={kpi.id}
            className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {kpi.label}
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {kpi.value}
                </h3>
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Hoạt động gần đây
            </h3>
            <Link 
              href="/dashboard/education/attendance" 
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start justify-between gap-2 text-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-full shrink-0 ${act.iconBg}`}>
                    {act.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">
                      {act.name}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                      {act.action}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">
                  {act.time}
                </span>
              </div>
            ))}
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
            <Link 
              href="/dashboard/education/care" 
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {weeklyMenu.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-xs">
                <span className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 text-[11px] ${item.color}`}>
                  {item.day}
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                  {item.dishes}
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
              href="/dashboard/education/communication" 
              className="text-xs font-bold text-[var(--education-brand-ink)] hover:underline flex items-center gap-0.5"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {announcements.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Megaphone className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {item.title}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0">
                  {item.date}
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

    </div>
  );
}
