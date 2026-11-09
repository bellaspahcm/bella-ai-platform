import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Revision ID is required' }, { status: 400 });
  }

  const rpc = interiorRbacRpcClient(ctx.supabase);
  const { data: projectId, error: projectError } = await rpc.rpc('interior_resolve_project_id', {
    p_tenant_id: ctx.tenantId,
    p_resource_key: 'design_revision',
    p_resource_id: id,
    p_parent_id: null,
    p_project_id: null,
  });
  if (projectError) {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_LOOKUP_FAILED' }, { status: 503 });
  }
  if (typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: `Design revision not found: ${id}` }, { status: 404 });
  }
  const [revisionResult, roomZoneResult] = await Promise.all([
    rpc.rpc('interior_list_design_revisions', { p_project_id: projectId }),
    rpc.rpc('interior_list_room_zones', { p_project_id: projectId }),
  ]);
  if (revisionResult.error || roomZoneResult.error
    || !Array.isArray(revisionResult.data) || !Array.isArray(roomZoneResult.data)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_ROOM_ZONE_LOOKUP_FAILED' }, { status: 503 });
  }
  const revision = revisionResult.data.find((item): item is Record<string, unknown> =>
    isInteriorRbacRecord(item) && item.id === id,
  );
  if (!revision) return NextResponse.json({ success: false, error: `Design revision not found: ${id}` }, { status: 404 });
  const roomZones = roomZoneResult.data.filter(isInteriorRbacRecord);

  return NextResponse.json({ success: true, data: { revision, roomZones } });
}
