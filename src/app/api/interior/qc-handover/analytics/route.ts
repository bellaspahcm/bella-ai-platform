import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorQCHandoverAnalyticsService } from '@/products/bella-interior/services/interior-qc-handover-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  let tenantId = '00000000-0000-0000-0000-000000000001';
  try {
    const ctx = await resolveInteriorContext(request);
    if (ctx.ok) {
      tenantId = ctx.tenantId;
    }
  } catch {
    // Default fallback tenant
  }

  const overview = InteriorQCHandoverAnalyticsService.getQCHandoverOverview();

  return NextResponse.json({
    success: true,
    data: {
      tenantId,
      overview,
    },
  });
}

