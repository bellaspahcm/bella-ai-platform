'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ChevronRight,
  Play,
  AlertTriangle,
  Coins,
  BarChart3,
  CircleDollarSign,
  Bell,
  ChevronDown,
  CheckCircle2,
  Info,
  Clock,
  ShieldCheck,
  LayoutGrid,
  List,
} from 'lucide-react';
import type {
  PortfolioOverviewResponse,
  PortfolioProjectItem,
} from '@/products/bella-interior/domain/portfolio-overview.types';

// Baseline fallback matching canonical domain definition exactly
const INITIAL_PORTFOLIO: PortfolioOverviewResponse = {
  kpis: {
    totalProjects: {
      value: 24,
      trend: '12%',
      isPositiveTrend: true,
      label: 'Tổng dự án',
    },
    inProgress: {
      value: 18,
      trend: '8%',
      isPositiveTrend: true,
      label: 'Đang triển khai',
    },
    delayedRisk: {
      value: 3,
      trend: '1%',
      isPositiveTrend: false,
      label: 'Có nguy cơ trễ hạn',
    },
    averageGrossMargin: {
      value: '42%',
      trend: '2%',
      isPositiveTrend: true,
      label: 'Biên lợi nhuận TB',
    },
  },
  projects: [
    {
      id: 'proj-001',
      name: 'Villa Sunrise Renovation',
      code: 'INT-2024-001',
      customerName: 'Ahmad Santoso',
      customerSegment: 'Biệt thự cao cấp',
      leadArchitect: 'KTS. Hoàng Long',
      leadArchitectAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      stage: 'design',
      stageLabel: 'Thiết kế',
      stageBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      progressPercent: 65,
      scheduleStatus: 'on_track',
      scheduleStatusLabel: 'Đúng tiến độ',
      scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
      deadlineDate: '30/11/2026',
      daysRemaining: 27,
      daysRemainingLabel: 'Còn 27 ngày',
      isDeadlineUrgent: true,
      daysRemainingClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      contractValue: 450000000,
      contractValueFormatted: '450.000.000 đ',
      grossMarginPercent: 41.5,
      grossMarginFormatted: '41.5%',
      nextAction: 'Hoàn thiện bản vẽ 3D',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'proj-002',
      name: 'Office Tower Lobby',
      code: 'INT-2024-002',
      customerName: 'PT Maju Bersama',
      customerSegment: 'Dinh thự Palm Jumeirah',
      leadArchitect: 'KTS. Lê Hoàng Sơn',
      leadArchitectAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      stage: 'production',
      stageLabel: 'Sản xuất',
      stageBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      progressPercent: 82,
      scheduleStatus: 'ahead',
      scheduleStatusLabel: 'Vượt tiến độ +2%',
      scheduleStatusClass: 'text-emerald-600 dark:text-emerald-400',
      deadlineDate: '15/12/2026',
      daysRemaining: 41,
      daysRemainingLabel: 'Còn 41 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 1200000000,
      contractValueFormatted: '1.200.000.000 đ',
      grossMarginPercent: 43.1,
      grossMarginFormatted: '43.1%',
      nextAction: 'Thi công phòng khách',
      imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'proj-003',
      name: 'Skyline Residence',
      code: 'INT-2024-003',
      customerName: 'VinaReal Group',
      customerSegment: 'Chung cư cao cấp',
      leadArchitect: 'KTS. Trần Minh Đức',
      leadArchitectAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
      stage: 'installation',
      stageLabel: 'Lắp đặt',
      stageBadgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
      progressPercent: 45,
      scheduleStatus: 'delayed',
      scheduleStatusLabel: 'Chậm tiến độ -5%',
      scheduleStatusClass: 'text-rose-600 dark:text-rose-400 font-semibold',
      deadlineDate: '20/12/2026',
      daysRemaining: 46,
      daysRemainingLabel: 'Còn 46 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 780000000,
      contractValueFormatted: '780.000.000 đ',
      grossMarginPercent: 38.7,
      grossMarginFormatted: '38.7%',
      nextAction: 'Lắp đặt nội thất tầng 5',
      imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=300&q=80',
    },
    {
      id: 'proj-004',
      name: 'The Garden Villa',
      code: 'INT-2024-004',
      customerName: 'Green Life Co.',
      customerSegment: 'Biệt thự sân vườn',
      leadArchitect: 'KTS. Nguyễn Thu Hà',
      leadArchitectAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      stage: 'handover',
      stageLabel: 'Bàn giao',
      stageBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      progressPercent: 95,
      scheduleStatus: 'on_track',
      scheduleStatusLabel: 'Đúng tiến độ',
      scheduleStatusClass: 'text-blue-600 dark:text-blue-400',
      deadlineDate: '05/12/2026',
      daysRemaining: 31,
      daysRemainingLabel: 'Còn 31 ngày',
      isDeadlineUrgent: false,
      daysRemainingClass: 'text-slate-500 dark:text-slate-400',
      contractValue: 620000000,
      contractValueFormatted: '620.000.000 đ',
      grossMarginPercent: 45.2,
      grossMarginFormatted: '45.2%',
      nextAction: 'Nghiệm thu & Bàn giao',
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=300&q=80',
    },
  ],
  progressOverview: {
    overallProgressPercent: 85,
    onTrackPercent: 72,
    delayedPercent: 18,
    completedPercent: 10,
    specialAttentionCount: 3,
    specialAttentionNote: 'Có 3 dự án cần theo dõi đặc biệt',
  },
  financialSummary: {
    period: 'Tháng này',
    totalContractValue: 12800000000,
    totalContractFormatted: '12.8 tỷ đ',
    contractGrowthPercent: 8,
    collectedAmount: 8600000000,
    collectedFormatted: '8.6 tỷ đ',
    collectedGrowthPercent: 12,
    receivableAmount: 4200000000,
    receivableFormatted: '4.2 tỷ đ',
    actualProfit: 4800000000,
    actualProfitFormatted: '4.8 tỷ đ',
    profitGrowthPercent: 15,
    averageMarginPercent: 42.3,
    averageMarginFormatted: '42.3%',
    averageMarginNote: 'Biên lợi nhuận bình quân: 42.3%',
  },
  actionAlerts: [
    {
      id: 'alert-1',
      type: 'critical',
      title: 'Dự án Skyline Residence đang chậm tiến độ 5%',
      timeAgo: '2 giờ trước',
      relatedProjectId: 'proj-003',
      actionUrl: '/dashboard/interior/projects/proj-003',
    },
    {
      id: 'alert-2',
      type: 'warning',
      title: 'Dự án Villa Sunrise cần duyệt bản vẽ',
      timeAgo: '1 ngày trước',
      relatedProjectId: 'proj-001',
      actionUrl: '/dashboard/interior/design',
    },
    {
      id: 'alert-3',
      type: 'info',
      title: 'Công nợ khách hàng Green Life Co. còn 1.2 tỷ đ',
      timeAgo: '1 ngày trước',
      relatedProjectId: 'proj-004',
      actionUrl: '/dashboard/interior/finance',
    },
    {
      id: 'alert-4',
      type: 'success',
      title: 'Dự án The Garden Villa đã hoàn tất lắp đặt',
      timeAgo: '2 ngày trước',
      relatedProjectId: 'proj-004',
      actionUrl: '/dashboard/interior/handover',
    },
  ],
};

