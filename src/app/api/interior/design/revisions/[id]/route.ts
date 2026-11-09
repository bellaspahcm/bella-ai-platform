import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let revision;
  try {
    revision = await repo.getDesignRevision(ctx.tenantId, id);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_LOOKUP_FAILED' }, { status: 503 });
  }
  if (!revision) {
    return NextResponse.json({ success: false, error: `Design revision not found: ${id}` }, { status: 404 });
  }

  let roomZones;
  try {
    roomZones = await repo.listRoomZones(ctx.tenantId, revision.projectId);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_ROOM_ZONE_LOOKUP_FAILED' }, { status: 503 });
  }

  return NextResponse.json({ success: true, data: { revision, roomZones } });
}
