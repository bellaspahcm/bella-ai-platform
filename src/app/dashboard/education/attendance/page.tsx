'use client';

/**
 * Bella Education — Daily Roll-Call & Safe Pickup Verification
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PreschoolAttendance from './preschool-attendance';
import {
  CalendarCheck,
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Thermometer,
  QrCode,
  BellRing,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'excused';

interface ClassroomOverviewItem {
  id: string;
  code?: string;
  name: string;
  gradeKey?: 'mam' | 'choi' | 'la' | 'nursery' | null;
  students: number;
  maxStudents: number | null;
  todayStatus: {
    present: number;
    absent: number;
    excused: number;
    unmarked: number;
  };
}

interface DailyAttendanceState {
  id: string;
  enrollmentId: string;
  schoolDay: string;
  status: AttendanceStatus;
}

function isDailyAttendanceState(value: unknown): value is DailyAttendanceState {
  if (!value || typeof value !== 'object') return false;
  const attendance = value as Record<string, unknown>;
  return typeof attendance.id === 'string' && attendance.id.trim().length > 0 &&
    typeof attendance.enrollmentId === 'string' && typeof attendance.schoolDay === 'string' &&
    (attendance.status === 'present' || attendance.status === 'absent' || attendance.status === 'excused');
}

interface AuthorizedGuardian {
  authorizationId: string;
  studentPartyId: string;
  guardianPartyId: string;
  displayName: string;
  phone: string;
  status: 'authorized';
}

interface SafePickupHandover {
  id: string;
  studentPartyId: string;
  guardianPartyId: string;
  pickupAuthorizationId: string;
  handedOverAt: string;
  handedOverBy: string;
}

interface AttendanceRosterItem {
  enrollmentId: string;
  studentId: string;
  studentPartyId: string;
  studentCode: string | null;
  name: string;
  gender: string | null;
  dob: string | null;
  enrollmentStatus: string;
  attendance: DailyAttendanceState | null;
  authorizedGuardians?: AuthorizedGuardian[];
  safePickupHandover?: SafePickupHandover | null;
}

const EMPTY_ROSTER: readonly AttendanceRosterItem[] = [];

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Có Mặt',
  absent: 'Vắng',
  excused: 'Có Phép',
};

const ATTENDANCE_BADGES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  absent: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
  excused: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
};

function todayLocalDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const STUDENT_NAMES_BY_ID: Record<string, string> = {
  'HS0001': 'Nguyễn Minh An',
  'STU-001': 'Nguyễn Minh An',
  'HS0002': 'Trần Bảo Ngọc',
  'STU-002': 'Trần Bảo Ngọc',
  'HS0003': 'Lê Gia Huy',
  'STU-003': 'Lê Gia Huy',
  'HS0004': 'Phạm Khánh Linh',
  'STU-004': 'Phạm Thảo My',
  'HS0005': 'Hoàng Nhật Minh',
  'STU-005': 'Hoàng Tuấn Kiệt',
  'HS0006': 'Vũ Phương Anh',
  'STU-006': 'Đặng Khánh Linh',
  'HS0007': 'Vũ Gia Hân',
  'STU-007': 'Vũ Gia Hân',
  'HS0008': 'Ngô Nhật Minh',
  'STU-008': 'Ngô Nhật Minh',
};

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const studentParam = searchParams ? searchParams.get('student') : null;
  const [classrooms, setClassrooms] = useState<readonly ClassroomOverviewItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [schoolDay, setSchoolDay] = useState(() => todayLocalDate());
  const [roster, setRoster] = useState<readonly AttendanceRosterItem[]>([]);
  const [rosterContext, setRosterContext] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [studentContextActive, setStudentContextActive] = useState(false);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingEnrollmentId, setSavingEnrollmentId] = useState<string | null>(null);
  const [savingHandoverStudentPartyId, setSavingHandoverStudentPartyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const rosterRequestVersion = useRef(0);
  const commandInFlight = useRef(false);
  const mounted = useRef(true);

  // Auto-filter by student when navigated via deep link ?student=...
  useEffect(() => {
    if (!studentParam) return;
    const targetName = STUDENT_NAMES_BY_ID[studentParam] || studentParam;
    setSearch(targetName);
    setStudentContextActive(true);
  }, [studentParam]);

  const selectedClassroom = classrooms.find((classroom) => classroom.id === selectedCourseId) ?? null;
  const contextKey = `${selectedCourseId}:${schoolDay}`;
  const validContext = Boolean(selectedCourseId && /^\d{4}-\d{2}-\d{2}$/.test(schoolDay));
  const rosterReady = validContext && !loadingRoster && rosterContext === contextKey;
  const currentRoster = rosterReady ? roster : EMPTY_ROSTER;
  const savingCommand = Boolean(savingEnrollmentId || savingHandoverStudentPartyId);

  const [selectedGrade, setSelectedGrade] = useState<'all' | 'nursery' | 'mam' | 'choi' | 'la'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'excused' | 'unmarked'>('all');
  const [handoverFilter, setHandoverFilter] = useState<'all' | 'handed_over' | 'pending'>('all');

  const filteredClassrooms = useMemo(() => {
    if (selectedGrade === 'all') return classrooms;
    return classrooms.filter((c) => c.gradeKey === selectedGrade);
  }, [classrooms, selectedGrade]);

  const handleSelectGrade = (grade: 'all' | 'nursery' | 'mam' | 'choi' | 'la') => {
    if (commandInFlight.current) return;
    setSelectedGrade(grade);
    if (grade !== 'all') {
      const firstInGrade = classrooms.find((c) => c.gradeKey === grade);
      if (firstInGrade) {
        setSelectedCourseId(firstInGrade.id);
      }
    }
  };

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();

    return currentRoster.filter((student) => {
      if (query) {
        const nameMatch = student.name.toLowerCase().includes(query);
        const codeMatch = (student.studentCode ?? '').toLowerCase().includes(query);
        const idMatch = (student.studentId ?? '').toLowerCase().includes(query) || (student.enrollmentId ?? '').toLowerCase().includes(query);
        const partyMatch = (student.studentPartyId ?? '').toLowerCase().includes(query);
        const guardianMatch = student.authorizedGuardians?.some((g) =>
          g.displayName.toLowerCase().includes(query) ||
          g.phone.toLowerCase().includes(query)
        ) ?? false;

        if (!nameMatch && !codeMatch && !idMatch && !partyMatch && !guardianMatch) {
          return false;
        }
      }

      if (statusFilter !== 'all') {
        const studentStatus = student.attendance?.status ?? 'unmarked';
        if (studentStatus !== statusFilter) {
          return false;
        }
      }

      if (handoverFilter === 'handed_over') {
        if (!student.safePickupHandover) return false;
      } else if (handoverFilter === 'pending') {
        if (student.safePickupHandover) return false;
      }

      return true;
    });
  }, [currentRoster, search, statusFilter, handoverFilter]);

  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePageSize, setAttendancePageSize] = useState(10);
  const [handoverPage, setHandoverPage] = useState(1);
  const [handoverPageSize, setHandoverPageSize] = useState(8);

  useEffect(() => {
    setAttendancePage(1);
    setHandoverPage(1);
  }, [search, selectedCourseId, schoolDay, statusFilter, handoverFilter]);

  const attendanceTotalPages = Math.max(1, Math.ceil(filteredRoster.length / attendancePageSize));
  const validAttendancePage = Math.min(attendancePage, attendanceTotalPages);
  const attendanceStartIdx = (validAttendancePage - 1) * attendancePageSize;
  const paginatedAttendanceRoster = useMemo(() => {
    return filteredRoster.slice(attendanceStartIdx, attendanceStartIdx + attendancePageSize);
  }, [filteredRoster, attendanceStartIdx, attendancePageSize]);

  // Học sinh vắng (absent) hoặc nghỉ phép (excused) đã không đến trường
  // => không cần bàn giao, loại khỏi panel đưa đón
  const handoverEligibleRoster = useMemo(() => {
    return filteredRoster.filter((student) => {
      const attendanceStatus = student.attendance?.status;
      return attendanceStatus !== 'absent' && attendanceStatus !== 'excused';
    });
  }, [filteredRoster]);

  const handoverTotalPages = Math.max(1, Math.ceil(handoverEligibleRoster.length / handoverPageSize));
  const validHandoverPage = Math.min(handoverPage, handoverTotalPages);
  const handoverStartIdx = (validHandoverPage - 1) * handoverPageSize;
  const paginatedHandoverRoster = useMemo(() => {
    return handoverEligibleRoster.slice(handoverStartIdx, handoverStartIdx + handoverPageSize);
  }, [handoverEligibleRoster, handoverStartIdx, handoverPageSize]);

  const attendanceSummary = useMemo(() => {
    return currentRoster.reduce(
      (summary, student) => {
        if (!student.attendance) {
          summary.unmarked += 1;
          return summary;
        }

        summary[student.attendance.status] += 1;
        return summary;
      },
      { present: 0, absent: 0, excused: 0, unmarked: 0 },
    );
  }, [currentRoster]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      rosterRequestVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadClassrooms() {
      setLoadingClassrooms(true);
      setError(null);
      try {
        const response = await fetch('/api/education/attendance/courses', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Không tải được danh sách lớp');
        }

        const loadedClassrooms = (payload.classrooms ?? []) as ClassroomOverviewItem[];
        if (active) {
          setClassrooms(loadedClassrooms);
          setSelectedCourseId((current) => current || loadedClassrooms[0]?.id || '');
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách lớp');
      } finally {
        if (active) setLoadingClassrooms(false);
      }
    }

    void loadClassrooms();
    return () => { active = false; };
  }, []);

  const refreshRoster = useCallback(async (): Promise<boolean> => {
    const requestVersion = ++rosterRequestVersion.current;
    const isCurrentRequest = () => mounted.current && requestVersion === rosterRequestVersion.current;
    setLoadingRoster(true);
    setRosterContext(null);
    setRoster([]);
    setError(null);
    setSuccessMessage(null);
    if (!validContext) {
      setLoadingRoster(false);
      return false;
    }
    try {
      const params = new URLSearchParams({ courseId: selectedCourseId, date: schoolDay });
      const response = await fetch(`/api/education/attendance?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Không tải được danh sách điểm danh');
      }
      if (!isCurrentRequest()) return false;
      setRoster((payload.roster ?? []) as AttendanceRosterItem[]);
      setRosterContext(contextKey);
      return true;
    } catch (loadError) {
      if (isCurrentRequest()) {
        setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách điểm danh');
      }
      return false;
    } finally {
      if (isCurrentRequest()) setLoadingRoster(false);
    }
  }, [selectedCourseId, schoolDay, contextKey, validContext]);

  useEffect(() => {
    void refreshRoster();
    return () => { rosterRequestVersion.current += 1; };
  }, [refreshRoster]);

  async function markAttendance(enrollmentId: string, status: AttendanceStatus) {
    if (commandInFlight.current || !rosterReady || !currentRoster.some((row) => row.enrollmentId === enrollmentId)) return;
    const requestVersion = rosterRequestVersion.current;
    const isCurrentCommand = () => mounted.current && requestVersion === rosterRequestVersion.current;
    commandInFlight.current = true;
    setSavingEnrollmentId(enrollmentId);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/education/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, status, date: schoolDay }),
      });
      const payload: unknown = await response.json();
      if (!isCurrentCommand()) return;
      const result = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
      if (!response.ok || result?.success !== true) {
        throw new Error(typeof result?.error === 'string' ? result.error : 'Không ghi được điểm danh');
      }
      const attendance = result.attendance;
      if (!isDailyAttendanceState(attendance) || attendance.enrollmentId !== enrollmentId || attendance.schoolDay !== schoolDay) {
        throw new Error('Chưa xác nhận được kết quả điểm danh. Hãy tải lại trang để kiểm tra trước khi tiếp tục.');
      }

      setRoster((current) => isCurrentCommand()
        ? current.map((row) => row.enrollmentId === enrollmentId ? { ...row, attendance } : row)
        : current);
      setSuccessMessage('Đã ghi nhận điểm danh thật vào hệ thống');
    } catch (saveError) {
      if (isCurrentCommand()) {
        // A failed response can follow a commit; require read-back before another command.
        rosterRequestVersion.current += 1;
        setRosterContext(null);
        setRoster([]);
        setError(saveError instanceof Error ? saveError.message : 'Không ghi được điểm danh');
      }
    } finally {
      commandInFlight.current = false;
      if (mounted.current) setSavingEnrollmentId(null);
    }
  }

  async function recordHandover(row: AttendanceRosterItem, guardian: AuthorizedGuardian) {
    const currentRow = currentRoster.find((item) => item.enrollmentId === row.enrollmentId && item.studentPartyId === row.studentPartyId);
    if (
      commandInFlight.current || !rosterReady || !currentRow || currentRow.safePickupHandover ||
      !currentRow.authorizedGuardians?.some((item) => item.authorizationId === guardian.authorizationId && item.guardianPartyId === guardian.guardianPartyId)
    ) return;
    commandInFlight.current = true;
    setSavingHandoverStudentPartyId(row.studentPartyId);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/education/attendance/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentPartyId: row.studentPartyId,
          guardianPartyId: guardian.guardianPartyId,
          pickupAuthorizationId: guardian.authorizationId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Không ghi được bàn giao');
      }

      if (!mounted.current) return;
      const refreshed = await refreshRoster();
      if (mounted.current) {
        if (refreshed) setSuccessMessage(`Đã bàn giao ${row.name} cho ${guardian.displayName}`);
        else setError('Đã ghi nhận bàn giao nhưng chưa tải lại được danh sách. Hãy tải lại trước khi tiếp tục.');
      }
    } catch (handoverError) {
      if (mounted.current) setError(handoverError instanceof Error ? handoverError.message : 'Không ghi được bàn giao');
    } finally {
      commandInFlight.current = false;
      if (mounted.current) setSavingHandoverStudentPartyId(null);
    }
  }

  function formatHandoverTime(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
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
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Điểm Danh &amp; Đưa Đón Bé An Toàn
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ghi nhận điểm danh hằng ngày từ danh sách học sinh đã enrollment thật
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <input
              type="date"
              aria-label="Ngày điểm danh"
              value={schoolDay}
              disabled={savingCommand}
              onChange={(event) => {
                if (!commandInFlight.current) setSchoolDay(event.target.value);
              }}
              className="px-3.5 py-2 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20 text-xs font-bold"
            />
            <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-5 py-3 text-xs font-bold shadow-lg shadow-primary/20">
              <CheckCircle2 className="w-4 h-4" />
              Điểm danh thật
            </span>
          </div>
        </div>

        {studentContextActive && studentParam && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Đang lọc điểm danh theo học sinh: <span className="text-primary underline decoration-primary/40 font-bold">{STUDENT_NAMES_BY_ID[studentParam] || studentParam}</span> ({studentParam})
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bộ lọc tìm kiếm đã được áp dụng. Bạn có thể chọn lớp để xem chi tiết hoặc chuyển nhanh sang các nghiệp vụ khác.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/education/enrollments/${studentParam}`}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs"
              >
                Xem Hồ Sơ 360°
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStudentContextActive(false);
                }}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-2xs"
              >
                Xem tất cả học sinh
              </button>
            </div>
          </div>
        )}
        {/* Grade tabs filter */}
        {classrooms.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { key: 'all', label: 'Tất cả khối' },
              { key: 'nursery', label: 'Nhà Trẻ (18-36th)' },
              { key: 'mam', label: 'Khối Mầm (3t)' },
              { key: 'choi', label: 'Khối Chồi (4t)' },
              { key: 'la', label: 'Khối Lá (5t)' },
            ].map((tab) => {
              const isActive = selectedGrade === tab.key;
              const count = tab.key === 'all'
                ? classrooms.length
                : classrooms.filter((c) => c.gradeKey === tab.key).length;
              if (tab.key !== 'all' && count === 0) return null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={savingCommand}
                  onClick={() => handleSelectGrade(tab.key as typeof selectedGrade)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Classroom cards grid */}
        {loadingClassrooms ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải danh sách lớp...
          </div>
        ) : classrooms.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Chưa có lớp đang hoạt động
          </div>
        ) : filteredClassrooms.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center bg-slate-50 dark:bg-slate-700/30 rounded-2xl">
            Không có lớp học nào thuộc khối này
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredClassrooms.map((classroom) => {
              const isSelected = classroom.id === selectedCourseId;
              const isLive = isSelected && rosterReady;
              const totalStudents = isLive ? currentRoster.length : classroom.students;
              const present = isLive ? attendanceSummary.present : classroom.todayStatus.present;
              const absent  = isLive ? attendanceSummary.absent  : (classroom.todayStatus.absent ?? 0);
              const excused = isLive ? attendanceSummary.excused : classroom.todayStatus.excused;
              const unmarked = isLive ? attendanceSummary.unmarked : classroom.todayStatus.unmarked;
              const fillPct = classroom.maxStudents !== null && classroom.maxStudents > 0
                ? Math.round((totalStudents / classroom.maxStudents) * 100)
                : 0;
              return (
                <button
                  key={classroom.id}
                  type="button"
                  disabled={savingCommand}
                  onClick={() => {
                    if (!commandInFlight.current) setSelectedCourseId(classroom.id);
                  }}
                  className={`text-left rounded-2xl p-4 border transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-[var(--education-brand-ink)] shadow-sm ring-1 ring-primary'
                      : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <p className={`font-extrabold text-[11px] leading-tight mb-2 ${
                    isSelected ? 'text-[var(--education-brand-ink)]' : 'text-gray-900 dark:text-white'
                  }`}>
                    {classroom.name}
                  </p>
                  <p className={`text-[10px] font-semibold mb-3 ${
                    isSelected ? 'text-[var(--education-brand-ink)]/70' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    Sĩ số: <span className="font-extrabold">{totalStudents}</span>
                    {classroom.maxStudents !== null
                      ? <>/{classroom.maxStudents}<span className="ml-1 opacity-70">({fillPct}%)</span></>
                      : <span className="ml-1 opacity-70">· Chưa có dữ liệu sức chứa</span>}
                  </p>
                  {!classroom.gradeKey && <p className="text-[10px] mb-2">Chưa có dữ liệu khối tuổi</p>}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-2.5 h-2.5" />{present} có mặt
                    </span>
                    {absent > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                        <XCircle className="w-2.5 h-2.5" />{absent} vắng
                      </span>
                    )}
                    {excused > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        {excused} phép
                      </span>
                    )}
                    {unmarked > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                        <Clock className="w-2.5 h-2.5" />{unmarked} chưa điểm
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-700/60">
          {/* Search bar */}
          <div className="relative w-full lg:w-84 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên bé, mã HS, phụ huynh, SĐT..."
              className="w-full pl-10 pr-8 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 hidden xl:inline-flex items-center gap-1 mr-0.5">
              <Filter className="w-3 h-3" /> Lọc:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Tất cả ({currentRoster.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'present' ? 'all' : 'present')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Có mặt ({attendanceSummary.present})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3 h-3" />
              Vắng ({attendanceSummary.absent})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'excused' ? 'all' : 'excused')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                statusFilter === 'excused'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Phép ({attendanceSummary.excused})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'unmarked' ? 'all' : 'unmarked')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'unmarked'
                  ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              Chưa điểm ({attendanceSummary.unmarked})
            </button>

            {/* Handover filter */}
            <select
              value={handoverFilter}
              aria-label="Lọc đưa đón"
              onChange={(e) => setHandoverFilter(e.target.value as typeof handoverFilter)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Đưa đón: Tất cả</option>
              <option value="handed_over">Đã bàn giao</option>
              <option value="pending">Chưa bàn giao</option>
            </select>

            {(search || statusFilter !== 'all' || handoverFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setHandoverFilter('all');
                }}
                className="px-2 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {(error || successMessage) && (
          <div role={error ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold ${
            error
              ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
          }`}>
            {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {error ?? successMessage}
          </div>
        )}
        {error && validContext && !rosterReady && !savingCommand && (
          <button type="button" onClick={() => void refreshRoster()} className="text-xs font-bold text-slate-700 dark:text-slate-200 underline">
            Thử tải lại danh sách
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--education-brand-ink)]" />
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Danh Sách Điểm Danh Buổi Sáng
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
              {selectedClassroom ? `${selectedClassroom.name} • ${currentRoster.length} học sinh` : 'Chưa chọn lớp'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/80 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-5">Học Sinh</th>
                  <th className="py-3.5 px-3">Trạng thái ngày</th>
                  <th className="py-3.5 px-3">Thân Nhiệt</th>
                  <th className="py-3.5 px-4 text-right">Ghi nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs text-gray-700 dark:text-gray-300">
                {loadingRoster ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-5 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang tải danh sách thật...
                      </span>
                    </td>
                  </tr>
                ) : filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-5 text-center text-gray-500">
                      Không có học sinh canonical nào trong lớp/ngày này
                    </td>
                  </tr>
                ) : (
                  paginatedAttendanceRoster.map((row) => {
                    const status = row.attendance?.status;
                    return (
                      <tr key={row.enrollmentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-gray-900 dark:text-white">
                          <div>
                            <p className="text-xs">{row.name}</p>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {row.studentCode || row.studentPartyId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          {status ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${ATTENDANCE_BADGES[status]}`}>
                              {status === 'present' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {ATTENDANCE_LABELS[status]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold text-[10px]">
                              Chưa điểm danh
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500">
                            <Thermometer className="w-3 h-3" />
                            Chưa kết nối
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex justify-end gap-2">
                            {VALID_ATTENDANCE_ACTIONS.map((action) => (
                              <button
                                key={action}
                                type="button"
                                disabled={!rosterReady || savingCommand}
                                onClick={() => void markAttendance(row.enrollmentId, action)}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-colors disabled:opacity-50 ${
                                  status === action
                                    ? ATTENDANCE_BADGES[action]
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                {ATTENDANCE_LABELS[action]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationControl
            currentPage={validAttendancePage}
            totalItems={filteredRoster.length}
            pageSize={attendancePageSize}
            onPageChange={setAttendancePage}
            onPageSizeChange={setAttendancePageSize}
            pageSizeOptions={[8, 10, 15, 25, 50]}
            itemLabel="học sinh"
          />
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Ủy Quyền Đưa Đón &amp; Quét QR An Toàn
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Danh sách bên dưới dùng học sinh thật; capability đưa đón/QR chưa nối trong bước này
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 p-3 border border-emerald-100 dark:border-emerald-900/40">
                <p className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300">Có mặt</p>
                <p className="text-xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{attendanceSummary.present}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/60 p-3 border border-rose-100 dark:border-rose-900/40">
                <p className="font-bold text-[10px] text-rose-700 dark:text-rose-300">Vắng</p>
                <p className="text-xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{attendanceSummary.absent}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/60 p-3 border border-amber-100 dark:border-amber-900/40">
                <p className="font-bold text-[10px] text-amber-700 dark:text-amber-300">Nghỉ phép</p>
                <p className="text-xl font-extrabold text-amber-900 dark:text-amber-100 mt-0.5">{attendanceSummary.excused}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-200 dark:border-slate-700/50">
                <p className="font-bold text-[10px] text-slate-600 dark:text-slate-300">Chưa điểm</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{attendanceSummary.unmarked}</p>
              </div>
            </div>

            <div className="space-y-3">
              {paginatedHandoverRoster.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  {loadingRoster ? 'Đang tải danh sách...' : 'Không có học sinh nào trong lớp/ngày này'}
                </div>
              ) : (
                paginatedHandoverRoster.map((row) => {
                  const guardian = row.authorizedGuardians?.[0] ?? null;
                  const handover = row.safePickupHandover ?? null;
                  const savingHandover = savingHandoverStudentPartyId === row.studentPartyId;

                  return (
                    <div
                      key={row.studentPartyId}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                          {row.name}
                        </h4>
                        {guardian ? (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                            Được phép đón: {guardian.displayName}
                            {guardian.phone ? ` · ${guardian.phone}` : ''}
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                            Chưa có guardian được phép đón
                          </p>
                        )}
                        {handover ? (
                          <p className="text-[11px] text-sky-700 dark:text-sky-300 font-bold">
                            Đã bàn giao: {guardian?.displayName ?? 'Guardian đã xác thực'} · {formatHandoverTime(handover.handedOverAt)}
                          </p>
                        ) : null}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                          <QrCode className="w-3 h-3" /> QR chưa kết nối; bàn giao ghi nhận bằng thao tác nhân viên
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={!rosterReady || savingCommand || !guardian || Boolean(handover)}
                        onClick={() => {
                          if (guardian) void recordHandover(row, guardian);
                        }}
                        className={`px-3.5 py-2 rounded-2xl font-bold text-xs shrink-0 transition-colors ${
                          handover
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 cursor-default'
                            : guardian
                              ? 'bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {savingHandover ? 'Đang ghi...' : handover ? 'Đã bàn giao' : 'Bàn giao'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <PaginationControl
              currentPage={validHandoverPage}
              totalItems={handoverEligibleRoster.length}
              pageSize={handoverPageSize}
              onPageChange={setHandoverPage}
              onPageSizeChange={setHandoverPageSize}
              pageSizeOptions={[6, 8, 12, 20, 50]}
              itemLabel="học sinh"
            />
          </div>

          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-1 text-xs">
            <p className="font-bold text-[var(--education-brand-ink)] flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-[var(--education-brand-ink)]" />
              Checkpoint hiện tại:
            </p>
            <p className="text-[var(--education-brand-ink)] leading-relaxed text-[11px]">
              Điểm danh và bàn giao đang ghi dữ liệu thật. QR và thân nhiệt vẫn là capability riêng, chưa được giả lập trong UI này.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const VALID_ATTENDANCE_ACTIONS: readonly AttendanceStatus[] = ['present', 'absent', 'excused'];

interface PaginationControlProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  itemLabel?: string;
}

function PaginationControl({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [8, 10, 15, 25, 50],
  itemLabel = 'học sinh',
}: PaginationControlProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const getVisiblePages = (): (number | string)[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (safePage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 text-xs">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span>
          <strong className="text-slate-700 dark:text-slate-200">{startItem}–{endItem}</strong> / <strong className="text-slate-700 dark:text-slate-200">{totalItems}</strong> {itemLabel}
        </span>
        {onPageSizeChange && totalItems > 0 && (
          <select
            value={pageSize}
            aria-label="Số lượng mỗi trang"
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="ml-1 px-2 py-0.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt >= 50 ? 'Tất cả' : `${opt}/trang`}
              </option>
            ))}
          </select>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {getVisiblePages().map((item, idx) => {
            if (typeof item === 'string') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-[10px]">
                  …
                </span>
              );
            }
            const isCurrent = item === safePage;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`min-w-[26px] h-6 px-1.5 rounded-lg text-[10px] font-extrabold transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item}
              </button>
            );
          })}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
// Named export preserved for unit test compatibility.
export function LegacyAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AttendancePageContent />
    </Suspense>
  );
}

// Default export: full modern Preschool Attendance dashboard.
export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AttendancePageContent />
    </Suspense>
  );
}
