import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialSpecRow {
  id: string;
  item_category: string;
  brand: string;
  code: string;
  name: string;
  color_tone: string | null;
  spec_description: string;
  approved_for_use: boolean;
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

// ─── Category mapping ────────────────────────────────────────────────────────

function categoryToFrontend(cat: string): string {
  const map: Record<string, string> = {
    'Gỗ & Bề mặt': 'wood',
    wood: 'wood',
    'Đá & Bề mặt': 'stone',
    stone: 'stone',
    'Kim khí & Phụ kiện': 'hardware',
    hardware: 'hardware',
    'Thiết bị bếp': 'appliances',
    appliances: 'appliances',
    'Chiếu sáng': 'lighting',
    lighting: 'lighting',
    'Sơn & Hoàn thiện': 'finishes',
    finishes: 'finishes',
  };
  return map[cat] ?? 'wood';
}

function statusFromApproved(approved: boolean): {
  status: string;
  statusLabel: string;
  statusBadgeClass: string;
} {
  if (approved) {
    return {
      status: 'locked',
      statusLabel: 'Đã khóa Spec',
      statusBadgeClass:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    };
  }
  return {
    status: 'procuring',
    statusLabel: 'Đang đặt hàng',
    statusBadgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return '';
  }
}

// Default R2 thumbnails by category
const DEFAULT_IMAGES: Record<string, string> = {
  wood: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
  stone: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
  hardware: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
  appliances: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
  lighting: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
  finishes: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
};

// ─── GET /api/interior/materials ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);

  // If no project resolved, return empty list (not an error — no data seeded yet)
  if (!projectResult.ok) {
    return NextResponse.json({ success: true, materials: [], totalCount: 0 });
  }

  const effectiveProjectId = projectResult.projectId;

  try {
    // Find the latest approved design revision for this project
    const revTable = getDynamicTable(ctx.supabase, 'interior_design_revisions');
    const revResult = await revTable
      .select('id, version_number, approved_by, approved_at, status')
      .eq('tenant_id', ctx.tenantId)
      .eq('project_id', effectiveProjectId)
      .order('version_number', { ascending: false })
      .then((r: { data: unknown; error: unknown }) => r);

    const revRows = Array.isArray(revResult.data) ? revResult.data : [];

    // Pick the latest approved revision, fallback to latest any
    type RevRow = { id: string; version_number: number; approved_by: string | null; approved_at: string | null; status: string };
    const approvedRev = (revRows as RevRow[]).find((r) => r.status === 'approved') ??
      (revRows as RevRow[])[0] ?? null;

    if (!approvedRev) {
      return NextResponse.json({ success: true, materials: [], totalCount: 0, revisionId: null });
    }

    // Fetch material specs for this revision
    const matTable = getDynamicTable(ctx.supabase, 'interior_design_material_specs');
    const matResult = await matTable
      .select('id, item_category, brand, code, name, color_tone, spec_description, approved_for_use, created_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('revision_id', approvedRev.id)
      .order('created_at', { ascending: true })
      .then((r: { data: unknown; error: unknown }) => r);

    if (matResult.error) {
      return NextResponse.json({ success: false, error: 'DB_READ_ERROR' }, { status: 500 });
    }

    const rows = (Array.isArray(matResult.data) ? matResult.data : []) as MaterialSpecRow[];

    const materials = rows.map((row) => {
      const catKey = categoryToFrontend(row.item_category);
      const { status, statusLabel, statusBadgeClass } = statusFromApproved(row.approved_for_use);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        brand: row.brand,
        category: catKey,
        categoryLabel: row.item_category,
        specDetails: row.spec_description,
        roomArea: row.color_tone ?? '',
        status,
        statusLabel,
        statusBadgeClass,
        imageUrl: DEFAULT_IMAGES[catKey] ?? DEFAULT_IMAGES.wood,
        unit: '',
        standard: '',
        origin: '',
        approvedDate: approvedRev.approved_at ? formatDate(approvedRev.approved_at) : formatDate(row.created_at),
        approvedBy: approvedRev.approved_by ?? '',
        sampleStatus: row.approved_for_use ? 'Đã ký mẫu thực tế' : 'Đang xác nhận',
      };
    });

    // Compute KPI aggregates — use raw rows (before mapping) for accuracy
    const totalCount = materials.length;
    const approvedCount = rows.filter((r) => r.approved_for_use).length;
    const domesticCount = rows.filter((r) =>
      ['An Cường', 'Đồng Tâm', 'Vicostone', 'Dulux', 'Inchem'].some((b) => r.brand.includes(b))
    ).length;
    const importCount = totalCount - domesticCount;

    return NextResponse.json({
      success: true,
      materials,
      totalCount,
      approvedCount,
      domesticCount,
      importCount,
      revisionId: approvedRev.id,
      revisionVersion: approvedRev.version_number,
      approvedBy: approvedRev.approved_by ?? null,
      approvedAt: approvedRev.approved_at ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ─── POST /api/interior/materials — add a new material spec ──────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 }); }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const revisionId = typeof b['revisionId'] === 'string' ? b['revisionId'] : null;
  const itemCategory = typeof b['itemCategory'] === 'string' ? b['itemCategory'].trim() : '';
  const brand = typeof b['brand'] === 'string' ? b['brand'].trim() : '';
  const code = typeof b['code'] === 'string' ? b['code'].trim() : '';
  const name = typeof b['name'] === 'string' ? b['name'].trim() : '';
  const colorTone = typeof b['colorTone'] === 'string' ? b['colorTone'].trim() : null;
  const specDescription = typeof b['specDescription'] === 'string' ? b['specDescription'].trim() : '';

  if (!revisionId || !itemCategory || !brand || !code || !name || !specDescription) {
    return NextResponse.json({ success: false, error: 'MISSING_REQUIRED_FIELDS' }, { status: 422 });
  }

  // UUID pattern check for revisionId
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(revisionId)) {
    return NextResponse.json({ success: false, error: 'INVALID_REVISION_ID' }, { status: 422 });
  }

  try {
    const matTable = getDynamicTable(ctx.supabase, 'interior_design_material_specs');
    const insertResult = await matTable.insert({
      tenant_id: ctx.tenantId,
      revision_id: revisionId,
      item_category: itemCategory,
      brand,
      code,
      name,
      color_tone: colorTone,
      spec_description: specDescription,
      approved_for_use: true,
    }).select('id, code, name').single();

    if (insertResult.error) {
      return NextResponse.json({ success: false, error: 'INSERT_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true, material: insertResult.data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
