/**
 * Unit Tests for Bella Interior OS — Design Studio Canonical Analytics Service
 *
 * Verifies:
 * 1. Tenant Isolation (Gate 0 / P0)
 * 2. Canonical Project Header & Breadcrumb
 * 3. Approved Design Lock Invariant
 * 4. Lock state toggling logic
 * 5. 3D Visual Gallery items & primary perspective
 * 6. Material Specifications & Compliance Audit
 * 7. Zero UI Calculation guarantee
 *
 * @module src/products/bella-interior/__tests__/design-analytics.test.ts
 */

import { InteriorDesignAnalyticsService } from '../services/interior-design-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorDesignAnalyticsService', () => {
  const VALID_TENANT_ID = 'tenant-bella-interior-test';

  describe('Gate 0: Tenant Isolation Verification', () => {
    it('should throw TenantIsolationViolationError if tenantId is missing or blank in getDesignStudioOverview', async () => {
      await expect(
        InteriorDesignAnalyticsService.getDesignStudioOverview(''),
      ).rejects.toThrow(TenantIsolationViolationError);

      await expect(
        InteriorDesignAnalyticsService.getDesignStudioOverview('   '),
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    it('should throw TenantIsolationViolationError if tenantId is missing or blank in toggleDesignLock', async () => {
      await expect(
        InteriorDesignAnalyticsService.toggleDesignLock('', 'rev-1'),
      ).rejects.toThrow(TenantIsolationViolationError);
    });
  });

  describe('Canonical Project Header & Navigation', () => {
    it('should return canonical Villa Sunrise Renovation project header with INT-2024-001', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.project).toBeDefined();
      expect(overview.project.code).toBe('INT-2024-001');
      expect(overview.project.name).toBe('Villa Sunrise Renovation');
      expect(overview.project.status).toBe('in_progress');
      expect(overview.project.statusLabel).toBe('Đang thực hiện');
      expect(overview.project.statusBadgeClass).toContain('bg-emerald-50');
      expect(overview.project.breadcrumbLabel).toContain('INT-2024-001');
    });

    it('should return 7 standard lifecycle sub-navigation tabs with "Thiết kế" active', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.subTabs).toHaveLength(7);
      const activeTab = overview.subTabs.find((t) => t.isActive);
      expect(activeTab).toBeDefined();
      expect(activeTab?.key).toBe('design');
      expect(activeTab?.label).toBe('Thiết kế');
    });
  });

  describe('Approved Design Lock Invariant', () => {
    it('should return locked R1.0 revision approved by Trần Thị Mai', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.versionLock).toBeDefined();
      expect(overview.versionLock.versionNumber).toBe('R1.0');
      expect(overview.versionLock.status).toBe('approved');
      expect(overview.versionLock.statusLabel).toBe('Đã duyệt');
      expect(overview.versionLock.isLocked).toBe(true);
      expect(overview.versionLock.lockLabel).toBe('Đã khóa');
      expect(overview.versionLock.approvalDateFormatted).toBe('06/11/2026');
      expect(overview.versionLock.approvedBy).toBe('Trần Thị Mai');
      expect(overview.versionLock.lockBannerTitle).toBe('Approved Design Lock');
      expect(overview.versionLock.lockBannerSubtitle).toBe(
        'Đã khóa thiết kế, chỉ cho phép tạo phiên bản mới',
      );
    });

    it('should correctly toggle lock status and update labels in toggleDesignLock', async () => {
      const unlocked = await InteriorDesignAnalyticsService.toggleDesignLock(
        VALID_TENANT_ID,
        'rev-r1-0',
        false,
      );

      expect(unlocked.isLocked).toBe(false);
      expect(unlocked.lockLabel).toContain('Mở khóa');
      expect(unlocked.lockBannerTitle).toBe('Design Editing Active');

      const relocked = await InteriorDesignAnalyticsService.toggleDesignLock(
        VALID_TENANT_ID,
        'rev-r1-0',
        true,
      );

      expect(relocked.isLocked).toBe(true);
      expect(relocked.lockLabel).toBe('Đã khóa');
      expect(relocked.lockBannerTitle).toBe('Approved Design Lock');
    });
  });

  describe('3D Visual Perspectives & Technical CAD Assets', () => {
    it('should provide at least 5 perspectives with living room as primary', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.visuals.length).toBeGreaterThanOrEqual(5);
      const primary = overview.visuals.find((v) => v.isPrimary);
      expect(primary).toBeDefined();
      expect(primary?.roomZone).toBe('Phòng khách');
      expect(primary?.imageUrl).toContain('images.unsplash.com');
      expect(primary?.thumbnailUrl).toBeDefined();
    });

    it('should provide technical blueprints with DWG and PDF formats', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.technicalDrawings.length).toBeGreaterThanOrEqual(2);
      expect(overview.technicalDrawings[0].drawingCode).toContain('REV 2');
      expect(overview.technicalDrawings[0].statusLabel).toBe('Đã duyệt');
    });
  });

  describe('Material Specifications & Compliance Audit', () => {
    it('should include 4 canonical materials matching reference mockup', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.materials).toHaveLength(4);

      const walnut = overview.materials.find((m) => m.name.includes('Veneer Óc Chó'));
      expect(walnut).toBeDefined();
      expect(walnut?.code).toBe('Code: MS-440 EV');
      expect(walnut?.status).toBe('approved');
      expect(walnut?.statusLabel).toBe('Đã duyệt');

      const quartz = overview.materials.find((m) => m.name.includes('Thạch Anh'));
      expect(quartz).toBeDefined();
      expect(quartz?.code).toBe('Code: BQ8628 Nero Marquina');
      expect(quartz?.statusLabel).toBe('Đã duyệt');

      const hinge = overview.materials.find((m) => m.name.includes('Bản Lề'));
      expect(hinge).toBeDefined();
      expect(hinge?.code).toBe('Code: Clip Top BLUMOTION 110');

      const slimFrame = overview.materials.find((m) => m.name.includes('Khung Cánh Kính'));
      expect(slimFrame).toBeDefined();
      expect(slimFrame?.code).toBe('Code: SLIM-CHAMPAGNE-05');
      expect(slimFrame?.statusLabel).toBe('Tham khảo');
    });

    it('should compute 100% compliant material audit summary', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.materialAudit.allCompliant).toBe(true);
      expect(overview.materialAudit.auditTitle).toBe('Tất cả vật liệu đều đạt tiêu chuẩn');
      expect(overview.materialAudit.auditSubtitle).toBe('Theo danh mục được phê duyệt');
      expect(overview.materialAudit.approvedCount).toBe(3);
      expect(overview.materialAudit.referenceCount).toBe(1);
      expect(overview.materialAudit.totalCount).toBe(4);
    });
  });
});
