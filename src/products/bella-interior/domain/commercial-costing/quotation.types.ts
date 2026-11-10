/**
 * Bella Interior OS — Quotation & Commercial Margin Domain Types (Phase 2)
 *
 * Defines contracts for Quotations, Tiered Markups, Cost Breakdowns,
 * Commercial Profitability Analysis, and the strict Authorization Boundary
 * separating Client-Facing Views from Internal Costing Views.
 *
 * @module src/products/bella-interior/domain/commercial-costing/quotation.types
 */

import type { FurnitureItemCategory, QuotationStatus } from './types';

// ---------------------------------------------------------------------------
// Tiered Markup Configuration
// ---------------------------------------------------------------------------

export type CategoryMarkupMap = Record<FurnitureItemCategory, number>;

export interface TieredMarkupConfig {
  /** Target gross margin threshold % below which a warning is raised (e.g. 22%) */
  readonly minimumGrossMarginPercent: number;
  /** Default markup % applied if category not specifically mapped */
  readonly defaultMarkupPercent: number;
  /** Category-specific markup percentages on internal COGS */
  readonly categoryMarkups: CategoryMarkupMap;
}

export const CANONICAL_TIERED_MARKUP_CONFIG: TieredMarkupConfig = {
  minimumGrossMarginPercent: 22.0,
  defaultMarkupPercent: 25.0,
  categoryMarkups: {
    cabinetry: 35.0,        // Tủ bếp, tủ áo, tủ lavabo (custom joinery)
    loose_furniture: 25.0,  // Sofa, bàn trà, ghế ăn (OEM / trading)
    wall_paneling: 30.0,    // Vách ốp lam sóng, nan gỗ
    stone_work: 20.0,       // Mặt đá Vicostone, granite
    metal_glass: 25.0,      // Cánh kính khung nhôm, vách kính
    lighting_fitout: 20.0,  // Đèn ray, LED định hình
    curtain_soft: 25.0,     // Rèm vải 2 lớp, thảm
  },
};

// ---------------------------------------------------------------------------
// Cost Breakdown
// ---------------------------------------------------------------------------

export interface ItemCostBreakdown {
  readonly materialCost: number;   // Chi phí vật tư (gỗ, đá, kính, vải)
  readonly laborCost: number;      // Chi phí nhân công sản xuất & hoàn thiện
  readonly hardwareCost: number;   // Chi phí phụ kiện cơ khí (ray trượt, bản lề, khóa)
  readonly finishingCost: number;  // Chi phí gia công hoàn thiện, sơn PU, đóng gói, vận chuyển
}

// ---------------------------------------------------------------------------
// Quotation Line Item (Full Domain Representation)
// ---------------------------------------------------------------------------

export interface QuotationLineItem {
  readonly id: string;
  readonly tenantId: string;
  readonly quotationId: string;
  readonly boqItemId?: string;
  readonly stableComponentId?: string;
  readonly roomZoneName: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly category: FurnitureItemCategory;
  readonly specifications: string;
  readonly unit: string;
  readonly quantity: number;

  // Tripartite Commercial Primitives
  readonly internalUnitCost: number;    // Giá vốn nội bộ
  readonly internalTotalCost: number;   // internalUnitCost * quantity
  readonly markupPercent: number;       // % Markup áp dụng trên giá vốn
  readonly clientUnitPrice: number;     // Đơn giá chào khách
  readonly clientTotalPrice: number;    // clientUnitPrice * quantity
  readonly grossMarginAmount: number;   // clientTotalPrice - internalTotalCost
  readonly grossMarginPercent: number;  // (grossMarginAmount / clientTotalPrice) * 100

  // Granular Cost Breakdown
  readonly costBreakdown?: ItemCostBreakdown;
}

// ---------------------------------------------------------------------------
// Full Quotation (Domain Aggregate)
// ---------------------------------------------------------------------------

export interface FullInteriorQuotation {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly boqId: string;
  readonly boqVersionNumber: number;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly status: QuotationStatus;
  readonly subtotal: number;            // Tổng giá bán trước chiết khấu
  readonly discountAmount: number;      // Số tiền giảm giá thương mại
  readonly discountedSubtotal: number;  // subtotal - discountAmount
  readonly vatPercent: number;          // % VAT (e.g. 8% or 10%)
  readonly vatAmount: number;           // discountedSubtotal * vatPercent / 100
  readonly grandTotal: number;          // discountedSubtotal + vatAmount
  readonly paymentTerms: string;
  readonly validityDays: number;
  readonly validUntil: string;          // ISO-8601 date string
  readonly preparedBy: string;
  readonly approvedBy?: string;
  readonly sentToClientAt?: string;
  readonly acceptedAt?: string;
  readonly rejectedAt?: string;
  readonly rejectionReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  // Internal Financial Summary (Estimator / PM view)
  readonly totalInternalCogs: number;   // Tổng giá vốn (COGS)
  readonly totalGrossMargin: number;    // Lợi nhuận gộp dự toán
  readonly grossMarginPercent: number;  // Tỷ suất lợi nhuận gộp (%)
  readonly markupPercentOnCogs: number; // Tỷ lệ Markup trung bình trên vốn

  readonly items: readonly QuotationLineItem[];
}

