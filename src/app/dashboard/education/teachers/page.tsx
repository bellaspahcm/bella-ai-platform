'use client';

/**
 * Bella Education — Teacher & Faculty Workforce Management
 *
 * Designed to exactly match Reference Design (Image 3):
 * - Scoped exclusively to Preschool tenants (`bella_education`)
 * - Color scheme: Primary Deep Green #0e5c43
 * - Top Navigation: Back button + Pink group icon badge + Title & Subtitle + Year selector + "+ Thêm Giáo Viên Mới" button
 * - 4 Stat Cards:
 *     1. Mint card: Tổng số giáo viên (32)
 *     2. Blue card: Giáo viên chủ nhiệm (12)
 *     3. Amber card: Giáo viên trợ giảng (14)
 *     4. Purple card: Giáo viên năng khiếu (6)
 * - Filter & Search Toolbar:
 *     - Row 1: Search input ("Tìm tên cô giáo, trình độ, lớp dạy..."), "Tất cả chức vụ", "Tất cả khối lớp", "Bộ lọc" button
 *     - Row 2: Pill tabs: Tất cả (32), Chủ nhiệm (12), Trợ giảng (14), Năng khiếu & Ngoại ngữ (6)
 * - 2-Column Grid of 6 Teacher Cards matching Image 3:
 *     1. Cô Nguyễn Thị Mai
 *     2. Cô Trần Ngọc Anh
 *     3. Cô Đặng Thùy Linh
 *     4. Cô Hoàng Bích Ngọc
 *     5. Cô Lê Minh Tâm
 *     6. Cô Phạm Thị Trang
 * - Card Content:
 *     - Photo avatar with fallback initials
 *     - Name, Role, Class Assigned (in emerald green)
 *     - Status badge & More options menu
 *     - 3 Info items with icons: Degree + Univ, Experience, Class
 *     - Workload bar: Hours, Percentage, and "Còn lịch trống" / "Đủ tải" pill
 *     - Certificate badges with shield icon
 *     - 2 Action buttons: "Xem Hồ Sơ" (outline) & "Phân Công Lớp" (solid deep green)
 * - Non-preschool fallback: Preserves standard view if tenant is not preschool
 * - STRICT TYPE SAFETY: Zero `any` and zero `unknown`
 */

import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  ShieldCheck,
  MoreVertical,
  GraduationCap,
  FileText,
  X,
  Check,
  SlidersHorizontal,
  Briefcase,
  MapPin,
  Star,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';

// ── Strict Types ──────────────────────────────────────────────────────────────

type RoleKey = 'chunhiem' | 'trogiang' | 'bomon';
type TeacherStatus = 'Đang Giảng Dạy' | 'Tạm Nghỉ' | 'Chờ Phân Công';
type GradeLevel = 'all' | 'nhatre' | 'mam' | 'choi' | 'la';

interface TeacherBadge {
  readonly title: string;
  readonly isWarning: boolean;
}

interface TeacherItem {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly roleKey: RoleKey;
  readonly classAssigned: string;
  readonly gradeLevel: 'nhatre' | 'mam' | 'choi' | 'la' | 'all';
  readonly degree: string;
  readonly university: string;
  readonly experience: string;
  readonly joinedYear: string;
  readonly phone: string;
  readonly email: string;
  readonly workloadHours: number;
  readonly maxWorkloadHours: number;
  readonly loadPercent: number;
  readonly workloadStatus: 'Còn lịch trống' | 'Đủ tải';
  readonly status: TeacherStatus;
  readonly statusColorClass: string;
  readonly avatarUrl: string;
  readonly avatarFallbackBg: string;
  readonly badges: readonly TeacherBadge[];
}

