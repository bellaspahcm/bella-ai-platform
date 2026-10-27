import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import {
  PRESCHOOL_G1_GUARDIANS_READ_RPC,
  PreschoolStudentGuardianReadError,
  PreschoolStudentGuardianReadService,
} from '@/products/bella-education/services/preschool-student-guardian-read.service';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const IDENTITY_HEADERS = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'];
const IDENTITY_QUERY_KEYS = new Set([
  'tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'user_role', 'mock_user_email',
]);
type RouteContext = { params: { id: string } | Promise<{ id: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const queryKeys = [...new URL(request.url).searchParams.keys()];
    if (IDENTITY_HEADERS.some(header => request.headers.has(header))
      || queryKeys.some(key => IDENTITY_QUERY_KEYS.has(key))) {
      return failure('STUDENT_GUARDIAN_ACCESS_DENIED', 403);
    }
    if (queryKeys.length > 0) return failure('INVALID_STUDENT_GUARDIAN_REQUEST', 400);
    const resolvedParams = await params;
    if (typeof resolvedParams?.id !== 'string' || !resolvedParams.id.trim()) {
      return failure('MISSING_STUDENT_ID', 400);
    }
    if (!UUID_PATTERN.test(resolvedParams.id)) return failure('INVALID_STUDENT_ID', 400);

    const client = await createClient();
    const authorization = request.headers.get('authorization');
    let accessToken: string;
    if (authorization !== null) {
      const bearer = /^Bearer ([^\s]+)$/i.exec(authorization);
      if (!bearer) return failure('STUDENT_GUARDIAN_UNAUTHENTICATED', 401);
      accessToken = bearer[1];
    } else {
      const session = await client.auth.getSession();
      if (session.error || !session.data.session?.access_token) {
        return failure('STUDENT_GUARDIAN_UNAUTHENTICATED', 401);
      }
      accessToken = session.data.session.access_token;
    }
    // getSession supplies only the token. getUser validates that exact token remotely.
    const auth = await client.auth.getUser(accessToken);
    if (auth.error || !auth.data.user) return failure('STUDENT_GUARDIAN_UNAUTHENTICATED', 401);
    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure(
        profileResult.error.code === '42501' ? 'STUDENT_GUARDIAN_ACCESS_DENIED' : 'STUDENT_GUARDIANS_UNAVAILABLE',
        profileResult.error.code === '42501' ? 403 : 503,
      );
    }
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') return failure('STUDENT_GUARDIAN_ACCESS_DENIED', 403);

    const { url, publicKey } = requireSupabasePublicEnv();
    const guardians = await new PreschoolStudentGuardianReadService(async studentId => {
      // Explicit approved HTTP contract; do not hand-edit generated database types.
      const response = await fetch(url + '/rest/v1/rpc/' + PRESCHOOL_G1_GUARDIANS_READ_RPC, {
        method: 'POST',
        headers: { apikey: publicKey, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_student_id: studentId }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const code = typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string'
          ? data.code
          : 'G1_PROVIDER_UNAVAILABLE';
        return { data: null, error: { code } };
      }
      return { data, error: null };
    }).read(resolvedParams.id);
    return NextResponse.json({ success: true, guardians }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof PreschoolStudentGuardianReadError) return failure(error.code, error.status);
    return failure('STUDENT_GUARDIANS_UNAVAILABLE', 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json({ success: false, error: 'STUDENT_GUARDIAN_READ_ONLY' }, {
    status: 405,
    headers: { ...PRIVATE_HEADERS, Allow: 'GET' },
  });
}

export async function POST(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PUT(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PATCH(): Promise<NextResponse> { return methodNotAllowed(); }
export async function DELETE(): Promise<NextResponse> { return methodNotAllowed(); }
