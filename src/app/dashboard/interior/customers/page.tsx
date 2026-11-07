'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Users,
  Plus,
  Search,
  ArrowLeft,
  Briefcase,
  Handshake,
  Trophy,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  Info,
  CheckCircle2,
  DollarSign,
  PieChart as PieChartIcon,
  Lightbulb,
  MoreHorizontal,
  ChevronDown,
  Bell,
  List,
  LayoutGrid,
  PhoneCall,
  UserCheck,
  HeartHandshake,
} from 'lucide-react';

import type {
  CustomerOverviewResponse,
  CustomerItem,
  CustomerType,
  CustomerStatus,
} from '@/products/bella-interior';
import { InteriorCustomerAnalyticsService } from '@/products/bella-interior';

export default function CustomersPage() {
  const [data, setData] = useState<CustomerOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Fetch canonical analytics from server API
  useEffect(() => {
    let isMounted = true;

    async function fetchCustomerOverview() {
      try {
        const res = await fetch('/api/interior/customers');
        if (res.ok) {
          const json: CustomerOverviewResponse = await res.json();
          if (isMounted) {
            setData(json);
            setIsLoading(false);
          }
        } else {
          // Fallback to canonical service
          if (isMounted) {
            setData(InteriorCustomerAnalyticsService.getCustomerOverview('tenant-fallback'));
            setIsLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setData(InteriorCustomerAnalyticsService.getCustomerOverview('tenant-fallback'));
          setIsLoading(false);
        }
      }
    }

    fetchCustomerOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  // Canonical fallback if loading
  const activeData: CustomerOverviewResponse = useMemo(() => {
    if (data) return data;
    return InteriorCustomerAnalyticsService.getCustomerOverview('tenant-preloaded');
  }, [data]);

  // Filter customers by search and category
  const filteredCustomers = useMemo(() => {
    return activeData.customers.filter((c: CustomerItem) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.managerName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'all' || c.type === (typeFilter as CustomerType);
      const matchesStatus = statusFilter === 'all' || c.status === (statusFilter as CustomerStatus);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activeData.customers, searchQuery, typeFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Khách hàng &amp; Chủ đầu tư
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Quản trị vòng đời khách hàng, phát triển quan hệ và tối ưu doanh thu
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Top user profile header matching mock image */}
          <div className="hidden sm:flex items-center gap-3 pr-2">
            <button
              type="button"
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <Image
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces"
                  alt="Nguyễn Văn Quang"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nguyễn Văn Quang
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Thêm khách hàng
          </button>
        </div>
      </div>

      {/* ─── Row 1: 4 KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng khách hàng */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeData.kpis.totalCustomers.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeData.kpis.totalCustomers.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {activeData.kpis.totalCustomers.label}
            </div>
          </div>
          {/* Mini Sparkline Wave (Blue) */}
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12 L 100 24 L 0 24 Z"
                fill="url(#blue-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="blue-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 2: Khách hàng tiềm năng */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeData.kpis.potentialCustomers.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeData.kpis.potentialCustomers.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {activeData.kpis.potentialCustomers.label}
            </div>
          </div>
          {/* Mini Sparkline Wave (Green) */}
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 19 Q 25 10, 50 14 T 100 6 L 100 24 L 0 24 Z"
                fill="url(#green-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 19 Q 25 10, 50 14 T 100 6"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="green-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 3: Đang giao dịch */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Handshake className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeData.kpis.activeTransacting.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeData.kpis.activeTransacting.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {activeData.kpis.activeTransacting.label}
            </div>
          </div>
          {/* Mini Sparkline Wave (Purple) */}
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 16 Q 30 18, 55 10 T 100 8 L 100 24 L 0 24 Z"
                fill="url(#purple-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 16 Q 30 18, 55 10 T 100 8"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="purple-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 4: Khách hàng VIP */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeData.kpis.vipCustomers.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeData.kpis.vipCustomers.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {activeData.kpis.vipCustomers.label}
            </div>
          </div>
          {/* Mini Sparkline Wave (Amber) */}
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 17 Q 35 15, 60 7 T 100 11 L 100 24 L 0 24 Z"
                fill="url(#amber-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 17 Q 35 15, 60 7 T 100 11"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="amber-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Row 2: Sales Funnel & Customer Growth Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Phễu kinh doanh (Funnel) - 5 Cols */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Phễu kinh doanh</h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              Tháng này
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Funnel Shapes (Col 8) */}
            <div className="sm:col-span-8 flex flex-col items-center gap-1.5 w-full">
              {activeData.salesFunnel.steps.map((step) => {
                // Width progression for funnel trapezoids
                const widths = ['w-full', 'w-[84%]', 'w-[68%]', 'w-[52%]', 'w-[38%]'];
                const bgColors = [
                  'bg-blue-600 text-white',
                  'bg-emerald-500 text-white',
                  'bg-amber-500 text-white',
                  'bg-purple-500 text-white',
                  'bg-indigo-600 text-white',
                ];
                const widthClass = widths[step.stepNumber - 1] || 'w-full';
                const bgClass = bgColors[step.stepNumber - 1] || 'bg-blue-600 text-white';

                return (
                  <div
                    key={step.stepNumber}
                    className={`h-7 ${widthClass} ${bgClass} rounded-md flex items-center justify-center text-[11px] font-bold shadow-2xs transition-all hover:brightness-105`}
                  >
                    <span>
                      {step.count} {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Funnel Metrics & Award (Col 4) */}
            <div className="sm:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left justify-center pl-0 sm:pl-2">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {activeData.salesFunnel.conversionRatePercent}%
              </div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                Tỷ lệ chuyển đổi
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {activeData.salesFunnel.conversionRateTrend}
              </div>

              {/* Award Pill */}
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                <Trophy className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <div className="text-[11px] leading-tight">
                  <span className="font-bold block">
                    {activeData.salesFunnel.targetAchievementLabel}
                  </span>
                  <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90">
                    {activeData.salesFunnel.targetAchievementSub}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tăng trưởng khách hàng & doanh thu (Combo Bar/Line) - 7 Cols */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tăng trưởng khách hàng &amp; doanh thu
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Khách hàng
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Doanh thu (Tỷ VNĐ)
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                {activeData.growthChart.timeRangeLabel}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>

          {/* SVG Combined Bar & Line Chart */}
          <div className="mt-4 relative h-48 w-full">
            <svg viewBox="0 0 520 180" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="60" x2="490" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="100" x2="490" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="140" x2="490" y2="140" stroke="#e2e8f0" strokeWidth="1" />

              {/* Y Axis Left (Khách hàng) */}
              <text x="30" y="24" fontSize="9" textAnchor="end" fill="#94a3b8">150</text>
              <text x="30" y="64" fontSize="9" textAnchor="end" fill="#94a3b8">100</text>
              <text x="30" y="104" fontSize="9" textAnchor="end" fill="#94a3b8">50</text>
              <text x="30" y="144" fontSize="9" textAnchor="end" fill="#94a3b8">0</text>

              {/* Y Axis Right (Doanh thu) */}
              <text x="500" y="24" fontSize="9" textAnchor="start" fill="#94a3b8">3</text>
              <text x="500" y="64" fontSize="9" textAnchor="start" fill="#94a3b8">2</text>
              <text x="500" y="104" fontSize="9" textAnchor="start" fill="#94a3b8">1</text>
              <text x="500" y="144" fontSize="9" textAnchor="start" fill="#94a3b8">0</text>

              {/* Bars & Line Points */}
              {activeData.growthChart.dataPoints.map((pt, idx) => {
                const totalPoints = activeData.growthChart.dataPoints.length;
                const slotWidth = (490 - 50) / totalPoints;
                const x = 50 + idx * slotWidth + slotWidth / 2;
                // Bar height mapping: 0 -> 140, 150 -> 20 (range 120)
                const barHeight = (pt.customerCount / 150) * 120;
                const barY = 140 - barHeight;

                return (
                  <g key={pt.month}>
                    {/* Blue Bar */}
                    <rect
                      x={x - 9}
                      y={barY}
                      width={18}
                      height={barHeight}
                      rx={3}
                      fill="#60a5fa"
                      className="hover:fill-blue-500 transition-colors cursor-pointer"
                    />
                    {/* X Axis Label */}
                    <text x={x} y="158" fontSize="9" textAnchor="middle" fill="#64748b" fontWeight="600">
                      {pt.month}
                    </text>
                  </g>
                );
              })}

              {/* Revenue Trend Line */}
              {(() => {
                const points = activeData.growthChart.dataPoints.map((pt, idx) => {
                  const totalPoints = activeData.growthChart.dataPoints.length;
                  const slotWidth = (490 - 50) / totalPoints;
                  const x = 50 + idx * slotWidth + slotWidth / 2;
                  // Revenue 0 -> 140, 3 -> 20 (range 120)
                  const y = 140 - (pt.revenueBillion / 3) * 120;
                  return { x, y, pt };
                });

                const pathString = points.reduce((acc, curr, i) => {
                  return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                }, '');

                return (
                  <g>
                    <path
                      d={pathString}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5 transition-all"
                      />
                    ))}
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Row 3: Toolbar & Filters ─── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm khách hàng, điện thoại, email..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <option value="all">Loại khách hàng ⌵</option>
              <option value="enterprise">Doanh nghiệp</option>
              <option value="individual">Cá nhân</option>
              <option value="organization">Tổ chức</option>
            </select>
          </div>

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              Nguồn khách hàng ⌵
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              Người phụ trách ⌵
            </button>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <option value="all">Trạng thái ⌵</option>
              <option value="transacting">Đang giao dịch</option>
              <option value="lead">Tiềm năng</option>
              <option value="negotiating">Đang đàm phán</option>
              <option value="re_engagement">Chăm sóc lại</option>
            </select>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
          >
            Bộ lọc khác ⌵
          </button>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label="Xem dạng danh sách"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label="Xem dạng lưới"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Row 4: Customer Table & Alerts Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Customer Table (Col 9) */}
        <div className="lg:col-span-9 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">KHÁCH HÀNG</th>
                  <th className="py-3 px-3">PHÂN LOẠI</th>
                  <th className="py-3 px-3">NGUỒN KHÁCH HÀNG</th>
                  <th className="py-3 px-3">NGƯỜI PHỤ TRÁCH</th>
                  <th className="py-3 px-2 text-center">CƠ HỘI</th>
                  <th className="py-3 px-2 text-center">SỐ DỰ ÁN</th>
                  <th className="py-3 px-3">TỔNG GIÁ TRỊ</th>
                  <th className="py-3 px-3">CÔNG NỢ</th>
                  <th className="py-3 px-3">LẦN TƯƠNG TÁC</th>
                  <th className="py-3 px-3">TRẠNG THÁI</th>
                  <th className="py-3 px-2 text-center">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* KHÁCH HÀNG */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100">
                          <Image
                            src={cust.avatar}
                            alt={cust.name}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white leading-tight">
                            {cust.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {cust.code}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* PHÂN LOẠI */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cust.typeBadgeClass}`}
                      >
                        {cust.typeLabel}
                      </span>
                    </td>

                    {/* NGUỒN KHÁCH HÀNG */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cust.sourceClass}`}
                      >
                        {cust.source === 'referral' && <Users className="w-3 h-3" />}
                        {cust.source === 'marketing' && <PhoneCall className="w-3 h-3" />}
                        {cust.source === 'partner' && <HeartHandshake className="w-3 h-3" />}
                        {cust.source === 'returning' && <Clock className="w-3 h-3" />}
                        {cust.source === 'website' && <UserCheck className="w-3 h-3" />}
                        {cust.sourceLabel}
                      </span>
                    </td>

                    {/* NGƯỜI PHỤ TRÁCH */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                          <Image
                            src={cust.managerAvatar}
                            alt={cust.managerName}
                            fill
                            sizes="24px"
                            className="object-cover"
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {cust.managerName}
                        </span>
                      </div>
                    </td>

                    {/* CƠ HỘI */}
                    <td className="py-3.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {cust.opportunityCount}
                    </td>

                    {/* SỐ DỰ ÁN */}
                    <td className="py-3.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {cust.projectCount}
                    </td>

                    {/* TỔNG GIÁ TRỊ */}
                    <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {cust.totalValueFormatted}
                    </td>

                    {/* CÔNG NỢ */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {cust.hasDebt ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {cust.debtFormatted}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>

                    {/* LẦN TƯƠNG TÁC */}
                    <td className="py-3.5 px-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {cust.lastInteractionDate}
                    </td>

                    {/* TRẠNG THÁI */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cust.statusBadgeClass}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                        {cust.statusLabel}
                      </span>
                    </td>

                    {/* THAO TÁC */}
                    <td className="py-3.5 px-2 text-center">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Thao tác"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts & Action Items (Col 3) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Cảnh báo &amp; Công việc cần xử lý
              </h2>
            </div>
            <Link
              href="/dashboard/interior/schedule"
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {activeData.alerts.map((alert) => (
              <div key={alert.id} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {alert.severity === 'critical' && (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  )}
                  {alert.severity === 'warning' && (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  {alert.severity === 'info' && (
                    <Info className="w-4 h-4 text-blue-500" />
                  )}
                  {alert.severity === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {alert.date}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {alert.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Row 5: Financial Summary, Source Distribution & Action Suggestion ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {/* Card 1: Tổng quan tài chính khách hàng (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Tổng quan tài chính khách hàng
            </h2>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            {/* 3 Metric Columns */}
            <div className="space-y-3">
              <div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {activeData.financialSummary.totalContractValueFormatted}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  Tổng giá trị hợp đồng
                </div>
              </div>

              <div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {activeData.financialSummary.collectedFormatted}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  Đã thu
                </div>
              </div>

              <div>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                  {activeData.financialSummary.receivableDebtFormatted}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  Công nợ phải thu
                </div>
              </div>
            </div>

            {/* Circular Gauge 77% */}
            <div className="flex flex-col items-center">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Circle (77%) */}
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${activeData.financialSummary.collectionRatePercent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {activeData.financialSummary.collectionRatePercent}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                Tỷ lệ thu tiền
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Khách hàng tiềm năng theo nguồn (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Khách hàng tiềm năng theo nguồn
            </h2>
          </div>

          <div className="mt-4 flex items-center justify-around gap-4">
            {/* Donut Chart SVG */}
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* 42% Referral (#10b981) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeDasharray="42 58"
                  strokeDashoffset="0"
                />
                {/* 33% Marketing (#8b5cf6) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="5"
                  strokeDasharray="33 67"
                  strokeDashoffset="-42"
                />
                {/* 25% Website (#f59e0b) */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="5"
                  strokeDasharray="25 75"
                  strokeDashoffset="-75"
                />
              </svg>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {activeData.sourceDistribution.map((src) => (
                <div key={src.source} className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: src.color }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {src.label}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {src.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Gợi ý hành động (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2">
              <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {activeData.actionSuggestion.title}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {activeData.actionSuggestion.description}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Link
              href={activeData.actionSuggestion.ctaLink}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-colors"
            >
              {activeData.actionSuggestion.ctaLabel}
            </Link>
            {/* Decorative Mini Trend Vector */}
            <div className="w-12 h-8">
              <svg viewBox="0 0 50 30" className="w-full h-full text-blue-500/40">
                <path
                  d="M5 25 L15 18 L25 22 L45 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
