import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import {
  interiorJsonBody,
  interiorMutationRow,
  interiorRbacRpcClient,
  validInteriorUuid,
} from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const resolved = await resolveInteriorContext(request);
  if (!resolved.ok) return resolved.response;
  const { id } = await context.params;
  const body = await interiorJsonBody(request);
  const branchId = body?.branch_id;
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'branch_id')
      || !validInteriorUuid(id)
      || (branchId !== null && branchId !== undefined && !validInteriorUuid(branchId))) {
    return NextResponse.json({ success: false, error: 'INVALID_PROJECT_BRANCH' }, { status: 400 });
  }

  const { data, error } = await interiorRbacRpcClient(resolved.supabase).rpc('interior_assign_project_branch', {
    p_project_id: id,
    p_branch_id: branchId ?? null,
  });
  if (error) return NextResponse.json({ success: false, error: 'PROJECT_BRANCH_UPDATE_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'PROJECT_BRANCH_UPDATE_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, project_id: result.project_id, branch_id: result.branch_id });
}
