import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { INTERIOR_PERMISSIONS, resolveInteriorContext, type InteriorServerContext } from '@/products/bella-interior/lib/server-context';
import { InteriorContractAnalyticsService } from '@/products/bella-interior/services/interior-contract-analytics.service';
import { InteriorContractLifecycleService } from '@/products/bella-interior/services/interior-contract-lifecycle.service';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { SupabaseInteriorFinanceOutboxAdapter } from '@/products/bella-interior/adapters/supabase-finance-outbox.adapter';
import { InteriorCustomerApprovalService } from '@/products/bella-interior/services/interior-customer-approval.service';
import type { InteriorContract, PaymentMilestone } from '@/products/bella-interior/domain/commercial-costing/types';
import type { ContractAddendumItem } from '@/products/bella-interior/domain/contract-overview.types';
import type { PaymentMethod } from '@/products/bella-interior/domain/commercial-costing/contract.types';

export const dynamic = 'force-dynamic';

async function readWorkflowCommands(ctx: InteriorServerContext, projectId: string) {
  const authorize = (permissionId: string) => ctx.authorization.authorize({
    permissionId,
    tenantId: ctx.tenantId,
    projectId,
  });
  const [boqRead, financeRead, contractCreate, contractWrite, paymentRecord, contractAmend] = await Promise.all([
    authorize(INTERIOR_PERMISSIONS.boqRead),
    authorize(INTERIOR_PERMISSIONS.financeRead),
    authorize(INTERIOR_PERMISSIONS.contractCreate),
    authorize(INTERIOR_PERMISSIONS.contractWrite),
    authorize(INTERIOR_PERMISSIONS.paymentRecord),
    authorize(INTERIOR_PERMISSIONS.contractAmend),
  ]);
  const allowed = (decision: typeof boqRead) => decision.status === 'ALLOW';
  return {
    createQuotationAvailable: allowed(boqRead) && allowed(financeRead) && allowed(contractCreate),
    requestCustomerApprovalAvailable: allowed(contractWrite),
    createContractAvailable: allowed(contractCreate),
    recordPaymentAvailable: allowed(paymentRecord),
    createAddendumAvailable: allowed(contractAmend),
    // The route stays closed until a persisted Manufacturing target is available.
    releaseProductionAvailable: false,
  };
}

interface PaymentMilestoneInput {
  name: string;
  percentageOfTotal: number;
  dueDate: string;
  triggerCondition?: string;
}

interface AddendumMilestoneInput extends PaymentMilestoneInput {
  id: string;
  milestoneOrder: number;
  amount: number;
  triggerCondition: string;
}

