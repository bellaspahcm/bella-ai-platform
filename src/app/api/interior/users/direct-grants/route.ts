import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import {
  interiorJsonBody,
  interiorMutationRow,
  interiorRbacRpcClient,
  validInteriorUuid,
} from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;
  const body = await interiorJsonBody(request);
  if (!body || !validInteriorUuid(body.target_user_id) || typeof body.permission_id !== 'string'
      || typeof body.scope_type !== 'string'
      || (body.scope_id !== undefined && body.scope_id !== null && !validInteriorUuid(body.scope_id))) {
    return NextResponse.json({ success: false, error: 'INVALID_DIRECT_PERMISSION' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_grant_direct_permission', {
    p_target_user_id: body.target_user_id,
    p_permission_id: body.permission_id,
    p_scope_type: body.scope_type,
    p_scope_id: body.scope_id ?? null,
  });
  if (error) return NextResponse.json({ success: false, error: 'DIRECT_PERMISSION_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'DIRECT_PERMISSION_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, grant_id: result.grant_id });
}
