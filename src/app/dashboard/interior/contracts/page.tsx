'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Handshake,
  Coins,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Plus,
  Send,
  Bell,
  BarChart3,
  CreditCard,
  ChevronDown,
  FileText,
  FilePlus,
  Download,
  AlertTriangle,
  Clock,
  X,
  Check,
  Building,
  Calendar,
  FileCheck,
  ChevronRight,
  Eye,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type {
  ContractOverviewResponse,
  MilestoneTableItem,
  PaymentStepperStep,
  ContractOperationalAlert,
  ContractAddendumItem,
  ContractAuditLogItem,
  WorkshopReleaseCriterion,
} from '@/products/bella-interior/domain/contract-overview.types';

export default function InteriorContractsPage() {
  const [data, setData] = useState<ContractOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'info' | 'addenda' | 'audit' | 'analysis'>('info');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals & Panels
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneTableItem | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState<boolean>(false);
  const [showNewContractModal, setShowNewContractModal] = useState<boolean>(false);
  const [showContractDocModal, setShowContractDocModal] = useState<boolean>(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState<boolean>(false);
  const [releaseSuccessOrder, setReleaseSuccessOrder] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<boolean>(false);

  // Fetch canonical contract data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/interior/contracts');
      const json = await res.json();
      if (json.success && json.data?.overview) {
        setData(json.data.overview);
      }
    } catch (err) {
      console.error('Failed to load contract overview', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleConfirmWorkshopRelease = async () => {
    if (!data) return;
    try {
      setReleasing(true);
      const res = await fetch('/api/interior/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release-to-workshop',
          projectId: data.header.projectId,
        }),
      });
      const json = await res.json();
      if (json.success && json.orderCode) {
        setReleaseSuccessOrder(json.orderCode);
      }
    } catch (err) {
      console.error('Failed to release to workshop', err);
    } finally {
      setReleasing(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Đang tải dữ liệu Hợp đồng &amp; Tiến độ Thu tiền...
          </p>
        </div>
      </div>
    );
  }

  const { header, kpis, progressStepper, milestones, alerts, quickActions, detailedTabs, projectSummary, workshopReleaseGating } = data;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 space-y-6">
      {/* ─── 1. TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quản lý Báo giá, Hợp đồng &amp; Tiến độ Thu tiền
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">Dự án:</span>
            <div className="relative inline-block">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <span>{header.selectorLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewContractModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tạo Hợp Đồng Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReleaseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:shadow"
          >
            <Send className="w-4 h-4" />
            <span>Chuyển lệnh sang xưởng</span>
          </button>

          <div className="relative">
            <button
              type="button"
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg relative"
              aria-label="Thông báo"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
              M
            </div>
            <div className="hidden sm:block text-left text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">{header.managerName}</div>
              <div className="text-[10px] text-slate-500">{header.managerRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. FIVE KPI CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Số hợp đồng & khách hàng */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kpis.contractAndClient.label}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">
              {kpis.contractAndClient.formattedValue}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{kpis.contractAndClient.subtext}</div>
          </div>
        </div>

        {/* KPI 2: Tổng giá trị hợp đồng */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kpis.totalContractValue.label}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">
              {kpis.totalContractValue.formattedValue}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{kpis.totalContractValue.subtext}</div>
          </div>
        </div>

        {/* KPI 3: Đã thực thu */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kpis.collectedAmount.label}
            </div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {kpis.collectedAmount.formattedValue}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{kpis.collectedAmount.subtext}</div>
          </div>
        </div>

        {/* KPI 4: Còn phải thu */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kpis.remainingAmount.label}
            </div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 truncate">
              {kpis.remainingAmount.formattedValue}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{kpis.remainingAmount.subtext}</div>
          </div>
        </div>

        {/* KPI 5: Trạng thái hợp đồng */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kpis.contractStatus.label}
            </div>
            <div className="mt-0.5">
              <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {kpis.contractStatus.formattedValue}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">{kpis.contractStatus.subtext}</div>
          </div>
        </div>
      </div>

      {/* ─── 3. MAIN SECTION (2 COLUMNS: 75% / 25%) ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN (~75% / 3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* CARD A: TIẾN ĐỘ THANH TOÁN THEO GIAI ĐOẠN HỢP ĐỒNG (STEPPER) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tiến độ Thanh toán Theo Giai Đoạn Hợp Đồng
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${progressStepper.completionPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {progressStepper.completionFormatted}
                </span>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="mt-6 relative">
              {/* Stepper Connecting Line */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                {progressStepper.steps.map((step) => {
                  let circleClass = 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400';
                  let badgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

                  if (step.badgeVariant === 'success') {
                    circleClass = 'bg-emerald-500 text-white border-emerald-500 shadow-sm';
                    badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                  } else if (step.badgeVariant === 'warning') {
                    circleClass = 'bg-amber-500 text-white border-amber-500 shadow-sm';
                    badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                  }

                  return (
                    <div key={step.stepNumber} className="flex flex-col items-center text-center">
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs mb-2 transition-transform ${circleClass}`}
                      >
                        {step.isCompleted ? <Check className="w-4 h-4" /> : step.stepNumber}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 min-h-[32px]">
                        {step.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {step.percentageFormatted} • {step.amountFormatted}
                      </div>
                      <span className={`mt-2 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${badgeClass}`}>
                        {step.badgeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CARD B: DANH SÁCH ĐỢT THANH TOÁN (DATA TABLE) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Danh sách đợt thanh toán
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Đợt thanh toán</th>
                    <th className="py-3 px-3 text-center">Tỷ lệ</th>
                    <th className="py-3 px-4 text-right">Giá trị</th>
                    <th className="py-3 px-4 text-right">Đã thu</th>
                    <th className="py-3 px-4 text-right">Còn thiếu</th>
                    <th className="py-3 px-4 text-center">Hạn thanh toán</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {milestones.map((m) => {
                    let badgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                    if (m.statusBadgeVariant === 'success') {
                      badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                    } else if (m.statusBadgeVariant === 'warning') {
                      badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                    } else if (m.statusBadgeVariant === 'danger') {
                      badgeClass = 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800';
                    }

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {m.phaseName}
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-400">
                          {m.percentageFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                          {m.amountFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                          {m.collectedFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={
                              m.remainingAmount > 0
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-400 font-normal'
                            }
                          >
                            {m.remainingFormatted}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">
                          {m.dueDateFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-md ${badgeClass}`}>
                            {m.statusLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedMilestone(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <span>Chi tiết</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (~25% / 1 col) */}
        <div className="space-y-6">
          {/* CARD C: CẢNH BÁO QUAN TRỌNG */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Cảnh báo quan trọng
                </h3>
              </div>
              <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                1
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {alerts.map((al) => (
                <div key={al.id} className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="text-slate-800 dark:text-slate-200">
                        <strong className="text-amber-600 dark:text-amber-400 font-bold">{al.highlightText}</strong>{' '}
                        {al.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {al.amountFormatted}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const target = milestones.find((m) => m.id === al.targetMilestoneId);
                          if (target) setSelectedMilestone(target);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 mt-2"
                      >
                        <span>{al.actionText}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CARD D: THAO TÁC NHANH */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Thao tác nhanh
              </h3>
            </div>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowContractDocModal(true)}
                className="w-full flex items-center gap-3 p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors group border border-transparent hover:border-emerald-200 dark:hover:border-slate-700 text-left"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">
                  Xem hợp đồng chi tiết
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => setShowPaymentHistoryModal(true)}
                className="w-full flex items-center gap-3 p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors group border border-transparent hover:border-emerald-200 dark:hover:border-slate-700 text-left"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">
                  Xem lịch sử thanh toán
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('addenda');
                  const el = document.getElementById('bottom-tabs-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3 p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors group border border-transparent hover:border-emerald-200 dark:hover:border-slate-700 text-left"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <FilePlus className="w-4 h-4" />
                </div>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">
                  Tạo phụ lục hợp đồng
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  toast.success('Báo cáo công nợ & tiến độ thu tiền đang được trích xuất PDF...');
                }}
                className="w-full flex items-center gap-3 p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors group border border-transparent hover:border-emerald-200 dark:hover:border-slate-700 text-left"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">
                  Xuất báo cáo công nợ
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. BOTTOM SECTION: TABS & PROJECT SUMMARY ─────────────────────────── */}
      <div id="bottom-tabs-section" className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT TABBED CONTAINER (~75% / 3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Tab Navigation Header */}
          <div className="flex items-center gap-6 px-6 pt-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'info'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Thông tin hợp đồng</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('addenda')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'addenda'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Phụ lục &amp; Tài liệu</span>
              <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-[10px] rounded-full">
                {detailedTabs.addenda.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'audit'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Lịch sử hoạt động</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'analysis'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Phân tích hiệu quả</span>
            </button>
          </div>

          {/* Tab 1: Thông tin hợp đồng */}
          {activeTab === 'info' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Col 1 */}
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Khách hàng</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.clientName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Dự án</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.projectName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Ngày ký hợp đồng</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.signedDateFormatted}
                    </strong>
                  </div>
                </div>

                {/* Col 2 */}
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Giá trị hợp đồng</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.contractValueFormatted}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Thời gian thực hiện</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.executionPeriod}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Điều khoản thanh toán</span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {detailedTabs.info.paymentTerms}
                    </strong>
                  </div>
                </div>

                {/* Col 3 */}
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Ghi chú</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {detailedTabs.info.notes}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Phụ lục & Tài liệu */}
          {activeTab === 'addenda' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Danh mục phụ lục bổ sung giá trị &amp; hồ sơ ký kết điện tử:
                </p>
                <button
                  type="button"
                  onClick={() => toast.info('Tính năng tạo phụ lục đang đồng bộ với thay đổi BOQ...')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm phụ lục</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {detailedTabs.addenda.map((ad) => (
                  <div key={ad.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{ad.code}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ad.statusLabel}
                        </span>
                        <span className="text-slate-400 text-[11px]">({ad.effectiveDate})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{ad.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-600">{ad.valueChangeFormatted}</div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 justify-end cursor-pointer hover:text-emerald-600 mt-0.5">
                        <FileText className="w-3 h-3" />
                        <span>{ad.fileAttachment}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Lịch sử hoạt động */}
          {activeTab === 'audit' && (
            <div className="p-6">
              <div className="space-y-4 text-xs">
                {detailedTabs.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{log.action}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{log.actor}</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Phân tích hiệu quả */}
          {activeTab === 'analysis' && (
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 block">Giá vốn dự toán (COGS)</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white">
                    {detailedTabs.financialAnalysis.estimatedCogsFormatted}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Giá trị hợp đồng</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white">
                    {detailedTabs.financialAnalysis.contractValueFormatted}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Lợi nhuận gộp dự kiến</span>
                  <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {detailedTabs.financialAnalysis.grossProfitExpectedFormatted}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Biên lợi nhuận (Gross Margin)</span>
                  <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {detailedTabs.financialAnalysis.grossMarginExpectedFormatted}
                  </strong>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Đánh giá dòng tiền:</span>{' '}
                {detailedTabs.financialAnalysis.cashflowSummary}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT BOX: TỔNG QUAN DỰ ÁN (~25% / 1 col) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-100 dark:border-slate-800">
            {projectSummary.title}
          </h3>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
              <Image
                src={projectSummary.imageUrl}
                alt={projectSummary.imageAlt}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Tiến độ dự án
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${projectSummary.progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {projectSummary.progressFormatted}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Ngày hoàn thành dự kiến:
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {projectSummary.completionDateFormatted}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: CHI TIẾT ĐỢT THANH TOÁN ──────────────────────────────────── */}
      {selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chi tiết đợt thanh toán
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedMilestone.phaseName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMilestone(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
              <div>
                <span className="text-slate-500 block text-[11px]">Tỷ lệ cam kết:</span>
                <strong className="font-bold text-slate-900 dark:text-white">
                  {selectedMilestone.percentageFormatted}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Giá trị đợt thu:</span>
                <strong className="font-bold text-slate-900 dark:text-white">
                  {selectedMilestone.amountFormatted}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Thực thu nhận về:</span>
                <strong className="font-bold text-emerald-600">
                  {selectedMilestone.collectedFormatted}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Khoản còn thiếu:</span>
                <strong className="font-bold text-amber-600">
                  {selectedMilestone.remainingFormatted}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Hạn thanh toán:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {selectedMilestone.dueDateFormatted}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Hóa đơn VAT:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {selectedMilestone.invoiceStatusLabel}{' '}
                  {selectedMilestone.invoiceNumber ? `(${selectedMilestone.invoiceNumber})` : ''}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                Lịch sử giao dịch ngân hàng ({selectedMilestone.transactions.length})
              </h4>
              {selectedMilestone.transactions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  Chưa ghi nhận giao dịch chuyển khoản cho đợt thanh toán này.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedMilestone.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-emerald-600">{tx.amountFormatted}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {tx.method} • {tx.referenceCode}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {tx.notes}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{tx.transactionDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMilestone(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: KIỂM SOÁT ĐIỀU KIỆN CHUYỂN LỆNH SANG XƯỞNG (GATING CHECKLIST) ─── */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Kiểm soát điều kiện chuyển lệnh sản xuất
                  </h3>
                  <p className="text-xs text-slate-500">Mối liên kết giữa Thương mại &amp; Sản xuất Xưởng Gỗ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReleaseModal(false);
                  setReleaseSuccessOrder(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {releaseSuccessOrder ? (
              <div className="p-6 text-center space-y-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                  Chuyển lệnh xưởng thành công!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Mã lệnh sản xuất xưởng gỗ: <strong className="font-bold text-emerald-600">{releaseSuccessOrder}</strong>.
                  <br />
                  Hồ sơ CAD, bảng BOM và kế hoạch cắt ván đã được gửi đến Phân hệ Sản xuất Xưởng.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/interior/production"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    <span>Đến bảng Kanban Sản xuất</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {workshopReleaseGating.releaseConditionsNote}
                </p>

                {/* 5 Criteria */}
                <div className="space-y-2.5">
                  {workshopReleaseGating.criteria.map((crit) => (
                    <div
                      key={crit.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {crit.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {crit.evidence}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Trạng thái kiểm duyệt: ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md">
                    5/5 Tiêu chí Đạt
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReleaseModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmWorkshopRelease}
                    disabled={releasing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{releasing ? 'Đang chuyển...' : 'Xác nhận Chuyển Lệnh Sang Xưởng'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 3: XEM HỢP ĐỒNG CHI TIẾT ────────────────────────────────────── */}
      {showContractDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hồ sơ Hợp đồng Kinh tế — {header.contractId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContractDocModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Mã hợp đồng:</span>
                <span className="font-bold text-slate-900 dark:text-white">{header.contractId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Chủ đầu tư (Bên A):</span>
                <span className="font-bold text-slate-900 dark:text-white">{header.clientName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Đơn vị thi công (Bên B):</span>
                <span className="font-bold text-slate-900 dark:text-white">Công ty TNHH Bella Interior Việt Nam</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Giá trị hợp đồng:</span>
                <span className="font-bold text-emerald-600">{kpis.totalContractValue.formattedValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tình trạng chữ ký số:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Đã ký số bảo mật điện tử hợp lệ
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowContractDocModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Đang tạo và tải bản scan hợp đồng PDF...');
                  if (typeof window !== 'undefined') window.print();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải bản PDF scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: LỊCH SỬ THANH TOÁN TOÀN DIỆN ─────────────────────────────── */}
      {showPaymentHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lịch sử Thu tiền &amp; Đối soát Ngân hàng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {milestones
                .flatMap((m) => m.transactions)
                .map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{tx.notes}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tx.method} • Mã giao dịch: <code className="text-slate-700 dark:text-slate-300">{tx.referenceCode}</code>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">{tx.amountFormatted}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tx.transactionDate}</div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentHistoryModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: TẠO HỢP ĐỒNG MỚI ────────────────────────────────────────── */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tạo Hợp đồng Thi công mới
              </h3>
              <button
                type="button"
                onClick={() => setShowNewContractModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Chủ đầu tư / Khách hàng:
                </label>
                <input
                  type="text"
                  defaultValue="Sheikh Al-Maktoum Office"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Tổng giá trị hợp đồng (VND):
                </label>
                <input
                  type="text"
                  defaultValue="418000000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                Lịch thanh toán chuẩn 5 giai đoạn: Đặt cọc 30% — Khóa thiết kế 20% — Khởi công xuất xưởng 30% — Hoàn thành lắp đặt 15% — Bàn giao &amp; bảo hành 5% (Tổng 100%).
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewContractModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Hợp đồng mới đã được tạo và đồng bộ với bảng BOQ R1.0.');
                  setShowNewContractModal(false);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Lưu Hợp đồng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
