/**
 * Bella Interior OS — Design Studio Canonical Analytics Domain Service
 *
 * Single Source of Truth for Design Studio, Approved Design Lock,
 * 3D Perspectives, Technical Blueprints, and Material Specifications.
 * Implements strict tenant isolation and pure server-side analytical calculations.
 * Client UI components MUST consume precomputed outputs from this service.
 *
 * @module src/products/bella-interior/services/interior-design-analytics.service
 */

import { TenantIsolationViolationError } from '../domain/errors';
import type {
  DesignStudioOverviewResponse,
  DesignProjectHeader,
  DesignVersionLockInfo,
  DesignVisualItem,
  DesignTechnicalDrawingItem,
  DesignDocumentItem,
  DesignMaterialItem,
  DesignMaterialAudit,
  DesignSubNavTab,
} from '../domain/design-overview.types';

export class InteriorDesignAnalyticsService {
  /**
   * Predefined Sub-Navigation Tabs for Bella Interior OS Project Lifecycle
   */
  public static readonly SUB_NAV_TABS: readonly DesignSubNavTab[] = [
    { key: 'overview', label: 'Tổng quan', href: '/dashboard/interior/projects', isActive: false },
    { key: 'design', label: 'Thiết kế', href: '/dashboard/interior/design', isActive: true },
    { key: 'materials', label: 'Vật liệu', href: '/dashboard/interior/materials', isActive: false },
    { key: 'boq', label: 'BOQ & Dự toán', href: '/dashboard/interior/boq', isActive: false },
    { key: 'production', label: 'Sản xuất', href: '/dashboard/interior/production', isActive: false },
    { key: 'installation', label: 'Thi công', href: '/dashboard/interior/installation', isActive: false },
    { key: 'reports', label: 'Báo cáo', href: '/dashboard/interior/reports', isActive: false },
  ];

  /**
   * Canonical Project Header Data matching executive reference
   */
  public static readonly CANONICAL_PROJECT: DesignProjectHeader = {
    id: 'proj-villa-sunrise',
    code: 'INT-2024-001',
    name: 'Villa Sunrise Renovation',
    breadcrumbLabel: 'Dự án > Villa Sunrise Renovation (INT-2024-001)',
    status: 'in_progress',
    statusLabel: 'Đang thực hiện',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    clientName: 'Trần Thị Mai',
    contractValueFormatted: '3.85 tỷ',
  };

  /**
   * Canonical Version Lock Information matching reference design
   */
  public static readonly CANONICAL_VERSION_LOCK: DesignVersionLockInfo = {
    versionId: 'rev-r1-0',
    versionNumber: 'R1.0',
    status: 'approved',
    statusLabel: 'Đã duyệt',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    isLocked: true,
    lockLabel: 'Đã khóa',
    lockBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    approvalDateFormatted: '06/11/2026',
    approvedBy: 'Trần Thị Mai',
    description: 'Phiên bản thiết kế chính thức',
    lockBannerTitle: 'Approved Design Lock',
    lockBannerSubtitle: 'Đã khóa thiết kế, chỉ cho phép tạo phiên bản mới',
    canUnlock: true,
  };

  /**
   * Canonical 3D Perspectives and Visual Renderings
   */
  public static readonly CANONICAL_VISUALS: readonly DesignVisualItem[] = [
    {
      id: 'vis-1',
      title: 'Phối cảnh Phòng khách & Bàn trà',
      roomZone: 'Phòng khách',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=300&q=80',
      isPrimary: true,
      viewAngleName: 'Góc nhìn chính (Chính diện sofa & bàn trà tròn)',
      resolution: '4K Ultra-HD (3840x2160)',
      fileFormat: '3ds Max / Corona Render',
      updatedDateFormatted: '06/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-2',
      title: 'Khu vực Bàn ăn & Đèn chùm thả',
      roomZone: 'Phòng ăn',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn phòng ăn liên thông',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '05/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-3',
      title: 'Phòng ngủ Master & Hệ vách ốp đầu giường',
      roomZone: 'Phòng ngủ Master',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn tổng thể giường ngủ',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '05/11/2026',
      authorName: 'KTS. Lê Hoàng',
    },
    {
      id: 'vis-4',
      title: 'Không gian Bếp đảo & Tủ bếp Acrylic',
      roomZone: 'Bếp & Đảo bếp',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn đảo bếp & tủ bếp kịch trần',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '04/11/2026',
      authorName: 'KTS. Lê Hoàng',
    },
    {
      id: 'vis-5',
      title: 'Phòng làm việc & Hệ tủ sách kính Slim',
      roomZone: 'Phòng làm việc',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc làm việc & view sân vườn',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '04/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-6',
      title: 'Phòng tắm Master & Lavabo đá Vicostone',
      roomZone: 'Phòng tắm Master',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc bồn tắm & lavabo',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '03/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-7',
      title: 'Sảnh đón & Tủ giày cánh kính',
      roomZone: 'Sảnh đón',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc sảnh vào & gương trang trí',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '03/11/2026',
      authorName: 'KTS. Lê Hoàng',
    },
  ];

