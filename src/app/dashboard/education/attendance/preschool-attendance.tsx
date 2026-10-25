'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { CourseDailyAttendanceRosterItem, EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';

type Course = { id: string; tenantId: string; courseCode: string; title: string; status: string };
type Catalog = { status: 'loading' | 'error' | 'legacy' } | { status: 'ready'; courses: Course[] };
type Roster = { status: 'loading' | 'error'; key: string } | { status: 'ready'; key: string; rows: CourseDailyAttendanceRosterItem[] };
const labels: Record<EducationAttendanceStatus, string> = { present: 'Có mặt', absent: 'Vắng', excused: 'Có phép' };
const statuses = Object.keys(labels) as EducationAttendanceStatus[];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const isStatus = (v: unknown): v is EducationAttendanceStatus => statuses.includes(v as EducationAttendanceStatus);
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function isCourse(v: unknown): v is Course {
  return record(v) && [v.id, v.tenantId, v.courseCode, v.title].every(text)
    && typeof v.status === 'string' && ['draft', 'active', 'archived'].includes(v.status);
}
function isRow(v: unknown, courseTenant: string, day: string): v is CourseDailyAttendanceRosterItem {
  if (!record(v) || ![v.enrollmentId, v.studentId, v.studentPartyId, v.name].every(text)
    || ![v.studentCode, v.gender, v.dob].every(nullableText) || v.enrollmentStatus !== 'active') return false;
  const a = v.attendance;
  return a === null || (record(a) && text(a.id) && a.enrollmentId === v.enrollmentId
    && a.tenantId === courseTenant && a.schoolDay === day && isStatus(a.status)
    && text(a.createdAt) && text(a.updatedAt));
}

