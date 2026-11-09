'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * Bella Interior OS — Hiện Trường Lắp Đặt & Nhật Ký Thi Công (Site Operations)
 *
 * Executive Site Operations & Installation Dashboard.
 * Canonical Source of Truth: InteriorInstallationAnalyticsService → /api/interior/installation/analytics
 * Enforces Zero UI Calculation: all math, formatting, badge colors, and Gantt
 * timeline coordinates are pre-computed in the Canonical Domain Service.
 *
 * HARD CONSTRAINTS:
 * - DO NOT touch src/components/layout/sidebar.tsx
 * - No calculation logic in UI layer
 * - Light theme: bg-[#F8FAFC], green primary #10b981 / #064e3b
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  InstallationOverviewResponse,
  RoomInstallationCard,
  InstallationAlertActivityItem,
  InstallationQuickActionCard,
} from '@/products/bella-interior/domain/installation-overview.types';

interface InstallationSiteDiary {
  id: string;
  date: string;
  supervisorName: string;
  workersPresent: number;
  weatherCondition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  activitiesCompleted: string[];
  issuesEncountered: string[];
  notes: string;
}

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

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function IconTool({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.303-3.084 1.123l-7.5 7.5a2.25 2.25 0 01-3.182-3.182l7.5-7.5c.82-.82 1.214-2.008 1.123-3.084A4.5 4.5 0 0117.25 2.25c.348 0 .684.04 1.008.115l-2.632 2.632a1.5 1.5 0 002.122 2.122l2.632-2.632c.075.324.115.66.115 1.008z" />
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

function IconPackage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
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

function IconImage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
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

export default function InteriorInstallationPage() {
  const [data, setData] = useState<InstallationOverviewResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'diaries'>('rooms');
  const [showNewDiaryModal, setShowNewDiaryModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [siteDiaries, setSiteDiaries] = useState<InstallationSiteDiary[]>([]);
  const [diariesLoading, setDiariesLoading] = useState(false);
  const [diariesUnavailable, setDiariesUnavailable] = useState(false);

  // Diary Form State
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [diaryWorkers, setDiaryWorkers] = useState('');
  const [diaryWeather, setDiaryWeather] = useState('');
  const [diaryActivities, setDiaryActivities] = useState('');
  const [diaryIssues, setDiaryIssues] = useState('');
  const [diaryNotes, setDiaryNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/installation/analytics', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; data: { overview: InstallationOverviewResponse } };
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

  const fetchSiteDiaries = useCallback(async (projectId: string) => {
    setDiariesLoading(true);
    setDiariesUnavailable(false);
    try {
      const response = await fetch(
        `/api/interior/delivery/site-diary?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' },
      );
      const result = (await response.json()) as {
        success?: boolean;
        data?: InstallationSiteDiary[];
      };
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        setSiteDiaries([]);
        setDiariesUnavailable(true);
        return;
      }
      setSiteDiaries(result.data);
    } catch {
      setSiteDiaries([]);
      setDiariesUnavailable(true);
    } finally {
      setDiariesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'diaries' || !data?.projectHeader.id) return;
    void fetchSiteDiaries(data.projectHeader.id);
  }, [activeTab, data?.projectHeader.id, fetchSiteDiaries]);

  // Handle Create Diary Submission
  const handleCreateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    try {
      const res = await fetch('/api/interior/delivery/site-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: data.projectHeader.id,
          date: diaryDate,
          workersPresent: Number(diaryWorkers),
          weatherCondition: diaryWeather,
          activitiesCompleted: diaryActivities.split('\n').filter((a) => a.trim().length > 0),
          issuesEncountered: diaryIssues.split('\n').filter((i) => i.trim().length > 0),
          notes: diaryNotes,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setShowNewDiaryModal(false);
        setFeedback({ type: 'success', message: 'Đã lưu nhật ký thi công công trình hôm nay!' });
        await fetchSiteDiaries(data.projectHeader.id);
      } else {
        setFeedback({ type: 'error', message: json.error || 'Không thể lưu nhật ký thi công.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Không thể kết nối để lưu nhật ký thi công.' });
    }
  };

  if (!hasLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-8">
        <p role="alert" className="max-w-lg text-center text-sm text-slate-600">
          Dữ liệu lắp đặt chưa khả dụng hoặc bạn chưa được cấp quyền đọc.
        </p>
      </div>
    );
  }

  const { projectHeader, kpis, overallProgress, rooms, timelineChart, alerts, quickActions } = data;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-6 space-y-5 font-sans">
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
            {feedback.type === 'success' ? (
              <IconCheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <IconAlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:text-slate-600 p-1">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ═══ 1. HEADER ROW ═══════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        {/* Left: Back button & Title & Project selector */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/interior"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs"
          >
            <IconArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>

          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
              {/* Tiêu đề chính */}
              Hiện Trường Lắp Đặt &amp; Nhật Ký Thi Công
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
              {projectHeader.badgeLabel}
            </span>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
            <span className="text-slate-400">Dự án:</span>
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center text-[9px] font-bold">
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
            onClick={() => setShowNewDiaryModal(true)}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Ghi Nhật Ký Hôm Nay
          </button>
          <Link
            href="/dashboard/interior/qc-handover"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Nghiệm Thu QC &amp; Punch List
            <IconArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ═══ 2. SUB-HEADER TABS ══════════════════════════════════════════════ */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'rooms'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <IconTool className="w-4 h-4 text-emerald-400" />
          <span>Kế Hoạch &amp; Tiến Độ Từng Phòng</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'rooms' ? 'bg-[#10b981] text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {rooms.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diaries')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'diaries'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <IconCalendar className="w-4 h-4 text-slate-400" />
          <span>Nhật Ký Thi Công Hiện Trường (Site Diary)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {siteDiaries.length}
          </span>
        </button>
      </div>

      {/* ═══ 3. MAIN CONTENT: TABS ═══════════════════════════════════════════ */}
      {activeTab === 'rooms' ? (
        <>
          {/* ═══ 4 KPI CARDS ROW ═════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tổng số phòng */}
            <div className="relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex items-center justify-between">
              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-xs">
                  <IconHome className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-blue-600 leading-tight">
                    {kpis.totalRooms.formattedValue}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{kpis.totalRooms.label}</div>
                </div>
              </div>
              {/* Subtle background illustration watermark */}
              <div className="absolute right-2 -bottom-2 opacity-5 pointer-events-none">
                <IconHome className="w-24 h-24 text-blue-900" />
              </div>
            </div>

            {/* Card 2: Đang thi công */}
            <div className="relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex items-center justify-between">
              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <IconTool className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                    {kpis.installingRooms.formattedValue}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{kpis.installingRooms.label}</div>
                </div>
              </div>
              <div className="absolute right-2 -bottom-2 opacity-5 pointer-events-none">
                <div className="w-24 h-24 rounded-full border-8 border-emerald-900" />
              </div>
            </div>

            {/* Card 3: Hoàn thành */}
            <div className="relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex items-center justify-between">
              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <IconCheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                    {kpis.completedRooms.formattedValue}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{kpis.completedRooms.label}</div>
                </div>
              </div>
              <div className="absolute right-2 -bottom-2 opacity-5 pointer-events-none">
                <IconCheckCircle className="w-24 h-24 text-emerald-900" />
              </div>
            </div>

            {/* Card 4: Cần chú ý */}
            <div className="relative bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden flex items-center justify-between">
              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <IconAlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-amber-500 leading-tight">
                    {kpis.attentionRooms.formattedValue}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{kpis.attentionRooms.label}</div>
                </div>
              </div>
              <div className="absolute right-2 -bottom-2 opacity-5 pointer-events-none">
                <IconAlertTriangle className="w-24 h-24 text-amber-900" />
              </div>
            </div>
          </div>

          {/* ═══ 5. SECTION: TIẾN ĐỘ THI CÔNG THEO PHÒNG ═════════════════════ */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-600 rounded-full" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Tiến độ thi công theo phòng</h2>
              </div>

              {/* Overall Project Progress Bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 font-medium">
                  {overallProgress.title}{' '}
                  <span className="font-extrabold text-slate-900">{overallProgress.progressFormatted}</span>
                </span>
                <div className="w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: overallProgress.progressFormatted,
                      backgroundColor: overallProgress.progressBarColor,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 4 Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rooms.map((room: RoomInstallationCard) => (
                <div
                  key={room.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col justify-between"
                >
                  {/* Image container with status badge & arrow button */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img
                      src={room.imageUrl}
                      alt={room.roomName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${room.statusBadgeClass}`}>
                        {room.statusLabel}
                      </span>
                      <button className="w-6 h-6 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-xs transition-colors">
                        <IconArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{room.code}</div>
                      <h3 className="font-bold text-slate-800 text-sm">{room.roomName}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{room.assignee}</p>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Tiến độ hoàn thiện</span>
                        <span className="font-bold text-slate-800">{room.progressFormatted}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: room.progressFormatted,
                            backgroundColor: room.progressBarColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <IconPackage className="w-3.5 h-3.5 text-slate-400" />
                        <span>{room.modulesFormatted}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{room.deadlineFormatted}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ 6. MIDDLE ROW: GANTT TIMELINE & ALERTS ══════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Timeline Chart (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-600 rounded-full" />
                  <h2 className="text-sm font-bold text-slate-900">{timelineChart.title}</h2>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 cursor-pointer">
                  <span>{timelineChart.rangeLabel}</span>
                  <IconChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </div>
              </div>

              {/* Gantt Timeline Container */}
              <div className="space-y-3 pt-2">
                {/* Header Columns */}
                <div className="grid grid-cols-12 text-center text-[11px] text-slate-400 border-b border-slate-100 pb-2">
                  <div className="col-span-3 text-left pl-2 font-medium">Hạng mục</div>
                  <div className="col-span-9 grid grid-cols-7 gap-1 font-mono">
                    {timelineChart.days.map((d) => (
                      <div key={d.dateKey} className="flex flex-col items-center">
                        <span className="font-bold text-slate-700 text-xs">{d.label}</span>
                        <span className="text-[10px] text-slate-400">{d.dayOfWeek}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                <div className="space-y-3.5">
                  {timelineChart.rows.map((row) => (
                    <div key={row.roomCode} className="grid grid-cols-12 items-center">
                      <div className="col-span-3 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="truncate">{row.roomCode}</span>
                      </div>
                      <div className="col-span-9 relative h-5 flex items-center">
                        {/* Background track line */}
                        <div className="absolute inset-x-0 h-1 bg-slate-100 rounded-full" />

                        {/* Gantt Span Bar */}
                        <div
                          className={`absolute h-2.5 rounded-full ${row.barBgClass} flex items-center justify-between px-0.5`}
                          style={{
                            left: `${row.leftPercent}%`,
                            width: `${row.widthPercent}%`,
                            opacity: row.isFaintTrack ? 0.35 : 1,
                          }}
                        >
                          {row.hasStartMarker && (
                            <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
                          )}
                          {row.hasEndMarker && (
                            <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Alerts & Recent Activity (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-600 rounded-full" />
                  <h2 className="text-sm font-bold text-slate-900">{alerts.title}</h2>
                </div>
                <button className="text-xs text-emerald-600 hover:underline font-semibold">
                  {alerts.viewAllLabel}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {alerts.items.map((alert: InstallationAlertActivityItem) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100/80 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-6 h-6 rounded-lg ${alert.iconBgClass} flex items-center justify-center shrink-0 mt-0.5`}>
                        {alert.iconType === 'alert-triangle' && (
                          <IconAlertTriangle className={`w-3.5 h-3.5 ${alert.iconClass}`} />
                        )}
                        {alert.iconType === 'check-circle' && (
                          <IconCheckCircle className={`w-3.5 h-3.5 ${alert.iconClass}`} />
                        )}
                        {alert.iconType === 'file-text' && (
                          <IconFileText className={`w-3.5 h-3.5 ${alert.iconClass}`} />
                        )}
                        {alert.iconType === 'image' && (
                          <IconImage className={`w-3.5 h-3.5 ${alert.iconClass}`} />
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-tight font-medium line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono mt-0.5">
                      {alert.timeFormatted}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ 7. BOTTOM ROW: QUICK ACTION NAVIGATION CARDS ═════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action: InstallationQuickActionCard) => (
              <Link
                key={action.id}
                href={action.href}
                className={`bg-gradient-to-br ${action.bgGradientClass} p-4 rounded-2xl border ${action.borderColorClass} shadow-xs hover:shadow-md transition-all group flex items-center justify-between`}
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {action.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    {action.actionLabel}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white shadow-2xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {action.iconType === 'calendar' && (
                    <IconCalendar className={`w-5 h-5 ${action.iconColorClass}`} />
                  )}
                  {action.iconType === 'alert-triangle' && (
                    <IconAlertTriangle className={`w-5 h-5 ${action.iconColorClass}`} />
                  )}
                  {action.iconType === 'bar-chart' && (
                    <IconBarChart className={`w-5 h-5 ${action.iconColorClass}`} />
                  )}
                  {action.iconType === 'image' && (
                    <IconImage className={`w-5 h-5 ${action.iconColorClass}`} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        /* ═══ SITE DIARY VIEW TAB ══════════════════════════════════════════ */
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Lịch Sử Nhật Ký Công Trình</h3>
              <p className="text-xs text-slate-500 mt-0.5">Bảo lưu hồ sơ hiện trường, nhật trình và ảnh thực tế</p>
            </div>
            <button
              onClick={() => setShowNewDiaryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <IconPlus className="w-3.5 h-3.5" />
              Ghi Nhật Ký Hôm Nay
            </button>
          </div>

          {diariesLoading ? (
            <div role="status" className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-500">
              Đang tải nhật ký đã lưu…
            </div>
          ) : diariesUnavailable ? (
            <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              Không thể tải nhật ký. Hãy thử làm mới.
              <button
                type="button"
                onClick={() => void fetchSiteDiaries(projectHeader.id)}
                className="ml-2 font-semibold underline"
              >
                Thử lại
              </button>
            </div>
          ) : siteDiaries.length === 0 ? (
            <div role="status" className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-500">
              Chưa có nhật ký được lưu cho dự án này.
            </div>
          ) : (
            <ul className="space-y-4" aria-label="Nhật ký thi công đã lưu">
              {siteDiaries.map((diary) => (
                <li key={diary.id} className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={diary.date} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-700">
                        {diary.date}
                      </time>
                      <span className="font-medium text-slate-600">{diary.workersPresent} nhân công</span>
                      <span className="text-slate-400" aria-hidden="true">•</span>
                      <span className="text-slate-600">Thời tiết: {diary.weatherCondition}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Người ghi: {diary.supervisorName}</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">Công việc đã hoàn thành:</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-slate-600">
                      {diary.activitiesCompleted.map((activity, index) => (
                        <li key={`${diary.id}-activity-${index}`}>{activity}</li>
                      ))}
                    </ul>
                  </div>
                  {diary.issuesEncountered.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      <span className="font-bold">Tồn đọng / vướng mắc: </span>
                      {diary.issuesEncountered.join('; ')}
                    </div>
                  )}
                  {diary.notes && diary.issuesEncountered.length === 0 && (
                    <p className="text-xs text-slate-600">Ghi chú: {diary.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ═══ 8. MODAL: GHI NHẬT KÝ HÔM NAY ═══════════════════════════════════ */}
      {showNewDiaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <IconCalendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Ghi Nhật Ký Thi Công Hiện Trường</h3>
              </div>
              <button
                onClick={() => setShowNewDiaryModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDiary} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Ngày ghi nhật ký</label>
                  <input
                    type="date"
                    value={diaryDate}
                    onChange={(e) => setDiaryDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Số lượng nhân công</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={diaryWorkers}
                    onChange={(e) => setDiaryWorkers(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Thời tiết</label>
                <select
                  value={diaryWeather}
                  onChange={(e) => setDiaryWeather(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                >
                  <option value="" disabled>Chọn thời tiết</option>
                  <option value="sunny">Nắng</option>
                  <option value="cloudy">Nhiều mây</option>
                  <option value="rainy">Mưa</option>
                  <option value="stormy">Dông bão</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Hạng mục đã hoàn thành</label>
                <textarea
                  rows={2}
                  value={diaryActivities}
                  onChange={(e) => setDiaryActivities(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tồn đọng / vướng mắc</label>
                <textarea
                  rows={2}
                  value={diaryIssues}
                  onChange={(e) => setDiaryIssues(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Ghi chú phối hợp</label>
                <input
                  type="text"
                  value={diaryNotes}
                  onChange={(e) => setDiaryNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiaryModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  Lưu Nhật Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
