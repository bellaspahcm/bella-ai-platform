import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorContractAnalyticsService } from '@/products/bella-interior/services/interior-contract-analytics.service';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import type { InteriorContract, PaymentMilestone } from '@/products/bella-interior/domain/commercial-costing/types';

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

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const requestedProjectId = searchParams.get('projectId');
  if (!validInteriorUuid(requestedProjectId)) {
    return NextResponse.json({ success: false, error: 'projectId must be a valid UUID' }, { status: 400 });
  }

  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_read_contract_project', {
    p_project_id: requestedProjectId,
  });
  if (error) {
    const denied = error.message?.includes('AuthorizationViolation') === true;
    return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: denied ? 403 : 503 });
  }
  if (!isInteriorRbacRecord(data) || !isInteriorRbacRecord(data.project)
    || typeof data.project.id !== 'string' || typeof data.project.name !== 'string') {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }

  const workflowCommands = { createContractAvailable: false, releaseProductionAvailable: false };
  if (data.hasContract !== true) {
    return NextResponse.json({
      success: true,
      data: { overview: { hasContract: false, financeAccess: data.financeAccess === true, workflowCommands }, hasContract: false, contracts: [], total: 0 },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
  if (!isInteriorRbacRecord(data.contract)
    || typeof data.contract.contractNumber !== 'string'
    || typeof data.contract.title !== 'string'
    || typeof data.contract.status !== 'string'
    || (data.contract.signedDate !== null && data.contract.signedDate !== undefined
      && typeof data.contract.signedDate !== 'string')) {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }

  const contractRow = data.contract;
  const summary = {
    contractNumber: contractRow.contractNumber,
    title: contractRow.title,
    status: contractRow.status,
    signedDate: typeof contractRow.signedDate === 'string' ? contractRow.signedDate : null,
    clientRepresentative: typeof contractRow.clientRepresentative === 'string' ? contractRow.clientRepresentative : null,
  };
  if (data.financeAccess !== true) {
    return NextResponse.json({
      success: true,
      data: {
        overview: { hasContract: true, financeAccess: false, contractSummary: summary, workflowCommands },
        hasContract: true,
        contracts: [summary],
        total: 1,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const contractNumber = contractRow.contractNumber;
  const contractTitle = contractRow.title;
  const contractStatus = contractRow.status;
  const signedDate = contractRow.signedDate;
  const contractorRepresentative = contractRow.contractorRepresentative;
  const validContractStatuses = ['draft', 'in_review', 'signed', 'active', 'completed', 'terminated'];
  if (typeof contractNumber !== 'string' || typeof contractTitle !== 'string'
    || typeof contractStatus !== 'string' || !validContractStatuses.includes(contractStatus)
    || (signedDate !== null && signedDate !== undefined && typeof signedDate !== 'string')
    || typeof contractorRepresentative !== 'string') {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }

  const statuses = ['pending', 'invoiced', 'paid', 'overdue'] as const;
  const numericField = (value: unknown): number | null => {
    if ((typeof value !== 'number' && typeof value !== 'string')
      || (typeof value === 'string' && value.trim() === '')) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const rawMilestones = contractRow.milestones;
  if (!Array.isArray(rawMilestones) || rawMilestones.some((item) => !isInteriorRbacRecord(item))) {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }
  const milestones: PaymentMilestone[] = [];
  for (const raw of rawMilestones) {
    if (!isInteriorRbacRecord(raw) || typeof raw.id !== 'string' || typeof raw.tenantId !== 'string'
      || typeof raw.contractId !== 'string' || typeof raw.name !== 'string'
      || typeof raw.triggerCondition !== 'string' || !statuses.includes(raw.status as typeof statuses[number])) {
      return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
    }
    const milestoneOrder = numericField(raw.milestoneOrder);
    const percentage = numericField(raw.percentage);
    const amount = numericField(raw.amount);
    if (milestoneOrder === null || !Number.isInteger(milestoneOrder)
      || percentage === null || percentage < 0 || percentage > 100
      || amount === null || amount < 0) {
      return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
    }
    milestones.push({
      id: raw.id, tenantId: raw.tenantId, contractId: raw.contractId,
      milestoneOrder, name: raw.name, percentage, amount, triggerCondition: raw.triggerCondition,
      status: raw.status as PaymentMilestone['status'],
      ...(typeof raw.dueDate === 'string' ? { dueDate: raw.dueDate } : {}),
      ...(typeof raw.paidAt === 'string' ? { paidAt: raw.paidAt } : {}),
    });
  }

  const baselineValue = numericField(contractRow.baselineContractValue);
  const currentValue = numericField(contractRow.currentContractValue);
  if (baselineValue === null || currentValue === null || typeof contractRow.id !== 'string'
    || typeof contractRow.tenantId !== 'string' || typeof contractRow.projectId !== 'string'
    || typeof contractRow.quotationId !== 'string' || typeof contractRow.contractorRepresentative !== 'string'
    || (signedDate !== null && signedDate !== undefined && typeof signedDate !== 'string')) {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }
  const contract: InteriorContract = {
    id: contractRow.id,
    tenantId: contractRow.tenantId,
    projectId: contractRow.projectId,
    quotationId: contractRow.quotationId,
    contractNumber,
    title: contractTitle,
    status: contractStatus as InteriorContract['status'],
    baselineContractValue: baselineValue,
    currentContractValue: currentValue,
    signedDate: typeof signedDate === 'string' ? signedDate : '',
    clientRepresentative: summary.clientRepresentative ?? 'Khách hàng (ẩn theo quyền)',
    contractorRepresentative,
    milestones,
    addenda: [],
  };
  const overview = {
    ...InteriorContractAnalyticsService.buildResponseFromDBContract(
      contract,
      typeof data.project.code === 'string' ? data.project.code : requestedProjectId,
    ),
    financeAccess: true,
    workflowCommands,
  };

  return NextResponse.json({
    success: true,
    data: {
      overview,
      hasContract: true,
      contracts: [contract],
      total: 1,
    },
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: ContractCreateBody;
  try {
    body = (await request.json()) as ContractCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Handle action: release-to-workshop
  if (body.action === 'release-to-workshop') {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PRODUCTION_RELEASE_PERSISTENCE_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { success: false, error: 'INTERIOR_CONTRACT_PERSISTENCE_UNAVAILABLE' },
    { status: 503 },
  );
}
