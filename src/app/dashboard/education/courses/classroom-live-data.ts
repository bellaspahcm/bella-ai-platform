import { getLocalDateString } from '@bella/shared';
import { isRegistryUuid } from '@/platform/education/contracts/preschool-registry.contract';

export interface ClassroomLiveOverview {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  room: string;
  teacher: string;
  teacherCount: number | null;
  students: number;
  maxStudents: number | null;
  todayStatus: { present: number; excused: number; unmarked: number };
}

const record = (value: unknown): value is Record<string, unknown> => value !== null
  && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;

/** Optional operational data never replaces the catalog's canonical identity. */
export async function loadClassroomOverview(tenantId: string, signal?: AbortSignal): Promise<ReadonlyMap<string, ClassroomLiveOverview>> {
  if (!isRegistryUuid(tenantId)) throw new Error('CLASSROOM_SCOPE_UNAVAILABLE');
  const date = getLocalDateString(new Date());
  const response = await fetch(`/api/education/courses?date=${date}`, { cache: 'no-store', signal });
  const body: unknown = await response.json();
  if (!response.ok || !record(body) || body.success !== true || !Array.isArray(body.classrooms)) {
    throw new Error('CLASSROOM_OVERVIEW_UNAVAILABLE');
  }
  const result = new Map<string, ClassroomLiveOverview>();
  for (const row of body.classrooms) {
    if (!record(row) || !isRegistryUuid(row.id) || row.tenantId !== tenantId || !isRegistryUuid(row.branchId)
      || result.has(row.id) || !['code', 'name', 'room', 'teacher'].every(key => typeof row[key] === 'string')
      || !count(row.students) || (row.maxStudents !== null && !count(row.maxStudents))
      || (row.teacherCount !== null && !count(row.teacherCount)) || !record(row.todayStatus)
      || !count(row.todayStatus.present) || !count(row.todayStatus.excused) || !count(row.todayStatus.unmarked)) {
      throw new Error('CLASSROOM_OVERVIEW_SCOPE_MISMATCH');
    }
    result.set(row.id, { id: row.id, tenantId, branchId: row.branchId,
      code: row.code as string, name: row.name as string, room: row.room as string, teacher: row.teacher as string,
      teacherCount: row.teacherCount as number | null, students: row.students, maxStudents: row.maxStudents as number | null,
      todayStatus: { present: row.todayStatus.present, excused: row.todayStatus.excused, unmarked: row.todayStatus.unmarked } });
  }
  return result;
}
