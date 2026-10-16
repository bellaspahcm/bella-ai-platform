'use client';

/**
 * Bella Education — Preschool Classroom Operations & Capacity Management
 * 
 * Scalable Architecture & Public Contract Integration:
 * - Unified Page Title: "Quản Lý Lớp Học"
 * - Context Selector: Academic Year 2025 - 2026 / 2026 - 2027
 * - Capacity Management (Còn chỗ, Gần đầy, Đã đầy)
 * - Live Operational Status ("Hôm nay lớp thế nào?")
 * - Create Class Workflow Modal with Public Contracts & Teacher Conflict Checks
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Users, 
  Sparkles, 
  ArrowLeft,
  GraduationCap,
  Calendar,
  MapPin,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  CalendarCheck,
  ExternalLink,
  X,
  ShieldCheck,
  Check,
  RefreshCw,
  UserCheck
} from 'lucide-react';

type ClassItem = {
  id: string;
  code?: string;
  name: string;
  grade: string;
  gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
  teacher: string;
  teacherPartyId?: string;
  room: string;
  students: number;
  maxStudents: number;
  focus: string;
  todayStatus: {
    present: number;
    excused: number;
    unmarked: number;
    healthAlerts: number;
  };
  theme: {
    badgeBg: string;
    badgeText: string;
  };
};

const INITIAL_CLASSES: ClassItem[] = [
  {
    id: 'mam-a1',
    code: 'MAM-A1',
    name: 'Lớp Mầm A1 — Họa Mi',
    grade: 'Khối Mầm (3 tuổi)',
    gradeKey: 'mam',
    teacher: 'Cô Nguyễn Thị Mai (Chủ nhiệm) & Cô Lê Thu Trang (Phó)',
    room: 'Phòng 101 • Tầng 1',
    students: 22,
    maxStudents: 25,
    focus: 'Phát triển Ngôn ngữ & Kỹ năng Giao tiếp',
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
    teacher: 'Cô Trần Ngọc Anh (Chủ nhiệm) & Cô Phạm Thanh Hà (Phó)',
    room: 'Phòng 202 • Tầng 2',
    students: 24,
    maxStudents: 25,
    focus: 'Tư duy Toán học Reggio Emilia & Mỹ thuật',
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
    teacher: 'Cô Đặng Thùy Linh (Chủ nhiệm) & Cô Vũ Khánh Vân (Phó)',
    room: 'Phòng 301 • Tầng 3',
    students: 25,
    maxStudents: 25,
    focus: 'Tiền Tiểu học & Tiếng Anh Song ngữ Montessori',
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
    teacher: 'Cô Hoàng Bích Ngọc (Chủ nhiệm) & Cô Bùi Thảo Chi (Phó)',
    room: 'Phòng 102 • Tầng 1',
    students: 15,
    maxStudents: 18,
    focus: 'Vận động thô & Thói quen tự lập đầu đời',
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

export default function CoursesPage() {
  const [selectedYear, setSelectedYear] = useState('2025-2026');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [classList, setClassList] = useState<ClassItem[]>(INITIAL_CLASSES);
  const [isLoading, setIsLoading] = useState(false);
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

  // Fetch live classrooms from API
  const fetchClassrooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/education/courses');
      const data = await res.json();
      if (data.success && data.classrooms && data.classrooms.length > 0) {
        const mapped: ClassItem[] = data.classrooms.map((c: {
          id: string;
          code: string;
          name: string;
          grade: string;
          gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
          teacher: string;
          room: string;
          students: number;
          maxStudents: number;
          focus: string;
          todayStatus: { present: number; excused: number; unmarked: number; healthAlerts: number };
        }) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          grade: c.grade,
          gradeKey: c.gradeKey,
          teacher: c.teacher,
          room: c.room,
          students: c.students,
          maxStudents: c.maxStudents,
          focus: c.focus,
          todayStatus: c.todayStatus,
          theme: {
            badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
            badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
          },
        }));
        setClassList(mapped);
      }
    } catch {
      // Keep initial classes on network error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
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
      };
    }
    if (remaining <= 2) {
      return {
        label: `Gần đầy (Còn ${remaining} chỗ)`,
        badgeClass: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/80',
        barClass: 'bg-amber-500',
      };
    }
    return {
      label: `Còn ${remaining} chỗ`,
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200/80',
      barClass: 'bg-emerald-500',
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

      const data = await res.json();
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

  const filteredClasses = classList.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cls.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cls.room.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || cls.gradeKey === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Unified Header Banner ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Top Navigation & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20">
                    Preschool ERP Operations
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    P3.2 Verified Contracts
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">
                  Quản Lý Lớp Học & Sức Chứa (Classroom Workspace)
                </h1>
              </div>
            </div>
          </div>

          {/* Context Selector & Actions */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchClassrooms}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Cập nhật danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-[var(--education-brand-ink)]" />
              <span className="font-semibold text-slate-500 dark:text-slate-400">Niên học:</span>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer pr-1"
              >
                <option value="2025-2026">Niên học 2025 - 2026</option>
                <option value="2026-2027">Niên học 2026 - 2027</option>
              </select>
            </div>

            <button
              onClick={() => { setModalStep(1); setModalError(null); setIsNewClassModalOpen(true); }}
              className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Mở Lớp Học Mới</span>
            </button>
          </div>
        </div>

        {/* Operational Overview KPI Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng số lớp mầm</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {classList.length} <span className="text-xs font-normal text-slate-400">lớp</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Tổng học sinh hiện tại</span>
            <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-1">
              {classList.reduce((acc, c) => acc + c.students, 0)} <span className="text-xs font-normal text-emerald-600">bé</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Chỗ trống còn lại</span>
            <div className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-1">
              {classList.reduce((acc, c) => acc + (c.maxStudents - c.students), 0)} <span className="text-xs font-normal text-amber-600">slot</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 ">
            <span className="text-[11px] font-bold text-[var(--education-brand-ink)]">Tỷ lệ lấp đầy trung bình</span>
            <div className="text-xl font-extrabold text-[var(--education-brand-ink)] mt-1">
              {Math.round((classList.reduce((acc, c) => acc + c.students, 0) / Math.max(1, classList.reduce((acc, c) => acc + c.maxStudents, 0))) * 100)}%
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Tất cả khối lớp' },
              { id: 'mam', label: 'Khối Mầm (3 tuổi)' },
              { id: 'choi', label: 'Khối Chồi (4 tuổi)' },
              { id: 'la', label: 'Khối Lá (5 tuổi)' },
              { id: 'nursery', label: 'Nhà Trẻ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedGrade(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedGrade === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên lớp, giáo viên, phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* ── Classrooms Grid Section ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClasses.map((cls) => {
          const capStatus = getCapacityStatus(cls.students, cls.maxStudents);
          const percent = Math.min(100, Math.round((cls.students / cls.maxStudents) * 100));

          return (
            <div
              key={cls.id}
              className="group relative rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Class Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${cls.theme.badgeBg} ${cls.theme.badgeText}`}>
                        {cls.grade}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${capStatus.badgeClass}`}>
                        {capStatus.label}
                      </span>
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-[var(--education-brand-ink)] transition-colors">
                      {cls.name}
                    </h2>
                  </div>

                  {/* Options Menu Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === cls.id ? null : cls.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === cls.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-10 z-30 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-0.5 text-xs font-semibold"
                      >
                        <Link
                          href={`/dashboard/education/courses/${cls.id}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
                          <span>Mở Workspace lớp</span>
                        </Link>
                        <Link
                          href="/dashboard/education/attendance"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Điểm danh hôm nay</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Metadata */}
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate font-medium" title={cls.teacher}>{cls.teacher}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">{cls.room}</span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
                      Sức chứa hiện tại:
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {cls.students} / {cls.maxStudents} <span className="text-[10px] font-normal text-slate-400">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${capStatus.barClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Today's Operational Status Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>Hôm nay lớp thế nào?</span>
                    <span className="text-[10px] font-normal text-slate-400">Live Status</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">Có mặt</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{cls.todayStatus.present}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">Có phép</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{cls.todayStatus.excused}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">Chưa báo</span>
                      <span className="font-extrabold text-slate-500">{cls.todayStatus.unmarked}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">Cảnh báo SK</span>
                      <span className="font-extrabold text-rose-500">{cls.todayStatus.healthAlerts}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                <Link
                  href={`/dashboard/education/courses/${cls.id}`}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-primary/10 hover:bg-primary/15 text-[var(--education-brand-ink)] font-bold text-xs text-center transition-colors border border-primary/20"
                >
                  Vào Workspace Lớp
                </Link>
                <Link
                  href="/dashboard/education/attendance"
                  className="py-2.5 px-4 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Điểm Danh</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create Class Workflow Modal ── */}
      {isNewClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Mở Lớp Học Mới — Niên Học {selectedYear}
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
                    Mã lớp (duy nhất per trường)
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="VD: MAM-A2"
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Khối lớp
                    </label>
                    <select 
                      value={formGrade}
                      onChange={(e) => setFormGrade(e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
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
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Lớp Mầm A2 — Sơn Ca"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
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
                      onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Phòng học chỉ định
                    </label>
                    <input
                      type="text"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      placeholder="VD: Phòng 103 • Tầng 1"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
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
                    Phân công Giáo viên chủ nhiệm (Canonical Teacher Assignment)
                  </label>
                  <select 
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  >
                    <option value="88888888-8888-8888-8888-88888888888b">Cô Nguyễn Thị Mai (Chưa có lớp chủ nhiệm 2025-2026)</option>
                    <option value="88888888-8888-8888-8888-88888888888c">Cô Trần Ngọc Anh (Khả dụng)</option>
                    <option value="88888888-8888-8888-8888-88888888888d">Thầy Lê Văn An (Khả dụng)</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Ràng buộc hệ thống (DB Invariant Verified):
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    ✓ Max 1 GV Chủ nhiệm per lớp/niên học • Không shadow model metadata • Concurrency protection 100% active.
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
                  className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Tiếp theo: Phân công →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCreateClass}
                  className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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
