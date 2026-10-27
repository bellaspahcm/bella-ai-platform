import { z } from 'zod';
import type { ExecutiveDashboardDTO } from './preschool-analytics.types';

// Validate the existing read contract at both dashboard consumers. Missing
// metrics remain null; malformed/cross-tenant responses never become UI truth.
const count = z.number().int().nonnegative();
const amount = z.number().nonnegative();
const rate = z.number().min(0).max(100);
const nullableCount = count.nullable();
const dashboardSchema: z.ZodType<ExecutiveDashboardDTO> = z.object({
  tenantId: z.string().min(1), evaluatedAt: z.iso.datetime(),
  enrollment: z.object({ totalEnrolledStudents: count, totalClassrooms: count,
    totalTeachers: nullableCount, classroomUtilization: z.array(z.object({
      classId: z.string().min(1), className: z.string().min(1), currentEnrollment: count,
      maxCapacity: nullableCount, utilizationRate: amount.nullable(), color: z.string().optional(),
    })),
  }),
  attendance: z.object({ todayPresentCount: count, todayAbsentCount: count,
    todayLateCount: nullableCount, presentVsEnrolledRate: rate }),
  careAndSafety: z.object({ activeHealthIncidents: nullableCount, pendingMedicationDoses: nullableCount }),
  learning: z.object({ draftPortfoliosCount: nullableCount, pendingMilestoneReviews: nullableCount }),
  parentEngagement: z.object({ unacknowledgedNotices: nullableCount, pendingConsentRequests: nullableCount }),
  finance: z.object({ invoicedGrossTotal: amount.nullable(), reconciledCashCollected: amount.nullable(),
    outstandingBalanceTotal: amount.nullable(), overdueAccountsCount: nullableCount,
    monthlyRevenue: z.array(z.object({ month: z.string(), yearMonth: z.string(), value: amount,
      highlighted: z.boolean().optional(), tooltip: z.string().optional() })).optional(),
  }),
  workforce: z.object({ activeStaffingViolations: nullableCount, openStaffingExceptions: nullableCount }),
  facilities: z.object({ outOfServiceAssetsCount: nullableCount, outOfServiceZonesCount: nullableCount,
    overdueScheduleCount: nullableCount, openSafetyExceptions: nullableCount }),
  commandCenter: z.object({ unmarkedAttendanceCount: count, leaveRequestsCount: nullableCount,
    overdueInvoicesCount: nullableCount, healthIncidentsCount: nullableCount,
    parentRequestsCount: nullableCount, totalParentsCount: nullableCount }).optional(),
  recentActivities: z.array(z.object({ id: z.string(),
    category: z.enum(['ALL', 'ATTENDANCE', 'LEARNING', 'CARE_NUTRITION', 'PARENT_COMM', 'FINANCE']),
    categoryLabel: z.string(), title: z.string(), description: z.string(), timestamp: z.string(),
    displayTime: z.string(), actorRole: z.string().optional(), status: z.string().optional() })).optional(),
  notices: z.array(z.object({ id: z.string(), title: z.string(), bodyText: z.string(), category: z.string(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']), date: z.string(), displayDate: z.string(),
    dueAt: z.string().nullable().optional(), iconColor: z.string().optional() })).optional(),
  weeklyMenu: z.object({ menuId: z.string(), weekNumber: count, year: count, startDate: z.string(),
    endDate: z.string(), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    days: z.array(z.object({ dayKey: z.enum(['T2', 'T3', 'T4', 'T5', 'T6', 'T7']), dayLabel: z.string(),
      dateStr: z.string(), badgeColor: z.string(), summaryDishes: z.string(), caloriesKcal: amount.optional(),
      meals: z.array(z.object({ mealType: z.enum(['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK']),
        mealTypeLabel: z.string(), dishes: z.array(z.string()) })).optional() })) }).nullable().optional(),
});
const responseSchema = z.object({ success: z.literal(true),
  branches: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  selectedBranchId: z.string().min(1).nullable(), dashboard: dashboardSchema.nullable(),
});

export function parseAnalyticsResponse(body: unknown, tenantId: string, requestedBranch: string | null) {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new Error('ANALYTICS_RESPONSE_INVALID');
  const data = parsed.data;
  if (new Set(data.branches.map(branch => branch.id)).size !== data.branches.length
    || (data.selectedBranchId !== null && !data.branches.some(branch => branch.id === data.selectedBranchId))
    || (requestedBranch === null && data.branches.length > 1 && data.selectedBranchId !== null)
    || (requestedBranch !== null && data.selectedBranchId !== requestedBranch)
    || (data.dashboard !== null && (data.dashboard.tenantId !== tenantId || data.selectedBranchId === null))
    || (data.dashboard === null && data.selectedBranchId !== null)) {
    throw new Error('ANALYTICS_RESPONSE_SCOPE_INVALID');
  }
  return data;
}

export function vietnamDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
