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
    const queryKeys = [...new URL(request.url).searchParams.keys()];
    if (
      IDENTITY_HEADERS.some((header) => request.headers.has(header)) ||
      queryKeys.some((key) => IDENTITY_QUERY_KEYS.has(key))
    ) {
      return failure('STUDENT_HEALTH_ACCESS_DENIED', 403);
    }
    if (queryKeys.length > 0) return failure('INVALID_STUDENT_HEALTH_REQUEST', 400);

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
      if (!bearer) return failure('STUDENT_HEALTH_UNAUTHENTICATED', 401);
      accessToken = bearer[1];
    } else {
      const session = await client.auth.getSession();
      if (session.error || !session.data.session?.access_token) {
        return failure('STUDENT_HEALTH_UNAUTHENTICATED', 401);
      }
      accessToken = session.data.session.access_token;
    }

    const auth = await client.auth.getUser(accessToken);
    if (auth.error || !auth.data.user) return failure('STUDENT_HEALTH_UNAUTHENTICATED', 401);

    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure(
        profileResult.error.code === '42501' ? 'STUDENT_HEALTH_ACCESS_DENIED' : 'STUDENT_HEALTH_UNAVAILABLE',
        profileResult.error.code === '42501' ? 403 : 503,
      );
    }

    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') return failure('STUDENT_HEALTH_ACCESS_DENIED', 403);

    const adminClient = createAdminClient();
    const queryClient = adminClient ?? client;

    const [allergiesRes, medicationsRes, incidentsRes] = await Promise.all([
      queryClient
        .from('edu_child_allergies')
        .select('id, allergen_id, severity, reaction_notes, status, created_at, allergen:edu_allergens(id, name, description)')
        .eq('tenant_id', actor.tenant_id)
        .eq('student_id', resolvedParams.id)
        .order('created_at', { ascending: false }),
      queryClient
        .from('edu_medication_authorizations')
        .select('id, medication_name, authorized_dose, authorized_at, valid_from, valid_until, status, created_at')
        .eq('tenant_id', actor.tenant_id)
        .eq('student_id', resolvedParams.id)
        .order('created_at', { ascending: false }),
      queryClient
        .from('edu_health_incidents')
        .select('id, incident_time, incident_type, severity, description, action_taken, status, escalation_required, parent_notified_at, created_at')
        .eq('tenant_id', actor.tenant_id)
        .eq('student_id', resolvedParams.id)
        .order('incident_time', { ascending: false }),
    ]);

    if (allergiesRes.error || medicationsRes.error || incidentsRes.error) {
      return failure('STUDENT_HEALTH_UNAVAILABLE', 503);
    }

    return NextResponse.json(
      {
        success: true,
        studentId: resolvedParams.id,
        allergies: allergiesRes.data ?? [],
        medications: medicationsRes.data ?? [],
        incidents: incidentsRes.data ?? [],
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    return failure('STUDENT_HEALTH_UNAVAILABLE', 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'STUDENT_HEALTH_READ_ONLY' },
    { status: 405, headers: { ...PRIVATE_HEADERS, Allow: 'GET' } },
  );
}

export async function POST(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PUT(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PATCH(): Promise<NextResponse> { return methodNotAllowed(); }
export async function DELETE(): Promise<NextResponse> { return methodNotAllowed(); }
