import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { WeeklyMenuService } from '../weekly-menu.service';
import type { SaveWeeklyMenuInput } from '../weekly-menu.contract';

describe('WeeklyMenuService', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const actorId = '00000000-0000-4000-8000-000000000002';

  const mockMenuRow = {
    id: 'menu-uuid-1',
    tenant_id: tenantId,
    academic_year: '2026-2027',
    week_number: 44,
    year: 2026,
    start_date: '2026-10-26',
    end_date: '2026-10-30',
    age_group: 'ALL',
    title: 'Thực đơn tuần 44',
    status: 'PUBLISHED' as const,
    notes: 'Thực đơn chuẩn Kcal',
    updated_at: '2026-10-26T00:00:00Z',
    edu_weekly_menu_days: [
      {
        id: 'day-2',
        tenant_id: tenantId,
        menu_id: 'menu-uuid-1',
        day_of_week: 'TUE',
        menu_date: '2026-10-27',
        summary_dishes: 'Cơm cá hồi',
        calories_kcal: 700,
        meals_payload: [
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa', dishes: ['Cơm cá hồi', 'Canh rau cải'] },
        ],
      },
      {
        id: 'day-1',
        tenant_id: tenantId,
        menu_id: 'menu-uuid-1',
        day_of_week: 'MON',
        menu_date: '2026-10-26',
        summary_dishes: 'Phở bò',
        calories_kcal: 680,
        meals_payload: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò'] },
        ],
      },
    ],
  };

  let mockSupabase: unknown;
  let service: WeeklyMenuService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeeklyMenu', () => {
    it('returns parsed and sorted days when menu is found', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn<() => Promise<{ data: unknown; error: null }>>().mockResolvedValue({
          data: mockMenuRow,
          error: null,
        }),
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      service = new WeeklyMenuService(mockSupabase as never);

      const result = await service.getWeeklyMenu(tenantId, { weekNumber: 44, year: 2026 });

      expect(result).not.toBeNull();
      expect(result?.menuId).toBe('menu-uuid-1');
      expect(result?.weekNumber).toBe(44);
      expect(result?.status).toBe('PUBLISHED');
      // Must sort MON before TUE
      expect(result?.days[0].dayKey).toBe('T2');
      expect(result?.days[0].dayLabel).toBe('Thứ Hai');
      expect(result?.days[0].summaryDishes).toBe('Phở bò');
      expect(result?.days[1].dayKey).toBe('T3');
      expect(result?.days[1].dayLabel).toBe('Thứ Ba');
    });

    it('returns null when menu is not found', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      service = new WeeklyMenuService(mockSupabase as never);

      const result = await service.getWeeklyMenu(tenantId, { weekNumber: 50, year: 2026 });
      expect(result).toBeNull();
    });
  });

  describe('saveWeeklyMenu', () => {
    const validInput: SaveWeeklyMenuInput = {
      academicYear: '2026-2027',
      weekNumber: 44,
      year: 2026,
      startDate: '2026-10-26',
      endDate: '2026-10-30',
      title: 'Thực đơn tuần 44',
      status: 'PUBLISHED',
      notes: 'Thực đơn dinh dưỡng mùa thu',
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

    it('validates required fields', async () => {
      service = new WeeklyMenuService({} as never);

      const resNoTenant = await service.saveWeeklyMenu('', actorId, validInput);
      expect(resNoTenant.success).toBe(false);
      expect(resNoTenant.error).toBe('TENANT_REQUIRED');

      const resNoTitle = await service.saveWeeklyMenu(tenantId, actorId, { ...validInput, title: '' });
      expect(resNoTitle.success).toBe(false);
      expect(resNoTitle.error).toBe('TITLE_REQUIRED');

      const resBadWeek = await service.saveWeeklyMenu(tenantId, actorId, { ...validInput, weekNumber: 99 });
      expect(resBadWeek.success).toBe(false);
      expect(resBadWeek.error).toBe('INVALID_WEEK_NUMBER');
    });

    it('inserts a new weekly menu and upserts day items', async () => {
      const mockDaysUpsert = jest.fn<() => Promise<{ error: null }>>().mockResolvedValue({ error: null });
      const mockInsertSingle = jest.fn<() => Promise<{ data: { id: string }; error: null }>>().mockResolvedValue({
        data: { id: 'created-menu-uuid' },
        error: null,
      });

      const mockFrom = jest.fn((table: string) => {
        if (table === 'edu_weekly_menus') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: mockInsertSingle,
              }),
            }),
          };
        }
        if (table === 'edu_weekly_menu_days') {
          return {
            upsert: mockDaysUpsert,
          };
        }
        return {};
      });

      mockSupabase = { from: mockFrom };
      service = new WeeklyMenuService(mockSupabase as never);

      const result = await service.saveWeeklyMenu(tenantId, actorId, validInput);

      expect(result.success).toBe(true);
      expect(result.menuId).toBe('created-menu-uuid');
      expect(mockDaysUpsert).toHaveBeenCalledTimes(1);
    });
  });
});

