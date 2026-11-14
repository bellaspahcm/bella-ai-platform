/**
 * Bella Interior OS — Server Request Context
 *
 * Canonical auth pattern for all Interior OS API route handlers.
 * Mirrors the pattern established in src/app/api/construction/schedule/route.ts.
 *
 * Security invariants enforced here:
 *   1. Forbidden client-controlled headers are blocked (Gate 0 preamble).
 *   2. Identity verified via auth.getUser() — NOT getSession().
 *   3. Tenant resolved via platform_current_actor_profile RPC — NOT from headers/metadata.
 *   4. auth.id cross-verified with profile.id before tenantId is trusted.
 *
 * @module src/products/bella-interior/lib/server-context
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  reconcileCurrentActorProfile,
  type ActiveCurrentActor,
} from '@/platform/security/current-actor.contract';
import { SupabaseInteriorRoleAuthorization } from './role-authorization';
import { interiorRbacRpcClient } from './rbac-api';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const INTERIOR_PERMISSIONS = {
  projectRead: 'interior:project:read',
  projectCreate: 'interior:project:create',
  projectUpdate: 'interior:project:update',
  projectWrite: 'interior:project:write',
  branchManage: 'interior:branch:manage',
  customerRead: 'interior:customer:read',
  designRead: 'interior:design:read',
  designCreate: 'interior:design:create',
  designUpdate: 'interior:design:update',
  designWrite: 'interior:design:write',
  designApprove: 'interior:design:approve',
  designUpload: 'interior:design:upload',
  boqRead: 'interior:boq:read',
  boqCreate: 'interior:boq:create',
  boqUpdate: 'interior:boq:update',
  boqWrite: 'interior:boq:write',
  boqApprove: 'interior:boq:approve',
  contractRead: 'interior:contract:read',
  contractCreate: 'interior:contract:create',
  contractUpdate: 'interior:contract:update',
  contractWrite: 'interior:contract:write',
  contractApprove: 'interior:contract:approve',
  contractSign: 'interior:contract:sign',
  contractAmend: 'interior:contract:amend',
  financeRead: 'interior:finance:read',
  financeWrite: 'interior:finance:write',
  paymentRecord: 'interior:payment:record',
  paymentApprove: 'interior:payment:approve',
  paymentRefund: 'interior:payment:refund',
  scheduleRead: 'interior:schedule:read',
  scheduleCreate: 'interior:schedule:create',
  scheduleUpdate: 'interior:schedule:update',
  scheduleWrite: 'interior:schedule:write',
  productionRead: 'interior:production:read',
  productionCreate: 'interior:production:create',
  productionUpdate: 'interior:production:update',
  productionWrite: 'interior:production:write',
  productionRelease: 'interior:production_order:release',
  installationRead: 'interior:installation:read',
  installationCreate: 'interior:installation:create',
  installationUpdate: 'interior:installation:update',
  installationWrite: 'interior:installation:write',
  qcRead: 'interior:qc:read',
  qcCreate: 'interior:qc:create',
  qcUpdate: 'interior:qc:update',
  qcWrite: 'interior:qc:write',
  qcApprove: 'interior:qc:approve',
  deliveryRead: 'interior:delivery:read',
  deliveryCreate: 'interior:delivery:create',
  deliveryUpdate: 'interior:delivery:update',
  deliveryWrite: 'interior:delivery:write',
  handoverApprove: 'interior:handover:approve',
  reportsRead: 'interior:reports:read',
  warrantyRead: 'interior:warranty:read',
  warrantyCreate: 'interior:warranty:create',
  warrantyUpdate: 'interior:warranty:update',
  warrantyWrite: 'interior:warranty:write',
  warrantyClose: 'interior:warranty:close',
  usersRead: 'interior:users:read',
  usersManage: 'interior:users:manage',
  rolesRead: 'interior:roles:read',
  rolesAssign: 'interior:roles:assign',
  rolesManage: 'interior:roles:manage',
  auditRead: 'interior:audit:read_limited',
  executiveApprove: 'interior:executive:approve',
} as const;

export type InteriorPermissionId = (typeof INTERIOR_PERMISSIONS)[keyof typeof INTERIOR_PERMISSIONS];

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nestedRecord(value: unknown, key: string): JsonRecord | null {
  if (!isJsonRecord(value)) return null;
  return isJsonRecord(value[key]) ? value[key] as JsonRecord : null;
}

export function requiredInteriorPermission(request: Request, body: JsonRecord | null): InteriorPermissionId | null {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  const isMethod = (...methods: readonly string[]) => methods.includes(method);

  if (pathname === '/api/interior/rbac' && method === 'GET') return INTERIOR_PERMISSIONS.rolesRead;
  if (pathname === '/api/interior/rbac/audit' && method === 'GET') return INTERIOR_PERMISSIONS.auditRead;
  if (pathname === '/api/interior/users' && method === 'GET') return INTERIOR_PERMISSIONS.usersRead;
  if (pathname === '/api/interior/users/invite' && method === 'POST') return INTERIOR_PERMISSIONS.usersManage;
  if (pathname === '/api/interior/users/roles' && method === 'POST') return INTERIOR_PERMISSIONS.rolesAssign;
  if (/^\/api\/interior\/users\/roles\/[^/]+$/.test(pathname) && method === 'DELETE') return INTERIOR_PERMISSIONS.rolesAssign;
  if (pathname === '/api/interior/users/project-assignments' && isMethod('POST', 'DELETE')) return INTERIOR_PERMISSIONS.usersManage;
  if (pathname === '/api/interior/users/delegations' && isMethod('POST', 'DELETE')) return INTERIOR_PERMISSIONS.rolesManage;
  if (pathname === '/api/interior/users/direct-grants' && method === 'POST') return INTERIOR_PERMISSIONS.rolesManage;
  if (/^\/api\/interior\/users\/direct-grants\/[^/]+$/.test(pathname) && method === 'DELETE') return INTERIOR_PERMISSIONS.rolesManage;

  if (pathname === '/api/interior/projects') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.projectRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.projectCreate;
  }
  if (/^\/api\/interior\/projects\/[^/]+$/.test(pathname) && method === 'GET') {
    return INTERIOR_PERMISSIONS.projectRead;
  }
  if (/^\/api\/interior\/projects\/[^/]+\/branch$/.test(pathname) && method === 'PATCH') {
    return INTERIOR_PERMISSIONS.branchManage;
  }
  if (pathname === '/api/interior/customers' && method === 'GET') return INTERIOR_PERMISSIONS.customerRead;
  if (pathname === '/api/interior/design') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.designRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.designCreate;
    if (method === 'PATCH') return INTERIOR_PERMISSIONS.designUpdate;
  }
  if (pathname === '/api/interior/design/revisions') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.designRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.designCreate;
  }
  if (/^\/api\/interior\/design\/revisions\/[^/]+\/approve$/.test(pathname) && method === 'POST') {
    return INTERIOR_PERMISSIONS.designApprove;
  }
  if (/^\/api\/interior\/design\/revisions\/[^/]+$/.test(pathname) && method === 'GET') {
    return INTERIOR_PERMISSIONS.designRead;
  }
  if (pathname === '/api/interior/boq') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.boqRead;
    if (method === 'POST') {
      const header = nestedRecord(body, 'boq_header') ?? nestedRecord(body, 'header');
      const id = header?.id ?? body?.boq_id ?? body?.id;
      return typeof id === 'string' && id.length > 0
        ? INTERIOR_PERMISSIONS.boqUpdate
        : INTERIOR_PERMISSIONS.boqCreate;
    }
  }
  if (/^\/api\/interior\/boq\/[^/]+\/approve$/.test(pathname) && method === 'POST') {
    return INTERIOR_PERMISSIONS.boqApprove;
  }
  if (pathname === '/api/interior/contracts') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.contractRead;
    if (method === 'POST') {
      switch (body?.action) {
        case 'create-contract': return INTERIOR_PERMISSIONS.contractCreate;
        case 'release-to-workshop': return INTERIOR_PERMISSIONS.productionRelease;
        case 'record-payment': return INTERIOR_PERMISSIONS.paymentRecord;
        case 'create-addendum': return INTERIOR_PERMISSIONS.contractAmend;
        default: return null;
      }
    }
  }
  if (pathname === '/api/interior/quotations') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.contractRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.contractCreate;
  }
  if (pathname === '/api/interior/customer-approvals') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.contractRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.contractWrite;
  }
  if (pathname === '/api/interior/finance' && method === 'GET') return INTERIOR_PERMISSIONS.financeRead;
  if (pathname === '/api/interior/reports/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.reportsRead;
  if (pathname === '/api/interior/schedule') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.scheduleRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.scheduleCreate;
    if (method === 'PATCH') return INTERIOR_PERMISSIONS.scheduleUpdate;
  }
  if (pathname === '/api/interior/installation/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.installationRead;
  if (pathname === '/api/interior/production/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.productionRead;
  if (pathname === '/api/interior/production/orders') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.productionRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.productionCreate;
  }
  if (pathname === '/api/interior/qc-handover/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
  if (pathname === '/api/interior/delivery/handover') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.deliveryRead;
    // This handler writes a completed, client-accepted dossier. The request
    // body cannot downgrade that approval into an ordinary create action.
    if (method === 'POST') return INTERIOR_PERMISSIONS.handoverApprove;
  }
  if (pathname === '/api/interior/delivery/punch-list') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.qcCreate;
  }
  if (/^\/api\/interior\/delivery\/punch-list\/[^/]+$/.test(pathname)) {
    if (method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
    if (method === 'PATCH' && ['approved', 'verified', 'accepted'].includes(String(body?.status ?? '').toLowerCase())) {
      return INTERIOR_PERMISSIONS.qcApprove;
    }
    if (method === 'PATCH') return INTERIOR_PERMISSIONS.qcUpdate;
  }
  if (pathname === '/api/interior/delivery/site-diary') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.installationRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.installationCreate;
  }
  if (pathname === '/api/interior/delivery/warranty') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.warrantyRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.warrantyCreate;
  }
  if (pathname === '/api/interior/warranty/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.warrantyRead;
  if (pathname === '/api/interior/upload' && method === 'POST') return INTERIOR_PERMISSIONS.designUpload;

  return null;
}

// ─── Forbidden headers ────────────────────────────────────────────────────────
// These headers must NEVER be accepted from the client — tenant/user identity is
// resolved exclusively from the authenticated session, not from request metadata.

const FORBIDDEN_HEADERS: readonly string[] = [
  'x-tenant-id',
  'x-user-id',
  'x-role',
  'x-actor-id',
  'x-impersonate',
];

// ─── Error response helpers ───────────────────────────────────────────────────

function interiorFailure(
  code: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 503,
): NextResponse {
  return NextResponse.json({ success: false, error: code }, { status });
}

type ProjectRequestScope =
  | { readonly status: 'OK'; readonly projectId?: string; readonly branchId?: string; readonly body: JsonRecord | null }
  | { readonly status: 'INVALID' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function projectIdCandidates(request: Request, body: JsonRecord | null): string[] {
  const url = new URL(request.url);
  const candidates: string[] = [];
  const projectRoute = url.pathname.replace(/\/+$/, '').match(/^\/api\/interior\/projects\/([^/]+)$/);
  const pathValue = projectRoute?.[1];
  const queryValue = url.searchParams.get('project_id') ?? url.searchParams.get('projectId');
  if (pathValue) {
    try {
      candidates.push(decodeURIComponent(pathValue));
    } catch {
      candidates.push('invalid-project-id');
    }
  }
  if (queryValue) candidates.push(queryValue);

  const bodyRecords = [
    body,
    nestedRecord(body, 'project'),
    nestedRecord(body, 'header'),
    nestedRecord(body, 'boq_header'),
    nestedRecord(body, 'payload'),
  ];
  for (const row of bodyRecords) {
    const value = row?.project_id ?? row?.projectId;
    if (typeof value === 'string' && value.trim().length > 0) candidates.push(value.trim());
  }
  return candidates;
}

export async function requestedProjectScope(request: Request): Promise<ProjectRequestScope> {
  let body: JsonRecord | null = null;
  if (request.method.toUpperCase() !== 'GET' && request.method.toUpperCase() !== 'HEAD') {
    try {
      const parsed: unknown = await request.clone().json();
      body = isJsonRecord(parsed) ? parsed : null;
    } catch {
      body = null;
    }
  }
  const candidates = projectIdCandidates(request, body);
  if (candidates.some((value) => !UUID_PATTERN.test(value))) return { status: 'INVALID' };
  const distinct = [...new Set(candidates.map((value) => value.toLowerCase()))];
  if (distinct.length > 1) return { status: 'INVALID' };
  const url = new URL(request.url);
  const branchCandidates = [url.searchParams.get('branch_id'), url.searchParams.get('branchId')].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  for (const record of [body, nestedRecord(body, 'project'), nestedRecord(body, 'payload')]) {
    const value = record?.branch_id ?? record?.branchId;
    if (typeof value === 'string' && value.trim().length > 0) branchCandidates.push(value.trim());
  }
  if (branchCandidates.some((value) => !UUID_PATTERN.test(value))) return { status: 'INVALID' };
  const distinctBranches = [...new Set(branchCandidates.map((value) => value.toLowerCase()))];
  if (distinctBranches.length > 1) return { status: 'INVALID' };
  return {
    status: 'OK',
    body,
    ...(distinct.length === 1 ? { projectId: distinct[0] } : {}),
    ...(distinctBranches.length === 1 ? { branchId: distinctBranches[0] } : {}),
  };
}

function scopedProjectResource(request: Request): { resourceKey: 'boq' | 'design_revision' | 'qc_item'; resourceId: string } | null {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  const boq = pathname.match(/^\/api\/interior\/boq\/([^/]+)\/approve$/);
  if (boq) return { resourceKey: 'boq', resourceId: boq[1] };
  const revision = pathname.match(/^\/api\/interior\/design\/revisions\/([^/]+)\/approve$/);
  if (revision) return { resourceKey: 'design_revision', resourceId: revision[1] };
  const qcItem = pathname.match(/^\/api\/interior\/delivery\/punch-list\/([^/]+)$/);
  if (qcItem) return { resourceKey: 'qc_item', resourceId: qcItem[1] };
  return null;
}

// ─── Resolved context type ────────────────────────────────────────────────────

export type InteriorServerContext = {
  ok: true;
  actor: ActiveCurrentActor;
  tenantId: string;
  supabase: ReturnType<typeof createClient>;
  authorization: SupabaseInteriorRoleAuthorization;
};

export type InteriorContextFailure = {
  ok: false;
  response: NextResponse;
};

export type InteriorContextResult = InteriorServerContext | InteriorContextFailure;

// ─── resolveInteriorContext ───────────────────────────────────────────────────

/**
 * Resolve an authenticated Interior OS request context.
 *
 * Usage in route handlers:
 * ```typescript
 * const ctx = await resolveInteriorContext(request);
 * if (!ctx.ok) return ctx.response;
 * const { actor, tenantId, supabase } = ctx;
 * ```
 *
 * @param request - The incoming NextRequest or Request object
 * @returns InteriorServerContext on success, InteriorContextFailure on any auth failure
 */
