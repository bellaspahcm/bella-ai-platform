/** @jest-environment node */
import { beforeEach, expect, it, jest } from '@jest/globals';

const getUser = jest.fn<() => Promise<unknown>>();
const rpc = jest.fn<() => Promise<unknown>>();
const getSession = jest.fn<() => Promise<unknown>>();
const listCourses = jest.fn<() => Promise<unknown>>();
const readRegistry = jest.fn<() => Promise<unknown>>();
let progressRows: unknown[] = [];
const mockFrom = jest.fn((table: string) => {
  const query: Record<string, unknown> = {};
  query.select = jest.fn().mockReturnValue(query);
  query.eq = jest.fn().mockReturnValue(query);
  query.in = jest.fn().mockReturnValue(query);
  query.gte = jest.fn().mockReturnValue(query);
  query.lt = jest.fn().mockReturnValue(query);
  query.order = jest.fn().mockReturnValue(query);
  query.limit = jest.fn().mockReturnValue(query);
  query.then = (resolve: (value: unknown) => void) => Promise.resolve({
    data: table === 'edu_dev_milestone_progress' ? progressRows : [], error: null,
  }).then(resolve);
  return query;
});

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser, getSession },
    rpc,
    from: mockFrom,
  }),
}));

jest.mock('@/platform/education/contracts/canonical-course-catalog.contract.impl', () => ({
  CanonicalCourseCatalogContractImpl: class {
    listCourses = listCourses;
  },
}));

jest.mock('@/platform/education/contracts/preschool-registry.contract.impl', () => ({
  PreschoolRegistryContractImpl: class {
    read = readRegistry;
  },
}));

// Prevent createAdminClient() from attempting a real Supabase connection in CI
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => null,
  getSupabaseAdminKey: () => null,
}));

// CI runners can be slow on first module load — extend timeout for route integration tests
jest.setTimeout(15_000);

const { GET, POST } = require('../route') as typeof import('../route');
const actorId = '00000000-0000-0000-0000-000000000001';
const tenantId = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  mockFrom.mockClear();
  progressRows = [];
  getUser.mockReset().mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'fake-token' } }, error: null });
  rpc.mockReset().mockResolvedValue({
    data: [
      {
        id: actorId,
        tenant_id: tenantId,
        role: 'admin',
        status: 'active',
        tenant_status: 'active',
        email: 'teacher@example.invalid',
        full_name: 'Cô Mai',
        avatar_url: null,
      },
    ],
    error: null,
  });
  listCourses.mockReset().mockResolvedValue([
    { id: '00000000-0000-0000-0000-000000000010', tenantId, courseCode: 'MAM_A1', title: 'Lớp Mầm A1', status: 'active' },
  ]);
  readRegistry.mockReset().mockResolvedValue({
    students: [
      {
        id: '00000000-0000-0000-0000-000000000100',
        studentCode: 'HS0001',
        name: 'Nguyễn Minh An',
        gender: 'male',
        dob: '2023-01-01',
        enrollments: [],
      },
    ],
  });
});

it('fetches live learning workspace data with classes and students', async () => {
  const response = await GET(new Request('http://test/api/education/grades?month=2026-09'));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const payload = (await response.json()) as {
    success: boolean;
    classrooms: unknown[];
    studentsCount: number;
    students: Array<{ id: string; name: string; physical: string; status: string; statusLabel: string }>;
  };
  expect(payload.success).toBe(true);
  expect(payload.classrooms.length).toBeGreaterThanOrEqual(1);
  expect(payload.studentsCount).toBe(1);
  expect(Array.isArray(payload.students)).toBe(true);
  expect(payload.students.length).toBe(1);
  expect(payload.students[0].name).toBe('Nguyễn Minh An');
  expect(payload.students[0].physical).toBe('unknown');
  expect(payload.students[0].status).toBe('supplement');
  expect(payload.students[0].statusLabel).toBe('Chưa đánh giá');
});

it('rejects identity spoofing headers with 403', async () => {
  const response = await GET(
    new Request('http://test/api/education/grades', {
      headers: { 'x-tenant-id': tenantId },
    }),
  );
  expect(response.status).toBe(403);
});

it('keeps a student incomplete when only one of five domains has a recorded result', async () => {
  progressRows = [{
    student_id: '00000000-0000-0000-0000-000000000100',
    status: 'achieved',
    milestone: { framework_domain_id: 'domain-language', edu_dev_framework_domains: { code: 'language', name: 'Language' } },
  }];
  const response = await GET(new Request('http://test/api/education/grades?month=2026-09'));
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    month: string;
    students: Array<{ language: string; physical: string; status: string; statusLabel: string }>;
  };
  expect(payload.month).toBe('2026-09');
  expect(payload.students[0]).toMatchObject({
    language: 'dat', physical: 'unknown', status: 'supplement', statusLabel: 'Chưa đánh giá đầy đủ',
  });
  const progressQuery = mockFrom.mock.results[1]?.value as { gte: jest.Mock; lt: jest.Mock };
  expect(progressQuery.gte).toHaveBeenCalledWith('interpreted_at', '2026-09-01T00:00:00.000Z');
  expect(progressQuery.lt).toHaveBeenCalledWith('interpreted_at', '2026-10-01T00:00:00.000Z');
});

it('does not claim an observation was saved without an approved persistence boundary', async () => {
  const response = await POST(
    new Request('http://test/api/education/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_observation',
        studentId: 'STU-001',
        domain: 'Ngôn Ngữ & Giao Tiếp',
        skill: 'Biết kể chuyện theo tranh',
        progression: 'Thành thạo',
        note: 'Bé nói rất lưu loát và rõ ràng',
        photosCount: 2,
      }),
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, error: 'GRADES_PERSISTENCE_UNAVAILABLE' });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('does not claim an award was issued when no award persistence contract exists', async () => {
  const response = await POST(new Request('http://test/api/education/grades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'issue_award', studentId: '00000000-0000-0000-0000-000000000100', title: 'Bé chăm ngoan' }),
  }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, error: 'GRADES_PERSISTENCE_UNAVAILABLE' });
  expect(mockFrom).not.toHaveBeenCalled();
});

