import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { WeeklyMenuService } from '@/products/bella-education/care-wellbeing/nutrition/weekly-menu.service';
import type {
  SaveWeeklyMenuInput,
  SaveWeeklyMenuDayInput,
  WeeklyMenuDayCode,
  WeeklyMenuAgeGroup,
  WeeklyMenuStatus,
  PreschoolWeeklyMenuMealItemDTO,
} from '@/products/bella-education/care-wellbeing/nutrition/weekly-menu.contract';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

function createOperationClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;
  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isWeeklyMenuDayCode(val: unknown): val is WeeklyMenuDayCode {
  return val === 'MON' || val === 'TUE' || val === 'WED' || val === 'THU' || val === 'FRI' || val === 'SAT' || val === 'SUN';
}

function isWeeklyMenuAgeGroup(val: unknown): val is WeeklyMenuAgeGroup {
  return val === 'ALL' || val === 'NURSERY' || val === 'TODDLER' || val === 'KINDY_1' || val === 'KINDY_2';
}

function isWeeklyMenuStatus(val: unknown): val is WeeklyMenuStatus {
  return val === 'DRAFT' || val === 'PUBLISHED' || val === 'ARCHIVED';
}

function isMealItemDTO(val: unknown): val is PreschoolWeeklyMenuMealItemDTO {
  if (!val || typeof val !== 'object') return false;
  const item = val as Record<string, unknown>;
  const validMealType =
    item.mealType === 'BREAKFAST' ||
    item.mealType === 'MORNING_SNACK' ||
    item.mealType === 'LUNCH' ||
    item.mealType === 'AFTERNOON_SNACK';
  const validLabel = typeof item.mealTypeLabel === 'string';
  const validDishes = Array.isArray(item.dishes) && item.dishes.every((d) => typeof d === 'string');
  return validMealType && validLabel && validDishes;
}

function isSaveDayInput(val: unknown): val is SaveWeeklyMenuDayInput {
  if (!val || typeof val !== 'object') return false;
  const day = val as Record<string, unknown>;
  if (!isWeeklyMenuDayCode(day.dayOfWeek)) return false;
  if (typeof day.menuDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.menuDate)) return false;
  if (day.summaryDishes !== undefined && typeof day.summaryDishes !== 'string') return false;
  if (day.caloriesKcal !== undefined && typeof day.caloriesKcal !== 'number') return false;
  if (!Array.isArray(day.mealsPayload) || !day.mealsPayload.every(isMealItemDTO)) return false;
  return true;
}

function isSaveMenuInput(val: unknown): val is SaveWeeklyMenuInput {
  if (!val || typeof val !== 'object') return false;
  const menu = val as Record<string, unknown>;
  if (typeof menu.title !== 'string' || menu.title.trim().length === 0) return false;
  if (typeof menu.weekNumber !== 'number' || menu.weekNumber < 1 || menu.weekNumber > 53) return false;
  if (typeof menu.year !== 'number' || menu.year < 2020 || menu.year > 2050) return false;
  if (typeof menu.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(menu.startDate)) return false;
  if (typeof menu.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(menu.endDate)) return false;
  if (!isWeeklyMenuStatus(menu.status)) return false;
  if (menu.ageGroup !== undefined && !isWeeklyMenuAgeGroup(menu.ageGroup)) return false;
  if (menu.menuId !== undefined && typeof menu.menuId !== 'string') return false;
  if (menu.notes !== undefined && menu.notes !== null && typeof menu.notes !== 'string') return false;
  if (!Array.isArray(menu.days) || menu.days.length === 0 || !menu.days.every(isSaveDayInput)) return false;
  return true;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('NUTRITION_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('NUTRITION_ACCESS_DENIED', 403);
    }

    const opClient = createOperationClient() ?? client;
    const service = new WeeklyMenuService(opClient);

    const { searchParams } = new URL(request.url);
    const listMode = searchParams.get('list') === 'true';
    const yearParam = searchParams.get('year');
    const weekParam = searchParams.get('weekNumber') || searchParams.get('week');
    const dateParam = searchParams.get('date');
    const ageGroupParam = searchParams.get('ageGroup');

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const weekNumber = weekParam ? parseInt(weekParam, 10) : undefined;

    if (listMode) {
      const menus = await service.listWeeklyMenus(tenantId, {
        year,
        ageGroup: ageGroupParam || undefined,
        limit: 30,
      });
      return NextResponse.json({ success: true, menus }, { headers: PRIVATE_HEADERS });
    }

    const menu = await service.getWeeklyMenu(tenantId, {
      year,
      weekNumber,
      date: dateParam || undefined,
      ageGroup: ageGroupParam || undefined,
      includeDrafts: true,
    });

    return NextResponse.json({ success: true, menu }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    console.error('[API WeeklyMenu GET Error]:', err);
    return failure('WEEKLY_MENU_FETCH_FAILED', 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('NUTRITION_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('NUTRITION_ACCESS_DENIED', 403);
    }

    const role = profile.role?.trim().toLowerCase();
    if (role !== 'admin' && role !== 'admin_staff' && role !== 'teacher') {
      return failure('NUTRITION_ROLE_DENIED', 403);
    }

    const body: unknown = await request.json();
    if (!isSaveMenuInput(body)) {
      return failure('INVALID_MENU_PAYLOAD', 400);
    }

    const opClient = createOperationClient() ?? client;
    const service = new WeeklyMenuService(opClient);

    const result = await service.saveWeeklyMenu(tenantId, user.id, body);
    if (!result.success) {
      return failure(result.error || 'SAVE_MENU_FAILED', 400);
    }

    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (err) {
    console.error('[API WeeklyMenu POST Error]:', err);
    return failure('WEEKLY_MENU_SAVE_FAILED', 500);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  return POST(request);
}

