import { NextResponse } from 'next/server';
import type { DailyCareAction } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.contract';
import { CARE_PRIVATE_HEADERS, CareAccessError, assertCareBodyContext, assertCareStudents, authorizeCareCourse, resolveCareRequestContext } from './request-context';

export const dynamic = 'force-dynamic';

interface CareRequestBody {
  readonly action?: unknown;
  readonly courseId?: unknown;
  readonly date?: unknown;
  readonly data?: unknown;
}

type CarePayload = {
  readonly arrivals?: Array<{
    readonly studentPartyId?: unknown;
    readonly status?: unknown;
    readonly condition?: unknown;
  }>;
  readonly mealItemId?: unknown;
  readonly mealType?: unknown;
  readonly students?: Array<{
    readonly studentPartyId?: unknown;
    readonly portion?: unknown;
    readonly notes?: unknown;
  }>;
  readonly hygieneEntries?: Array<{
    readonly studentPartyId?: unknown;
    readonly type?: unknown;
    readonly notes?: unknown;
  }>;
  readonly napEntries?: Array<{
    readonly studentPartyId?: unknown;
    readonly quality?: unknown;
    readonly notes?: unknown;
  }>;
  readonly records?: Array<{
    readonly studentPartyId?: unknown;
    readonly meal?: { readonly portion?: unknown; readonly notes?: unknown };
    readonly nap?: { readonly quality?: unknown; readonly notes?: unknown };
    readonly health?: {
      readonly status?: unknown;
      readonly label?: unknown;
      readonly temperature?: unknown;
      readonly isAlert?: unknown;
      readonly alertReason?: unknown;
      readonly notes?: unknown;
    };
    readonly hygiene?: { readonly type?: unknown; readonly notes?: unknown };
    readonly note?: unknown;
  }>;
};

function isSchoolDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isCareAction(value: unknown): value is DailyCareAction | 'save_care' {
  return (
    value === 'arrival' ||
    value === 'meal' ||
    value === 'hygiene' ||
    value === 'nap' ||
    value === 'save_care'
  );
}

function asPayload(value: unknown): CarePayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CarePayload : {};
}

function isArrivalStatus(value: unknown): value is 'PRESENT' | 'ABSENT' | 'LATE' {
  return value === 'PRESENT' || value === 'ABSENT' || value === 'LATE';
}

function isMealPortion(value: unknown): value is 'ALL' | 'HALF' | 'FEW' | 'NONE' {
  return value === 'ALL' || value === 'HALF' || value === 'FEW' || value === 'NONE';
}

function isMealType(value: unknown): value is 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' {
  return value === 'BREAKFAST' || value === 'LUNCH' || value === 'AFTERNOON_SNACK';
}

function isHygieneType(value: unknown): value is 'DIAPER' | 'TOILET' | 'BOWEL_MOVEMENT' {
  return value === 'DIAPER' || value === 'TOILET' || value === 'BOWEL_MOVEMENT';
}

function isNapQuality(value: unknown): value is 'DEEP' | 'RESTLESS' | 'REFUSED' {
  return value === 'DEEP' || value === 'RESTLESS' || value === 'REFUSED';
}

