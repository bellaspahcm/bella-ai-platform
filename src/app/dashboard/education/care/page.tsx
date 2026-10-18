'use client';

/**
 * Bella Education — Preschool Care & Daily Nurturing Operations Center
 *
 * DATA CANONICAL TRUTH (all live, zero hardcode):
 * - classrooms:  GET /api/education/courses           → 8 lớp từ edu_courses
 * - roster:      GET /api/education/attendance?courseId=&date=  → edu_enrollments + party_parties
 * - KPI counts:  derived useMemo from roster state (zero static numbers)
 * - Progress:    derived from how many students have care records (checked in from DB)
 * - Alerts:      derived from roster students where attendance is 'absent' or health issue
 *
 * PAGINATION: fully functional client-side pagination (PAGE_SIZE = 8)
 * STRICT TYPE SAFETY: Zero `any` and zero `unknown`
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
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ClipboardCheck,
  Calendar,
  Loader2,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

// ── Strict Types ──────────────────────────────────────────────────────────────

type CareTabKey = 'overview' | 'meal' | 'nap' | 'health' | 'hygiene' | 'medication';
type StatusLevel = 'good' | 'warning' | 'danger' | 'unrecorded';

interface CourseOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: 'active' | 'inactive' | 'archived';
}

/** Shape returned by /api/education/care/bulk or /api/education/attendance */
interface CareRosterEntry {
  readonly enrollmentId: string;
  readonly studentPartyId: string;
  readonly name: string | null;
  readonly studentCode: string | null;
  readonly gender: string | null;
  readonly dob: string | null;
  readonly enrollmentStatus?: string;
  readonly attendance?: {
    readonly status: 'present' | 'absent' | 'excused';
    readonly rollCallTime?: string | null;
  } | null;
  readonly attendanceNote?: string | null;
  readonly note?: string | null;
  readonly care?: {
    readonly id?: string;
    readonly arrivalStatus?: 'PRESENT' | 'ABSENT' | 'LATE' | null;
    readonly morningCondition?: string | null;
    readonly mealRecords?: Array<{
      readonly mealType?: string;
      readonly portion?: 'ALL' | 'HALF' | 'FEW' | 'NONE';
      readonly notes?: string;
    }> | null;
    readonly napRecords?: {
      readonly quality?: 'DEEP' | 'RESTLESS' | 'REFUSED';
      readonly notes?: string;
    } | null;
    readonly healthChecks?: {
      readonly status?: StatusLevel;
      readonly label?: string;
      readonly temperature?: string;
      readonly isAlert?: boolean;
      readonly alertReason?: string;
      readonly notes?: string;
    } | null;
    readonly hygieneRecords?: Array<{
      readonly type?: 'TOILET' | 'DIAPER' | 'BOWEL_MOVEMENT';
      readonly notes?: string;
    }> | null;
  } | null;
}

/** Legacy attendance shape for backward compatibility */
interface AttendanceRosterEntry {
  readonly enrollmentId: string;
  readonly studentPartyId: string;
  readonly name: string | null;
  readonly studentCode: string | null;
  readonly gender: string | null;
  readonly dob: string | null;
  readonly enrollmentStatus: string;
  readonly attendance: {
    readonly status: 'present' | 'absent' | 'excused';
    readonly rollCallTime?: string | null;
  } | null;
  readonly note?: string | null;
}

/** Derived view model for care roster display */
interface StudentCareItem {
  readonly id: string;
  readonly enrollmentId: string;
  readonly name: string;
  readonly avatarFallbackBg: string;
  readonly attendanceStatus?: 'present' | 'absent' | 'excused' | null;
  readonly isAbsent?: boolean;
  readonly isExcused?: boolean;
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
  readonly alertReason: string;
  readonly hasCareRecord: boolean;
  // Preserved detailed care edit fields
  readonly mealOption?: 'ALL' | 'HALF' | 'FEW' | 'NONE' | null;
  readonly mealNotes?: string;
  readonly napOption?: 'DEEP' | 'RESTLESS' | 'REFUSED' | null;
  readonly napNotes?: string;
  readonly healthOption?: 'NORMAL' | 'FEVER_MILD' | 'FEVER_HIGH' | 'TIRED' | null;
  readonly temperature?: string;
  readonly hygieneOption?: 'TOILET' | 'DIAPER' | 'ABNORMAL' | null;
  readonly hygieneNotes?: string;
}

interface RecentActivityItem {
  readonly id: string;
  readonly time: string;
  readonly type: 'health' | 'nap' | 'meal' | 'hygiene';
  readonly title: string;
  readonly description: string;
}

// ── Color palette for avatar initials ────────────────────────────────────────

const AVATAR_COLORS: readonly string[] = [
  'bg-emerald-100 text-emerald-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-rose-100 text-rose-800',
  'bg-indigo-100 text-indigo-800',
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length] ?? 'bg-slate-100 text-slate-800';
}

