import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import { PreschoolRegistryError } from '@/platform/education/contracts/preschool-registry.contract';
import { loadStudent360Profile, Student360ReadError } from '../student-360.service';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const IDENTITY_HEADERS = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'];
const IDENTITY_QUERY_KEYS = new Set([
  'tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'user_role', 'mock_user_email',
]);
type RouteContext = { params: { id: string } | Promise<{ id: string }> };

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const queryKeys = [...new URL(request.url).searchParams.keys()];
    if (IDENTITY_HEADERS.some(header => request.headers.has(header))
      || queryKeys.some(key => IDENTITY_QUERY_KEYS.has(key))) {
      return failure('STUDENT_PROFILE_ACCESS_DENIED', 403);
    }
    if (queryKeys.length > 0) return failure('INVALID_STUDENT_PROFILE_REQUEST', 400);
    const resolvedParams = await params;
    if (typeof resolvedParams?.id !== 'string' || !resolvedParams.id.trim()) {
      return failure('MISSING_STUDENT_ID', 400);
    }

    const client = await createClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return failure('STUDENT_PROFILE_UNAUTHENTICATED', 401);
    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure(profileResult.error.code === '42501' ? 'STUDENT_PROFILE_ACCESS_DENIED' : 'STUDENT_PROFILE_UNAVAILABLE',
        profileResult.error.code === '42501' ? 403 : 503);
    }
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') return failure('STUDENT_PROFILE_ACCESS_DENIED', 403);

    const profile = await loadStudent360Profile(client, actor.tenant_id, resolvedParams.id);
    if (!profile) return failure('STUDENT_PROFILE_NOT_FOUND', 404);
    return NextResponse.json({ success: true, profile }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof PreschoolRegistryError || error instanceof Student360ReadError) {
      return failure(error.status === 503 ? 'STUDENT_PROFILE_UNAVAILABLE' : error.code, error.status);
    }
    return failure('STUDENT_PROFILE_UNAVAILABLE', 503);
  }
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json({ success: false, error: 'STUDENT_PROFILE_UPDATE_UNAVAILABLE' }, {
    status: 405,
    headers: { ...PRIVATE_HEADERS, Allow: 'GET' },
  });
}
