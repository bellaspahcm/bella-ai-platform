import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

function createOperationClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;
  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('COMMUNICATION_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('COMMUNICATION_ACCESS_DENIED', 403);
    }

    const opClient = createOperationClient() ?? client;

    // Fetch active threads for this tenant
    const { data: threads, error: threadsError } = await opClient
      .from('edu_comm_threads')
      .select('id, student_id, guardian_party_id, thread_type, title, status, last_activity_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .order('last_activity_at', { ascending: false })
      .limit(50);

    if (threadsError) {
      return failure('FETCH_THREADS_FAILED', 503);
    }

    // Also calculate metrics
    const [unreadRes, exceptionsRes] = await Promise.all([
      opClient
        .from('edu_comm_responses')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('sender_role', 'PARENT'),
      opClient
        .from('edu_comm_exceptions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'OPEN'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        threads: threads ?? [],
        metrics: {
          unreadCount: unreadRes.count ?? 0,
          overdueCount: exceptionsRes.count ?? 0,
        },
      },
    }, { headers: PRIVATE_HEADERS });
  } catch {
    return failure('COMMUNICATION_SERVICE_UNAVAILABLE', 503);
  }
}

