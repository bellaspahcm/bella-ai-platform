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

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'inquiry': return 'Khảo sát / Tiếp nhận';
    case 'design': return 'Đang thiết kế';
    case 'approved': return 'Đã duyệt thiết kế';
    case 'production': return 'Sản xuất xưởng';
    case 'installation': return 'Thi công lắp đặt';
    case 'handover': return 'Nghiệm thu bàn giao';
    case 'completed': return 'Hoàn thành';
    case 'cancelled': return 'Đã hủy';
    case 'active':
    case 'in_progress':
    default: return 'Đang thực hiện';
  }
}

function formatStatusBadge(status: string): string {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'production':
    case 'installation':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'inquiry':
    case 'design':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  }
}

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
      const [revisionResult, roomZoneResult, projectsResult] = await Promise.all([
        rpc.rpc('interior_list_design_revisions', { p_project_id: effectiveProjectId }),
        rpc.rpc('interior_list_room_zones', { p_project_id: effectiveProjectId }),
        rpc.rpc('interior_list_projects'),
      ]);

      let finalOverview = overview;
      const allProjects = Array.isArray(projectsResult.data) ? projectsResult.data : [];
      const projectRow = allProjects.find(
        (p) => typeof p === 'object' && p !== null && (p as { id?: string }).id === effectiveProjectId
      ) as Record<string, unknown> | undefined;

      if (projectRow) {
        const pCode = typeof projectRow.code === 'string' ? projectRow.code : 'INT-PROJECT';
        const pName = typeof projectRow.name === 'string' ? projectRow.name : 'Dự án nội thất';
        const pStatus = typeof projectRow.status === 'string' ? projectRow.status : 'in_progress';
        const pCustomer = typeof projectRow.customer_name === 'string' ? projectRow.customer_name : 'Khách hàng';
        const budgetNum = Number(projectRow.estimated_budget) || 0;
        const budgetFormatted = budgetNum >= 1_000_000_000
          ? `${(budgetNum / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`
          : budgetNum >= 1_000_000
          ? `${(budgetNum / 1_000_000).toFixed(0)} triệu`
          : `${budgetNum.toLocaleString('vi-VN')} đ`;

        finalOverview = {
          ...overview,
          project: {
            id: effectiveProjectId,
            code: pCode,
            name: pName,
            breadcrumbLabel: `Dự án > ${pName} (${pCode})`,
            status: pStatus,
            statusLabel: formatStatusLabel(pStatus),
            statusBadgeClass: formatStatusBadge(pStatus),
            clientName: pCustomer,
            contractValueFormatted: budgetFormatted,
          },
        };
      }

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
          overview: finalOverview,
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
