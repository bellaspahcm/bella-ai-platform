import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

export async function POST(_request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('COMMUNICATION_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('COMMUNICATION_ACCESS_DENIED', 403);
    }

    return failure('PRESCHOOL_PRIVATE_CHAT_UNAVAILABLE', 503);
  } catch {
    return failure('COMMUNICATION_SERVICE_UNAVAILABLE', 503);
  }
}

