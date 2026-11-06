'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, ArrowLeft, Search, Filter, ShieldCheck, CheckCircle2, Clock, ArrowRight, Layers, Building2, Wrench, Award } from 'lucide-react';

interface ProjectItem {
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
  leadArchitect: string;
  progressPercent: number;
  nextAction: string;
  imageUrl: string;
}

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'p-1',
    code: 'INT-CIPUTRA-01',
    name: 'Villa Ciputra Giai Đoạn 2',
    customerName: 'Nguyễn Văn A',
    projectType: 'Biệt thự cao cấp',
    status: 'production',
    statusLabel: 'Sản xuất',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40',
    contractValue: 2450000000,
    grossMarginPercent: 41.5,
    approvedRevisionNumber: 2,
    leadArchitect: 'KTS. Hoàng Long',
    progressPercent: 65,
    nextAction: 'Hoàn thiện sản xuất',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'p-2',
    code: 'INT-DUBAI-001',
    name: 'Dubai Luxury Villa Fitout',
    customerName: 'Sheikh Mansoor',
    projectType: 'Dinh thự Palm Jumeirah',
    status: 'installation',
    statusLabel: 'Lắp đặt',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/40',
    contractValue: 3780000000,
    grossMarginPercent: 43.1,
    approvedRevisionNumber: 3,
    leadArchitect: 'KTS. Lê Hoàng Sơn',
    progressPercent: 82,
    nextAction: 'Thi công phòng khách',
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'p-3',
    code: 'INT-METROPOLIS-02',
    name: 'Penthouse Metropolis Liễu Giai',
    customerName: 'Trịnh Thăng Bình',
    projectType: 'Penthouse 2 tầng',
    status: 'handover',
    statusLabel: 'Bàn giao & Bảo hành',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40',
    contractValue: 2200000000,
    grossMarginPercent: 39.8,
    approvedRevisionNumber: 1,
    leadArchitect: 'KTS. Phan Hải',
    progressPercent: 100,
    nextAction: 'Nghiệm thu hồ sơ',
    imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'p-4',
    code: 'INT-ECOPARK-03',
    name: 'Duplex Aqua Bay Ecopark',
    customerName: 'Phạm Hồng Nhung',
    projectType: 'Căn hộ Duplex',
    status: 'design',
    statusLabel: 'Thiết kế',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/40',
    contractValue: 850000000,
    grossMarginPercent: 38.5,
    approvedRevisionNumber: 1,
    leadArchitect: 'KTS. Hoàng Long',
    progressPercent: 30,
    nextAction: 'Duyệt bản vẽ',
    imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=300&q=80',
  },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>(DEFAULT_PROJECTS);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    // Canonical read through API endpoint without direct DB access
    fetch('/api/interior/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.projects && Array.isArray(data.data.projects) && data.data.projects.length > 0) {
          // Merge with UI presentation fields
          const merged: ProjectItem[] = data.data.projects.map((p: {
            id: string;
            code: string;
            name: string;
            clientName: string;
            status: string;
            contractValue: number;
          }, idx: number) => {
            const fallback = DEFAULT_PROJECTS[idx % DEFAULT_PROJECTS.length];
            return {
              ...fallback,
              id: p.id || fallback.id,
              code: p.code || fallback.code,
              name: p.name || fallback.name,
              customerName: p.clientName || fallback.customerName,
              contractValue: p.contractValue || fallback.contractValue,
            };
          });
          setProjects(merged);
        }
      })
      .catch(() => {
        // Safe fallback maintains uninterrupted UI
      });
  }, []);

  const filtered = projects.filter((p) => {
    const matchesFilter = filterStage === 'all' || p.status === filterStage;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-amber-600" />
            Danh mục Dự án Nội thất
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị chuỗi giá trị toàn diện từ Thiết kế, BOQ, Sản xuất xưởng đến Thi công &amp; Bàn giao
          </p>
        </div>
        <Link
          href="/dashboard/interior/design"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo dự án mới
        </Link>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'design', label: 'Thiết kế' },
            { id: 'production', label: 'Xưởng sản xuất' },
            { id: 'installation', label: 'Lắp đặt' },
            { id: 'handover', label: 'Bàn giao' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStage(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterStage === tab.id
                  ? 'bg-[#1B365D] text-white shadow-2xs dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên, mã, khách hàng..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Dự án</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Phụ trách</th>
                <th className="py-3 px-4">Giai đoạn</th>
                <th className="py-3 px-4">Tiến độ</th>
                <th className="py-3 px-4">Bản vẽ</th>
                <th className="py-3 px-4">Giá trị HĐ</th>
                <th className="py-3 px-4">Biên lợi nhuận</th>
                <th className="py-3 px-4">Công việc tiếp theo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filtered.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      <img
                        src={project.imageUrl}
                        alt={project.name}
                        className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {project.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {project.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{project.customerName}</p>
                    <p className="text-[11px] text-slate-400">{project.projectType}</p>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                    {project.leadArchitect}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${project.statusColor}`}>
                      ● {project.statusLabel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-1 w-24">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span>{project.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Rev #{project.approvedRevisionNumber}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(project.contractValue)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                    {project.grossMarginPercent}%
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {project.nextAction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

