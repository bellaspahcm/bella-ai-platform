import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'projectId query parameter is required' }, { status: 400 });
  }

  const rpc = interiorRbacRpcClient(ctx.supabase);
  try {
    const [revisionResult, roomZoneResult] = await Promise.all([
      rpc.rpc('interior_list_design_revisions', { p_project_id: projectId }),
      rpc.rpc('interior_list_room_zones', { p_project_id: projectId }),
    ]);
    if (revisionResult.error || roomZoneResult.error
      || !Array.isArray(revisionResult.data) || !Array.isArray(roomZoneResult.data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_LOOKUP_FAILED' }, { status: 503 });
    }
    const revisions = revisionResult.data.filter(isInteriorRbacRecord);
    const roomZones = roomZoneResult.data.filter(isInteriorRbacRecord);
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        revisions,
        roomZones,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
}
