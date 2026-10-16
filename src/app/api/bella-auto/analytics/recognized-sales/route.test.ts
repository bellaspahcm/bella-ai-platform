import { createServerClient } from '@/lib/supabase-server';
import { FinancialReportingService, RecognizedSalesReadError } from '@/modules/bella-auto/services/FinancialReportingService';
import { GET } from './route';

jest.mock('@/lib/supabase-server', () => ({ createServerClient: jest.fn(() => ({ requestClient: true })) }));

describe('recognized sales authenticated API', () => {
  afterEach(() => jest.restoreAllMocks());
  it('passes the request client to the actual service boundary and disables shared caching', async () => {
    const client = createServerClient();
    const read = jest.spyOn(FinancialReportingService, 'getRecognizedSalesDashboard')
      .mockResolvedValue({ summary: { revenue: 0, sales: 0, averageSalePrice: 0 }, revenueByMonth: [], topModels: [], timeZone: 'UTC' });
    const result = await GET();
    expect(read).toHaveBeenCalledWith(client);
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toEqual({ summary: { revenue: 0, sales: 0, averageSalePrice: 0 }, revenueByMonth: [], topModels: [], timeZone: 'UTC' });
  });
  it.each([401,403,503] as const)('preserves %s authorization/configuration failures without zero data', async status => {
    jest.spyOn(FinancialReportingService, 'getRecognizedSalesDashboard')
      .mockRejectedValue(new RecognizedSalesReadError('Internal authority detail',status));
    const result = await GET();
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual({ error: 'Unable to load recognized sales' });
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('does not leak upstream database errors or return an empty success', async () => {
    jest.spyOn(FinancialReportingService, 'getRecognizedSalesDashboard').mockRejectedValue(new Error('Private DB detail'));
    const result = await GET();
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'Unable to load recognized sales' });
  });
});
