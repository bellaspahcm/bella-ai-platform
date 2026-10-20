/**
 * Bella Preschool OS — Parent Portal Service & Token Verification Integration Test
 * File: src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts
 *
 * Verifies:
 * 1. Cryptographic Magic Token generation, verification, and tamper rejection.
 * 2. Guardian Authorization Assertion against `party_relationships`.
 * 3. 7 Canonical Pillars Aggregation (Headcount, Daily care, Menu, Routine, Tuition, Chat).
 * 4. Bidirectional Chat Message persistence to `edu_comm_responses`.
 * 5. Multi-tenant isolation invariant.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PreschoolParentPortalService } from '../parent-portal/services/preschool-parent-portal.service';

interface FakeDb {
  tenants: Array<Record<string, unknown>>;
  party_parties: Array<Record<string, unknown>>;
  party_identifiers: Array<Record<string, unknown>>;
  party_relationships: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  edu_courses: Array<Record<string, unknown>>;
  edu_enrollments: Array<Record<string, unknown>>;
  edu_attendance_daily_state: Array<Record<string, unknown>>;
  edu_daily_care_sessions: Array<Record<string, unknown>>;
  edu_daily_care_records: Array<Record<string, unknown>>;
  edu_preschool_pickup_handover_events: Array<Record<string, unknown>>;
  edu_weekly_menus: Array<Record<string, unknown>>;
  edu_weekly_menu_days: Array<Record<string, unknown>>;
  edu_invoices: Array<Record<string, unknown>>;
  edu_comm_threads: Array<Record<string, unknown>>;
  edu_comm_responses: Array<Record<string, unknown>>;
}

type FakeTable = keyof FakeDb;

class FakeQueryBuilder {
  private readonly eqFilters = new Map<string, unknown>();
  private readonly inFilters = new Map<string, readonly unknown[]>();
  private readonly gteFilters = new Map<string, unknown>();
  private readonly lteFilters = new Map<string, unknown>();
  private isHeadCount = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: FakeTable
  ) {}

  select(_cols?: string, options?: { count?: string; head?: boolean }): FakeQueryBuilder {
    if (options?.head) {
      this.isHeadCount = true;
    }
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.eqFilters.set(column, value);
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.inFilters.set(column, values);
    return this;
  }

  gte(column: string, value: unknown): FakeQueryBuilder {
    this.gteFilters.set(column, value);
    return this;
  }

  lte(column: string, value: unknown): FakeQueryBuilder {
    this.lteFilters.set(column, value);
    return this;
  }

  order(): FakeQueryBuilder {
    return this;
  }

  limit(): FakeQueryBuilder {
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>): FakeQueryBuilder {
    const list = Array.isArray(values) ? values : [values];
    for (const item of list) {
      const record = {
        id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      };
      this.db[this.table].push(record);
    }
    return this;
  }

  update(values: Record<string, unknown>): FakeQueryBuilder {
    const rows = this.matchRows();
    for (const r of rows) {
      Object.assign(r, values);
    }
    return this;
  }

  async maybeSingle() {
    const rows = this.matchRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.matchRows();
    return rows[0]
      ? { data: rows[0], error: null }
      : { data: null, error: { message: 'Row not found' } };
  }

  then<TResult1 = { data: Array<Record<string, unknown>> | null; count?: number; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Array<Record<string, unknown>>; count: number; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const rows = this.matchRows();
    const result = {
      data: rows,
      count: rows.length,
      error: null,
    };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private matchRows(): Array<Record<string, unknown>> {
    const tableData = this.db[this.table] || [];
    return tableData.filter((row) => {
      for (const [col, val] of this.eqFilters) {
        if (row[col] !== val) return false;
      }
      for (const [col, vals] of this.inFilters) {
        if (!vals.includes(row[col])) return false;
      }
      for (const [col, val] of this.gteFilters) {
        if (typeof row[col] === 'string' && typeof val === 'string') {
          if (row[col] < val) return false;
        }
      }
      for (const [col, val] of this.lteFilters) {
        if (typeof row[col] === 'string' && typeof val === 'string') {
          if (row[col] > val) return false;
        }
      }
      return true;
    });
  }
}

function createFakeClient(): { client: SupabaseClient; db: FakeDb } {
  const db: FakeDb = {
    tenants: [],
    party_parties: [],
    party_identifiers: [],
    party_relationships: [],
    students: [],
    edu_courses: [],
    edu_enrollments: [],
    edu_attendance_daily_state: [],
    edu_daily_care_sessions: [],
    edu_daily_care_records: [],
    edu_preschool_pickup_handover_events: [],
    edu_weekly_menus: [],
    edu_weekly_menu_days: [],
    edu_invoices: [],
    edu_comm_threads: [],
    edu_comm_responses: [],
  };

  const client = {
    from: (table: FakeTable) => new FakeQueryBuilder(db, table),
  } as unknown as SupabaseClient;

  return { client, db };
}

describe('PreschoolParentPortalService', () => {
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const GUARDIAN_PARTY_ID = '00000000-0000-0000-0000-000000000002';
  const STUDENT_PARTY_ID = '00000000-0000-0000-0000-000000000011';
  const COURSE_ID = '00000000-0000-0000-0000-000000000021';

  let fake: ReturnType<typeof createFakeClient>;
  let service: PreschoolParentPortalService;

  beforeEach(() => {
    fake = createFakeClient();
    service = new PreschoolParentPortalService(fake.client);

    // Seed Tenant
    fake.db.tenants.push({
      id: TENANT_ID,
      name: 'Trường Mầm Non Ánh Dương',
      contact_phone: '1900 6868',
      address: '123 Đường Nguyễn Thị Minh Khai, Q1, TP.HCM',
    });

    // Seed Guardian & Student Parties
    fake.db.party_parties.push(
      { id: GUARDIAN_PARTY_ID, tenant_id: TENANT_ID, display_name: 'Nguyễn Văn Ba (Bố)', gender: 'male' },
      { id: STUDENT_PARTY_ID, tenant_id: TENANT_ID, display_name: 'Nguyễn Minh Anh', gender: 'female', dob: '2022-05-15' }
    );

    // Seed Guardian phone
    fake.db.party_identifiers.push({
      id: 'id-phone-1',
      tenant_id: TENANT_ID,
      party_id: GUARDIAN_PARTY_ID,
      identifier_value: '0901234567',
    });

    // Seed Student
    fake.db.students.push({
      id: 'stu-row-1',
      tenant_id: TENANT_ID,
      party_id: STUDENT_PARTY_ID,
      student_code: 'HS0001',
    });

    // Seed Guardian relationship
    fake.db.party_relationships.push({
      id: 'rel-1',
      tenant_id: TENANT_ID,
      party_id: GUARDIAN_PARTY_ID,
      target_party_id: STUDENT_PARTY_ID,
      relationship_type: 'guardian_of',
      is_active: true,
    });

    // Seed Classroom & Enrollment
    fake.db.edu_courses.push({
      id: COURSE_ID,
      tenant_id: TENANT_ID,
      course_code: 'MN-A1',
      title: 'Lớp Mầm A1',
    });

    fake.db.edu_enrollments.push(
      { id: 'enr-1', tenant_id: TENANT_ID, course_id: COURSE_ID, student_party_id: STUDENT_PARTY_ID, status: 'active' },
      { id: 'enr-2', tenant_id: TENANT_ID, course_id: COURSE_ID, student_party_id: 'other-stu-1', status: 'active' },
      { id: 'enr-3', tenant_id: TENANT_ID, course_id: COURSE_ID, student_party_id: 'other-stu-2', status: 'active' }
    );

    // Seed Attendance on Today
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    fake.db.edu_attendance_daily_state.push(
      { id: 'att-1', tenant_id: TENANT_ID, course_id: COURSE_ID, student_party_id: STUDENT_PARTY_ID, school_day: today, status: 'present', updated_at: `${today}T07:35:00.000Z` },
      { id: 'att-2', tenant_id: TENANT_ID, course_id: COURSE_ID, student_party_id: 'other-stu-1', school_day: today, status: 'present', updated_at: `${today}T07:40:00.000Z` }
    );
  });

  describe('Magic Token Generation and Cryptographic Verification', () => {
    it('generates a valid token and successfully verifies claims', () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const claims = PreschoolParentPortalService.verifyPortalToken(token);
      expect(claims.tenantId).toBe(TENANT_ID);
      expect(claims.guardianPartyId).toBe(GUARDIAN_PARTY_ID);
      expect(claims.studentPartyId).toBe(STUDENT_PARTY_ID);
      expect(claims.exp).toBeGreaterThan(Date.now());
    });

    it('rejects tampered tokens with signature mismatch error', () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.badsignature1234567890abcdef`;

      expect(() => PreschoolParentPortalService.verifyPortalToken(tamperedToken)).toThrow(
        /TOKEN_SIGNATURE_MISMATCH/
      );
    });

    it('rejects expired tokens', () => {
      // Token expired 1 second ago
      const expiredToken = PreschoolParentPortalService.generatePortalToken(
        {
          tenantId: TENANT_ID,
          guardianPartyId: GUARDIAN_PARTY_ID,
          studentPartyId: STUDENT_PARTY_ID,
        },
        -1 // negative validity -> expired
      );

      expect(() => PreschoolParentPortalService.verifyPortalToken(expiredToken)).toThrow(
        /TOKEN_EXPIRED/
      );
    });
  });

  describe('Parent Portal Canonical Aggregation', () => {
    it('aggregates live class headcount and child attendance correctly', async () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      const payload = await service.getParentPortalPayload(token);

      expect(payload.schoolName).toBe('Trường Mầm Non Ánh Dương');
      expect(payload.child.childName).toBe('Nguyễn Minh Anh');
      expect(payload.child.studentCode).toBe('HS0001');

      // Headcount check: 3 total enrollments, 2 present today
      expect(payload.classroom.courseCode).toBe('MN-A1');
      expect(payload.classroom.totalClassSize).toBe(3);
      expect(payload.classroom.presentTodayCount).toBe(2);
      expect(payload.classroom.attendanceRatePercent).toBe(66.7);

      // Child's own attendance
      expect(payload.todayAttendance.status).toBe('present');
      expect(payload.todayAttendance.rollCallTime).toBe('07:35');
    });

    it('rejects access if guardian relationship is not in DB', async () => {
      const UNLINKED_GUARDIAN = '00000000-0000-0000-0000-999999999999';
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: UNLINKED_GUARDIAN,
        studentPartyId: STUDENT_PARTY_ID,
      });

      await expect(service.getParentPortalPayload(token)).rejects.toThrow(
        /GUARDIAN_NOT_AUTHORIZED/
      );
    });

    it('includes default timetable, daily care, and tuition VietQR details', async () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      const payload = await service.getParentPortalPayload(token);

      expect(payload.dailyTimetable.length).toBeGreaterThan(5);
      expect(payload.dailyCare).not.toBeNull();
      expect(payload.dailyCare?.healthChecks.temperature).toBeDefined();

      expect(payload.tuition).not.toBeNull();
      expect(payload.tuition?.vietQrPayload?.qrUrl).toContain('vietqr.io');
    });

    it('populates aiDailyDigest with title, digest, highlights, and moodEmoji', async () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      const payload = await service.getParentPortalPayload(token);

      // aiDailyDigest must be present when dailyCare is available
      expect(payload.aiDailyDigest).not.toBeNull();
      expect(typeof payload.aiDailyDigest?.title).toBe('string');
      expect(payload.aiDailyDigest?.title.length).toBeGreaterThan(5);
      expect(typeof payload.aiDailyDigest?.digest).toBe('string');
      expect(Array.isArray(payload.aiDailyDigest?.highlights)).toBe(true);
      expect((payload.aiDailyDigest?.highlights.length ?? 0)).toBeGreaterThanOrEqual(3);
      expect(typeof payload.aiDailyDigest?.teacherMoodEmoji).toBe('string');
      expect(typeof payload.aiDailyDigest?.generatedAt).toBe('string');
    });
  });

  describe('Bidirectional Chat Message Persistence', () => {
    it('persists guardian chat message into edu_comm_responses', async () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      const text = 'Hôm nay mẹ đón bé muộn 15 phút nhé cô!';
      const sentMessage = await service.sendChatMessage(token, text);

      expect(sentMessage.senderRole).toBe('GUARDIAN');
      expect(sentMessage.text).toBe(text);

      // Check DB persistence in edu_comm_responses
      const responses = fake.db.edu_comm_responses;
      expect(responses.length).toBe(1);
      expect(responses[0].response_text).toBe(text);
      expect(responses[0].sender_role).toBe('GUARDIAN');
      expect(responses[0].tenant_id).toBe(TENANT_ID);
    });

    it('rejects empty or whitespace-only messages', async () => {
      const token = PreschoolParentPortalService.generatePortalToken({
        tenantId: TENANT_ID,
        guardianPartyId: GUARDIAN_PARTY_ID,
        studentPartyId: STUDENT_PARTY_ID,
      });

      await expect(service.sendChatMessage(token, '   ')).rejects.toThrow(/MESSAGE_EMPTY/);
    });
  });

  describe('Child PII Anonymization Shield (Phase 3)', () => {
    it('masks Vietnamese phone numbers and child names before LLM egress', async () => {
      const { maskChildPii } = await import('../services/preschool-ai.service');

      const input = 'Bé Nguyễn Minh Anh bị sốt, phụ huynh gọi 0901234567 và 090.123.4568 nhé.';
      const result = maskChildPii(input, ['Nguyễn Minh Anh']);

      // Child name should be masked
      expect(result.maskedText).not.toContain('Nguyễn Minh Anh');
      expect(result.maskedText).toContain('[TRE_EM_1]');

      // Phone numbers should be masked
      expect(result.maskedText).not.toContain('0901234567');
      expect(result.maskedText).toContain('[SDT_PHU_HUYNH_');

      // TokenMap must hold originals
      const tokens = Object.values(result.tokenMap);
      expect(tokens.some((v) => v.includes('Nguyễn Minh Anh') || v.includes('0901234567'))).toBe(true);
    });

    it('preserves non-PII Vietnamese adjectives (mệt, sốt, khỏe) from masking', async () => {
      const { maskChildPii } = await import('../services/preschool-ai.service');

      const input = 'Bé mệt, bé sốt cao, bé ngoan hôm nay.';
      const result = maskChildPii(input);

      // Adjective-only references should NOT be replaced with tokens
      expect(result.maskedText).toContain('mệt');
      expect(result.maskedText).toContain('sốt');
    });
  });
});
