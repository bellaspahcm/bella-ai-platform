/**
 * Bounded Context 2: Commercial & Costing
 *
 * Manages furniture BOQ/BOM itemization, tripartite costing (Internal COGS vs Client Price
 * vs Contract Baseline), quotations, discounts, contract milestones and cash flow.
 *
 * @module src/products/bella-interior/domain/commercial-costing
 */

export type FurnitureItemCategory =
  | 'cabinetry'       // Tủ bếp, tủ áo, tủ lavabo, tủ giầy
  | 'loose_furniture' // Bàn ăn, ghế sofa, bàn trà, giường ngủ
  | 'wall_paneling'   // Vách ốp lam sóng, vách nan gỗ, vách bọc nỉ
  | 'stone_work'      // Mặt đá bếp, bàn đảo, đá lavabo
  | 'metal_glass'     // Cánh kính khung nhôm, vách kính phòng tắm
  | 'lighting_fitout' // Đèn ray nam châm, LED cảm ứng
  | 'curtain_soft';   // Rèm vải 2 lớp, thảm trang trí

export interface BOQDimensions {
  readonly width: number;  // mm
  readonly depth: number;  // mm
  readonly height: number; // mm
  readonly unit: 'mm';
}

export interface BOQItemSpecifications {
  readonly carcassMaterial: string;    // Thùng tủ (e.g. MDF chống ẩm lõi xanh Thái Lan phủ Melamine)
  readonly doorFrontMaterial: string;   // Cánh tủ (e.g. Cánh Acrylic bóng gương noline An Cường)
  readonly surfaceFinish: string;      // Bề mặt hoàn thiện
  readonly hardwareSpec: string;       // Phụ kiện ray/bản lề (e.g. Bản lề Blum Clip Top giảm chấn)
  readonly stoneOrGlassSpec?: string;  // Đá/Kính (nếu có)
}

/**
 * Commercial sync lifecycle status for BOQ items synced from Design Takeoff.
 * - 'active': Item is active and included in commercial estimate
 * - 'marked_for_deletion': Component removed from design, proposed for deletion in BOQ
 * - 'deletion_approved': Estimator confirmed removal from client quotation
 * - 'retained_as_deduction': Retained as a deductive addendum item in contract negotiation
 */
export type BOQItemSyncStatus =
  | 'active'
  | 'marked_for_deletion'
  | 'deletion_approved'
  | 'retained_as_deduction';

/**
 * End-to-end 7-field Lineage traceability contract for BOQ Items.
 * Traces every commercial line back to its source technical design and diff.
 */
export interface BOQItemLineage {
  /** Source approved design revision ID */
  readonly sourceDesignRevisionId: string;
  /** Source takeoff extraction run ID */
  readonly sourceTakeoffRunId: string;
  /** Stable persistent component identity across versions */
  readonly sourceStableComponentId: string;
  /** Diff change classification applied to this line */
  readonly diffChangeType: 'added' | 'modified' | 'removed' | 'unchanged' | 'manual';
  /** Timestamp when sync was executed (ISO-8601) */
  readonly syncedAt: string;
  /** Source Diff computation run / fingerprint ID */
  readonly sourceDiffRunId: string;
  /** Source BOQ revision ID that this line originated from */
  readonly sourceBOQRevisionId: string;
}

export interface BOQItem {
  readonly id: string;
  readonly tenantId: string;
  readonly boqId: string;
  readonly roomZoneId: string;
  readonly roomZoneName: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly category: FurnitureItemCategory;
  readonly dimensions: BOQDimensions;
  readonly specifications: BOQItemSpecifications;
  readonly unit: 'bộ' | 'cái' | 'md' | 'm2' | 'gói';
  readonly quantity: number;
  
  // Tripartite Costing Primitives
  readonly internalUnitCost: number;  // Giá vốn nội bộ (Vật tư + Gia công + Nhân công)
  readonly internalTotalCost: number; // internalUnitCost * quantity
  readonly clientUnitPrice: number;   // Đơn giá chào khách hàng
  readonly clientTotalPrice: number;  // clientUnitPrice * quantity
  readonly grossMarginAmount: number; // clientTotalPrice - internalTotalCost
  readonly grossMarginPercent: number;// (grossMarginAmount / clientTotalPrice) * 100

