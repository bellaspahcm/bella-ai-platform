/**
 * Multi-branch Consolidated P&L Tests (Phase 29.3)
 *
 * Verify:
 *   1. getConsolidatedPnLReport rejects non-HQ admins (via checkHqAuth)
 *   2. Returns rows sorted by net_profit DESC
 *   3. Propagates RPC errors from get_consolidated_pnl
 *   4. Returns empty array gracefully when no branches active
 *   5. checkHqAuth gate enforces HQ admin via tenant product_key lookup
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }), { virtual: true });
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }), { virtual: true });

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockRpc = jest.fn();
const mockTenantQuery = {
  from: jest.fn(),
};

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: mockTenantQuery.from,
  })),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getConsolidatedPnLReport } from '../services/hq-actions';
import { readFileSync } from 'fs';
import * as path from 'path';

const HQ_ADMIN = { id: 'hq-uuid', tenant_id: 'hq-tenant-uuid', role: 'admin' };
const BRANCH_ADMIN = { id: 'branch-uuid', tenant_id: 'branch-tenant-uuid', role: 'admin' };
const KTV = { id: 'ktv-uuid', tenant_id: 'branch-tenant-uuid', role: 'ktv' };

// Helper: mock tenant lookup in checkHqAuth
function mockTenantLookup(productKey: string) {
  mockTenantQuery.from.mockImplementation((table: string) => {
    if (table === 'tenants') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { product_key: productKey, status: 'active' }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// getConsolidatedPnLReport
// ════════════════════════════════════════════════════════════════════════════

describe('getConsolidatedPnLReport', () => {
  const FROM = '2026-05-01';
  const TO = '2026-05-31';

  it('returns rows sorted by net_profit DESC for HQ admin', async () => {
    mockGetCurrentUser.mockResolvedValue(HQ_ADMIN);
    mockTenantLookup('bella_hq');

    const unsorted = [
      { tenant_id: 'b1', tenant_name: 'Quận 1', net_revenue: 5_000_000, net_profit: 800_000, operating_expense: 3_000_000, net_margin_percent: 16, total_bookings_count: 12, total_sessions_completed: 30, gross_revenue: 5_500_000, deductions: 500_000, cost_of_goods_sold: 0, gross_profit: 5_000_000, financial_income: 0, financial_expense: 0, operating_profit: 800_000, other_income: 0, other_expense: 0, profit_before_tax: 800_000, tax_expense: 0 },
      { tenant_id: 'b2', tenant_name: 'Quận 7', net_revenue: 9_000_000, net_profit: 2_500_000, operating_expense: 5_000_000, net_margin_percent: 27.8, total_bookings_count: 25, total_sessions_completed: 60, gross_revenue: 9_500_000, deductions: 500_000, cost_of_goods_sold: 1_000_000, gross_profit: 8_000_000, financial_income: 0, financial_expense: 0, operating_profit: 2_500_000, other_income: 0, other_expense: 0, profit_before_tax: 2_500_000, tax_expense: 0 },
      { tenant_id: 'b3', tenant_name: 'Bình Thạnh', net_revenue: 7_000_000, net_profit: 1_500_000, operating_expense: 4_500_000, net_margin_percent: 21.4, total_bookings_count: 18, total_sessions_completed: 45, gross_revenue: 7_000_000, deductions: 0, cost_of_goods_sold: 800_000, gross_profit: 6_200_000, financial_income: 0, financial_expense: 0, operating_profit: 1_500_000, other_income: 0, other_expense: 0, profit_before_tax: 1_500_000, tax_expense: 0 },
    ];
    mockRpc.mockResolvedValueOnce({ data: unsorted, error: null });

    const result = await getConsolidatedPnLReport(FROM, TO);

    expect(result).toHaveLength(3);
    expect(result[0].tenant_name).toBe('Quận 7');     // 2.5M profit
    expect(result[1].tenant_name).toBe('Bình Thạnh'); // 1.5M
    expect(result[2].tenant_name).toBe('Quận 1');     // 0.8M

    expect(mockRpc).toHaveBeenCalledWith('get_consolidated_pnl', {
      p_from_date: FROM,
      p_to_date: TO,
    });
  });

  it('returns empty array gracefully when no branches active', async () => {
    mockGetCurrentUser.mockResolvedValue(HQ_ADMIN);
    mockTenantLookup('bella_hq');
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getConsolidatedPnLReport(FROM, TO);
    expect(result).toEqual([]);
  });

  it('rejects non-HQ branch admin (tenant product_key != bella_hq)', async () => {
    mockGetCurrentUser.mockResolvedValue(BRANCH_ADMIN);
    mockTenantLookup('bella_babycare'); // Not HQ

    await expect(getConsolidatedPnLReport(FROM, TO)).rejects.toThrow(/Tổng bộ/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects KTV users entirely', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV);

    await expect(getConsolidatedPnLReport(FROM, TO)).rejects.toThrow(/Quyền truy cập bị từ chối/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects users without tenant_id', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'orphan', tenant_id: null, role: 'admin' });

    await expect(getConsolidatedPnLReport(FROM, TO)).rejects.toThrow(/không thuộc chi nhánh/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates RPC errors (e.g., function does not exist)', async () => {
    mockGetCurrentUser.mockResolvedValue(HQ_ADMIN);
    mockTenantLookup('bella_hq');
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function get_consolidated_pnl does not exist' },
    });

    await expect(getConsolidatedPnLReport(FROM, TO)).rejects.toMatchObject({
      message: expect.stringContaining('does not exist'),
    });
  });

  it('returns empty array when RPC data is null', async () => {
    mockGetCurrentUser.mockResolvedValue(HQ_ADMIN);
    mockTenantLookup('bella_hq');
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await getConsolidatedPnLReport(FROM, TO);
    expect(result).toEqual([]);
  });

  it('reports inter-branch clearing eliminations in consolidated revenue and COGS', () => {
    const migrationSql = readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/20260606110000_add_consolidated_pnl_elimination_totals.sql'
      ),
      'utf8'
    );

    expect(migrationSql).toContain('DROP FUNCTION IF EXISTS public.get_consolidated_pnl(DATE, DATE)');
    expect(migrationSql).toContain('internal_revenue_eliminated DECIMAL(19,4)');
    expect(migrationSql).toContain('internal_cogs_eliminated DECIMAL(19,4)');
    expect(migrationSql).toMatch(
      /a\.account_code LIKE '511%'[\s\S]*COALESCE\(e\.reference_type, ''\) <> 'INTER_BRANCH_CLEARING'/
    );
    expect(migrationSql).toMatch(
      /a\.account_code LIKE '632%'[\s\S]*COALESCE\(e\.reference_type, ''\) <> 'INTER_BRANCH_CLEARING'/
    );
    expect(migrationSql).toMatch(
      /a\.account_code LIKE '511%'[\s\S]*COALESCE\(e\.reference_type, ''\) = 'INTER_BRANCH_CLEARING'/
    );
    expect(migrationSql).toMatch(
      /a\.account_code LIKE '632%'[\s\S]*COALESCE\(e\.reference_type, ''\) = 'INTER_BRANCH_CLEARING'/
    );
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM PUBLIC');
    expect(migrationSql).toContain('REVOKE EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM anon');
  });
});
