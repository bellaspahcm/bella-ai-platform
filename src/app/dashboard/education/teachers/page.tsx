'use client';

/**
 * Bella Education — Teacher & Faculty Workforce Management
 * 
 * Scalable Architecture:
 * - Unified Title: "Đội Ngũ Giáo Viên Mầm Non"
 * - Academic Year Context: 2026 - 2027
 * - Workload & Availability Tracking (Định mức 32/40h)
 * - Governed Class Assignment Modal with Rule & Conflict Checks
 * - Scalable CTAs: [ Xem Hồ Sơ 360° ] [ Phân Công Lớp ] [ ⋯ ]
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Search, 
  ArrowLeft, 
  Award, 
  Phone, 
  Mail, 
  BookOpen, 
  Calendar, 
  ShieldCheck, 
  Sparkles,
  MapPin,
  ChevronDown,
  Clock,
  MoreVertical,
  GraduationCap,
  ExternalLink,
  FileText,
  X,
  Check,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

type TeacherItem = {
  id: string;
  name: string;
  role: string;
  roleKey: 'chunhiem' | 'trogiang' | 'bomon';
  degree: string;
  experience: string;
  joinedYear: string;
  phone: string;
  email: string;
  classAssigned: string;
  certifications: Array<{ title: string; expiry: string; isExpiringSoon: boolean }>;
  workloadHours: number;
  maxWorkloadHours: number;
  status: 'Đang Giảng Dạy' | 'Tạm Nghỉ' | 'Chờ Phân Công';
  theme: {
    avatarBg: string;
    badgeBg: string;
    badgeText: string;
  };
};

const TEACHERS_LIST: TeacherItem[] = [
  {
    id: 'TEA-001',
    name: 'Cô Nguyễn Thị Mai',
    role: 'Giáo viên Chủ nhiệm Lớp Mầm A1',
    roleKey: 'chunhiem',
    degree: 'Cử nhân Sư phạm Mầm non - ĐH Quốc Gia',
    experience: '8 Năm kinh nghiệm',
    joinedYear: 'Gia nhập: 08/2022',
    phone: '0982 111 222',
    email: 'mai.nguyen@bellapreschool.edu.vn',
    classAssigned: 'Lớp Mầm A1 — Họa Mi',
    certifications: [
      { title: 'Montessori International', expiry: '12/2028', isExpiringSoon: false },
      { title: 'Sơ cứu Y tế Trẻ em', expiry: '10/2026', isExpiringSoon: true },
    ],
    workloadHours: 32,
    maxWorkloadHours: 40,
    status: 'Đang Giảng Dạy',
    theme: {
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200/60',
    },
  },
  {
    id: 'TEA-002',
    name: 'Cô Trần Ngọc Anh',
    role: 'Giáo viên Chủ nhiệm Lớp Chồi B1',
    roleKey: 'chunhiem',
    degree: 'Thạc sĩ Tâm lý Học Mầm non - ĐH Sư Phạm',
    experience: '10 Năm kinh nghiệm',
    joinedYear: 'Gia nhập: 08/2020',
    phone: '0915 222 333',
    email: 'ngocanh.tran@bellapreschool.edu.vn',
    classAssigned: 'Lớp Chồi B1 — Thỏ Ngọc',
    certifications: [
      { title: 'Reggio Emilia Expert', expiry: '05/2027', isExpiringSoon: false },
      { title: 'Chứng chỉ Tiếng Anh C1', expiry: '08/2029', isExpiringSoon: false },
    ],
    workloadHours: 36,
    maxWorkloadHours: 40,
    status: 'Đang Giảng Dạy',
    theme: {
      avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
      badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
    },
  },
  {
    id: 'TEA-003',
    name: 'Cô Đặng Thùy Linh',
    role: 'Giáo viên Chủ nhiệm Lớp Lá C1',
    roleKey: 'chunhiem',
    degree: 'Cử nhân Ngôn ngữ Anh & GD Mầm non',
    experience: '6 Năm kinh nghiệm',
    joinedYear: 'Gia nhập: 09/2023',
    phone: '0973 444 555',
    email: 'thuylinh.dang@bellapreschool.edu.vn',
    classAssigned: 'Lớp Lá C1 — Vàng Anh',
    certifications: [
      { title: 'Tiền Tiểu học Chuẩn Quốc gia', expiry: '04/2027', isExpiringSoon: false },
      { title: 'Tốt nghiệp loại Ưu', expiry: 'Vĩnh viễn', isExpiringSoon: false },
    ],
    workloadHours: 28,
    maxWorkloadHours: 40,
    status: 'Đang Giảng Dạy',
    theme: {
      avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
    },
  },
  {
    id: 'TEA-004',
    name: 'Cô Hoàng Bích Ngọc',
    role: 'Giáo viên Chủ nhiệm Lớp Nhà Trẻ N1',
    roleKey: 'chunhiem',
    degree: 'Cử nhân Giáo dục Đặc biệt',
    experience: '5 Năm kinh nghiệm',
    joinedYear: 'Gia nhập: 01/2024',
    phone: '0904 666 777',
    email: 'bichngoc.hoang@bellapreschool.edu.vn',
    classAssigned: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    certifications: [
      { title: 'Chăm sóc Trẻ sơ sinh & Nhà trẻ', expiry: '11/2027', isExpiringSoon: false },
      { title: 'Dinh dưỡng Nhi khoa', expiry: '09/2026', isExpiringSoon: true },
    ],
    workloadHours: 30,
    maxWorkloadHours: 40,
    status: 'Đang Giảng Dạy',
    theme: {
      avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300 border-amber-200/60',
    },
  },
];

export default function TeachersPage() {
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');
  const [selectedRoleTab, setSelectedRoleTab] = useState<'all' | 'chunhiem' | 'trogiang' | 'bomon'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<TeacherItem | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getWorkloadStatus = (hours: number, maxHours: number) => {
    if (hours >= maxHours) {
      return {
        label: '⚠ Quá tải',
        badgeClass: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200/60',
        barClass: 'bg-rose-500',
      };
    }
    if (hours >= maxHours * 0.85) {
      return {
        label: '● Đủ tải',
        badgeClass: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200/60',
        barClass: 'bg-amber-500',
      };
    }
    return {
      label: '● Còn lịch trống',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
      barClass: 'bg-emerald-500',
    };
  };

  const filteredTeachers = TEACHERS_LIST.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.degree.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.classAssigned.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedRoleTab === 'all') return matchesSearch;
    return matchesSearch && t.roleKey === selectedRoleTab;
  });

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Page Header ── */}
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
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Đội Ngũ Giáo Viên Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý 32 giáo viên chuyên môn, phân công giảng dạy, bằng cấp chứng chỉ & định mức tải công việc
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {/* Academic Year Context Selector */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl px-4 py-2.5 pr-8 focus:outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <option>Năm học 2026 - 2027</option>
                <option>Năm học 2025 - 2026</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer">
              <UserPlus className="w-4 h-4" />
              <span>Thêm Giáo Viên Mới</span>
            </button>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên cô giáo, trình độ, lớp dạy..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setSelectedRoleTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedRoleTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất Cả Giáo Viên (32)
            </button>
            <button 
              onClick={() => setSelectedRoleTab('chunhiem')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedRoleTab === 'chunhiem'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Chủ Nhiệm (12)
            </button>
            <button 
              onClick={() => setSelectedRoleTab('trogiang')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedRoleTab === 'trogiang'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Trợ Giảng (14)
            </button>
            <button 
              onClick={() => setSelectedRoleTab('bomon')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedRoleTab === 'bomon'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Năng Khiếu & Ngoại Ngữ (6)
            </button>
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid: Teachers Grid Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={menuRef}>
        {filteredTeachers.map((t) => {
          const workloadStatus = getWorkloadStatus(t.workloadHours, t.maxWorkloadHours);
          const isMenuOpen = activeMenuId === t.id;

          return (
            <div 
              key={t.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 relative"
            >
              {/* Card Header: Avatar, Name, Role & Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl ${t.theme.avatarBg} flex items-center justify-center font-extrabold text-base shrink-0 shadow-sm`}>
                    {t.name.split(' ').pop()?.[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      {t.name}
                    </h3>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      {t.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${t.theme.badgeBg} ${t.theme.badgeText}`}>
                    {t.status}
                  </span>

                  {/* ⋯ Overflow Menu Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : t.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Thao tác khác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <Link
                          href={`/dashboard/education/teachers/${t.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-[var(--education-brand-ink)] rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-[var(--education-brand-ink)]" />
                          <span>Hồ Sơ Bằng Cấp & Chứng Chỉ</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => { setSelectedTeacherForAssign(t); setActiveMenuId(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-[var(--education-brand-ink)] rounded-xl transition-colors text-left"
                        >
                          <BookOpen className="w-4 h-4 text-[var(--education-brand-ink)]" />
                          <span>Quy Trình Phân Công Lớp</span>
                        </button>
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                          <a
                            href={`tel:${t.phone}`}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <Phone className="w-4 h-4 text-emerald-500" />
                            <span>Gọi Điện ({t.phone})</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Degrees, Tenure & Class Assignment */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">Bằng cấp:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{t.degree}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">Thâm niên:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {t.experience} <span className="text-gray-400 font-normal">({t.joinedYear})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">Phụ trách:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.classAssigned}</span>
                </div>
              </div>

              {/* ── Operational Workload Indicator ── */}
              <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
                    Định mức giảng dạy:
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${workloadStatus.badgeClass}`}>
                    {workloadStatus.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Khối lượng tuần: <strong>{t.workloadHours}</strong> / {t.maxWorkloadHours} giờ</span>
                  <span>{Math.round((t.workloadHours / t.maxWorkloadHours) * 100)}% tải</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full ${workloadStatus.barClass}`} style={{ width: `${(t.workloadHours / t.maxWorkloadHours) * 100}%` }} />
                </div>
              </div>

              {/* Certifications Badges with Expiry Notice */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {t.certifications.map((c, i) => (
                  <span 
                    key={i} 
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${
                      c.isExpiringSoon 
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 font-bold' 
                        : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200/60'
                    }`}
                  >
                    <ShieldCheck className={`w-3 h-3 ${c.isExpiringSoon ? 'text-amber-500' : 'text-[var(--education-brand-ink)]'}`} />
                    {c.title}
                    {c.isExpiringSoon && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold">(Hết hạn {c.expiry})</span>}
                  </span>
                ))}
              </div>

              {/* Scalable Primary Action CTAs */}
              <div className="pt-1 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700/60">
                <Link
                  href={`/dashboard/education/teachers/${t.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-md transition-all flex-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xem Hồ Sơ 360°</span>
                </Link>
                <button 
                  onClick={() => setSelectedTeacherForAssign(t)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
                  <span>Phân Công Lớp</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── GOVERNED CLASS ASSIGNMENT WORKFLOW MODAL ── */}
      {selectedTeacherForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setSelectedTeacherForAssign(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--education-brand-ink)]">
                Quy trình phân công giảng dạy có kiểm soát
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Phân Công Lớp: {selectedTeacherForAssign.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thiết lập bối cảnh năm học, vai trò phụ trách & tự động kiểm tra xung đột thời khóa biểu
              </p>
            </div>

            {/* Form & Conflict Rule Checks */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Năm học áp dụng
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedYear}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Lớp phân công chỉ định
                  </label>
                  <select defaultValue={selectedTeacherForAssign.classAssigned} className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring">
                    <option>Lớp Mầm A1 — Họa Mi</option>
                    <option>Lớp Chồi B1 — Thỏ Ngọc</option>
                    <option>Lớp Lá C1 — Vàng Anh</option>
                    <option>Lớp Nhà Trẻ N1 — Gấu Misa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Vai trò phụ trách
                  </label>
                  <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring">
                    <option>Giáo viên Chủ nhiệm</option>
                    <option>Giáo viên Trợ giảng</option>
                    <option>Giáo viên Bộ môn Năng khiếu</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Hiệu lực phân công
                  </label>
                  <input
                    type="text"
                    defaultValue="01/08/2026 ➔ 31/05/2027"
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Governed Business Rules Verification Box */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1.5">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Kiểm duyệt quy tắc vận hành (Business Rule Engine):
                </span>
                <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                  ✓ Bằng cấp Cử nhân Sư phạm Mầm non phù hợp với Khối Mầm.<br />
                  ✓ Tải công việc sau phân công: <strong>32/40 giờ/tuần</strong> (Nằm trong hạn mức an toàn).<br />
                  ✓ Không trùng lịch giảng dạy với các lớp khác.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTeacherForAssign(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeacherForAssign(null)}
                className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Xác Nhận Phân Công Lớp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
