import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

interface HandoverCreateBody {
  projectId: string;
  clientRepresentative: string;
  notes?: string;
}

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
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }
  const payload = body as Partial<HandoverCreateBody>;
  if (!validInteriorUuid(payload.projectId) || typeof payload.clientRepresentative !== 'string' || !payload.clientRepresentative.trim() || payload.clientRepresentative.trim().length > 200) {
    return NextResponse.json({ success: false, error: 'projectId and clientRepresentative are required' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_handover_dossier', {
    p_project_id: payload.projectId,
    p_client_representative: payload.clientRepresentative.trim(),
  });
  if (error) return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_PERSISTENCE_FAILED' }, { status: 503 });
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || !isInteriorRbacRecord(outcome.dossier)) {
    const reason = outcome?.reason;
    const status = reason === 'PROJECT_NOT_FOUND' ? 404
      : reason === 'HANDOVER_ALREADY_COMPLETED' ? 409
        : reason === 'SIGNED_ACTIVE_CONTRACT_REQUIRED' || reason === 'OPEN_CRITICAL_QC_ITEMS_REMAIN' || reason === 'INVALID_HANDOVER_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_DENIED', reason }, { status });
  }
  return NextResponse.json({ success: true, data: { dossier: outcome.dossier } }, { status: 201 });
}
