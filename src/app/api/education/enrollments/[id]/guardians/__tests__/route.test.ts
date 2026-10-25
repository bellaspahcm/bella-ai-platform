import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';
import { CURRENT_ACTOR_PROFILE_RPC } from '@/platform/security/current-actor.contract';
import type { PreschoolStudentGuardianReadPage } from '@/products/bella-education/services/preschool-student-guardian-read.service';

const mockReadGuardians = jest.fn<(studentId: string) => Promise<PreschoolStudentGuardianReadPage>>();
jest.mock('@/products/bella-education/services/preschool-student-guardian-read.service', () => {
  const actual = jest.requireActual<typeof import('@/products/bella-education/services/preschool-student-guardian-read.service')>(
    '@/products/bella-education/services/preschool-student-guardian-read.service'
  );
  return {
    ...actual,
    PreschoolStudentGuardianReadService: jest.fn().mockImplementation(() => ({ read: mockReadGuardians })),
  };
});

type AuthResult = { data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: { message: string } | null };
type ProfileResult = { data: unknown; error: { code?: string; message: string } | null };
const mockGetUser = jest.fn<(token?: string) => Promise<AuthResult>>();
const mockGetSession = jest.fn<() => Promise<{
  data: { session: { access_token: string } | null }; error: { message: string } | null;
}>>();
const mockRpc = jest.fn<(name: string, args?: { p_student_id: string }) => Promise<ProfileResult>>();
const callerClient = { auth: { getUser: mockGetUser, getSession: mockGetSession }, rpc: mockRpc };
const mockCreateClient = jest.fn<() => Promise<typeof callerClient>>();
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/lib/supabase-public-env', () => ({
  requireSupabasePublicEnv: () => ({ url: 'https://g1.example.test', publicKey: 'test-public-key' }),
}));

const { GET, POST, PUT, PATCH, DELETE } = require('../route') as typeof import('../route');
const guardianReadModule = require('@/products/bella-education/services/preschool-student-guardian-read.service') as typeof import('@/products/bella-education/services/preschool-student-guardian-read.service');
const { PreschoolStudentGuardianReadError } = guardianReadModule;

const tenantId = 'ed100000-0000-4000-8000-000000000001';
const actorId = 'ad6899c2-4b9d-49af-acb3-69e2e1d11447';
const studentId = '00000001-0000-4000-8000-000000000001';
const studentPartyId = '00000002-0000-4000-8000-000000000001';
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
const guardianPage: PreschoolStudentGuardianReadPage = {
  studentId,
  studentPartyId,
  asOfDate: '2026-10-24',
  complete: true,
  guardianCount: 0,
  guardians: [],
};

function request(query = '', headers: HeadersInit = {}): Request {
  return new Request(`http://localhost/api/education/enrollments/${studentId}/guardians${query}`, { headers });
}
const context = (id = studentId) => ({ params: Promise.resolve({ id }) });
function expectPrivate(response: Response): void {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
}

