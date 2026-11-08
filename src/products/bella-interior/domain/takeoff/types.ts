/**
 * Bella Interior OS — Takeoff Domain Types
 *
 * Defines domain entities and value objects for the Takeoff Staging & Review layer.
 * Connects Design Studio (Approved Design Revision) to Commercial BOQ.
 *
 * Implements:
 * 1. Approved Design Lock validation
 * 2. Mandatory Room Zone binding (no floating components)
 * 3. Stable Component Identity (stableComponentId across runs/revisions)
 * 4. Category-flexible dimensions & material specifications
 * 5. Estimator review workflow (pending -> verified / review_required)
 * 6. Completed Run Snapshot Immutability
 *
 * @module src/products/bella-interior/domain/takeoff
 */

export type TakeoffComponentCategory =
  | 'cabinetry'        // Tủ bếp, tủ quần áo, tủ lavabo, tủ giầy, tủ trang trí
  | 'loose_furniture'  // Sofa, bàn trà, bàn ghế ăn, giường ngủ, ghế bành
  | 'wall_paneling'    // Vách ốp lam sóng, vách nan gỗ, ốp nỉ, ốp kính
  | 'stone_work'       // Mặt đá bếp, bàn đảo, lavabo nguyên khối
  | 'metal_glass'      // Cánh kính khung nhôm, vách kính phòng tắm, vách ngăn CNC
  | 'lighting_fitout'  // Đèn ray nam châm, LED cảm ứng, rọi ray spotlight
  | 'curtain_soft'     // Rèm 2 lớp voan lụa, đệm ngồi, thảm sàn
  | 'custom_decorative'; // Gương decor, vách nghệ thuật, kệ độc lập

export type TakeoffComponentUnit = 'bộ' | 'cái' | 'md' | 'm2' | 'gói' | 'mét';

/**
 * Flexible dimensions object.
 * Width/depth/height are optional so each category only tracks applicable measurements.
 */
export interface ComponentDimensions {
  readonly width?: number;               // Chiều rộng / Dài mặt tiền (mm)
  readonly depth?: number;               // Chiều sâu (mm)
  readonly height?: number;              // Chiều cao (mm)
  readonly thickness?: number;           // Độ dày tấm gỗ / mặt đá / kính (mm)
  readonly diameter?: number;            // Đường kính cho bàn tròn, đèn (mm)
  readonly customDimensionText?: string; // Ghi chú kích thước đặc biệt (ví dụ: 'Theo hiện trạng đo đạc')
  readonly unit: 'mm';
}

/**
 * Category-flexible Material Binding.
 * Supports cabinetry (carcass, door front), loose furniture (frame, upholstery, tabletop),
 * finishes and hardware without forcing uniform schema on dissimilar pieces.
 */
export interface ComponentMaterialBinding {
  // Cabinetry / Thùng - Cánh tủ
  readonly carcassMaterialId?: string;      // FK to DesignMaterialSpec
  readonly carcassMaterialName?: string;
  readonly doorFrontMaterialId?: string;    // FK to DesignMaterialSpec
  readonly doorFrontMaterialName?: string;

  // Loose Furniture / Đồ rời
  readonly frameMaterialId?: string;        // Khung sườn (Gỗ tự nhiên, sắt mạ, inox)
  readonly frameMaterialName?: string;
  readonly upholsteryMaterialId?: string;   // Bọc đệm (Da thật, nỉ Hàn Quốc, vải bố)
  readonly upholsteryMaterialName?: string;
  readonly tabletopMaterialId?: string;     // Mặt bàn (Mặt đá cẩm thạch, kính cường lực, gỗ óc chó)
  readonly tabletopMaterialName?: string;

  // Common Specifications & Finishes
  readonly surfaceFinish?: string;          // Sơn PU Inchem, Melamine An Cường, Acrylic, Veneer
  readonly hardwareSpec?: string;           // Phụ kiện: Ray Blum BLUMOTION, Bản lề Hafele
  readonly rawMaterialNotes?: string;       // Ghi chú chi tiết quy cách phụ trợ
}

export type ComponentReviewStatus = 'pending' | 'verified' | 'review_required';

/**
 * Canonical Takeoff Component entity in Takeoff Staging.
 */
