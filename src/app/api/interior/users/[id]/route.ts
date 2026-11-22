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

  const { id: targetUserId } = await context.params;
  if (!validInteriorUuid(targetUserId)) {
    return NextResponse.json({ success: false, error: 'INVALID_USER_ID' }, { status: 400 });
  }

  const body = await interiorJsonBody(request);
  const status = typeof body?.status === 'string' ? body.status.toLowerCase().trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  if (status !== 'active' && status !== 'inactive') {
    return NextResponse.json(
      { success: false, error: 'INVALID_STATUS', message: 'Trạng thái phải là active hoặc inactive.' },
      { status: 400 }
    );
  }

  const { data, error } = await interiorRbacRpcClient(resolved.supabase).rpc('interior_update_user_status', {
    p_target_user_id: targetUserId,
    p_status: status,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: 'USER_STATUS_UPDATE_UNAVAILABLE' },
      { status: 503 }
    );
  }

  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    const errorReason = typeof result?.reason === 'string' ? result.reason : 'USER_STATUS_UPDATE_DENIED';
    const statusCode =
      errorReason === 'USER_NOT_FOUND_IN_TENANT' ? 404 :
      errorReason === 'CANNOT_CHANGE_OWN_STATUS' || errorReason === 'INVALID_INPUT' ? 400 : 403;

    return NextResponse.json(
      { success: false, error: 'USER_STATUS_UPDATE_DENIED', reason: errorReason },
      { status: statusCode }
    );
  }

  return NextResponse.json({
    success: true,
    user_id: targetUserId,
    status,
    event_type: result.reason,
  });
}
