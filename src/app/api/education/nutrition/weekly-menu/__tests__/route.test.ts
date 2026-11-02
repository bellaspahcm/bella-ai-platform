/** @jest-environment node */
import { beforeEach, expect, it, jest, describe } from '@jest/globals';

const mockGetUser = jest.fn<() => Promise<unknown>>();
const mockGetCurrentUser = jest.fn<() => Promise<unknown>>();

const mockFrom = jest.fn((table: string) => {
  const query: Record<string, unknown> = {};
  query.select = jest.fn().mockReturnValue(query);
  query.eq = jest.fn().mockReturnValue(query);
  query.insert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: { id: 'menu-1' }, error: null }),
    }),
  });
  query.update = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: { id: 'menu-1' }, error: null }),
        }),
      }),
    }),
  });
  query.upsert = jest.fn<() => Promise<unknown>>().mockResolvedValue({ error: null });
  query.maybeSingle = jest.fn<() => Promise<unknown>>().mockResolvedValue({ data: null, error: null });
  query.delete = jest.fn().mockReturnValue(query);
  query.not = jest.fn<() => Promise<unknown>>().mockResolvedValue({ error: null });
  return query;
});

jest.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => null,
  getSupabaseAdminKey: () => null,
}));

const { POST } = require('../route') as typeof import('../route');

describe('Weekly Menu Nutrition API Security & Authorization (F05)', () => {
  const actorId = '00000000-0000-0000-0000-000000000001';
  const tenantId = '00000000-0000-0000-0000-000000000002';

  const validMenuPayload = {
    title: 'Thực đơn tuần 45',
    weekNumber: 45,
    year: 2026,
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    ageGroup: 'ALL',
    status: 'DRAFT',
    days: [
      {
        dayOfWeek: 'MON',
        menuDate: '2026-11-02',
        summaryDishes: 'Phở bò',
        caloriesKcal: 680,
        mealsPayload: [],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  });

  it('F05: rejects teacher attempting to create or edit school-wide weekly menu', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'teacher' });
    const req = new Request('http://localhost/api/education/nutrition/weekly-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validMenuPayload),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('NUTRITION_ROLE_DENIED');
  });

  it('F05: rejects non-admin staff attempting to publish weekly menu', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'admin_staff' });
    const req = new Request('http://localhost/api/education/nutrition/weekly-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validMenuPayload, status: 'PUBLISHED' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('NUTRITION_PUBLISH_FORBIDDEN');
  });

  it('F05: allows admin to publish school-wide weekly menu', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'admin' });
    const req = new Request('http://localhost/api/education/nutrition/weekly-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validMenuPayload, status: 'PUBLISHED' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
