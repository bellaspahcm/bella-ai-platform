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

interface GenericDynamicTable {
  select: (cols?: string) => GenericDynamicQuery;
  insert: (values: Record<string, unknown>) => GenericDynamicInsertQuery;
}

interface GenericDynamicQuery {
  eq: (col: string, val: unknown) => GenericDynamicQuery;
  order: (col: string, opts?: { ascending?: boolean }) => GenericDynamicQuery;
  limit: (count: number) => GenericDynamicQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
}

interface GenericDynamicInsertQuery {
  select: (cols?: string) => {
    single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  };
  then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
}

function getDynamicTable(supabase: unknown, tableName: string): GenericDynamicTable {
  return (supabase as { from: (table: string) => GenericDynamicTable }).from(tableName);
}

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
        ? (revisionResult.data as Array<Record<string, unknown>>)
        : [];
      const roomZones = Array.isArray(roomZoneResult.data)
        ? roomZoneResult.data.filter(isInteriorRbacRecord)
        : [];

      // ─── Extract real assets & material specs from Supabase revisions ───
      const rawAssets: Array<Record<string, unknown>> = [];
      const rawMaterials: Array<Record<string, unknown>> = [];

      for (const rev of revisions) {
        if (Array.isArray(rev.assets)) {
          for (const a of rev.assets) {
            if (typeof a === 'object' && a !== null) {
              rawAssets.push({
                ...a,
                revisionStatus: rev.status,
                revisionTitle: rev.title,
                submittedBy: rev.submittedBy,
              });
            }
          }
        }
        if (Array.isArray(rev.materialSpecs)) {
          for (const m of rev.materialSpecs) {
            if (typeof m === 'object' && m !== null) {
              rawMaterials.push(m as Record<string, unknown>);
            }
          }
        }
      }

      // If database has technical drawings or assets, map them directly into finalOverview
      if (rawAssets.length > 0) {
        const dbTechnicalDrawings = rawAssets
          .filter(
            (a) =>
              a.type === '2d_cad' ||
              a.type === 'technical' ||
              a.type === 'cad' ||
              String(a.fileUrl || '').endsWith('.dwg') ||
              String(a.fileUrl || '').endsWith('.dxf')
          )
          .map((a, idx) => {
            let parsedNotes: Record<string, string> = {};
            try {
              if (typeof a.notes === 'string' && a.notes.startsWith('{')) {
                parsedNotes = JSON.parse(a.notes);
              }
            } catch {
              parsedNotes = {};
            }
            const isApproved = a.revisionStatus === 'approved';
            const fileUrl = String(a.fileUrl || '');
            const ext = fileUrl.split('.').pop()?.toUpperCase() || 'DWG';
            return {
              id: String(a.id || `dwg-${idx}`),
              title: String(a.title || 'Bản vẽ kỹ thuật'),
              drawingCode:
                parsedNotes.code ||
                (typeof a.notes === 'string' && !a.notes.startsWith('{')
                  ? a.notes
                  : `REV 1 - DWG-0${idx + 1}`),
              fileType: ext === 'DXF' || ext === 'PDF' ? ext : 'DWG',
              author: parsedNotes.author || String(a.submittedBy || 'KTS. Bella Interior'),
              updatedDateFormatted: '06/11/2026',
              statusLabel: isApproved ? 'Đã duyệt' : 'Chờ duyệt',
              statusBadgeClass: isApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
              fileUrl,
              downloadUrl: fileUrl,
              fileSize: parsedNotes.fileSize || '14.8 MB',
              hasFile: Boolean(fileUrl),
              scale: parsedNotes.scale || '1:100',
              sheetNumber: parsedNotes.sheet || `KT-0${idx + 1}/18`,
            };
          });

        const dbDocuments = rawAssets
          .filter((a) => a.type === 'document' || String(a.fileUrl || '').endsWith('.pdf'))
          .map((a, idx) => {
            let parsedNotes: Record<string, string> = {};
            try {
              if (typeof a.notes === 'string' && a.notes.startsWith('{')) {
                parsedNotes = JSON.parse(a.notes);
              }
            } catch {
              parsedNotes = {};
            }
            const fileUrl = String(a.fileUrl || '');
            return {
              id: String(a.id || `doc-${idx}`),
              title: String(a.title || 'Hồ sơ tài liệu'),
              documentCategory: 'Chỉ dẫn kỹ thuật',
              fileType: 'PDF',
              author: parsedNotes.author || String(a.submittedBy || 'Phòng Kỹ Thuật Bella'),
              updatedDateFormatted: '06/11/2026',
              fileSize: parsedNotes.fileSize || '8.2 MB',
              fileUrl,
              downloadUrl: fileUrl,
              hasFile: Boolean(fileUrl),
            };
          });

        if (dbTechnicalDrawings.length > 0) {
          finalOverview = {
            ...finalOverview,
            technicalDrawings: dbTechnicalDrawings,
          };
        }
        if (dbDocuments.length > 0) {
          finalOverview = {
            ...finalOverview,
            relatedDocuments: dbDocuments,
          };
        }
      }

      // If database has material specs, map them directly into finalOverview
      if (rawMaterials.length > 0) {
        const MATERIAL_THUMBNAILS: Record<string, string> = {
          'Veneer Óc Chó Bắc Mỹ':
            'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
          'Đá Thạch Anh Nhân Tạo':
            'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/accent-wall-detail.jpg',
          'Bản Lề Giảm Chấn Thép':
            'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/wood-panel.jpg',
          'Khung Cánh Kính Slim':
            'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
        };
        const dbMaterials = rawMaterials.map((m, idx) => {
          const name = String(m.name || 'Vật liệu thi công');
          const isApproved = Boolean(m.approvedForUse);
          return {
            id: String(m.id || `mat-${idx}`),
            name,
            code: String(m.code || 'MS-SPEC'),
            brand: String(m.brand || 'Bella Standard'),
            specification: String(m.specDescription || m.spec_description || 'Đạt tiêu chuẩn xuất xưởng'),
            usageArea: String(m.itemCategory || m.item_category || 'Nội thất chung'),
            status: isApproved ? ('approved' as const) : ('reference' as const),
            statusLabel: isApproved ? 'Đã duyệt' : 'Tham khảo',
            statusBadgeClass: isApproved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-blue-50 text-blue-700 border-blue-200',
            thumbnailImage:
              MATERIAL_THUMBNAILS[name] ||
              'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
          };
        });

        finalOverview = {
          ...finalOverview,
          materials: dbMaterials,
        };
      }

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
      const rawInput = (payload.drawing && typeof payload.drawing === 'object' ? payload.drawing : payload) as Record<string, unknown>;
      const drawingInput: CreateTechnicalDrawingInput = {
        title: String(rawInput.title || ''),
        fileUrl: String(rawInput.fileUrl || ''),
        drawingCode: String(rawInput.drawingCode || 'REV 1 - ARCH'),
        fileType: String(rawInput.fileType || 'DWG'),
        author: String(rawInput.author || 'KTS. Bella Interior'),
        fileSize: typeof rawInput.fileSize === 'string' ? rawInput.fileSize : undefined,
        statusLabel: typeof rawInput.statusLabel === 'string' ? rawInput.statusLabel : undefined,
      };
      if (!drawingInput.title.trim() || !drawingInput.fileUrl.trim()) {
        return NextResponse.json({ success: false, error: 'Invalid technical drawing input' }, { status: 422 });
      }
      const item = InteriorDesignAnalyticsService.addTechnicalDrawing(ctx.tenantId, drawingInput);

      // Persist to Supabase database if projectId provided
      const projectId = typeof payload.projectId === 'string' ? payload.projectId : undefined;
      if (projectId) {
        try {
          const revTable = getDynamicTable(ctx.supabase, 'interior_design_revisions');
          const { data: revData } = await revTable
            .select('id')
            .eq('tenant_id', ctx.tenantId)
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          let revisionId = typeof revData?.id === 'string' ? revData.id : undefined;
          if (!revisionId) {
            const { data: newRev } = await revTable
              .insert({
                tenant_id: ctx.tenantId,
                project_id: projectId,
                version_number: 1,
                title: 'Hồ sơ thiết kế kỹ thuật R1.0',
                status: 'approved',
                submitted_by: drawingInput.author,
              })
              .select('id')
              .single();
            revisionId = typeof newRev?.id === 'string' ? newRev.id : undefined;
          }

          if (revisionId) {
            const assetTable = getDynamicTable(ctx.supabase, 'interior_design_assets');
            await assetTable
              .insert({
                tenant_id: ctx.tenantId,
                revision_id: revisionId,
                asset_type: '2d_cad',
                title: drawingInput.title,
                file_url: drawingInput.fileUrl,
                notes: JSON.stringify({
                  code: drawingInput.drawingCode,
                  author: drawingInput.author,
                  fileSize: drawingInput.fileSize || '14.5 MB',
                  scale: '1:100',
                  sheet: 'KT-NEW',
                }),
              });
          }
        } catch {
          // Non-blocking for local fallback
        }
      }

      return NextResponse.json({
        success: true,
        data: item,
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'add_document') {
      const rawDoc = (payload.document && typeof payload.document === 'object' ? payload.document : payload) as Record<string, unknown>;
      const docInput: CreateDesignDocumentInput = {
        title: String(rawDoc.title || ''),
        fileUrl: String(rawDoc.fileUrl || ''),
        documentCategory: String(rawDoc.documentCategory || 'Chỉ dẫn kỹ thuật'),
        fileType: String(rawDoc.fileType || 'PDF'),
        author: String(rawDoc.author || 'Phòng Kỹ Thuật Bella'),
        fileSize: typeof rawDoc.fileSize === 'string' ? rawDoc.fileSize : undefined,
      };
      if (!docInput.title.trim() || !docInput.fileUrl.trim()) {
        return NextResponse.json({ success: false, error: 'Invalid document input' }, { status: 422 });
      }
      const item = InteriorDesignAnalyticsService.addDesignDocument(ctx.tenantId, docInput);

      // Persist to Supabase database if projectId provided
      const projectId = typeof payload.projectId === 'string' ? payload.projectId : undefined;
      if (projectId) {
        try {
          const revTable = getDynamicTable(ctx.supabase, 'interior_design_revisions');
          const { data: revData } = await revTable
            .select('id')
            .eq('tenant_id', ctx.tenantId)
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          let revisionId = typeof revData?.id === 'string' ? revData.id : undefined;
          if (!revisionId) {
            const { data: newRev } = await revTable
              .insert({
                tenant_id: ctx.tenantId,
                project_id: projectId,
                version_number: 1,
                title: 'Hồ sơ thiết kế kỹ thuật R1.0',
                status: 'approved',
                submitted_by: docInput.author,
              })
              .select('id')
              .single();
            revisionId = typeof newRev?.id === 'string' ? newRev.id : undefined;
          }

          if (revisionId) {
            const assetTable = getDynamicTable(ctx.supabase, 'interior_design_assets');
            await assetTable
              .insert({
                tenant_id: ctx.tenantId,
                revision_id: revisionId,
                asset_type: 'document',
                title: docInput.title,
                file_url: docInput.fileUrl,
                notes: JSON.stringify({
                  author: docInput.author,
                  fileSize: docInput.fileSize || '5.0 MB',
                  category: docInput.documentCategory,
                }),
              });
          }
        } catch {
          // Non-blocking
        }
      }

      return NextResponse.json({
        success: true,
        data: item,
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
