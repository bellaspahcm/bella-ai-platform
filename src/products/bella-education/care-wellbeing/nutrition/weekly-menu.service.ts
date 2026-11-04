/**
 * BELLA PRESCHOOL OS — WEEKLY NUTRITION MENU SERVICE
 *
 * Provides transactional query and persistence capabilities for weekly meal plans
 * across institution, teacher, and parent portal interfaces.
 *
 * Canonical Source of Truth: `edu_weekly_menus` & `edu_weekly_menu_days`.
 *
 * @module src/products/bella-education/care-wellbeing/nutrition/weekly-menu.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { persistWeeklyMenu } from './weekly-menu.persistence';
import type {
  PreschoolWeeklyMenuDTO,
  PreschoolWeeklyMenuDayDTO,
  PreschoolWeeklyMenuMealItemDTO,
  SaveWeeklyMenuInput,
  SaveWeeklyMenuResult,
  WeeklyMenuSummaryDTO,
  WeeklyMenuDayCode,
} from './weekly-menu.contract';

const DAYS_MAP: Readonly<Record<WeeklyMenuDayCode, { dayKey: PreschoolWeeklyMenuDayDTO['dayKey']; label: string; color: string }>> = {
  MON: { dayKey: 'T2', label: 'Thứ Hai', color: 'bg-sky-400 text-white' },
  TUE: { dayKey: 'T3', label: 'Thứ Ba', color: 'bg-rose-400 text-white' },
  WED: { dayKey: 'T4', label: 'Thứ Tư', color: 'bg-emerald-400 text-white' },
  THU: { dayKey: 'T5', label: 'Thứ Năm', color: 'bg-blue-400 text-white' },
  FRI: { dayKey: 'T6', label: 'Thứ Sáu', color: 'bg-purple-400 text-white' },
  SAT: { dayKey: 'T7', label: 'Thứ Bảy', color: 'bg-amber-400 text-white' },
  SUN: { dayKey: 'T2', label: 'Chủ Nhật', color: 'bg-indigo-400 text-white' },
};

const DAY_ORDER: Readonly<Record<WeeklyMenuDayCode, number>> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

function isWeeklyMenuDayCode(value: unknown): value is WeeklyMenuDayCode {
  return (
    value === 'MON' ||
    value === 'TUE' ||
    value === 'WED' ||
    value === 'THU' ||
    value === 'FRI' ||
    value === 'SAT' ||
    value === 'SUN'
  );
}

function getDayOrder(day: string): number {
  if (isWeeklyMenuDayCode(day)) {
    return DAY_ORDER[day];
  }
  return 99;
}

function getDayMeta(day: string): { dayKey: PreschoolWeeklyMenuDayDTO['dayKey']; label: string; color: string } {
  if (isWeeklyMenuDayCode(day)) {
    return DAYS_MAP[day];
  }
  return DAYS_MAP.MON;
}

interface DbMenuRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly academic_year: string;
  readonly week_number: number;
  readonly year: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly age_group: string;
  readonly title: string;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  readonly notes: string | null;
  readonly updated_at: string;
  readonly edu_weekly_menu_days?: readonly DbMenuDayRow[];
}

interface DbMenuDayRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly menu_id: string;
  readonly day_of_week: string;
  readonly menu_date: string;
  readonly summary_dishes: string;
  readonly calories_kcal: number | null;
  readonly meals_payload: unknown;
}

function formatDateToVn(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const dateObj = new Date(dateStr);
  return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
}

export class WeeklyMenuService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Retrieves a weekly menu matching weekNumber + year, or containing target date, or the latest active menu.
   */
  async getWeeklyMenu(
    tenantId: string,
    options?: {
      weekNumber?: number;
      year?: number;
      date?: string;
      ageGroup?: string;
      includeDrafts?: boolean;
    }
  ): Promise<PreschoolWeeklyMenuDTO | null> {
    try {
      let query = this.supabase
        .from('edu_weekly_menus')
        .select('id, tenant_id, academic_year, week_number, year, start_date, end_date, age_group, title, status, notes, updated_at, edu_weekly_menu_days(*)')
        .eq('tenant_id', tenantId);

      if (options?.weekNumber && options?.year) {
        query = query.eq('week_number', options.weekNumber).eq('year', options.year);
      } else if (options?.date) {
        query = query.lte('start_date', options.date).gte('end_date', options.date);
      } else {
        query = query.order('year', { ascending: false }).order('week_number', { ascending: false }).limit(1);
      }

      if (options?.ageGroup && options.ageGroup !== 'ALL') {
        query = query.eq('age_group', options.ageGroup);
      }

      if (!options?.includeDrafts) {
        query = query.neq('status', 'ARCHIVED');
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw new Error('WEEKLY_MENU_READ_FAILED');
      if (!data) {
        return null;
      }

      const menuRow = data as DbMenuRow;
      const rawDays = Array.isArray(menuRow.edu_weekly_menu_days) ? menuRow.edu_weekly_menu_days : [];

      const sortedDays: PreschoolWeeklyMenuDayDTO[] = [...rawDays]
        .sort((a, b) => getDayOrder(a.day_of_week) - getDayOrder(b.day_of_week))
        .map((d) => {
          const dayMeta = getDayMeta(d.day_of_week);
          const meals = Array.isArray(d.meals_payload) ? (d.meals_payload as PreschoolWeeklyMenuMealItemDTO[]) : [];
          return {
            dayKey: dayMeta.dayKey,
            dayLabel: dayMeta.label,
            dateStr: formatDateToVn(d.menu_date),
            badgeColor: dayMeta.color,
            summaryDishes: d.summary_dishes,
            caloriesKcal: d.calories_kcal ?? 680,
            meals,
          };
        });

      return {
        menuId: menuRow.id,
        updatedAt: menuRow.updated_at,
        weekNumber: menuRow.week_number,
        year: menuRow.year,
        startDate: menuRow.start_date,
        endDate: menuRow.end_date,
        status: menuRow.status,
        title: menuRow.title,
        ageGroup: menuRow.age_group,
        notes: menuRow.notes,
        academicYear: menuRow.academic_year,
        days: sortedDays,
      };
    } catch (err) {
      console.warn('[WeeklyMenuService] Failed to load weekly menu:', err);
      throw err;
    }
  }

  /**
   * Lists weekly menus for the tenant with summary metrics.
   */
  async listWeeklyMenus(
    tenantId: string,
    options?: {
      year?: number;
      ageGroup?: string;
      limit?: number;
    }
  ): Promise<WeeklyMenuSummaryDTO[]> {
    try {
      let query = this.supabase
        .from('edu_weekly_menus')
        .select('id, week_number, year, start_date, end_date, age_group, title, status, updated_at, edu_weekly_menu_days(id)')
        .eq('tenant_id', tenantId)
        .order('year', { ascending: false })
        .order('week_number', { ascending: false })
        .limit(options?.limit ?? 20);

      if (options?.year) {
        query = query.eq('year', options.year);
      }

      if (options?.ageGroup && options.ageGroup !== 'ALL') {
        query = query.eq('age_group', options.ageGroup);
      }

      const { data, error } = await query;
      if (error) throw new Error('WEEKLY_MENU_LIST_FAILED');
      if (!data) {
        return [];
      }

      return (data as Array<{
        id: string;
        week_number: number;
        year: number;
        start_date: string;
        end_date: string;
        age_group: string;
        title: string;
        status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
        updated_at: string;
        edu_weekly_menu_days?: readonly { id: string }[];
      }>).map((row) => ({
        id: row.id,
        weekNumber: row.week_number,
        year: row.year,
        startDate: row.start_date,
        endDate: row.end_date,
        ageGroup: row.age_group,
        title: row.title,
        status: row.status,
        daysCount: Array.isArray(row.edu_weekly_menu_days) ? row.edu_weekly_menu_days.length : 0,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.warn('[WeeklyMenuService] Failed to list weekly menus:', err);
      throw err;
    }
  }

  /**
   * Persists weekly menu and granular daily breakdowns atomically.
   */
  async saveWeeklyMenu(
    tenantId: string,
    actorId: string,
    input: SaveWeeklyMenuInput
  ): Promise<SaveWeeklyMenuResult> {
    // 1. Validation
    if (!tenantId) return { success: false, menuId: '', error: 'TENANT_REQUIRED' };
    if (!input.title || input.title.trim().length === 0) {
      return { success: false, menuId: '', error: 'TITLE_REQUIRED' };
    }
    if (!input.weekNumber || input.weekNumber < 1 || input.weekNumber > 53) {
      return { success: false, menuId: '', error: 'INVALID_WEEK_NUMBER' };
    }
    if (!input.year || input.year < 2020 || input.year > 2050) {
      return { success: false, menuId: '', error: 'INVALID_YEAR' };
    }
    if (!input.startDate || !input.endDate) {
      return { success: false, menuId: '', error: 'DATES_REQUIRED' };
    }
    if (!Array.isArray(input.days) || input.days.length === 0) {
      return { success: false, menuId: '', error: 'DAYS_REQUIRED' };
    }

    if (input.menuId && !input.expectedUpdatedAt) {
      return { success: false, menuId: '', error: 'WEEKLY_MENU_VERSION_REQUIRED' };
    }

    try {
      const saved = await persistWeeklyMenu(this.supabase, tenantId, actorId, input);
      return {
        success: true,
        menuId: saved.menuId,
        updatedAt: saved.updatedAt,
        message: input.status === 'PUBLISHED' ? 'Thực đơn tuần đã được ban hành thành công.' : 'Lưu dự thảo thực đơn tuần thành công.',
      };
    } catch (err) {
      console.error('[WeeklyMenuService] Exception while saving weekly menu:', err);
      return {
        success: false,
        menuId: '',
        error: err instanceof Error ? err.message : 'UNEXPECTED_ERROR',
      };
    }
  }
}
