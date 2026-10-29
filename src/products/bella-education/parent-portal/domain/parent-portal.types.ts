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
  readonly scope?: 'daily_read_v1';
  readonly courseId?: string;
}

export interface PortalIssuerContext {
  readonly tenantId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly guardians: readonly { readonly guardianPartyId: string; readonly guardianLabel: string }[];
}

export interface ParentPortalAnnouncement {
  readonly id: string;
  readonly title: string;
  readonly bodyText: string;
  readonly publishedAt: string;
}

export interface ParentPortalAnnouncementFeed {
  readonly tenantId: string;
  readonly announcements: readonly ParentPortalAnnouncement[];
}

/** Deliberately excludes unavailable care, payment, pickup and communication data. */
export interface ParentPortalDailyRead {
  readonly scope: 'daily_read_v1';
  readonly tenantId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly schoolName: string;
  readonly guardianName: string;
  readonly childName: string;
  readonly courseTitle: string;
  readonly courseCode: string;
  readonly schoolDay: string;
  readonly attendanceStatus: 'present' | 'absent' | 'excused' | 'unmarked';
  readonly attendanceUpdatedAt: string | null;
  readonly totalClassSize: number;
  readonly presentTodayCount: number;
  readonly announcements: readonly ParentPortalAnnouncement[];
  readonly serverTime: string;
}

const portalRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const portalText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const isPortalUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function isParentPortalAnnouncementFeed(value: unknown): value is ParentPortalAnnouncementFeed {
  return portalRecord(value) && isPortalUuid(value.tenantId) && Array.isArray(value.announcements)
    && value.announcements.length <= 100
    && value.announcements.every(item => portalRecord(item) && isPortalUuid(item.id)
      && portalText(item.title) && item.title.length <= 200
      && portalText(item.bodyText) && item.bodyText.length <= 20000
      && typeof item.publishedAt === 'string' && Number.isFinite(Date.parse(item.publishedAt)));
}

export function isPortalIssuerContext(value: unknown): value is PortalIssuerContext {
  return portalRecord(value) && isPortalUuid(value.tenantId) && isPortalUuid(value.courseId)
    && isPortalUuid(value.studentPartyId) && Array.isArray(value.guardians)
    && value.guardians.length > 0 && value.guardians.length <= 100
    && value.guardians.every(g => portalRecord(g) && isPortalUuid(g.guardianPartyId) && portalText(g.guardianLabel))
    && new Set(value.guardians.map(g => g.guardianPartyId)).size === value.guardians.length;
}

export function isParentPortalDailyRead(value: unknown): value is ParentPortalDailyRead {
  if (!portalRecord(value) || value.scope !== 'daily_read_v1'
    || !['tenantId', 'courseId', 'studentPartyId', 'guardianPartyId'].every(key => isPortalUuid(value[key]))
    || !['schoolName', 'guardianName', 'childName', 'courseTitle', 'courseCode'].every(key => portalText(value[key]))
    || typeof value.schoolDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.schoolDay)
    || typeof value.attendanceStatus !== 'string' || !['present', 'absent', 'excused', 'unmarked'].includes(value.attendanceStatus)
    || !(value.attendanceUpdatedAt === null || (typeof value.attendanceUpdatedAt === 'string' && Number.isFinite(Date.parse(value.attendanceUpdatedAt))))
    || typeof value.serverTime !== 'string' || !Number.isFinite(Date.parse(value.serverTime))
    || typeof value.totalClassSize !== 'number' || !Number.isSafeInteger(value.totalClassSize) || value.totalClassSize < 1
    || typeof value.presentTodayCount !== 'number' || !Number.isSafeInteger(value.presentTodayCount)
    || value.presentTodayCount < 0 || value.presentTodayCount > value.totalClassSize
    || !isParentPortalAnnouncementFeed({ tenantId: value.tenantId, announcements: value.announcements })) return false;
  return true;
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
  readonly totalClassSize: number | null;
  readonly presentTodayCount: number | null;
  readonly attendanceRatePercent: number | null;
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
  readonly napRecords: ParentPortalNapRecord | null;
  readonly healthChecks: ParentPortalHealthCheck | null;
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
  readonly caloriesKcal: number | null;
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
  readonly invoiceCode: string | null;
  readonly billingPeriodName: string | null;
  readonly totalAmount: number;
  readonly amountPaid: number;
  readonly balanceDue: number;
  readonly dueDate: string | null;
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