  /**
   * Canonical Technical Drawings & CAD Blueprints
   */
  public static readonly CANONICAL_TECHNICAL_DRAWINGS: readonly DesignTechnicalDrawingItem[] = [
    {
      id: 'dwg-1',
      title: 'Mặt bằng bố trí nội thất tầng 1 & tầng 2',
      drawingCode: 'REV 2 - ARCH-01',
      fileType: 'DWG',
      author: 'KTS. Hoàng Long',
      updatedDateFormatted: '06/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-ARCH-01.dwg',
      fileSize: '14.8 MB',
    },
    {
      id: 'dwg-2',
      title: 'Chi tiết mặt cắt kỹ thuật bổ đồ gỗ nội thất',
      drawingCode: 'REV 2 - DET-02',
      fileType: 'DWG',
      author: 'KTS. Lê Hoàng',
      updatedDateFormatted: '06/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-DET-02.dwg',
      fileSize: '22.4 MB',
    },
    {
      id: 'dwg-3',
      title: 'Sơ đồ định vị ổ cắm, công tắc & chiếu sáng thông minh',
      drawingCode: 'REV 1 - MEP-01',
      fileType: 'PDF',
      author: 'KS. Nguyễn Văn Tuấn',
      updatedDateFormatted: '04/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-MEP-01.pdf',
      fileSize: '8.2 MB',
    },
  ];

  /**
   * Canonical Related Documents & Specifications
   */
  public static readonly CANONICAL_DOCUMENTS: readonly DesignDocumentItem[] = [
    {
      id: 'doc-1',
      title: 'Hồ sơ chỉ dẫn kỹ thuật & tiêu chuẩn thi công gỗ óc chó',
      documentCategory: 'Chỉ dẫn kỹ thuật',
      fileType: 'PDF',
      author: 'Phòng Kỹ Thuật Bella',
      updatedDateFormatted: '06/11/2026',
      fileSize: '4.5 MB',
      fileUrl: '/docs/spec-walnut-wood.pdf',
    },
    {
      id: 'doc-2',
      title: 'Biên bản nghiệm thu hồ sơ thiết kế ý tưởng (Concept Sign-off)',
      documentCategory: 'Biên bản phê duyệt',
      fileType: 'PDF',
      author: 'Trần Thị Mai',
      updatedDateFormatted: '06/11/2026',
      fileSize: '1.2 MB',
      fileUrl: '/docs/concept-signoff.pdf',
    },
    {
      id: 'doc-3',
      title: 'Bảng mẫu vật liệu thực tế (Physical Moodboard & Material Swatch)',
      documentCategory: 'Moodboard',
      fileType: 'PDF',
      author: 'KTS. Hoàng Long',
      updatedDateFormatted: '02/11/2026',
      fileSize: '18.6 MB',
      fileUrl: '/docs/moodboard-samples.pdf',
    },
  ];

