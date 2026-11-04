import type { SupabaseClient } from '@supabase/supabase-js';
import { persistWeeklyMenu } from '../weekly-menu.persistence';
import type { SaveWeeklyMenuInput } from '../weekly-menu.contract';

const input: SaveWeeklyMenuInput = {
  title: 'Menu', weekNumber: 1, year: 2026, startDate: '2026-01-05', endDate: '2026-01-11',
  status: 'DRAFT', days: [{ dayOfWeek: 'MON', menuDate: '2026-01-05', mealsPayload: [] }],
};

it('uses the declared RPC and validates its persisted result', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: { menuId: 'menu-1', updatedAt: '2026-01-05T00:00:00Z' }, error: null });
  const result = await persistWeeklyMenu({ rpc } as unknown as SupabaseClient, 'tenant', 'actor', input);
  expect(rpc).toHaveBeenCalledWith('preschool_save_weekly_menu', {
    p_tenant_id: 'tenant', p_actor_id: 'actor',
    p_payload: { ...input, days: [{ ...input.days[0], summaryDishes: 'Thực đơn tiêu chuẩn trường' }] },
  });
  expect(result).toEqual({ menuId: 'menu-1', updatedAt: '2026-01-05T00:00:00Z' });
});

it('does not claim success when the RPC is unavailable or returns malformed data', async () => {
  const rpc = jest.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
    .mockResolvedValueOnce({ data: { menuId: 'menu-1' }, error: null });
  const client = { rpc } as unknown as SupabaseClient;
  await expect(persistWeeklyMenu(client, 'tenant', 'actor', input)).rejects.toThrow('WEEKLY_MENU_PERSISTENCE_FAILED: PGRST202');
  await expect(persistWeeklyMenu(client, 'tenant', 'actor', input)).rejects.toThrow('WEEKLY_MENU_READBACK_INVALID');
});
