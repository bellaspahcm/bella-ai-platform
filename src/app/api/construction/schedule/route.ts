import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import {
  isRecord,
  parseScheduleItem,
  parseScheduleItems,
  type ConstructionAssigneeChoice,
  type ConstructionProjectChoice,
  type ConstructionSiteChoice,
  type ConstructionWorkPackageChoice,
} from '@/platform/construction/schedule.contract';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const forbiddenHeaders = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-mock-role', 'x-tenant-id', 'x-user-id', 'x-actor-id'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

interface RpcError { readonly code?: string; readonly message?: string }
interface RpcResponse { readonly data: unknown; readonly error: RpcError | null }
interface ScheduleRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>;
}

function failure(code: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: code }, { status, headers: privateHeaders });
}

function uuid(value: string | null): value is string {
  return value !== null && uuidPattern.test(value);
}

function singleRow(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return value;
}

function parseProjectChoices(value: unknown): ConstructionProjectChoice[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionProjectChoice[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== 'string' || !uuidPattern.test(row.id)
      || typeof row.project_code !== 'string' || typeof row.name !== 'string') return null;
    rows.push({ id: row.id, project_code: row.project_code, name: row.name });
  }
  return rows;
}

function parseSiteChoices(value: unknown): ConstructionSiteChoice[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionSiteChoice[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== 'string' || !uuidPattern.test(row.id)
      || typeof row.project_id !== 'string' || !uuidPattern.test(row.project_id)
      || typeof row.org_unit_id !== 'string' || !uuidPattern.test(row.org_unit_id)
      || typeof row.site_code !== 'string' || typeof row.name !== 'string') return null;
    rows.push({ id: row.id, project_id: row.project_id, org_unit_id: row.org_unit_id, site_code: row.site_code, name: row.name });
  }
  return rows;
}

