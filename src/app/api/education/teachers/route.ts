import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { PreschoolTeacherContractError } from '@/platform/education/contracts/teacher-assignment.contract';
import { PreschoolTeacherContractImpl } from '@/platform/education/contracts/preschool-teacher.contract.impl';
import { PreschoolChainError, PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import { PreschoolTeacherProductService } from '@/products/bella-education/services/preschool-teacher.service';
import type { Database } from '@/types/database.types';
import { resolvePreschoolTeacherContext, TEACHER_PRIVATE_HEADERS, teacherFailure } from './request-context';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function operationClient(): SupabaseClient<Database> | null {
  const url = getSupabaseAdminUrl();
  const key = getSupabaseAdminKey();
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function exactParams(params: URLSearchParams, keys: readonly string[]): boolean {
  const actual = [...params.keys()];
  return actual.length === keys.length && keys.every(key => params.getAll(key).length === 1)
    && actual.every(key => keys.includes(key));
}
function unsigned(value: string | null): number | null {
  return value !== null && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : null;
}
function getQueryContext(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = params.get('view');
  const keys = view === 'classes' ? ['view', 'branchId']
    : view === 'candidates' ? ['view', 'branchId', 'query', 'confirmedOnly', 'onDate', 'offset', 'limit']
      : view === 'assignments' ? ['view', 'branchId', 'courseId', 'onDate', 'offset', 'limit'] : [];
  if (!keys.length || !exactParams(params, keys)) return null;
  const branchId = params.get('branchId');
  if (!branchId || !UUID.test(branchId)) return null;
  return { view, branchId: branchId.toLowerCase(), params };
}

function makeService(writer: SupabaseClient<Database>, reader: SupabaseClient<Database>) {
  return new PreschoolTeacherProductService(
    new PreschoolTeacherContractImpl(writer),
    new PreschoolChainService(writer),
    new CanonicalCourseCatalogContractImpl(reader),
  );
}

function mapFailure(error: unknown): NextResponse {
  if (error instanceof PreschoolTeacherContractError) return teacherFailure(error.code, error.status);
  if (error instanceof PreschoolChainError && error.status === 403) {
    return teacherFailure('PRESCHOOL_TEACHER_ACCESS_DENIED', 403);
  }
  if (error instanceof SyntaxError) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
}

export async function GET(request: Request) {
  const auth = await resolvePreschoolTeacherContext(request);
  if (!auth.allowed) return auth.response;
  const query = getQueryContext(request);
  if (!query) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
  const writer = operationClient();
  if (!writer) return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  const context = { tenantId: auth.tenantId, actorId: auth.actor.id, branchId: query.branchId };
  const service = makeService(writer, auth.client);
  try {
    if (query.view === 'classes') {
      const classes = await service.listMappedClasses(context);
      return NextResponse.json({ success: true, tenantId: context.tenantId,
        branchId: context.branchId, classes }, { headers: TEACHER_PRIVATE_HEADERS });
    }
    const onDate = query.params.get('onDate');
    const offset = unsigned(query.params.get('offset'));
    const limit = unsigned(query.params.get('limit'));
    if (!onDate || offset === null || limit === null) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    if (query.view === 'candidates') {
      const confirmed = query.params.get('confirmedOnly');
      if (confirmed !== 'true' && confirmed !== 'false') return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
      const page = await service.listCandidates(context, query.params.get('query') ?? '', confirmed === 'true',
        onDate, offset, limit);
      return NextResponse.json({ success: true, page }, { headers: TEACHER_PRIVATE_HEADERS });
    }
    const courseId = query.params.get('courseId');
    if (!courseId || !UUID.test(courseId)) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    const page = await service.listCourseTeachers(context, courseId, onDate, offset, limit);
    return NextResponse.json({ success: true, page }, { headers: TEACHER_PRIVATE_HEADERS });
  } catch (error) { return mapFailure(error); }
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.body || request.body.locked || request.bodyUsed) throw new SyntaxError('INVALID_BODY');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8_192) throw new SyntaxError('BODY_TOO_LARGE');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new SyntaxError('INVALID_BODY');
  } finally { reader.releaseLock(); }
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw new SyntaxError('INVALID_FIELD');
  return value;
}
function nullableString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value !== null && typeof value !== 'string') throw new SyntaxError('INVALID_FIELD');
  return value;
}

export async function POST(request: Request) {
  const auth = await resolvePreschoolTeacherContext(request);
  if (!auth.allowed) return auth.response;
  try {
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    }
    const body = await readBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    }
    const action = (body as Record<string, unknown>).action;
    const keys = action === 'confirm'
      ? ['action', 'branchId', 'operationKey', 'teacherPartyId', 'validFrom', 'validTo', 'attestation']
      : action === 'revoke' ? ['action', 'branchId', 'confirmationId', 'reason']
        : action === 'assign' ? ['action', 'branchId', 'operationKey', 'courseId', 'confirmationId',
          'teacherPartyId', 'role', 'academicYear', 'effectiveStartDate', 'effectiveEndDate']
          : action === 'terminate' ? ['action', 'branchId', 'courseId', 'assignmentId', 'endDate'] : [];
    if (!keys.length || !exactBody(body, keys)) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    const branchId = requiredString(body, 'branchId');
    if (!UUID.test(branchId)) return teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    const writer = operationClient();
    if (!writer) return teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
    const context = { tenantId: auth.tenantId, actorId: auth.actor.id, branchId: branchId.toLowerCase() };
    const service = makeService(writer, auth.client);
    if (action === 'confirm') {
      const confirmation = await service.confirm(context, {
        operationKey: requiredString(body, 'operationKey'), teacherPartyId: requiredString(body, 'teacherPartyId'),
        validFrom: requiredString(body, 'validFrom'), validTo: nullableString(body, 'validTo'),
        attestation: requiredString(body, 'attestation'),
      });
      return NextResponse.json({ success: true, confirmation }, { status: 201, headers: TEACHER_PRIVATE_HEADERS });
    }
    if (action === 'revoke') {
      const confirmation = await service.revoke(context, {
        confirmationId: requiredString(body, 'confirmationId'), reason: requiredString(body, 'reason'),
      });
      return NextResponse.json({ success: true, confirmation }, { headers: TEACHER_PRIVATE_HEADERS });
    }
    if (action === 'assign') {
      const assignment = await service.assign(context, {
        operationKey: requiredString(body, 'operationKey'), courseId: requiredString(body, 'courseId'),
        confirmationId: requiredString(body, 'confirmationId'), teacherPartyId: requiredString(body, 'teacherPartyId'),
        role: requiredString(body, 'role') as Parameters<typeof service.assign>[1]['role'],
        academicYear: requiredString(body, 'academicYear'), effectiveStartDate: requiredString(body, 'effectiveStartDate'),
        effectiveEndDate: nullableString(body, 'effectiveEndDate'),
      });
      return NextResponse.json({ success: true, assignment }, { status: 201, headers: TEACHER_PRIVATE_HEADERS });
    }
    const assignment = await service.terminate(context, {
      courseId: requiredString(body, 'courseId'), assignmentId: requiredString(body, 'assignmentId'),
      endDate: requiredString(body, 'endDate'),
    });
    return NextResponse.json({ success: true, assignment }, { headers: TEACHER_PRIVATE_HEADERS });
  } catch (error) { return mapFailure(error); }
}
