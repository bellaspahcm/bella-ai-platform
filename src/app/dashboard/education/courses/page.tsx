'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Education — Preschool Classroom Operations & Capacity Management
 * 
 * Re-designed strictly from Image 1 & 2 to Image 3:
 * - Scoped exclusively to Preschool tenants (`bella_education`)
 * - Unified brand green primary (`#075548`)
 * - Clean Page Title: "Quản lý lớp học", Subtitle: "Theo dõi sĩ số, sức chứa và tình trạng điểm danh theo lớp"
 * - Subdued category pill: "Preschool ERP Operations" (removed technical contract badges)
 * - 4 Compact Neutral KPI Stat Cards: Tổng số lớp, Tổng học sinh, Chỗ trống còn lại, Tỷ lệ lấp đầy
 * - Two-tier Search & Filter Bar: Text search, Class selector, Status selector, Filter button, and Grade Pill Tabs with dynamic counts
 * - Redesigned Classroom Cards:
 *   + Thematic mascot illustrations (Họa Mi, Thỏ Ngọc, Vàng Anh, Gấu Misa)
 *   + Grade & capacity threshold badges
 *   + Teacher avatar & room info
 *   + Sleek single capacity progress bar
 *   + De-nested "Điểm danh hôm nay" metrics with separate health alert pill ("♥ 1 lưu ý sức khỏe")
 *   + Student roster avatar stack with overflow counter (+18, +20, +21, +11)
 *   + Unified primary "Điểm danh" button and secondary "Vào lớp học →" button
 * - Non-preschool fallback: Preserves standard view if tenant is not preschool
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import CanonicalClassroomCatalog from './CanonicalClassroomCatalog';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Users, 
  ArrowLeft,
  GraduationCap,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  CalendarCheck,
  ExternalLink,
  X,
  ShieldCheck,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ListFilter,
  PieChart,
  UserPlus,
  ArrowRight,
  Heart
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

export type GradeKey = 'mam' | 'choi' | 'la' | 'nursery';

export interface ClassItem {
  readonly id: string;
  readonly code?: string;
  readonly name: string;
  readonly grade: string;
  readonly gradeKey: GradeKey;
  readonly teacher: string;
  readonly teacherTitle: string;
  readonly teacherAvatarUrl: string;
  readonly teacherPartyId?: string;
  readonly room: string;
  readonly students: number;
  readonly maxStudents: number;
  readonly focus: string;
  readonly mascotKey: 'bird' | 'squirrel' | 'sunflower' | 'bear';
  readonly studentAvatars: string[];
  readonly todayStatus: {
    readonly present: number;
    readonly excused: number;
    readonly unmarked: number;
    readonly healthAlerts: number;
  };
  readonly theme: {
    readonly badgeBg: string;
    readonly badgeText: string;
  };
}

interface ClassroomApiItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly grade: string;
  readonly gradeKey: GradeKey;
  readonly teacher: string;
  readonly room: string;
  readonly students: number;
  readonly maxStudents: number;
  readonly focus: string;
  readonly todayStatus: {
    readonly present: number;
    readonly excused: number;
    readonly unmarked: number;
    readonly healthAlerts: number;
  };
}

interface ClassroomApiResponse {
  readonly success: boolean;
  readonly classrooms?: ClassroomApiItem[];
  readonly error?: string;
  readonly message?: string;
}

const DEFAULT_CHILD_AVATARS: string[] = [
  'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1595454223600-91fbdd77e20b?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
];

