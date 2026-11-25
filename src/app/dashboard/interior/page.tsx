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

import type {
  BusinessChainPeriodKey,
  BusinessChainProgressOverview,
  BusinessChainPeriodData,
  PortfolioOverviewResponse,
} from '@/products/bella-interior/domain/portfolio-overview.types';
import { useUser } from '@/lib/user-context';
import InteriorUserBar from '@/components/interior/InteriorUserBar';

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
    id: 'INT-2024-001',
    code: 'INT-2024-001',
    name: 'Villa Sunrise Renovation',
    customerName: 'Ahmad Santoso',
    projectType: 'Biệt thự cao cấp · SunCasa Group',
    status: 'production',
    statusLabel: 'Sản xuất',
    statusColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40',
    contractValue: 1680000000,
    grossMarginPercent: 25.6,
    approvedRevisionNumber: 2,
    leadArchitect: 'KTS. Hoàng Long',
    progressPercent: 65,
    nextAction: 'Khóa hợp đồng từ BOQ',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    architectAvatar: 'L',
    roomsCount: 6,
  },
  {
    id: 'INT-2024-002',
    code: 'INT-2024-002',
    name: 'Dubai Luxury Villa Fitout',
    customerName: 'Sheikh Mansoor',
    projectType: 'Dinh thự Palm Jumeirah · Dubai Group',
    status: 'installation',
    statusLabel: 'Lắp đặt',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/40',
    contractValue: 418000000,
    grossMarginPercent: 25.8,
    approvedRevisionNumber: 3,
    leadArchitect: 'KTS. Lê Hoàng Sơn',
    progressPercent: 82,
    nextAction: 'Lắp đặt phòng khách',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
    architectAvatar: 'S',
    roomsCount: 8,
  },
  {
    id: 'INT-THD-2026',
    code: 'INT-THD-2026',
    name: 'Villa Riverside Thảo Điền - Fitout Trọn Gói',
    customerName: 'Trần Minh Quân',
    projectType: 'Biệt thự ven sông cao cấp · Thảo Điền Q2',
    status: 'production',
    statusLabel: 'Đã duyệt HĐ',
    statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/40',
    contractValue: 1350000000,
    grossMarginPercent: 44.4,
    approvedRevisionNumber: 1,
    leadArchitect: 'KTS. Lê Hoàng Sơn',
    progressPercent: 50,
    nextAction: 'Gia công xuất xưởng Đợt 3',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    architectAvatar: 'S',
    roomsCount: 6,
  },
  {
    id: 'INT-2024-003',
    code: 'INT-2024-003',
    name: 'Penthouse Metropolis Liễu Giai',
    customerName: 'Trịnh Thăng Bình',
    projectType: 'Penthouse 2 tầng · Metropolis JSC',
    status: 'design',
    statusLabel: 'Thiết kế',
    statusColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/40',
    contractValue: 780000000,
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
    id: 'INT-2024-004',
    code: 'INT-2024-004',
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
  projectId: string;
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
    projectId: 'INT-2024-001',
    tag: 'Khẩn cấp',
    tagClass: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
    projectName: 'Villa Sunrise Renovation',
    taskTitle: 'Thiếu duyệt bản vẽ',
    dueTime: 'Hôm nay',
    timeClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
    actionHref: '/dashboard/interior/projects/INT-2024-001',
  },
  {
    id: 'u-2',
    projectId: 'INT-2024-002',
    tag: 'Sắp đến hạn',
    tagClass: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    projectName: 'Dubai Luxury Villa Fitout',
    taskTitle: 'Kiểm tra tiến độ xưởng',
    dueTime: '2 ngày',
    timeClass: 'text-amber-700 dark:text-amber-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
    actionHref: '/dashboard/interior/projects/INT-2024-002',
  },
  {
    id: 'u-3',
    projectId: 'INT-2024-003',
    tag: 'Chờ duyệt',
    tagClass: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
    projectName: 'Penthouse Metropolis Liễu Giai',
    taskTitle: 'Biên bản nghiệm thu',
    dueTime: '3 ngày',
    timeClass: 'text-blue-600 dark:text-blue-400 font-semibold',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/skyline-residence.jpg',
    actionHref: '/dashboard/interior/projects/INT-2024-003',
  },
];

