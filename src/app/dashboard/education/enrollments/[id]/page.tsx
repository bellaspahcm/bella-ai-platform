'use client';

import { Suspense, useEffect, useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CircleAlert,
  Clock3,
  GraduationCap,
  IdCard,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Student360ProfileData } from '@/app/api/education/enrollments/student-360.service';
import { useUser } from '@/lib/user-context';
import PortalAccessLink from './PortalAccessLink';
import StudentGuardians from './StudentGuardians';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; selector: string; profile: Student360ProfileData }
  | { status: 'error'; code: string; message: string; needsLogin: boolean };

const PROFILE_KEYS = ['id', 'studentId', 'partyId', 'name', 'dob', 'gender', 'enrollments', 'attendance'];
const ENROLLMENT_KEYS = ['id', 'courseId', 'courseCode', 'courseTitle', 'branchId', 'branchName', 'status'];
const ATTENDANCE_KEYS = ['present', 'absent', 'excused', 'totalRecords', 'records'];
const ATTENDANCE_RECORD_KEYS = ['id', 'enrollmentId', 'courseId', 'courseTitle', 'status', 'rollCallTime'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEnrollment(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ENROLLMENT_KEYS)) return false;
  return isUuid(value.id) && isUuid(value.courseId) && isUuid(value.branchId)
    && isNonEmptyText(value.courseCode) && isNonEmptyText(value.courseTitle)
    && isNonEmptyText(value.branchName) && (value.status === 'active' || value.status === 'pending');
}

function isAttendanceRecord(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ATTENDANCE_RECORD_KEYS)) return false;
  return isUuid(value.id) && isUuid(value.enrollmentId) && isUuid(value.courseId)
    && isNonEmptyText(value.courseTitle)
    && (value.status === 'present' || value.status === 'absent' || value.status === 'excused')
    && typeof value.rollCallTime === 'string' && Number.isFinite(Date.parse(value.rollCallTime));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isStudent360Profile(value: unknown): value is Student360ProfileData {
  if (!isRecord(value) || !hasOnlyKeys(value, PROFILE_KEYS)
    || !isNonEmptyText(value.id) || !isUuid(value.studentId) || !isUuid(value.partyId)
    || !isNonEmptyText(value.name) || (value.dob !== null && typeof value.dob !== 'string')
    || (value.gender !== null && typeof value.gender !== 'string') || !Array.isArray(value.enrollments)
    || !value.enrollments.every(isEnrollment) || !isRecord(value.attendance)
    || !hasOnlyKeys(value.attendance, ATTENDANCE_KEYS)
    || !isNonNegativeInteger(value.attendance.present)
    || !isNonNegativeInteger(value.attendance.absent)
    || !isNonNegativeInteger(value.attendance.excused)
    || !isNonNegativeInteger(value.attendance.totalRecords)
    || !Array.isArray(value.attendance.records)
    || !value.attendance.records.every(isAttendanceRecord)) return false;
  return value.attendance.totalRecords === value.attendance.records.length
    && value.attendance.present + value.attendance.absent + value.attendance.excused === value.attendance.totalRecords;
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chưa ghi nhận' : new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function genderLabel(value: string | null): string {
  if (value === 'male') return 'Bé trai';
  if (value === 'female') return 'Bé gái';
  if (value === 'other') return 'Khác';
  return 'Chưa ghi nhận';
}

function enrollmentStatusLabel(status: 'active' | 'pending'): string {
  return status === 'active' ? 'Đang học' : 'Chờ nhập học';
}

function attendanceStatusLabel(status: 'present' | 'absent' | 'excused'): string {
  if (status === 'present') return 'Có mặt';
  if (status === 'absent') return 'Vắng';
  return 'Vắng có phép';
}

