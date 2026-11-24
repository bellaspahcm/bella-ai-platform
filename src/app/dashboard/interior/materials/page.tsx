'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Bảng Chỉ Định Vật Liệu & Mẫu Thực Tế (Material Specification & Spec Lock)
 *
 * Implements the executive Material Specification dashboard matching the reference lifecycle:
 * - Breadcrumb & Project Header (Villa Sunrise Renovation INT-2024-001)
 * - Lifecycle Sub-navigation Tabs (Tổng quan, Thiết kế, Vật liệu [Active], BOQ & Dự toán, Sản xuất, Thi công, Báo cáo)
 * - Spec Lock Invariant Banner (R1.0 - Approved Spec Lock, 100% mẫu đã ký duyệt)
 * - 4 Summary KPI Cards (Tổng danh mục, Đã duyệt mẫu, Sẵn có nội địa, Đặt hàng nhập khẩu)
 * - Category Filter & Quick Search (Gỗ, Đá, Kim khí, Thiết bị, Chiếu sáng)
 * - Dual View: Material Sample Card Grid (ảnh vân mẫu trực quan) + Bảng Quy Cách Kỹ Thuật (Spec Table)
 * - Detail Modal: Xem phóng to chi tiết quy cách, CO/CQ, thương hiệu chỉ định
 *
 * @module src/app/dashboard/interior/materials/page
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import InteriorUserBar from '@/components/interior/InteriorUserBar';
import {
  Layers,
  Lock,
  Unlock,
  Search,
  ChevronDown,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Filter,
  Eye,
  X,
  Sparkles,
  ShieldCheck,
  Check,
  PackageCheck,
  Clock,
  ExternalLink,
  SlidersHorizontal,
  Plus,
  Upload,
  FileUp,
  FileText,
  AlertCircle,
  RotateCcw,
  Building,
} from 'lucide-react';

// ——— Types & Data Contracts ———

export type MaterialCategory = 'all' | 'wood' | 'stone' | 'hardware' | 'appliances' | 'lighting' | 'finishes';

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: MaterialCategory;
  categoryLabel: string;
  specDetails: string;
  roomArea: string;
  status: 'locked' | 'approved' | 'in_stock' | 'procuring';
  statusLabel: string;
  statusBadgeClass: string;
  imageUrl: string;
  unit: string;
  standard: string;
  origin: string;
  approvedDate: string;
  approvedBy: string;
  sampleStatus: string;
}

