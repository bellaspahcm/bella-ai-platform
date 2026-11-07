import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InteriorContract as DomainContract, PaymentMilestone as DomainMilestone } from '@/products/bella-interior/domain/commercial-costing/types';
import { InteriorContractAnalyticsService } from '@/products/bella-interior/services/interior-contract-analytics.service';

export const dynamic = 'force-dynamic';

interface PaymentMilestoneInput {
  name: string;
  percentageOfTotal: number;
  dueDate: string;
}

interface ContractCreateBody {
  action?: 'create-contract' | 'release-to-workshop' | 'record-payment' | 'create-addendum';
  projectId?: string;
  boqId?: string;
  contractValue?: number;
  clientPartyId?: string;
  milestones?: PaymentMilestoneInput[];
  milestoneId?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  addendumTitle?: string;
  addendumValue?: number;
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
    projectId: 'proj-villa-sunrise',
    boqId: 'boq-001',
    contractValue: 418_000_000,
    clientPartyId: 'Sheikh Al-Maktoum Office',
    status: 'active',
    createdAt: '2024-02-06T00:00:00Z',
    milestones: [
      { id: 'm-1', name: 'Đợt 1: Đặt cọc ký hợp đồng', percentageOfTotal: 30, amount: 125_400_000, dueDate: '2024-02-10', status: 'paid' },
      { id: 'm-2', name: 'Đợt 2: Duyệt thiết kế khóa sản xuất', percentageOfTotal: 20, amount: 83_600_000, dueDate: '2024-02-20', status: 'paid' },
      { id: 'm-3', name: 'Đợt 3: Khởi công xuất xưởng', percentageOfTotal: 30, amount: 125_400_000, dueDate: '2024-03-05', status: 'invoiced' },
      { id: 'm-4', name: 'Đợt 4: Hoàn thành lắp đặt hiện trường', percentageOfTotal: 15, amount: 62_700_000, dueDate: '2024-03-20', status: 'pending' },
      { id: 'm-5', name: 'Đợt 5: Nghiệm thu bàn giao & bảo hành', percentageOfTotal: 5, amount: 20_900_000, dueDate: '2024-03-30', status: 'pending' },
    ],
  },
];

export async function GET(request: Request): Promise<NextResponse> {
  let tenantId = '00000000-0000-0000-0000-000000000001';
  try {
    const ctx = await resolveInteriorContext(request);
    if (ctx.ok) {
      tenantId = ctx.tenantId;
    }
  } catch {
    // default tenant
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;

  // Canonical Single Source of Truth
  const overview = await InteriorContractAnalyticsService.getContractOverview(tenantId, projectId);

  const results = contractStore.filter((c) => {
    const tenantMatch = c.tenantId === tenantId || c.tenantId === '00000000-0000-0000-0000-000000000001';
    const projectMatch = projectId ? c.projectId === projectId : true;
    return tenantMatch && projectMatch;
  });

  return NextResponse.json({
    success: true,
    data: {
      overview,
      contracts: results,
      total: results.length,
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let tenantId = '00000000-0000-0000-0000-000000000001';
  let actorName = 'Bella Interior Lead';
  try {
    const ctx = await resolveInteriorContext(request);
    if (ctx.ok) {
      tenantId = ctx.tenantId;
      actorName = ctx.actor.full_name || actorName;
    }
  } catch {
    // default tenant
  }

  let body: ContractCreateBody;
  try {
    body = (await request.json()) as ContractCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Handle action: release-to-workshop
  if (body.action === 'release-to-workshop') {
    const overview = await InteriorContractAnalyticsService.getContractOverview(tenantId, body.projectId);
    if (!overview.workshopReleaseGating.isEligible) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chưa đủ điều kiện chuyển lệnh sang xưởng sản xuất',
          criteria: overview.workshopReleaseGating.criteria,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lệnh sản xuất đã được chuyển thành công sang xưởng gỗ (Woodworking Released).',
      orderCode: `WO-${Date.now().toString().slice(-6)}`,
      releasedAt: new Date().toISOString(),
      releasedBy: actorName,
    });
  }

  // Validate required fields for contract creation
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
    amount: Math.round((m.percentageOfTotal / 100) * (body.contractValue || 0)),
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
    contractorRepresentative: actorName,
    milestones: domainMilestones,
    addenda: [],
  };

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