// ---------------------------------------------------------------------------
// STRICT AUTHORIZATION BOUNDARY: Client-Facing View (Zero Financial Leakage)
// ---------------------------------------------------------------------------

export interface ClientQuotationLineItem {
  readonly itemNumber: number;
  readonly roomZoneName: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly specifications: string;
  readonly unit: string;
  readonly quantity: number;
  readonly clientUnitPrice: number;
  readonly clientUnitPriceFormatted: string;
  readonly clientTotalPrice: number;
  readonly clientTotalPriceFormatted: string;
}

export interface ClientQuotationView {
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly projectName: string;
  readonly clientName: string;
  readonly status: QuotationStatus;
  readonly statusLabel: string;
  readonly subtotalFormatted: string;
  readonly discountFormatted: string;
  readonly vatFormatted: string;
  readonly grandTotalFormatted: string;
  readonly paymentTerms: string;
  readonly validityDays: number;
  readonly validUntilFormatted: string;
  readonly itemsByZone: Array<{
    readonly roomZoneName: string;
    readonly items: readonly ClientQuotationLineItem[];
    readonly zoneSubtotalFormatted: string;
  }>;
}

// ---------------------------------------------------------------------------
// Internal Estimator View (Full Tripartite Costing & Profitability)
// ---------------------------------------------------------------------------

export interface InternalQuotationCostingView {
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly boqVersionNumber: number;
  readonly status: QuotationStatus;
  readonly subtotal: number;
  readonly subtotalFormatted: string;
  readonly discountAmount: number;
  readonly discountFormatted: string;
  readonly grandTotal: number;
  readonly grandTotalFormatted: string;
  readonly totalInternalCogs: number;
  readonly totalInternalCogsFormatted: string;
  readonly totalGrossMargin: number;
  readonly totalGrossMarginFormatted: string;
  readonly grossMarginPercent: number;
  readonly grossMarginPercentFormatted: string;
  readonly markupPercentOnCogs: number;
  readonly isMarginAcceptable: boolean;
  readonly minimumGrossMarginPercent: number;
  readonly items: readonly QuotationLineItem[];
  readonly categoryBreakdown: readonly CategoryProfitabilitySummary[];
}

// ---------------------------------------------------------------------------
// Profitability Analysis Report
// ---------------------------------------------------------------------------

export interface CategoryProfitabilitySummary {
  readonly category: FurnitureItemCategory;
  readonly categoryLabel: string;
  readonly itemCount: number;
  readonly totalCogs: number;
  readonly totalCogsFormatted: string;
  readonly totalPrice: number;
  readonly totalPriceFormatted: string;
  readonly grossMarginAmount: number;
  readonly grossMarginFormatted: string;
  readonly grossMarginPercent: number;
  readonly grossMarginPercentFormatted: string;
  readonly averageMarkupPercent: number;
}

export interface CommercialProfitabilityReport {
  readonly quotationId: string;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly totalCogs: number;
  readonly totalCogsFormatted: string;
  readonly totalRevenue: number;
  readonly totalRevenueFormatted: string;
  readonly grossProfit: number;
  readonly grossProfitFormatted: string;
  readonly grossMarginPercent: number;
  readonly grossMarginPercentFormatted: string;
  readonly markupPercent: number;
  readonly isMarginThresholdMet: boolean;
  readonly minimumMarginThreshold: number;
  readonly lowMarginWarnings: readonly string[];
  readonly categoryBreakdowns: readonly CategoryProfitabilitySummary[];
}

// ---------------------------------------------------------------------------
// Quotation Revision Diff (V1 vs V2 Comparison)
// ---------------------------------------------------------------------------

export interface QuotationRevisionDiffResult {
  readonly baseQuotationNumber: string;
  readonly baseVersionNumber: number;
  readonly targetQuotationNumber: string;
  readonly targetVersionNumber: number;
  readonly revenueDelta: number;
  readonly revenueDeltaFormatted: string;
  readonly cogsDelta: number;
  readonly cogsDeltaFormatted: string;
  readonly marginDelta: number;
  readonly marginDeltaFormatted: string;
  readonly marginPercentDelta: number;
  readonly discountDelta: number;
  readonly discountDeltaFormatted: string;
  readonly modifiedItemsCount: number;
  readonly addedItemsCount: number;
  readonly removedItemsCount: number;
}

// ---------------------------------------------------------------------------
// Input DTOs
// ---------------------------------------------------------------------------

export interface GenerateQuotationFromBOQInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly boqId: string;
  readonly actorId: string;
  readonly actorName?: string;
  readonly quotationNumber?: string;
  readonly discountAmount?: number;
  readonly vatPercent?: number;
  readonly paymentTerms?: string;
  readonly validityDays?: number;
  readonly tieredMarkupConfig?: Partial<TieredMarkupConfig>;
}

export interface ReviseQuotationInput {
  readonly tenantId: string;
  readonly sourceQuotationId: string;
  readonly actorId: string;
  readonly actorName?: string;
  readonly discountAmount?: number;
  readonly vatPercent?: number;
  readonly paymentTerms?: string;
  readonly validityDays?: number;
  readonly revisionNotes?: string;
  readonly itemPriceAdjustments?: Array<{
    readonly itemId: string;
    readonly newClientUnitPrice?: number;
    readonly newQuantity?: number;
    readonly reason?: string;
  }>;
}
