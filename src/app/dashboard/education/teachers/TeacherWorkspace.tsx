'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { PreschoolTeacherCandidatePage, PreschoolCourseTeacherPage } from '@/platform/education/contracts/teacher-assignment.contract';

type Branch = { id: string; name: string };
type Course = { id: string; code: string; title: string };
type View<T> = { status: 'loading' | 'error' } | { status: 'ready'; data: T };
type Action = { kind: 'confirm' | 'revoke' | 'assign' | 'terminate'; partyId?: string; partyName?: string;
  confirmationId?: string; courseId?: string; assignmentId?: string };
const pageSize = 20;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
async function read(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const body: unknown = await response.json();
  if (!response.ok || !record(body) || body.success !== true) throw new Error('READ_FAILED');
  return body;
}
function failure(code: string): string {
  if (code === 'PRESCHOOL_TEACHER_ACCESS_DENIED') return 'Bạn không có quyền thao tác tại chi nhánh hoặc lớp này.';
  if (code === 'PRESCHOOL_TEACHER_CONFLICT') return 'Dữ liệu đã thay đổi hoặc có phân công trùng. Tải lại để kiểm tra.';
  if (code === 'PRESCHOOL_TEACHER_INVALID_REQUEST') return 'Kiểm tra ngày, vai trò và nội dung đã nhập.';
  return 'Không lưu được dữ liệu giáo viên. Vui lòng thử lại.';
}

