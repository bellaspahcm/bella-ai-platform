'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — BOQ & BOM Commercial & Manufacturing Costing Page
 *
 * Implements the executive BOQ & BOM dashboard matching reference design:
 * - Top breadcrumb with project context (Villa Sunrise Renovation INT-2024-001)
 * - 4 Financial KPI cards (COGS 1.25B, Client Price 1.68B, Profit 430M, Gross Margin 25.6%)
 * - Tripartite Costing Itemized BOQ table with grouped two-tier headers
 * - Area subtotals for Living room, Master bedroom, Kitchen & Dining
 * - Switcher between BOQ (Commercial) and BOM (Production Bill of Materials)
 * - Bottom version audit link (R1.0 - Approved, Trần Thị Mai, 06/11/2026)
 * - Zero UI calculation: All data, formatting, formulas, and percentages are precomputed server-side.
 *
 * @module src/app/dashboard/interior/boq/page
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  Search,
  Bell,
  ChevronDown,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  Settings,
  Download,
  Printer,
  Filter,
  Layers,
  Tag,
  TrendingUp,
  Percent,
  Folder,
  Calendar,
  User,
  Eye,
  CheckCircle2,
  X,
  FileText,
  MapPin,
  Maximize2,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Send,
  Check,
  RotateCcw,
  FilePlus,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import type {
  BOQOverviewResponse,
  BOQLineItem,
  BOQZoneGroup,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/products/bella-interior/domain/boq-overview.types';
import type { BOQStatus } from '@/products/bella-interior/domain/commercial-costing/types';

// Baseline initial state for instant zero-flicker render
const INITIAL_BOQ_OVERVIEW: BOQOverviewResponse = {
  tenantId: 'tenant-bella-interior-default',
  project: {
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
  },
  kpis: {
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
  },
  activeView: 'boq',
  zoneGroups: [
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
  ],
  bomMaterials: [
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
  ],
  audit: {
    versionLabel: 'R1.0 - Approved',
    approvalDateFormatted: '06/11/2026',
    approvedBy: 'Trần Thị Mai',
  },
  status: 'approved',
  versionNumber: 1,
};

export default function InteriorBOQPage() {
  const [data, setData] = useState<BOQOverviewResponse>(INITIAL_BOQ_OVERVIEW);
  const [currentTab, setCurrentTab] = useState<'boq' | 'bom'>('boq');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<BOQLineItem | null>(null);

  // Modals
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showQuoteModal, setShowQuoteModal] = useState<boolean>(false);
  const [showFilterBar, setShowFilterBar] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manual Workspace Modals & Form State
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showEditItemModal, setShowEditItemModal] = useState<boolean>(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Fields
  const [formZoneId, setFormZoneId] = useState<string>('');
  const [formItemName, setFormItemName] = useState<string>('');
  const [formSpecs, setFormSpecs] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('Bộ');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formInternalCost, setFormInternalCost] = useState<number>(10_000_000);
  const [formClientPrice, setFormClientPrice] = useState<number>(15_000_000);

  // Zone State
  const [newZoneName, setNewZoneName] = useState<string>('');

  const boqStatus = (data.status as BOQStatus) || 'approved';
  const isEditable = boqStatus === 'draft';

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const executeBOQAction = async (payload: unknown, successMsg?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/interior/boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Thao tác không thành công');
      }
      setData(json.data);
      if (successMsg) {
        showNotification(successMsg, 'success');
      }
      return json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi cập nhật BOQ';
      showNotification(msg, 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddItem = (zoneId?: string) => {
    const targetZone = zoneId || data.zoneGroups[0]?.zoneId || '';
    setFormZoneId(targetZone);
    setFormItemName('');
    setFormSpecs('');
    setFormUnit('Bộ');
    setFormQuantity(1);
    setFormInternalCost(10_000_000);
    setFormClientPrice(15_000_000);
    setShowAddItemModal(true);
  };

  const handleSaveAddItem = async () => {
    if (!formItemName.trim()) {
      showNotification('Vui lòng nhập tên cấu kiện', 'error');
      return;
    }
    if (!formZoneId) {
      showNotification('Vui lòng chọn khu vực', 'error');
      return;
    }
    await executeBOQAction(
      {
        action: 'add_item',
        item: {
          zoneId: formZoneId,
          itemName: formItemName.trim(),
          specifications: formSpecs.trim() || 'Theo thiết kế 3D chi tiết',
          unit: formUnit,
          quantity: Math.max(0.01, formQuantity),
          internalUnitCost: Math.max(0, formInternalCost),
          clientUnitPrice: Math.max(0, formClientPrice),
        },
      },
      `Đã thêm cấu kiện "${formItemName.trim()}" thành công`
    );
    setShowAddItemModal(false);
  };

  const handleOpenEditItem = (item: BOQLineItem, zoneId: string) => {
    setEditingItemId(item.id);
    setFormZoneId(zoneId);
    setFormItemName(item.itemName);
    setFormSpecs(item.specifications);
    setFormUnit(item.unit);
    setFormQuantity(item.quantity);
    setFormInternalCost(item.internalUnitCost);
    setFormClientPrice(item.clientUnitPrice);
    setShowEditItemModal(true);
  };

  const handleSaveEditItem = async () => {
    if (!editingItemId) return;
    if (!formItemName.trim()) {
      showNotification('Vui lòng nhập tên cấu kiện', 'error');
      return;
    }
    await executeBOQAction(
      {
        action: 'update_item',
        item: {
          itemId: editingItemId,
          itemName: formItemName.trim(),
          specifications: formSpecs.trim(),
          unit: formUnit,
          quantity: Math.max(0.01, formQuantity),
          internalUnitCost: Math.max(0, formInternalCost),
          clientUnitPrice: Math.max(0, formClientPrice),
        },
      },
      `Đã cập nhật cấu kiện "${formItemName.trim()}" thành công`
    );
    setShowEditItemModal(false);
    setEditingItemId(null);
  };

  const handleDuplicateItem = async (itemId: string, itemName: string) => {
    await executeBOQAction(
      {
        action: 'duplicate_item',
        duplicate: { itemId },
      },
      `Đã nhân bản cấu kiện "${itemName}"`
    );
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cấu kiện "${itemName}" khỏi dự toán?`)) {
      return;
    }
    await executeBOQAction(
      {
        action: 'delete_item',
        itemId,
      },
      `Đã xóa cấu kiện "${itemName}"`
    );
  };

  const handleSaveAddZone = async () => {
    if (!newZoneName.trim()) {
      showNotification('Vui lòng nhập tên khu vực', 'error');
      return;
    }
    await executeBOQAction(
      {
        action: 'add_zone',
        zoneName: newZoneName.trim(),
      },
      `Đã thêm khu vực "${newZoneName.trim()}"`
    );
    setNewZoneName('');
    setShowAddZoneModal(false);
  };

  const handleDeleteZone = async (zoneId: string, zoneName: string) => {
    if (!window.confirm(`Xác nhận xóa khu vực "${zoneName}" và tất cả cấu kiện liên quan?`)) {
      return;
    }
    await executeBOQAction(
      {
        action: 'delete_zone',
        zoneId,
      },
      `Đã xóa khu vực "${zoneName}"`
    );
  };

  const handleStatusTransition = async (targetStatus: BOQStatus) => {
    const statusLabels: Record<BOQStatus, string> = {
      draft: 'Bản nháp (Draft)',
      under_review: 'Gửi duyệt (Under Review)',
      approved: 'Phê duyệt chính thức (Approved)',
      locked_for_contract: 'Khóa theo Hợp đồng (Locked)',
    };
    if (
      targetStatus === 'approved' &&
      !window.confirm('Xác nhận phê duyệt BOQ? Sau khi duyệt, dự toán sẽ trở thành BẤT BIẾN, mọi sửa đổi phải tạo Revision mới.')
    ) {
      return;
    }
    await executeBOQAction(
      {
        action: 'update_status',
        transition: { targetStatus },
      },
      `Trạng thái dự toán đã chuyển sang: ${statusLabels[targetStatus]}`
    );
  };

  const handleCreateRevision = async () => {
    if (!window.confirm('Tạo Revision dự thảo mới? Hệ thống sẽ giữ nguyên phiên bản đã duyệt và mở phiên bản mới ở trạng thái Nháp để bạn hiệu chỉnh.')) {
      return;
    }
    await executeBOQAction(
      {
        action: 'create_revision',
        revision: {},
      },
      'Đã khởi tạo Revision mới thành công! Hiện bạn có thể chỉnh sửa dự toán.'
    );
  };

  const handleResetBOQ = async () => {
    if (!window.confirm('Khôi phục lại dữ liệu BOQ mẫu ban đầu?')) {
      return;
    }
    await executeBOQAction(
      { action: 'reset' },
      'Đã khôi phục dữ liệu mẫu ban đầu'
    );
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchBOQData() {
      try {
        const res = await fetch('/api/interior/boq');
        if (res.ok) {
          const json: BOQOverviewResponse = await res.json();
          if (isMounted) {
            setData(json);
          }
        }
      } catch {
        // Retain initial state
      }
    }

    fetchBOQData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleCheck = (id: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExportReport = () => {
    setToastMessage('Đang kết xuất báo cáo dự toán thương mại BOQ (PDF/Excel)...');
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-5">
      {/* ─── Toast Feedback ─── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Top Header: Breadcrumbs & Search / User Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Link
            href="/dashboard/interior"
            className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <Home className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <span className="text-slate-400">›</span>
          <Link
            href="/dashboard/interior/projects"
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Dự án
          </Link>
          <span className="text-slate-400">›</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {data.project.name} ({data.project.code})
          </span>
        </div>

        {/* Search, Notifications & User */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm... (Ctrl + K)"
              readOnly
              className="w-56 pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none cursor-pointer shadow-2xs"
            />
          </div>

          {/* Notifications with Red Badge */}
          <button
            type="button"
            className="relative p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs transition-colors"
            aria-label="Thông báo"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
              3
            </span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1 cursor-pointer">
            <img
              src={'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg'}
              alt="Nguyễn Văn Quang"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nguyễn Văn Quang
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Project Title & Metadata & Action Buttons Row ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Title & Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {data.project.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                boqStatus === 'draft'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700'
                  : boqStatus === 'under_review'
                  ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700'
                  : boqStatus === 'approved'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                  : 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  boqStatus === 'draft'
                    ? 'bg-amber-500'
                    : boqStatus === 'under_review'
                    ? 'bg-blue-500'
                    : boqStatus === 'approved'
                    ? 'bg-emerald-500'
                    : 'bg-purple-500'
                }`}
              />
              <span>
                {boqStatus === 'draft'
                  ? 'Bản nháp (Draft)'
                  : boqStatus === 'under_review'
                  ? 'Đang duyệt (Under Review)'
                  : boqStatus === 'approved'
                  ? 'Đã duyệt (Approved)'
                  : 'Khóa hợp đồng (Locked)'}
              </span>
            </span>

            {/* Revision Tag */}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {data.audit.versionLabel}
            </span>
          </div>

          {/* Metadata line */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            <div className="flex items-center gap-1 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Khách hàng:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {data.project.clientName}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="font-medium">
              <span>Diện tích:</span>{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {data.project.areaFormatted}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Địa điểm:</span>{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {data.project.location}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1 font-medium">
              {isEditable ? (
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  Chế độ: Đang soạn thảo
                </span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Chế độ: Bất biến (Đã khóa)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Lifecycle & Workspace Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Draft Mode Actions */}
          {boqStatus === 'draft' && (
            <>
              <button
                type="button"
                onClick={() => setShowAddZoneModal(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>+ Thêm khu vực</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddItem()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm cấu kiện</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusTransition('under_review')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi duyệt (Submit)</span>
              </button>
            </>
          )}

          {/* Under Review Actions */}
          {boqStatus === 'under_review' && (
            <>
              <button
                type="button"
                onClick={() => handleStatusTransition('approved')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Phê duyệt BOQ (Approve)</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusTransition('draft')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 shadow-2xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Trả về Draft</span>
              </button>
            </>
          )}

          {/* Approved & Locked Actions */}
          {(boqStatus === 'approved' || boqStatus === 'locked_for_contract') && (
            <>
              <button
                type="button"
                onClick={handleCreateRevision}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                title="Tạo phiên bản dự thảo mới (R2.0) từ dữ liệu đã duyệt để tiếp tục chỉnh sửa"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>Tạo Revision mới (Chỉnh sửa)</span>
              </button>

              {boqStatus === 'approved' && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition('locked_for_contract')}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  title="Khóa dự toán gắn kết với hợp đồng chính thức"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Khóa Hợp đồng</span>
                </button>
              )}
            </>
          )}

          {/* Standard Navigation & History Modals */}
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">So sánh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Lịch sử</span>
          </button>

          {/* Lập Báo giá / Hợp đồng */}
          <button
            type="button"
            onClick={() => setShowQuoteModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Lập Báo giá</span>
            <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleResetBOQ}
            disabled={isSubmitting}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-2xs transition-all cursor-pointer"
            title="Khôi phục dữ liệu mẫu ban đầu"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Lifecycle Sub-navigation Tabs ─── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-6 overflow-x-auto text-xs font-semibold">
        <Link
          href="/dashboard/interior/projects"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Tổng quan
        </Link>
        <Link
          href="/dashboard/interior/design"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Thiết kế
        </Link>
        <Link
          href="/dashboard/interior/materials"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Vật liệu
        </Link>
        <button
          type="button"
          className="pb-3 border-b-2 border-[#0f4c3a] text-[#0f4c3a] dark:border-emerald-400 dark:text-emerald-400 font-bold whitespace-nowrap transition-colors"
        >
          BOQ &amp; BOM
        </button>
        <Link
          href="/dashboard/interior/production"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Sản xuất
        </Link>
        <Link
          href="/dashboard/interior/installation"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Thi công
        </Link>
        <Link
          href="/dashboard/interior/reports"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap transition-colors"
        >
          Báo cáo
        </Link>
      </div>

      {/* ─── 4 Financial KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng giá vốn nội bộ (COGS) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>{data.kpis.totalCogs.label}</span>
              <span title={data.kpis.totalCogs.tooltip} className="cursor-help text-slate-400">ⓘ</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.kpis.totalCogs.formattedValue}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {data.kpis.totalCogs.trendLabel}
          </div>
        </div>

        {/* KPI 2: Tổng giá bán khách hàng */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>{data.kpis.totalClientPrice.label}</span>
              <span title={data.kpis.totalClientPrice.tooltip} className="cursor-help text-slate-400">ⓘ</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.kpis.totalClientPrice.formattedValue}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {data.kpis.totalClientPrice.trendLabel}
          </div>
        </div>

        {/* KPI 3: Lợi nhuận gộp dự kiến */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>{data.kpis.grossProfit.label}</span>
              <span title={data.kpis.grossProfit.tooltip} className="cursor-help text-slate-400">ⓘ</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.kpis.grossProfit.formattedValue}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {data.kpis.grossProfit.trendLabel}
          </div>
        </div>

        {/* KPI 4: Gross Margin */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {data.kpis.grossMargin.label}
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.kpis.grossMargin.formattedPercentage}
          </div>
          {/* Smooth Rising Sparkline */}
          <div className="mt-1 h-5 w-full">
            <svg viewBox="0 0 100 20" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 16 Q 25 14, 50 10 T 100 4"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Mode Switcher (BOQ vs BOM) & Filter / Export Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Switchers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentTab('boq')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'boq'
                ? 'bg-[#0f4c3a] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>BOQ – Dự toán thương mại</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('bom')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'bom'
                ? 'bg-[#0f4c3a] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>BOM – Định mức sản xuất</span>
          </button>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>In báo cáo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilterBar((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
              showFilterBar
                ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Bộ lọc</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Filter Bar Panel when toggled */}
      {showFilterBar && (
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-slate-850/60 border border-amber-200/60 dark:border-slate-800 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Lọc chuyên mục:</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold">Tất cả ({data.zoneGroups.length} khu vực)</span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">Mộc &amp; Ván gỗ</span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">Kim loại &amp; Cơ khí</span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">Đá &amp; Kính</span>
          </div>
          <button
            type="button"
            onClick={() => setShowFilterBar(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Đóng
          </button>
        </div>
      )}

      {/* ─── Main Content Table Card ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        {currentTab === 'boq' ? (
          /* Tripartite Costing Itemized BOQ Table */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[1000px]">
              {/* Grouped Two-Tier Header */}
              <thead>
                {/* Row 1: Group Categories */}
                <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-3 w-10 text-center border-r border-slate-100 dark:border-slate-800">
                    #
                  </th>
                  <th colSpan={2} className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 text-center">
                    Cấu kiện
                  </th>
                  <th colSpan={2} className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 text-center">
                    Khối lượng
                  </th>
                  <th colSpan={2} className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 text-center">
                    Giá vốn
                  </th>
                  <th colSpan={4} className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 text-center">
                    Thương mại
                  </th>
                  <th className="py-2.5 px-2 text-center w-24">
                    Thao tác
                  </th>
                </tr>

                {/* Row 2: Detailed Column Titles */}
                <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <th className="py-2 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="py-2 px-3">Khu vực / Hạng mục</th>
                  <th className="py-2 px-3">Quy cách</th>
                  <th className="py-2 px-2 text-center w-14">ĐVT</th>
                  <th className="py-2 px-3 text-center w-16">Số lượng</th>
                  <th className="py-2 px-3 text-right">Đơn giá vốn</th>
                  <th className="py-2 px-3 text-right">Thành tiền vốn</th>
                  <th className="py-2 px-3 text-right">Đơn giá bán</th>
                  <th className="py-2 px-3 text-right">Thành tiền bán</th>
                  <th className="py-2 px-3 text-right">Lợi nhuận</th>
                  <th className="py-2 px-3 text-center w-18">Biên LN</th>
                  <th className="py-2 px-2 text-center w-24">{isEditable ? 'Thao tác' : 'Trạng thái'}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.zoneGroups.map((group) => (
                  <React.Fragment key={group.zoneId}>
                    {/* Zone Group Header Row with Subtotals */}
                    <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold text-xs text-slate-900 dark:text-white border-y border-emerald-100/60 dark:border-emerald-900/30">
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Chọn khu vực ${group.zoneName}`}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td colSpan={5} className="py-2.5 px-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                            <Folder className="w-4 h-4 text-emerald-600" />
                            <span>{group.zoneName}</span>
                            <span className="text-[10px] font-normal text-slate-400">({group.items.length} cấu kiện)</span>
                          </div>
                          {isEditable && (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleOpenAddItem(group.zoneId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 shadow-2xs cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Thêm cấu kiện</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteZone(group.zoneId, group.zoneName)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Xóa khu vực"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-800 dark:text-slate-200">
                        {group.subtotalCogsFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                        {group.subtotalPriceFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                        {group.subtotalProfitFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                        {group.subtotalMarginPercentFormatted}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400 text-[10px] font-semibold">—</td>
                    </tr>

                    {/* Zone Line Items */}
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedDrawerItem(item)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                      >
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedItems[item.id])}
                            onChange={() => handleToggleCheck(item.id)}
                            aria-label={`Chọn ${item.itemName}`}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono text-[11px] w-4 text-center">
                              {item.itemNumber}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.itemName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          {item.specifications}
                        </td>
                        <td className="py-2.5 px-2 text-center text-[11px] text-slate-500">
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium">
                          {item.quantityFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {item.internalUnitCostFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {item.internalTotalCostFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {item.clientUnitPriceFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {item.clientTotalPriceFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.grossMarginFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.grossMarginPercentFormatted}
                        </td>
                        {/* 12th Column: Row Actions */}
                        <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {isEditable ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditItem(item, group.zoneId)}
                                className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title="Chỉnh sửa cấu kiện"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(item.id, item.itemName)}
                                className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                                title="Nhân bản cấu kiện"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id, item.itemName)}
                                className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Xóa cấu kiện"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-slate-400" title="Dự toán đã khóa bất biến">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {/* Quick Add Row in Draft Mode */}
            {isEditable && (
              <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddItem()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm cấu kiện mới</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddZoneModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm khu vực mới</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 italic">
                  * Mọi thay đổi về đơn giá hoặc số lượng sẽ được máy chủ tự động tính toán lại tức thời.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Production BOM Materials Table */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-4">Mã vật tư</th>
                  <th className="py-3 px-4">Tên vật tư &amp; Phân loại</th>
                  <th className="py-3 px-4">Quy cách kỹ thuật</th>
                  <th className="py-3 px-3 text-center">ĐVT</th>
                  <th className="py-3 px-3 text-center">Định mức cần</th>
                  <th className="py-3 px-3 text-center">Hao hụt (%)</th>
                  <th className="py-3 px-3 text-center">Tổng xuất kho</th>
                  <th className="py-3 px-4 text-center">Trạng thái kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {data.bomMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                      {mat.materialCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{mat.materialName}</div>
                      <div className="text-[10px] text-slate-400">{mat.categoryLabel}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">{mat.spec}</td>
                    <td className="py-3 px-3 text-center text-slate-500">{mat.unit}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{mat.requiredQuantity}</td>
                    <td className="py-3 px-3 text-center font-mono text-amber-600 font-bold">{mat.wasteFactorPercent}%</td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-blue-600">{mat.totalAllocated}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${mat.stockStatusBadgeClass}`}>
                        {mat.stockStatusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Bottom Audit & Version Lock Bar ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Phiên bản BOQ</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                  {data.audit.versionLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Ngày duyệt */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Ngày duyệt</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data.audit.approvalDateFormatted}
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Người duyệt */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Người duyệt</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data.audit.approvedBy}
              </div>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDrawerItem(data.zoneGroups[0]?.items[0] || null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Xem chi tiết</span>
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* ─── Drawer: Item Tripartite Costing Drilldown ─── */}
      {selectedDrawerItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between space-y-4 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Tripartite Costing Details
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {selectedDrawerItem.itemName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDrawerItem(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80">
                  <div className="font-bold text-slate-900 dark:text-white mb-1">Quy cách kỹ thuật</div>
                  <div className="text-slate-600 dark:text-slate-300">{selectedDrawerItem.specifications}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Đơn vị: {selectedDrawerItem.unit} · Khối lượng: {selectedDrawerItem.quantityFormatted}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80">
                    <div className="text-[10px] font-bold text-blue-700">Đơn giá vốn nội bộ</div>
                    <div className="text-sm font-extrabold text-blue-900 dark:text-blue-200 mt-1">
                      {selectedDrawerItem.internalUnitCostFormatted} đ
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Thành tiền vốn: {selectedDrawerItem.internalTotalCostFormatted} đ</div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80">
                    <div className="text-[10px] font-bold text-emerald-700">Đơn giá bán khách hàng</div>
                    <div className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200 mt-1">
                      {selectedDrawerItem.clientUnitPriceFormatted} đ
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Thành tiền bán: {selectedDrawerItem.clientTotalPriceFormatted} đ</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-950 dark:text-emerald-200">
                    <span>Lợi nhuận gộp cấu kiện:</span>
                    <span className="text-sm font-extrabold text-emerald-600">{selectedDrawerItem.grossMarginFormatted} đ</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
                    <span>Tỷ suất lợi nhuận (Gross Margin):</span>
                    <span>{selectedDrawerItem.grossMarginPercentFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDrawerItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: So sánh phiên bản BOQ ─── */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  So sánh phiên bản dự toán BOQ
                </h3>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <div className="font-extrabold text-slate-900 mb-1">R1.0 (Approved)</div>
                <div>• Giá vốn COGS: 1,250,000,000 đ</div>
                <div>• Giá bán: 1,680,000,000 đ</div>
                <div>• Lợi nhuận: 430,000,000 đ (25.6%)</div>
                <div>• Ngày duyệt: 06/11/2026</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-extrabold text-slate-900 mb-1">R0.9 (Dự thảo sơ bộ)</div>
                <div>• Giá vốn COGS: 1,180,000,000 đ</div>
                <div>• Giá bán: 1,550,000,000 đ</div>
                <div>• Lợi nhuận: 370,000,000 đ (23.8%)</div>
                <div>• Chưa bao gồm đá Vicostone đảo bếp</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Lập Báo giá / Hợp đồng ─── */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lập Báo giá &amp; Hợp đồng thương mại
                </h3>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 text-xs text-emerald-900 space-y-2 border border-emerald-200">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Dữ liệu BOQ R1.0 đã được xác nhận!
              </div>
              <div>
                Hệ thống sẽ chuyển toàn bộ giá bán <strong>1,680,000,000 đ</strong> sang module <em>Báo giá &amp; Hợp đồng</em> kèm theo điều khoản thanh toán 4 đợt.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <Link
                href="/dashboard/interior/contracts"
                className="px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold"
              >
                Chuyển sang Báo giá &amp; Hợp đồng →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Lịch sử BOQ ─── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lịch sử phê duyệt BOQ &amp; BOM
                </h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>06/11/2026 15:45</span>
                  <span className="text-emerald-600">BOQ Locked &amp; Approved</span>
                </div>
                <div className="text-slate-600 mt-1">
                  Trần Thị Mai phê duyệt dự toán R1.0 tổng giá bán 1.68 tỷ, lợi nhuận gộp 25.6%.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 4: Thêm Cấu Kiện Mới ─── */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Thêm Cấu Kiện Dự Toán Mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Chọn khu vực */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Khu vực / Phòng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formZoneId}
                  onChange={(e) => setFormZoneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {data.zoneGroups.map((z) => (
                    <option key={z.zoneId} value={z.zoneId}>
                      {z.zoneName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tên cấu kiện */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên cấu kiện / Hạng mục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  placeholder="Ví dụ: Tủ giày cánh kính, Sofa băng, Kệ tivi..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quy cách kỹ thuật */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quy cách kỹ thuật &amp; Vật liệu
                </label>
                <input
                  type="text"
                  value={formSpecs}
                  onChange={(e) => setFormSpecs(e.target.value)}
                  placeholder="Ví dụ: Thùng MDF lõi xanh chống ẩm, cánh Acrylic bóng gương..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Grid: ĐVT & Số lượng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn vị tính (ĐVT)
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Bộ">Bộ</option>
                    <option value="Cái">Cái</option>
                    <option value="Mét dài">Mét dài</option>
                    <option value="m²">m²</option>
                    <option value="m3">m3</option>
                    <option value="Gói">Gói</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số lượng
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.5"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Grid: Đơn giá vốn & Đơn giá bán */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn giá vốn nội bộ (COGS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={formInternalCost}
                    onChange={(e) => setFormInternalCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn giá bán khách hàng
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={formClientPrice}
                    onChange={(e) => setFormClientPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Live Financial Calculation Preview */}
              {(() => {
                const cogs = Math.max(0, formQuantity * formInternalCost);
                const price = Math.max(0, formQuantity * formClientPrice);
                const profit = price - cogs;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const markup = cogs > 0 ? (profit / cogs) * 100 : 0;
                return (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Thành tiền vốn (COGS):</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cogs.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Thành tiền bán:</span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                        {price.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">Lợi nhuận gộp cấu kiện:</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {profit.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Gross Margin: <strong className="text-emerald-600">{margin.toFixed(1)}%</strong></span>
                      <span>Markup: <strong className="text-blue-600">{markup.toFixed(1)}%</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAddItem}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu cấu kiện'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 5: Chỉnh Sửa Cấu Kiện ─── */}
      {showEditItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chỉnh Sửa Cấu Kiện Dự Toán
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditItemModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Tên cấu kiện */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên cấu kiện / Hạng mục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quy cách kỹ thuật */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quy cách kỹ thuật &amp; Vật liệu
                </label>
                <input
                  type="text"
                  value={formSpecs}
                  onChange={(e) => setFormSpecs(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Grid: ĐVT & Số lượng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn vị tính (ĐVT)
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bộ">Bộ</option>
                    <option value="Cái">Cái</option>
                    <option value="Mét dài">Mét dài</option>
                    <option value="m²">m²</option>
                    <option value="m3">m3</option>
                    <option value="Gói">Gói</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số lượng
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.5"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Grid: Đơn giá vốn & Đơn giá bán */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn giá vốn nội bộ (COGS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={formInternalCost}
                    onChange={(e) => setFormInternalCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn giá bán khách hàng
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={formClientPrice}
                    onChange={(e) => setFormClientPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Live Financial Calculation Preview */}
              {(() => {
                const cogs = Math.max(0, formQuantity * formInternalCost);
                const price = Math.max(0, formQuantity * formClientPrice);
                const profit = price - cogs;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const markup = cogs > 0 ? (profit / cogs) * 100 : 0;
                return (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Thành tiền vốn (COGS):</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cogs.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Thành tiền bán:</span>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                        {price.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">Lợi nhuận gộp cấu kiện:</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {profit.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Gross Margin: <strong className="text-emerald-600">{margin.toFixed(1)}%</strong></span>
                      <span>Markup: <strong className="text-blue-600">{markup.toFixed(1)}%</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditItemModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditItem}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Cập nhật cấu kiện'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 6: Thêm Khu Vực Mới ─── */}
      {showAddZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Thêm Khu Vực Dự Toán Mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddZoneModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên khu vực / Không gian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Ví dụ: Phòng làm việc, Ban công, Phòng ngủ trẻ em..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddZoneModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAddZone}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang tạo...' : 'Tạo khu vực'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