export async function resolveInteriorContext(
  request: Request,
): Promise<InteriorContextResult> {
  // ── 1. Block forbidden client-controlled identity headers ─────────────────
  if (FORBIDDEN_HEADERS.some((name) => request.headers.has(name))) {
    return { ok: false, response: interiorFailure('INTERIOR_ACCESS_DENIED', 403) };
  }

  // ── 2. Validate Authorization header format if present ────────────────────
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return { ok: false, response: interiorFailure('INTERIOR_UNAUTHENTICATED', 401) };
  }

  try {
    // ── 3. Create SSR Supabase client (cookie-based) ─────────────────────────
    const supabase = createClient();

    // ── 4. Verify identity — auth.getUser(), NOT getSession() ────────────────
    const auth = authorization
      ? await supabase.auth.getUser(authorization.slice(7))
      : await supabase.auth.getUser();

    if (auth.error || !auth.data.user) {
      return { ok: false, response: interiorFailure('INTERIOR_UNAUTHENTICATED', 401) };
    }

    // ── 5. Resolve tenant from DB via platform RPC — NOT from headers ─────────
    const profile = await supabase.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) {
      return { ok: false, response: interiorFailure('INTERIOR_UNAVAILABLE', 503) };
    }

    // ── 6. Cross-verify auth.id === profile.id before trusting tenantId ───────
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id) {
      return { ok: false, response: interiorFailure('INTERIOR_ACCESS_DENIED', 403) };
    }
    const tenantId = actor.tenant_id;

    // ── 7. Build authorization helper ─────────────────────────────────────────
    const authorization_helper = new SupabaseInteriorRoleAuthorization(
      supabase as unknown as SupabaseClient<Database>,
    );

    const scope = await requestedProjectScope(request);
    if (scope.status === 'INVALID') {
      return { ok: false, response: interiorFailure('INTERIOR_PROJECT_SCOPE_INVALID', 403) };
    }
    let projectId = scope.projectId;
    const scopedResource = scopedProjectResource(request);
    if (!projectId && scopedResource) {
      if (!UUID_PATTERN.test(scopedResource.resourceId)) {
        return { ok: false, response: interiorFailure('INTERIOR_RESOURCE_NOT_FOUND', 404) };
      }
      const resolvedProject = await interiorRbacRpcClient(supabase as unknown as SupabaseClient<Database>).rpc('interior_resolve_project_id', {
        p_tenant_id: tenantId,
        p_resource_key: scopedResource.resourceKey,
        p_resource_id: scopedResource.resourceId,
        p_parent_id: null,
        p_project_id: null,
      });
      if (resolvedProject.error) {
        return { ok: false, response: interiorFailure('INTERIOR_AUTHORIZATION_UNAVAILABLE', 503) };
      }
      if (typeof resolvedProject.data !== 'string' || !UUID_PATTERN.test(resolvedProject.data)) {
        return { ok: false, response: interiorFailure('INTERIOR_RESOURCE_NOT_FOUND', 404) };
      }
      projectId = resolvedProject.data;
    }
    const permissionId = requiredInteriorPermission(request, scope.body);
    if (!permissionId) {
      return { ok: false, response: interiorFailure('INTERIOR_ACTION_NOT_CONFIGURED', 403) };
    }

    const isProjectList = new URL(request.url).pathname.replace(/\/+$/, '') === '/api/interior/projects'
      && request.method.toUpperCase() === 'GET';
    const isCustomerList = new URL(request.url).pathname.replace(/\/+$/, '') === '/api/interior/customers'
      && request.method.toUpperCase() === 'GET';
    const isScheduleCollection = new URL(request.url).pathname.replace(/\/+$/, '') === '/api/interior/schedule'
      && request.method.toUpperCase() === 'GET'
      && projectId === undefined;
    const isAuditRead = new URL(request.url).pathname.replace(/\/+$/, '') === '/api/interior/rbac/audit'
      && request.method.toUpperCase() === 'GET';
    const decision = isProjectList
      ? await authorization_helper.authorizeProjectList(tenantId)
      : isCustomerList
        ? await authorization_helper.authorizeCustomerList(tenantId)
        : isScheduleCollection
          ? await authorization_helper.authorizeScheduleList(tenantId)
      : isAuditRead
        ? await (async () => {
          const decisions = await Promise.all([
            authorization_helper.authorize({ permissionId: 'interior:audit:read', tenantId }),
            authorization_helper.authorize({ permissionId: 'interior:audit:read_limited', tenantId }),
          ]);
          if (decisions.some((item) => item.status === 'ALLOW')) {
            return { status: 'ALLOW' as const, reason: 'AUDIT_READ' };
          }
          if (decisions.some((item) => item.status === 'UNAVAILABLE')) {
            return { status: 'UNAVAILABLE' as const, reason: 'RESOLVER_UNAVAILABLE' };
          }
          return { status: 'DENY' as const, reason: 'NO_GRANT' };
        })()
        : await authorization_helper.authorize({
        permissionId,
        tenantId,
        projectId,
        branchId: scope.branchId,
      });
    if (decision.status === 'DENY') {
      return { ok: false, response: interiorFailure('INTERIOR_PERMISSION_DENIED', 403) };
    }
    if (decision.status === 'UNAVAILABLE') {
      return { ok: false, response: interiorFailure('INTERIOR_AUTHORIZATION_UNAVAILABLE', 503) };
    }

    return {
      ok: true,
      actor,
      tenantId,
      supabase,
      authorization: authorization_helper,
    };
  } catch {
    return { ok: false, response: interiorFailure('INTERIOR_UNAVAILABLE', 503) };
  }
}

