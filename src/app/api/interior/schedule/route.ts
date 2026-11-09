import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    const plans = await repo.listInstallationPlans(ctx.tenantId, projectId);
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