const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: 'mat-01',
    code: 'SPEC-WD-01',
    name: 'Gỗ Óc Chó Tự Nhiên Bắc Mỹ (Walnut FAS)',
    brand: 'Nhập khẩu Bắc Mỹ',
    category: 'wood',
    categoryLabel: 'Gỗ & Bề mặt',
    specDetails: 'Gỗ thịt nhập khẩu tiêu chuẩn FAS, độ ẩm sấy đạt 8-12%, phủ sơn PU mờ 70% Inchem cao cấp',
    roomArea: 'Phòng khách, Bàn ăn, Cửa chính',
    status: 'locked',
    statusLabel: 'Đã khóa Spec',
    statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
    unit: 'm3',
    standard: 'Tiêu chuẩn FAS (NHLA USA)',
    origin: 'Hoa Kỳ',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã ký mẫu thực tế',
  },
  {
    id: 'mat-02',
    code: 'SPEC-WD-02',
    name: 'MDF Lõi Xanh Chống Ẩm Phủ Melamine',
    brand: 'An Cường',
    category: 'wood',
    categoryLabel: 'Gỗ & Bề mặt',
    specDetails: 'Ván MDF chống ẩm chuẩn E1 Green Label Singapore, mã màu MS 4022 EV vân sồi thanh lịch',
    roomArea: 'Thùng tủ áo, Tủ giầy, Hệ tủ bếp dưới',
    status: 'locked',
    statusLabel: 'Đã khóa Spec',
    statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/project-render-warm.jpg',
    unit: 'Tấm (1220x2440x17mm)',
    standard: 'Green Label E1 (Tiêu chuẩn phát thải)',
    origin: 'Việt Nam (An Cường chính hãng)',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã ký bảng mẫu vật tư',
  },
  {
    id: 'mat-03',
    code: 'SPEC-ST-01',
    name: 'Đá Thạch Anh Nhân Tạo Vicostone Java Noir',
    brand: 'Vicostone',
    category: 'stone',
    categoryLabel: 'Đá & Bề mặt',
    specDetails: 'Mã BQ8812 tông đen vân chỉ trắng huyền bí, độ cứng 7 Mohs, chống thấm ố và kháng khuẩn bề mặt',
    roomArea: 'Mặt bàn đảo bếp, Mặt đá tủ lavabo Master',
    status: 'locked',
    statusLabel: 'Đã khóa Spec',
    statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    unit: 'm2',
    standard: 'NSF 51 (Food Safe), Greenguard Gold',
    origin: 'Việt Nam',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã duyệt mẫu phiến 300x300mm',
  },
  {
    id: 'mat-04',
    code: 'SPEC-HW-01',
    name: 'Bản Lề Giảm Chấn Thép Không Gỉ 304',
    brand: 'Hafele',
    category: 'hardware',
    categoryLabel: 'Kim khí & Phụ kiện',
    specDetails: 'Bản lề thẳng góc mở 110 độ có tích hợp pit-tông giảm chấn Smuso, inox 304 chống rỉ sét',
    roomArea: 'Toàn bộ cánh tủ nội thất (Bếp, Áo, Lavabo)',
    status: 'in_stock',
    statusLabel: 'Đã nhập xưởng',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/wood-panel.jpg',
    unit: 'Cái',
    standard: 'DIN EN 15570 (Cấp độ 3 - 80.000 lần đóng mở)',
    origin: 'CHLB Đức (Hafele)',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long',
    sampleStatus: 'Hàng mẫu đạt kiểm định xưởng',
  },
  {
    id: 'mat-05',
    code: 'SPEC-HW-02',
    name: 'Ray Trượt Ngăn Kéo Giảm Chấn Âm Tủ Blum Movento',
    brand: 'Blum',
    category: 'hardware',
    categoryLabel: 'Kim khí & Phụ kiện',
    specDetails: 'Ray mở toàn phần tải trọng 40kg, công nghệ chuyển động mượt mà Tip-on Blumotion đồng bộ',
    roomArea: 'Hệ ngăn kéo đảo bếp, Ngăn kéo bàn phấn',
    status: 'locked',
    statusLabel: 'Đã khóa Spec',
    statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/stone-tile.jpg',
    unit: 'Bộ',
    standard: 'ISO 9001 (Áo)',
    origin: 'Cộng hòa Áo',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã thử nghiệm đóng mở êm',
  },
  {
    id: 'mat-06',
    code: 'SPEC-AP-01',
    name: 'Bếp Từ Đôi 3 Vùng Nấu Bosch Serie 8',
    brand: 'Bosch',
    category: 'appliances',
    categoryLabel: 'Thiết bị bếp',
    specDetails: 'Model PID675DC1E, mặt kính gốm thủy tinh Schott Ceran vát cạnh bo viền inox, công suất 7400W',
    roomArea: 'Khu vực bếp nấu chính',
    status: 'procuring',
    statusLabel: 'Đang đặt hàng',
    statusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/kitchen-design-render.jpg',
    unit: 'Chiếc',
    standard: 'CE Châu Âu (Nhập khẩu nguyên chiếc Tây Ban Nha)',
    origin: 'Tây Ban Nha',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Chốt model kỹ thuật theo bản vẽ điện',
  },
  {
    id: 'mat-07',
    code: 'SPEC-LT-01',
    name: 'Đèn LED Âm Trần Spot Light SmartBright',
    brand: 'Philips',
    category: 'lighting',
    categoryLabel: 'Chiếu sáng',
    specDetails: 'Chip LED COB góc chiếu 24 độ, chỉ số hoàn màu CRI > 90, nhiệt độ màu 3000K ánh sáng vàng ấm',
    roomArea: 'Trần thạch cao Phòng khách, Rọi tranh hành lang',
    status: 'in_stock',
    statusLabel: 'Đã nhập xưởng',
    statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/materials/fabric-upholstery.jpg',
    unit: 'Bóng',
    standard: 'IEC 60598 / RoHS',
    origin: 'Philips Hà Lan',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long',
    sampleStatus: 'Đã test mẫu nhiệt độ màu tại showroom',
  },
  {
    id: 'mat-08',
    code: 'SPEC-FN-01',
    name: 'Sơn Nước Kháng Khuẩn Better Living Air Clean',
    brand: 'Dulux',
    category: 'finishes',
    categoryLabel: 'Sơn & Hoàn thiện',
    specDetails: 'Công nghệ than tre hoạt tính lọc không khí, chống nấm mốc tối ưu, bề mặt bóng mờ sang trọng',
    roomArea: 'Toàn bộ tường nội thất căn biệt thự',
    status: 'locked',
    statusLabel: 'Đã khóa Spec',
    statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/flooring-installation.jpg',
    unit: 'Thùng 18L',
    standard: 'Green Label Singapore, hàm lượng VOC siêu thấp',
    origin: 'AkzoNobel Việt Nam',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã test thẻ màu mẫu thực tế trên tường mẫu',
  },
];

// ─── API response shape ─────────────────────────────────────────────────────

interface MaterialsApiResponse {
  success: boolean;
  materials: MaterialItem[];
  totalCount: number;
  approvedCount: number;
  domesticCount: number;
  importCount: number;
  revisionId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  revisionVersion?: number | null;
}