function parseWorkPackageChoices(value: unknown): ConstructionWorkPackageChoice[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionWorkPackageChoice[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== 'string' || !uuidPattern.test(row.id)
      || typeof row.project_id !== 'string' || !uuidPattern.test(row.project_id)
      || typeof row.site_id !== 'string' || !uuidPattern.test(row.site_id)
      || typeof row.org_unit_id !== 'string' || !uuidPattern.test(row.org_unit_id)
      || typeof row.work_package_code !== 'string' || typeof row.name !== 'string') return null;
    rows.push({ id: row.id, project_id: row.project_id, site_id: row.site_id, org_unit_id: row.org_unit_id, work_package_code: row.work_package_code, name: row.name });
  }
  return rows;
}

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw new Error('INVALID_REQUEST');
  }
  const raw = await request.text();
  if (raw.length > 8192) throw new Error('INVALID_REQUEST');
  try { return JSON.parse(raw) as unknown; } catch { throw new Error('INVALID_REQUEST'); }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function resolveRequest(request: Request) {
  if (forbiddenHeaders.some((name) => request.headers.has(name))) {
    return { ok: false as const, response: failure('CONSTRUCTION_ACCESS_DENIED', 403) };
  }
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return { ok: false as const, response: failure('CONSTRUCTION_UNAUTHENTICATED', 401) };
  }
  try {
    const client = await createClient();
    const auth = authorization ? await client.auth.getUser(authorization.slice(7)) : await client.auth.getUser();
    if (auth.error || !auth.data.user) {
      return { ok: false as const, response: failure('CONSTRUCTION_UNAUTHENTICATED', 401) };
    }
    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) return { ok: false as const, response: failure('CONSTRUCTION_UNAVAILABLE', 503) };
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id) return { ok: false as const, response: failure('CONSTRUCTION_ACCESS_DENIED', 403) };
    return {
      ok: true as const,
      client,
      rpc: client as unknown as ScheduleRpcClient,
      actor,
      tenantId: actor.tenant_id,
      authorization: new SupabasePlatformActionAuthorization(client as unknown as SupabaseClient<Database>),
    };
  } catch {
    return { ok: false as const, response: failure('CONSTRUCTION_UNAVAILABLE', 503) };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  const params = new URL(request.url).searchParams;
  const allowedParams = ['project_id', 'site_id', 'work_package_id'];
  if ([...params.keys()].some((key) => !allowedParams.includes(key) || params.getAll(key).length !== 1)) {
    return failure('CONSTRUCTION_INVALID_REQUEST', 400);
  }
  const projectId = params.get('project_id');
  const siteId = params.get('site_id');
  const workPackageId = params.get('work_package_id');
  if (projectId && !uuid(projectId) || siteId && !uuid(siteId) || workPackageId && !uuid(workPackageId)
    || (projectId && siteId) || (workPackageId && !siteId)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);

  try {
    if (!projectId && !siteId && !workPackageId) {
      const decision = await context.authorization.authorize({
        permissionId: 'construction:foundation:read',
        tenantId: context.tenantId,
      });
      if (decision.status === 'UNAVAILABLE') return failure('CONSTRUCTION_UNAVAILABLE', 503);
      if (decision.status !== 'ALLOW') return failure('CONSTRUCTION_ACCESS_DENIED', 403);
    }
    const args: Record<string, unknown> = projectId
      ? { p_project_id: projectId }
      : siteId ? { p_site_id: siteId }
        : workPackageId ? { p_work_package_id: workPackageId }
          : { p_project_id: null };
    const rpcName = projectId ? 'construction_list_sites'
      : siteId ? 'construction_list_work_packages'
        : workPackageId ? 'construction_list_schedule_items'
          : 'construction_list_projects';
    const result = await context.rpc.rpc(rpcName, args);
    if (result.error) return failure(result.error.code === '42501' ? 'CONSTRUCTION_ACCESS_DENIED' : 'CONSTRUCTION_UNAVAILABLE', result.error.code === '42501' ? 403 : 503);

    if (projectId) {
      const rows = parseSiteChoices(result.data);
      if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, sites: rows }, { headers: privateHeaders });
    }
    if (siteId && !workPackageId) {
      const rows = parseWorkPackageChoices(result.data);
      if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, workPackages: rows }, { headers: privateHeaders });
    }
    if (workPackageId && siteId) {
      const packages = parseWorkPackageChoices(result.data);
      if (!packages) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const workPackage = packages.find((row) => row.id === workPackageId);
      if (!workPackage) return failure('CONSTRUCTION_NOT_FOUND', 404);
      const readDecision = await context.authorization.authorize({
        permissionId: 'construction:foundation:read',
        tenantId: context.tenantId,
        orgUnitId: workPackage.org_unit_id,
      });
      if (readDecision.status === 'UNAVAILABLE') return failure('CONSTRUCTION_UNAVAILABLE', 503);
      if (readDecision.status !== 'ALLOW') return failure('CONSTRUCTION_ACCESS_DENIED', 403);
      const decision = await context.authorization.authorize({
        permissionId: 'construction:work_package:write',
        tenantId: context.tenantId,
        orgUnitId: workPackage.org_unit_id,
      });
      if (decision.status === 'UNAVAILABLE') return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const itemsResponse = await context.rpc.rpc('construction_list_schedule_items', { p_work_package_id: workPackageId });
      if (itemsResponse.error) return failure(itemsResponse.error.code === '42501' ? 'CONSTRUCTION_ACCESS_DENIED' : 'CONSTRUCTION_UNAVAILABLE', itemsResponse.error.code === '42501' ? 403 : 503);
      const items = parseScheduleItems(itemsResponse.data);
      if (!items) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const assignedUserIds = [...new Set(items.flatMap((item) => item.responsible_user_id ? [item.responsible_user_id] : []))];
      const assigneesResult = decision.status === 'ALLOW'
        ? await context.client.from('users').select('id,full_name')
          .eq('tenant_id', context.tenantId).eq('status', 'active').order('full_name')
        : assignedUserIds.length > 0
          ? await context.client.from('users').select('id,full_name')
            .eq('tenant_id', context.tenantId).eq('status', 'active').in('id', assignedUserIds)
          : { data: [], error: null };
      if (assigneesResult.error) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const assignees: ConstructionAssigneeChoice[] = [];
      for (const user of assigneesResult.data ?? []) {
        if (typeof user.id !== 'string' || !uuidPattern.test(user.id) || typeof user.full_name !== 'string') {
          return failure('CONSTRUCTION_UNAVAILABLE', 503);
        }
        assignees.push({ id: user.id, full_name: user.full_name });
      }
      return NextResponse.json({ success: true, scheduleItems: items, assignees, canWrite: decision.status === 'ALLOW' }, { headers: privateHeaders });
    }
    const rows = parseProjectChoices(result.data);
    if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    return NextResponse.json({ success: true, projects: rows }, { headers: privateHeaders });
  } catch {
    return failure('CONSTRUCTION_UNAVAILABLE', 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  try {
    const body = await readJson(request);
    if (!isRecord(body) || !hasOnlyKeys(body, ['workPackageId', 'title', 'baselineStartDate', 'baselineEndDate', 'responsibleUserId', 'predecessorScheduleItemId'])
      || !uuidPattern.test(String(body.workPackageId ?? '')) || typeof body.title !== 'string' || !body.title.trim()
      || typeof body.baselineStartDate !== 'string' || !datePattern.test(body.baselineStartDate)
      || typeof body.baselineEndDate !== 'string' || !datePattern.test(body.baselineEndDate)
      || !isCalendarDate(body.baselineStartDate) || !isCalendarDate(body.baselineEndDate)
      || body.baselineStartDate > body.baselineEndDate
      || (body.responsibleUserId !== null && body.responsibleUserId !== undefined && !uuidPattern.test(String(body.responsibleUserId)))
      || (body.predecessorScheduleItemId !== null && body.predecessorScheduleItemId !== undefined && !uuidPattern.test(String(body.predecessorScheduleItemId)))) {
      return failure('CONSTRUCTION_INVALID_REQUEST', 400);
    }
    const result = await context.rpc.rpc('construction_create_schedule_item_with_details', {
      p_work_package_id: body.workPackageId,
      p_title: body.title.trim(),
      p_baseline_start_date: body.baselineStartDate,
      p_baseline_end_date: body.baselineEndDate,
      p_responsible_user_id: body.responsibleUserId ?? null,
      p_predecessor_schedule_item_id: body.predecessorScheduleItemId ?? null,
    });
    if (result.error) return mapMutationError(result.error);
    const item = parseScheduleItem(singleRow(result.data));
    if (!item) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    return NextResponse.json({ success: true, scheduleItem: item }, { status: 201, headers: privateHeaders });
  } catch (error) {
    return failure(error instanceof Error && error.message === 'INVALID_REQUEST' ? 'CONSTRUCTION_INVALID_REQUEST' : 'CONSTRUCTION_UNAVAILABLE', error instanceof Error && error.message === 'INVALID_REQUEST' ? 400 : 503);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  try {
    const body = await readJson(request);
    if (!isRecord(body) || !hasOnlyKeys(body, ['scheduleItemId', 'forecastStartDate', 'forecastEndDate', 'actualStartDate', 'actualEndDate', 'progressPercent', 'delayReason', 'responsibleUserId', 'predecessorScheduleItemId'])
      || !uuidPattern.test(String(body.scheduleItemId ?? ''))
      || typeof body.forecastStartDate !== 'string' || !datePattern.test(body.forecastStartDate)
      || typeof body.forecastEndDate !== 'string' || !datePattern.test(body.forecastEndDate)
      || !isCalendarDate(body.forecastStartDate) || !isCalendarDate(body.forecastEndDate)
      || body.forecastStartDate > body.forecastEndDate
      || (body.actualStartDate !== null && body.actualStartDate !== undefined && (typeof body.actualStartDate !== 'string' || !datePattern.test(body.actualStartDate) || !isCalendarDate(body.actualStartDate)))
      || (body.actualEndDate !== null && body.actualEndDate !== undefined && (typeof body.actualEndDate !== 'string' || !datePattern.test(body.actualEndDate) || !isCalendarDate(body.actualEndDate)))
      || (typeof body.actualStartDate === 'string' && typeof body.actualEndDate === 'string' && body.actualStartDate > body.actualEndDate)
      || typeof body.progressPercent !== 'number' || !Number.isFinite(body.progressPercent) || body.progressPercent < 0 || body.progressPercent > 100
      || (body.delayReason !== null && body.delayReason !== undefined && typeof body.delayReason !== 'string')
      || (body.responsibleUserId !== null && body.responsibleUserId !== undefined && !uuidPattern.test(String(body.responsibleUserId)))
      || (body.predecessorScheduleItemId !== null && body.predecessorScheduleItemId !== undefined && !uuidPattern.test(String(body.predecessorScheduleItemId)))) {
      return failure('CONSTRUCTION_INVALID_REQUEST', 400);
    }
    const result = await context.rpc.rpc('construction_update_schedule_item_with_details', {
      p_schedule_item_id: body.scheduleItemId,
      p_forecast_start_date: body.forecastStartDate,
      p_forecast_end_date: body.forecastEndDate,
      p_actual_start_date: body.actualStartDate ?? null,
      p_actual_end_date: body.actualEndDate ?? null,
      p_progress_percent: body.progressPercent,
      p_delay_reason: body.delayReason ?? null,
      p_responsible_user_id: body.responsibleUserId ?? null,
      p_predecessor_schedule_item_id: body.predecessorScheduleItemId ?? null,
    });
    if (result.error) return mapMutationError(result.error);
    const item = parseScheduleItem(singleRow(result.data));
    if (!item) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    return NextResponse.json({ success: true, scheduleItem: item }, { headers: privateHeaders });
  } catch (error) {
    return failure(error instanceof Error && error.message === 'INVALID_REQUEST' ? 'CONSTRUCTION_INVALID_REQUEST' : 'CONSTRUCTION_UNAVAILABLE', error instanceof Error && error.message === 'INVALID_REQUEST' ? 400 : 503);
  }
}

function mapMutationError(error: RpcError): NextResponse {
  if (error.code === '42501') return failure('CONSTRUCTION_ACCESS_DENIED', 403);
  if (error.code === 'P0002') return failure('CONSTRUCTION_NOT_FOUND', 404);
  if (error.code === '23514') return failure('CONSTRUCTION_SCHEDULE_CONSTRAINT', 422);
  return failure('CONSTRUCTION_UNAVAILABLE', 503);
}

export async function PUT(): Promise<NextResponse> { return failure('METHOD_NOT_ALLOWED', 405); }
export async function DELETE(): Promise<NextResponse> { return failure('METHOD_NOT_ALLOWED', 405); }
