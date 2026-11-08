import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DesignRevision as DomainDesignRevision } from '@/products/bella-interior/domain/design-specification/types';

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
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ success: false, error: 'projectId query parameter is required' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbRevs = await repo.listDesignRevisions(tenantId, projectId);
    const mapped: DesignRevision[] = dbRevs.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          revisionName: r.title,
          revisionNumber: `R${r.versionNumber}.0`,
          status: r.status === 'approved' ? 'approved' : r.status === 'client_review' ? 'review' : r.status === 'rejected' ? 'rejected' : 'draft',
          designedByUserId: r.submittedBy,
          approvedByUserId: r.approvedBy ?? null,
          approvedAt: r.approvedAt ?? null,
          createdAt: r.submittedAt || new Date().toISOString(),
          updatedAt: r.approvedAt || r.submittedAt || new Date().toISOString(),
        }));
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
  const { tenantId, actor } = ctx;

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

  if (!parsed.projectId || typeof parsed.projectId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "projectId" is required and must be a string' },
      { status: 422 }
    );
  }
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
  const now = new Date().toISOString();
  const revId = randomUUID();
  const numParsed = parseInt(parsed.revisionNumber.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(numParsed) || numParsed <= 0) {
    return NextResponse.json({ success: false, error: 'revisionNumber must contain a positive revision number' }, { status: 422 });
  }
  const versionNumber = numParsed;

  const domainRevision: DomainDesignRevision = {
    id: revId,
    tenantId,
    projectId: parsed.projectId,
    versionNumber,
    title: parsed.revisionName,
    status: 'draft',
    submittedBy: actor.id,
    submittedAt: now,
    assets: [],
    materialSpecs: [],
  };

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const project = await repo.getProject(tenantId, parsed.projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    await repo.saveDesignRevision(tenantId, domainRevision);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_PERSISTENCE_FAILED' }, { status: 503 });
  }

  const newRevision: DesignRevision = {
    id: revId,
    projectId: parsed.projectId,
    revisionName: parsed.revisionName,
    revisionNumber: parsed.revisionNumber,
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
