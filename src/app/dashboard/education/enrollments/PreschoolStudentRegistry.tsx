'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isPreschoolRegistryPage, normalizeRegistryQuery, type PreschoolRegistryPage, type PreschoolRegistryStatus } from '@/platform/education/contracts/preschool-registry.contract';
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** School registry includes pending admission; the daily Attendance roster below remains active-only. */
export function PreschoolStudentRegistry({ refreshKey = 0 }: { refreshKey?: number }) {
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [status, setStatus] = useState<PreschoolRegistryStatus>('all');
  const [offset, setOffset] = useState(0);
  const [inputError, setInputError] = useState(false);
  const request = normalizeRegistryQuery({ query, status, offset, limit: 20 });
  const requestKey = JSON.stringify({ ...request, refreshKey });
  const [load, setLoad] = useState<{ key: string; status: 'loading' | 'error' | 'unsupported' } | { key: string; status: 'ready'; value: PreschoolRegistryPage }>({ key: '', status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad({ key: requestKey, status: 'loading' });
    void (async () => {
      try {
        const input = normalizeRegistryQuery({ query, status, offset, limit: 20 });
        const params = new URLSearchParams({ query: input.query, status: input.status, offset: String(input.offset), limit: String(input.limit) });
        const response = await fetch(`/api/education/student-registry?${params}`, { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (response.status === 404 && isRecord(body) && body.error === 'REGISTRY_UNSUPPORTED_PRODUCT') {
          if (active) setLoad({ key: requestKey, status: 'unsupported' });
          return;
        }
        if (!response.ok || !isRecord(body) || body.success !== true || !isPreschoolRegistryPage(body.registry, input)) throw Error('REGISTRY_UNAVAILABLE');
        if (active) setLoad({ key: requestKey, status: 'ready', value: body.registry });
      } catch { if (active) setLoad({ key: requestKey, status: 'error' }); }
    })();
    return () => { active = false; controller.abort(); };
  }, [query, status, offset, refreshKey, requestKey]);
  const current = load.key === requestKey && load.status === 'ready' ? load.value : null;
  if (load.key === requestKey && load.status === 'unsupported') return null;
  return <section aria-label="Danh sách trẻ toàn trường" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Danh sách trẻ toàn trường</h2>
    <p className="text-sm text-slate-600 dark:text-slate-300">Hồ sơ từ ghi danh đang học và chờ nhập học, trong các cơ sở được cấp quyền.</p>
    <form className="flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault();
      try { const next = normalizeRegistryQuery({ query: draftQuery }); setInputError(false); setOffset(0); setQuery(next.query); }
      catch { setInputError(true); }
    }}>
      <input aria-label="Tìm trẻ theo tên hoặc mã" maxLength={80} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} className="rounded-xl border border-slate-300 bg-transparent p-2 dark:border-slate-600" />
      <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-600">Tìm trẻ</button>
      <button type="button" onClick={() => { setInputError(false); setDraftQuery(''); setQuery(''); setStatus('all'); setOffset(0); }} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-600">Xóa bộ lọc trẻ</button>
    </form>
    <div className="flex flex-wrap gap-2" aria-label="Trạng thái ghi danh">
      {([['all', 'Tất cả trẻ'], ['active', 'Đang học'], ['pending', 'Chờ nhập học']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); }} className="rounded-xl border border-slate-300 px-3 py-2 aria-pressed:font-bold aria-pressed:underline dark:border-slate-600">{label}</button>)}
    </div>
    {inputError ? <p role="alert">Từ khóa có ký tự không hợp lệ. Chưa thực hiện tìm kiếm.</p>
      : load.key === requestKey && load.status === 'error' ? <p role="alert">Không thể tải danh sách trẻ được cấp quyền. Chưa thể xác định tổng hồ sơ; vui lòng thử tải lại.</p>
      : !current ? <p>Đang tải danh sách trẻ…</p> : <>
        <p>Tổng hồ sơ: {current.totals.students} · Đang học: {current.totals.active} · Chờ nhập học: {current.totals.pending}</p>
        <p>Kết quả phù hợp bộ lọc: {current.filteredTotal}</p>
        {current.students.length === 0 ? <p>Không có hồ sơ phù hợp trong phạm vi được cấp quyền.</p>
          : <ul className="divide-y divide-slate-200 dark:divide-slate-700">{current.students.map(student => <li key={student.id} className="space-y-1 py-3">
            <p className="font-semibold text-slate-900 dark:text-white">{student.name} · {student.studentCode}</p>
            {student.enrollments.map(enrollment => <p key={enrollment.id} className="text-sm text-slate-600 dark:text-slate-300">
              {enrollment.status === 'active' ? <Link className="underline" href={`/dashboard/education/enrollments/${encodeURIComponent(student.id)}?courseId=${encodeURIComponent(enrollment.courseId)}`}>{enrollment.courseTitle}</Link> : enrollment.courseTitle}
              {' · '}{enrollment.branchName}{' · '}{enrollment.status === 'active' ? 'Đang học' : 'Chờ nhập học'}
            </p>)}
          </li>)}</ul>}
        <nav aria-label="Phân trang danh sách trẻ" className="flex items-center gap-3">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Trang trẻ trước</button>
          <span>Trang {Math.floor(offset / 20) + 1}</span>
          <button type="button" disabled={current.nextOffset === null} onClick={() => { if (current.nextOffset !== null) setOffset(current.nextOffset); }}>Trang trẻ tiếp</button>
        </nav>
      </>}
  </section>;
}
