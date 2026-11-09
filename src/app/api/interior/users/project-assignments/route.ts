import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import {
  interiorJsonBody,
  interiorMutationRow,
  interiorRbacRpcClient,
  validInteriorUuid,
} from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

async function updateProjectAssignment(request: Request, operation: 'GRANT' | 'REVOKE'): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;
  const body = await interiorJsonBody(request);
  if (!body || !validInteriorUuid(body.user_id) || !validInteriorUuid(body.project_id)) {
    return NextResponse.json({ success: false, error: 'INVALID_PROJECT_ASSIGNMENT' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(context.supabase).rpc('interior_assign_project_user', {
    p_user_id: body.user_id,
    p_project_id: body.project_id,
    p_operation: operation,
  });
  if (error) return NextResponse.json({ success: false, error: 'PROJECT_ASSIGNMENT_UNAVAILABLE' }, { status: 503 });
  const result = interiorMutationRow(data);
  if (result?.status !== 'COMMITTED') {
    return NextResponse.json({ success: false, error: 'PROJECT_ASSIGNMENT_DENIED', reason: result?.reason ?? 'UNAVAILABLE' }, { status: 403 });
  }
  return NextResponse.json({ success: true, assignment_id: result.assignment_id });
}

export async function POST(request: Request): Promise<NextResponse> {
  return updateProjectAssignment(request, 'GRANT');
}

export async function DELETE(request: Request): Promise<NextResponse> {
  return updateProjectAssignment(request, 'REVOKE');
}
