import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import {
  interiorJsonBody,
  interiorMutationRow,
  interiorRbacRpcClient,
  isInteriorRbacRecord,
  validInteriorUuid,
} from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

const ROLE_KEYS = new Set([
  'OWNER','ADMIN','SALES','DESIGNER','QS','PM','SITE_MANAGER',
  'PRODUCTION_MANAGER','QC','ACCOUNTANT','WARRANTY','EXECUTIVE',
]);
const SCOPE_TYPES = new Set(['TENANT','BRANCH','PROJECT','SELF']);

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;
  const body = await interiorJsonBody(request);
  if (!body || !validInteriorUuid(body.target_user_id)
      || typeof body.role_key !== 'string' || !ROLE_KEYS.has(body.role_key)
      || typeof body.scope_type !== 'string' || !SCOPE_TYPES.has(body.scope_type)
      || (body.scope_id !== undefined && body.scope_id !== null && !validInteriorUuid(body.scope_id))) {
    return NextResponse.json({ success: false, error: 'INVALID_ROLE_ASSIGNMENT' }, { status: 400 });
  }

  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_manage_user_role', {
    p_operation: 'GRANT',
    p_target_user_id: body.target_user_id,
    p_role_key: body.role_key,
    p_scope_type: body.scope_type,
    p_scope_id: body.scope_id ?? null,
    p_assignment_id: null,
  });
  if (error) return NextResponse.json({ success: false, error: 'ROLE_ASSIGNMENT_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'ROLE_ASSIGNMENT_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, assignment_id: result.assignment_id });
}
