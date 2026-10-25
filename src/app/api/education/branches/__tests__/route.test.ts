import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetUser = jest.fn();
const mockGetCurrentUser=jest.fn();
jest.mock('@/services/user-actions',()=>({getCurrentUser:mockGetCurrentUser}));
const mockListAccessibleBranches = jest.fn();

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Headers()),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminKey: () => '',
  getSupabaseAdminUrl: () => '',
}));

jest.mock('@/products/bella-education/services/preschool-chain.service', () => ({
  ...jest.requireActual('@/products/bella-education/services/preschool-chain.service') as typeof import('@/products/bella-education/services/preschool-chain.service'),
  PreschoolChainService: jest.fn().mockImplementation(() => ({
    listAccessibleBranches: mockListAccessibleBranches,
  })),
}));

const { GET } = require('../route') as typeof import('../route');

describe('GET /api/education/branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({id:'user-1',tenant_id:'tenant-1',role:'admin_staff'});
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: { tenant_id: 'tenant-1' },
        },
      },
      error: null,
    });
    mockListAccessibleBranches.mockResolvedValue([
      { id: 'branch-1', name: 'Bella Preschool Quận 1', code: 'Q1' },
    ]);
  });

  it('returns active branches accessible to the current Preschool user', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      branches: [{ id: 'branch-1', name: 'Bella Preschool Quận 1', code: 'Q1' }],
      count: 1,
    });
    expect(mockListAccessibleBranches).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('rejects unauthenticated requests', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockListAccessibleBranches).not.toHaveBeenCalled();
  });
});
