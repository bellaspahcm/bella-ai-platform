import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorQuotationMarginService } from '@/products/bella-interior/services/interior-quotation-margin.service';

export const dynamic = 'force-dynamic';

function optionalFiniteNumber(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function optionalText(value: unknown, maximumLength: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) return null;
  return value.trim();
}

function safeQuotation(quotation: Awaited<ReturnType<SupabaseInteriorRepository['listQuotationsByProject']>>[number]) {
  return {
    id: quotation.id,
    projectId: quotation.projectId,
    boqId: quotation.boqId,
    boqVersionNumber: quotation.boqVersionNumber,
    quotationNumber: quotation.quotationNumber,
    versionNumber: quotation.versionNumber,
    status: quotation.status,
    subtotal: quotation.subtotal,
    discountAmount: quotation.discountAmount,
    vatPercent: quotation.vatPercent,
    vatAmount: quotation.vatAmount,
    grandTotal: quotation.grandTotal,
    paymentTerms: quotation.paymentTerms,
    validityDays: quotation.validityDays,
    sentToClientAt: quotation.sentToClientAt ?? null,
    acceptedAt: quotation.acceptedAt ?? null,
    rejectedAt: quotation.rejectedAt ?? null,
    createdAt: quotation.createdAt,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectId = new URL(request.url).searchParams.get('project_id')
    ?? new URL(request.url).searchParams.get('projectId');
  if (!validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'project_id must be a valid UUID' }, { status: 400 });
  }

  try {
    const repository = new SupabaseInteriorRepository(ctx.supabase);
    const quotations = await repository.listQuotationsByProject(ctx.tenantId, projectId);
    return NextResponse.json({ success: true, data: quotations.map(safeQuotation) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_LOOKUP_FAILED' }, { status: 503 });
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

  const projectId = body.project_id ?? body.projectId;
  const boqId = body.boq_id ?? body.boqId;
  if (!validInteriorUuid(projectId) || !validInteriorUuid(boqId)) {
    return NextResponse.json({ success: false, error: 'project_id and boq_id must be valid UUIDs' }, { status: 400 });
  }
  const [boqRead, financeRead] = await Promise.all([
    ctx.authorization.authorize({
      permissionId: 'interior:boq:read', tenantId: ctx.tenantId, projectId,
    }),
    ctx.authorization.authorize({
      permissionId: 'interior:finance:read', tenantId: ctx.tenantId, projectId,
    }),
  ]);
  if (boqRead.status === 'UNAVAILABLE' || financeRead.status === 'UNAVAILABLE') {
    return NextResponse.json({ success: false, error: 'INTERIOR_AUTHORIZATION_UNAVAILABLE' }, { status: 503 });
  }
  if (boqRead.status !== 'ALLOW' || financeRead.status !== 'ALLOW') {
    return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
  }
  const discountAmount = optionalFiniteNumber(body.discount_amount ?? body.discountAmount);
  const vatPercent = optionalFiniteNumber(body.vat_percent ?? body.vatPercent);
  const validityDays = optionalFiniteNumber(body.validity_days ?? body.validityDays);
  const quotationNumber = optionalText(body.quotation_number ?? body.quotationNumber, 120);
  const paymentTerms = optionalText(body.payment_terms ?? body.paymentTerms, 2000);
  if (discountAmount === null || (discountAmount !== undefined && discountAmount < 0)
    || vatPercent === null || (vatPercent !== undefined && (vatPercent < 0 || vatPercent > 100))
    || validityDays === null || (validityDays !== undefined
      && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365))
    || quotationNumber === null || paymentTerms === null) {
    return NextResponse.json({ success: false, error: 'Quotation terms are invalid' }, { status: 400 });
  }

  try {
    const repository = new SupabaseInteriorRepository(ctx.supabase);
    const [boq, existing] = await Promise.all([
      repository.getBOQ(ctx.tenantId, boqId),
      repository.listQuotationsByProject(ctx.tenantId, projectId),
    ]);
    if (!boq || boq.projectId !== projectId) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_SOURCE_NOT_FOUND' }, { status: 404 });
    }
    if (boq.status !== 'approved' && boq.status !== 'locked_for_contract') {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_REQUIRES_APPROVED_BOQ' }, { status: 409 });
    }
    if (existing.some((quotation) => quotation.boqId === boq.id && !quotation.forkedFromQuotationId)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_ALREADY_EXISTS_FOR_BOQ' }, { status: 409 });
    }

    const service = new InteriorQuotationMarginService(repository);
    const quotation = await service.generateQuotationFromBOQ({
      tenantId: ctx.tenantId,
      projectId,
      boqId,
      actorId: ctx.actor.id,
      actorName: ctx.actor.full_name ?? undefined,
      ...(discountAmount !== undefined ? { discountAmount } : {}),
      ...(vatPercent !== undefined ? { vatPercent } : {}),
      ...(validityDays !== undefined ? { validityDays } : {}),
      ...(quotationNumber !== undefined ? { quotationNumber } : {}),
      ...(paymentTerms !== undefined ? { paymentTerms } : {}),
    });
    const customerView = await service.getClientQuotationView(ctx.tenantId, quotation);

    return NextResponse.json({
      success: true,
      data: {
        quotationId: quotation.id,
        projectId: quotation.projectId,
        boqId: quotation.boqId,
        boqVersionNumber: quotation.boqVersionNumber,
        ...customerView,
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/ALREADY_EXISTS|already exists|REVISION_ALREADY_EXISTS/i.test(message)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_ALREADY_EXISTS_FOR_BOQ' }, { status: 409 });
    }
    if (/AuthorizationViolation|permission/i.test(message)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
    }
    if (/QuotationGenerationError|QuotationTermsInvalid|QuotationPriceRequired/i.test(message)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_SOURCE_OR_TERMS_INVALID' }, { status: 422 });
    }
    return NextResponse.json({ success: false, error: 'INTERIOR_QUOTATION_CREATE_FAILED' }, { status: 503 });
  }
}
