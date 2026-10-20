import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export const COURSE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type CourseReadContext =
  | {
    allowed: true;
    supabase: Awaited<ReturnType<typeof createClient>>;
    tenantId: string;
  }
  | { allowed: false; response: NextResponse };

function deny(status: 401 | 403, error: string): CourseReadContext {
  return {
    allowed: false,
    response: NextResponse.json({ success: false, error }, {
      status,
      headers: COURSE_PRIVATE_HEADERS,
    }),
  };
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
  return { allowed: true, supabase, tenantId };
}
