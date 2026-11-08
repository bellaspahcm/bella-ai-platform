import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ success: false, error: 'projectId query parameter is required' }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    const project = await repo.getProject(ctx.tenantId, projectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    const [revisions, roomZones] = await Promise.all([
      repo.listDesignRevisions(ctx.tenantId, project.id),
      repo.listRoomZones(ctx.tenantId, project.id),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
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
