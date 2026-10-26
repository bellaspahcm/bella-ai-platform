import { PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import { PreschoolAttendanceAccessService } from '@/products/bella-education/services/preschool-attendance-access.service';
import { PreschoolAttendanceCommandService } from '@/products/bella-education/services/preschool-attendance-command.service';
import { EducationAttendanceCommandError } from '@/platform/education/contracts/attendance-command.contract';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { AttendanceProductService } from '@/products/bella-education/services/attendance.service';
import { PreschoolGuardianAuthorizationService } from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import {
  ATTENDANCE_PRIVATE_HEADERS, AttendanceAccessError, authorizeAttendanceCourse,
  assertAttendanceDay, assertAttendanceSelectors, requireSchoolDay,
  resolveAttendanceRequestContext, resolveAttendanceRollCallTime,
} from './request-context';

type EducationAttendanceClient = SupabaseClient<Database>;

function isAttendanceStatus(value: unknown): value is EducationAttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'excused';
}

function createAdminOperationClient(): EducationAttendanceClient | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function resolveErrorStatus(message: string): number {
  if (message === 'INVALID_ROLL_CALL_TIME') return 400;
  if (message.startsWith('AUTH_ROLE_PERMISSION_ERROR')) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const schoolDay = searchParams.get('date');

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }
    const day = requireSchoolDay(schoolDay);
    const context = await resolveAttendanceRequestContext(request);
    await authorizeAttendanceCourse(context, request, courseId, day);

    const trusted = createAdminOperationClient() ?? context.client;
    const service = new AttendanceProductService(new AttendanceContractImpl(context.client));
    const branchScope = new PreschoolAttendanceAccessService(trusted);
    await branchScope.assertCourseAccess(context.tenantId, context.actorId, courseId);
    const roster = await service.getCourseDailyAttendance({ tenantId: context.tenantId, courseId, schoolDay: day });
    for (const row of roster) await branchScope.assertEnrollmentAccess(context.tenantId, context.actorId, row.enrollmentId, row.studentPartyId, courseId);
    // Pickup tables are intentionally not directly selectable by callers.
    // Their existing trusted reader is bounded by the authorized roster and
    // the per-enrollment branch checks above; no table grant is added.
    const guardianService = new PreschoolGuardianAuthorizationService(trusted);
    const guardiansByStudent = await guardianService.getAuthorizedGuardians(
      context.tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const handoverService = new PreschoolSafePickupHandoverService(trusted);
    const handoversByStudent = await handoverService.getLatestHandovers(
      context.tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const rosterWithGuardians = roster.map((student) => ({
      ...student,
      authorizedGuardians: guardiansByStudent.get(student.studentPartyId) ?? [],
      safePickupHandover: handoversByStudent.get(student.studentPartyId) ?? null,
    }));

    return NextResponse.json({ success: true, courseId, schoolDay: day, roster: rosterWithGuardians }, { headers: ATTENDANCE_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof AttendanceAccessError) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status, headers: ATTENDANCE_PRIVATE_HEADERS });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: error instanceof PreschoolChainError || error instanceof EducationAttendanceCommandError ? error.status : resolveErrorStatus(message), headers: ATTENDANCE_PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveAttendanceRequestContext(request);
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AttendanceAccessError(400, 'ATTENDANCE_INVALID_REQUEST');
    }
    const body = value as Record<string, unknown>;

    if (typeof body.enrollmentId !== 'string' || !body.enrollmentId.trim()) {
      return NextResponse.json({ success: false, error: 'enrollmentId is required' }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.enrollmentId)) {
      return NextResponse.json({ success: false, error: 'enrollmentId must be a UUID' }, { status: 400 });
    }
    if (!isAttendanceStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'status must be present, absent, or excused' }, { status: 400 });
    }
    const day = requireSchoolDay(body.date);
    assertAttendanceDay(context, day);
    assertAttendanceSelectors(request, context, { enrollmentId: body.enrollmentId.toLowerCase(), date: day }, {
      ...body, enrollmentId: body.enrollmentId.toLowerCase(),
    });

    const supabase = createAdminOperationClient() ?? await createClient();
    const service = new PreschoolAttendanceCommandService(supabase);
    const attendance = await service.setDailyAttendance({
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      enrollmentId: body.enrollmentId.toLowerCase(),
      status: body.status,
      schoolDay: day,
      rollCallTime: resolveAttendanceRollCallTime(day, body.rollCallTime),
    });

    return NextResponse.json({ success: true, attendance }, { headers: ATTENDANCE_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof AttendanceAccessError) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status, headers: ATTENDANCE_PRIVATE_HEADERS });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: 'ATTENDANCE_INVALID_REQUEST' }, { status: 400, headers: ATTENDANCE_PRIVATE_HEADERS });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: error instanceof PreschoolChainError || error instanceof EducationAttendanceCommandError ? error.status : resolveErrorStatus(message), headers: ATTENDANCE_PRIVATE_HEADERS });
  }
}