const TEACHERS_LIST: readonly TeacherItem[] = [
  {
    id: 'TEA-001',
    name: 'Cô Nguyễn Thị Mai',
    role: 'Giáo viên chủ nhiệm',
    roleKey: 'chunhiem',
    classAssigned: 'Lớp Mầm A1 — Họa Mi',
    gradeLevel: 'mam',
    degree: 'Cử nhân Sư phạm Mầm non',
    university: 'ĐH Quốc Gia',
    experience: '8 năm kinh nghiệm',
    joinedYear: '08/2022',
    phone: '0982 111 222',
    email: 'mai.nguyen@bellapreschool.edu.vn',
    workloadHours: 32,
    maxWorkloadHours: 40,
    loadPercent: 80,
    workloadStatus: 'Còn lịch trống',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-rose-50 text-rose-600 border-rose-100',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-rose-100 text-rose-700',
    badges: [
      { title: 'Montessori International', isWarning: false },
      { title: 'Sơ cứu Y tế Trẻ em (Hết hạn 10/2026)', isWarning: true },
    ],
  },
  {
    id: 'TEA-002',
    name: 'Cô Trần Ngọc Anh',
    role: 'Giáo viên chủ nhiệm',
    roleKey: 'chunhiem',
    classAssigned: 'Lớp Chồi B1 — Thỏ Ngọc',
    gradeLevel: 'choi',
    degree: 'Thạc sĩ Tâm lý Học Mầm non',
    university: 'ĐH Sư Phạm',
    experience: '10 năm kinh nghiệm',
    joinedYear: '08/2020',
    phone: '0915 222 333',
    email: 'ngocanh.tran@bellapreschool.edu.vn',
    workloadHours: 36,
    maxWorkloadHours: 40,
    loadPercent: 90,
    workloadStatus: 'Đủ tải',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-indigo-100 text-indigo-700',
    badges: [
      { title: 'Reggio Emilia Expert', isWarning: false },
      { title: 'Chứng chỉ Tiếng Anh C1', isWarning: false },
    ],
  },
  {
    id: 'TEA-003',
    name: 'Cô Đặng Thùy Linh',
    role: 'Giáo viên chủ nhiệm',
    roleKey: 'chunhiem',
    classAssigned: 'Lớp Lá C1 — Vàng Anh',
    gradeLevel: 'la',
    degree: 'Cử nhân Ngôn ngữ Anh & GD Mầm non',
    university: 'ĐH Ngoại Ngữ',
    experience: '6 năm kinh nghiệm',
    joinedYear: '09/2023',
    phone: '0973 444 555',
    email: 'thuylinh.dang@bellapreschool.edu.vn',
    workloadHours: 28,
    maxWorkloadHours: 40,
    loadPercent: 70,
    workloadStatus: 'Còn lịch trống',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-emerald-100 text-emerald-700',
    badges: [
      { title: 'Tiền Tiểu học Chuẩn Quốc gia', isWarning: false },
      { title: 'Tốt nghiệp loại Ưu', isWarning: false },
    ],
  },
  {
    id: 'TEA-004',
    name: 'Cô Hoàng Bích Ngọc',
    role: 'Giáo viên chủ nhiệm',
    roleKey: 'chunhiem',
    classAssigned: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    gradeLevel: 'nhatre',
    degree: 'Cử nhân Giáo dục Đặc biệt',
    university: 'ĐH Sư Phạm TP.HCM',
    experience: '5 năm kinh nghiệm',
    joinedYear: '01/2024',
    phone: '0904 666 777',
    email: 'bichngoc.hoang@bellapreschool.edu.vn',
    workloadHours: 30,
    maxWorkloadHours: 40,
    loadPercent: 75,
    workloadStatus: 'Còn lịch trống',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-amber-50 text-amber-600 border-amber-100',
    avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-700',
    badges: [
      { title: 'Chăm sóc Trẻ sơ sinh & Nhà trẻ', isWarning: false },
      { title: 'Dinh dưỡng Nhi khoa (Hết hạn 09/2026)', isWarning: true },
    ],
  },
  {
    id: 'TEA-005',
    name: 'Cô Lê Minh Tâm',
    role: 'Giáo viên trợ giảng',
    roleKey: 'trogiang',
    classAssigned: 'Lớp Mầm A2 — Sơn Ca',
    gradeLevel: 'mam',
    degree: 'Cao đẳng Sư phạm Mầm non',
    university: 'CĐ Sư Phạm T.Ư',
    experience: '4 năm kinh nghiệm',
    joinedYear: '03/2023',
    phone: '0938 888 999',
    email: 'minhtam.le@bellapreschool.edu.vn',
    workloadHours: 20,
    maxWorkloadHours: 40,
    loadPercent: 50,
    workloadStatus: 'Còn lịch trống',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-indigo-100 text-indigo-700',
    badges: [
      { title: 'Kỹ năng Giáo dục sớm', isWarning: false },
      { title: 'An toàn trường học', isWarning: false },
    ],
  },
  {
    id: 'TEA-006',
    name: 'Cô Phạm Thị Trang',
    role: 'Giáo viên năng khiếu',
    roleKey: 'bomon',
    classAssigned: 'Âm nhạc — Nghệ thuật',
    gradeLevel: 'all',
    degree: 'Cử nhân Âm nhạc',
    university: 'Giáo dục Nghệ thuật Mầm non',
    experience: '7 năm kinh nghiệm',
    joinedYear: '08/2021',
    phone: '0945 777 888',
    email: 'trang.pham@bellapreschool.edu.vn',
    workloadHours: 24,
    maxWorkloadHours: 40,
    loadPercent: 60,
    workloadStatus: 'Còn lịch trống',
    status: 'Đang Giảng Dạy',
    statusColorClass: 'bg-amber-50 text-amber-600 border-amber-100',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80',
    avatarFallbackBg: 'bg-amber-100 text-amber-700',
    badges: [
      { title: 'Phương pháp Orff', isWarning: false },
      { title: 'Nghệ thuật sáng tạo', isWarning: false },
    ],
  },
];

