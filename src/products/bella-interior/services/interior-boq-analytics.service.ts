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

import { randomUUID } from 'crypto';
import { TenantIsolationViolationError } from '../domain/errors';
import type {
  BOQOverviewResponse,
  BOQProjectHeader,
  BOQFinancialKPIs,
  BOQZoneGroup,
  BOQLineItem,
  BOMMaterialItem,
  BOQVersionAudit,
  CreateBOQItemInput,
  UpdateBOQItemInput,
  DuplicateBOQItemInput,
  TransitionBOQStatusInput,
  CreateBOQRevisionInput,
} from '../domain/boq-overview.types';
import type { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import type {
  InteriorBOQ as DomainInteriorBOQ,
  BOQItem as DomainBOQItem,
  FurnitureItemCategory,
  BOQStatus,
} from '../domain/commercial-costing/types';

export interface TenantBOQState {
  project: BOQProjectHeader;
  zoneGroups: BOQZoneGroup[];
  bomMaterials: BOMMaterialItem[];
  audit: BOQVersionAudit;
  status: BOQStatus;
  versionNumber: number;
  snapshots?: Map<number, Omit<TenantBOQState, 'snapshots'>>;
}

function formatVND(val: number): string {
  return Math.round(val).toLocaleString('en-US');
}

function computeLineItem(
  itemNumber: number,
  id: string,
  itemName: string,
  specifications: string,
  unit: string,
  quantity: number,
  internalUnitCost: number,
  clientUnitPrice: number,
): BOQLineItem {
  if (quantity <= 0) {
    throw new Error('Số lượng cấu kiện phải lớn hơn 0');
  }
  if (internalUnitCost < 0 || clientUnitPrice < 0) {
    throw new Error('Đơn giá vốn và đơn giá bán không được âm');
  }

  const internalTotalCost = Math.round(quantity * internalUnitCost);
  const clientTotalPrice = Math.round(quantity * clientUnitPrice);
  const grossMarginAmount = clientTotalPrice - internalTotalCost;
  const grossMarginPercent = clientTotalPrice > 0
    ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
    : 0;
  const markupPercent = internalTotalCost > 0
    ? Math.round((grossMarginAmount / internalTotalCost) * 1000) / 10
    : 0;

  return {
    itemNumber,
    id,
    itemName,
    specifications,
    unit,
    quantity,
    quantityFormatted: quantity % 1 === 0 ? quantity.toFixed(2) : quantity.toString(),
    internalUnitCost,
    internalUnitCostFormatted: formatVND(internalUnitCost),
    internalTotalCost,
    internalTotalCostFormatted: formatVND(internalTotalCost),
    clientUnitPrice,
    clientUnitPriceFormatted: formatVND(clientUnitPrice),
    clientTotalPrice,
    clientTotalPriceFormatted: formatVND(clientTotalPrice),
    grossMarginAmount,
    grossMarginFormatted: formatVND(grossMarginAmount),
    grossMarginPercent,
    grossMarginPercentFormatted: `${grossMarginPercent}%`,
    markupPercent,
    markupPercentFormatted: `${markupPercent}%`,
  };
}

function computeZoneGroup(
  zoneId: string,
  zoneName: string,
  items: readonly BOQLineItem[],
): BOQZoneGroup {
  const subtotalCogs = items.reduce((sum, i) => sum + i.internalTotalCost, 0);
  const subtotalPrice = items.reduce((sum, i) => sum + i.clientTotalPrice, 0);
  const subtotalProfit = subtotalPrice - subtotalCogs;
  const subtotalMarginPercent = subtotalPrice > 0
    ? Math.round((subtotalProfit / subtotalPrice) * 1000) / 10
    : 0;
  const subtotalMarkupPercent = subtotalCogs > 0
    ? Math.round((subtotalProfit / subtotalCogs) * 1000) / 10
    : 0;

  return {
    zoneId,
    zoneName,
    subtotalCogs,
    subtotalCogsFormatted: formatVND(subtotalCogs),
    subtotalPrice,
    subtotalPriceFormatted: formatVND(subtotalPrice),
    subtotalProfit,
    subtotalProfitFormatted: formatVND(subtotalProfit),
    subtotalMarginPercent,
    subtotalMarginPercentFormatted: `${subtotalMarginPercent}%`,
    subtotalMarkupPercent,
    subtotalMarkupPercentFormatted: `${subtotalMarkupPercent}%`,
    items,
  };
}

function computeFinancialKPIs(zoneGroups: readonly BOQZoneGroup[]): BOQFinancialKPIs {
  const totalCogsRaw = zoneGroups.reduce((sum, z) => sum + z.subtotalCogs, 0);
  const totalClientPriceRaw = zoneGroups.reduce((sum, z) => sum + z.subtotalPrice, 0);
  const grossProfitRaw = totalClientPriceRaw - totalCogsRaw;
  const grossMarginPercent = totalClientPriceRaw > 0
    ? Math.round((grossProfitRaw / totalClientPriceRaw) * 1000) / 10
    : 0;
  const markupPercent = totalCogsRaw > 0
    ? Math.round((grossProfitRaw / totalCogsRaw) * 1000) / 10
    : 0;

  return {
    totalCogs: {
      rawValue: totalCogsRaw,
      formattedValue: `${formatVND(totalCogsRaw)} đ`,
      label: 'Tổng giá vốn nội bộ (COGS)',
      tooltip: 'Bao gồm chi phí nguyên vật liệu, phụ kiện, nhân công sản xuất & hoàn thiện',
      trendLabel: '▲ +2.5% so với dự toán',
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'Layers',
      iconBgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    },
    totalClientPrice: {
      rawValue: totalClientPriceRaw,
      formattedValue: `${formatVND(totalClientPriceRaw)} đ`,
      label: 'Tổng giá bán khách hàng',
      tooltip: 'Tổng giá trị hợp đồng dự toán thương mại đề xuất với khách hàng',
      trendLabel: '▲ +1.8% so với dự toán',
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'Tag',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    grossProfit: {
      rawValue: grossProfitRaw,
      formattedValue: `${formatVND(grossProfitRaw)} đ`,
      label: 'Lợi nhuận gộp dự kiến',
      tooltip: 'Lợi nhuận gộp = Tổng giá bán khách hàng - Tổng giá vốn nội bộ',
      trendLabel: `▲ ${grossMarginPercent}%`,
      trendClass: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'TrendingUp',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    grossMargin: {
      rawPercentage: grossMarginPercent,
      formattedPercentage: `${grossMarginPercent}%`,
      label: 'Gross Margin',
      sparklineTrend: [18, 20, 22, 21, 23, 24, grossMarginPercent],
    },
    markup: {
      rawPercentage: markupPercent,
      formattedPercentage: `${markupPercent}%`,
      label: 'Markup trên giá vốn',
    },
  };
}

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
   * Tenant-isolated state storage (Single Source of Truth)
   */
  private static readonly tenantStore: Map<string, TenantBOQState> = new Map();

  /**
   * Retrieves or initializes tenant state from canonical baseline
   */
  private static getOrCreateTenantState(tenantId: string): TenantBOQState {
    const existing = this.tenantStore.get(tenantId);
    if (existing) {
      return existing;
    }

    // Initialize with a deep clone of canonical data (initially in approved R1.0 state)
    const clonedZones: BOQZoneGroup[] = this.CANONICAL_ZONE_GROUPS.map((zg) => ({
      ...zg,
      items: zg.items.map((i) => ({ ...i })),
    }));

    const newState: TenantBOQState = {
      project: { ...this.CANONICAL_PROJECT },
      zoneGroups: clonedZones,
      bomMaterials: this.CANONICAL_BOM_MATERIALS.map((b) => ({ ...b })),
      audit: { ...this.CANONICAL_AUDIT },
      status: 'approved',
      versionNumber: 1,
    };

    this.tenantStore.set(tenantId, newState);
    return newState;
  }

  /**
   * Invariant Enforcement: Only Draft BOQ may be modified directly.
   * Under Review requires returning to Draft.
   * Approved & Locked for Contract are strictly immutable and require creating a new revision.
   */
  private static assertEditable(state: TenantBOQState): void {
    if (state.status === 'approved' || state.status === 'locked_for_contract') {
      throw new Error(
        `Không thể chỉnh sửa BOQ đã ở trạng thái "${state.status.toUpperCase()}". Phiên bản là bất biến, vui lòng tạo Revision mới trước khi điều chỉnh.`
      );
    }
    if (state.status === 'under_review') {
      throw new Error(
        'BOQ đang ở trạng thái "Chờ duyệt" (Under Review). Vui lòng trả về bản nháp (Draft) trước khi chỉnh sửa trực tiếp.'
      );
    }
  }

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

    const state = this.getOrCreateTenantState(tenantId);
    const kpis = computeFinancialKPIs(state.zoneGroups);

    return {
      tenantId,
      project: state.project,
      kpis,
      activeView: 'boq',
      zoneGroups: state.zoneGroups,
      bomMaterials: state.bomMaterials,
      audit: state.audit,
      status: state.status,
      versionNumber: state.versionNumber,
    };
  }

  /**
   * Adds a new zone to the tenant's BOQ workspace
   */
  public static async addZone(
    tenantId: string,
    zoneName: string,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    const trimmed = zoneName.trim();
    if (!trimmed) {
      throw new Error('Tên khu vực không được để trống');
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    const exists = state.zoneGroups.some((z) => z.zoneName.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      throw new Error(`Khu vực "${trimmed}" đã tồn tại trong dự toán`);
    }

    const newZone = computeZoneGroup(`zone-${randomUUID().slice(0, 8)}`, trimmed, []);
    state.zoneGroups.push(newZone);

    return this.getBOQOverview(tenantId);
  }

  /**
   * Deletes a zone and all its constituent line items
   */
  public static async deleteZone(
    tenantId: string,
    zoneId: string,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    state.zoneGroups = state.zoneGroups.filter((z) => z.zoneId !== zoneId);
    return this.getBOQOverview(tenantId);
  }

  /**
   * Adds a new line item to a specified zone with pure server-side financial computation
   */
  public static async addItem(
    tenantId: string,
    input: CreateBOQItemInput,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    let zone = state.zoneGroups.find((z) => z.zoneId === input.zoneId);
    if (!zone && input.zoneName) {
      // Auto-create zone if not found but zoneName provided
      const newZone = computeZoneGroup(input.zoneId, input.zoneName, []);
      state.zoneGroups.push(newZone);
      zone = newZone;
    }
    if (!zone) {
      throw new Error(`Khu vực với id "${input.zoneId}" không tồn tại`);
    }

    // Compute total items across all zones to determine itemNumber
    const totalExistingItems = state.zoneGroups.reduce((sum, z) => sum + z.items.length, 0);
    const nextItemNumber = totalExistingItems + 1;

    const newItem = computeLineItem(
      nextItemNumber,
      `item-${randomUUID().slice(0, 8)}`,
      input.itemName.trim(),
      input.specifications.trim() || 'Theo tiêu chuẩn hoàn thiện Bella',
      input.unit.trim() || 'Cái',
      Number(input.quantity),
      Number(input.internalUnitCost),
      Number(input.clientUnitPrice),
    );

    const updatedItems = [...zone.items, newItem];
    const updatedZone = computeZoneGroup(zone.zoneId, zone.zoneName, updatedItems);
    state.zoneGroups = state.zoneGroups.map((z) => (z.zoneId === zone!.zoneId ? updatedZone : z));

    return this.getBOQOverview(tenantId);
  }

  /**
   * Updates an existing line item's quantity, specifications or pricing
   */
  public static async updateItem(
    tenantId: string,
    input: UpdateBOQItemInput,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    let found = false;
    state.zoneGroups = state.zoneGroups.map((zg) => {
      const idx = zg.items.findIndex((i) => i.id === input.itemId);
      if (idx === -1) return zg;

      found = true;
      const target = zg.items[idx];
      const quantity = input.quantity !== undefined ? Number(input.quantity) : target.quantity;
      const unitCost = input.internalUnitCost !== undefined ? Number(input.internalUnitCost) : target.internalUnitCost;
      const unitPrice = input.clientUnitPrice !== undefined ? Number(input.clientUnitPrice) : target.clientUnitPrice;

      const updated = computeLineItem(
        target.itemNumber,
        target.id,
        input.itemName !== undefined ? input.itemName.trim() : target.itemName,
        input.specifications !== undefined ? input.specifications.trim() : target.specifications,
        input.unit !== undefined ? input.unit.trim() : target.unit,
        quantity,
        unitCost,
        unitPrice,
      );

      const newItems = [...zg.items];
      newItems[idx] = updated;
      return computeZoneGroup(zg.zoneId, zg.zoneName, newItems);
    });

    if (!found) {
      throw new Error(`Cấu kiện với id "${input.itemId}" không tồn tại trong dự toán`);
    }

    return this.getBOQOverview(tenantId);
  }

  /**
   * Deletes a line item and re-indexes line numbers
   */
  public static async deleteItem(
    tenantId: string,
    itemId: string,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    let found = false;
    state.zoneGroups = state.zoneGroups.map((zg) => {
      const filtered = zg.items.filter((i) => i.id !== itemId);
      if (filtered.length !== zg.items.length) {
        found = true;
        return computeZoneGroup(zg.zoneId, zg.zoneName, filtered);
      }
      return zg;
    });

    if (!found) {
      throw new Error(`Cấu kiện với id "${itemId}" không tồn tại`);
    }

    // Re-index item numbers sequentially across all zones
    let counter = 1;
    state.zoneGroups = state.zoneGroups.map((zg) => {
      const reindexed = zg.items.map((i) => ({ ...i, itemNumber: counter++ }));
      return computeZoneGroup(zg.zoneId, zg.zoneName, reindexed);
    });

    return this.getBOQOverview(tenantId);
  }

  /**
   * Duplicates an existing item to another zone or within the same zone
   */
  public static async duplicateItem(
    tenantId: string,
    input: DuplicateBOQItemInput,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    this.assertEditable(state);

    let sourceItem: BOQLineItem | null = null;
    let sourceZoneId = '';

    for (const zg of state.zoneGroups) {
      const it = zg.items.find((i) => i.id === input.itemId);
      if (it) {
        sourceItem = it;
        sourceZoneId = zg.zoneId;
        break;
      }
    }

    if (!sourceItem) {
      throw new Error(`Không tìm thấy cấu kiện nguồn "${input.itemId}" để nhân bản`);
    }

    const targetZoneId = input.targetZoneId || sourceZoneId;
    const targetZone = state.zoneGroups.find((z) => z.zoneId === targetZoneId);
    if (!targetZone) {
      throw new Error(`Khu vực đích "${targetZoneId}" không tồn tại`);
    }

    const totalExistingItems = state.zoneGroups.reduce((sum, z) => sum + z.items.length, 0);
    const duplicated = computeLineItem(
      totalExistingItems + 1,
      `item-${randomUUID().slice(0, 8)}`,
      `${sourceItem.itemName} (Copy)`,
      sourceItem.specifications,
      sourceItem.unit,
      sourceItem.quantity,
      sourceItem.internalUnitCost,
      sourceItem.clientUnitPrice,
    );

    const updatedItems = [...targetZone.items, duplicated];
    state.zoneGroups = state.zoneGroups.map((z) =>
      z.zoneId === targetZoneId ? computeZoneGroup(z.zoneId, z.zoneName, updatedItems) : z
    );

    return this.getBOQOverview(tenantId);
  }

  /**
   * Transitions BOQ lifecycle status with strict workflow gates
   */
  public static async transitionStatus(
    tenantId: string,
    input: TransitionBOQStatusInput,
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    const current = state.status;
    const target = input.targetStatus;

    if (current === target) {
      return this.getBOQOverview(tenantId);
    }

    const validTransitions: Record<BOQStatus, BOQStatus[]> = {
      draft: ['under_review'],
      under_review: ['draft', 'approved'],
      approved: ['locked_for_contract'],
      locked_for_contract: [],
    };

    if (!validTransitions[current]?.includes(target)) {
      throw new Error(
        `Chuyển đổi trạng thái không hợp lệ: Từ "${current}" sang "${target}". Quy trình hợp lệ: Draft -> Under Review -> Approved -> Locked for Contract.`
      );
    }

    state.status = target;
    const dateStr = new Date().toLocaleDateString('vi-VN');

    if (target === 'approved') {
      state.audit = {
        versionLabel: `R${state.versionNumber}.0 - Approved`,
        approvalDateFormatted: dateStr,
        approvedBy: input.actorName || 'Trần Thị Mai',
      };
    } else if (target === 'under_review') {
      state.audit = {
        versionLabel: `R${state.versionNumber}.0 - Under Review`,
        approvalDateFormatted: dateStr,
        approvedBy: input.actorName || 'Chờ thẩm định',
      };
    } else if (target === 'draft') {
      state.audit = {
        versionLabel: `R${state.versionNumber}.0 - Draft`,
        approvalDateFormatted: dateStr,
        approvedBy: input.actorName || 'Đang lập dự toán',
      };
    } else if (target === 'locked_for_contract') {
      state.audit = {
        versionLabel: `R${state.versionNumber}.0 - Locked for Contract`,
        approvalDateFormatted: dateStr,
        approvedBy: input.actorName || 'Đã xuất Hợp đồng',
      };
    }

    return this.getBOQOverview(tenantId);
  }

  /**
   * Creates a new draft revision from an approved or locked BOQ (Fork / Increment Revision)
   */
  public static async createRevision(
    tenantId: string,
    input: CreateBOQRevisionInput = {},
  ): Promise<BOQOverviewResponse> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }

    const state = this.getOrCreateTenantState(tenantId);
    if (state.status !== 'approved' && state.status !== 'locked_for_contract') {
      throw new Error(
        'Chỉ có thể tạo phiên bản mới (Revision) từ BOQ đã Approved hoặc Locked for Contract.'
      );
    }

    // Preserve historical snapshot of current version before incrementing
    if (!state.snapshots) {
      state.snapshots = new Map();
    }
    state.snapshots.set(state.versionNumber, {
      project: { ...state.project },
      zoneGroups: state.zoneGroups.map((zg) => ({
        ...zg,
        items: zg.items.map((i) => ({ ...i })),
      })),
      bomMaterials: state.bomMaterials.map((b) => ({ ...b })),
      audit: { ...state.audit },
      status: state.status,
      versionNumber: state.versionNumber,
    });

    state.versionNumber += 1;
    state.status = 'draft';
    state.audit = {
      versionLabel: `R${state.versionNumber}.0 - Draft`,
      approvalDateFormatted: new Date().toLocaleDateString('vi-VN'),
      approvedBy: input.actorName || 'Người lập dự toán',
    };

    return this.getBOQOverview(tenantId);
  }

  /**
   * Retrieves a historical revision snapshot (Immutable Audit Trail)
   */
  public static getHistoricalSnapshot(
    tenantId: string,
    versionNumber: number
  ): Omit<TenantBOQState, 'snapshots'> | null {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    const state = this.getOrCreateTenantState(tenantId);
    if (state.versionNumber === versionNumber) {
      return {
        project: state.project,
        zoneGroups: state.zoneGroups,
        bomMaterials: state.bomMaterials,
        audit: state.audit,
        status: state.status,
        versionNumber: state.versionNumber,
      };
    }
    return state.snapshots?.get(versionNumber) || null;
  }

  /**
   * Synchronizes current tenant state to real Supabase repository
   */
  public static async syncToRepository(
    tenantId: string,
    repo: SupabaseInteriorRepository,
    actorName?: string,
  ): Promise<void> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    const state = this.getOrCreateTenantState(tenantId);
    const kpis = computeFinancialKPIs(state.zoneGroups);

    const boqId = `boq-${state.project.id}-${state.versionNumber}`;
    const domainItems: DomainBOQItem[] = [];

    for (const zg of state.zoneGroups) {
      for (const item of zg.items) {
        domainItems.push({
          id: item.id.startsWith('item-') ? item.id : `item-${item.id}`,
          tenantId,
          boqId,
          roomZoneId: zg.zoneId,
          roomZoneName: zg.zoneName,
          itemCode: `ITEM-${item.itemNumber}`,
          itemName: item.itemName,
          category: 'cabinetry' as FurnitureItemCategory,
          dimensions: { width: 2000, depth: 600, height: 850, unit: 'mm' },
          specifications: {
            carcassMaterial: item.specifications,
            doorFrontMaterial: 'Tiêu chuẩn hoàn thiện',
            surfaceFinish: 'Sơn PU hoàn thiện',
            hardwareSpec: 'Bản lề ray trượt tiêu chuẩn',
          },
          unit: (item.unit as 'bộ' | 'cái' | 'md' | 'm2' | 'gói') || 'cái',
          quantity: item.quantity,
          internalUnitCost: item.internalUnitCost,
          internalTotalCost: item.internalTotalCost,
          clientUnitPrice: item.clientUnitPrice,
          clientTotalPrice: item.clientTotalPrice,
          grossMarginAmount: item.grossMarginAmount,
          grossMarginPercent: item.grossMarginPercent,
        });
      }
    }

    const domainBOQ: DomainInteriorBOQ = {
      id: boqId,
      tenantId,
      projectId: state.project.id,
      designRevisionId: 'rev-001',
      boqNumber: `BOQ-${state.project.code}-V${state.versionNumber}`,
      versionNumber: state.versionNumber,
      status: state.status,
      totalInternalCost: kpis.totalCogs.rawValue,
      totalClientPrice: kpis.totalClientPrice.rawValue,
      totalGrossMargin: kpis.grossProfit.rawValue,
      grossMarginPercent: kpis.grossMargin.rawPercentage,
      items: domainItems,
      preparedBy: actorName || state.audit.approvedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.saveBOQ(tenantId, domainBOQ);
  }

  /**
   * Resets tenant state (Used for test isolation)
   */
  public static resetTenantBOQData(tenantId?: string): void {
    if (tenantId) {
      this.tenantStore.delete(tenantId);
    } else {
      this.tenantStore.clear();
    }
  }
}


