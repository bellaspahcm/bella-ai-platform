'use client';

import { Suspense, useEffect, useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CircleAlert,
  RefreshCw,
} from 'lucide-react';
import type { Student360ProfileData } from '@/app/api/education/enrollments/student-360.service';
import { useUser } from '@/lib/user-context';
import Student360LegacyLayout from './Student360LegacyLayout';

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

  const userRole = (user?.role ?? '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const canViewFinance = userRole !== 'teacher' && (userRole === 'admin' || userRole === 'accountant' || !userRole);

  return <Student360LegacyLayout
    profile={profile}
    registryHref={registryHref}
    selectedCourseId={selectedCourseId}
    tenantId={product?.productKey === 'bella_preschool' ? user?.tenant_id ?? null : null}
    isAdmin={isAdmin}
    canViewFinance={canViewFinance}
    onProfileUpdated={(updated) => setState({ status: 'ready', selector: studentCode, profile: updated })}
  />;
}

export default function Student360Page(): ReactElement {
  return <Suspense fallback={<ProfileLoading />}><Student360PageContent /></Suspense>;
}
