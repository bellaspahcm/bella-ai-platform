import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InteriorProject } from '@/products/bella-interior/domain/design-specification/types';

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
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);

  try {
    const projects = await repo.listProjects(ctx.tenantId);
    const [customerDecision, financeDecision, contractDecision] = await Promise.all([
      ctx.authorization.authorize({ permissionId: 'interior:customer:read', tenantId: ctx.tenantId }),
      ctx.authorization.authorize({ permissionId: 'interior:finance:read', tenantId: ctx.tenantId }),
      ctx.authorization.authorize({ permissionId: 'interior:contract:read', tenantId: ctx.tenantId }),
    ]);
    const canReadBudget = financeDecision.status === 'ALLOW' || contractDecision.status === 'ALLOW';
    return NextResponse.json({
      success: true,
      data: {
        projects: projects.map((project) => ({
          id: project.id,
          code: project.code,
          name: project.name,
          status: project.status,
          customerName: customerDecision.status === 'ALLOW' ? project.customerName : null,
          estimatedBudget: canReadBudget && Number.isFinite(project.estimatedBudget)
            ? project.estimatedBudget
            : null,
          targetCompletionDate: project.targetCompletionDate,
          leadArchitectName: project.leadArchitectName,
        })),
        total: projects.length,
      },
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PROJECT_LOOKUP_FAILED' },
      { status: 503 }
    );
  }
}

// ─── POST /api/interior/projects ─────────────────────────────────────────────

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

  const now = new Date().toISOString();
  const projectId = randomUUID();
  const domainProject: InteriorProject = {
    id: projectId,
    tenantId,
    code: parsed.code,
    name: parsed.name,
    customerId: parsed.clientPartyId,
    customerName: parsed.clientPartyId,
    customerPhone: '',
    siteAddress: parsed.description || '',
    projectType: 'residential_villa',
    status: 'concept_design',
    estimatedBudget: parsed.estimatedBudget,
    targetCompletionDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    leadArchitectId: actor.id,
    leadArchitectName: actor.full_name || actor.email,
    createdAt: now,
    updatedAt: now,
  };

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    await repo.saveProject(tenantId, domainProject);
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PROJECT_PERSISTENCE_FAILED' },
      { status: 503 },
    );
  }

  const newProject = {
    id: projectId,
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