interface ContractCreateBody {
  action?: 'create-contract' | 'release-to-workshop' | 'record-payment' | 'create-addendum';
  projectId?: string;
  quotationId?: string;
  quotationCustomerApprovalId?: string;
  contractNumber?: string;
  title?: string;
  clientRepresentative?: string;
  contractorRepresentative?: string;
  milestoneTemplate?: '3_STEP_STANDARD' | '4_STEP_BALANCED' | '5_STEP_DUBAI_CANONICAL';
  boqId?: string;
  contractValue?: number;
  clientPartyId?: string;
  milestones?: PaymentMilestoneInput[];
  milestoneId?: string;
  contractId?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  referenceCode?: string;
  transactionDate?: string;
  proofUrl?: string;
  notes?: string;
  addendumTitle?: string;
  addendumNumber?: string;
  addendumReason?: string;
  addendumValue?: number;
  addendumMilestones?: AddendumMilestoneInput[];
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

const persistedAddendumStatuses = ['pending_customer_approval', 'approved', 'rejected', 'superseded'] as const;
type PersistedAddendumStatus = typeof persistedAddendumStatuses[number];

function parseContractAddenda(
  value: unknown,
  tenantId: string,
  contractId: string,
): ContractAddendumItem[] | null {
  if (!Array.isArray(value)) return null;
  const addenda: ContractAddendumItem[] = [];
  for (const row of value) {
    if (!isInteriorRbacRecord(row) || typeof row.id !== 'string' || row.tenantId !== tenantId
      || row.contractId !== contractId || typeof row.addendumNumber !== 'string' || !row.addendumNumber.trim()
      || typeof row.title !== 'string' || typeof row.reason !== 'string'
      || typeof row.status !== 'string' || !persistedAddendumStatuses.includes(row.status as PersistedAddendumStatus)
      || (row.approvedAt !== undefined && row.approvedAt !== null && typeof row.approvedAt !== 'string')
      || typeof row.approvalEvidenceStatus !== 'string'
      || !['pending', 'verified', 'unverified'].includes(row.approvalEvidenceStatus)) return null;
    const valueDelta = typeof row.valueDelta === 'number' ? row.valueDelta
      : typeof row.valueDelta === 'string' && row.valueDelta.trim() !== '' ? Number(row.valueDelta) : Number.NaN;
    if (!Number.isFinite(valueDelta)) return null;
    const evidenceMatchesStatus = row.status === 'pending_customer_approval'
      ? row.approvalEvidenceStatus === 'pending' : row.approvalEvidenceStatus === 'verified';
    const unverified = row.approvalEvidenceStatus === 'unverified' || !evidenceMatchesStatus;
    const displayStatus: ContractAddendumItem['status'] = unverified
      ? 'legacy_unverified'
      : row.status === 'pending_customer_approval' ? 'pending' : row.status as ContractAddendumItem['status'];
    const approvedAt = typeof row.approvedAt === 'string' ? new Date(row.approvedAt) : null;
    if (approvedAt && Number.isNaN(approvedAt.getTime())) return null;
    const statusLabel = displayStatus === 'approved' ? 'Đã duyệt'
      : displayStatus === 'rejected' ? 'Khách từ chối'
        : displayStatus === 'superseded' ? 'Đã thay thế'
          : displayStatus === 'pending' ? 'Đang chờ khách duyệt' : 'Chưa xác minh chấp thuận';
    addenda.push({
      id: row.id,
      code: row.addendumNumber,
      title: row.title,
      reason: row.reason,
      valueChange: valueDelta,
      valueChangeFormatted: `${valueDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(valueDelta)} đ`,
      effectiveDate: approvedAt ? approvedAt.toLocaleDateString('vi-VN') : 'Chưa được duyệt',
      status: displayStatus,
      statusLabel,
      statusBadgeVariant: displayStatus === 'approved' ? 'success'
        : displayStatus === 'rejected' ? 'danger' : 'warning',
    });
  }
  return addenda;
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

  const workflowCommands = await readWorkflowCommands(ctx, requestedProjectId);
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
  const rawQuotationVersionNumber = contractRow.quotationVersionNumber;
  const quotationVersionNumber = typeof rawQuotationVersionNumber === 'number'
    ? rawQuotationVersionNumber
    : typeof rawQuotationVersionNumber === 'string' && rawQuotationVersionNumber.trim() !== ''
      ? Number(rawQuotationVersionNumber)
      : Number.NaN;
  if (typeof contractRow.id !== 'string' || typeof contractRow.quotationId !== 'string'
    || !Number.isInteger(quotationVersionNumber) || quotationVersionNumber < 1) {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }
  const commercialWorkflow = {
    contractId: contractRow.id,
    contractStatus: contractRow.status,
    quotationId: contractRow.quotationId,
    quotationVersionNumber,
  };
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
        overview: { hasContract: true, financeAccess: false, contractSummary: summary, workflowCommands, commercialWorkflow },
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
  const addendaView = parseContractAddenda(contractRow.addenda, contractRow.tenantId, contractRow.id);
  if (!addendaView) {
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
    signedDate: typeof signedDate === 'string' ? signedDate : null,
    ...(typeof contractRow.quotationCustomerApprovalId === 'string'
      ? { quotationCustomerApprovalId: contractRow.quotationCustomerApprovalId } : {}),
    ...(typeof contractRow.customerApprovalId === 'string'
      ? { customerApprovalId: contractRow.customerApprovalId } : {}),
    ...(typeof contractRow.quotationVersionNumber === 'number'
      ? { quotationVersionNumber: contractRow.quotationVersionNumber } : {}),
    ...(typeof contractRow.boqId === 'string' ? { boqId: contractRow.boqId } : {}),
    ...(typeof contractRow.boqVersionNumber === 'number'
      ? { boqVersionNumber: contractRow.boqVersionNumber } : {}),
    ...(typeof contractRow.designRevisionId === 'string'
      ? { designRevisionId: contractRow.designRevisionId } : {}),
    ...(typeof contractRow.designVersionNumber === 'number'
      ? { designVersionNumber: contractRow.designVersionNumber } : {}),
    clientRepresentative: summary.clientRepresentative ?? 'Khách hàng (ẩn theo quyền)',
    contractorRepresentative,
    milestones,
    addenda: [],
  };
  const baseOverview = InteriorContractAnalyticsService.buildResponseFromDBContract(
      contract,
      typeof data.project.code === 'string' ? data.project.code : requestedProjectId,
    );
  const overview = {
    ...baseOverview,
    detailedTabs: { ...baseOverview.detailedTabs, addenda: addendaView },
    financeAccess: true,
    workflowCommands,
    commercialWorkflow,
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
    const parsed: unknown = await request.json();
    if (!isInteriorRbacRecord(parsed)) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as unknown as ContractCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'create-contract') {
    for (const [field, value] of Object.entries({
      contractNumber: body.contractNumber,
      title: body.title,
      clientRepresentative: body.clientRepresentative,
      contractorRepresentative: body.contractorRepresentative,
      notes: body.notes,
    })) {
      if (value !== undefined && typeof value !== 'string') {
        return NextResponse.json({ success: false, error: `INTERIOR_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_INVALID` }, { status: 400 });
      }
    }
    if (!validInteriorUuid(body.projectId)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_ID_INVALID' }, { status: 400 });
    }
    if (body.quotationId !== undefined && !validInteriorUuid(body.quotationId)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_ID_INVALID' }, { status: 400 });
    }
    if (body.quotationCustomerApprovalId !== undefined
      && !validInteriorUuid(body.quotationCustomerApprovalId)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_APPROVAL_ID_INVALID' }, { status: 400 });
    }
    if (body.milestones !== undefined && (!Array.isArray(body.milestones) || body.milestones.some((milestone) =>
      !isInteriorRbacRecord(milestone)
      || typeof milestone.name !== 'string' || !milestone.name.trim()
      || typeof milestone.percentageOfTotal !== 'number' || !Number.isFinite(milestone.percentageOfTotal)
      || milestone.percentageOfTotal <= 0 || milestone.percentageOfTotal > 100
      || (milestone.dueDate !== undefined
        && (typeof milestone.dueDate !== 'string' || !isIsoCalendarDate(milestone.dueDate)))
      || (milestone.triggerCondition !== undefined && typeof milestone.triggerCondition !== 'string')
    ))) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_SCHEDULE_INVALID' }, { status: 400 });
    }
    if (body.milestoneTemplate !== undefined
      && !['3_STEP_STANDARD', '4_STEP_BALANCED', '5_STEP_DUBAI_CANONICAL'].includes(body.milestoneTemplate)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_SCHEDULE_INVALID' }, { status: 400 });
    }

    const repository = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    try {
      const { data: projectData, error: projectError } = await interiorRbacRpcClient(ctx.supabase).rpc(
        'interior_read_project_for_contract',
        { p_project_id: body.projectId },
      );
      if (projectError) {
        if (projectError.message?.includes('AuthorizationViolation')) {
          return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
        }
        throw new Error(`Contract project lookup failed: ${projectError.message ?? 'unknown error'}`);
      }
      if (!isInteriorRbacRecord(projectData)
        || typeof projectData.id !== 'string'
        || typeof projectData.code !== 'string'
        || typeof projectData.name !== 'string'
        || typeof projectData.customerId !== 'string'
        || typeof projectData.customerName !== 'string') {
        return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
      }
      const project = {
        id: projectData.id as string,
        code: projectData.code as string,
        name: projectData.name as string,
        customerId: projectData.customerId as string,
        customerName: projectData.customerName as string,
      };
      if (body.clientPartyId && body.clientPartyId !== project.customerId) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_CUSTOMER_MISMATCH' }, { status: 422 });
      }

      const quotations = await repository.listQuotationsByProject(ctx.tenantId, project.id);
      const acceptedQuotations = quotations.filter((quotation) =>
        quotation.status === 'accepted'
        && (!body.quotationId || quotation.id === body.quotationId)
        && (!body.boqId || quotation.boqId === body.boqId),
      );
      if (acceptedQuotations.length !== 1) {
        return NextResponse.json(
          { success: false, error: acceptedQuotations.length ? 'INTERIOR_ACCEPTED_QUOTATION_AMBIGUOUS' : 'INTERIOR_ACCEPTED_QUOTATION_REQUIRED' },
          { status: acceptedQuotations.length ? 409 : 422 },
        );
      }
      const quotation = acceptedQuotations[0];
      const approvals = await repository.listCustomerApprovals(ctx.tenantId, quotation.id);
      const approvedEvidence = approvals.filter((approval) =>
        approval.subjectType === 'quotation'
        && approval.subjectVersionNumber === quotation.versionNumber
        && approval.status === 'approved'
        && Boolean(approval.approvedAt),
      );
      const selectedApproval = body.quotationCustomerApprovalId
        ? approvedEvidence.filter((approval) => approval.id === body.quotationCustomerApprovalId)
        : approvedEvidence;
      if (selectedApproval.length !== 1) {
        return NextResponse.json(
          { success: false, error: 'INTERIOR_QUOTATION_APPROVAL_EVIDENCE_REQUIRED' },
          { status: selectedApproval.length ? 409 : 422 },
        );
      }
      if (body.contractValue !== undefined
        && (typeof body.contractValue !== 'number' || !Number.isFinite(body.contractValue)
          || body.contractValue !== quotation.grandTotal)) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_VALUE_MUST_MATCH_ACCEPTED_QUOTATION' }, { status: 422 });
      }

