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
} from 'lucide-react';
import type {
  FinanceOverviewResponse,
} from '@/products/bella-interior/domain/finance-overview.types';
import { InteriorFinanceAnalyticsService } from '@/products/bella-interior/services/interior-finance-analytics.service';

export default function InteriorProjectFinancePage() {
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedQuarter] = useState('Quý 4/2026');
  const [selectedPeriod, setSelectedPeriod] = useState<'3_months' | '6_months' | '1_year'>('3_months');
  const [selectedCashFlowRange] = useState('6 tháng');

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/interior/finance?quarter=${encodeURIComponent(selectedQuarter)}`);
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
    const fallback = InteriorFinanceAnalyticsService.getFinanceOverview(selectedQuarter);
    setData(fallback);
    setLoading(false);
    setRefreshing(false);
  }, [selectedQuarter]);

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

  const { kpis, financialPerformance, cogsStructure, projectPLBreakdown, cashFlow, debtOverview, recentTransactions, quickInsights, footerBanner } = data;

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
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors"
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
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.totalCogs.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.totalCogs.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.totalCogs.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
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
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.grossMargin.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.grossMargin.formattedValue}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.grossMargin.subtext}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
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
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Lợi nhuận</span>
              </div>
            </div>

            {/* Bar Chart Grid */}
            <div className="relative h-56 flex items-end">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[11px] text-slate-400 font-mono">
                {financialPerformance.yAxisLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Grid Lines */}
              <div className="absolute left-10 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-200 dark:border-slate-700 w-full" />
              </div>

              {/* Grouped Bars */}
              <div className="ml-10 w-full h-full pb-6 flex items-end justify-around">
                {financialPerformance.bars.map((bar) => (
                  <div key={bar.month} className="flex flex-col items-center gap-2 h-full justify-end">
                    <div className="flex items-end gap-1.5 sm:gap-2 h-full">
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
                    {/* Month Label */}
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {bar.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Cơ cấu giá vốn (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Cơ cấu giá vốn
              </h2>
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
          <Link
            href={projectPLBreakdown.detailUrl}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Xem chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
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
            <div className="relative h-48 flex items-end">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 w-6 flex flex-col justify-between text-[11px] text-slate-400 font-mono">
                {cashFlow.yAxisLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Grid Lines */}
              <div className="absolute left-8 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-100 dark:border-slate-800/80 w-full" />
                <div className="border-b border-slate-200 dark:border-slate-700 w-full" />
              </div>

              {/* SVG Line Chart */}
              <div className="ml-8 w-full h-full pb-6 relative">
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

                {/* X-axis Month Labels */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {cashFlow.points.map((p) => (
                    <span key={p.month}>{p.month}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Công nợ & Thanh toán (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Công nợ &amp; Thanh toán
              </h2>
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
            <div className="mt-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400 font-semibold">
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
            <Link
              href={recentTransactions.viewAllUrl}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
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
            <Link
              href={quickInsights.actionUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all"
            >
              <span>{quickInsights.actionLabel}</span>
            </Link>
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
    </div>
  );
}
