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

import type { SupabaseClient } from '@supabase/supabase-js';
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

  describe('BOQ Manual Workspace Mutations & Immutability (Phase 1)', () => {
    const MUTATION_TENANT = 'tenant-boq-workspace-mutation-test';

    beforeEach(() => {
      InteriorBOQAnalyticsService.resetTenantBOQData(MUTATION_TENANT);
    });

    it('should enforce Immutability on Approved BOQ: modifications fail closed', async () => {
      const overview = await InteriorBOQAnalyticsService.getBOQOverview(MUTATION_TENANT);
      expect(overview.status).toBe('approved');

      // Attempting to add an item to an approved revision must throw
      await expect(
        InteriorBOQAnalyticsService.addItem(MUTATION_TENANT, {
          zoneId: 'zone-living',
          itemName: 'Đèn chùm pha lê',
          specifications: 'Pha lê Tiệp Khắc',
          unit: 'Bộ',
          quantity: 1,
          internalUnitCost: 20_000_000,
          clientUnitPrice: 35_000_000,
        }),
      ).rejects.toThrow(/bất biến|Revision mới/);

      // Attempting to add zone to approved revision must throw
      await expect(
        InteriorBOQAnalyticsService.addZone(MUTATION_TENANT, 'Phòng rượu'),
      ).rejects.toThrow(/bất biến|Revision mới/);
    });

    it('should fork a new revision (R2.0 Draft) from Approved BOQ, allowing mutations', async () => {
      // 1. Fork revision
      const rev2 = await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT, {
        actorName: 'Kỹ sư Dự toán',
      });

      expect(rev2.versionNumber).toBe(2);
      expect(rev2.status).toBe('draft');
      expect(rev2.audit.versionLabel).toContain('R2.0 - Draft');

      // 2. Add new zone
      const withZone = await InteriorBOQAnalyticsService.addZone(MUTATION_TENANT, 'Phòng làm việc VIP');
      const addedZone = withZone.zoneGroups.find((z) => z.zoneName === 'Phòng làm việc VIP');
      expect(addedZone).toBeDefined();
      expect(addedZone?.items).toHaveLength(0);

      // 3. Add new line item with financial calculations
      const withItem = await InteriorBOQAnalyticsService.addItem(MUTATION_TENANT, {
        zoneId: addedZone!.zoneId,
        itemName: 'Bàn giám đốc gỗ gõ đỏ',
        specifications: 'Gỗ gõ đỏ Pachy tự nhiên sơn bóng',
        unit: 'Bộ',
        quantity: 2,
        internalUnitCost: 50_000_000, // 2 * 50M = 100M COGS
        clientUnitPrice: 80_000_000,   // 2 * 80M = 160M Price -> 60M Profit -> Margin 37.5%, Markup 60%
      });

      const updatedZone = withItem.zoneGroups.find((z) => z.zoneId === addedZone!.zoneId);
      expect(updatedZone?.items).toHaveLength(1);
      const item = updatedZone!.items[0];
      expect(item.internalTotalCost).toBe(100_000_000);
      expect(item.clientTotalPrice).toBe(160_000_000);
      expect(item.grossMarginAmount).toBe(60_000_000);
      expect(item.grossMarginPercent).toBe(37.5);
      expect(item.markupPercent).toBe(60);

      // 4. Verify project KPIs updated accurately
      expect(withItem.kpis.totalCogs.rawValue).toBe(1_250_000_000 + 100_000_000);
      expect(withItem.kpis.totalClientPrice.rawValue).toBe(1_680_000_000 + 160_000_000);
    });

    it('should support item update, duplication, and deletion with sequential re-indexing', async () => {
      await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT);

      // 1. Update existing item
      const updated = await InteriorBOQAnalyticsService.updateItem(MUTATION_TENANT, {
        itemId: 'item-sofa',
        quantity: 2, // was 1 -> total cost becomes 160M, price becomes 220M
      });

      const sofa = updated.zoneGroups[0].items.find((i) => i.id === 'item-sofa');
      expect(sofa?.quantity).toBe(2);
      expect(sofa?.internalTotalCost).toBe(160_000_000);
      expect(sofa?.clientTotalPrice).toBe(220_000_000);

      // 2. Duplicate item
      const duplicated = await InteriorBOQAnalyticsService.duplicateItem(MUTATION_TENANT, {
        itemId: 'item-sofa',
        targetZoneId: 'zone-living',
      });
      const living = duplicated.zoneGroups.find((z) => z.zoneId === 'zone-living');
      const copyItem = living?.items.find((i) => i.itemName.includes('(Copy)'));
      expect(copyItem).toBeDefined();

      // 3. Delete item & verify sequential re-indexing
      const deleted = await InteriorBOQAnalyticsService.deleteItem(MUTATION_TENANT, copyItem!.id);
      const livingAfterDelete = deleted.zoneGroups.find((z) => z.zoneId === 'zone-living');
      expect(livingAfterDelete?.items.some((i) => i.id === copyItem!.id)).toBe(false);

      // Check item numbers are 1, 2, 3...
      const allItemNumbers = deleted.zoneGroups.flatMap((z) => z.items.map((i) => i.itemNumber));
      for (let i = 0; i < allItemNumbers.length; i++) {
        expect(allItemNumbers[i]).toBe(i + 1);
      }
    });

    it('should enforce strict 4-stage lifecycle state machine', async () => {
      await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT); // status: draft

      // 1. Draft -> Under Review
      const underReview = await InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
        targetStatus: 'under_review',
        actorName: 'Trưởng phòng Dự toán',
      });
      expect(underReview.status).toBe('under_review');
      expect(underReview.audit.versionLabel).toContain('Under Review');

      // In Under Review, edits must be blocked
      await expect(
        InteriorBOQAnalyticsService.deleteItem(MUTATION_TENANT, 'item-sofa'),
      ).rejects.toThrow(/Chờ duyệt/);

      // 2. Under Review -> Draft (Reject)
      const returnedToDraft = await InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
        targetStatus: 'draft',
      });
      expect(returnedToDraft.status).toBe('draft');

      // 3. Draft -> Under Review -> Approved
      await InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
        targetStatus: 'under_review',
      });
      const approved = await InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
        targetStatus: 'approved',
        actorName: 'Ban Giám Đốc',
      });
      expect(approved.status).toBe('approved');
      expect(approved.audit.versionLabel).toContain('Approved');

      // 4. Approved -> Locked for Contract
      const locked = await InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
        targetStatus: 'locked_for_contract',
        actorName: 'Bộ phận Hợp đồng',
      });
      expect(locked.status).toBe('locked_for_contract');
      expect(locked.audit.versionLabel).toContain('Locked for Contract');

      // Illegal transition: Locked -> Draft directly is forbidden
      await expect(
        InteriorBOQAnalyticsService.transitionStatus(MUTATION_TENANT, {
          targetStatus: 'draft',
        }),
      ).rejects.toThrow(/không hợp lệ/);
    });

    it('should reject invalid input: negative price or zero quantity', async () => {
      await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT);

      await expect(
        InteriorBOQAnalyticsService.addItem(MUTATION_TENANT, {
          zoneId: 'zone-living',
          itemName: 'Lỗi số lượng',
          specifications: 'Test',
          unit: 'Cái',
          quantity: 0,
          internalUnitCost: 10_000_000,
          clientUnitPrice: 15_000_000,
        }),
      ).rejects.toThrow(/Số lượng cấu kiện phải lớn hơn 0/);

      await expect(
        InteriorBOQAnalyticsService.addItem(MUTATION_TENANT, {
          zoneId: 'zone-living',
          itemName: 'Lỗi đơn giá',
          specifications: 'Test',
          unit: 'Cái',
          quantity: 1,
          internalUnitCost: -5_000_000,
          clientUnitPrice: 10_000_000,
        }),
      ).rejects.toThrow(/không được âm/);
    });

    it('should preserve immutable historical snapshots across revisions (Snapshot Isolation)', async () => {
      // Baseline is R1.0 (Approved) with 7 items, 1.25B COGS, 1.68B Price
      const overviewR1 = await InteriorBOQAnalyticsService.getBOQOverview(MUTATION_TENANT);
      expect(overviewR1.versionNumber).toBe(1);
      expect(overviewR1.status).toBe('approved');
      expect(overviewR1.kpis.totalClientPrice.rawValue).toBe(1_680_000_000);

      // Fork to R2.0 (Draft)
      await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT, { actorName: 'KTS. Lê Hoàng' });

      // Mutate R2.0: Add a high-value item
      await InteriorBOQAnalyticsService.addItem(MUTATION_TENANT, {
        zoneId: 'zone-living',
        itemName: 'Bàn console mạ PVD',
        specifications: 'Khung inox mạ vàng PVD, mặt đá tự nhiên',
        unit: 'Cái',
        quantity: 1,
        internalUnitCost: 50_000_000,
        clientUnitPrice: 80_000_000,
      });

      const overviewR2 = await InteriorBOQAnalyticsService.getBOQOverview(MUTATION_TENANT);
      expect(overviewR2.versionNumber).toBe(2);
      expect(overviewR2.status).toBe('draft');
      const r2TotalItems = overviewR2.zoneGroups.reduce((acc, zg) => acc + zg.items.length, 0);
      expect(r2TotalItems).toBe(8); // 7 original + 1 added console table

      // Verify that Snapshot of R1.0 is preserved unchanged!
      const snapR1 = InteriorBOQAnalyticsService.getHistoricalSnapshot(MUTATION_TENANT, 1);
      expect(snapR1).toBeDefined();
      expect(snapR1?.versionNumber).toBe(1);
      expect(snapR1?.status).toBe('approved');
      const r1TotalItems = snapR1?.zoneGroups.reduce((acc, zg) => acc + zg.items.length, 0);
      expect(r1TotalItems).toBe(7); // Exactly 7 original items, unpolluted by R2.0 additions!
    });

    it('should enforce repository-level immutability guard against unauthorized writes to approved BOQ', async () => {
      // Mock Supabase client to test repository immutability guard
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'boq-imm-001',
          tenant_id: MUTATION_TENANT,
          project_id: 'proj-001',
          design_revision_id: 'rev-001',
          boq_number: 'BOQ-TEST-001',
          version_number: 1,
          status: 'approved', // ALREADY APPROVED
          total_internal_cost: 100_000_000,
          total_client_price: 150_000_000,
          total_gross_margin: 50_000_000,
          gross_margin_percent: 33.3,
          prepared_by: 'QA Architect',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'interior_boqs') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: mockSingle,
              upsert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'interior_boq_items') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              delete: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }),
      };

      // Import repository dynamically
      const { SupabaseInteriorRepository } = await import(
        '../repositories/supabase.repository'
      );
      const repo = new SupabaseInteriorRepository(mockSupabase as unknown as SupabaseClient);

      // Attempt to save modifications to the approved BOQ without creating a new revision
      const tamperingBOQ = {
        id: 'boq-imm-001',
        tenantId: MUTATION_TENANT,
        projectId: 'proj-001',
        designRevisionId: 'rev-001',
        boqNumber: 'BOQ-TEST-001',
        versionNumber: 1,
        status: 'draft' as const, // Attempting to downgrade back to draft
        totalInternalCost: 120_000_000,
        totalClientPrice: 180_000_000,
        totalGrossMargin: 60_000_000,
        grossMarginPercent: 33.3,
        items: [],
        preparedBy: 'Hacker',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(repo.saveBOQ(MUTATION_TENANT, tamperingBOQ)).rejects.toThrow(
        /Immutability violation/,
      );
    });

    it('should prevent cross-tenant tampering and reject item operations on non-existent items', async () => {
      await InteriorBOQAnalyticsService.createRevision(MUTATION_TENANT);

      // Tenant A cannot update or delete item from Tenant B
      await expect(
        InteriorBOQAnalyticsService.updateItem(MUTATION_TENANT, {
          itemId: 'item-foreign-tenant-xyz',
          quantity: 99,
        }),
      ).rejects.toThrow(/không tồn tại/);

      await expect(
        InteriorBOQAnalyticsService.deleteItem(MUTATION_TENANT, 'item-foreign-tenant-xyz'),
      ).rejects.toThrow(/không tồn tại/);
    });

    it('should record comprehensive audit log with oldData and newData before/after changesets', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'audit_logs') {
            return { insert: insertMock };
          }
          return {};
        }),
      };

      const { SupabaseInteriorRepository } = await import(
        '../repositories/supabase.repository'
      );
      const repo = new SupabaseInteriorRepository(mockSupabase as unknown as SupabaseClient);

      await repo.recordAuditLog(MUTATION_TENANT, {
        userId: 'user-estimator-001',
        action: 'BOQ_UPDATE_ITEM',
        module: 'INTERIOR_BOQ',
        targetId: 'item-sofa',
        oldData: { quantity: 1, clientTotalPrice: 110_000_000 },
        newData: { quantity: 2, clientTotalPrice: 220_000_000 },
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      const insertedPayload = insertMock.mock.calls[0][0];
      expect(insertedPayload.tenant_id).toBe(MUTATION_TENANT);
      expect(insertedPayload.action).toBe('BOQ_UPDATE_ITEM');
      expect(insertedPayload.module).toBe('INTERIOR_BOQ');
      expect(insertedPayload.old_data).toEqual({ quantity: 1, clientTotalPrice: 110_000_000 });
      expect(insertedPayload.new_data).toEqual({ quantity: 2, clientTotalPrice: 220_000_000 });
    });
  });
});

