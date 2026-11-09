import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface ProjectDetailResponse {
  id: string;
  code: string;
  name: string;
  status: string;
  customerName: string | null;
  siteAddress: string | null;
  projectType: string;
  totalFloorAreaSquareMeters: number;
  estimatedBudget: number | null;
  targetCompletionDate: string;
  leadArchitectName: string;
  rooms: Array<{
    id: string;
    code: string;
    name: string;
    floor: number;
    areaSquareMeters: number;
  }>;
  materials: Array<{
    category: string;
    brand: string;
    name: string;
    spec: string;
  }> | null;
  progress: {
    designPercent: number;
    workshopPercent: number;
    installPercent: number;
    overallPercent: number;
  } | null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbProject = await repo.getProject(tenantId, id);

    if (dbProject) {
      const [customerDecision, financeDecision, contractDecision] = await Promise.all([
        ctx.authorization.authorize({ permissionId: 'interior:customer:read', tenantId }),
        ctx.authorization.authorize({ permissionId: 'interior:finance:read', tenantId }),
        ctx.authorization.authorize({ permissionId: 'interior:contract:read', tenantId }),
      ]);
      const dbRooms = await repo.listRoomZones(tenantId, dbProject.id);
      const rooms = dbRooms.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        floor: r.floor,
        areaSquareMeters: r.areaSquareMeters || 0,
      }));

      const responseData: ProjectDetailResponse = {
        id: dbProject.id,
        code: dbProject.code,
        name: dbProject.name,
        status: dbProject.status,
        customerName: customerDecision.status === 'ALLOW' ? dbProject.customerName || null : null,
        siteAddress: customerDecision.status === 'ALLOW' ? dbProject.siteAddress : null,
        projectType: dbProject.projectType,
        totalFloorAreaSquareMeters: rooms.reduce((acc, r) => acc + (r.areaSquareMeters || 0), 0),
        estimatedBudget: financeDecision.status === 'ALLOW' || contractDecision.status === 'ALLOW'
          ? Number.isFinite(dbProject.estimatedBudget) ? dbProject.estimatedBudget : null
          : null,
        targetCompletionDate: dbProject.targetCompletionDate,
        leadArchitectName: dbProject.leadArchitectName,
        rooms,
        materials: null,
        progress: null,
      };

      return NextResponse.json({ success: true, data: responseData }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_READ_FAILED' }, { status: 503 });
  }

  return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
}
