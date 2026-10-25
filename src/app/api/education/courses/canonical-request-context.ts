import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';

export const CANONICAL_COURSE_HEADERS = { 'Cache-Control': 'private, no-store' };

export function canonicalCourseFailure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: CANONICAL_COURSE_HEADERS });
}

/** Resolves live caller identity and active Preschool scope before a privileged writer is constructed. */
export async function resolveCanonicalCourseContext(request: Request) {
  const forbiddenHeaders = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-mock-role', 'x-tenant-id', 'x-user-id', 'x-actor-id'];
  if (forbiddenHeaders.some(key => request.headers.has(key))) {
    return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_ACCESS_DENIED', 403) };
  }
  if (new URL(request.url).searchParams.size) {
    return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400) };
  }
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_UNAUTHENTICATED', 401) };
  }

  try {
    const client = await createClient();
    const auth = authorization
      ? await client.auth.getUser(authorization.slice(7))
      : await client.auth.getUser();
    if (auth.error || !auth.data.user) {
      return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_UNAUTHENTICATED', 401) };
    }

    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) {
      return { allowed: false as const, response: profile.error.code === '42501'
        ? canonicalCourseFailure('CANONICAL_COURSE_ACCESS_DENIED', 403)
        : canonicalCourseFailure('CANONICAL_COURSE_UNAVAILABLE', 503) };
    }
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id || actor.role !== 'admin') {
      return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_ACCESS_DENIED', 403) };
    }

    const tenantResult = await client.from('tenants').select('id,status,product_key')
      .eq('id', actor.tenant_id).maybeSingle();
    if (tenantResult.error) {
      return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_UNAVAILABLE', 503) };
    }
    const tenant = tenantResult.data;
    if (!tenant || tenant.id !== actor.tenant_id || tenant.status !== 'active') {
      return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_ACCESS_DENIED', 403) };
    }
    if (tenant.product_key !== 'bella_preschool') {
      return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_UNSUPPORTED_PRODUCT', 403) };
    }
    return { allowed: true as const, actor, tenantId: actor.tenant_id };
  } catch {
    return { allowed: false as const, response: canonicalCourseFailure('CANONICAL_COURSE_UNAVAILABLE', 503) };
  }
}
