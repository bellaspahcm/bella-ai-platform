/**
 * Unit Tests for Bella Interior OS — BOQ & BOM Canonical Analytics Service
 *
 * Verifies:
 * 1. Tenant Isolation (Gate 0 / P0)
 * 2. Canonical Project Header & Location Metadata
 * 3. Financial KPIs (COGS, Client Price, Gross Profit, Gross Margin %)
 * 4. Zone Groups & Tripartite Costing Subtotals
 * 5. Production BOM Raw Materials itemization
 * 6. Approved Design Lock and Version Audit Link
 * 7. Zero UI Calculation guarantee
 *
 * @module src/products/bella-interior/__tests__/boq-analytics.test.ts
 */

import { InteriorBOQAnalyticsService } from '../services/interior-boq-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorBOQAnalyticsService', () => {
  const VALID_TENANT_ID = 'tenant-bella-interior-test';

  describe('Gate 0: Tenant Isolation Verification', () => {
    it('should throw TenantIsolationViolationError if tenantId is missing or empty', async () => {
      await expect(InteriorBOQAnalyticsService.getBOQOverview('')).rejects.toThrow(
        TenantIsolationViolationError,
      );

      await expect(InteriorBOQAnalyticsService.getBOQOverview('   ')).rejects.toThrow(
        TenantIsolationViolationError,
      );
    });
  });

  describe('Canonical Project Header & Site Metadata', () => {
    it('should return canonical Villa Sunrise Renovation project with SunCasa Group and 320 m²', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      expect(overview.project).toBeDefined();
      expect(overview.project.code).toBe('INT-2024-001');
      expect(overview.project.name).toBe('Villa Sunrise Renovation');
      expect(overview.project.clientName).toBe('SunCasa Group');
      expect(overview.project.areaFormatted).toBe('320 m²');
      expect(overview.project.location).toBe('Quận 7, TP.HCM');
      expect(overview.project.statusLabel).toBe('Đang thực hiện');
    });
  });

  describe('Financial KPIs & Tripartite Costing Calculations', () => {
    it('should compute exact 1.25B COGS, 1.68B Price, 430M Gross Profit, and 25.6% Margin', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      // 1. COGS
      expect(overview.kpis.totalCogs.rawValue).toBe(1_250_000_000);
      expect(overview.kpis.totalCogs.formattedValue).toBe('1,250,000,000 đ');
      expect(overview.kpis.totalCogs.trendLabel).toContain('+2.5%');

      // 2. Client Price
      expect(overview.kpis.totalClientPrice.rawValue).toBe(1_680_000_000);
      expect(overview.kpis.totalClientPrice.formattedValue).toBe('1,680,000,000 đ');
      expect(overview.kpis.totalClientPrice.trendLabel).toContain('+1.8%');

      // 3. Gross Profit
      expect(overview.kpis.grossProfit.rawValue).toBe(430_000_000);
      expect(overview.kpis.grossProfit.formattedValue).toBe('430,000,000 đ');
      expect(overview.kpis.grossProfit.trendLabel).toContain('25.6%');

      // 4. Gross Margin
      expect(overview.kpis.grossMargin.rawPercentage).toBe(25.6);
      expect(overview.kpis.grossMargin.formattedPercentage).toBe('25.6%');
      expect(overview.kpis.grossMargin.sparklineTrend.length).toBeGreaterThan(0);
    });

    it('should verify mathematical invariant: Total Price - COGS = Gross Profit', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);
      const { totalCogs, totalClientPrice, grossProfit, grossMargin } = overview.kpis;

      expect(totalClientPrice.rawValue - totalCogs.rawValue).toBe(grossProfit.rawValue);

      const computedMargin = (grossProfit.rawValue / totalClientPrice.rawValue) * 100;
      expect(Math.round(computedMargin * 10) / 10).toBe(grossMargin.rawPercentage);
    });
  });

  describe('Zone Groups and Itemized Tripartite Subtotals', () => {
    it('should return 3 zone groups matching reference screen', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      expect(overview.zoneGroups).toHaveLength(3);
      const [living, master, kitchen] = overview.zoneGroups;

      expect(living.zoneName).toBe('Phòng khách');
      expect(living.subtotalCogsFormatted).toBe('320,000,000');
      expect(living.subtotalPriceFormatted).toBe('460,000,000');
      expect(living.subtotalProfitFormatted).toBe('140,000,000');
      expect(living.subtotalMarginPercentFormatted).toBe('30.4%');

      expect(master.zoneName).toBe('Phòng ngủ Master');
      expect(master.subtotalCogsFormatted).toBe('280,000,000');
      expect(master.subtotalPriceFormatted).toBe('390,000,000');
      expect(master.subtotalProfitFormatted).toBe('110,000,000');
      expect(master.subtotalMarginPercentFormatted).toBe('28.2%');

      expect(kitchen.zoneName).toBe('Bếp + Ăn');
      expect(kitchen.subtotalCogsFormatted).toBe('650,000,000');
      expect(kitchen.subtotalPriceFormatted).toBe('830,000,000');
      expect(kitchen.subtotalProfitFormatted).toBe('180,000,000');
      expect(kitchen.subtotalMarginPercentFormatted).toBe('21.7%');
    });

    it('should verify zone subtotals sum exactly to Grand Totals', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      const sumCogs = overview.zoneGroups.reduce((acc, z) => acc + z.subtotalCogs, 0);
      const sumPrice = overview.zoneGroups.reduce((acc, z) => acc + z.subtotalPrice, 0);
      const sumProfit = overview.zoneGroups.reduce((acc, z) => acc + z.subtotalProfit, 0);

      expect(sumCogs).toBe(overview.kpis.totalCogs.rawValue);
      expect(sumPrice).toBe(overview.kpis.totalClientPrice.rawValue);
      expect(sumProfit).toBe(overview.kpis.grossProfit.rawValue);
    });

    it('should correctly format all individual line items without UI calculation', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);
      const firstItem = overview.zoneGroups[0].items[0];

      expect(firstItem.itemName).toBe('Sofa cao cấp');
      expect(firstItem.specifications).toBe('Da thật, 3 chỗ ngồi');
      expect(firstItem.unit).toBe('Bộ');
      expect(firstItem.quantityFormatted).toBe('1.00');
      expect(firstItem.internalUnitCostFormatted).toBe('80,000,000');
      expect(firstItem.internalTotalCostFormatted).toBe('80,000,000');
      expect(firstItem.clientUnitPriceFormatted).toBe('110,000,000');
      expect(firstItem.clientTotalPriceFormatted).toBe('110,000,000');
      expect(firstItem.grossMarginFormatted).toBe('30,000,000');
      expect(firstItem.grossMarginPercentFormatted).toBe('27.3%');
    });
  });

  describe('BOM Raw Materials & Version Audit', () => {
    it('should return BOM materials for production planning', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      expect(overview.bomMaterials.length).toBeGreaterThanOrEqual(4);
      const mdf = overview.bomMaterials.find((m) => m.materialCode === 'MFC-MS-440-EV');
      expect(mdf).toBeDefined();
      expect(mdf?.stockStatus).toBe('in_stock');
      expect(mdf?.wasteFactorPercent).toBe(8);
    });

    it('should link back to approved design revision R1.0 in audit footer', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(VALID_TENANT_ID);

      expect(overview.audit.versionLabel).toBe('R1.0 - Approved');
      expect(overview.audit.approvalDateFormatted).toBe('06/11/2026');
      expect(overview.audit.approvedBy).toBe('Trần Thị Mai');
    });
  });
});

