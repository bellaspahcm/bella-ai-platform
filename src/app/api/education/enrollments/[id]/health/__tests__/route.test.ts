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

// Mock @supabase/supabase-js createClient for admin client
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
  return new Request(`http://localhost/api/education/enrollments/${studentId}/health${query}`, { headers });
}
const context = (id = studentId) => ({ params: Promise.resolve({ id }) });

describe('Student Health Authenticated Read-Only Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'synthetic-token' } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [activeActor], error: null });

    // Mock query chains for tables
    mockAdminFrom.mockImplementation((tableName: string) => {
      const createBuilder = (resolvedData: unknown[]) => {
        const chain: Record<string, unknown> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.order = jest.fn().mockReturnValue(chain);
        chain.then = (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: resolvedData, error: null }).then(resolve);
        return chain;
      };

      if (tableName === 'edu_child_allergies') {
        return createBuilder([
          {
            id: 'alg-1',
            severity: 'MODERATE',
            reaction_notes: 'Red rash',
            status: 'ACTIVE',
            allergen: { name: 'Seafood', description: 'Crab/shrimp' },
          },
        ]);
      }
      if (tableName === 'edu_medication_authorizations') {
        return createBuilder([
          {
            id: 'med-1',
            medication_name: 'Prospan',
            authorized_dose: '5ml',
            status: 'ACTIVE',
          },
        ]);
      }
      if (tableName === 'edu_health_incidents') {
        return createBuilder([
          {
            id: 'inc-1',
            incident_type: 'TRIP_FALL',
            severity: 'MINOR',
            description: 'Scratched knee',
            status: 'RESOLVED',
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
    expect(body).toEqual({ success: false, error: 'STUDENT_HEALTH_ACCESS_DENIED' });
  });

  it('rejects invalid student id', async () => {
    const res = await GET(request(), context('not-a-uuid'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'INVALID_STUDENT_ID' });
  });

  it('rejects unauthenticated requests', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const res = await GET(request(), context());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'STUDENT_HEALTH_UNAUTHENTICATED' });
  });

  it('rejects non-admin roles', async () => {
    const teacherActor = { ...activeActor, role: 'teacher' };
    mockRpc.mockResolvedValueOnce({ data: [teacherActor], error: null });
    const res = await GET(request(), context());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'STUDENT_HEALTH_ACCESS_DENIED' });
  });

  it('returns health records with private cache control', async () => {
    const res = await GET(request(), context());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.studentId).toBe(studentId);
    expect(body.allergies).toHaveLength(1);
    expect(body.medications).toHaveLength(1);
    expect(body.incidents).toHaveLength(1);
  });

  it('returns 405 for unsupported HTTP methods', async () => {
    expect((await POST()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});
