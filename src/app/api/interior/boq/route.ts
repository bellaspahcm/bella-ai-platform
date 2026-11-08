import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mockRevisions } from '../design/revisions/route';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BOQStatus, InteriorBOQ as DomainInteriorBOQ, BOQItem as DomainBOQItem, FurnitureItemCategory } from '@/products/bella-interior/domain/commercial-costing/types';
import { InteriorBOQAnalyticsService } from '@/products/bella-interior/services/interior-boq-analytics.service';

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

// ─── Mock In-Memory Store ─────────────────────────────────────────────────────

const mockBOQs: BOQ[] = [
  {
    id: 'boq-001',
    projectId: 'proj-001',
    designRevisionId: 'rev-001',
    boqNumber: 'BOQ-DUBAI-001',
    items: [
      {
        id: 'boqi-001',
        itemCode: 'LIV-PANEL-01',
        roomName: 'Phòng Khách Luxury',
        itemName: 'Hệ vách ốp nan gỗ óc chó kết hợp đá Marble',
        description: 'Hệ vách ốp nan gỗ óc chó kết hợp đá Marble',
        dimensions: '6000x150x3200 mm',
        specifications: 'Khung sắt + Plywood + Nan gỗ óc chó tự nhiên sơn bóng mờ 50%',
        unit: 'bộ',
        quantity: 1,
        unitCostInternal: 120_000_000,
        unitPriceClient: 195_000_000,
        totalCostInternal: 120_000_000,
        totalPriceClient: 195_000_000,
        grossMarginPercent: 38.5,
      },
      {
        id: 'boqi-002',
        itemCode: 'KIT-ISLAND-01',
        roomName: 'Bếp Đảo Master',
        itemName: 'Bàn đảo bếp mặt đá Vicostone và tủ rượu cánh kính',
        description: 'Bàn đảo bếp mặt đá Vicostone và tủ rượu cánh kính',
        dimensions: '3200x1100x880 mm',
        specifications: 'MDF lõi xanh An Cường + Mặt đá Vicostone BQ8628 + Ray Blum Legrabox',
        unit: 'bộ',
        quantity: 1,
        unitCostInternal: 95_000_000,
        unitPriceClient: 165_000_000,
        totalCostInternal: 95_000_000,
        totalPriceClient: 165_000_000,
        grossMarginPercent: 42.4,
      },
      {
        id: 'boqi-003',
        itemCode: 'MAS-BED-01',
        roomName: 'Phòng Ngủ Master',
        itemName: 'Giường ngủ 2mx2m2 bọc da bò Ý cao cấp',
        description: 'Giường ngủ 2mx2m2 bọc da bò Ý cao cấp',
        dimensions: '2000x2200x1100 mm',
        specifications: 'Khung gỗ sồi tự nhiên + Da bò Mastrotto nhập khẩu Ý + Đệm mút D40',
        unit: 'cái',
        quantity: 1,
        unitCostInternal: 35_000_000,
        unitPriceClient: 58_000_000,
        totalCostInternal: 35_000_000,
        totalPriceClient: 58_000_000,
        grossMarginPercent: 39.7,
      },
    ],
    grandTotalCostInternal: 250_000_000,
    grandTotalPriceClient: 418_000_000,
    totalGrossMargin: 168_000_000,
    grossMarginPercent: 40.2,
    createdAt: '2024-02-05T09:00:00.000Z',
    updatedAt: '2024-02-05T09:00:00.000Z',
  },
];

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
  let tenantId = 'tenant-bella-interior-default';
  try {
    const ctx = await resolveInteriorContext(request);
    if (ctx.ok) {
      tenantId = ctx.tenantId;
    }
  } catch {
    // default tenant fallback
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;

  const overview = await InteriorBOQAnalyticsService.getBOQOverview(tenantId, projectId);

  const filtered = projectId
    ? mockBOQs.filter((b) => b.projectId === projectId)
    : mockBOQs;

  return NextResponse.json(
    {
      ...overview,
      success: true,
      data: {
        overview,
        boqs: filtered,
        total: filtered.length,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
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

  // ─── Action-based Router for BOQ Manual Workspace ──────────────────────────
  if (typeof payload['action'] === 'string') {
    const action = payload['action'];
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);

    try {
      const previousOverview = await InteriorBOQAnalyticsService.getBOQOverview(tenantId);
      let result;
      switch (action) {
        case 'add_zone': {
          const zoneName = payload['zoneName'] as string;
          if (!zoneName || typeof zoneName !== 'string' || !zoneName.trim()) {
            return NextResponse.json({ success: false, error: 'Tên khu vực không được để trống' }, { status: 422 });
          }
          result = await InteriorBOQAnalyticsService.addZone(tenantId, zoneName);
          break;
        }

        case 'delete_zone': {
          const zoneId = payload['zoneId'] as string;
          if (!zoneId || typeof zoneId !== 'string') {
            return NextResponse.json({ success: false, error: 'zoneId không hợp lệ' }, { status: 422 });
          }
          result = await InteriorBOQAnalyticsService.deleteZone(tenantId, zoneId);
          break;
        }

        case 'add_item': {
          const item = payload['item'] as Record<string, unknown>;
          if (!item || typeof item !== 'object') {
            return NextResponse.json({ success: false, error: 'Dữ liệu cấu kiện không hợp lệ' }, { status: 422 });
          }
          if (!item['itemName'] || typeof item['itemName'] !== 'string') {
            return NextResponse.json({ success: false, error: 'Tên cấu kiện không được để trống' }, { status: 422 });
          }
          if (typeof item['quantity'] !== 'number' || item['quantity'] <= 0) {
            return NextResponse.json({ success: false, error: 'Số lượng phải lớn hơn 0' }, { status: 422 });
          }
          if (typeof item['internalUnitCost'] !== 'number' || item['internalUnitCost'] < 0) {
            return NextResponse.json({ success: false, error: 'Đơn giá vốn không được âm' }, { status: 422 });
          }
          if (typeof item['clientUnitPrice'] !== 'number' || item['clientUnitPrice'] < 0) {
            return NextResponse.json({ success: false, error: 'Đơn giá bán không được âm' }, { status: 422 });
          }

          result = await InteriorBOQAnalyticsService.addItem(tenantId, {
            zoneId: (item['zoneId'] as string) || 'zone-living',
            zoneName: item['zoneName'] as string | undefined,
            itemName: item['itemName'] as string,
            specifications: (item['specifications'] as string) || 'Theo thiết kế',
            unit: (item['unit'] as string) || 'Cái',
            quantity: item['quantity'] as number,
            internalUnitCost: item['internalUnitCost'] as number,
            clientUnitPrice: item['clientUnitPrice'] as number,
          });
          break;
        }

        case 'update_item': {
          const item = payload['item'] as Record<string, unknown>;
          if (!item || typeof item['itemId'] !== 'string') {
            return NextResponse.json({ success: false, error: 'itemId không hợp lệ' }, { status: 422 });
          }
          if (item['quantity'] !== undefined && (typeof item['quantity'] !== 'number' || item['quantity'] <= 0)) {
            return NextResponse.json({ success: false, error: 'Số lượng phải lớn hơn 0' }, { status: 422 });
          }
          if (item['internalUnitCost'] !== undefined && (typeof item['internalUnitCost'] !== 'number' || item['internalUnitCost'] < 0)) {
            return NextResponse.json({ success: false, error: 'Đơn giá vốn không được âm' }, { status: 422 });
          }
          if (item['clientUnitPrice'] !== undefined && (typeof item['clientUnitPrice'] !== 'number' || item['clientUnitPrice'] < 0)) {
            return NextResponse.json({ success: false, error: 'Đơn giá bán không được âm' }, { status: 422 });
          }

          result = await InteriorBOQAnalyticsService.updateItem(tenantId, {
            itemId: item['itemId'] as string,
            itemName: item['itemName'] as string | undefined,
            specifications: item['specifications'] as string | undefined,
            unit: item['unit'] as string | undefined,
            quantity: item['quantity'] as number | undefined,
            internalUnitCost: item['internalUnitCost'] as number | undefined,
            clientUnitPrice: item['clientUnitPrice'] as number | undefined,
          });
          break;
        }

        case 'delete_item': {
          const itemId = payload['itemId'] as string;
          if (!itemId || typeof itemId !== 'string') {
            return NextResponse.json({ success: false, error: 'itemId không hợp lệ' }, { status: 422 });
          }
          result = await InteriorBOQAnalyticsService.deleteItem(tenantId, itemId);
          break;
        }

        case 'duplicate_item': {
          const duplicate = payload['duplicate'] as Record<string, unknown>;
          if (!duplicate || typeof duplicate['itemId'] !== 'string') {
            return NextResponse.json({ success: false, error: 'itemId không hợp lệ' }, { status: 422 });
          }
          result = await InteriorBOQAnalyticsService.duplicateItem(tenantId, {
            itemId: duplicate['itemId'] as string,
            targetZoneId: duplicate['targetZoneId'] as string | undefined,
          });
          break;
        }

        case 'update_status': {
          const transition = payload['transition'] as Record<string, unknown>;
          if (!transition || typeof transition['targetStatus'] !== 'string') {
            return NextResponse.json({ success: false, error: 'targetStatus không hợp lệ' }, { status: 422 });
          }
          result = await InteriorBOQAnalyticsService.transitionStatus(tenantId, {
            targetStatus: transition['targetStatus'] as BOQStatus,
            actorName: actor.full_name ?? undefined,
          });
          break;
        }

        case 'create_revision': {
          result = await InteriorBOQAnalyticsService.createRevision(tenantId, {
            actorName: actor.full_name ?? undefined,
          });
          break;
        }

        case 'reset': {
          InteriorBOQAnalyticsService.resetTenantBOQData(tenantId);
          result = await InteriorBOQAnalyticsService.getBOQOverview(tenantId);
          break;
        }

        default:
          return NextResponse.json({ success: false, error: `Action không được hỗ trợ: ${action}` }, { status: 400 });
      }

      // Synchronize to real DB repository in background if configured
      try {
        await InteriorBOQAnalyticsService.syncToRepository(tenantId, repo, actor.full_name ?? undefined);
      } catch {
        // Continue with memory store confirmation
      }

      // Record Real Audit Log in public.audit_logs
      try {
        await repo.recordAuditLog(tenantId, {
          userId: actor.id ?? null,
          action: `BOQ_${action.toUpperCase()}`,
          module: 'INTERIOR_BOQ',
          targetId: result.project.id,
          oldData: {
            action,
            status: previousOverview.status,
            versionNumber: previousOverview.versionNumber,
            totalClientPrice: previousOverview.kpis.totalClientPrice.rawValue,
            totalCogs: previousOverview.kpis.totalCogs.rawValue,
            grossProfit: previousOverview.kpis.grossProfit.rawValue,
            grossMargin: previousOverview.kpis.grossMargin.rawPercentage,
          },
          newData: {
            action,
            status: result.status,
            versionNumber: result.versionNumber,
            totalClientPrice: result.kpis.totalClientPrice.rawValue,
            totalCogs: result.kpis.totalCogs.rawValue,
            grossProfit: result.kpis.grossProfit.rawValue,
            grossMargin: result.kpis.grossMargin.rawPercentage,
            actor: actor.full_name,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Silent fallback
      }

      return NextResponse.json({ success: true, data: result }, { status: 200 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi xử lý BOQ';
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
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
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Field "items" must be a non-empty array' },
      { status: 422 }
    );
  }

  // ── Guard: designRevisionId must reference an approved revision ───────────
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let dbRevision = null;
  try {
    dbRevision = await repo.getDesignRevision(tenantId, parsed.designRevisionId);
  } catch {
    // DB check failed
  }

  const mockRev = mockRevisions.find((r) => r.id === parsed.designRevisionId);

  if (!dbRevision && !mockRev) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${parsed.designRevisionId}` },
      { status: 404 }
    );
  }

  const isApproved = (dbRevision && dbRevision.status === 'approved') || (mockRev && mockRev.status === 'approved');
  if (!isApproved) {
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
    await repo.saveBOQ(tenantId, domainBOQ);
  } catch {
    // Database save failed; continue with mock
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

  mockBOQs.push(newBOQ);

  return NextResponse.json(
    { success: true, data: { boq: newBOQ } },
    { status: 201 }
  );
}
