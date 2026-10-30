import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';
import { CURRENT_ACTOR_PROFILE_RPC } from '@/platform/security/current-actor.contract';

type AuthResult = {
  data: { user: { id: string; user_metadata?: Record<string, unknown> } | null };
  error: { message: string } | null;
};
type ProfileResult = { data: unknown; error: { code?: string; message: string } | null };

const mockGetUser = jest.fn<(token?: string) => Promise<AuthResult>>();
const mockGetSession = jest.fn<() => Promise<{
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
}>>();
const mockRpc = jest.fn<(name: string, args?: unknown) => Promise<ProfileResult>>();

const mockFrom = jest.fn();

const callerClient = {
  auth: { getUser: mockGetUser, getSession: mockGetSession },
  rpc: mockRpc,
  from: mockFrom,
};

const mockCreateClient = jest.fn<() => Promise<typeof callerClient>>();
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-role-key',
  requireSupabaseAdminEnv: () => ({ url: 'https://mock.supabase.co', adminKey: 'mock-service-role-key' }),
}));

const mockAdminFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
  })),
}));

const { GET, POST, PUT, PATCH, DELETE } = require('../route') as typeof import('../route');

const tenantId = 'ed100000-0000-4000-8000-000000000001';
const actorId = 'ad6899c2-4b9d-49af-acb3-69e2e1d11447';
const studentId = '00000001-0000-4000-8000-000000000001';

const activeActor: CurrentActorProfileRow = {
  id: actorId,
  tenant_id: tenantId,
  tenant_status: 'active',
  status: 'active',
  role: 'admin',
  email: 'admin@example.test',
  full_name: 'Canonical admin',
  avatar_url: null,
};

function request(query = '', headers: HeadersInit = {}): Request {
  return new Request(`http://localhost/api/education/enrollments/${studentId}/development${query}`, { headers });
}
const context = (id = studentId) => ({ params: Promise.resolve({ id }) });

describe('Student Development Authenticated Read-Only Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'synthetic-token' } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [activeActor], error: null });

    mockAdminFrom.mockImplementation((tableName: string) => {
      const createBuilder = (resolvedData: unknown[]) => {
        const chain: Record<string, unknown> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.in = jest.fn().mockReturnValue(chain);
        chain.order = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockResolvedValue({
          data: resolvedData[0] ?? null,
          error: null,
        });
        chain.then = (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: resolvedData, error: null }).then(resolve);
        return chain;
      };

      if (tableName === 'students') {
        return createBuilder([{ student_id: studentId, party_id: 'party-1' }]);
      }
      if (tableName === 'edu_enrollments') {
        return createBuilder([{ id: 'enroll-1', student_party_id: 'party-1' }]);
      }
      if (tableName === 'edu_assessments') {
        return createBuilder([
          {
            id: 'asm-1',
            score_type: 'midterm',
            grade: 9.5,
            weight: 1.0,
            occurred_at: '2026-10-25T08:00:00Z',
          },
        ]);
      }
      if (tableName === 'edu_dev_milestone_progress') {
        return createBuilder([
          {
            id: 'prg-1',
            status: 'ACQUIRED',
            rationale: 'Good progress',
            milestone: {
              code: 'PHYS-4Y-01',
              title: 'Hopping on one foot',
              indicator_statement: 'Gross motor skill',
            },
          },
        ]);
      }
      return createBuilder([]);
    });
  });

  it('rejects forbidden identity headers', async () => {
    const res = await GET(request('', { 'x-role': 'admin' }), context());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'STUDENT_DEVELOPMENT_ACCESS_DENIED' });
  });

  it('rejects invalid student id', async () => {
    const res = await GET(request(), context('invalid-uuid'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'INVALID_STUDENT_ID' });
  });

  it('returns developmental assessments & milestone progress', async () => {
    const res = await GET(request(), context());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.studentId).toBe(studentId);
    expect(body.assessments).toHaveLength(1);
    expect(body.milestoneProgress).toHaveLength(1);
  });

  it('returns 405 for unsupported HTTP methods', async () => {
    expect((await POST()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});
