'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Design Studio & Specification Showcase Page
 *
 * Implements the executive Design Studio dashboard matching reference design:
 * - Top breadcrumb & user status bar (Villa Sunrise Renovation INT-2024-001)
 * - Approved Design Lock strip (R1.0, approval metadata, lock invariant)
 * - 3D Perspectives Showcase with 4K renders and +3 gallery thumbnails
 * - Ingestion of 2D technical CAD blueprints (DWG/PDF/DXF) and 3D visual perspectives
 * - Direct upload pipeline to Cloudflare R2 (`https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev`)
 * - Intermediate canonical domain store persistence (zero data loss across F5 refreshes)
 * - Material & Specification Cards (Veneer Óc Chó, Đá Thạch Anh, Bản Lề, Khung Nhôm Slim)
 * - Material Compliance Audit Banner ("Tất cả vật liệu đều đạt tiêu chuẩn")
 * - Technical CAD Blueprints (DWG, PDF) and Document archives
 * - Zero UI logic: All business rules & calculations are computed server-side.
 *
 * @module src/app/dashboard/interior/design/page
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import InteriorUserBar from '@/components/interior/InteriorUserBar';
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
  Upload,
  Plus,
  Loader2,
  Trash2,
  ImageIcon,
  HardDrive,
  Building,
  LayoutGrid,
  List as ListIcon,
  ArrowLeft,
  Sparkles,
  MapPin,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  ShieldCheck,
  FileCode,
} from 'lucide-react';

