import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

interface PaymentMilestoneInput {
  name: string;
  percentageOfTotal: number;
  dueDate: string;
}

interface ContractCreateBody {
  projectId: string;
  boqId: string;
  contractValue: number;
  clientPartyId: string;
  milestones: PaymentMilestoneInput[];
}

interface StoredMilestone {
  id: string;
  name: string;
  percentageOfTotal: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'invoiced' | 'paid' | 'overdue';
}

interface StoredContract {
  id: string;
  tenantId: string;
  projectId: string;
  boqId: string;
  contractValue: number;
  clientPartyId: string;
  status: 'draft' | 'signed' | 'active' | 'completed' | 'terminated';
  milestones: StoredMilestone[];
  createdAt: string;
}

// In-memory store (demo)
const contractStore: StoredContract[] = [
  {
    id: 'CON-DEMO-001',
    tenantId: 'demo-tenant',
    projectId: 'PRJ-DEMO-001',
    boqId: 'BOQ-DEMO-001',
    contractValue: 2_800_000_000,
    clientPartyId: 'PARTY-001',
    status: 'active',
    createdAt: '2026-09-15T00:00:00Z',
    milestones: [
      { id: 'm1', name: 'Đặt cọc ký hợp đồng',      percentageOfTotal: 30, amount: 840_000_000, dueDate: '2026-09-20', status: 'paid'    },
      { id: 'm2', name: 'Duyệt thiết kế chính thức', percentageOfTotal: 20, amount: 560_000_000, dueDate: '2026-10-15', status: 'paid'    },
      { id: 'm3', name: 'Khởi công sản xuất',        percentageOfTotal: 30, amount: 840_000_000, dueDate: '2026-11-10', status: 'invoiced' },
      { id: 'm4', name: 'Hoàn thành lắp đặt',        percentageOfTotal: 15, amount: 420_000_000, dueDate: '2026-12-20', status: 'pending' },
      { id: 'm5', name: 'Bàn giao chính thức',        percentageOfTotal:  5, amount: 140_000_000, dueDate: '2027-01-05', status: 'pending' },
    ],
  },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId  = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const projectId = request.nextUrl.searchParams.get('projectId');

  const results = contractStore.filter((c) => {
    const tenantMatch  = c.tenantId === tenantId;
    const projectMatch = projectId ? c.projectId === projectId : true;
    return tenantMatch && projectMatch;
  });

  return NextResponse.json({ success: true, data: { contracts: results, total: results.length } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';

  let body: ContractCreateBody;
  try {
    body = (await request.json()) as ContractCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.projectId || !body.boqId || !body.contractValue || !body.clientPartyId) {
    return NextResponse.json({ success: false, error: 'projectId, boqId, contractValue and clientPartyId are required' }, { status: 400 });
  }

  if (!body.milestones || body.milestones.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one milestone is required' }, { status: 400 });
  }

  // Validate milestone sum = 100%
  const totalPercent = body.milestones.reduce((sum, m) => sum + m.percentageOfTotal, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    return NextResponse.json(
      { success: false, error: `Milestone percentages must sum to 100, got ${totalPercent}` },
      { status: 422 },
    );
  }

  const contract: StoredContract = {
    id: `CON-${randomUUID().slice(0, 8).toUpperCase()}`,
    tenantId,
    projectId: body.projectId,
    boqId: body.boqId,
    contractValue: body.contractValue,
    clientPartyId: body.clientPartyId,
    status: 'draft',
    createdAt: new Date().toISOString(),
    milestones: body.milestones.map((m) => ({
      id: randomUUID(),
      name: m.name,
      percentageOfTotal: m.percentageOfTotal,
      amount: Math.round((m.percentageOfTotal / 100) * body.contractValue),
      dueDate: m.dueDate,
      status: 'pending',
    })),
  };

  contractStore.push(contract);

  return NextResponse.json({ success: true, data: contract }, { status: 201 });
}
