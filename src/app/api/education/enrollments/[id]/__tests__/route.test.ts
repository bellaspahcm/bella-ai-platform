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
type ProfileResult = { data: unknown; error: { code?: string; message: string } | null };
const mockGetUser = jest.fn<() => Promise<AuthResult>>();
const mockRpc = jest.fn<(name: string, args?: unknown) => Promise<ProfileResult>>();
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

describe('Student 360 authenticated route', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockImplementation(async (name: string) => {
      if (name === CURRENT_ACTOR_PROFILE_RPC) {
        return { data: [activeActor], error: null };
      }
      return { data: { success: true }, error: null };
    });
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
    mockGetUser.mockResolvedValueOnce(fault === 'no-user'
      ? { data: { user: null }, error: null }
      : { data: { user: null }, error: { message: 'invalid session' } });
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_UNAUTHENTICATED' });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('rejects forbidden role with no cross-tenant exposure', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ ...activeActor, role: 'teacher' }], error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_ACCESS_DENIED' });
    expect(mockLoadStudent360Profile).not.toHaveBeenCalled();
  });

  it('fails closed when identity spoof headers or query parameters are present', async () => {
    const forged = request('', { 'x-role': 'admin' });
    const response = await GET(forged, context());
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_ACCESS_DENIED' });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('fails closed when unexpected query parameters are present', async () => {
    const invalid = request('?view=full');
    const response = await GET(invalid, context());
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'INVALID_STUDENT_PROFILE_REQUEST' });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns 404 when canonical student is not found', async () => {
    mockLoadStudent360Profile.mockResolvedValueOnce(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_NOT_FOUND' });
  });

  it.each(['provider', 'malformed-data'])('fails closed for %s instead of returning a fallback profile', async failure => {
    mockLoadStudent360Profile.mockRejectedValueOnce(failure === 'provider'
      ? new Error('database internal details') : new Student360ReadError('STUDENT_PROFILE_UNAVAILABLE', 503));
    const response = await GET(request(), context());
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_UNAVAILABLE' });
  });

  describe('PATCH student profile update', () => {
    function patchRequest(body: unknown, headers: HeadersInit = {}): Request {
      return new Request(`http://localhost/api/education/enrollments/${studentCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    }

    it('denies unauthenticated callers', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'unauthenticated' } });
      const response = await PATCH(patchRequest({ name: 'Updated Name' }), context());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_UNAUTHENTICATED' });
    });

    it('denies non-admin callers (only admin is permitted)', async () => {
      mockRpc.mockImplementationOnce(async () => ({
        data: [{ ...activeActor, role: 'teacher' }],
        error: null,
      }));
      const response = await PATCH(patchRequest({ name: 'Updated Name' }), context());
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ success: false, error: 'STUDENT_PROFILE_ACCESS_DENIED' });
    });

    it('rejects invalid payload fields or malformed data', async () => {
      const response = await PATCH(patchRequest({ invalidField: 123 }), context());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: 'INVALID_STUDENT_PROFILE_REQUEST' });
    });

    it('allows admin to update name, dob, gender and returns refreshed profile', async () => {
      const updatedProfile: Student360ProfileData = {
        ...canonicalProfile,
        name: 'Đặng Khôi Mới',
        dob: '2022-03-15',
        gender: 'male',
      };
      mockLoadStudent360Profile
        .mockResolvedValueOnce(canonicalProfile)
        .mockResolvedValueOnce(updatedProfile);

      const response = await PATCH(
        patchRequest({ name: 'Đặng Khôi Mới', dob: '2022-03-15', gender: 'male' }),
        context()
      );
      expect(response.status).toBe(200);
      expectPrivate(response);
      expect(mockRpc).toHaveBeenCalledWith('preschool_admin_update_student_profile', {
        p_student_id: canonicalProfile.studentId,
        p_name: 'Đặng Khôi Mới',
        p_dob: '2022-03-15',
        p_gender: 'male',
      });
      expect(await response.json()).toEqual({ success: true, profile: updatedProfile });
    });
  });
});