  // Phase 2C Takeoff-to-BOQ Lineage & Workflow Controls
  readonly stableComponentId?: string;
  readonly syncStatus?: BOQItemSyncStatus;
  readonly lineage?: BOQItemLineage;
  readonly pricingPending?: boolean;     // true if added without verified unit price
  readonly priceReviewNeeded?: boolean;  // true if modified specs require estimator review
}

export type BOQStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'locked_for_contract';

export interface InteriorBOQ {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly designRevisionId: string;
  readonly boqNumber: string;
  readonly versionNumber: number;
  readonly status: BOQStatus;
  readonly totalInternalCost: number;   // Tổng giá vốn (COGS)
  readonly totalClientPrice: number;    // Tổng giá bán dự toán
  readonly totalGrossMargin: number;    // Lợi nhuận gộp dự kiến
  readonly grossMarginPercent: number;  // % Tỷ suất lợi nhuận gộp dự kiến
  readonly items: BOQItem[];
  readonly preparedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type QuotationStatus =
  | 'draft'
  | 'sent_to_client'
  | 'negotiating'
  | 'accepted'
  | 'rejected';

export interface InteriorQuotation {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly boqId: string;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly status: QuotationStatus;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly vatPercent: number; // e.g. 8 or 10
  readonly vatAmount: number;
  readonly grandTotal: number;
  readonly paymentTerms: string;
  readonly validityDays: number;
  readonly createdAt: string;

  // Phase 2 Additive Commercial Margin & Lineage Fields
  readonly boqVersionNumber?: number;
  readonly totalInternalCogs?: number;
  readonly totalGrossMargin?: number;
  readonly grossMarginPercent?: number;
  readonly forkedFromQuotationId?: string | null;
  readonly preparedBy?: string;
  readonly approvedBy?: string;
  readonly sentToClientAt?: string | null;
  readonly acceptedAt?: string | null;
  readonly rejectedAt?: string | null;
}

export type PaymentMilestoneStatus =
  | 'pending'
  | 'invoiced'
  | 'paid'
  | 'overdue';

export interface PaymentMilestone {
  readonly id: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly milestoneOrder: number; // 1, 2, 3, 4, 5
  readonly name: string;           // 'Đợt 1: Ký hợp đồng & Tạm ứng'
  readonly percentage: number;     // 30 (%)
  readonly amount: number;         // 30% * contractValue
  readonly triggerCondition: string; // 'Ngay sau khi ký hợp đồng'
  readonly status: PaymentMilestoneStatus;
  readonly dueDate?: string;
  readonly paidAt?: string;

  // Phase 3 Additive Milestone Progress & Financial Reconciliation Fields
  readonly collectedAmount?: number;
  readonly invoiceStatus?: 'unissued' | 'issued' | 'adjusted';
  readonly invoiceNumber?: string;
  readonly invoicedAt?: string;
}

export type InteriorContractStatus =
  | 'draft'
  | 'in_review'
  | 'signed'
  | 'active'
  | 'completed'
  | 'terminated';

export interface ContractAddendum {
  readonly id: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly addendumNumber: string;
  readonly title: string;
  readonly valueDelta: number; // Giá trị phát sinh (+ hoặc -)
  readonly reason: string;
  readonly approvedAt: string;
}

export interface InteriorContract {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly quotationId: string;
  readonly contractNumber: string;
  readonly title: string;
  readonly status: InteriorContractStatus;
  readonly baselineContractValue: number; // Giá trị hợp đồng gốc được chốt
  readonly currentContractValue: number;  // Đã cộng/trừ các phụ lục phát sinh
  readonly signedDate: string;
  readonly clientRepresentative: string;
  readonly contractorRepresentative: string;
  readonly milestones: PaymentMilestone[];
  readonly addenda: ContractAddendum[];

  // Phase 3 Additive Lineage, Schedule & Terms Fields
  readonly quotationNumber?: string;
  readonly quotationVersionNumber?: number;
  readonly boqId?: string;
  readonly boqVersionNumber?: number;
  readonly paymentTerms?: string;
  readonly executionStartDate?: string;
  readonly executionEndDate?: string;
  readonly notes?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

