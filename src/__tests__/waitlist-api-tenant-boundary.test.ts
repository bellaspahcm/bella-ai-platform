import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/waitlist/route';
import { GET as getStats } from '@/app/api/waitlist/stats/route';
import { getCurrentUser } from '@/services/user-actions';
import { getWaitlistEntries, getWaitlistStats, addToWaitlist } from '@/services/waitlist/waitlist-service';

jest.mock('@/services/user-actions', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/services/waitlist/waitlist-service', () => ({
  getWaitlistEntries: jest.fn(), getWaitlistStats: jest.fn(), addToWaitlist: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', tenant_id: 'profile-tenant', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
  jest.mocked(getWaitlistEntries).mockResolvedValue({ entries: [], total: 0, page: 1, limit: 20, total_pages: 0 });
});

it('reads only the profile tenant for a regular admin', async () => {
  const response = await GET(new NextRequest('http://localhost/api/waitlist?tenant_id=profile-tenant'));
  expect(response.status).toBe(200);
  expect(getWaitlistEntries).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'profile-tenant' }));
});

it.each(['dev-tenant', 'another-tenant'])('rejects list and stats for %s before any data read', async tenantId => {
  const request = new NextRequest(`http://localhost/api/waitlist?tenant_id=${tenantId}`);
  expect((await GET(request)).status).toBe(403);
  expect((await getStats(request)).status).toBe(403);
  expect(getWaitlistEntries).not.toHaveBeenCalled();
  expect(getWaitlistStats).not.toHaveBeenCalled();
});

it('still rejects cross-tenant writes', async () => {
  const request = new NextRequest('http://localhost/api/waitlist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: 'another-tenant' }),
  });
  expect((await POST(request)).status).toBe(403);
  expect(addToWaitlist).not.toHaveBeenCalled();
});

it('still rejects unauthenticated requests', async () => {
  jest.mocked(getCurrentUser).mockResolvedValue(null);
  expect((await GET(new NextRequest('http://localhost/api/waitlist?tenant_id=profile-tenant'))).status).toBe(401);
  expect(getWaitlistEntries).not.toHaveBeenCalled();
});