export default function ProjectsPage() {
  const [data, setData] = useState<PortfolioOverviewResponse>(INITIAL_PORTFOLIO);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    // Canonical read through API endpoint without direct DB access
    fetch('/api/interior/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.data && resData.success) {
          setData({
            kpis: resData.data.kpis || INITIAL_PORTFOLIO.kpis,
            projects: resData.data.projects || INITIAL_PORTFOLIO.projects,
            progressOverview: resData.data.progressOverview || INITIAL_PORTFOLIO.progressOverview,
            financialSummary: resData.data.financialSummary || INITIAL_PORTFOLIO.financialSummary,
            actionAlerts: resData.data.actionAlerts || INITIAL_PORTFOLIO.actionAlerts,
          });
        }
      })
      .catch(() => {
        // Safe fallback maintains uninterrupted UI
      });
  }, []);

  const filteredProjects = data.projects.filter((p: PortfolioProjectItem) => {
    const matchesFilter = filterStage === 'all' || p.stage === filterStage;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── 00. TOP HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <FolderKanban className="w-5 h-5" />
            </span>
            Danh mục Dự án Nội thất
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị chuỗi giá trị toàn diện từ Thiết kế, BOQ, Sản xuất xưởng đến Thi công &amp; Bàn giao
          </p>
        </div>

        {/* User bar & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 pr-2 border-r border-slate-200 dark:border-slate-800">
            <button
              type="button"
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center gap-2 pl-1 cursor-pointer">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80"
                alt="Nguyễn Văn Quang"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nguyễn Văn Quang
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>

          <Link
            href="/dashboard/interior/design"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Tạo dự án mới
          </Link>
        </div>
      </div>

      {/* ─── 01. TẦNG 1: 4 KPI CARDS ĐIỀU HÀNH ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng dự án */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.totalProjects.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.totalProjects.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.totalProjects.label}
              </p>
            </div>
            {/* Sparkline Blue Wave */}
            <svg className="w-20 h-7 text-blue-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 24C15 24 20 12 35 12C50 12 55 4 78 4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Đang triển khai */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.inProgress.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.inProgress.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.inProgress.label}
              </p>
            </div>
            {/* Sparkline Emerald Wave */}
            <svg className="w-20 h-7 text-emerald-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 22C18 22 24 16 38 16C52 16 60 6 78 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Có nguy cơ trễ hạn */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-500 dark:text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
              {data.kpis.delayedRisk.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.delayedRisk.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.delayedRisk.label}
              </p>
            </div>
            {/* Sparkline Amber/Rose Wave */}
            <svg className="w-20 h-7 text-amber-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 10C16 10 24 20 40 20C56 20 62 14 78 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Biên lợi nhuận TB */}
        <div className="relative bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Coins className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {data.kpis.averageGrossMargin.trend}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {data.kpis.averageGrossMargin.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {data.kpis.averageGrossMargin.label}
              </p>
            </div>
            {/* Sparkline Purple Wave */}
            <svg className="w-20 h-7 text-purple-500" viewBox="0 0 80 28" fill="none">
              <path
                d="M2 22C14 22 24 12 40 12C56 12 64 6 78 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── 02. TẦNG 2: BỘ LỌC & DANH MỤC DỰ ÁN ─────────────────────────── */}
      <div className="space-y-3">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          {/* Stage Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterStage === tab.id
                    ? 'bg-[#1B365D] text-white shadow-2xs dark:bg-blue-600'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Filter & View Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên dự án, khách hàng..."
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Bộ lọc
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#1B365D] text-white shadow-2xs dark:bg-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-label="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 10-Column Projects Table */}
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
                  <th className="py-3 px-4">Hạn hoàn thành</th>
                  <th className="py-3 px-4">Giá trị HĐ</th>
                  <th className="py-3 px-4">Biên lợi nhuận</th>
                  <th className="py-3 px-4">Công việc tiếp theo</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredProjects.map((project: PortfolioProjectItem) => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Cột 1: Dự án */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <img
                          src={project.imageUrl}
                          alt={project.name}
                          className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
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

                    {/* Cột 2: Khách hàng */}
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {project.customerName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {project.customerSegment}
                      </p>
                    </td>

                    {/* Cột 3: Phụ trách */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <img
                          src={project.leadArchitectAvatar}
                          alt={project.leadArchitect}
                          className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                          {project.leadArchitect}
                        </span>
                      </div>
                    </td>

                    {/* Cột 4: Giai đoạn */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${project.stageBadgeClass}`}>
                        ● {project.stageLabel}
                      </span>
                    </td>

                    {/* Cột 5: Tiến độ */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1 w-24">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {project.progressPercent}%
                        </span>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${project.progressPercent}%` }}
                          />
                        </div>
                        <p className={`text-[11px] ${project.scheduleStatusClass}`}>
                          {project.scheduleStatusLabel}
                        </p>
                      </div>
                    </td>

                    {/* Cột 6: Hạn hoàn thành */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{project.deadlineDate}</span>
                        </div>
                        <p className={`text-[11px] ${project.daysRemainingClass}`}>
                          {project.daysRemainingLabel}
                        </p>
                      </div>
                    </td>

                    {/* Cột 7: Giá trị HĐ */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {project.contractValueFormatted}
                    </td>

                    {/* Cột 8: Biên lợi nhuận */}
                    <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      {project.grossMarginFormatted}
                    </td>

                    {/* Cột 9: Công việc tiếp theo */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {project.nextAction}
                      </span>
                    </td>

                    {/* Cột 10: Thao tác */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Tùy chọn khác"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/dashboard/interior/projects/${project.id}`}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                          aria-label="Xem chi tiết"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── 03. TẦNG 3: 3 THẺ ĐIỀU HÀNH & PHÂN TÍCH ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Tổng quan tiến độ */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">
              Tổng quan tiến độ
            </h2>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            {/* Donut Chart */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="9"
                  className="dark:stroke-slate-800"
                />
                {/* Segment 1: On-track (72% Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563EB"
                  strokeWidth="9"
                  strokeDasharray="171.9 238.76"
                  strokeDashoffset="0"
                />
                {/* Segment 2: Delayed (18% Orange) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="9"
                  strokeDasharray="42.98 238.76"
                  strokeDashoffset="-171.9"
                />
                {/* Segment 3: Completed (10% Gray) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#94A3B8"
                  strokeWidth="9"
                  strokeDasharray="23.88 238.76"
                  strokeDashoffset="-214.88"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
                  {data.progressOverview.overallProgressPercent}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Tổng tiến độ
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Đúng tiến độ
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.onTrackPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Chậm tiến độ
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.delayedPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Hoàn thành
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {data.progressOverview.completedPercent}%
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{data.progressOverview.specialAttentionNote}</span>
          </div>
        </div>

        {/* Card 2: Tình hình tài chính dự án */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Tình hình tài chính dự án
              </h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {data.financialSummary.period}
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* 4 Financial Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Tổng giá trị HĐ
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.totalContractFormatted}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <Coins className="w-3 h-3 text-amber-500" />
                {data.financialSummary.contractGrowthPercent}%
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Đã thu
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.collectedFormatted}
              </p>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                {data.financialSummary.collectedGrowthPercent}%
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Còn phải thu
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.receivableFormatted}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Lợi nhuận thực tế
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {data.financialSummary.actualProfitFormatted}
              </p>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                {data.financialSummary.profitGrowthPercent}%
              </span>
            </div>
          </div>

          {/* Average Margin Footer */}
          <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{data.financialSummary.averageMarginNote}</span>
          </div>
        </div>

        {/* Card 3: Cảnh báo & Công việc cần làm */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Cảnh báo &amp; Công việc cần làm
              </h2>
            </div>
            <Link
              href="/dashboard/interior/schedule"
              className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="py-2 space-y-2.5">
            {data.actionAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {alert.type === 'critical' ? (
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  ) : alert.type === 'warning' ? (
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <Info className="w-3 h-3" />
                    </span>
                  ) : alert.type === 'info' ? (
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <Info className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                    </span>
                  )}
                  <p className="text-slate-800 dark:text-slate-200 truncate font-medium">
                    {alert.title}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                  {alert.timeAgo}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2" />
        </div>
      </div>
    </div>
  );
}
