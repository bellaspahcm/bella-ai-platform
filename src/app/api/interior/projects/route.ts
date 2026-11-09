import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectStatus =
  | 'inquiry'
  | 'design'
  | 'approved'
  | 'production'
  | 'installation'
  | 'handover'
  | 'completed'
  | 'cancelled';

interface CreateProjectBody {
  name: string;
  code: string;
  clientPartyId: string;
  description?: string;
  estimatedBudget: number;
  branchId?: string | null;
  branch_id?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateProjectStatus(status: string): status is ProjectStatus {
  return [
    'inquiry',
    'design',
    'approved',
    'production',
    'installation',
    'handover',
    'completed',
    'cancelled',
  ].includes(status);
}

// ─── GET /api/interior/projects ───────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_projects');
  if (error || !Array.isArray(data)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_LOOKUP_FAILED' }, { status: 503 });
  }
  const projects = data.filter((value): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  );
  return NextResponse.json({ success: true, data: { projects, total: projects.length } }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

// ─── POST /api/interior/projects ─────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = body as Partial<CreateProjectBody>;

  if (!parsed.name || typeof parsed.name !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "name" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.code || typeof parsed.code !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "code" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.clientPartyId || typeof parsed.clientPartyId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "clientPartyId" is required and must be a string' },
      { status: 422 }
    );
  }
  if (typeof parsed.estimatedBudget !== 'number' || parsed.estimatedBudget < 0) {
    return NextResponse.json(
      { success: false, error: 'Field "estimatedBudget" is required and must be a non-negative number' },
      { status: 422 }
    );
  }
  const branchId = parsed.branchId ?? parsed.branch_id ?? null;
  if (branchId !== null && !validInteriorUuid(branchId)) {
    return NextResponse.json({ success: false, error: 'INVALID_BRANCH_SCOPE' }, { status: 422 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_project', {
    p_code: parsed.code,
    p_name: parsed.name,
    p_customer_id: parsed.clientPartyId,
    p_customer_name: parsed.clientPartyId,
    p_customer_phone: '',
    p_site_address: parsed.description ?? '',
    p_project_type: 'residential_villa',
    p_estimated_budget: parsed.estimatedBudget,
    p_target_completion_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    p_branch_id: branchId,
  });
  if (error) {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PROJECT_PERSISTENCE_FAILED' },
      { status: 503 },
    );
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || typeof outcome.project_id !== 'string') {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'PROJECT_CREATE_DENIED';
    const status = reason === 'PROJECT_CODE_ALREADY_EXISTS' ? 409
      : reason === 'INVALID_PROJECT_INPUT' || reason === 'INVALID_BRANCH' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_CREATE_DENIED', reason }, { status });
  }
  const now = new Date().toISOString();

  const newProject = {
    id: outcome.project_id,
    name: parsed.name,
    code: parsed.code,
    status: 'design',
    clientName: parsed.clientPartyId,
    contractValue: parsed.estimatedBudget,
    createdAt: now,
  };

  return NextResponse.json(
    { success: true, data: { project: newProject } },
    { status: 201 }
  );
}

// Re-export validateProjectStatus for potential use by sub-routes
export { validateProjectStatus };
