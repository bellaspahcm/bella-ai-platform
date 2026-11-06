/**
 * Bounded Context 1: Design & Specification
 *
 * Manages interior projects, room/zone hierarchies, design revisions (3D concept,
 * 2D technical drawings, moodboards), materials & hardware specs, and customer approval lock.
 *
 * @module src/products/bella-interior/domain/design-specification
 */

export type InteriorProjectType =
  | 'residential_villa'
  | 'residential_apartment'
  | 'residential_townhouse'
  | 'commercial_office'
  | 'hospitality_resort'
  | 'retail_showroom';

export type InteriorProjectStatus =
  | 'survey'
  | 'concept_design'
  | 'technical_design'
  | 'estimation'
  | 'contracted'
  | 'in_production'
  | 'installing'
  | 'handover'
  | 'completed'
  | 'warranty';

export interface ProjectRoomZone {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly code: string; // e.g. 'R01_LIVING', 'R02_KITCHEN'
  readonly name: string; // e.g. 'Phòng khách', 'Bếp & Phòng ăn'
  readonly floor: number;
  readonly areaSquareMeters?: number;
  readonly description?: string;
}

export type DesignAssetType =
  | 'concept_3d'
  | 'technical_2d'
  | 'moodboard'
  | 'cad_dwg'
  | 'pdf_drawing';

export interface DesignAsset {
  readonly id: string;
  readonly tenantId: string;
  readonly revisionId: string;
  readonly type: DesignAssetType;
  readonly title: string;
  readonly fileUrl: string;
  readonly roomZoneId?: string;
  readonly notes?: string;
}

export type MaterialCategory =
  | 'wood_board'       // MDF chống ẩm, MFC, Plywood, Gỗ sồi tự nhiên
  | 'surface_finish'  // Melamine An Cường, Acrylic, Veneer óc chó, Sơn bệt Inchem
  | 'stone'           // Đá tự nhiên Marble, Vicostone thạch anh, Granite
  | 'hardware'        // Bản lề giảm chấn, ray trượt Blum, tay nắm Hafele
  | 'lighting'        // Đèn LED thanh nhôm định hình, rọi ray spotlight
  | 'glass_metal';    // Khung nhôm slim, kính cường lực xám khói

export interface DesignMaterialSpec {
  readonly id: string;
  readonly tenantId: string;
  readonly revisionId: string;
  readonly itemCategory: MaterialCategory;
  readonly brand: string; // e.g. 'An Cường', 'Blum', 'Vicostone'
  readonly code: string;  // e.g. 'MS 440 EV', 'Clip Top 110 BLUMOTION'
  readonly name: string;
  readonly colorTone?: string;
  readonly specDescription: string;
  readonly approvedForUse: boolean;
}

export type DesignRevisionStatus =
  | 'draft'
  | 'in_review'
  | 'client_review'
  | 'approved'
  | 'rejected'
  | 'superseded';

export interface DesignRevision {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly versionNumber: number; // 1, 2, 3...
  readonly title: string;
  readonly status: DesignRevisionStatus;
  readonly changeSummary?: string;
  readonly submittedBy: string;
  readonly submittedAt: string;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly clientSignoffName?: string;
  readonly clientSignoffDate?: string;
  readonly assets: DesignAsset[];
  readonly materialSpecs: DesignMaterialSpec[];
}

export interface InteriorProject {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string; // e.g. 'INT-2026-001'
  readonly name: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly siteAddress: string;
  readonly projectType: InteriorProjectType;
  readonly status: InteriorProjectStatus;
  readonly estimatedBudget: number;
  readonly targetCompletionDate: string;
  readonly leadArchitectId: string;
  readonly leadArchitectName: string;
  readonly activeApprovedRevisionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

