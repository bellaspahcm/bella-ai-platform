'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { CircleAlert, Phone, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import {
  isPreschoolStudentGuardianReadPage,
  type PreschoolStudentGuardianReadPage,
  type PreschoolGuardianPickupStatus,
  type PreschoolGuardianRelationshipType,
} from '@/products/bella-education/services/preschool-student-guardian-read.service';

type GuardianState =
  | { status: 'loading' }
  | { status: 'ready'; data: PreschoolStudentGuardianReadPage }
  | { status: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function relationLabel(type: PreschoolGuardianRelationshipType): string {
  return type === 'parent_of' ? 'Cha/mẹ' : 'Người giám hộ';
}

function pickupLabel(status: PreschoolGuardianPickupStatus): string {
  if (status === 'authorized') return 'Được phép đón trẻ';
  if (status === 'revoked') return 'Quyền đón đã thu hồi';
  return 'Chưa ghi nhận quyền đón';
}

function pickupTone(status: PreschoolGuardianPickupStatus): string {
  if (status === 'authorized') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'revoked') return 'text-rose-700 dark:text-rose-300';
  return 'text-amber-700 dark:text-amber-300';
}

function errorMessage(status: number): string {
  if (status === 401) return 'Phiên đăng nhập không còn hợp lệ.';
  if (status === 403) return 'Tài khoản hiện tại không có quyền xem người giám hộ của trẻ này.';
  if (status === 404) return 'Không tìm thấy trẻ trong phạm vi lớp được cấp quyền.';
  if (status === 400) return 'Mã hồ sơ trẻ không hợp lệ.';
  return 'Chưa thể tải danh sách người giám hộ đã xác minh.';
}

export default function StudentGuardians({ studentId }: {
  readonly studentId: string;
}): ReactElement {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<GuardianState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      setState({ status: 'error', message: errorMessage(503) });
    }, 15_000);
    setState({ status: 'loading' });
    void fetch(
      `/api/education/enrollments/${encodeURIComponent(studentId)}/guardians`,
      { cache: 'no-store', signal: controller.signal },
    ).then(async response => {
      const body: unknown = await response.json().catch(() => null);
      if (!active || timedOut) return;
      clearTimeout(timeout);
      if (!response.ok) {
        setState({ status: 'error', message: errorMessage(response.status) });
        return;
      }
      if (!isRecord(body) || Object.keys(body).some(key => !['success', 'guardians'].includes(key))
        || body.success !== true || !isPreschoolStudentGuardianReadPage(body.guardians, studentId)) {
        setState({ status: 'error', message: errorMessage(503) });
        return;
      }
      setState({ status: 'ready', data: body.guardians });
    }).catch(error => {
      if (!active || timedOut || (error instanceof DOMException && error.name === 'AbortError')) return;
      clearTimeout(timeout);
      setState({ status: 'error', message: errorMessage(503) });
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [studentId, reloadToken]);

  const visibleState: GuardianState = state.status === 'ready' && state.data.studentId.toLowerCase() !== studentId.toLowerCase()
    ? { status: 'loading' }
    : state;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7" aria-labelledby="student-guardians-heading">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          <UsersRound className="h-5 w-5" />
        </div>
        <div>
          <h2 id="student-guardians-heading" className="text-lg font-black">Người giám hộ</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quan hệ và quyền đón trẻ được hiển thị riêng theo nguồn chuẩn.
          </p>
        </div>
      </div>

      {visibleState.status === 'loading' && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-busy="true">
          Đang tải người giám hộ…
        </div>
      )}

      {visibleState.status === 'error' && (
        <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Không thể tải người giám hộ</p>
              <p className="mt-1">{visibleState.message}</p>
              <button type="button" onClick={() => setReloadToken(value => value + 1)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 font-bold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950">
                <RefreshCw className="h-4 w-4" /> Thử lại
              </button>
            </div>
          </div>
        </div>
      )}

      {visibleState.status === 'ready' && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Dữ liệu quan hệ tại ngày {visibleState.data.asOfDate.split('-').reverse().join('/')}.
        </p>
      )}

      {visibleState.status === 'ready' && visibleState.data.guardians.length === 0 && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Chưa có quan hệ người giám hộ được ghi nhận tại ngày dữ liệu.
        </div>
      )}

      {visibleState.status === 'ready' && visibleState.data.guardians.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {visibleState.data.guardians.map(guardian => (
            <article key={guardian.guardianPartyId} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
              <h3 className="font-black text-slate-950 dark:text-white">{guardian.displayName}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {guardian.relationships.map(relationship => (
                  <span key={relationship.id} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                    {relationLabel(relationship.type)}
                  </span>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Phone className="h-4 w-4 text-slate-400" />
                {guardian.phoneState === 'recorded' ? guardian.phone : 'Chưa ghi nhận số điện thoại'}
              </p>
              <p
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${pickupTone(guardian.pickupStatus)}`}
                data-pickup-status={guardian.pickupStatus}
                aria-label={`Trạng thái đón trẻ: ${pickupLabel(guardian.pickupStatus)}`}
              >
                {guardian.pickupStatus === 'authorized'
                  ? <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  : <CircleAlert className="h-4 w-4" aria-hidden="true" />}
                {pickupLabel(guardian.pickupStatus)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
