import { GET, POST } from '../route';
import { getCurrentUser } from '@/services/user-actions';
import { publishFeeProgramVersion } from '@/products/bella-education/fee-program/fee-program.persistence';

jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: jest.fn() }) }));
jest.mock('@/lib/supabase-public-env', () => ({ requireSupabasePublicEnv: () => ({ url: 'http://127.0.0.1', publicKey: 'test' }) }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/products/bella-education/fee-program/fee-program.persistence', () => ({ publishFeeProgramVersion: jest.fn() }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }) }));

const actor = { id: 'actor', tenant_id: 'tenant-a', role: 'admin', status: 'active' as const, email: 'admin@example.test', full_name: 'Admin', avatar_url: null };
const versionId = '00000000-0000-4000-8000-000000000001';
const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const insert = jest.fn();

function request(body: object) {
  return new Request('http://localhost/api/education/fee-program', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: actor.id } }, error: null });
  jest.mocked(getCurrentUser).mockResolvedValue(actor);
  insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: versionId }, error: null }) }) });
  mockFrom.mockReturnValue({ insert });
});

it('rejects unauthenticated and Staff requests before database access', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await GET()).status).toBe(401);
  jest.mocked(getCurrentUser).mockResolvedValueOnce({ ...actor, role: 'admin_staff' });
  expect((await POST(request({ action: 'create_type', code: 'FEE', name: 'Phí' }))).status).toBe(403);
  expect(mockFrom).not.toHaveBeenCalled();
});

it('rejects actor or tenant fields supplied in the body', async () => {
  expect((await POST(request({ action: 'create_type', code: 'FEE', name: 'Phí', tenantId: 'tenant-b' }))).status).toBe(400);
  expect(mockFrom).not.toHaveBeenCalled();
});

it('derives tenant from the authenticated profile for catalog creation', async () => {
  expect((await POST(request({ action: 'create_type', code: 'FEE', name: 'Phí' }))).status).toBe(200);
  expect(insert).toHaveBeenCalledWith({ tenant_id: 'tenant-a', code: 'FEE', display_name: 'Phí' });
});

it('uses the registered adapter for publication and retains duplicate result', async () => {
  jest.mocked(publishFeeProgramVersion).mockResolvedValue({ programVersionId: versionId, status: 'PUBLISHED', duplicate: true });
  const result = await POST(request({ action: 'publish', versionId }));
  expect(result.status).toBe(200);
  expect((await result.json()).data.duplicate).toBe(true);
  expect(publishFeeProgramVersion).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.anything() }), versionId);
  expect(mockFrom).not.toHaveBeenCalled();
});

it('rejects an invalid amount without touching persistence', async () => {
  const result = await POST(request({ action: 'create_item_version', itemId: versionId, typeCode: 'FEE', amount: -1, currency: 'VND' }));
  expect(result.status).toBe(400);
  expect(mockFrom).not.toHaveBeenCalled();
});
