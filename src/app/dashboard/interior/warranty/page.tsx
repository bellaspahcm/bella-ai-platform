'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Bell,
  LayoutGrid,
  Home,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  Headset,
  DollarSign,
  MoreHorizontal,
  Wrench,
  Star,
  Info,
  ExternalLink,
  X,
  FileCheck2,
  UserCheck,
} from 'lucide-react';
import {
  WarrantyOverviewResponse,
  WarrantyCertificateRow,
} from '@/products/bella-interior/domain/warranty-overview.types';

export default function WarrantyDashboardPage() {
  const [data, setData] = useState<WarrantyOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('INT-2024-001');
  const [activeTab, setActiveTab] = useState<'certificates' | 'tickets'>('certificates');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modals
  const [selectedCertificate, setSelectedCertificate] = useState<WarrantyCertificateRow | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchOverview = async (projectId?: string) => {
    try {
      setLoading(true);
      const url = `/api/interior/warranty/analytics${projectId ? `?projectId=${projectId}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data?.overview) {
        setData(json.data.overview);
      }
    } catch (err) {
      console.error('Failed to fetch warranty overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedProjectId);
  }, [selectedProjectId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-4">
        <RotateCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Đang tải dữ liệu Bảo hành & Chăm sóc sau bàn giao...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-[#F8FAFC]">
        <p className="text-red-500 font-medium">Không thể tải dữ liệu bảo hành.</p>
        <button
          onClick={() => fetchOverview(selectedProjectId)}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          Thử lại
        </button>
      </div>
    );
  }

  // Filter certificates purely on presentation level based on search/status
  const displayedCertificates = data.certificates.filter((cert) => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const match =
        cert.certificateNo.toLowerCase().includes(q) ||
        cert.project.toLowerCase().includes(q) ||
        cert.client.toLowerCase().includes(q) ||
        cert.coverage.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedStatusFilter !== 'all' && cert.status !== selectedStatusFilter) {
      return false;
    }
    if (selectedProjectFilter !== 'all' && cert.project !== selectedProjectFilter) {
      return false;
    }
    if (selectedClientFilter !== 'all' && cert.client !== selectedClientFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans p-6 space-y-6">
      {/* ─── TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── TOP HEADER BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        {/* Left: Home & Project Selector */}
        <div className="flex items-center space-x-3">
          <button
            title="Trang chủ"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition"
          >
            <Home className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Dự án:</span>
            <div className="relative">
              <button
                type="button"
                className="flex items-center space-x-2.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 text-sm font-semibold text-slate-800 transition"
              >
                <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 relative">
                  <Image
                    src={data.project.thumbnailUrl}
                    alt={data.project.name}
                    width={24}
                    height={24}
                    className="object-cover"
                  />
                </div>
                <span>{data.project.name}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              fetchOverview(selectedProjectId);
              showToast('Dữ liệu đã được làm mới từ máy chủ');
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Làm mới</span>
          </button>

          <button
            title="Thông báo"
            className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {data.project.notificationCount}
            </span>
          </button>

          <button
            title="Menu ứng dụng"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── PAGE TITLE & EXPIRY ALERT ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Warranty & Aftercare
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5 max-w-2xl">
              Manage warranty certificates, track service tickets, and coordinate aftercare for completed interior projects.
            </p>
          </div>
        </div>

        {/* Expiry Alert Card (Right) */}
        <div className="flex items-center justify-between space-x-4 px-4 py-2.5 bg-amber-50 border border-amber-200/90 rounded-xl text-xs md:text-sm shadow-xs max-w-md">
          <div className="flex items-center space-x-2.5 text-amber-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{data.expiryAlert.message}</span>
          </div>
          <button
            onClick={() => {
              setSelectedStatusFilter('expiring_soon');
              showToast('Đang lọc các chứng thư sắp hết hạn (≤ 90 ngày)');
            }}
            className="text-amber-800 hover:text-amber-950 font-semibold whitespace-nowrap hover:underline flex items-center text-xs"
          >
            {data.expiryAlert.linkText}
          </button>
        </div>
      </div>

      {/* ─── 6 KPI CARDS ROW ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Tổng Chứng Thư */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.totalCertificates.label}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{data.kpis.totalCertificates.formattedValue}</span>
            <span className={`text-xs ${data.kpis.totalCertificates.subLabelClass}`}>
              {data.kpis.totalCertificates.subLabel}
            </span>
          </div>
        </div>

        {/* 2. Đang Hiệu Lực */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.activeCertificates.label}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">{data.kpis.activeCertificates.formattedValue}</span>
              <span className={`text-xs ${data.kpis.activeCertificates.subLabelClass}`}>
                {data.kpis.activeCertificates.subLabel}
              </span>
            </div>
            {/* Donut ring preview */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg className="w-6 h-6 transform -rotate-90">
                <circle cx="12" cy="12" r="9" stroke="#E2E8F0" strokeWidth="3" fill="transparent" />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeDasharray={56.5}
                  strokeDashoffset={56.5 * (1 - (data.kpis.activeCertificates.percentage || 91.7) / 100)}
                  fill="transparent"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* 3. Sắp Hết Hạn (≤ 90 ngày) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.expiringCertificates.label}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">{data.kpis.expiringCertificates.formattedValue}</span>
              <span className={`text-xs ${data.kpis.expiringCertificates.subLabelClass}`}>
                {data.kpis.expiringCertificates.subLabel}
              </span>
            </div>
            <div className="w-5 h-5 rounded-full border border-amber-300 text-amber-500 flex items-center justify-center text-[10px]">
              L
            </div>
          </div>
        </div>

        {/* 4. Đã Hết Hạn */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.expiredCertificates.label}</span>
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">{data.kpis.expiredCertificates.formattedValue}</span>
              <span className={`text-xs ${data.kpis.expiredCertificates.subLabelClass}`}>
                {data.kpis.expiredCertificates.subLabel}
              </span>
            </div>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* 5. Ticket Đang Mở */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.openTickets.label}</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Headset className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-900">{data.kpis.openTickets.formattedValue}</span>
              <span className={`text-xs ${data.kpis.openTickets.subLabelClass}`}>
                {data.kpis.openTickets.subLabel}
              </span>
            </div>
            <Headset className="w-4 h-4 text-sky-300" />
          </div>
        </div>

        {/* 6. Chi Phí Bảo Hành */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{data.kpis.warrantyCost.label}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4 font-bold" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900">{data.kpis.warrantyCost.formattedValue}</span>
            {/* Sparkline mini bars */}
            <div className="flex items-end space-x-1 h-6 pb-0.5">
              <div className="w-1.5 h-3 bg-emerald-200 rounded-xs" />
              <div className="w-1.5 h-5 bg-emerald-400 rounded-xs" />
              <div className="w-1.5 h-6 bg-emerald-500 rounded-xs" />
              <div className="w-1.5 h-4 bg-emerald-300 rounded-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── TABS & CONTROLS ───────────────────────────────────────────── */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setActiveTab('certificates')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'certificates'
              ? 'bg-[#064E3B] text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Chứng Thư Bảo Hành</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tickets');
            setIsNewTicketModalOpen(true);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            activeTab === 'tickets'
              ? 'bg-[#064E3B] text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Headset className="w-4 h-4 text-slate-500" />
          <span>Phiếu Dịch Vụ</span>
        </button>
      </div>

      {/* ─── FILTERS & SEARCH BAR ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm chứng thư, dự án, khách hàng..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Project Filter */}
        <select
          value={selectedProjectFilter}
          onChange={(e) => setSelectedProjectFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden cursor-pointer"
        >
          <option value="all">Tất cả dự án</option>
          {data.filterOptions.projects.filter((p) => p !== 'Tất cả dự án').map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Client Filter */}
        <select
          value={selectedClientFilter}
          onChange={(e) => setSelectedClientFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden cursor-pointer"
        >
          <option value="all">Tất cả khách hàng</option>
          {data.filterOptions.clients.filter((c) => c !== 'Tất cả khách hàng').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden cursor-pointer"
        >
          {data.filterOptions.statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Date Range Badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{data.filterOptions.dateRangeLabel}</span>
        </div>
      </div>

      {/* ─── MAIN CONTENT: TABLE (2/3) + RIGHT COLUMN (1/3) ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT 2 COLS: CERTIFICATES TABLE */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-3.5 w-10 text-center">#</th>
                  <th className="py-3 px-3">Mã Chứng Thư</th>
                  <th className="py-3 px-3">Dự Án</th>
                  <th className="py-3 px-3">Khách Hàng</th>
                  <th className="py-3 px-3">Ngày Bàn Giao</th>
                  <th className="py-3 px-3">Ngày BĐ Bảo Hành</th>
                  <th className="py-3 px-3">Ngày Hết Hạn</th>
                  <th className="py-3 px-3">Phạm Vi Bảo Hành</th>
                  <th className="py-3 px-3">Trạng Thái</th>
                  <th className="py-3 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCertificates.map((cert) => (
                  <tr
                    key={cert.certificateNo}
                    className="hover:bg-slate-50/60 transition group cursor-pointer"
                    onClick={() => setSelectedCertificate(cert)}
                  >
                    <td className="py-3 px-3.5 text-center font-medium text-slate-400">{cert.index}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">{cert.certificateNo}</td>
                    <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">{cert.project}</td>
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{cert.client}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{cert.handoverDate}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{cert.warrantyStartDate}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{cert.warrantyExpires}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={cert.coverage}>
                      {cert.coverage}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cert.statusBadgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cert.statusDotClass}`} />
                        <span>{cert.statusLabel}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Tùy chọn"
                        onClick={() => setSelectedCertificate(cert)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>{data.pagination.displayRange}</span>
            <div className="flex items-center space-x-1">
              <button className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 text-white font-semibold shadow-xs">
                1
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700">
                2
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700">
                3
              </button>
              <span className="px-1 text-slate-400">...</span>
              <button className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700">
                5
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: BANNER + WARRANTY CALENDAR */}
        <div className="space-y-6">
          {/* Card 1: Reassurance Banner "Bảo hành an tâm" */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-xs bg-[#EAF5F0] flex flex-col justify-between min-h-[170px] p-5">
            <div className="relative z-10 max-w-[65%]">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm mb-1">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>{data.reassuranceBanner.title}</span>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed font-normal">
                {data.reassuranceBanner.subtitle}
              </p>
              <button
                onClick={() => showToast('Cam kết bảo hành Bella: Bảo hành 24 tháng, cam kết mặt bằng xử lý trong 24h.')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#064E3B] hover:bg-emerald-950 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <span>{data.reassuranceBanner.buttonText}</span>
              </button>
            </div>

            {/* Background image right cut */}
            <div className="absolute right-0 top-0 bottom-0 w-2/5 overflow-hidden">
              <Image
                src={data.reassuranceBanner.imageUrl}
                alt="Bảo hành an tâm"
                fill
                className="object-cover object-center opacity-90"
              />
            </div>
          </div>

          {/* Card 2: Warranty Calendar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Lịch Bảo Hành</span>
              </div>
              <button
                onClick={() => showToast('Đang mở toàn bộ lịch bảo hành dự án')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-0.5"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Month Header */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3 px-1">
              <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>{data.calendar.monthLabel}</span>
              <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 mb-2">
              {data.calendar.daysOfWeek.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {data.calendar.days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-7 w-7" />;
                }
                return (
                  <div
                    key={`day-${day.dayNumber}`}
                    title={day.eventDescription || `Ngày ${day.dayNumber}`}
                    onClick={() => {
                      if (day.eventDescription) showToast(`${day.dayNumber}/11/2026: ${day.eventDescription}`);
                    }}
                    className={`h-7 w-7 mx-auto flex flex-col items-center justify-center rounded-full text-[11px] transition cursor-pointer relative ${
                      day.isHighlighted
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{day.dayNumber}</span>
                    {day.hasAmberDot && (
                      <span className="w-1 h-1 rounded-full bg-amber-500 absolute -bottom-1" />
                    )}
                    {day.hasRedDot && (
                      <span className="w-1 h-1 rounded-full bg-red-500 absolute -bottom-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM SECTION: ROADMAP (2/3) + RECENT ACTIVITIES (1/3) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT 2 COLS: QUY TRÌNH QUẢN LÝ BẢO HÀNH (5 STAGES) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-6">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Quy trình Quản lý Bảo hành</span>
            <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          </div>

          <div className="relative flex items-center justify-between px-4 sm:px-8">
            {/* Connecting green line across steps */}
            <div className="absolute left-8 right-8 top-5 h-0.5 bg-emerald-500 -z-0" />

            {data.roadmap.map((step) => {
              const renderStepIcon = (name: string) => {
                switch (name) {
                  case 'file-text':
                    return <FileText className="w-4 h-4" />;
                  case 'headset':
                    return <Headset className="w-4 h-4" />;
                  case 'wrench':
                    return <Wrench className="w-4 h-4" />;
                  case 'check-circle':
                    return <CheckCircle2 className="w-4 h-4" />;
                  case 'star':
                    return <Star className="w-4 h-4" />;
                  default:
                    return <CheckCircle2 className="w-4 h-4" />;
                }
              };

              return (
                <div key={step.stepNumber} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs mb-2">
                    {renderStepIcon(step.iconName)}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 max-w-[90px] leading-tight">
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT 1 COL: HOẠT ĐỘNG GẦN ĐÂY */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Hoạt động gần đây</span>
            </div>
            <button
              onClick={() => showToast('Đang tải toàn bộ nhật ký bảo hành')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-0.5"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3.5">
            {data.recentActivities.map((act) => (
              <div key={act.id} className="flex items-start justify-between space-x-3 text-xs">
                <div className="flex items-start space-x-2.5">
                  {act.avatarUrl ? (
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 relative mt-0.5 border border-slate-200">
                      <Image
                        src={act.avatarUrl}
                        alt="User"
                        width={24}
                        height={24}
                        className="object-cover"
                      />
                    </div>
                  ) : act.iconName === 'check-circle' ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar className="w-3 h-3" />
                    </div>
                  )}
                  <p className="text-slate-800 font-medium leading-relaxed">
                    {act.title}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 ml-2">
                  {act.timeAgo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MODAL: CERTIFICATE DETAIL ─────────────────────────────────── */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi Tiết Chứng Thư Bảo Hành</h3>
                  <p className="text-xs text-slate-500">{selectedCertificate.certificateNo}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCertificate(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Dự án:</span>
                <span className="font-semibold text-slate-800">{selectedCertificate.project}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Khách hàng:</span>
                <span className="font-semibold text-slate-800">{selectedCertificate.client}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Ngày bắt đầu:</span>
                <span className="font-semibold text-slate-800">{selectedCertificate.warrantyStartDate}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Ngày hết hạn:</span>
                <span className="font-semibold text-slate-800">{selectedCertificate.warrantyExpires}</span>
              </div>
              <div className="col-span-2 bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-400 block mb-1">Phạm vi bảo hành:</span>
                <span className="font-semibold text-slate-800">{selectedCertificate.coverage}</span>
              </div>
              <div className="col-span-2 bg-slate-50 p-3 rounded-lg flex items-center justify-between">
                <span className="text-slate-400">Trạng thái hiện tại:</span>
                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${selectedCertificate.statusBadgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedCertificate.statusDotClass}`} />
                  <span>{selectedCertificate.statusLabel}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setSelectedCertificate(null);
                  showToast(`Đã xuất PDF chứng thư ${selectedCertificate.certificateNo}`);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Xuất PDF Chứng Thư
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: NEW SERVICE TICKET ─────────────────────────────────── */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Headset className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tạo Phiếu Yêu Cầu Dịch Vụ (Service Ticket)</h3>
                  <p className="text-xs text-slate-500">Tiếp nhận yêu cầu bảo hành & sửa chữa sau bàn giao</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewTicketModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Dự án:</label>
                <input
                  type="text"
                  readOnly
                  value="The Horizon Residence (INT-2024-001)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Chứng thư liên quan:</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800">
                  <option>WC-2024-001 (Nội thất tổng thể — Đang hiệu lực)</option>
                  <option>WC-2024-002 (Nội thất & Thiết bị — Sắp hết hạn)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mô tả sự cố:</label>
                <textarea
                  rows={3}
                  placeholder="Nhập mô tả lỗi phát sinh từ khách hàng..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsNewTicketModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setIsNewTicketModalOpen(false);
                  showToast('Đã tạo thành công Phiếu dịch vụ #ST-2026-012');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Tạo Phiếu Dịch Vụ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