interface InteriorProjectItem {
  id: string;
  code: string;
  name: string;
  status?: string;
  customer_name?: string | null;
  client_name?: string | null;
  site_address?: string | null;
  estimated_budget?: number | string | null;
}

export default function InteriorMaterialsPage() {
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'cards' | 'table'>('cards');
  const [activeModalItem, setActiveModalItem] = useState<MaterialItem | null>(null);

  // Project selection & switcher dropdown state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-villa-sunrise');
  const [projectOptions, setProjectOptions] = useState<InteriorProjectItem[]>([
    {
      id: 'proj-villa-sunrise',
      code: 'INT-2024-001',
      name: 'Villa Sunrise Renovation',
      customer_name: 'SunCasa Group',
      status: 'in_progress',
    },
    {
      id: 'proj-penthouse-diamond',
      code: 'INT-2024-002',
      name: 'Penthouse Diamond Island Luxury',
      customer_name: 'Trần Gia Hưng',
      status: 'design',
    },
    {
      id: 'proj-shophouse-sala',
      code: 'INT-2024-003',
      name: 'Shophouse Sala Saroma Office',
      customer_name: 'TechCorp Holdings',
      status: 'approved',
    },
  ]);
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modals for adding & importing
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  // Form state for adding new material item
  const [formItem, setFormItem] = useState({
    code: '',
    name: '',
    brand: 'An Cường',
    category: 'wood' as MaterialCategory,
    categoryLabel: 'Gỗ & Bề mặt',
    specDetails: '',
    roomArea: 'Phòng khách',
    unit: 'Tấm',
    standard: 'Tiêu chuẩn E1 / Green Label',
    origin: 'Việt Nam',
    approvedForUse: true,
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
  });

  // State for Excel / CSV import text
  const [importText, setImportText] = useState<string>('');

  // Live data — starts with static seed, replaced by DB data once fetched
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [kpiTotalCount, setKpiTotalCount] = useState<number>(28);
  const [kpiApprovedCount, setKpiApprovedCount] = useState<number>(28);
  const [kpiDomesticCount, setKpiDomesticCount] = useState<number>(21);
  const [kpiImportCount, setKpiImportCount] = useState<number>(7);
  const [specLockApprovedBy, setSpecLockApprovedBy] = useState<string>('Trần Thị Mai & Hoàng Long');
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load real projects from API
  useEffect(() => {
    let isMounted = true;
    async function loadProjects() {
      try {
        const res = await fetch('/api/interior/projects', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data?.projects) ? (json.data.projects as InteriorProjectItem[]) : [];
          if (isMounted && items.length > 0) {
            setProjectOptions(items);
          }
        }
      } catch {
        // keep fallback
      }
    }
    loadProjects();
    return () => { isMounted = false; };
  }, []);

  // Click outside to close project dropdown
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

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return projectOptions;
    const q = projectSearchQuery.toLowerCase();
    return projectOptions.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        (p.customer_name && p.customer_name.toLowerCase().includes(q))
    );
  }, [projectOptions, projectSearchQuery]);

  // Current selected project object
  const currentProject = useMemo(() => {
    return projectOptions.find((p) => p.id === selectedProjectId) || projectOptions[0] || {
      id: 'proj-villa-sunrise',
      code: 'INT-2024-001',
      name: 'Villa Sunrise Renovation',
      customer_name: 'SunCasa Group',
    };
  }, [projectOptions, selectedProjectId]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowProjectDropdown(false);
    const proj = projectOptions.find((p) => p.id === projectId);
    showToast(`Đã chuyển sang dự án: ${proj?.name || projectId}`, 'info');
  };

  // Fetch real material data from DB whenever selectedProjectId changes
  useEffect(() => {
    let isMounted = true;
    async function fetchMaterials() {
      setIsLoadingMaterials(true);
      try {
        const url = selectedProjectId
          ? `/api/interior/materials?projectId=${encodeURIComponent(selectedProjectId)}`
          : '/api/interior/materials';
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json: MaterialsApiResponse = await res.json();
          if (isMounted && json.success && json.materials.length > 0) {
            setMaterials(json.materials);
            setKpiTotalCount(json.totalCount);
            setKpiApprovedCount(json.approvedCount);
            setKpiDomesticCount(json.domesticCount);
            setKpiImportCount(json.importCount);
            if (json.approvedBy) setSpecLockApprovedBy(json.approvedBy);
            if (json.revisionId) setRevisionId(json.revisionId);
          }
        }
      } catch {
        // Retain INITIAL_MATERIALS as fallback
      } finally {
        if (isMounted) setIsLoadingMaterials(false);
      }
    }
    fetchMaterials();
    return () => { isMounted = false; };
  }, [selectedProjectId]);

  // Category labels helper
  const getCategoryLabel = (cat: MaterialCategory): string => {
    switch (cat) {
      case 'wood': return 'Gỗ & Bề mặt';
      case 'stone': return 'Đá & Bề mặt';
      case 'hardware': return 'Kim khí & Phụ kiện';
      case 'appliances': return 'Thiết bị bếp';
      case 'lighting': return 'Chiếu sáng';
      case 'finishes': return 'Sơn & Hoàn thiện';
      default: return 'Khác';
    }
  };

  // Handle Save New Material
  const handleSaveMaterial = async () => {
    if (!formItem.name.trim()) {
      showToast('Vui lòng nhập tên vật tư chỉ định', 'error');
      return;
    }
    if (!formItem.code.trim()) {
      showToast('Vui lòng nhập mã chỉ định (VD: SPEC-WD-09)', 'error');
      return;
    }

    setIsSubmitting(true);
    const categoryLabel = getCategoryLabel(formItem.category);
    const isDomestic = ['An Cường', 'Đồng Tâm', 'Vicostone', 'Dulux', 'Inchem', 'Việt Nam'].some(
      (b) => formItem.brand.includes(b) || formItem.origin.includes(b)
    );

    const newItem: MaterialItem = {
      id: `mat-${Date.now()}`,
      code: formItem.code.trim(),
      name: formItem.name.trim(),
      brand: formItem.brand.trim() || 'Chỉ định theo thiết kế',
      category: formItem.category,
      categoryLabel,
      specDetails: formItem.specDetails.trim() || 'Theo tiêu chuẩn hồ sơ thiết kế thi công',
      roomArea: formItem.roomArea.trim() || 'Toàn bộ công trình',
      status: formItem.approvedForUse ? 'locked' : 'procuring',
      statusLabel: formItem.approvedForUse ? 'Đã khóa Spec' : 'Đang đặt hàng',
      statusBadgeClass: formItem.approvedForUse
        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
        : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
      imageUrl: formItem.imageUrl || 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
      unit: formItem.unit.trim() || 'Tấm',
      standard: formItem.standard.trim() || 'TCVN',
      origin: formItem.origin.trim() || (isDomestic ? 'Việt Nam' : 'Nhập khẩu'),
      approvedDate: new Date().toLocaleDateString('vi-VN'),
      approvedBy: specLockApprovedBy,
      sampleStatus: formItem.approvedForUse ? 'Đã ký mẫu thực tế' : 'Đang trình duyệt',
    };

    // Optimistic UI update
    setMaterials((prev) => [newItem, ...prev]);
    setKpiTotalCount((prev) => prev + 1);
    if (formItem.approvedForUse) setKpiApprovedCount((prev) => prev + 1);
    if (isDomestic) {
      setKpiDomesticCount((prev) => prev + 1);
    } else {
      setKpiImportCount((prev) => prev + 1);
    }

    try {
      // Persist to server API
      const res = await fetch('/api/interior/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revisionId,
          itemCategory: categoryLabel,
          brand: newItem.brand,
          code: newItem.code,
          name: newItem.name,
          colorTone: newItem.roomArea,
          specDescription: `${newItem.specDetails} | ĐVT: ${newItem.unit} | Chuẩn: ${newItem.standard}`,
          approvedForUse: formItem.approvedForUse,
        }),
      });
      if (res.ok) {
        showToast(`Đã thêm vật tư "${newItem.name}" và đồng bộ CSDL thành công!`, 'success');
      } else {
        showToast(`Đã lưu cục bộ vật tư "${newItem.name}".`, 'info');
      }
    } catch {
      showToast(`Đã lưu cục bộ vật tư "${newItem.name}".`, 'info');
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      // Reset form code with next sequence
      setFormItem((prev) => ({
        ...prev,
        code: `SPEC-${prev.category.toUpperCase().slice(0, 2)}-0${Math.floor(Math.random() * 90 + 10)}`,
        name: '',
        specDetails: '',
      }));
    }
  };

  // Handle Excel / CSV Import
  const handleImportExcelData = async () => {
    if (!importText.trim()) {
      showToast('Vui lòng dán dữ liệu bảng tính Excel hoặc CSV', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const lines = importText.trim().split('\n').filter((l) => l.trim().length > 0);
      const parsedItems: MaterialItem[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Split by tab (copy from Excel) or comma / semicolon
        const cols = line.includes('\t') ? line.split('\t') : line.split(/[,;]/);
        if (cols.length < 2) continue;

        // Skip header if first row has "Mã" or "Tên"
        if (i === 0 && (cols[0].toLowerCase().includes('mã') || cols[1].toLowerCase().includes('tên'))) {
          continue;
        }

        const code = cols[0]?.trim() || `SPEC-EX-${i + 1}`;
        const name = cols[1]?.trim() || `Vật liệu ${i + 1}`;
        const brand = cols[2]?.trim() || 'An Cường';
        const rawCat = cols[3]?.trim().toLowerCase() || '';
        let category: MaterialCategory = 'wood';
        if (rawCat.includes('đá') || rawCat.includes('stone')) category = 'stone';
        else if (rawCat.includes('kim') || rawCat.includes('khóa') || rawCat.includes('bản lề')) category = 'hardware';
        else if (rawCat.includes('bếp') || rawCat.includes('thiết bị')) category = 'appliances';
        else if (rawCat.includes('đèn') || rawCat.includes('sáng')) category = 'lighting';
        else if (rawCat.includes('sơn') || rawCat.includes('hoàn thiện')) category = 'finishes';

        const origin = cols[4]?.trim() || 'Việt Nam';
        const specDetails = cols[5]?.trim() || 'Quy cách kỹ thuật theo hồ sơ thi công';
        const roomArea = cols[6]?.trim() || 'Khu vực nội thất';

        parsedItems.push({
          id: `mat-import-${Date.now()}-${i}`,
          code,
          name,
          brand,
          category,
          categoryLabel: getCategoryLabel(category),
          specDetails,
          roomArea,
          status: 'locked',
          statusLabel: 'Đã khóa Spec',
          statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
          imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/design/material-texture-board.jpg',
          unit: 'Tấm',
          standard: 'TCVN',
          origin,
          approvedDate: new Date().toLocaleDateString('vi-VN'),
          approvedBy: specLockApprovedBy,
          sampleStatus: 'Đã ký mẫu thực tế',
        });
      }

      if (parsedItems.length === 0) {
        showToast('Không đọc được dữ liệu hợp lệ. Vui lòng kiểm tra định dạng copy từ Excel.', 'error');
        setIsSubmitting(false);
        return;
      }

      // Add to state
      setMaterials((prev) => [...parsedItems, ...prev]);
      setKpiTotalCount((prev) => prev + parsedItems.length);
      setKpiApprovedCount((prev) => prev + parsedItems.length);

      // Post to API
      try {
        await fetch('/api/interior/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revisionId,
            items: parsedItems.map((item) => ({
              itemCategory: item.categoryLabel,
              brand: item.brand,
              code: item.code,
              name: item.name,
              colorTone: item.roomArea,
              specDescription: item.specDetails,
              approvedForUse: true,
            })),
          }),
        });
      } catch {
        // Fallback local ok
      }

      showToast(`Đã nhập thành công ${parsedItems.length} vật tư từ Excel vào Spec Lock!`, 'success');
      setShowImportModal(false);
      setImportText('');
    } catch {
      showToast('Có lỗi xảy ra khi đọc dữ liệu bảng tính', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sample CSV template generator
  const handleDownloadCsvTemplate = () => {
    const csvHeader = 'Mã Spec\tTên vật tư\tThương hiệu\tChủng loại\tXuất xứ\tQuy cách kỹ thuật\tKhu vực áp dụng\n';
    const sampleRows = [
      'SPEC-WD-09\tVán Gỗ Plywood Óc Chó 18mm\tAn Cường\tGỗ & Bề mặt\tViệt Nam\tKhổ 1220x2440x18mm tiêu chuẩn CARB P2\tVách ốp phòng khách\n',
      'SPEC-ST-05\tĐá Cẩm Thạch Trắng Ý Calacatta\tNhập khẩu Ý\tĐá & Bề mặt\tÝ\tĐộ dày 20mm chống thấm ố 5 lớp\tMặt bàn đảo bếp & Lavabo\n',
      'SPEC-HW-08\tTay nắm âm tủ nhôm mạ Anode\tHafele\tKim khí & Phụ kiện\tĐức\tMàu xám Titan mờ dài 200mm\tToàn bộ cánh tủ áo\n',
    ].join('');
    
    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_bang_chi_dinh_vat_lieu_spec_lock.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã tải file mẫu bảng tính (Excel/CSV)', 'success');
  };

  // Sub-tabs matching the official lifecycle sub-navigation
  const subTabs = [
    { key: 'overview', label: 'Tổng quan', href: '/dashboard/interior/projects', isActive: false },
    { key: 'design', label: 'Thiết kế', href: '/dashboard/interior/design', isActive: false },
    { key: 'materials', label: 'Vật liệu', href: '/dashboard/interior/materials', isActive: true },
    { key: 'boq', label: 'BOQ & Dự toán', href: '/dashboard/interior/boq', isActive: false },
    { key: 'production', label: 'Sản xuất', href: '/dashboard/interior/production', isActive: false },
    { key: 'installation', label: 'Thi công', href: '/dashboard/interior/installation', isActive: false },
    { key: 'reports', label: 'Báo cáo', href: '/dashboard/interior/reports', isActive: false },
  ];

  const filteredMaterials = useMemo(() => {
    return materials.filter((mat) => {
      const matchCategory = selectedCategory === 'all' || mat.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        mat.name.toLowerCase().includes(q) ||
        mat.code.toLowerCase().includes(q) ||
        mat.brand.toLowerCase().includes(q) ||
        mat.roomArea.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [materials, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* ─── Toast Feedback Container ─── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          {toastType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastType === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastType === 'info' && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
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

      {/* ─── Top Level: Breadcrumbs & Project Switcher Dropdown & User Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        {/* Left: Breadcrumbs + Interactive Project Switcher Dropdown */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link
            href="/dashboard/interior/projects"
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            Dự án
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&rsaquo;</span>

          {/* Project Switcher Dropdown Component */}
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowProjectDropdown((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-2xs transition-all cursor-pointer group"
              title="Nhấn để đổi sang dự án khác"
            >
              <Building className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[320px]">
                {currentProject.name}
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-normal">
                ({currentProject.code})
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                  showProjectDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showProjectDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm dự án..."
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                  {filteredProjects.map((p) => {
                    const isCurrent = p.id === selectedProjectId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProject(p.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate font-semibold text-slate-900 dark:text-white">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {p.code} • {p.customer_name || 'Khách hàng'}
                          </p>
                        </div>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Top user profile & notifications */}
        <div className="flex items-center gap-3">
          <InteriorUserBar />
        </div>
      </div>

      {/* ─── Second Level: Page Title + Executive Action Toolbar ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        {/* Title & Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Bảng Chỉ Định Vật Liệu &amp; Mẫu Thực Tế (Spec Lock)
          </h1>

          {/* Spec Lock Toggle Pill */}
          <button
            type="button"
            onClick={() => {
              setIsUnlocked(!isUnlocked);
              showToast(
                !isUnlocked
                  ? 'Đã mở khóa chế độ Soạn thảo (Draft Revision).'
                  : 'Đã khóa Spec R1.0 Active (Bất biến).',
                'info'
              );
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
              isUnlocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title="Nhấn để chuyển đổi giữa Khóa Spec và Chế độ Soạn thảo"
          >
            {isUnlocked ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isUnlocked ? 'Đang Soạn Thảo (Draft R1.1)' : 'Spec Lock R1.0 Active'}</span>
          </button>

          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Đang thực hiện
          </span>
        </div>

        {/* Action Controls: Harmonized, Non-wrapping, Professional Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Segmented View Mode Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveView('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Thẻ Mẫu</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Dạng Bảng</span>
            </button>
          </div>

          {/* Button: Nhập Excel */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/90 dark:border-slate-800 shadow-2xs transition-all cursor-pointer"
            title="Nhập danh mục hàng loạt từ bảng tính Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nhập Excel</span>
          </button>

          {/* Button: Xuất PDF */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.print();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/90 dark:border-slate-800 shadow-2xs transition-all cursor-pointer"
            title="Xuất hồ sơ Spec kỹ thuật PDF"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Xuất PDF</span>
          </button>

          {/* Primary CTA: + Thêm Vật Tư */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
            title="Khai báo vật tư chỉ định mới"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Thêm Vật Tư</span>
          </button>
        </div>
      </div>

      {/* ─── Lifecycle Sub-navigation Tabs ─── */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-6 overflow-x-auto text-xs font-semibold">
        {subTabs.map((tab) => (
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

      {/* ─── Approved Spec Lock Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent dark:from-emerald-950/40 dark:via-amber-950/20 border border-emerald-500/20 dark:border-emerald-800/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Bảng Quy Cách &amp; Chủng Loại Vật Liệu Đã Được Khóa (Spec Lock R1.0)
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                100% Ký Duyệt
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Toàn bộ {kpiTotalCount} hạng mục vật liệu chính đã được KTS trưởng và Chủ đầu tư ký duyệt mẫu thực tế. Mọi thay đổi chủng loại vật tư đều phải thông qua thủ tục Addendum hợp đồng.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Người duyệt mẫu</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{specLockApprovedBy}</span>
          </div>
        </div>
      </div>

      {/* ─── 4 Summary KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Tổng Danh Mục Vật Tư
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{isLoadingMaterials ? '—' : kpiTotalCount}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
              Đầy đủ 100%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">Bao gồm gỗ, đá, kim khí, thiết bị</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Đã Ký Bảng Mẫu Thực Tế
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{isLoadingMaterials ? '—' : `${kpiApprovedCount} / ${kpiTotalCount}`}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">Lưu trữ tại phòng Sample Board xưởng</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Nguồn Cung Nội Địa
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {isLoadingMaterials ? '—' : (kpiTotalCount > 0 ? `${Math.round((kpiDomesticCount / kpiTotalCount) * 100)}%` : '0%')}
            </span>
            <span className="text-xs font-semibold text-slate-500">{isLoadingMaterials ? '' : `${kpiDomesticCount} danh mục`}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">An Cường, Vicostone, Dulux</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Hàng Nhập Khẩu Chỉ Định
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {isLoadingMaterials ? '—' : (kpiTotalCount > 0 ? `${Math.round((kpiImportCount / kpiTotalCount) * 100)}%` : '0%')}
            </span>
            <span className="text-xs font-semibold text-slate-500">{isLoadingMaterials ? '' : `${kpiImportCount} danh mục`}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">Gỗ Óc Chó FAS, Hafele, Blum, Bosch</span>
        </div>
      </div>

      {/* ─── Search &amp; Category Filters Bar ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên vật liệu, thương hiệu, mã spec..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#0f4c3a]"
            />
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 self-end sm:self-center font-medium">
            Hiển thị <strong>{filteredMaterials.length}</strong> / {materials.length} vật tư
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          {[
            { key: 'all', label: 'Tất cả chủng loại' },
            { key: 'wood', label: 'Gỗ & Bề mặt' },
            { key: 'stone', label: 'Đá & Bề mặt' },
            { key: 'hardware', label: 'Kim khí & Phụ kiện' },
            { key: 'appliances', label: 'Thiết bị bếp' },
            { key: 'lighting', label: 'Chiếu sáng' },
            { key: 'finishes', label: 'Sơn & Hoàn thiện' },
          ].map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key as MaterialCategory)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                selectedCategory === cat.key
                  ? 'bg-[#0f4c3a] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── View 1: Material Sample Card Grid ─── */}
      {activeView === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Image Preview with Spec Code overlay */}
              <div className="relative aspect-16/10 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                  src={mat.imageUrl}
                  alt={mat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-black/70 text-white backdrop-blur-xs border border-white/20">
                    {mat.code}
                  </span>
                </div>

                <div className="absolute top-2.5 right-2.5">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border backdrop-blur-xs ${mat.statusBadgeClass}`}>
                    {mat.statusLabel}
                  </span>
                </div>

                <div className="interior-material-caption absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px] rounded-md px-2 py-1">
                  <span className="font-semibold">{mat.categoryLabel}</span>
                  <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded backdrop-blur-xs">
                    {mat.brand}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {mat.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {mat.specDetails}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Khu vực:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate max-w-[160px]">
                      {mat.roomArea}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Mẫu thực tế:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {mat.sampleStatus}
                    </span>
                  </div>
                </div>

                {/* Card Button */}
                <button
                  type="button"
                  onClick={() => setActiveModalItem(mat)}
                  className="w-full mt-2 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem Chi Tiết Quy Cách</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── View 2: Spec Sheet Table View ─── */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
              <thead className="whitespace-nowrap">
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  <th className="py-3 px-4 whitespace-nowrap">Mã Spec</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tên Vật Liệu</th>
                  <th className="py-3 px-4 whitespace-nowrap">Thương Hiệu / Xuất Xứ</th>
                  <th className="py-3 px-4 whitespace-nowrap">Quy Cách Kỹ Thuật</th>
                  <th className="py-3 px-4 whitespace-nowrap">Khu Vực Ứng Dụng</th>
                  <th className="py-3 px-4 whitespace-nowrap">Trạng Thái Spec</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {filteredMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {mat.code}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{mat.name}</div>
                      <div className="text-[11px] text-slate-400 whitespace-nowrap">{mat.categoryLabel}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{mat.brand}</span>
                      <div className="text-[11px] text-slate-400 whitespace-nowrap">{mat.origin}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {mat.specDetails}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                      {mat.roomArea}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${mat.statusBadgeClass}`}>
                        {mat.statusLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveModalItem(mat)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Detail Modal (Xem Chi Tiết Mẫu Vật Liệu) ─── */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#0f4c3a] text-white">
                  {activeModalItem.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chi Tiết Mẫu Chỉ Định Vật Tư
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
              <div className="aspect-16/9 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                <img
                  src={activeModalItem.imageUrl}
                  alt={activeModalItem.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeModalItem.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1">{activeModalItem.specDetails}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Thương hiệu / Xuất xứ</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {activeModalItem.brand} ({activeModalItem.origin})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Khu vực sử dụng</span>
                  <span className="font-bold text-slate-900 dark:text-white">{activeModalItem.roomArea}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tiêu chuẩn kiểm định</span>
                  <span className="font-bold text-slate-900 dark:text-white">{activeModalItem.standard}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Trạng thái duyệt mẫu</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeModalItem.sampleStatus}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
                <span>Duyệt bởi: <strong>{activeModalItem.approvedBy}</strong></span>
                <span>Ngày ký: <strong>{activeModalItem.approvedDate}</strong></span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="px-4 py-2 rounded-xl bg-[#0f4c3a] text-white text-xs font-semibold hover:bg-[#0c3c2e]"
              >
                Xác Nhận Đạt Mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: Thêm Vật Tư Chỉ Định Mới ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0f4c3a] text-white flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Khai Báo Vật Tư Chỉ Định Mới (Spec Item)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Bổ sung vật tư vào danh mục thiết kế và hồ sơ Spec Lock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên vật tư */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Tên vật tư chỉ định <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Gỗ Sồi Trắng Tự Nhiên Bắc Mỹ (White Oak FAS)"
                    value={formItem.name}
                    onChange={(e) => setFormItem({ ...formItem, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Mã Spec */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Mã Spec / Chỉ định <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: SPEC-WD-03"
                    value={formItem.code}
                    onChange={(e) => setFormItem({ ...formItem, code: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Phân loại chủng loại */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Chủng loại vật tư
                  </label>
                  <select
                    value={formItem.category}
                    onChange={(e) => {
                      const cat = e.target.value as MaterialCategory;
                      setFormItem({ ...formItem, category: cat, categoryLabel: getCategoryLabel(cat) });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  >
                    <option value="wood">Gỗ &amp; Bề mặt</option>
                    <option value="stone">Đá &amp; Bề mặt</option>
                    <option value="hardware">Kim khí &amp; Phụ kiện</option>
                    <option value="appliances">Thiết bị bếp</option>
                    <option value="lighting">Chiếu sáng</option>
                    <option value="finishes">Sơn &amp; Hoàn thiện</option>
                  </select>
                </div>

                {/* Thương hiệu */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Thương hiệu / Nhà sản xuất
                  </label>
                  <input
                    type="text"
                    placeholder="VD: An Cường, Vicostone, Hafele, Blum..."
                    value={formItem.brand}
                    onChange={(e) => setFormItem({ ...formItem, brand: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Xuất xứ */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Nguồn gốc / Xuất xứ
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Việt Nam, Hoa Kỳ, CHLB Đức, Ý..."
                    value={formItem.origin}
                    onChange={(e) => setFormItem({ ...formItem, origin: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Khu vực sử dụng */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Khu vực áp dụng
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Bàn ăn, Tủ bếp dưới, Vách ốp Master..."
                    value={formItem.roomArea}
                    onChange={(e) => setFormItem({ ...formItem, roomArea: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Đơn vị tính */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Đơn vị tính (ĐVT)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Tấm, m2, m3, Bộ, Cái, Thùng..."
                    value={formItem.unit}
                    onChange={(e) => setFormItem({ ...formItem, unit: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Tiêu chuẩn kiểm định */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Tiêu chuẩn kỹ thuật / Chứng nhận
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Chuẩn E1 Green Label Singapore, NSF 51 Food Safe, DIN EN 15570..."
                    value={formItem.standard}
                    onChange={(e) => setFormItem({ ...formItem, standard: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Quy cách kỹ thuật chi tiết */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Quy cách chi tiết &amp; Hướng dẫn gia công
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Gỗ thịt sấy đạt độ ẩm 8-12%, phủ sơn PU mờ Inchem cao cấp 70%, vát cạnh bo góc R5..."
                    value={formItem.specDetails}
                    onChange={(e) => setFormItem({ ...formItem, specDetails: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                  />
                </div>

                {/* Checkbox duyệt mẫu */}
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chkSampleApproved"
                    checked={formItem.approvedForUse}
                    onChange={(e) => setFormItem({ ...formItem, approvedForUse: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0f4c3a] focus:ring-[#0f4c3a] border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="chkSampleApproved" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Đã ký duyệt mẫu thực tế trên bảng Sample Board (Khóa Spec ngay)
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveMaterial}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Đang Lưu...' : 'Lưu Vật Tư Vào Bảng Spec'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Nhập Dữ Liệu Từ Excel (Spec Sheet Import) ─── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Nhập Danh Mục Vật Tư Từ Bảng Tính Excel (Spec Sheet)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Hỗ trợ dán trực tiếp từ Microsoft Excel, Google Sheets hoặc file CSV
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Guidance card */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300">
                    Cấu trúc các cột trong bảng tính (theo thứ tự):
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải file mẫu Excel (.csv)</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/60 overflow-x-auto">
                  Mã Spec | Tên vật tư | Thương hiệu | Chủng loại | Xuất xứ | Quy cách kỹ thuật | Khu vực áp dụng
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Bạn có thể quét chọn các ô trong Excel, bấm <strong>Ctrl+C</strong> và dán thẳng (<strong>Ctrl+V</strong>) vào ô bên dưới.
                </p>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Dán nội dung bảng tính sao chép từ Excel:
                </label>
                <textarea
                  rows={8}
                  placeholder={`SPEC-WD-09\tVán Gỗ Plywood Óc Chó 18mm\tAn Cường\tGỗ & Bề mặt\tViệt Nam\tKhổ 1220x2440x18mm CARB P2\tVách ốp phòng khách\nSPEC-ST-05\tĐá Cẩm Thạch Trắng Calacatta\tNhập khẩu Ý\tĐá & Bề mặt\tÝ\tDày 20mm chống thấm\tMặt bàn đảo bếp`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 font-mono text-[11px] focus:ring-2 focus:ring-[#0f4c3a] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting || !importText.trim()}
                onClick={handleImportExcelData}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Đang Nhập Dữ Liệu...' : 'Xác Nhận Nhập Vào Spec Lock'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

