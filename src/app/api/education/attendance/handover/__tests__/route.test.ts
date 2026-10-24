import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRecordHandover = jest.fn();

const mockBranchCheck = jest.fn(async()=>undefined);
jest.mock('@/products/bella-education/services/preschool-chain.service',()=>{ const actual=jest.requireActual('@/products/bella-education/services/preschool-chain.service') as typeof import('@/products/bella-education/services/preschool-chain.service');return {...actual,PreschoolChainService:jest.fn().mockImplementation(()=>({assertStudentAccess:mockBranchCheck}))};});
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/products/bella-education/services/preschool-safe-pickup-handover.service', () => ({
  ...jest.requireActual<typeof import('@/products/bella-education/services/preschool-safe-pickup-handover.service')>('@/products/bella-education/services/preschool-safe-pickup-handover.service'),
  PreschoolSafePickupHandoverService: jest.fn().mockImplementation(() => ({
    recordHandover: mockRecordHandover,
  })),
}));

const { POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const operatorUserId = '00000000-0000-0000-0000-000000000001';

function handoverRequest(): Request {
  return new Request('http://localhost/api/education/attendance/handover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
    }),
  });
}

describe('/api/education/attendance/handover route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: operatorUserId,
      tenant_id: tenantId,
      role: 'admin_staff',
    });
    mockRecordHandover.mockResolvedValue({
      id: 'handover-a',
      tenantId,
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      handedOverAt: '2026-10-06T10:00:00.000Z',
      handedOverBy: operatorUserId,
    });
  });

  it('blocks parent users from recording pickup handover', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'parent-user',
      tenant_id: tenantId,
      role: 'parent',
    });

    const response = await POST(handoverRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain('AUTH_ROLE_PERMISSION_ERROR');
    expect(mockRecordHandover).not.toHaveBeenCalled();
  });

  it('allows an education staff actor to record handover through the service', async () => {
    const response = await POST(handoverRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockRecordHandover).toHaveBeenCalledWith({
      tenantId,
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId,
    });
  });

  it.each([
    ['ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND', 403],
    ['STUDENT_ALREADY_HANDED_OVER_TODAY', 409],
    ['PRESCHOOL_HANDOVER_BRANCH_MAPPING_CONFLICT', 409],
  ])('returns current command denial %s without false success', async (code, status) => {
    const { PreschoolHandoverError } = jest.requireActual<typeof import('@/products/bella-education/services/preschool-safe-pickup-handover.service')>('@/products/bella-education/services/preschool-safe-pickup-handover.service');
    mockRecordHandover.mockRejectedValueOnce(new PreschoolHandoverError(code, status));
    const response = await POST(handoverRequest());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: code });
  });
});
