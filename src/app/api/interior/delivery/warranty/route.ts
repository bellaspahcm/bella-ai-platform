import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

interface WarrantyTicketBody {
  warrantyId: string;
  projectId: string;
  reportedByClientContact?: string;
  issueCategory: 'structural' | 'finishing' | 'mechanical' | 'electrical';
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

function computeStatus(expirationDate: string): 'active' | 'expiring_soon' | 'expired' {
  const remaining = new Date(expirationDate).getTime() - Date.now();
  if (remaining < 0) return 'expired';
  if (remaining < 90 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'active';
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const type = searchParams.get('type') ?? 'certificates';
  if (projectId !== null && !validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'projectId must be a valid UUID' }, { status: 400 });
  }

  if (type !== 'tickets' && type !== 'certificates') {
    return NextResponse.json({ success: false, error: 'Unsupported warranty data type' }, { status: 400 });
  }
  const rpcName = type === 'tickets' ? 'interior_list_warranty_tickets' : 'interior_list_warranty_certificates';
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc(rpcName, { p_project_id: projectId });
  if (error) {
    const denied = error.message?.includes('AuthorizationViolation') === true;
    return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_WARRANTY_LOOKUP_FAILED' }, { status: denied ? 403 : 503 });
  }
  if (!Array.isArray(data) || data.some((item) => !isInteriorRbacRecord(item))) {
    return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_LOOKUP_FAILED' }, { status: 503 });
  }
  if (type === 'tickets') {
    const tickets = data.flatMap((item) => {
      if (!isInteriorRbacRecord(item) || typeof item.id !== 'string' || typeof item.tenantId !== 'string'
        || typeof item.projectId !== 'string' || typeof item.warrantyId !== 'string'
        || typeof item.customerReport !== 'string' || typeof item.reportedDate !== 'string') return [];
      const category = item.defectCategory === 'hardware_defect' ? 'mechanical'
        : item.defectCategory === 'lighting_failure' ? 'electrical'
          : item.defectCategory === 'dimensional_error' ? 'structural' : 'finishing';
      const status = item.status === 'assigned' ? 'assigned'
        : item.status === 'in_progress' ? 'in_progress'
          : item.status === 'resolved' ? 'resolved' : item.status === 'closed' ? 'closed' : 'open';
      const priority = ['urgent', 'high', 'medium', 'low'].includes(String(item.priority))
        ? item.priority : 'medium';
      return [{
        id: item.id, tenantId: item.tenantId, warrantyId: item.warrantyId, projectId: item.projectId,
        reportedByUserId: typeof item.reportedByUserId === 'string' ? item.reportedByUserId : null,
        reportedByClientContact: typeof item.reportedByContact === 'string' ? item.reportedByContact : '',
        issueCategory: category, description: item.customerReport, priority, status,
        createdAt: item.reportedDate,
      }];
    });
    return NextResponse.json({ success: true, data: { tickets, total: tickets.length } }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
  const certificates = data.flatMap((item) => {
    if (!isInteriorRbacRecord(item) || typeof item.id !== 'string' || typeof item.tenantId !== 'string'
      || typeof item.projectId !== 'string' || typeof item.certificateNumber !== 'string'
      || typeof item.effectiveDate !== 'string' || typeof item.expirationDate !== 'string') return [];
    return [{
      id: item.id,
      tenantId: item.tenantId,
      projectId: item.projectId,
      certificateNumber: item.certificateNumber,
      clientName: typeof item.customerName === 'string' ? item.customerName : null,
      handoverDate: item.effectiveDate,
      warrantyStartDate: item.effectiveDate,
      warrantyEndDate: item.expirationDate,
      coverageScope: typeof item.termsSummary === 'string' ? item.termsSummary : '',
      status: computeStatus(item.expirationDate),
    }];
  });
  return NextResponse.json({ success: true, data: { certificates, total: certificates.length } }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const payload = body as Partial<WarrantyTicketBody>;
  const categories: WarrantyTicketBody['issueCategory'][] = ['structural', 'finishing', 'mechanical', 'electrical'];
  const priorities: WarrantyTicketBody['priority'][] = ['urgent', 'high', 'medium', 'low'];
  if (
    !validInteriorUuid(payload.warrantyId) ||
    !validInteriorUuid(payload.projectId) ||
    typeof payload.description !== 'string' || !payload.description.trim() || payload.description.trim().length > 4000 ||
    (payload.reportedByClientContact !== undefined && (typeof payload.reportedByClientContact !== 'string' || payload.reportedByClientContact.length > 200)) ||
    typeof payload.issueCategory !== 'string' || !categories.includes(payload.issueCategory) ||
    typeof payload.priority !== 'string' || !priorities.includes(payload.priority)
  ) {
    return NextResponse.json({ success: false, error: 'Invalid warranty ticket fields' }, { status: 400 });
  }

  const categoryMap: Record<WarrantyTicketBody['issueCategory'], string> = {
    structural: 'dimensional_error',
    finishing: 'scratched_surface',
    mechanical: 'hardware_defect',
    electrical: 'lighting_failure',
  };
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_warranty_ticket', {
    p_certificate_id: payload.warrantyId,
    p_project_id: payload.projectId,
    p_reported_by_contact: payload.reportedByClientContact?.trim() ?? '',
    p_defect_category: categoryMap[payload.issueCategory],
    p_customer_report: payload.description.trim(),
    p_priority: payload.priority,
  });
  if (error) return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_TICKET_PERSISTENCE_FAILED' }, { status: 503 });
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || !isInteriorRbacRecord(outcome.ticket)) {
    const reason = outcome?.reason;
    const status = reason === 'PROJECT_NOT_FOUND' || reason === 'WARRANTY_CERTIFICATE_NOT_FOUND' ? 404
      : reason === 'INVALID_WARRANTY_TICKET_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_TICKET_DENIED', reason }, { status });
  }
  const item = outcome.ticket;
  return NextResponse.json({ success: true, data: {
    id: item.id,
    tenantId: item.tenantId,
    warrantyId: item.warrantyId,
    projectId: item.projectId,
    reportedByUserId: item.reportedByUserId,
    reportedByClientContact: item.reportedByContact,
    ticketNumber: item.ticketNumber,
    reportedDate: item.reportedDate,
    customerReport: item.customerReport,
    issueCategory: payload.issueCategory,
    priority: item.priority,
    status: 'open',
  } }, { status: 201 });
}
