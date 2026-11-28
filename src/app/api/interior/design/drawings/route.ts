import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  asset_type: string;
  title: string;
  file_url: string;
  notes: string | null;
  created_at: string;
}

interface RevRow {
  id: string;
  version_number: number;
  title: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  submitted_by: string;
  is_active_revision: boolean;
  assets: AssetRow[];
}

function toRevisionRows(value: unknown, tenantId: string, projectId: string): RevRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isInteriorRbacRecord).flatMap((revision): RevRow[] => {
    if (typeof revision.id !== 'string' || typeof revision.versionNumber !== 'number'
      || typeof revision.title !== 'string' || typeof revision.status !== 'string'
      || revision.tenantId !== tenantId || revision.projectId !== projectId) return [];
    const assets = Array.isArray(revision.assets)
      ? revision.assets.filter(isInteriorRbacRecord).flatMap((asset): AssetRow[] => {
          if (asset.tenantId !== revision.tenantId || asset.revisionId !== revision.id
            || typeof asset.id !== 'string' || typeof asset.type !== 'string'
            || typeof asset.title !== 'string' || typeof asset.fileUrl !== 'string') return [];
          return [{
            id: asset.id,
            asset_type: asset.type,
            title: asset.title,
            file_url: asset.fileUrl,
            notes: typeof asset.notes === 'string' ? asset.notes : null,
            created_at: typeof asset.createdAt === 'string' ? asset.createdAt : '',
          }];
        })
      : [];
    return [{
      id: revision.id,
      version_number: revision.versionNumber,
      title: revision.title,
      status: revision.status,
      approved_by: typeof revision.approvedBy === 'string' ? revision.approvedBy : null,
      approved_at: typeof revision.approvedAt === 'string' ? revision.approvedAt : null,
      submitted_by: typeof revision.submittedBy === 'string' ? revision.submittedBy : '',
      is_active_revision: revision.isActiveRevision === true,
      assets,
    }];
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return ''; }
}

function fileTypeFromUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  const filename = path.split('/').pop() ?? '';
  const extension = filename.match(/\.([a-z0-9]{1,10})$/)?.[1];
  return extension ? extension.toUpperCase() : 'Tệp';
}

function assetTypeToTab(assetType: string, fileUrl: string): 'visuals' | 'technicalDrawings' | 'relatedDocuments' | null {
  const normalizedType = assetType.toLowerCase();
  if (['technical_2d', 'cad_dwg', 'pdf_drawing', 'technical_drawing', '2d_cad', 'technical', 'cad', 'dwg', 'dxf'].includes(normalizedType)) {
    return 'technicalDrawings';
  }
  const extension = fileTypeFromUrl(fileUrl).toLowerCase();
  if (['dwg', 'dxf'].includes(extension)) return 'technicalDrawings';
  if (['document', 'pdf'].includes(normalizedType)) return 'relatedDocuments';
  if (['concept_3d', 'moodboard', '3d_render', 'perspective', 'render'].includes(normalizedType)) return 'visuals';
  return null;
}

function displayActorName(value: string | null | undefined): string {
  if (!value || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return 'Chưa ghi nhận';
  }
  return value;
}

