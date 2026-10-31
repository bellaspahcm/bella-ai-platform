/**
 * BELLA PRESCHOOL OS — NUTRITION & WEEKLY MENU CONTRACT
 *
 * Canonical Contract defining the Weekly Nutrition Menu data models,
 * CRUD input shapes, and institutional meal structures.
 *
 * Source of Truth: PostgreSQL tables `edu_weekly_menus` & `edu_weekly_menu_days`.
 *
 * @module src/products/bella-education/care-wellbeing/nutrition/weekly-menu.contract
 */

import type {
  PreschoolWeeklyMenuDTO,
  PreschoolWeeklyMenuDayDTO,
  PreschoolWeeklyMenuMealItemDTO,
} from '@/products/bella-education/analytics/domain/preschool-analytics.types';

export type {
  PreschoolWeeklyMenuDTO,
  PreschoolWeeklyMenuDayDTO,
  PreschoolWeeklyMenuMealItemDTO,
};

export type WeeklyMenuDayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type WeeklyMenuAgeGroup = 'ALL' | 'NURSERY' | 'TODDLER' | 'KINDY_1' | 'KINDY_2';

export type WeeklyMenuStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type NutritionMealType = 'BREAKFAST' | 'MORNING_SNACK' | 'LUNCH' | 'AFTERNOON_SNACK';

export interface SaveWeeklyMenuDayInput {
  readonly dayOfWeek: WeeklyMenuDayCode;
  readonly menuDate: string; // YYYY-MM-DD
  readonly summaryDishes?: string;
  readonly caloriesKcal?: number;
  readonly mealsPayload: readonly PreschoolWeeklyMenuMealItemDTO[];
}

export interface SaveWeeklyMenuInput {
  readonly menuId?: string;
  readonly academicYear?: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;   // YYYY-MM-DD
  readonly ageGroup?: WeeklyMenuAgeGroup;
  readonly title: string;
  readonly status: WeeklyMenuStatus;
  readonly notes?: string | null;
  readonly days: readonly SaveWeeklyMenuDayInput[];
}

export interface WeeklyMenuSummaryDTO {
  readonly id: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly ageGroup: string;
  readonly title: string;
  readonly status: WeeklyMenuStatus;
  readonly daysCount: number;
  readonly updatedAt: string;
}

export interface SaveWeeklyMenuResult {
  readonly success: boolean;
  readonly menuId: string;
  readonly message?: string;
  readonly error?: string;
}

