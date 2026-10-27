'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { loadClassroomOverview, type ClassroomLiveOverview } from '../classroom-live-data';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';
import { isPreschoolRegistryPage, isRegistryUuid, type PreschoolRegistryPage } from '@/platform/education/contracts/preschool-registry.contract';
import { 
  ArrowLeft, 
  Users, 
  CalendarCheck, 
  MapPin, 
  Sparkles, 
  UserCheck,
  RefreshCw,
} from 'lucide-react';

interface StudentRosterItem {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  name: string;
  gender: string;
  status: string;
  temp: string;
}

interface TeacherItem {
  assignmentId: string;
  teacherPartyId: string;
  name: string;
  role: string;
  roleDisplay: string;
  academicYear: string;
  status: string;
}

interface ClassroomDetail {
  id: string;
  code: string;
  name: string;
  grade: string;
  room: string;
  maxStudents: number;
  currentStudents: number;
  teachers: TeacherItem[];
  teacherSummary: string;
  roster: StudentRosterItem[];
}

type WorkspaceState =
  | { classId: string; status: 'loading' | 'error' | 'empty' }
  | { classId: string; status: 'ready'; workspace: ClassroomDetail };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every(field => typeof value[field] === 'string');
}

// Validate the existing read shape; canonical read semantics are a separate workstream.
function isClassroomDetail(value: unknown, classId: string): value is ClassroomDetail {
  if (!isRecord(value) || value.id !== classId || !hasStringFields(value, [
    'id', 'code', 'name', 'grade', 'room', 'teacherSummary',
  ])) return false;
  if (typeof value.maxStudents !== 'number' || !Number.isInteger(value.maxStudents) || value.maxStudents < 0
    || typeof value.currentStudents !== 'number' || !Number.isInteger(value.currentStudents) || value.currentStudents < 0) return false;

  return Array.isArray(value.teachers) && value.teachers.every((teacher: unknown) =>
    isRecord(teacher) && hasStringFields(teacher, [
      'assignmentId', 'teacherPartyId', 'name', 'role', 'roleDisplay', 'academicYear', 'status',
    ]) && typeof teacher.assignmentId === 'string' && teacher.assignmentId.trim().length > 0
      && typeof teacher.teacherPartyId === 'string' && teacher.teacherPartyId.trim().length > 0)
    && Array.isArray(value.roster) && value.roster.every((student: unknown) =>
      isRecord(student) && hasStringFields(student, [
        'enrollmentId', 'studentId', 'studentCode', 'name', 'gender', 'status', 'temp',
      ]) && typeof student.enrollmentId === 'string' && student.enrollmentId.trim().length > 0
        && typeof student.studentId === 'string' && student.studentId.trim().length > 0);
}

type CatalogDetailState =
  | { classId: string; status: 'loading' | 'error' | 'empty' | 'legacy' }
  | { classId: string; status: 'ready'; course: EducationCourseDTO; registry: PreschoolRegistryPage | null; rosterStatus: 'loading' | 'error' | 'ready' };

const CLASSROOM_ROSTER_PAGE_SIZE = 20;

function isCatalogCourse(value: unknown, classId: string): value is EducationCourseDTO {
  return isRecord(value) && value.id === classId
    && ['id', 'tenantId', 'courseCode', 'title'].every(key => typeof value[key] === 'string' && value[key].trim().length > 0)
    && typeof value.status === 'string' && ['draft', 'active', 'archived'].includes(value.status)
    && Array.isArray(value.prerequisites) && value.prerequisites.every(code => typeof code === 'string');
}