export interface DesignTakeoffComponent {
  readonly id: string;                      // Unique ID of this snapshot record
  readonly stableComponentId: string;       // Persistent identity across runs and cloned revisions
  readonly tenantId: string;
  readonly projectId: string;
  readonly takeoffRunId: string;
  readonly designRevisionId: string;        // Reference to approved Design Revision
  readonly roomZoneId: string;              // Must be a valid RoomZone belonging to project
  readonly roomZoneName: string;
  readonly componentCode: string;           // e.g. 'PK-SF-01', 'BEP-TB-01'
  readonly componentName: string;           // e.g. 'Sofa cao cấp 3 chỗ', 'Tủ bếp dưới'
  readonly category: TakeoffComponentCategory;
  readonly dimensions: ComponentDimensions;
  readonly specifications: ComponentMaterialBinding;
  readonly unit: TakeoffComponentUnit;
  readonly quantity: number;
  readonly reviewStatus: ComponentReviewStatus;
  readonly reviewNotes?: string;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;
  readonly sourceDrawingRef?: string;       // Technical drawing asset reference
  readonly source3DVisualRef?: string;      // 3D perspective visual asset reference
  readonly estimatedUnitCost?: number;      // Preliminary internal cost entered by Estimator
  readonly targetUnitPrice?: number;        // Preliminary sales price entered by Estimator
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TakeoffRunStatus = 'draft' | 'under_review' | 'completed' | 'locked';

/**
 * A Takeoff Run represents an extraction / takeoff staging session from an approved Design Revision.
 * Can be cloned to create subsequent runs when design revisions change.
 */
export interface DesignTakeoffRun {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly designRevisionId: string;        // Must reference an approved Design Revision
  readonly runNumber: number;               // 1, 2, 3...
  readonly title: string;                   // e.g. 'Bóc tách cấu kiện đợt 1 (R1.0)'
  readonly status: TakeoffRunStatus;
  readonly isImmutable: boolean;            // true if status is 'completed' or 'locked'
  readonly preparedBy: string;
  readonly completedBy?: string;
  readonly completedAt?: string;
  readonly parentRunId?: string;            // Source run if cloned/inherited
  readonly idempotencyKey?: string;         // Deduplication key
  readonly totalComponentsCount: number;
  readonly pendingReviewCount: number;
  readonly verifiedCount: number;
  readonly reviewRequiredCount: number;
  readonly components: readonly DesignTakeoffComponent[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

// --- DTOs for Service Operations ---

export interface InitializeTakeoffRunInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly designRevisionId: string;
  readonly title: string;
  readonly preparedBy: string;
  readonly idempotencyKey?: string;
}

export interface CreateTakeoffComponentInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly takeoffRunId: string;
  readonly roomZoneId: string;
  readonly componentCode: string;
  readonly componentName: string;
  readonly category: TakeoffComponentCategory;
  readonly dimensions?: Partial<ComponentDimensions>;
  readonly specifications?: Partial<ComponentMaterialBinding>;
  readonly unit: TakeoffComponentUnit;
  readonly quantity: number;
  readonly stableComponentId?: string;     // If inheriting from an existing component, preserve it!
  readonly estimatedUnitCost?: number;
  readonly targetUnitPrice?: number;
  readonly sourceDrawingRef?: string;
  readonly source3DVisualRef?: string;
  readonly notes?: string;
}

export interface UpdateTakeoffComponentInput {
  readonly componentCode?: string;
  readonly componentName?: string;
  readonly category?: TakeoffComponentCategory;
  readonly roomZoneId?: string;
  readonly dimensions?: Partial<ComponentDimensions>;
  readonly specifications?: Partial<ComponentMaterialBinding>;
  readonly unit?: TakeoffComponentUnit;
  readonly quantity?: number;
  readonly estimatedUnitCost?: number;
  readonly targetUnitPrice?: number;
  readonly sourceDrawingRef?: string;
  readonly source3DVisualRef?: string;
  readonly notes?: string;
}

export interface ReviewTakeoffComponentInput {
  readonly status: ComponentReviewStatus;
  readonly reviewerName: string;
  readonly reviewNotes?: string;
}

export interface CloneTakeoffRunInput {
  readonly tenantId: string;
  readonly sourceRunId: string;
  readonly targetDesignRevisionId: string;
  readonly newTitle: string;
  readonly preparedBy: string;
  readonly idempotencyKey?: string;
}

