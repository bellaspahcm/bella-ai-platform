/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
  Wrench,
  Award,
  Wallet,
  Zap,
  Activity,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  X,
  FileText,
  ClipboardList,
  Check,
  ChevronDown,
} from 'lucide-react';

interface MockProject {
  id: string;
  code: string;
  name: string;
  customerName: string;
  projectType: string;
  status: 'design' | 'production' | 'installation' | 'handover';
  statusLabel: string;
  statusColor: string;
  contractValue: number;
  grossMarginPercent: number;
  approvedRevisionNumber: number;
  leadArchitect: string;
  progressPercent: number;
  nextAction: string;
  imageUrl: string;
  architectAvatar: string;
  roomsCount: number;
}

const INITIAL_PROJECTS: MockProject[] = [
  {
    id: 'proj-001',
    code: 'INT-CIPUTRA-01',
    name: 'Villa Ciputra Giai Đoạn 2',
    customerName: 'Nguyễn Văn A',
    projectType: 'Biệt thự cao cấp · Ciputra Group',
    status: 'production',
    statusLabel: 'Sản xuất',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40',
    contractValue: 2450000000,
    grossMarginPercent: 41.5,
    approvedRevisionNumber: 2,
    leadArchitect: 'KTS. Hoàng Long',
    progressPercent: 65,
    nextAction: 'Hoàn thiện sản xuất',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    architectAvatar: 'L',
    roomsCount: 6,
  },
  {
    id: 'proj-002',
    code: 'INT-DUBAI-001',
    name: 'Dubai Luxury Villa Fitout',
    customerName: 'Sheikh Mansoor',
    projectType: 'Dinh thự Palm Jumeirah · Dubai Group',
    status: 'installation',
    statusLabel: 'Lắp đặt',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/40',
    contractValue: 3780000000,
    grossMarginPercent: 43.1,
    approvedRevisionNumber: 3,
    leadArchitect: 'KTS. Lê Hoàng Sơn',
    progressPercent: 82,
    nextAction: 'Thi công phòng khách',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
    architectAvatar: 'S',
    roomsCount: 8,
  },
  {
    id: 'proj-003',
    code: 'INT-METROPOLIS-02',
    name: 'Penthouse Metropolis Liễu Giai',
    customerName: 'Trịnh Thăng Bình',
    projectType: 'Penthouse 2 tầng · Metropolis JSC',
    status: 'design',
    statusLabel: 'Thiết kế',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/40',
    contractValue: 2200000000,
    grossMarginPercent: 39.8,
    approvedRevisionNumber: 1,
    leadArchitect: 'KTS. Phan Hải',
    progressPercent: 30,
    nextAction: 'Duyệt bản vẽ',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/skyline-residence.jpg',
    architectAvatar: 'H',
    roomsCount: 5,
  },
  {
    id: 'proj-004',
    code: 'INT-ECOPARK-03',
    name: 'Duplex Aqua Bay Ecopark',
    customerName: 'Phạm Hồng Nhung',
    projectType: 'Căn hộ Duplex cao cấp',
    status: 'handover',
    statusLabel: 'Đã bàn giao',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40',
    contractValue: 850000000,
    grossMarginPercent: 38.5,
    approvedRevisionNumber: 1,
    leadArchitect: 'KTS. Hoàng Long',
    progressPercent: 100,
    nextAction: 'Kích hoạt bảo hành',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
    architectAvatar: 'L',
    roomsCount: 3,
  },
];

interface UrgentItem {
  id: string;
  tag: string;
  tagClass: string;
  projectName: string;
  taskTitle: string;
  dueTime: string;
  timeClass: string;
  imageUrl: string;
  actionHref: string;
}

