import { beforeEach, describe, expect, it, jest } from '@jest/globals';

interface AuthResult {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}

interface Profile {
  id: string;
  tenant_id: string | null;
  status?: string;
  role?: string;
}

const mockGetUser = jest.fn<() => Promise<AuthResult>>();
const mockGetCurrentUser = jest.fn<() => Promise<Profile | null>>();
const mockExecute = jest.fn<() => Promise<{ success: boolean; action: string }>>();
const mockClient = { auth: { getUser: mockGetUser } };
const mockCreateClient = jest.fn<() => typeof mockClient>();

jest.mock('@/lib/supabase-server', () => ({ createClient: mockCreateClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/products/bella-education/services/preschool-ai.service', () => ({
  executePreschoolCopilot: mockExecute,
}));

const { POST } = require('../route') as typeof import('../route');
const userId = '00000000-0000-4000-8000-000000000011';
const tenantId = '00000000-0000-4000-8000-000000000022';
const foreignTenant = '00000000-0000-4000-8000-000000000033';
const profile: Profile = { id: userId, tenant_id: tenantId, status: 'active', role: 'education_teacher' };
const executiveActions = ['executive_briefing', 'executive_safety_audit'] as const;
// Approved Phase4 gate, section1 item3; this list is independent from the route implementation.
const approvedExecutiveRoles = ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'PROGRAM_DIRECTOR', 'EDUCATION_HEAD', 'ACADEMIC_ADMIN'] as const;

function request(body: Record<string, unknown> = { action: 'classify_intent', message: 'synthetic' }, query = '', headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/education/ai/copilot${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

async function expectDenied(req: Request, status: number, error: string) {
  const response = await POST(req);
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mockExecute).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.resetAllMocks();
  mockCreateClient.mockReturnValue(mockClient);
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockGetCurrentUser.mockResolvedValue(profile);
  mockExecute.mockResolvedValue({ success: true, action: 'classify_intent' });
});

describe('Copilot verified request boundary', () => {
  it('denies anonymous requests despite tenant, role, email and cookie assertions before profile or payload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = request({ action: 'executive_briefing', role: 'SUPER_ADMIN' }, `?tenantId=${tenantId}`, {
      'x-mock-role': 'SUPER_ADMIN', 'x-mock-user-email': 'synthetic@example.invalid',
      Cookie: 'mock_user_email=synthetic@example.invalid',
    });
    const payloadRead = jest.spyOn(req, 'json');
    await expectDenied(req, 401, 'COPILOT_UNAUTHENTICATED');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(payloadRead).not.toHaveBeenCalled();
  });

  it('denies an invalid Auth response even if it contains a user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: { message: 'invalid token' } });
    await expectDenied(request(), 401, 'COPILOT_UNAUTHENTICATED');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it.each([
    ['missing profile', null],
    ['different Auth subject', { ...profile, id: foreignTenant }],
    ['inactive profile', { ...profile, status: 'inactive' }],
    ['missing status', { ...profile, status: undefined }],
    ['missing tenant', { ...profile, tenant_id: null }],
    ['empty tenant', { ...profile, tenant_id: '' }],
    ['blank tenant', { ...profile, tenant_id: '   ' }],
  ] as const)('denies %s without executing', async (_label, invalidProfile) => {
    mockGetCurrentUser.mockResolvedValue(invalidProfile);
    await expectDenied(request(), 403, 'FORBIDDEN');
  });

  it.each([
    ['foreign', `?tenantId=${foreignTenant}`],
    ['empty', '?tenantId='],
    ['matching then foreign', `?tenantId=${tenantId}&tenantId=${foreignTenant}`],
    ['foreign then matching', `?tenantId=${foreignTenant}&tenantId=${tenantId}`],
    ['matching then empty', `?tenantId=${tenantId}&tenantId=`],
  ])('denies %s tenant selectors before payload or AI', async (_label, selector) => {
    const req = request(undefined, selector);
    const payloadRead = jest.spyOn(req, 'json');
    await expectDenied(req, 403, 'TENANT_ISOLATION_VIOLATION');
    expect(payloadRead).not.toHaveBeenCalled();
  });

  it('does not let a forged leadership header override a forbidden live role', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...profile, role: 'customer' });
    await expectDenied(request(undefined, '', { 'x-mock-role': 'SUPER_ADMIN' }), 403, 'FORBIDDEN');
  });

  it('denies a profile without an eligible role instead of applying a test default', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...profile, role: undefined });
    await expectDenied(request(), 403, 'FORBIDDEN');
  });

  it.each(['', `?tenantId=${tenantId}`, `?tenantId=${tenantId}&tenantId=${tenantId}`])(
    'executes an authorized general action with a bound selector %s', async selector => {
      const response = await POST(request({ action: 'classify_intent', message: 'synthetic', tenantId: foreignTenant, role: 'SUPER_ADMIN' }, selector));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, tenantId });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ action: 'classify_intent', message: 'synthetic' }));
      expect(mockExecute).toHaveBeenCalledWith(expect.not.objectContaining({ tenantId: foreignTenant, role: 'SUPER_ADMIN' }));
      expect(mockGetUser.mock.invocationCallOrder[0]).toBeLessThan(mockGetCurrentUser.mock.invocationCallOrder[0]);
    },
  );

  it('keeps invalid action behavior for a verified eligible profile', async () => {
    await expectDenied(request({ action: 'invalid_action' }), 400, 'INVALID_ACTION');
  });

  it.each(['client construction', 'Auth provider', 'profile provider'])(
    'fails closed if %s throws', async failure => {
      if (failure === 'client construction') mockCreateClient.mockImplementation(() => { throw new Error('unavailable'); });
      else if (failure === 'Auth provider') mockGetUser.mockRejectedValue(new Error('unavailable'));
      else mockGetCurrentUser.mockRejectedValue(new Error('unavailable'));
      await expectDenied(request(), 500, 'INTERNAL_ERROR');
    },
  );
});

describe('Copilot executive action authorization from approved Phase4 contract', () => {
  for (const action of executiveActions) {
    it.each(approvedExecutiveRoles)(`permits %s to execute ${action}`, async role => {
      mockGetCurrentUser.mockResolvedValue({ ...profile, role });
      mockExecute.mockResolvedValue({ success: true, action });
      const response = await POST(request({ action }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, action, tenantId });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ action }));
    });

    it.each(['education_teacher', 'homeroom_teacher', 'teacher', 'education_staff', 'principal', 'director', 'admin'])(
      `denies general role %s for ${action} even with a forged admin header`, async role => {
        mockGetCurrentUser.mockResolvedValue({ ...profile, role });
        await expectDenied(request({ action }, '', { 'x-mock-role': 'SUPER_ADMIN' }), 403, 'FORBIDDEN');
      },
    );
  }

  it('normalizes the verified executive role without accepting header authority', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...profile, role: '  Campus_Admin  ' });
    const response = await POST(request({ action: 'executive_briefing' }, '', { 'x-mock-role': 'customer' }));
    expect(response.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
