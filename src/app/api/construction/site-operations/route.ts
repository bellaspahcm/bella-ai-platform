import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import {
  constructionIssuePermissions,
  constructionSiteDiaryPermissions,
  parseConstructionActivitySites,
  parseConstructionActivityWorkPackages,
  parseConstructionIssue,
  parseConstructionIssues,
  parseConstructionSiteDiaryEntries,
  parseConstructionSiteDiaryEntry,
  type ConstructionIssue,
  type ConstructionSiteDiaryEntry,
  type ConstructionSiteActivityChoice,
  type ConstructionActivityWorkPackageChoice,
} from '@/platform/construction/site-operations.contract';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const forbiddenHeaders = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-mock-role', 'x-tenant-id', 'x-user-id', 'x-actor-id'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

interface RpcError { readonly code?: string; readonly message?: string }
interface RpcResponse { readonly data: unknown; readonly error: RpcError | null }
interface ConstructionRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>;
}

function failure(code: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: code }, { status, headers: privateHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function singleRow(value: unknown): unknown {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
}

function isCalendarDate(value: string): boolean {
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validNullableUuid(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && uuidPattern.test(value));
}

function validNullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && datePattern.test(value) && isCalendarDate(value));
}

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw new Error('INVALID_REQUEST');
  }
  const raw = await request.text();
  if (raw.length > 16384) throw new Error('INVALID_REQUEST');
  try { return JSON.parse(raw) as unknown; } catch { throw new Error('INVALID_REQUEST'); }
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
      rpc: client as unknown as ConstructionRpcClient,
      userId: actor.id,
      tenantId: actor.tenant_id,
      authorization: new SupabasePlatformActionAuthorization(client as unknown as SupabaseClient<Database>),
    };
  } catch {
    return { ok: false as const, response: failure('CONSTRUCTION_UNAVAILABLE', 503) };
  }
}

async function authorize(
  context: { tenantId: string; authorization: SupabasePlatformActionAuthorization },
  permissionId: string,
  site: ConstructionSiteActivityChoice,
): Promise<NextResponse | null> {
  const decision = await context.authorization.authorize({
    permissionId,
    tenantId: context.tenantId,
    orgUnitId: site.org_unit_id,
  });
  if (decision.status === 'UNAVAILABLE') return failure('CONSTRUCTION_UNAVAILABLE', 503);
  if (decision.status !== 'ALLOW') return failure('CONSTRUCTION_ACCESS_DENIED', 403);
  return null;
}

