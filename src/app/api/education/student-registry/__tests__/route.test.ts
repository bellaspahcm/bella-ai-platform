import { beforeEach, describe, expect, it, jest } from '@jest/globals';
const mockResolve = jest.fn(), mockRead = jest.fn();
jest.mock('../../attendance/request-context', () => ({
  resolveAttendanceRequestContext: mockResolve,
  AttendanceAccessError: class extends Error { constructor(readonly status: number, readonly code: string) { super(code); } },
}));
jest.mock('@/platform/education/contracts/preschool-registry.contract.impl', () => ({
  PreschoolRegistryContractImpl: class { read = mockRead; },
}));
const { GET } = require('../route') as typeof import('../route');
const context = { tenantId: '00000000-0000-0000-0000-000000000001', actorId: 'actor', productKey: 'bella_preschool', client: {} };
beforeEach(() => { jest.clearAllMocks(); mockResolve.mockResolvedValue(context); mockRead.mockResolvedValue({ totals: { students: 187, active: 157, pending: 30 } }); });
describe('Preschool registry GET', () => {
  it('uses the authenticated public contract with bounded paging and no client identity', async () => {
    const response = await GET(new Request('http://localhost/api/education/student-registry?status=pending&query=An&limit=20&offset=20'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mockRead).toHaveBeenCalledWith(context.tenantId, { query: 'An', status: 'pending', courseId: null, branchId: null, limit: 20, offset: 20 });
    expect(mockResolve.mock.invocationCallOrder[0]).toBeLessThan(mockRead.mock.invocationCallOrder[0]);
  });
  it.each(['role=admin', 'tenantId=other', 'actorId=other', 'offset=NaN', 'limit=51', 'offset=-1', 'status=cancelled', 'status=all&status=pending', 'courseId=foreign'])('rejects overrides/malformed selectors before contract: %s', async qs => {
    const response = await GET(new Request(`http://localhost/api/education/student-registry?${qs}`));
    expect(response.status).toBe(400); expect(mockRead).not.toHaveBeenCalled();
  });
  it('does not offer this capability to another Product', async () => {
    mockResolve.mockResolvedValue({ ...context, productKey: 'bella_training' });
    expect((await GET(new Request('http://localhost/api/education/student-registry'))).status).toBe(404);
    expect(mockRead).not.toHaveBeenCalled();
  });
  it('does not turn a dependency failure into an empty successful list or expose SQL details', async () => {
    mockRead.mockRejectedValue(Error('sensitive SQL details'));
    const response = await GET(new Request('http://localhost/api/education/student-registry'));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ success: false, error: 'REGISTRY_UNAVAILABLE' });
  });
});
