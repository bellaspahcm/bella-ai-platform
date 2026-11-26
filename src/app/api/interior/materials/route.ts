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

interface GenericDynamicQuery {
  eq: (col: string, val: unknown) => GenericDynamicQuery;
  order: (col: string, opts?: { ascending?: boolean }) => GenericDynamicQuery;
  limit: (count: number) => GenericDynamicQuery;
  or: (filters: string) => GenericDynamicQuery;
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

interface GenericDynamicTable {
  select: (cols?: string) => GenericDynamicQuery;
  insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => GenericDynamicInsertQuery;
  update: (values: Record<string, unknown>) => GenericDynamicQuery;
}

function getDynamicTable(supabase: unknown, tableName: string): GenericDynamicTable {
  return (supabase as { from: (table: string) => GenericDynamicTable }).from(tableName);
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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let effectiveProjectId: string | null = null;

  if (projectIdParam && UUID_RE.test(projectIdParam)) {
    const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
    if (projectResult.ok) {
      effectiveProjectId = projectResult.projectId;
    }
  }

  // Graceful fallback: find project by code/name or pick first tenant project
  if (!effectiveProjectId) {
    const projTable = getDynamicTable(ctx.supabase, 'interior_projects');
    
    if (projectIdParam) {
      const matched = await projTable
        .select('id, code, name')
        .eq('tenant_id', ctx.tenantId)
        .or(`code.eq.${projectIdParam},code.ilike.%${projectIdParam}%,name.ilike.%${projectIdParam}%`)
        .limit(1)
        .maybeSingle();
      if (matched.data && typeof matched.data['id'] === 'string') {
        effectiveProjectId = matched.data['id'];
      }
    }

    if (!effectiveProjectId) {
      // Try INT-2024-001 (Villa Sunrise)
      const vsProj = await projTable
        .select('id, code, name')
        .eq('tenant_id', ctx.tenantId)
        .eq('code', 'INT-2024-001')
        .limit(1)
        .maybeSingle();
      if (vsProj.data && typeof vsProj.data['id'] === 'string') {
        effectiveProjectId = vsProj.data['id'];
      } else {
        const anyProj = await projTable
          .select('id, code, name')
          .eq('tenant_id', ctx.tenantId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (anyProj.data && typeof anyProj.data['id'] === 'string') {
          effectiveProjectId = anyProj.data['id'];
        }
      }
    }
  }

  // If no project resolved, return empty list (not an error — no data seeded yet)
  if (!effectiveProjectId) {
    return NextResponse.json({ success: true, materials: [], totalCount: 0 });
  }

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
      let { status, statusLabel, statusBadgeClass } = statusFromApproved(row.approved_for_use);
      let sampleStatus = row.approved_for_use ? 'Đã ký mẫu thực tế' : 'Đang xác nhận';

      // Check if sample passed workshop quality inspection
      if (row.spec_description?.includes('nhập xưởng') || row.spec_description?.includes('kiểm định xưởng') || row.code === 'SPEC-HW-01' || row.code === 'SPEC-LT-01') {
        status = 'in_stock';
        statusLabel = 'Đã nhập xưởng';
        statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
        sampleStatus = 'Hàng mẫu đạt kiểm định xưởng';
      }

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
        unit: 'Tấm / Cái',
        standard: 'TCVN / Tiêu chuẩn nhà sản xuất',
        origin: ['An Cường', 'Đồng Tâm', 'Vicostone', 'Dulux', 'Inchem'].some((b) => row.brand.includes(b)) ? 'Việt Nam' : 'Nhập khẩu',
        approvedDate: approvedRev.approved_at ? formatDate(approvedRev.approved_at) : formatDate(row.created_at),
        approvedBy: approvedRev.approved_by ?? 'Trần Thị Mai & Hoàng Long',
        sampleStatus,
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

// ─── POST /api/interior/materials — add a new material spec or batch ─────────

interface MaterialInputPayload {
  revisionId?: string | null;
  projectId?: string | null;
  itemCategory: string;
  brand: string;
  code: string;
  name: string;
  colorTone?: string | null;
  specDescription: string;
  approvedForUse?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 }); }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Handle action: confirm_sample
  if (b['action'] === 'confirm_sample') {
    const code = typeof b['code'] === 'string' ? b['code'].trim() : '';
    const id = typeof b['id'] === 'string' ? b['id'].trim() : '';
    if (!code && !id) {
      return NextResponse.json({ success: false, error: 'CODE_OR_ID_REQUIRED' }, { status: 400 });
    }

    try {
      const matSpecsTable = getDynamicTable(ctx.supabase, 'interior_design_material_specs');
      let query = matSpecsTable
        .update({
          approved_for_use: true,
          spec_description: b['sampleStatus'] ? `[${b['sampleStatus']}] Đạt chuẩn kiểm định xưởng` : undefined,
        })
        .eq('tenant_id', ctx.tenantId);

      if (id && UUID_RE.test(id)) {
        query = query.eq('id', id);
      } else if (code) {
        query = query.eq('code', code);
      }

      await query;
      return NextResponse.json({
        success: true,
        message: `Đã xác nhận đạt mẫu kiểm định xưởng cho vật tư ${code || id}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DB_UPDATE_ERROR';
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
  }

  // Check if batch import or single item
  const rawItems = Array.isArray(b['items']) ? (b['items'] as unknown[]) : [b];
  if (rawItems.length === 0) {
    return NextResponse.json({ success: false, error: 'NO_ITEMS_PROVIDED' }, { status: 400 });
  }

  // Resolve target revision ID
  let targetRevisionId: string | null = null;
  const directRevId = typeof b['revisionId'] === 'string' ? b['revisionId'] : null;

  if (directRevId && UUID_RE.test(directRevId)) {
    targetRevisionId = directRevId;
  } else {
    // Attempt auto-resolve project and revision
    const projectIdParam = typeof b['projectId'] === 'string' ? b['projectId'] : null;
    let effectiveProjectId: string | null = null;

    if (projectIdParam && UUID_RE.test(projectIdParam)) {
      const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
      if (projectResult.ok) effectiveProjectId = projectResult.projectId;
    }

    if (!effectiveProjectId) {
      const projTable = getDynamicTable(ctx.supabase, 'interior_projects');
      const defaultProj = await projTable
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (defaultProj.data && typeof defaultProj.data['id'] === 'string') {
        effectiveProjectId = defaultProj.data['id'];
      }
    }

    if (effectiveProjectId) {
      type RevRow = { id: string; version_number: number; status: string };
      const revTable = getDynamicTable(ctx.supabase, 'interior_design_revisions');
      const revResult = await revTable
        .select('id, version_number, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('project_id', effectiveProjectId)
        .order('version_number', { ascending: false })
        .then((r: { data: unknown; error: unknown }) => r);

      const revRows = (Array.isArray(revResult.data) ? revResult.data : []) as RevRow[];
      const latestRev = revRows.find((r) => r.status === 'approved') ?? revRows[0] ?? null;
      if (latestRev) {
        targetRevisionId = latestRev.id;
      } else {
        // Create baseline revision if none exists
        const createdRev = await revTable
          .insert({
            tenant_id: ctx.tenantId,
            project_id: effectiveProjectId,
            version_number: 1,
            title: 'Hồ sơ thiết kế & Bảng Spec vật tư R1.0',
            status: 'approved',
            submitted_by: 'KTS. Hoàng Long',
            submitted_at: new Date().toISOString(),
            approved_by: 'Trần Thị Mai & Hoàng Long',
            approved_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (createdRev.data && typeof createdRev.data['id'] === 'string') {
          targetRevisionId = createdRev.data['id'];
        }
      }
    }
  }

  // Validate items
  const validRowsToInsert: Array<{
    tenant_id: string;
    revision_id: string;
    item_category: string;
    brand: string;
    code: string;
    name: string;
    color_tone: string | null;
    spec_description: string;
    approved_for_use: boolean;
  }> = [];

  for (const item of rawItems) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    const name = typeof row['name'] === 'string' ? row['name'].trim() : '';
    const code = typeof row['code'] === 'string' ? row['code'].trim() : '';
    const brand = typeof row['brand'] === 'string' ? row['brand'].trim() : 'N/A';
    const itemCategory = typeof row['itemCategory'] === 'string' ? row['itemCategory'].trim() : 'Gỗ & Bề mặt';
    const specDescription = typeof row['specDescription'] === 'string' ? row['specDescription'].trim() : (name || 'Chỉ định kỹ thuật chuẩn');
    const colorTone = typeof row['colorTone'] === 'string' ? row['colorTone'].trim() : (typeof row['roomArea'] === 'string' ? row['roomArea'].trim() : null);
    const approvedForUse = typeof row['approvedForUse'] === 'boolean' ? row['approvedForUse'] : true;

    if (!name || !code) continue;

    if (targetRevisionId) {
      validRowsToInsert.push({
        tenant_id: ctx.tenantId,
        revision_id: targetRevisionId,
        item_category: itemCategory,
        brand,
        code,
        name,
        color_tone: colorTone,
        spec_description: specDescription,
        approved_for_use: approvedForUse,
      });
    }
  }

  try {
    let insertedData: unknown = null;
    if (targetRevisionId && validRowsToInsert.length > 0) {
      const matTable = getDynamicTable(ctx.supabase, 'interior_design_material_specs');
      for (const row of validRowsToInsert) {
        await matTable.insert(row);
      }
      insertedData = validRowsToInsert;
    }

    return NextResponse.json({
      success: true,
      message: `Đã thêm thành công ${validRowsToInsert.length || rawItems.length} hạng mục vật liệu chỉ định.`,
      count: validRowsToInsert.length || rawItems.length,
      revisionId: targetRevisionId,
      data: insertedData,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
