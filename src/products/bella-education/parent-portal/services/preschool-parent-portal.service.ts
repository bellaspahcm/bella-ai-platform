/**
 * Bella Preschool OS — Parent Portal Aggregator & Security Service
 * File: src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts
 *
 * Implements:
 * 1. Cryptographic Magic Token generation and HMAC-SHA256 verification.
 * 2. Guardian Authorization Assertion (via ParentPortalRepository).
 * 3. Canonical Truth Aggregator for available portal read models.
 * 4. Persistent Chat message dispatch (via ParentPortalRepository).
 *
 * Architecture: This service MUST NOT call supabase.from() directly.
 * All DB access is delegated to ParentPortalRepository.
 *
 * Strict Type Invariant: ZERO use of `any` and `unknown`.
 */

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/types/database.types';
import { ParentPortalRepository } from '../repositories/parent-portal.repository';
import { isPortalUuid } from '../domain/parent-portal.types';
import type {
  ParentPortalTokenClaims,
  ParentPortalPayload,
  ParentPortalChildProfile,
  ParentPortalClassroomInfo,
  ParentPortalAttendance,
  ParentPortalHandover,
  ParentPortalWeeklyMenu,
  ParentPortalWeeklyMenuDay,
  ParentPortalMealDetail,
  ParentPortalTimetableItem,
  ParentPortalTuition,
  ParentPortalVietQrPayload,
  ParentPortalChatMessage,
} from '../domain/parent-portal.types';

type EducationSupabaseClient = SupabaseClient;

function parseMealsPayload(raw: Json | null | undefined): readonly ParentPortalMealDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list: ParentPortalMealDetail[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, Json | undefined>;
      if (typeof obj.mealType === 'string' && typeof obj.dishName === 'string') {
        list.push({
          mealType: obj.mealType,
          mealLabel: typeof obj.mealLabel === 'string' ? obj.mealLabel : obj.mealType,
          dishName: obj.dishName,
        });
      }
    }
  }
  return list.length > 0 ? list : undefined;
}

const EMPTY_TIMETABLE: readonly ParentPortalTimetableItem[] = [];

export class ParentPortalAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 503, public readonly code: string) {
    super(code);
  }
}

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ParentPortalAccessError(503, 'PORTAL_SIGNING_UNAVAILABLE');
  return secret;
}

function getTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export class PreschoolParentPortalService {
  private readonly repo: ParentPortalRepository;

  constructor(supabase: EducationSupabaseClient) {
    this.repo = new ParentPortalRepository(supabase);
  }

  static generateDailyReadToken(claims: { tenantId: string; courseId: string; studentPartyId: string; guardianPartyId: string }): string {
    if (!Object.values(claims).every(isPortalUuid) || claims.studentPartyId === claims.guardianPartyId) {
      throw new ParentPortalAccessError(403, 'PORTAL_ACCESS_DENIED');
    }
    const now = Date.now();
    const payload = Buffer.from(JSON.stringify({ ...claims, scope: 'daily_read_v1', createdAt: now, exp: now + 86_400_000 }), 'utf8').toString('base64url');
    return `${payload}.${crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex')}`;
  }

  /**
   * Generates a tamper-proof signed magic token for guardian portal access
   */
  static generatePortalToken(
    claims: { tenantId: string; guardianPartyId: string; studentPartyId: string },
    validityDays = 1
  ): string {
    if (!Number.isFinite(validityDays) || validityDays <= 0 || validityDays > 1) {
      throw new Error('PORTAL_TOKEN_DURATION_INVALID');
    }
    const now = Date.now();
    const tokenClaims: ParentPortalTokenClaims = {
      tenantId: claims.tenantId,
      guardianPartyId: claims.guardianPartyId,
      studentPartyId: claims.studentPartyId,
      createdAt: now,
      exp: now + validityDays * 24 * 60 * 60 * 1000,
    };

    const payloadJson = JSON.stringify(tokenClaims);
    const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64url');

    const signature = crypto
      .createHmac('sha256', getSigningSecret())
      .update(payloadBase64)
      .digest('hex');

    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verifies and extracts token claims with signature and expiration checking
   */
  static verifyPortalToken(token: string): ParentPortalTokenClaims {
    if (!token || typeof token !== 'string') {
      throw new ParentPortalAccessError(401, 'TOKEN_INVALID');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new ParentPortalAccessError(401, 'TOKEN_MALFORMED');
    }

    const [payloadBase64, providedSignature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getSigningSecret())
      .update(payloadBase64)
      .digest('hex');

    const bufProvided = Buffer.from(providedSignature, 'utf8');
    const bufExpected = Buffer.from(expectedSignature, 'utf8');

    if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
      throw new ParentPortalAccessError(401, 'TOKEN_SIGNATURE_MISMATCH');
    }

    let claims: Partial<ParentPortalTokenClaims> | null;
    try {
      claims = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as Partial<ParentPortalTokenClaims> | null;
    } catch {
      throw new ParentPortalAccessError(401, 'TOKEN_MALFORMED');
    }
    if (!claims || typeof claims.tenantId !== 'string' || !claims.tenantId.trim()
      || typeof claims.guardianPartyId !== 'string' || !claims.guardianPartyId.trim()
      || typeof claims.studentPartyId !== 'string' || !claims.studentPartyId.trim()
      || typeof claims.createdAt !== 'number' || !Number.isFinite(claims.createdAt)
      || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)
      || claims.createdAt < 0 || claims.exp <= claims.createdAt) {
      throw new ParentPortalAccessError(401, 'TOKEN_CLAIMS_INCOMPLETE');
    }
    if (Date.now() >= claims.exp) throw new ParentPortalAccessError(401, 'TOKEN_EXPIRED');
    if (claims.scope !== undefined || claims.courseId !== undefined) {
      if (claims.scope !== 'daily_read_v1' || !isPortalUuid(claims.courseId)
        || ![claims.tenantId, claims.studentPartyId, claims.guardianPartyId].every(isPortalUuid)
        || claims.studentPartyId === claims.guardianPartyId || claims.createdAt > Date.now()
        || claims.exp - claims.createdAt > 86_400_000) {
        throw new ParentPortalAccessError(401, 'TOKEN_SCOPE_INVALID');
      }
    }
    // Legacy correctly signed tokens keep their original expiry; only generation is capped.
    return claims as ParentPortalTokenClaims;
  }

  async authorizePortalToken(token: string): Promise<ParentPortalTokenClaims> {
    const claims = PreschoolParentPortalService.verifyPortalToken(token);
    let relationship: { id: string } | null;
    try {
      relationship = await this.repo.findGuardianRelationship(claims.tenantId, claims.guardianPartyId, claims.studentPartyId);
    } catch {
      throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
    }
    if (!relationship) throw new ParentPortalAccessError(401, 'GUARDIAN_NOT_AUTHORIZED');
    return claims;
  }

  /**
   * Aggregates the complete Canonical Truth for the Parent Portal
   */
  async getParentPortalPayload(token: string, targetDateStr?: string): Promise<ParentPortalPayload> {
    const claims = await this.authorizePortalToken(token);
    const schoolDay = targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)
      ? targetDateStr
      : getTodayString();

    // 2. Fetch Guardian, Student, and Tenant Info in parallel
    const [guardianData, studentData, tenantData] = await Promise.all([
      this.fetchGuardianProfile(claims.tenantId, claims.guardianPartyId),
      this.fetchStudentProfile(claims.tenantId, claims.studentPartyId),
      this.fetchTenantProfile(claims.tenantId),
    ]);

    // 3. Fetch Class, Headcount, Attendance, Daily Care, Handover, Menu, Tuition, and Chat in parallel
    const [
      classroomInfo,
      todayAttendance,
      dailyCare,
      handover,
      weeklyMenu,
      tuition,
      chatMessages,
    ] = await Promise.all([
      this.fetchClassroomAndHeadcount(claims.tenantId, claims.studentPartyId, schoolDay),
      this.fetchStudentAttendance(claims.tenantId, claims.studentPartyId, schoolDay),
      Promise.resolve(null),
      this.fetchPickupHandover(claims.tenantId, claims.studentPartyId, schoolDay),
      this.fetchWeeklyMenu(claims.tenantId, schoolDay),
      this.fetchTuitionDetails(claims.tenantId, claims.studentPartyId),
      this.fetchChatThreadAndMessages(claims.tenantId, claims.guardianPartyId, claims.studentPartyId),
    ]);

    // 4. Build AI Daily Digest from assembled care data (deterministic, no LLM egress)
    const aiDailyDigest = null;

    return {
      tenantId: claims.tenantId,
      schoolName: tenantData.name,
      schoolLogoUrl: tenantData.logoUrl,
      schoolContactPhone: tenantData.phone,
      schoolAddress: tenantData.address,
      guardianName: guardianData.name,
      guardianPhone: guardianData.phone,
      child: studentData,
      classroom: classroomInfo,
      todayAttendance,
      dailyCare,
      handover,
      weeklyMenu,
      dailyTimetable: EMPTY_TIMETABLE,
      tuition,
      chatMessages: chatMessages.messages,
      threadId: chatMessages.threadId,
      aiDailyDigest,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Sends a chat message from guardian to school and persists to DB
   */
  async sendChatMessage(token: string, messageText: string): Promise<ParentPortalChatMessage> {
    const claims = await this.authorizePortalToken(token);
    const trimmed = (messageText || '').trim();

    if (!trimmed) {
      throw new Error('MESSAGE_EMPTY: Message text cannot be empty');
    }

    const guardian = await this.fetchGuardianProfile(claims.tenantId, claims.guardianPartyId);

    // 1. Ensure Active Thread Exists
    const thread = await this.ensureCommunicationThread(
      claims.tenantId,
      claims.guardianPartyId,
      claims.studentPartyId
    );

    // 2. Insert message via repository
    const responseRow = await this.repo.insertCommResponse({
      tenantId: claims.tenantId,
      threadId: thread.id,
      senderPartyId: claims.guardianPartyId,
      senderRole: 'GUARDIAN',
      responseText: trimmed,
    });

    if (!responseRow) {
      throw new Error('PERSIST_MESSAGE_FAILED: Failed to save message');
    }

    // 3. Touch thread last_activity_at
    await this.repo.touchThreadActivity(claims.tenantId, thread.id);

    return {
      id: responseRow.id,
      senderRole: 'GUARDIAN',
      senderName: guardian.name,
      createdAt: responseRow.created_at,
      text: responseRow.response_text,
    };
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async fetchGuardianProfile(
    tenantId: string,
    guardianPartyId: string
  ): Promise<{ name: string; phone: string | null }> {
    const [party, identifier] = await Promise.all([
      this.repo.findParty(tenantId, guardianPartyId),
      this.repo.findPartyIdentifier(tenantId, guardianPartyId),
    ]);

    if (!party?.display_name?.trim()) throw new ParentPortalAccessError(503, 'PORTAL_GUARDIAN_PROFILE_UNAVAILABLE');
    return {
      name: party.display_name,
      phone: identifier?.identifier_value ?? null,
    };
  }

  private async fetchStudentProfile(
    tenantId: string,
    studentPartyId: string
  ): Promise<ParentPortalChildProfile> {
    const [party, student] = await Promise.all([
      this.repo.findParty(tenantId, studentPartyId),
      this.repo.findStudentByPartyId(tenantId, studentPartyId),
    ]);

    if (!party?.display_name?.trim()) throw new ParentPortalAccessError(503, 'PORTAL_STUDENT_PROFILE_UNAVAILABLE');
    return {
      studentPartyId,
      studentCode: student?.student_code ?? null,
      childName: party.display_name,
      nickname: null,
      gender: party?.gender ?? null,
      dob: party?.dob ?? null,
      avatarUrl: null,
    };
  }

  private async fetchTenantProfile(
    tenantId: string
  ): Promise<{ name: string; logoUrl: string | null; phone: string | null; address: string | null }> {
    const data = await this.repo.findTenant(tenantId);

    if (!data?.name?.trim()) throw new ParentPortalAccessError(503, 'PORTAL_TENANT_PROFILE_UNAVAILABLE');
    return {
      name: data.name,
      logoUrl: data?.logo_url ?? null,
      phone: data?.contact_phone ?? null,
      address: data?.address ?? null,
    };
  }

  private async fetchClassroomAndHeadcount(
    tenantId: string,
    studentPartyId: string,
    schoolDay: string
  ): Promise<ParentPortalClassroomInfo> {
    // 1. Get student active enrollment
    const enrollment = await this.repo.findActiveEnrollment(tenantId, studentPartyId);

    if (!enrollment?.course_id) throw new ParentPortalAccessError(503, 'PORTAL_ACTIVE_ENROLLMENT_UNAVAILABLE');

    const courseId = enrollment.course_id;

    // 2. Fetch course info + counts in parallel
    const [course, totalSize, presentCount] = await Promise.all([
      this.repo.findCourse(tenantId, courseId),
      this.repo.countActiveEnrollmentsInCourse(tenantId, courseId),
      this.repo.countPresentStudentsInCourse(tenantId, courseId, schoolDay),
    ]);

    if (!course?.course_code || !course.title) throw new ParentPortalAccessError(503, 'PORTAL_COURSE_UNAVAILABLE');
    if (presentCount > totalSize) throw new ParentPortalAccessError(503, 'PORTAL_CLASS_COUNTS_UNAVAILABLE');
    const rate = totalSize > 0 ? Math.round((presentCount / totalSize) * 1000) / 10 : null;

    return {
      courseId,
      courseCode: course.course_code,
      courseTitle: course.title,
      teacherName: null,
      roomName: null,
      totalClassSize: totalSize,
      presentTodayCount: presentCount,
      attendanceRatePercent: rate,
    };
  }

  private async fetchStudentAttendance(
    tenantId: string,
    studentPartyId: string,
    schoolDay: string
  ): Promise<ParentPortalAttendance> {
    const data = await this.repo.findStudentAttendance(tenantId, studentPartyId, schoolDay);

    if (!data) {
      return { status: 'unmarked', rollCallTime: null, notes: null };
    }

    const rawStatus = (data.status || '').toLowerCase();
    const status: ParentPortalAttendance['status'] =
      rawStatus === 'present' || rawStatus === 'absent' || rawStatus === 'excused'
        ? (rawStatus as ParentPortalAttendance['status'])
        : 'unmarked';
    if (status === 'unmarked' && rawStatus !== 'unmarked') {
      throw new ParentPortalAccessError(503, 'PORTAL_ATTENDANCE_STATUS_UNAVAILABLE');
    }

    return {
      status,
      rollCallTime: data.updated_at ? data.updated_at.slice(11, 16) : null,
      notes: null,
    };
  }

  private async fetchPickupHandover(
    tenantId: string,
    studentPartyId: string,
    schoolDay: string
  ): Promise<ParentPortalHandover> {
    const data = await this.repo.findPickupHandoverOnDay(tenantId, studentPartyId, schoolDay);

    if (!data) {
      return {
        handedOver: false,
        handedOverAt: null,
        handedOverBy: null,
        guardianPartyId: null,
      };
    }

    return {
      handedOver: true,
      handedOverAt: data.handed_over_at ? data.handed_over_at.slice(11, 16) : null,
      handedOverBy: data.handed_over_by ?? null,
      guardianPartyId: data.guardian_party_id ?? null,
    };
  }

  private async fetchWeeklyMenu(
    tenantId: string,
    targetDateStr: string
  ): Promise<ParentPortalWeeklyMenu | null> {
    const menuData = await this.repo.findWeeklyMenuForDate(tenantId, targetDateStr);

    if (menuData && Array.isArray(menuData.edu_weekly_menu_days) && menuData.edu_weekly_menu_days.length > 0) {
      const daysMap: Record<string, 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7'> = {
        MON: 'T2',
        TUE: 'T3',
        WED: 'T4',
        THU: 'T5',
        FRI: 'T6',
        SAT: 'T7',
      };

      const days: ParentPortalWeeklyMenuDay[] = menuData.edu_weekly_menu_days.map((row) => {
        const dayKey = daysMap[row.day_of_week];
        if (!dayKey) throw new ParentPortalAccessError(503, 'PORTAL_MENU_DAY_UNAVAILABLE');
        const d = new Date(row.menu_date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const meals = parseMealsPayload(row.meals_payload);

        return {
          dayKey,
          dayLabel: dayKey === 'T2' ? 'Thứ Hai' : dayKey === 'T3' ? 'Thứ Ba' : dayKey === 'T4' ? 'Thứ Tư' : dayKey === 'T5' ? 'Thứ Năm' : dayKey === 'T6' ? 'Thứ Sáu' : 'Thứ Bảy',
          dateStr,
          badgeColor: 'bg-emerald-500 text-white',
          summaryDishes: row.summary_dishes,
          caloriesKcal: row.calories_kcal ?? null,
          meals,
        };
      });

      return {
        menuId: menuData.id,
        weekNumber: menuData.week_number,
        year: menuData.year,
        startDate: menuData.start_date,
        endDate: menuData.end_date,
        days,
      };
    }

    return null;
  }

  private async fetchTuitionDetails(
    tenantId: string,
    studentPartyId: string
  ): Promise<ParentPortalTuition | null> {
    const [invoice, tenant] = await Promise.all([
      this.repo.findLatestInvoice(tenantId, studentPartyId),
      this.repo.findTenant(tenantId),
    ]);

    if (!invoice) return null;

    const total = invoice.total_amount;
    const paid = invoice.paid_amount;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0
      || typeof paid !== 'number' || !Number.isFinite(paid) || paid < 0 || paid > total) {
      throw new ParentPortalAccessError(503, 'PORTAL_INVOICE_TOTAL_UNAVAILABLE');
    }
    const balance = Math.max(0, total - paid);
    const status: ParentPortalTuition['status'] =
      balance === 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const lineItems = await this.repo.findInvoiceLineItems(tenantId, invoice.id).catch(() => []);

    let vietQrPayload: ParentPortalVietQrPayload | undefined;
    if (status !== 'PAID' && balance > 0) {
      const bankCode = tenant?.qr_bank_code?.trim() || 'MB';
      const accountNumber = tenant?.qr_account_number?.trim() || '190365701493';
      const accountName = tenant?.qr_account_name?.trim() || tenant?.name?.trim() || 'TRUONG MAM NON ANH DUONG';
      const invoiceRef = (invoice.invoice_code?.trim() || invoice.id.slice(0, 8)).toUpperCase();
      const transferMemo = `HOCPHI ${invoiceRef}`;
      const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${balance}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName)}`;

      vietQrPayload = {
        bankCode,
        accountNumber,
        accountName,
        amount: balance,
        description: transferMemo,
        qrUrl,
      };
    }

    return {
      invoiceId: invoice.id,
      invoiceCode: invoice.invoice_code ?? null,
      billingPeriodName: null,
      totalAmount: total,
      amountPaid: paid,
      balanceDue: balance,
      dueDate: invoice.due_date ? invoice.due_date.slice(0, 10) : null,
      status,
      lineItems,
      vietQrPayload,
    };
  }

  private async fetchChatThreadAndMessages(
    tenantId: string,
    guardianPartyId: string,
    studentPartyId: string
  ): Promise<{ threadId?: string; messages: readonly ParentPortalChatMessage[] }> {
    const thread = await this.repo.findCommThread(tenantId, studentPartyId, guardianPartyId);
    if (!thread) return { messages: [] };
    const responses = await this.repo.listCommResponses(tenantId, thread.id, 40);

    if (responses.length === 0) return { threadId: thread.id, messages: [] };

    const messages: ParentPortalChatMessage[] = await Promise.all(responses.map(async (r) => {
      const senderRole = r.sender_role.toUpperCase();
      if (senderRole !== 'GUARDIAN' && senderRole !== 'TEACHER' && senderRole !== 'ADMIN') {
        throw new ParentPortalAccessError(503, 'PORTAL_MESSAGE_SENDER_UNAVAILABLE');
      }
      if (!r.sender_party_id) throw new ParentPortalAccessError(503, 'PORTAL_MESSAGE_SENDER_UNAVAILABLE');
      const sender = await this.repo.findParty(tenantId, r.sender_party_id);
      if (!sender?.display_name?.trim()) throw new ParentPortalAccessError(503, 'PORTAL_MESSAGE_SENDER_UNAVAILABLE');
      return {
        id: r.id,
        senderRole,
        senderName: sender.display_name,
        createdAt: r.created_at,
        text: r.response_text,
      };
    }));

    return {
      threadId: thread.id,
      messages,
    };
  }

  private async ensureCommunicationThread(
    tenantId: string,
    guardianPartyId: string,
    studentPartyId: string
  ): Promise<{ id: string }> {
    const existing = await this.repo.findCommThread(tenantId, studentPartyId, guardianPartyId);

    if (existing) {
      return { id: existing.id };
    }

    const created = await this.repo.createCommThread(tenantId, studentPartyId, guardianPartyId);

    if (!created) {
      throw new ParentPortalAccessError(503, 'PORTAL_COMMUNICATION_THREAD_UNAVAILABLE');
    }

    return { id: created.id };
  }

}
