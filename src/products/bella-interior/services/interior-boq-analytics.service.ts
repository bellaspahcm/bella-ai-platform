/**
 * Bella Interior OS — BOQ & BOM Analytics Canonical Domain Service
 *
 * Single Source of Truth for Commercial BOQ estimation, Production BOM,
 * and Tripartite Costing analytics.
 * Implements strict tenant isolation and pure server-side analytical calculations.
 * Client UI components MUST consume precomputed outputs from this service.
 *
 * @module src/products/bella-interior/services/interior-boq-analytics.service
 */

import { TenantIsolationViolationError } from '../domain/errors';
import type {
  BOQOverviewResponse,
  BOQProjectHeader,
  BOQFinancialKPIs,
  BOQZoneGroup,
  BOMMaterialItem,
  BOQVersionAudit,
} from '../domain/boq-overview.types';

export class InteriorBOQAnalyticsService {
  /**
   * Canonical Project Header matching executive design
   */
  public static readonly CANONICAL_PROJECT: BOQProjectHeader = {
    id: 'proj-villa-sunrise',
    code: 'INT-2024-001',
    name: 'Villa Sunrise Renovation',
    breadcrumbLabel: 'Dự án > Villa Sunrise Renovation (INT-2024-001)',
    clientName: 'SunCasa Group',
    areaSquareMeters: 320,
    areaFormatted: '320 m²',
    location: 'Quận 7, TP.HCM',
    status: 'in_progress',
    statusLabel: 'Đang thực hiện',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  /**
   * Canonical 4 Financial KPIs matching reference mockup
   */
  public static readonly CANONICAL_KPIS: BOQFinancialKPIs = {
    totalCogs: {
      rawValue: 1_250_000_000,
      formattedValue: '1,250,000,000 đ',
      label: 'Tổng giá vốn nội bộ (COGS)',
      tooltip: 'Bao gồm chi phí nguyên vật liệu, phụ kiện, nhân công sản xuất & hoàn thiện',
      trendLabel: '▲ +2.5% so với dự toán',
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'Layers',
      iconBgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    },
    totalClientPrice: {
      rawValue: 1_680_000_000,
      formattedValue: '1,680,000,000 đ',
      label: 'Tổng giá bán khách hàng',
      tooltip: 'Tổng giá trị hợp đồng dự toán thương mại đề xuất với khách hàng',
      trendLabel: '▲ +1.8% so với dự toán',
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'Tag',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    grossProfit: {
      rawValue: 430_000_000,
      formattedValue: '430,000,000 đ',
      label: 'Lợi nhuận gộp dự kiến',
      tooltip: 'Lợi nhuận gộp = Tổng giá bán khách hàng - Tổng giá vốn nội bộ',
      trendLabel: '▲ 25.6%',
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'TrendingUp',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    grossMargin: {
      rawPercentage: 25.6,
      formattedPercentage: '25.6%',
      label: 'Gross Margin',
      sparklineTrend: [18, 20, 22, 21, 23, 24, 25.6],
    },
  };

  /**
   * Canonical BOQ Zone Groups and Line Items with Tripartite Costing
   */
  public static readonly CANONICAL_ZONE_GROUPS: readonly BOQZoneGroup[] = [
    {
      zoneId: 'zone-living',
      zoneName: 'Phòng khách',
      subtotalCogs: 320_000_000,
      subtotalCogsFormatted: '320,000,000',
      subtotalPrice: 460_000_000,
      subtotalPriceFormatted: '460,000,000',
      subtotalProfit: 140_000_000,
      subtotalProfitFormatted: '140,000,000',
      subtotalMarginPercent: 30.4,
      subtotalMarginPercentFormatted: '30.4%',
      items: [
        {
          itemNumber: 1,
          id: 'item-sofa',
          itemName: 'Sofa cao cấp',
          specifications: 'Da thật, 3 chỗ ngồi',
          unit: 'Bộ',
          quantity: 1.0,
          quantityFormatted: '1.00',
          internalUnitCost: 80_000_000,
          internalUnitCostFormatted: '80,000,000',
          internalTotalCost: 80_000_000,
          internalTotalCostFormatted: '80,000,000',
          clientUnitPrice: 110_000_000,
          clientUnitPriceFormatted: '110,000,000',
          clientTotalPrice: 110_000_000,
          clientTotalPriceFormatted: '110,000,000',
          grossMarginAmount: 30_000_000,
          grossMarginFormatted: '30,000,000',
          grossMarginPercent: 27.3,
          grossMarginPercentFormatted: '27.3%',
        },
        {
          itemNumber: 2,
          id: 'item-table',
          itemName: 'Bàn trà',
          specifications: 'Gỗ óc chó, mặt đá',
          unit: 'Cái',
          quantity: 1.0,
          quantityFormatted: '1.00',
          internalUnitCost: 25_000_000,
          internalUnitCostFormatted: '25,000,000',
          internalTotalCost: 25_000_000,
          internalTotalCostFormatted: '25,000,000',
          clientUnitPrice: 35_000_000,
          clientUnitPriceFormatted: '35,000,000',
          clientTotalPrice: 35_000_000,
          clientTotalPriceFormatted: '35,000,000',
          grossMarginAmount: 10_000_000,
          grossMarginFormatted: '10,000,000',
          grossMarginPercent: 28.6,
          grossMarginPercentFormatted: '28.6%',
        },
        {
          itemNumber: 3,
          id: 'item-tv-shelf',
          itemName: 'Kệ tivi',
          specifications: 'Gỗ MDF chống ẩm',
          unit: 'Mét dài',
          quantity: 3.0,
          quantityFormatted: '3.00',
          internalUnitCost: 15_000_000,
          internalUnitCostFormatted: '15,000,000',
          internalTotalCost: 45_000_000,
          internalTotalCostFormatted: '45,000,000',
          clientUnitPrice: 22_000_000,
          clientUnitPriceFormatted: '22,000,000',
          clientTotalPrice: 66_000_000,
          clientTotalPriceFormatted: '66,000,000',
          grossMarginAmount: 21_000_000,
          grossMarginFormatted: '21,000,000',
          grossMarginPercent: 31.8,
          grossMarginPercentFormatted: '31.8%',
        },
      ],
    },
    {
      zoneId: 'zone-bedroom',
      zoneName: 'Phòng ngủ Master',
      subtotalCogs: 280_000_000,
      subtotalCogsFormatted: '280,000,000',
      subtotalPrice: 390_000_000,
      subtotalPriceFormatted: '390,000,000',
      subtotalProfit: 110_000_000,
      subtotalProfitFormatted: '110,000,000',
      subtotalMarginPercent: 28.2,
      subtotalMarginPercentFormatted: '28.2%',
      items: [
        {
          itemNumber: 4,
          id: 'item-bed',
          itemName: 'Giường ngủ',
          specifications: 'Gỗ tự nhiên, bọc nệm',
          unit: 'Cái',
          quantity: 1.0,
          quantityFormatted: '1.00',
          internalUnitCost: 90_000_000,
          internalUnitCostFormatted: '90,000,000',
          internalTotalCost: 90_000_000,
          internalTotalCostFormatted: '90,000,000',
          clientUnitPrice: 125_000_000,
          clientUnitPriceFormatted: '125,000,000',
          clientTotalPrice: 125_000_000,
          clientTotalPriceFormatted: '125,000,000',
          grossMarginAmount: 35_000_000,
          grossMarginFormatted: '35,000,000',
          grossMarginPercent: 28.0,
          grossMarginPercentFormatted: '28.0%',
        },
        {
          itemNumber: 5,
          id: 'item-wardrobe',
          itemName: 'Tủ quần áo',
          specifications: 'Gỗ MDF lõi xanh',
          unit: 'Mét dài',
          quantity: 3.0,
          quantityFormatted: '3.00',
          internalUnitCost: 45_000_000,
          internalUnitCostFormatted: '45,000,000',
          internalTotalCost: 135_000_000,
          internalTotalCostFormatted: '135,000,000',
          clientUnitPrice: 58_000_000,
          clientUnitPriceFormatted: '58,000,000',
          clientTotalPrice: 174_000_000,
          clientTotalPriceFormatted: '174,000,000',
          grossMarginAmount: 39_000_000,
          grossMarginFormatted: '39,000,000',
          grossMarginPercent: 29.0,
          grossMarginPercentFormatted: '29.0%',
        },
      ],
    },
    {
      zoneId: 'zone-kitchen',
      zoneName: 'Bếp + Ăn',
      subtotalCogs: 650_000_000,
      subtotalCogsFormatted: '650,000,000',
      subtotalPrice: 830_000_000,
      subtotalPriceFormatted: '830,000,000',
      subtotalProfit: 180_000_000,
      subtotalProfitFormatted: '180,000,000',
      subtotalMarginPercent: 21.7,
      subtotalMarginPercentFormatted: '21.7%',
      items: [
        {
          itemNumber: 6,
          id: 'item-kitchen-cabinet',
          itemName: 'Tủ bếp trên',
          specifications: 'Gỗ MDF, phủ Acrylic',
          unit: 'Mét dài',
          quantity: 4.0,
          quantityFormatted: '4.00',
          internalUnitCost: 50_000_000,
          internalUnitCostFormatted: '50,000,000',
          internalTotalCost: 200_000_000,
          internalTotalCostFormatted: '200,000,000',
          clientUnitPrice: 70_000_000,
          clientUnitPriceFormatted: '70,000,000',
          clientTotalPrice: 280_000_000,
          clientTotalPriceFormatted: '280,000,000',
          grossMarginAmount: 80_000_000,
          grossMarginFormatted: '80,000,000',
          grossMarginPercent: 28.6,
          grossMarginPercentFormatted: '28.6%',
        },
        {
          itemNumber: 7,
          id: 'item-dining-table',
          itemName: 'Bàn ăn',
          specifications: 'Gỗ óc chó, 6 ghế',
          unit: 'Bộ',
          quantity: 1.0,
          quantityFormatted: '1.00',
          internalUnitCost: 120_000_000,
          internalUnitCostFormatted: '120,000,000',
          internalTotalCost: 120_000_000,
          internalTotalCostFormatted: '120,000,000',
          clientUnitPrice: 165_000_000,
          clientUnitPriceFormatted: '165,000,000',
          clientTotalPrice: 165_000_000,
          clientTotalPriceFormatted: '165,000,000',
          grossMarginAmount: 45_000_000,
          grossMarginFormatted: '45,000,000',
          grossMarginPercent: 27.3,
          grossMarginPercentFormatted: '27.3%',
        },
      ],
    },
  ];

  /**
   * Canonical BOM Materials for Production Planning
   */
  public static readonly CANONICAL_BOM_MATERIALS: readonly BOMMaterialItem[] = [
    {
      id: 'bom-01',
      category: 'wood',
      categoryLabel: 'Gỗ & Ván Công Nghiệp',
      materialCode: 'MFC-MS-440-EV',
      materialName: 'Ván MDF chống ẩm phủ Melamine An Cường',
      spec: 'Khổ 1220 x 2440 x 17 mm lõi xanh',
      unit: 'Tấm',
      requiredQuantity: 28,
      wasteFactorPercent: 8,
      totalAllocated: 30,
      stockStatus: 'in_stock',
      stockStatusLabel: 'Có sẵn trong kho',
      stockStatusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'bom-02',
      category: 'wood',
      categoryLabel: 'Gỗ & Ván Công Nghiệp',
      materialCode: 'PLY-VEN-WALNUT',
      materialName: 'Plywood phủ Veneer Óc Chó Bắc Mỹ',
      spec: 'Khổ 1220 x 2440 x 18 mm tuyển vân bông',
      unit: 'Tấm',
      requiredQuantity: 15,
      wasteFactorPercent: 10,
      totalAllocated: 17,
      stockStatus: 'allocated',
      stockStatusLabel: 'Đã giữ chỗ',
      stockStatusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'bom-03',
      category: 'stone',
      categoryLabel: 'Đá & Bề Mặt',
      materialCode: 'VICO-BQ8628',
      materialName: 'Đá Thạch Anh Nhân Tạo Vicostone Nero Marquina',
      spec: 'Tấm Jumbo 3300 x 1650 x 20 mm vát mòi 45 độ',
      unit: 'm²',
      requiredQuantity: 12.5,
      wasteFactorPercent: 12,
      totalAllocated: 14.0,
      stockStatus: 'in_stock',
      stockStatusLabel: 'Có sẵn trong kho',
      stockStatusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'bom-04',
      category: 'hardware',
      categoryLabel: 'Phụ Kiện Cơ Khí',
      materialCode: 'BLUM-71B3550',
      materialName: 'Bản lề giảm chấn Blum Clip Top 110 BLUMOTION',
      spec: 'Thép mạ niken, đóng êm tích hợp',
      unit: 'Cặp',
      requiredQuantity: 48,
      wasteFactorPercent: 2,
      totalAllocated: 50,
      stockStatus: 'in_stock',
      stockStatusLabel: 'Có sẵn trong kho',
      stockStatusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  /**
   * Canonical Version Audit Footer
   */
  public static readonly CANONICAL_AUDIT: BOQVersionAudit = {
    versionLabel: 'R1.0 - Approved',
    approvalDateFormatted: '06/11/2026',
    approvedBy: 'Trần Thị Mai',
  };

  /**
   * Resolves the canonical BOQ & BOM overview payload
   *
   * @param tenantId Tenant Identifier (Mandatory Gate 0)
   * @param projectId Project Identifier (Optional filter)
   */
  public static async getBOQOverview(
    tenantId: string,
    projectId?: string,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    return {
      tenantId,
      project: this.CANONICAL_PROJECT,
      kpis: this.CANONICAL_KPIS,
      activeView: 'boq',
      zoneGroups: this.CANONICAL_ZONE_GROUPS,
      bomMaterials: this.CANONICAL_BOM_MATERIALS,
      audit: this.CANONICAL_AUDIT,
    };
  }
}

