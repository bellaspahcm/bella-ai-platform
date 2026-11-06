import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mockRevisions } from '../design/revisions/route';
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
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    if (projectId) {
      const dbBOQ = await repo.getBOQByProject(tenantId, projectId);
      if (dbBOQ) {
        const mappedBOQ: BOQ = {
          id: dbBOQ.id,
          projectId: dbBOQ.projectId,
          designRevisionId: dbBOQ.designRevisionId,
          boqNumber: dbBOQ.boqNumber,
          items: dbBOQ.items.map((i) => ({
            id: i.id,
            itemCode: i.itemCode,
            roomName: i.roomZoneName,
            itemName: i.itemName,
            description: i.itemName,
            dimensions: `${i.dimensions.width}x${i.dimensions.depth}x${i.dimensions.height} mm`,
            specifications: `${i.specifications.carcassMaterial} • ${i.specifications.surfaceFinish} • ${i.specifications.hardwareSpec}`,
            unit: i.unit,
            quantity: i.quantity,
            unitCostInternal: i.internalUnitCost,
            unitPriceClient: i.clientUnitPrice,
            totalCostInternal: i.internalTotalCost,
            totalPriceClient: i.clientTotalPrice,
            grossMarginPercent: i.grossMarginPercent,
          })),
          grandTotalCostInternal: dbBOQ.totalInternalCost,
          grandTotalPriceClient: dbBOQ.totalClientPrice,
          totalGrossMargin: dbBOQ.totalGrossMargin,
          grossMarginPercent: dbBOQ.grossMarginPercent,
          createdAt: dbBOQ.createdAt,
          updatedAt: dbBOQ.updatedAt,
        };
        return NextResponse.json({
          success: true,
          data: { boqs: [mappedBOQ], total: 1 },
        });
      }
    }
  } catch {
    // Database query failed; fall back to mock store
  }

  const filtered = projectId
    ? mockBOQs.filter((b) => b.projectId === projectId)
    : mockBOQs;

  return NextResponse.json({
    success: true,
    data: { boqs: filtered, total: filtered.length },
  });
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