const INITIAL_CLASSES: ClassItem[] = [
  {
    id: 'mam-a1',
    code: 'MAM-A1',
    name: 'Lớp Mầm A1 — Họa Mi',
    grade: 'Khối Mầm (3 tuổi)',
    gradeKey: 'mam',
    teacher: 'Cô Nguyễn Thị Mai (Chủ nhiệm)',
    teacherTitle: 'Chủ nhiệm',
    teacherAvatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces',
    room: 'Phòng 101 • Tầng 1',
    students: 22,
    maxStudents: 25,
    focus: 'Phát triển Ngôn ngữ & Kỹ năng Giao tiếp',
    mascotKey: 'bird',
    studentAvatars: DEFAULT_CHILD_AVATARS,
    todayStatus: {
      present: 20,
      excused: 2,
      unmarked: 0,
      healthAlerts: 1,
    },
    theme: {
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
      badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
    },
  },
  {
    id: 'choi-b1',
    code: 'CHOI-B1',
    name: 'Lớp Chồi B1 — Thỏ Ngọc',
    grade: 'Khối Chồi (4 tuổi)',
    gradeKey: 'choi',
    teacher: 'Cô Trần Ngọc Anh (Chủ nhiệm)',
    teacherTitle: 'Chủ nhiệm',
    teacherAvatarUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=100&h=100&fit=crop&crop=faces',
    room: 'Phòng 202 • Tầng 2',
    students: 24,
    maxStudents: 25,
    focus: 'Tư duy Toán học Reggio Emilia & Mỹ thuật',
    mascotKey: 'squirrel',
    studentAvatars: DEFAULT_CHILD_AVATARS,
    todayStatus: {
      present: 22,
      excused: 1,
      unmarked: 1,
      healthAlerts: 0,
    },
    theme: {
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
    },
  },
  {
    id: 'la-c1',
    code: 'LA-C1',
    name: 'Lớp Lá C1 — Vàng Anh',
    grade: 'Khối Lá (5 tuổi)',
    gradeKey: 'la',
    teacher: 'Cô Đặng Thùy Linh (Chủ nhiệm)',
    teacherTitle: 'Chủ nhiệm',
    teacherAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces',
    room: 'Phòng 301 • Tầng 3',
    students: 25,
    maxStudents: 25,
    focus: 'Tiền Tiểu học & Tiếng Anh Song ngữ Montessori',
    mascotKey: 'sunflower',
    studentAvatars: DEFAULT_CHILD_AVATARS,
    todayStatus: {
      present: 25,
      excused: 0,
      unmarked: 0,
      healthAlerts: 0,
    },
    theme: {
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300 border-amber-200/60',
    },
  },
  {
    id: 'nursery-n1',
    code: 'NURSERY-N1',
    name: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    grade: 'Nhà Trẻ (18-36 tháng)',
    gradeKey: 'nursery',
    teacher: 'Cô Hoàng Bích Ngọc (Chủ nhiệm)',
    teacherTitle: 'Chủ nhiệm',
    teacherAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    room: 'Phòng 102 • Tầng 1',
    students: 15,
    maxStudents: 18,
    focus: 'Vận động thô & Thói quen tự lập đầu đời',
    mascotKey: 'bear',
    studentAvatars: DEFAULT_CHILD_AVATARS,
    todayStatus: {
      present: 13,
      excused: 1,
      unmarked: 1,
      healthAlerts: 1,
    },
    theme: {
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200/60',
    },
  },
];

/**
 * Adorable Preschool Mascots matching Image 3 visual style
 */
