/**
 * Bella Preschool OS — Parent Portal Repository
 * File: src/products/bella-education/parent-portal/repositories/parent-portal.repository.ts
 *
 * Contains ALL direct Supabase queries for the Parent Portal aggregator.
 * This repository is the ONLY file in parent-portal/ that may call `.from()`.
 * The service layer must NEVER call supabase directly — always delegate here.
 *
 * Strict Type Invariant: ZERO use of `any` and `unknown`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/types/database.types';

type EducationSupabaseClient = SupabaseClient;

interface GuardianBindingRow {
  id: string;
  tenant_id: string;
  source_party_id: string;
  target_party_id: string;
  relationship_type: string;
  active_from: string | null;
  active_to: string | null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function isCurrentRelationship(row: GuardianBindingRow, today: string): boolean {
  // Canonical fields are DATE; the entire end date is included in school time.
  return (row.active_from === null || isCalendarDate(row.active_from) && row.active_from <= today)
    && (row.active_to === null || isCalendarDate(row.active_to) && today <= row.active_to);
}

// ── Row shapes returned from DB ───────────────────────────────────────────────

export interface DbPartyRow {
  display_name?: string | null;
  gender?: string | null;
  dob?: string | null;
}

export interface DbIdentifierRow {
  identifier_value?: string | null;
}

export interface DbStudentRow {
  student_code?: string | null;
}

export interface DbTenantRow {
  name?: string | null;
  logo_url?: string | null;
  contact_phone?: string | null;
  address?: string | null;
}

export interface DbEnrollmentRow {
  course_id?: string | null;
}

export interface DbCourseRow {
  course_code?: string | null;
  title?: string | null;
}

export interface DbAttendanceStateRow {
  status?: string | null;
  updated_at?: string | null;
}

export interface DbDailyCareSessionRow {
  id: string;
}

export interface DbDailyCareRecordRow {
  arrival_status?: string | null;
  arrival_time?: string | null;
  morning_condition?: string | null;
  meal_records?: Json | null;
  hygiene_records?: Json | null;
  nap_records?: Json | null;
  health_checks?: Json | null;
  updated_at?: string | null;
}

export interface DbPickupHandoverRow {
  id: string;
  handed_over_at?: string | null;
  handed_over_by?: string | null;
  guardian_party_id?: string | null;
}

export interface DbWeeklyMenuDayRow {
  day_of_week: string;
  menu_date: string;
  summary_dishes: string;
  calories_kcal?: number | null;
  meals_payload?: Json | null;
}

export interface DbWeeklyMenuRow {
  id: string;
  week_number: number;
  year: number;
  start_date: string;
  end_date: string;
  status: string;
  edu_weekly_menu_days?: DbWeeklyMenuDayRow[];
}

export interface DbInvoiceRow {
  id: string;
  invoice_code?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  status?: string | null;
  due_date?: string | null;
  billing_period_id?: string | null;
}

export interface DbCommThreadRow {
  id: string;
}

export interface DbCommResponseRow {
  id: string;
  response_text: string;
  sender_role: string;
  created_at: string;
  sender_party_id?: string | null;
}

export interface DbInsertedResponseRow {
  id: string;
  created_at: string;
  response_text: string;
  sender_role: string;
  sender_party_id?: string | null;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class ParentPortalRepository {
  constructor(private readonly supabase: EducationSupabaseClient) {}

  // ── Authorization ──────────────────────────────────────────────────────────

  async findGuardianRelationship(
    tenantId: string,
    guardianPartyId: string,
    studentPartyId: string
  ): Promise<{ id: string } | null> {
    if (guardianPartyId === studentPartyId) return null;

    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('id, status, product_key')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw new Error('PORTAL_ACCESS_UNAVAILABLE');
    if (!tenant || tenant.id !== tenantId || tenant.status !== 'active' || tenant.product_key !== 'bella_preschool') return null;

    const { data: parties, error: partyError } = await this.supabase
      .from('party_parties')
      .select('id, tenant_id, deleted_at')
      .eq('tenant_id', tenantId)
      .in('id', [guardianPartyId, studentPartyId]);
    if (partyError) throw new Error('PORTAL_ACCESS_UNAVAILABLE');
    const existingParties = (parties ?? []) as Array<{ id: string; tenant_id: string; deleted_at: string | null }>;
    if (![guardianPartyId, studentPartyId].every(id => existingParties.some(party =>
      party.id === id && party.tenant_id === tenantId && party.deleted_at === null))) return null;

    const { data, error } = await this.supabase
      .from('party_relationships')
      .select('id, tenant_id, source_party_id, target_party_id, relationship_type, active_from, active_to')
      .eq('tenant_id', tenantId)
      .eq('source_party_id', guardianPartyId)
      .eq('target_party_id', studentPartyId)
      .in('relationship_type', ['guardian_of', 'parent_of']);
    if (error) throw new Error('PORTAL_ACCESS_UNAVAILABLE');
    // Authorization always uses current access time, never the requested payload date.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const relationship = ((data ?? []) as GuardianBindingRow[]).find(row =>
      row.tenant_id === tenantId && row.source_party_id === guardianPartyId && row.target_party_id === studentPartyId
      && ['guardian_of', 'parent_of'].includes(row.relationship_type) && isCurrentRelationship(row, today));
    return relationship ? { id: relationship.id } : null;
  }

  // ── Party & Student profiles ───────────────────────────────────────────────

  async findParty(tenantId: string, partyId: string): Promise<DbPartyRow | null> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('display_name, gender, dob')
      .eq('tenant_id', tenantId)
      .eq('id', partyId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async findPartyIdentifier(tenantId: string, partyId: string): Promise<DbIdentifierRow | null> {
    const { data, error } = await this.supabase
      .from('party_identifiers')
      .select('identifier_value')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async findStudentByPartyId(tenantId: string, partyId: string): Promise<DbStudentRow | null> {
    const { data, error } = await this.supabase
      .from('students')
      .select('student_code')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async findTenant(tenantId: string): Promise<DbTenantRow | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('name, logo_url, contact_phone, address')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  // ── Enrollment & Course ────────────────────────────────────────────────────

  async findActiveEnrollment(
    tenantId: string,
    studentPartyId: string
  ): Promise<DbEnrollmentRow | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('course_id')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async findCourse(tenantId: string, courseId: string): Promise<DbCourseRow | null> {
    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('course_code, title')
      .eq('tenant_id', tenantId)
      .eq('id', courseId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async countActiveEnrollmentsInCourse(tenantId: string, courseId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('edu_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .eq('status', 'active');
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return count ?? 0;
  }

  async countPresentStudentsInCourse(
    tenantId: string,
    courseId: string,
    schoolDay: string
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('edu_attendance_daily_state')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .eq('school_day', schoolDay)
      .in('status', ['present', 'late']);
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return count ?? 0;
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  async findStudentAttendance(
    tenantId: string,
    studentPartyId: string,
    schoolDay: string
  ): Promise<DbAttendanceStateRow | null> {
    const { data, error } = await this.supabase
      .from('edu_attendance_daily_state')
      .select('status, updated_at')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .eq('school_day', schoolDay)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  // ── Daily Care ─────────────────────────────────────────────────────────────

  async findLatestDailyCareSession(tenantId: string): Promise<DbDailyCareSessionRow | null> {
    const { data, error } = await this.supabase
      .from('edu_daily_care_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async findLatestDailyCareRecord(
    tenantId: string,
    studentPartyId: string
  ): Promise<DbDailyCareRecordRow | null> {
    const { data, error } = await this.supabase
      .from('edu_daily_care_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentPartyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  // ── Pickup Handover ────────────────────────────────────────────────────────

  async findPickupHandoverOnDay(
    tenantId: string,
    studentPartyId: string,
    schoolDay: string
  ): Promise<DbPickupHandoverRow | null> {
    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_handover_events')
      .select('id, handed_over_at, handed_over_by, guardian_party_id')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .gte('handed_over_at', `${schoolDay}T00:00:00.000Z`)
      .lte('handed_over_at', `${schoolDay}T23:59:59.999Z`)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  // ── Weekly Menu ────────────────────────────────────────────────────────────

  async findWeeklyMenuForDate(
    tenantId: string,
    targetDateStr: string
  ): Promise<DbWeeklyMenuRow | null> {
    const { data, error } = await this.supabase
      .from('edu_weekly_menus')
      .select('id, week_number, year, start_date, end_date, status, edu_weekly_menu_days(*)')
      .eq('tenant_id', tenantId)
      .lte('start_date', targetDateStr)
      .gte('end_date', targetDateStr)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return (data as DbWeeklyMenuRow | null) ?? null;
  }

  // ── Tuition / Invoice ──────────────────────────────────────────────────────

  async findLatestInvoice(
    tenantId: string,
    studentPartyId: string
  ): Promise<DbInvoiceRow | null> {
    const { data, error } = await this.supabase
      .from('edu_invoices')
      .select('id, invoice_code, total_amount, paid_amount, status, due_date, billing_period_id')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return (data as DbInvoiceRow | null) ?? null;
  }

  // ── Communication Thread & Messages ───────────────────────────────────────

  async findCommThread(
    tenantId: string,
    studentPartyId: string,
    guardianPartyId: string
  ): Promise<DbCommThreadRow | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_threads')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentPartyId)
      .eq('guardian_party_id', guardianPartyId)
      .maybeSingle();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async createCommThread(
    tenantId: string,
    studentPartyId: string,
    guardianPartyId: string
  ): Promise<DbCommThreadRow | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_threads')
      .insert({
        tenant_id: tenantId,
        student_id: studentPartyId,
        guardian_party_id: guardianPartyId,
        created_by: guardianPartyId,
        title: 'Trao đổi Phụ huynh & Nhà trường',
        thread_type: 'GENERAL',
        status: 'ACTIVE',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? null;
  }

  async listCommResponses(
    tenantId: string,
    threadId: string,
    limit = 40
  ): Promise<readonly DbCommResponseRow[]> {
    const { data, error } = await this.supabase
      .from('edu_comm_responses')
      .select('id, response_text, sender_role, created_at, sender_party_id')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error('PORTAL_DATA_UNAVAILABLE');
    return data ?? [];
  }

  async insertCommResponse(input: {
    tenantId: string;
    threadId: string;
    senderPartyId: string;
    senderRole: string;
    responseText: string;
  }): Promise<DbInsertedResponseRow | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_responses')
      .insert({
        tenant_id: input.tenantId,
        thread_id: input.threadId,
        sender_party_id: input.senderPartyId,
        sender_role: input.senderRole,
        response_text: input.responseText,
        attachments: [],
      })
      .select('id, created_at, response_text, sender_role, sender_party_id')
      .single();
    if (error || !data) return null;
    return data;
  }

  async touchThreadActivity(tenantId: string, threadId: string): Promise<void> {
    await this.supabase
      .from('edu_comm_threads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('tenant_id', tenantId);
  }
}
