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
  if (!body || !validInteriorUuid(body.admin_user_id) || typeof body.role_key !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_ROLE_DELEGATION' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_set_admin_role_delegation', {
    p_admin_user_id: body.admin_user_id,
    p_role_key: body.role_key,
    p_operation: 'GRANT',
  });
  if (error) return NextResponse.json({ success: false, error: 'ROLE_DELEGATION_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'ROLE_DELEGATION_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, delegation_id: result.delegation_id });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;
  const body = await interiorJsonBody(request);
  if (!body || !validInteriorUuid(body.admin_user_id) || typeof body.role_key !== 'string') {
    return NextResponse.json({ success: false, error: 'INVALID_ROLE_DELEGATION' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_set_admin_role_delegation', {
    p_admin_user_id: body.admin_user_id,
    p_role_key: body.role_key,
    p_operation: 'REVOKE',
  });
  if (error) return NextResponse.json({ success: false, error: 'ROLE_DELEGATION_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'ROLE_DELEGATION_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, delegation_id: result.delegation_id });
}
