import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { DeliveryAftercareService } from '@/products/bella-interior/services/delivery-aftercare.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import type { NoteCategory, NoteSeverity, AssessmentStatus } from '@/products/bella-interior/domain/acceptance-handover.types';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = new Set<NoteCategory>([
  'QUALITY_ISSUE',
  'INSTALLATION_ISSUE',
  'CUSTOMER_REQUEST',
  'MISSING_ITEM',
  'DAMAGE',
  'FOLLOW_UP',
  'GENERAL_NOTE',
]);

const VALID_SEVERITIES = new Set<NoteSeverity>(['low', 'medium', 'high', 'critical']);
const VALID_ASSESSMENTS = new Set<AssessmentStatus>([
  'NO_ISSUES',
  'MINOR_MONITORING',
  'DEFECT_REMEDIATION_REQUIRED',
  'INCOMPLETE_ITEMS',
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id: sessionId } = await context.params;
  if (!sessionId || !validInteriorUuid(sessionId)) {
    return NextResponse.json({ success: false, error: 'Valid sessionId parameter is required' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);
    const notes = await service.listNotes(ctx.tenantId, sessionId);

    return NextResponse.json({ success: true, data: notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_NOTES_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { id: sessionId } = await context.params;
  if (!sessionId || !validInteriorUuid(sessionId)) {
    return NextResponse.json({ success: false, error: 'Valid sessionId parameter is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      category,
      severity,
      assessmentStatus,
      description,
      relatedBoqItemId,
      remediationPlan,
      assignedFixer,
      targetDeadline,
    } = body;

    if (!category || !VALID_CATEGORIES.has(category as NoteCategory)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Allowed: ${Array.from(VALID_CATEGORIES).join(', ')}` },
        { status: 400 }
      );
    }
    if (!severity || !VALID_SEVERITIES.has(severity as NoteSeverity)) {
      return NextResponse.json(
        { success: false, error: `Invalid severity. Allowed: ${Array.from(VALID_SEVERITIES).join(', ')}` },
        { status: 400 }
      );
    }
    if (!assessmentStatus || !VALID_ASSESSMENTS.has(assessmentStatus as AssessmentStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid assessmentStatus. Allowed: ${Array.from(VALID_ASSESSMENTS).join(', ')}` },
        { status: 400 }
      );
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
    }

    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const aftercare = new DeliveryAftercareService(repo);
    const service = new InteriorAcceptanceService(repo, aftercare);

    const note = await service.recordAcceptanceNote({
      tenantId: ctx.tenantId,
      sessionId,
      category,
      severity,
      assessmentStatus,
      description: description.trim(),
      relatedBoqItemId: relatedBoqItemId ?? null,
      remediationPlan: remediationPlan ?? null,
      assignedFixer: assignedFixer ?? null,
      targetDeadline: targetDeadline ?? null,
      createdByUserId: ctx.actor?.id || 'unassigned',
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_NOTE_CREATE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
