import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { PlatformManufacturingAdapter } from '@/products/bella-interior/adapters/platform-manufacturing.adapter';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductionOrder as DomainProductionOrder } from '@/products/bella-interior/domain/manufacturing-install/types';

export const dynamic = 'force-dynamic';

type ProductionStage = 'design_locked' | 'cutting_cnc' | 'edge_banding' | 'assembly' | 'workshop_qc' | 'packing' | 'dispatched';

interface OrderItem {
  description: string;
  quantity: number;
  unit: string;
  estimatedHours: number;
}

interface CreateProductionOrderBody {
  projectId: string;
  designRevisionId: string;
  description: string;
  items: OrderItem[];
}

function isOrderItems(value: unknown): value is OrderItem[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const row = item as Record<string, unknown>;
    return typeof row.description === 'string' && row.description.trim().length > 0
      && typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0
      && typeof row.unit === 'string' && row.unit.trim().length > 0
      && typeof row.estimatedHours === 'number' && Number.isFinite(row.estimatedHours) && row.estimatedHours > 0;
  });
}

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }
  const payload = body as Partial<CreateProductionOrderBody>;
  if (typeof payload.projectId !== 'string' || !payload.projectId
    || typeof payload.designRevisionId !== 'string' || !payload.designRevisionId
    || typeof payload.description !== 'string' || !payload.description.trim()
    || !isOrderItems(payload.items)) {
    return NextResponse.json({ success: false, error: 'projectId, designRevisionId, description and valid items are required' }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let project;
  let revision;
  try {
    project = await repo.getProject(ctx.tenantId, payload.projectId);
    revision = await repo.getDesignRevision(ctx.tenantId, payload.designRevisionId);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_PRODUCTION_PRECONDITION_LOOKUP_FAILED' }, { status: 503 });
  }
  if (!project || !revision || revision.projectId !== project.id || revision.status !== 'approved') {
    return NextResponse.json({ success: false, error: 'Production orders require an approved design revision belonging to a project in this tenant' }, { status: 422 });
  }

  const orderId = randomUUID();
  const now = new Date().toISOString();
  let manufacturingResult;
  try {
    manufacturingResult = await new PlatformManufacturingAdapter().requestProduction({
      tenantId: ctx.tenantId,
      actorUserId: ctx.actor.id,
      designRevisionId: revision.id,
      interiorProjectId: project.id,
      projectCode: project.code,
      items: payload.items.map((item) => ({
        boqItemId: randomUUID(),
        itemName: item.description,
        roomZoneName: 'Room',
        quantity: item.quantity,
        unit: item.unit,
        carcassMaterial: 'Standard',
        doorFrontMaterial: 'Standard',
        surfaceFinish: 'Standard',
        hardwareSpec: 'Standard',
        dimensionsMm: { width: 600, depth: 600, height: 720 },
        estimatedProductionHours: item.estimatedHours,
      })),
      requiredByDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'MANUFACTURING_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
  if (manufacturingResult.status !== 'released') {
    return NextResponse.json({ success: false, error: 'MANUFACTURING_ORDER_NOT_RELEASED' }, { status: 409 });
  }

  const domainOrder: DomainProductionOrder = {
    id: orderId,
    tenantId: ctx.tenantId,
    projectId: project.id,
    designRevisionId: revision.id,
    boqId: randomUUID(),
    orderNumber: manufacturingResult.manufacturingOrderNumber,
    mode: 'in_house',
    status: 'order_released',
    scheduledStartDate: now,
    scheduledCompletionDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    workshopManagerName: 'Trưởng xưởng sản xuất',
    items: payload.items.map((item) => ({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      productionOrderId: orderId,
      boqItemId: randomUUID(),
      roomZoneName: 'Phòng thi công',
      itemName: item.description,
      quantity: item.quantity,
      unit: item.unit,
      dimensionsSummary: 'Quy cách kỹ thuật',
      materialSummary: 'Ván & Ngũ kim',
      currentStage: 'cutting_cnc',
      qcPassed: false,
    })),
  };

  try {
    await repo.saveProductionOrder(ctx.tenantId, domainOrder);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_PRODUCTION_ORDER_PERSISTENCE_FAILED' }, { status: 503 });
  }

  return NextResponse.json({ success: true, data: { ...domainOrder, manufacturingProductionOrderId: manufacturingResult.manufacturingProductionOrderId } }, { status: 201 });
}