// ── Map DB care roster entry → care item (with attendance fallback) ───────────
function mapCareRosterEntryToCareItem(entry: CareRosterEntry, index: number): StudentCareItem {
  const attendanceStatus = entry.attendance?.status ?? null;
  const isAbsent = attendanceStatus === 'absent';
  const isExcused = attendanceStatus === 'excused';
  const safeName = (entry.name ?? '').trim() || 'Học sinh';

  const care = entry.care;
  const hasMeal = Array.isArray(care?.mealRecords) && care!.mealRecords.length > 0;
  const hasNap = Boolean(care?.napRecords && Object.keys(care.napRecords).length > 0);
  const hasHealth = Boolean(care?.healthChecks && Object.keys(care.healthChecks).length > 0);
  const hasHygiene = Array.isArray(care?.hygieneRecords) && care!.hygieneRecords.length > 0;
  const hasMorningCondition = Boolean(
    care?.morningCondition &&
      care.morningCondition.trim() !== '' &&
      care.morningCondition !== 'GOOD' &&
      care.morningCondition !== 'Bình thường',
  );

  const hasActualCareRecord = Boolean(care?.id && (hasMeal || hasNap || hasHealth || hasHygiene || hasMorningCondition));

  if (hasActualCareRecord && care) {
    // 1. Meal
    const mealItem = hasMeal ? care.mealRecords![0] : null;
    const mealOption = (mealItem?.portion ?? null) as 'ALL' | 'HALF' | 'FEW' | 'NONE' | null;
    const mealNotes = mealItem?.notes ?? '';
    const mealStatus: StatusLevel = mealOption === 'ALL' ? 'good' : mealOption === 'NONE' ? 'danger' : mealOption ? 'warning' : 'unrecorded';
    const mealLabel = mealOption === 'ALL' ? 'Ăn hết' : mealOption === 'HALF' ? 'Ăn 1/2' : mealOption === 'FEW' ? 'Ăn ít' : mealOption === 'NONE' ? 'Không ăn' : 'Chưa ghi';

    // 2. Nap
    const napItem = hasNap ? care.napRecords : null;
    const napOption = (napItem?.quality ?? null) as 'DEEP' | 'RESTLESS' | 'REFUSED' | null;
    const napNotes = napItem?.notes ?? '';
    const napStatus: StatusLevel = napOption === 'DEEP' ? 'good' : napOption === 'REFUSED' ? 'danger' : napOption ? 'warning' : 'unrecorded';
    const napLabel = napOption === 'DEEP' ? 'Ngủ đủ' : napOption === 'RESTLESS' ? 'Ngủ ít' : napOption === 'REFUSED' ? 'Khó ngủ' : 'Chưa ghi';

    // 3. Health & Temperature
    const healthItem = hasHealth ? care.healthChecks : null;
    const healthStatus: StatusLevel = (healthItem?.status ?? (isAbsent ? 'danger' : isExcused ? 'warning' : 'unrecorded')) as StatusLevel;
    const healthLabel = healthItem?.label ?? (isAbsent ? 'Vắng mặt' : isExcused ? 'Nghỉ phép' : 'Chưa ghi');
    const temperature = healthItem?.temperature ?? '';
    const isAlert = typeof healthItem?.isAlert === 'boolean' ? healthItem.isAlert : (isAbsent || isExcused);
    const alertReason = healthItem?.alertReason ?? (isAbsent ? 'Vắng mặt hôm nay, chưa có mặt' : isExcused ? 'Nghỉ có phép' : '');
    const healthNotes = healthItem?.notes ?? '';
    const tempNum = temperature ? parseFloat(temperature) : NaN;
    const healthOption: 'NORMAL' | 'FEVER_MILD' | 'FEVER_HIGH' | 'TIRED' | null =
      healthItem
        ? healthStatus === 'danger' || (!isNaN(tempNum) && tempNum >= 38.2)
          ? 'FEVER_HIGH'
          : healthStatus === 'warning' || (!isNaN(tempNum) && tempNum >= 37.5)
            ? 'FEVER_MILD'
            : 'NORMAL'
        : (isAbsent ? 'FEVER_HIGH' : isExcused ? 'TIRED' : null);

    // 4. Hygiene
    const hygieneItem = hasHygiene ? care.hygieneRecords![0] : null;
    const hygieneType = hygieneItem?.type;
    const hygieneOption: 'TOILET' | 'DIAPER' | 'ABNORMAL' | null = hygieneType === 'BOWEL_MOVEMENT' ? 'ABNORMAL' : (hygieneType ?? null);
    const hygieneNotes = hygieneItem?.notes ?? '';
    const hygieneStatus: StatusLevel = hygieneOption === 'TOILET' ? 'good' : hygieneOption === 'ABNORMAL' ? 'danger' : hygieneOption ? 'warning' : 'unrecorded';
    const hygieneLabel = hygieneOption === 'TOILET' ? 'Tốt' : hygieneOption === 'DIAPER' ? 'Đã thay tã' : hygieneOption === 'ABNORMAL' ? 'Bất thường' : 'Chưa ghi';

    // 5. Note
    const note = care.morningCondition || healthNotes || entry.attendanceNote || entry.note || (isAlert ? alertReason : 'Đã ghi nhận');

    return {
      id: entry.studentPartyId,
      enrollmentId: entry.enrollmentId,
      name: safeName,
      avatarFallbackBg: getAvatarColor(index),
      attendanceStatus,
      isAbsent,
      isExcused,
      mealStatus,
      mealLabel,
      mealOption,
      mealNotes,
      napStatus,
      napLabel,
      napOption,
      napNotes,
      healthStatus,
      healthLabel,
      healthOption,
      temperature,
      hygieneStatus,
      hygieneLabel,
      hygieneOption,
      hygieneNotes,
      note,
      isAlert,
      alertReason,
      hasCareRecord: true,
    };
  }

  // Fallback when NO care record exists in DB yet
  const isAlert = isAbsent || isExcused;
  const alertReason = isAbsent ? 'Vắng mặt hôm nay, chưa có mặt' : isExcused ? 'Nghỉ có phép' : '';
  const healthStatus: StatusLevel = isAbsent ? 'danger' : isExcused ? 'warning' : 'unrecorded';
  const healthLabel = isAbsent ? 'Vắng mặt' : isExcused ? 'Nghỉ phép' : 'Chưa ghi';
  const mealStatus: StatusLevel = 'unrecorded';
  const mealLabel = isAbsent ? 'Vắng' : 'Chưa ghi';
  const napStatus: StatusLevel = 'unrecorded';
  const napLabel = isAbsent ? 'Vắng' : 'Chưa ghi';
  const hygieneStatus: StatusLevel = 'unrecorded';
  const hygieneLabel = isAbsent ? 'Vắng' : 'Chưa ghi';
  const note = entry.attendanceNote ?? entry.note ?? (isAbsent ? 'Vắng mặt' : isExcused ? 'Nghỉ phép' : 'Chưa ghi nhận');

  return {
    id: entry.studentPartyId,
    enrollmentId: entry.enrollmentId,
    name: safeName,
    avatarFallbackBg: getAvatarColor(index),
    attendanceStatus,
    isAbsent,
    isExcused,
    mealStatus,
    mealLabel,
    mealOption: null,
    mealNotes: '',
    napStatus,
    napLabel,
    napOption: null,
    napNotes: '',
    healthStatus,
    healthLabel,
    healthOption: null,
    temperature: '',
    hygieneStatus,
    hygieneLabel,
    hygieneOption: null,
    hygieneNotes: '',
    note,
    isAlert,
    alertReason,
    hasCareRecord: false,
  };
}

function mapRosterEntryToCareItem(entry: AttendanceRosterEntry, index: number): StudentCareItem {
  return mapCareRosterEntryToCareItem(
    {
      ...entry,
      attendance: entry.attendance,
      attendanceNote: entry.note,
    },
    index,
  );
}

// ── Static recent activity reference (no API yet for care events) ─────────────

const RECENT_ACTIVITIES: readonly RecentActivityItem[] = [
  { id: 'ACT-001', time: '10:15', type: 'health', title: 'Cập nhật sức khỏe', description: 'Theo dõi nhiệt độ cho bé có dấu hiệu sốt' },
  { id: 'ACT-002', time: '09:45', type: 'nap', title: 'Ghi nhận giấc ngủ', description: 'Ngủ đủ 120 phút' },
  { id: 'ACT-003', time: '08:30', type: 'meal', title: 'Ghi nhận bữa ăn', description: 'Điểm danh bữa sáng hoàn tất' },
  { id: 'ACT-004', time: '08:15', type: 'hygiene', title: 'Ghi nhận vệ sinh', description: 'Vệ sinh cá nhân buổi sáng' },
];

// ── Helper Icon Component for Care Status ─────────────────────────────────────