const DEFAULT_BUSINESS_CHAIN_PROGRESS: BusinessChainProgressOverview = {
  defaultPeriod: 'this_month',
  periods: {
    this_month: {
      periodKey: 'this_month',
      periodLabel: 'Tháng này',
      stages: [
        { key: 'design', label: 'Thiết kế', percent: 92 },
        { key: 'commercial', label: 'Thương mại', percent: 85 },
        { key: 'production', label: 'Sản xuất', percent: 70 },
        { key: 'handover', label: 'Bàn giao', percent: 45 },
      ],
      overallPercent: 65,
      statusLabel: 'Đúng tiến độ',
    },
    last_month: {
      periodKey: 'last_month',
      periodLabel: 'Tháng trước',
      stages: [
        { key: 'design', label: 'Thiết kế', percent: 88 },
        { key: 'commercial', label: 'Thương mại', percent: 80 },
        { key: 'production', label: 'Sản xuất', percent: 62 },
        { key: 'handover', label: 'Bàn giao', percent: 38 },
      ],
      overallPercent: 58,
      statusLabel: 'Đúng tiến độ',
    },
    this_quarter: {
      periodKey: 'this_quarter',
      periodLabel: 'Quý này (Q4)',
      stages: [
        { key: 'design', label: 'Thiết kế', percent: 94 },
        { key: 'commercial', label: 'Thương mại', percent: 89 },
        { key: 'production', label: 'Sản xuất', percent: 75 },
        { key: 'handover', label: 'Bàn giao', percent: 52 },
      ],
      overallPercent: 72,
      statusLabel: 'Vượt tiến độ +3%',
    },
    all: {
      periodKey: 'all',
      periodLabel: 'Toàn bộ thời gian',
      stages: [
        { key: 'design', label: 'Thiết kế', percent: 90 },
        { key: 'commercial', label: 'Thương mại', percent: 84 },
        { key: 'production', label: 'Sản xuất', percent: 68 },
        { key: 'handover', label: 'Bàn giao', percent: 48 },
      ],
      overallPercent: 66,
      statusLabel: 'Đúng tiến độ',
    },
  },
};

