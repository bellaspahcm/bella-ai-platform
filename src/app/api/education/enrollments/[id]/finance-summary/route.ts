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
      return failure('STUDENT_FINANCE_ACCESS_DENIED', 403);
    }
    if (queryKeys.length > 0) return failure('INVALID_STUDENT_FINANCE_REQUEST', 400);

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
      if (!bearer) return failure('STUDENT_FINANCE_UNAUTHENTICATED', 401);
      accessToken = bearer[1];
    } else {
      const session = await client.auth.getSession();
      if (session.error || !session.data.session?.access_token) {
        return failure('STUDENT_FINANCE_UNAUTHENTICATED', 401);
      }
      accessToken = session.data.session.access_token;
    }

    const auth = await client.auth.getUser(accessToken);
    if (auth.error || !auth.data.user) return failure('STUDENT_FINANCE_UNAUTHENTICATED', 401);

    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure(
        profileResult.error.code === '42501' ? 'STUDENT_FINANCE_ACCESS_DENIED' : 'STUDENT_FINANCE_UNAVAILABLE',
        profileResult.error.code === '42501' ? 403 : 503,
      );
    }

    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') return failure('STUDENT_FINANCE_ACCESS_DENIED', 403);

    const adminClient = createAdminClient();
    const queryClient = adminClient ?? client;

    // Get student party_id
    const studentRes = await queryClient
      .from('students')
      .select('student_id, party_id')
      .eq('tenant_id', actor.tenant_id)
      .eq('student_id', resolvedParams.id)
      .maybeSingle();

    const partyId = studentRes.data?.party_id;

    // Build filter for invoices: by student_id or student_party_id
    let invoicesQuery = queryClient
      .from('edu_fin_invoices')
      .select('id, invoice_number, billing_period_id, gross_amount, discount_amount, net_amount, paid_amount, outstanding_amount, invoice_status, settlement_status, due_date, issued_at, created_at')
      .eq('tenant_id', actor.tenant_id);

    if (partyId) {
      invoicesQuery = invoicesQuery.or(`student_id.eq.${resolvedParams.id},student_party_id.eq.${partyId}`);
    } else {
      invoicesQuery = invoicesQuery.eq('student_id', resolvedParams.id);
    }

    const { data: invoices, error: invError } = await invoicesQuery.order('issued_at', { ascending: false });

    if (invError) {
      return failure('STUDENT_FINANCE_UNAVAILABLE', 503);
    }

    const list = invoices ?? [];
    const totalDue = list.reduce((sum: number, inv: { net_amount: number | null }) => sum + (Number(inv.net_amount) || 0), 0);
    const totalPaid = list.reduce((sum: number, inv: { paid_amount: number | null }) => sum + (Number(inv.paid_amount) || 0), 0);
    const outstanding = list.reduce((sum: number, inv: { outstanding_amount: number | null }) => sum + (Number(inv.outstanding_amount) || 0), 0);

    return NextResponse.json(
      {
        success: true,
        studentId: resolvedParams.id,
        partyId: partyId ?? null,
        invoiceCount: list.length,
        totalDue,
        totalPaid,
        outstanding,
        invoices: list,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    return failure('STUDENT_FINANCE_UNAVAILABLE', 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'STUDENT_FINANCE_READ_ONLY' },
    { status: 405, headers: { ...PRIVATE_HEADERS, Allow: 'GET' } },
  );
}

export async function POST(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PUT(): Promise<NextResponse> { return methodNotAllowed(); }
export async function PATCH(): Promise<NextResponse> { return methodNotAllowed(); }
export async function DELETE(): Promise<NextResponse> { return methodNotAllowed(); }