function loadErrorMessage(status: number, code: string): { message: string; needsLogin: boolean } {
  if (status === 401 || code === 'STUDENT_PROFILE_UNAUTHENTICATED') {
    return { message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại để xem hồ sơ.', needsLogin: true };
  }
  if (status === 403) return { message: 'Tài khoản hiện tại không có quyền xem hồ sơ trẻ này.', needsLogin: false };
  if (status === 404) return { message: 'Không tìm thấy trẻ trong phạm vi lớp được cấp quyền.', needsLogin: false };
  if (status === 400) return { message: 'Mã hồ sơ không hợp lệ. Vui lòng quay lại danh sách trẻ và chọn lại.', needsLogin: false };
  return { message: 'Chưa thể tải hồ sơ đã xác minh. Vui lòng thử lại.', needsLogin: false };
}

function ProfileLoading(): ReactElement {
  return (
    <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8" aria-busy="true">
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-10 w-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-44 rounded-3xl bg-white shadow-sm dark:bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-28 rounded-3xl bg-white shadow-sm dark:bg-slate-900" />)}
        </div>
      </div>
    </main>
  );
}

function ProfileError({ state, onRetry }: { state: Extract<LoadState, { status: 'error' }>; onRetry: () => void }): ReactElement {
  return (
    <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/education/enrollments" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách trẻ
        </Link>
        <section role="alert" className="mt-6 rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
          <CircleAlert className="mx-auto h-11 w-11 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Không thể mở hồ sơ</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{state.message}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">Mã: {state.code}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {state.needsLogin && (
              <Link href={{ pathname: '/login', query: { reset: 'true', next: '/dashboard/education/enrollments' } }} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900">
                Đăng nhập lại
              </Link>
            )}
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <RefreshCw className="h-4 w-4" /> Thử lại
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Student360PageContent(): ReactElement {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const { user, product } = useUser();
  const courseHint = searchParams.get('courseId')?.trim() ?? '';
  const studentCode = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0]?.trim() ?? '' : raw?.trim() ?? '';
  }, [params]);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });

    if (!studentCode) {
      setState({ status: 'error', code: 'MISSING_STUDENT_ID', message: 'Mã hồ sơ bị thiếu. Vui lòng quay lại danh sách trẻ.', needsLogin: false });
      return () => controller.abort();
    }

    void fetch(`/api/education/enrollments/${encodeURIComponent(studentCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    }).then(async response => {
      const body: unknown = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        const code = isRecord(body) && typeof body.error === 'string' ? body.error : 'STUDENT_PROFILE_UNAVAILABLE';
        setState({ status: 'error', code, ...loadErrorMessage(response.status, code) });
        return;
      }
      if (!isRecord(body) || body.success !== true || !isStudent360Profile(body.profile)) {
        setState({ status: 'error', code: 'STUDENT_PROFILE_UNAVAILABLE', ...loadErrorMessage(503, 'STUDENT_PROFILE_UNAVAILABLE') });
        return;
      }
      setState({ status: 'ready', selector: studentCode, profile: body.profile });
    }).catch(error => {
      if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
      setState({ status: 'error', code: 'STUDENT_PROFILE_UNAVAILABLE', ...loadErrorMessage(503, 'STUDENT_PROFILE_UNAVAILABLE') });
    });

    return () => { active = false; controller.abort(); };
  }, [studentCode, reloadToken]);

  if (state.status === 'loading' || (state.status === 'ready' && state.selector !== studentCode)) return <ProfileLoading />;
  if (state.status === 'error') return <ProfileError state={state} onRetry={() => setReloadToken(value => value + 1)} />;

  const { profile } = state;
  const activeEnrollment = profile.enrollments.find(enrollment => enrollment.status === 'active' && enrollment.courseId === courseHint)
    ?? profile.enrollments.find(enrollment => enrollment.status === 'active')
    ?? profile.enrollments[0];
  const selectedCourseId = activeEnrollment?.status === 'active' ? activeEnrollment.courseId : null;
  const registryHref = selectedCourseId
    ? `/dashboard/education/enrollments?courseId=${encodeURIComponent(selectedCourseId)}`
    : '/dashboard/education/enrollments';

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href={registryHref} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách trẻ
        </Link>

        <header className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/20">{profile.name.trim().charAt(0).toUpperCase()}</div>
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15"><ShieldCheck className="h-3.5 w-3.5" /> Hồ sơ chỉ đọc</div>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{profile.name}</h1>
                  <p className="mt-1 text-sm text-emerald-50">Mã hồ sơ: {profile.id}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/15">
                <p className="font-semibold text-emerald-100">Lớp hiện tại</p>
                <p className="mt-1 font-bold">{activeEnrollment?.courseTitle ?? 'Chưa có lớp được xác minh'}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><IdCard className="h-4 w-4" /> Ngày sinh</div><p className="mt-2 text-lg font-bold">{formatDate(profile.dob)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><UserRound className="h-4 w-4" /> Giới tính</div><p className="mt-2 text-lg font-bold">{genderLabel(profile.gender)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><GraduationCap className="h-4 w-4" /> Trạng thái</div><p className="mt-2 text-lg font-bold">{activeEnrollment ? enrollmentStatusLabel(activeEnrollment.status) : 'Chưa xác định'}</p></div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tổng hợp sự kiện điểm danh">
          {[
            { label: 'Tổng sự kiện', value: profile.attendance.totalRecords, tone: 'text-slate-900' },
            { label: 'Có mặt', value: profile.attendance.present, tone: 'text-emerald-700' },
            { label: 'Vắng', value: profile.attendance.absent, tone: 'text-rose-600' },
            { label: 'Vắng có phép', value: profile.attendance.excused, tone: 'text-amber-700' },
          ].map(item => <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{item.label}</p><p className={`mt-2 text-3xl font-black dark:text-slate-100 ${item.tone}`}>{item.value}</p></article>)}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Lớp và cơ sở được cấp quyền</h2><p className="text-sm text-slate-500 dark:text-slate-400">Thông tin đang có hiệu lực trong danh sách trường.</p></div></div>
          <div className="mt-5 grid gap-3">
            {profile.enrollments.map(enrollment => (
              <article key={enrollment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-bold text-slate-950 dark:text-white">{enrollment.courseTitle}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{enrollment.courseCode} · {enrollment.branchName}</p></div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${enrollment.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{enrollmentStatusLabel(enrollment.status)}</span>
              </article>
            ))}
          </div>
        </section>

        <StudentGuardians studentId={profile.studentId} />
        {selectedCourseId && user?.tenant_id && product?.productKey === 'bella_preschool' && (
          <PortalAccessLink tenantId={user.tenant_id} courseId={selectedCourseId} studentPartyId={profile.partyId} />
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 p-6 dark:border-slate-800 sm:p-7"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><CalendarCheck className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Lịch sử sự kiện điểm danh</h2><p className="text-sm text-slate-500 dark:text-slate-400">Hiển thị nguyên trạng sự kiện đã ghi nhận; không suy diễn ngày học hoặc tỷ lệ.</p></div></div>
          {profile.attendance.records.length === 0 ? <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Chưa có sự kiện điểm danh được ghi nhận.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-6 py-3">Thời điểm</th><th className="px-6 py-3">Lớp</th><th className="px-6 py-3">Trạng thái</th><th className="px-6 py-3">Mã sự kiện</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {profile.attendance.records.map(record => <tr key={record.id}><td className="px-6 py-4 font-semibold"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{formatDateTime(record.rollCallTime)}</span></td><td className="px-6 py-4 text-slate-600 dark:text-slate-300">{record.courseTitle}</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{attendanceStatusLabel(record.status)}</span></td><td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{record.id}</td></tr>)}
            </tbody></table></div>
          )}
        </section>

        <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Một số nhóm dữ liệu chưa được hiển thị</p><p className="mt-1 leading-6">Y tế, tài chính, đánh giá học tập và trao đổi riêng chỉ xuất hiện khi có nguồn dữ liệu được xác minh và quyền truy cập phù hợp.</p></div></div></aside>
      </div>
    </main>
  );
}

export default function Student360Page(): ReactElement {
  return <Suspense fallback={<ProfileLoading />}><Student360PageContent /></Suspense>;
}
