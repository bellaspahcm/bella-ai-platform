import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (projectId !== null && !validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'projectId must be a valid UUID' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_handover_dossiers', {
    p_project_id: projectId,
  });
  if (error) {
    const denied = error.message?.includes('AuthorizationViolation') === true;
    return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_HANDOVER_LOOKUP_FAILED' }, { status: denied ? 403 : 503 });
  }
  if (!Array.isArray(data) || data.some((item) => !isInteriorRbacRecord(item))) {
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_LOOKUP_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: { handovers: data, total: data.length } }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isInteriorRbacRecord(body) || !validInteriorUuid(body.projectId)
    || (body.contractId !== undefined && !validInteriorUuid(body.contractId))) {
    return NextResponse.json({ success: false, error: 'projectId and optional contractId are invalid' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_request_handover_acceptance', {
    p_project_id: body.projectId,
    p_contract_id: typeof body.contractId === 'string' ? body.contractId : null,
  });
  if (error) {
    if (error.message?.includes('AuthorizationViolation')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_PERMISSION_DENIED' }, { status: 403 });
    }
    if (error.message?.includes('CUSTOMER_CONTACT_REQUIRED')) {
      return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_CUSTOMER_CONTACT_REQUIRED' }, { status: 422 });
    }
    const code = error.message?.includes('LEGACY_ACCEPTANCE_UNVERIFIED')
      ? 'INTERIOR_HANDOVER_LEGACY_ACCEPTANCE_UNVERIFIED'
      : error.message?.includes('ALREADY_COMPLETED') ? 'INTERIOR_HANDOVER_ALREADY_COMPLETED'
        : error.message?.includes('CONTRACT_AMBIGUOUS') ? 'INTERIOR_HANDOVER_CONTRACT_SELECTION_REQUIRED'
          : error.message?.includes('OPEN_QC_ITEMS_REMAIN') ? 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN'
            : error.message?.includes('SIGNED_CONTRACT_REQUIRED') ? 'INTERIOR_HANDOVER_SIGNED_CONTRACT_REQUIRED'
              : 'INTERIOR_HANDOVER_REQUEST_FAILED';
    const status = code === 'INTERIOR_HANDOVER_LEGACY_ACCEPTANCE_UNVERIFIED'
      || code === 'INTERIOR_HANDOVER_ALREADY_COMPLETED'
      || code === 'INTERIOR_HANDOVER_CONTRACT_SELECTION_REQUIRED' ? 409
      : code === 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN'
        || code === 'INTERIOR_HANDOVER_SIGNED_CONTRACT_REQUIRED' ? 422 : 503;
    return NextResponse.json({ success: false, error: code }, { status });
  }
  if (!isInteriorRbacRecord(data) || data.status !== 'COMMITTED'
    || !isInteriorRbacRecord(data.dossier) || !isInteriorRbacRecord(data.approval)
    || typeof data.approval.id !== 'string' || !validInteriorUuid(data.approval.token)
    || typeof data.approval.expiresAt !== 'string') {
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_REQUEST_FAILED' }, { status: 503 });
  }

  const customerAcceptanceEndpoint = `/api/interior/delivery/handover/acceptances/${data.approval.id}?token=${encodeURIComponent(data.approval.token)}`;
  return NextResponse.json({
    success: true,
    data: {
      dossier: data.dossier,
      approvalId: data.approval.id,
      status: data.approval.status,
      expiresAt: data.approval.expiresAt,
      customerAcceptanceEndpoint,
    },
  }, { status: 201, headers: {
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
  } });
}