export default function InteriorDashboardPage() {
  const userContext = useUser();
  const userName = userContext?.user?.full_name
    ? userContext.user.full_name.split(' ').slice(-1)[0]
    : 'bạn';

  const [projects, setProjects] = useState<MockProject[]>(INITIAL_PROJECTS);
  const [portfolioData, setPortfolioData] = useState<PortfolioOverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [projectPage, setProjectPage] = useState<number>(1);
  const PROJECT_PAGE_SIZE = 8;
  const [selectedWorkspaceProject, setSelectedWorkspaceProject] = useState<MockProject | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<BusinessChainPeriodKey>('this_month');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [businessChainOverview, setBusinessChainOverview] = useState<BusinessChainProgressOverview>(DEFAULT_BUSINESS_CHAIN_PROGRESS);

  useEffect(() => {
    // Canonical real-time read through Portfolio Analytics endpoint
    fetch('/api/interior/portfolio/analytics')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          const overview: PortfolioOverviewResponse = json.data;
          setPortfolioData(overview);

          if (overview.projects && Array.isArray(overview.projects) && overview.projects.length > 0) {
            const mapped: MockProject[] = overview.projects.map((p, idx) => ({
              id: p.id || `proj-${idx + 1}`,
              code: p.code || `INT-${idx + 1}`,
              name: p.name,
              customerName: p.customerName,
              projectType: p.customerSegment || 'Nội thất cao cấp',
              status: (p.stage as MockProject['status']) || 'design',
              statusLabel: p.stageLabel,
              statusColor: p.stageBadgeClass || 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/40',
              contractValue: p.contractValue,
              grossMarginPercent: p.grossMarginPercent || 0,
              approvedRevisionNumber: 1,
              leadArchitect: p.leadArchitect,
              progressPercent: p.progressPercent,
              nextAction: p.nextAction,
              imageUrl: p.imageUrl || 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
              architectAvatar: p.leadArchitect.slice(0, 1) || 'A',
              roomsCount: 4,
            }));
            setProjects(mapped);
          }

          if (overview.businessChainProgress) {
            setBusinessChainOverview(overview.businessChainProgress);
          }
        } else {
          // Fallback to /api/interior/projects
          fetch('/api/interior/projects')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.data?.projects && Array.isArray(data.data.projects) && data.data.projects.length > 0) {
                const merged: MockProject[] = data.data.projects.map((p: Record<string, unknown>, idx: number) => {
                  const pId = typeof p.id === 'string' ? p.id : '';
                  const pCode = typeof p.code === 'string' ? p.code : '';
                  const pName = typeof p.name === 'string' ? p.name : '';
                  const pCustomer = typeof p.customerName === 'string' ? p.customerName : typeof p.clientName === 'string' ? p.clientName : '';
                  const pBudget = typeof p.estimatedBudget === 'number' ? p.estimatedBudget : Number(p.estimatedBudget) || (typeof p.contractValue === 'number' ? p.contractValue : 0);
                  const pArch = typeof p.leadArchitectName === 'string' ? p.leadArchitectName : typeof p.leadArchitect === 'string' ? p.leadArchitect : '';
                  const pStatus = typeof p.status === 'string' ? p.status : 'design';

                  const fallback = INITIAL_PROJECTS.find((df) => df.id === pId || df.code === pCode);
                  return {
                    id: pId || fallback?.id || `proj-${idx + 1}`,
                    code: pCode || fallback?.code || `INT-2024-${String(idx + 1).padStart(3, '0')}`,
                    name: pName || fallback?.name || `Dự án nội thất ${pCode || ''}`,
                    customerName: pCustomer || fallback?.customerName || 'Khách hàng',
                    projectType: fallback?.projectType || 'Biệt thự cao cấp',
                    status: (pStatus as MockProject['status']) || fallback?.status || 'design',
                    statusLabel: fallback?.statusLabel || (pStatus === 'production' ? 'Sản xuất' : pStatus === 'installation' ? 'Lắp đặt' : pStatus === 'handover' ? 'Bàn giao' : 'Thiết kế'),
                    statusColor: fallback?.statusColor || 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/40',
                    contractValue: pBudget || fallback?.contractValue || 0,
                    grossMarginPercent: fallback?.grossMarginPercent ?? 40.0,
                    approvedRevisionNumber: fallback?.approvedRevisionNumber ?? 1,
                    leadArchitect: pArch || fallback?.leadArchitect || 'KTS. Lê Hoàng Sơn',
                    progressPercent: fallback?.progressPercent ?? 50,
                    nextAction: fallback?.nextAction ?? 'Kiểm tra tiến độ',
                    imageUrl: fallback?.imageUrl || 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
                    architectAvatar: fallback?.architectAvatar || 'S',
                    roomsCount: fallback?.roomsCount || 4,
                  };
                });
                setProjects(merged);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        // Safe fallback maintains uninterrupted UI
      });
  }, []);

  const currentPeriodData: BusinessChainPeriodData =
    businessChainOverview.periods[selectedPeriod] || businessChainOverview.periods.this_month;

  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'design') return p.status === 'design';
    if (activeTab === 'production') return p.status === 'production';
    if (activeTab === 'installation') return p.status === 'installation';
    if (activeTab === 'handover') return p.status === 'handover';
    return true;
  });

  const totalProjectPages = Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE);
  const pagedProjects = filteredProjects.slice(
    (projectPage - 1) * PROJECT_PAGE_SIZE,
    projectPage * PROJECT_PAGE_SIZE
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── 00. TOP CONTROL & USER BAR ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Bella Interior OS
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
            Trung tâm Điều hành Nội thất
          </h2>
        </div>
        <InteriorUserBar />
      </div>

      {/* ─── 01. VIEWPORT HERO BANNER ─────────────────────────────────── */}
      <div className="interior-hero relative rounded-3xl bg-gradient-to-r from-slate-900 via-[#0F2744] to-[#1B365D] text-white p-6 sm:p-8 shadow-sm overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Ambient background decoration */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-32 bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold tracking-wide text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Hệ điều hành Nội thất Doanh nghiệp
          </div>
          <h1 className="interior-hero-title text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Chào buổi sáng, {userName}!
          </h1>
          <p className="interior-hero-description text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
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
                {portfolioData ? portfolioData.kpis.inProgress.value : projects.length}
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
              {portfolioData?.kpis.inProgress.trend || 'Theo thời gian thực'}
            </p>
          </div>
        </div>

        {/* Card 2: Giá trị hợp đồng, Thực thu & Công nợ */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/40">
              Thương mại &amp; Thu tiền
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tổng giá trị hợp đồng
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {portfolioData ? portfolioData.financialSummary.totalContractFormatted : '9,28 tỷ đ'}
              </span>
              {/* Sparkline Amber SVG */}
              <svg className="w-20 h-7 text-amber-500 shrink-0" viewBox="0 0 100 30" fill="none">
                <path
                  d="M0 28 Q 20 25, 40 18 T 75 14 T 100 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đã thu:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {portfolioData ? portfolioData.financialSummary.collectedFormatted : 'Chưa có'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Công nợ:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {portfolioData ? portfolioData.financialSummary.receivableFormatted : 'Chưa có'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Dự án có nguy cơ trễ */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/40">
              Kiểm soát rủi ro
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Dự án có nguy cơ trễ
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {portfolioData ? portfolioData.kpis.delayedRisk.value : 0}
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
              {portfolioData?.kpis.delayedRisk.trend || 'Đánh giá tự động theo hạn'}
            </p>
          </div>
        </div>

        {/* Card 4: Chất lượng & Hoàn thiện */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/40">
              QC &amp; Bàn giao
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tồn đọng QC &amp; Cần chú ý
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {portfolioData
                  ? (portfolioData.deliveryQualityAnalytics?.openPunchListItems ??
                    portfolioData.progressOverview.specialAttentionCount)
                  : 0}
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
              {portfolioData?.progressOverview.specialAttentionNote || 'Hạng mục cần xử lý'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 03. MIDDLE TWO-COLUMN GRID: VIỆC CẦN XỬ LÝ &amp; TIẾN ĐỘ CHUỖI ─ */}
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
            {portfolioData?.actionAlerts && portfolioData.actionAlerts.length > 0 ? (
              portfolioData.actionAlerts.map((alert) => {
                const matchedProject = projects.find((p) => p.id === alert.relatedProjectId || p.code === alert.relatedProjectId);
                const tag = alert.type === 'critical' ? 'Khẩn cấp' : alert.type === 'warning' ? 'Cảnh báo' : 'Thông tin';
                const tagClass = alert.type === 'critical'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                  : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900';

                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (matchedProject) {
                        setSelectedWorkspaceProject(matchedProject);
                      }
                    }}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        <AlertTriangle className={`w-5 h-5 ${alert.type === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tagClass}`}>
                            {tag}
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {matchedProject?.name || 'Hạng mục nội thất'}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {alert.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span className="text-xs text-slate-400">
                        {alert.timeAgo}
                      </span>
                      {alert.actionUrl && (
                        <Link
                          href={alert.actionUrl}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          title="Mở chi tiết"
                        >
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : projects.length > 0 ? (
              projects.slice(0, 3).map((proj) => {
                const stageTasks: Record<string, { tag: string; tagClass: string; task: string; due: string; timeClass: string; iconType: 'file' | 'wrench' | 'check' }> = {
                  design: {
                    tag: 'Thiết kế',
                    tagClass: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
                    task: 'Phê duyệt hồ sơ thiết kế kỹ thuật thi công',
                    due: 'Hôm nay',
                    timeClass: 'text-rose-600 dark:text-rose-400 font-semibold',
                    iconType: 'file',
                  },
                  production: {
                    tag: 'Sản xuất',
                    tagClass: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
                    task: 'Kiểm tra tiến độ xưởng & KCS hoàn thiện',
                    due: '2 ngày',
                    timeClass: 'text-amber-600 dark:text-amber-400 font-semibold',
                    iconType: 'wrench',
                  },
                  installation: {
                    tag: 'Lắp đặt',
                    tagClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900',
                    task: 'Kiểm tra hiện trường & đối soát kích thước',
                    due: '3 ngày',
                    timeClass: 'text-indigo-600 dark:text-indigo-400 font-semibold',
                    iconType: 'wrench',
                  },
                  handover: {
                    tag: 'Nghiệm thu',
                    tagClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
                    task: 'Biên bản nghiệm thu bàn giao & bảo hành',
                    due: 'Theo lịch',
                    timeClass: 'text-emerald-600 dark:text-emerald-400 font-semibold',
                    iconType: 'check',
                  },
                };

                const cfg = stageTasks[proj.status] || stageTasks.design;
                const stageLinks: Record<string, string> = {
                  design: `/dashboard/interior/design?projectId=${proj.id}`,
                  production: `/dashboard/interior/production?projectId=${proj.id}`,
                  installation: `/dashboard/interior/installation?projectId=${proj.id}`,
                  handover: `/dashboard/interior/qc-handover?projectId=${proj.id}`,
                };
                const actionHref = stageLinks[proj.status] || `/dashboard/interior/design?projectId=${proj.id}`;

                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedWorkspaceProject(proj)}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        {cfg.iconType === 'file' ? (
                          <FileText className="w-5 h-5 text-blue-500" />
                        ) : cfg.iconType === 'wrench' ? (
                          <Wrench className="w-5 h-5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.tagClass}`}>
                            {cfg.tag}
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {proj.name}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {proj.nextAction || cfg.task}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span className={`text-xs ${cfg.timeClass}`}>
                        {cfg.due}
                      </span>
                      <Link
                        href={actionHref}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title={`Chuyển đến phân hệ ${cfg.tag}`}
                      >
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">Không có việc khẩn cấp cần xử lý</p>
            )}
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

            {/* Interactive Period Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
              >
                <span>{currentPeriodData.periodLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {isPeriodDropdownOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                  {(['this_month', 'last_month', 'this_quarter', 'all'] as BusinessChainPeriodKey[]).map((key) => {
                    const periodItem = businessChainOverview.periods[key];
                    const isSelected = selectedPeriod === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedPeriod(key);
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{periodItem?.periodLabel || key}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Stepper with 4 Steps */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              {
                key: 'design',
                label: 'Thiết kế',
                pct: currentPeriodData.stages.find((s) => s.key === 'design')?.percent ?? 92,
                icon: Layers,
                color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400',
              },
              {
                key: 'commercial',
                label: 'Thương mại',
                pct: currentPeriodData.stages.find((s) => s.key === 'commercial')?.percent ?? 85,
                icon: FileText,
                color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400',
              },
              {
                key: 'production',
                label: 'Sản xuất',
                pct: currentPeriodData.stages.find((s) => s.key === 'production')?.percent ?? 70,
                icon: Wrench,
                color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400',
              },
              {
                key: 'handover',
                label: 'Bàn giao',
                pct: currentPeriodData.stages.find((s) => s.key === 'handover')?.percent ?? 45,
                icon: Award,
                color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
              },
            ].map((step) => {
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
                {currentPeriodData.statusLabel} · {currentPeriodData.overallPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-[#1B365D] dark:to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${currentPeriodData.overallPercent}%` }}
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
                  onClick={() => {
                    setActiveTab(tab.id);
                    setProjectPage(1);
                  }}
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
          <table className="w-full text-left text-xs sm:text-sm min-w-[1100px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-y border-slate-100 dark:border-slate-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Dự án</th>
                <th className="py-3 px-4 whitespace-nowrap">Khách hàng</th>
                <th className="py-3 px-4 whitespace-nowrap">Phụ trách</th>
                <th className="py-3 px-4 whitespace-nowrap">Giai đoạn</th>
                <th className="py-3 px-4 whitespace-nowrap">Tiến độ</th>
                <th className="py-3 px-4 whitespace-nowrap">Bản vẽ</th>
                <th className="py-3 px-4 whitespace-nowrap">Giá trị HĐ</th>
                <th className="py-3 px-4 whitespace-nowrap">Biên lợi nhuận</th>
                <th className="py-3 px-4 whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {pagedProjects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  onClick={() => setSelectedWorkspaceProject(project)}
                >
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors whitespace-nowrap">
                        {project.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                        {project.code}
                      </p>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <p className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{project.customerName}</p>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">{project.projectType}</p>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      {project.leadArchitect}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${project.statusColor}`}>
                      ● {project.statusLabel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
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
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 whitespace-nowrap">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Rev #{project.approvedRevisionNumber} Lock
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(project.contractValue)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {project.grossMarginPercent}%
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
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

        {/* Pagination */}
        {totalProjectPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700 dark:text-slate-300">{pagedProjects.length}</span> trên <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredProjects.length}</span> dự án · Trang <span className="font-semibold text-slate-700 dark:text-slate-300">{projectPage}</span>/{totalProjectPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setProjectPage((p) => Math.max(1, p - 1))}
                disabled={projectPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Trước
              </button>
              {Array.from({ length: totalProjectPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setProjectPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    page === projectPage
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setProjectPage((p) => Math.min(totalProjectPages, p + 1))}
                disabled={projectPage === totalProjectPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 05. TÀI CHÍNH &amp; CẢNH BÁO + BANNER PROMO ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Tài chính &amp; cảnh báo */}
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
            <p className="interior-promo-description text-xs text-slate-300 max-w-md leading-relaxed">
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
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
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
                    href={`/dashboard/interior/design?projectId=${selectedWorkspaceProject.id}`}
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
                    href={`/dashboard/interior/boq?projectId=${selectedWorkspaceProject.id}`}
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
                    href={`/dashboard/interior/production?projectId=${selectedWorkspaceProject.id}`}
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

                  {/* Module 4: QC &amp; Handover */}
                  <Link
                    href={`/dashboard/interior/qc-handover?projectId=${selectedWorkspaceProject.id}`}
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
