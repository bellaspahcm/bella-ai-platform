import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers });
}

/** Catalog identity only; operational classroom assignments require their own contract. */
export async function GET(request: Request): Promise<NextResponse> {
  if (['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id']
    .some(key => request.headers.has(key))) return failure('COURSE_CATALOG_ACCESS_DENIED', 403);
  if (new URL(request.url).searchParams.size) return failure('COURSE_CATALOG_INVALID_REQUEST', 400);
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return failure('COURSE_CATALOG_UNAUTHENTICATED', 401);
  }
  try {
    const client = await createClient();
    const auth = authorization
      ? await client.auth.getUser(authorization.slice(7)) : await client.auth.getUser();
    if (auth.error || !auth.data.user) return failure('COURSE_CATALOG_UNAUTHENTICATED', 401);
    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) return failure('COURSE_CATALOG_UNAVAILABLE', 503);
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id) return failure('COURSE_CATALOG_ACCESS_DENIED', 403);
    const tenantResult = await client.from('tenants').select('id,status,product_key')
      .eq('id', actor.tenant_id).maybeSingle();
    if (tenantResult.error) return failure('COURSE_CATALOG_UNAVAILABLE', 503);
    const tenant = tenantResult.data;
    if (!tenant || tenant.id !== actor.tenant_id || tenant.status !== 'active'
      || typeof tenant.product_key !== 'string' || !tenant.product_key.trim()) {
      return failure('COURSE_CATALOG_ACCESS_DENIED', 403);
    }
    // Only a verified other Product can select the existing non-Preschool UI.
    if (tenant.product_key !== 'bella_preschool') return failure('COURSE_CATALOG_UNSUPPORTED_PRODUCT', 403);
    if (actor.role !== 'admin') return failure('COURSE_CATALOG_ACCESS_DENIED', 403);
    const courses = await new CanonicalCourseCatalogContractImpl(client).listCourses(actor.tenant_id);
    return NextResponse.json({ success: true, tenantId: actor.tenant_id, courses }, { headers });
  } catch {
    return failure('COURSE_CATALOG_UNAVAILABLE', 503);
  }
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json({ success: false, error: 'METHOD_NOT_ALLOWED' }, {
    status: 405, headers: { ...headers, Allow: 'GET' },
  });
}
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
