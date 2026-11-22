import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { InteriorBOQAnalyticsService } from '@/products/bella-interior/services/interior-boq-analytics.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InteriorBOQ as DomainInteriorBOQ, BOQItem as DomainBOQItem, FurnitureItemCategory, BOQStatus } from '@/products/bella-interior/domain/commercial-costing/types';
import type {
  CreateBOQItemInput,
  UpdateBOQItemInput,
  DuplicateBOQItemInput,
  TransitionBOQStatusInput,
} from '@/products/bella-interior/domain/boq-overview.types';

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

  let effectiveProjectId: string | undefined;
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, requestedProjectId);
  if (!projectResult.ok) {
    if (projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION') {
      // If no projectId was explicitly requested (e.g. sidebar navigation / overview),
      // gracefully resolve to canonical project (INT-2024-001 Villa Sunrise) or first available project
      const canonicalMatch = projectResult.availableProjects?.find(
        (p) => p.code === 'INT-2024-001' || p.name.includes('Villa Sunrise')
      );
      effectiveProjectId = canonicalMatch?.id || projectResult.availableProjects?.[0]?.id;
    }

    if (!effectiveProjectId) {
      // If no project found in tenant, return canonical demo overview
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(ctx.tenantId);
      return NextResponse.json({ success: true, data: { overview } }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
  } else {
    effectiveProjectId = projectResult.projectId;
  }

  try {
    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_read_boqs', {
      p_project_id: effectiveProjectId,
    });

    if (!error && isInteriorRbacRecord(data) && data.hasBoq === true) {
      return NextResponse.json({ success: true, data }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const overview = await InteriorBOQAnalyticsService.getBOQOverview(ctx.tenantId, effectiveProjectId);
    return NextResponse.json({ success: true, data: { overview, ...(isInteriorRbacRecord(data) ? { rpcData: data } : {}) } }, {
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

  // ─── Action-based commands from BOQ Studio UI ─────────────────────────────
  if (typeof payload['action'] === 'string') {
    const action = payload['action'];
    try {
      if (action === 'add_item') {
        const raw = (payload['item'] || {}) as Record<string, unknown>;
        const itemInput: CreateBOQItemInput = {
          zoneId: String(raw.zoneId || ''),
          zoneName: raw.zoneName ? String(raw.zoneName) : undefined,
          itemName: String(raw.itemName || ''),
          specifications: String(raw.specifications || ''),
          unit: String(raw.unit || 'bộ'),
          quantity: Number(raw.quantity || 1),
          internalUnitCost: Number(raw.internalUnitCost ?? raw.unitCostInternal ?? 0),
          clientUnitPrice: Number(raw.clientUnitPrice ?? raw.unitPriceClient ?? 0),
        };
        const updated = await InteriorBOQAnalyticsService.addItem(tenantId, itemInput);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'update_item') {
        const raw = (payload['item'] || {}) as Record<string, unknown>;
        const itemInput: UpdateBOQItemInput = {
          itemId: String(raw.itemId || ''),
          itemName: raw.itemName !== undefined ? String(raw.itemName) : undefined,
          specifications: raw.specifications !== undefined ? String(raw.specifications) : undefined,
          unit: raw.unit !== undefined ? String(raw.unit) : undefined,
          quantity: raw.quantity !== undefined ? Number(raw.quantity) : undefined,
          internalUnitCost: raw.internalUnitCost !== undefined ? Number(raw.internalUnitCost) : (raw.unitCostInternal !== undefined ? Number(raw.unitCostInternal) : undefined),
          clientUnitPrice: raw.clientUnitPrice !== undefined ? Number(raw.clientUnitPrice) : (raw.unitPriceClient !== undefined ? Number(raw.unitPriceClient) : undefined),
        };
        const updated = await InteriorBOQAnalyticsService.updateItem(tenantId, itemInput);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'duplicate_item') {
        const raw = (payload['duplicate'] || {}) as Record<string, unknown>;
        const dupInput: DuplicateBOQItemInput = {
          itemId: String(raw.itemId || payload['itemId'] || ''),
          targetZoneId: raw.targetZoneId ? String(raw.targetZoneId) : undefined,
        };
        const updated = await InteriorBOQAnalyticsService.duplicateItem(tenantId, dupInput);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'delete_item') {
        const itemId = String(payload['itemId'] || '');
        const updated = await InteriorBOQAnalyticsService.deleteItem(tenantId, itemId);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'add_zone') {
        const zoneName = String(payload['zoneName'] || '');
        const updated = await InteriorBOQAnalyticsService.addZone(tenantId, zoneName);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'delete_zone') {
        const zoneId = String(payload['zoneId'] || '');
        const updated = await InteriorBOQAnalyticsService.deleteZone(tenantId, zoneId);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'update_status') {
        const raw = (payload['transition'] || {}) as Record<string, unknown>;
        const targetStatus = (raw.targetStatus || payload['targetStatus']) as BOQStatus;
        const transitionInput: TransitionBOQStatusInput = {
          targetStatus,
          actorName: raw.actorName ? String(raw.actorName) : undefined,
        };
        const updated = await InteriorBOQAnalyticsService.transitionStatus(tenantId, transitionInput);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'create_revision') {
        const updated = await InteriorBOQAnalyticsService.createRevision(tenantId);
        return NextResponse.json({ success: true, data: updated }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (action === 'reset') {
        InteriorBOQAnalyticsService.resetTenantBOQData(tenantId);
        const fresh = await InteriorBOQAnalyticsService.getBOQOverview(tenantId);
        return NextResponse.json({ success: true, data: fresh }, { headers: { 'Cache-Control': 'no-store' } });
      }

      return NextResponse.json({ success: false, error: `Unrecognized action: ${action}` }, { status: 400 });
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Action failed';
      return NextResponse.json({ success: false, error: message }, { status: 422 });
    }
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
  if (!validInteriorUuid(parsed.designRevisionId)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_ID_INVALID' }, { status: 422 });
  }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Field "items" must be a non-empty array' },
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

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    await repo.saveBOQ(tenantId, domainBOQ, { auditActorId: actor.id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.includes('AuthorizationViolation')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
    }
    if (message.includes('BOQPreconditionViolation')) {
      return NextResponse.json({ success: false, error: 'APPROVED_DESIGN_REVISION_REQUIRED' }, { status: 422 });
    }
    if (message.includes('TenantIsolationViolation')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_OR_REVISION_NOT_FOUND' }, { status: 404 });
    }
    if (message.includes('Immutability violation') || message.includes('ConcurrencyConflict')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_BOQ_STATE_CONFLICT' }, { status: 409 });
    }
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