/** Real roll-call only. The backend owns eligibility, scope and persistence. */
export default function PreschoolAttendance({ legacy }: { legacy: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });
  const [courseId, setCourseId] = useState('');
  const [day, setDay] = useState(today);
  const [roster, setRoster] = useState<Roster>({ status: 'loading', key: '' });
  const [reload, setReload] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const generation = useRef(0);
  const command = useRef(false);
  const mounted = useRef(false);
  const selected = catalog.status === 'ready' ? catalog.courses.find(c => c.id === courseId) : undefined;
  const key = `${courseId}:${day}`;
  const ready = roster.status === 'ready' && roster.key === key && !!selected && day === today();
  const rows = ready && roster.status === 'ready' ? roster.rows : [];

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCatalog({ status: 'loading' });
    setCourseId('');
    void (async () => {
      try {
        const response = await fetch('/api/education/courses?view=catalog', { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!active) return;
        if (response.status === 403 && record(body) && body.success === false && body.error === 'COURSE_CATALOG_UNSUPPORTED_PRODUCT') {
          setCatalog({ status: 'legacy' }); return;
        }
        if (!response.ok || !record(body) || body.success !== true || !Array.isArray(body.courses)
          || !body.courses.every(isCourse)) throw new Error('INVALID_CATALOG');
        const loadedCourses = body.courses;
        if (new Set(loadedCourses.map(c => c.id)).size !== loadedCourses.length
          || loadedCourses.some(c => c.tenantId !== loadedCourses[0]?.tenantId)) throw new Error('INVALID_CATALOG');
        const courses = loadedCourses.filter(c => c.status === 'active');
        setCatalog({ status: 'ready', courses });
        setCourseId(courses[0]?.id ?? '');
      } catch { if (active) setCatalog({ status: 'error' }); }
    })();
    return () => { active = false; controller.abort(); };
  }, [catalogReload]);

  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    const current = () => mounted.current && generation.current === version;
    setRoster({ status: 'loading', key });
    setMessage(null);
    if (!selected || day !== today()) {
      if (selected) { setRoster({ status: 'error', key }); setMessage({ kind: 'error', text: 'Hiện chỉ hỗ trợ điểm danh ngày hôm nay tại Việt Nam.' }); }
      return () => { generation.current += 1; controller.abort(); };
    }
    void (async () => {
      try {
        const query = new URLSearchParams({ view: 'roster', courseId: selected.id, date: day });
        const response = await fetch(`/api/education/attendance?${query}`, { cache: 'no-store', signal: controller.signal });
        const body: unknown = await response.json();
        if (!current()) return;
        if (!response.ok || !record(body) || body.success !== true || body.courseId !== selected.id || body.schoolDay !== day
          || !Array.isArray(body.roster) || !body.roster.every(row => isRow(row, selected.tenantId, day))
          || new Set(body.roster.map(row => row.enrollmentId)).size !== body.roster.length) throw new Error('INVALID_ROSTER');
        setRoster({ status: 'ready', key, rows: body.roster });
      } catch {
        if (current()) { setRoster({ status: 'error', key }); setMessage({ kind: 'error', text: 'Không thể tải danh sách điểm danh. Vui lòng tải lại.' }); }
      }
    })();
    return () => { generation.current += 1; controller.abort(); };
  }, [selected, day, key, reload]);

  async function mark(enrollmentId: string, status: EducationAttendanceStatus) {
    if (command.current || !ready || !rows.some(row => row.enrollmentId === enrollmentId)) return;
    const version = generation.current;
    const current = () => mounted.current && generation.current === version;
    command.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/education/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, status, date: day }) });
      const body: unknown = await response.json();
      if (!current()) return;
      const a = record(body) ? body.attendance : null;
      if (!response.ok || !record(body) || body.success !== true || !record(a) || !text(a.id)
        || a.tenantId !== selected?.tenantId || a.enrollmentId !== enrollmentId || a.schoolDay !== day || a.status !== status
        || !text(a.createdAt) || !text(a.updatedAt)) throw new Error('UNCONFIRMED_WRITE');
      setRoster(previous => previous.status === 'ready' && previous.key === key
        ? { ...previous, rows: previous.rows.map(row => row.enrollmentId === enrollmentId
          ? { ...row, attendance: a as unknown as NonNullable<CourseDailyAttendanceRosterItem['attendance']> } : row) } : previous);
      setMessage({ kind: 'success', text: 'Đã ghi nhận điểm danh.' });
    } catch {
      if (current()) {
        setRoster({ status: 'error', key });
        setMessage({ kind: 'error', text: 'Chưa xác nhận được kết quả ghi. Hãy tải lại danh sách trước khi tiếp tục.' });
      }
    } finally { command.current = false; if (mounted.current) setSaving(false); }
  }

  if (catalog.status === 'legacy') return <>{legacy}</>;
  const filtered = rows.filter(row => [row.name, row.studentCode, row.studentPartyId].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  return <div className="preschool-ui p-4 sm:p-6 lg:p-8 space-y-5">
    <div><Link href="/dashboard/education/courses" className="text-sm underline">Danh mục khóa học</Link>
      <h1 className="text-2xl font-bold mt-3">Điểm danh</h1>
      <p className="text-sm text-muted-foreground mt-1">Ngày học tại Việt Nam. Chỉ học sinh có ghi danh đang hoạt động.</p></div>
    {catalog.status === 'loading' ? <p role="status">Đang tải khóa học…</p> : catalog.status === 'error' ? <div role="alert">
      Không thể tải khóa học. <button type="button" className="underline" onClick={() => setCatalogReload(n => n + 1)}>Thử lại</button></div>
      : catalog.status === 'ready' && catalog.courses.length === 0 ? <p role="status">Chưa có khóa học đang hoạt động.</p> : null}
    {catalog.status === 'ready' && catalog.courses.length > 0 && <>
      <div className="flex flex-wrap gap-3 items-end">
        <fieldset disabled={saving} className="flex flex-wrap gap-2" aria-label="Chọn khóa học">
          {catalog.courses.map(course => <button type="button" key={course.id} aria-pressed={course.id === courseId}
            className="px-4 py-2 rounded-xl border border-border bg-card aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:opacity-50"
            onClick={() => { if (!command.current) setCourseId(course.id); }}>{course.title} · {course.courseCode}</button>)}
        </fieldset>
        <label className="text-sm">Ngày điểm danh<input type="date" value={day} min={today()} max={today()} disabled={saving}
          className="block rounded-lg border border-border bg-card p-2" onChange={event => { if (!command.current) setDay(event.target.value); }} /></label>
        <button type="button" disabled={saving} className="px-4 py-2 border border-border rounded-xl disabled:opacity-50"
          onClick={() => { if (!command.current) { generation.current += 1; setRoster({ status: 'loading', key }); setReload(n => n + 1); } }}>Tải lại danh sách</button>
      </div>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {!ready && roster.status === 'loading' && <p role="status">Đang tải danh sách điểm danh…</p>}
      {ready && <>
        <p aria-label="Tổng hợp điểm danh">{rows.length} học sinh · {statuses.map(status => `${labels[status]}: ${rows.filter(row => row.attendance?.status === status).length}`).join(' · ')} · Chưa điểm danh: {rows.filter(row => !row.attendance).length}</p>
        <label className="block text-sm">Tìm học sinh<input value={search} onChange={event => setSearch(event.target.value)}
          className="block rounded-lg border border-border bg-card p-2 mt-1" /></label>
        <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm text-left">
          <thead><tr><th className="p-3">Học sinh</th><th className="p-3">Trạng thái</th><th className="p-3">Ghi nhận</th></tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={3} className="p-4">Không có học sinh phù hợp.</td></tr> : filtered.map(row => <tr key={row.enrollmentId} className="border-t border-border">
            <td className="p-3">{row.name}<span className="block text-muted-foreground">{row.studentCode ?? row.studentPartyId}</span></td>
            <td className="p-3">{row.attendance ? labels[row.attendance.status] : 'Chưa điểm danh'}</td>
            <td className="p-3"><div className="flex gap-2">{statuses.map(status => <button type="button" key={status} disabled={saving} aria-label={`${labels[status]} — ${row.name}`}
              className="px-3 py-2 rounded-lg border border-border bg-card disabled:opacity-50" onClick={() => void mark(row.enrollmentId, status)}>{labels[status]}</button>)}</div></td>
          </tr>)}</tbody></table></div>
      </>}
    </>}
  </div>;
}
