import { SupabaseClient } from '@supabase/supabase-js';
import {
  DailyCareRecordDTO,
  DailyCareRosterItem,
  IBulkCareResult,
  IDailyCareContract,
  IParentDigest,
  IRecordBulkArrivalCommand,
  IRecordBulkHygieneCommand,
  IRecordBulkMealCommand,
  IRecordBulkNapCommand,
} from './daily-care.contract';
import { AllergySafetyService } from '../health-profile/allergy-safety.service';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';

const ROSTER_ENROLLMENT_STATUSES = ['active', 'pending'] as const;

type CareSessionRow = {
  id: string;
};

type CareRecordRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  student_party_id: string | null;
  arrival_status: 'PRESENT' | 'ABSENT' | 'LATE' | null;
  arrival_time: string | null;
  morning_condition: string | null;
  meal_records: unknown;
  hygiene_records: unknown;
  nap_records: unknown;
  health_checks: unknown;
  updated_at: string;
};

type EnrollmentRow = {
  id: string;
  student_party_id: string;
  status: string;
};

type StudentRow = {
  party_id: string | null;
  student_code: string | null;
};

type PartyRow = {
  id: string;
  display_name: string | null;
  gender: string | null;
  dob: string | null;
};

type CareRecordInsert = {
  tenant_id: string;
  session_id: string;
  student_party_id: string;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapRecord(row: CareRecordRow): DailyCareRecordDTO {
  if (!row.student_party_id) {
    throw new Error(`CARE_RECORD_CANONICAL_IDENTITY_MISSING: ${row.id}`);
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    studentPartyId: row.student_party_id,
    arrivalStatus: row.arrival_status,
    arrivalTime: row.arrival_time,
    morningCondition: row.morning_condition,
    mealRecords: asArray(row.meal_records),
    hygieneRecords: asArray(row.hygiene_records),
    napRecords: asObject(row.nap_records),
    healthChecks: asObject(row.health_checks),
    updatedAt: row.updated_at,
  };
}

export class DailyCareService implements IDailyCareContract {
  private allergySafetyService: AllergySafetyService;

  constructor(private readonly supabase: SupabaseClient) {
    this.allergySafetyService = new AllergySafetyService(supabase);
  }

  private async assertCourseBelongsToTenant(tenantId: string, courseId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('id')
      .eq('id', courseId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error(`CARE_COURSE_LOOKUP_FAILED: ${error.message}`);
    }
    if (!data) {
      throw new Error('CARE_COURSE_NOT_FOUND_FOR_TENANT');
    }
  }

  private async getCanonicalRoster(tenantId: string, courseId: string): Promise<readonly EnrollmentRow[]> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('id, student_party_id, status')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

    if (error) {
      throw new Error(`CARE_ROSTER_LOOKUP_FAILED: ${error.message}`);
    }

    return (data ?? []) as EnrollmentRow[];
  }

  private async assertStudentInCourse(
    tenantId: string,
    courseId: string,
    studentPartyId: string,
  ): Promise<EnrollmentRow> {
    const roster = await this.getCanonicalRoster(tenantId, courseId);
    const enrollment = roster.find((item) => item.student_party_id === studentPartyId);
    if (!enrollment) {
      throw new Error('CARE_STUDENT_NOT_ENROLLED_IN_COURSE');
    }
    return enrollment;
  }

  private async getOrCreateSession(tenantId: string, courseId: string, date: string): Promise<string> {
    await this.assertCourseBelongsToTenant(tenantId, courseId);

    const { data: existingSession } = await this.supabase
      .from('edu_daily_care_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', courseId)
      .eq('date', date)
      .maybeSingle();

    if (existingSession) {
      return (existingSession as CareSessionRow).id;
    }

    const { data: newSession, error } = await this.supabase
      .from('edu_daily_care_sessions')
      .insert({ tenant_id: tenantId, class_id: courseId, date })
      .select('id')
      .single();

    if (error || !newSession) {
      throw new Error(`FAILED_TO_CREATE_CARE_SESSION: ${error?.message ?? 'Unknown error'}`);
    }

    return (newSession as CareSessionRow).id;
  }

  private async getExistingSession(tenantId: string, courseId: string, date: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('edu_daily_care_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', courseId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      throw new Error(`CARE_SESSION_LOOKUP_FAILED: ${error.message}`);
    }

    return data ? (data as CareSessionRow).id : null;
  }

  private async getOrCreateStudentRecord(
    tenantId: string,
    courseId: string,
    sessionId: string,
    studentPartyId: string,
  ): Promise<DailyCareRecordDTO> {
    await this.assertStudentInCourse(tenantId, courseId, studentPartyId);

    const { data: existingRecord, error: existingError } = await this.supabase
      .from('edu_daily_care_records')
      .select('*')
      .eq('session_id', sessionId)
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`CARE_RECORD_LOOKUP_FAILED: ${existingError.message}`);
    }
    if (existingRecord) {
      return mapRecord(existingRecord as CareRecordRow);
    }

    const insertRow: CareRecordInsert = {
      tenant_id: tenantId,
      session_id: sessionId,
      student_party_id: studentPartyId,
    };

    const { data: newRecord, error } = await this.supabase
      .from('edu_daily_care_records')
      .insert(insertRow)
      .select('*')
      .single();

    if (error || !newRecord) {
      throw new Error(`FAILED_TO_CREATE_STUDENT_CARE_RECORD: ${error?.message ?? 'Unknown error'}`);
    }

    return mapRecord(newRecord as CareRecordRow);
  }

  public async getDailyCareRoster(
    tenantId: string,
    courseId: string,
    date: string,
  ): Promise<readonly DailyCareRosterItem[]> {
    await this.assertCourseBelongsToTenant(tenantId, courseId);
    const tenant = await this.supabase.from('tenants').select('id, product_key').eq('id', tenantId).maybeSingle();
    if (tenant.error || !tenant.data || tenant.data.id !== tenantId) throw new Error('CARE_PRODUCT_CONTEXT_UNAVAILABLE');
    const preschoolRoster = tenant.data.product_key === 'bella_preschool'
      ? await new AttendanceContractImpl(this.supabase).getCourseDailyAttendance({ tenantId, courseId, schoolDay: date })
      : null;
    const enrollmentRows: readonly EnrollmentRow[] = preschoolRoster
      ? preschoolRoster.map(row => ({ id: row.enrollmentId, student_party_id: row.studentPartyId, status: row.enrollmentStatus }))
      : await this.getCanonicalRoster(tenantId, courseId);
    if (enrollmentRows.length === 0) return [];

    const studentPartyIds = [...new Set(enrollmentRows.map((enrollment) => enrollment.student_party_id))];
    const sessionId = await this.getExistingSession(tenantId, courseId, date);

    const [
      { data: students, error: studentError },
      { data: parties, error: partyError },
      { data: records, error: recordError },
    ] = await Promise.all([
      preschoolRoster
        ? Promise.resolve({ data: null, error: null })
        : this.supabase
          .from('students')
          .select('party_id, student_code')
          .eq('tenant_id', tenantId)
          .in('party_id', studentPartyIds),
      preschoolRoster
        ? Promise.resolve({ data: null, error: null })
        : this.supabase
          .from('party_parties')
          .select('id, display_name, gender, dob')
          .eq('tenant_id', tenantId)
          .in('id', studentPartyIds),
      sessionId
        ? this.supabase
          .from('edu_daily_care_records')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('session_id', sessionId)
          .in('student_party_id', studentPartyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentError) {
      throw new Error(`CARE_STUDENT_LOOKUP_FAILED: ${studentError.message}`);
    }
    if (partyError) {
      throw new Error(`CARE_PARTY_LOOKUP_FAILED: ${partyError.message}`);
    }
    if (recordError) {
      throw new Error(`CARE_RECORDS_LOOKUP_FAILED: ${recordError.message}`);
    }

    const studentByPartyId = new Map(
      ((students ?? []) as StudentRow[])
        .filter((student) => student.party_id)
        .map((student) => [student.party_id as string, student]),
    );
    const partyById = new Map(((parties ?? []) as PartyRow[]).map((party) => [party.id, party]));
    const preschoolByPartyId = new Map((preschoolRoster ?? []).map(row => [row.studentPartyId, row]));
    const careByPartyId = new Map(
      ((records ?? []) as CareRecordRow[])
        .filter((record) => record.student_party_id)
        .map((record) => [record.student_party_id as string, mapRecord(record)]),
    );

    return enrollmentRows.map((enrollment) => {
      const preschoolStudent = preschoolByPartyId.get(enrollment.student_party_id);
      const party = partyById.get(enrollment.student_party_id);
      const student = studentByPartyId.get(enrollment.student_party_id);
      const name = preschoolStudent?.name ?? party?.display_name;
      if (!name) {
        throw new Error(`CARE_CANONICAL_ROSTER_JOIN_FAILED: ${enrollment.student_party_id}`);
      }

      return {
        enrollmentId: enrollment.id,
        studentPartyId: enrollment.student_party_id,
        studentCode: preschoolStudent?.studentCode ?? student?.student_code ?? null,
        name,
        gender: preschoolStudent?.gender ?? party?.gender ?? null,
        dob: preschoolStudent?.dob ?? party?.dob ?? null,
        care: careByPartyId.get(enrollment.student_party_id) ?? null,
      };
    });
  }

  public async recordBulkArrival(command: IRecordBulkArrivalCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.courseId, command.date);
    const result: IBulkCareResult = {
      requested: command.arrivals.length,
      committed: 0,
      blocked: 0,
      successfulStudentPartyIds: [],
      exceptions: [],
    };

    for (const arrival of command.arrivals) {
      try {
        const record = await this.getOrCreateStudentRecord(
          command.tenantId,
          command.courseId,
          sessionId,
          arrival.studentPartyId,
        );

        const { error } = await this.supabase
          .from('edu_daily_care_records')
          .update({
            arrival_status: arrival.status,
            arrival_time: arrival.arrivalTime?.toISOString() ?? new Date().toISOString(),
            morning_condition: arrival.condition ?? 'GOOD',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentPartyIds.push(arrival.studentPartyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record arrival';
        result.blocked++;
        result.exceptions.push({
          studentPartyId: arrival.studentPartyId,
          errorCode: 'ARRIVAL_RECORD_FAILED',
          errorMessage: message,
          requiresAction: true,
        });
      }
    }

    return result;
  }

  public async recordBulkMeals(command: IRecordBulkMealCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.courseId, command.date);
    const result: IBulkCareResult = {
      requested: command.students.length,
      committed: 0,
      blocked: 0,
      successfulStudentPartyIds: [],
      exceptions: [],
    };

    for (const studentMeal of command.students) {
      try {
        if (command.mealItemId) {
          await this.allergySafetyService.checkMealSafety({
            tenantId: command.tenantId,
            studentId: studentMeal.studentPartyId,
            mealItemId: command.mealItemId,
          });
        }

        const record = await this.getOrCreateStudentRecord(
          command.tenantId,
          command.courseId,
          sessionId,
          studentMeal.studentPartyId,
        );
        const newMealEntry = {
          mealItemId: command.mealItemId ?? null,
          mealType: command.mealType,
          portion: studentMeal.portion,
          notes: studentMeal.notes,
          recordedAt: new Date().toISOString(),
        };

        const { error } = await this.supabase
          .from('edu_daily_care_records')
          .update({
            meal_records: [...record.mealRecords, newMealEntry],
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentPartyIds.push(studentMeal.studentPartyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to commit meal record';
        result.blocked++;
        result.exceptions.push({
          studentPartyId: studentMeal.studentPartyId,
          errorCode: message.includes('ALLERGY_EXPOSURE_RISK') ? 'ALLERGY_EXPOSURE_RISK' : 'MEAL_RECORD_FAILED',
          errorMessage: message,
          requiresAction: true,
        });
      }
    }

    return result;
  }

  public async recordBulkHygiene(command: IRecordBulkHygieneCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.courseId, command.date);
    const result: IBulkCareResult = {
      requested: command.hygieneEntries.length,
      committed: 0,
      blocked: 0,
      successfulStudentPartyIds: [],
      exceptions: [],
    };

    for (const entry of command.hygieneEntries) {
      try {
        const record = await this.getOrCreateStudentRecord(
          command.tenantId,
          command.courseId,
          sessionId,
          entry.studentPartyId,
        );
        const newHygieneEntry = {
          type: entry.type,
          time: entry.time?.toISOString() ?? new Date().toISOString(),
          notes: entry.notes,
        };

        const { error } = await this.supabase
          .from('edu_daily_care_records')
          .update({
            hygiene_records: [...record.hygieneRecords, newHygieneEntry],
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentPartyIds.push(entry.studentPartyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to commit hygiene record';
        result.blocked++;
        result.exceptions.push({
          studentPartyId: entry.studentPartyId,
          errorCode: 'HYGIENE_RECORD_FAILED',
          errorMessage: message,
          requiresAction: true,
        });
      }
    }

    return result;
  }

  public async recordBulkNap(command: IRecordBulkNapCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.courseId, command.date);
    const result: IBulkCareResult = {
      requested: command.napEntries.length,
      committed: 0,
      blocked: 0,
      successfulStudentPartyIds: [],
      exceptions: [],
    };

    for (const entry of command.napEntries) {
      try {
        const record = await this.getOrCreateStudentRecord(
          command.tenantId,
          command.courseId,
          sessionId,
          entry.studentPartyId,
        );
        const napData = {
          sleepTime: entry.sleepTime?.toISOString(),
          wakeTime: entry.wakeTime?.toISOString(),
          quality: entry.quality,
          notes: entry.notes,
          updatedAt: new Date().toISOString(),
        };

        const { error } = await this.supabase
          .from('edu_daily_care_records')
          .update({
            nap_records: napData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentPartyIds.push(entry.studentPartyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to commit nap record';
        result.blocked++;
        result.exceptions.push({
          studentPartyId: entry.studentPartyId,
          errorCode: 'NAP_RECORD_FAILED',
          errorMessage: message,
          requiresAction: true,
        });
      }
    }

    return result;
  }

  public async generateParentDigest(tenantId: string, classId: string, studentPartyId: string, date: string): Promise<IParentDigest> {
    const sessionId = await this.getOrCreateSession(tenantId, classId, date);
    const { data: record } = await this.supabase
      .from('edu_daily_care_records')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_party_id', studentPartyId)
      .single();

    if (!record) {
      throw new Error('CARE_RECORD_NOT_FOUND: No care record found to generate digest.');
    }

    const { data: existingDigest } = await this.supabase
      .from('edu_daily_parent_digests')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_party_id', studentPartyId)
      .single();

    if (existingDigest && existingDigest.status === 'PUBLISHED') {
      throw new Error('DIGEST_IMMUTABLE_ERROR: Cannot regenerate a PUBLISHED parent digest.');
    }

    const careRecord = record as CareRecordRow;
    const payload = {
      date,
      arrivalStatus: careRecord.arrival_status,
      arrivalTime: careRecord.arrival_time,
      morningCondition: careRecord.morning_condition,
      meals: careRecord.meal_records,
      hygiene: careRecord.hygiene_records,
      nap: careRecord.nap_records,
      healthChecks: careRecord.health_checks,
      generatedAt: new Date().toISOString(),
    };

    if (existingDigest) {
      const { data: updated, error } = await this.supabase
        .from('edu_daily_parent_digests')
        .update({
          status: 'GENERATED',
          digest_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDigest.id)
        .select('*')
        .single();

      if (error) throw error;
      return {
        digestId: updated.id,
        tenantId: updated.tenant_id,
        sessionId: updated.session_id,
        studentPartyId: updated.student_party_id,
        date: updated.date,
        status: updated.status,
        payload: updated.digest_payload as Record<string, unknown>,
        publishedAt: updated.published_at,
      };
    }

    const { data: created, error } = await this.supabase
      .from('edu_daily_parent_digests')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        student_party_id: studentPartyId,
        date,
        status: 'GENERATED',
        digest_payload: payload,
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      digestId: created.id,
      tenantId: created.tenant_id,
      sessionId: created.session_id,
      studentPartyId: created.student_party_id,
      date: created.date,
      status: created.status,
      payload: created.digest_payload as Record<string, unknown>,
      publishedAt: created.published_at,
    };
  }

  public async publishParentDigest(tenantId: string, digestId: string): Promise<IParentDigest> {
    const { data: digest, error: fetchErr } = await this.supabase
      .from('edu_daily_parent_digests')
      .select('*')
      .eq('id', digestId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !digest) {
      throw new Error('DIGEST_NOT_FOUND: Parent digest not found.');
    }

    if (digest.status === 'PUBLISHED') {
      return {
        digestId: digest.id,
        tenantId: digest.tenant_id,
        sessionId: digest.session_id,
        studentPartyId: digest.student_party_id,
        date: digest.date,
        status: digest.status,
        payload: digest.digest_payload as Record<string, unknown>,
        publishedAt: digest.published_at,
      };
    }

    const { data: published, error } = await this.supabase
      .from('edu_daily_parent_digests')
      .update({
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', digestId)
      .select('*')
      .single();

    if (error) throw error;

    return {
      digestId: published.id,
      tenantId: published.tenant_id,
      sessionId: published.session_id,
      studentPartyId: published.student_party_id,
      date: published.date,
      status: published.status,
      payload: published.digest_payload as Record<string, unknown>,
      publishedAt: published.published_at,
    };
  }
}
