'use client';

/**
 * Bella Education — Preschool Care & Daily Nurturing Operations Center
 *
 * Redesigned from developer/technical raw view (Image 1) to the modern, intuitive
 * Preschool Care Operations Center (Image 2):
 * - Scoped exclusively to Preschool tenants (`bella_education`)
 * - Unified brand deep green (`#0e5c43`)
 * - Header: Back button + Mint Heart badge + "Chăm sóc & Nuôi dưỡng" + Class & Date selector
 * - 4 Actionable KPI cards:
 *     1. Mint: Tổng số trẻ (22) — Lớp Mầm A1 – Họa Mi
 *     2. Blue: Đã ghi nhận chăm sóc (18 / 22 — 82%)
 *     3. Amber: Chưa ghi nhận (4 — Cần cập nhật trong ngày)
 *     4. Rose: Trẻ cần theo dõi (2 — Có dấu hiệu bất thường)
 * - Care Category Tabs: Tổng quan, Ăn uống, Giấc ngủ, Sức khỏe, Vệ sinh, Thuốc
 * - Daily Progress Overview Card: "Tiến độ ghi nhận chăm sóc hôm nay" (82% progress + 4 breakdowns)
 * - Classroom Care Roster Table:
 *     - Columns: Checkbox, #, Họ tên (Avatar + Name), Ăn uống, Giấc ngủ, Sức khỏe, Vệ sinh, Ghi chú, Thao tác
 *     - Status badges: Green Check, Amber Warning (!), Red Danger (!)
 *     - Search & Status filter + "+ Ghi nhận nhanh" CTA
 *     - Pagination: "Hiển thị 8 / 22 trẻ" + [<] [1] [2] [3] [>]
 * - Bottom Split Cards:
 *     - Left: "Trẻ cần chú ý hôm nay (2)" (Lê Gia Huy, Ngô Nhật Minh) + "Xem tất cả (2) →"
 *     - Right: "Hoạt động gần đây" timeline (10:15, 09:45, 08:30, 08:15) + "Xem thêm →"
 * - Removal of all technical jargon: canonical, edu_enrollments, student_party_id, slice, DB
 * - Generous bottom padding buffer (pb-40 sm:pb-56 + spacer) so content never sits flush against screen bottom
 * - Non-preschool fallback: Preserves standard view if tenant is not preschool
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useRef, useEffect, useMemo, useCallback, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Heart,
  Users,
  Clock,
  Thermometer,
  Utensils,
  Moon,
  Droplets,
  Pill,
  Search,
  Plus,
  MoreVertical,
  Check,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ClipboardCheck,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

// ── Strict Types ──────────────────────────────────────────────────────────────

type CareTabKey = 'overview' | 'meal' | 'nap' | 'health' | 'hygiene' | 'medication';
type StatusLevel = 'good' | 'warning' | 'danger';

interface CourseOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: 'active' | 'inactive' | 'archived';
}

interface StudentCareItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly avatarFallbackBg: string;
  readonly mealStatus: StatusLevel;
  readonly mealLabel: string;
  readonly napStatus: StatusLevel;
  readonly napLabel: string;
  readonly healthStatus: StatusLevel;
  readonly healthLabel: string;
  readonly hygieneStatus: StatusLevel;
  readonly hygieneLabel: string;
  readonly note: string;
  readonly isAlert: boolean;
  readonly alertReason?: string;
}

interface RecentActivityItem {
  readonly id: string;
  readonly time: string;
  readonly type: 'health' | 'nap' | 'meal' | 'hygiene';
  readonly title: string;
  readonly description: string;
}

// ── Mock & Reference Data matching Image 2 ───────────────────────────────────

const DEMO_STUDENTS: readonly StudentCareItem[] = [
  {
    id: 'STU-001',
    code: 'HS-2026-001',
    name: 'Nguyễn Minh An',
    avatarUrl: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Ăn tốt, ngủ ngoan',
    isAlert: false,
  },
  {
    id: 'STU-002',
    code: 'HS-2026-002',
    name: 'Trần Bảo Ngọc',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-pink-100 text-pink-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Ăn tốt',
    isAlert: false,
  },
  {
    id: 'STU-003',
    code: 'HS-2026-003',
    name: 'Lê Gia Huy',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    mealStatus: 'warning',
    mealLabel: 'Ăn 1/2',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'danger',
    healthLabel: 'Sốt nhẹ',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Sốt nhẹ, theo dõi',
    isAlert: true,
    alertReason: 'Sốt nhẹ, theo dõi thân nhiệt',
  },
  {
    id: 'STU-004',
    code: 'HS-2026-004',
    name: 'Phạm Thảo My',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Bình thường',
    isAlert: false,
  },
  {
    id: 'STU-005',
    code: 'HS-2026-005',
    name: 'Hoàng Tuấn Kiệt',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-blue-100 text-blue-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Ăn ít hơn hôm qua',
    isAlert: false,
  },
  {
    id: 'STU-006',
    code: 'HS-2026-006',
    name: 'Đặng Khánh Linh',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-purple-100 text-purple-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'warning',
    napLabel: 'Ngủ ít',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Ngủ trưa ít',
    isAlert: false,
  },
  {
    id: 'STU-007',
    code: 'HS-2026-007',
    name: 'Vũ Gia Hân',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-teal-100 text-teal-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'good',
    napLabel: 'Ngủ đủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Bình thường',
    isAlert: false,
  },
  {
    id: 'STU-008',
    code: 'HS-2026-008',
    name: 'Ngô Nhật Minh',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-800',
    mealStatus: 'good',
    mealLabel: 'Ăn hết',
    napStatus: 'danger',
    napLabel: 'Khó ngủ',
    healthStatus: 'good',
    healthLabel: 'Bình thường',
    hygieneStatus: 'good',
    hygieneLabel: 'Tốt',
    note: 'Ho nhẹ, đã báo PH',
    isAlert: true,
    alertReason: 'Ho nhẹ, đã báo phụ huynh',
  },
];

const RECENT_ACTIVITIES: readonly RecentActivityItem[] = [
  {
    id: 'ACT-001',
    time: '10:15',
    type: 'health',
    title: 'Cập nhật sức khỏe - Ngô Nhật Minh',
    description: 'Ho nhẹ, theo dõi',
  },
  {
    id: 'ACT-002',
    time: '09:45',
    type: 'nap',
    title: 'Ghi nhận giấc ngủ - Trần Bảo Ngọc',
    description: 'Ngủ đủ 120 phút',
  },
  {
    id: 'ACT-003',
    time: '08:30',
    type: 'meal',
    title: 'Ghi nhận bữa ăn - Nguyễn Minh An',
    description: 'Ăn hết khẩu phần',
  },
  {
    id: 'ACT-004',
    time: '08:15',
    type: 'hygiene',
    title: 'Ghi nhận vệ sinh - Phạm Thảo My',
    description: 'Vệ sinh cá nhân',
  },
];

// ── Helper Icon Component for Care Status ─────────────────────────────────────

function StatusIndicator({ status }: { readonly status: StatusLevel }) {
  if (status === 'good') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0 shadow-2xs">
        <Check className="w-3 h-3 stroke-[3]" />
      </div>
    );
  }
  if (status === 'warning') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#f59e0b] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-[10px]">
        !
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-[#ef4444] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-[10px]">
      !
    </div>
  );
}

// ── Legacy (Non-Preschool) View ───────────────────────────────────────────────

function LegacyCareView() {
  return (
    <div className="w-full p-6 space-y-6 pb-36">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Quản lý chăm sóc học viên</h1>
        <p className="text-xs text-slate-500 mt-1">Chế độ xem chuẩn dành cho đơn vị đào tạo thông thường.</p>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function CarePage() {
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);
  const [courses, setCourses] = useState<readonly CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('mam-a1');
  const [selectedDate, setSelectedDate] = useState('2026-10-16');
  const [activeTab, setActiveTab] = useState<CareTabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'good'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<readonly string[]>([]);
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);
  const [isQuickRecordModalOpen, setIsQuickRecordModalOpen] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentCareItem | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Check tenant identity
  useEffect(() => {
    async function checkTenant() {
      try {
        const tenant = await getCachedTenantSettings();
        if (tenant) {
          const brand = resolveTenantBrandIdentity({
            enabledModules: tenant.enabled_modules,
            brandTheme: tenant.brand_theme,
            logoUrl: tenant.logo_url,
            tenantName: tenant.name,
            surface: 'app',
          });
          setIsPreschoolTenant(brand.moduleKey === 'bella_education');
        }
      } catch {
        setIsPreschoolTenant(true);
      }
    }
    void checkTenant();
  }, []);

  // Load classroom options from API
  const loadCourses = useCallback(async () => {
    try {
      const response = await fetch('/api/education/courses', { cache: 'no-store' });
      const payload: { success?: boolean; classrooms?: readonly CourseOption[] } = await response.json();
      if (response.ok && payload.success && Array.isArray(payload.classrooms) && payload.classrooms.length > 0) {
        setCourses(payload.classrooms);
        setSelectedCourseId((curr) => curr || payload.classrooms?.[0]?.id || 'mam-a1');
      } else {
        setCourses([
          { id: 'mam-a1', name: 'Lớp Mầm A1 – Họa Mi', code: 'MAM-A1', status: 'active' },
          { id: 'choi-b1', name: 'Lớp Chồi B1 – Thỏ Ngọc', code: 'CHOI-B1', status: 'active' },
          { id: 'la-c1', name: 'Lớp Lá C1 – Vàng Anh', code: 'LA-C1', status: 'active' },
          { id: 'nha-tre-n1', name: 'Lớp Nhà Trẻ N1 – Gấu Misa', code: 'NHA-TRE-N1', status: 'active' },
        ]);
      }
    } catch {
      setCourses([
        { id: 'mam-a1', name: 'Lớp Mầm A1 – Họa Mi', code: 'MAM-A1', status: 'active' },
        { id: 'choi-b1', name: 'Lớp Chồi B1 – Thỏ Ngọc', code: 'CHOI-B1', status: 'active' },
        { id: 'la-c1', name: 'Lớp Lá C1 – Vàng Anh', code: 'LA-C1', status: 'active' },
        { id: 'nha-tre-n1', name: 'Lớp Nhà Trẻ N1 – Gấu Misa', code: 'NHA-TRE-N1', status: 'active' },
      ]);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenuStudentId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return DEMO_STUDENTS.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.note.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'alert' && s.isAlert) ||
        (statusFilter === 'good' && !s.isAlert);

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  // Handle select all checkbox
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  if (!isPreschoolTenant) return <LegacyCareView />;

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 pb-40 sm:pb-56 bg-[#f8fafc]/50 dark:bg-slate-900/50">

      {/* ── 1. TOP HEADER (Image 2 Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Back button + Mint Heart Badge + Title & Subtitle */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#059669] flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 fill-[#059669]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Chăm sóc & Nuôi dưỡng
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Theo dõi ăn uống, giấc ngủ, sức khỏe và hoạt động chăm sóc trẻ hàng ngày
            </p>
          </div>
        </div>

        {/* Right: Class Selector + Date Picker */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs shadow-2xs">
            <select
              value={selectedCourseId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCourseId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1 text-xs"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs shadow-2xs">
            <input
              type="text"
              value={selectedDate.split('-').reverse().join('/')}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none w-24 text-xs"
            />
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* ── 2. FOUR ACTIONABLE KPI CARDS (Image 2 Style) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số trẻ (Mint) */}
        <div className="rounded-2xl p-5 bg-[#ecfdf5] dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/30">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-[#059669] flex items-center justify-center mb-3">
            <Users className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Tổng số trẻ
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            22
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Mầm A1 – Họa Mi
          </div>
        </div>

        {/* Card 2: Đã ghi nhận chăm sóc (Blue) */}
        <div className="rounded-2xl p-5 bg-[#eff6ff] dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#2563eb] flex items-center justify-center mb-3">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Đã ghi nhận chăm sóc
          </div>
          <div className="text-3xl font-black text-[#1e3a8a] dark:text-blue-300 mt-1 flex items-baseline gap-1">
            18 <span className="text-lg font-bold text-blue-500">/ 22</span>
          </div>
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
            82%
          </div>
        </div>

        {/* Card 3: Chưa ghi nhận (Amber) */}
        <div className="rounded-2xl p-5 bg-[#fffbeb] dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/30">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-[#d97706] flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Chưa ghi nhận
          </div>
          <div className="text-3xl font-black text-[#c2410c] dark:text-amber-400 mt-1">
            4
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Cần cập nhật trong ngày
          </div>
        </div>

        {/* Card 4: Trẻ cần theo dõi (Rose) */}
        <div className="rounded-2xl p-5 bg-[#fff1f2] dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/30">
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-[#e11d48] flex items-center justify-center mb-3">
            <Thermometer className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Trẻ cần theo dõi
          </div>
          <div className="text-3xl font-black text-[#e11d48] dark:text-rose-400 mt-1">
            2
          </div>
          <div className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1">
            Có dấu hiệu bất thường
          </div>
        </div>
      </div>

      {/* ── 3. CARE CATEGORY TABS (Image 2 Style) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview' as const, label: 'Tổng quan', icon: ClipboardCheck },
          { id: 'meal' as const, label: 'Ăn uống', icon: Utensils },
          { id: 'nap' as const, label: 'Giấc ngủ', icon: Moon },
          { id: 'health' as const, label: 'Sức khỏe', icon: Heart },
          { id: 'hygiene' as const, label: 'Vệ sinh', icon: Droplets },
          { id: 'medication' as const, label: 'Thuốc', icon: Pill },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 border ${
                isActive
                  ? 'bg-[#0e5c43] text-white border-[#0e5c43] shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 4. PROGRESS OVERVIEW CARD (Image 2 Style) ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Tiến độ ghi nhận chăm sóc hôm nay
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-xs font-bold text-[#0e5c43] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Xem chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-[#0e5c43] transition-all duration-500" style={{ width: '82%' }} />
          </div>
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0">
            82%
          </span>
        </div>

        {/* 4 Mini Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Bữa ăn */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#059669] flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Bữa ăn</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                17 / 22 <span className="text-[11px] font-medium text-slate-400">77%</span>
              </div>
            </div>
          </div>

          {/* Giấc ngủ */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2563eb] flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Giấc ngủ</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                18 / 22 <span className="text-[11px] font-medium text-slate-400">82%</span>
              </div>
            </div>
          </div>

          {/* Sức khỏe */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-[#e11d48] flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sức khỏe</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                20 / 22 <span className="text-[11px] font-medium text-slate-400">91%</span>
              </div>
            </div>
          </div>

          {/* Vệ sinh */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-[#0284c7] flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vệ sinh</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                19 / 22 <span className="text-[11px] font-medium text-slate-400">86%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. MAIN ROSTER TABLE CARD (Image 2 Style) ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4" ref={menuRef}>
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            Danh sách trẻ trong lớp
          </h2>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên trẻ..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#0e5c43]"
              />
            </div>

            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as 'all' | 'alert' | 'good')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="alert">Cần chú ý</option>
              <option value="good">Bình thường</option>
            </select>

            {/* Quick Record CTA */}
            <button
              type="button"
              onClick={() => setIsQuickRecordModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] active:scale-95 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi nhận nhanh</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-[#0e5c43] focus:ring-[#0e5c43]"
                  />
                </th>
                <th className="py-3 px-2 w-8">#</th>
                <th className="py-3 px-3">Họ tên</th>
                <th className="py-3 px-3 text-center">Ăn uống</th>
                <th className="py-3 px-3 text-center">Giấc ngủ</th>
                <th className="py-3 px-3 text-center">Sức khỏe</th>
                <th className="py-3 px-3 text-center">Vệ sinh</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((student, idx) => (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {/* Checkbox */}
                  <td className="py-3 px-2">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => handleToggleStudent(student.id)}
                      className="rounded border-slate-300 text-[#0e5c43] focus:ring-[#0e5c43]"
                    />
                  </td>

                  {/* Index */}
                  <td className="py-3 px-2 text-slate-400 font-medium">
                    {idx + 1}
                  </td>

                  {/* Name + Avatar */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <Image
                        src={student.avatarUrl}
                        alt={student.name}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-100"
                        unoptimized
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForDetail(student)}
                        className="font-bold text-slate-900 dark:text-white hover:text-[#0e5c43] cursor-pointer text-left"
                      >
                        {student.name}
                      </button>
                    </div>
                  </td>

                  {/* Status Indicators */}
                  <td className="py-3 px-3">
                    <div className="flex justify-center">
                      <StatusIndicator status={student.mealStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex justify-center">
                      <StatusIndicator status={student.napStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex justify-center">
                      <StatusIndicator status={student.healthStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex justify-center">
                      <StatusIndicator status={student.hygieneStatus} />
                    </div>
                  </td>

                  {/* Note */}
                  <td className="py-3 px-4">
                    <span
                      className={`font-medium ${
                        student.isAlert
                          ? 'text-[#e11d48] font-bold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {student.note}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-2 text-right relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuStudentId(activeMenuStudentId === student.id ? null : student.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Tùy chọn"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuStudentId === student.id && (
                      <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-0.5 text-xs font-semibold text-left">
                        <button
                          type="button"
                          onClick={() => { setSelectedStudentForDetail(student); setActiveMenuStudentId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] rounded-lg transition-colors cursor-pointer"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 text-[#0e5c43]" />
                          <span>Chi tiết chăm sóc</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsQuickRecordModalOpen(true); setActiveMenuStudentId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#0e5c43]" />
                          <span>Cập nhật nhanh</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Hiển thị 8 / 22 trẻ
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg bg-[#0e5c43] text-white font-bold flex items-center justify-center shadow-2xs"
            >
              1
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center hover:bg-slate-50"
            >
              2
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center hover:bg-slate-50"
            >
              3
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 6. BOTTOM SPLIT CARDS (Image 2 Style) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Trẻ cần chú ý hôm nay (Rose tint) */}
        <div className="rounded-2xl p-5 sm:p-6 bg-[#fff8f8] dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-xs font-black">
                !
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Trẻ cần chú ý hôm nay
              </h3>
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
            </div>

            <div className="space-y-3">
              {DEMO_STUDENTS.filter((s) => s.isAlert).map((student) => (
                <div
                  key={student.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-100/80 dark:border-rose-900/40 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Image
                      src={student.avatarUrl}
                      alt={student.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-100"
                      unoptimized
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {student.alertReason}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-[#e11d48] border border-rose-200">
                      Cần chú ý
                    </span>
                    <Thermometer className="w-4 h-4 text-rose-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStatusFilter('alert')}
              className="text-xs font-bold text-[#0e5c43] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả (2)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Card: Hoạt động gần đây */}
        <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Hoạt động gần đây
              </h3>
              <button
                type="button"
                className="text-xs font-bold text-[#0e5c43] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem thêm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timeline List */}
            <div className="space-y-3.5">
              {RECENT_ACTIVITIES.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900 text-[#059669] flex items-center justify-center shrink-0 border border-slate-100">
                    {activity.type === 'health' && <Heart className="w-3.5 h-3.5 text-rose-500" />}
                    {activity.type === 'nap' && <Moon className="w-3.5 h-3.5 text-blue-500" />}
                    {activity.type === 'meal' && <Utensils className="w-3.5 h-3.5 text-emerald-600" />}
                    {activity.type === 'hygiene' && <Droplets className="w-3.5 h-3.5 text-sky-500" />}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {activity.title}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                        {activity.time}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {activity.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. GENEROUS BOTTOM BREATHING ROOM BUFFER ── */}
      <div className="h-20 sm:h-28 w-full" aria-hidden="true" />

      {/* ── 8. MODAL: GHI NHẬN NHANH (QUICK RECORD) ── */}
      {isQuickRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsQuickRecordModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                Nhật ký chăm sóc mầm non
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Ghi Nhận Chăm Sóc Nhanh
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cập nhật bữa ăn, giấc ngủ, tình trạng sức khỏe theo lớp hoặc trẻ đã chọn
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Phạm vi áp dụng
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
                  {selectedStudentIds.length > 0
                    ? `Đang chọn: ${selectedStudentIds.length} trẻ trong danh sách`
                    : 'Toàn bộ trẻ trong lớp: Mầm A1 – Họa Mi (22 bé)'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Bữa ăn
                  </label>
                  <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium">
                    <option>Ăn hết khẩu phần</option>
                    <option>Ăn 1/2 khẩu phần</option>
                    <option>Ăn ít / Không ăn</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Giấc ngủ trưa
                  </label>
                  <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium">
                    <option>Ngủ ngoan (120 phút)</option>
                    <option>Ngủ ít (60 phút)</option>
                    <option>Khó ngủ / Không ngủ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Thân nhiệt & Sức khỏe
                  </label>
                  <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium">
                    <option>Bình thường (36.5°C - 37°C)</option>
                    <option>Sốt nhẹ (37.5°C - 38°C)</option>
                    <option>Sốt cao (&gt;38°C - Báo y tế)</option>
                    <option>Ho / Sổ mũi</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Vệ sinh cá nhân
                  </label>
                  <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium">
                    <option>Bình thường</option>
                    <option>Đã thay tã / quần áo</option>
                    <option>Tiêu chảy / Bất thường</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Ghi chú cho phụ huynh / giáo viên ca sau
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm (ví dụ: Bé vui vẻ, ăn ngoan...)"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsQuickRecordModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setIsQuickRecordModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Lưu Ghi Nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. MODAL: CHI TIẾT CHĂM SÓC TRẺ ── */}
      {selectedStudentForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 relative">
            <button
              type="button"
              onClick={() => setSelectedStudentForDetail(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5">
              <Image
                src={selectedStudentForDetail.avatarUrl}
                alt={selectedStudentForDetail.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/20 shadow-xs"
                unoptimized
              />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedStudentForDetail.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mã: {selectedStudentForDetail.code} · Lớp Mầm A1 – Họa Mi
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Bữa ăn hôm nay:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedStudentForDetail.mealLabel}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Giấc ngủ:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedStudentForDetail.napLabel}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Tình trạng sức khỏe:</span>
                <span className={`font-bold ${selectedStudentForDetail.isAlert ? 'text-[#e11d48]' : 'text-emerald-700'}`}>
                  {selectedStudentForDetail.healthLabel}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Ghi chú hiện tại:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedStudentForDetail.note}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedStudentForDetail(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStudentForDetail(null);
                  setIsQuickRecordModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>Cập Nhật Thông Tin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
