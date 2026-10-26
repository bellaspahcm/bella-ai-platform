import { afterEach, expect, it, jest } from '@jest/globals';
import { loadClassroomOverview } from '../classroom-live-data';

const tenantId = '00000000-0000-4000-8000-000000000001';
const row = { id: '00000000-0000-4000-8000-000000000002', tenantId,
  branchId: '00000000-0000-4000-8000-000000000003', code: 'MAM-01', name: 'Lớp Mầm', room: 'Chưa ghi nhận phòng',
  teacher: 'Chưa phân công GVN', teacherCount: 0, students: 0, maxStudents: null,
  todayStatus: { present: 0, excused: 0, unmarked: 0 } };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function response(rows: unknown[]) {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({ ok: true,
    json: async () => ({ success: true, classrooms: rows }) } as Response);
}

it('retains observed zeroes and unknown capacity without inventing a default', async () => {
  response([row]);
  expect((await loadClassroomOverview(tenantId)).get(row.id)).toMatchObject({ students: 0, teacherCount: 0, maxStudents: null });
});

it.each([
  { rows: [{ ...row, tenantId: '00000000-0000-4000-8000-000000000009' }] },
  { rows: [row, row] },
  { rows: [{ ...row, todayStatus: { present: -1, excused: 0, unmarked: 0 } }] },
])('rejects foreign, duplicate or invalid operational metadata', async ({ rows }) => {
  response(rows);
  await expect(loadClassroomOverview(tenantId)).rejects.toThrow('CLASSROOM_OVERVIEW_SCOPE_MISMATCH');
});
