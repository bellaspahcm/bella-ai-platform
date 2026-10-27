'use client';

/** Bella Preschool teacher list: original presentation, canonical branch and teacher reads. */

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  ArrowLeft,
  BookOpen,
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
  Mail,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Baby,
} from 'lucide-react';
import { loadAllClassAssignments, loadAllConfirmedTeachers, loadTeacherBranches,
  loadTeacherClasses, localDate, type TeacherBranch, type TeacherClass } from './teacher-live-data';

// ── Strict Types ──────────────────────────────────────────────────────────────

type RoleKey = 'chunhiem' | 'trogiang' | 'bomon' | 'all';
type TeacherStatus = 'Đã xác nhận';
type GradeLevel = 'all' | 'nhatre' | 'mam' | 'choi' | 'la';

interface TeacherBadge {
  readonly title: string;
  readonly isWarning: boolean;
}

interface TeacherItem {
  readonly id: string;
  readonly branchId: string;
  readonly confirmationId: string;
  readonly classId: string | null;
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

// ── Preschool Teacher Card Component ──────────────────────────────────────────

interface TeacherCardProps {
  readonly teacher: TeacherItem;
  readonly isMenuOpen: boolean;
  readonly onMenuToggle: () => void;
  readonly onAssignClass: () => void;
  readonly onOpenProfile: () => void;
}

function TeacherCard({ teacher, isMenuOpen, onMenuToggle, onAssignClass, onOpenProfile }: TeacherCardProps) {
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
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] dark:hover:text-emerald-300 rounded-lg transition-colors text-left cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0e5c43] dark:text-emerald-400 shrink-0" />
                  <span>Xem Hồ Sơ (Popup)</span>
                </button>
                <Link
                  href={`/dashboard/education/teachers/${teacher.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] dark:hover:text-emerald-300 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Hồ Sơ 360° Đầy Đủ</span>
                </Link>
                <button
                  type="button"
                  onClick={onAssignClass}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#0e5c43]/10 hover:text-[#0e5c43] dark:hover:text-emerald-300 rounded-lg transition-colors text-left cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#0e5c43] dark:text-emerald-400 shrink-0" />
                  <span>Phân Công Lớp</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 space-y-0.5">
                  <a
                    href={teacher.phone ? `tel:${teacher.phone}` : undefined}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{teacher.phone ? `Gọi Điện (${teacher.phone})` : 'Điện thoại: chưa được cung cấp'}</span>
                  </a>
                  <a
                    href={teacher.email ? `mailto:${teacher.email}` : undefined}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{teacher.email ? 'Gửi Email' : 'Email: chưa được cung cấp'}</span>
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
            {teacher.maxWorkloadHours ? `${teacher.workloadHours} / ${teacher.maxWorkloadHours} giờ` : 'Chưa được cung cấp'}
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
          {teacher.maxWorkloadHours === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#f1f5f9] text-slate-600 border border-slate-200">Chưa xác minh</span>
          ) : teacher.workloadStatus === 'Đủ tải' ? (
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
            {teacher.maxWorkloadHours ? `${teacher.loadPercent}%` : '—'}
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
        <button
          type="button"
          onClick={onOpenProfile}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0e5c43] dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs cursor-pointer active:scale-95"
        >
          <FileText className="w-4 h-4" />
          <span>Xem Hồ Sơ</span>
        </button>
        {teacher.roleKey === 'chunhiem' && teacher.classId ? (
          <Link
            href={`/dashboard/education/courses/${teacher.classId}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-[#0e5c43] hover:bg-[#0a4633] text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Baby className="w-4 h-4" />
            <span>Vào Lớp Phụ Trách</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAssignClass}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-[#0e5c43] hover:bg-[#0a4633] text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Phân Công Lớp</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function TeachersPage() {
  const [selectedYear, setSelectedYear] = useState('2026-2027');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<TeacherItem | null>(null);
  const [teachers, setTeachers] = useState<readonly TeacherItem[]>([]);
  const [branches, setBranches] = useState<readonly TeacherBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [classes, setClasses] = useState<readonly TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const pendingAssignment = useRef<Record<string, unknown> | null>(null);
  const [selectedTeacherForProfile, setSelectedTeacherForProfile] = useState<TeacherItem | null>(null);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Derived counts (single source of truth from state)
  const totalTeachers = teachers.length;
  const countChunhiem = teachers.filter((t) => t.roleKey === 'chunhiem').length;
  const countTrogiang = teachers.filter((t) => t.roleKey === 'trogiang').length;
  const countBomon = '—'; // The approved teacher roles do not establish a specialty category.

  // Use the authorized branch list; never combine teachers across an inferred branch.
  useEffect(() => {
    const controller = new AbortController();
    void loadTeacherBranches(controller.signal).then(items => {
      if (controller.signal.aborted) return;
      setBranches(items);
      setBranchId(current => items.some(item => item.id === current) ? current : items.length === 1 ? items[0].id : '');
      setLoadError('');
      if (items.length !== 1) setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) { setLoadError('Không tải được chi nhánh được phân quyền.'); setLoading(false); } });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!branchId) { setTeachers([]); setClasses([]); return; }
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    void (async () => {
      const [people, mappedClasses] = await Promise.all([
        loadAllConfirmedTeachers(branchId, localDate(), controller.signal),
        loadTeacherClasses(branchId, controller.signal),
      ]);
      const assignments = await Promise.all(mappedClasses.map(item =>
        loadAllClassAssignments(branchId, item.id, localDate(), controller.signal)));
      if (controller.signal.aborted) return;
      setClasses(mappedClasses);
      setTeachers(people.map(person => {
        const current = assignments.flat().filter(item => item.teacherPartyId === person.partyId
          && item.status === 'active' && item.effectiveOnDate && item.eligibility === 'confirmed');
        const first = current[0];
        const roleKey: RoleKey = first?.role === 'lead_teacher' ? 'chunhiem'
          : first?.role === 'assistant' ? 'trogiang' : 'all';
        const role = first?.role === 'lead_teacher' ? 'Giáo viên chủ nhiệm'
          : first?.role === 'assistant' ? 'Giáo viên trợ giảng'
          : first?.role === 'co_teacher' ? 'Giáo viên cùng lớp'
          : first?.role === 'substitute' ? 'Giáo viên thay thế' : 'Chưa phân công';
        const classAssigned = current.length ? current.map(item =>
          mappedClasses.find(course => course.id === item.courseId)?.title || 'Lớp không khả dụng').join(', ')
          : 'Chưa phân công lớp';
        return { id: person.partyId, branchId, confirmationId: person.confirmations[0]?.confirmationId ?? '',
          classId: first?.courseId ?? null,
          name: person.displayName, role, roleKey, classAssigned, gradeLevel: 'all' as const,
          degree: 'Chưa được cung cấp', university: 'Chưa được cung cấp', experience: 'Chưa được cung cấp',
          joinedYear: 'Chưa được cung cấp', phone: '', email: '', workloadHours: 0, maxWorkloadHours: 0,
          loadPercent: 0, workloadStatus: 'Còn lịch trống' as const, status: 'Đã xác nhận' as const,
          statusColorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100', avatarUrl: '',
          avatarFallbackBg: 'bg-emerald-100 text-emerald-700', badges: [] };
      }));
      setLoading(false);
    })().catch(() => { if (!controller.signal.aborted) { setLoadError('Không tải được dữ liệu giáo viên hoặc phân công.'); setLoading(false); } });
    return () => controller.abort();
  }, [branchId, revision]);

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeacherForAssign || !branchId || saveLock.current) return;
    const form = new FormData(event.currentTarget);
    const courseId = String(form.get('classAssigned') ?? '');
    const role = String(form.get('role') ?? '');
    const startDate = String(form.get('effectiveStartDate') ?? '');
    if (!classes.some(item => item.id === courseId) || !selectedTeacherForAssign.confirmationId
      || !startDate || !['lead_teacher', 'co_teacher', 'assistant', 'substitute'].includes(role)) {
      setSaveError('Chọn lớp, vai trò và ngày hiệu lực hợp lệ.');
      return;
    }
    const payload = pendingAssignment.current ?? {
      action: 'assign', branchId, operationKey: crypto.randomUUID(), courseId,
      confirmationId: selectedTeacherForAssign.confirmationId,
      teacherPartyId: selectedTeacherForAssign.id, role, academicYear: selectedYear,
      effectiveStartDate: startDate, effectiveEndDate: null,
    };
    pendingAssignment.current = payload;
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/education/teachers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (!response.ok || body === null || typeof body !== 'object' || !('success' in body) || body.success !== true) {
        throw new Error('ASSIGN_FAILED');
      }
      pendingAssignment.current = null;
      setSelectedTeacherForAssign(null);
      setToastMessage(`Đã lưu phân công cho ${selectedTeacherForAssign.name}.`);
      setRevision(value => value + 1);
    } catch {
      setSaveError('Không lưu được phân công. Có thể thử lại cùng yêu cầu hoặc đóng để nhập lại.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

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
    return teachers.filter((t) => {
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        t.degree.toLowerCase().includes(q) ||
        t.university.toLowerCase().includes(q) ||
        t.classAssigned.toLowerCase().includes(q);

      const matchRole = roleFilter === 'all' || t.roleKey === roleFilter;
      const matchGrade = gradeFilter === 'all' || t.gradeLevel === gradeFilter;

      return matchSearch && matchRole && matchGrade;
    });
  }, [teachers, searchQuery, roleFilter, gradeFilter]);

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 pb-40 sm:pb-56 bg-[#f8fafc]/50 dark:bg-slate-900/50">

      {loadError && <p role="alert" className="text-xs font-semibold text-red-700">{loadError}</p>}
      {!branchId && !loading && !loadError && branches.length > 1 && <p role="status" className="text-xs font-semibold text-slate-600">Có nhiều chi nhánh được phân quyền; cần chọn chi nhánh trước khi xem giáo viên.</p>}

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-bold animate-in slide-in-from-top-4 duration-300">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-700 transition-colors ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              Quản lý {totalTeachers} giáo viên chuyên môn, phân công giảng dạy
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
            onClick={() => { setSaveError(''); setIsAddTeacherOpen(true); }}
            className="px-4 py-2.5 rounded-lg bg-[#0e5c43] hover:bg-[#0a4633] active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Thêm Giáo Viên Mới</span>
          </button>
        </div>
      </div>

      {/* ── 2. FOUR KPI STAT CARDS — counts derived from teachers state (single source of truth) ── */}
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
            {totalTeachers}
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
            {countChunhiem}
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
            {countTrogiang}
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
            {countBomon}
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
              <option value="bomon">Năng khiếu &amp; Ngoại ngữ</option>
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
          {[
            { id: 'all' as const, label: `Tất cả (${totalTeachers})` },
            { id: 'chunhiem' as const, label: `Chủ nhiệm (${countChunhiem})` },
            { id: 'trogiang' as const, label: `Trợ giảng (${countTrogiang})` },
            { id: 'bomon' as const, label: `Năng khiếu & Ngoại ngữ (${countBomon})` },
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
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{loading ? 'Đang tải giáo viên…' : loadError || !branchId ? 'Chưa xác định được chi nhánh' : roleFilter === 'bomon' ? 'Chưa có nguồn dữ liệu giáo viên năng khiếu' : gradeFilter !== 'all' ? 'Chưa có nguồn dữ liệu khối lớp của giáo viên' : totalTeachers === 0 ? 'Chưa có giáo viên được xác nhận' : 'Không tìm thấy giáo viên nào'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{loading ? 'Đang đọc dữ liệu của chi nhánh' : loadError || !branchId ? 'Chưa thể hiển thị danh sách giáo viên.' : totalTeachers === 0 ? 'Danh sách chỉ hiển thị người đã xác nhận tại chi nhánh.' : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'}</p>
          </div>
        ) : (
          filteredTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              isMenuOpen={activeMenuId === teacher.id}
              onMenuToggle={() => setActiveMenuId(activeMenuId === teacher.id ? null : teacher.id)}
              onAssignClass={() => { pendingAssignment.current = null; setSaveError(''); setSelectedTeacherForAssign(teacher); setActiveMenuId(null); }}
              onOpenProfile={() => { setSelectedTeacherForProfile(teacher); setActiveMenuId(null); }}
            />
          ))
        )}
      </div>

      {/* Generous bottom spacing buffer so cards never sit flush against the viewport bottom */}
      <div className="h-20 sm:h-28 w-full" aria-hidden="true" />

      {/* ── 5. TEACHER 360 PROFILE POPUP MODAL ── */}
      {selectedTeacherForProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => setSelectedTeacherForProfile(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className={`w-16 h-16 rounded-2xl ${selectedTeacherForProfile.avatarFallbackBg} flex items-center justify-center font-black text-2xl shrink-0 shadow-sm`}>
                {selectedTeacherForProfile.name.split(' ').pop()?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                    Hồ Sơ Giáo Viên 360° • {selectedTeacherForProfile.id}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${selectedTeacherForProfile.statusColorClass}`}>
                    {selectedTeacherForProfile.status}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedTeacherForProfile.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedTeacherForProfile.role} • <span className="font-bold text-[#059669] dark:text-emerald-400">{selectedTeacherForProfile.classAssigned}</span>
                </p>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Box 1: Thông tin liên hệ & Nhân sự */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Thông tin liên hệ &amp; Công tác
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Số điện thoại:</span>
                    <a href={selectedTeacherForProfile.phone ? `tel:${selectedTeacherForProfile.phone}` : undefined} className="font-bold text-emerald-600 hover:underline">
                      {selectedTeacherForProfile.phone || 'Chưa được cung cấp'}
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Email:</span>
                    <a href={selectedTeacherForProfile.email ? `mailto:${selectedTeacherForProfile.email}` : undefined} className="font-semibold text-slate-800 dark:text-slate-200 hover:underline truncate max-w-[180px]">
                      {selectedTeacherForProfile.email || 'Chưa được cung cấp'}
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Năm vào trường:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedTeacherForProfile.joinedYear}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Khối phụ trách:</span>
                    <span className="font-bold text-[#0e5c43] dark:text-emerald-400 uppercase">
                      {selectedTeacherForProfile.gradeLevel === 'all' ? 'Chưa được cung cấp' : `Khối ${selectedTeacherForProfile.gradeLevel}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: Trình độ chuyên môn & Học vấn */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Trình độ &amp; Bằng cấp
                </span>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Bằng cấp chuyên môn:</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedTeacherForProfile.degree}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Cơ sở đào tạo:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                      {selectedTeacherForProfile.university}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Kinh nghiệm:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedTeacherForProfile.experience}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: Định mức giờ dạy & Tải giảng dạy */}
            <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Định mức giảng dạy trong tuần
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {selectedTeacherForProfile.maxWorkloadHours ? `${selectedTeacherForProfile.workloadHours} / ${selectedTeacherForProfile.maxWorkloadHours} giờ (${selectedTeacherForProfile.loadPercent}%)` : 'Chưa được cung cấp'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    selectedTeacherForProfile.workloadStatus === 'Đủ tải' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, selectedTeacherForProfile.loadPercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {selectedTeacherForProfile.maxWorkloadHours === 0 ? 'Chưa có dữ liệu tải công việc' : selectedTeacherForProfile.workloadStatus === 'Đủ tải'
                    ? 'Đã đạt định mức giảng dạy quy định'
                    : `Còn trống ${selectedTeacherForProfile.maxWorkloadHours - selectedTeacherForProfile.workloadHours} giờ phân công`}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTeacherForProfile.workloadStatus === 'Đủ tải'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {selectedTeacherForProfile.maxWorkloadHours ? selectedTeacherForProfile.workloadStatus : 'Chưa xác minh'}
                </span>
              </div>
            </div>

            {/* Box 4: Chứng chỉ sư phạm mầm non */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Chứng chỉ sư phạm &amp; Giám sát chứng chỉ hành nghề:
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedTeacherForProfile.badges.map((badge, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
                      badge.isWarning
                        ? 'bg-[#fffbeb] text-[#b45309] border border-[#fef3c7] dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${badge.isWarning ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <span>{badge.title}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTeacherForProfile(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const t = selectedTeacherForProfile;
                    setSelectedTeacherForProfile(null);
                    setSelectedTeacherForAssign(t);
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0e5c43] dark:text-emerald-400 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                >
                  <Users className="w-4 h-4" />
                  <span>Phân Công Lớp</span>
                </button>
                <Link
                  href={`/dashboard/education/teachers/${selectedTeacherForProfile.id}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Hồ Sơ 360° Đầy Đủ</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. ADD NEW TEACHER MODAL ── */}
      {isAddTeacherOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => setIsAddTeacherOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0e5c43] dark:text-emerald-400">
                Khai báo hồ sơ nhân sự sư phạm mầm non
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                + Thêm Giáo Viên Mới
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có API lưu hồ sơ chi tiết giáo viên; biểu mẫu này hiện chưa thể kích hoạt.
              </p>
            </div>

            <form
              onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setSaveError('Chưa có API tạo hồ sơ giáo viên. Thông tin chưa được lưu.'); }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Họ và tên cô giáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ví dụ: Cô Vũ Hoàng Lan"
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Chức vụ / Vai trò <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="roleKey"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="chunhiem">Giáo viên chủ nhiệm</option>
                    <option value="trogiang">Giáo viên trợ giảng</option>
                    <option value="bomon">Giáo viên năng khiếu</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Khối mầm non <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="gradeLevel"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option value="mam">Khối Mầm (3 - 4 tuổi)</option>
                    <option value="choi">Khối Chồi (4 - 5 tuổi)</option>
                    <option value="la">Khối Lá (5 - 6 tuổi)</option>
                    <option value="nhatre">Khối Nhà Trẻ (18 - 36 tháng)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Lớp phân công
                  </label>
                  <select
                    name="classAssigned"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  >
                    <option>Chưa có API tạo hồ sơ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Định mức giờ/tuần (Max 40h)
                  </label>
                  <input
                    type="number"
                    name="workloadHours"
                    defaultValue={undefined}
                    min={10}
                    max={40}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Trình độ bằng cấp
                  </label>
                  <input
                    type="text"
                    name="degree"
                    defaultValue=""
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Trường đào tạo
                  </label>
                  <input
                    type="text"
                    name="university"
                    defaultValue=""
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Số năm kinh nghiệm
                  </label>
                  <input
                    type="text"
                    name="experience"
                    defaultValue=""
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue=""
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Chứng chỉ chuyên môn (cách nhau bởi dấu phẩy)
                </label>
                <input
                  type="text"
                  name="certs"
                  defaultValue=""
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0e5c43]"
                />
              </div>

              {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  aria-disabled="true"
                  onClick={() => setSaveError('Chưa có API tạo hồ sơ giáo viên. Thông tin chưa được lưu.')}
                  className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu &amp; Kích Hoạt Hồ Sơ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. GOVERNED CLASS ASSIGNMENT MODAL ── */}
      {selectedTeacherForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              type="button"
              onClick={() => { if (!saving) { pendingAssignment.current = null; setSelectedTeacherForAssign(null); } }}
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
                Thiết lập năm học, lớp, vai trò và ngày hiệu lực theo xác nhận giáo viên hiện có
              </p>
            </div>

            <form
              onSubmit={submitAssignment}
              className="space-y-4"
            >
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
                    name="classAssigned"
                    defaultValue=""
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  >
                    <option value="">Chọn lớp</option>
                    {classes.map(item => <option key={item.id} value={item.id}>{item.title} ({item.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Vai trò phụ trách</label>
                  <select
                    name="role"
                    defaultValue="lead_teacher"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  >
                    <option value="lead_teacher">Giáo viên chủ nhiệm</option>
                    <option value="co_teacher">Giáo viên cùng lớp</option>
                    <option value="assistant">Giáo viên trợ giảng</option>
                    <option value="substitute">Giáo viên thay thế</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Hiệu lực phân công</label>
                  <input
                    type="date"
                    name="effectiveStartDate"
                    defaultValue={localDate()}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0e5c43] outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 text-xs space-y-1.5">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Phân công theo xác nhận giáo viên và phạm vi chi nhánh:
                </span>
                <p className="text-emerald-700 dark:text-emerald-400 text-[11px] leading-relaxed">
                  Giáo viên đã được xác nhận. Bằng cấp, tải công việc và thời khóa biểu chưa có nguồn dữ liệu kiểm chứng. Hệ thống sẽ kiểm tra quyền và ràng buộc phân công khi lưu.
                </p>
              </div>

              {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { if (!saving) { pendingAssignment.current = null; setSelectedTeacherForAssign(null); } }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#0e5c43] hover:bg-[#0a4633] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Phân Công</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