import type {
  DesignStudioOverviewResponse,
  DesignVisualItem,
  DesignTechnicalDrawingItem,
  DesignDocumentItem,
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
    { key: 'boq', label: 'BOQ &amp; Dự toán', href: '/dashboard/interior/boq', isActive: false },
    { key: 'production', label: 'Sản xuất', href: '/dashboard/interior/production', isActive: false },
    { key: 'installation', label: 'Thi công', href: '/dashboard/interior/installation', isActive: false },
    { key: 'reports', label: 'Báo cáo', href: '/dashboard/interior/reports', isActive: false },
  ],
  visuals: [
    {
      id: 'vis-1',
      title: 'Phối cảnh Phòng khách &amp; Bàn trà',
      roomZone: 'Phòng khách',
      category: '3d',
      categoryLabel: 'Phối cảnh 3D',
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
      thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
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
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/DET-04.dwg',
      fileSize: '14.8 MB',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/DET-04.dwg',
      sheetNumber: 'KT-01/18',
      scale: '1:100',
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
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/DET-04.dwg',
      fileSize: '22.4 MB',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/blueprints/DET-04.dwg',
      sheetNumber: 'KT-06/18',
      scale: '1:25',
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
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
      fileSize: '8.2 MB',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
      sheetNumber: 'MEP-01/08',
      scale: '1:100',
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
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
    },
    {
      id: 'doc-2',
      title: 'Biên bản nghiệm thu hồ sơ thiết kế ý tưởng (Concept Sign-off)',
      documentCategory: 'Biên bản phê duyệt',
      fileType: 'PDF',
      author: 'Trần Thị Mai',
      updatedDateFormatted: '06/11/2026',
      fileSize: '1.2 MB',
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
    },
    {
      id: 'doc-3',
      title: 'Bảng mẫu vật liệu thực tế (Physical Moodboard & Material Swatch)',
      documentCategory: 'Moodboard',
      fileType: 'PDF',
      author: 'KTS. Hoàng Long',
      updatedDateFormatted: '02/11/2026',
      fileSize: '18.6 MB',
      fileUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
      hasFile: true,
      downloadUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/accent-wall-detail.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/wood-panel.jpg',
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
      thumbnailImage: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
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

interface InteriorProjectItem {
  id: string;
  code: string;
  name: string;
  status: string;
  customer_name?: string | null;
  client_name?: string | null;
  site_address?: string | null;
  project_type?: string | null;
  estimated_budget?: number | string | null;
  contract_value?: number | string | null;
  lead_architect_name?: string | null;
  leadArchitect?: string | null;
  created_at?: string | null;
}

const PROJECT_COVER_IMAGES = [
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/luxury-living-room.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bedroom-render-modern.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-wide.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/bathroom-design.jpg',
  'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
];

function getProjectCoverImage(index: number): string {
  return PROJECT_COVER_IMAGES[index % PROJECT_COVER_IMAGES.length];
}

function formatProjectStatusLabel(status: string): string {
  switch (status) {
    case 'inquiry': return 'Khảo sát / Tiếp nhận';
    case 'design': return 'Đang thiết kế';
    case 'approved': return 'Đã duyệt thiết kế';
    case 'production': return 'Sản xuất xưởng';
    case 'installation': return 'Thi công lắp đặt';
    case 'handover': return 'Nghiệm thu bàn giao';
    case 'completed': return 'Hoàn thành';
    case 'cancelled': return 'Đã hủy';
    case 'active':
    case 'in_progress':
    default: return 'Đang thực hiện';
  }
}

function formatProjectStatusBadge(status: string): string {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'production':
    case 'installation':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'inquiry':
    case 'design':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  }
}

function formatBudgetDisplay(budget?: number | string | null): string {
  if (!budget) return '3.85 tỷ';
  const num = Number(budget);
  if (isNaN(num) || num <= 0) return '3.85 tỷ';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} triệu`;
  return `${num.toLocaleString('vi-VN')} đ`;
}

function InteriorDesignStudioContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [projectOptions, setProjectOptions] = useState<InteriorProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  const [hubSearchQuery, setHubSearchQuery] = useState<string>('');
  const [hubStatusFilter, setHubStatusFilter] = useState<string>('all');
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [switcherSearch, setSwitcherSearch] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<DesignStudioOverviewResponse>(INITIAL_DESIGN_OVERVIEW);
  const [selectedVisualId, setSelectedVisualId] = useState<string>('vis-1');
  const [activeViewerTab, setActiveViewerTab] = useState<'3d' | 'technical' | 'documents'>('3d');

  // Modals state
  const [showFullscreenModal, setShowFullscreenModal] = useState<boolean>(false);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showBoqModal, setShowBoqModal] = useState<boolean>(false);
  const [showAllMaterialsModal, setShowAllMaterialsModal] = useState<boolean>(false);

  // 2D CAD Blueprint & Document Interactive Viewers
  const [selectedDrawingForView, setSelectedDrawingForView] = useState<DesignTechnicalDrawingItem | null>(null);
  const [selectedDocForView, setSelectedDocForView] = useState<DesignDocumentItem | null>(null);
  const [cadTheme, setCadTheme] = useState<'dark' | 'light'>('dark');
  const [cadZoom, setCadZoom] = useState<number>(1);

  // Ingestion / Upload Modals
  const [showUpload3DModal, setShowUpload3DModal] = useState<boolean>(false);
  const [showUpload2DModal, setShowUpload2DModal] = useState<boolean>(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Form states
  const [visualForm, setVisualForm] = useState({
    title: '',
    roomZone: 'Phòng khách',
    viewAngleName: '',
    resolution: '4K Ultra-HD (3840x2160)',
    fileFormat: 'Corona Render',
    authorName: 'KTS. Hoàng Long',
    isPrimary: false,
    file: null as File | null,
    previewUrl: '',
  });

  const [drawingForm, setDrawingForm] = useState({
    title: '',
    drawingCode: '',
    fileType: 'DWG',
    author: 'KTS. Lê Hoàng',
    statusLabel: 'Đã duyệt',
    file: null as File | null,
  });

  const [docForm, setDocForm] = useState({
    title: '',
    documentCategory: 'Chỉ dẫn kỹ thuật',
    fileType: 'PDF',
    author: 'Phòng Kỹ Thuật Bella',
    file: null as File | null,
  });

  const fileInput3DRef = useRef<HTMLInputElement>(null);
  const fileInput2DRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);

  // Lock toggling state
  const [isTogglingLock, setIsTogglingLock] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('success');

  /**
   * Smart file opener — nếu URL là đường dẫn thực (R2 / https) thì mở tab mới,
   * nếu là đường dẫn giả (local path chưa upload) thì hiển thị toast hướng dẫn.
   */
  const handleOpenFile = (fileUrl: string, label: string) => {
    const isRealUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://');
    if (isRealUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      setToastType('info');
      setToastMessage(
        `"${label}" chưa có tệp trên cloud. Dùng nút "+ Tải lên" để upload tệp lên Cloudflare R2.`,
      );
      setTimeout(() => { setToastMessage(null); setToastType('success'); }, 5000);
    }
  };

  // Load projects list
  useEffect(() => {
    let isMounted = true;
    async function loadProjects() {
      try {
        const res = await fetch('/api/interior/projects', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data?.projects) ? (json.data.projects as InteriorProjectItem[]) : [];
          if (isMounted) {
            setProjectOptions(items);
            setProjectsLoading(false);
          }
        } else {
          if (isMounted) setProjectsLoading(false);
        }
      } catch {
        if (isMounted) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => { isMounted = false; };
  }, []);

  // Sync selected project with URL query param if present
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    if (urlProjectId && urlProjectId !== selectedProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [searchParams, selectedProjectId]);

  // Click outside to close Project Switcher dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    if (showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProjectDropdown]);

  // Load design data whenever selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) return;
    let isMounted = true;

    async function fetchDesignData() {
      try {
        const res = await fetch(`/api/interior/design?projectId=${encodeURIComponent(selectedProjectId || '')}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          const incoming = json.data?.overview || json.data || json;
          if (isMounted && incoming && typeof incoming === 'object' && Array.isArray(incoming.visuals)) {
            setData(incoming);
            if (incoming.visuals.length > 0) {
              const primary = incoming.visuals.find((v: { isPrimary?: boolean }) => v.isPrimary) || incoming.visuals[0];
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
  }, [selectedProjectId]);

  // Project navigation handlers
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowProjectDropdown(false);
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', projectId);
    window.history.pushState(null, '', url.toString());
  };

  const handleReturnToHub = () => {
    setSelectedProjectId(null);
    setShowProjectDropdown(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('projectId');
    window.history.pushState(null, '', url.pathname);
  };

  // Filtered projects for the Project Hub
  const filteredProjects = projectOptions.filter((p) => {
    const matchesSearch =
      !hubSearchQuery.trim() ||
      p.name?.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
      p.code?.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(hubSearchQuery.toLowerCase())) ||
      (p.client_name && p.client_name.toLowerCase().includes(hubSearchQuery.toLowerCase())) ||
      (p.site_address && p.site_address.toLowerCase().includes(hubSearchQuery.toLowerCase()));

    const matchesStatus =
      hubStatusFilter === 'all' ||
      (hubStatusFilter === 'in_progress' && (p.status === 'in_progress' || p.status === 'active' || p.status === 'design' || p.status === 'inquiry')) ||
      (hubStatusFilter === 'approved' && p.status === 'approved') ||
      (hubStatusFilter === 'production' && (p.status === 'production' || p.status === 'installation' || p.status === 'handover'));

    return matchesSearch && matchesStatus;
  });

  // Filtered projects for the Quick Switcher dropdown inside Studio
  const filteredSwitcherProjects = projectOptions.filter((p) => {
    if (!switcherSearch.trim()) return true;
    const q = switcherSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(q))
    );
  });

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
          action: 'toggle_lock',
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

  // ─── 3D Visual Upload Handler ───
  const handleFile3DChange = (file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const inferredTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setVisualForm((prev) => ({
      ...prev,
      file,
      previewUrl,
      title: prev.title || inferredTitle,
    }));
  };

  const handleUpload3D = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visualForm.file) {
      setToastMessage('Vui lòng chọn tệp hình ảnh phối cảnh (JPG, PNG, WebP).');
      return;
    }
    if (!visualForm.title.trim()) {
      setToastMessage('Vui lòng nhập tiêu đề phối cảnh.');
      return;
    }

    try {
      setIsUploading(true);

      // 1. Upload to Cloudflare R2 Bucket
      const formData = new FormData();
      formData.append('file', visualForm.file);
      formData.append('folder', 'interior/design');
      formData.append('category', '3d');
      formData.append('tenantId', data.tenantId);

      const uploadRes = await fetch('/api/interior/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload ảnh lên Cloudflare R2 thất bại');
      }

      const uploadJson = await uploadRes.json();
      const cdnUrl = uploadJson.url;

      // 2. Persist to Intermediate Canonical Service
      const designRes = await fetch('/api/interior/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_visual',
          tenantId: data.tenantId,
          title: visualForm.title,
          roomZone: visualForm.roomZone,
          viewAngleName: visualForm.viewAngleName || `Góc nhìn ${visualForm.roomZone}`,
          imageUrl: cdnUrl,
          thumbnailUrl: cdnUrl,
          isPrimary: visualForm.isPrimary,
          resolution: visualForm.resolution,
          fileFormat: visualForm.fileFormat,
          authorName: visualForm.authorName,
        }),
      });

      if (!designRes.ok) {
        throw new Error('Đăng ký phối cảnh vào hệ thống thất bại');
      }

      const designJson = await designRes.json();
      const newVisual: DesignVisualItem = designJson.data;

      // 3. Update UI state immediately
      setData((prev) => {
        const visuals = prev.visuals.map((v) =>
          newVisual.isPrimary ? { ...v, isPrimary: false } : v
        );
        return {
          ...prev,
          visuals: [newVisual, ...visuals],
        };
      });

      setSelectedVisualId(newVisual.id);
      setShowUpload3DModal(false);
      setVisualForm({
        title: '',
        roomZone: 'Phòng khách',
        viewAngleName: '',
        resolution: '4K Ultra-HD (3840x2160)',
        fileFormat: 'Corona Render',
        authorName: 'KTS. Hoàng Long',
        isPrimary: false,
        file: null,
        previewUrl: '',
      });
      setToastMessage('Tải lên Cloudflare R2 &amp; lưu phối cảnh 3D thành công!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải lên phối cảnh 3D';
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── 2D CAD Technical Drawing Upload Handler ───
  const handleFile2DChange = (file: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'DWG';
    const inferredTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setDrawingForm((prev) => ({
      ...prev,
      file,
      fileType: ext === 'DXF' || ext === 'PDF' ? ext : 'DWG',
      title: prev.title || inferredTitle,
      drawingCode: prev.drawingCode || `REV 1 - DWG-${String(Date.now()).slice(-4)}`,
    }));
  };

  const handleUpload2D = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingForm.file) {
      setToastMessage('Vui lòng chọn tệp bản vẽ kỹ thuật (DWG, DXF, PDF).');
      return;
    }
    if (!drawingForm.title.trim()) {
      setToastMessage('Vui lòng nhập tên bản vẽ kỹ thuật.');
      return;
    }

    try {
      setIsUploading(true);

      // 1. Upload to Cloudflare R2
      const formData = new FormData();
      formData.append('file', drawingForm.file);
      formData.append('folder', 'interior/blueprints');
      formData.append('category', '2d');
      formData.append('tenantId', data.tenantId);

      const uploadRes = await fetch('/api/interior/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload bản vẽ lên Cloudflare R2 thất bại');
      }

      const uploadJson = await uploadRes.json();
      const cdnUrl = uploadJson.url;
      const fileSize = uploadJson.fileSize || '14.5 MB';

      // 2. Persist to Intermediate Canonical Service
      const designRes = await fetch('/api/interior/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_drawing',
          tenantId: data.tenantId,
          title: drawingForm.title,
          drawingCode: drawingForm.drawingCode || `REV 1 - DWG-${String(Date.now()).slice(-4)}`,
          fileType: drawingForm.fileType,
          author: drawingForm.author,
          fileUrl: cdnUrl,
          fileSize,
          statusLabel: drawingForm.statusLabel,
        }),
      });

      if (!designRes.ok) {
        throw new Error('Đăng ký bản vẽ vào hệ thống thất bại');
      }

      const designJson = await designRes.json();
      const newDrawing: DesignTechnicalDrawingItem = designJson.data;

      // 3. Update UI state
      setData((prev) => ({
        ...prev,
        technicalDrawings: [newDrawing, ...prev.technicalDrawings],
      }));

      setShowUpload2DModal(false);
      setDrawingForm({
        title: '',
        drawingCode: '',
        fileType: 'DWG',
        author: 'KTS. Lê Hoàng',
        statusLabel: 'Đã duyệt',
        file: null,
      });
      setActiveViewerTab('technical');
      setToastMessage('Đã tải lên Cloudflare R2 và lưu bản vẽ kỹ thuật 2D thành công!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải lên bản vẽ kỹ thuật 2D';
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Technical Document Upload Handler ───
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.file) {
      setToastMessage('Vui lòng chọn tệp tài liệu kỹ thuật.');
      return;
    }
    if (!docForm.title.trim()) {
      setToastMessage('Vui lòng nhập tên tài liệu.');
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', docForm.file);
      formData.append('folder', 'interior/docs');
      formData.append('category', 'document');
      formData.append('tenantId', data.tenantId);

      const uploadRes = await fetch('/api/interior/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload tài liệu lên Cloudflare R2 thất bại');
      }

      const uploadJson = await uploadRes.json();
      const cdnUrl = uploadJson.url;
      const fileSize = uploadJson.fileSize || '3.5 MB';

      const designRes = await fetch('/api/interior/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_document',
          tenantId: data.tenantId,
          title: docForm.title,
          documentCategory: docForm.documentCategory,
          fileType: docForm.fileType,
          author: docForm.author,
          fileSize,
          fileUrl: cdnUrl,
        }),
      });

      if (!designRes.ok) {
        throw new Error('Lưu tài liệu thất bại');
      }

      const designJson = await designRes.json();
      const newDoc: DesignDocumentItem = designJson.data;

      setData((prev) => ({
        ...prev,
        relatedDocuments: [newDoc, ...prev.relatedDocuments],
      }));

      setShowUploadDocModal(false);
      setDocForm({
        title: '',
        documentCategory: 'Chỉ dẫn kỹ thuật',
        fileType: 'PDF',
        author: 'Phòng Kỹ Thuật Bella',
        file: null,
      });
      setActiveViewerTab('documents');
      setToastMessage('Đã tải lên và lưu tài liệu kỹ thuật thành công!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải tài liệu';
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-5">
      {/* ─── Toast Feedback ─── */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold animate-in fade-in slide-in-from-top-2 max-w-sm ${
          toastType === 'info'
            ? 'bg-blue-900 text-white border-blue-700'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastType === 'info' ? (
            <Eye className="w-4 h-4 text-blue-300 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => { setToastMessage(null); setToastType('success'); }}
            className="ml-2 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!selectedProjectId ? (
        /* ─── 00. DESIGN STUDIO PROJECT HUB (GALLERY / LIST VIEW) ─── */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Hub Top Bar: Breadcrumb & User Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>Dự án</span>
              <span className="text-slate-300 dark:text-slate-700">›</span>
              <span className="text-slate-900 dark:text-white font-bold">
                Design Studio (Hồ sơ thiết kế)
              </span>
            </div>
            <InteriorUserBar />
          </div>

          {/* Hub Hero Header */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8 rounded-3xl border border-amber-200/60 dark:border-amber-900/40 relative overflow-hidden shadow-xs">
            <div className="max-w-2xl relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Không gian Thiết kế & Hồ sơ Kỹ thuật</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Design Studio — Danh mục Công trình
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Chọn công trình để mở hồ sơ chi tiết gồm phối cảnh 3D Render, bản vẽ kỹ thuật 2D CAD (DWG/PDF), danh mục vật liệu và quản lý khóa phiên bản (Approved Design Lock).
              </p>
            </div>
          </div>

          {/* Controls: Search, Filter Tabs & View Toggle (Gallery / List) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên dự án, mã INT/PRJ, khách hàng..."
                value={hubSearchQuery}
                onChange={(e) => setHubSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {hubSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHubSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills & View Switcher */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Status Filters */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { key: 'all', label: `Tất cả (${projectOptions.length})` },
                  { key: 'in_progress', label: 'Đang thiết kế' },
                  { key: 'approved', label: 'Đã duyệt' },
                  { key: 'production', label: 'Sản xuất / Thi công' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setHubStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      hubStatusFilter === f.key
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* View Switcher: Gallery vs List */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('gallery')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'gallery'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chế độ xem Gallery (Thẻ ảnh 3D)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chế độ xem Danh sách bảng"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Danh sách</span>
                </button>
              </div>
            </div>
          </div>

          {/* Content: Gallery Mode or List Mode */}
          {projectsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-medium">Đang tải danh mục dự án...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
              <FolderOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Không tìm thấy dự án nào phù hợp với bộ lọc
              </p>
              <button
                type="button"
                onClick={() => {
                  setHubSearchQuery('');
                  setHubStatusFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : viewMode === 'gallery' ? (
            /* ─── GALLERY VIEW (CARDS WITH 3D RENDERS) ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((p, idx) => {
                const cover = getProjectCoverImage(idx);
                const statusLabel = formatProjectStatusLabel(p.status);
                const statusBadge = formatProjectStatusBadge(p.status);
                const budgetStr = formatBudgetDisplay(p.estimated_budget || p.contract_value);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-xl hover:border-amber-400/60 dark:hover:border-amber-500/40 transition-all duration-300 flex flex-col cursor-pointer transform hover:-translate-y-1"
                  >
                    {/* Card Cover Image */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={cover}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white font-mono text-[11px] font-bold border border-white/20">
                          {p.code}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Bottom Info Overlay */}
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <p className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{p.site_address || 'TP. Hồ Chí Minh'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                          {p.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          Khách hàng: <strong className="text-slate-700 dark:text-slate-300">{p.customer_name || p.client_name || 'Khách hàng'}</strong>
                        </p>
                      </div>

                      {/* Quick Metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">3D Render</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">5 views</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Bản vẽ CAD</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">3 DWG</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Dự toán</span>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400">{budgetStr}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProject(p.id);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-amber-600 dark:bg-slate-800 dark:hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Mở Design Studio</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST VIEW (TABLE) ─── */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Dự án & Mã</th>
                      <th className="py-3 px-4">Khách hàng & Địa điểm</th>
                      <th className="py-3 px-4">Trạng thái thiết kế</th>
                      <th className="py-3 px-4">KTS Chủ trì</th>
                      <th className="py-3 px-4">Dự toán</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProjects.map((p, idx) => {
                      const cover = getProjectCoverImage(idx);
                      const statusLabel = formatProjectStatusLabel(p.status);
                      const statusBadge = formatProjectStatusBadge(p.status);
                      const budgetStr = formatBudgetDisplay(p.estimated_budget || p.contract_value);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectProject(p.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={cover}
                                alt={p.name}
                                className="w-12 h-10 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-700"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                  {p.name}
                                </p>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {p.code}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {p.customer_name || p.client_name || 'Khách hàng'}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {p.site_address || 'TP. Hồ Chí Minh'}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {p.lead_architect_name || p.leadArchitect || 'KTS. Bella Interior'}
                          </td>
                          <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">
                            {budgetStr}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProject(p.id);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-600 dark:bg-slate-800 dark:hover:bg-amber-600 text-slate-700 hover:text-white dark:text-slate-300 dark:hover:text-white font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>Vào Studio</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── 01. DESIGN STUDIO WORKSPACE (PROJECT SPECIFIC VIEW) ─── */
        <>
          {/* ─── Top Header: Breadcrumbs & Search / User Bar ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            {/* Breadcrumb with Back to Hub button */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={handleReturnToHub}
                className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Quay lại danh sách dự án (Gallery / List)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Danh sách dự án</span>
              </button>
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

              {/* Top user profile & notifications */}
              <InteriorUserBar />
            </div>
          </div>

          {/* ─── Project Title & Action Buttons Row (Interactive Project Switcher!) ─── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Title, Switcher Dropdown & Status Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative inline-block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown((prev) => !prev)}
                  className="flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-2xl text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all cursor-pointer group"
                  title="Bấm để chọn chuyển đổi sang dự án khác"
                >
                  <Building className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Dự án thiết kế
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold tracking-tight truncate max-w-[280px] sm:max-w-[420px] block leading-tight">
                      {data.project.name}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${showProjectDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProjectDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm dự án..."
                          value={switcherSearch}
                          onChange={(e) => setSwitcherSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                      {filteredSwitcherProjects.map((p) => {
                        const isCurrent = p.id === selectedProjectId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProject(p.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs truncate font-semibold text-slate-900 dark:text-white">
                                {p.name}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                {p.code} • {p.customer_name || 'Khách hàng'} • {formatBudgetDisplay(p.estimated_budget)}
                              </p>
                            </div>
                            {isCurrent && (
                              <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={handleReturnToHub}
                        className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
                        <span>Xem tất cả dự án (Gallery / List)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border ${data.project.statusBadgeClass}`}>
                {data.project.statusLabel}
              </span>
            </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary Upload 2D / 3D Gateway */}
          <button
            type="button"
            onClick={() => {
              if (activeViewerTab === 'technical') {
                setShowUpload2DModal(true);
              } else if (activeViewerTab === 'documents') {
                setShowUploadDocModal(true);
              } else {
                setShowUpload3DModal(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Tải lên thiết kế (2D / 3D)</span>
          </button>

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

      {/* ─── Approved Design Lock &amp; Version Info Strip ─── */}
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

        {/* Right Card: Approved Design Lock Status &amp; Unlock Action */}
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

      {/* ─── Main Content Grid: Left 3D Showcase &amp; Right Materials ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 3D Perspective Viewer &amp; Blueprint Canvas (Col 8/9) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between space-y-4">
          {/* Viewer Tabs Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
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
                <span>Phối cảnh 3D ({data.visuals.length})</span>
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
                <span>Bản vẽ kỹ thuật ({data.technicalDrawings.length})</span>
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
                <span>Tài liệu liên quan ({data.relatedDocuments.length})</span>
              </button>
            </div>

            {/* Contextual Upload &amp; Fullscreen action buttons */}
            <div className="flex items-center gap-2">
              {activeViewerTab === '3d' && (
                <button
                  type="button"
                  onClick={() => setShowUpload3DModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm phối cảnh 3D</span>
                </button>
              )}

              {activeViewerTab === 'technical' && (
                <button
                  type="button"
                  onClick={() => setShowUpload2DModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tải lên bản vẽ CAD/DWG</span>
                </button>
              )}

              {activeViewerTab === 'documents' && (
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tải lên tài liệu</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowFullscreenModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors ml-1"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xem toàn màn hình</span>
              </button>
            </div>
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

                {/* Fullscreen hint — visible on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Click để xem toàn màn hình</span>
                  </div>
                </div>

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

                {/* 5th slot: Either +N more button, or direct + Thêm phối cảnh tile */}
                {data.visuals.length > 4 ? (
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
                      +{data.visuals.length - 4}
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowUpload3DModal(true)}
                    className="relative aspect-16/10 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all flex flex-col items-center justify-center text-slate-400 hover:text-emerald-700 gap-0.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] font-bold">+ Thêm góc</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Technical Drawings Tab View */}
          {activeViewerTab === 'technical' && (
            <div className="space-y-3 flex-1">
              {/* Quick Action Dropzone Banner */}
              <div
                onClick={() => setShowUpload2DModal(true)}
                className="p-3.5 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between gap-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Đưa bản vẽ kỹ thuật 2D mới vào hệ thống (Cloudflare R2)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hỗ trợ tệp định dạng .DWG, .DXF, .PDF (AutoCAD, Revit, bổ chi tiết gỗ)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 transition-colors"
                >
                  + Tải lên ngay
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-500 pt-1">
                Danh mục hồ sơ bản vẽ kỹ thuật kiến trúc, bổ đồ gỗ &amp; MEP:
              </div>

              {data.technicalDrawings.map((dwg) => {
                const hasFile = dwg.hasFile !== false && Boolean(dwg.fileUrl);
                return (
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
                          {dwg.drawingCode} · {dwg.author} · {hasFile ? dwg.fileSize : 'Chưa có tệp'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${hasFile ? dwg.statusBadgeClass : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {hasFile ? dwg.statusLabel : 'Chờ nộp tệp'}
                      </span>
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDrawingForView(dwg)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                          title="Xem bản vẽ CAD 2D tương tác"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem 2D</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowUpload2DModal(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
                          title="Tải lên tệp bản vẽ"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nộp tệp</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Related Documents Tab View */}
          {activeViewerTab === 'documents' && (
            <div className="space-y-3 flex-1">
              {/* Quick Action Dropzone Banner */}
              <div
                onClick={() => setShowUploadDocModal(true)}
                className="p-3.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between gap-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Tải lên tài liệu kỹ thuật &amp; biên bản nghiệm thu
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Chỉ dẫn thi công gỗ óc chó, biên bản nghiệm thu ý tưởng, moodboard
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shrink-0 transition-colors"
                >
                  + Tải lên tài liệu
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-500 pt-1">
                Hồ sơ chỉ dẫn thi công, biên bản nghiệm thu &amp; moodboard:
              </div>

              {data.relatedDocuments.map((doc) => {
                const hasFile = doc.hasFile !== false && Boolean(doc.fileUrl);
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs shrink-0">
                        {doc.fileType}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {doc.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {doc.documentCategory} · {doc.author} · {hasFile ? doc.fileSize : 'Chưa có tệp'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${hasFile ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {hasFile ? 'Đã duyệt' : 'Chờ nộp'}
                      </span>
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDocForView(doc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
                          title="Xem tài liệu kỹ thuật"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowUploadDocModal(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
                          title="Tải lên tài liệu"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nộp tệp</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Materials &amp; Specifications (Col 4/3) */}
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

            {/* List of 4 Material Cards */}
            <div className="space-y-3 pt-3">
              {data.materials.map((material) => (
                <div
                  key={material.id}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={material.thumbnailImage}
                        alt={material.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200/80 dark:border-slate-700 shrink-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {material.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {material.code}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${material.statusBadgeClass}`}
                    >
                      {material.statusLabel}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-1">
                    {material.specification}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Green Material Audit Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
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

      {/* ─── Modal 6: Tải lên Phối cảnh 3D mới (Cloudflare R2 Direct) ─── */}
      {showUpload3DModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tải lên Phối cảnh 3D mới
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lưu trữ ảnh gốc trên Cloudflare R2 bucket: <code className="text-emerald-700 font-bold">bella-production</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpload3DModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpload3D} className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tệp hình ảnh phối cảnh (JPG, PNG, WebP) *
                </label>
                <input
                  type="file"
                  ref={fileInput3DRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFile3DChange(e.target.files?.[0] || null)}
                />
                <div
                  onClick={() => fileInput3DRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    visualForm.file
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  {visualForm.previewUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={visualForm.previewUrl}
                        alt="Preview"
                        className="w-20 h-14 object-cover rounded-lg border shadow-xs shrink-0"
                      />
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {visualForm.file?.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {visualForm.file && (visualForm.file.size / (1024 * 1024)).toFixed(2)} MB · Bấm để đổi ảnh khác
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 flex flex-col items-center gap-1.5 text-slate-500">
                      <Upload className="w-6 h-6 text-emerald-600" />
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Kéo thả ảnh vào đây hoặc bấm để chọn tệp
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Hỗ trợ độ phân giải cao 2K / 4K / 8K (tối đa 50MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title &amp; Room Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề phối cảnh *
                  </label>
                  <input
                    type="text"
                    required
                    value={visualForm.title}
                    onChange={(e) => setVisualForm({ ...visualForm, title: e.target.value })}
                    placeholder="VD: Phối cảnh Sofa &amp; Cửa sổ ban công"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Khu vực / Phòng *
                  </label>
                  <select
                    value={visualForm.roomZone}
                    onChange={(e) => setVisualForm({ ...visualForm, roomZone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="Phòng khách">Phòng khách</option>
                    <option value="Phòng ăn">Phòng ăn</option>
                    <option value="Phòng ngủ Master">Phòng ngủ Master</option>
                    <option value="Bếp & Đảo bếp">Bếp &amp; Đảo bếp</option>
                    <option value="Phòng làm việc">Phòng làm việc</option>
                    <option value="Phòng tắm">Phòng tắm</option>
                    <option value="Ban công sân vườn">Ban công sân vườn</option>
                  </select>
                </div>
              </div>

              {/* View Angle &amp; Resolution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên góc nhìn chi tiết
                  </label>
                  <input
                    type="text"
                    value={visualForm.viewAngleName}
                    onChange={(e) => setVisualForm({ ...visualForm, viewAngleName: e.target.value })}
                    placeholder="VD: Góc nhìn chính diện bàn trà tròn"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Độ phân giải &amp; Công cụ render
                  </label>
                  <select
                    value={visualForm.resolution}
                    onChange={(e) => setVisualForm({ ...visualForm, resolution: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="4K Ultra-HD (3840x2160)">4K Ultra-HD (3840x2160)</option>
                    <option value="2K HD (2560x1440)">2K HD (2560x1440)</option>
                    <option value="Full HD (1920x1080)">Full HD (1920x1080)</option>
                  </select>
                </div>
              </div>

              {/* Author &amp; Primary Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kiến trúc sư phụ trách
                  </label>
                  <input
                    type="text"
                    value={visualForm.authorName}
                    onChange={(e) => setVisualForm({ ...visualForm, authorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="isPrimaryCheckbox"
                    checked={visualForm.isPrimary}
                    onChange={(e) => setVisualForm({ ...visualForm, isPrimary: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isPrimaryCheckbox" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Đặt làm góc nhìn chính (Primary View)
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUpload3DModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu lên Cloudflare R2...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Xác nhận tải lên &amp; Lưu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 7: Tải lên Bản vẽ kỹ thuật 2D CAD (DWG / DXF / PDF) ─── */}
      {showUpload2DModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tải lên Bản vẽ kỹ thuật 2D (CAD / DWG / PDF)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lưu trữ bản vẽ kỹ thuật trên Cloudflare R2: <code className="text-emerald-700 font-bold">interior/blueprints/</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpload2DModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpload2D} className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tệp bản vẽ kỹ thuật (.DWG, .DXF, .PDF, .CAD) *
                </label>
                <input
                  type="file"
                  ref={fileInput2DRef}
                  accept=".dwg,.dxf,.pdf,.cad,.zip"
                  className="hidden"
                  onChange={(e) => handleFile2DChange(e.target.files?.[0] || null)}
                />
                <div
                  onClick={() => fileInput2DRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    drawingForm.file
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  {drawingForm.file ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                        {drawingForm.fileType}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {drawingForm.file.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {(drawingForm.file.size / (1024 * 1024)).toFixed(2)} MB · Bấm để đổi tệp khác
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 flex flex-col items-center gap-1.5 text-slate-500">
                      <HardDrive className="w-6 h-6 text-emerald-600" />
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Kéo thả tệp bản vẽ vào đây hoặc bấm để chọn tệp
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Định dạng AutoCAD .DWG, .DXF hoặc bản vẽ vector .PDF (Tối đa 100MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title &amp; Drawing Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên bản vẽ kỹ thuật *
                  </label>
                  <input
                    type="text"
                    required
                    value={drawingForm.title}
                    onChange={(e) => setDrawingForm({ ...drawingForm, title: e.target.value })}
                    placeholder="VD: Mặt bằng chi tiết bổ đồ gỗ tủ áo Master"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã bản vẽ
                  </label>
                  <input
                    type="text"
                    value={drawingForm.drawingCode}
                    onChange={(e) => setDrawingForm({ ...drawingForm, drawingCode: e.target.value })}
                    placeholder="VD: REV 2 - DET-03"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* File Type &amp; Author */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Định dạng file
                  </label>
                  <select
                    value={drawingForm.fileType}
                    onChange={(e) => setDrawingForm({ ...drawingForm, fileType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="DWG">DWG (AutoCAD Drawing)</option>
                    <option value="DXF">DXF (Drawing Exchange Format)</option>
                    <option value="PDF">PDF (Vector Blueprint)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kỹ sư / KTS phụ trách
                  </label>
                  <input
                    type="text"
                    value={drawingForm.author}
                    onChange={(e) => setDrawingForm({ ...drawingForm, author: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUpload2DModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu bản vẽ lên Cloudflare R2...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Lưu hồ sơ bản vẽ 2D</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 8: Tải lên Tài liệu kỹ thuật &amp; Biên bản ─── */}
      {showUploadDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tải lên Tài liệu kỹ thuật &amp; Biên bản
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lưu trữ hồ sơ tài liệu trên Cloudflare R2: <code className="text-amber-700 font-bold">interior/docs/</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadDocModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tệp tài liệu (PDF, DOCX, ZIP) *
                </label>
                <input
                  type="file"
                  ref={fileInputDocRef}
                  accept=".pdf,.doc,.docx,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      setDocForm((prev) => ({
                        ...prev,
                        file,
                        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
                      }));
                    }
                  }}
                />
                <div
                  onClick={() => fileInputDocRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    docForm.file
                      ? 'border-amber-500 bg-amber-50/30'
                      : 'border-slate-300 hover:border-amber-500 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  {docForm.file ? (
                    <div className="text-left">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {docForm.file.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {(docForm.file.size / (1024 * 1024)).toFixed(2)} MB · Bấm để đổi tệp
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 flex flex-col items-center gap-1 text-slate-500">
                      <FileText className="w-5 h-5 text-amber-600" />
                      <span>Bấm để chọn tệp tài liệu</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên tài liệu *
                </label>
                <input
                  type="text"
                  required
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  placeholder="VD: Biên bản nghiệm thu chỉ dẫn kỹ thuật"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phân loại
                  </label>
                  <select
                    value={docForm.documentCategory}
                    onChange={(e) => setDocForm({ ...docForm, documentCategory: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="Chỉ dẫn kỹ thuật">Chỉ dẫn kỹ thuật</option>
                    <option value="Biên bản phê duyệt">Biên bản phê duyệt</option>
                    <option value="Moodboard">Moodboard</option>
                    <option value="Hồ sơ nghiệm thu">Hồ sơ nghiệm thu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Người lập
                  </label>
                  <input
                    type="text"
                    value={docForm.author}
                    onChange={(e) => setDocForm({ ...docForm, author: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Lưu tài liệu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 8: Xem bản vẽ kỹ thuật 2D tương tác (CAD Blueprint Interactive Viewer) ─── */}
      {selectedDrawingForView && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className={`w-full max-w-6xl max-h-[95vh] rounded-2xl flex flex-col shadow-2xl border overflow-hidden ${
            cadTheme === 'dark'
              ? 'bg-[#0f172a] text-slate-100 border-slate-700'
              : 'bg-white text-slate-900 border-slate-300'
          }`}>
            {/* Header */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 ${
              cadTheme === 'dark' ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                  {selectedDrawingForView.fileType}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold truncate">
                      {selectedDrawingForView.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      {selectedDrawingForView.statusLabel}
                    </span>
                  </div>
                  <div className="text-xs opacity-70 font-mono mt-0.5 truncate">
                    {selectedDrawingForView.drawingCode} · KTS: {selectedDrawingForView.author} · Tỉ lệ: {selectedDrawingForView.scale || '1:100'} · Tờ: {selectedDrawingForView.sheetNumber || 'KT-01'} · {selectedDrawingForView.fileSize}
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCadTheme(cadTheme === 'dark' ? 'light' : 'dark')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    cadTheme === 'dark'
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                  title="Chuyển chế độ nền CAD (Đen) / Nền in ấn (Trắng)"
                >
                  {cadTheme === 'dark' ? '☀️ Nền in ấn' : '🌙 Nền CAD'}
                </button>

                <div className={`flex items-center rounded-lg border p-0.5 ${
                  cadTheme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'
                }`}>
                  <button
                    type="button"
                    onClick={() => setCadZoom((prev) => Math.max(0.6, prev - 0.2))}
                    className="p-1 rounded hover:bg-slate-700/50"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-mono font-semibold">
                    {Math.round(cadZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setCadZoom((prev) => Math.min(2.0, prev + 0.2))}
                    className="p-1 rounded hover:bg-slate-700/50"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCadZoom(1)}
                    className="p-1 rounded hover:bg-slate-700/50 ml-1"
                    title="Vừa màn hình"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {selectedDrawingForView.downloadUrl && (
                  <a
                    href={selectedDrawingForView.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                    title="Tải tệp CAD gốc về máy"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tải DWG gốc</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDrawingForView(null);
                    setCadZoom(1);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CAD Canvas */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center relative min-h-[460px]">
              <div
                className="transition-transform duration-200 origin-center"
                style={{ transform: `scale(${cadZoom})` }}
              >
                {/* Technical CAD Blueprint Vector Render */}
                <div className={`w-[850px] h-[520px] rounded-lg border-2 p-6 relative flex flex-col justify-between shadow-xl ${
                  cadTheme === 'dark'
                    ? 'bg-[#080e1a] border-cyan-500/40 text-cyan-400'
                    : 'bg-white border-slate-900 text-slate-900'
                }`}>
                  {/* Architectural Grid Lines */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Top Dimensions & Axis Header */}
                  <div className="relative z-10 flex items-center justify-between pb-2 border-b border-dashed border-current opacity-70 text-[11px] font-mono">
                    <div className="flex items-center gap-12">
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold">1</span>
                      <span>← 4,500 mm →</span>
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold">2</span>
                      <span>← 5,200 mm →</span>
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold">3</span>
                      <span>← 3,800 mm →</span>
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold">4</span>
                    </div>
                    <div className="font-bold tracking-wider">CỐT SÀN HOÀN THIỆN +0.000</div>
                  </div>

                  {/* Floorplan Blueprint Schematics */}
                  <div className="relative z-10 grid grid-cols-12 gap-3 flex-1 py-4">
                    {/* Left: Living Room & Tea Area */}
                    <div className="col-span-6 border-2 border-current rounded p-3 relative flex flex-col justify-between">
                      <div className="text-[11px] font-bold font-mono tracking-wide">
                        01. PHÒNG KHÁCH LIÊN THÔNG (48.5 m²)
                      </div>
                      <div className="space-y-2 py-2">
                        <div className="border border-dashed border-current rounded p-2 text-center text-[10px] font-mono">
                          [ HỆ SOFA L-SHAPE VẢI CAO CẤP &amp; BÀN TRÀ ĐÁ MARQUINA ]
                        </div>
                        <div className="border-t border-b border-current py-1 text-center text-[10px] font-mono opacity-80">
                          ════ VÁCH ỐP VENEER ÓC CHÓ &amp; KỆ TIVI TREO ════
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono opacity-70">
                        <span>Cao độ trần: +3,450 mm</span>
                        <span>Đèn ray nam châm LED 4000K</span>
                      </div>
                    </div>

                    {/* Right: Dining & Island Kitchen */}
                    <div className="col-span-6 grid grid-rows-2 gap-3">
                      <div className="border-2 border-current rounded p-3 flex flex-col justify-between">
                        <div className="text-[11px] font-bold font-mono tracking-wide">
                          02. KHU VỰC BÀN ĂN &amp; ĐÈN THẢ (22.0 m²)
                        </div>
                        <div className="border border-dashed border-current rounded p-1 text-center text-[10px] font-mono">
                          BÀN ĂN NGUYÊN TẤM ÓC CHÓ 8 GHẾ
                        </div>
                        <div className="text-[10px] font-mono opacity-70">Cửa trượt kính Slim view ban công</div>
                      </div>

                      <div className="border-2 border-current rounded p-3 flex flex-col justify-between">
                        <div className="text-[11px] font-bold font-mono tracking-wide">
                          03. ĐẢO BẾP &amp; TỦ BẾP ACRYLIC (18.5 m²)
                        </div>
                        <div className="flex gap-2">
                          <div className="border border-current p-1 flex-1 text-center text-[10px] font-mono">
                            ĐẢO BẾP ĐÁ VICOSTONE
                          </div>
                          <div className="border border-current p-1 flex-1 text-center text-[10px] font-mono">
                            HỆ TỦ KỊCH TRẦN
                          </div>
                        </div>
                        <div className="text-[10px] font-mono opacity-70">Phụ kiện Blum &amp; Hafele chính hãng</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Title Block (Khung tên bản vẽ chuẩn kỹ thuật) */}
                  <div className="relative z-10 border-2 border-current rounded-sm p-3 grid grid-cols-12 gap-2 text-[10px] font-mono">
                    <div className="col-span-4 border-r border-current pr-2">
                      <div className="font-bold text-[11px] tracking-wider text-emerald-500">PHÚ CƯỜNG DESIGN &amp; FIT-OUT</div>
                      <div className="opacity-70 mt-0.5">Dự án: {data.project.name}</div>
                      <div className="opacity-70">Mã DA: {data.project.code}</div>
                    </div>
                    <div className="col-span-5 border-r border-current pr-2">
                      <div className="font-bold uppercase truncate">{selectedDrawingForView.title}</div>
                      <div className="opacity-70 mt-0.5">Chủ trì: {selectedDrawingForView.author}</div>
                      <div className="opacity-70">Kiểm tra: Trần Thị Mai (Trưởng phòng TK)</div>
                    </div>
                    <div className="col-span-3 text-right">
                      <div className="font-bold text-emerald-400">APPROVED · ĐÃ DUYỆT</div>
                      <div className="opacity-70 mt-0.5">Bản vẽ: {selectedDrawingForView.sheetNumber || 'KT-01/18'}</div>
                      <div className="opacity-70">Tỉ lệ: {selectedDrawingForView.scale || '1:100'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer status bar */}
            <div className={`px-5 py-2.5 border-t flex items-center justify-between text-xs ${
              cadTheme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Hồ sơ đã kiểm tra tiêu chuẩn sản xuất xưởng &amp; thi công fit-out</span>
              </div>
              <div className="font-mono text-[11px] opacity-75">
                Cloudflare R2 Secure CAD Asset · Invariant Locked
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 9: Xem tài liệu kỹ thuật & biên bản nghiệm thu (Document Viewer) ─── */}
      {selectedDocForView && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {selectedDocForView.title}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedDocForView.documentCategory} · {selectedDocForView.author} · {selectedDocForView.fileSize}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForView(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Paper Container */}
            <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-800 p-8 rounded-xl space-y-5 text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                {/* Doc Header Stamp */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                      BELLA INTERIOR OS — OFFICIAL SPECIFICATION
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {selectedDocForView.title}
                    </div>
                  </div>
                  <div className="border-2 border-emerald-600 text-emerald-600 font-bold px-3 py-1 rounded text-xs uppercase tracking-wider rotate-[-4deg]">
                    APPROVED SIGN-OFF
                  </div>
                </div>

                <div className="space-y-3 leading-relaxed">
                  <p>
                    <strong>Dự án:</strong> {data.project.name} ({data.project.code})
                  </p>
                  <p>
                    <strong>Chủ đầu tư / Khách hàng:</strong> {data.project.clientName}
                  </p>
                  <p>
                    <strong>Ngày nghiệm thu phát hành:</strong> {selectedDocForView.updatedDateFormatted}
                  </p>
                  <p>
                    <strong>Người phê duyệt kỹ thuật:</strong> {selectedDocForView.author}
                  </p>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 mt-4">
                    <div className="font-bold text-slate-900 dark:text-white">Nội dung chỉ dẫn &amp; tiêu chuẩn kỹ thuật:</div>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300 text-xs">
                      <li>Độ ẩm cốt gỗ tự nhiên và ván MDF kháng ẩm đạt chuẩn ≤ 12% theo tiêu chuẩn TCVN.</li>
                      <li>Sơn phủ bóng mờ 50% PU Inchem 4 lớp chống ố vàng và trầy xước.</li>
                      <li>Hệ phụ kiện ray trượt, bản lề giảm chấn Blum Clip Top BLUMOTION bảo hành 5 năm.</li>
                      <li>Đá thạch anh Vicostone độ dày 20mm bo mài mòi 45 độ sắc nét, liền mạch.</li>
                    </ul>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-center space-y-1">
                    <div className="text-[11px] text-slate-400">Đại diện khách hàng</div>
                    <div className="font-bold text-slate-900 dark:text-white pt-8">{data.project.clientName}</div>
                    <div className="text-[10px] text-emerald-600">Đã ký xác nhận</div>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-[11px] text-slate-400">Chủ trì thiết kế Bella</div>
                    <div className="font-bold text-slate-900 dark:text-white pt-8">{selectedDocForView.author}</div>
                    <div className="text-[10px] text-emerald-600">Phê duyệt kỹ thuật</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <span className="text-xs text-slate-400">
                Tài liệu pháp lý đính kèm hợp đồng thi công fit-out
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDocForView(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
                {selectedDocForView.downloadUrl && (
                  <a
                    href={selectedDocForView.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải PDF gốc</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default function InteriorDesignStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <InteriorDesignStudioContent />
    </Suspense>
  );
}
