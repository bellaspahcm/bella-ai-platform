/** @jest-environment node */
import { beforeEach, expect, it, jest } from '@jest/globals';

const getUser = jest.fn<() => Promise<unknown>>();
const rpc = jest.fn<() => Promise<unknown>>();
const getSession = jest.fn<() => Promise<unknown>>();
const listCourses = jest.fn<() => Promise<unknown>>();
const readRegistry = jest.fn<() => Promise<unknown>>();

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser, getSession },
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 'obs-uuid-1' }, error: null }),
        }),
      }),
    }),
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
    students: Array<{ id: string; name: string; physical: string; status: string }>;
  };
  expect(payload.success).toBe(true);
  expect(payload.classrooms.length).toBeGreaterThanOrEqual(1);
  expect(payload.studentsCount).toBe(1);
  expect(Array.isArray(payload.students)).toBe(true);
  expect(payload.students.length).toBe(1);
  expect(payload.students[0].name).toBe('Nguyễn Minh An');
  expect(payload.students[0].physical).toBe('dat');
});

it('rejects identity spoofing headers with 403', async () => {
  const response = await GET(
    new Request('http://test/api/education/grades', {
      headers: { 'x-tenant-id': tenantId },
    }),
  );
  expect(response.status).toBe(403);
});

it('persists a new pedagogical observation via POST', async () => {
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
  expect(response.status).toBe(200);
  const payload = (await response.json()) as { success: boolean; observation: { domainName: string; skill?: string } };
  expect(payload.success).toBe(true);
  expect(payload.observation.domainName).toBe('Ngôn Ngữ & Giao Tiếp');
});

