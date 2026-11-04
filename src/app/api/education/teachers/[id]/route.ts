import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { resolvePreschoolTeacherContext, TEACHER_PRIVATE_HEADERS, teacherFailure } from '../request-context';
import { loadTeacher360Profile, updateTeacher360Profile, Teacher360ReadError, type UpdateTeacher360ProfileInput } from '../teacher-360.service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RouteContext = { params: { id: string } | Promise<{ id: string }> };

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

function operationClient(): SupabaseClient<Database> | null {
  const url = getSupabaseAdminUrl();
  const key = getSupabaseAdminKey();
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await resolvePreschoolTeacherContext(request);
  if (!auth.allowed) return auth.response;

  const resolvedParams = await params;
  const teacherId = resolvedParams?.id;
  if (!teacherId || !UUID.test(teacherId)) {
    return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  }

  const client = operationClient();
  if (!client) return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);

  try {
    const profile = await loadTeacher360Profile(
      client,
      auth.tenantId,
      auth.actor.id,
      teacherId.toLowerCase()
    );
    return NextResponse.json({ success: true, profile }, { headers: TEACHER_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Teacher360ReadError) {
      return teacherFailure(error.code, error.status);
    }
    return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await resolvePreschoolTeacherContext(request);
  if (!auth.allowed) return auth.response;

  const resolvedParams = await params;
  const teacherId = resolvedParams?.id;
  if (!teacherId || !UUID.test(teacherId)) {
    return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  }

  if (!isRecord(body)) {
    return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  }

  const allowedKeys = [
    'name', 'phone', 'email', 'address', 'joinedDate',
    'degree', 'totalExperience', 'workloadHours', 'compliance'
  ];

  if (Object.keys(body).some(key => !allowedKeys.includes(key))) {
    return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  }

  const input: Mutable<UpdateTeacher360ProfileInput> = {};

  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (!trimmed || trimmed.length > 120) {
      return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    }
    input.name = trimmed;
  }

  if (typeof body.phone === 'string') input.phone = body.phone.trim();
  if (typeof body.email === 'string') input.email = body.email.trim();
  if (typeof body.address === 'string') input.address = body.address.trim();
  if (typeof body.joinedDate === 'string') input.joinedDate = body.joinedDate.trim();
  if (typeof body.degree === 'string') input.degree = body.degree.trim();
  if (typeof body.totalExperience === 'string') input.totalExperience = body.totalExperience.trim();
  if (typeof body.workloadHours === 'number') input.workloadHours = Math.max(0, Math.min(40, body.workloadHours));

  if (isRecord(body.compliance)) {
    const raw = body.compliance;
    const firstAid = raw.firstAidWarning;
    input.compliance = {
      officialRecords: Boolean(raw.officialRecords),
      healthCheck: Boolean(raw.healthCheck),
      firstAidWarning: firstAid === 'valid' || firstAid === 'warning' ? firstAid : 'unknown',
    };
  }

  const client = operationClient();
  if (!client) return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);

  try {
    const updated = await updateTeacher360Profile(
      client,
      auth.tenantId,
      auth.actor.id,
      teacherId.toLowerCase(),
      input
    );
    return NextResponse.json({ success: true, profile: updated }, { headers: TEACHER_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Teacher360ReadError) {
      return teacherFailure(error.code, error.status);
    }
    return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  }
}
