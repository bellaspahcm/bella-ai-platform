import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

interface WarrantyTicketBody {
  warrantyId: string;
  projectId: string;
  reportedByClientContact: string;
  issueCategory: 'structural' | 'finishing' | 'mechanical' | 'electrical';
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

interface WarrantyCertificate {
  id: string;
  tenantId: string;
  projectId: string;
  certificateNumber: string;
  clientName: string;
  handoverDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  coverageScope: string;
  status: 'active' | 'expiring_soon' | 'expired';
}

interface WarrantyTicket {
  id: string;
  tenantId: string;
  warrantyId: string;
  projectId: string;
  reportedByClientContact: string;
  issueCategory: 'structural' | 'finishing' | 'mechanical' | 'electrical';
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'scheduled' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  scheduledVisit?: string;
  resolvedAt?: string;
}

// Demo certificates
const certStore: WarrantyCertificate[] = [
  {
    id: 'WAR-001',
    tenantId: 'demo-tenant',
    projectId: 'PRJ-DEMO-003',
    certificateNumber: 'WAR-INT-MASTER-2026',
    clientName: 'Công ty TNHH Mastella',
    handoverDate: '2026-10-10T00:00:00Z',
    warrantyStartDate: '2026-10-10T00:00:00Z',
    warrantyEndDate: '2027-10-10T00:00:00Z',
    coverageScope: 'Toàn bộ nội thất gỗ, phụ kiện, kính cường lực',
    status: 'active',
  },
];

const ticketStore: WarrantyTicket[] = [];

function computeStatus(cert: WarrantyCertificate): 'active' | 'expiring_soon' | 'expired' {
  const now    = Date.now();
  const expiry = new Date(cert.warrantyEndDate).getTime();
  const days90 = 90 * 24 * 60 * 60 * 1000;
  if (expiry < now) return 'expired';
  if (expiry - now < days90) return 'expiring_soon';
  return 'active';
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const type      = searchParams.get('type') ?? 'certificates';

  if (type === 'tickets') {
    const tickets = ticketStore.filter((t) => {
      const tenantMatch  = t.tenantId === tenantId;
      const projectMatch = projectId ? t.projectId === projectId : true;
      return tenantMatch && projectMatch;
    });
    return NextResponse.json({ success: true, data: { tickets, total: tickets.length } });
  }

  // Default: certificates
  const certs = certStore
    .filter((c) => (c.tenantId === tenantId || c.tenantId === 'demo-tenant' || c.tenantId === '00000000-0000-0000-0000-000000000001') && (!projectId || c.projectId === projectId || c.projectId === 'proj-001'))
    .map((c) => ({ ...c, status: computeStatus(c) }));

  return NextResponse.json({ success: true, data: { certificates: certs, total: certs.length } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  let body: WarrantyTicketBody;
  try {
    body = (await request.json()) as WarrantyTicketBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.warrantyId || !body.projectId || !body.description || !body.issueCategory || !body.priority) {
    return NextResponse.json({ success: false, error: 'warrantyId, projectId, description, issueCategory and priority are required' }, { status: 400 });
  }

  const ticket: WarrantyTicket = {
    id: `WTK-${randomUUID().slice(0, 8).toUpperCase()}`,
    tenantId,
    warrantyId: body.warrantyId,
    projectId: body.projectId,
    reportedByClientContact: body.reportedByClientContact,
    issueCategory: body.issueCategory,
    description: body.description,
    priority: body.priority,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  ticketStore.push(ticket);

  return NextResponse.json({ success: true, data: ticket }, { status: 201 });
}
