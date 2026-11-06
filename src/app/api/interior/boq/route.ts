import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mockRevisions } from '../design/revisions/route';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BOQItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitCostInternal: number;
  unitPriceClient: number;
  totalCostInternal: number;
  totalPriceClient: number;
}

interface BOQCreateItemInput {
  description: string;
  unit: string;
  quantity: number;
  unitCostInternal: number;
  unitPriceClient: number;
}

interface BOQ {
  id: string;
  projectId: string;
  designRevisionId: string;
  items: BOQItem[];
  grandTotalCostInternal: number;
  grandTotalPriceClient: number;
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
    items: [
      {
        id: 'boqi-001',
        description: 'Custom wooden wardrobe',
        unit: 'unit',
        quantity: 2,
        unitCostInternal: 8_000_000,
        unitPriceClient: 12_000_000,
        totalCostInternal: 16_000_000,
        totalPriceClient: 24_000_000,
      },
    ],
    grandTotalCostInternal: 16_000_000,
    grandTotalPriceClient: 24_000_000,
    createdAt: '2024-02-05T09:00:00.000Z',
    updatedAt: '2024-02-05T09:00:00.000Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateBOQItemInput(item: unknown): item is BOQCreateItemInput {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i['description'] === 'string' &&
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

  const filtered = projectId
    ? mockBOQs.filter((b) => b.projectId === projectId)
    : mockBOQs;

  void tenantId; // tenantId available for future DB-scoped filtering

  return NextResponse.json({
    success: true,
    data: { boqs: filtered, total: filtered.length },
  });
}

// ─── POST /api/interior/boq ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  void tenantId; // tenantId available for future DB-scoped creation

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
  const revision = mockRevisions.find((r) => r.id === parsed.designRevisionId);

  if (!revision) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${parsed.designRevisionId}` },
      { status: 404 }
    );
  }

  if (revision.status !== 'approved') {
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
          error: `Item at index ${i} is invalid. Each item must have: description (string), unit (string), quantity (number > 0), unitCostInternal (number >= 0), unitPriceClient (number >= 0).`,
        },
        { status: 422 }
      );
    }
  }

  const now = new Date().toISOString();

  const boqItems: BOQItem[] = parsed.items.map((raw) => {
    const item = raw as BOQCreateItemInput;
    return {
      id: randomUUID(),
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitCostInternal: item.unitCostInternal,
      unitPriceClient: item.unitPriceClient,
      totalCostInternal: item.quantity * item.unitCostInternal,
      totalPriceClient: item.quantity * item.unitPriceClient,
    };
  });

  const grandTotalCostInternal = boqItems.reduce((sum, i) => sum + i.totalCostInternal, 0);
  const grandTotalPriceClient = boqItems.reduce((sum, i) => sum + i.totalPriceClient, 0);

  const newBOQ: BOQ = {
    id: randomUUID(),
    projectId: parsed.projectId,
    designRevisionId: parsed.designRevisionId,
    items: boqItems,
    grandTotalCostInternal,
    grandTotalPriceClient,
    createdAt: now,
    updatedAt: now,
  };

  mockBOQs.push(newBOQ);

  return NextResponse.json(
    { success: true, data: { boq: newBOQ } },
    { status: 201 }
  );
}