async function accessibleSites(context: { rpc: ConstructionRpcClient }): Promise<ConstructionSiteActivityChoice[] | null> {
  const result = await context.rpc.rpc('construction_list_site_activity_sites');
  if (result.error) return null;
  return parseConstructionActivitySites(result.data);
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== 'site_id' || params.getAll(key).length !== 1)) {
    return failure('CONSTRUCTION_INVALID_REQUEST', 400);
  }
  const siteId = params.get('site_id');
  if (siteId && !uuidPattern.test(siteId)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);

  try {
    const sites = await accessibleSites(context);
    if (!sites) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    if (!siteId) return NextResponse.json({ success: true, sites }, { headers: privateHeaders });
    const site = sites.find((candidate) => candidate.id === siteId);
    if (!site) return failure('CONSTRUCTION_NOT_FOUND', 404);

    const canReadDiary = site.can_view_diary || site.can_update_diary;
    const canReadIssue = site.can_view_issue || site.can_update_issue || site.can_resolve_issue
      || site.can_close_issue || site.can_reopen_issue;
    let diaryEntries: ConstructionSiteDiaryEntry[] = [];
    let issues: ConstructionIssue[] = [];
    let workPackages: ConstructionActivityWorkPackageChoice[] = [];
    if (canReadDiary) {
      const result = await context.rpc.rpc('construction_list_site_diary_entries', { p_site_id: site.id });
      if (result.error) return failure(result.error.code === '42501' ? 'CONSTRUCTION_ACCESS_DENIED' : 'CONSTRUCTION_UNAVAILABLE', result.error.code === '42501' ? 403 : 503);
      const rows = parseConstructionSiteDiaryEntries(result.data);
      if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      diaryEntries = rows;
    }
    if (canReadIssue) {
      const result = await context.rpc.rpc('construction_list_issues', { p_site_id: site.id });
      if (result.error) return failure(result.error.code === '42501' ? 'CONSTRUCTION_ACCESS_DENIED' : 'CONSTRUCTION_UNAVAILABLE', result.error.code === '42501' ? 403 : 503);
      const rows = parseConstructionIssues(result.data);
      if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      issues = rows;
    }
    if (canReadDiary || site.can_create_diary || canReadIssue || site.can_create_issue) {
      const result = await context.rpc.rpc('construction_list_activity_work_packages', { p_site_id: site.id });
      if (result.error) return failure(result.error.code === '42501' ? 'CONSTRUCTION_ACCESS_DENIED' : 'CONSTRUCTION_UNAVAILABLE', result.error.code === '42501' ? 403 : 503);
      const rows = parseConstructionActivityWorkPackages(result.data);
      if (!rows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      workPackages = rows;
    }
    return NextResponse.json({
      success: true,
      site,
      currentUserId: context.userId,
      diaryEntries,
      issues,
      workPackages,
    }, { headers: privateHeaders });
  } catch {
    return failure('CONSTRUCTION_UNAVAILABLE', 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  try {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.kind !== 'string' || typeof body.siteId !== 'string'
      || !uuidPattern.test(body.siteId)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
    const sites = await accessibleSites(context);
    if (!sites) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    const site = sites.find((candidate) => candidate.id === body.siteId);
    if (!site) return failure('CONSTRUCTION_NOT_FOUND', 404);

    if (body.kind === 'diary') {
      if (!onlyKeys(body, ['kind', 'siteId', 'entryDate', 'workPackageId', 'content'])
        || typeof body.entryDate !== 'string' || !datePattern.test(body.entryDate) || !isCalendarDate(body.entryDate)
        || !validNullableUuid(body.workPackageId) || typeof body.content !== 'string'
        || !body.content.trim() || body.content.length > 10000) {
        return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      }
      const denied = await authorize(context, constructionSiteDiaryPermissions.create, site);
      if (denied) return denied;
      const result = await context.rpc.rpc('construction_create_site_diary_entry', {
        p_site_id: site.id,
        p_entry_date: body.entryDate,
        p_work_package_id: body.workPackageId,
        p_content: body.content.trim(),
      });
      if (result.error) return mapMutationError(result.error);
      const diaryEntry = parseConstructionSiteDiaryEntry(singleRow(result.data));
      if (!diaryEntry) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, diaryEntry }, { status: 201, headers: privateHeaders });
    }

    if (body.kind === 'issue') {
      if (!onlyKeys(body, ['kind', 'siteId', 'title', 'description', 'dueDate', 'diaryEntryId', 'workPackageId'])
        || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 250
        || typeof body.description !== 'string' || !body.description.trim() || body.description.length > 10000
        || !validNullableDate(body.dueDate) || !validNullableUuid(body.diaryEntryId)
        || !validNullableUuid(body.workPackageId)) {
        return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      }
      const denied = await authorize(context, constructionIssuePermissions.create, site);
      if (denied) return denied;
      const result = await context.rpc.rpc('construction_create_issue', {
        p_site_id: site.id,
        p_title: body.title.trim(),
        p_description: body.description.trim(),
        p_due_date: body.dueDate,
        p_diary_entry_id: body.diaryEntryId,
        p_work_package_id: body.workPackageId,
      });
      if (result.error) return mapMutationError(result.error);
      const issue = parseConstructionIssue(singleRow(result.data));
      if (!issue) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, issue }, { status: 201, headers: privateHeaders });
    }

    return failure('CONSTRUCTION_INVALID_REQUEST', 400);
  } catch (error) {
    return failure(error instanceof Error && error.message === 'INVALID_REQUEST' ? 'CONSTRUCTION_INVALID_REQUEST' : 'CONSTRUCTION_UNAVAILABLE',
      error instanceof Error && error.message === 'INVALID_REQUEST' ? 400 : 503);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const context = await resolveRequest(request);
  if (!context.ok) return context.response;
  try {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.kind !== 'string' || typeof body.siteId !== 'string'
      || !uuidPattern.test(body.siteId)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
    const sites = await accessibleSites(context);
    if (!sites) return failure('CONSTRUCTION_UNAVAILABLE', 503);
    const site = sites.find((candidate) => candidate.id === body.siteId);
    if (!site) return failure('CONSTRUCTION_NOT_FOUND', 404);

    if (body.kind === 'diary') {
      if (!onlyKeys(body, ['kind', 'siteId', 'entryId', 'entryDate', 'workPackageId', 'content'])
        || typeof body.entryId !== 'string' || !uuidPattern.test(body.entryId)
        || typeof body.entryDate !== 'string' || !datePattern.test(body.entryDate) || !isCalendarDate(body.entryDate)
        || !validNullableUuid(body.workPackageId) || typeof body.content !== 'string'
        || !body.content.trim() || body.content.length > 10000) {
        return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      }
      const existingResponse = await context.rpc.rpc('construction_list_site_diary_entries', { p_site_id: site.id });
      if (existingResponse.error) return mapMutationError(existingResponse.error);
      const existingRows = parseConstructionSiteDiaryEntries(existingResponse.data);
      if (!existingRows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const existing = existingRows.find((row) => row.id === body.entryId);
      if (!existing) return failure('CONSTRUCTION_NOT_FOUND', 404);
      const denied = await authorize(context, constructionSiteDiaryPermissions.update, site);
      if (denied) return denied;
      const result = await context.rpc.rpc('construction_update_site_diary_entry', {
        p_entry_id: existing.id,
        p_entry_date: body.entryDate,
        p_work_package_id: body.workPackageId,
        p_content: body.content.trim(),
      });
      if (result.error) return mapMutationError(result.error);
      const diaryEntry = parseConstructionSiteDiaryEntry(singleRow(result.data));
      if (!diaryEntry) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, diaryEntry }, { headers: privateHeaders });
    }

    if (body.kind === 'issue') {
      if (typeof body.issueId !== 'string' || !uuidPattern.test(body.issueId) || typeof body.action !== 'string') {
        return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      }
      const listResponse = await context.rpc.rpc('construction_list_issues', { p_site_id: site.id });
      if (listResponse.error) return mapMutationError(listResponse.error);
      const issueRows = parseConstructionIssues(listResponse.data);
      if (!issueRows) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      const existing = issueRows.find((row) => row.id === body.issueId);
      if (!existing) return failure('CONSTRUCTION_NOT_FOUND', 404);

      if (body.action === 'update') {
        if (!onlyKeys(body, ['kind', 'siteId', 'issueId', 'action', 'title', 'description', 'dueDate', 'diaryEntryId', 'workPackageId'])
          || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 250
          || typeof body.description !== 'string' || !body.description.trim() || body.description.length > 10000
          || !validNullableDate(body.dueDate) || !validNullableUuid(body.diaryEntryId)
          || !validNullableUuid(body.workPackageId)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
        const denied = await authorize(context, constructionIssuePermissions.update, site);
        if (denied) return denied;
        const result = await context.rpc.rpc('construction_update_issue', {
          p_issue_id: existing.id,
          p_title: body.title.trim(),
          p_description: body.description.trim(),
          p_due_date: body.dueDate,
          p_diary_entry_id: body.diaryEntryId,
          p_work_package_id: body.workPackageId,
        });
        if (result.error) return mapMutationError(result.error);
        const issue = parseConstructionIssue(singleRow(result.data));
        if (!issue) return failure('CONSTRUCTION_UNAVAILABLE', 503);
        return NextResponse.json({ success: true, issue }, { headers: privateHeaders });
      }

      const transitionRules = {
        start: { permissionId: constructionIssuePermissions.update, targetStatus: 'IN_PROGRESS' },
        resolve: { permissionId: constructionIssuePermissions.resolve, targetStatus: 'RESOLVED' },
        close: { permissionId: constructionIssuePermissions.close, targetStatus: 'CLOSED' },
        reopen: { permissionId: constructionIssuePermissions.reopen, targetStatus: 'IN_PROGRESS' },
      } as const;
      if (!Object.prototype.hasOwnProperty.call(transitionRules, body.action)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      const action = body.action as keyof typeof transitionRules;
      const rule = transitionRules[action];
      const allowedKeys = action === 'resolve'
        ? ['kind', 'siteId', 'issueId', 'action', 'resolutionResult']
        : action === 'reopen' ? ['kind', 'siteId', 'issueId', 'action', 'reopenReason']
          : ['kind', 'siteId', 'issueId', 'action'];
      if (!onlyKeys(body, allowedKeys)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      if (action === 'resolve' && (typeof body.resolutionResult !== 'string'
        || !body.resolutionResult.trim() || body.resolutionResult.length > 5000)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      if (action === 'reopen' && (typeof body.reopenReason !== 'string'
        || !body.reopenReason.trim() || body.reopenReason.length > 5000)) return failure('CONSTRUCTION_INVALID_REQUEST', 400);
      const denied = await authorize(context, rule.permissionId, site);
      if (denied) return denied;
      const result = await context.rpc.rpc('construction_transition_issue', {
        p_issue_id: existing.id,
        p_target_status: rule.targetStatus,
        p_resolution_result: action === 'resolve' ? (body.resolutionResult as string).trim() : null,
        p_reopen_reason: action === 'reopen' ? (body.reopenReason as string).trim() : null,
      });
      if (result.error) return mapMutationError(result.error);
      const issue = parseConstructionIssue(singleRow(result.data));
      if (!issue) return failure('CONSTRUCTION_UNAVAILABLE', 503);
      return NextResponse.json({ success: true, issue }, { headers: privateHeaders });
    }

    return failure('CONSTRUCTION_INVALID_REQUEST', 400);
  } catch (error) {
    return failure(error instanceof Error && error.message === 'INVALID_REQUEST' ? 'CONSTRUCTION_INVALID_REQUEST' : 'CONSTRUCTION_UNAVAILABLE',
      error instanceof Error && error.message === 'INVALID_REQUEST' ? 400 : 503);
  }
}

function mapMutationError(error: RpcError): NextResponse {
  if (error.code === '42501') return failure('CONSTRUCTION_ACCESS_DENIED', 403);
  if (error.code === 'P0002') return failure('CONSTRUCTION_NOT_FOUND', 404);
  if (error.code === '23514' || error.code === '23503') return failure('CONSTRUCTION_INVALID_REQUEST', 422);
  return failure('CONSTRUCTION_UNAVAILABLE', 503);
}
