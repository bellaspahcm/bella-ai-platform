import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorInstallationAnalyticsService } from '@/products/bella-interior/services/interior-installation-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const overview = InteriorInstallationAnalyticsService.getInstallationOverview();
    return NextResponse.json(
      {
        success: true,
        data: { overview },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown installation overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_INSTALLATION_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