      const contractNumber = body.contractNumber?.trim()
        || `CTR-${project.code}-${quotation.quotationNumber}-V${quotation.versionNumber}`;
      const clientRepresentative = body.clientRepresentative?.trim() || project.customerName.trim();
      const contractorRepresentative = body.contractorRepresentative?.trim() || ctx.actor.full_name?.trim() || '';
      if (!contractNumber || !clientRepresentative || !contractorRepresentative) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_PARTY_DETAILS_REQUIRED' }, { status: 422 });
      }
      const customMilestones = body.milestones?.map((milestone, index) => ({
        milestoneOrder: index + 1,
        name: milestone.name,
        percentage: milestone.percentageOfTotal,
        triggerCondition: milestone.triggerCondition?.trim() || milestone.name,
        dueDate: milestone.dueDate,
      }));

      const service = new InteriorContractLifecycleService(repository);
      const contract = await service.createContractFromQuotation({
        tenantId: ctx.tenantId,
        projectId: project.id,
        quotationId: quotation.id,
        quotationCustomerApprovalId: selectedApproval[0].id,
        contractNumber,
        title: body.title?.trim() || `Hợp đồng thi công nội thất ${project.name}`,
        clientRepresentative,
        contractorRepresentative,
        userRole: ctx.actor.role,
        actorId: ctx.actor.id,
        milestoneTemplate: body.milestoneTemplate,
        customMilestones,
      });
      return NextResponse.json({ success: true, data: contract }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('AuthorizationViolation')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
      }
      if (message.includes('already exists') || message.includes('ALREADY_EXISTS') || message.includes('duplicate key')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_ALREADY_EXISTS_FOR_QUOTATION' }, { status: 409 });
      }
      if (message.includes('not found') || message.includes('TenantIsolationViolation')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_SOURCE_NOT_FOUND' }, { status: 404 });
      }
      if (message.includes('Violation') || message.includes('Required') || message.includes('must be')
        || message.includes('must match') || message.includes('Percentage') || message.includes('Mismatch')
        || message.includes('LINEAGE') || message.includes('SCHEDULE') || message.includes('PRECONDITION')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_PRECONDITION_FAILED' }, { status: 422 });
      }
      return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_PERSISTENCE_FAILED' }, { status: 503 });
    }
  }

  if (body.action === 'record-payment') {
    if (!validInteriorUuid(body.projectId) || !validInteriorUuid(body.contractId)
      || !validInteriorUuid(body.milestoneId)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_SCOPE_INVALID' }, { status: 400 });
    }
    if (typeof body.paymentAmount !== 'number' || !Number.isFinite(body.paymentAmount)
      || body.paymentAmount <= 0 || typeof body.referenceCode !== 'string'
      || !body.referenceCode.trim() || typeof body.transactionDate !== 'string'
      || !isIsoCalendarDate(body.transactionDate)
      || (body.proofUrl !== undefined && typeof body.proofUrl !== 'string')
      || (body.notes !== undefined && typeof body.notes !== 'string')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_INPUT_INVALID' }, { status: 400 });
    }
    const allowedMethods: readonly PaymentMethod[] = ['bank_transfer', 'cash', 'credit_card', 'escrow', 'other'];
    if (!allowedMethods.includes(body.paymentMethod as PaymentMethod)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_METHOD_INVALID' }, { status: 400 });
    }

    const repository = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    try {
      const contract = await repository.getContract(ctx.tenantId, body.contractId);
      if (!contract || contract.projectId !== body.projectId) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_NOT_FOUND' }, { status: 404 });
      }
      const service = new InteriorContractLifecycleService(repository);
      const transaction = await service.recordPayment({
        tenantId: ctx.tenantId,
        contractId: contract.id,
        milestoneId: body.milestoneId,
        amount: body.paymentAmount,
        paymentMethod: body.paymentMethod as PaymentMethod,
        referenceCode: body.referenceCode,
        transactionDate: body.transactionDate,
        proofUrl: body.proofUrl,
        notes: body.notes,
        recordedBy: ctx.actor.id,
        userRole: ctx.actor.role,
      });
      return NextResponse.json({ success: true, data: transaction }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('AuthorizationViolation')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
      }
      if (message.includes('DuplicatePaymentTransaction') || message.includes('uq_interior_payment_tx_reference')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_REFERENCE_DUPLICATE' }, { status: 409 });
      }
      if (message.includes('NotFound') || message.includes('ContractNotFound') || message.includes('MILESTONE_OR_SIGNED')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_TARGET_NOT_FOUND_OR_UNSIGNED' }, { status: 404 });
      }
      if (message.includes('InvalidPayment') || message.includes('EXCEEDS_MILESTONE') || message.includes('LifecycleError')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_PRECONDITION_FAILED' }, { status: 422 });
      }
      return NextResponse.json({ success: false, error: 'INTERIOR_PAYMENT_PERSISTENCE_FAILED' }, { status: 503 });
    }
  }

  if (body.action === 'create-addendum') {
    if (!validInteriorUuid(body.projectId) || !validInteriorUuid(body.contractId)
      || typeof body.addendumNumber !== 'string' || !body.addendumNumber.trim()
      || typeof body.addendumTitle !== 'string' || !body.addendumTitle.trim()
      || typeof body.addendumReason !== 'string' || !body.addendumReason.trim()
      || typeof body.addendumValue !== 'number' || !Number.isFinite(body.addendumValue)
      || body.addendumValue === 0 || !Array.isArray(body.addendumMilestones)
      || body.addendumMilestones.length === 0
      || body.addendumMilestones.some((milestone) => !isInteriorRbacRecord(milestone)
        || !validInteriorUuid(milestone.id)
        || typeof milestone.milestoneOrder !== 'number' || !Number.isInteger(milestone.milestoneOrder)
        || milestone.milestoneOrder < 1
        || typeof milestone.name !== 'string' || !milestone.name.trim()
        || typeof milestone.percentageOfTotal !== 'number' || !Number.isFinite(milestone.percentageOfTotal)
        || milestone.percentageOfTotal <= 0 || milestone.percentageOfTotal > 100
        || typeof milestone.amount !== 'number' || !Number.isFinite(milestone.amount) || milestone.amount <= 0
        || typeof milestone.triggerCondition !== 'string' || !milestone.triggerCondition.trim()
        || (milestone.dueDate !== undefined
          && (typeof milestone.dueDate !== 'string' || !isIsoCalendarDate(milestone.dueDate))))) {
      return NextResponse.json({ success: false, error: 'INTERIOR_ADDENDUM_INPUT_INVALID' }, { status: 400 });
    }
    if (typeof ctx.actor.full_name !== 'string' || !ctx.actor.full_name.trim()) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_ACTOR_NAME_REQUIRED' }, { status: 422 });
    }
    const repository = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    try {
      const contract = await repository.getContract(ctx.tenantId, body.contractId);
      if (!contract || contract.projectId !== body.projectId) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_NOT_FOUND' }, { status: 404 });
      }
      const { data: projectData, error: projectError } = await interiorRbacRpcClient(ctx.supabase).rpc(
        'interior_read_project_for_contract',
        { p_project_id: body.projectId },
      );
      if (projectError) {
        if (projectError.message?.includes('AuthorizationViolation')) {
          return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
        }
        throw new Error('Addendum project lookup failed');
      }
      if (!isInteriorRbacRecord(projectData)
        || projectData.id !== body.projectId
        || typeof projectData.customerName !== 'string' || !projectData.customerName.trim()
        || typeof projectData.customerPhone !== 'string' || !projectData.customerPhone.trim()) {
        return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_CONTACT_REQUIRED' }, { status: 422 });
      }
      const lifecycle = new InteriorContractLifecycleService(repository);
      const addendum = await lifecycle.createAddendum({
        tenantId: ctx.tenantId,
        contractId: contract.id,
        addendumNumber: body.addendumNumber,
        title: body.addendumTitle,
        valueDelta: body.addendumValue,
        reason: body.addendumReason,
        proposedPaymentSchedule: body.addendumMilestones.map((milestone) => ({
          id: milestone.id,
          milestoneOrder: milestone.milestoneOrder,
          name: milestone.name,
          percentage: milestone.percentageOfTotal,
          amount: milestone.amount,
          triggerCondition: milestone.triggerCondition,
          dueDate: milestone.dueDate,
        })),
        userRole: ctx.actor.role,
        actorId: ctx.actor.id,
      });
      const approvals = new InteriorCustomerApprovalService(
        repository,
        new SupabaseInteriorFinanceOutboxAdapter(ctx.supabase as unknown as SupabaseClient),
      );
      const approval = await approvals.sendApprovalRequest({
        tenantId: ctx.tenantId,
        projectId: contract.projectId,
        subjectType: 'contract_addendum',
        subjectId: addendum.id,
        subjectVersionNumber: 1,
        clientRepresentative: projectData.customerName,
        clientContact: projectData.customerPhone,
        actorId: ctx.actor.id,
        actorName: ctx.actor.full_name.trim(),
        userRole: ctx.actor.role,
      });
      return NextResponse.json({
        success: true,
        data: {
          addendum,
          approvalId: approval.id,
          approvalStatus: approval.status,
          customerApprovalEndpoint: `/api/interior/customer-approvals/${approval.id}?token=${encodeURIComponent(approval.approvalToken)}`,
        },
      }, { status: 201, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('AuthorizationViolation')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
      }
      if (message.includes('AddendumScheduleInvalid') || message.includes('ADDENDUM_')
        || message.includes('ContractLifecycleError')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_ADDENDUM_PRECONDITION_FAILED' }, { status: 422 });
      }
      if (message.includes('ApprovalSubjectStatusError') || message.includes('already exists')
        || message.includes('duplicate key')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_ADDENDUM_OR_APPROVAL_ALREADY_EXISTS' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: 'INTERIOR_ADDENDUM_PERSISTENCE_FAILED' }, { status: 503 });
    }
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
