import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';
import { CURRENT_ACTOR_PROFILE_RPC } from '@/platform/security/current-actor.contract';
import { PreschoolRegistryError } from '@/platform/education/contracts/preschool-registry.contract';
import type { Student360ProfileData } from '../../student-360.service';

const mockLoadStudent360Profile = jest.fn<(client: unknown, tenantId: string, id: string) => Promise<Student360ProfileData | null>>();
jest.mock('../../student-360.service', () => {
  const actual = jest.requireActual<typeof import('../../student-360.service')>('../../student-360.service');
  return { ...actual, loadStudent360Profile: mockLoadStudent360Profile };
});
type AuthResult = { data: { user: { id: string; user_metadata?: Record<string, unknown> } | null }; error: { message: string } | null };
type ProfileResult = { data: CurrentActorProfileRow[] | null; error: { code?: string; message: string } | null };
const mockGetUser = jest.fn<() => Promise<AuthResult>>();
const mockRpc = jest.fn<(name: string) => Promise<ProfileResult>>();
const callerClient = { auth: { getUser: mockGetUser }, rpc: mockRpc };
const mockCreateClient = jest.fn<() => Promise<typeof callerClient>>();
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));

const { GET, PATCH } = require('../route') as typeof import('../route');
const { Student360ReadError } = require('../../student-360.service') as typeof import('../../student-360.service');
const tenantId = 'ed100000-0000-0000-0000-000000000001';
const actorId = 'ad6899c2-4b9d-49af-acb3-69e2e1d11447';
const studentCode = 'EDU-2026-000001';
const activeActor: CurrentActorProfileRow = {
  id: actorId, tenant_id: tenantId, tenant_status: 'active', status: 'active', role: 'admin',
  email: 'admin@example.test', full_name: 'Canonical admin', avatar_url: null,
};
const canonicalProfile: Student360ProfileData = {
  id: studentCode, studentId: '00000001-0000-4000-8000-000000000001',
  partyId: '00000002-0000-4000-8000-000000000001', name: 'Canonical child', dob: null, gender: null,
  enrollments: [], attendance: { present: 0, absent: 0, excused: 0, totalRecords: 0, records: [] },
};
function request(query = '', headers: HeadersInit = {}): Request {
  return new Request(`http://localhost/api/education/enrollments/${studentCode}${query}`, { headers });
}
const context = () => ({ params: Promise.resolve({ id: studentCode }) });
function expectPrivate(response: Response): void {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
}

describe('Student 360 authenticated read-only route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [activeActor], error: null });
    mockLoadStudent360Profile.mockResolvedValue(canonicalProfile);
  });

  it('reconciles the real caller with the canonical actor and uses that same caller client', async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(mockRpc).toHaveBeenCalledWith(CURRENT_ACTOR_PROFILE_RPC);
    expect(mockLoadStudent360Profile).toHaveBeenCalledWith(callerClient, tenantId, studentCode);
    expect(await response.json()).toEqual({ success: true, profile: canonicalProfile });
  });

  it.each(['no-user', 'auth-error'])('denies %s without profile or student contract reads', async fault => {
    mockGetUser.mockResolvedValueOnce({ data: { user: fault === 'no-user' ? null : { id: actorId } },
      error: fault === 'auth-error' ? { message: 'session invalid' } : null });
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expectPrivate(response);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it.each(['admin_staff', 'super_admin', 'student', 'parent', 'teacher'])('denies non-admin canonical role %s', async role => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...activeActor, role }], error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it.each(['inactive-user', 'inactive-tenant', 'wrong-subject', 'missing-profile', 'duplicate-profile'])('rejects invalid canonical actor: %s', async fault => {
    const data = fault === 'missing-profile' ? [] : fault === 'duplicate-profile' ? [activeActor, activeActor]
      : [{ ...activeActor, ...(fault === 'inactive-user' ? { status: 'inactive' }
        : fault === 'inactive-tenant' ? { tenant_status: 'inactive' } : { id: '00000000-0000-0000-0000-000000000099' }) }];
    mockRpc.mockResolvedValueOnce({ data, error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('ignores mutable Auth metadata when resolving tenant and action authority', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId,
      user_metadata: { tenant_id: '00000000-0000-0000-0000-000000000099', role: 'super_admin' } } }, error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(mockLoadStudent360Profile).toHaveBeenCalledWith(callerClient, tenantId, studentCode);
  });

  it.each(['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'])('rejects identity override header %s', async header => {
    const response = await GET(request('', { [header]: 'spoofed' }), context());
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it.each(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'user_role', 'mock_user_email'])('rejects caller identity query %s', async key => {
    const response = await GET(request(`?${key}=spoofed`), context());
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('rejects unsupported query selectors without reading student data', async () => {
    const response = await GET(request('?branchId=unapproved'), context());
    expect(response.status).toBe(400);
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('rejects missing identifiers', async () => {
    const response = await GET(request(), { params: { id: ' ' } });
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns generic not found without disclosing tenant details', async () => {
    mockLoadStudent360Profile.mockResolvedValueOnce(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_NOT_FOUND' });
  });

  it.each(['42501', 'XX000'])('handles canonical actor RPC failure %s without reading student data', async code => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code, message: 'private provider details' } });
    const response = await GET(request(), context());
    expect(response.status).toBe(code === '42501' ? 403 : 503);
    expectPrivate(response);
    expect(JSON.stringify(await response.json())).not.toContain('private provider details');
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('preserves branch denial from the Registry contract', async () => {
    mockLoadStudent360Profile.mockRejectedValueOnce(new PreschoolRegistryError('REGISTRY_ACCESS_DENIED', 403));
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expectPrivate(response);
  });

  it.each(['provider', 'malformed-data'])('fails closed for %s instead of returning a fallback profile', async failure => {
    mockLoadStudent360Profile.mockRejectedValueOnce(failure === 'provider'
      ? new Error('database internal details') : new Student360ReadError('STUDENT_PROFILE_UNAVAILABLE', 503));
    const response = await GET(request(), context());
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_UNAVAILABLE' });
  });

  it('locks PATCH with no Auth, reads, or persistence side effects', async () => {
    const response = await PATCH();
    expect(response.status).toBe(405);
    expectPrivate(response);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_UPDATE_UNAVAILABLE' });
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });
});