  /**
   * Canonical Materials and Hardware Specifications matching reference screen
   */
  public static readonly CANONICAL_MATERIALS: readonly DesignMaterialItem[] = [
    {
      id: 'mat-1',
      name: 'Veneer Óc Chó Bắc Mỹ',
      code: 'Code: MS-440 EV',
      brand: 'An Cường',
      specification: 'Hoàn thiện sơn bóng mờ 50% PU cao cấp',
      usageArea: 'Vách ốp phòng khách, kệ tivi, bàn trà',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-2',
      name: 'Đá Thạch Anh Nhân Tạo',
      code: 'Code: BQ8628 Nero Marquina',
      brand: 'Vicostone',
      specification: 'Dày 20mm, bo mài 45 độ',
      usageArea: 'Mặt bàn trà, mặt đảo bếp, lavabo',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-3',
      name: 'Bản Lề Giảm Chấn Thép',
      code: 'Code: Clip Top BLUMOTION 110',
      brand: 'Blum (Áo)',
      specification: 'Bảo hành 5 năm',
      usageArea: 'Hệ cánh tủ áo, tủ bếp, tủ giày',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-4',
      name: 'Khung Cánh Kính Slim',
      code: 'Code: SLIM-CHAMPAGNE-05',
      brand: 'Bella Slim Aluminium',
      specification: 'Kính xám khói cường lực 5mm',
      usageArea: 'Tủ rượu trang trí, tủ áo walk-in closet',
      status: 'reference',
      statusLabel: 'Tham khảo',
      statusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=200&q=80',
    },
  ];

  /**
   * Precomputed Material Audit Invariant
   */
  public static readonly CANONICAL_MATERIAL_AUDIT: DesignMaterialAudit = {
    allCompliant: true,
    auditTitle: 'Tất cả vật liệu đều đạt tiêu chuẩn',
    auditSubtitle: 'Theo danh mục được phê duyệt',
    approvedCount: 3,
    referenceCount: 1,
    totalCount: 4,
  };

  /**
   * Available design versions in repository
   */
  public static readonly CANONICAL_AVAILABLE_VERSIONS = [
    { versionNumber: 'R1.0', status: 'Approved – Locked', isCurrent: true },
    { versionNumber: 'R1.1', status: 'Draft – Editing', isCurrent: false },
    { versionNumber: 'R0.9', status: 'Concept Review', isCurrent: false },
  ];

  /**
   * Resolves the complete canonical Design Studio Overview for a project
   *
   * @param tenantId Tenant Identifier (Mandatory Gate 0)
   * @param projectId Project Identifier (Optional filter)
   */
  public static async getDesignStudioOverview(
    tenantId: string,
    projectId?: string,
  ): Promise<DesignStudioOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    return {
      tenantId,
      project: this.CANONICAL_PROJECT,
      versionLock: this.CANONICAL_VERSION_LOCK,
      activeTab: 'design',
      subTabs: this.SUB_NAV_TABS,
      visuals: this.CANONICAL_VISUALS,
      technicalDrawings: this.CANONICAL_TECHNICAL_DRAWINGS,
      relatedDocuments: this.CANONICAL_DOCUMENTS,
      materials: this.CANONICAL_MATERIALS,
      materialAudit: this.CANONICAL_MATERIAL_AUDIT,
      availableVersions: this.CANONICAL_AVAILABLE_VERSIONS,
    };
  }

  /**
   * Toggles or updates the Approved Design Lock
   *
   * @param tenantId Tenant Identifier (Mandatory Gate 0)
   * @param versionId Revision Identifier
   * @param lockState Target lock state (true = locked, false = unlocked)
   */
  public static async toggleDesignLock(
    tenantId: string,
    versionId: string,
    lockState?: boolean,
  ): Promise<DesignVersionLockInfo> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const currentLock = this.CANONICAL_VERSION_LOCK;
    const isNowLocked = lockState !== undefined ? lockState : !currentLock.isLocked;

    return {
      ...currentLock,
      versionId: versionId || currentLock.versionId,
      isLocked: isNowLocked,
      lockLabel: isNowLocked ? 'Đã khóa' : 'Mở khóa (Đang sửa đổi)',
      lockBadgeClass: isNowLocked
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200',
      lockBannerTitle: isNowLocked ? 'Approved Design Lock' : 'Design Editing Active',
      lockBannerSubtitle: isNowLocked
        ? 'Đã khóa thiết kế, chỉ cho phép tạo phiên bản mới'
        : 'Thiết kế đang mở khóa cho phép cập nhật thông số',
      canUnlock: true,
    };
  }
}
