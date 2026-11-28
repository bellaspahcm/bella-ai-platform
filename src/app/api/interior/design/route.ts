import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';
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
  update: (values: Record<string, unknown>) => GenericDynamicQuery;
}

interface GenericDynamicQuery {
  eq: (col: string, val: unknown) => GenericDynamicQuery;
  order: (col: string, opts?: { ascending?: boolean }) => GenericDynamicQuery;
  limit: (count: number) => GenericDynamicQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
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

function getFileExtension(fileUrl: string): string {
  const path = fileUrl.split(/[?#]/, 1)[0] ?? '';
  const filename = path.split('/').pop() ?? '';
  return filename.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? '';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const projectIdParam = request.nextUrl.searchParams.get('projectId') || request.nextUrl.searchParams.get('project_id');

  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
  if (!projectResult.ok && projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION') {
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      availableProjects: projectResult.availableProjects,
    }, { status: 400 });
  }
  if (!projectResult.ok) {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
  }

  const effectiveProjectId = projectResult.projectId;

  try {
    const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(ctx.tenantId, effectiveProjectId);

    if (effectiveProjectId) {
      const rpc = interiorRbacRpcClient(ctx.supabase);
      const [revisionResult, roomZoneResult, projectsResult] = await Promise.all([
        rpc.rpc('interior_list_design_revisions', { p_project_id: effectiveProjectId }),
        rpc.rpc('interior_list_room_zones', { p_project_id: effectiveProjectId }),
        rpc.rpc('interior_list_projects'),
      ]);
      if (revisionResult.error || !Array.isArray(revisionResult.data) || roomZoneResult.error || projectsResult.error) {
        return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_READ_FAILED' }, { status: 503 });
      }

      let finalOverview = {
        ...overview,
        visuals: [],
        technicalDrawings: [],
        relatedDocuments: [],
      };
      const allProjects = Array.isArray(projectsResult.data) ? projectsResult.data : [];
      const projectRow = allProjects.find(
        (p) => typeof p === 'object' && p !== null && (p as { id?: string }).id === effectiveProjectId
      ) as Record<string, unknown> | undefined;

      if (!projectRow) {
        return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
      }

      if (projectRow) {
        const pCode = typeof projectRow.code === 'string' ? projectRow.code : 'INT-PROJECT';
        const pName = typeof projectRow.name === 'string' ? projectRow.name : 'Dự án nội thất';
        const pStatus = typeof projectRow.status === 'string' ? projectRow.status : 'in_progress';
        const rawCustomerName = projectRow.customerName ?? projectRow.customer_name;
        const rawBudget = projectRow.estimatedBudget ?? projectRow.estimated_budget;
        const pCustomer = typeof rawCustomerName === 'string' ? rawCustomerName : 'Khách hàng';
        const budgetNum = Number(rawBudget) || 0;
        const budgetFormatted = budgetNum >= 1_000_000_000
          ? `${(budgetNum / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`
          : budgetNum >= 1_000_000
          ? `${(budgetNum / 1_000_000).toFixed(0)} triệu`
          : `${budgetNum.toLocaleString('vi-VN')} đ`;

        finalOverview = {
          ...finalOverview,
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
      const sortedRevisions = [...revisions].sort((a, b) => {
        const versionA = Number(a.versionNumber ?? a.version_number ?? 0);
        const versionB = Number(b.versionNumber ?? b.version_number ?? 0);
        return versionB - versionA;
      });
      const roomZones = Array.isArray(roomZoneResult.data)
        ? roomZoneResult.data.filter(isInteriorRbacRecord)
        : [];
      const latestApprovedRevision = sortedRevisions.find((revision) => revision.status === 'approved') ?? null;
      const activeApprovedRevision = sortedRevisions.find(
        (revision) => revision.status === 'approved' && revision.isActiveRevision === true
      ) ?? null;
      const displayedRevision = sortedRevisions[0] ?? null;

      // ─── Synchronize version lock from latest revision or robust default ───
      if (displayedRevision) {
        const latestRev = displayedRevision;
        const vNum = Number(latestRev.versionNumber ?? latestRev.version_number ?? 1);
        const revStatusRaw = String(latestRev.status ?? '').toLowerCase();
        const status: 'draft' | 'review' | 'approved' | 'rejected' | 'superseded' | 'unknown' =
          revStatusRaw === 'approved' ? 'approved' :
          revStatusRaw === 'rejected' ? 'rejected' :
          revStatusRaw === 'draft' ? 'draft' :
          revStatusRaw === 'superseded' ? 'superseded' :
          ['review', 'in_review', 'client_review'].includes(revStatusRaw) ? 'review' : 'unknown';
        const isApproved = status === 'approved';
        const rawDate = isApproved ? latestRev.approvedAt ?? latestRev.approved_at : null;
        let approvalDateFormatted = '—';
        if (typeof rawDate === 'string' && rawDate.length > 0) {
          try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              approvalDateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }
          } catch {
              // Keep the explicit empty date when stored metadata is invalid.
          }
        }
        const isUuid = (val: unknown): boolean =>
          typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        let approver = 'Chưa ghi nhận';
        const rawApprovedBy = latestRev.approvedBy ?? latestRev.approved_by;

        if (rawApprovedBy && typeof rawApprovedBy === 'string' && !isUuid(rawApprovedBy)) {
          approver = rawApprovedBy;
        }
        const desc = String(
          latestRev.changeSummary ??
          latestRev.change_summary ??
          latestRev.title ??
          'Chưa có mô tả'
        );

        finalOverview = {
          ...finalOverview,
          versionLock: {
            versionId: String(latestRev.id ?? ''),
            versionNumber: `R${vNum}.0`,
            status,
            statusLabel: isApproved
              ? 'Đã duyệt'
              : status === 'rejected'
              ? 'Từ chối'
              : status === 'superseded'
              ? 'Đã thay thế'
              : status === 'unknown'
              ? 'Chưa xác định'
              : status === 'draft'
              ? 'Bản nháp'
              : 'Chờ duyệt',
            statusBadgeClass: isApproved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status === 'rejected'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : status === 'superseded'
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : status === 'unknown'
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
            isLocked: isApproved,
            lockLabel: isApproved ? 'Đã khóa' : status === 'superseded' ? 'Đã thay thế' : status === 'unknown' ? 'Chưa xác định' : 'Chưa khóa',
            lockBadgeClass: isApproved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status === 'superseded'
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : status === 'unknown'
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
            approvalDateFormatted,
            approvedBy: approver,
            description: desc,
            lockBannerTitle: isApproved ? 'Approved Design Lock' : status === 'superseded' ? 'Revision đã thay thế' : status === 'unknown' ? 'Trạng thái revision' : 'Thiết kế đang cập nhật',
            lockBannerSubtitle: isApproved
              ? activeApprovedRevision?.id === latestRev.id
                ? 'Đã duyệt và đang là revision kích hoạt của dự án.'
                : 'Đã duyệt nhưng chưa được đặt làm revision kích hoạt của dự án.'
              : status === 'rejected'
              ? 'Revision này đã bị từ chối.'
              : status === 'superseded'
              ? 'Revision này đã được thay thế bởi revision khác.'
              : status === 'unknown'
              ? 'Trạng thái revision chưa được nhận diện; không thể phê duyệt từ màn hình này.'
              : 'Revision mới nhất chưa được phê duyệt.',
            canUnlock: false,
          },
        };
      } else {
        finalOverview = {
          ...finalOverview,
          versionLock: {
            ...finalOverview.versionLock,
            versionId: '',
            versionNumber: '—',
            status: 'draft',
            statusLabel: 'Chưa có revision',
            statusBadgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
            isLocked: false,
            lockLabel: 'Chưa khóa',
            lockBadgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
            approvalDateFormatted: '—',
            approvedBy: 'Chưa ghi nhận',
            description: 'Chưa có revision thiết kế được lưu.',
            lockBannerTitle: 'Trạng thái revision',
            lockBannerSubtitle: 'Chưa có revision đã lưu cho dự án này.',
            canUnlock: false,
          },
        };
      }

      // ─── Extract real assets & material specs from Supabase revisions ───
      const rawAssets: Array<Record<string, unknown>> = [];
      const rawMaterials: Array<Record<string, unknown>> = [];
      const drawingRevision = activeApprovedRevision ?? latestApprovedRevision ?? sortedRevisions[0] ?? null;

      for (const rev of revisions) {
        if (rev === drawingRevision && Array.isArray(rev.assets)) {
          for (const a of rev.assets) {
            if (typeof a === 'object' && a !== null) {
              rawAssets.push({
                ...a,
                revisionStatus: rev.status,
                revisionTitle: rev.title,
                submittedBy: rev.submittedBy,
                revisionApprovedBy: rev.approvedBy ?? rev.approved_by,
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
        const technicalDrawingTypes = new Set<string>([
          'technical_2d',
          'cad_dwg',
          'pdf_drawing',
          'technical_drawing',
          '2d_cad',
          'technical',
          'cad',
          'dwg',
          'dxf',
        ]);
        const visualAssetTypes = new Set<string>(['concept_3d', 'moodboard', '3d_render', 'perspective', 'render']);
        const dbVisuals = rawAssets
          .filter((asset) =>
            visualAssetTypes.has(String(asset.type ?? asset.assetType ?? asset.asset_type ?? '').toLowerCase()) &&
            String(asset.fileUrl ?? asset.file_url ?? '').trim().length > 0
          )
          .map((asset, index) => {
            const assetType = String(asset.type ?? asset.assetType ?? asset.asset_type ?? '').toLowerCase();
            const fileUrl = String(asset.fileUrl ?? asset.file_url ?? '');
            const extension = getFileExtension(fileUrl);
            const rawAuthor = asset.submittedBy ?? asset.submitted_by;
            const authorName = typeof rawAuthor === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAuthor)
              ? rawAuthor
              : 'Chưa ghi nhận';
            return {
              id: String(asset.id ?? `visual-${index}`),
              title: String(asset.title ?? 'Phối cảnh thiết kế'),
              roomZone: '',
              category: assetType === 'moodboard' ? 'document' as const : '3d' as const,
              categoryLabel: assetType === 'moodboard' ? 'Moodboard' : 'Phối cảnh 3D',
              imageUrl: fileUrl,
              thumbnailUrl: fileUrl,
              isPrimary: false,
              viewAngleName: String(asset.title ?? 'Phối cảnh thiết kế'),
              fileFormat: extension ? extension.toUpperCase() : 'Tệp',
              updatedDateFormatted: '—',
              authorName,
            };
          });
        const dbTechnicalDrawings = rawAssets
          .filter((asset) => {
            const assetType = String(asset.type ?? asset.assetType ?? asset.asset_type ?? '').toLowerCase();
            const fileUrl = String(asset.fileUrl ?? asset.file_url ?? '');
            const extension = getFileExtension(fileUrl);
            return (technicalDrawingTypes.has(assetType) || ['dwg', 'dxf'].includes(extension)) && fileUrl.trim().length > 0;
          })
          .map((a, idx) => {
            let parsedNotes: Record<string, string> = {};
            try {
              if (typeof a.notes === 'string' && a.notes.startsWith('{')) {
                parsedNotes = JSON.parse(a.notes);
              }
            } catch {
              parsedNotes = {};
            }
            const isApproved = drawingRevision?.status === 'approved';
            const fileUrl = String(a.fileUrl ?? a.file_url ?? '');
            const extension = getFileExtension(fileUrl);
            const rawAuthor = parsedNotes.author ?? a.submittedBy ?? a.submitted_by;
            const author = typeof rawAuthor === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAuthor)
              ? rawAuthor
              : 'Chưa ghi nhận';
            const createdAt = a.createdAt ?? a.created_at;
            let updatedDateFormatted = '—';
            if (typeof createdAt === 'string') {
              const createdDate = new Date(createdAt);
              if (!Number.isNaN(createdDate.getTime())) {
                updatedDateFormatted = `${String(createdDate.getDate()).padStart(2, '0')}/${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}`;
              }
            }
            return {
              id: String(a.id || `dwg-${idx}`),
              revisionId: typeof a.revisionId === 'string' ? a.revisionId : typeof a.revision_id === 'string' ? a.revision_id : undefined,
              approvedBy: isApproved
                ? typeof a.revisionApprovedBy === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.revisionApprovedBy)
                  ? a.revisionApprovedBy
                  : 'Chưa ghi nhận'
                : undefined,
              title: String(a.title || 'Bản vẽ kỹ thuật'),
              drawingCode:
                (typeof parsedNotes.code === 'string' ? parsedNotes.code : '') ||
                (typeof a.notes === 'string' && !a.notes.startsWith('{')
                  ? a.notes
                  : ''),
              fileType: ['dwg', 'dxf', 'pdf'].includes(extension) ? extension.toUpperCase() : 'Tệp',
              author,
              updatedDateFormatted,
              statusLabel: isApproved ? 'Đã duyệt' : drawingRevision?.status === 'rejected' ? 'Từ chối' : drawingRevision?.status === 'superseded' ? 'Đã thay thế' : ['draft', 'in_review', 'client_review'].includes(String(drawingRevision?.status ?? '')) ? 'Chờ duyệt' : 'Chưa xác định',
              statusBadgeClass: isApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : drawingRevision?.status === 'rejected'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : drawingRevision?.status === 'superseded'
                ? 'bg-slate-50 text-slate-600 border-slate-200'
                : ['draft', 'in_review', 'client_review'].includes(String(drawingRevision?.status ?? ''))
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-600 border-slate-200',
              fileUrl,
              downloadUrl: fileUrl,
              fileSize: typeof parsedNotes.fileSize === 'string' ? parsedNotes.fileSize : '',
              hasFile: fileUrl.trim().length > 0,
              scale: typeof parsedNotes.scale === 'string' ? parsedNotes.scale : '',
              sheetNumber: typeof parsedNotes.sheet === 'string' ? parsedNotes.sheet : '',
            };
          });

        const dbDocuments = rawAssets
          .filter((asset) => {
            const assetType = String(asset.type ?? asset.assetType ?? asset.asset_type ?? '').toLowerCase();
            const fileUrl = String(asset.fileUrl ?? asset.file_url ?? '');
            const extension = getFileExtension(fileUrl);
            return (assetType === 'document' || assetType === 'pdf' || (extension === 'pdf' && !technicalDrawingTypes.has(assetType))) && fileUrl.trim().length > 0;
          })
          .map((a, idx) => {
            let parsedNotes: Record<string, string> = {};
            try {
              if (typeof a.notes === 'string' && a.notes.startsWith('{')) {
                parsedNotes = JSON.parse(a.notes);
              }
            } catch {
              parsedNotes = {};
            }
            const fileUrl = String(a.fileUrl ?? a.file_url ?? '');
            const rawAuthor = parsedNotes.author ?? a.submittedBy ?? a.submitted_by;
            const author = typeof rawAuthor === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAuthor)
              ? rawAuthor
              : 'Chưa ghi nhận';
            const extension = getFileExtension(fileUrl);
            return {
              id: String(a.id || `doc-${idx}`),
              title: String(a.title || 'Hồ sơ tài liệu'),
              documentCategory: typeof a.notes === 'string' && !a.notes.startsWith('{') ? a.notes : 'Tài liệu',
              fileType: extension ? extension.toUpperCase() : 'Tệp',
              author,
              updatedDateFormatted: '—',
              fileSize: typeof parsedNotes.fileSize === 'string' ? parsedNotes.fileSize : '',
              fileUrl,
              downloadUrl: fileUrl,
              hasFile: fileUrl.trim().length > 0,
            };
          });

        finalOverview = {
          ...finalOverview,
          visuals: dbVisuals,
          technicalDrawings: dbTechnicalDrawings,
          relatedDocuments: dbDocuments,
        };
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
      const versionId = typeof payload.versionId === 'string' ? payload.versionId : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
        return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_NOT_FOUND' }, { status: 404 });
      }
      if (payload.targetState !== true) {
        return NextResponse.json({
          success: false,
          error: 'APPROVED_REVISION_IMMUTABLE',
          message: 'Revision đã duyệt không thể mở khóa; hãy tạo revision mới để tiếp tục chỉnh sửa.',
        }, { status: 409 });
      }

      const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_approve_design_revision', {
        p_revision_id: versionId,
        p_approval_notes: null,
      });
      if (error) {
        const denied = error.message?.includes('AuthorizationViolation') === true;
        return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_DESIGN_REVISION_APPROVAL_FAILED' }, {
          status: denied ? 403 : 503,
        });
      }
      const outcome = interiorMutationRow(data);
      if (!outcome || outcome.status !== 'COMMITTED' || typeof outcome.approved_at !== 'string') {
        const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'DESIGN_APPROVAL_DENIED';
        const status = reason === 'REVISION_ALREADY_APPROVED' || reason === 'REVISION_STATE_NOT_APPROVABLE' ? 409
          : reason === 'INVALID_APPROVAL_INPUT' ? 422 : 403;
        return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_APPROVAL_DENIED', reason }, { status });
      }

      return NextResponse.json({
        success: true,
        data: {
          versionLock: {
            versionId,
            status: 'approved',
            statusLabel: 'Đã duyệt',
            statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            isLocked: true,
            lockLabel: 'Đã khóa',
            lockBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            approvalDateFormatted: new Date(outcome.approved_at).toLocaleDateString('vi-VN'),
            lockBannerTitle: 'Revision đã duyệt',
            lockBannerSubtitle: 'Revision đã được duyệt và đặt làm revision đang kích hoạt của dự án.',
            canUnlock: false,
          },
        },
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
