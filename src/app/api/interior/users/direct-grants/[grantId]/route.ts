import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ grantId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const resolved = await resolveInteriorContext(request);
  if (!resolved.ok) return resolved.response;
  const { grantId } = await context.params;
  if (!validInteriorUuid(grantId)) {
    return NextResponse.json({ success: false, error: 'INVALID_GRANT_ID' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(resolved.supabase).rpc('interior_revoke_direct_permission', {
    p_grant_id: grantId,
  });
  if (error) return NextResponse.json({ success: false, error: 'DIRECT_PERMISSION_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'DIRECT_PERMISSION_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, grant_id: result.grant_id });
}