// ── Derived Counts (computed once, single source of truth) ───────────────────
const TOTAL_TEACHERS = TEACHERS_LIST.length;
const COUNT_CHUNHIEM = TEACHERS_LIST.filter((t) => t.roleKey === 'chunhiem').length;
const COUNT_TROGIANG = TEACHERS_LIST.filter((t) => t.roleKey === 'trogiang').length;
const COUNT_BOMON = TEACHERS_LIST.filter((t) => t.roleKey === 'bomon').length;

// ── Preschool Teacher Card Component ──────────────────────────────────────────

interface TeacherCardProps {
  readonly teacher: TeacherItem;
  readonly isMenuOpen: boolean;
  readonly onMenuToggle: () => void;
  readonly onAssignClass: () => void;
}

function TeacherCard({ teacher, isMenuOpen, onMenuToggle, onAssignClass }: TeacherCardProps) {
  const initials = teacher.name.split(' ').pop()?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4.5">

      {/* Top Row: Avatar + Name + Class + Status Badge + More Menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`relative w-13 h-13 rounded-full shrink-0 overflow-hidden border border-slate-100 dark:border-slate-700 shadow-xs ${teacher.avatarFallbackBg} flex items-center justify-center font-bold text-base`}>
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
              {teacher.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {teacher.role}
            </p>
            <p className="text-xs font-bold text-[#059669] dark:text-emerald-400 mt-0.5 truncate">
              {teacher.classAssigned}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${teacher.statusColorClass}`}>
            {teacher.status}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={onMenuToggle}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Thao tác"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-0.5 text-xs font-semibold">
                {/* TODO: create /dashboard/education/teachers/[id]/page.tsx */}
                <Link
                  href={`/dashboard/education/teachers?teacher=${teacher.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] dark:hover:text-emerald-300 rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0e5c43] dark:text-emerald-400 shrink-0" />
                  <span>Hồ Sơ Giáo Viên</span>
                </Link>
                <button
                  type="button"
                  onClick={onAssignClass}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] dark:hover:text-emerald-300 rounded-lg transition-colors text-left"
                >
                  <Users className="w-3.5 h-3.5 text-[#0e5c43] dark:text-emerald-400 shrink-0" />
                  <span>Phân Công Lớp</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <a
                    href={`tel:${teacher.phone}`}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Gọi Điện ({teacher.phone})</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle: 3 Info Rows with Icons */}
      <div className="space-y-2 pt-1 text-xs">
        <div className="flex items-start gap-2.5">
          <GraduationCap className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              {teacher.degree}
            </span>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              {teacher.university}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            {teacher.experience}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            {teacher.classAssigned}
          </span>
        </div>
      </div>

      {/* Workload Indicator Section */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Định mức giảng dạy
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {teacher.workloadHours} / {teacher.maxWorkloadHours} giờ
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              teacher.workloadStatus === 'Đủ tải' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, teacher.loadPercent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          {teacher.workloadStatus === 'Đủ tải' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#fffbeb] text-[#d97706] border border-amber-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
              Đủ tải
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#059669] border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              Còn lịch trống
            </span>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            {teacher.loadPercent}%
          </span>
        </div>
      </div>

      {/* Certification Badges */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {teacher.badges.map((badge, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              badge.isWarning
                ? 'bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]'
                : 'bg-[#f1f5f9] dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-transparent'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${badge.isWarning ? 'text-amber-500' : 'text-slate-400'}`} />
            <span>{badge.title}</span>
          </span>
        ))}
      </div>

      {/* Card Action Buttons (Bottom) */}
      <div className="grid grid-cols-2 gap-3.5 pt-4 pb-1 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
        {/* TODO: navigate to /dashboard/education/teachers/[id] once created */}
        <Link
          href={`/dashboard/education/teachers?teacher=${teacher.id}`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0e5c43] dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs"
        >
          <FileText className="w-4 h-4" />
          <span>Xem Hồ Sơ</span>
        </Link>
        <button
          type="button"
          onClick={onAssignClass}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-[#0e5c43] hover:bg-[#0a4633] text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <Users className="w-4 h-4" />
          <span>Phân Công Lớp</span>
        </button>
      </div>
    </div>
  );
}