const URGENT_ITEMS: UrgentItem[] = [
  {
    id: 'u-1',
    tag: 'Khẩn cấp',
    tagClass: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
    projectName: 'Villa Ciputra',
    taskTitle: 'Thiếu duyệt bản vẽ',
    dueTime: 'Hôm nay',
    timeClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    actionHref: '/dashboard/interior/design',
  },
  {
    id: 'u-2',
    tag: 'Sắp đến hạn',
    tagClass: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    projectName: 'Dubai Luxury Villa',
    taskTitle: 'Kiểm tra tiến độ xưởng',
    dueTime: '2 ngày',
    timeClass: 'text-amber-700 dark:text-amber-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
    actionHref: '/dashboard/interior/production',
  },
  {
    id: 'u-3',
    tag: 'Chờ duyệt',
    tagClass: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
    projectName: 'Penthouse Metropolis',
    taskTitle: 'Biên bản nghiệm thu',
    dueTime: '3 ngày',
    timeClass: 'text-blue-600 dark:text-blue-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/skyline-residence.jpg',
    actionHref: '/dashboard/interior/qc-handover',
  },
];

export default function InteriorDashboardPage() {
  const [projects, setProjects] = useState<MockProject[]>(INITIAL_PROJECTS);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedWorkspaceProject, setSelectedWorkspaceProject] = useState<MockProject | null>(null);

  useEffect(() => {
    // Canonical read through API endpoint without direct DB access
    fetch('/api/interior/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.projects && Array.isArray(data.data.projects) && data.data.projects.length > 0) {
          const merged: MockProject[] = data.data.projects.map((p: {
            id: string;
            code: string;
            name: string;
            clientName: string;
            status: string;
            contractValue: number;
          }, idx: number) => {
            const fallback =
              INITIAL_PROJECTS.find((df) => df.id === p.id || df.code === p.code) ||
              INITIAL_PROJECTS[idx % INITIAL_PROJECTS.length];
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

  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'design') return p.status === 'design';
    if (activeTab === 'production') return p.status === 'production';
    if (activeTab === 'installation') return p.status === 'installation';
    if (activeTab === 'handover') return p.status === 'handover';
    return true;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── 01. VIEWPORT HERO BANNER ─────────────────────────────────── */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-[#0F2744] to-[#1B365D] text-white p-6 sm:p-8 shadow-sm overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Ambient background decoration */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-32 bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold tracking-wide text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Hệ điều hành Nội thất Doanh nghiệp
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Chào buổi sáng, Mai!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Theo dõi toàn bộ dự án thiết kế và thi công nội thất theo thời gian thực.
          </p>
        </div>

        {/* Hero living room viewport image matching demo */}
        <div className="relative z-10 w-full md:w-80 lg:w-96 flex-shrink-0 rounded-2xl overflow-hidden shadow-lg border border-white/20 group">
          <img
            src={'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg'}
            alt="Bella Interior Living Room"
            className="w-full h-36 sm:h-40 object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
            <p className="text-[11px] font-semibold text-white/90 truncate">
              Không gian sống tiêu chuẩn · Penthouse Metropolis
            </p>
          </div>
        </div>
      </div>

      {/* ─── 02. 4 EXECUTIVE KPI CARDS WITH SPARKLINES ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng dự án đang chạy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FolderKanban className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40">
              Đang triển khai
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tổng dự án đang chạy
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                12
              </span>
              {/* Sparkline Blue SVG */}
              <svg className="w-24 h-8 text-blue-500" viewBox="0 0 100 30" fill="none">
                <path
                  d="M0 25 Q 25 20, 45 22 T 80 8 T 100 4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +1 so với tháng trước
            </p>
          </div>
        </div>

        {/* Card 2: Giá trị hợp đồng */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40">
              Theo hợp đồng
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Giá trị hợp đồng
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                9,28 tỷ
              </span>
              {/* Sparkline Amber SVG */}
              <svg className="w-24 h-8 text-amber-500" viewBox="0 0 100 30" fill="none">
                <path
                  d="M0 28 Q 20 25, 40 18 T 75 14 T 100 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +12% so với tháng trước
            </p>
          </div>
        </div>

        {/* Card 3: Dự án có nguy cơ trễ */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/40">
              Cần xử lý
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Dự án có nguy cơ trễ
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                2
              </span>
              {/* Sparkline Rose SVG */}
              <svg className="w-24 h-8 text-rose-500" viewBox="0 0 100 30" fill="none">
                <path
                  d="M0 8 Q 30 10, 50 18 T 80 22 T 100 26"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              -1 so với tuần trước
            </p>
          </div>
        </div>

        {/* Card 4: Công việc chờ duyệt */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/40">
              Chờ phê duyệt
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Công việc chờ duyệt
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                5
              </span>
              {/* Sparkline Purple SVG */}
              <svg className="w-24 h-8 text-purple-500" viewBox="0 0 100 30" fill="none">
                <path
                  d="M0 22 Q 25 24, 45 16 T 75 14 T 100 10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Đang chờ PM ký duyệt
            </p>
          </div>
        </div>
      </div>

      {/* ─── 03. MIDDLE TWO-COLUMN GRID: VIỆC CẦN XỬ LÝ & TIẾN ĐỘ CHUỖI ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Việc cần xử lý */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Việc cần xử lý
              </h2>
            </div>
            <Link
              href="/dashboard/interior/schedule"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {URGENT_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.actionHref}
                className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.imageUrl}
                    alt={item.projectName}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.tagClass}`}>
                        {item.tag}
                      </span>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.projectName}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.taskTitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-right">
                  <span className={`text-xs ${item.timeClass}`}>
                    {item.dueTime}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Card: Tiến độ chuỗi nghiệp vụ */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tiến độ chuỗi nghiệp vụ
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Tháng này ▾
            </span>
          </div>

          {/* Stepper with 4 Steps */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              { label: 'Thiết kế', pct: 92, icon: Layers, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400' },
              { label: 'Thương mại', pct: 85, icon: FileText, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400' },
              { label: 'Sản xuất', pct: 70, icon: Wrench, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400' },
              { label: 'Bàn giao', pct: 45, icon: Award, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400' },
            ].map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div key={step.label} className="text-center space-y-2">
                  <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-2xs ${step.color}`}>
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {step.label}
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {step.pct}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall progress block */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300">Tiến độ tổng thể dự án</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                Đúng tiến độ · 65%
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-[#1B365D] dark:to-blue-400 rounded-full transition-all duration-500"
                style={{ width: '65%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 04. DANH SÁCH DỰ ÁN (PROJECT LIST TABLE) ────────────────── */}
      <div id="projects" className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Danh sách dự án
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Theo dõi tiến độ từ giai đoạn chốt phương án đến nghiệm thu bảo hành
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stage filter pills */}
            <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'design', label: 'Thiết kế' },
                { id: 'production', label: 'Xưởng sản xuất' },
                { id: 'installation', label: 'Lắp đặt' },
                { id: 'handover', label: 'Bảo hành' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Link
              href="/dashboard/interior/projects"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors px-2"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-y border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Dự án</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Phụ trách</th>
                <th className="py-3 px-4">Giai đoạn</th>
                <th className="py-3 px-4">Tiến độ</th>
                <th className="py-3 px-4">Bản vẽ</th>
                <th className="py-3 px-4">Giá trị HĐ</th>
                <th className="py-3 px-4">Biên lợi nhuận</th>
                <th className="py-3 px-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  onClick={() => setSelectedWorkspaceProject(project)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={project.imageUrl}
                        alt={project.name}
                        className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                          {project.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {project.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{project.customerName}</p>
                    <p className="text-[11px] text-slate-400">{project.projectType}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center">
                        {project.architectAvatar}
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {project.leadArchitect}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${project.statusColor}`}>
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
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Rev #{project.approvedRevisionNumber} Lock
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(project.contractValue)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                    {project.grossMarginPercent}%
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorkspaceProject(project);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
                    >
                      Mở hồ sơ <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 05. TÀI CHÍNH & CẢNH BÁO + BANNER PROMO ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Tài chính & cảnh báo */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Wallet className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tài chính &amp; Cảnh báo
              </h2>
            </div>
            <Link
              href="/dashboard/interior/finance"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              Xem chi tiết <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {/* Metric 1 */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Công nợ đến hạn</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">1,25 tỷ</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  ↑ 2 khoản sắp đến hạn (+200tr)
                </p>
              </div>
              {/* Sparkline */}
              <svg className="w-20 h-6 text-amber-500" viewBox="0 0 100 30" fill="none">
                <path d="M0 20 Q 30 25, 50 15 T 80 10 T 100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chi phí vượt dự toán</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">180 triệu</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  ↑ +10% so với dự toán BOQ
                </p>
              </div>
              {/* Sparkline */}
              <svg className="w-20 h-6 text-rose-500" viewBox="0 0 100 30" fill="none">
                <path d="M0 10 Q 30 15, 60 18 T 100 25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Biên lợi nhuận dự kiến</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">38.5%</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  ↑ +1.2% tối ưu hao hụt ván xưởng
                </p>
              </div>
              {/* Sparkline */}
              <svg className="w-20 h-6 text-emerald-500" viewBox="0 0 100 30" fill="none">
                <path d="M0 25 Q 30 20, 60 10 T 100 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Card: Banner Promo Bella Interior OS */}
        <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800 min-h-[260px] flex flex-col justify-end p-6 sm:p-8 group">
          <img
            src={'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg'}
            alt="Bella Interior OS Promo"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

          <div className="relative z-10 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Kiến trúc &amp; Nội thất Đẳng cấp
            </span>
            <h3 className="text-2xl font-black text-white leading-tight">
              Bella Interior OS
            </h3>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Kiến tạo không gian sống đẳng cấp với chuỗi giá trị khép kín từ bản vẽ thiết kế đến hoàn thiện thực tế tại công trình.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/interior/design"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Khám phá hệ thống <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 06. PROJECT WORKSPACE DRAWER (SECTION 5 REQUIREMENT) ────────── */}
      {selectedWorkspaceProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity">
          <div
            className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <img
                  src={selectedWorkspaceProject.imageUrl}
                  alt={selectedWorkspaceProject.name}
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {selectedWorkspaceProject.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedWorkspaceProject.code} · {selectedWorkspaceProject.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkspaceProject(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body - Project Workspace Sections */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 font-medium">Giá trị HĐ</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(selectedWorkspaceProject.contractValue)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 font-medium">Lợi nhuận gộp</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedWorkspaceProject.grossMarginPercent}%
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 font-medium">Bản vẽ Lock</span>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    Rev #{selectedWorkspaceProject.approvedRevisionNumber}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 font-medium">Số khu vực</span>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedWorkspaceProject.roomsCount} phòng
                  </p>
                </div>
              </div>

              {/* Workspace Modules Breakdown */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Không gian làm việc theo chuỗi nghiệp vụ
                </p>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {/* Module 1: Design */}
                  <Link
                    href="/dashboard/interior/design"
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Thiết kế &amp; Bản vẽ Revision Lock</p>
                        <p className="text-xs text-slate-500">3D Render, bản vẽ 2D kỹ thuật, bảng chỉ định vật liệu</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>

                  {/* Module 2: BOQ */}
                  <Link
                    href="/dashboard/interior/boq"
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">BOQ &amp; Dự toán 3 bên</p>
                        <p className="text-xs text-slate-500">Bóc tách khối lượng, vật tư phụ kiện, giá vốn COGS vs giá bán</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>

                  {/* Module 3: Production */}
                  <Link
                    href="/dashboard/interior/production"
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Lệnh sản xuất xưởng</p>
                        <p className="text-xs text-slate-500">Cắt ván CNC, dán cạnh, ráp phụ kiện Blum/Hafele, đóng gói</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>

                  {/* Module 4: QC & Handover */}
                  <Link
                    href="/dashboard/interior/qc-handover"
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">QC, Punch List &amp; Bàn giao</p>
                        <p className="text-xs text-slate-500">Kiểm định không lỗi chí mạng, ký bàn giao và kích hoạt bảo hành</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Phụ trách: <strong className="text-slate-800 dark:text-slate-200">{selectedWorkspaceProject.leadArchitect}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/interior/projects/${selectedWorkspaceProject.id}`}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                >
                  Chi tiết dự án <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedWorkspaceProject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
