import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import { PreschoolRegistryContractImpl } from '@/platform/education/contracts/preschool-registry.contract.impl';
import { normalizeRegistryQuery, PreschoolRegistryError, type PreschoolRegistryStatus } from '@/platform/education/contracts/preschool-registry.contract';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return NextResponse.json({ success: false, error: 'REGISTRY_UNAUTHENTICATED' }, { status: 401, headers });
    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) throw new PreschoolRegistryError('REGISTRY_UNAVAILABLE', 503);
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id || actor.role !== 'admin') throw new PreschoolRegistryError('REGISTRY_ACCESS_DENIED', 403);
    // No mock identity, caller-provided tenant or privileged application client.
    const params = new URL(request.url).searchParams;
    const allowed = ['query', 'status', 'courseId', 'branchId', 'offset', 'limit'];
    if (['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'].some(key => request.headers.has(key))) {
      throw new PreschoolRegistryError('REGISTRY_ACCESS_DENIED', 403);
    }
    if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)
      || ['offset', 'limit'].some(key => params.has(key) && !/^\d{1,6}$/.test(params.get(key) ?? ''))) {
      throw new PreschoolRegistryError('REGISTRY_INVALID_REQUEST', 400);
    }
    const query = normalizeRegistryQuery({ query: params.get('query') ?? '', status: (params.get('status') ?? 'all') as PreschoolRegistryStatus,
      courseId: params.get('courseId'), branchId: params.get('branchId'),
      offset: params.has('offset') ? Number(params.get('offset')) : 0,
      limit: params.has('limit') ? Number(params.get('limit')) : 20 });
    const registry = await new PreschoolRegistryContractImpl(client).read(actor.tenant_id, query);
    return NextResponse.json({ success: true, registry }, { headers });
  } catch (error) {
    const known = error instanceof PreschoolRegistryError;
    return NextResponse.json({ success: false, error: known ? error.code : 'REGISTRY_UNAVAILABLE' }, { status: known ? error.status : 503, headers });
  }
}
