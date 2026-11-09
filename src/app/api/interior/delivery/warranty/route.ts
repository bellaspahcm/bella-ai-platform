import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WarrantyServiceTicket as DomainWarrantyTicket, DefectCategory } from '@/products/bella-interior/domain/delivery-aftercare/types';

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
  const projectId = searchParams.get('projectId') || undefined;
  const type = searchParams.get('type') ?? 'certificates';
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);

  try {
    if (type === 'tickets') {
      const rows = await repo.listWarrantyTickets(ctx.tenantId, projectId);
      const tickets = rows.map((ticket) => ({
        id: ticket.id,
        tenantId: ticket.tenantId,
        warrantyId: ticket.certificateId,
        projectId: ticket.projectId,
        reportedByClientContact: ticket.assignedTechnician ?? '',
        issueCategory: ticket.defectCategory === 'hardware_defect' ? 'mechanical' as const : 'finishing' as const,
        description: ticket.customerReport,
        priority: 'medium' as const,
        status: ticket.status === 'in_progress' ? 'in_progress' : ticket.status === 'resolved' ? 'resolved' : 'open',
        createdAt: ticket.reportedDate,
      }));
      return NextResponse.json({ success: true, data: { tickets, total: tickets.length } }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    if (type !== 'certificates') {
      return NextResponse.json({ success: false, error: 'Unsupported warranty data type' }, { status: 400 });
    }

    const rows = await repo.listWarrantyCertificates(ctx.tenantId, projectId);
    const customerDecision = await ctx.authorization.authorize({
      permissionId: 'interior:customer:read',
      tenantId: ctx.tenantId,
      ...(projectId ? { projectId } : {}),
    });
    const certificates = rows.map((certificate) => ({
      id: certificate.id,
      tenantId: certificate.tenantId,
      projectId: certificate.projectId,
      certificateNumber: certificate.certificateNumber,
      clientName: customerDecision.status === 'ALLOW' ? certificate.customerName : null,
      handoverDate: certificate.effectiveDate,
      warrantyStartDate: certificate.effectiveDate,
      warrantyEndDate: certificate.expirationDate,
      coverageScope: certificate.termsSummary,
      status: computeStatus(certificate.expirationDate),
    }));
    return NextResponse.json({ success: true, data: { certificates, total: certificates.length } }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_LOOKUP_FAILED' }, { status: 503 });
  }
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
  const categories = ['structural', 'finishing', 'mechanical', 'electrical'];
  const priorities = ['urgent', 'high', 'medium', 'low'];
  if (
    typeof payload.warrantyId !== 'string' || !payload.warrantyId ||
    typeof payload.projectId !== 'string' || !payload.projectId ||
    typeof payload.description !== 'string' || !payload.description.trim() ||
    typeof payload.issueCategory !== 'string' || !categories.includes(payload.issueCategory) ||
    typeof payload.priority !== 'string' || !priorities.includes(payload.priority)
  ) {
    return NextResponse.json({ success: false, error: 'Invalid warranty ticket fields' }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let project;
  let certificate;
  try {
    project = await repo.getProject(ctx.tenantId, payload.projectId);
    certificate = await repo.getWarrantyCertificate(ctx.tenantId, payload.warrantyId);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_PRECONDITION_LOOKUP_FAILED' }, { status: 503 });
  }
  if (!project || !certificate || certificate.projectId !== payload.projectId) {
    return NextResponse.json({ success: false, error: 'Warranty certificate or project not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const categoryMap: Record<WarrantyTicketBody['issueCategory'], DefectCategory> = {
    structural: 'dimensional_error',
    finishing: 'scratched_surface',
    mechanical: 'hardware_defect',
    electrical: 'lighting_failure',
  };
  const ticket: DomainWarrantyTicket = {
    id: randomUUID(),
    tenantId: ctx.tenantId,
    certificateId: certificate.id,
    projectId: project.id,
    ticketNumber: `WTK-${Date.now().toString().slice(-6)}`,
    reportedDate: now,
    customerReport: payload.description.trim(),
    roomZoneName: 'Toàn bộ công trình',
    itemName: payload.description.trim().slice(0, 30),
    defectCategory: categoryMap[payload.issueCategory],
    status: 'submitted',
  };
  try {
    await repo.saveWarrantyTicket(ctx.tenantId, ticket);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_WARRANTY_TICKET_PERSISTENCE_FAILED' }, { status: 503 });
  }

  return NextResponse.json({ success: true, data: ticket }, { status: 201 });
}
