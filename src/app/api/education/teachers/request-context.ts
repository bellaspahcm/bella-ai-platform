import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  CURRENT_ACTOR_TENANT_PRESENTATION_RPC,
  reconcileCurrentActorProfile,
  reconcileCurrentActorTenantPresentation,
  type CurrentActorTenantPresentationRow,
} from '@/platform/security/current-actor.contract';

export const TEACHER_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

export function teacherFailure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: TEACHER_PRIVATE_HEADERS });
}

/** Caller identity and Product role are resolved before a privileged Teacher RPC client exists. */
export async function resolvePreschoolTeacherContext(request: Request) {
  const forbiddenHeaders = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-mock-role',
    'x-tenant-id', 'x-user-id', 'x-actor-id'];
  if (forbiddenHeaders.some(key => request.headers.has(key))) {
    return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_ACCESS_DENIED', 403) };
  }
  if (request.method !== 'GET' && new URL(request.url).searchParams.size > 0) {
    return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_INVALID_REQUEST', 400) };
  }
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_UNAUTHENTICATED', 401) };
  }
  try {
    const client = await createClient();
    const auth = authorization ? await client.auth.getUser(authorization.slice(7)) : await client.auth.getUser();
    if (auth.error || !auth.data.user) {
      return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_UNAUTHENTICATED', 401) };
    }
    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) return { allowed: false as const, response: teacherFailure(
      profile.error.code === '42501' ? 'PRESCHOOL_TEACHER_ACCESS_DENIED' : 'PRESCHOOL_TEACHER_UNAVAILABLE',
      profile.error.code === '42501' ? 403 : 503,
    ) };
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id || actor.role !== 'admin') {
      return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_ACCESS_DENIED', 403) };
    }
    const tenantResult = await client.rpc(CURRENT_ACTOR_TENANT_PRESENTATION_RPC);
    if (tenantResult.error) return { allowed: false as const, response: teacherFailure(
      tenantResult.error.code === '42501' ? 'PRESCHOOL_TEACHER_ACCESS_DENIED' : 'PRESCHOOL_TEACHER_UNAVAILABLE',
      tenantResult.error.code === '42501' ? 403 : 503,
    ) };
    const tenant = reconcileCurrentActorTenantPresentation(
      actor.tenant_id,
      tenantResult.data as CurrentActorTenantPresentationRow[] | null,
    );
    if (!tenant || tenant.product_key !== 'bella_preschool') {
      return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_ACCESS_DENIED', 403) };
    }
    return { allowed: true as const, actor, tenantId: actor.tenant_id, client };
  } catch {
    return { allowed: false as const, response: teacherFailure('PRESCHOOL_TEACHER_UNAVAILABLE', 503) };
  }
}
