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
  CreateVisualPerspectiveInput,
  CreateTechnicalDrawingInput,
  CreateDesignDocumentInput,
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bathroom-design.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bathroom-design.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/accent-wall-detail.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/wood-panel.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
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
   * In-memory intermediate canonical store for tenant custom visual perspectives,
   * 2D CAD technical drawings, and engineering documents.
   * Ensures zero data loss across page refreshes (F5) and serves as single source of truth.
   */
  private static readonly tenantCustomVisuals: Map<string, DesignVisualItem[]> = new Map();
  private static readonly tenantCustomDrawings: Map<string, DesignTechnicalDrawingItem[]> = new Map();
  private static readonly tenantCustomDocuments: Map<string, DesignDocumentItem[]> = new Map();

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

    const customVisuals = this.tenantCustomVisuals.get(tenantId) || [];
    const customDrawings = this.tenantCustomDrawings.get(tenantId) || [];
    const customDocs = this.tenantCustomDocuments.get(tenantId) || [];

    // Merge custom visuals with canonical visuals
    let allVisuals = [...customVisuals, ...this.CANONICAL_VISUALS];
    const hasCustomPrimary = customVisuals.some((v) => v.isPrimary);
    if (hasCustomPrimary) {
      const primaryId = customVisuals.find((v) => v.isPrimary)?.id;
      allVisuals = allVisuals.map((v) => ({
        ...v,
        isPrimary: v.id === primaryId,
      }));
    }

    const allDrawings = [...customDrawings, ...this.CANONICAL_TECHNICAL_DRAWINGS];
    const allDocs = [...customDocs, ...this.CANONICAL_DOCUMENTS];

    return {
      tenantId,
      project: this.CANONICAL_PROJECT,
      versionLock: this.CANONICAL_VERSION_LOCK,
      activeTab: 'design',
      subTabs: this.SUB_NAV_TABS,
      visuals: allVisuals,
      technicalDrawings: allDrawings,
      relatedDocuments: allDocs,
      materials: this.CANONICAL_MATERIALS,
      materialAudit: this.CANONICAL_MATERIAL_AUDIT,
      availableVersions: this.CANONICAL_AVAILABLE_VERSIONS,
    };
  }

  /**
   * Adds a new 3D visual perspective to the tenant's canonical portfolio
   */
  public static addVisualPerspective(
    tenantId: string,
    input: CreateVisualPerspectiveInput,
  ): DesignVisualItem {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    if (!input.title || input.title.trim() === '') {
      throw new Error('Tiêu đề phối cảnh là bắt buộc');
    }
    if (!input.imageUrl || input.imageUrl.trim() === '') {
      throw new Error('Đường dẫn hình ảnh phối cảnh là bắt buộc');
    }

    const newId = `vis-custom-${Date.now()}`;
    const newItem: DesignVisualItem = {
      id: newId,
      title: input.title.trim(),
      roomZone: input.roomZone || 'Không gian chung',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl || input.imageUrl,
      isPrimary: Boolean(input.isPrimary),
      viewAngleName: input.viewAngleName || 'Phối cảnh thiết kế mới',
      resolution: input.resolution || '4K Ultra-HD (3840x2160)',
      fileFormat: input.fileFormat || 'Corona Render',
      updatedDateFormatted: '08/11/2026',
      authorName: input.authorName || 'KTS. Bella Interior',
    };

    const currentList = this.tenantCustomVisuals.get(tenantId) || [];
    // If new item is primary, unset primary on previous custom items
    const updatedList = input.isPrimary
      ? currentList.map((v) => ({ ...v, isPrimary: false }))
      : [...currentList];

    updatedList.unshift(newItem);
    this.tenantCustomVisuals.set(tenantId, updatedList);
    return newItem;
  }

  /**
   * Adds a new 2D technical CAD/DWG/PDF drawing to the tenant's portfolio
   */
  public static addTechnicalDrawing(
    tenantId: string,
    input: CreateTechnicalDrawingInput,
  ): DesignTechnicalDrawingItem {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    if (!input.title || input.title.trim() === '') {
      throw new Error('Tên bản vẽ kỹ thuật là bắt buộc');
    }
    if (!input.fileUrl || input.fileUrl.trim() === '') {
      throw new Error('Tệp bản vẽ là bắt buộc');
    }

    const newId = `dwg-custom-${Date.now()}`;
    const fileTypeUpper = (input.fileType || 'DWG').toUpperCase();
    const newItem: DesignTechnicalDrawingItem = {
      id: newId,
      title: input.title.trim(),
      drawingCode: input.drawingCode?.trim() || `REV 1 - DWG-${String(Date.now()).slice(-4)}`,
      fileType: fileTypeUpper,
      author: input.author?.trim() || 'KTS. Bella Interior',
      updatedDateFormatted: '08/11/2026',
      statusLabel: input.statusLabel || 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: input.fileUrl,
      fileSize: input.fileSize || '12.5 MB',
    };

    const current = this.tenantCustomDrawings.get(tenantId) || [];
    current.unshift(newItem);
    this.tenantCustomDrawings.set(tenantId, current);
    return newItem;
  }

  /**
   * Adds a new specification or design document to the tenant's portfolio
   */
  public static addDesignDocument(
    tenantId: string,
    input: CreateDesignDocumentInput,
  ): DesignDocumentItem {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    if (!input.title || input.title.trim() === '') {
      throw new Error('Tên tài liệu là bắt buộc');
    }

    const newId = `doc-custom-${Date.now()}`;
    const newItem: DesignDocumentItem = {
      id: newId,
      title: input.title.trim(),
      documentCategory: input.documentCategory || 'Hồ sơ thiết kế',
      fileType: (input.fileType || 'PDF').toUpperCase(),
      author: input.author?.trim() || 'Bella Interior',
      updatedDateFormatted: '08/11/2026',
      fileSize: input.fileSize || '3.2 MB',
      fileUrl: input.fileUrl,
    };

    const current = this.tenantCustomDocuments.get(tenantId) || [];
    current.unshift(newItem);
    this.tenantCustomDocuments.set(tenantId, current);
    return newItem;
  }

  /**
   * Deletes a visual perspective
   */
  public static deleteVisualPerspective(tenantId: string, visualId: string): boolean {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    const current = this.tenantCustomVisuals.get(tenantId) || [];
    const filtered = current.filter((v) => v.id !== visualId);
    this.tenantCustomVisuals.set(tenantId, filtered);
    return filtered.length < current.length;
  }

  /**
   * Deletes a technical drawing
   */
  public static deleteTechnicalDrawing(tenantId: string, drawingId: string): boolean {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    const current = this.tenantCustomDrawings.get(tenantId) || [];
    const filtered = current.filter((d) => d.id !== drawingId);
    this.tenantCustomDrawings.set(tenantId, filtered);
    return filtered.length < current.length;
  }

  /**
   * Resets tenant custom designs (used for unit testing)
   */
  public static resetTenantDesignData(tenantId: string): void {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    this.tenantCustomVisuals.delete(tenantId);
    this.tenantCustomDrawings.delete(tenantId);
    this.tenantCustomDocuments.delete(tenantId);
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
