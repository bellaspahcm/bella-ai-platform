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

