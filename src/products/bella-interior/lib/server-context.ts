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
import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const INTERIOR_PERMISSIONS = {
  projectRead: 'interior:project:read',
  projectWrite: 'interior:project:write',
  customerRead: 'interior:customer:read',
  designRead: 'interior:design:read',
  designWrite: 'interior:design:write',
  designApprove: 'interior:design:approve',
  boqRead: 'interior:boq:read',
  boqWrite: 'interior:boq:write',
  contractRead: 'interior:contract:read',
  contractWrite: 'interior:contract:write',
  financeRead: 'interior:finance:read',
  financeWrite: 'interior:finance:write',
  scheduleRead: 'interior:schedule:read',
  scheduleWrite: 'interior:schedule:write',
  productionRead: 'interior:production:read',
  productionWrite: 'interior:production:write',
  installationRead: 'interior:installation:read',
  installationWrite: 'interior:installation:write',
  qcRead: 'interior:qc:read',
  qcWrite: 'interior:qc:write',
  deliveryRead: 'interior:delivery:read',
  deliveryWrite: 'interior:delivery:write',
  reportsRead: 'interior:reports:read',
  warrantyRead: 'interior:warranty:read',
  warrantyWrite: 'interior:warranty:write',
  designUpload: 'interior:design:upload',
  executiveApprove: 'interior:executive:approve',
} as const;

export type InteriorPermissionId = (typeof INTERIOR_PERMISSIONS)[keyof typeof INTERIOR_PERMISSIONS];

function requiredInteriorPermission(request: Request): InteriorPermissionId | null {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  const isMethod = (...methods: readonly string[]) => methods.includes(method);

  if (pathname === '/api/interior/projects') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.projectRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.projectWrite;
  }
  if (/^\/api\/interior\/projects\/[^/]+$/.test(pathname) && method === 'GET') {
    return INTERIOR_PERMISSIONS.projectRead;
  }
  if (pathname === '/api/interior/customers' && method === 'GET') return INTERIOR_PERMISSIONS.customerRead;
  if (pathname === '/api/interior/design') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.designRead;
    if (isMethod('POST', 'DELETE')) return INTERIOR_PERMISSIONS.designWrite;
  }
  if (pathname === '/api/interior/design/revisions') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.designRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.designWrite;
  }
  if (/^\/api\/interior\/design\/revisions\/[^/]+\/approve$/.test(pathname) && method === 'POST') {
    return INTERIOR_PERMISSIONS.designApprove;
  }
  if (/^\/api\/interior\/design\/revisions\/[^/]+$/.test(pathname) && method === 'GET') {
    return INTERIOR_PERMISSIONS.designRead;
  }
  if (pathname === '/api/interior/boq') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.boqRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.boqWrite;
  }
  if (pathname === '/api/interior/contracts') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.contractRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.contractWrite;
  }
  if (pathname === '/api/interior/finance' && method === 'GET') return INTERIOR_PERMISSIONS.financeRead;
  if (pathname === '/api/interior/reports/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.reportsRead;
  if (pathname === '/api/interior/schedule') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.scheduleRead;
    if (isMethod('POST', 'PATCH', 'DELETE')) return INTERIOR_PERMISSIONS.scheduleWrite;
  }
  if (pathname === '/api/interior/installation/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.installationRead;
  if (pathname === '/api/interior/production/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.productionRead;
  if (pathname === '/api/interior/production/orders') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.productionRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.productionWrite;
  }
  if (pathname === '/api/interior/qc-handover/analytics' && method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
  if (pathname === '/api/interior/delivery/handover') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.deliveryRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.deliveryWrite;
  }
  if (pathname === '/api/interior/delivery/punch-list') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.qcWrite;
  }
  if (/^\/api\/interior\/delivery\/punch-list\/[^/]+$/.test(pathname)) {
    if (method === 'GET') return INTERIOR_PERMISSIONS.qcRead;
    if (method === 'PATCH') return INTERIOR_PERMISSIONS.qcWrite;
  }
  if (pathname === '/api/interior/delivery/site-diary') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.deliveryRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.deliveryWrite;
  }
  if (pathname === '/api/interior/delivery/warranty') {
    if (method === 'GET') return INTERIOR_PERMISSIONS.warrantyRead;
    if (method === 'POST') return INTERIOR_PERMISSIONS.warrantyWrite;
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

// ─── Resolved context type ────────────────────────────────────────────────────

export type InteriorServerContext = {
  ok: true;
  actor: ActiveCurrentActor;
  tenantId: string;
  supabase: ReturnType<typeof createClient>;
  authorization: SupabasePlatformActionAuthorization;
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

    // ── 7. Build authorization helper ─────────────────────────────────────────
    const authorization_helper = new SupabasePlatformActionAuthorization(
      supabase as unknown as SupabaseClient<Database>,
    );

    const permissionId = requiredInteriorPermission(request);
    if (!permissionId) {
      return { ok: false, response: interiorFailure('INTERIOR_ACTION_NOT_CONFIGURED', 403) };
    }

    const decision = await authorization_helper.authorize({
      permissionId,
      tenantId: actor.tenant_id,
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
      tenantId: actor.tenant_id,
      supabase,
      authorization: authorization_helper,
    };
  } catch {
    return { ok: false, response: interiorFailure('INTERIOR_UNAVAILABLE', 503) };
  }
}

