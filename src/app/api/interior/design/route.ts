import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { InteriorDesignAnalyticsService } from '@/products/bella-interior/services/interior-design-analytics.service';
import type {
  CreateVisualPerspectiveInput,
  CreateTechnicalDrawingInput,
  CreateDesignDocumentInput,
} from '@/products/bella-interior/domain/design-overview.types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectIdParam = request.nextUrl.searchParams.get('projectId');

  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
  if (!projectResult.ok && projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION') {
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      availableProjects: projectResult.availableProjects,
    }, { status: 400 });
  }

  const effectiveProjectId = projectResult.ok ? projectResult.projectId : undefined;

  try {
    const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(ctx.tenantId, effectiveProjectId);

    if (effectiveProjectId) {
      const rpc = interiorRbacRpcClient(ctx.supabase);
      const [revisionResult, roomZoneResult] = await Promise.all([
        rpc.rpc('interior_list_design_revisions', { p_project_id: effectiveProjectId }),
        rpc.rpc('interior_list_room_zones', { p_project_id: effectiveProjectId }),
      ]);

      const revisions = Array.isArray(revisionResult.data)
        ? revisionResult.data.filter(isInteriorRbacRecord)
        : [];
      const roomZones = Array.isArray(roomZoneResult.data)
        ? roomZoneResult.data.filter(isInteriorRbacRecord)
        : [];

      return NextResponse.json({
        success: true,
        data: {
          projectId: effectiveProjectId,
          revisions,
          roomZones,
          overview,
        },
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    return NextResponse.json({
      success: true,
      data: {
        overview,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const action = payload.action;

  try {
    if (action === 'toggle_lock') {
      const versionId = typeof payload.versionId === 'string' ? payload.versionId : 'rev-r1-0';
      const versionLock = await InteriorDesignAnalyticsService.toggleDesignLock(ctx.tenantId, versionId);
      return NextResponse.json({
        success: true,
        data: { versionLock },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'add_visual') {
      const visualInput = payload.visual as CreateVisualPerspectiveInput;
      if (!visualInput || typeof visualInput.title !== 'string' || typeof visualInput.imageUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid visual perspective input' }, { status: 422 });
      }
      const item = InteriorDesignAnalyticsService.addVisualPerspective(ctx.tenantId, visualInput);
      return NextResponse.json({
        success: true,
        data: { item },
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'add_drawing') {
      const drawingInput = payload.drawing as CreateTechnicalDrawingInput;
      if (!drawingInput || typeof drawingInput.title !== 'string' || typeof drawingInput.fileUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid technical drawing input' }, { status: 422 });
      }
      const item = InteriorDesignAnalyticsService.addTechnicalDrawing(ctx.tenantId, drawingInput);
      return NextResponse.json({
        success: true,
        data: { item },
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'add_document') {
      const docInput = payload.document as CreateDesignDocumentInput;
      if (!docInput || typeof docInput.title !== 'string' || typeof docInput.fileUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid document input' }, { status: 422 });
      }
      const item = InteriorDesignAnalyticsService.addDesignDocument(ctx.tenantId, docInput);
      return NextResponse.json({
        success: true,
        data: { item },
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ success: false, error: 'UNRECOGNIZED_ACTION' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_COMMAND_EXECUTION_FAILED' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const action = payload.action;
  const id = typeof payload.id === 'string' ? payload.id : undefined;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Field "id" is required' }, { status: 422 });
  }

  if (action === 'delete_visual' || payload.type === 'visual') {
    const deleted = InteriorDesignAnalyticsService.deleteVisualPerspective(ctx.tenantId, id);
    return NextResponse.json({ success: true, data: { deleted } }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'delete_drawing' || payload.type === 'drawing') {
    const deleted = InteriorDesignAnalyticsService.deleteTechnicalDrawing(ctx.tenantId, id);
    return NextResponse.json({ success: true, data: { deleted } }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ success: false, error: 'UNRECOGNIZED_ACTION' }, { status: 400 });
}
