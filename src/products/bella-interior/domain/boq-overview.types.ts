/**
 * Bella Interior OS — BOQ & BOM Canonical Domain Types
 *
 * Single Source of Truth for Commercial Bill of Quantities (BOQ),
 * Production Bill of Materials (BOM), and Tripartite Costing.
 * Zero logic in UI: All calculations, formatting, percentages, and sub-totals are computed server-side.
 *
 * @module src/products/bella-interior/domain/boq-overview.types
 */

export interface BOQProjectHeader {
  readonly id: string;
  readonly code: string; // e.g. "INT-2024-001"
  readonly name: string; // e.g. "Villa Sunrise Renovation"
  readonly breadcrumbLabel: string;
  readonly clientName: string; // e.g. "SunCasa Group"
  readonly areaSquareMeters: number; // e.g. 320
  readonly areaFormatted: string; // e.g. "320 m²"
  readonly location: string; // e.g. "Quận 7, TP.HCM"
  readonly status: string;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
}

export interface BOQFinancialKPIItem {
  readonly rawValue: number;
  readonly formattedValue: string; // e.g. "1,250,000,000 đ"
  readonly label: string;
  readonly tooltip: string;
  readonly trendLabel: string; // e.g. "▲ +2.5% so với dự toán"
  readonly trendClass: string;
  readonly iconName: string;
  readonly iconBgClass: string;
}

export interface BOQFinancialKPIs {
  readonly totalCogs: BOQFinancialKPIItem;
  readonly totalClientPrice: BOQFinancialKPIItem;
  readonly grossProfit: BOQFinancialKPIItem;
  readonly grossMargin: {
    readonly rawPercentage: number;
    readonly formattedPercentage: string; // "25.6%"
    readonly label: string;
    readonly sparklineTrend: readonly number[];
  };
}

export interface BOQLineItem {
  readonly itemNumber: number;
  readonly id: string;
  readonly itemName: string;
  readonly specifications: string;
  readonly unit: string;
  readonly quantity: number;
  readonly quantityFormatted: string; // "1.00" or "3.00"
  readonly internalUnitCost: number;
  readonly internalUnitCostFormatted: string; // "80,000,000"
  readonly internalTotalCost: number;
  readonly internalTotalCostFormatted: string; // "80,000,000"
  readonly clientUnitPrice: number;
  readonly clientUnitPriceFormatted: string; // "110,000,000"
  readonly clientTotalPrice: number;
  readonly clientTotalPriceFormatted: string; // "110,000,000"
  readonly grossMarginAmount: number;
  readonly grossMarginFormatted: string; // "30,000,000"
  readonly grossMarginPercent: number;
  readonly grossMarginPercentFormatted: string; // "27.3%"
}

export interface BOQZoneGroup {
  readonly zoneId: string;
  readonly zoneName: string; // e.g. "Phòng khách", "Phòng ngủ Master", "Bếp + Ăn"
  readonly subtotalCogs: number;
  readonly subtotalCogsFormatted: string; // "320,000,000"
  readonly subtotalPrice: number;
  readonly subtotalPriceFormatted: string; // "460,000,000"
  readonly subtotalProfit: number;
  readonly subtotalProfitFormatted: string; // "140,000,000"
  readonly subtotalMarginPercent: number;
  readonly subtotalMarginPercentFormatted: string; // "30.4%"
  readonly items: readonly BOQLineItem[];
}

export type BOMMaterialCategory = 'wood' | 'stone' | 'hardware' | 'finish_aux';

export interface BOMMaterialItem {
  readonly id: string;
  readonly category: BOMMaterialCategory;
  readonly categoryLabel: string;
  readonly materialCode: string;
  readonly materialName: string;
  readonly spec: string;
  readonly unit: string;
  readonly requiredQuantity: number;
  readonly wasteFactorPercent: number;
  readonly totalAllocated: number;
  readonly stockStatus: 'in_stock' | 'allocated' | 'order_needed';
  readonly stockStatusLabel: string;
  readonly stockStatusBadgeClass: string;
}

export interface BOQVersionAudit {
  readonly versionLabel: string; // "R1.0 - Approved"
  readonly approvalDateFormatted: string; // "06/11/2026"
  readonly approvedBy: string; // "Trần Thị Mai"
}

export interface BOQOverviewResponse {
  readonly tenantId: string;
  readonly project: BOQProjectHeader;
  readonly kpis: BOQFinancialKPIs;
  readonly activeView: 'boq' | 'bom';
  readonly zoneGroups: readonly BOQZoneGroup[];
  readonly bomMaterials: readonly BOMMaterialItem[];
  readonly audit: BOQVersionAudit;
}