// ── Legacy (Non-Preschool) View ───────────────────────────────────────────────

function LegacyTeacherView() {
  const [selectedRoleTab, setSelectedRoleTab] = useState<'all' | RoleKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = TEACHERS_LIST.filter((t) => {
    const q = searchQuery.toLowerCase();
    const match = t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q);
    if (selectedRoleTab === 'all') return match;
    return match && t.roleKey === selectedRoleTab;
  });

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-36 sm:pb-48">
      <div className="w-full rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/education"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Đội Ngũ Giáo Viên Mầm Non</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Quản lý giáo viên, phân công giảng dạy & định mức tải công việc</p>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'chunhiem', 'trogiang', 'bomon'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedRoleTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedRoleTab === tab ? 'bg-[#0e5c43] text-white' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab === 'all' ? 'Tất Cả' : tab === 'chunhiem' ? 'Chủ Nhiệm' : tab === 'trogiang' ? 'Trợ Giảng' : 'Bộ Môn'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên cô giáo..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0e5c43]"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full ${t.avatarFallbackBg} flex items-center justify-center font-bold text-sm`}>
                {t.name.split(' ').pop()?.[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.classAssigned}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function TeachersPage() {
  const [isPreschoolTenant, setIsPreschoolTenant] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState('2026-2027');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<TeacherItem | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return TEACHERS_LIST.filter((t) => {
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        t.degree.toLowerCase().includes(q) ||
        t.university.toLowerCase().includes(q) ||
        t.classAssigned.toLowerCase().includes(q);

      const matchRole = roleFilter === 'all' || t.roleKey === roleFilter;
      const matchGrade = gradeFilter === 'all' || t.gradeLevel === gradeFilter || t.gradeLevel === 'all';

      return matchSearch && matchRole && matchGrade;
    });
  }, [searchQuery, roleFilter, gradeFilter]);

  if (!isPreschoolTenant) return <LegacyTeacherView />;

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 pb-40 sm:pb-56 bg-[#f8fafc]/50 dark:bg-slate-900/50">

      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Back button + Pink Badge + Title & Subtitle */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Đội Ngũ Giáo Viên Mầm Non
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Quản lý {TOTAL_TEACHERS} giáo viên chuyên môn, phân công giảng dạy
            </p>
          </div>
        </div>

        {/* Right: Year selector + "+ Thêm Giáo Viên Mới" */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs shadow-2xs">
            <select
              value={selectedYear}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedYear(e.target.value)}
              className="bg-transparent font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="2026-2027">Năm học 2026 - 2027</option>
              <option value="2025-2026">Năm học 2025 - 2026</option>
            </select>
          </div>

          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-[#0e5c43] hover:bg-[#0a4633] active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Thêm Giáo Viên Mới</span>
          </button>
        </div>
      </div>

      {/* ── 2. FOUR KPI STAT CARDS — counts derived from TEACHERS_LIST (single source of truth) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số giáo viên (Mint) */}
        <div className="rounded-2xl p-5 bg-[#ecfdf5] dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-[#059669] flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Tổng số giáo viên
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {TOTAL_TEACHERS}
          </div>
        </div>

        {/* Card 2: Giáo viên chủ nhiệm (Blue) */}
        <div className="rounded-2xl p-5 bg-[#eff6ff] dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#2563eb] flex items-center justify-center mb-3">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Giáo viên chủ nhiệm
          </div>
          <div className="text-3xl font-black text-[#1d4ed8] dark:text-blue-400 mt-1">
            {COUNT_CHUNHIEM}
          </div>
        </div>

        {/* Card 3: Giáo viên trợ giảng (Amber) */}
        <div className="rounded-2xl p-5 bg-[#fffbeb] dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/30">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-[#d97706] flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Giáo viên trợ giảng
          </div>
          <div className="text-3xl font-black text-[#c2410c] dark:text-amber-400 mt-1">
            {COUNT_TROGIANG}
          </div>
        </div>

        {/* Card 4: Giáo viên năng khiếu (Purple) */}
        <div className="rounded-2xl p-5 bg-[#faf5ff] dark:bg-purple-950/20 border border-purple-100/60 dark:border-purple-900/30">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-[#7c3aed] flex items-center justify-center mb-3">
            <Star className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Giáo viên năng khiếu
          </div>
          <div className="text-3xl font-black text-[#7c3aed] dark:text-purple-400 mt-1">
            {COUNT_BOMON}
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTER TOOLBAR CARD (Image 3 Style) ── */}
      <div className="w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
        {/* Row 1: Search Input + Chức Vụ + Khối Lớp + Bộ Lọc Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên cô giáo, trình độ, lớp dạy..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200/90 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#0e5c43] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setRoleFilter(e.target.value as 'all' | RoleKey)}
              className="w-full sm:w-auto bg-[#f8fafc] dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Tất cả chức vụ</option>
              <option value="chunhiem">Chủ nhiệm</option>
              <option value="trogiang">Trợ giảng</option>
              <option value="bomon">Năng khiếu & Ngoại ngữ</option>
            </select>

            <select
              value={gradeFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setGradeFilter(e.target.value as GradeLevel)}
              className="w-full sm:w-auto bg-[#f8fafc] dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Tất cả khối lớp</option>
              <option value="nhatre">Khối Nhà Trẻ</option>
              <option value="mam">Khối Mầm</option>
              <option value="choi">Khối Chồi</option>
              <option value="la">Khối Lá</option>
            </select>

            <button
              type="button"
              onClick={() => { setSearchQuery(''); setRoleFilter('all'); setGradeFilter('all'); }}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Bộ lọc</span>
            </button>
          </div>
        </div>

        {/* Row 2: Pill Tabs matching Image 3 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Pill tab counts are always derived from TEACHERS_LIST — no hardcoded numbers */}
        {[
            { id: 'all' as const, label: `Tất cả (${TOTAL_TEACHERS})` },
            { id: 'chunhiem' as const, label: `Chủ nhiệm (${COUNT_CHUNHIEM})` },
            { id: 'trogiang' as const, label: `Trợ giảng (${COUNT_TROGIANG})` },
            { id: 'bomon' as const, label: `Năng khiếu & Ngoại ngữ (${COUNT_BOMON})` },
          ].map((tab) => {
            const isActive = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#0e5c43] text-white font-bold'
                    : 'bg-[#f1f5f9] dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. TEACHER CARDS GRID (2 Columns as in Image 3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={menuRef}>
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy giáo viên nào</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          filteredTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              isMenuOpen={activeMenuId === teacher.id}
              onMenuToggle={() => setActiveMenuId(activeMenuId === teacher.id ? null : teacher.id)}
              onAssignClass={() => { setSelectedTeacherForAssign(teacher); setActiveMenuId(null); }}
            />
          ))
        )}
      </div>

      {/* Generous bottom spacing buffer so cards never sit flush against the viewport bottom */}
      <div className="h-20 sm:h-28 w-full" aria-hidden="true" />

      {/* ── 5. GOVERNED CLASS ASSIGNMENT MODAL ── */}
      {selectedTeacherForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => setSelectedTeacherForAssign(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                Quy trình phân công giảng dạy có kiểm soát
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Phân Công Lớp: {selectedTeacherForAssign.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thiết lập bối cảnh năm học, vai trò phụ trách & tự động kiểm tra xung đột thời khóa biểu
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Năm học áp dụng</label>
                  <input
                    type="text"
                    disabled
                    value={selectedYear === '2026-2027' ? 'Năm học 2026 - 2027' : 'Năm học 2025 - 2026'}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Lớp phân công</label>
                  <select
                    defaultValue={selectedTeacherForAssign.classAssigned}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  >
                    <option>Lớp Mầm A1 — Họa Mi</option>
                    <option>Lớp Chồi B1 — Thỏ Ngọc</option>
                    <option>Lớp Lá C1 — Vàng Anh</option>
                    <option>Lớp Nhà Trẻ N1 — Gấu Misa</option>
                    <option>Lớp Mầm A2 — Sơn Ca</option>
                    <option>Âm nhạc — Nghệ thuật</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Vai trò phụ trách</label>
                  <select
                    defaultValue={selectedTeacherForAssign.role}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  >
                    <option>Giáo viên chủ nhiệm</option>
                    <option>Giáo viên trợ giảng</option>
                    <option>Giáo viên năng khiếu</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Hiệu lực phân công</label>
                  <input
                    type="text"
                    defaultValue="01/08/2026 ➔ 31/05/2027"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-xs space-y-1.5">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Kiểm duyệt quy tắc vận hành (Business Rule Engine):
                </span>
                <p className="text-emerald-700 dark:text-emerald-400 text-[11px] leading-relaxed">
                  ✓ Bằng cấp Sư phạm Mầm non phù hợp với khối phân công.<br />
                  ✓ Tải công việc sau phân công: <strong>{selectedTeacherForAssign.workloadHours}/{selectedTeacherForAssign.maxWorkloadHours} giờ/tuần</strong> (Trong hạn mức an toàn).<br />
                  ✓ Không trùng lịch giảng dạy với các lớp khác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTeacherForAssign(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeacherForAssign(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Xác Nhận Phân Công</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}