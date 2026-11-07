/**
 * Unit Tests for InteriorCustomerAnalyticsService
 *
 * Verifies tenant isolation, calculation correctness, format invariance,
 * and zero-UI-calculation guarantees.
 */

import {
  InteriorCustomerAnalyticsService,
  type RawCustomerInput,
} from '../services/interior-customer-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorCustomerAnalyticsService', () => {
  const TEST_TENANT = 'tenant-interior-crm-001';

  it('throws TenantIsolationViolationError when tenantId is empty or whitespace', () => {
    expect(() => InteriorCustomerAnalyticsService.getCustomerOverview('')).toThrow(
      TenantIsolationViolationError,
    );
    expect(() => InteriorCustomerAnalyticsService.getCustomerOverview('   ')).toThrow(
      TenantIsolationViolationError,
    );
  });

  it('returns valid 4 KPIs matching canonical metrics', () => {
    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(TEST_TENANT);
    expect(overview.kpis.totalCustomers.value).toBe(248);
    expect(overview.kpis.potentialCustomers.value).toBe(72);
    expect(overview.kpis.activeTransacting.value).toBe(36);
    expect(overview.kpis.vipCustomers.value).toBe(24);
  });

  it('calculates sales funnel with 5 steps and 24% conversion rate', () => {
    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(TEST_TENANT);
    expect(overview.salesFunnel.steps).toHaveLength(5);
    expect(overview.salesFunnel.steps[0].label).toBe('Khách hàng tiềm năng');
    expect(overview.salesFunnel.steps[0].count).toBe(100);
    expect(overview.salesFunnel.steps[4].label).toBe('Ký hợp đồng');
    expect(overview.salesFunnel.steps[4].count).toBe(24);
    expect(overview.salesFunnel.conversionRatePercent).toBe(24);
    expect(overview.salesFunnel.targetAchievementLabel).toBe('Vượt chỉ tiêu');
  });

  it('formats currency values correctly into Vietnamese notation', () => {
    expect(InteriorCustomerAnalyticsService.formatCurrency(5_200_000_000)).toBe('5.20 tỷ');
    expect(InteriorCustomerAnalyticsService.formatCurrency(12_800_000_000)).toBe('12.80 tỷ');
    expect(InteriorCustomerAnalyticsService.formatCurrency(850_000_000)).toBe('850 triệu');
    expect(InteriorCustomerAnalyticsService.formatCurrency(0)).toBe('0');
  });

  it('transforms customer items with correct labels, badges, and debt indicators', () => {
    const customList: RawCustomerInput[] = [
      {
        id: 'c-test-1',
        code: 'KH-0001',
        name: 'Test Corp',
        type: 'enterprise',
        source: 'referral',
        managerName: 'Minh PM',
        opportunityCount: 2,
        projectCount: 3,
        totalValue: 5_200_000_000,
        debt: 1_200_000_000,
        lastInteractionDate: '29/10/2026',
        status: 'transacting',
      },
    ];

    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(TEST_TENANT, customList);
    expect(overview.customers).toHaveLength(1);
    const item = overview.customers[0];
    expect(item.name).toBe('Test Corp');
    expect(item.typeLabel).toBe('Doanh nghiệp');
    expect(item.sourceLabel).toBe('Giới thiệu');
    expect(item.statusLabel).toBe('Đang giao dịch');
    expect(item.totalValueFormatted).toBe('5.20 tỷ');
    expect(item.debtFormatted).toBe('1.20 tỷ');
    expect(item.hasDebt).toBe(true);
  });

  it('produces accurate financial summary with debt and collection rate', () => {
    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(TEST_TENANT);
    expect(overview.financialSummary.totalContractValueFormatted).toBe('36.5 tỷ');
    expect(overview.financialSummary.collectedFormatted).toBe('28.2 tỷ');
    expect(overview.financialSummary.receivableDebtFormatted).toBe('8.3 tỷ');
    expect(overview.financialSummary.collectionRatePercent).toBe(77);
  });

  it('provides customer sources distribution summing to 100%', () => {
    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(TEST_TENANT);
    const sum = overview.sourceDistribution.reduce((acc, curr) => acc + curr.percentage, 0);
    expect(sum).toBe(100);
    expect(overview.sourceDistribution[0].label).toBe('Giới thiệu');
    expect(overview.sourceDistribution[0].percentage).toBe(42);
  });
});
