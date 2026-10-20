/**
 * Bella Preschool OS — Parent Portal Domain Types & Contracts
 * File: src/products/bella-education/parent-portal/domain/parent-portal.types.ts
 *
 * Strict Domain Model for the Parent Portal Experience:
 * - Aggregates Classroom Headcount, Attendance, Daily Care, Nutrition, Timetable, Tuition, and Chat.
 * - Zero `any` and zero `unknown` in external interfaces.
 */

export interface ParentPortalTokenClaims {
  readonly tenantId: string;
  readonly guardianPartyId: string;
  readonly studentPartyId: string;
  readonly createdAt: number;
  readonly exp: number;
}

export interface ParentPortalChildProfile {
  readonly studentPartyId: string;
  readonly studentCode: string | null;
  readonly childName: string;
  readonly nickname?: string | null;
  readonly gender?: string | null;
  readonly dob?: string | null;
  readonly avatarUrl?: string | null;
}

export interface ParentPortalClassroomInfo {
  readonly courseId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly teacherName?: string | null;
  readonly roomName?: string | null;
  readonly totalClassSize: number;
  readonly presentTodayCount: number;
  readonly attendanceRatePercent: number;
}

export interface ParentPortalAttendance {
  readonly status: 'present' | 'absent' | 'excused' | 'unmarked';
  readonly rollCallTime?: string | null;
  readonly notes?: string | null;
}

export interface ParentPortalMealRecord {
  readonly mealName: string;
  readonly consumedStatus: string;
  readonly time?: string;
  readonly note?: string;
}

export interface ParentPortalHygieneRecord {
  readonly type: string;
  readonly time?: string;
  readonly condition?: string;
}

export interface ParentPortalNapRecord {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly durationMinutes?: number;
  readonly quality?: string;
}

export interface ParentPortalHealthCheck {
  readonly temperature?: number;
  readonly notes?: string;
  readonly checkedAt?: string;
}

export interface ParentPortalDailyCare {
  readonly arrivalStatus: string | null;
  readonly arrivalTime: string | null;
  readonly morningCondition: string | null;
  readonly mealRecords: readonly ParentPortalMealRecord[];
  readonly hygieneRecords: readonly ParentPortalHygieneRecord[];
  readonly napRecords: ParentPortalNapRecord;
  readonly healthChecks: ParentPortalHealthCheck;
  readonly updatedAt: string | null;
}

export interface ParentPortalHandover {
  readonly handedOver: boolean;
  readonly handedOverAt: string | null;
  readonly handedOverBy: string | null;
  readonly guardianPartyId: string | null;
}

export interface ParentPortalMealDetail {
  readonly mealType: string;
  readonly mealLabel: string;
  readonly dishName: string;
}

export interface ParentPortalWeeklyMenuDay {
  readonly dayKey: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';
  readonly dayLabel: string;
  readonly dateStr: string;
  readonly badgeColor: string;
  readonly summaryDishes: string;
  readonly caloriesKcal: number;
  readonly meals?: readonly ParentPortalMealDetail[];
}

export interface ParentPortalWeeklyMenu {
  readonly menuId: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly days: readonly ParentPortalWeeklyMenuDay[];
}

export type TimetableActivityIcon =
  | 'welcome'
  | 'exercise'
  | 'meal'
  | 'learning'
  | 'outdoor'
  | 'nap'
  | 'play'
  | 'goodbye';

export interface ParentPortalTimetableItem {
  readonly id: string;
  readonly timeSlot: string;
  readonly activityTitle: string;
  readonly description?: string;
  readonly iconType: TimetableActivityIcon;
}

export interface ParentPortalInvoiceLineItem {
  readonly description: string;
  readonly amount: number;
}

export interface ParentPortalVietQrPayload {
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly amount: number;
  readonly description: string;
  readonly qrUrl: string;
}

export interface ParentPortalTuition {
  readonly invoiceId: string;
  readonly invoiceCode: string;
  readonly billingPeriodName: string;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly balanceDue: number;
  readonly dueDate: string;
  readonly status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  readonly lineItems: readonly ParentPortalInvoiceLineItem[];
  readonly vietQrPayload?: ParentPortalVietQrPayload;
}

export interface ParentPortalChatMessage {
  readonly id: string;
  readonly senderRole: 'GUARDIAN' | 'TEACHER' | 'ADMIN';
  readonly senderName: string;
  readonly createdAt: string;
  readonly text: string;
}

export interface ParentPortalDailyDigest {
  readonly title: string;
  readonly digest: string;
  readonly highlights: readonly string[];
  readonly teacherMoodEmoji: string;
  readonly generatedAt: string;
}

export interface ParentPortalPayload {
  readonly tenantId: string;
  readonly schoolName: string;
  readonly schoolLogoUrl?: string | null;
  readonly schoolContactPhone?: string | null;
  readonly schoolAddress?: string | null;
  readonly guardianName: string;
  readonly guardianPhone?: string | null;
  readonly child: ParentPortalChildProfile;
  readonly classroom: ParentPortalClassroomInfo;
  readonly todayAttendance: ParentPortalAttendance;
  readonly dailyCare: ParentPortalDailyCare | null;
  readonly handover: ParentPortalHandover;
  readonly weeklyMenu: ParentPortalWeeklyMenu | null;
  readonly dailyTimetable: readonly ParentPortalTimetableItem[];
  readonly tuition: ParentPortalTuition | null;
  readonly chatMessages: readonly ParentPortalChatMessage[];
  readonly threadId?: string;
  readonly aiDailyDigest?: ParentPortalDailyDigest | null;
  readonly serverTime: string;
}