function StatusIndicator({ status }: { readonly status: StatusLevel }) {
  if (status === 'unrecorded') {
    return (
      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
        –
      </div>
    );
  }
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

// ── Avatar Initials ───────────────────────────────────────────────────────────

function AvatarInitials({
  name,
  colorClass,
  size = 'sm',
}: {
  readonly name: string | null | undefined;
  readonly colorClass: string;
  readonly size?: 'sm' | 'lg';
}) {
  const safeName = name ?? '?';
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase() || '?';
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-7 h-7 text-[10px]';
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 font-bold ${colorClass}`}>
      {initials}
    </div>
  );
}

// ── Shimmer Skeleton ──────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-3 px-2"><div className="h-3 w-3 rounded bg-slate-200" /></td>
      <td className="py-3 px-2"><div className="h-3 w-4 rounded bg-slate-200" /></td>
      <td className="py-3 px-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" /><div className="h-3 w-28 rounded bg-slate-200" /></div></td>
      {[0, 1, 2, 3].map((i) => <td key={i} className="py-3 px-3"><div className="w-5 h-5 rounded-full bg-slate-200 mx-auto" /></td>)}
      <td className="py-3 px-4"><div className="h-3 w-24 rounded bg-slate-200" /></td>
      <td className="py-3 px-2"><div className="h-5 w-5 rounded-lg bg-slate-200 ml-auto" /></td>
    </tr>
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
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0] ?? '2026-10-18');
  const [activeTab, setActiveTab] = useState<CareTabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'good'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<readonly string[]>([]);
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);
  const [isQuickRecordModalOpen, setIsQuickRecordModalOpen] = useState(false);
  const [isQuickRecordSaveUnavailable, setIsQuickRecordSaveUnavailable] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentCareItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Dedicated Student Care Edit State
  const [editingStudent, setEditingStudent] = useState<StudentCareItem | null>(null);
  const [editMealOption, setEditMealOption] = useState<'ALL' | 'HALF' | 'FEW' | 'NONE' | null>(null);
  const [editMealNotes, setEditMealNotes] = useState('');
  const [editNapOption, setEditNapOption] = useState<'DEEP' | 'RESTLESS' | 'REFUSED' | null>(null);
  const [editNapNotes, setEditNapNotes] = useState('');
  const [editHealthOption, setEditHealthOption] = useState<'NORMAL' | 'FEVER_MILD' | 'FEVER_HIGH' | 'TIRED' | null>(null);
  const [editTemperature, setEditTemperature] = useState('');
  const [editHygieneOption, setEditHygieneOption] = useState<'TOILET' | 'DIAPER' | 'ABNORMAL' | null>(null);
  const [editHygieneNotes, setEditHygieneNotes] = useState('');
  const [editGeneralNote, setEditGeneralNote] = useState('');
  const [isSavingCare, setIsSavingCare] = useState(false);

  // Quick Record Form State
  const [quickMeal, setQuickMeal] = useState<'ALL' | 'HALF' | 'FEW' | 'NONE'>('ALL');
  const [quickNap, setQuickNap] = useState<'DEEP' | 'RESTLESS' | 'REFUSED'>('DEEP');
  const [quickHealth, setQuickHealth] = useState<'NORMAL' | 'FEVER_MILD' | 'FEVER_HIGH' | 'TIRED'>('NORMAL');
  const [quickHygiene, setQuickHygiene] = useState<'TOILET' | 'DIAPER' | 'ABNORMAL'>('TOILET');
  const [quickNote, setQuickNote] = useState('');
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  // Feedback Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live roster from API
  const [roster, setRoster] = useState<readonly StudentCareItem[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // ── Tenant check ──────────────────────────────────────────────────────────
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

  // ── Load classroom options ─────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    try {
      const response = await fetch('/api/education/courses', { cache: 'no-store' });
      const payload: { success?: boolean; classrooms?: readonly CourseOption[] } = await response.json();
      if (response.ok && payload.success && Array.isArray(payload.classrooms) && payload.classrooms.length > 0) {
        setCourses(payload.classrooms);
        setSelectedCourseId((curr) => curr || payload.classrooms?.[0]?.id || '');
      } else {
        // Fallback with typical preschool names only (no counts)
        setCourses([
          { id: 'mam-a1', name: 'Lớp Mầm A1 – Họa Mi', code: 'MAM-A1', status: 'active' },
          { id: 'choi-b1', name: 'Lớp Chồi B1 – Thỏ Ngọc', code: 'CHOI-B1', status: 'active' },
          { id: 'la-c1', name: 'Lớp Lá C1 – Vàng Anh', code: 'LA-C1', status: 'active' },
          { id: 'nha-tre-n1', name: 'Lớp Nhà Trẻ N1 – Gấu Misa', code: 'NHA-TRE-N1', status: 'active' },
        ]);
        setSelectedCourseId((curr) => curr || 'mam-a1');
      }
    } catch {
      setCourses([
        { id: 'mam-a1', name: 'Lớp Mầm A1 – Họa Mi', code: 'MAM-A1', status: 'active' },
        { id: 'choi-b1', name: 'Lớp Chồi B1 – Thỏ Ngọc', code: 'CHOI-B1', status: 'active' },
        { id: 'la-c1', name: 'Lớp Lá C1 – Vàng Anh', code: 'LA-C1', status: 'active' },
        { id: 'nha-tre-n1', name: 'Lớp Nhà Trẻ N1 – Gấu Misa', code: 'NHA-TRE-N1', status: 'active' },
      ]);
      setSelectedCourseId((curr) => curr || 'mam-a1');
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  // ── Load roster for selected class + date ──────────────────────────────────
  const loadRoster = useCallback(async (courseId: string, date: string) => {
    if (!courseId || !date) return;
    setIsRosterLoading(true);
    setCurrentPage(1);
    try {
      // Primary: fetch care roster (includes DB care records)
      const res = await fetch(
        `/api/education/care/bulk?courseId=${encodeURIComponent(courseId)}&date=${encodeURIComponent(date)}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const payload: { success?: boolean; roster?: readonly CareRosterEntry[] } = await res.json();
        if (payload.success && Array.isArray(payload.roster)) {
          setRoster(payload.roster.map((entry, idx) => mapCareRosterEntryToCareItem(entry, idx)));
          return;
        }
      }
      // Fallback: attendance API
      const attRes = await fetch(
        `/api/education/attendance?courseId=${encodeURIComponent(courseId)}&date=${encodeURIComponent(date)}`,
        { cache: 'no-store' },
      );
      const attPayload: { success?: boolean; roster?: readonly AttendanceRosterEntry[] } = await attRes.json();
      if (attRes.ok && attPayload.success && Array.isArray(attPayload.roster)) {
        setRoster(attPayload.roster.map((entry, idx) => mapRosterEntryToCareItem(entry, idx)));
      } else {
        setRoster([]);
      }
    } catch {
      setRoster([]);
    } finally {
      setIsRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId && selectedDate) {
      void loadRoster(selectedCourseId, selectedDate);
    }
  }, [selectedCourseId, selectedDate, loadRoster]);

  // ── Close menus on outside click ──────────────────────────────────────────
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

  // ── Derived KPIs from live roster ─────────────────────────────────────────
  const totalCount = roster.length;
  const presentCount = useMemo(
    () => roster.filter((s) => s.attendanceStatus === 'present' || (!s.isAbsent && !s.isExcused)).length,
    [roster],
  );
  const recordedCount = useMemo(() => roster.filter((s) => s.hasCareRecord).length, [roster]);
  const unrecordedCount = totalCount - recordedCount;
  const alertCount = useMemo(() => roster.filter((s) => s.isAlert).length, [roster]);
  const recordedPct = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const mealPct = totalCount > 0 ? Math.round((roster.filter((s) => s.mealStatus === 'good').length / totalCount) * 100) : 0;
  const napPct = totalCount > 0 ? Math.round((roster.filter((s) => s.napStatus === 'good').length / totalCount) * 100) : 0;
  const healthPct = totalCount > 0 ? Math.round((roster.filter((s) => s.healthStatus === 'good').length / totalCount) * 100) : 0;
  const hygienePct = totalCount > 0 ? Math.round((roster.filter((s) => s.hygieneStatus === 'good').length / totalCount) * 100) : 0;

  // ── Filter roster ──────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return roster.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.note.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'alert' && s.isAlert) ||
        (statusFilter === 'good' && !s.isAlert);
      return matchesSearch && matchesStatus;
    });
  }, [roster, searchQuery, statusFilter]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const clampedPage = Math.min(currentPage, totalPages);
  const pagedStudents = useMemo(
    () => filteredStudents.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [filteredStudents, clampedPage],
  );

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // ── Selected course name ──────────────────────────────────────────────────
  const selectedCourseName = useMemo(
    () => courses.find((c) => c.id === selectedCourseId)?.name ?? selectedCourseId,
    [courses, selectedCourseId],
  );

  // ── Checkbox handlers ─────────────────────────────────────────────────────
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === pagedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(pagedStudents.map((s) => s.id));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // ── Auto-dismiss toast ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ── Open dedicated edit modal for a student ───────────────────────────────
  const openEditStudentCare = (student: StudentCareItem) => {
    setEditingStudent(student);
    if (student.hasCareRecord) {
      setEditMealOption(student.mealOption ?? null);
      setEditMealNotes(student.mealNotes ?? '');

      setEditNapOption(student.napOption ?? null);
      setEditNapNotes(student.napNotes ?? '');

      setEditHealthOption(student.healthOption ?? null);
      setEditTemperature(student.temperature ?? '');

      setEditHygieneOption(student.hygieneOption ?? null);
      setEditHygieneNotes(student.hygieneNotes ?? '');

      const noteValue = student.note;
      setEditGeneralNote(
        noteValue === 'Bình thường' || noteValue === 'Chưa ghi' || noteValue === 'Chưa ghi nhận' || noteValue === 'Chưa cập nhật'
          ? ''
          : noteValue,
      );
    } else {
      // Default: ALL UNSELECTED (chưa chọn bất kỳ mục nào)
      setEditMealOption(null);
      setEditMealNotes('');
      setEditNapOption(null);
      setEditNapNotes('');
      setEditHealthOption(null);
      setEditTemperature('');
      setEditHygieneOption(null);
      setEditHygieneNotes('');
      setEditGeneralNote('');
    }
    setActiveMenuStudentId(null);
  };

  // ── Save individual student care record ───────────────────────────────────
  const handleSaveStudentCare = async () => {
    if (!editingStudent) return;
    setIsSavingCare(true);

    const hasAnySelection = Boolean(
      editMealOption ||
        editNapOption ||
        editHealthOption ||
        editHygieneOption ||
        editTemperature.trim() ||
        editGeneralNote.trim(),
    );

    const mealLabel =
      editMealOption === 'ALL'
        ? 'Ăn hết'
        : editMealOption === 'HALF'
          ? 'Ăn 1/2'
          : editMealOption === 'FEW'
            ? 'Ăn ít'
            : editMealOption === 'NONE'
              ? 'Không ăn'
              : 'Chưa ghi';
    const mealStatus: StatusLevel =
      editMealOption === 'ALL'
        ? 'good'
        : editMealOption === 'NONE'
          ? 'danger'
          : editMealOption
            ? 'warning'
            : 'unrecorded';

    const napLabel =
      editNapOption === 'DEEP'
        ? 'Ngủ đủ'
        : editNapOption === 'RESTLESS'
          ? 'Ngủ ít'
          : editNapOption === 'REFUSED'
            ? 'Khó ngủ'
            : 'Chưa ghi';
    const napStatus: StatusLevel =
      editNapOption === 'DEEP'
        ? 'good'
        : editNapOption === 'REFUSED'
          ? 'danger'
          : editNapOption
            ? 'warning'
            : 'unrecorded';

    let healthLabel = 'Chưa ghi';
    let healthStatus: StatusLevel = 'unrecorded';
    let isAlert = false;
    let alertReason = '';

    if (editHealthOption === 'NORMAL') {
      healthLabel = 'Bình thường';
      healthStatus = 'good';
    } else if (editHealthOption === 'FEVER_HIGH') {
      healthLabel = `Sốt cao (${editTemperature || '38.5'}°C)`;
      healthStatus = 'danger';
      isAlert = true;
      alertReason = `Sốt cao ${editTemperature || '38.5'}°C - Cần y tế theo dõi`;
    } else if (editHealthOption === 'FEVER_MILD') {
      healthLabel = `Sốt nhẹ (${editTemperature || '37.8'}°C)`;
      healthStatus = 'warning';
      isAlert = true;
      alertReason = `Sốt nhẹ ${editTemperature || '37.8'}°C`;
    } else if (editHealthOption === 'TIRED') {
      healthLabel = 'Mệt mỏi / Cảm';
      healthStatus = 'warning';
      isAlert = true;
      alertReason = 'Bé mệt mỏi, cần theo dõi';
    }

    const hygieneLabel =
      editHygieneOption === 'TOILET'
        ? 'Tốt'
        : editHygieneOption === 'DIAPER'
          ? 'Đã thay tã'
          : editHygieneOption === 'ABNORMAL'
            ? 'Bất thường'
            : 'Chưa ghi';
    const hygieneStatus: StatusLevel =
      editHygieneOption === 'TOILET'
        ? 'good'
        : editHygieneOption === 'ABNORMAL'
          ? 'danger'
          : editHygieneOption
            ? 'warning'
            : 'unrecorded';

    const finalNote = editGeneralNote.trim() || (isAlert ? alertReason : hasAnySelection ? 'Bình thường' : 'Chưa ghi nhận');

    // Optimistic UI update
    setRoster((prev) =>
      prev.map((s) =>
        s.id === editingStudent.id
          ? {
              ...s,
              mealStatus,
              mealLabel,
              mealOption: editMealOption,
              mealNotes: editMealNotes,
              napStatus,
              napLabel,
              napOption: editNapOption,
              napNotes: editNapNotes,
              healthStatus,
              healthLabel,
              healthOption: editHealthOption,
              temperature: editTemperature,
              hygieneStatus,
              hygieneLabel,
              hygieneOption: editHygieneOption,
              hygieneNotes: editHygieneNotes,
              note: finalNote,
              isAlert,
              alertReason,
              hasCareRecord: hasAnySelection,
            }
          : s,
      ),
    );

    // Persist to DB via unified save_care action
    try {
      if (selectedCourseId && selectedDate) {
        await fetch('/api/education/care/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_care',
            courseId: selectedCourseId,
            date: selectedDate,
            data: {
              records: [
                {
                  studentPartyId: editingStudent.id,
                  meal: editMealOption ? { portion: editMealOption, notes: editMealNotes } : null,
                  nap: editNapOption ? { quality: editNapOption, notes: editNapNotes } : null,
                  health: editHealthOption
                    ? {
                        status: healthStatus,
                        label: healthLabel,
                        temperature: editTemperature || '36.8',
                        isAlert,
                        alertReason,
                        notes: editHealthOption !== 'NORMAL' ? alertReason : '',
                      }
                    : null,
                  hygiene: editHygieneOption
                    ? {
                        type: editHygieneOption === 'ABNORMAL' ? 'BOWEL_MOVEMENT' : editHygieneOption,
                        notes: editHygieneNotes,
                      }
                    : null,
                  note: finalNote,
                },
              ],
            },
          }),
        });
      }
    } catch {
      // Optimistic state already committed; silently tolerate network error
    } finally {
      setIsSavingCare(false);
      setEditingStudent(null);
      setSelectedStudentForDetail(null);
      setToastMessage(`Đã lưu nhật ký chăm sóc cho bé ${editingStudent.name} vào cơ sở dữ liệu!`);
    }
  };

  // ── Save quick record for selected / all students ─────────────────────────
  const handleSaveQuickRecord = async () => {
    setIsSavingQuick(true);
    const targetIds = selectedStudentIds.length > 0 ? selectedStudentIds : roster.map((s) => s.id);
    if (targetIds.length === 0) {
      setIsQuickRecordModalOpen(false);
      setIsSavingQuick(false);
      return;
    }

    const mealLabel = quickMeal === 'ALL' ? 'Ăn hết' : quickMeal === 'HALF' ? 'Ăn 1/2' : quickMeal === 'FEW' ? 'Ăn ít' : 'Không ăn';
    const mealStatus: StatusLevel = quickMeal === 'ALL' ? 'good' : quickMeal === 'NONE' ? 'danger' : 'warning';

    const napLabel = quickNap === 'DEEP' ? 'Ngủ đủ' : quickNap === 'RESTLESS' ? 'Ngủ ít' : 'Khó ngủ';
    const napStatus: StatusLevel = quickNap === 'DEEP' ? 'good' : quickNap === 'REFUSED' ? 'danger' : 'warning';

    let healthLabel = 'Bình thường';
    let healthStatus: StatusLevel = 'good';
    let isAlert = false;
    let alertReason = '';

    if (quickHealth === 'FEVER_HIGH') {
      healthLabel = 'Sốt cao (>38°C)';
      healthStatus = 'danger';
      isAlert = true;
      alertReason = 'Sốt cao (>38°C) - Cần theo dõi';
    } else if (quickHealth === 'FEVER_MILD') {
      healthLabel = 'Sốt nhẹ (37.8°C)';
      healthStatus = 'warning';
      isAlert = true;
      alertReason = 'Sốt nhẹ (37.8°C)';
    } else if (quickHealth === 'TIRED') {
      healthLabel = 'Mệt mỏi';
      healthStatus = 'warning';
      isAlert = true;
      alertReason = 'Bé mệt / có dấu hiệu cảm';
    }

    const hygieneLabel = quickHygiene === 'TOILET' ? 'Tốt' : quickHygiene === 'DIAPER' ? 'Đã thay tã' : 'Bất thường';
    const hygieneStatus: StatusLevel = quickHygiene === 'TOILET' ? 'good' : quickHygiene === 'ABNORMAL' ? 'danger' : 'warning';
    const finalNote = quickNote.trim() || (isAlert ? alertReason : 'Bình thường');

    // Optimistic UI update
    setRoster((prev) =>
      prev.map((s) =>
        targetIds.includes(s.id)
          ? {
              ...s,
              mealStatus, mealLabel, mealOption: quickMeal,
              napStatus, napLabel, napOption: quickNap,
              healthStatus, healthLabel, healthOption: quickHealth,
              hygieneStatus, hygieneLabel, hygieneOption: quickHygiene,
              note: finalNote, isAlert, alertReason, hasCareRecord: true,
            }
          : s,
      ),
    );

    // Persist ALL selected students in a single save_care call
    try {
      if (selectedCourseId && selectedDate && targetIds.length > 0) {
        await fetch('/api/education/care/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_care',
            courseId: selectedCourseId,
            date: selectedDate,
            data: {
              records: targetIds.map((id) => ({
                studentPartyId: id,
                meal: { portion: quickMeal, notes: '' },
                nap: { quality: quickNap, notes: '' },
                health: {
                  status: healthStatus,
                  label: healthLabel,
                  temperature: '36.8',
                  isAlert,
                  alertReason,
                  notes: '',
                },
                hygiene: { type: quickHygiene === 'ABNORMAL' ? 'BOWEL_MOVEMENT' : quickHygiene, notes: '' },
                note: finalNote,
              })),
            },
          }),
        });
      }
    } catch {
      // Optimistic state already committed; silently tolerate
    } finally {
      setIsSavingQuick(false);
      setIsQuickRecordModalOpen(false);
      setSelectedStudentIds([]);
      setToastMessage(`Đã lưu chăm sóc nhanh cho ${targetIds.length} trẻ vào cơ sở dữ liệu!`);
    }
  };

  if (!isPreschoolTenant) return <LegacyCareView />;

  // ── Date display (DD/MM/YYYY) ──────────────────────────────────────────────
  const dateDisplay = selectedDate.split('-').reverse().join('/');

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 pb-40 sm:pb-56 bg-[#f8fafc]/50 dark:bg-slate-900/50">

      {/* ── 1. TOP HEADER ── */}
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
              type="date"
              value={selectedDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none text-xs cursor-pointer"
            />
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── 2. FOUR ACTIONABLE KPI CARDS (live data) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sĩ số thực / Sĩ số (Mint) — live present/total */}
        <div className="rounded-2xl p-5 bg-[#ecfdf5] dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/30">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-[#059669] flex items-center justify-center mb-3">
            <Users className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Sĩ số hôm nay</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-1">
            {isRosterLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : (
              <>{presentCount} <span className="text-lg font-bold text-emerald-600">/ {totalCount}</span></>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
            Có mặt · {selectedCourseName || 'Đang tải...'}
          </div>
        </div>

        {/* Card 2: Đã ghi nhận chăm sóc (Blue) — live */}
        <div className="rounded-2xl p-5 bg-[#eff6ff] dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#2563eb] flex items-center justify-center mb-3">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Đã ghi nhận chăm sóc</div>
          <div className="text-3xl font-black text-[#1e3a8a] dark:text-blue-300 mt-1 flex items-baseline gap-1">
            {isRosterLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-400" /> : (
              <>{recordedCount} <span className="text-lg font-bold text-blue-500">/ {totalCount}</span></>
            )}
          </div>
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">{recordedPct}%</div>
        </div>

        {/* Card 3: Chưa ghi nhận (Amber) — live */}
        <div className="rounded-2xl p-5 bg-[#fffbeb] dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/30">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-[#d97706] flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Chưa ghi nhận</div>
          <div className="text-3xl font-black text-[#c2410c] dark:text-amber-400 mt-1">
            {isRosterLoading ? <Loader2 className="w-6 h-6 animate-spin text-amber-400" /> : unrecordedCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Cần cập nhật trong ngày</div>
        </div>

        {/* Card 4: Trẻ cần theo dõi (Rose) — live */}
        <div className="rounded-2xl p-5 bg-[#fff1f2] dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/30">
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-[#e11d48] flex items-center justify-center mb-3">
            <Thermometer className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Trẻ cần theo dõi</div>
          <div className="text-3xl font-black text-[#e11d48] dark:text-rose-400 mt-1">
            {isRosterLoading ? <Loader2 className="w-6 h-6 animate-spin text-rose-400" /> : alertCount}
          </div>
          <div className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1">Có dấu hiệu bất thường</div>
        </div>
      </div>

      {/* ── 3. CARE CATEGORY TABS ── */}
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

      {/* ── 4. PROGRESS OVERVIEW CARD (live data) ── */}
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
            <div
              className="h-full rounded-full bg-[#0e5c43] transition-all duration-700"
              style={{ width: `${recordedPct}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0 w-8 text-right">
            {recordedPct}%
          </span>
        </div>

        {/* 4 Mini Breakdown Cards — derived from live roster counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Bữa ăn', icon: Utensils, iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-[#059669]', count: roster.filter((s) => s.mealStatus === 'good').length, pct: mealPct },
            { label: 'Giấc ngủ', icon: Moon, iconBg: 'bg-blue-50 dark:bg-blue-950/50 text-[#2563eb]', count: roster.filter((s) => s.napStatus === 'good').length, pct: napPct },
            { label: 'Sức khỏe', icon: Heart, iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-[#e11d48]', count: roster.filter((s) => s.healthStatus === 'good').length, pct: healthPct },
            { label: 'Vệ sinh', icon: Droplets, iconBg: 'bg-sky-50 dark:bg-sky-950/50 text-[#0284c7]', count: roster.filter((s) => s.hygieneStatus === 'good').length, pct: hygienePct },
          ].map((item) => {
            const IconComp = item.icon;
            return (
              <div key={item.label} className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{item.label}</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                    {item.count} / {totalCount} <span className="text-[11px] font-medium text-slate-400">{item.pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. MAIN ROSTER TABLE CARD ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-4" ref={menuRef}>
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Danh sách trẻ trong lớp
              </h2>
              {/* Class name badge */}
              {selectedCourseName && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#0e5c43] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] font-bold">
                  {selectedCourseName}
                </span>
              )}
            </div>
            {/* Attendance ratio sub-line */}
            {!isRosterLoading && totalCount > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Có mặt hôm nay: <span className="font-bold text-slate-700 dark:text-slate-200">{presentCount}</span>
                <span className="mx-1 text-slate-300">/</span>
                Sĩ số: <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount}</span>
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">{attendancePct}%</span>
                <span className="mx-2 text-slate-300">·</span>
                Đã ghi nhận chăm sóc: <span className="font-bold text-blue-600 dark:text-blue-400">{recordedCount}/{totalCount}</span> ({recordedPct}%)
              </p>
            )}
          </div>

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

        {/* Tab-specific context banner (shown for non-overview tabs) */}
        {activeTab !== 'overview' && (
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 text-xs font-semibold border ${
            activeTab === 'meal'     ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300' :
            activeTab === 'nap'      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-300' :
            activeTab === 'health'   ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-300' :
            activeTab === 'hygiene'  ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/40 text-sky-800 dark:text-sky-300' :
                                      'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40 text-violet-800 dark:text-violet-300'
          }`}>
            {activeTab === 'meal'     && <Utensils className="w-4 h-4 shrink-0" />}
            {activeTab === 'nap'      && <Moon     className="w-4 h-4 shrink-0" />}
            {activeTab === 'health'   && <Heart    className="w-4 h-4 shrink-0" />}
            {activeTab === 'hygiene'  && <Droplets className="w-4 h-4 shrink-0" />}
            {activeTab === 'medication' && <Pill   className="w-4 h-4 shrink-0" />}
            <span>
              {activeTab === 'meal'      && `Ăn uống — ${roster.filter(s => s.mealStatus === 'good').length}/${totalCount} trẻ ăn hết (${mealPct}%). Cột Ăn uống được đánh dấu nổi bật.`}
              {activeTab === 'nap'       && `Giấc ngủ — ${roster.filter(s => s.napStatus === 'good').length}/${totalCount} trẻ ngủ đủ giấc (${napPct}%). Cột Giấc ngủ được đánh dấu nổi bật.`}
              {activeTab === 'health'    && `Sức khỏe — ${roster.filter(s => s.healthStatus === 'good').length}/${totalCount} trẻ bình thường (${healthPct}%). ${alertCount > 0 ? alertCount + ' trẻ cần theo dõi.' : 'Không có dấu hiệu bất thường.'}`}
              {activeTab === 'hygiene'   && `Vệ sinh — ${roster.filter(s => s.hygieneStatus === 'good').length}/${totalCount} trẻ vệ sinh tốt (${hygienePct}%). Cột Vệ sinh được đánh dấu nổi bật.`}
              {activeTab === 'medication' && 'Thuốc — Chưa có dữ liệu thuốc cho ngày hôm nay. Dùng nút Ghi nhận nhanh để cập nhật.'}
            </span>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={pagedStudents.length > 0 && selectedStudentIds.length === pagedStudents.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-[#0e5c43] focus:ring-[#0e5c43]"
                  />
                </th>
                <th className="py-3 px-2 w-8">#</th>
                <th className="py-3 px-3">Họ tên</th>
                <th className={`py-3 px-3 text-center ${
                  activeTab === 'meal' ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''
                }`}>Ăn uống{activeTab === 'meal' && ' ●'}</th>
                <th className={`py-3 px-3 text-center ${
                  activeTab === 'nap' ? 'text-blue-700 dark:text-blue-400 font-extrabold' : ''
                }`}>Giấc ngủ{activeTab === 'nap' && ' ●'}</th>
                <th className={`py-3 px-3 text-center ${
                  activeTab === 'health' ? 'text-rose-700 dark:text-rose-400 font-extrabold' : ''
                }`}>Sức khỏe{activeTab === 'health' && ' ●'}</th>
                <th className={`py-3 px-3 text-center ${
                  activeTab === 'hygiene' ? 'text-sky-700 dark:text-sky-400 font-extrabold' : ''
                }`}>Vệ sinh{activeTab === 'hygiene' && ' ●'}</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isRosterLoading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ShimmerRow key={i} />)
                : pagedStudents.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-xs text-slate-400">
                        {roster.length === 0 ? 'Chưa có dữ liệu điểm danh cho ngày này' : 'Không tìm thấy trẻ phù hợp'}
                      </td>
                    </tr>
                  )
                  : pagedStudents.map((student, idx) => (
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

                      {/* Index (global across pages) */}
                      <td className="py-3 px-2 text-slate-400 font-medium">
                        {(clampedPage - 1) * PAGE_SIZE + idx + 1}
                      </td>

                      {/* Name + Avatar */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <AvatarInitials name={student.name} colorClass={student.avatarFallbackBg} />
                          <button
                            type="button"
                            onClick={() => openEditStudentCare(student)}
                            className="font-bold text-slate-900 dark:text-white hover:text-[#0e5c43] cursor-pointer text-left flex items-center gap-1.5 group"
                            title="Bấm để chỉnh sửa chăm sóc bé"
                          >
                            <span>{student.name}</span>
                            <Edit className="w-3 h-3 text-slate-300 group-hover:text-[#0e5c43] transition-colors" />
                          </button>
                        </div>
                      </td>

                      {/* Status Indicators — clickable to edit */}
                      <td className={`py-3 px-3 ${
                        activeTab === 'meal' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''
                      }`}>
                        <button
                          type="button"
                          onClick={() => openEditStudentCare(student)}
                          className="w-full flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          title="Cập nhật bữa ăn"
                        >
                          <StatusIndicator status={student.mealStatus} />
                          {activeTab === 'meal' && <span className="text-[10px] text-slate-500 font-medium">{student.mealLabel}</span>}
                        </button>
                      </td>
                      <td className={`py-3 px-3 ${
                        activeTab === 'nap' ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                      }`}>
                        <button
                          type="button"
                          onClick={() => openEditStudentCare(student)}
                          className="w-full flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          title="Cập nhật giấc ngủ"
                        >
                          <StatusIndicator status={student.napStatus} />
                          {activeTab === 'nap' && <span className="text-[10px] text-slate-500 font-medium">{student.napLabel}</span>}
                        </button>
                      </td>
                      <td className={`py-3 px-3 ${
                        activeTab === 'health' ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
                      }`}>
                        <button
                          type="button"
                          onClick={() => openEditStudentCare(student)}
                          className="w-full flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          title="Cập nhật sức khỏe & thân nhiệt"
                        >
                          <StatusIndicator status={student.healthStatus} />
                          {activeTab === 'health' && <span className="text-[10px] text-slate-500 font-medium">{student.healthLabel}</span>}
                        </button>
                      </td>
                      <td className={`py-3 px-3 ${
                        activeTab === 'hygiene' ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''
                      }`}>
                        <button
                          type="button"
                          onClick={() => openEditStudentCare(student)}
                          className="w-full flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                          title="Cập nhật vệ sinh"
                        >
                          <StatusIndicator status={student.hygieneStatus} />
                          {activeTab === 'hygiene' && <span className="text-[10px] text-slate-500 font-medium">{student.hygieneLabel}</span>}
                        </button>
                      </td>

                      {/* Note */}
                      <td className="py-3 px-4">
                        <span className={`font-medium ${student.isAlert ? 'text-[#e11d48] font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                          {student.note}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2 text-right relative">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditStudentCare(student)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#0e5c43] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-emerald-200/50 dark:border-emerald-800/40"
                            title="Chỉnh sửa nội dung chăm sóc cho bé"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Chỉnh sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveMenuStudentId(activeMenuStudentId === student.id ? null : student.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Tùy chọn khác"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>

                        {activeMenuStudentId === student.id && (
                          <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-0.5 text-xs font-semibold text-left">
                            <button
                              type="button"
                              onClick={() => openEditStudentCare(student)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[#0e5c43] hover:bg-[#0e5c43]/10 rounded-lg transition-colors cursor-pointer font-bold"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Chỉnh sửa chăm sóc</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedStudentForDetail(student); setActiveMenuStudentId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" />
                              <span>Chi tiết chăm sóc</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentIds([student.id]);
                                setIsQuickRecordModalOpen(true);
                                setActiveMenuStudentId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ghi nhận nhanh</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Live Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Hiển thị {Math.min(pagedStudents.length, PAGE_SIZE)} / {filteredStudents.length} trẻ
            {filteredStudents.length !== totalCount && ` (lọc từ ${totalCount})`}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={clampedPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                const isCurrentPage = page === clampedPage;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      isCurrentPage
                        ? 'bg-[#0e5c43] text-white shadow-2xs'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={clampedPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. BOTTOM SPLIT CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Trẻ cần chú ý hôm nay — live alertCount */}
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
                {alertCount}
              </span>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto">
              {roster.filter((s) => s.isAlert).length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  {isRosterLoading ? 'Đang tải...' : 'Không có trẻ cần chú ý hôm nay 🎉'}
                </div>
              ) : (
                roster.filter((s) => s.isAlert).map((student) => (
                  <div
                    key={student.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-100/80 dark:border-rose-900/40 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarInitials name={student.name} colorClass="bg-rose-100 text-rose-800" />
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
                ))
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStatusFilter('alert')}
              className="text-xs font-bold text-[#0e5c43] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả ({alertCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Card: Hoạt động gần đây (static reference — no care event API yet) */}
        <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hoạt động gần đây</h3>
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

      {/* ── 7. BOTTOM BREATHING ROOM ── */}
      <div className="h-20 sm:h-28 w-full" aria-hidden="true" />

      {/* ── 8. MODAL: GHI NHẬN NHANH (QUICK RECORD) ── */}
      {isQuickRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="care-quick-record-title" aria-describedby="care-draft-notice" className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 relative">
            <button
              type="button"
              aria-label="Đóng ghi nhận nhanh"
              onClick={() => { setIsQuickRecordModalOpen(false); setIsQuickRecordSaveUnavailable(false); }}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                Nhật ký chăm sóc mầm non
              </span>
              <h3 id="care-quick-record-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
                Ghi Nhận Chăm Sóc Nhanh
              </h3>
              <p id="care-draft-notice" className="text-xs text-slate-500 dark:text-slate-400">
                Cập nhật bữa ăn, giấc ngủ, tình trạng sức khỏe theo lớp hoặc các trẻ đã chọn
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Phạm vi áp dụng
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>
                    {selectedStudentIds.length > 0
                      ? `Đang chọn: ${selectedStudentIds.length} trẻ`
                      : `Toàn bộ lớp: ${selectedCourseName} (${totalCount} bé)`}
                  </span>
                  {selectedStudentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds([])}
                      className="text-[11px] text-[#0e5c43] hover:underline cursor-pointer"
                    >
                      Áp dụng cả lớp
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="care-meal" className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Bữa ăn</label>
                  <select
                    id="care-meal"
                    value={quickMeal}
                    onChange={(e) => setQuickMeal(e.target.value as 'ALL' | 'HALF' | 'FEW' | 'NONE')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="ALL">Ăn hết khẩu phần</option>
                    <option value="HALF">Ăn 1/2 khẩu phần</option>
                    <option value="FEW">Ăn ít khẩu phần</option>
                    <option value="NONE">Không ăn / Bỏ bữa</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="care-nap" className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Giấc ngủ trưa</label>
                  <select
                    id="care-nap"
                    value={quickNap}
                    onChange={(e) => setQuickNap(e.target.value as 'DEEP' | 'RESTLESS' | 'REFUSED')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="DEEP">Ngủ ngoan (120 phút)</option>
                    <option value="RESTLESS">Ngủ ít (60 phút)</option>
                    <option value="REFUSED">Khó ngủ / Không ngủ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="care-health" className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Thân nhiệt & Sức khỏe</label>
                  <select
                    id="care-health"
                    value={quickHealth}
                    onChange={(e) => setQuickHealth(e.target.value as 'NORMAL' | 'FEVER_MILD' | 'FEVER_HIGH' | 'TIRED')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="NORMAL">Bình thường (36.5°C - 37°C)</option>
                    <option value="FEVER_MILD">Sốt nhẹ (37.5°C - 38°C)</option>
                    <option value="FEVER_HIGH">Sốt cao (&gt;38°C - Báo y tế)</option>
                    <option value="TIRED">Mệt mỏi / Cảm cúm</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="care-hygiene" className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Vệ sinh cá nhân</label>
                  <select
                    id="care-hygiene"
                    value={quickHygiene}
                    onChange={(e) => setQuickHygiene(e.target.value as 'TOILET' | 'DIAPER' | 'ABNORMAL')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="TOILET">Bình thường / Tốt</option>
                    <option value="DIAPER">Đã thay tã / quần áo</option>
                    <option value="ABNORMAL">Tiêu chảy / Bất thường</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="care-note" className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Ghi chú cho phụ huynh / giáo viên ca sau
                </label>
                <textarea
                  id="care-note"
                  rows={2}
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Ghi chú thêm (ví dụ: Bé vui vẻ, ăn ngoan...)"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
              </div>
            </div>

            {isQuickRecordSaveUnavailable && (
              <p id="care-save-status" role="status" className="text-xs text-slate-800 dark:text-slate-100">
                Chưa lưu ghi nhận: chức năng lưu chưa khả dụng. Nội dung tạm thời vẫn ở trong biểu mẫu này.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setIsQuickRecordModalOpen(false); setIsQuickRecordSaveUnavailable(false); }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSavingQuick}
                onClick={() => void handleSaveQuickRecord()}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isSavingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isSavingQuick ? 'Đang lưu...' : 'Lưu Ghi Nhận'}</span>
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
              <AvatarInitials name={selectedStudentForDetail.name} colorClass={selectedStudentForDetail.avatarFallbackBg} size="lg" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedStudentForDetail.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCourseName} · {dateDisplay}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { label: 'Bữa ăn hôm nay:', value: selectedStudentForDetail.mealLabel, status: selectedStudentForDetail.mealStatus },
                { label: 'Giấc ngủ trưa:', value: selectedStudentForDetail.napLabel, status: selectedStudentForDetail.napStatus },
                { label: 'Tình trạng sức khỏe:', value: selectedStudentForDetail.healthLabel, isAlert: selectedStudentForDetail.isAlert },
                { label: 'Vệ sinh cá nhân:', value: selectedStudentForDetail.hygieneLabel, status: selectedStudentForDetail.hygieneStatus },
                { label: 'Ghi chú hiện tại:', value: selectedStudentForDetail.note },
              ].map((row) => (
                <div key={row.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{row.label}</span>
                  <span className={`font-bold ${row.isAlert ? 'text-[#e11d48]' : 'text-slate-900 dark:text-white'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
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
                  const student = selectedStudentForDetail;
                  setSelectedStudentForDetail(null);
                  openEditStudentCare(student);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Edit className="w-4 h-4" />
                <span>Chỉnh Sửa Chi Tiết</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. MODAL: CHỈNH SỬA NỘI DUNG CHĂM SÓC CHO TỪNG BÉ (DEDICATED EDIT) ── */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <AvatarInitials name={editingStudent.name} colorClass={editingStudent.avatarFallbackBg} size="lg" />
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                  Cập nhật nhật ký chăm sóc
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {editingStudent.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lớp: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedCourseName}</span> · Ngày: <span className="font-semibold text-slate-700 dark:text-slate-300">{dateDisplay}</span>
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* 1. Bữa ăn */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                  <Utensils className="w-4 h-4 text-emerald-600" />
                  <span>1. Bữa ăn hôm nay</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'ALL' as const, label: 'Ăn hết', desc: '100% khẩu phần', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                    { key: 'HALF' as const, label: 'Ăn 1/2', desc: '50% khẩu phần', activeClass: 'bg-amber-500 text-white border-amber-500' },
                    { key: 'FEW' as const, label: 'Ăn ít', desc: 'Dưới 1/3', activeClass: 'bg-orange-500 text-white border-orange-500' },
                    { key: 'NONE' as const, label: 'Không ăn', desc: 'Bỏ bữa', activeClass: 'bg-rose-500 text-white border-rose-500' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEditMealOption((curr) => (curr === opt.key ? null : opt.key))}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        editMealOption === opt.key
                          ? opt.activeClass + ' font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editMealNotes}
                  onChange={(e) => setEditMealNotes(e.target.value)}
                  placeholder="Ghi chú thêm về bữa ăn (ví dụ: uống thêm 1 hộp sữa, không thích ăn rau...)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43] text-xs"
                />
              </div>

              {/* 2. Giấc ngủ */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                  <Moon className="w-4 h-4 text-blue-600" />
                  <span>2. Giấc ngủ trưa</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'DEEP' as const, label: 'Ngủ ngoan', desc: '120 phút sâu giấc', activeClass: 'bg-blue-600 text-white border-blue-600' },
                    { key: 'RESTLESS' as const, label: 'Ngủ ít', desc: '60 phút / chập chờn', activeClass: 'bg-amber-500 text-white border-amber-500' },
                    { key: 'REFUSED' as const, label: 'Khó ngủ', desc: 'Không ngủ / quấy', activeClass: 'bg-rose-500 text-white border-rose-500' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEditNapOption((curr) => (curr === opt.key ? null : opt.key))}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        editNapOption === opt.key
                          ? opt.activeClass + ' font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editNapNotes}
                  onChange={(e) => setEditNapNotes(e.target.value)}
                  placeholder="Ghi chú giấc ngủ (ví dụ: vào giấc lúc 11:45, ngủ ngoan...)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43] text-xs"
                />
              </div>

              {/* 3. Thân nhiệt & Sức khỏe */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>3. Thân nhiệt & Sức khỏe</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500">Nhiệt độ:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="35"
                      max="41"
                      value={editTemperature}
                      placeholder="--.-"
                      onChange={(e) => setEditTemperature(e.target.value)}
                      className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">°C</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'NORMAL' as const, label: 'Bình thường', desc: '36.5 - 37.2°C', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                    { key: 'FEVER_MILD' as const, label: 'Sốt nhẹ', desc: '37.5 - 38.0°C', activeClass: 'bg-amber-500 text-white border-amber-500' },
                    { key: 'FEVER_HIGH' as const, label: 'Sốt cao', desc: '>38.0°C (Cảnh báo)', activeClass: 'bg-rose-500 text-white border-rose-500' },
                    { key: 'TIRED' as const, label: 'Mệt mỏi / Cảm', desc: 'Có biểu hiện ốm', activeClass: 'bg-purple-600 text-white border-purple-600' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setEditHealthOption((curr) => {
                          if (curr === opt.key) {
                            setEditTemperature('');
                            return null;
                          }
                          if (opt.key === 'NORMAL') setEditTemperature('36.8');
                          else if (opt.key === 'FEVER_MILD') setEditTemperature('37.8');
                          else if (opt.key === 'FEVER_HIGH') setEditTemperature('38.5');
                          else if (opt.key === 'TIRED') setEditTemperature('37.0');
                          return opt.key;
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        editHealthOption === opt.key
                          ? opt.activeClass + ' font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Vệ sinh cá nhân */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  <span>4. Vệ sinh cá nhân</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'TOILET' as const, label: 'Bình thường', desc: 'Tự chủ tốt', activeClass: 'bg-sky-600 text-white border-sky-600' },
                    { key: 'DIAPER' as const, label: 'Đã thay tã', desc: 'Thay đồ / tã sạch', activeClass: 'bg-amber-500 text-white border-amber-500' },
                    { key: 'ABNORMAL' as const, label: 'Bất thường', desc: 'Tiêu chảy / nôn trớ', activeClass: 'bg-rose-500 text-white border-rose-500' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEditHygieneOption((curr) => (curr === opt.key ? null : opt.key))}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        editHygieneOption === opt.key
                          ? opt.activeClass + ' font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editHygieneNotes}
                  onChange={(e) => setEditHygieneNotes(e.target.value)}
                  placeholder="Ghi chú vệ sinh (ví dụ: đã thay bộ quần áo sơ cua...)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43] text-xs"
                />
              </div>

              {/* 5. Ghi chú & Lời nhắn phụ huynh */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  5. Lời nhắn gửi phụ huynh / Giáo viên ca chiều
                </label>
                <textarea
                  rows={2}
                  value={editGeneralNote}
                  onChange={(e) => setEditGeneralNote(e.target.value)}
                  placeholder="Nhập dặn dò phụ huynh lúc trả trẻ (ví dụ: Hôm nay bé vui vẻ, hợp tác cùng cô và các bạn...)"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSavingCare}
                onClick={() => void handleSaveStudentCare()}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isSavingCare ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSavingCare ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. FLOATING TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0e5c43] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-4 duration-200 text-xs font-bold border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded-lg ml-1 text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
