import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { AttendanceProductService } from '@/products/bella-education/services/attendance.service';
import { PreschoolGuardianAuthorizationService } from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import {
  EducationSecurityGuardService,
  type EducationRole,
  type SecurityUserContext,
} from '@/products/bella-education/security/education-security-guard.service';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type EducationAttendanceClient = SupabaseClient<Database>;

interface RequestContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: string;
}

const attendanceGuard = new EducationSecurityGuardService();

function isAttendanceStatus(value: unknown): value is EducationAttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'excused';
}

function isSchoolDay(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function resolveRollCallTime(schoolDay: string, explicitRollCallTime?: unknown): string {
  if (typeof explicitRollCallTime === 'string' && explicitRollCallTime.trim()) {
    const date = new Date(explicitRollCallTime);
    if (Number.isNaN(date.getTime())) {
      throw new Error('INVALID_ROLL_CALL_TIME');
    }

    return date.toISOString();
  }

  return new Date(`${schoolDay}T05:00:00.000Z`).toISOString();
}

function createDevMockClient(mockEmail: string): EducationAttendanceClient | null {
  if (!mockEmail) return null;
  return createAdminOperationClient();
}

function createAdminOperationClient(): EducationAttendanceClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapBellaAttendanceRole(role: string): EducationRole | null {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'admin' || normalizedRole === 'super_admin') return 'PRINCIPAL';
  if (normalizedRole === 'admin_staff') return 'TEACHER';
  return null;
}

function assertCanUseAttendanceRoster(context: RequestContext): void {
  const educationRole = mapBellaAttendanceRole(context.role);
  if (!educationRole) {
    throw new Error(
      `AUTH_ROLE_PERMISSION_ERROR: Role '${context.role || 'unknown'}' is forbidden from modifying class attendance rosters`
    );
  }

  const securityContext: SecurityUserContext = {
    userId: context.userId,
    tenantId: context.tenantId,
    role: educationRole,
  };

  attendanceGuard.assertCanModifyAttendanceRoster(securityContext);
}

async function resolveRequestContext(request: Request): Promise<RequestContext | null> {
  const mockEmail = process.env.NODE_ENV === 'development'
    ? request.headers.get('x-mock-user-email')?.trim()
    : '';

  if (mockEmail) {
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('email', mockEmail)
      .maybeSingle();

    if (user?.id && user.tenant_id && user.role) {
      return {
        tenantId: user.tenant_id,
        userId: user.id,
        role: user.role,
      };
    }
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.id || !currentUser.tenant_id || !currentUser.role) {
    if (process.env.NODE_ENV === 'development') {
      return {
        tenantId: 'ed100000-0000-0000-0000-000000000001',
        userId: 'ed000000-0000-0000-0000-000000000001',
        role: 'admin',
      };
    }
    return null;
  }

  const effectiveTenantId = (process.env.NODE_ENV === 'development' && currentUser.tenant_id === '00000000-0000-0000-0000-000000000001')
    ? 'ed100000-0000-0000-0000-000000000001'
    : currentUser.tenant_id;

  return {
    tenantId: effectiveTenantId,
    userId: currentUser.id,
    role: currentUser.role,
  };
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
    const mockEmail = request.headers.get('x-mock-user-email')?.trim() ?? '';

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }
    if (!isSchoolDay(schoolDay)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const context = await resolveRequestContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }
    assertCanUseAttendanceRoster(context);

    const supabase = createDevMockClient(mockEmail) ?? createAdminOperationClient() ?? createClient();
    const service = new AttendanceProductService(new AttendanceContractImpl(supabase));
    const roster = await service.getCourseDailyAttendance({ tenantId: context.tenantId, courseId, schoolDay });
    const guardianService = new PreschoolGuardianAuthorizationService(supabase);
    const guardiansByStudent = await guardianService.getAuthorizedGuardians(
      context.tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const handoverService = new PreschoolSafePickupHandoverService(supabase);
    const handoversByStudent = await handoverService.getLatestHandovers(
      context.tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const rosterWithGuardians = roster.map((student) => ({
      ...student,
      authorizedGuardians: guardiansByStudent.get(student.studentPartyId) ?? [],
      safePickupHandover: handoversByStudent.get(student.studentPartyId) ?? null,
    }));

    return NextResponse.json({ success: true, roster: rosterWithGuardians });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: resolveErrorStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mockEmail = request.headers.get('x-mock-user-email')?.trim() ?? '';
    const context = await resolveRequestContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }
    assertCanUseAttendanceRoster(context);

    if (typeof body.enrollmentId !== 'string' || !body.enrollmentId.trim()) {
      return NextResponse.json({ success: false, error: 'enrollmentId is required' }, { status: 400 });
    }
    if (!isAttendanceStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'status must be present, absent, or excused' }, { status: 400 });
    }
    if (!isSchoolDay(typeof body.date === 'string' ? body.date : null)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const supabase = createDevMockClient(mockEmail) ?? createAdminOperationClient() ?? createClient();
    const service = new AttendanceProductService(new AttendanceContractImpl(supabase));
    const attendance = await service.setDailyAttendance({
      tenantId: context.tenantId,
      enrollmentId: body.enrollmentId,
      status: body.status,
      rollCallTime: resolveRollCallTime(body.date, body.rollCallTime),
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: resolveErrorStatus(message) });
  }
}
