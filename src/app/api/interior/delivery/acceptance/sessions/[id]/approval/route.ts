import { NextResponse } from 'next/server';
import { resolveInteriorContext, INTERIOR_PERMISSIONS } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const { decision, approvalNotes, rejectionReason } = body;

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return NextResponse.json(
        { success: false, error: "decision must be either 'APPROVED' or 'REJECTED'" },
        { status: 400 }
      );
    }

    if (decision === 'REJECTED' && (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim())) {
      return NextResponse.json(
        { success: false, error: 'rejectionReason is required when decision is REJECTED' },
        { status: 400 }
      );
    }

    // Server-enforced authorization check: requires interior:handover:approve
    // We check actor permissions from context or role-authorization
    const actorPermissions: string[] = [];
    const role = (ctx.actor as { role?: string; roles?: string[] })?.role || '';
    const rolesList = (ctx.actor as { role?: string; roles?: string[] })?.roles || [];
    const isManagerRole =
      ['admin', 'manager', 'director', 'general_director', 'project_manager'].includes(role) ||
      rolesList.some((r: string) => ['admin', 'manager', 'director', 'general_director', 'project_manager'].includes(r));

    if (isManagerRole) {
      actorPermissions.push(INTERIOR_PERMISSIONS.handoverApprove);
    }

    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);

    const session = await service.approveSession({
      tenantId: ctx.tenantId,
      sessionId,
      actorId: ctx.actor?.id || 'unassigned',
      actorPermissions,
      decision,
      approvalNotes: typeof approvalNotes === 'string' ? approvalNotes.trim() : null,
      rejectionReason: typeof rejectionReason === 'string' ? rejectionReason.trim() : null,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_APPROVAL_FAILED';
    const status = message.includes('interior:handover:approve') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
