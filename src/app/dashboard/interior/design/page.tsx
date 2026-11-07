'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Design Studio & Specification Showcase Page
 *
 * Implements the executive Design Studio dashboard matching reference design:
 * - Top breadcrumb & user status bar (Villa Sunrise Renovation INT-2024-001)
 * - Approved Design Lock strip (R1.0, approval metadata, lock invariant)
 * - 3D Perspectives Showcase with 4K renders and +3 gallery thumbnails
 * - Material & Specification Cards (Veneer Óc Chó, Đá Thạch Anh, Bản Lề, Khung Nhôm Slim)
 * - Material Compliance Audit Banner ("Tất cả vật liệu đều đạt tiêu chuẩn")
 * - Technical CAD Blueprints (DWG, PDF) and Document archives
 * - Zero UI logic: All business rules & calculations are computed server-side.
 *
 * @module src/app/dashboard/interior/design/page
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  CheckCircle2,
  Lock,
  Unlock,
  Calendar,
  User,
  FileText,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  Maximize2,
  Box,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  Ruler,
  FolderOpen,
  X,
  Eye,
  Check,
} from 'lucide-react';

import type {
  DesignStudioOverviewResponse,
  DesignVisualItem,
} from '@/products/bella-interior/domain/design-overview.types';

// Baseline initial state for instant zero-flicker render
const INITIAL_DESIGN_OVERVIEW: DesignStudioOverviewResponse = {
  tenantId: 'tenant-bella-interior-default',
  project: {
    id: 'proj-villa-sunrise',
    code: 'INT-2024-001',
    name: 'Villa Sunrise Renovation',
    breadcrumbLabel: 'Dự án > Villa Sunrise Renovation (INT-2024-001)',
    status: 'in_progress',
    statusLabel: 'Đang thực hiện',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    clientName: 'Trần Thị Mai',
    contractValueFormatted: '3.85 tỷ',
  },
  versionLock: {
    versionId: 'rev-r1-0',
    versionNumber: 'R1.0',
    status: 'approved',
    statusLabel: 'Đã duyệt',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    isLocked: true,
    lockLabel: 'Đã khóa',
    lockBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    approvalDateFormatted: '06/11/2026',
    approvedBy: 'Trần Thị Mai',
    description: 'Phiên bản thiết kế chính thức',
    lockBannerTitle: 'Approved Design Lock',
    lockBannerSubtitle: 'Đã khóa thiết kế, chỉ cho phép tạo phiên bản mới',
    canUnlock: true,
  },
  activeTab: 'design',
  subTabs: [
    { key: 'overview', label: 'Tổng quan', href: '/dashboard/interior/projects', isActive: false },
    { key: 'design', label: 'Thiết kế', href: '/dashboard/interior/design', isActive: true },
    { key: 'materials', label: 'Vật liệu', href: '/dashboard/interior/materials', isActive: false },
    { key: 'boq', label: 'BOQ & Dự toán', href: '/dashboard/interior/boq', isActive: false },
    { key: 'production', label: 'Sản xuất', href: '/dashboard/interior/production', isActive: false },
    { key: 'installation', label: 'Thi công', href: '/dashboard/interior/installation', isActive: false },
    { key: 'reports', label: 'Báo cáo', href: '/dashboard/interior/reports', isActive: false },
  ],
  visuals: [
    {
      id: 'vis-1',
      title: 'Phối cảnh Phòng khách & Bàn trà',
      roomZone: 'Phòng khách',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=300&q=80',
      isPrimary: true,
      viewAngleName: 'Góc nhìn chính (Chính diện sofa & bàn trà tròn)',
      resolution: '4K Ultra-HD (3840x2160)',
      fileFormat: '3ds Max / Corona Render',
      updatedDateFormatted: '06/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-2',
      title: 'Khu vực Bàn ăn & Đèn chùm thả',
      roomZone: 'Phòng ăn',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn phòng ăn liên thông',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '05/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
    {
      id: 'vis-3',
      title: 'Phòng ngủ Master & Hệ vách ốp đầu giường',
      roomZone: 'Phòng ngủ Master',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn tổng thể giường ngủ',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '05/11/2026',
      authorName: 'KTS. Lê Hoàng',
    },
    {
      id: 'vis-4',
      title: 'Không gian Bếp đảo & Tủ bếp Acrylic',
      roomZone: 'Bếp & Đảo bếp',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc nhìn đảo bếp & tủ bếp kịch trần',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '04/11/2026',
      authorName: 'KTS. Lê Hoàng',
    },
    {
      id: 'vis-5',
      title: 'Phòng làm việc & Hệ tủ sách kính Slim',
      roomZone: 'Phòng làm việc',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=85',
      thumbnailUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80',
      isPrimary: false,
      viewAngleName: 'Góc làm việc & view sân vườn',
      resolution: '4K Ultra-HD',
      fileFormat: 'Corona Render',
      updatedDateFormatted: '04/11/2026',
      authorName: 'KTS. Hoàng Long',
    },
  ],
  technicalDrawings: [
    {
      id: 'dwg-1',
      title: 'Mặt bằng bố trí nội thất tầng 1 & tầng 2',
      drawingCode: 'REV 2 - ARCH-01',
      fileType: 'DWG',
      author: 'KTS. Hoàng Long',
      updatedDateFormatted: '06/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-ARCH-01.dwg',
      fileSize: '14.8 MB',
    },
    {
      id: 'dwg-2',
      title: 'Chi tiết mặt cắt kỹ thuật bổ đồ gỗ nội thất',
      drawingCode: 'REV 2 - DET-02',
      fileType: 'DWG',
      author: 'KTS. Lê Hoàng',
      updatedDateFormatted: '06/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-DET-02.dwg',
      fileSize: '22.4 MB',
    },
    {
      id: 'dwg-3',
      title: 'Sơ đồ định vị ổ cắm, công tắc & chiếu sáng thông minh',
      drawingCode: 'REV 1 - MEP-01',
      fileType: 'PDF',
      author: 'KS. Nguyễn Văn Tuấn',
      updatedDateFormatted: '04/11/2026',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fileUrl: '/drawings/INT-2024-001-MEP-01.pdf',
      fileSize: '8.2 MB',
    },
  ],
  relatedDocuments: [
    {
      id: 'doc-1',
      title: 'Hồ sơ chỉ dẫn kỹ thuật & tiêu chuẩn thi công gỗ óc chó',
      documentCategory: 'Chỉ dẫn kỹ thuật',
      fileType: 'PDF',
      author: 'Phòng Kỹ Thuật Bella',
      updatedDateFormatted: '06/11/2026',
      fileSize: '4.5 MB',
      fileUrl: '/docs/spec-walnut-wood.pdf',
    },
    {
      id: 'doc-2',
      title: 'Biên bản nghiệm thu hồ sơ thiết kế ý tưởng (Concept Sign-off)',
      documentCategory: 'Biên bản phê duyệt',
      fileType: 'PDF',
      author: 'Trần Thị Mai',
      updatedDateFormatted: '06/11/2026',
      fileSize: '1.2 MB',
      fileUrl: '/docs/concept-signoff.pdf',
    },
  ],
  materials: [
    {
      id: 'mat-1',
      name: 'Veneer Óc Chó Bắc Mỹ',
      code: 'Code: MS-440 EV',
      brand: 'An Cường',
      specification: 'Hoàn thiện sơn bóng mờ 50% PU cao cấp',
      usageArea: 'Vách ốp phòng khách, kệ tivi, bàn trà',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-2',
      name: 'Đá Thạch Anh Nhân Tạo',
      code: 'Code: BQ8628 Nero Marquina',
      brand: 'Vicostone',
      specification: 'Dày 20mm, bo mài 45 độ',
      usageArea: 'Mặt bàn trà, mặt đảo bếp, lavabo',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-3',
      name: 'Bản Lề Giảm Chấn Thép',
      code: 'Code: Clip Top BLUMOTION 110',
      brand: 'Blum (Áo)',
      specification: 'Bảo hành 5 năm',
      usageArea: 'Hệ cánh tủ áo, tủ bếp, tủ giày',
      status: 'approved',
      statusLabel: 'Đã duyệt',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'mat-4',
      name: 'Khung Cánh Kính Slim',
      code: 'Code: SLIM-CHAMPAGNE-05',
      brand: 'Bella Slim Aluminium',
      specification: 'Kính xám khói cường lực 5mm',
      usageArea: 'Tủ rượu trang trí, tủ áo walk-in closet',
      status: 'reference',
      statusLabel: 'Tham khảo',
      statusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      thumbnailImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=200&q=80',
    },
  ],
  materialAudit: {
    allCompliant: true,
    auditTitle: 'Tất cả vật liệu đều đạt tiêu chuẩn',
    auditSubtitle: 'Theo danh mục được phê duyệt',
    approvedCount: 3,
    referenceCount: 1,
    totalCount: 4,
  },
  availableVersions: [
    { versionNumber: 'R1.0', status: 'Approved – Locked', isCurrent: true },
    { versionNumber: 'R1.1', status: 'Draft – Editing', isCurrent: false },
    { versionNumber: 'R0.9', status: 'Concept Review', isCurrent: false },
  ],
};

export default function InteriorDesignStudioPage() {
  const [data, setData] = useState<DesignStudioOverviewResponse>(INITIAL_DESIGN_OVERVIEW);
  const [selectedVisualId, setSelectedVisualId] = useState<string>('vis-1');
  const [activeViewerTab, setActiveViewerTab] = useState<'3d' | 'technical' | 'documents'>('3d');

  // Modals & Drawers state
  const [showFullscreenModal, setShowFullscreenModal] = useState<boolean>(false);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showBoqModal, setShowBoqModal] = useState<boolean>(false);
  const [showAllMaterialsModal, setShowAllMaterialsModal] = useState<boolean>(false);

  // Lock toggling state
  const [isTogglingLock, setIsTogglingLock] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchDesignData() {
      try {
        const res = await fetch('/api/interior/design');
        if (res.ok) {
          const json: DesignStudioOverviewResponse = await res.json();
          if (isMounted) {
            setData(json);
            if (json.visuals && json.visuals.length > 0) {
              const primary = json.visuals.find((v) => v.isPrimary) || json.visuals[0];
              setSelectedVisualId(primary.id);
            }
          }
        }
      } catch {
        // Retain initial state
      }
    }

    fetchDesignData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Active Visual item selected
  const activeVisual: DesignVisualItem =
    data.visuals.find((v) => v.id === selectedVisualId) || data.visuals[0];

  // Handle Toggle Lock
  const handleToggleLock = async () => {
    try {
      setIsTogglingLock(true);
      const res = await fetch('/api/interior/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: data.versionLock.versionId,
          targetState: !data.versionLock.isLocked,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData((prev) => ({
            ...prev,
            versionLock: json.data,
          }));
          const msg = json.data.isLocked
            ? 'Đã kích hoạt Approved Design Lock! Bản thiết kế đã được bảo vệ khóa sản xuất.'
            : 'Đã mở khóa thiết kế! Cho phép kiến trúc sư cập nhật thông số và tài liệu.';
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }
      }
    } catch {
      setToastMessage('Lỗi khi thao tác khóa thiết kế. Vui lòng thử lại.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsTogglingLock(false);
    }
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
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces"
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

      {/* ─── Project Title & Action Buttons Row ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Status Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.project.name}
          </h1>
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${data.project.statusBadgeClass} transition-colors`}
          >
            <span>{data.project.statusLabel}</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* So sánh phiên bản */}
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>So sánh phiên bản</span>
          </button>

          {/* Lịch sử */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Lịch sử</span>
          </button>

          {/* Lập BOQ / Dự toán */}
          <button
            type="button"
            onClick={() => setShowBoqModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Lập BOQ / Dự toán</span>
            <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-80" />
          </button>
        </div>
      </div>

      {/* ─── Lifecycle Sub-navigation Tabs ─── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-6 overflow-x-auto text-xs font-semibold">
        {data.subTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
              tab.isActive
                ? 'border-[#0f4c3a] text-[#0f4c3a] dark:border-emerald-400 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ─── Approved Design Lock & Version Info Strip ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Card: Version Information */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-400">
                Phiên bản thiết kế
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {data.versionLock.versionNumber}
                </span>
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {data.versionLock.statusLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                  <Lock className="w-2.5 h-2.5" />
                  {data.versionLock.lockLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-10 w-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Ngày duyệt */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Ngày duyệt</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data.versionLock.approvalDateFormatted}
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-10 w-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Người duyệt */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Người duyệt</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data.versionLock.approvedBy}
              </div>
            </div>
          </div>

          <div className="hidden md:block h-10 w-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Mô tả */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400">Mô tả</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {data.versionLock.description}
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Approved Design Lock Status & Unlock Action */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {data.versionLock.lockBannerTitle}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {data.versionLock.lockBannerSubtitle}
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={isTogglingLock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shrink-0 shadow-2xs"
          >
            {data.versionLock.isLocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
                <span>Mở khóa</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Khóa lại</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Main Content Grid: Left 3D Showcase & Right Materials ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 3D Perspective Viewer & Blueprint Canvas (Col 8/9) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between space-y-4">
          {/* Viewer Tabs Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            {/* View Switchers */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveViewerTab('3d')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeViewerTab === '3d'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Phối cảnh 3D</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewerTab('technical')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeViewerTab === 'technical'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Bản vẽ kỹ thuật</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewerTab('documents')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeViewerTab === 'documents'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Tài liệu liên quan</span>
              </button>
            </div>

            {/* Maximize / Fullscreen action */}
            <button
              type="button"
              onClick={() => setShowFullscreenModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xem toàn màn hình</span>
            </button>
          </div>

          {/* Active Canvas Body */}
          {activeViewerTab === '3d' && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              {/* Main Large Visualizer */}
              <div
                className="relative w-full aspect-16/10 rounded-2xl overflow-hidden bg-slate-900 shadow-inner group cursor-pointer"
                onClick={() => setShowFullscreenModal(true)}
              >
                <img
                  src={activeVisual.imageUrl}
                  alt={activeVisual.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />

                {/* Subtle gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span className="font-bold drop-shadow">{activeVisual.title}</span>
                    <span className="text-[11px] text-slate-200 opacity-90 drop-shadow">
                      ({activeVisual.roomZone})
                    </span>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-slate-300">
                    {activeVisual.resolution}
                  </span>
                </div>
              </div>

              {/* Gallery Thumbnails Carousel Strip */}
              <div className="grid grid-cols-5 gap-3 pt-1">
                {data.visuals.slice(0, 4).map((visual) => (
                  <button
                    key={visual.id}
                    type="button"
                    onClick={() => setSelectedVisualId(visual.id)}
                    className={`relative aspect-16/10 rounded-xl overflow-hidden transition-all duration-200 ${
                      selectedVisualId === visual.id
                        ? 'ring-2 ring-[#0f4c3a] ring-offset-2 dark:ring-offset-slate-900 scale-[1.02] shadow-sm'
                        : 'opacity-75 hover:opacity-100 hover:scale-[1.01]'
                    }`}
                  >
                    <img
                      src={visual.thumbnailUrl}
                      alt={visual.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}

                {/* 5th Thumbnail with +3 Overlay */}
                <button
                  type="button"
                  onClick={() => setShowFullscreenModal(true)}
                  className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-700 hover:bg-slate-600 transition-all duration-200 flex items-center justify-center text-white"
                >
                  <img
                    src={data.visuals[4]?.thumbnailUrl || data.visuals[0].thumbnailUrl}
                    alt="Xem thêm góc nhìn"
                    className="w-full h-full object-cover opacity-40"
                  />
                  <div className="absolute inset-0 flex items-center justify-center font-extrabold text-base sm:text-lg">
                    +3
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Technical Drawings Tab View */}
          {activeViewerTab === 'technical' && (
            <div className="space-y-3 flex-1">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Hồ sơ bản vẽ kỹ thuật kiến trúc, bổ đồ gỗ & MEP đã duyệt:
              </div>
              {data.technicalDrawings.map((dwg) => (
                <div
                  key={dwg.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                      {dwg.fileType}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {dwg.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {dwg.drawingCode} · {dwg.author} · {dwg.fileSize}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${dwg.statusBadgeClass}`}>
                      {dwg.statusLabel}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Related Documents Tab View */}
          {activeViewerTab === 'documents' && (
            <div className="space-y-3 flex-1">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Hồ sơ chỉ dẫn thi công, biên bản nghiệm thu & moodboard:
              </div>
              {data.relatedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs shrink-0">
                      PDF
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {doc.documentCategory} · {doc.author} · {doc.fileSize}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Materials & Specifications (Col 4/3) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Danh sách vật liệu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAllMaterialsModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 transition-colors"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Materials List */}
            <div className="mt-3.5 space-y-3">
              {data.materials.map((mat) => (
                <div
                  key={mat.id}
                  className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Material Texture Thumbnail */}
                    <img
                      src={mat.thumbnailImage}
                      alt={mat.name}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {mat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {mat.code}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {mat.specification}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${mat.statusBadgeClass}`}
                  >
                    {mat.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Compliance Audit Banner */}
          <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                {data.materialAudit.auditTitle}
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                {data.materialAudit.auditSubtitle}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal 1: Fullscreen 3D Perspectives Lightbox ─── */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm sm:text-base font-bold">{activeVisual.title}</h3>
              <p className="text-xs text-slate-400">{activeVisual.roomZone} · {activeVisual.resolution}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFullscreenModal(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Large View */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <img
              src={activeVisual.imageUrl}
              alt={activeVisual.title}
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>

          {/* Thumbnail Picker in Fullscreen */}
          <div className="flex items-center justify-center gap-3 overflow-x-auto py-2">
            {data.visuals.map((visual) => (
              <button
                key={visual.id}
                type="button"
                onClick={() => setSelectedVisualId(visual.id)}
                className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 transition-all ${
                  selectedVisualId === visual.id
                    ? 'ring-2 ring-emerald-400 scale-105'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                <img
                  src={visual.thumbnailUrl}
                  alt={visual.title}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal 2: So sánh phiên bản thiết kế ─── */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  So sánh phiên bản thiết kế (Design Revisions)
                </h3>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">R1.0 (Hiện tại)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Approved – Locked
                  </span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                  <li>• Người duyệt: Trần Thị Mai</li>
                  <li>• Ngày duyệt: 06/11/2026</li>
                  <li>• Trạng thái BOQ: Đủ điều kiện sản xuất</li>
                  <li>• Vật liệu: 4 hạng mục chính</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">R1.1 (Dự thảo)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    Draft – Editing
                  </span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                  <li>• Kiến trúc sư: KTS. Hoàng Long</li>
                  <li>• Cập nhật: Thay đổi chất liệu đá lavabo</li>
                  <li>• Trạng thái: Đang chỉnh sửa, chưa khóa</li>
                  <li>• Tác động BOQ: Ước tính +15 triệu</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Lập BOQ / Dự toán ─── */}
      {showBoqModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lập BOQ / Dự toán từ thiết kế R1.0
                </h3>
              </div>
              <button onClick={() => setShowBoqModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Bản vẽ R1.0 đã đủ điều kiện khóa sản xuất!
              </div>
              <div>
                Hệ thống sẽ tự động bóc tách vật liệu (gỗ óc chó, đá thạch anh Vicostone, phụ kiện Blum) và đồng bộ sang phân hệ BOQ &amp; Dự toán.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBoqModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <Link
                href="/dashboard/interior/boq"
                className="px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold"
              >
                Chuyển sang phân hệ BOQ →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 4: Lịch sử phê duyệt ─── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lịch sử phê duyệt thiết kế
                </h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>06/11/2026 14:30</span>
                  <span className="text-emerald-600">Approved Design Lock</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  Chủ đầu tư Trần Thị Mai ký duyệt phiên bản R1.0 và kích hoạt khóa sản xuất.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>04/11/2026 09:15</span>
                  <span className="text-blue-600">Client Review</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  KTS. Hoàng Long trình duyệt 4K render phòng khách và danh mục vật liệu An Cường.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 5: Xem tất cả vật liệu ─── */}
      {showAllMaterialsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Toàn bộ danh mục vật liệu &amp; phụ kiện (R1.0)
                </h3>
              </div>
              <button onClick={() => setShowAllMaterialsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {data.materials.map((mat) => (
                <div
                  key={mat.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={mat.thumbnailImage}
                      alt={mat.name}
                      className="w-12 h-12 rounded-lg object-cover border"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{mat.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{mat.code} · Thương hiệu: {mat.brand}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{mat.specification}</div>
                      <div className="text-[10px] text-slate-400 italic mt-0.5">Vị trí: {mat.usageArea}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${mat.statusBadgeClass}`}>
                    {mat.statusLabel}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAllMaterialsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
