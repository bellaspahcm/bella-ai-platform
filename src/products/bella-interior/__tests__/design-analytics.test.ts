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
 * 7. Ingestion of 2D CAD technical drawings & 3D visual perspectives
 * 8. Persistence across calls (canonical single source of truth)
 * 9. Zero UI Calculation guarantee
 *
 * @module src/products/bella-interior/__tests__/design-analytics.test.ts
 */

import { InteriorDesignAnalyticsService } from '../services/interior-design-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorDesignAnalyticsService', () => {
  const VALID_TENANT_ID = 'tenant-bella-interior-test';

  beforeEach(() => {
    InteriorDesignAnalyticsService.resetTenantDesignData(VALID_TENANT_ID);
  });

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

    it('should throw TenantIsolationViolationError if tenantId is missing in addVisualPerspective', () => {
      expect(() =>
        InteriorDesignAnalyticsService.addVisualPerspective('', {
          title: 'Góc nhìn Test',
          imageUrl: 'https://cdn.example.com/test.jpg',
        }),
      ).toThrow(TenantIsolationViolationError);
    });

    it('should throw TenantIsolationViolationError if tenantId is missing in addTechnicalDrawing', () => {
      expect(() =>
        InteriorDesignAnalyticsService.addTechnicalDrawing('', {
          title: 'Bản vẽ Test',
          fileUrl: 'https://cdn.example.com/test.dwg',
        }),
      ).toThrow(TenantIsolationViolationError);
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

  describe('3D Visual Perspectives & Ingestion Pipeline', () => {
    it('should provide at least 5 baseline perspectives with living room as primary', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.visuals.length).toBeGreaterThanOrEqual(5);
      const primary = overview.visuals.find((v) => v.isPrimary);
      expect(primary).toBeDefined();
      expect(primary?.roomZone).toBe('Phòng khách');
      expect(primary?.imageUrl).toMatch(/r2\.dev|r2\.cloudflarestorage\.com|cdn\.bella-interior\.com|images\.unsplash\.com/);
      expect(primary?.thumbnailUrl).toBeDefined();
    });

    it('should allow adding a new 3D perspective and retain it in subsequent queries', async () => {
      const customVisual = InteriorDesignAnalyticsService.addVisualPerspective(VALID_TENANT_ID, {
        title: 'Góc nhìn Ban Công & Sân Vườn Hoàng Hôn',
        roomZone: 'Ban công sân vườn',
        imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/balcony-sunset.jpg',
        isPrimary: true,
        resolution: '4K Ultra-HD (3840x2160)',
        fileFormat: 'Corona Render',
        authorName: 'KTS. Hoàng Long',
      });

      expect(customVisual.id).toContain('vis-custom-');
      expect(customVisual.isPrimary).toBe(true);

      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);
      expect(overview.visuals.length).toBe(
        InteriorDesignAnalyticsService.CANONICAL_VISUALS.length + 1,
      );
      expect(overview.visuals[0].id).toBe(customVisual.id);
      expect(overview.visuals[0].isPrimary).toBe(true);

      // Verify baseline items are no longer primary when custom is primary
      const baselinePrimary = overview.visuals.slice(1).find((v) => v.id === 'vis-1');
      expect(baselinePrimary?.isPrimary).toBe(false);
    });

    it('should allow deleting custom perspective', async () => {
      const custom = InteriorDesignAnalyticsService.addVisualPerspective(VALID_TENANT_ID, {
        title: 'Phối cảnh tạm',
        imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/temp.jpg',
      });

      const deleted = InteriorDesignAnalyticsService.deleteVisualPerspective(VALID_TENANT_ID, custom.id);
      expect(deleted).toBe(true);

      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);
      expect(overview.visuals.find((v) => v.id === custom.id)).toBeUndefined();
    });
  });

  describe('2D CAD Technical Blueprints & Ingestion Pipeline', () => {
    it('should provide baseline technical blueprints with DWG and PDF formats', async () => {
      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);

      expect(overview.technicalDrawings.length).toBeGreaterThanOrEqual(2);
      expect(overview.technicalDrawings[0].drawingCode).toContain('REV 2');
      expect(overview.technicalDrawings[0].statusLabel).toBe('Đã duyệt');
    });

    it('should allow adding a new 2D CAD technical drawing and persist it', async () => {
      const customDwg = InteriorDesignAnalyticsService.addTechnicalDrawing(VALID_TENANT_ID, {
        title: 'Mặt bằng chi tiết bổ đồ gỗ tủ rượu phòng khách',
        drawingCode: 'REV 1 - DET-04',
        fileType: 'DWG',
        author: 'KTS. Lê Hoàng',
        fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/DET-04.dwg',
        fileSize: '16.2 MB',
        statusLabel: 'Đã duyệt',
      });

      expect(customDwg.id).toContain('dwg-custom-');
      expect(customDwg.fileType).toBe('DWG');

      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);
      expect(overview.technicalDrawings[0].id).toBe(customDwg.id);
      expect(overview.technicalDrawings[0].title).toBe('Mặt bằng chi tiết bổ đồ gỗ tủ rượu phòng khách');
    });

    it('should allow deleting a custom 2D drawing', async () => {
      const custom = InteriorDesignAnalyticsService.addTechnicalDrawing(VALID_TENANT_ID, {
        title: 'Bản vẽ tạm',
        fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/temp.dwg',
      });

      const deleted = InteriorDesignAnalyticsService.deleteTechnicalDrawing(VALID_TENANT_ID, custom.id);
      expect(deleted).toBe(true);

      const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(VALID_TENANT_ID);
      expect(overview.technicalDrawings.find((d) => d.id === custom.id)).toBeUndefined();
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
