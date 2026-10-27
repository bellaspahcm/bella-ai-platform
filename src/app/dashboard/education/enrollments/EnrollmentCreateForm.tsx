'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CourseOption = { id: string; tenantId: string; title: string; courseCode: string };
type GuardianCandidate = { guardianPartyId: string; guardianLabel: string };
type StudentCandidate = { studentPartyId: string; studentLabel: string; guardians: GuardianCandidate[] };
type CandidateState = { status: 'idle' | 'loading' | 'error' | 'unavailable' }
  | { status: 'ready'; value: StudentCandidate[]; nextCursor: string | null };
type RequestIdentity = { key: string; id: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function isCandidate(value: unknown): value is StudentCandidate {
  return isRecord(value) && isText(value.studentPartyId) && isText(value.studentLabel)
    && Array.isArray(value.guardians) && value.guardians.every(guardian => isRecord(guardian)
      && isText(guardian.guardianPartyId) && isText(guardian.guardianLabel));
}

function isCandidateResponse(value: unknown, course: CourseOption): value is { success: true; courseId: string; candidates: StudentCandidate[]; nextCursor: string | null } {
  return isRecord(value) && value.success === true && value.courseId === course.id && value.tenantId === course.tenantId
    && (value.nextCursor === null || isText(value.nextCursor))
    && Array.isArray(value.candidates) && value.candidates.length <= 20 && value.candidates.every(isCandidate)
    && new Set(value.candidates.map(candidate => candidate.studentPartyId)).size === value.candidates.length
    && value.candidates.every(candidate => new Set(candidate.guardians.map(guardian => guardian.guardianPartyId)).size === candidate.guardians.length);
}

function stableRequestId(): string {
  return globalThis.crypto.randomUUID();
}

export function EnrollmentCreateForm({ course, onEnrolled, onSubmittingChange }: {
  course: CourseOption;
  onEnrolled: (courseId: string) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<CandidateState>({ status: 'idle' });
  const [studentPartyId, setStudentPartyId] = useState('');
  const [guardianPartyId, setGuardianPartyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [saved, setSaved] = useState(false);
  const requestIdentity = useRef<RequestIdentity | null>(null);
  const candidateRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    candidateRequest.current?.abort();
    candidateRequest.current = null;
    setQuery('');
    setCandidates({ status: 'idle' });
    setStudentPartyId('');
    setGuardianPartyId('');
    setSubmitError(false);
    setSaved(false);
    requestIdentity.current = null;
    return () => candidateRequest.current?.abort();
  }, [course.id]);

  const selectedStudent = useMemo(() => candidates.status === 'ready'
    ? candidates.value.find(candidate => candidate.studentPartyId === studentPartyId) : undefined,
  [candidates, studentPartyId]);

  async function searchCandidates(cursor?: string) {
    if (query.trim().length < 2) return;
    candidateRequest.current?.abort();
    const controller = new AbortController();
    candidateRequest.current = controller;
    setCandidates({ status: 'loading' });
    setStudentPartyId('');
    setGuardianPartyId('');
    setSubmitError(false);
    setSaved(false);
    requestIdentity.current = null;
    try {
      const params = new URLSearchParams({ view: 'candidates', courseId: course.id, query: query.trim(), limit: '20' });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/education/enrollments?${params}`, { cache: 'no-store', signal: controller.signal });
      const body: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 503) {
        setCandidates({ status: 'unavailable' });
        return;
      }
      if (!response.ok || !isCandidateResponse(body, course)) throw new Error('INVALID_CANDIDATE_RESPONSE');
      setCandidates({ status: 'ready', value: body.candidates, nextCursor: body.nextCursor });
    } catch {
      if (!controller.signal.aborted) setCandidates({ status: 'error' });
    }
  }

  function changeStudent(value: string) {
    setStudentPartyId(value);
    setGuardianPartyId('');
    setSubmitError(false);
    setSaved(false);
    requestIdentity.current = null;
  }

  function changeGuardian(value: string) {
    setGuardianPartyId(value);
    setSubmitError(false);
    setSaved(false);
    requestIdentity.current = null;
  }

  async function submitEnrollment() {
    if (!studentPartyId || !guardianPartyId || !selectedStudent?.guardians.some(guardian => guardian.guardianPartyId === guardianPartyId)) return;
    const intentKey = JSON.stringify([course.id, studentPartyId, guardianPartyId]);
    if (!requestIdentity.current || requestIdentity.current.key !== intentKey) {
      requestIdentity.current = { key: intentKey, id: stableRequestId() };
    }
    const requestId = requestIdentity.current.id;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setSubmitError(false);
    setSaved(false);
    try {
      const response = await fetch('/api/education/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ courseId: course.id, studentPartyId, guardianPartyId, requestId }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || body.success !== true || !isRecord(body.enrollment)
        || body.enrollment.tenantId !== course.tenantId || body.enrollment.courseId !== course.id || body.enrollment.studentPartyId !== studentPartyId
        || body.enrollment.status !== 'active' || !isText(body.enrollment.id)) throw new Error('ENROLLMENT_NOT_CONFIRMED');
      setSaved(true);
      requestIdentity.current = null;
      onEnrolled(course.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Ghi danh học sinh</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{course.title} · {course.courseCode}</p>
        </div>
        <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-white" onClick={() => setOpen(value => !value)}>
          {open ? 'Đóng' : 'Bắt đầu ghi danh'}
        </button>
      </div>
      {open && <div className="mt-4 space-y-4">
        <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void searchCandidates(); }}>
          <label className="sr-only" htmlFor="enrollment-student-search">Tìm học sinh</label>
          <input id="enrollment-student-search" disabled={submitting} maxLength={80} className="min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={query} onChange={event => {
            candidateRequest.current?.abort(); setQuery(event.target.value); setCandidates({ status: 'idle' });
            changeStudent('');
          }} placeholder="Tìm học sinh đủ điều kiện" />
          <button type="submit" disabled={submitting || candidates.status === 'loading' || query.trim().length < 2} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{candidates.status === 'loading' ? 'Đang tìm…' : 'Tìm học sinh'}</button>
        </form>
        {candidates.status === 'unavailable' && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">Chưa thể tải danh sách học sinh đủ điều kiện. Vui lòng thử lại sau.</p>}
        {candidates.status === 'error' && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Không thể xác minh danh sách học sinh. Hãy thử lại sau.</p>}
        {candidates.status === 'ready' && candidates.value.length === 0 && <p role="status">Không tìm thấy học sinh đủ điều kiện.</p>}
        {candidates.status === 'ready' && candidates.value.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Học sinh
            <select disabled={submitting} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" value={studentPartyId} onChange={event => changeStudent(event.target.value)}>
              <option value="">Chọn học sinh</option>
              {candidates.value.map(candidate => <option key={candidate.studentPartyId} value={candidate.studentPartyId}>{candidate.studentLabel}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Người giám hộ
            <select className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" value={guardianPartyId} onChange={event => changeGuardian(event.target.value)} disabled={submitting || !selectedStudent || selectedStudent.guardians.length === 0}>
              <option value="">Chọn người giám hộ</option>
              {selectedStudent?.guardians.map(guardian => <option key={guardian.guardianPartyId} value={guardian.guardianPartyId}>{guardian.guardianLabel}</option>)}
            </select>
          </label>
        </div>}
        {candidates.status === 'ready' && selectedStudent?.guardians.length === 0 && <p role="status">Học sinh này chưa có người giám hộ hợp lệ để ghi danh.</p>}
        {candidates.status === 'ready' && candidates.value.length > 0 && <div className="space-y-2">
          <button type="button" disabled={!studentPartyId || !guardianPartyId || submitting || saved} onClick={() => void submitEnrollment()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Đang ghi danh…' : 'Xác nhận ghi danh'}</button>
          {submitError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Chưa xác nhận được ghi danh. Có thể thử lại cùng yêu cầu này.</p>}
          {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Ghi danh đã được xác nhận. Roster đang được tải lại.</p>}
        </div>}
        {candidates.status === 'ready' && candidates.nextCursor && <button type="button" disabled={submitting} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600" onClick={() => void searchCandidates(candidates.nextCursor ?? undefined)}>Kết quả tiếp theo</button>}
      </div>}
    </section>
  );
}
