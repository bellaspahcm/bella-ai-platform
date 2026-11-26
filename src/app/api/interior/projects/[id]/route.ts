import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';
import {
  computeOperationalLeadTime,
  type OperationalStatusHistoryEntry,
} from '@/products/bella-interior/lib/operational-audit-trail';

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
  createdAt?: string | null;
  createdByName?: string | null;
  startedAt?: string | null;
  startedByName?: string | null;
  completedAt?: string | null;
  completedByName?: string | null;
  executionDuration?: string | null;
  statusHistory?: readonly OperationalStatusHistoryEntry[];
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

  // Fetch lifecycle audit trail from database
  let auditRow: {
    created_at?: string | null;
    created_by_name?: string | null;
    started_at?: string | null;
    started_by_name?: string | null;
    completed_at?: string | null;
    completed_by_name?: string | null;
    status_history?: unknown[] | null;
  } | null = null;

  try {
    const db = ctx.supabase as unknown as SupabaseClient;
    const { data: row } = await db
      .from('interior_projects')
      .select('created_at, created_by_name, started_at, started_by_name, completed_at, completed_by_name, status_history')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    auditRow = row;
  } catch {
    // Non-blocking fallback
  }

  const rawProject = data as Record<string, unknown>;
  const createdAtIso = auditRow?.created_at || (typeof rawProject.created_at === 'string' ? rawProject.created_at : null);
  const leadTime = computeOperationalLeadTime(auditRow?.started_at || createdAtIso, auditRow?.completed_at);

  const enrichedProject: ProjectDetailResponse = {
    ...(data as unknown as ProjectDetailResponse),
    createdAt: createdAtIso,
    createdByName: auditRow?.created_by_name || 'Quản lý dự án',
    startedAt: auditRow?.started_at ?? null,
    startedByName: auditRow?.started_by_name || null,
    completedAt: auditRow?.completed_at ?? null,
    completedByName: auditRow?.completed_by_name || null,
    executionDuration: leadTime,
    statusHistory: Array.isArray(auditRow?.status_history)
      ? (auditRow.status_history as unknown as OperationalStatusHistoryEntry[])
      : [],
  };

  return NextResponse.json({ success: true, data: enrichedProject }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
