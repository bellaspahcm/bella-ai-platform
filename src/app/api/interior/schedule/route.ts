import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  try {
    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_installation_plans', {
      p_project_id: projectId ?? null,
    });
    if (error || !Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
    }
    const plans = data.filter(isInteriorRbacRecord);
    return NextResponse.json({ success: true, data: { plans, total: plans.length } }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
}
