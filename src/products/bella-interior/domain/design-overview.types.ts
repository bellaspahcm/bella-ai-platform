/**
 * Bella Interior OS — Design Studio Canonical Domain Types
 *
 * Single Source of Truth for Design Studio, Approved Design Lock,
 * 3D visual perspectives, technical blueprints, and material specifications.
 * Zero logic in UI: All calculations, formatting, badges, and statuses are computed server-side.
 *
 * @module src/products/bella-interior/domain/design-overview.types
 */

export type DesignVersionStatus = 'draft' | 'review' | 'approved' | 'rejected';
export type DesignVisualCategory = '3d' | 'technical' | 'document';
export type MaterialApprovalStatus = 'approved' | 'reference' | 'pending';

export interface DesignProjectHeader {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly breadcrumbLabel: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
  readonly clientName: string;
  readonly contractValueFormatted: string;
}

export interface DesignVersionLockInfo {
  readonly versionId: string;
  readonly versionNumber: string; // e.g. "R1.0"
  readonly status: DesignVersionStatus;
  readonly statusLabel: string; // e.g. "Đã duyệt"
  readonly statusBadgeClass: string;
  readonly isLocked: boolean;
  readonly lockLabel: string; // e.g. "Đã khóa"
  readonly lockBadgeClass: string;
  readonly approvalDateFormatted: string; // e.g. "06/11/2026"
  readonly approvedBy: string; // e.g. "Trần Thị Mai"
  readonly description: string; // e.g. "Phiên bản thiết kế chính thức"
  readonly lockBannerTitle: string; // e.g. "Approved Design Lock"
  readonly lockBannerSubtitle: string; // e.g. "Đã khóa thiết kế, chỉ cho phép tạo phiên bản mới"
  readonly canUnlock: boolean;
}

export interface DesignVisualItem {
  readonly id: string;
  readonly title: string;
  readonly roomZone: string;
  readonly category: DesignVisualCategory;
  readonly categoryLabel: string;
  readonly imageUrl: string;
  readonly thumbnailUrl: string;
  readonly isPrimary: boolean;
  readonly viewAngleName: string;
  readonly resolution?: string;
  readonly fileFormat?: string;
  readonly updatedDateFormatted?: string;
  readonly authorName?: string;
}

export interface DesignTechnicalDrawingItem {
  readonly id: string;
  readonly title: string;
  readonly drawingCode: string; // e.g. "REV 2", "DWG-01"
  readonly fileType: string; // "DWG", "PDF"
  readonly author: string;
  readonly updatedDateFormatted: string;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
  readonly fileUrl: string;
  readonly fileSize: string;
}

export interface DesignDocumentItem {
  readonly id: string;
  readonly title: string;
  readonly documentCategory: string;
  readonly fileType: string;
  readonly author: string;
  readonly updatedDateFormatted: string;
  readonly fileSize: string;
  readonly fileUrl: string;
}

export interface DesignMaterialItem {
  readonly id: string;
  readonly name: string; // e.g. "Veneer Óc Chó Bắc Mỹ"
  readonly code: string; // e.g. "Code: MS-440 EV"
  readonly brand: string; // e.g. "An Cường"
  readonly specification: string; // e.g. "Hoàn thiện sơn bóng mờ 50% PU cao cấp"
  readonly usageArea: string; // e.g. "Phòng khách / Vách ốp"
  readonly status: MaterialApprovalStatus;
  readonly statusLabel: string; // "Đã duyệt" | "Tham khảo"
  readonly statusBadgeClass: string;
  readonly thumbnailImage: string;
}

export interface DesignMaterialAudit {
  readonly allCompliant: boolean;
  readonly auditTitle: string; // "Tất cả vật liệu đều đạt tiêu chuẩn"
  readonly auditSubtitle: string; // "Theo danh mục được phê duyệt"
  readonly approvedCount: number;
  readonly referenceCount: number;
  readonly totalCount: number;
}

export interface DesignSubNavTab {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly isActive: boolean;
  readonly badge?: string;
}

export interface CreateVisualPerspectiveInput {
  readonly title: string;
  readonly roomZone: string;
  readonly imageUrl: string;
  readonly thumbnailUrl?: string;
  readonly isPrimary?: boolean;
  readonly viewAngleName?: string;
  readonly resolution?: string;
  readonly fileFormat?: string;
  readonly authorName?: string;
}

export interface CreateTechnicalDrawingInput {
  readonly title: string;
  readonly drawingCode: string; // e.g. "REV 3 - ARCH-02"
  readonly fileType: string; // "DWG" | "PDF" | "CAD" | "DXF"
  readonly author: string;
  readonly fileUrl: string;
  readonly fileSize?: string;
  readonly statusLabel?: string;
}

export interface CreateDesignDocumentInput {
  readonly title: string;
  readonly documentCategory: string;
  readonly fileType: string;
  readonly author: string;
  readonly fileUrl: string;
  readonly fileSize?: string;
}

export interface DesignStudioOverviewResponse {
  readonly tenantId: string;
  readonly project: DesignProjectHeader;
  readonly versionLock: DesignVersionLockInfo;
  readonly activeTab: 'design';
  readonly subTabs: readonly DesignSubNavTab[];
  readonly visuals: readonly DesignVisualItem[];
  readonly technicalDrawings: readonly DesignTechnicalDrawingItem[];
  readonly relatedDocuments: readonly DesignDocumentItem[];
  readonly materials: readonly DesignMaterialItem[];
  readonly materialAudit: DesignMaterialAudit;
  readonly availableVersions: readonly {
    readonly versionNumber: string;
    readonly status: string;
    readonly isCurrent: boolean;
  }[];
}