export async function GET(request: Request) {
  try {
    const context = await resolveCareRequestContext(request);
    const { client, tenantId } = context;
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId')?.trim() ?? '';
    const date = searchParams.get('date');
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400, headers: CARE_PRIVATE_HEADERS });
    }
    if (!isSchoolDay(date)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400, headers: CARE_PRIVATE_HEADERS });
    }

    const { roster } = await authorizeCareCourse(context, request, courseId, date);

    // Preserve the attendance projection only after the active roster is authorized.
    // edu_attendance_daily_state links via enrollment_id, so we join through edu_enrollments.
    const { data: enrollmentAttRows, error: attendanceError } = await client
        .from('edu_attendance_daily_state')
        .select('id, status, school_day, enrollment_id, edu_enrollments!inner(id, student_party_id)')
        .eq('tenant_id', tenantId)
        .eq('school_day', date)
        .eq('edu_enrollments.course_id', courseId);
    if (attendanceError) throw new CareAccessError(503, 'CARE_DATA_UNAVAILABLE');

    // Build map: studentPartyId -> attendance status
    const attendanceByPartyId = new Map<string, { status: string; rollCallTime: string | null; note: string | null }>();
    for (const row of enrollmentAttRows ?? []) {
      const enrollment = Array.isArray(row.edu_enrollments) ? row.edu_enrollments[0] : row.edu_enrollments;
      const partyId = (enrollment as { student_party_id?: string } | null)?.student_party_id;
      if (partyId) {
        attendanceByPartyId.set(partyId, { status: row.status, rollCallTime: null, note: null });
      }
    }

    const mergedRoster = roster.map((item) => {
      const att = attendanceByPartyId.get(item.studentPartyId);
      return {
        ...item,
        attendance: att ? { status: att.status, rollCallTime: att.rollCallTime } : null,
        attendanceNote: att?.note ?? null,
      };
    });

    return NextResponse.json({ success: true, roster: mergedRoster }, { headers: CARE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof CareAccessError ? error.code : 'CARE_DEPENDENCY_UNAVAILABLE' }, {
      status: error instanceof CareAccessError ? error.status : 503, headers: CARE_PRIVATE_HEADERS,
    });
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveCareRequestContext(request);
    const { client, tenantId } = context;
    const rawBody: unknown = await request.json().catch(() => { throw new CareAccessError(400, 'CARE_INVALID_PAYLOAD'); });
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) throw new CareAccessError(400, 'CARE_INVALID_PAYLOAD');
    const body = rawBody as CareRequestBody;
    assertCareBodyContext(body, context);
    const action = body.action;
    const courseId = asString(body.courseId);
    const date = body.date;
    const payload = asPayload(body.data);

    if (!isCareAction(action)) {
      return NextResponse.json({ success: false, error: 'action must be arrival, meal, hygiene, nap, or save_care' }, { status: 400, headers: CARE_PRIVATE_HEADERS });
    }
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400, headers: CARE_PRIVATE_HEADERS });
    }
    if (!isSchoolDay(date)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400, headers: CARE_PRIVATE_HEADERS });
    }

    const targetEntries = action === 'save_care' ? payload.records : action === 'arrival' ? payload.arrivals
      : action === 'meal' ? payload.students : action === 'hygiene' ? payload.hygieneEntries : payload.napEntries;
    if (!Array.isArray(targetEntries) || targetEntries.length === 0 || targetEntries.some(entry => !entry || typeof entry !== 'object')) {
      throw new CareAccessError(400, 'CARE_TARGETS_REQUIRED');
    }
    if (action === 'save_care' && targetEntries.some(entry => 'health' in entry || 'health_checks' in entry || 'healthChecks' in entry)) {
      throw new CareAccessError(503, 'CARE_HEALTH_POLICY_UNAVAILABLE');
    }
    const { service, roster } = await authorizeCareCourse(context, request, courseId, date, body);
    assertCareStudents(targetEntries.map(entry => asString(entry.studentPartyId)), roster);

    // ── Unified save_care action (single or bulk full care state) ────────────
    if (action === 'save_care') {
      const recordsToSave = (payload.records ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        mealPortion: isMealPortion(entry.meal?.portion) ? entry.meal.portion : null,
        mealNotes: asString(entry.meal?.notes),
        napQuality: isNapQuality(entry.nap?.quality) ? entry.nap.quality : null,
        napNotes: asString(entry.nap?.notes),
        hygieneType: isHygieneType(entry.hygiene?.type) ? entry.hygiene.type : null,
        hygieneNotes: asString(entry.hygiene?.notes),
        note: asString(entry.note),
      }));

      // Get or create daily care session
      let sessionId: string;
      const { data: existingSession, error: sessionLookupError } = await client
        .from('edu_daily_care_sessions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('class_id', courseId)
        .eq('date', date)
        .maybeSingle();

      if (sessionLookupError) throw new CareAccessError(503, 'CARE_DATA_UNAVAILABLE');
      if (existingSession?.id) {
        sessionId = existingSession.id;
      } else {
        const { data: newSession, error: sessErr } = await client
          .from('edu_daily_care_sessions')
          .insert({ tenant_id: tenantId, class_id: courseId, date, status: 'OPEN' })
          .select('id')
          .single();
        if (sessErr || !newSession) {
          throw new Error(`FAILED_CREATE_CARE_SESSION: ${sessErr?.message ?? 'unknown'}`);
        }
        sessionId = newSession.id;
      }

      const now = new Date().toISOString();
      let savedCount = 0;

      for (const rec of recordsToSave) {
        const mealRecords = rec.mealPortion
          ? [
              {
                mealType: 'LUNCH',
                portion: rec.mealPortion,
                notes: rec.mealNotes,
                recordedAt: now,
              },
            ]
          : [];

        const napRecords = rec.napQuality
          ? {
              quality: rec.napQuality,
              notes: rec.napNotes,
              updatedAt: now,
            }
          : {};

        const hygieneRecords = rec.hygieneType
          ? [
              {
                type: rec.hygieneType,
                notes: rec.hygieneNotes,
                time: now,
              },
            ]
          : [];

        const morningCondition = rec.note || '';

        // Check if student care record exists by student_party_id
        const { data: existingRec, error: recordLookupError } = await client
          .from('edu_daily_care_records')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('session_id', sessionId)
          .eq('student_party_id' as 'id', rec.studentPartyId as unknown as string)
          .maybeSingle();

        if (recordLookupError) throw new CareAccessError(503, 'CARE_DATA_UNAVAILABLE');
        if (existingRec?.id) {
          const { error: upErr } = await client
            .from('edu_daily_care_records')
            .update({
              morning_condition: morningCondition,
              meal_records: mealRecords,
              nap_records: napRecords,
              hygiene_records: hygieneRecords,
              updated_at: now,
            })
            .eq('tenant_id', tenantId)
            .eq('session_id', sessionId)
            .eq('id', existingRec.id);
          if (upErr) throw new CareAccessError(503, 'CARE_WRITE_UNAVAILABLE');
          savedCount++;
        } else {
          // Insert — student_party_id exists in DB even if TS types lag
          const insertPayload: Record<string, unknown> = {
            tenant_id: tenantId,
            session_id: sessionId,
            student_party_id: rec.studentPartyId,
            arrival_status: 'PRESENT',
            morning_condition: morningCondition,
            meal_records: mealRecords,
            nap_records: napRecords,
            hygiene_records: hygieneRecords,
            updated_at: now,
          };
          const { error: insErr } = await (client
            .from('edu_daily_care_records') as unknown as {
              insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
            }).insert(insertPayload);
          if (insErr) {
            throw new CareAccessError(503, 'CARE_WRITE_UNAVAILABLE');
          } else {
            savedCount++;
          }
        }
      }

      return NextResponse.json({ success: true, savedCount, total: recordsToSave.length }, { headers: CARE_PRIVATE_HEADERS });
    }

    if (action === 'arrival') {
      const arrivals = (payload.arrivals ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        status: isArrivalStatus(entry.status) ? entry.status : 'PRESENT',
        condition: asString(entry.condition) || 'GOOD',
      }));

      const result = await service.recordBulkArrival({ tenantId, courseId, date, arrivals });
      return NextResponse.json({ success: result.blocked === 0, result }, { headers: CARE_PRIVATE_HEADERS });
    }

    if (action === 'meal') {
      const mealType = isMealType(payload.mealType) ? payload.mealType : 'LUNCH';
      const students = (payload.students ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        portion: isMealPortion(entry.portion) ? entry.portion : 'ALL',
        notes: asString(entry.notes) || undefined,
      }));

      const result = await service.recordBulkMeals({
        tenantId,
        courseId,
        date,
        mealItemId: asString(payload.mealItemId) || undefined,
        mealType,
        students,
      });
      return NextResponse.json({ success: result.blocked === 0, result }, { headers: CARE_PRIVATE_HEADERS });
    }

    if (action === 'hygiene') {
      const hygieneEntries = (payload.hygieneEntries ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        type: isHygieneType(entry.type) ? entry.type : 'TOILET',
        notes: asString(entry.notes) || undefined,
      }));

      const result = await service.recordBulkHygiene({ tenantId, courseId, date, hygieneEntries });
      return NextResponse.json({ success: result.blocked === 0, result }, { headers: CARE_PRIVATE_HEADERS });
    }

    const napEntries = (payload.napEntries ?? []).map((entry) => ({
      studentPartyId: asString(entry.studentPartyId),
      quality: isNapQuality(entry.quality) ? entry.quality : 'DEEP',
      notes: asString(entry.notes) || undefined,
    }));

    const result = await service.recordBulkNap({ tenantId, courseId, date, napEntries });
    return NextResponse.json({ success: result.blocked === 0, result }, { headers: CARE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof CareAccessError ? error.code : 'CARE_DEPENDENCY_UNAVAILABLE' }, {
      status: error instanceof CareAccessError ? error.status : 503, headers: CARE_PRIVATE_HEADERS,
    });
  }
}
