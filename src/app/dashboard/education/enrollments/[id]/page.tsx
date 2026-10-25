'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PortalAccessLink from './PortalAccessLink';
import type { CourseDailyAttendanceRosterItem, EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';

type Course = { id: string; tenantId: string; courseCode: string; title: string; status: 'draft' | 'active' | 'archived' };
type LoadState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };
const attendanceLabels: Record<EducationAttendanceStatus, string> = { present: 'Có mặt', absent: 'Vắng', excused: 'Có phép' };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isAttendanceStatus = (value: unknown): value is EducationAttendanceStatus =>
  value === 'present' || value === 'absent' || value === 'excused';

function isCourse(value: unknown): value is Course {
  return isRecord(value) && isText(value.id) && isText(value.tenantId) && isText(value.courseCode)
    && isText(value.title) && (value.status === 'draft' || value.status === 'active' || value.status === 'archived');
}

function isRosterRow(value: unknown, tenantId: string, schoolDay: string): value is CourseDailyAttendanceRosterItem {
  if (!isRecord(value) || !isText(value.enrollmentId) || !isText(value.studentId)
    || !isText(value.studentPartyId) || !isText(value.name) || !isNullableText(value.studentCode)
    || !isNullableText(value.gender) || !isNullableText(value.dob) || value.enrollmentStatus !== 'active') return false;
  if (value.attendance === null) return true;
  const attendance = value.attendance;
  return isRecord(attendance) && isText(attendance.id) && attendance.tenantId === tenantId
    && attendance.enrollmentId === value.enrollmentId && attendance.schoolDay === schoolDay
    && isAttendanceStatus(attendance.status) && isText(attendance.createdAt) && isText(attendance.updatedAt);
}

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function Student360Page({ studentId: requestedStudentId }: { readonly studentId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const studentId = requestedStudentId ?? (typeof params?.id === 'string' ? params.id : '');
  const [courses, setCourses] = useState<LoadState<Course[]>>({ status: 'loading' });
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [roster, setRoster] = useState<LoadState<{ courseId: string; studentId: string; rows: CourseDailyAttendanceRosterItem[] }>>({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCourses({ status: 'loading' });
    setSelectedCourseId('');
    void (async () => {
      try {
        const response = await fetch('/api/education/courses?view=catalog', { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || body.success !== true || !Array.isArray(body.courses)
          || !body.courses.every(isCourse)) throw new Error('UNAVAILABLE');
        const rows = body.courses;
        if (new Set(rows.map(course => course.id)).size !== rows.length
          || rows.some(course => course.tenantId !== rows[0]?.tenantId)) throw new Error('INVALID_CATALOG');
        const activeCourses = rows.filter(course => course.status === 'active');
        const hints = new URLSearchParams(window.location.search).getAll('courseId');
        if (hints.length > 1 || (hints.length === 1 && !activeCourses.some(item => item.id === hints[0]))) throw new Error('INVALID_COURSE_SELECTOR');
        if (!active) return;
        setCourses({ status: 'ready', value: activeCourses });
        setSelectedCourseId(hints[0] ?? activeCourses[0]?.id ?? '');
      } catch {
        if (active) setCourses({ status: 'error' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const course = courses.status === 'ready' ? courses.value.find(item => item.id === selectedCourseId) : undefined;
    setRoster({ status: 'loading' });
    if (!course || !studentId) {
      if (course && !studentId) setRoster({ status: 'error' });
      return () => { active = false; controller.abort(); };
    }
    void (async () => {
      try {
        const day = todayInVietnam();
        const query = new URLSearchParams({ view: 'roster', courseId: course.id, date: day });
        const response = await fetch(`/api/education/attendance?${query}`, { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || body.success !== true || body.courseId !== course.id
          || body.schoolDay !== day || !Array.isArray(body.roster) || !body.roster.every(row => isRosterRow(row, course.tenantId, day))
          || new Set(body.roster.map(row => row.enrollmentId)).size !== body.roster.length) throw new Error('UNAVAILABLE');
        if (active) setRoster({ status: 'ready', value: { courseId: course.id, studentId, rows: body.roster.filter(row => row.studentId === studentId) } });
      } catch {
        if (active) setRoster({ status: 'error' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [courses, selectedCourseId, studentId, reload]);

  const course = courses.status === 'ready' ? courses.value.find(item => item.id === selectedCourseId) : undefined;
  const currentRoster = roster.status === 'ready' && roster.value.courseId === selectedCourseId && roster.value.studentId === studentId ? roster.value.rows : null;
  const studentRows = currentRoster ?? [];

  return (
    <main className="preschool-ui mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Link href={selectedCourseId ? `/dashboard/education/enrollments?courseId=${encodeURIComponent(selectedCourseId)}` : '/dashboard/education/enrollments'} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Quay lại Quản lý trẻ
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Hồ sơ học sinh</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Chỉ hiển thị danh tính ghi danh và điểm danh hôm nay từ roster được cấp quyền. Hồ sơ sức khỏe, học phí và lịch sử chưa khả dụng tại đây.</p>
      </header>

      {courses.status === 'loading' && <p role="status">Đang tải danh mục lớp…</p>}
      {courses.status === 'error' && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">Không thể tải lớp được cấp quyền. Hồ sơ chưa khả dụng.</div>}
      {courses.status === 'ready' && courses.value.length === 0 && <p role="status">Không có lớp đang hoạt động trong danh mục được cấp quyền.</p>}
      {courses.status === 'ready' && courses.value.length > 0 && <>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Lớp học
          <select aria-label="Lớp học" className="mt-1 block rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900" value={selectedCourseId} onChange={event => {
            const value = event.target.value;
            setSelectedCourseId(value);
            const url = new URL(window.location.href);
            url.searchParams.set('courseId', value);
            window.history.replaceState(window.history.state, '', url);
          }}>
            {courses.value.map(item => <option key={item.id} value={item.id}>{item.title} · {item.courseCode}</option>)}
          </select>
        </label>
        {(roster.status === 'loading' || (roster.status === 'ready' && currentRoster === null)) && <p role="status">Đang kiểm tra roster lớp…</p>}
        {roster.status === 'error' && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">Không thể xác minh roster. Không hiển thị dữ liệu thay thế.<button type="button" className="ml-2 underline" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>}
        {currentRoster !== null && studentRows.length === 0 && <p role="status">Không tìm thấy học sinh trong roster lớp được cấp quyền.</p>}
        {roster.status === 'ready' && studentRows.map(row => (
          <section key={row.enrollmentId} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800" aria-label={`Hồ sơ ${row.name}`}>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{row.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{row.studentCode ?? 'Mã học sinh chưa ghi nhận'}</p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {row.gender && <div><dt className="font-semibold">Giới tính</dt><dd>{row.gender}</dd></div>}
              {row.dob && <div><dt className="font-semibold">Ngày sinh</dt><dd>{row.dob}</dd></div>}
              <div><dt className="font-semibold">Lớp</dt><dd>{course?.title}</dd></div>
              <div><dt className="font-semibold">Điểm danh hôm nay</dt><dd>{row.attendance ? attendanceLabels[row.attendance.status] : 'Chưa điểm danh'}</dd></div>
            </dl>
            <p className="text-xs text-slate-500 dark:text-slate-400">Enrollment đang hoạt động · {todayInVietnam()} (giờ Việt Nam)</p>
            {course && <PortalAccessLink key={`${course.id}/${row.studentPartyId}`} tenantId={course.tenantId} courseId={course.id} studentPartyId={row.studentPartyId} />}
          </section>
        ))}
      </>}
    </main>
  );
}
