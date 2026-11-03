import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaveWeeklyMenuInput } from './weekly-menu.contract';

export interface PersistedWeeklyMenu {
  readonly menuId: string;
  readonly updatedAt: string;
}

/** Caller-bound client only; the RPC is responsible for the final authorization. */
export async function persistWeeklyMenu(
  client: SupabaseClient,
  tenantId: string,
  actorId: string,
  input: SaveWeeklyMenuInput,
): Promise<PersistedWeeklyMenu> {
  const payload: SaveWeeklyMenuInput = {
    ...input,
    days: input.days.map(day => {
      const dishes = day.mealsPayload.flatMap(meal => meal.dishes || [])
        .filter(dish => typeof dish === 'string' && dish.trim().length > 0);
      return { ...day, summaryDishes: day.summaryDishes?.trim() || dishes.slice(0, 4).join(', ') || 'Thực đơn tiêu chuẩn trường' };
    }),
  };
  const { data, error } = await client.rpc('preschool_save_weekly_menu', {
    p_tenant_id: tenantId,
    p_actor_id: actorId,
    p_payload: payload,
  });
  if (error) throw new Error(`WEEKLY_MENU_PERSISTENCE_FAILED: ${error.code ?? 'UNKNOWN'}`);
  const result: unknown = data;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('WEEKLY_MENU_READBACK_INVALID');
  }
  const row = result as Record<string, unknown>;
  if (typeof row.menuId !== 'string' || !row.menuId || typeof row.updatedAt !== 'string'
      || Number.isNaN(Date.parse(row.updatedAt))) throw new Error('WEEKLY_MENU_READBACK_INVALID');
  return { menuId: row.menuId, updatedAt: row.updatedAt };
}
