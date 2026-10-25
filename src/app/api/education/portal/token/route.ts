import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { isPortalIssuerContext, isPortalUuid } from '@/products/bella-education/parent-portal/domain/parent-portal.types';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const respond = (status: number, error: string) => NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

async function issue(request: Request, mint: boolean) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return respond(401, 'PORTAL_UNAUTHENTICATED');
    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !('status' in profile) || profile.status !== 'active'
      || !tenantId || profile.role?.trim().toLowerCase() !== 'admin') return respond(403, 'PORTAL_ACCESS_DENIED');
    const selectors = new URL(request.url).searchParams;
    if (['tenantId', 'tenant_id'].flatMap(k => selectors.getAll(k)).some(v => v !== tenantId)
      || ['actorId', 'actor_id', 'userId', 'user_id'].flatMap(k => selectors.getAll(k)).some(v => v !== user.id)
      || request.headers.has('x-tenant-id') && request.headers.get('x-tenant-id') !== tenantId
      || request.headers.has('x-actor-id') && request.headers.get('x-actor-id') !== user.id) return respond(403, 'TENANT_ISOLATION_VIOLATION');
    const { data: tenant, error: tenantError } = await client.from('tenants')
      .select('id, status, product_key').eq('id', tenantId).maybeSingle();
    if (tenantError) return respond(503, 'PORTAL_ACCESS_UNAVAILABLE');
    if (!tenant || tenant.id !== tenantId || tenant.status !== 'active' || tenant.product_key !== 'bella_preschool') return respond(403, 'PORTAL_ACCESS_DENIED');
    const selectorKeys = ['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id'];
    if ([...selectors.keys()].some(k => !selectorKeys.includes(k) && (mint || !['courseId', 'studentPartyId'].includes(k)))) return respond(400, 'PORTAL_INVALID_REQUEST');
    let body: unknown;
    if (mint) {
      try { body = await request.json(); } catch { return respond(400, 'PORTAL_INVALID_REQUEST'); }
    } else {
      if (['courseId', 'studentPartyId'].some(k => selectors.getAll(k).length !== 1)) return respond(400, 'PORTAL_INVALID_REQUEST');
      body = { courseId: selectors.get('courseId'), studentPartyId: selectors.get('studentPartyId') };
    }
    if (!record(body) || Object.keys(body).some(k => !['courseId', 'studentPartyId', 'guardianPartyId'].includes(k))
      || !isPortalUuid(body.courseId) || !isPortalUuid(body.studentPartyId)
      || mint && !isPortalUuid(body.guardianPartyId)) return respond(400, 'PORTAL_INVALID_REQUEST');
    const courseId = body.courseId.toLowerCase(), studentPartyId = body.studentPartyId.toLowerCase();
    const guardianPartyId = mint ? String(body.guardianPartyId).toLowerCase() : null;
    const { data, error: contextError } = await client.rpc('preschool_portal_issuer_context', {
      p_course_id: courseId, p_student_party_id: studentPartyId, ...(guardianPartyId ? { p_guardian_party_id: guardianPartyId } : {}),
    });
    if (contextError) return respond(contextError.code === '42501' ? 403 : 503, contextError.code === '42501' ? 'PORTAL_ACCESS_DENIED' : 'PORTAL_ACCESS_UNAVAILABLE');
    if (!isPortalIssuerContext(data) || data.tenantId !== tenantId || data.courseId !== courseId || data.studentPartyId !== studentPartyId
      || guardianPartyId && !data.guardians.some(g => g.guardianPartyId === guardianPartyId)) return respond(503, 'PORTAL_ACCESS_UNAVAILABLE');
    if (!mint) return NextResponse.json({ success: true, data: {
      tenantId: data.tenantId, courseId, studentPartyId,
      guardians: data.guardians.map(g => ({ guardianPartyId: g.guardianPartyId, guardianLabel: g.guardianLabel })),
    } }, { headers: PRIVATE_HEADERS });
    const token = PreschoolParentPortalService.generateDailyReadToken({ tenantId, courseId, studentPartyId, guardianPartyId: guardianPartyId! });
    return NextResponse.json({ success: true, portalUrl: `/portal/education/${encodeURIComponent(token)}`, expiresInSeconds: 86400 }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return respond(error instanceof ParentPortalAccessError ? error.status : 503, error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE');
  }
}
export const GET = (request: Request) => issue(request, false);
export const POST = (request: Request) => issue(request, true);
