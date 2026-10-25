import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export const COURSE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type CourseReadContext =
  | {
    allowed: true;
    supabase: Awaited<ReturnType<typeof createClient>>;
    tenantId: string;
    actor: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  }
  | { allowed: false; response: NextResponse };

type CourseCatalogReadContext =
  | { allowed: true; supabase: Awaited<ReturnType<typeof createClient>>; tenantId: string }
  | { allowed: false; response: NextResponse };

function deny(status: 400 | 401 | 403, error: string): CourseReadContext {
  return {
    allowed: false,
    response: NextResponse.json({ success: false, error }, {
      status,
      headers: COURSE_PRIVATE_HEADERS,
    }),
  };
}

function denyCatalog(status: 400 | 401 | 403, error: string): CourseCatalogReadContext {
  return {
    allowed: false,
    response: NextResponse.json({ success: false, error }, {
      status,
      headers: COURSE_PRIVATE_HEADERS,
    }),
  };
}

type CourseReadMode =
  | { allowed: true; mode: 'default' | 'catalog' }
  | { allowed: false; response: NextResponse };

/** A mode selects a projection, never grants permission to read it. */
export function resolveCourseReadMode(request: Request): CourseReadMode {
  const search = new URL(request.url).searchParams;
  const views = search.getAll('view');
  if (views.length === 0) return { allowed: true, mode: 'default' };
  if (views.length !== 1 || views[0] !== 'catalog') {
    return { allowed: false, response: NextResponse.json({ success: false, error: 'COURSE_INVALID_CATALOG_REQUEST' }, {
      status: 400, headers: COURSE_PRIVATE_HEADERS,
    }) };
  }
  const keys = [...search.keys()];
  const tenants = search.getAll('tenantId');
  if (keys.some(key => key !== 'view' && key !== 'tenantId') || tenants.length > 1
    || tenants.some(tenant => !tenant || tenant.trim() !== tenant)) {
    return { allowed: false, response: NextResponse.json({ success: false, error: 'COURSE_INVALID_CATALOG_REQUEST' }, {
      status: 400, headers: COURSE_PRIVATE_HEADERS,
    }) };
  }
  return { allowed: true, mode: 'catalog' };
}

/** The catalog's approved C matrix uses fresh, minimal caller-visible identity. */
export async function resolveCourseCatalogReadContext(request: Request): Promise<CourseCatalogReadContext> {
  const mode = resolveCourseReadMode(request);
  if (!mode.allowed) return mode;
  if (mode.mode !== 'catalog') return denyCatalog(400, 'COURSE_INVALID_CATALOG_REQUEST');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return denyCatalog(401, 'COURSE_UNAUTHENTICATED');

  const { data: profile, error: profileError } = await supabase.from('users')
    .select('id,tenant_id,role,status').eq('id', user.id).maybeSingle();
  const tenantId = profile?.tenant_id;
  if (profileError || !profile || profile.id !== user.id || profile.status !== 'active'
    || !tenantId || tenantId.trim() !== tenantId) {
    return denyCatalog(403, 'COURSE_ACCESS_DENIED');
  }
  const requestedTenant = new URL(request.url).searchParams.get('tenantId');
  if (requestedTenant !== null && requestedTenant !== tenantId) {
    return denyCatalog(403, 'TENANT_ISOLATION_VIOLATION');
  }

  const { data: tenant, error: tenantError } = await supabase.from('tenants')
    .select('id,status,product_key').eq('id', tenantId).maybeSingle();
  if (tenantError || !tenant || tenant.id !== tenantId || tenant.status !== 'active'
    || typeof tenant.product_key !== 'string' || !tenant.product_key.trim()) {
    return denyCatalog(403, 'COURSE_ACCESS_DENIED');
  }
  // Only this trusted current-Product result permits the existing UI compatibility branch.
  if (tenant.product_key !== 'bella_preschool') return denyCatalog(403, 'COURSE_CATALOG_UNSUPPORTED_PRODUCT');
  if (profile.role !== 'admin') return denyCatalog(403, 'COURSE_ACCESS_DENIED');
  return { allowed: true, supabase, tenantId };
}

export async function resolveCourseReadContext(request: Request): Promise<CourseReadContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return deny(401, 'COURSE_UNAUTHENTICATED');

  // Verify Auth before calling the profile resolver, which has a development mock path.
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id?.trim();
  if (!profile || profile.id !== user.id || !('status' in profile) || profile.status !== 'active' || !tenantId) {
    return deny(403, 'COURSE_ACCESS_DENIED');
  }

  const requestedTenants = new URL(request.url).searchParams.getAll('tenantId');
  if (requestedTenants.some((requestedTenant) => requestedTenant !== tenantId)) {
    return deny(403, 'TENANT_ISOLATION_VIOLATION');
  }

  // RLS remains authoritative for these reads; this does not establish a full role/branch matrix.
  return { allowed: true, supabase, tenantId, actor: profile };
}
