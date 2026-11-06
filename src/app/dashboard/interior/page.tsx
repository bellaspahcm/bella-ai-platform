'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  FileText,
  Wrench,
  Building2,
  ShieldCheck,
  Award,
  LineChart,
  Heart,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FolderKanban,
  Hammer,
} from 'lucide-react';

interface MockProject {
  id: string;
  code: string;
  name: string;
  customerName: string;
  projectType: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  contractValue: number;
  grossMarginPercent: number;
  approvedRevisionNumber: number;
  roomsCount: number;
  leadArchitect: string;
}

const INITIAL_PROJECTS: MockProject[] = [
  {
    id: 'p-1',
    code: 'INT-CIPUTRA-01',
    name: 'Villa Ciputra Giai Đoạn 2',
    customerName: 'Nguyễn Văn A',
    projectType: 'Biệt thự cao cấp',
    status: 'in_production',
    statusLabel: 'Đang sản xuất xưởng',
    statusColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    contractValue: 2450000000,
    grossMarginPercent: 41.5,
    approvedRevisionNumber: 2,
    roomsCount: 6,
    leadArchitect: 'KTS. Hoàng Long',
  },
  {
    id: 'p-2',
    code: 'INT-DUBAI-001',
    name: 'Dubai Luxury Villa Fitout',
    customerName: 'Sheikh Mansoor',
    projectType: 'Dinh thự Palm Jumeirah',
    status: 'installing',
    statusLabel: 'Đang lắp đặt công trình',
    statusColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    contractValue: 3780000000,
    grossMarginPercent: 43.1,
    approvedRevisionNumber: 3,
    roomsCount: 8,
    leadArchitect: 'KTS. Lê Hoàng Sơn',
  },
  {
    id: 'p-3',
    code: 'INT-METROPOLIS-02',
    name: 'Penthouse Metropolis Liễu Giai',
    customerName: 'Trịnh Thăng Bình',
    customerPhone: '0901112222',
    projectType: 'Penthouse 2 tầng',
    status: 'warranty',
    statusLabel: 'Đã bàn giao & Bảo hành',
    statusColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    contractValue: 2200000000,
    grossMarginPercent: 39.8,
    approvedRevisionNumber: 1,
    roomsCount: 5,
    leadArchitect: 'KTS. Phan Hải',
  } as unknown as MockProject,
  {
    id: 'p-4',
    code: 'INT-ECOPARK-03',
    name: 'Duplex Aqua Bay Ecopark',
    customerName: 'Phạm Hồng Nhung',
    projectType: 'Căn hộ Duplex',
    status: 'estimation',
    statusLabel: 'Dự toán BOQ & Báo giá',
    statusColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    contractValue: 850000000,
    grossMarginPercent: 38.5,
    approvedRevisionNumber: 1,
    roomsCount: 4,
    leadArchitect: 'KTS. Minh Châu',
  },
];

