import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
  }

  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_read_project', {
    p_project_id: id,
  });
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_READ_FAILED' }, { status: 503 });
  }
  if (!isInteriorRbacRecord(data)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_PROJECT_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: data as unknown as ProjectDetailResponse }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
