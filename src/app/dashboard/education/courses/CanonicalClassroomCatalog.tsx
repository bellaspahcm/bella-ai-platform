'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, BookOpen, Calendar, CalendarCheck, GraduationCap, MapPin, PieChart, Plus, Search, RefreshCw, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import type { CanonicalCourseCatalogItem } from '@/platform/education/contracts/canonical-course-catalog.contract';
import { loadClassroomOverview, type ClassroomLiveOverview } from './classroom-live-data';

type CatalogState =
  | { kind: 'loading' | 'error' | 'unsupported' }
  | { kind: 'ready'; tenantId: string; courses: readonly CanonicalCourseCatalogItem[] };
const statusLabels = { draft: 'Chưa hoạt động', active: 'Đang hoạt động', archived: 'Đã lưu trữ' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parseCatalog(value: unknown): { tenantId: string; courses: readonly CanonicalCourseCatalogItem[] } {
  if (!isRecord(value) || value.success !== true || typeof value.tenantId !== 'string' || !value.tenantId
    || !Array.isArray(value.courses)) throw new Error('INVALID_CATALOG');
  const tenantId = value.tenantId;
  const seen = new Set<string>();
  const courses = value.courses.map((row: unknown) => {
    const courseStatus = isRecord(row) ? row.status : undefined;
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id || seen.has(row.id)
      || row.tenantId !== tenantId || typeof row.courseCode !== 'string'
      || typeof row.title !== 'string'
      || (courseStatus !== 'draft' && courseStatus !== 'active' && courseStatus !== 'archived')) {
      throw new Error('INVALID_CATALOG');
    }
    seen.add(row.id);
    const status = courseStatus as CanonicalCourseCatalogItem['status'];
    return { id: row.id, tenantId, courseCode: row.courseCode, title: row.title, status };
  });
  return { tenantId, courses };
}

