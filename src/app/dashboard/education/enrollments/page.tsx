'use client';

/**
 * Bella Education — Student Registry & Admission Management
 * 
 * Scalable Architecture:
 * - Unified Header Title: "Quản Lý Trẻ"
 * - Academic Year Context: 2026 - 2027
 * - Exception-Based Health UI (Highlight only when warning exists)
 * - Admission Workflow Modal (Multi-step enrollment process)
 * - Scalable CTAs: [ Xem Hồ Sơ (Student 360°) ] [ Sổ Liên Lạc ] [ ⋯ ]
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Baby, 
  UserPlus, 
  Search, 
  ArrowLeft, 
  Phone, 
  FileText,
  CalendarCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  ShieldCheck,
  X,
  Check,
  GraduationCap,
  CreditCard,
  MessageSquare,
  Loader2
} from 'lucide-react';

type StudentItem = {
  id: string;
  name: string;
  nickname: string;
  dob: string;
  age: string;
  gender: string;
  className: string;
  branchName?: string;
  parentName: string;
  parentPhone: string;
  hasHealthAlert: boolean;
  medicalNote: string;
  status: 'Đang Học' | 'Chờ Nhập Học' | 'Đã Nghỉ Học';
  statusKey: 'active' | 'pending' | 'inactive';
  theme: {
    avatarBg: string;
    badgeBg: string;
    badgeText: string;
  };
};

type ClassroomOption = {
  id: string;
  name: string;
  code: string;
  grade: string;
};

type BranchOption = {
  id: string;
  name: string;
  code?: string;
};

type AdmissionFormState = {
  childName: string;
  nickname: string;
  dateOfBirth: string;
  gender: 'Nam' | 'Nữ';
  guardianName: string;
  guardianPhone: string;
  medicalNote: string;
  courseId: string;
  branchId: string;
};

type AdmissionResponse = {
  success: boolean;
  error?: string;
  student?: {
    partyId: string;
    studentCode: string;
    childName: string;
    nickname: string;
    dateOfBirth: string;
    gender: string;
    guardianName: string;
    guardianPhone: string;
    medicalNote: string;
  };
  enrollment?: {
    id: string;
    courseId: string;
    courseTitle: string;
    status: string;
    enrolledAt: string;
  };
  chain?: {
    branchId: string;
    enrollmentId: string;
    courseId: string;
  } | null;
};

type StudentRegistryResponse = {
  success: boolean;
  error?: string;
  students?: Array<{
    id: string;
    name: string;
    nickname: string;
    dateOfBirth: string;
    gender: string;
    className: string;
    parentName: string;
    parentPhone: string;
    hasHealthAlert: boolean;
    medicalNote: string;
    status: StudentItem['status'];
    statusKey: StudentItem['statusKey'];
  }>;
};

const DEFAULT_ADMISSION_FORM: AdmissionFormState = {
  childName: '',
  nickname: '',
  dateOfBirth: '2023-06-15',
  gender: 'Nam',
  guardianName: '',
  guardianPhone: '',
  medicalNote: '',
  courseId: '',
  branchId: '',
};

const STUDENTS_LIST: StudentItem[] = [];

function formatAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'Chưa rõ tuổi';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return `${Math.max(age, 0)} Tuổi`;
}

function formatDate(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'Chưa rõ';
  return dob.toLocaleDateString('vi-VN');
}

function getStudentTheme(statusKey: StudentItem['statusKey']): StudentItem['theme'] {
  if (statusKey === 'pending') {
    return {
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200/60',
    };
  }

  return {
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
  };
}

async function fetchStudentRegistry(): Promise<StudentItem[]> {
  const response = await fetch('/api/education/enrollments', { method: 'GET' });
  const data = (await response.json()) as StudentRegistryResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Không tải được danh sách học sinh.');
  }

  return (data.students || []).map((item) => ({
    id: item.id,
    name: item.name,
    nickname: item.nickname || 'Chưa có',
    dob: item.dateOfBirth ? formatDate(item.dateOfBirth) : 'Chưa rõ',
    age: item.dateOfBirth ? formatAge(item.dateOfBirth) : 'Chưa rõ tuổi',
    gender: item.gender,
    className: item.className,
    parentName: item.parentName,
    parentPhone: item.parentPhone,
    hasHealthAlert: item.hasHealthAlert,
    medicalNote: item.medicalNote || 'Chưa ghi nhận lưu ý y tế.',
    status: item.status,
    statusKey: item.statusKey,
    theme: getStudentTheme(item.statusKey),
  }));
}

export default function EnrollmentsPage() {
  const [students, setStudents] = useState<StudentItem[]>(STUDENTS_LIST);
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'active' | 'pending' | 'healthAlert'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [admissionForm, setAdmissionForm] = useState<AdmissionFormState>(DEFAULT_ADMISSION_FORM);
  const [admissionError, setAdmissionError] = useState('');
  const [admissionSuccess, setAdmissionSuccess] = useState('');
  const [isSubmittingAdmission, setIsSubmittingAdmission] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentLoadError, setStudentLoadError] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadInitialStudents() {
      setIsLoadingStudents(true);
      try {
        const loadedStudents = await fetchStudentRegistry();
        if (!cancelled) {
          setStudents(loadedStudents);
          setStudentLoadError('');
        }
      } catch (error) {
        if (!cancelled) {
          setStudentLoadError(error instanceof Error ? error.message : 'Không tải được danh sách học sinh.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStudents(false);
        }
      }
    }

    loadInitialStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmissionModalOpen) return;

    let cancelled = false;
    async function loadAdmissionOptions() {
      try {
        const [classroomResponse, branchResponse] = await Promise.all([
          fetch('/api/education/courses'),
          fetch('/api/education/branches'),
        ]);
        const classroomData = await classroomResponse.json();
        const branchData = await branchResponse.json();
        if (cancelled) return;
        if (!classroomData?.success) return;

        const loadedClassrooms: ClassroomOption[] = (classroomData.classrooms || []).map((item: ClassroomOption) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          grade: item.grade,
        }));
        const loadedBranches: BranchOption[] = branchData?.success
          ? (branchData.branches || []).map((item: BranchOption) => ({
              id: item.id,
              name: item.name,
              code: item.code,
            }))
          : [];

        setClassrooms(loadedClassrooms);
        setBranches(loadedBranches);
        setAdmissionForm((current) => ({
          ...current,
          courseId: current.courseId || loadedClassrooms[0]?.id || '',
          branchId: current.branchId || loadedBranches[0]?.id || '',
        }));
      } catch {
        if (!cancelled) {
          setAdmissionError('Không tải được danh sách lớp hoặc chi nhánh. Vui lòng thử lại.');
        }
      }
    }

    loadAdmissionOptions();
    return () => {
      cancelled = true;
    };
  }, [isAdmissionModalOpen]);

  const filteredStudents = students.filter((stu) => {
    const matchesSearch = stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.parentPhone.includes(searchQuery) ||
                          stu.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedStatusTab === 'all') return matchesSearch;
    if (selectedStatusTab === 'active') return matchesSearch && stu.statusKey === 'active';
    if (selectedStatusTab === 'pending') return matchesSearch && stu.statusKey === 'pending';
    if (selectedStatusTab === 'healthAlert') return matchesSearch && stu.hasHealthAlert;
    return matchesSearch;
  });
  const activeStudentCount = students.filter((stu) => stu.statusKey === 'active').length;
  const pendingStudentCount = students.filter((stu) => stu.statusKey === 'pending').length;
  const healthAlertCount = students.filter((stu) => stu.hasHealthAlert).length;

  function openAdmissionModal() {
    setAdmissionForm(DEFAULT_ADMISSION_FORM);
    setAdmissionError('');
    setAdmissionSuccess('');
    setModalStep(1);
    setIsAdmissionModalOpen(true);
  }

  function updateAdmissionForm<K extends keyof AdmissionFormState>(field: K, value: AdmissionFormState[K]) {
    setAdmissionForm((current) => ({ ...current, [field]: value }));
    setAdmissionError('');
  }

  async function submitAdmission() {
    setAdmissionError('');
    setAdmissionSuccess('');

    if (!admissionForm.childName.trim() || !admissionForm.dateOfBirth || !admissionForm.guardianName.trim() || !admissionForm.guardianPhone.trim() || !admissionForm.courseId) {
      setAdmissionError('Vui lòng nhập đủ thông tin bắt buộc và chọn lớp.');
      return;
    }
    if (branches.length > 0 && !admissionForm.branchId) {
      setAdmissionError('Vui lòng chọn cơ sở/chi nhánh nhập học.');
      return;
    }

    setIsSubmittingAdmission(true);
    try {
      const response = await fetch('/api/education/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admissionForm),
      });
      const data = (await response.json()) as AdmissionResponse;

      if (!response.ok || !data.success || !data.student || !data.enrollment) {
        throw new Error(data.error || 'Đăng ký nhập học chưa hoàn tất.');
      }

      const refreshedStudents = await fetchStudentRegistry();
      setStudents(refreshedStudents);
      setStudentLoadError('');
      setAdmissionSuccess(`Đã tạo học sinh ${data.student.studentCode}, enrollment ${data.enrollment.id}${data.chain ? ' và chain assignment đã đọc lại.' : ''}`);
      setIsAdmissionModalOpen(false);
    } catch (error) {
      setAdmissionError(error instanceof Error ? error.message : 'Đăng ký nhập học thất bại.');
    } finally {
      setIsSubmittingAdmission(false);
    }
  }

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
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Quản Lý Trẻ
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Danh sách 280 trẻ mầm non, hồ sơ cá nhân, người giám hộ & lịch sử quá trình học tập
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

            {/* Admission Workflow Button */}
            <button 
              onClick={openAdmissionModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng Ký Nhập Học Mới</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên bé, biệt danh, tên phụ huynh, SĐT..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setSelectedStatusTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'all' 
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả trẻ ({students.length})
            </button>
            <button 
              onClick={() => setSelectedStatusTab('active')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'active' 
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Đang học ({activeStudentCount})
            </button>
            <button 
              onClick={() => setSelectedStatusTab('pending')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'pending' 
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Chờ nhập học ({pendingStudentCount})
            </button>
            <button 
              onClick={() => setSelectedStatusTab('healthAlert')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'healthAlert' 
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              ⚠️ Lưu ý y tế ({healthAlertCount})
            </button>
          </div>
        </div>
      </div>

      {studentLoadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {studentLoadError}
        </div>
      )}

      {isLoadingStudents && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Đang tải danh sách học sinh...</span>
        </div>
      )}

      {/* ── 2 Column Grid for Student Cards ── */}
      {!isLoadingStudents && filteredStudents.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Chưa có học sinh phù hợp với bộ lọc hiện tại.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={menuRef}>
        {filteredStudents.map((stu) => {
          const isMenuOpen = activeMenuId === stu.id;

          return (
            <div 
              key={stu.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 relative"
            >
              {/* Top Student Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl ${stu.theme.avatarBg} flex items-center justify-center font-extrabold text-base shrink-0 shadow-sm`}>
                    {stu.name.split(' ').pop()?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                        {stu.name}
                      </h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        &quot;{stu.nickname}&quot;
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                      Mã Bé: <strong className="text-gray-800 dark:text-gray-200">{stu.id}</strong> • {stu.gender} • {stu.age}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${stu.theme.badgeBg} ${stu.theme.badgeText}`}>
                    {stu.status}
                  </span>

                  {/* ⋯ Overflow Actions Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : stu.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Thao tác khác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <Link
                          href={`/dashboard/education/enrollments/${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-emerald-500" />
                          <span>Hồ Sơ Y Tế & Sức Khỏe</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/attendance?student=${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-[var(--education-brand-ink)] rounded-xl transition-colors"
                        >
                          <CalendarCheck className="w-4 h-4 text-[var(--education-brand-ink)]" />
                          <span>Lịch Sử Điểm Danh</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/grades?student=${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-[var(--education-brand-ink)] rounded-xl transition-colors"
                        >
                          <GraduationCap className="w-4 h-4 text-[var(--education-brand-ink)]" />
                          <span>Đánh Giá Phát Triển</span>
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                          <Link
                            href={`/dashboard/education/finance?student=${stu.id}`}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/10 hover:text-[var(--education-brand-ink)] rounded-xl transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-[var(--education-brand-ink)]" />
                            <span>Học Phí & Công Nợ</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Class & Parent Contacts */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">Lớp học hiện tại:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{stu.className}</span>
                </div>
                {stu.branchName && (
                  <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400 font-medium">Cơ sở/chi nhánh:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{stu.branchName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">Phụ huynh:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{stu.parentName}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 font-medium">SĐT liên hệ:</span>
                  <a href={`tel:${stu.parentPhone}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {stu.parentPhone}
                  </a>
                </div>
              </div>

              {/* ── Exception-Based Health UI ── */}
              {stu.hasHealthAlert ? (
                <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-900/60 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ⚠ LƯU Ý SỨC KHỎE & DẶN DÒ:
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                    {stu.medicalNote}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-200/60 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>✓ Hồ sơ y tế đầy đủ • Sức khỏe bình thường</span>
                </div>
              )}

              {/* Action Buttons: Primary Student 360° CTA */}
              <div className="pt-1 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700/60">
                <Link 
                  href={`/dashboard/education/enrollments/${stu.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-md transition-all flex-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xem Hồ Sơ 360°</span>
                </Link>
                <Link 
                  href={`/dashboard/education/communication?student=${stu.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Sổ Liên Lạc</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ADMISSION WORKFLOW MODAL ── */}
      {isAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setIsAdmissionModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Quy trình đăng ký nhập học • Bước {modalStep}/2
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng Ký Hồ Sơ Nhập Học Mới
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thu thập thông tin bé, người giám hộ, tiền sử y tế và phân lớp dự kiến
              </p>
            </div>

            {/* Modal Step 1 */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ và tên trẻ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.childName}
                      onChange={(event) => updateAdmissionForm('childName', event.target.value)}
                      placeholder="VD: Lê Hoàng Nam"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Tên thường gọi / Biệt danh
                    </label>
                    <input
                      type="text"
                      value={admissionForm.nickname}
                      onChange={(event) => updateAdmissionForm('nickname', event.target.value)}
                      placeholder="VD: Bé Tôm"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Ngày sinh *
                    </label>
                    <input
                      type="date"
                      value={admissionForm.dateOfBirth}
                      onChange={(event) => updateAdmissionForm('dateOfBirth', event.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Giới tính
                    </label>
                    <select
                      value={admissionForm.gender}
                      onChange={(event) => updateAdmissionForm('gender', event.target.value as AdmissionFormState['gender'])}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    >
                      <option>Nam</option>
                      <option>Nữ</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Step 2 */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ tên người giám hộ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.guardianName}
                      onChange={(event) => updateAdmissionForm('guardianName', event.target.value)}
                      placeholder="VD: Lê Văn Thành (Bố)"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Số điện thoại liên hệ *
                    </label>
                    <input
                      type="text"
                      value={admissionForm.guardianPhone}
                      onChange={(event) => updateAdmissionForm('guardianPhone', event.target.value)}
                      placeholder="VD: 0989 112 334"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Ghi chú y tế / Dặn dò đặc biệt (Dị ứng, chế độ ăn)
                  </label>
                  <textarea
                    rows={2}
                    value={admissionForm.medicalNote}
                    onChange={(event) => updateAdmissionForm('medicalNote', event.target.value)}
                    placeholder="VD: Dị ứng sữa bò, cần dùng sữa hạt thay thế."
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Lớp nhập học *
                  </label>
                  <select
                    value={admissionForm.courseId}
                    onChange={(event) => updateAdmissionForm('courseId', event.target.value)}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring"
                  >
                    {classrooms.length === 0 ? (
                      <option value="">Chưa có lớp active để chọn</option>
                    ) : (
                      classrooms.map((classroom) => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name} • {classroom.grade}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Cơ sở / chi nhánh nhập học {branches.length > 0 ? '*' : ''}
                  </label>
                  <select
                    value={admissionForm.branchId}
                    onChange={(event) => updateAdmissionForm('branchId', event.target.value)}
                    disabled={branches.length === 0}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-ring disabled:opacity-60"
                  >
                    {branches.length === 0 ? (
                      <option value="">Chưa có chi nhánh active để chọn</option>
                    ) : (
                      branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}{branch.code ? ` • ${branch.code}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Kiểm tra hồ sơ trước khi ghi nhận:
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    Mã học sinh sẽ được sinh trên server. Hệ thống chỉ báo hoàn tất sau khi enrollment được ghi và đọc lại từ database.
                  </p>
                </div>
              </div>
            )}

            {admissionError && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/70 dark:border-rose-900/70 px-4 py-3 text-xs font-bold text-rose-700 dark:text-rose-300">
                {admissionError}
              </div>
            )}

            {admissionSuccess && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900/70 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {admissionSuccess}
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
                  Tiếp theo: Giám hộ →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitAdmission}
                  disabled={isSubmittingAdmission}
                  className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover disabled:bg-slate-400 text-primary-foreground font-bold text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingAdmission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isSubmittingAdmission ? 'Đang ghi nhận...' : 'Hoàn Tất Đăng Ký Nhập Học'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
