'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CourseDailyAttendanceRosterItem, EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { EnrollmentCreateForm } from './EnrollmentCreateForm';
import { PreschoolStudentRegistry } from './PreschoolStudentRegistry';


type Course = { id: string; tenantId: string; courseCode: string; title: string; status: 'draft' | 'active' | 'archived' };
type LoadState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };
type RosterState = { status: 'loading' | 'error' } | { status: 'ready'; courseId: string; value: CourseDailyAttendanceRosterItem[] };
const labels: Record<EducationAttendanceStatus, string> = { present: 'Có mặt', absent: 'Vắng', excused: 'Có phép' };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isNullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isStatus = (value: unknown): value is EducationAttendanceStatus =>
  value === 'present' || value === 'absent' || value === 'excused';

function isCourse(value: unknown): value is Course {
  return isRecord(value) && isText(value.id) && isText(value.tenantId) && isText(value.courseCode)
    && isText(value.title) && (value.status === 'draft' || value.status === 'active' || value.status === 'archived');
}

function isRosterRow(value: unknown, tenantId: string, day: string): value is CourseDailyAttendanceRosterItem {
  if (!isRecord(value) || !isText(value.enrollmentId) || !isText(value.studentId)
    || !isText(value.studentPartyId) || !isText(value.name) || !isNullableText(value.studentCode)
    || !isNullableText(value.gender) || !isNullableText(value.dob) || value.enrollmentStatus !== 'active') return false;
  if (value.attendance === null) return true;
  const attendance = value.attendance;
  return isRecord(attendance) && isText(attendance.id) && attendance.tenantId === tenantId
    && attendance.enrollmentId === value.enrollmentId && attendance.schoolDay === day
    && isStatus(attendance.status) && isText(attendance.createdAt) && isText(attendance.updatedAt);
}

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function EnrollmentsPage() {
  const [courses, setCourses] = useState<LoadState<Course[]>>({ status: 'loading' });
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [roster, setRoster] = useState<RosterState>({ status: 'loading' });
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [enrollmentSubmitting, setEnrollmentSubmitting] = useState(false);

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
          || !body.courses.every(isCourse)) throw new Error('CATALOG_UNAVAILABLE');
        const allCourses = body.courses;
        if (new Set(allCourses.map(course => course.id)).size !== allCourses.length
          || new Set(allCourses.map(course => course.tenantId)).size > 1) throw new Error('INVALID_CATALOG');
        const activeCourses = allCourses.filter(course => course.status === 'active');
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

  const selectedCourse = courses.status === 'ready'
    ? courses.value.find(course => course.id === selectedCourseId) : undefined;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRoster({ status: 'loading' });
    if (!selectedCourse) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        const day = todayInVietnam();
        const query = new URLSearchParams({ view: 'roster', courseId: selectedCourse.id, date: day });
        const response = await fetch(`/api/education/attendance?${query}`, { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || body.success !== true || body.courseId !== selectedCourse.id
          || body.schoolDay !== day || !Array.isArray(body.roster)
          || !body.roster.every(row => isRosterRow(row, selectedCourse.tenantId, day))
          || new Set(body.roster.map(row => isRecord(row) ? row.enrollmentId : null)).size !== body.roster.length) {
          throw new Error('ROSTER_UNAVAILABLE');
        }
        if (active) setRoster({ status: 'ready', courseId: selectedCourse.id, value: body.roster });
      } catch {
        if (active) setRoster({ status: 'error' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [selectedCourse, rosterRefreshKey]);

  const currentRoster = roster.status === 'ready' && roster.courseId === selectedCourse?.id ? roster.value : null;

  return (
    <main className="preschool-ui mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Danh sách học sinh</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Hồ sơ toàn trường và roster đang học theo lớp được cấp quyền.</p>
      </header>
      <PreschoolStudentRegistry refreshKey={rosterRefreshKey} />
      {courses.status === 'loading' && <p role="status">Đang tải danh mục lớp…</p>}
      {courses.status === 'error' && <p role="alert">Không thể tải danh mục lớp được cấp quyền.</p>}
      {courses.status === 'ready' && courses.value.length === 0 && <p role="status">Không có lớp đang hoạt động trong danh mục được cấp quyền.</p>}
      {courses.status === 'ready' && courses.value.length > 0 && <>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Lớp học
          <select aria-label="Lớp học" disabled={enrollmentSubmitting} className="mt-1 block rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50" value={selectedCourseId} onChange={event => {
            const value = event.target.value;
            setSelectedCourseId(value);
            const url = new URL(window.location.href);
            url.searchParams.set('courseId', value);
            window.history.replaceState(window.history.state, '', url);
          }}>
            {courses.value.map(course => <option key={course.id} value={course.id}>{course.title} · {course.courseCode}</option>)}
          </select>
        </label>
        {selectedCourse && <EnrollmentCreateForm course={selectedCourse} onSubmittingChange={setEnrollmentSubmitting} onEnrolled={courseId => {
          setSelectedCourseId(courseId);
          setRosterRefreshKey(value => value + 1);
        }} />}
        {(roster.status === 'loading' || (roster.status === 'ready' && !currentRoster)) && <p role="status">Đang tải roster lớp…</p>}
        {roster.status === 'error' && <p role="alert">Không thể xác minh roster. Không hiển thị dữ liệu thay thế.</p>}
        {currentRoster?.length === 0 && <p role="status">Roster lớp hiện không có học sinh đang hoạt động.</p>}
        {currentRoster && currentRoster.length > 0 && <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {currentRoster.map(row => <li key={row.enrollmentId} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><Link className="font-semibold text-slate-900 underline dark:text-white" href={`/dashboard/education/enrollments/${encodeURIComponent(row.studentId)}?courseId=${encodeURIComponent(selectedCourse?.id ?? '')}`}>{row.name}</Link>
              <p className="text-sm text-slate-600 dark:text-slate-300">{row.studentCode ?? 'Chưa có mã học sinh'} · {selectedCourse?.title}</p></div>
            <p className="text-sm text-slate-700 dark:text-slate-200">Điểm danh hôm nay: {row.attendance ? labels[row.attendance.status] : 'Chưa điểm danh'}</p>
          </li>)}
        </ul>}
      </>}
    </main>
  );
}
