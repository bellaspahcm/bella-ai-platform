'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Calendar, CalendarCheck, GraduationCap, MapPin, PieChart, Plus, Search, RefreshCw, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import type { CanonicalCourseCatalogItem } from '@/platform/education/contracts/canonical-course-catalog.contract';

type CatalogState =
  | { kind: 'loading' | 'error' | 'unsupported' }
  | { kind: 'ready'; courses: readonly CanonicalCourseCatalogItem[] };
const statusLabels = { draft: 'Chưa hoạt động', active: 'Đang hoạt động', archived: 'Đã lưu trữ' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parseCatalog(value: unknown): readonly CanonicalCourseCatalogItem[] {
  if (!isRecord(value) || value.success !== true || typeof value.tenantId !== 'string' || !value.tenantId
    || !Array.isArray(value.courses)) throw new Error('INVALID_CATALOG');
  const tenantId = value.tenantId;
  const seen = new Set<string>();
  return value.courses.map((row: unknown) => {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id || seen.has(row.id)
      || row.tenantId !== tenantId || typeof row.courseCode !== 'string'
      || typeof row.title !== 'string'
      || (row.status !== 'draft' && row.status !== 'active' && row.status !== 'archived')) {
      throw new Error('INVALID_CATALOG');
    }
    seen.add(row.id);
    return { id: row.id, tenantId, courseCode: row.courseCode, title: row.title, status: row.status };
  });
}

export default function CanonicalClassroomCatalog({ legacy }: { legacy: ReactNode }) {
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

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
          setState({ kind: 'ready', courses: parseCatalog(body) });
        }
      } catch {
        if (current) setState({ kind: 'error' });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  if (state.kind === 'unsupported') return legacy;
  const ready = state.kind === 'ready';
  const courses = ready ? state.courses : [];
  const term = query.trim().toLocaleLowerCase('vi');
  const filtered = courses.filter(course => (status === 'all' || course.status === status)
    && `${course.title} ${course.courseCode}`.toLocaleLowerCase('vi').includes(term));

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
          <button type="button" disabled title="Chưa mở chức năng tạo lớp trong phạm vi chỉ đọc"
            className="px-4 py-2.5 rounded-2xl bg-[#075548] text-white font-bold text-xs flex items-center gap-1.5 opacity-60 cursor-not-allowed">
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
          { label: 'Tổng học sinh', value: 'Chưa được cung cấp', icon: Users, color: 'bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
          { label: 'Chỗ trống còn lại', value: 'Chưa được cung cấp', icon: UserPlus, color: 'bg-amber-100/70 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
          { label: 'Tỷ lệ lấp đầy', value: 'Chưa được cung cấp', icon: PieChart, color: 'bg-purple-100/70 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
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
    {state.kind === 'loading' && <p role="status">Đang tải danh sách lớp…</p>}
    {state.kind === 'error' && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
      Không thể tải danh sách lớp. Chưa thể xác định tổng số lớp; vui lòng tải lại.
    </p>}
    {ready && <>
      <p className="text-sm text-slate-500 dark:text-slate-400">Hiển thị {filtered.length} / {courses.length} lớp</p>
      {!courses.length ? <p>Chưa có lớp học trong phạm vi được cấp quyền.</p>
        : !filtered.length ? <p>Không có lớp phù hợp bộ lọc.</p>
          : <section aria-label="Danh sách lớp" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(course => <article key={course.id} className="group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60">{statusLabels[course.status]}</span>
                <span className="px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">Sức chứa chưa xác minh</span>
              </div>
              <div className="flex items-center gap-3.5 pt-1">
                <div className="w-16 h-16 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#075548] dark:text-emerald-300 flex items-center justify-center"><BookOpen className="w-8 h-8" /></div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight group-hover:text-[#075548] dark:group-hover:text-emerald-300">{course.title || 'Chưa có tên lớp'}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Mã lớp: {course.courseCode || 'Chưa có mã lớp'}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Users className="w-3.5 h-3.5 shrink-0" />Giáo viên: chưa được cung cấp</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><MapPin className="w-3.5 h-3.5 shrink-0" />Phòng học: chưa được cung cấp</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600 dark:text-slate-400">Sức chứa hiện tại</span><span>Chưa được cung cấp</span></div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Điểm danh hôm nay</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs py-1">
                  {['Có mặt', 'Có phép', 'Chưa báo', 'Cảnh báo SK'].map(label => <div key={label}><span className="text-[10px] text-slate-400 block font-medium">{label}</span><span className="text-base font-extrabold text-slate-400">—</span></div>)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Chưa có số liệu điểm danh hoặc sức khỏe trong danh sách lớp.</p>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <button type="button" disabled title="Chi tiết vận hành lớp chưa khả dụng."
                  className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-400 font-bold text-xs cursor-not-allowed">Vào lớp học</button>
                <Link href="/dashboard/education/attendance" className="flex-1 py-2 px-3 rounded-xl bg-[#075548] hover:bg-[#05443a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs">
                  <CalendarCheck className="w-3.5 h-3.5" />Điểm danh
                </Link>
              </div>
            </article>)}
          </section>}
    </>}
  </main>;
}
