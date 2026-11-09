'use client';

/**
 * Bella Interior OS — Điều phối Sản xuất xưởng (Platform Manufacturing)
 *
 * Executive Production Dashboard — 7-Stage Workshop Pipeline & Analytics.
 * Canonical truth: InteriorProductionAnalyticsService → /api/interior/production/analytics
 * Zero UI Calculation: all formatting, colors, SVG paths pre-computed server-side.
 *
 * HARD CONSTRAINTS:
 * - DO NOT modify src/components/layout/sidebar.tsx
 * - No math in this file; all numbers come pre-formatted from the API
 * - Light theme: bg-[#F8FAFC], green primary #2D7A4F
 */

import React, { Fragment, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { ProductionOverviewResponse } from '@/products/bella-interior/domain/production-overview.types';

// ─── Icon Components (inline SVG, zero deps) ─────────────────────────────────

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconPackage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function IconTruck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function IconCpu({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  );
}

function IconClipboardCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconBarChart2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconLineChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconMoreHorizontal({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
    </svg>
  );
}

function IconFilter({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

// ─── Stage Icon Selector ──────────────────────────────────────────────────────

function StageIcon({ iconName, className }: { iconName: string; className?: string }) {
  switch (iconName) {
    case 'lock': return <IconLock className={className} />;
    case 'cpu': return <IconCpu className={className} />;
    case 'settings': return <IconSettings className={className} />;
    case 'grid': return <IconGrid className={className} />;
    case 'clipboard-check': return <IconClipboardCheck className={className} />;
    case 'package': return <IconPackage className={className} />;
    case 'truck': return <IconTruck className={className} />;
    default: return <IconSettings className={className} />;
  }
}

// ─── Alert Icon Selector ──────────────────────────────────────────────────────

function AlertIcon({ iconType, className }: { iconType: string; className?: string }) {
  if (iconType === 'circle-alert') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    );
  }
  if (iconType === 'triangle-alert') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ProductionDashboardPage() {
  const [data, setData] = useState<ProductionOverviewResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/production/analytics', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json() as { success: boolean; data: { overview: ProductionOverviewResponse } };
        if (json.success && json.data?.overview) {
          setData(json.data.overview);
          return;
        }
      }
      setData(null);
    } catch {
      setData(null);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (!hasLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#2D7A4F] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-8">
        <p role="alert" className="max-w-lg text-center text-sm text-slate-600">
          Dữ liệu sản xuất chưa khả dụng hoặc bạn chưa được cấp quyền đọc.
        </p>
      </div>
    );
  }

  const { kpis, workflowStages, efficiencyMetrics, timelineChart, ordersTable, alerts, workshopCapacities, architectureNotice } = data;

  // ─── Chart SVG dimensions (must match service constants) ────────────────
  const SVG_W = 320;
  const SVG_H = 100;
  const PAD_X = 20;
  const PAD_Y = 10;

  // ─── Donut SVG ──────────────────────────────────────────────────────────
  const DONUT_R = 52;
  const DONUT_CX = 70;
  const DONUT_CY = 70;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Back button */}
        <Link
          href="/dashboard/interior"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          title="Quay lại Tổng quan"
        >
          <IconArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>

        {/* Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-slate-800 truncate">
            Điều phối Sản xuất xưởng (Platform Manufacturing)
          </h1>
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
            {architectureNotice.bridgeBadgeLabel}
          </span>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
          <span className="text-slate-500 text-xs mr-1">Dự án:</span>
          <span className="font-medium">{data.projectHeader.selectorLabel}</span>
          <IconChevronDown className="w-4 h-4 text-slate-400 ml-1" />
        </div>

        {/* Action buttons */}
        <button
          onClick={() => void fetchData()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <IconRefresh className="w-4 h-4" />
          Làm mới
        </button>
        <button
          type="button"
          disabled
          title="Chưa có giao diện chọn project, approved revision và BOM thực tế"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-400 text-white rounded-lg text-sm font-medium opacity-70 cursor-not-allowed"
        >
          <IconPlus className="w-4 h-4" />
          Phát lệnh — chưa khả dụng
        </button>
        <Link
          href="/dashboard/interior/installation"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <IconBarChart2 className="w-4 h-4" />
          Tiến Độ Lắp Đặt Hiện Trường
        </Link>
      </div>

      {/* ═══ ARCHITECTURE NOTICE BANNER ═══════════════════════════════════════ */}
      <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <IconShield className="w-4 h-4 text-[#2D7A4F]" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800 mb-0.5">{architectureNotice.title}</p>
          <p className="text-xs text-green-700 leading-relaxed">
            {architectureNotice.description.split('Interior OS').map((part, i) => (
              <Fragment key={`io-part-${i}`}>
                {i > 0 && <span className="underline cursor-pointer text-green-800">Interior OS</span>}
                {part.split('Platform Manufacturing OS').map((sub, j) => (
                  <Fragment key={`pm-sub-${j}`}>
                    {j > 0 && <span className="underline cursor-pointer text-green-800">Platform Manufacturing OS</span>}
                    {sub.split('Approved Design Lock').map((s2, k) => (
                      <Fragment key={`al-s2-${k}`}>
                        {k > 0 && <span className="underline cursor-pointer text-green-800 font-medium">Approved Design Lock</span>}
                        {s2}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </p>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[kpis.totalOrders, kpis.inProductionOrders, kpis.completedOrders, kpis.needsAttentionOrders].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg ${kpi.bgClass} flex items-center justify-center`}>
                {kpi.iconName === 'list-checks' && <IconList className={`w-5 h-5 ${kpi.iconClass}`} />}
                {kpi.iconName === 'play-circle' && (
                  <svg className={`w-5 h-5 ${kpi.iconClass}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                  </svg>
                )}
                {kpi.iconName === 'check-circle' && (
                  <svg className={`w-5 h-5 ${kpi.iconClass}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {kpi.iconName === 'alert-triangle' && (
                  <svg className={`w-5 h-5 ${kpi.iconClass}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                )}
              </div>
              {/* Sparkline */}
              <svg width="80" height="28" viewBox="0 0 80 28" className="opacity-50">
                <path d={kpi.sparklineSvgPath} fill="none"
                  stroke={kpi.iconName === 'alert-triangle' ? '#f59e0b' : '#2D7A4F'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">{kpi.formattedValue}</div>
            <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
            <div className={`text-xs font-medium ${kpi.trendColorClass} flex items-center gap-0.5`}>
              <span>{kpi.trendDirection === 'up' ? '↑' : '↓'}</span>
              <span>{kpi.trendLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 7-STAGE WORKFLOW PIPELINE ═══════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <IconSettings className="w-4 h-4 text-[#2D7A4F]" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Quy trình sản xuất 7 công đoạn</h2>
          </div>
          <button className="text-xs text-[#2D7A4F] hover:underline font-medium">Xem chi tiết →</button>
        </div>

        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {workflowStages.map((stage, idx) => (
            <div key={stage.key} className="flex items-center">
              {/* Stage node */}
              <div className="flex flex-col items-center gap-2 min-w-[72px]">
                <div className={`relative w-12 h-12 rounded-full ${stage.iconBgClass} border-2 ${stage.borderClass} flex items-center justify-center transition-all`}>
                  {stage.status === 'completed' ? (
                    <IconCheck className={`w-5 h-5 ${stage.iconColorClass}`} />
                  ) : (
                    <StageIcon iconName={stage.iconName} className={`w-5 h-5 ${stage.iconColorClass}`} />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-medium text-slate-700 leading-tight text-center whitespace-nowrap">
                    {stage.stageNumber}. {stage.label}
                  </div>
                  {stage.statusBadge && (
                    <span className="mt-0.5 inline-block px-1.5 py-0.5 text-[9px] font-medium bg-green-100 text-green-700 rounded-full">
                      {stage.statusBadge}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow connector */}
              {idx < workflowStages.length - 1 && (
                <div className="mx-1 text-slate-300 text-lg font-light select-none">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ EFFICIENCY + TIMELINE ROW ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">
        {/* Efficiency Donut */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <IconBarChart2 className="w-4 h-4 text-[#2D7A4F]" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">{efficiencyMetrics.title}</h2>
          </div>

          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative shrink-0">
              <svg width="140" height="140" viewBox="0 0 140 140">
                {/* Background track */}
                <circle
                  cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
                  fill="none" stroke="#e2e8f0" strokeWidth="14"
                />
                {/* Filled arc */}
                <circle
                  cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
                  fill="none" stroke="#2D7A4F" strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={efficiencyMetrics.donutDashArray}
                  strokeDashoffset={efficiencyMetrics.donutDashOffset}
                  transform={`rotate(-90 ${DONUT_CX} ${DONUT_CY})`}
                />
                {/* Center label */}
                <text x={DONUT_CX} y={DONUT_CY - 6} textAnchor="middle" className="font-bold" fontSize="22" fontWeight="700" fill="#1e293b">
                  {efficiencyMetrics.overallRateFormatted}
                </text>
                <text x={DONUT_CX} y={DONUT_CY + 14} textAnchor="middle" fontSize="10" fill="#64748b">
                  {efficiencyMetrics.overallRateLabel}
                </text>
              </svg>
              <div className={`text-center text-xs font-medium ${efficiencyMetrics.trendColorClass} -mt-2`}>
                ↑ {efficiencyMetrics.trendLabel}
              </div>
            </div>

            {/* Stage bars */}
            <div className="flex-1 space-y-3">
              {efficiencyMetrics.stages.map((stage) => (
                <div key={stage.stageName}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{stage.stageName}</span>
                    <span className="font-medium text-slate-800">{stage.percentageFormatted}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: stage.percentageFormatted, backgroundColor: stage.barColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <IconLineChart className="w-4 h-4 text-[#2D7A4F]" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{timelineChart.title}</h2>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer">
              {timelineChart.range}
              <IconChevronDown className="w-3 h-3 ml-0.5" />
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-slate-300 border-dashed border-t-2 border-slate-300" />
              <span className="text-xs text-slate-500">{timelineChart.legendPlanned}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-[#2D7A4F]" />
              <span className="text-xs text-slate-500">{timelineChart.legendActual}</span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ height: '120px' }}
              preserveAspectRatio="none"
            >
              {/* Y-axis grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = PAD_Y + ((100 - pct) / 100) * (SVG_H - 2 * PAD_Y);
                return (
                  <line key={pct} x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                    stroke="#e2e8f0" strokeWidth="0.5" />
                );
              })}

              {/* Planned path (dashed) */}
              <path
                d={timelineChart.plannedSvgPath}
                fill="none" stroke="#94a3b8" strokeWidth="1.5"
                strokeDasharray="4,3" strokeLinecap="round" strokeLinejoin="round"
              />

              {/* Actual path (solid green) */}
              <path
                d={timelineChart.actualSvgPath}
                fill="none" stroke="#2D7A4F" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />

              {/* Area fill under actual */}
              <path
                d={`${timelineChart.actualSvgPath} L ${(SVG_W - PAD_X).toFixed(1)} ${SVG_H - PAD_Y} L ${PAD_X} ${SVG_H - PAD_Y} Z`}
                fill="url(#prodGradient)" opacity="0.15"
              />
              <defs>
                <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2D7A4F" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#2D7A4F" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Data points */}
              {timelineChart.points.map((pt) => (
                <circle key={pt.dayLabel} cx={pt.xCoord} cy={pt.yActualCoord}
                  r="3" fill="#2D7A4F" stroke="white" strokeWidth="1.5" />
              ))}

              {/* X-axis labels */}
              {timelineChart.points.map((pt) => (
                <text key={`lbl-${pt.dayLabel}`} x={pt.xCoord} y={SVG_H - 1}
                  textAnchor="middle" fontSize="7" fill="#94a3b8">
                  {pt.dayLabel}
                </text>
              ))}
            </svg>

            {/* Y-axis labels (absolute positioned) */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-slate-400 py-2 -translate-x-1">
              {timelineChart.yAxisLabels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PRODUCTION ORDERS TABLE ══════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-5">
        {/* Table header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <IconList className="w-4 h-4 text-[#2D7A4F]" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{ordersTable.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={ordersTable.searchPlaceholder}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#2D7A4F] w-52"
                />
              </div>
              {/* Filter */}
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                <IconFilter className="w-3.5 h-3.5" />
                {ordersTable.filterLabel}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {ordersTable.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#2D7A4F] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {ordersTable.headers.map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordersTable.rows
                .filter((row) => activeTab === 'all' || row.status === activeTab || (activeTab === 'delayed' && row.status === 'delayed'))
                .map((row, idx) => (
                  <tr key={row.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">{row.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.project}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.roomCategory}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.currentStageName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: row.progressFormatted, backgroundColor: row.progressBarColor }}
                          />
                        </div>
                        <span className="text-slate-700 font-medium">{row.progressFormatted}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.deadlineFormatted}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.statusBadgeClass}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                        <IconMoreHorizontal className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ALERTS + WORKSHOP CAPACITY ROW ══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Alerts */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <IconBell className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{alerts.title}</h2>
            </div>
            <button className="text-xs text-[#2D7A4F] hover:underline font-medium">{alerts.viewAllLabel}</button>
          </div>

          <div className="space-y-3">
            {alerts.items.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'danger'
                    ? 'bg-red-50 border border-red-100'
                    : alert.severity === 'warning'
                      ? 'bg-amber-50 border border-amber-100'
                      : 'bg-blue-50 border border-blue-100'
                }`}
              >
                <AlertIcon iconType={alert.iconType} className={`w-4 h-4 shrink-0 mt-0.5 ${alert.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700">{alert.message}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{alert.timeFormatted}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workshop Capacity Bar Chart */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <IconBarChart2 className="w-4 h-4 text-[#2D7A4F]" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">{workshopCapacities.title}</h2>
            </div>
            <button className="text-xs text-[#2D7A4F] hover:underline font-medium">{workshopCapacities.detailLabel}</button>
          </div>

          {/* Bar chart */}
          <div className="flex items-end justify-around gap-3 h-36 relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-slate-400">
              {workshopCapacities.yAxisLabels.map((lbl) => <span key={lbl}>{lbl}</span>)}
            </div>

            {/* Bars */}
            <div className="flex items-end justify-around gap-4 h-full flex-1 pl-6">
              {workshopCapacities.workshops.map((ws) => (
                <div key={ws.workshopName} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="text-xs font-semibold text-slate-700">{ws.capacityFormatted}</div>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${ws.heightPercent}%`,
                        backgroundColor: ws.barColor,
                        minHeight: '8px',
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 text-center">{ws.workshopName}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
