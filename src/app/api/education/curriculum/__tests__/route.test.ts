/** @jest-environment node */
import { beforeEach, expect, it, jest, describe } from '@jest/globals';

const mockGetUser = jest.fn<() => Promise<unknown>>();
const mockGetCurrentUser = jest.fn<() => Promise<unknown>>();

const mockFrom = jest.fn((table: string) => {
  const query: Record<string, unknown> = {};
  query.select = jest.fn().mockReturnValue(query);
  query.eq = jest.fn().mockReturnValue(query);
  query.or = jest.fn().mockReturnValue(query);
  query.insert = jest.fn().mockReturnValue(query);
  query.update = jest.fn().mockReturnValue(query);
  query.delete = jest.fn().mockReturnValue(query);
  query.single = jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: { id: 'plan-1' }, error: null });
  query.maybeSingle = jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: { id: 'plan-1' }, error: null });
  query.order = jest.fn().mockReturnValue(query);
  return query;
});

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => null,
  getSupabaseAdminKey: () => null,
}));

const { POST } = require('../route') as typeof import('../route');

describe('Curriculum & Lesson Plan API Security & Authorization (F05)', () => {
  const actorId = '00000000-0000-0000-0000-000000000001';
  const tenantId = '00000000-0000-0000-0000-000000000002';
  const courseId = '00000000-0000-0000-0000-000000000010';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  });

  it('F05: rejects teacher attempting to modify curriculum framework', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'teacher' });
    const req = new Request('http://localhost/api/education/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'curriculum',
        data: { code: 'CURR_1', name: 'Curriculum 1', subjects: [] },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('CURRICULUM_PERMISSION_DENIED');
  });

  it('F05: rejects teacher attempting to self-approve lesson plan', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'teacher' });
    const req = new Request('http://localhost/api/education/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bật qua vật cản',
        theme: 'Thể chất',
        subjectDomain: 'Thể dục',
        plannedDate: '2026-11-02',
        status: 'APPROVED',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('LESSON_PLAN_APPROVAL_FORBIDDEN');
  });

  it('F05: rejects teacher saving lesson for course without active assignment', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'teacher' });
    mockFrom.mockImplementation(() => {
      const query: Record<string, unknown> = {};
      query.select = jest.fn().mockReturnValue(query);
      query.eq = jest.fn().mockReturnValue(query);
      query.or = jest.fn().mockReturnValue(query);
      query.maybeSingle = jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: null, error: null });
      return query;
    });

    const req = new Request('http://localhost/api/education/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bật qua vật cản',
        theme: 'Thể chất',
        subjectDomain: 'Thể dục',
        plannedDate: '2026-11-02',
        courseId,
        status: 'DRAFT',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('TEACHER_NOT_ASSIGNED_TO_COURSE');
  });

  it('F05: allows admin to approve lesson plans', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'admin' });
    mockFrom.mockImplementation((table: string) => {
      const query: Record<string, unknown> = {};
      query.select = jest.fn().mockReturnValue(query);
      query.eq = jest.fn().mockReturnValue(query);
      query.insert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: { id: 'approved-plan' }, error: null }),
        }),
      });
      return query;
    });

    const req = new Request('http://localhost/api/education/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bật qua vật cản',
        theme: 'Thể chất',
        subjectDomain: 'Thể dục',
        plannedDate: '2026-11-02',
        status: 'APPROVED',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
