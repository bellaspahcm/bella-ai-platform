'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Home,
  ChevronDown,
  Calendar,
  RotateCw,
  Download,
  Coins,
  Percent,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  PieChart,
  ListFilter,
  Bell,
  AlertCircle,
  Clock,
  Info,
  FileText,
  Headset,
  Wrench,
  Layers,
  ArrowRight,
  BarChart3,
  Check,
  Building2,
} from 'lucide-react';
import {
  ReportsOverviewResponse,
  ProjectPerformanceRow,
  ManagementAlert,
} from '@/products/bella-interior/domain/reports-overview.types';

export default function InteriorReportsAnalyticsPage() {
  const [data, setData] = useState<ReportsOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('INT-2024-001');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Tháng 10/2026');
  const [selectedScope, setSelectedScope] = useState<string>('Tất cả dự án');
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showScopeDropdown, setShowScopeDropdown] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<ProjectPerformanceRow | null>(null);
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<ManagementAlert | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const fetchData = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const queryParams = new URLSearchParams({
          tenantId: 'tenant-bella-interior-001',
          projectId: selectedProjectId,
          period: selectedPeriod,
        });

        const res = await fetch(`/api/interior/reports/analytics?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error(`API returned HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.success && json.data?.overview) {
          setData(json.data.overview);
        } else {
          throw new Error(json.error || 'Invalid API payload');
        }
      } catch (err) {
        console.error('Failed to fetch reports analytics:', err);
        showToast('Không thể tải dữ liệu báo cáo từ máy chủ.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProjectId, selectedPeriod, showToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
    showToast('Đang làm mới dữ liệu báo cáo...');
  };

  const handleExportPdf = () => {
    showToast('Đang tạo và tải xuống bản báo cáo PDF điều hành...');
    setTimeout(() => {
      showToast('Bản báo cáo PDF Tháng 10/2026 đã được xuất thành công!');
    }, 1200);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] p-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">
          Đang khởi tạo báo cáo &amp; dữ liệu phân tích điều hành Bella Interior...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Không có dữ liệu báo cáo</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Hệ thống không tìm thấy báo cáo cho dự án hoặc kỳ đánh giá được chọn.
          </p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition"
          >
            Thử tải lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 p-4 sm:p-6 space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & CONTROLS BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-transparent">
        {/* Left: Home + Project Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard/interior"
            className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition shadow-xs"
            title="Về trang tổng quan"
          >
            <Home className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">Dự án:</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProjectDropdown(!showProjectDropdown);
                  setShowPeriodDropdown(false);
                  setShowScopeDropdown(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 text-xs font-semibold text-slate-800 transition"
              >
                <div className="w-5 h-5 rounded overflow-hidden bg-slate-100 shrink-0 relative">
                  <Image
                    src={data.project.thumbnailUrl}
                    alt={data.project.name}
                    width={20}
                    height={20}
                    unoptimized
                    className="object-cover w-full h-full"
                  />
                </div>
                <span>{data.project.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {showProjectDropdown && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                  {data.availableProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between ${
                        p.id === selectedProjectId ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      {p.id === selectedProjectId && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Time filter, Status filter, Refresh, Export PDF */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto justify-end">
          {/* Time Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPeriodDropdown(!showPeriodDropdown);
                setShowProjectDropdown(false);
                setShowScopeDropdown(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 text-xs font-medium text-slate-700 transition"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{selectedPeriod}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showPeriodDropdown && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                {data.filterOptions.availablePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(period);
                      setShowPeriodDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      period === selectedPeriod ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span>{period}</span>
                    {period === selectedPeriod && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scope / Status Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowScopeDropdown(!showScopeDropdown);
                setShowProjectDropdown(false);
                setShowPeriodDropdown(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 text-xs font-medium text-slate-700 transition"
            >
              <span>{selectedScope}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showScopeDropdown && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                {data.filterOptions.availableProjectFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setSelectedScope(filter);
                      setShowScopeDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between ${
                      filter === selectedScope ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{filter}</span>
                    {filter === selectedScope && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 text-xs font-medium text-slate-700 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0D4E3A] hover:bg-[#0A3D2D] text-white rounded-lg shadow-xs text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Xuất báo cáo PDF</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD TITLE BANNER */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Báo cáo &amp; Phân tích dự án
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng quan hiệu quả kinh doanh, tiến độ và chất lượng của dự án
          </p>
        </div>
      </div>

      {/* ROW 1: 4 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng giá trị hợp đồng */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{data.kpis.contractValue.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{data.kpis.contractValue.formattedValue}</p>
              <p className={`text-[11px] mt-0.5 ${data.kpis.contractValue.subLabelClass}`}>
                {data.kpis.contractValue.subLabel}
              </p>
            </div>
          </div>
          {/* Mini 4-Bar Sparkline */}
          <div className="flex items-end gap-1 h-9 shrink-0 pl-2">
            <div className="w-1.5 h-3 bg-emerald-200 rounded-xs" />
            <div className="w-1.5 h-5 bg-emerald-300 rounded-xs" />
            <div className="w-1.5 h-7 bg-emerald-400 rounded-xs" />
            <div className="w-1.5 h-9 bg-emerald-500 rounded-xs" />
          </div>
        </div>

        {/* KPI 2: Biên lợi nhuận gộp TB */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center shrink-0 text-sky-600">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{data.kpis.grossMargin.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{data.kpis.grossMargin.formattedValue}</p>
              <p className={`text-[11px] mt-0.5 ${data.kpis.grossMargin.subLabelClass}`}>
                {data.kpis.grossMargin.subLabel}
              </p>
            </div>
          </div>
          {/* Mini Wave Sparkline */}
          <div className="shrink-0 pl-2">
            <svg className="w-14 h-8 text-sky-400" viewBox="0 0 60 25" fill="none">
              <path
                d="M 2 20 C 15 20, 25 6, 38 12 C 48 16, 54 6, 58 3"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 3: Tỷ lệ đúng tiến độ */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 text-amber-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{data.kpis.onTimeRate.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{data.kpis.onTimeRate.formattedValue}</p>
              <p className={`text-[11px] mt-0.5 ${data.kpis.onTimeRate.subLabelClass}`}>
                {data.kpis.onTimeRate.subLabel}
              </p>
            </div>
          </div>
          {/* Mini Donut Progress Ring */}
          <div className="shrink-0 pl-2">
            <svg className="w-11 h-11" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray="91.6, 100"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* KPI 4: Lỗi Punch List */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{data.kpis.punchListErrors.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {data.kpis.punchListErrors.formattedValue}
              </p>
              <p className={`text-[11px] mt-0.5 ${data.kpis.punchListErrors.subLabelClass}`}>
                {data.kpis.punchListErrors.subLabel}
              </p>
            </div>
          </div>
          {/* Watermark Shield */}
          <div className="shrink-0 pl-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-purple-300" />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: MIDDLE SECTION (Trends 2/3 + Cost Structure 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT (2/3): Xu hướng hiệu quả kinh doanh */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          {/* Header & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">{data.trends.title}</h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Doanh thu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-slate-600 font-medium">Lợi nhuận gộp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600 font-medium">Biên lợi nhuận</span>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="pt-6 pb-2 relative">
            <div className="flex h-56">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between text-[11px] text-slate-400 font-medium pr-3 pb-6 select-none shrink-0 text-right w-8">
                {data.trends.yAxisLabels.map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>

              {/* Chart Plot Area with Grid Lines */}
              <div className="flex-1 relative pb-6 flex flex-col justify-between">
                {/* 5 Horizontal Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                  <div className="w-full border-b border-slate-100" />
                  <div className="w-full border-b border-slate-100" />
                  <div className="w-full border-b border-slate-100" />
                  <div className="w-full border-b border-slate-100" />
                  <div className="w-full border-b border-slate-100" />
                  <div className="w-full border-b border-slate-200" />
                </div>

                {/* Bars & Overlay Container */}
                <div className="relative h-full flex items-end justify-around px-2 z-10">
                  {data.trends.months.map((m) => (
                    <div key={m.monthKey} className="flex flex-col items-center flex-1 h-full justify-end group">
                      {/* Dual Bars Container */}
                      <div className="flex items-end gap-1.5 h-full relative">
                        {/* Revenue Bar (Emerald) */}
                        <div className="flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition">
                            {m.revenueFormatted}
                          </span>
                          <div
                            style={{ height: `${m.revenueBarHeightPercent}%` }}
                            className="w-4 sm:w-5 bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-600"
                          />
                        </div>

                        {/* Gross Profit Bar (Sky) */}
                        <div className="flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition">
                            {m.grossProfitFormatted}
                          </span>
                          <div
                            style={{ height: `${m.profitBarHeightPercent}%` }}
                            className="w-4 sm:w-5 bg-sky-400 rounded-t-sm transition-all duration-500 group-hover:bg-sky-500"
                          />
                        </div>
                      </div>

                      {/* X-Axis Month Label */}
                      <span className="text-[11px] font-medium text-slate-600 mt-2.5">
                        {m.monthLabel}
                      </span>
                    </div>
                  ))}

                  {/* SVG Orange Trendline Overlay connecting months */}
                  <svg
                    className="absolute inset-0 w-full h-[calc(100%-1.5rem)] pointer-events-none overflow-visible"
                    viewBox="0 0 500 200"
                    preserveAspectRatio="none"
                  >
                    <polyline
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2.5"
                      points={data.trends.trendlineSvgPoints}
                    />
                  </svg>

                  {/* Absolute Margin Badges for each month */}
                  <div className="absolute inset-0 pointer-events-none flex justify-around px-2 pb-6">
                    {data.trends.months.map((m) => (
                      <div
                        key={`badge-${m.monthKey}`}
                        className="flex flex-col items-center relative flex-1"
                        style={{ top: `${m.marginLineTopPercent - 15}%` }}
                      >
                        <div className="px-1.5 py-0.5 rounded-full bg-white border border-amber-500 shadow-xs flex items-center justify-center">
                          <span className="text-[10px] font-bold text-amber-600">
                            {m.marginFormatted}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (1/3): Cơ cấu chi phí */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <PieChart className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">{data.costStructure.title}</h2>
          </div>

          {/* Donut Chart + Breakdown */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6 my-auto py-2">
            {/* SVG Donut */}
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="15"
                />
                {/* Pre-computed Donut Segments from Canonical Service */}
                {data.costStructure.donutSegments.map((seg, idx) => (
                  <circle
                    key={`seg-${idx}`}
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="15"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                  />
                ))}
              </svg>

              {/* Donut Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-base font-black text-slate-900 leading-tight">
                  {data.costStructure.totalCostFormatted}
                </span>
                <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                  {data.costStructure.totalCostSublabel}
                </span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="w-full space-y-2.5">
              {data.costStructure.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} />
                    <span className="font-medium text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-normal">{item.amountFormatted}</span>
                    <span className="font-bold text-slate-900 w-11 text-right">
                      {item.percentageFormatted}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: BOTTOM SECTION (Project Performance 2/3 + Alerts & Lifecycle 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT (2/3): Hiệu quả theo dự án */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">Hiệu quả theo dự án</h2>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Dự án</th>
                  <th className="py-2.5 px-3">Giá trị HĐ</th>
                  <th className="py-2.5 px-3">Chi phí vật tư</th>
                  <th className="py-2.5 px-3">Chi phí nhân công</th>
                  <th className="py-2.5 px-3">Đã thu</th>
                  <th className="py-2.5 px-3 text-center">Biên LN</th>
                  <th className="py-2.5 pl-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.projectPerformance.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedProjectDetail(row)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    {/* Project Name + Thumbnail */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative border border-slate-100">
                          <Image
                            src={row.thumbnailUrl}
                            alt={row.name}
                            width={32}
                            height={32}
                            unoptimized
                            className="object-cover w-full h-full group-hover:scale-105 transition"
                          />
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-emerald-700 transition">
                          {row.name}
                        </span>
                      </div>
                    </td>

                    {/* Contract Value */}
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {row.contractValueFormatted}
                    </td>

                    {/* Material Cost */}
                    <td className="py-3 px-3 text-slate-600">
                      {row.materialCostFormatted}
                    </td>

                    {/* Labor Cost */}
                    <td className="py-3 px-3 text-slate-600">
                      {row.laborCostFormatted}
                    </td>

                    {/* Collected */}
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {row.collectedFormatted}
                    </td>

                    {/* Gross Margin */}
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {row.grossMarginFormatted}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 pl-3 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT (1/3): Cảnh báo quản trị & Quy trình quản lý dự án */}
        <div className="space-y-5">
          {/* CẢNH BÁO QUẢN TRỊ */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-800">Cảnh báo quản trị</h2>
              </div>
              <button
                type="button"
                onClick={() => showToast('Mở trung tâm quản lý cảnh báo toàn hệ thống...')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3 mt-3">
              {data.managementAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertDetail(alert)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${alert.iconBgClass}`}>
                      {alert.level === 'critical' ? (
                        <AlertCircle className={`w-4 h-4 ${alert.iconClass}`} />
                      ) : alert.level === 'warning' ? (
                        <Clock className={`w-4 h-4 ${alert.iconClass}`} />
                      ) : (
                        <Info className={`w-4 h-4 ${alert.iconClass}`} />
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-medium line-clamp-1">{alert.message}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ml-2 ${alert.badgeClass}`}>
                    {alert.badgeLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* QUY TRÌNH QUẢN LÝ DỰ ÁN */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">Quy trình quản lý dự án</h2>
            </div>

            <div className="grid grid-cols-5 gap-2 mt-4 text-center">
              {data.lifecycleSteps.map((step) => (
                <div key={step.stepNumber} className="flex flex-col items-center group">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs mb-1.5 transition group-hover:scale-105">
                    {step.stepNumber === 1 && <FileText className="w-4 h-4" />}
                    {step.stepNumber === 2 && <Headset className="w-4 h-4" />}
                    {step.stepNumber === 3 && <Wrench className="w-4 h-4" />}
                    {step.stepNumber === 4 && <CheckCircle2 className="w-4 h-4" />}
                    {step.stepNumber === 5 && <BarChart3 className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 leading-tight">
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL: PROJECT DETAILS */}
      {selectedProjectDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden relative">
                  <Image
                    src={selectedProjectDetail.thumbnailUrl}
                    alt={selectedProjectDetail.name}
                    width={40}
                    height={40}
                    unoptimized
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{selectedProjectDetail.name}</h3>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    {selectedProjectDetail.statusLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProjectDetail(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-slate-400 font-medium">Giá trị hợp đồng</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {selectedProjectDetail.contractValueFormatted}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-slate-400 font-medium">Đã thu khách hàng</p>
                <p className="text-sm font-bold text-emerald-700 mt-1">
                  {selectedProjectDetail.collectedFormatted}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-slate-400 font-medium">Chi phí vật tư</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {selectedProjectDetail.materialCostFormatted}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-slate-400 font-medium">Chi phí nhân công</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {selectedProjectDetail.laborCostFormatted}
                </p>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <span className="text-slate-600 font-semibold">Biên lợi nhuận gộp thực tế:</span>
                <span className="text-base font-black text-emerald-700">
                  {selectedProjectDetail.grossMarginFormatted}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedProjectDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: ALERT DETAILS */}
      {selectedAlertDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${selectedAlertDetail.iconBgClass}`}>
                <AlertCircle className={`w-5 h-5 ${selectedAlertDetail.iconClass}`} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Chi tiết cảnh báo quản trị</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedAlertDetail.badgeClass}`}>
                  {selectedAlertDetail.badgeLabel}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 my-4 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {selectedAlertDetail.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertDetail(null);
                  showToast('Đã gửi thông báo xử lý tới Project Manager phụ trách.');
                }}
                className="px-3.5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 transition"
              >
                Giao việc xử lý
              </button>
              <button
                type="button"
                onClick={() => setSelectedAlertDetail(null)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
