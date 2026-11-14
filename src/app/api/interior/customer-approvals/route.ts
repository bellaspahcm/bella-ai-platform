import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseInteriorFinanceOutboxAdapter } from '@/products/bella-interior/adapters/supabase-finance-outbox.adapter';
import { validInteriorUuid, interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorCustomerApprovalService } from '@/products/bella-interior/services/interior-customer-approval.service';

export const dynamic = 'force-dynamic';

function safeApproval(approval: Record<string, unknown>) {
  return {
    id: approval.id,
    projectId: approval.projectId,
    subjectType: approval.subjectType,
    subjectId: approval.subjectId,
    subjectVersionNumber: approval.subjectVersionNumber,
    status: approval.status,
    clientRepresentative: approval.clientRepresentative,
    sentAt: approval.sentAt,
    expiresAt: approval.expiresAt,
    approvedAt: approval.approvedAt ?? null,
    rejectedAt: approval.rejectedAt ?? null,
    rejectionReason: approval.rejectionReason ?? null,
    customerNotes: approval.customerNotes ?? null,
    sentByActorId: approval.sentByActorId,
    sentByActorName: approval.sentByActorName,
    hasSignature: Boolean(approval.signatureReference),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const subjectId = new URL(request.url).searchParams.get('subjectId');
  if (!validInteriorUuid(subjectId)) {
    return NextResponse.json({ success: false, error: 'subjectId must be a valid UUID' }, { status: 400 });
  }

  try {
    const repository = new SupabaseInteriorRepository(ctx.supabase);
    const approvals = await repository.listCustomerApprovals(ctx.tenantId, subjectId);
    return NextResponse.json({ success: true, data: approvals.map((approval) => safeApproval(approval as unknown as Record<string, unknown>)) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_APPROVAL_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isInteriorRbacRecord(parsed)) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const subjectType = body.subjectType;
  const subjectId = body.subjectId;
  const requestedVersion = body.subjectVersionNumber;
  if ((subjectType !== 'quotation' && subjectType !== 'contract' && subjectType !== 'contract_addendum') || !validInteriorUuid(subjectId)
    || !validInteriorUuid(body.projectId)
    || (requestedVersion !== undefined
      && (typeof requestedVersion !== 'number' || !Number.isInteger(requestedVersion) || requestedVersion < 1))) {
    return NextResponse.json({ success: false, error: 'Customer approval subject is invalid' }, { status: 400 });
  }

  const repository = new SupabaseInteriorRepository(ctx.supabase);
  try {
    let projectId: string;
    let subjectVersionNumber: number;
    if (subjectType === 'quotation') {
      const quotation = await repository.getQuotation(ctx.tenantId, subjectId);
      if (!quotation) {
        return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_NOT_FOUND' }, { status: 404 });
      }
      projectId = quotation.projectId;
      subjectVersionNumber = quotation.versionNumber;
    } else if (subjectType === 'contract') {
      const contract = await repository.getContractForCustomerApproval(ctx.tenantId, subjectId);
      if (!contract) {
        return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_NOT_FOUND' }, { status: 404 });
      }
      projectId = contract.projectId;
      subjectVersionNumber = contract.quotationVersionNumber;
    } else {
      const addendum = await repository.getContractAddendumForCustomerApproval(ctx.tenantId, subjectId);
      if (!addendum) {
        return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_NOT_FOUND' }, { status: 404 });
      }
      if (addendum.status !== 'pending_customer_approval' || addendum.customerApprovalId !== null) {
        return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_NOT_READY' }, { status: 409 });
      }
      projectId = addendum.projectId;
      subjectVersionNumber = addendum.versionNumber;
    }
    if ((requestedVersion !== undefined && requestedVersion !== subjectVersionNumber)
      || body.projectId !== projectId) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_VERSION_MISMATCH' }, { status: 409 });
    }

    const { data: projectData, error: projectError } = await interiorRbacRpcClient(ctx.supabase).rpc(
      'interior_read_project_for_contract',
      { p_project_id: projectId },
    );
    if (projectError) {
      if (projectError.message?.includes('AuthorizationViolation')) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
      }
      throw new Error('Interior project lookup failed');
    }
    if (!isInteriorRbacRecord(projectData)
      || projectData.id !== projectId
      || typeof projectData.customerName !== 'string'
      || typeof projectData.customerPhone !== 'string'
      || !projectData.customerPhone.trim()) {
      return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_CONTACT_REQUIRED' }, { status: 422 });
    }
    if (typeof ctx.actor.full_name !== 'string' || !ctx.actor.full_name.trim()) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_ACTOR_NAME_REQUIRED' }, { status: 422 });
    }

    const validityDays = body.validityDays;
    if (validityDays !== undefined
      && (typeof validityDays !== 'number' || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_VALIDITY_INVALID' }, { status: 400 });
    }

    const service = new InteriorCustomerApprovalService(
      repository,
      new SupabaseInteriorFinanceOutboxAdapter(ctx.supabase as unknown as SupabaseClient),
    );
    const approval = await service.sendApprovalRequest({
      tenantId: ctx.tenantId,
      projectId,
      subjectType,
      subjectId,
      subjectVersionNumber,
      clientRepresentative: projectData.customerName,
      clientContact: projectData.customerPhone,
      actorId: ctx.actor.id,
      actorName: ctx.actor.full_name.trim(),
      userRole: ctx.actor.role,
      ...(typeof validityDays === 'number' ? { validityDays } : {}),
    });
    const customerApprovalEndpoint = `/api/interior/customer-approvals/${approval.id}?token=${encodeURIComponent(approval.approvalToken)}`;

    return NextResponse.json({
      success: true,
      data: {
        approvalId: approval.id,
        subjectType: approval.subjectType,
        subjectId: approval.subjectId,
        subjectVersionNumber: approval.subjectVersionNumber,
        status: approval.status,
        expiresAt: approval.expiresAt,
        customerApprovalEndpoint,
      },
    }, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('APPROVAL_RBAC_DENIED') || message.includes('AuthorizationViolation')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
    }
    if (message.includes('APPROVAL_SUBJECT_STATUS_ERROR') || message.includes('ALREADY_EXISTS')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_SUBJECT_NOT_READY' }, { status: 409 });
    }
    if (message.includes('APPROVAL_TOKEN_ERROR')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_REQUEST_INVALID' }, { status: 422 });
    }
    return NextResponse.json({ success: false, error: 'INTERIOR_APPROVAL_REQUEST_FAILED' }, { status: 503 });
  }
}
