import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetUser = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetWeeklyMenu = jest.fn();
const mockListWeeklyMenus = jest.fn();
const mockSaveWeeklyMenu = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-role-key',
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/products/bella-education/care-wellbeing/nutrition/weekly-menu.service', () => ({
  WeeklyMenuService: jest.fn().mockImplementation(() => ({
    getWeeklyMenu: mockGetWeeklyMenu,
    listWeeklyMenus: mockListWeeklyMenus,
    saveWeeklyMenu: mockSaveWeeklyMenu,
  })),
}));

// Import GET and POST from route
const { GET, POST } = require('../route') as typeof import('../route');

describe('Weekly Menu API Route (/api/education/nutrition/weekly-menu)', () => {
  const actorId = '00000000-0000-4000-8000-000000000001';
  const tenantId = '00000000-0000-4000-8000-000000000002';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } } as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('NUTRITION_UNAUTHENTICATED');
    });

    it('returns 403 when user has no active tenant profile', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce(null as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('NUTRITION_ACCESS_DENIED');
    });

    it('returns 200 with menu data when authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockGetWeeklyMenu.mockResolvedValueOnce({
        menuId: 'menu-123',
        weekNumber: 44,
        year: 2026,
        startDate: '2026-10-26',
        endDate: '2026-10-30',
        status: 'PUBLISHED',
        days: [],
      } as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu?weekNumber=44&year=2026');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.menu.menuId).toBe('menu-123');
    });

    it('returns 200 with list of menus when ?list=true', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockListWeeklyMenus.mockResolvedValueOnce([
        { id: 'menu-1', weekNumber: 44, year: 2026, title: 'Tuần 44' },
      ] as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu?list=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.menus).toHaveLength(1);
    });
  });

  describe('POST', () => {
    const validPayload = {
      academicYear: '2026-2027',
      weekNumber: 44,
      year: 2026,
      startDate: '2026-10-26',
      endDate: '2026-10-30',
      ageGroup: 'ALL',
      title: 'Thực đơn tuần 44',
      status: 'PUBLISHED',
      days: [
        {
          dayOfWeek: 'MON',
          menuDate: '2026-10-26',
          summaryDishes: 'Phở bò',
          caloriesKcal: 680,
          mealsPayload: [
            { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò'] },
          ],
        },
      ],
    };

    it('returns 403 when user is not authorized role', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'parent' } as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('NUTRITION_ROLE_DENIED');
    });

    it('returns 400 when payload is invalid', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'body' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('INVALID_MENU_PAYLOAD');
    });

    it('returns 200 when save succeeds', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockSaveWeeklyMenu.mockResolvedValueOnce({
        success: true,
        menuId: 'saved-menu-123',
        message: 'Thành công',
      } as never);

      const request = new Request('http://localhost/api/education/nutrition/weekly-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.menuId).toBe('saved-menu-123');
    });
  });
});