export default function CanonicalClassroomCatalog({ legacy }: { legacy: ReactNode }) {
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [operationKey, setOperationKey] = useState<string | null>(null);
  const [branchId, setBranchId] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [submittedPayload, setSubmittedPayload] = useState<{
    operationKey: string; branchId: string; code: string; title: string; tenantId: string;
  } | null>(null);
  const [branches, setBranches] = useState<readonly { id: string; name: string }[] | null>(null);
  const [branchError, setBranchError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [createError, setCreateError] = useState('');
  const [created, setCreated] = useState<CanonicalCourseCatalogItem | null>(null);
  const [liveData, setLiveData] = useState<ReadonlyMap<string, ClassroomLiveOverview> | null>(null);
  const currentTenantId = state.kind === 'ready' ? state.tenantId : null;

  useEffect(() => {
    const controller = new AbortController();
    setLiveData(null);
    if (currentTenantId) void loadClassroomOverview(currentTenantId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setLiveData(data); })
      .catch(() => { if (!controller.signal.aborted) setLiveData(null); });
    return () => controller.abort();
  }, [currentTenantId, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ kind: 'loading' });
    const timeout = setTimeout(() => {
      if (!current) return;
      current = false;
      controller.abort();
      setState({ kind: 'error' });
    }, 15_000);
    void (async () => {
      try {
        const response = await fetch('/api/education/courses/catalog', { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!current) return;
        if (response.status === 403 && isRecord(body) && body.success === false
          && body.error === 'COURSE_CATALOG_UNSUPPORTED_PRODUCT') {
          setState({ kind: 'unsupported' });
        } else {
          if (!response.ok) throw new Error('CATALOG_READ_FAILED');
          setState({ kind: 'ready', ...parseCatalog(body) });
        }
      } catch {
        if (current) setState({ kind: 'error' });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    let current = true;
    setBranches(null);
    setBranchError(false);
    const timeout = setTimeout(() => {
      controller.abort();
      if (current) { current = false; setBranchError(true); }
    }, 15_000);
    void (async () => {
      try {
        const response = await fetch('/api/education/branches', { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || body.success !== true || !Array.isArray(body.branches)) {
          throw new Error('BRANCHES_UNAVAILABLE');
        }
        const seen = new Set<string>();
        const options = body.branches.map((row: unknown) => {
          if (!isRecord(row) || typeof row.id !== 'string' || !row.id || seen.has(row.id)
            || typeof row.name !== 'string' || !row.name.trim()) throw new Error('INVALID_BRANCHES');
          seen.add(row.id);
          return { id: row.id, name: row.name };
        });
        if (current) setBranches(options);
      } catch {
        if (current) setBranchError(true);
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [createOpen]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || state.kind !== 'ready' || !operationKey
      || !branches?.some(branch => branch.id === branchId)) return;
    const payload = submittedPayload ?? { operationKey, branchId, code, title, tenantId: state.tenantId };
    if (payload.tenantId !== state.tenantId) {
      setCreateError('Phạm vi truy cập đã thay đổi. Tải lại danh sách lớp trước khi thử lại.');
      return;
    }

    setSubmittedPayload(payload);
    submitLock.current = true;
    setSubmitting(true);
    setCreateError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let failureMessage = 'Chưa thể xác nhận tạo lớp. Thông tin được giữ lại để bạn thử lại an toàn.';
    try {
      const response = await fetch('/api/education/courses', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationKey: payload.operationKey, branchId: payload.branchId, code: payload.code, title: payload.title }),
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 409) failureMessage = 'Mã lớp hoặc yêu cầu tạo lớp bị trùng. Kiểm tra danh sách trước khi bắt đầu yêu cầu mới.';
        if (response.status === 401 || response.status === 403) failureMessage = 'Bạn chưa được cấp quyền tạo lớp tại chi nhánh này.';
        throw new Error('CREATE_FAILED');
      }
      const row = isRecord(body) && body.success === true && isRecord(body.course) ? body.course : null;
      if (!row || typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)
        || row.tenantId !== payload.tenantId || row.branchId !== payload.branchId || row.operationKey !== payload.operationKey
        || row.courseCode !== payload.code.trim().toUpperCase() || row.title !== payload.title.trim() || row.status !== 'active') {
        failureMessage = 'Phản hồi tạo lớp chưa được xác minh. Thông tin được giữ lại để bạn thử lại an toàn.';
        throw new Error('IDENTITY_UNCONFIRMED');
      }
      setCreated({ id: row.id, tenantId: payload.tenantId, courseCode: row.courseCode, title: row.title, status: 'active' });
      setCreateOpen(false);
      setOperationKey(null);
      setBranchId('');
      setCode('');
      setTitle('');
      setSubmittedPayload(null);
      setState({ kind: 'loading' });
      setAttempt(value => value + 1);
    } catch {
      setCreateError(failureMessage);
    } finally {
      clearTimeout(timeout);
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (state.kind === 'unsupported') return legacy;
  const ready = state.kind === 'ready';
  const courses = ready ? state.courses : [];
  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = courses.filter(course => (status === 'all' || course.status === status)
    && `${course.title} ${course.courseCode}`.toLocaleLowerCase('vi').includes(term));
  const activeCourses = courses.filter(course => course.status === 'active');
  const activeLiveCourses = liveData && activeCourses.length > 0
    ? activeCourses.map(course => {
      const candidate = liveData.get(course.id);
      return candidate?.tenantId === course.tenantId && candidate.code === course.courseCode
        && candidate.name === course.title ? candidate : null;
    })
    : liveData && activeCourses.length === 0 ? [] : null;
  const rosterVerified = activeLiveCourses !== null && activeLiveCourses.every(Boolean);
  const totalStudents = rosterVerified
    ? (activeLiveCourses ?? []).reduce((total, course) => total + (course?.students ?? 0), 0)
    : null;
  const capacityVerified = rosterVerified && (activeLiveCourses ?? []).every(course => course?.maxStudents !== null);
  const totalCapacity = capacityVerified
    ? (activeLiveCourses ?? []).reduce((total, course) => total + (course?.maxStudents ?? 0), 0)
    : null;
  const remainingCapacity = totalStudents !== null && totalCapacity !== null
    ? Math.max(0, totalCapacity - totalStudents) : null;
  const fillRate = totalStudents !== null && totalCapacity !== null && totalCapacity > 0
    ? Math.min(100, Math.round((totalStudents / totalCapacity) * 100)) : null;

  return <main className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-16 bg-[#F3F6F8]/60 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-xs space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <Link href="/dashboard/education" title="Quay lại Dashboard"
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0"><BookOpen className="w-6 h-6" /></div>
          <div>
            <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60">Preschool ERP Operations</span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">Quản lý lớp học</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Theo dõi sĩ số, sức chứa và tình trạng điểm danh theo lớp</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-500">
            <Calendar className="w-4 h-4" />Năm học: chưa được cung cấp
          </span>
          <button type="button" disabled={!ready || submitting} onClick={() => {
            if (!operationKey) setOperationKey(crypto.randomUUID());
            setCreateError('');
            setCreateOpen(true);
          }} className="px-4 py-2.5 rounded-2xl bg-[#075548] text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" />Mở Lớp Học Mới
          </button>
          <button type="button" onClick={() => { setState({ kind: 'loading' }); setAttempt(value => value + 1); }}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 text-xs font-semibold">
            <RefreshCw className={`w-4 h-4 ${state.kind === 'loading' ? 'animate-spin' : ''}`} />Tải lại
          </button>
        </div>
      </header>
      <section aria-label="Thống kê lớp học" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng số lớp', value: ready ? String(courses.length) : '—', icon: GraduationCap, color: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
          { label: 'Tổng học sinh', value: totalStudents === null ? 'Chưa được cung cấp' : String(totalStudents), icon: Users, color: 'bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
          { label: 'Chỗ trống còn lại', value: remainingCapacity === null ? 'Chưa được cung cấp' : String(remainingCapacity), icon: UserPlus, color: 'bg-amber-100/70 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
          { label: 'Tỷ lệ lấp đầy', value: fillRate === null ? 'Chưa được cung cấp' : `${fillRate}%`, icon: PieChart, color: 'bg-purple-100/70 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
        ].map(({ label, value, icon: Icon, color }, index) => <div key={label} className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">{label}</p>
          <p className={`${index === 0 ? 'text-2xl' : 'text-sm pt-1'} font-extrabold`}>{value}</p>
        </div>)}
      </section>
      <section aria-label="Bộ lọc lớp học" className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <label className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input aria-label="Tìm tên hoặc mã lớp" value={query} onChange={event => setQuery(event.target.value)} disabled={!ready}
              placeholder="Tìm tên hoặc mã lớp…" className="w-full pl-9 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-[#075548]" />
          </label>
          <select aria-label="Khối lớp" disabled className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 px-3 py-2.5 text-xs text-slate-500 cursor-not-allowed">
            <option>Khối lớp chưa được cung cấp</option>
          </select>
          <select aria-label="Trạng thái lớp" value={status} onChange={event => setStatus(event.target.value)} disabled={!ready}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold">
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" title="Đặt lại bộ lọc" onClick={() => { setQuery(''); setStatus('all'); }}
            className="p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-slate-500">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          <button type="button" onClick={() => { setQuery(''); setStatus('all'); }} className="px-4 py-2 rounded-xl bg-[#075548] text-white whitespace-nowrap">Tất cả lớp ({ready ? courses.length : '—'})</button>
          {['Nhà Trẻ', 'Khối Mầm', 'Khối Chồi', 'Khối Lá'].map(label => <button key={label} type="button" disabled
            title="Chưa có phân loại khối từ nguồn dữ liệu chuẩn" className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 whitespace-nowrap cursor-not-allowed">{label} (—)</button>)}
        </div>
      </section>
    </div>
    <Dialog open={createOpen} onOpenChange={open => { if (!submitting) setCreateOpen(open); }}>
      <DialogContent showCloseButton={!submitting}>
        <DialogTitle>Mở lớp học mới</DialogTitle>
        <DialogDescription>Nhập mã, tên lớp và chọn chi nhánh. Quyền tạo lớp được xác minh khi lưu.</DialogDescription>
        <form onSubmit={submitCreate} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">Chi nhánh
            <select aria-label="Chi nhánh" value={branchId} disabled={!branches || submitting || !!submittedPayload}
              onChange={event => { if (!submittedPayload) setBranchId(event.target.value); }} required
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Chọn chi nhánh</option>
              {branches?.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          {!branches && !branchError && <p role="status">Đang tải chi nhánh…</p>}
          {branchError && <p role="alert">Không thể tải chi nhánh. Đóng rồi mở lại biểu mẫu để thử lại.</p>}
          {branches?.length === 0 && <p role="alert">Chưa có chi nhánh trong phạm vi truy cập.</p>}
          <label className="block text-sm font-semibold">Mã lớp
            <input aria-label="Mã lớp" value={code} onChange={event => { if (!submittedPayload) setCode(event.target.value); }}
              required maxLength={80} disabled={submitting || !!submittedPayload}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm font-semibold">Tên lớp
            <input aria-label="Tên lớp" value={title} onChange={event => { if (!submittedPayload) setTitle(event.target.value); }}
              required maxLength={200} disabled={submitting || !!submittedPayload}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          {createError && <p role="alert" className="text-sm text-red-700">{createError} Thông tin được giữ lại.</p>}
          {submittedPayload && !submitting && <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>Yêu cầu trước có thể đã tạo lớp. Giữ nguyên thông tin để thử lại cùng mã yêu cầu hoặc kiểm tra danh sách trước.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setCreateOpen(false); setState({ kind: 'loading' }); setAttempt(value => value + 1); }} className="rounded-xl border px-3 py-2">Kiểm tra danh sách lớp</button>
              <button type="button" onClick={() => {
                setOperationKey(crypto.randomUUID()); setSubmittedPayload(null); setBranchId(''); setCode(''); setTitle(''); setCreateError('');
              }} className="rounded-xl border px-3 py-2">Bắt đầu yêu cầu mới</button>
            </div>
          </div>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={submitting} onClick={() => setCreateOpen(false)} className="rounded-xl border px-4 py-2">Đóng</button>
            <button type="submit" disabled={submitting || !branchId || !branches?.some(branch => branch.id === branchId) || !code.trim() || !title.trim()}
              className="rounded-xl bg-[#075548] px-4 py-2 font-bold text-white disabled:opacity-60">
              {submitting ? 'Đang tạo lớp…' : 'Tạo lớp'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    {created && state.kind === 'ready' && created.tenantId === state.tenantId && <p role="status">Đã tạo lớp {created.title}. <Link href={`/dashboard/education/courses/${encodeURIComponent(created.id)}`} className="underline">Mở lớp vừa tạo</Link></p>}
    {state.kind === 'loading' && <p role="status">Đang tải danh sách lớp…</p>}
    {state.kind === 'error' && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
      Không thể tải danh sách lớp. Chưa thể xác định tổng số lớp; vui lòng tải lại.
    </p>}
    {ready && <>
      <p className="text-sm text-slate-500 dark:text-slate-400">Hiển thị {filtered.length} / {courses.length} lớp</p>
      {!courses.length ? <p>Chưa có lớp học trong phạm vi được cấp quyền.</p>
        : !filtered.length ? <p>Không có lớp phù hợp bộ lọc.</p>
          : <section aria-label="Danh sách lớp" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(course => {
              const candidate = liveData?.get(course.id);
              const live = candidate?.tenantId === course.tenantId && candidate.code === course.courseCode
                && candidate.name === course.title ? candidate : null;
              const remainingSeats = live?.maxStudents === null || live?.maxStudents === undefined
                ? null : Math.max(0, live.maxStudents - live.students);
              const fillPercent = live && live.maxStudents !== null && live.maxStudents > 0
                ? Math.min(100, Math.round((live.students / live.maxStudents) * 100)) : null;
              return <article key={course.id} className="group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60">{statusLabels[course.status]}</span>
                <span className="px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">{remainingSeats === null ? 'Sức chứa chưa xác minh' : `Còn ${remainingSeats} chỗ`}</span>
              </div>
              <div className="flex items-center gap-3.5 pt-1">
                <div className="w-16 h-16 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#075548] dark:text-emerald-300 flex items-center justify-center"><BookOpen className="w-8 h-8" /></div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight group-hover:text-[#075548] dark:group-hover:text-emerald-300">{course.title || 'Chưa có tên lớp'}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Mã lớp: {course.courseCode || 'Chưa có mã lớp'}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Users className="w-3.5 h-3.5 shrink-0" />Giáo viên: {live?.teacher ?? 'chưa được cung cấp'}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3.5 h-3.5 shrink-0" />Phòng học: {live?.room ?? 'chưa được cung cấp'}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600 dark:text-slate-400">Sức chứa hiện tại</span><span>{live ? `${live.students} / ${live.maxStudents ?? '—'}` : 'Chưa được cung cấp'}</span></div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  {fillPercent !== null && <div className="h-full rounded-full bg-emerald-500" style={{ width: `${fillPercent}%` }} />}
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Điểm danh hôm nay</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs py-1">
                  {([['Có mặt', live?.todayStatus.present], ['Có phép', live?.todayStatus.excused], ['Chưa báo', live?.todayStatus.unmarked], ['Cảnh báo SK', null]] as const).map(([label, value]) => <div key={label}><span className="text-[10px] text-slate-400 block font-medium">{label}</span><span className="text-base font-extrabold text-slate-400">{value ?? '—'}</span></div>)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{live ? 'Dữ liệu điểm danh hôm nay; sức khỏe chưa được cung cấp.' : 'Chưa có số liệu điểm danh hoặc sức khỏe trong danh sách lớp.'}</p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Link href={`/dashboard/education/courses/${encodeURIComponent(course.id)}`}
                  className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs text-center">Vào lớp học</Link>
                <Link href={`/dashboard/education/attendance?courseId=${encodeURIComponent(course.id)}`} className="flex-1 py-2 px-3 rounded-xl bg-[#075548] hover:bg-[#05443a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs">
                  <CalendarCheck className="w-3.5 h-3.5" />Điểm danh
                </Link>
              </div>
            </article>; })}
          </section>}
    </>}
  </main>;
}
