/**
 * Bella Interior OS — Quotation & Commercial Margin Engine Service (Phase 2)
 *
 * Single Source of Truth for Commercial Quotation generation, Tiered Markups,
 * Cost Breakdown, and Profitability Analysis.
 *
 * CRITICAL SECURITY / AUTHORIZATION BOUNDARY:
 * Strict separation between Client-Facing Views (sanitized — zero financial leakage)
 * and Internal Costing Views (tripartite COGS, margins, markups).
 *
 * @module src/products/bella-interior/services/interior-quotation-margin.service
 */

import { randomUUID } from 'crypto';
import { TenantIsolationViolationError } from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type {
  FullInteriorQuotation,
  QuotationLineItem,
  ClientQuotationView,
  ClientQuotationLineItem,
  InternalQuotationCostingView,
  CommercialProfitabilityReport,
  CategoryProfitabilitySummary,
  QuotationRevisionDiffResult,
  GenerateQuotationFromBOQInput,
  ReviseQuotationInput,
  TieredMarkupConfig,
  ItemCostBreakdown,
} from '../domain/commercial-costing/quotation.types';
import { CANONICAL_TIERED_MARKUP_CONFIG } from '../domain/commercial-costing/quotation.types';
import type { BOQItem, FurnitureItemCategory } from '../domain/commercial-costing/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVND(val: number): string {
  return `${Math.round(val).toLocaleString('en-US')} đ`;
}

function formatDelta(val: number): string {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  return `${sign}${Math.round(abs).toLocaleString('en-US')} đ`;
}

const CATEGORY_LABELS: Record<FurnitureItemCategory, string> = {
  cabinetry: 'Tủ bếp & Tủ âm tường',
  loose_furniture: 'Nội thất rời & Sofa',
  wall_paneling: 'Vách ốp & Lam trang trí',
  stone_work: 'Đá nhân tạo & Tự nhiên',
  metal_glass: 'Cánh kính & Kim loại',
  lighting_fitout: 'Đèn & Thiết bị chiếu sáng',
  curtain_soft: 'Rèm vải & Đồ trang trí',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  sent_to_client: 'Đã gửi khách hàng',
  negotiating: 'Đang thương thảo',
  accepted: 'Khách hàng chấp thuận',
  rejected: 'Từ chối / Hủy',
};

// Canonical RBAC Roles permitted to view internal costing & commercial margin data
// Normalized to lowercase for case-insensitive role evaluation
// Maps to public.interior_role_permissions (migration 20261109130000) having interior:finance:read
export const CANONICAL_INTERNAL_COSTING_ROLES = new Set([
  'owner',
  'admin',
  'qs',         // Quantity Surveyor / Estimator
  'pm',         // Project Manager
  'director',   // Executive / Director
  'executive',
  'estimator',
  'lead_architect',
]);

