import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ assignmentId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const resolved = await resolveInteriorContext(request);
  if (!resolved.ok) return resolved.response;
  const { assignmentId } = await context.params;
  if (!validInteriorUuid(assignmentId)) {
    return NextResponse.json({ success: false, error: 'INVALID_ASSIGNMENT_ID' }, { status: 400 });
  }

  const { data, error } = await interiorRbacRpcClient(resolved.supabase).rpc('interior_manage_user_role', {
    p_operation: 'REVOKE',
    p_target_user_id: null,
    p_role_key: null,
    p_scope_type: null,
    p_scope_id: null,
    p_assignment_id: assignmentId,
  });
  if (error) return NextResponse.json({ success: false, error: 'ROLE_REVOCATION_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'ROLE_REVOCATION_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, assignment_id: result.assignment_id });
}
