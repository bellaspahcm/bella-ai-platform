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

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Lock,
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
    imageUrl: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
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
    imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    unit: 'Thùng 18L',
    standard: 'Green Label Singapore, hàm lượng VOC siêu thấp',
    origin: 'AkzoNobel Việt Nam',
    approvedDate: '06/11/2026',
    approvedBy: 'KTS. Hoàng Long & Trần Thị Mai',
    sampleStatus: 'Đã test thẻ màu mẫu thực tế trên tường mẫu',
  },
];

export default function InteriorMaterialsPage() {
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'cards' | 'table'>('cards');
  const [activeModalItem, setActiveModalItem] = useState<MaterialItem | null>(null);

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
    return INITIAL_MATERIALS.filter((mat) => {
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
  }, [selectedCategory, searchQuery]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* ─── Breadcrumb & Context Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <Link href="/dashboard/interior/projects" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Dự án
            </Link>
            <span>&rsaquo;</span>
            <span className="text-slate-900 dark:text-white font-bold">
              Villa Sunrise Renovation (INT-2024-001)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Bảng Chỉ Định Vật Liệu &amp; Mẫu Thực Tế (Spec Lock)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
              Đang thực hiện
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Spec Lock R1.0 Active</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveView(activeView === 'cards' ? 'table' : 'cards')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeView === 'cards' ? 'Xem Dạng Bảng' : 'Xem Dạng Thẻ Mẫu'}</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f4c3a] hover:bg-[#0c3c2e] text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Bảng Spec Kỹ Thuật (PDF)</span>
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
              Toàn bộ 28 hạng mục vật liệu chính đã được KTS trưởng và Chủ đầu tư ký duyệt mẫu thực tế vào ngày 06/11/2026. Mọi thay đổi chủng loại vật tư đều phải thông qua thủ tục Addendum hợp đồng.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">Người duyệt mẫu</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">Trần Thị Mai &amp; Hoàng Long</span>
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
            <span className="text-2xl font-black text-slate-900 dark:text-white">28</span>
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
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">28 / 28</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">Lưu trữ tại phòng Sample Board xưởng</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Nguồn Cung Nội Địa
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">75%</span>
            <span className="text-xs font-semibold text-slate-500">21 danh mục</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">An Cường, Vicostone, Dulux</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Hàng Nhập Khẩu Chỉ Định
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">25%</span>
            <span className="text-xs font-semibold text-slate-500">7 danh mục</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1.5">Gỗ Óc Chó FAS, Hafele, Blum, Bosch</span>
        </div>
      </div>

      {/* ─── Search & Category Filters Bar ─── */}
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
            Hiển thị <strong>{filteredMaterials.length}</strong> / {INITIAL_MATERIALS.length} vật tư
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

                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
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
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Mã Spec</th>
                  <th className="py-3 px-4">Tên Vật Liệu</th>
                  <th className="py-3 px-4">Thương Hiệu / Xuất Xứ</th>
                  <th className="py-3 px-4">Quy Cách Kỹ Thuật</th>
                  <th className="py-3 px-4">Khu Vực Ứng Dụng</th>
                  <th className="py-3 px-4">Trạng Thái Spec</th>
                  <th className="py-3 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {mat.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{mat.name}</div>
                      <div className="text-[11px] text-slate-400">{mat.categoryLabel}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{mat.brand}</span>
                      <div className="text-[11px] text-slate-400">{mat.origin}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-[11px] text-slate-600 dark:text-slate-400">
                      {mat.specDetails}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {mat.roomArea}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${mat.statusBadgeClass}`}>
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
    </div>
  );
}

