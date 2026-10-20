import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function respond(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return respond(401, 'ANNOUNCEMENT_UNAUTHENTICATED');

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !('status' in profile) || profile.status !== 'active'
      || !tenantId || profile.role?.trim().toLowerCase() !== 'admin') {
      return respond(403, 'ANNOUNCEMENT_ACCESS_DENIED');
    }
    const query = new URL(request.url).searchParams;
    const tenantSelectors = ['tenantId', 'tenant_id'].flatMap(key => query.getAll(key));
    const actorSelectors = ['actorId', 'actor_id', 'userId', 'user_id'].flatMap(key => query.getAll(key));
    if (tenantSelectors.some(value => value !== tenantId) || actorSelectors.some(value => value !== user.id)
      || request.headers.has('x-tenant-id') && request.headers.get('x-tenant-id') !== tenantId
      || request.headers.has('x-actor-id') && request.headers.get('x-actor-id') !== user.id) {
      return respond(403, 'ANNOUNCEMENT_CONTEXT_OVERRIDE_DENIED');
    }

    const { data: tenant, error: tenantError } = await client.from('tenants')
      .select('id, status, product_key').eq('id', tenantId).maybeSingle();
    if (tenantError) return respond(503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
    if (!tenant || tenant.id !== tenantId || tenant.status !== 'active' || tenant.product_key !== 'bella_preschool') {
      return respond(403, 'ANNOUNCEMENT_ACCESS_DENIED');
    }

    // Server-resolved recipients, all-branch scope and idempotent per-recipient delivery
    // are not proven. Hold before reading payload or creating a thread/notice.
    return respond(503, 'ANNOUNCEMENT_BROADCAST_NOT_READY');
  } catch {
    return respond(503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
  }
}