describe('Student guardian authenticated read-only route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-token' } }, error: null });
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true, json: async () => guardianPage,
    } as Response);
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [activeActor], error: null });
    mockReadGuardians.mockResolvedValue(guardianPage);
  });

  it('reconciles Real Auth and lets the G1 capability recheck the canonical Student scope', async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(mockRpc).toHaveBeenCalledWith(CURRENT_ACTOR_PROFILE_RPC);
    expect(mockReadGuardians).toHaveBeenCalledWith(studentId);
    expect(await response.json()).toEqual({ success: true, guardians: guardianPage });
  });

  it('binds the approved RPC POST to the exact validated caller token and only the Student selector', async () => {
    await GET(request(), context());
    expect(mockGetUser).toHaveBeenCalledWith('synthetic-token');
    const read = jest.mocked(guardianReadModule.PreschoolStudentGuardianReadService).mock.calls[0][0];
    await expect(read(studentId)).resolves.toEqual({ data: guardianPage, error: null });
    expect(global.fetch).toHaveBeenCalledWith('https://g1.example.test/rest/v1/rpc/preschool_g1_guardians_read', {
      method: 'POST',
      headers: { apikey: 'test-public-key', Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_student_id: studentId }),
      cache: 'no-store', signal: expect.any(AbortSignal),
    });
  });

  it('validates an explicit Bearer caller without using a cookie session token', async () => {
    expect((await GET(request('', { Authorization: 'Bearer synthetic-bearer' }), context())).status).toBe(200);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetUser).toHaveBeenCalledWith('synthetic-bearer');
  });

  it('denies missing or invalid token before reading canonical profile or guardians', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    expect((await GET(request(), context())).status).toBe(401);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockReadGuardians).not.toHaveBeenCalled();
    expect((await GET(request('', { Authorization: 'Basic invalid' }), context())).status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps RPC failure details private and never treats provider denial as success', async () => {
    await GET(request(), context());
    const read = jest.mocked(guardianReadModule.PreschoolStudentGuardianReadService).mock.calls[0][0];
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false, json: async () => ({ code: '42501', message: 'private guardian details' }),
    } as Response);
    await expect(read(studentId)).resolves.toEqual({ data: null, error: { code: '42501' } });
  });
  it.each(['no-user', 'auth-error'])('denies %s before Registry or G1 reads', async fault => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: fault === 'no-user' ? null : { id: actorId } },
      error: fault === 'auth-error' ? { message: 'invalid session' } : null,
    });
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expect(mockReadGuardians).not.toHaveBeenCalled();
  });

  it.each(['admin_staff', 'super_admin', 'parent', 'student', 'teacher'])('denies canonical role %s', async role => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...activeActor, role }], error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expect(mockReadGuardians).not.toHaveBeenCalled();
  });

  it('ignores mutable Auth metadata and retains the canonical actor', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: actorId, user_metadata: { role: 'super_admin', tenant_id: 'foreign' } } },
      error: null,
    });
    expect((await GET(request(), context())).status).toBe(200);
    expect(mockReadGuardians).toHaveBeenCalledWith(studentId);
  });

  it.each(['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'])(
    'rejects identity override header %s before Auth',
    async header => {
      const response = await GET(request('', { [header]: 'spoofed' }), context());
      expect(response.status).toBe(403);
      expect(mockCreateClient).not.toHaveBeenCalled();
    },
  );

  it.each(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'user_role'])(
    'rejects identity query %s before Auth',
    async key => {
      const response = await GET(request(`?${key}=spoofed`), context());
      expect(response.status).toBe(403);
      expect(mockCreateClient).not.toHaveBeenCalled();
    },
  );

  it('rejects unsupported selectors, missing identifiers and non-UUID selectors', async () => {
    expect((await GET(request('?branchId=foreign'), context())).status).toBe(400);
    expect((await GET(request(), context(' '))).status).toBe(400);
    expect((await GET(request(), context('EDU-2026-000001'))).status).toBe(400);
    expect(mockReadGuardians).not.toHaveBeenCalled();
  });

  it.each([
    [new PreschoolStudentGuardianReadError('STUDENT_GUARDIAN_ACCESS_DENIED', 403), 403],
    [new PreschoolStudentGuardianReadError('STUDENT_GUARDIANS_UNAVAILABLE', 503), 503],
  ] as const)('sanitizes G1 dependency failure', async (failure, expectedStatus) => {
    mockReadGuardians.mockRejectedValueOnce(failure);
    const response = await GET(request(), context());
    expect(response.status).toBe(expectedStatus);
    expectPrivate(response);
    expect(JSON.stringify(await response.json())).not.toContain('database');
  });

  it('fails unavailable on an unknown dependency exception', async () => {
    mockReadGuardians.mockRejectedValueOnce(new Error('private database details'));
    const response = await GET(request(), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_GUARDIANS_UNAVAILABLE' });
  });

  it.each([POST, PUT, PATCH, DELETE])('locks every mutation method before all dependencies', async method => {
    const response = await method();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expectPrivate(response);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockReadGuardians).not.toHaveBeenCalled();
  });
});