export default function InteriorDashboardPage() {
  const [projects] = useState<MockProject[]>(INITIAL_PROJECTS);
  const [activeTab, setActiveTab] = useState<'all' | 'design' | 'production' | 'installing' | 'warranty'>('all');

  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'design') return p.status === 'survey' || p.status === 'estimation';
    if (activeTab === 'production') return p.status === 'in_production';
    if (activeTab === 'installing') return p.status === 'installing';
    if (activeTab === 'warranty') return p.status === 'warranty';
    return true;
  });

  const totalContractValue = projects.reduce((acc, p) => acc + p.contractValue, 0);
  const avgGrossMargin = projects.length > 0
    ? (projects.reduce((acc, p) => acc + p.grossMarginPercent, 0) / projects.length).toFixed(1)
    : '0';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-8 font-sans">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 border border-amber-600/30 flex items-center justify-center text-amber-200 shadow-lg shadow-amber-950/50">
              <Hammer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Bella Interior OS
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  V1.0 Architecture
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Hệ điều hành quản trị toàn diện: Thiết kế • Bóc tách BOQ • Sản xuất xưởng • Thi công &amp; Bàn giao
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior/design"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors shadow-sm"
          >
            <Layers className="h-4 w-4 text-amber-400" />
            Studio Thiết kế
          </Link>
          <Link
            href="/dashboard/interior/production"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-950/40 transition-all"
          >
            <Plus className="h-4 w-4" />
            Lệnh sản xuất xưởng
          </Link>
        </div>
      </div>

      {/* 4 Core Invariant KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">Tổng giá trị hợp đồng</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{formatCurrency(totalContractValue)}</div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">4 dự án</span> đang triển khai thực tế
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">Biên lợi nhuận gộp TB</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <LineChart className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">{avgGrossMargin}%</div>
          <p className="text-xs text-slate-400 mt-2">
            Chênh lệch rạch ròi: Giá vốn vs Giá bán vs Giá HĐ
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">Approved Design Lock</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-300 tracking-tight">100% Khóa bản vẽ</div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
            Tuyệt đối không chạy xưởng bản vẽ cũ
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">Kiểm định Punch List</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-300 tracking-tight">0 lỗi chí mạng</div>
          <p className="text-xs text-slate-400 mt-2">
            Điều kiện tiên quyết trước khi ký bàn giao
          </p>
        </div>
      </div>

      {/* 4 Bounded Contexts Navigation Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900/80 border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-amber-500" />
            4 Bounded Contexts Nghiệp Vụ Chuỗi Giá Trị Nội Thất
          </h2>
          <span className="text-xs text-slate-500">Platform Reuse – Domain Ownership</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <Link
            href="/dashboard/interior/design"
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-amber-600/40 hover:bg-slate-950 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-200 group-hover:text-amber-400 transition-colors">
                  1. Design &amp; Specification
                </div>
                <div className="text-xs text-slate-400 mt-0.5">3D Render, Bản vẽ 2D, Bảng vật liệu, Version Lock</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/interior/boq"
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-blue-600/40 hover:bg-slate-950 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-200 group-hover:text-blue-400 transition-colors">
                  2. Commercial &amp; Costing
                </div>
                <div className="text-xs text-slate-400 mt-0.5">BOQ cấu kiện, Giá vốn COGS, Hợp đồng 5 mốc</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/interior/production"
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-amber-600/40 hover:bg-slate-950 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-200 group-hover:text-amber-400 transition-colors">
                  3. Manufacturing &amp; Install
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Cắt CNC, Dán cạnh, Lắp ráp, Đóng gói, Lắp đặt phòng</div>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/interior/qc-handover"
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-emerald-600/40 hover:bg-slate-950 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-200 group-hover:text-emerald-400 transition-colors">
                  4. Delivery &amp; Aftercare
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Site Diary, Punch List lỗi, Bàn giao &amp; Bảo hành gỗ/phụ kiện</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Projects Table & Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Danh Sách Công Trình &amp; Dự Án Nội Thất</h3>
            <p className="text-xs text-slate-400">Theo dõi tiến độ từ giai đoạn chốt phương án đến nghiệm thu bảo hành</p>
          </div>

          <div className="flex items-center gap-2 border border-slate-800 p-1 rounded-xl bg-slate-900/60 text-xs">
            {(['all', 'design', 'production', 'installing', 'warranty'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-amber-600/90 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' && 'Tất cả'}
                {tab === 'design' && 'Thiết kế / BOQ'}
                {tab === 'production' && 'Xưởng sản xuất'}
                {tab === 'installing' && 'Lắp đặt'}
                {tab === 'warranty' && 'Bảo hành'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Mã &amp; Tên Công Trình</th>
                  <th className="py-3.5 px-4">Khách Hàng / Loại</th>
                  <th className="py-3.5 px-4">Trạng Thái Vận Hành</th>
                  <th className="py-3.5 px-4">Approved Version</th>
                  <th className="py-3.5 px-4">Giá Trị Hợp Đồng</th>
                  <th className="py-3.5 px-4">Lợi Nhuận Gộp</th>
                  <th className="py-3.5 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-4 font-medium text-white">
                      <div className="font-semibold text-slate-100">{p.name}</div>
                      <div className="text-xs text-amber-500/90 font-mono mt-0.5">{p.code}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-200 font-medium">{p.customerName}</div>
                      <div className="text-xs text-slate-400">{p.projectType}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${p.statusColor}`}>
                        {p.statusLabel}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-xs font-mono text-amber-300 border border-slate-700">
                        <CheckCircle2 className="h-3 w-3 text-amber-400" />
                        Rev #{p.approvedRevisionNumber} Lock
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.roomsCount} khu vực/phòng</div>
                    </td>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-100">
                      {formatCurrency(p.contractValue)}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-emerald-400 font-semibold font-mono">
                        {p.grossMarginPercent}%
                      </span>
                      <div className="text-[11px] text-slate-400">P&amp;L dự toán</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/dashboard/interior/design?projectId=${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:underline"
                      >
                        Mở hồ sơ <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