export default function TeacherWorkspace() {
  const [branches, setBranches] = useState<View<Branch[]>>({ status: 'loading' });
  const [branchId, setBranchId] = useState('');
  const [courses, setCourses] = useState<View<Course[]>>({ status: 'loading' });
  const [courseId, setCourseId] = useState('');
  const [candidates, setCandidates] = useState<View<PreschoolTeacherCandidatePage>>({ status: 'loading' });
  const [assignments, setAssignments] = useState<View<PreschoolCourseTeacherPage>>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [confirmedOnly, setConfirmedOnly] = useState(true);
  const [onDate, setOnDate] = useState(today);
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [assignmentOffset, setAssignmentOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [operationKey, setOperationKey] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [finishDate, setFinishDate] = useState('');
  const [attestation, setAttestation] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [role, setRole] = useState('lead_teacher');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setBranches({ status: 'loading' });
    void read('/api/education/branches', controller.signal).then(body => {
      if (!Array.isArray(body.branches) || body.branches.some(row => !record(row)
        || typeof row.id !== 'string' || typeof row.name !== 'string')) throw new Error('BAD_BRANCHES');
      if (!controller.signal.aborted) setBranches({ status: 'ready', data: body.branches as Branch[] });
    }).catch(() => { if (!controller.signal.aborted) setBranches({ status: 'error' }); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    setCourses({ status: 'loading' });
    const params = new URLSearchParams({ view: 'classes', branchId });
    void read(`/api/education/teachers?${params}`, controller.signal).then(body => {
      if (body.branchId !== branchId || !Array.isArray(body.classes)
        || body.classes.some(row => !record(row) || typeof row.id !== 'string'
          || typeof row.code !== 'string' || typeof row.title !== 'string')) throw new Error('BAD_CLASSES');
      if (!controller.signal.aborted) setCourses({ status: 'ready', data: body.classes as Course[] });
    }).catch(() => { if (!controller.signal.aborted) setCourses({ status: 'error' }); });
    return () => controller.abort();
  }, [branchId, revision]);

  useEffect(() => {
    if (!branchId || !onDate || (!confirmedOnly && query.trim().length < 2)) return;
    const controller = new AbortController();
    setCandidates({ status: 'loading' });
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ view: 'candidates', branchId, query,
        confirmedOnly: String(confirmedOnly), onDate, offset: String(candidateOffset), limit: String(pageSize) });
      void read(`/api/education/teachers?${params}`, controller.signal).then(body => {
        const page = body.page;
        if (!record(page) || page.branchId !== branchId || page.onDate !== onDate
          || page.confirmedOnly !== confirmedOnly || page.offset !== candidateOffset || page.limit !== pageSize
          || !Array.isArray(page.parties)
          || !Number.isInteger(page.filteredTotal) || (page.nextOffset !== null && !Number.isInteger(page.nextOffset))
          || page.parties.some(row => !record(row) || typeof row.partyId !== 'string'
            || typeof row.displayName !== 'string' || !Array.isArray(row.confirmations))) throw new Error('BAD_CANDIDATES');
        if (!controller.signal.aborted) setCandidates({ status: 'ready', data: page as unknown as PreschoolTeacherCandidatePage });
      }).catch(() => { if (!controller.signal.aborted) setCandidates({ status: 'error' }); });
    }, query ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [branchId, query, confirmedOnly, onDate, candidateOffset, revision]);

  useEffect(() => {
    if (!branchId || !courseId || !onDate) return;
    const controller = new AbortController();
    setAssignments({ status: 'loading' });
    const params = new URLSearchParams({ view: 'assignments', branchId, courseId,
      onDate, offset: String(assignmentOffset), limit: String(pageSize) });
    void read(`/api/education/teachers?${params}`, controller.signal).then(body => {
      const page = body.page;
      if (!record(page) || page.branchId !== branchId || page.courseId !== courseId
        || page.onDate !== onDate || page.offset !== assignmentOffset || page.limit !== pageSize
        || !Array.isArray(page.assignments) || !Number.isInteger(page.total)
        || (page.nextOffset !== null && !Number.isInteger(page.nextOffset))) throw new Error('BAD_ASSIGNMENTS');
      if (!controller.signal.aborted) setAssignments({ status: 'ready', data: page as unknown as PreschoolCourseTeacherPage });
    }).catch(() => { if (!controller.signal.aborted) setAssignments({ status: 'error' }); });
    return () => controller.abort();
  }, [branchId, courseId, onDate, assignmentOffset, revision]);

  function open(next: Action) {
    if (pending) return;
    setAction(next);
    setOperationKey(crypto.randomUUID());
    setStartDate(onDate);
    setFinishDate('');
    setAttestation('');
    setAcademicYear('');
    setRole('lead_teacher');
    setReason('');
    setSaveError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !branchId || lock.current) return;
    const payload = pending ?? (action.kind === 'confirm' ? {
      action: 'confirm', branchId, operationKey, teacherPartyId: action.partyId,
      validFrom: startDate, validTo: finishDate || null, attestation: attestation.trim(),
    } : action.kind === 'revoke' ? {
      action: 'revoke', branchId, confirmationId: action.confirmationId, reason: reason.trim(),
    } : action.kind === 'assign' ? {
      action: 'assign', branchId, operationKey, courseId: action.courseId, confirmationId: action.confirmationId,
      teacherPartyId: action.partyId, role, academicYear: academicYear.trim(),
      effectiveStartDate: startDate, effectiveEndDate: finishDate || null,
    } : { action: 'terminate', branchId, courseId: action.courseId,
      assignmentId: action.assignmentId, endDate: startDate });
    lock.current = true;
    setSaving(true);
    setPending(payload);
    setSaveError('');
    try {
      const response = await fetch('/api/education/teachers', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body: unknown = await response.json();
      if (!response.ok || !record(body) || body.success !== true) {
        throw new Error(record(body) && typeof body.error === 'string' ? body.error : 'WRITE_FAILED');
      }
      setPending(null);
      setAction(null);
      setRevision(value => value + 1);
    } catch (error) { setSaveError(failure(error instanceof Error ? error.message : 'WRITE_FAILED')); }
    finally { lock.current = false; setSaving(false); }
  }

  const chosen = courses.status === 'ready' ? courses.data.find(course => course.id === courseId) : undefined;
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/dashboard/education/courses" className="text-sm font-semibold text-emerald-800 underline">← Quản lý lớp học</Link>
        <div className="mt-4 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">Bella Preschool</p>
          <h1 className="text-3xl font-bold">Quản lý giáo viên</h1><p className="mt-1 text-sm text-slate-600">Xác nhận người thật và phân công vào lớp đã liên kết.</p></div>
          <button type="button" onClick={() => setRevision(value => value + 1)} className="rounded-xl border px-4 py-2 font-semibold">Tải lại</button></div>
        <div className="mt-5 flex flex-wrap gap-4"><label className="text-sm">Chi nhánh<select aria-label="Chi nhánh" value={branchId}
          onChange={event => { setBranchId(event.target.value); setCourseId(''); setCandidateOffset(0); setAssignmentOffset(0); }}
          className="mt-1 block min-w-60 rounded-xl border bg-white p-2.5"><option value="">Chọn chi nhánh</option>
          {branches.status === 'ready' && branches.data.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm">Ngày xem hiệu lực<input aria-label="Ngày xem hiệu lực" type="date" value={onDate}
            onChange={event => { setOnDate(event.target.value); setCandidateOffset(0); setAssignmentOffset(0); }} className="mt-1 block rounded-xl border p-2.5" /></label></div>
        {branches.status === 'error' && <p role="alert" className="mt-3 text-red-700">Không tải được chi nhánh có quyền truy cập.</p>}
        {branches.status === 'ready' && branches.data.length === 0 && <p className="mt-3 text-sm">Không có chi nhánh được phân quyền.</p>}
      </header>
      {branchId && <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Người và xác nhận giáo viên</h2>
          <p className="mt-1 text-sm text-slate-600">Chỉ người đã được xác nhận mới đủ điều kiện phân công. Để xác nhận người mới, bỏ bộ lọc và tìm đúng tên.</p>
          <div className="mt-4 flex flex-wrap gap-3"><input aria-label="Tìm người" placeholder="Tìm theo tên" value={query}
            onChange={event => { setQuery(event.target.value); setCandidateOffset(0); }} className="min-w-48 flex-1 rounded-xl border p-2.5" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmedOnly}
              onChange={event => { setConfirmedOnly(event.target.checked); setCandidateOffset(0); }} /> Chỉ đã xác nhận</label></div>
          {!confirmedOnly && query.trim().length < 2 && <p className="mt-5 text-sm text-slate-600">Nhập ít nhất 2 ký tự tên người cần xác nhận.</p>}
          {(confirmedOnly || query.trim().length >= 2) && candidates.status === 'loading' && <p role="status" className="mt-5">Đang tải…</p>}
          {(confirmedOnly || query.trim().length >= 2) && candidates.status === 'error' && <p role="alert" className="mt-5 text-red-700">Không tải được người của chi nhánh.</p>}
          {(confirmedOnly || query.trim().length >= 2) && candidates.status === 'ready' && <><p className="mt-4 text-sm text-slate-600">{candidates.data.filteredTotal} người phù hợp</p>
            {candidates.data.parties.length === 0 && confirmedOnly && <p className="mt-3 text-sm text-slate-600">Chưa có giáo viên được xác nhận tại chi nhánh vào ngày này.</p>}
            <div className="divide-y">{candidates.data.parties.map(party => <article key={party.partyId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{party.displayName}</h3>
                <p className="text-xs text-slate-500">{party.confirmations.length ? 'Đã xác nhận' : 'Chưa xác nhận'}</p></div>
                {!party.confirmations.length && <button type="button" onClick={() => open({ kind: 'confirm', partyId: party.partyId, partyName: party.displayName })}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Xác nhận giáo viên</button>}</div>
              {party.confirmations.map(confirmation => <div key={confirmation.confirmationId} className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm">
                <p>Hiệu lực: {confirmation.validFrom} → {confirmation.validTo || 'chưa kết thúc'}</p>
                <div className="mt-2 flex gap-4">{chosen && <button type="button" className="font-semibold text-emerald-800 underline"
                  onClick={() => open({ kind: 'assign', partyId: party.partyId, partyName: party.displayName,
                    confirmationId: confirmation.confirmationId, courseId: chosen.id })}>Phân công vào lớp</button>}
                  <button type="button" className="text-red-700 underline" onClick={() => open({ kind: 'revoke', confirmationId: confirmation.confirmationId })}>Thu hồi</button></div>
              </div>)}</article>)}{candidates.data.parties.length === 0 && !confirmedOnly && <p className="py-5 text-sm">Không có người phù hợp.</p>}</div>
            <div className="flex gap-2 text-sm"><button type="button" disabled={!candidateOffset} onClick={() => setCandidateOffset(Math.max(0, candidateOffset - pageSize))} className="rounded-lg border px-3 py-1 disabled:opacity-40">Trước</button>
              <button type="button" disabled={candidates.data.nextOffset === null} onClick={() => setCandidateOffset(candidates.data.nextOffset ?? candidateOffset)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Sau</button></div>
          </>}
        </section>
        <section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Phân công theo lớp</h2>
          <label className="mt-4 block text-sm">Lớp đã liên kết chi nhánh<select aria-label="Lớp" value={courseId}
            onChange={event => { setCourseId(event.target.value); setAssignmentOffset(0); }} className="mt-1 block w-full rounded-xl border bg-white p-2.5">
            <option value="">Chọn lớp</option>{courses.status === 'ready' && courses.data.map(course => <option key={course.id} value={course.id}>{course.title} ({course.code})</option>)}</select></label>
          {courses.status === 'error' && <p role="alert" className="mt-4 text-red-700">Không tải được lớp đã liên kết.</p>}
          {courses.status === 'ready' && courses.data.length === 0 && <p className="mt-4 text-sm">Chưa có lớp được liên kết tại chi nhánh.</p>}
          {chosen && <div className="mt-5"><p className="text-sm text-slate-600">Chọn người đã xác nhận ở danh sách bên trái để phân công.</p>
            {assignments.status === 'loading' && <p role="status" className="mt-4">Đang tải phân công…</p>}
            {assignments.status === 'error' && <p role="alert" className="mt-4 text-red-700">Không tải được phân công.</p>}
            {assignments.status === 'ready' && <><p className="mt-4 text-sm text-slate-600">{assignments.data.total} phân công được lưu</p>
              <div className="divide-y">{assignments.data.assignments.map(item => <article key={item.assignmentId} className="flex justify-between gap-3 py-4">
                <div><h3 className="font-semibold">{item.teacherName || 'Danh tính không khả dụng'}</h3>
                  <p className="text-sm">{item.role} · {item.academicYear} · {item.status}</p>
                  <p className="text-xs text-slate-600">{item.effectiveStartDate} → {item.effectiveEndDate || 'chưa kết thúc'} · {item.eligibility}</p></div>
                {item.status === 'active' && <button type="button" className="self-start text-sm text-red-700 underline"
                  onClick={() => open({ kind: 'terminate', courseId: chosen.id, assignmentId: item.assignmentId })}>Chấm dứt</button>}
              </article>)}{assignments.data.assignments.length === 0 && <p className="py-5 text-sm">Chưa có phân công được lưu.</p>}</div>
              <div className="flex gap-2 text-sm"><button type="button" disabled={!assignmentOffset} onClick={() => setAssignmentOffset(Math.max(0, assignmentOffset - pageSize))} className="rounded-lg border px-3 py-1 disabled:opacity-40">Trước</button>
                <button type="button" disabled={assignments.data.nextOffset === null} onClick={() => setAssignmentOffset(assignments.data.nextOffset ?? assignmentOffset)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Sau</button></div>
            </>}
          </div>}
        </section>
      </div>}
    </div>
    <Dialog open={action !== null} onOpenChange={visible => { if (!visible && !saving && !pending) setAction(null); }}>
      <DialogContent className="max-w-lg bg-white text-slate-900"><DialogTitle>{action?.kind === 'confirm' ? 'Xác nhận giáo viên' : action?.kind === 'assign' ? 'Phân công giáo viên' : action?.kind === 'revoke' ? 'Thu hồi xác nhận' : 'Chấm dứt phân công'}</DialogTitle>
        <DialogDescription>Thông tin sẽ được lưu theo quyền chi nhánh và lớp hiện có.</DialogDescription>
        <form onSubmit={submit} className="mt-3 space-y-4">
          {action?.partyName && <p className="font-semibold">{action.partyName}</p>}
          {(action?.kind === 'confirm' || action?.kind === 'assign' || action?.kind === 'terminate') && <label className="block text-sm">{action.kind === 'terminate' ? 'Ngày kết thúc' : 'Ngày bắt đầu hiệu lực'}
            <input required type="date" value={startDate} disabled={!!pending} onChange={event => setStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>}
          {(action?.kind === 'confirm' || action?.kind === 'assign') && <label className="block text-sm">Ngày kết thúc (nếu có)<input type="date" min={startDate} value={finishDate} disabled={!!pending} onChange={event => setFinishDate(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>}
          {action?.kind === 'confirm' && <label className="block text-sm">Căn cứ xác nhận là giáo viên tại chi nhánh<textarea required maxLength={500} value={attestation} disabled={!!pending} onChange={event => setAttestation(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>}
          {action?.kind === 'assign' && <><label className="block text-sm">Năm học<input required maxLength={80} value={academicYear} disabled={!!pending} onChange={event => setAcademicYear(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
            <label className="block text-sm">Vai trò<select value={role} disabled={!!pending} onChange={event => setRole(event.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="lead_teacher">Giáo viên chủ nhiệm</option><option value="co_teacher">Giáo viên đồng phụ trách</option><option value="assistant">Trợ giảng</option><option value="substitute">Giáo viên thay thế</option></select></label></>}
          {action?.kind === 'revoke' && <label className="block text-sm">Lý do thu hồi<input required maxLength={500} value={reason} disabled={!!pending} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>}
          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          {pending && saveError && <p className="text-xs text-slate-600">Thử lại gửi đúng yêu cầu cũ. Tải lại trang để nhập yêu cầu mới.</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-emerald-800 p-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : pending ? 'Thử lại yêu cầu' : 'Xác nhận và lưu'}</button>
        </form>
      </DialogContent>
    </Dialog>
  </main>;
}
