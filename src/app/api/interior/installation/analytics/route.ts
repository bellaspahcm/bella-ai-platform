import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorInstallationAnalyticsService } from '@/products/bella-interior/services/interior-installation-analytics.service';

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

  const overview = InteriorInstallationAnalyticsService.getInstallationOverview();

  return NextResponse.json({
    success: true,
    data: {
      tenantId,
      overview,
    },
  });
}
