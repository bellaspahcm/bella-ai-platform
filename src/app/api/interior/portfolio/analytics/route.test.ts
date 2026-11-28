import { GET } from './route';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorPortfolioAnalyticsService } from '@/products/bella-interior/services/interior-portfolio-analytics.service';

jest.mock('@/products/bella-interior/lib/server-context', () => ({
  INTERIOR_PERMISSIONS: { projectRead: 'interior:project:read', financeRead: 'interior:finance:read' },
  resolveInteriorContext: jest.fn(),
}));
jest.mock('@/products/bella-interior/repositories/supabase.repository', () => ({ SupabaseInteriorRepository: jest.fn() }));
jest.mock('@/products/bella-interior/services/interior-portfolio-analytics.service', () => ({
  InteriorPortfolioAnalyticsService: jest.fn().mockImplementation(() => ({ computePortfolioOverview: jest.fn().mockResolvedValue({ projects: [] }) })),
}));

const resolve = jest.mocked(resolveInteriorContext);
const Service = jest.mocked(InteriorPortfolioAnalyticsService);

describe('portfolio authorization', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it.each([
    ['DENY', 'ALLOW', 403],
    ['ALLOW', 'DENY', 403],
    ['UNAVAILABLE', 'ALLOW', 503],
    ['ALLOW', 'UNAVAILABLE', 503],
  ])('fails closed for project=%s and finance=%s', async (project, finance, status) => {
    const authorize = jest.fn().mockImplementation(({ permissionId }: { permissionId: string }) =>
      Promise.resolve({ status: permissionId === 'interior:project:read' ? project : finance }));
    resolve.mockResolvedValue({ ok: true, tenantId: 'tenant-a', supabase: {}, authorization: { authorize } } as never);
    const response = await GET(new Request('https://example.com/api/interior/portfolio/analytics?projectId=other'));
    expect(response.status).toBe(status);
    expect(Service).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalledWith({ permissionId: 'interior:project:read', tenantId: 'tenant-a' });
    expect(authorize).toHaveBeenCalledWith({ permissionId: 'interior:finance:read', tenantId: 'tenant-a' });
  });

  it('returns the overview only when both tenant-wide checks allow it', async () => {
    const authorize = jest.fn().mockResolvedValue({ status: 'ALLOW' });
    resolve.mockResolvedValue({ ok: true, tenantId: 'tenant-a', supabase: {}, authorization: { authorize } } as never);
    const response = await GET(new Request('https://example.com/api/interior/portfolio/analytics'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { projects: [] } });
    expect(Service).toHaveBeenCalledTimes(1);
  });
});

