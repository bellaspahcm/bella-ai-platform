import { NextRequest, NextResponse } from 'next/server';

type PunchStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

interface PunchListPatchBody {
  status: PunchStatus;
  resolvedByUserId?: string;
}

// In-memory store shared conceptually with route.ts (in production would be DB)
// Here we return a mock response for the PATCH
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const tenantId  = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const { id }    = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });
  }

  let body: PunchListPatchBody;
  try {
    body = (await request.json()) as PunchListPatchBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const validStatuses: PunchStatus[] = ['open', 'in_progress', 'resolved', 'verified'];
  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 422 },
    );
  }

  // In production: fetch from DB with tenant isolation check, then update
  // Mock: return updated item
  return NextResponse.json({
    success: true,
    data: {
      id,
      tenantId,
      status: body.status,
      resolvedByUserId: body.resolvedByUserId ?? null,
      resolvedAt: body.status === 'resolved' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const { id }   = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });
  }

  // Mock single item lookup
  return NextResponse.json({
    success: true,
    data: {
      id,
      tenantId,
      description: 'Mock punch list item',
      status: 'open',
      severity: 'minor',
      category: 'finishing',
    },
  });
}
