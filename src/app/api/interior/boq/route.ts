import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InteriorBOQ as DomainInteriorBOQ, BOQItem as DomainBOQItem, FurnitureItemCategory } from '@/products/bella-interior/domain/commercial-costing/types';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BOQItem {
  id: string;
  itemCode?: string;
  roomName?: string;
  itemName?: string;
  description: string;
  dimensions?: string;
  specifications?: string;
  unit: string;
  quantity: number;
  unitCostInternal: number;
  unitPriceClient: number;
  totalCostInternal: number;
  totalPriceClient: number;
  grossMarginPercent?: number;
}

interface BOQCreateItemInput {
  itemCode?: string;
  roomName?: string;
  itemName?: string;
  description: string;
  dimensions?: string;
  specifications?: string;
  unit: string;
  quantity: number;
  unitCostInternal: number;
  unitPriceClient: number;
}

interface BOQ {
  id: string;
  projectId: string;
  designRevisionId: string;
  boqNumber?: string;
  items: BOQItem[];
  grandTotalCostInternal: number;
  grandTotalPriceClient: number;
  totalGrossMargin?: number;
  grossMarginPercent?: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateBOQBody {
  projectId: string;
  designRevisionId: string;
  items: BOQCreateItemInput[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateBOQItemInput(item: unknown): item is BOQCreateItemInput {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  const hasDesc = (typeof i['description'] === 'string' && i['description'].trim().length > 0) ||
                  (typeof i['itemName'] === 'string' && i['itemName'].trim().length > 0);
  return (
    hasDesc &&
    typeof i['unit'] === 'string' &&
    typeof i['quantity'] === 'number' &&
    i['quantity'] > 0 &&
    typeof i['unitCostInternal'] === 'number' &&
    i['unitCostInternal'] >= 0 &&
    typeof i['unitPriceClient'] === 'number' &&
    i['unitPriceClient'] >= 0
  );
}

// ─── GET /api/interior/boq ────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { searchParams } = new URL(request.url);
  const requestedProjectId = searchParams.get('projectId');
  if (!requestedProjectId) {
    return NextResponse.json({ success: false, error: 'projectId query parameter is required' }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    const project = await repo.getProject(ctx.tenantId, requestedProjectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    const [financeDecision, contractDecision] = await Promise.all([
      ctx.authorization.authorize({ permissionId: 'interior:finance:read', tenantId: ctx.tenantId }),
      ctx.authorization.authorize({ permissionId: 'interior:contract:read', tenantId: ctx.tenantId }),
    ]);
    const canReadInternalCosts = financeDecision.status === 'ALLOW';
    const canReadClientPricing = canReadInternalCosts || contractDecision.status === 'ALLOW';
    const boqs = await repo.listBOQRevisions(ctx.tenantId, project.id);
    const totals = boqs.reduce((sum, boq) => ({
      internalCost: sum.internalCost + boq.totalInternalCost,
      clientPrice: sum.clientPrice + boq.totalClientPrice,
      grossMargin: sum.grossMargin + boq.totalGrossMargin,
    }), { internalCost: 0, clientPrice: 0, grossMargin: 0 });
    const projectedBOQs = boqs.map((boq) => {
      const {
        totalInternalCost,
        totalClientPrice,
        totalGrossMargin,
        grossMarginPercent,
        items,
        ...visibleBOQ
      } = boq;
      return {
        ...visibleBOQ,
        items: items.map((item) => {
          const {
            internalUnitCost,
            internalTotalCost,
            clientUnitPrice,
            clientTotalPrice,
            grossMarginAmount,
            grossMarginPercent: itemGrossMarginPercent,
            ...visibleItem
          } = item;
          return {
            ...visibleItem,
            ...(canReadInternalCosts ? {
              internalUnitCost,
              internalTotalCost,
              grossMarginAmount,
              grossMarginPercent: itemGrossMarginPercent,
            } : {}),
            ...(canReadClientPricing ? { clientUnitPrice, clientTotalPrice } : {}),
          };
        }),
        ...(canReadInternalCosts ? { totalInternalCost, totalGrossMargin, grossMarginPercent } : {}),
        ...(canReadClientPricing ? { totalClientPrice } : {}),
      };
    });
    const visibleTotals = {
      ...(canReadInternalCosts ? { internalCost: totals.internalCost, grossMargin: totals.grossMargin } : {}),
      ...(canReadClientPricing ? { clientPrice: totals.clientPrice } : {}),
    };
    return NextResponse.json({ success: true, data: { projectId: project.id, boqs: projectedBOQs, total: boqs.length, totals: visibleTotals } }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_BOQ_LOOKUP_FAILED' }, { status: 503 });
  }
}

// ─── POST /api/interior/boq ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload['action'] === 'string') {
    return NextResponse.json({ success: false, error: 'INTERIOR_BOQ_COMMAND_PERSISTENCE_UNAVAILABLE' }, { status: 503 });
  }

  // ─── Legacy batch creation path (Backward compatibility) ───────────────────
  const parsed = body as Partial<CreateBOQBody>;

  if (!parsed.projectId || typeof parsed.projectId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "projectId" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.designRevisionId || typeof parsed.designRevisionId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "designRevisionId" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Field "items" must be a non-empty array' },
      { status: 422 }
    );
  }

  // ── Guard: designRevisionId must reference an approved revision ───────────
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let dbRevision;
  try {
    dbRevision = await repo.getDesignRevision(tenantId, parsed.designRevisionId);
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_DESIGN_REVISION_LOOKUP_FAILED' },
      { status: 503 },
    );
  }

  if (!dbRevision) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${parsed.designRevisionId}` },
      { status: 404 }
    );
  }

  if (dbRevision.projectId !== parsed.projectId) {
    return NextResponse.json(
      { success: false, error: 'Design revision does not belong to the requested project' },
      { status: 422 },
    );
  }

  let project;
  try {
    project = await repo.getProject(tenantId, parsed.projectId);
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PROJECT_LOOKUP_FAILED' },
      { status: 503 },
    );
  }
  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  if (dbRevision.status !== 'approved') {
    return NextResponse.json(
      {
        success: false,
        error: 'Design revision must be approved before creating BOQ',
      },
      { status: 422 }
    );
  }

  // ── Validate each item ────────────────────────────────────────────────────
  for (let i = 0; i < parsed.items.length; i++) {
    if (!validateBOQItemInput(parsed.items[i])) {
      return NextResponse.json(
        {
          success: false,
          error: `Item at index ${i} is invalid. Each item must have: description or itemName, unit, quantity (>0), unitCostInternal (>=0), unitPriceClient (>=0).`,
        },
        { status: 422 }
      );
    }
  }

  const now = new Date().toISOString();
  const boqId = randomUUID();
  const boqNumber = `BOQ-${Date.now().toString().slice(-6)}`;

  const domainItems: DomainBOQItem[] = parsed.items.map((raw, idx) => {
    const item = raw as BOQCreateItemInput;
    const itemName = item.itemName || item.description;
    const internalUnitCost = item.unitCostInternal;
    const internalTotalCost = item.quantity * item.unitCostInternal;
    const clientUnitPrice = item.unitPriceClient;
    const clientTotalPrice = item.quantity * item.unitPriceClient;
    const grossMarginAmount = clientTotalPrice - internalTotalCost;
    const grossMarginPercent = clientTotalPrice > 0
      ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
      : 0;

    return {
      id: randomUUID(),
      tenantId,
      boqId,
      roomZoneId: 'zone-01',
      roomZoneName: item.roomName || 'Không gian chính',
      itemCode: item.itemCode || `ITEM-${idx + 1}`,
      itemName,
      category: 'cabinetry' as FurnitureItemCategory,
      dimensions: {
        width: 2000,
        depth: 600,
        height: 850,
        unit: 'mm',
      },
      specifications: {
        carcassMaterial: 'MDF lõi xanh chống ẩm',
        doorFrontMaterial: 'Cánh phủ Melamine cao cấp',
        surfaceFinish: 'Sơn hoàn thiện PU bóng mờ',
        hardwareSpec: 'Bản lề giảm chấn Blum',
      },
      unit: (item.unit as 'bộ' | 'cái' | 'md' | 'm2' | 'gói') || 'bộ',
      quantity: item.quantity,
      internalUnitCost,
      internalTotalCost,
      clientUnitPrice,
      clientTotalPrice,
      grossMarginAmount,
      grossMarginPercent,
    };
  });

  const grandTotalCostInternal = domainItems.reduce((sum, i) => sum + i.internalTotalCost, 0);
  const grandTotalPriceClient = domainItems.reduce((sum, i) => sum + i.clientTotalPrice, 0);
  const totalGrossMargin = grandTotalPriceClient - grandTotalCostInternal;
  const grossMarginPercent = grandTotalPriceClient > 0
    ? Math.round((totalGrossMargin / grandTotalPriceClient) * 1000) / 10
    : 0;

  const domainBOQ: DomainInteriorBOQ = {
    id: boqId,
    tenantId,
    projectId: parsed.projectId,
    designRevisionId: parsed.designRevisionId,
    boqNumber,
    versionNumber: 1,
    status: 'draft',
    totalInternalCost: grandTotalCostInternal,
    totalClientPrice: grandTotalPriceClient,
    totalGrossMargin,
    grossMarginPercent,
    items: domainItems,
    preparedBy: actor.full_name || 'Dự toán viên',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await repo.saveBOQ(tenantId, domainBOQ, { auditActorId: actor.id });
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_BOQ_PERSISTENCE_FAILED' },
      { status: 503 },
    );
  }

  const boqItems: BOQItem[] = domainItems.map((item) => ({
    id: item.id,
    itemCode: item.itemCode,
    roomName: item.roomZoneName,
    itemName: item.itemName,
    description: item.itemName,
    dimensions: `${item.dimensions.width}x${item.dimensions.depth}x${item.dimensions.height} mm`,
    specifications: `${item.specifications.carcassMaterial} • ${item.specifications.surfaceFinish}`,
    unit: item.unit,
    quantity: item.quantity,
    unitCostInternal: item.internalUnitCost,
    unitPriceClient: item.clientUnitPrice,
    totalCostInternal: item.internalTotalCost,
    totalPriceClient: item.clientTotalPrice,
    grossMarginPercent: item.grossMarginPercent,
  }));

  const newBOQ: BOQ = {
    id: boqId,
    projectId: parsed.projectId,
    designRevisionId: parsed.designRevisionId,
    boqNumber,
    items: boqItems,
    grandTotalCostInternal,
    grandTotalPriceClient,
    totalGrossMargin,
    grossMarginPercent,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(
    { success: true, data: { boq: newBOQ } },
    { status: 201 }
  );
}
