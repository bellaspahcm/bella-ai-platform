/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  RefreshCw,
  Bell,
  ChevronDown,
  TrendingUp,
  Layers,
  FolderKanban,
  Percent,
  BarChart3,
  PieChart,
  Table as TableIcon,
  Activity,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Receipt,
  X,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Lock,
  Building2,
  Wrench,
  PackageCheck,
  Sparkles,
} from 'lucide-react';
import type {
  FinanceOverviewResponse,
  ProjectPLItem,
} from '@/products/bella-interior/domain/finance-overview.types';
import { InteriorFinanceAnalyticsService } from '@/products/bella-interior/services/interior-finance-analytics.service';

export default function InteriorProjectFinancePage() {
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedQuarter] = useState('Quý 4/2026');
  const [selectedPeriod, setSelectedPeriod] = useState<'3_months' | '6_months' | '1_year'>('3_months');
  const [selectedCashFlowRange] = useState('6 tháng');

  // Modals for Phases 2, 3, 4
  const [selectedProjectForDrilldown, setSelectedProjectForDrilldown] = useState<ProjectPLItem | null>(null);
  const [showCostControlModal, setShowCostControlModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showRiskRadarModal, setShowRiskRadarModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [workshopLockTriggered, setWorkshopLockTriggered] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(
        `/api/interior/finance?quarter=${encodeURIComponent(selectedQuarter)}&period=${selectedPeriod}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.overview) {
          setData(json.data.overview);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
    } catch {
      // Fallback to Canonical Domain Service (Zero UI calculation)
    }
    const fallback = InteriorFinanceAnalyticsService.getFinanceOverview(selectedQuarter, selectedPeriod);
    setData(fallback);
    setLoading(false);
    setRefreshing(false);
  }, [selectedQuarter, selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Đang tải dữ liệu Tài chính &amp; P&amp;L dự án...
          </p>
        </div>
      </div>
    );
  }

  const {
    kpis,
    financialPerformance,
    cogsStructure,
    projectPLBreakdown,
    cashFlow,
    debtOverview,
    recentTransactions,
    quickInsights,
    footerBanner,
    costControlDossier,
    debtAgeingDossier,
    riskRadar,
  } = data;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── 01. HEADER: Title, Subtitle, Quarter Dropdown, Refresh, Alerts, User Avatar ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Project Finance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Tổng quan tài chính, hiệu quả kinh doanh và công nợ dự án
          </p>
        </div>

        <div className="flex items-center gap-3 self-end lg:self-auto">
          {/* Quarter Dropdown */}
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedQuarter}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchData}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDebtModal(true)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
              aria-label="Thông báo tài chính"
            >
              <Bell className="w-4 h-4" />
              {data.user.notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                  {data.user.notificationsCount}
                </span>
              )}
            </button>
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer">
            <img
              src={'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80'}
              alt={data.user.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/20 dark:ring-emerald-500/40"
            />
          </div>
        </div>
      </div>

      {/* ─── 02. TOP ROW: 4 KPI CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Giá trị hợp đồng */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.contractRevenue.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.contractRevenue.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.contractRevenue.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Tổng giá vốn */}
        <div
          onClick={() => setShowCostControlModal(true)}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {kpis.totalCogs.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.totalCogs.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.totalCogs.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Lợi nhuận gộp */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.grossProfit.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {kpis.grossProfit.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.grossProfit.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Biên lợi nhuận */}
        <div
          onClick={() => setShowRiskRadarModal(true)}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {kpis.grossMargin.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.grossMargin.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.grossMargin.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── 03. ROW 2: FINANCIAL PERFORMANCE & COGS STRUCTURE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hiệu quả tài chính theo thời gian (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Hiệu quả tài chính theo thời gian
                </h2>
              </div>

              {/* Period Tabs */}
              <div className="flex items-center gap-3 text-xs">
                {financialPerformance.availablePeriods.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => setSelectedPeriod(period.key)}
                    className={`font-semibold transition-colors pb-0.5 ${
                      selectedPeriod === period.key
                        ? 'text-emerald-600 border-b-2 border-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center sm:justify-end gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 mb-6">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Doanh thu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Chi phí</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Lợi nhuận</span>
              </div>
            </div>

            {/* Bar Chart — fixed baseline: bars occupy top zone, x-axis labels in bottom 24px row */}
            <div className="relative h-56">
              {/* Y-axis labels — aligned to plot area height (h-56 minus 24px x-axis row = h-[calc(100%-24px)]) */}
              <div className="absolute left-0 top-0 h-[calc(100%-24px)] w-6 flex flex-col justify-between text-[11px] text-slate-400 font-mono pointer-events-none">
                {financialPerformance.yAxisLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Plot area: exact same height as y-axis labels so "0" grid line = bar bottom */}
              <div className="absolute left-8 right-0 top-0 h-[calc(100%-24px)]">
                {/* Grid lines filling plot area */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-200 dark:border-slate-700 w-full" />
                </div>

                {/* Bars — items-end aligns bar bottoms to bottom of this plot area = "0" baseline */}
                <div className="relative h-full flex items-end justify-around px-2 sm:px-8">
                  {financialPerformance.bars.map((bar) => (
                    <div key={bar.month} className="flex items-end gap-1 sm:gap-2 h-full">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${bar.revenueHeightPercent}%` }}
                        className="w-4 sm:w-6 bg-emerald-500 rounded-t-md hover:opacity-90 transition-all cursor-pointer relative group"
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                          {bar.revenueFormatted}
                        </div>
                      </div>

                      {/* Cost Bar */}
                      <div
                        style={{ height: `${bar.costHeightPercent}%` }}
                        className="w-4 sm:w-6 bg-blue-500 rounded-t-md hover:opacity-90 transition-all cursor-pointer relative group"
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                          {bar.costFormatted}
                        </div>
                      </div>

                      {/* Profit Bar */}
                      <div
                        style={{ height: `${bar.profitHeightPercent}%` }}
                        className="w-4 sm:w-6 bg-amber-400 rounded-t-md hover:opacity-90 transition-all cursor-pointer relative group"
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                          {bar.profitFormatted}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* X-axis month labels — absolute bottom 24px row, aligned under each bar group */}
              <div className="absolute left-8 right-0 bottom-0 h-6 flex items-center justify-around px-2 sm:px-8">
                {financialPerformance.bars.map((bar) => (
                  <span key={bar.month} className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {bar.month}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Cơ cấu giá vốn (5 cols) */}
        <div
          onClick={() => setShowCostControlModal(true)}
          className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Cơ cấu giá vốn
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                Chi tiết 6 khoản mục →
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
              {/* SVG Donut */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="12"
                  />
                  {/* Material Slice 70% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#3B82F6"
                    strokeWidth="12"
                    strokeDasharray={cogsStructure.items[0].dashArray}
                    strokeDashoffset={cogsStructure.items[0].dashOffset}
                    strokeLinecap="round"
                  />
                  {/* Labor Slice 30% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="12"
                    strokeDasharray={cogsStructure.items[1].dashArray}
                    strokeDashoffset={cogsStructure.items[1].dashOffset}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {cogsStructure.totalCogsFormatted}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {cogsStructure.centerSublabel}
                  </span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div className="space-y-4">
                {cogsStructure.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {item.label}
                      </p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.percentageFormatted}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 04. ROW 3: CHI TIẾT P&L THEO DỰ ÁN (FULL WIDTH TABLE) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {projectPLBreakdown.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelectedProjectForDrilldown(projectPLBreakdown.projects[0])}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Xem chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Dự án</th>
                <th className="py-3 px-4 font-semibold">Khách hàng</th>
                <th className="py-3 px-4 font-semibold">Giá trị hợp đồng</th>
                <th className="py-3 px-4 font-semibold">Giá vốn</th>
                <th className="py-3 px-4 font-semibold">Lợi nhuận gộp</th>
                <th className="py-3 px-4 font-semibold">Biên lợi nhuận</th>
                <th className="py-3 px-4 font-semibold">Đã thu</th>
                <th className="py-3 px-4 font-semibold">Công nợ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {projectPLBreakdown.projects.map((proj) => (
                <tr
                  key={proj.id}
                  onClick={() => setSelectedProjectForDrilldown(proj)}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {proj.projectName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                    {proj.clientName}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {proj.contractRevenueFormatted}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                    {proj.cogsFormatted}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {proj.grossProfitFormatted}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${proj.marginBadgeClass}`}
                    >
                      {proj.marginFormatted}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {proj.cashCollectedFormatted}
                  </td>
                  <td className={`py-3.5 px-4 font-mono ${proj.debtColorClass}`}>
                    {proj.outstandingDebtFormatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 05. ROW 4: DÒNG TIỀN DỰ ÁN & CÔNG NỢ & THANH TOÁN ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Dòng tiền dự án (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {cashFlow.title}
                </h2>
              </div>

              {/* Range Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>{selectedCashFlowRange}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-start gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Thu tiền</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Chi phí</span>
              </div>
            </div>

            {/* Line Chart Grid */}
            <div className="relative h-48">
              {/* Y-axis labels — aligned to plot area */}
              <div className="absolute left-0 top-0 h-[calc(100%-24px)] w-6 flex flex-col justify-between text-[11px] text-slate-400 font-mono pointer-events-none">
                {cashFlow.yAxisLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Plot area */}
              <div className="absolute left-8 right-0 top-0 h-[calc(100%-24px)]">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-200 dark:border-slate-700 w-full" />
                </div>

                {/* SVG Line Chart — fills plot area exactly */}
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 300 150"
                  preserveAspectRatio="none"
                >
                  {/* Collected Line (Emerald) */}
                  <path
                    d={cashFlow.collectedSvgPath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Cost Line (Blue) */}
                  <path
                    d={cashFlow.costSvgPath}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points */}
                  {cashFlow.points.map((p, idx) => {
                    const x = 30 + idx * 48;
                    const yColl = 140 - (p.collected / 3_000_000_000) * 110;
                    const yCost = 140 - (p.cost / 3_000_000_000) * 110;
                    return (
                      <g key={p.month}>
                        <circle cx={x} cy={yColl} r="3.5" fill="#10B981" />
                        <circle cx={x} cy={yCost} r="3.5" fill="#3B82F6" />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X-axis Month Labels — bottom 24px row */}
              <div className="absolute left-8 right-0 bottom-0 h-6 flex justify-between items-center px-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {cashFlow.points.map((p) => (
                  <span key={p.month}>{p.month}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Công nợ & Thanh toán (5 cols) */}
        <div
          onClick={() => setShowDebtModal(true)}
          className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors group"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Công nợ &amp; Thanh toán
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 group-hover:underline">
                Chi tiết thu hồi nợ →
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              {/* SVG Donut */}
              <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="12"
                  />
                  {/* Not Due (Emerald) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="12"
                    strokeDasharray={debtOverview.categories[0].dashArray}
                    strokeDashoffset={debtOverview.categories[0].dashOffset}
                    strokeLinecap="round"
                  />
                  {/* Upcoming (Amber) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F59E0B"
                    strokeWidth="12"
                    strokeDasharray={debtOverview.categories[1].dashArray}
                    strokeDashoffset={debtOverview.categories[1].dashOffset}
                    strokeLinecap="round"
                  />
                  {/* Overdue (Red) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#EF4444"
                    strokeWidth="12"
                    strokeDasharray={debtOverview.categories[2].dashArray}
                    strokeDashoffset={debtOverview.categories[2].dashOffset}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {debtOverview.centerValue}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {debtOverview.centerUnit}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {debtOverview.centerLabel}
                  </span>
                </div>
              </div>

              {/* Debt Categories */}
              <div className="space-y-3.5">
                {debtOverview.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {cat.label}
                      </p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        {cat.amountFormatted}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert Notice Pill */}
            <div className="mt-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400 font-semibold group-hover:bg-rose-100 dark:group-hover:bg-rose-950/60 transition-colors">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                !
              </span>
              <span>{debtOverview.alertNotice.message}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 06. ROW 5: GIAO DỊCH GẦN ĐÂY & NHẬN ĐỊNH NHANH ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Giao dịch gần đây (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {recentTransactions.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowTransactionsModal(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">Ngày</th>
                  <th className="py-3 px-4 font-semibold">Nội dung</th>
                  <th className="py-3 px-4 font-semibold">Số tiền</th>
                  <th className="py-3 px-4 font-semibold">Loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {recentTransactions.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setShowTransactionsModal(true)}
                  >
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.description}
                    </td>
                    <td className={`py-3 px-4 font-mono ${tx.amountColorClass}`}>
                      {tx.amountFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${tx.badgeClass}`}
                      >
                        {tx.badgeLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Nhận định nhanh (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {quickInsights.title}
              </h2>
            </div>

            <div className="space-y-3">
              {quickInsights.insights.map((ins) => (
                <div key={ins.id} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {ins.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowRiskRadarModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
              <span>{quickInsights.actionLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 07. FOOTER BANNER: Bella Interior Luxury Living ─── */}
      <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800 min-h-[200px] sm:min-h-[240px] flex flex-col justify-end p-6 sm:p-8 group">
        <img
          src={'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80'}
          alt="Bella Interior Living Room"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />

        <div className="relative z-10 space-y-1">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {footerBanner.title}
          </h3>
          <p className="text-xs sm:text-sm font-medium text-slate-200">
            {footerBanner.subtitle}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: PROJECT P&L & COST DRILLDOWN MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {selectedProjectForDrilldown && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedProjectForDrilldown(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedProjectForDrilldown.projectName}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chủ đầu tư: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedProjectForDrilldown.clientName}</span> | Mã dự án: {selectedProjectForDrilldown.id}
              </p>
            </div>

            {/* Project Financial Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Giá trị hợp đồng</span>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {selectedProjectForDrilldown.contractRevenueFormatted}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Doanh thu ghi nhận</span>
                <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {selectedProjectForDrilldown.recognizedRevenueFormatted}
                </p>
                <span className="text-[10px] text-slate-400">Tiến độ {selectedProjectForDrilldown.completionPercent}%</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Giá vốn thực tế</span>
                <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {selectedProjectForDrilldown.cogsFormatted}
                </p>
                <span className={`text-[10px] font-semibold ${selectedProjectForDrilldown.isOverBudget ? 'text-rose-600' : 'text-slate-400'}`}>
                  {selectedProjectForDrilldown.costVarianceFormatted} so dự toán
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Biên lợi nhuận dự kiến</span>
                <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {selectedProjectForDrilldown.marginFormatted}
                </p>
                <span className="text-[10px] text-slate-400">Dự báo chốt: {selectedProjectForDrilldown.forecastFinalMarginFormatted}</span>
              </div>
            </div>

            {/* Risk Alert if any */}
            {selectedProjectForDrilldown.riskAlert && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                selectedProjectForDrilldown.riskAlert.severity === 'danger'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}>
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold">Cảnh báo kiểm soát chi phí &amp; công nợ</p>
                  <p className="text-xs font-medium">{selectedProjectForDrilldown.riskAlert.label}</p>
                </div>
              </div>
            )}

            {/* Related Work Orders for this project */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lệnh sản xuất xưởng liên quan (Work Orders)
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {costControlDossier.sourceWorkOrders
                  .filter((wo) => wo.project === selectedProjectForDrilldown.projectName)
                  .map((wo) => (
                    <div key={wo.woNumber} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                      <div>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">{wo.woNumber}</span>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">{wo.workshopStage}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{wo.laborCostFormatted}</span>
                        <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">{wo.statusLabel}</p>
                      </div>
                    </div>
                  ))}
                {costControlDossier.sourceWorkOrders.filter((wo) => wo.project === selectedProjectForDrilldown.projectName).length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    Không có lệnh sản xuất trực tiếp phát sinh trong quý này.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedProjectForDrilldown(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: PHASE 2 — DETAILED COST CONTROL & MULTI-CATEGORY COGS DRILLDOWN
      ═══════════════════════════════════════════════════════════════════════ */}
      {showCostControlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowCostControlModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {costControlDossier.title}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Định mức chi phí 6 nhóm cấu thành COGS đối soát cùng Đơn đặt hàng vật tư &amp; Lệnh sản xuất xưởng
              </p>
            </div>

            {/* Dossier Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Tổng ngân sách dự toán</span>
                <p className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                  {costControlDossier.totalBudgetFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60">
                <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">Chi phí đã cam kết (PO)</span>
                <p className="text-sm sm:text-base font-black font-mono text-purple-700 dark:text-purple-400 mt-1">
                  {costControlDossier.totalCommittedFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60">
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">Giá vốn thực tế phát sinh</span>
                <p className="text-sm sm:text-base font-black font-mono text-blue-700 dark:text-blue-400 mt-1">
                  {costControlDossier.totalActualFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Chênh lệch ngân sách</span>
                <p className="text-sm sm:text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                  {costControlDossier.totalVarianceFormatted}
                </p>
              </div>
            </div>

            {/* 6 Categories Detailed Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Khoản mục giá vốn</th>
                      <th className="py-2.5 px-3 font-semibold">Dự toán</th>
                      <th className="py-2.5 px-3 font-semibold">Thực tế</th>
                      <th className="py-2.5 px-3 font-semibold">Chênh lệch</th>
                      <th className="py-2.5 px-3 font-semibold">Dự kiến còn lại</th>
                      <th className="py-2.5 px-3 font-semibold">Nhà cung cấp chính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {costControlDossier.categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 dark:text-white">{cat.name}</p>
                          <p className="text-[10px] text-slate-400">{cat.description}</p>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {cat.budgetAmountFormatted}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {cat.actualAmountFormatted}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[11px] font-bold ${cat.isOverBudget ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
                            {cat.varianceAmountFormatted} ({cat.variancePercentFormatted})
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {cat.remainingForecastFormatted}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                          {cat.topSuppliers.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source Purchase Orders & Work Orders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purchase Orders */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                  Đơn đặt hàng vật tư chính (Purchase Orders)
                </h4>
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {costControlDossier.sourcePurchaseOrders.map((po) => (
                    <div key={po.poNumber} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">{po.poNumber}</span>
                        <p className="text-[11px] text-slate-500">{po.vendor} • {po.project}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{po.amountFormatted}</span>
                        <p className="text-[10px] text-emerald-600 font-semibold">{po.statusLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Orders */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                  Lệnh sản xuất &amp; Tổ thợ mộc (Work Orders)
                </h4>
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {costControlDossier.sourceWorkOrders.map((wo) => (
                    <div key={wo.woNumber} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">{wo.woNumber}</span>
                        <p className="text-[11px] text-slate-500">{wo.workshopStage} • {wo.project}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{wo.laborCostFormatted}</span>
                        <p className="text-[10px] text-emerald-600 font-semibold">{wo.statusLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCostControlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Đóng bảng đối soát
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: PHASE 3 — GRANULAR DEBT AGEING, CASH COLLECTION & RECOVERY
      ═══════════════════════════════════════════════════════════════════════ */}
      {showDebtModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowDebtModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quản trị Công nợ, Lịch thanh toán &amp; Kích hoạt Thu hồi nợ
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Đối soát công nợ phải thu gắn liền với mốc nghiệm thu hợp đồng và bảo hộ tiến độ xuất xưởng
              </p>
            </div>

            {/* Debt Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500">Tổng công nợ còn lại</span>
                <p className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                  {debtAgeingDossier.totalOutstandingFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Chưa đến hạn</span>
                <p className="text-sm sm:text-base font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {debtAgeingDossier.notDueAmountFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60">
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Sắp đến hạn (≤ 7 ngày)</span>
                <p className="text-sm sm:text-base font-black font-mono text-amber-700 dark:text-amber-400 mt-1">
                  {debtAgeingDossier.upcomingAmountFormatted}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/60">
                <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Quá hạn (&gt; 15 ngày)</span>
                <p className="text-sm sm:text-base font-black font-mono text-rose-700 dark:text-rose-400 mt-1">
                  {debtAgeingDossier.overdueAmountFormatted}
                </p>
              </div>
            </div>

            {/* Overdue Debt Item & Action Card */}
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-300">
                    Khoản công nợ quá hạn cần xử lý ngay
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                  Quá hạn 16 ngày
                </span>
              </div>

              {debtAgeingDossier.overdueItems.map((item) => (
                <div key={item.id} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Dự án:</p>
                      <p className="font-bold text-slate-900 dark:text-white">{item.projectName}</p>
                      <p className="text-[11px] text-slate-500">Khách hàng: {item.clientName} ({item.contractNumber})</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Mốc thanh toán &amp; Số tiền:</p>
                      <p className="font-bold font-mono text-rose-600 dark:text-rose-400">{item.amountFormatted}</p>
                      <p className="text-[11px] text-slate-500">{item.milestoneName}</p>
                    </div>
                  </div>

                  {/* Pre-composed formal message */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200/80 dark:border-rose-800 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Công văn thu hồi nợ tự động (Canonical Message)
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 italic">
                      &quot;{item.recoveryAction.suggestedMessage}&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      {workshopLockTriggered ? 'Đã khóa xuất xưởng thành công' : 'Chế độ an toàn: Sẵn sàng khóa xuất xưởng'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWorkshopLockTriggered(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        workshopLockTriggered
                          ? 'bg-slate-600 text-white cursor-default'
                          : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer hover:shadow-sm'
                      }`}
                    >
                      {workshopLockTriggered ? '✓ Đã kích hoạt lệnh khóa' : item.recoveryAction.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Upcoming Milestones */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lịch thu tiền sắp đến hạn trong tuần (Upcoming Milestones)
              </h4>
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {debtAgeingDossier.upcomingMilestones.map((ums) => (
                  <div key={ums.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{ums.projectName}</p>
                      <p className="text-[11px] text-slate-500">{ums.milestoneName} ({ums.contractNumber})</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{ums.amountFormatted}</p>
                      <span className="inline-block px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 text-[10px] font-bold">
                        Đến hạn sau {ums.daysRemaining} ngày ({ums.dueDate})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDebtModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Đóng bảng công nợ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: PHASE 4 — EXECUTIVE INTELLIGENCE & RISK RADAR
      ═══════════════════════════════════════════════════════════════════════ */}
      {showRiskRadarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowRiskRadarModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Trung tâm Điều hành Tài chính &amp; Bảo vệ Biên Lợi Nhuận
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Báo cáo chuyên sâu dành cho Tổng Giám đốc: Đánh giá sức khỏe danh mục, phát hiện xói mòn lợi nhuận và kiến nghị quyết định
              </p>
            </div>

            {/* Health Score Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                  Chỉ số sức khỏe tài chính danh mục (Portfolio Health Score)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black">{riskRadar.overallHealthScore}/100</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-bold">Hạng {riskRadar.overallHealthGrade}</span>
                </div>
                <p className="text-xs text-emerald-50">
                  Danh mục duy trì tăng trưởng an toàn với {riskRadar.healthyProjectCount} dự án ổn định, {riskRadar.warningProjectCount} dự án cảnh báo nhẹ, {riskRadar.highRiskProjectCount} dự án rủi ro cao.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="px-3 py-2 rounded-xl bg-white/10 text-center">
                  <span className="text-xs font-bold block">{riskRadar.healthyProjectCount}</span>
                  <span className="text-[10px] text-emerald-100">An toàn</span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-amber-400/20 text-center">
                  <span className="text-xs font-bold block text-amber-200">{riskRadar.warningProjectCount}</span>
                  <span className="text-[10px] text-amber-100">Cảnh báo</span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-rose-500/20 text-center">
                  <span className="text-xs font-bold block text-rose-200">{riskRadar.highRiskProjectCount}</span>
                  <span className="text-[10px] text-rose-100">Rủi ro cao</span>
                </div>
              </div>
            </div>

            {/* Project Risk Evaluations Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Đánh giá rủi ro xói mòn lợi nhuận từng dự án (Margin Erosion Radar)
              </h4>
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Dự án</th>
                        <th className="py-2.5 px-3 font-semibold">Mức độ rủi ro</th>
                        <th className="py-2.5 px-3 font-semibold">Biên ban đầu</th>
                        <th className="py-2.5 px-3 font-semibold">Dự báo chốt</th>
                        <th className="py-2.5 px-3 font-semibold">Nguyên nhân gốc rễ</th>
                        <th className="py-2.5 px-3 font-semibold">Hành động khắc phục</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {riskRadar.projectRiskEvaluations.map((evalItem) => (
                        <tr key={evalItem.projectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {evalItem.projectName}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${evalItem.riskBadgeClass}`}>
                              {evalItem.riskLevel}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">{evalItem.initialMargin}%</td>
                          <td className="py-3 px-3 font-mono font-bold">
                            {evalItem.forecastFinalMargin}%
                            {evalItem.marginDelta !== 0 && (
                              <span className={`text-[10px] ml-1 ${evalItem.marginDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                ({evalItem.marginDelta > 0 ? '+' : ''}{evalItem.marginDelta}%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 max-w-[200px]">
                            {evalItem.rootCauseSummary}
                          </td>
                          <td className="py-3 px-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 max-w-[220px]">
                            {evalItem.executiveRemedyAction}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Variance Root Causes & Recommended Decisions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Root causes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Phân tích nguyên nhân biến động giá vốn (+71 Triệu ₫)
                </h4>
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {riskRadar.varianceRootCauses.map((factor) => (
                    <div key={factor.factor} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{factor.factor}</span>
                        <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{factor.impactAmountFormatted} ({factor.impactPercentage}%)</span>
                      </div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Trạng thái: {factor.mitigationStatus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Decisions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Kiến nghị quyết định điều hành (Executive Decisions)
                </h4>
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {riskRadar.recommendedDecisions.map((dec) => (
                    <div key={dec.id} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{dec.title}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${dec.urgency === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                          {dec.urgency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">{dec.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          Tác động: {dec.financialImpact}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          {dec.actionButtonText}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRiskRadarModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Đóng báo cáo điều hành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 5: TRANSACTION TRACEABILITY LEDGER
      ═══════════════════════════════════════════════════════════════════════ */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowTransactionsModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Sổ cái Giao dịch &amp; Nguồn gốc Đối soát (Traceable Ledger)
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Toàn bộ dòng tiền thu/chi đều có mã tham chiếu chứng từ gốc (Payment Milestone, Work Order, Site Package)
              </p>
            </div>

            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Mã GD</th>
                      <th className="py-2.5 px-3 font-semibold">Ngày</th>
                      <th className="py-2.5 px-3 font-semibold">Nội dung chứng từ</th>
                      <th className="py-2.5 px-3 font-semibold">Số tiền</th>
                      <th className="py-2.5 px-3 font-semibold">Chứng từ gốc (Source Ref)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {recentTransactions.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {tx.id}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {tx.description}
                        </td>
                        <td className={`py-3 px-3 font-mono ${tx.amountColorClass}`}>
                          {tx.amountFormatted}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <FileText className="w-3 h-3 text-slate-500" />
                            {tx.sourceRef}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTransactionsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Đóng sổ cái
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