// ─── GET /api/interior/design/drawings ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId') || request.nextUrl.searchParams.get('project_id');
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);

  if (!projectResult.ok) {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
  }

  const effectiveProjectId = projectResult.projectId;

  try {
    const revResult = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_design_revisions', {
      p_project_id: effectiveProjectId,
    });

    if (revResult.error || !Array.isArray(revResult.data)) {
      return NextResponse.json({ success: false, error: 'DB_READ_ERROR' }, { status: 500 });
    }

    const revRows = toRevisionRows(revResult.data, ctx.tenantId, effectiveProjectId).sort((a, b) => b.version_number - a.version_number);
    const latestApprovedRevision = revRows.find((r) => r.status === 'approved') ?? null;
    const activeApprovedRevision = revRows.find((revision) => revision.is_active_revision && revision.status === 'approved') ?? null;
    const latestRev = activeApprovedRevision ?? latestApprovedRevision ?? revRows[0] ?? null;

    if (!latestRev) {
      return NextResponse.json({
        success: true,
        visuals: [],
        technicalDrawings: [],
        relatedDocuments: [],
        revisionId: null,
        revisionVersion: null,
        revisionStatus: null,
        revisionTitle: null,
        approvedBy: null,
        approvedAt: null,
      });
    }

    const rows = latestRev.assets;

    const visuals: unknown[] = [];
    const technicalDrawings: unknown[] = [];
    const relatedDocuments: unknown[] = [];

    rows.forEach((row, idx) => {
      if (!row.file_url.trim()) return;
      const tab = assetTypeToTab(row.asset_type, row.file_url);
      if (!tab) return;
      const dateFormatted = formatDate(row.created_at);
      const authorName = latestRev.status === 'approved'
        ? displayActorName(latestRev.approved_by)
        : displayActorName(latestRev.submitted_by);

      if (tab === 'visuals') {
        visuals.push({
          id: row.id,
          title: row.title,
          roomZone: row.notes ?? '',
          category: row.asset_type.toLowerCase() === 'moodboard' ? 'document' : '3d',
          categoryLabel: row.asset_type.toLowerCase() === 'moodboard' ? 'Moodboard' : 'Phối cảnh 3D',
          imageUrl: row.file_url,
          thumbnailUrl: row.file_url,
          isPrimary: false,
          viewAngleName: row.title,
          fileFormat: fileTypeFromUrl(row.file_url),
          updatedDateFormatted: dateFormatted,
          authorName,
        });
      } else if (tab === 'technicalDrawings') {
        const fType = fileTypeFromUrl(row.file_url);
        // Extract drawing code from notes or title
        const drawingCode = row.notes?.match(/^REV\s*\d+\s*-\s*\S+/i)?.[0] ?? '';
        technicalDrawings.push({
          id: row.id,
          revisionId: latestRev.id,
          approvedBy: latestRev.status === 'approved' ? displayActorName(latestRev.approved_by) : undefined,
          title: row.title,
          drawingCode,
          fileType: fType,
          author: authorName,
          updatedDateFormatted: dateFormatted,
          statusLabel: latestRev.status === 'approved'
            ? 'Đã duyệt'
            : latestRev.status === 'rejected'
            ? 'Từ chối'
            : latestRev.status === 'superseded'
            ? 'Đã thay thế'
            : ['draft', 'in_review', 'client_review'].includes(latestRev.status)
            ? 'Chờ duyệt'
            : 'Chưa xác định',
          statusBadgeClass: latestRev.status === 'approved'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : latestRev.status === 'rejected'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : latestRev.status === 'superseded'
            ? 'bg-slate-50 text-slate-600 border-slate-200'
            : ['draft', 'in_review', 'client_review'].includes(latestRev.status)
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-slate-50 text-slate-600 border-slate-200',
          fileUrl: row.file_url,
          fileSize: '',
          hasFile: row.file_url.trim().length > 0,
          downloadUrl: row.file_url,
          sheetNumber: '',
          scale: '',
        });
      } else {
        const fType = fileTypeFromUrl(row.file_url);
        relatedDocuments.push({
          id: row.id,
          title: row.title,
          documentCategory: row.notes ?? 'Tài liệu',
          fileType: fType,
          author: authorName,
          updatedDateFormatted: dateFormatted,
          fileSize: '',
          fileUrl: row.file_url,
          hasFile: Boolean(row.file_url),
          downloadUrl: row.file_url,
        });
      }
    });

    return NextResponse.json({
      success: true,
      visuals,
      technicalDrawings,
      relatedDocuments,
      revisionId: latestRev.id,
      revisionVersion: latestRev.version_number,
      revisionStatus: latestRev.status,
      revisionTitle: latestRev.title,
      revisionIsActive: activeApprovedRevision?.id === latestRev.id,
      approvedBy: latestRev.status === 'approved' ? displayActorName(latestRev.approved_by) : null,
      approvedAt: latestRev.status === 'approved' && latestRev.approved_at ? formatDate(latestRev.approved_at) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
