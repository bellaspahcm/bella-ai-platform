/** @jest-environment node */
import { beforeEach, expect, it, jest } from '@jest/globals';
const getUser = jest.fn<() => Promise<unknown>>(), rpc = jest.fn<() => Promise<unknown>>(), read = jest.fn<() => Promise<unknown>>();
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));
jest.mock('@/platform/education/contracts/preschool-registry.contract.impl', () => ({ PreschoolRegistryContractImpl: class { read = read; } }));
const { GET } = require('../route') as typeof import('../route');
const actorId = '00000000-0000-0000-0000-000000000001', tenantId = '00000000-0000-0000-0000-000000000002';
beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: [{ id: actorId, tenant_id: tenantId, role: 'admin', status: 'active', tenant_status: 'active', email: 'synthetic@example.invalid', full_name: null, avatar_url: null }], error: null });
  read.mockReset().mockResolvedValue({ synthetic: true });
});
it('uses real Auth and canonical self profile before the public registry contract', async () => {
  const response = await GET(new Request('http://test/api/education/student-registry'));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledWith('platform_current_actor_profile'); expect(read).toHaveBeenCalledWith(tenantId, expect.objectContaining({ status: 'all' }));
});
it('rejects absent Auth before self profile or registry access', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new Request('http://test/api/education/student-registry'))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
});
it.each(['tenantId=other', 'role=admin', 'offset=-1', 'limit=51', 'status=inactive', 'limit=20&limit=50'])('rejects invalid or identity selectors before registry: %s', async query => {
  expect((await GET(new Request('http://test/api/education/student-registry?' + query))).status).toBe(400); expect(read).not.toHaveBeenCalled();
});
it('rejects mock/tenant headers and mismatched persisted actor', async () => {
  expect((await GET(new Request('http://test/api/education/student-registry', { headers: { 'x-mock-user-email': 'admin@example.invalid' } }))).status).toBe(403);
  rpc.mockResolvedValue({ data: [{ id: tenantId }], error: null });
  expect((await GET(new Request('http://test/api/education/student-registry'))).status).toBe(403); expect(read).not.toHaveBeenCalled();
});
it('returns unavailable on self-profile/provider failure, never a successful empty list', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
  const response = await GET(new Request('http://test/api/education/student-registry'));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ success: false, error: 'REGISTRY_UNAVAILABLE' }); expect(read).not.toHaveBeenCalled();
});
