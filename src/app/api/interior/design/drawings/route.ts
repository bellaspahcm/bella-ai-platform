import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';

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

interface DynamicQuery {
  eq: (col: string, val: unknown) => DynamicQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DynamicQuery;
  then: <T>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => T | PromiseLike<T>) | null
  ) => Promise<T>;
}

interface DynamicTable {
  select: (cols: string) => DynamicQuery;
  insert: (row: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: unknown; error: unknown }> } };
}

function getDynamicTable(supabase: unknown, table: string): DynamicTable {
  return (supabase as { from: (t: string) => DynamicTable }).from(table);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return ''; }
}

function fileTypeFromUrl(url: string): 'DWG' | 'PDF' | 'DXF' | 'IMG' {
  const ext = url.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'dwg') return 'DWG';
  if (ext === 'dxf') return 'DXF';
  if (ext === 'pdf') return 'PDF';
  return 'IMG';
}

function assetTypeToTab(assetType: string): 'visuals' | 'technicalDrawings' | 'relatedDocuments' {
  if (assetType === 'technical_drawing' || assetType === 'dwg' || assetType === 'dxf') return 'technicalDrawings';
  if (assetType === 'document' || assetType === 'pdf') return 'relatedDocuments';
  return 'visuals'; // 3d_render, perspective, etc.
}

// ─── GET /api/interior/design/drawings ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);

  if (!projectResult.ok) {
    return NextResponse.json({ success: true, visuals: [], technicalDrawings: [], relatedDocuments: [] });
  }

  const effectiveProjectId = projectResult.projectId;

  try {
    // Find latest revision for this project
    type RevRow = { id: string; version_number: number; status: string; approved_by: string | null; approved_at: string | null; submitted_by: string };
    const revTable = getDynamicTable(ctx.supabase, 'interior_design_revisions');
    const revResult = await revTable
      .select('id, version_number, status, approved_by, approved_at, submitted_by')
      .eq('tenant_id', ctx.tenantId)
      .eq('project_id', effectiveProjectId)
      .order('version_number', { ascending: false })
      .then((r: { data: unknown; error: unknown }) => r);

    const revRows = (Array.isArray(revResult.data) ? revResult.data : []) as RevRow[];
    const latestRev = revRows.find((r) => r.status === 'approved') ?? revRows[0] ?? null;

    if (!latestRev) {
      return NextResponse.json({ success: true, visuals: [], technicalDrawings: [], relatedDocuments: [], revisionId: null });
    }

    // Fetch all assets for this revision
    const assetTable = getDynamicTable(ctx.supabase, 'interior_design_assets');
    const assetResult = await assetTable
      .select('id, asset_type, title, file_url, notes, created_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('revision_id', latestRev.id)
      .order('created_at', { ascending: true })
      .then((r: { data: unknown; error: unknown }) => r);

    if (assetResult.error) {
      return NextResponse.json({ success: false, error: 'DB_READ_ERROR' }, { status: 500 });
    }

    const rows = (Array.isArray(assetResult.data) ? assetResult.data : []) as AssetRow[];

    const visuals: unknown[] = [];
    const technicalDrawings: unknown[] = [];
    const relatedDocuments: unknown[] = [];

    rows.forEach((row, idx) => {
      const tab = assetTypeToTab(row.asset_type);
      const dateFormatted = formatDate(row.created_at);
      const authorName = latestRev.approved_by ?? latestRev.submitted_by;

      if (tab === 'visuals') {
        visuals.push({
          id: row.id,
          title: row.title,
          roomZone: row.notes ?? '',
          category: '3d',
          categoryLabel: 'Phối cảnh 3D',
          imageUrl: row.file_url,
          thumbnailUrl: row.file_url,
          isPrimary: idx === 0,
          viewAngleName: row.notes ?? row.title,
          resolution: '4K Ultra-HD',
          fileFormat: 'Render',
          updatedDateFormatted: dateFormatted,
          authorName,
        });
      } else if (tab === 'technicalDrawings') {
        const fType = fileTypeFromUrl(row.file_url);
        // Extract drawing code from notes or title
        const drawingCode = row.notes?.match(/^REV\s*\d+\s*-\s*\S+/i)?.[0] ?? row.title.slice(0, 20);
        technicalDrawings.push({
          id: row.id,
          title: row.title,
          drawingCode,
          fileType: fType,
          author: authorName,
          updatedDateFormatted: dateFormatted,
          statusLabel: latestRev.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
          statusBadgeClass:
            latestRev.status === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
          fileUrl: row.file_url,
          fileSize: '',
          hasFile: true,
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
          hasFile: true,
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
      approvedBy: latestRev.approved_by,
      approvedAt: latestRev.approved_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
