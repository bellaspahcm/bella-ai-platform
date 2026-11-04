import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import type { Database } from '@/types/database.types';

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

function createAdminClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;
  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const queryKeys = [...url.searchParams.keys()];
    if (
      IDENTITY_HEADERS.some((header) => request.headers.has(header)) ||
      queryKeys.some((key) => IDENTITY_QUERY_KEYS.has(key))
    ) {
      return failure('STUDENT_DEVELOPMENT_ACCESS_DENIED', 403);
    }

    const enrollmentIdParam = url.searchParams.get('enrollment_id');
    const allowedKeys = new Set(['enrollment_id']);
    if (queryKeys.some((key) => !allowedKeys.has(key))) {
      return failure('INVALID_STUDENT_DEVELOPMENT_REQUEST', 400);
    }

    if (enrollmentIdParam && !UUID_PATTERN.test(enrollmentIdParam)) {
      return failure('INVALID_ENROLLMENT_ID', 400);
    }

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
      if (!bearer) return failure('STUDENT_DEVELOPMENT_UNAUTHENTICATED', 401);
      accessToken = bearer[1];
    } else {
      const session = await client.auth.getSession();
      if (session.error || !session.data.session?.access_token) {
        return failure('STUDENT_DEVELOPMENT_UNAUTHENTICATED', 401);
      }
      accessToken = session.data.session.access_token;
    }

    const auth = await client.auth.getUser(accessToken);
    if (auth.error || !auth.data.user) return failure('STUDENT_DEVELOPMENT_UNAUTHENTICATED', 401);

    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure(
        profileResult.error.code === '42501' ? 'STUDENT_DEVELOPMENT_ACCESS_DENIED' : 'STUDENT_DEVELOPMENT_UNAVAILABLE',
        profileResult.error.code === '42501' ? 403 : 503,
      );
    }

    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') return failure('STUDENT_DEVELOPMENT_ACCESS_DENIED', 403);

    const adminClient = createAdminClient();
    const queryClient = adminClient ?? client;

    // First find student party_id
    const studentRes = await queryClient
      .from('students')
      .select('student_id, party_id')
      .eq('tenant_id', actor.tenant_id)
      .eq('student_id', resolvedParams.id)
      .maybeSingle();

    const partyId = studentRes.data?.party_id;

    // Find enrollment IDs for this student
    let validEnrollmentIds: string[] = [];
    if (enrollmentIdParam) {
      validEnrollmentIds = [enrollmentIdParam];
    } else if (partyId) {
      const enrollRes = await queryClient
        .from('edu_enrollments')
        .select('id')
        .eq('tenant_id', actor.tenant_id)
        .eq('student_party_id', partyId);
      validEnrollmentIds = (enrollRes.data ?? []).map((e: { id: string }) => e.id);
    }

    // Fetch assessments & milestone progress
    const [assessmentsRes, milestoneRes] = await Promise.all([
      validEnrollmentIds.length > 0
        ? queryClient
            .from('edu_assessments')
            .select('id, enrollment_id, score_type, grade, weight, occurred_at, created_at')
            .eq('tenant_id', actor.tenant_id)
            .in('enrollment_id', validEnrollmentIds)
            .order('occurred_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      queryClient
        .from('edu_dev_milestone_progress')
        .select('id, milestone_id, framework_version_id, status, status_lifecycle, rationale, is_confirmed, interpreted_at, created_at, milestone:edu_dev_milestones(id, code, title, description, indicator_statement, min_age_months, max_age_months)')
        .eq('tenant_id', actor.tenant_id)
        .eq('student_id', resolvedParams.id)
        .order('created_at', { ascending: false }),
    ]);

    if (assessmentsRes.error || milestoneRes.error) {
      return failure('STUDENT_DEVELOPMENT_UNAVAILABLE', 503);
    }

    return NextResponse.json(
      {
        success: true,
        studentId: resolvedParams.id,
        enrollmentId: enrollmentIdParam ?? (validEnrollmentIds[0] || null),
        assessments: assessmentsRes.data ?? [],
        milestoneProgress: milestoneRes.data ?? [],
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    return failure('STUDENT_DEVELOPMENT_UNAVAILABLE', 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'STUDENT_DEVELOPMENT_READ_ONLY' },
    { status: 405, headers: { ...PRIVATE_HEADERS, Allow: 'GET' } },
  );
}

export async function POST(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PUT(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PATCH(): Promise<NextResponse> { return methodNotAllowed(); }
export async function DELETE(): Promise<NextResponse> { return methodNotAllowed(); }
