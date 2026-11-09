import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type ProductionStage = 'design_locked' | 'cutting_cnc' | 'edge_banding' | 'assembly' | 'workshop_qc' | 'packing' | 'dispatched';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  const stage = searchParams.get('stage') as ProductionStage | null;
  const validStages: ProductionStage[] = ['design_locked', 'cutting_cnc', 'edge_banding', 'assembly', 'workshop_qc', 'packing', 'dispatched'];
  if (stage && !validStages.includes(stage)) {
    return NextResponse.json({ success: false, error: `Invalid stage. Valid values: ${validStages.join(', ')}` }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    const rows = await repo.listProductionOrders(ctx.tenantId, projectId);
    const orders = rows.map((order) => ({
      id: order.id,
      tenantId: order.tenantId,
      projectId: order.projectId,
      designRevisionId: order.designRevisionId,
      description: order.orderNumber,
      items: order.items.map((item) => ({
        description: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        estimatedHours: 8,
      })),
      stage: (order.status === 'in_production' ? 'cutting_cnc' : order.status === 'ready_for_dispatch' ? 'packing' : order.status === 'dispatched' ? 'dispatched' : 'design_locked') as ProductionStage,
      createdAt: order.scheduledStartDate,
      updatedAt: order.scheduledCompletionDate,
    }));
    return NextResponse.json({ success: true, data: stage ? orders.filter((order) => order.stage === stage) : orders });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_PRODUCTION_ORDER_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    success: false,
    error: 'INTERIOR_PRODUCTION_COMMAND_PERSISTENCE_UNAVAILABLE',
  }, { status: 503 });
}

