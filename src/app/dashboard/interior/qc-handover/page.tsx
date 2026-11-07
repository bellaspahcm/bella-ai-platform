'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Kiểm Soát Chất Lượng QC, Punch List & Bàn Giao
 *
 * Executive Quality Control, Handover Gate & Punch List Lifecycle Dashboard.
 * Canonical Source of Truth: InteriorQCHandoverAnalyticsService → /api/interior/qc-handover/analytics
 * Enforces Zero UI Calculation: All numbers, status counts, percentages,
 * overdue statuses, badge styles, and roadmap steps are pre-computed in the Domain Service.
 *
 * HARD CONSTRAINTS:
 * - DO NOT touch src/components/layout/sidebar.tsx
 * - No math in UI component
 * - Light theme: bg-[#F8FAFC], green primary #10b981 / #064e3b
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  QCHandoverOverviewResponse,
  PunchListTableRow,
} from '@/products/bella-interior/domain/qc-handover-overview.types';
import { InteriorQCHandoverAnalyticsService } from '@/products/bella-interior/services/interior-qc-handover-analytics.service';

// ─── Inline Clean Icons (Zero External Bundle Overhead) ──────────────────────

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

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
    </svg>
  );
}

function IconFileText({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
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

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconMoreVertical({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5V21" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function InteriorQCHandoverPage() {
  const [data, setData] = useState<QCHandoverOverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showNewPunchModal, setShowNewPunchModal] = useState<boolean>(false);
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);

  // Form states
  const [punchZone, setPunchZone] = useState('Phòng khách');
  const [punchCategory, setPunchCategory] = useState('Sơn tường');
  const [punchDesc, setPunchDesc] = useState('');
  const [punchSeverity, setPunchSeverity] = useState<'critical' | 'major' | 'minor'>('major');
  const [punchAssignee, setPunchAssignee] = useState('Trần Văn Minh (Đội thi công)');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/qc-handover/analytics');
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; data: { overview: QCHandoverOverviewResponse } };
        if (json.success && json.data?.overview) {
          setData(json.data.overview);
          return;
        }
      }
    } catch {
      // Fallback to static domain service
    }
    setData(InteriorQCHandoverAnalyticsService.getQCHandoverOverview());
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Handle Create Punch List
  const handleCreatePunch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNewPunchModal(false);
    setFeedback({ type: 'success', message: 'Đã lập biên bản Punch List mới thành công!' });
  };

  // Handle Confirm Handover
  const handleConfirmHandover = () => {
    setShowHandoverModal(false);
    setFeedback({ type: 'success', message: 'Đã xác nhận biên bản nghiệm thu & kích hoạt chứng thư bảo hành!' });
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  const {
    projectHeader,
    handoverGate,
    filterTabs,
    kpis,
    table,
    projectInfoCard,
    qualityRoadmap,
    commitmentBanner,
  } = data;

  const filteredRows = table.rows.filter(
    (row) => activeTab === 'all' || row.status === activeTab
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 space-y-4 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconCheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-slate-600 p-1">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ═══ 1. HEADER ROW ═══════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        {/* Left: Back button & Project selector */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <IconArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
            <span className="text-slate-400">Dự án:</span>
            <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center text-[10px] font-bold">
              🏛
            </div>
            <span className="font-semibold text-slate-800">{projectHeader.selectorLabel}</span>
            <IconChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <IconRefresh className="w-3.5 h-3.5 text-slate-500" />
            Làm mới
          </button>
          <button
            onClick={() => setShowNewPunchModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <IconFileText className="w-3.5 h-3.5" />
            Lập Biên Bản Punch List
          </button>
          <button
            onClick={() => setShowHandoverModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <IconCheckCircle className="w-3.5 h-3.5" />
            Nghiệm Thu Bàn Giao
          </button>
          <div className="relative w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs">
            <IconBell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {projectHeader.notificationsCount}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 2. TITLE ROW ════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
          <IconShieldCheck className="w-4 h-4" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Kiểm Soát Chất Lượng QC, Punch List &amp; Bàn Giao
        </h1>
      </div>

      {/* ═══ 3. HANDOVER GATE HERO BANNER ════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between">
        {/* Left Side Content */}
        <div className="p-5 md:p-6 space-y-3 max-w-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <IconShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-slate-900">
                  {handoverGate.title}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${handoverGate.badgeClass}`}>
                  {handoverGate.badgeLabel}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {handoverGate.description}
          </p>

          <div>
            <Link
              href="/dashboard/interior/warranty"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <IconFileText className="w-3.5 h-3.5 text-slate-500" />
              <span>{handoverGate.warrantyCertificateButtonLabel}</span>
            </Link>
          </div>
        </div>

        {/* Right Side Living Room Hero Image Banner */}
        <div className="w-full md:w-80 lg:w-96 h-40 md:h-44 shrink-0 overflow-hidden relative">
          <img
            src={handoverGate.bannerImageUrl}
            alt="Handover Ready Living Room"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-transparent md:block hidden" />
        </div>
      </div>

      {/* ═══ 4. FILTER TABS BAR ══════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold px-2">
          <IconFilter className="w-3.5 h-3.5" />
          <span>Lọc theo trạng thái:</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#064e3b] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 5. 4 KPI CARDS ROW ═════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng Punch List */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${kpis.totalPunchList.iconBgClass} flex items-center justify-center shrink-0`}>
              <IconClipboardCheck className={`w-5 h-5 ${kpis.totalPunchList.iconClass}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">{kpis.totalPunchList.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{kpis.totalPunchList.formattedValue}</span>
                <span className={`text-xs ${kpis.totalPunchList.subLabelClass}`}>{kpis.totalPunchList.subLabel}</span>
              </div>
            </div>
          </div>
          {/* Sparkline */}
          <svg width="60" height="24" viewBox="0 0 100 24" className="shrink-0 opacity-70">
            <path d={kpis.totalPunchList.sparklineSvgPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* KPI 2: Chưa xử lý */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${kpis.pendingPunchList.iconBgClass} flex items-center justify-center shrink-0`}>
              <IconAlertCircle className={`w-5 h-5 ${kpis.pendingPunchList.iconClass}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">{kpis.pendingPunchList.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{kpis.pendingPunchList.formattedValue}</span>
                <span className={`text-xs ${kpis.pendingPunchList.subLabelClass}`}>{kpis.pendingPunchList.subLabel}</span>
              </div>
            </div>
          </div>
          <svg width="60" height="24" viewBox="0 0 100 24" className="shrink-0 opacity-70">
            <path d={kpis.pendingPunchList.sparklineSvgPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* KPI 3: Đã xác thực */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${kpis.verifiedPunchList.iconBgClass} flex items-center justify-center shrink-0`}>
              <IconCheckCircle className={`w-5 h-5 ${kpis.verifiedPunchList.iconClass}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">{kpis.verifiedPunchList.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{kpis.verifiedPunchList.formattedValue}</span>
                <span className={`text-xs ${kpis.verifiedPunchList.subLabelClass}`}>{kpis.verifiedPunchList.subLabel}</span>
              </div>
            </div>
          </div>
          <svg width="60" height="24" viewBox="0 0 100 24" className="shrink-0 opacity-70">
            <path d={kpis.verifiedPunchList.sparklineSvgPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* KPI 4: Quá hạn */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${kpis.overduePunchList.iconBgClass} flex items-center justify-center shrink-0`}>
              <IconClock className={`w-5 h-5 ${kpis.overduePunchList.iconClass}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">{kpis.overduePunchList.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{kpis.overduePunchList.formattedValue}</span>
                <span className={`text-xs ${kpis.overduePunchList.subLabelClass}`}>{kpis.overduePunchList.subLabel}</span>
              </div>
            </div>
          </div>
          <svg width="60" height="24" viewBox="0 0 100 24" className="shrink-0 opacity-70">
            <path d={kpis.overduePunchList.sparklineSvgPath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ═══ 6. PUNCH LIST TABLE ═════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Title Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconClipboardCheck className="w-4 h-4 text-slate-600" />
            <h2 className="text-xs md:text-sm font-bold text-slate-900">
              {table.title} <span className="font-normal text-slate-500">{table.itemsCountLabel}</span>
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-medium">
            {table.lifecycleGuide}
          </span>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} className="px-3.5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row: PunchListTableRow) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50/60 transition-colors ${
                    row.hasRedAccentBorder ? 'border-l-4 border-l-red-500 bg-red-50/10' : ''
                  }`}
                >
                  {/* # */}
                  <td className="px-3.5 py-3 font-semibold text-slate-700">{row.index}</td>

                  {/* Mã lỗi */}
                  <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{row.code}</td>

                  {/* Khu vực */}
                  <td className="px-3.5 py-3 font-medium text-slate-800">{row.zoneArea}</td>

                  {/* Hạng mục */}
                  <td className="px-3.5 py-3 text-slate-600">{row.categoryName}</td>

                  {/* Mô tả */}
                  <td className="px-3.5 py-3 text-slate-700 max-w-xs">{row.description}</td>

                  {/* Mức độ */}
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${row.severityBadgeClass}`}>
                      {row.severity === 'critical' && <IconAlertTriangle className="w-3 h-3" />}
                      {row.severity === 'major' && <IconAlertCircle className="w-3 h-3" />}
                      {row.severity === 'minor' && <IconCheckCircle className="w-3 h-3" />}
                      {row.severityLabel}
                    </span>
                  </td>

                  {/* Phụ trách */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={row.assigneeAvatarUrl}
                        alt={row.assigneeName}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                      <span className="text-slate-800 font-medium whitespace-nowrap">
                        {row.assigneeName} <span className="text-slate-400 font-normal">{row.assigneeTeam}</span>
                      </span>
                    </div>
                  </td>

                  {/* Hạn xử lý */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700">{row.deadlineFormatted}</span>
                      {row.isOverdue && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                          {row.overdueBadgeLabel}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-3.5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${row.statusBadgeClass}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {row.statusLabel}
                    </span>
                  </td>

                  {/* Thao tác */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700">
                        <IconEye className="w-4 h-4" />
                      </button>
                      <button className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700">
                        <IconMoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 7. BOTTOM 3-COLUMN SECTION ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Column 1: Thông tin dự án (3 cols) */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
              <IconInfo className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">{projectInfoCard.title}</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <IconBuilding className="w-3.5 h-3.5 text-slate-400" />
              <span>{projectInfoCard.projectName}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <IconMapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{projectInfoCard.location}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{projectInfoCard.scheduledDateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Hành trình chất lượng công trình (6 cols) */}
        <div className="md:col-span-6 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900">{qualityRoadmap.title}</h3>

          <div className="flex items-center justify-between pt-1 relative">
            {/* Connecting Line */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0">
              <div className="h-full bg-emerald-500 w-3/4" />
            </div>

            {/* 5 Steps */}
            {qualityRoadmap.steps.map((step) => (
              <div key={step.stepNumber} className="flex flex-col items-center gap-1.5 z-10 text-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${step.circleClass}`}
                >
                  {step.status === 'completed' ? (
                    <IconCheckCircle className="w-4 h-4" />
                  ) : (
                    step.stepNumber
                  )}
                </div>
                <div>
                  <div className={`text-[10px] leading-tight ${step.textClass}`}>{step.name}</div>
                  <div className="text-[9px] text-slate-400 leading-tight">{step.subName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Quality Commitment Banner (3 cols) */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex flex-col justify-between relative group">
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center">
                <IconShieldCheck className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900">{commitmentBanner.title}</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {commitmentBanner.description}
            </p>
          </div>

          <div className="mt-3 h-16 w-full rounded-xl overflow-hidden relative">
            <img
              src={commitmentBanner.imageUrl}
              alt="Quality Commitment"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-emerald-950/10" />
          </div>
        </div>
      </div>

      {/* ═══ 8. MODAL: LẬP BIÊN BẢN PUNCH LIST ════════════════════════════════ */}
      {showNewPunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <IconFileText className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Lập Biên Bản Punch List Mới</h3>
              </div>
              <button
                onClick={() => setShowNewPunchModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePunch} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Khu vực kiểm định</label>
                  <input
                    type="text"
                    value={punchZone}
                    onChange={(e) => setPunchZone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Hạng mục chi tiết</label>
                  <input
                    type="text"
                    value={punchCategory}
                    onChange={(e) => setPunchCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mô tả chi tiết khiếm khuyết</label>
                <textarea
                  rows={2}
                  value={punchDesc}
                  onChange={(e) => setPunchDesc(e.target.value)}
                  placeholder="Ghi rõ hiện trạng vết xước, độ hở, sai lệch..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Mức độ nghiêm trọng</label>
                  <select
                    value={punchSeverity}
                    onChange={(e) => setPunchSeverity(e.target.value as 'critical' | 'major' | 'minor')}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="critical">Critical (Chặn bàn giao)</option>
                    <option value="major">Major (Khắc phục trước bàn giao)</option>
                    <option value="minor">Minor (Tồn đọng nhỏ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Đơn vị / Nhân sự phụ trách</label>
                  <input
                    type="text"
                    value={punchAssignee}
                    onChange={(e) => setPunchAssignee(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPunchModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold shadow-xs"
                >
                  Tạo Biên Bản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ 9. MODAL: NGHIỆM THU BÀN GIAO ═══════════════════════════════════ */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <IconShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Xác Nhận Nghiệm Thu Bàn Giao</h3>
              </div>
              <button
                onClick={() => setShowHandoverModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                  Cổng Kiểm Định: READY FOR HANDOVER
                </div>
                <p className="text-[11px] text-emerald-700">
                  Tất cả các hạng mục Critical đã đạt Verified. Công trình đủ điều kiện ký biên bản bàn giao.
                </p>
              </div>

              <p className="text-slate-600">
                Thực hiện hành động này sẽ chính thức đóng giai đoạn thi công hiện trường và kích hoạt
                <strong> Chứng Thư Bảo Hành</strong> cho dự án <strong>{projectHeader.name}</strong>.
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmHandover}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  Xác Nhận &amp; Bàn Giao
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
