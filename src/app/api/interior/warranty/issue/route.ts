import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

interface WarrantyIssueBody {
  certificateId: string;
  warrantySnapshot: Record<string, unknown>;
}

/**
 * POST /api/interior/warranty/issue
 *
 * Formally issues a warranty certificate using `rpc_issue_interior_warranty`.
 *
 * D13 guards (enforced at DB level):
 * 1. Contract must be active/executed/completed
 * 2. Customer-accepted handover dossier must exist (client_accepted = true)
 * 3. Internal handover_review approval must exist and not be superseded
 * 4. warranty_terms_status must NOT be PENDING_TERMS
 * 5. warrantySnapshot must be non-empty
 *
 * RBAC: requires interior:warranty:issue permission
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const payload = body as Partial<WarrantyIssueBody>;

  if (!validInteriorUuid(payload.certificateId)) {
    return NextResponse.json(
      { success: false, error: 'certificateId must be a valid UUID' },
      { status: 400 },
    );
  }

  if (
    typeof payload.warrantySnapshot !== 'object' ||
    payload.warrantySnapshot === null ||
    Array.isArray(payload.warrantySnapshot) ||
    Object.keys(payload.warrantySnapshot).length === 0
  ) {
    return NextResponse.json(
      { success: false, error: 'warrantySnapshot must be a non-empty object' },
      { status: 400 },
    );
  }

  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('rpc_issue_interior_warranty', {
    p_tenant_id: ctx.tenantId,
    p_certificate_id: payload.certificateId,
    p_warranty_snapshot: payload.warrantySnapshot,
  });

  if (error) {
    const msg = typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : '';
    const isAuthError = msg.includes('AuthorizationViolation') || msg.includes('permission');
    const isGuardError = msg.includes('guard_') || msg.includes('D13') || msg.includes('PENDING_TERMS');
    return NextResponse.json(
      {
        success: false,
        error: isAuthError
          ? 'INTERIOR_PERMISSION_DENIED'
          : isGuardError
          ? 'INTERIOR_WARRANTY_ISSUANCE_GUARD_FAILED'
          : 'INTERIOR_WARRANTY_ISSUANCE_FAILED',
        message: isAuthError ? undefined : msg,
      },
      { status: isAuthError ? 403 : isGuardError ? 422 : 503 },
    );
  }

  // rpc_issue_interior_warranty returns the updated certificate row
  const result = Array.isArray(data) && data.length === 1
    ? data[0]
    : isInteriorRbacRecord(data) ? data : null;

  if (!result || !isInteriorRbacRecord(result)) {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_WARRANTY_ISSUANCE_FAILED', message: 'No certificate returned from RPC' },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: result.id,
        certificateNumber: result.certificate_number,
        warrantyTermsStatus: result.warranty_terms_status,
        issuedAt: result.issued_at,
        issuedById: result.issued_by_id,
      },
    },
    { status: 200 },
  );
}
