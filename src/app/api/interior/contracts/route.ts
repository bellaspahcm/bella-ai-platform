import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InteriorContract as DomainContract, PaymentMilestone as DomainMilestone, InteriorContractStatus } from '@/products/bella-interior/domain/commercial-costing/types';

export const dynamic = 'force-dynamic';

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

// In-memory store (demo fallback)
const contractStore: StoredContract[] = [
  {
    id: 'CON-DUBAI-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    projectId: 'proj-001',
    boqId: 'boq-001',
    contractValue: 418_000_000,
    clientPartyId: 'Sheikh Al-Maktoum Office',
    status: 'active',
    createdAt: '2024-02-06T00:00:00Z',
    milestones: [
      { id: 'm1', name: 'Đợt 1: Đặt cọc ký hợp đồng', percentageOfTotal: 30, amount: 125_400_000, dueDate: '2024-02-10', status: 'paid' },
      { id: 'm2', name: 'Đợt 2: Duyệt thiết kế khóa sản xuất', percentageOfTotal: 20, amount: 83_600_000, dueDate: '2024-02-25', status: 'paid' },
      { id: 'm3', name: 'Đợt 3: Khởi công xuất xưởng', percentageOfTotal: 30, amount: 125_400_000, dueDate: '2024-03-20', status: 'invoiced' },
      { id: 'm4', name: 'Đợt 4: Hoàn thành lắp đặt hiện trường', percentageOfTotal: 15, amount: 62_700_000, dueDate: '2024-04-10', status: 'pending' },
      { id: 'm5', name: 'Đợt 5: Nghiệm thu bàn giao & bảo hành', percentageOfTotal: 5, amount: 20_900_000, dueDate: '2024-04-25', status: 'pending' },
    ],
  },
];

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    if (projectId) {
      const dbContract = await repo.getContractByProject(tenantId, projectId);
      if (dbContract) {
        const mapped: StoredContract = {
          id: dbContract.id,
          tenantId: dbContract.tenantId,
          projectId: dbContract.projectId,
          boqId: dbContract.quotationId,
          contractValue: dbContract.currentContractValue,
          clientPartyId: dbContract.clientRepresentative,
          status: dbContract.status as StoredContract['status'],
          createdAt: dbContract.signedDate || new Date().toISOString(),
          milestones: dbContract.milestones.map((m) => ({
            id: m.id,
            name: m.name,
            percentageOfTotal: m.percentage,
            amount: m.amount,
            dueDate: m.dueDate || '',
            status: m.status,
          })),
        };
        return NextResponse.json({ success: true, data: { contracts: [mapped], total: 1 } });
      }
    }
  } catch {
    // Database query failed; fall back to mock store
  }

  const results = contractStore.filter((c) => {
    const tenantMatch = c.tenantId === tenantId || c.tenantId === '00000000-0000-0000-0000-000000000001';
    const projectMatch = projectId ? c.projectId === projectId : true;
    return tenantMatch && projectMatch;
  });

  return NextResponse.json({ success: true, data: { contracts: results, total: results.length } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

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

  const contractId = `CON-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  const domainMilestones: DomainMilestone[] = body.milestones.map((m, idx) => ({
    id: randomUUID(),
    tenantId,
    contractId,
    milestoneOrder: idx + 1,
    name: m.name,
    percentage: m.percentageOfTotal,
    amount: Math.round((m.percentageOfTotal / 100) * body.contractValue),
    triggerCondition: `Giai đoạn ${idx + 1}`,
    status: 'pending',
    dueDate: m.dueDate,
  }));

  const domainContract: DomainContract = {
    id: contractId,
    tenantId,
    projectId: body.projectId,
    quotationId: body.boqId,
    contractNumber: contractId,
    title: `Hợp đồng thi công nội thất ${contractId}`,
    status: 'signed',
    baselineContractValue: body.contractValue,
    currentContractValue: body.contractValue,
    signedDate: now,
    clientRepresentative: body.clientPartyId,
    contractorRepresentative: actor.full_name || 'Bella Interior Lead',
    milestones: domainMilestones,
    addenda: [],
  };

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    await repo.saveContract(tenantId, domainContract);
  } catch {
    // Database save failed; proceed with mock store
  }

  const contract: StoredContract = {
    id: contractId,
    tenantId,
    projectId: body.projectId,
    boqId: body.boqId,
    contractValue: body.contractValue,
    clientPartyId: body.clientPartyId,
    status: 'signed',
    createdAt: now,
    milestones: domainMilestones.map((m) => ({
      id: m.id,
      name: m.name,
      percentageOfTotal: m.percentage,
      amount: m.amount,
      dueDate: m.dueDate || '',
      status: m.status,
    })),
  };

  contractStore.push(contract);

  return NextResponse.json({ success: true, data: contract }, { status: 201 });
}