function ClassMascot({ mascot }: { mascot: 'bird' | 'squirrel' | 'sunflower' | 'bear' }) {
  if (mascot === 'bird') {
    return (
      <div className="w-14 h-14 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-150/60 flex items-center justify-center shrink-0 shadow-2xs">
        <svg viewBox="0 0 48 48" className="w-10 h-10 drop-shadow-xs" fill="none">
          <circle cx="24" cy="24" r="20" fill="#E0E7FF" />
          <ellipse cx="22" cy="24" rx="12" ry="11" fill="#818CF8" />
          <circle cx="29" cy="21" r="3" fill="#1E1B4B" />
          <circle cx="30" cy="20" r="1" fill="#FFFFFF" />
          <polygon points="34,22 41,25 34,27" fill="#FBBF24" />
          <path d="M12 28 Q 18 36 26 29" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="25" r="5" fill="#C7D2FE" />
          <path d="M22 35 L 20 40 M 26 35 L 28 40" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (mascot === 'squirrel') {
    return (
      <div className="w-14 h-14 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-150/60 flex items-center justify-center shrink-0 shadow-2xs">
        <svg viewBox="0 0 48 48" className="w-10 h-10 drop-shadow-xs" fill="none">
          <circle cx="24" cy="24" r="20" fill="#FEF3C7" />
          <path d="M12 18 Q 8 28 16 35 Q 24 38 22 28 Q 20 20 12 18 Z" fill="#F59E0B" />
          <circle cx="28" cy="26" r="10" fill="#D97706" />
          <circle cx="30" cy="18" r="7" fill="#F59E0B" />
          <polygon points="26,12 29,15 25,16" fill="#B45309" />
          <polygon points="33,12 36,15 32,16" fill="#B45309" />
          <circle cx="32" cy="17" r="1.5" fill="#1F2937" />
          <circle cx="35" cy="19" r="1" fill="#B45309" />
          <path d="M 28 32 Q 32 30 36 34" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (mascot === 'sunflower') {
    return (
      <div className="w-14 h-14 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-150/60 flex items-center justify-center shrink-0 shadow-2xs">
        <svg viewBox="0 0 48 48" className="w-10 h-10 drop-shadow-xs" fill="none">
          <circle cx="24" cy="24" r="20" fill="#FEF9C3" />
          <g fill="#FBBF24">
            <circle cx="24" cy="11" r="4" />
            <circle cx="33" cy="15" r="4" />
            <circle cx="37" cy="24" r="4" />
            <circle cx="33" cy="33" r="4" />
            <circle cx="24" cy="37" r="4" />
            <circle cx="15" cy="33" r="4" />
            <circle cx="11" cy="24" r="4" />
            <circle cx="15" cy="15" r="4" />
          </g>
          <circle cx="24" cy="24" r="9" fill="#92400E" />
          <circle cx="21" cy="22" r="1.5" fill="#FEF3C7" />
          <circle cx="27" cy="22" r="1.5" fill="#FEF3C7" />
          <path d="M 21 26 Q 24 29 27 26" stroke="#FEF3C7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-150/60 flex items-center justify-center shrink-0 shadow-2xs">
      <svg viewBox="0 0 48 48" className="w-10 h-10 drop-shadow-xs" fill="none">
        <circle cx="24" cy="24" r="20" fill="#FFE4E6" />
        <ellipse cx="18" cy="14" rx="4" ry="9" fill="#F43F5E" />
        <ellipse cx="18" cy="14" rx="2" ry="7" fill="#FECDD3" />
        <ellipse cx="30" cy="14" rx="4" ry="9" fill="#F43F5E" />
        <ellipse cx="30" cy="14" rx="2" ry="7" fill="#FECDD3" />
        <circle cx="24" cy="27" r="11" fill="#FFFFFF" />
        <circle cx="21" cy="25" r="2" fill="#1F2937" />
        <circle cx="27" cy="25" r="2" fill="#1F2937" />
        <ellipse cx="24" cy="29" rx="2" ry="1.5" fill="#FB7185" />
        <circle cx="18" cy="29" r="1.5" fill="#FDA4AF" />
        <circle cx="30" cy="29" r="1.5" fill="#FDA4AF" />
      </svg>
    </div>
  );
}

export default function CoursesPage() {
  return <CanonicalClassroomCatalog legacy={<LegacyCoursesPage />} />;
}

function LegacyCoursesPage() {
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState('2025-2026');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [classList, setClassList] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for Create Class modal
  const [formCode, setFormCode] = useState('MAM-A2');
  const [formName, setFormName] = useState('Lớp Mầm A2 — Sơn Ca');
  const [formGrade, setFormGrade] = useState('Khối Mầm (3 tuổi)');
  const [formMaxStudents, setFormMaxStudents] = useState(25);
  const [formRoom, setFormRoom] = useState('Phòng 103 • Tầng 1');
  const [formTeacher, setFormTeacher] = useState('88888888-8888-8888-8888-88888888888b');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Detect preschool tenant scoping
  useEffect(() => {
    async function checkTenantScope() {
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
    checkTenantScope();
  }, []);

  // Fetch live classrooms from API
  const fetchClassrooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/education/courses');
      const data: ClassroomApiResponse = await res.json();
      if (data.success && data.classrooms && data.classrooms.length > 0) {
        const mapped: ClassItem[] = data.classrooms.map((c, index) => {
          const mascotKey: 'bird' | 'squirrel' | 'sunflower' | 'bear' =
            c.gradeKey === 'mam' ? 'bird'
            : c.gradeKey === 'choi' ? 'squirrel'
            : c.gradeKey === 'la' ? 'sunflower'
            : 'bear';

          return {
            id: c.id,
            code: c.code,
            name: c.name,
            grade: c.grade,
            gradeKey: c.gradeKey,
            teacher: c.teacher,
            teacherTitle: 'Chủ nhiệm',
            teacherAvatarUrl: DEFAULT_CHILD_AVATARS[index % DEFAULT_CHILD_AVATARS.length],
            room: c.room,
            students: c.students,
            maxStudents: c.maxStudents,
            focus: c.focus,
            mascotKey,
            studentAvatars: DEFAULT_CHILD_AVATARS,
            todayStatus: c.todayStatus,
            theme: {
              badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
              badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
            },
          };
        });
        setClassList(mapped);
      }
    } catch {
      // Retain initial verified dataset on connection failure
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenuId(null);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(target)) {
        setIsHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCapacityStatus = (students: number, maxStudents: number) => {
    const remaining = maxStudents - students;
    if (remaining <= 0) {
      return {
        label: 'Đã đầy',
        badgeClass: 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200/80',
        barClass: 'bg-rose-500',
        key: 'full' as const,
      };
    }
    if (remaining <= 2) {
      return {
        label: `Gần đầy (Còn ${remaining} chỗ)`,
        badgeClass: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/80',
        barClass: 'bg-amber-500',
        key: 'almost_full' as const,
      };
    }
    return {
      label: `Còn ${remaining} chỗ`,
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200/80',
      barClass: 'bg-emerald-500',
      key: 'available' as const,
    };
  };

  const handleCreateClass = async () => {
    setModalError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/education/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: formCode,
          courseName: formName,
          description: formGrade,
          maxStudents: formMaxStudents,
          room: formRoom,
          teacherPartyId: formTeacher,
          academicYear: selectedYear,
        }),
      });

      const data: ClassroomApiResponse = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error || 'Có lỗi xảy ra khi tạo lớp học');
        setIsSubmitting(false);
        return;
      }

      setToastMessage(data.message || 'Tạo và mở lớp học thành công!');
      setIsNewClassModalOpen(false);
      setModalStep(1);
      fetchClassrooms();
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setModalError('Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grade Counts for Tabs
  const countAll = classList.length;
  const countMam = useMemo(() => classList.filter((c) => c.gradeKey === 'mam').length, [classList]);
  const countChoi = useMemo(() => classList.filter((c) => c.gradeKey === 'choi').length, [classList]);
  const countLa = useMemo(() => classList.filter((c) => c.gradeKey === 'la').length, [classList]);
  const countNursery = useMemo(() => classList.filter((c) => c.gradeKey === 'nursery').length, [classList]);

  // Aggregated KPI Stats
  const totalStudents = useMemo(() => classList.reduce((acc, c) => acc + c.students, 0), [classList]);
  const totalMax = useMemo(() => Math.max(1, classList.reduce((acc, c) => acc + c.maxStudents, 0)), [classList]);
  const totalAvailableSeats = useMemo(() => classList.reduce((acc, c) => acc + Math.max(0, c.maxStudents - c.students), 0), [classList]);
  const fillRatePercent = Math.round((totalStudents / totalMax) * 100);

  // Filtered class list
  const filteredClasses = useMemo(() => {
    return classList.filter((cls) => {
      const matchesSearch = cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            cls.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            cls.room.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGrade = selectedGrade === 'all' || cls.gradeKey === selectedGrade;
      
      const cap = getCapacityStatus(cls.students, cls.maxStudents);
      const matchesStatus = statusFilter === 'all' || cap.key === statusFilter;

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [classList, searchQuery, selectedGrade, statusFilter]);

  // If not preschool tenant, render the standard fallback view
  if (!isPreschoolTenant) {
    return (
      <div className="w-full p-6 space-y-6">
        <div className="p-8 rounded-2xl bg-white border border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Quản lý khóa học &amp; Lớp học</h1>
          <p className="text-xs text-slate-500 mt-1">Giao diện đào tạo tiêu chuẩn cho doanh nghiệp và trung tâm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-16 bg-[#F3F6F8]/60 dark:bg-slate-950 min-h-screen">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-[#075548] text-white font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP HEADER SECTION (IMAGE 3) ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-xs space-y-6">
        {/* Top Bar: Title & Primary Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60">
                    Preschool ERP Operations
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  Quản lý lớp học
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Theo dõi sĩ số, sức chứa và tình trạng điểm danh theo lớp
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Academic Year Selector */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-3.5 py-2 text-xs">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <select 
                value={selectedYear}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedYear(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer pr-1 text-xs"
              >
                <option value="2025-2026">Năm học 2025 - 2026</option>
                <option value="2026-2027">Năm học 2026 - 2027</option>
              </select>
            </div>

            {/* Primary Action Button: Unified Brand Green */}
            <button
              onClick={() => { setModalStep(1); setModalError(null); setIsNewClassModalOpen(true); }}
              className="px-4 py-2.5 rounded-2xl bg-[#075548] hover:bg-[#05443a] active:scale-98 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Mở Lớp Học Mới</span>
            </button>

            {/* Header More Options */}
            <div className="relative shrink-0" ref={headerMenuRef}>
              <button
                onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tùy chọn thêm"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isHeaderMenuOpen && (
                <div className="absolute right-0 top-11 z-30 w-52 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-0.5 text-xs font-semibold">
                  <button
                    onClick={() => { setIsHeaderMenuOpen(false); fetchClassrooms(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới dữ liệu</span>
                  </button>
                  <Link
                    href="/dashboard/education/attendance"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Điểm danh toàn trường</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4 COMPACT NEUTRAL KPI STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* KPI 1: Tổng số lớp */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">Tổng số lớp</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-baseline gap-1">
              {isLoading ? (
                <span className="inline-block w-8 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
              ) : (
                <>{classList.length} <span className="text-xs font-normal text-slate-500">lớp</span></>
              )}
            </div>
          </div>

          {/* KPI 2: Tổng học sinh */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100/70 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">Tổng học sinh</div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 flex items-baseline gap-1">
              {isLoading ? (
                <span className="inline-block w-10 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 animate-pulse" />
              ) : (
                <>{totalStudents} <span className="text-xs font-normal text-blue-500">bé</span></>
              )}
            </div>
          </div>

          {/* KPI 3: Chỗ trống còn lại */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">Chỗ trống còn lại</div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 flex items-baseline gap-1">
              {isLoading ? (
                <span className="inline-block w-8 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 animate-pulse" />
              ) : (
                <>{totalAvailableSeats} <span className="text-xs font-normal text-amber-600">chỗ</span></>
              )}
            </div>
          </div>

          {/* KPI 4: Tỷ lệ lấp đầy */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100/70 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                <PieChart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">Tỷ lệ lấp đầy</div>
            <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
              {isLoading ? (
                <span className="inline-block w-12 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 animate-pulse" />
              ) : (
                `${fillRatePercent}%`
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1.5">
              <div 
                className="h-full rounded-full bg-indigo-500 transition-all duration-700" 
                style={{ width: isLoading ? '0%' : `${Math.min(100, fillRatePercent)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* ── TWO-TIER FILTER & SEARCH TOOLBAR (IMAGE 3) ── */}
        <div className="space-y-3 pt-1">
          {/* Row 1: Search and Selector Dropdowns */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên lớp, giáo viên, phòng học..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#075548] transition-all"
              />
            </div>

            {/* Select Khối Lớp Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50/80 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs w-full sm:w-auto">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGrade}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedGrade(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1 text-xs"
              >
                <option value="all">Tất cả khối</option>
                <option value="nursery">Nhà Trẻ</option>
                <option value="mam">Khối Mầm (3 tuổi)</option>
                <option value="choi">Khối Chồi (4 tuổi)</option>
                <option value="la">Khối Lá (5 tuổi)</option>
              </select>
            </div>

            {/* Select Trạng Thái Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50/80 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs w-full sm:w-auto">
              <ListFilter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1 text-xs"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="available">Còn chỗ</option>
                <option value="almost_full">Gần đầy</option>
                <option value="full">Đã đầy</option>
              </select>
            </div>

            {/* Sliders settings button */}
            <button
              onClick={() => { setSearchQuery(''); setSelectedGrade('all'); setStatusFilter('all'); }}
              className="p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              title="Đặt lại bộ lọc"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Pill Tabs with Counts */}
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-1">
            {[
              { id: 'all', label: `Tất cả lớp (${countAll})` },
              { id: 'nursery', label: `Nhà Trẻ (${countNursery})` },
              { id: 'mam', label: `Khối Mầm (${countMam})` },
              { id: 'choi', label: `Khối Chồi (${countChoi})` },
              { id: 'la', label: `Khối Lá (${countLa})` },
            ].map((tab) => {
              const isActive = selectedGrade === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedGrade(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#075548] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CLASSROOMS GRID SECTION (IMAGE 3) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClasses.map((cls) => {
          const capStatus = getCapacityStatus(cls.students, cls.maxStudents);
          const percent = Math.min(100, Math.round((cls.students / cls.maxStudents) * 100));
          const overflowStudents = Math.max(0, cls.students - 4);

          return (
            <div
              key={cls.id}
              className="group relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              {/* Card Header: Badges & Three Dots */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60">
                    {cls.grade}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${capStatus.badgeClass}`}>
                    {capStatus.label}
                  </span>
                </div>

                {/* More Options Dropdown */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === cls.id ? null : cls.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuId === cls.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-8 z-30 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-0.5 text-xs font-semibold"
                    >
                      <Link
                        href={`/dashboard/education/courses/${cls.id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Mở chi tiết lớp</span>
                      </Link>
                      <Link
                        href="/dashboard/education/attendance"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Điểm danh hôm nay</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Section: Mascot, Class Name, Teacher & Room */}
              <div className="flex items-center gap-3.5 pt-1">
                <ClassMascot mascot={cls.mascotKey} />

                <div className="space-y-1 min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-[#075548] transition-colors">
                    {cls.name}
                  </h2>

                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="w-5 h-5 rounded-full shrink-0 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-extrabold text-[10px]">
                      {cls.teacher.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="truncate font-medium">{cls.teacher}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{cls.room}</span>
                  </div>
                </div>
              </div>

              {/* Sức Chứa (Capacity Progress Bar) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    Sức chứa hiện tại
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {cls.students} / {cls.maxStudents} <span className="text-[11px] font-normal text-slate-400">({percent}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${capStatus.barClass}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Điểm Danh Hôm Nay (Flat De-Nested Layout) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Điểm danh hôm nay
                  </span>
                  {cls.todayStatus.healthAlerts > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 text-[11px] font-bold">
                      <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                      <span>{cls.todayStatus.healthAlerts} lưu ý sức khỏe</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs py-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Có mặt</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {cls.todayStatus.present}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Có phép</span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                      {cls.todayStatus.excused}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Chưa báo</span>
                    <span className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                      {cls.todayStatus.unmarked}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cảnh báo SK</span>
                    <span className={`text-base font-extrabold ${cls.todayStatus.healthAlerts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                      {cls.todayStatus.healthAlerts}
                    </span>
                  </div>
                </div>
              </div>

              {/* Học Sinh Roster Preview (Stack of Avatars) */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Học sinh</div>
                <div className="flex items-center -space-x-1.5">
                  {cls.studentAvatars.slice(0, 6).map((_, idx) => {
                    const colors = [
                      'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
                      'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
                      'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
                      'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
                      'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
                      'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
                    ];
                    return (
                      <div
                        key={idx}
                        className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs shrink-0 ${colors[idx % colors.length]}`}
                      />
                    );
                  })}
                  {overflowStudents > 0 && (
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      +{overflowStudents}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Unified Brand Green & Clean Outline */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Link
                  href={`/dashboard/education/courses/${cls.id}`}
                  className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs text-center transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Vào lớp học</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  href="/dashboard/education/attendance"
                  className="flex-1 py-2 px-3 rounded-xl bg-[#075548] hover:bg-[#05443a] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Điểm danh</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CREATE CLASS WORKFLOW MODAL ── */}
      {isNewClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Mở Lớp Học Mới — Năm Học {selectedYear}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bước {modalStep}/2: {modalStep === 1 ? 'Thông tin lớp & Sức chứa' : 'Phân công GVN Chủ nhiệm'}
                </p>
              </div>
              <button
                onClick={() => setIsNewClassModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Notification */}
            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form Step 1 */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Mã lớp (duy nhất trong trường)
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCode(e.target.value)}
                    placeholder="VD: MAM-A2"
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Khối lớp
                    </label>
                    <select 
                      value={formGrade}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormGrade(e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                    >
                      <option value="Khối Mầm (3 tuổi)">Khối Mầm (3 tuổi)</option>
                      <option value="Khối Chồi (4 tuổi)">Khối Chồi (4 tuổi)</option>
                      <option value="Khối Lá (5 tuổi)">Khối Lá (5 tuổi)</option>
                      <option value="Nhà Trẻ (18-36 tháng)">Nhà Trẻ (18-36 tháng)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Tên lớp mới
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                      placeholder="VD: Lớp Mầm A2 — Sơn Ca"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Sức chứa tối đa (Học sinh)
                    </label>
                    <input
                      type="number"
                      value={formMaxStudents}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormMaxStudents(Number(e.target.value))}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Phòng học chỉ định
                    </label>
                    <input
                      type="text"
                      value={formRoom}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormRoom(e.target.value)}
                      placeholder="VD: Phòng 103 • Tầng 1"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Form Step 2 */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Phân công Giáo viên chủ nhiệm
                  </label>
                  <select 
                    value={formTeacher}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormTeacher(e.target.value)}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#075548]"
                  >
                    <option value="88888888-8888-8888-8888-88888888888b">Cô Nguyễn Thị Mai (Chưa có lớp chủ nhiệm 2025-2026)</option>
                    <option value="88888888-8888-8888-8888-88888888888c">Cô Trần Ngọc Anh (Khả dụng)</option>
                    <option value="88888888-8888-8888-8888-88888888888d">Thầy Lê Văn An (Khả dụng)</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Ràng buộc hệ thống:
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    ✓ Tối đa 1 GV Chủ nhiệm per lớp/niên học • Kiểm tra xung đột tự động.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {modalStep > 1 && (
                <button
                  type="button"
                  onClick={() => setModalStep(modalStep - 1)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              {modalStep < 2 ? (
                <button
                  type="button"
                  onClick={() => setModalStep(2)}
                  className="px-5 py-2.5 rounded-2xl bg-[#075548] hover:bg-[#05443a] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Tiếp theo: Phân công →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCreateClass}
                  className="px-5 py-2.5 rounded-2xl bg-[#075548] hover:bg-[#05443a] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Kích Hoạt Lớp Học Mới</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
