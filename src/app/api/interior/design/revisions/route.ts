import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type RevisionStatus = 'draft' | 'review' | 'approved' | 'rejected';

export interface DesignRevision {
  id: string;
  projectId: string;
  revisionName: string;
  revisionNumber: string;
  status: RevisionStatus;
  designedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateRevisionBody {
  projectId: string;
  revisionName: string;
  revisionNumber: string;
}

// ─── GET /api/interior/design/revisions ──────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectIdParam = searchParams.get('projectId');

  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
  if (!projectResult.ok) {
    const status = projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION' ? 400 : 404;
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      ...(projectResult.availableProjects ? { availableProjects: projectResult.availableProjects } : {}),
    }, { status });
  }

  const projectId = projectResult.projectId;

  try {
    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_design_revisions', {
      p_project_id: projectId,
    });
    if (error || !Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_READ_FAILED' }, { status: 503 });
    }
    const mapped: DesignRevision[] = data.filter(isInteriorRbacRecord).flatMap((revision) => {
      if (typeof revision.id !== 'string' || typeof revision.projectId !== 'string'
        || typeof revision.title !== 'string' || typeof revision.versionNumber !== 'number'
        || typeof revision.submittedBy !== 'string' || typeof revision.submittedAt !== 'string') return [];
      const status: RevisionStatus = revision.status === 'approved' ? 'approved'
        : revision.status === 'client_review' || revision.status === 'in_review' ? 'review'
          : revision.status === 'rejected' ? 'rejected' : 'draft';
      return [{
        id: revision.id,
        projectId: revision.projectId,
        revisionName: revision.title,
        revisionNumber: `R${revision.versionNumber}.0`,
        status,
        designedByUserId: revision.submittedBy,
        approvedByUserId: typeof revision.approvedBy === 'string' ? revision.approvedBy : null,
        approvedAt: typeof revision.approvedAt === 'string' ? revision.approvedAt : null,
        createdAt: revision.submittedAt,
        updatedAt: typeof revision.approvedAt === 'string' ? revision.approvedAt : revision.submittedAt,
      }];
    });
    return NextResponse.json({
      success: true,
      data: { revisions: mapped, total: mapped.length },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_READ_FAILED' }, { status: 503 });
  }
}

// ─── POST /api/interior/design/revisions ─────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { actor } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = body as Partial<CreateRevisionBody>;

  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, parsed.projectId);
  if (!projectResult.ok) {
    const status = projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION' ? 400 : 422;
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      ...(projectResult.availableProjects ? { availableProjects: projectResult.availableProjects } : {}),
    }, { status });
  }
  const targetProjectId = projectResult.projectId;

  if (!parsed.revisionName || typeof parsed.revisionName !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "revisionName" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.revisionNumber || typeof parsed.revisionNumber !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "revisionNumber" is required and must be a string' },
      { status: 422 }
    );
  }
  const versionMatch = /^R?(\d+)(?:\.\d+)?$/i.exec(parsed.revisionNumber.trim());
  const numParsed = versionMatch?.[1] ? Number.parseInt(versionMatch[1], 10) : Number.NaN;
  if (!Number.isFinite(numParsed) || numParsed <= 0) {
    return NextResponse.json({ success: false, error: 'revisionNumber must contain a positive revision number' }, { status: 422 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_design_revision', {
    p_project_id: targetProjectId,
    p_title: parsed.revisionName.trim(),
    p_version_number: numParsed,
  });
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_PERSISTENCE_FAILED' }, { status: 503 });
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || typeof outcome.revision_id !== 'string') {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'DESIGN_REVISION_CREATE_DENIED';
    const status = reason === 'REVISION_NUMBER_ALREADY_EXISTS' ? 409
      : reason === 'PROJECT_NOT_FOUND' ? 404
        : reason === 'INVALID_REVISION_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_CREATE_DENIED', reason }, { status });
  }

  const now = new Date().toISOString();
  const newRevision: DesignRevision = {
    id: outcome.revision_id,
    projectId: targetProjectId,
    revisionName: parsed.revisionName.trim(),
    revisionNumber: `R${numParsed}.0`,
    status: 'draft',
    designedByUserId: actor.id,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(
    { success: true, data: { revision: newRevision } },
    { status: 201 }
  );
}
