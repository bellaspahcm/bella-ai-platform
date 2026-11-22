import { PATCH } from '@/app/api/interior/users/[id]/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
}));

jest.mock('../lib/rbac-api', () => ({
  ...jest.requireActual('../lib/rbac-api'),
  interiorRbacRpcClient: jest.fn(),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);

const TARGET_USER_ID = '123e4567-e89b-42d3-a456-426614174000';

function createPatchRequest(body: unknown): Request {
  return new Request(`https://bella.example/api/interior/users/${TARGET_USER_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Interior User Status Management Route (PATCH /api/interior/users/[id])', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      supabase: {} as any,
    } as any);
  });

  it('rejects invalid uuid path parameter', async () => {
    const request = new Request('https://bella.example/api/interior/users/invalid-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'invalid-id' }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('INVALID_USER_ID');
  });

  it('rejects invalid status value', async () => {
    const request = createPatchRequest({ status: 'suspended' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('INVALID_STATUS');
  });

  it('fails closed when context resolution fails', async () => {
    resolveContextMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }) as any,
    } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(401);
  });

  it('returns 503 when RPC call fails', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'Database connection error' } });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe('USER_STATUS_UPDATE_UNAVAILABLE');
  });

  it('returns 403 when RPC denies authorization (USER_MANAGEMENT_DENIED)', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'DENIED', reason: 'USER_MANAGEMENT_DENIED', user_id: null }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('USER_STATUS_UPDATE_DENIED');
    expect(data.reason).toBe('USER_MANAGEMENT_DENIED');
  });

  it('returns 400 when attempting to change own status (CANNOT_CHANGE_OWN_STATUS)', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'DENIED', reason: 'CANNOT_CHANGE_OWN_STATUS', user_id: null }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.reason).toBe('CANNOT_CHANGE_OWN_STATUS');
  });

  it('returns 404 when target user is not found in tenant', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'DENIED', reason: 'USER_NOT_FOUND_IN_TENANT', user_id: null }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.reason).toBe('USER_NOT_FOUND_IN_TENANT');
  });

  it('returns 403 when attempting to deactivate the last active OWNER', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'DENIED', reason: 'CANNOT_DEACTIVATE_LAST_OWNER', user_id: null }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.reason).toBe('CANNOT_DEACTIVATE_LAST_OWNER');
  });

  it('successfully deactivates user and returns committed status', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'USER_DEACTIVATED', user_id: TARGET_USER_ID }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'inactive', reason: 'Tạm khóa tài khoản' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      user_id: TARGET_USER_ID,
      status: 'inactive',
      event_type: 'USER_DEACTIVATED',
    });
    expect(rpc).toHaveBeenCalledWith('interior_update_user_status', {
      p_target_user_id: TARGET_USER_ID,
      p_status: 'inactive',
      p_reason: 'Tạm khóa tài khoản',
    });
  });

  it('successfully activates user and returns committed status', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'USER_ACTIVATED', user_id: TARGET_USER_ID }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as any);

    const request = createPatchRequest({ status: 'active' });
    const response = await PATCH(request, { params: Promise.resolve({ id: TARGET_USER_ID }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      user_id: TARGET_USER_ID,
      status: 'active',
      event_type: 'USER_ACTIVATED',
    });
    expect(rpc).toHaveBeenCalledWith('interior_update_user_status', {
      p_target_user_id: TARGET_USER_ID,
      p_status: 'active',
      p_reason: null,
    });
  });
});