export default function ClassWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const classId = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';
  const [loadState, setLoadState] = useState<CatalogDetailState>({ classId, status: 'loading' });
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'teachers' | 'attendance'>('overview');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [rosterOffset, setRosterOffset] = useState(0);
  const requestGeneration = useRef(0);
  const currentRequest = useRef<AbortController | null>(null);
  const [liveData, setLiveData] = useState<ClassroomLiveOverview | null>(null);
  const currentTenantId = loadState.status === 'ready' && loadState.classId === classId ? loadState.course.tenantId : null;

  useEffect(() => {
    const controller = new AbortController();
    setLiveData(null);
    if (currentTenantId) void loadClassroomOverview(currentTenantId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setLiveData(data.get(classId) ?? null); })
      .catch(() => { if (!controller.signal.aborted) setLiveData(null); });
    return () => controller.abort();
  }, [classId, currentTenantId, reloadVersion]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    currentRequest.current = controller;
    const isCurrent = () => requestGeneration.current === generation && !controller.signal.aborted;
    setLoadState({ classId, status: 'loading' });
    void (async () => {
      try {
        if (!classId.trim()) throw new Error('Missing course ID');
        const response = await fetch(`/api/education/courses/${encodeURIComponent(classId)}?view=catalog`, {
          signal: controller.signal, cache: 'no-store',
        });
        if (!isCurrent()) return;
        if (!response.ok) {
          if (response.status === 403) {
            const denial: unknown = await response.json();
            if (isCurrent() && isRecord(denial) && denial.success === false && denial.error === 'COURSE_CATALOG_UNSUPPORTED_PRODUCT') {
              setLoadState({ classId, status: 'legacy' });
              return;
            }
          }
          throw new Error('Course unavailable');
        }
        const data: unknown = await response.json();
        if (!isCurrent()) return;
        if (!isRecord(data) || data.success !== true) throw new Error('Invalid catalog response');
        if (data.course === null) {
          setLoadState({ classId, status: 'empty' });
          return;
        }
        if (!isCatalogCourse(data.course, classId)) throw new Error('Invalid course shape or ID');
        const course = data.course;
        if (!isRegistryUuid(classId)) {
          setLoadState({ classId, status: 'ready', course, registry: null, rosterStatus: 'error' });
          return;
        }
        setLoadState({ classId, status: 'ready', course, registry: null, rosterStatus: 'loading' });
        const query = { query: '', status: 'all' as const, courseId: classId, branchId: null, offset: rosterOffset, limit: CLASSROOM_ROSTER_PAGE_SIZE };
        const search = new URLSearchParams({ courseId: classId, offset: String(rosterOffset), limit: String(CLASSROOM_ROSTER_PAGE_SIZE) });
        const rosterResponse = await fetch(`/api/education/student-registry?${search}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const rosterPayload: unknown = await rosterResponse.json();
        if (!isCurrent()) return;
        if (!rosterResponse.ok || !isRecord(rosterPayload) || rosterPayload.success !== true
          || !isPreschoolRegistryPage(rosterPayload.registry, query, course.tenantId)) throw new Error('Registry unavailable');
        setLoadState({ classId, status: 'ready', course, registry: rosterPayload.registry, rosterStatus: 'ready' });
      } catch {
        if (isCurrent()) setLoadState(previous => previous.classId === classId && previous.status === 'ready'
          ? { ...previous, registry: null, rosterStatus: 'error' }
          : { classId, status: 'error' });
      }
    })();
    return () => {
      controller.abort();
      requestGeneration.current += 1;
      if (currentRequest.current === controller) currentRequest.current = null;
    };
  }, [classId, reloadVersion, rosterOffset]);

  const reload = () => {
    currentRequest.current?.abort();
    requestGeneration.current += 1;
    setLoadState({ classId, status: 'loading' });
    setReloadVersion(version => version + 1);
  };
  const state = loadState.classId === classId ? loadState : { classId, status: 'loading' as const };
  const live = state.status === 'ready' && liveData?.id === classId && liveData.tenantId === state.course.tenantId
    && liveData.code === state.course.courseCode && liveData.name === state.course.title ? liveData : null;
  if (state.status === 'legacy') return <LegacyClassWorkspacePage params={params} onRefresh={reload} />;

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {state.status === 'ready' ? (
        <>
          <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
              <div className="flex items-center gap-3">
                <Link href="/dashboard/education/courses" aria-label="Quay lại Quản lý lớp học"
                  className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
                  title="Quay lại Quản lý lớp học"><ArrowLeft className="w-4 h-4" /></Link>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20">Mã lớp: <span>{state.course.courseCode}</span></span>
                    <span className="text-[11px] font-semibold text-slate-500">Phòng học: chưa được cung cấp</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">{state.course.title}</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Giáo viên: {live?.teacher ?? 'chưa được cung cấp'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button type="button" onClick={reload} title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu"
                  className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                <Link href={`/dashboard/education/attendance?courseId=${encodeURIComponent(classId)}`} aria-label="Điểm danh lớp này"
                  className="px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4" />Điểm Danh Lớp</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Sức chứa lớp', live?.maxStudents ?? 'Chưa được cung cấp'],
                ['Có mặt hôm nay', live?.todayStatus.present ?? 'Chưa được cung cấp'],
                ['Đội ngũ GVN', live?.teacherCount ?? 'Chưa được cung cấp'],
              ].map(([label, value]) => <div key={label} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">{value}</div>
              </div>)}
            </div>
          <nav aria-label="Thông tin khóa học" className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
            {([
              ['overview', 'Tổng Quan Lớp'], ['students', 'Danh Sách Học Sinh'],
              ['teachers', 'Đội Ngũ GVN'], ['attendance', 'Sổ Điểm Danh'],
            ] as const).map(([tab, title]) => <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{title}</button>)}
          </nav>
          </div>
          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-6 space-y-4 text-sm text-slate-700 dark:text-slate-200">
            {activeTab === 'overview' && <>
              <p>Danh tính lớp học đã được xác minh từ Education. Phòng học, sức chứa, khối lớp và năm học chưa có nguồn chuẩn để hiển thị.</p>
              <p>Điều kiện tiên quyết: <span>{state.course.prerequisites.length ? state.course.prerequisites.join(', ') : 'Không có'}</span></p>
              <button type="button" disabled={!live || live.teacherCount === null} onClick={() => { window.location.href = '/dashboard/education/teachers'; }} aria-describedby="catalog-overview-assignment-unavailable" className="font-bold disabled:cursor-not-allowed text-slate-500 dark:text-slate-400">Phân công GVN</button>
              <p id="catalog-overview-assignment-unavailable">{live && live.teacherCount !== null ? 'Quản lý phân công tại trang Quản lý giáo viên.' : 'Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.'}</p>
            </>}
            {activeTab === 'students' && <div className="space-y-4">
              <div>
                <h2 className="font-bold">Danh sách học sinh đăng ký lớp</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Danh sách theo đăng ký lớp và mapping chi nhánh được cấp quyền; không đại diện cho số học sinh có mặt hôm nay.</p>
              </div>
              {state.rosterStatus === 'loading' && <p role="status">Đang tải danh sách học sinh…</p>}
              {state.rosterStatus === 'error' && <p role="alert" className="text-red-700 dark:text-red-300">Không thể tải danh sách học sinh trong phạm vi được cấp quyền. Chưa xác định được số học sinh; vui lòng tải lại.</p>}
              {state.registry && state.registry.filteredTotal === 0 && <p>Chưa có học sinh đăng ký trong phạm vi được cấp quyền.</p>}
              {state.registry && state.registry.filteredTotal > 0 && <>
                <p>Hiển thị {rosterOffset + 1}–{rosterOffset + state.registry.students.length} / {state.registry.filteredTotal} học sinh</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="py-3 pr-4">Mã học sinh</th><th className="py-3 pr-4">Họ và tên</th><th className="py-3 pr-4">Đăng ký lớp</th><th className="py-3">Cơ sở</th></tr></thead>
                    <tbody>{state.registry.students.map(student => <tr key={student.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3 pr-4 font-mono">{student.studentCode}</td>
                      <td className="py-3 pr-4 font-semibold">{student.name}</td>
                      <td className="py-3 pr-4">{student.enrollments.map(enrollment => enrollment.status === 'active' ? 'Đang hoạt động' : 'Chờ xác nhận').join(', ')}</td>
                      <td className="py-3">{[...new Set(student.enrollments.map(enrollment => enrollment.branchName))].join(', ')}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <nav aria-label="Phân trang học sinh" className="flex gap-3">
                  <button type="button" disabled={rosterOffset === 0} onClick={() => setRosterOffset(Math.max(0, rosterOffset - CLASSROOM_ROSTER_PAGE_SIZE))} className="rounded-xl border px-3 py-2 disabled:opacity-40">Trang trước</button>
                  <button type="button" disabled={state.registry.nextOffset === null} onClick={() => { if (state.registry?.nextOffset !== null && state.registry?.nextOffset !== undefined) setRosterOffset(state.registry.nextOffset); }} className="rounded-xl border px-3 py-2 disabled:opacity-40">Trang sau</button>
                </nav>
              </>}
            </div>}
            {activeTab === 'teachers' && <>
              <p role="status">{live?.teacher ?? 'Thông tin đội ngũ giáo viên hiện chưa khả dụng trong danh mục này.'}</p>
              <button type="button" disabled={!live || live.teacherCount === null} onClick={() => { window.location.href = '/dashboard/education/teachers'; }} aria-describedby="catalog-teachers-assignment-unavailable" className="font-bold disabled:cursor-not-allowed text-slate-500 dark:text-slate-400">Phân công Giáo viên Mới</button>
              <p id="catalog-teachers-assignment-unavailable">{live && live.teacherCount !== null ? 'Quản lý phân công tại trang Quản lý giáo viên.' : 'Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.'}</p>
            </>}
            {activeTab === 'attendance' && <div className="space-y-3">
              <p role="status">Mở sổ điểm danh theo đúng lớp đã chọn. Dữ liệu ngày và thao tác điểm danh tuân theo phạm vi được cấp quyền tại trang điểm danh.</p>
              <Link href={`/dashboard/education/attendance?courseId=${encodeURIComponent(classId)}`} className="inline-flex rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">Mở điểm danh lớp này</Link>
            </div>}
          </section>
        </>
      ) : <><Link href="/dashboard/education/courses" className="text-sm font-bold text-[var(--education-brand-ink)]">Quay lại Quản lý lớp học</Link>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Chi tiết lớp học</h1>
        <p role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite" className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-700 dark:text-slate-200">{state.status === 'loading' ? 'Đang tải dữ liệu lớp học…' : state.status === 'empty' ? 'Chưa có dữ liệu lớp học.' : 'Không thể tải dữ liệu lớp học. Vui lòng thử lại.'}</p>
        <button type="button" onClick={reload} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Tải lại dữ liệu</button></>}
    </div>
  );
}

function LegacyClassWorkspacePage({ params, onRefresh }: { params: Promise<{ id: string }>; onRefresh: () => void }) {
  const resolvedParams = use(params);
  const classId = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';

  const [loadState, setLoadState] = useState<WorkspaceState>({ classId, status: 'loading' });
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'attendance' | 'teachers'>('overview');
  const requestGeneration = useRef(0);
  const currentRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    currentRequest.current = controller;
    const isCurrent = () => requestGeneration.current === generation && !controller.signal.aborted;
    setLoadState({ classId, status: 'loading' });

    void (async () => {
      try {
        if (!classId.trim()) throw new Error('Missing class ID');
        const response = await fetch(`/api/education/courses/${encodeURIComponent(classId)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Class detail unavailable');
        const data: unknown = await response.json();
        if (!isCurrent()) return;
        if (!isRecord(data) || data.success !== true) throw new Error('Invalid class detail response');
        if (data.classroom === null) {
          setLoadState({ classId, status: 'empty' });
        } else if (isClassroomDetail(data.classroom, classId)) {
          setLoadState({ classId, status: 'ready', workspace: data.classroom });
        } else {
          throw new Error('Invalid class detail shape or ID');
        }
      } catch {
        if (isCurrent()) setLoadState({ classId, status: 'error' });
      }
    })();

    return () => {
      controller.abort();
      requestGeneration.current += 1;
      if (currentRequest.current === controller) currentRequest.current = null;
    };
  }, [classId]);

  const reloadWorkspace = () => {
    currentRequest.current?.abort();
    requestGeneration.current += 1;
    setLoadState({ classId, status: 'loading' });
    // Revalidate the current Product before another default-mode read.
    onRefresh();
  };

  const state = loadState.classId === classId ? loadState : { classId, status: 'loading' as const };
  if (state.status !== 'ready') {
    return (
      <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        <Link href="/dashboard/education/courses" className="text-sm font-bold text-[var(--education-brand-ink)]">
          Quay lại Quản lý lớp học
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Chi tiết lớp học</h1>
        <div role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite" className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-700 dark:text-slate-200">
          {state.status === 'loading' ? 'Đang tải dữ liệu lớp học…'
            : state.status === 'empty' ? 'Chưa có dữ liệu lớp học.'
              : 'Không thể tải dữ liệu lớp học. Vui lòng thử lại.'}
        </div>
        <button type="button" onClick={reloadWorkspace} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          Tải lại dữ liệu
        </button>
      </div>
    );
  }

  const workspace = state.workspace;
  const percent = workspace.maxStudents > 0
    ? `${Math.min(100, Math.round((workspace.currentStudents / workspace.maxStudents) * 100))}%`
    : '—';

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education/courses" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Quản lý lớp học"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-primary/10 text-[var(--education-brand-ink)] border border-primary/20">
                  {workspace.grade}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {workspace.room}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">
                {workspace.name} — Workspace 360°
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Giáo viên: <strong>{workspace.teacherSummary}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={reloadWorkspace}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link 
              href="/dashboard/education/attendance" 
              className="px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Điểm Danh Lớp</span>
            </Link>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500">Sức chứa lớp</span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              {workspace.currentStudents} / {workspace.maxStudents} <span className="text-xs font-normal text-slate-400">({percent})</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Có mặt hôm nay</span>
            <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200 mt-1">
              {workspace.roster.filter(s => s.status === 'Có mặt').length} / {workspace.currentStudents} bé
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 ">
            <span className="text-[11px] font-bold text-[var(--education-brand-ink)]">Đội ngũ GVN</span>
            <div className="text-lg font-extrabold text-[var(--education-brand-ink)] mt-1">
              {workspace.teachers.length} <span className="text-xs font-normal text-[var(--education-brand-ink)]">giáo viên</span>
            </div>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
          {[
            { id: 'overview', label: 'Tổng Quan Lớp', icon: Sparkles },
            { id: 'students', label: `Danh Sách Học Sinh (${workspace.currentStudents})`, icon: Users },
            { id: 'teachers', label: `Đội Ngũ GVN (${workspace.teachers.length})`, icon: UserCheck },
            { id: 'attendance', label: 'Sổ Điểm Danh Today', icon: CalendarCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'students' | 'attendance' | 'teachers')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 pt-2">
            <div className="space-y-6">
              {/* Teachers Cards */}
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[var(--education-brand-ink)]" />
                    <span>Đội ngũ Giáo viên Phụ trách</span>
                  </h3>
                  <button
                    type="button"
                    disabled
                    aria-describedby="overview-assignment-unavailable"
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <span>Phân công GVN</span>
                  </button>
                </div>
                <p id="overview-assignment-unavailable" className="text-xs text-slate-600 dark:text-slate-300">
                  Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.
                </p>
                {workspace.teachers.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu phân công giáo viên.</p>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {workspace.teachers.map((t) => (
                    <div key={t.assignmentId} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${t.role === 'lead_teacher' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                          {t.roleDisplay}
                        </span>
                        <span className="text-[10px] text-slate-400">Niên học {t.academicYear}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{t.name}</h4>
                      <p className="text-[11px] text-slate-500">Trạng thái: {t.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab Content: Student Roster */}
        {activeTab === 'students' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Danh Sách Học Sinh Lớp</h3>
            </div>
            {workspace.roster.length === 0 && <p role="status" className="text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu học sinh.</p>}

            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Mã HS</th>
                    <th className="p-3.5">Họ &amp; Tên Học Sinh</th>
                    <th className="p-3.5">Giới tính</th>
                    <th className="p-3.5">Thân nhiệt sáng</th>
                    <th className="p-3.5">Trạng thái điểm danh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {workspace.roster.map((s) => (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-[var(--education-brand-ink)]">{s.studentCode}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{s.name}</td>
                      <td className="p-3.5">{s.gender}</td>
                      <td className="p-3.5">{s.temp}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${s.status === 'Có mặt' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Teachers Management */}
        {activeTab === 'teachers' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Đội Ngũ GVN</h3>
              <button
                type="button"
                disabled
                aria-describedby="teachers-assignment-unavailable"
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs disabled:cursor-not-allowed"
              >
                <span>Phân công Giáo viên Mới</span>
              </button>
            </div>
            <p id="teachers-assignment-unavailable" role="status" className="text-xs text-slate-600 dark:text-slate-300">
              Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.
            </p>
            {workspace.teachers.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu phân công giáo viên.</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {workspace.teachers.map((t) => (
                <div key={t.assignmentId} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold px-3 py-0.5 rounded-full ${t.role === 'lead_teacher' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {t.roleDisplay}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{t.name}</h4>
                  <p className="text-xs text-slate-500">Niên học: {t.academicYear}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Attendance */}
        {activeTab === 'attendance' && (
          <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center space-y-3">
            <CalendarCheck className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Sổ Điểm Danh &amp; Đón Trẻ Hằng Ngày</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Mở trang điểm danh để xem dữ liệu và các thao tác khả dụng.
            </p>
            <Link
              href="/dashboard/education/attendance"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs shadow-md"
            >
              Mở Giao Diện Điểm Danh Chi Tiết →
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