const INTERNAL_ESTIMATOR_ROLES = CANONICAL_INTERNAL_COSTING_ROLES;

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class InteriorQuotationMarginService {
  constructor(private readonly repo: IInteriorRepository) {}

  /**
   * Generates a commercial quotation snapshot from an approved BOQ.
   * Applies category-specific tiered markups and computes cost breakdowns.
   */
  async generateQuotationFromBOQ(input: GenerateQuotationFromBOQInput): Promise<FullInteriorQuotation> {
    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const boq = await this.repo.getBOQ(input.tenantId, input.boqId);
    if (!boq) {
      throw new Error(`QuotationGenerationError: BOQ "${input.boqId}" not found for tenant "${input.tenantId}".`);
    }

    if (boq.status !== 'approved' && boq.status !== 'locked_for_contract') {
      throw new Error(
        `QuotationGenerationError: Cannot generate quotation from BOQ in status "${boq.status}". BOQ must be "approved" or "locked_for_contract".`
      );
    }

    const markupConfig: TieredMarkupConfig = {
      minimumGrossMarginPercent: input.tieredMarkupConfig?.minimumGrossMarginPercent ?? CANONICAL_TIERED_MARKUP_CONFIG.minimumGrossMarginPercent,
      defaultMarkupPercent: input.tieredMarkupConfig?.defaultMarkupPercent ?? CANONICAL_TIERED_MARKUP_CONFIG.defaultMarkupPercent,
      categoryMarkups: {
        ...CANONICAL_TIERED_MARKUP_CONFIG.categoryMarkups,
        ...(input.tieredMarkupConfig?.categoryMarkups ?? {}),
      },
    };

    const quotationId = randomUUID();
    const now = new Date().toISOString();
    const validityDays = input.validityDays ?? 30;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);

    let runningSubtotal = 0;
    let runningCogs = 0;

    const items: QuotationLineItem[] = boq.items.map((item: BOQItem) => {
      const markupPercent = markupConfig.categoryMarkups[item.category] ?? markupConfig.defaultMarkupPercent;
      
      // Determine client unit price: if already set in BOQ, respect it; otherwise calculate from markup
      const clientUnitPrice = item.clientUnitPrice > 0
        ? item.clientUnitPrice
        : Math.round(item.internalUnitCost * (1 + markupPercent / 100));

      const internalTotalCost = Math.round(item.internalUnitCost * item.quantity);
      const clientTotalPrice = Math.round(clientUnitPrice * item.quantity);
      const grossMarginAmount = clientTotalPrice - internalTotalCost;
      const grossMarginPercent = clientTotalPrice > 0
        ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
        : 0;

      // Estimate granular 4-part cost breakdown based on industry heuristics
      const costBreakdown: ItemCostBreakdown = {
        materialCost: Math.round(internalTotalCost * 0.55),
        laborCost: Math.round(internalTotalCost * 0.20),
        hardwareCost: Math.round(internalTotalCost * 0.15),
        finishingCost: internalTotalCost - Math.round(internalTotalCost * 0.55) - Math.round(internalTotalCost * 0.20) - Math.round(internalTotalCost * 0.15),
      };

      runningSubtotal += clientTotalPrice;
      runningCogs += internalTotalCost;

      return {
        id: randomUUID(),
        tenantId: input.tenantId,
        quotationId,
        boqItemId: item.id,
        stableComponentId: item.stableComponentId,
        roomZoneName: item.roomZoneName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        specifications: [
          item.specifications?.carcassMaterial,
          item.specifications?.doorFrontMaterial,
          item.specifications?.surfaceFinish,
          item.specifications?.hardwareSpec,
        ].filter(Boolean).join('; ') || 'Theo tiêu chuẩn hoàn thiện Bella',
        unit: item.unit,
        quantity: item.quantity,
        internalUnitCost: item.internalUnitCost,
        internalTotalCost,
        markupPercent,
        clientUnitPrice,
        clientTotalPrice,
        grossMarginAmount,
        grossMarginPercent,
        costBreakdown,
      };
    });

    const discountAmount = input.discountAmount ?? 0;
    const discountedSubtotal = Math.max(0, runningSubtotal - discountAmount);
    const vatPercent = input.vatPercent ?? 8;
    const vatAmount = Math.round((discountedSubtotal * vatPercent) / 100);
    const grandTotal = discountedSubtotal + vatAmount;

    const totalGrossMargin = runningSubtotal - runningCogs - discountAmount;
    // Weighted blended gross margin on net revenue (discounted subtotal)
    const grossMarginPercent = discountedSubtotal > 0
      ? Math.round((totalGrossMargin / discountedSubtotal) * 1000) / 10
      : 0;
    // Markup on internal COGS
    const markupPercentOnCogs = runningCogs > 0
      ? Math.round((totalGrossMargin / runningCogs) * 1000) / 10
      : 0;

    const quotationNumber = input.quotationNumber ?? `BG-${boq.boqNumber.replace(/^BOQ-/, '')}-Q1`;

    const fullQuotation: FullInteriorQuotation = {
      id: quotationId,
      tenantId: input.tenantId,
      projectId: boq.projectId,
      boqId: boq.id,
      boqVersionNumber: boq.versionNumber,
      quotationNumber,
      versionNumber: 1,
      status: 'draft',
      subtotal: runningSubtotal,
      discountAmount,
      discountedSubtotal,
      vatPercent,
      vatAmount,
      grandTotal,
      paymentTerms: input.paymentTerms ?? 'Tạm ứng 30% khi ký hợp đồng, 40% khi giao hàng, 30% khi nghiệm thu bàn giao',
      validityDays,
      validUntil: validUntilDate.toISOString().split('T')[0],
      preparedBy: input.actorName || input.actorId,
      totalInternalCogs: runningCogs,
      totalGrossMargin,
      grossMarginPercent,
      markupPercentOnCogs,
      createdAt: now,
      updatedAt: now,
      items,
    };

    // Save to repository (saves header and items)
    await this.repo.saveQuotation(input.tenantId, {
      id: fullQuotation.id,
      tenantId: fullQuotation.tenantId,
      projectId: fullQuotation.projectId,
      boqId: fullQuotation.boqId,
      quotationNumber: fullQuotation.quotationNumber,
      versionNumber: fullQuotation.versionNumber,
      status: fullQuotation.status,
      subtotal: fullQuotation.subtotal,
      discountAmount: fullQuotation.discountAmount,
      vatPercent: fullQuotation.vatPercent,
      vatAmount: fullQuotation.vatAmount,
      grandTotal: fullQuotation.grandTotal,
      paymentTerms: fullQuotation.paymentTerms,
      validityDays: fullQuotation.validityDays,
      createdAt: fullQuotation.createdAt,
      boqVersionNumber: fullQuotation.boqVersionNumber,
      totalInternalCogs: fullQuotation.totalInternalCogs,
      totalGrossMargin: fullQuotation.totalGrossMargin,
      grossMarginPercent: fullQuotation.grossMarginPercent,
      preparedBy: fullQuotation.preparedBy,
    });

    return fullQuotation;
  }

  /**
   * STRICT AUTHORIZATION BOUNDARY:
   * Returns a sanitized, client-facing view of the quotation.
   * ALL INTERNAL COGS, MARGINS, MARKUPS, AND COST BREAKDOWNS ARE STRICTLY STRIPPED.
   */
  async getClientQuotationView(tenantId: string, quotation: FullInteriorQuotation): Promise<ClientQuotationView> {
    if (!tenantId || tenantId !== quotation.tenantId) {
      throw new TenantIsolationViolationError();
    }

    // Group items by room zone
    const zoneMap = new Map<string, ClientQuotationLineItem[]>();
    let itemSeq = 1;

    for (const item of quotation.items) {
      const zoneName = item.roomZoneName || 'Khu vực chung';
      if (!zoneMap.has(zoneName)) {
        zoneMap.set(zoneName, []);
      }

      // CRITICAL: Construct client item with ZERO internal financial fields
      const clientItem: ClientQuotationLineItem = {
        itemNumber: itemSeq++,
        roomZoneName: zoneName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        specifications: item.specifications,
        unit: item.unit,
        quantity: item.quantity,
        clientUnitPrice: item.clientUnitPrice,
        clientUnitPriceFormatted: formatVND(item.clientUnitPrice),
        clientTotalPrice: item.clientTotalPrice,
        clientTotalPriceFormatted: formatVND(item.clientTotalPrice),
      };

      zoneMap.get(zoneName)!.push(clientItem);
    }

    const itemsByZone = Array.from(zoneMap.entries()).map(([roomZoneName, zoneItems]) => {
      const zoneSubtotal = zoneItems.reduce((sum, i) => sum + i.clientTotalPrice, 0);
      return {
        roomZoneName,
        items: zoneItems,
        zoneSubtotalFormatted: formatVND(zoneSubtotal),
      };
    });

    return {
      quotationNumber: quotation.quotationNumber,
      versionNumber: quotation.versionNumber,
      projectName: 'Dự án Nội thất Bella',
      clientName: 'Quý khách hàng',
      status: quotation.status,
      statusLabel: STATUS_LABELS[quotation.status] || quotation.status,
      subtotalFormatted: formatVND(quotation.subtotal),
      discountFormatted: formatVND(quotation.discountAmount),
      vatFormatted: formatVND(quotation.vatAmount),
      grandTotalFormatted: formatVND(quotation.grandTotal),
      paymentTerms: quotation.paymentTerms,
      validityDays: quotation.validityDays,
      validUntilFormatted: quotation.validUntil,
      itemsByZone,
    };
  }

  /**
   * Internal Estimator View:
   * Accessible ONLY to authorized estimator/director/admin roles.
   * Exposes full tripartite costing, cost breakdowns, and margin percentages.
   */
  async getInternalCostingView(
    tenantId: string,
    quotation: FullInteriorQuotation,
    userRole: string,
    minimumGrossMarginPercent = CANONICAL_TIERED_MARKUP_CONFIG.minimumGrossMarginPercent
  ): Promise<InternalQuotationCostingView> {
    if (!tenantId || tenantId !== quotation.tenantId) {
      throw new TenantIsolationViolationError();
    }

    if (!INTERNAL_ESTIMATOR_ROLES.has(userRole.toLowerCase())) {
      throw new Error(
        `AuthorizationViolation: Role "${userRole}" is not authorized to view internal costing and margin data.`
      );
    }

    const report = await this.analyzeProfitability(tenantId, quotation, minimumGrossMarginPercent);

    return {
      quotationNumber: quotation.quotationNumber,
      versionNumber: quotation.versionNumber,
      boqVersionNumber: quotation.boqVersionNumber,
      status: quotation.status,
      subtotal: quotation.subtotal,
      subtotalFormatted: formatVND(quotation.subtotal),
      discountAmount: quotation.discountAmount,
      discountFormatted: formatVND(quotation.discountAmount),
      grandTotal: quotation.grandTotal,
      grandTotalFormatted: formatVND(quotation.grandTotal),
      totalInternalCogs: quotation.totalInternalCogs,
      totalInternalCogsFormatted: formatVND(quotation.totalInternalCogs),
      totalGrossMargin: quotation.totalGrossMargin,
      totalGrossMarginFormatted: formatVND(quotation.totalGrossMargin),
      grossMarginPercent: quotation.grossMarginPercent,
      grossMarginPercentFormatted: `${quotation.grossMarginPercent}%`,
      markupPercentOnCogs: quotation.markupPercentOnCogs,
      isMarginAcceptable: quotation.grossMarginPercent >= minimumGrossMarginPercent,
      minimumGrossMarginPercent,
      items: quotation.items,
      categoryBreakdown: report.categoryBreakdowns,
    };
  }

  /**
   * Generates a comprehensive commercial profitability analysis report
   * with category-level breakdowns and low-margin alerts.
   */
  async analyzeProfitability(
    tenantId: string,
    quotation: FullInteriorQuotation,
    minimumGrossMarginPercent = CANONICAL_TIERED_MARKUP_CONFIG.minimumGrossMarginPercent
  ): Promise<CommercialProfitabilityReport> {
    if (!tenantId || tenantId !== quotation.tenantId) {
      throw new TenantIsolationViolationError();
    }

    // Category aggregations
    const catMap = new Map<FurnitureItemCategory, {
      count: number;
      cogs: number;
      revenue: number;
      margin: number;
      markups: number[];
    }>();

    for (const item of quotation.items) {
      const cat = item.category;
      if (!catMap.has(cat)) {
        catMap.set(cat, { count: 0, cogs: 0, revenue: 0, margin: 0, markups: [] });
      }
      const entry = catMap.get(cat)!;
      entry.count += 1;
      entry.cogs += item.internalTotalCost;
      entry.revenue += item.clientTotalPrice;
      entry.margin += item.grossMarginAmount;
      entry.markups.push(item.markupPercent);
    }

    const lowMarginWarnings: string[] = [];
    const categoryBreakdowns: CategoryProfitabilitySummary[] = [];

    for (const [cat, data] of catMap.entries()) {
      const marginPct = data.revenue > 0
        ? Math.round((data.margin / data.revenue) * 1000) / 10
        : 0;
      const avgMarkup = data.markups.length > 0
        ? Math.round((data.markups.reduce((s, m) => s + m, 0) / data.markups.length) * 10) / 10
        : 0;

      const label = CATEGORY_LABELS[cat] || cat;

      if (marginPct < minimumGrossMarginPercent) {
        lowMarginWarnings.push(
          `Cảnh báo biên lợi nhuận thấp: Danh mục "${label}" chỉ đạt ${marginPct}% (dưới ngưỡng tối thiểu ${minimumGrossMarginPercent}%).`
        );
      }

      categoryBreakdowns.push({
        category: cat,
        categoryLabel: label,
        itemCount: data.count,
        totalCogs: data.cogs,
        totalCogsFormatted: formatVND(data.cogs),
        totalPrice: data.revenue,
        totalPriceFormatted: formatVND(data.revenue),
        grossMarginAmount: data.margin,
        grossMarginFormatted: formatVND(data.margin),
        grossMarginPercent: marginPct,
        grossMarginPercentFormatted: `${marginPct}%`,
        averageMarkupPercent: avgMarkup,
      });
    }

    // Overall quotation check
    if (quotation.grossMarginPercent < minimumGrossMarginPercent) {
      lowMarginWarnings.unshift(
        `Cảnh báo tổng thể: Toàn bộ báo giá có Gross Margin = ${quotation.grossMarginPercent}%, không đạt ngưỡng phê duyệt tối thiểu ${minimumGrossMarginPercent}%.`
      );
    }

    return {
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      versionNumber: quotation.versionNumber,
      totalCogs: quotation.totalInternalCogs,
      totalCogsFormatted: formatVND(quotation.totalInternalCogs),
      totalRevenue: quotation.subtotal,
      totalRevenueFormatted: formatVND(quotation.subtotal),
      grossProfit: quotation.totalGrossMargin,
      grossProfitFormatted: formatVND(quotation.totalGrossMargin),
      grossMarginPercent: quotation.grossMarginPercent,
      grossMarginPercentFormatted: `${quotation.grossMarginPercent}%`,
      markupPercent: quotation.markupPercentOnCogs,
      isMarginThresholdMet: quotation.grossMarginPercent >= minimumGrossMarginPercent,
      minimumMarginThreshold: minimumGrossMarginPercent,
      lowMarginWarnings,
      categoryBreakdowns,
    };
  }

  /**
   * Revises an existing quotation (creates V2, V3 etc.) during commercial negotiations.
   * The source quotation is preserved immutably.
   */
  async reviseQuotation(input: ReviseQuotationInput, source: FullInteriorQuotation): Promise<FullInteriorQuotation> {
    if (!input.tenantId || input.tenantId !== source.tenantId) {
      throw new TenantIsolationViolationError();
    }

    const newVersionNumber = source.versionNumber + 1;
    const newQuotationNumber = source.quotationNumber.replace(/-Q\d+$/, '') + `-Q${newVersionNumber}`;
    const newQuotationId = randomUUID();
    const now = new Date().toISOString();

    const priceAdjustmentMap = new Map<string, { newPrice?: number; newQty?: number }>();
    if (input.itemPriceAdjustments) {
      for (const adj of input.itemPriceAdjustments) {
        priceAdjustmentMap.set(adj.itemId, { newPrice: adj.newClientUnitPrice, newQty: adj.newQuantity });
      }
    }

    let runningSubtotal = 0;
    let runningCogs = 0;

    const revisedItems: QuotationLineItem[] = source.items.map((item) => {
      const adj = priceAdjustmentMap.get(item.id);
      const clientUnitPrice = adj?.newPrice !== undefined ? adj.newPrice : item.clientUnitPrice;
      const quantity = adj?.newQty !== undefined ? adj.newQty : item.quantity;
      const clientTotalPrice = Math.round(clientUnitPrice * quantity);
      const internalTotalCost = Math.round(item.internalUnitCost * quantity);
      const grossMarginAmount = clientTotalPrice - internalTotalCost;
      const grossMarginPercent = clientTotalPrice > 0
        ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
        : 0;
      const markupPercent = internalTotalCost > 0
        ? Math.round((grossMarginAmount / internalTotalCost) * 1000) / 10
        : 0;

      runningSubtotal += clientTotalPrice;
      runningCogs += internalTotalCost;

      return {
        ...item,
        id: randomUUID(),
        quotationId: newQuotationId,
        quantity,
        clientUnitPrice,
        clientTotalPrice,
        internalTotalCost,
        grossMarginAmount,
        grossMarginPercent,
        markupPercent,
      };
    });

    const discountAmount = input.discountAmount !== undefined ? input.discountAmount : source.discountAmount;
    const discountedSubtotal = Math.max(0, runningSubtotal - discountAmount);
    const vatPercent = input.vatPercent !== undefined ? input.vatPercent : source.vatPercent;
    const vatAmount = Math.round((discountedSubtotal * vatPercent) / 100);
    const grandTotal = discountedSubtotal + vatAmount;

    const totalGrossMargin = runningSubtotal - runningCogs - discountAmount;
    // Weighted blended gross margin on net revenue (discounted subtotal)
    const grossMarginPercent = discountedSubtotal > 0
      ? Math.round((totalGrossMargin / discountedSubtotal) * 1000) / 10
      : 0;
    // Markup on internal COGS
    const markupPercentOnCogs = runningCogs > 0
      ? Math.round((totalGrossMargin / runningCogs) * 1000) / 10
      : 0;

    const revisedQuotation: FullInteriorQuotation = {
      id: newQuotationId,
      tenantId: input.tenantId,
      projectId: source.projectId,
      boqId: source.boqId,
      boqVersionNumber: source.boqVersionNumber,
      quotationNumber: newQuotationNumber,
      versionNumber: newVersionNumber,
      status: 'draft',
      subtotal: runningSubtotal,
      discountAmount,
      discountedSubtotal,
      vatPercent,
      vatAmount,
      grandTotal,
      paymentTerms: input.paymentTerms ?? source.paymentTerms,
      validityDays: input.validityDays ?? source.validityDays,
      validUntil: source.validUntil,
      preparedBy: input.actorName || input.actorId,
      totalInternalCogs: runningCogs,
      totalGrossMargin,
      grossMarginPercent,
      markupPercentOnCogs,
      createdAt: now,
      updatedAt: now,
      items: revisedItems,
    };

    return revisedQuotation;
  }

  /**
   * Compares two quotation revisions (e.g. V1 vs V2).
   * Calculates revenue delta, COGS delta, margin delta, and discount variance.
   */
  async compareQuotationRevisions(
    tenantId: string,
    base: FullInteriorQuotation,
    target: FullInteriorQuotation
  ): Promise<QuotationRevisionDiffResult> {
    if (!tenantId || tenantId !== base.tenantId || tenantId !== target.tenantId) {
      throw new TenantIsolationViolationError();
    }

    const revenueDelta = target.subtotal - base.subtotal;
    const cogsDelta = target.totalInternalCogs - base.totalInternalCogs;
    const marginDelta = target.totalGrossMargin - base.totalGrossMargin;
    const marginPercentDelta = Math.round((target.grossMarginPercent - base.grossMarginPercent) * 10) / 10;
    const discountDelta = target.discountAmount - base.discountAmount;

    // Detect item modifications
    const baseItemMap = new Map(base.items.map((i) => [i.itemCode, i]));
    let modifiedItemsCount = 0;
    let addedItemsCount = 0;
    let removedItemsCount = 0;

    for (const tItem of target.items) {
      const bItem = baseItemMap.get(tItem.itemCode);
      if (!bItem) {
        addedItemsCount++;
      } else if (bItem.clientUnitPrice !== tItem.clientUnitPrice || bItem.quantity !== tItem.quantity) {
        modifiedItemsCount++;
      }
    }

    const targetCodes = new Set(target.items.map((i) => i.itemCode));
    for (const bItem of base.items) {
      if (!targetCodes.has(bItem.itemCode)) {
        removedItemsCount++;
      }
    }

    return {
      baseQuotationNumber: base.quotationNumber,
      baseVersionNumber: base.versionNumber,
      targetQuotationNumber: target.quotationNumber,
      targetVersionNumber: target.versionNumber,
      revenueDelta,
      revenueDeltaFormatted: formatDelta(revenueDelta),
      cogsDelta,
      cogsDeltaFormatted: formatDelta(cogsDelta),
      marginDelta,
      marginDeltaFormatted: formatDelta(marginDelta),
      marginPercentDelta,
      discountDelta,
      discountDeltaFormatted: formatDelta(discountDelta),
      modifiedItemsCount,
      addedItemsCount,
      removedItemsCount,
    };
  }
}

