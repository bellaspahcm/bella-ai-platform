import type { PreschoolCourseTeacherPage, PreschoolTeacherCandidate, PreschoolTeacherCandidatePage } from '@/platform/education/contracts/teacher-assignment.contract';

export type TeacherBranch = { id: string; name: string };
export type TeacherClass = { id: string; code: string; title: string };

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function teacherRead(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const body: unknown = await response.json();
  if (!response.ok || !object(body) || body.success !== true) throw new Error('READ_FAILED');
  return body;
}

export async function loadTeacherBranches(signal?: AbortSignal): Promise<TeacherBranch[]> {
  const body = await teacherRead('/api/education/branches', signal);
  if (!Array.isArray(body.branches) || body.branches.some(item => !object(item)
    || typeof item.id !== 'string' || typeof item.name !== 'string')) throw new Error('BAD_BRANCHES');
  return body.branches as TeacherBranch[];
}

export async function loadTeacherClasses(branchId: string, signal?: AbortSignal): Promise<TeacherClass[]> {
  const params = new URLSearchParams({ view: 'classes', branchId });
  const body = await teacherRead(`/api/education/teachers?${params}`, signal);
  if (body.branchId !== branchId || !Array.isArray(body.classes) || body.classes.some(item => !object(item)
    || typeof item.id !== 'string' || typeof item.code !== 'string' || typeof item.title !== 'string')) {
    throw new Error('BAD_CLASSES');
  }
  return body.classes as TeacherClass[];
}

export async function loadTeacherCandidates(branchId: string, onDate: string, query: string,
  confirmedOnly: boolean, offset: number, signal?: AbortSignal): Promise<PreschoolTeacherCandidatePage> {
  const limit = 50;
  const params = new URLSearchParams({ view: 'candidates', branchId, query, confirmedOnly: String(confirmedOnly),
    onDate, offset: String(offset), limit: String(limit) });
  const body = await teacherRead(`/api/education/teachers?${params}`, signal);
  const page = body.page;
  if (!object(page) || page.branchId !== branchId || page.onDate !== onDate
    || page.offset !== offset || page.limit !== limit || page.confirmedOnly !== confirmedOnly
    || !Array.isArray(page.parties) || !Number.isInteger(page.filteredTotal)
    || (page.nextOffset !== null && !Number.isInteger(page.nextOffset))
    || page.parties.some(item => !object(item) || typeof item.partyId !== 'string'
      || typeof item.displayName !== 'string' || !Array.isArray(item.confirmations))) {
    throw new Error('BAD_CANDIDATES');
  }
  return page as unknown as PreschoolTeacherCandidatePage;
}

export async function loadAllConfirmedTeachers(branchId: string, onDate: string,
  signal?: AbortSignal): Promise<PreschoolTeacherCandidate[]> {
  const result: PreschoolTeacherCandidate[] = [];
  let offset = 0;
  for (;;) {
    const page = await loadTeacherCandidates(branchId, onDate, '', true, offset, signal);
    result.push(...page.parties);
    const nextOffset = page.nextOffset;
    if (nextOffset === null) return result;
    if (typeof nextOffset !== 'number' || nextOffset <= offset) throw new Error('BAD_PAGINATION');
    offset = nextOffset;
  }
}

export async function loadAllClassAssignments(branchId: string, courseId: string,
  onDate: string, signal?: AbortSignal): Promise<PreschoolCourseTeacherPage['assignments']> {
  const result: PreschoolCourseTeacherPage['assignments'][number][] = [];
  let offset = 0;
  for (;;) {
    const limit = 50;
    const params = new URLSearchParams({ view: 'assignments', branchId, courseId, onDate,
      offset: String(offset), limit: String(limit) });
    const body = await teacherRead(`/api/education/teachers?${params}`, signal);
    const page = body.page;
    if (!object(page) || page.branchId !== branchId || page.courseId !== courseId
      || page.onDate !== onDate || page.offset !== offset || page.limit !== limit
      || !Array.isArray(page.assignments) || !Number.isInteger(page.total)
      || (page.nextOffset !== null && !Number.isInteger(page.nextOffset))) throw new Error('BAD_ASSIGNMENTS');
    result.push(...page.assignments as PreschoolCourseTeacherPage['assignments'][number][]);
    const nextOffset = page.nextOffset;
    if (nextOffset === null) return result;
    if (typeof nextOffset !== 'number' || nextOffset <= offset) throw new Error('BAD_PAGINATION');
    offset = nextOffset;
  }
}
