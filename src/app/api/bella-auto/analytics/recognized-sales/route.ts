import { createServerClient } from '@/lib/supabase-server';
import { FinancialReportingService, RecognizedSalesReadError } from '@/modules/bella-auto/services/FinancialReportingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await FinancialReportingService.getRecognizedSalesDashboard(createServerClient());
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    const status = error instanceof RecognizedSalesReadError ? error.status : 503;
    return Response.json({ error: 'Unable to load recognized sales' }, {
      status, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
