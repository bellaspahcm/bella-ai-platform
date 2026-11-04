/** @jest-environment node */
import { beforeEach, expect, it, jest } from '@jest/globals';

const mockGetUser = jest.fn<() => Promise<unknown>>();
const mockGetCurrentUser = jest.fn<() => Promise<unknown>>();
const mockFrom = jest.fn();
const actorId = '00000000-0000-4000-8000-000000000001';
const tenantId = '00000000-0000-4000-8000-000000000002';

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));

const { GET } = require('../threads/route') as typeof import('../threads/route');
const { POST } = require('../messages/route') as typeof import('../messages/route');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'parent' });
});

it('does not read tenant-wide thread metadata while private chat is unavailable', async () => {
  const response = await GET(new Request('http://test/api/education/communication/threads'));
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ success: false, error: 'PRESCHOOL_PRIVATE_CHAT_UNAVAILABLE' });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('does not create or attach a message to a caller supplied thread', async () => {
  mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin_staff' });
  const response = await POST(new Request('http://test/api/education/communication/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: '00000000-0000-4000-8000-000000000099', message: 'Hello' }),
  }));
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ success: false, error: 'PRESCHOOL_PRIVATE_CHAT_UNAVAILABLE' });
  expect(mockFrom).not.toHaveBeenCalled();
});

it('denies mismatched actor profiles before returning the held capability state', async () => {
  mockGetCurrentUser.mockResolvedValueOnce({ id: '00000000-0000-4000-8000-000000000003', tenant_id: tenantId, role: 'admin' });
  const response = await GET(new Request('http://test/api/education/communication/threads'));
  expect(response.status).toBe(403);
  expect(mockFrom).not.toHaveBeenCalled();
});
