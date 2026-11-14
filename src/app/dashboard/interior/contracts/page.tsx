'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import CommercialWorkflowModal from './commercial-workflow-modal';
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
  FolderOpen,
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

interface InteriorProjectOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export default function InteriorContractsPage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectOptions, setProjectOptions] = useState<InteriorProjectOption[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ContractOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'addenda' | 'audit' | 'analysis'>('info');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals & Panels
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneTableItem | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState<boolean>(false);
  const [showNewContractModal, setShowNewContractModal] = useState<boolean>(false);
  const [showContractDocModal, setShowContractDocModal] = useState<boolean>(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState<boolean>(false);
  const [showPaymentEntry, setShowPaymentEntry] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReferenceCode, setPaymentReferenceCode] = useState('');
  const [paymentTransactionDate, setPaymentTransactionDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [releaseSuccessOrder, setReleaseSuccessOrder] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<boolean>(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch contract data for the selected project
  const loadData = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/interior/contracts?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      if (!res.ok) {
        setFetchError(`HTTP ${res.status}`);
        setData(null);
        return;
      }
      const json = await res.json();
      if (json.success && json.data?.overview) {
        setData(json.data.overview);
      } else {
        setData(null);
        setFetchError('Không thể tải dữ liệu hợp đồng');
      }
    } catch (err) {
      console.error('Failed to load contract overview', err);
      setFetchError('Lỗi kết nối máy chủ');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/interior/projects', { cache: 'no-store' });
        const body = await response.json() as { success?: unknown; data?: { projects?: unknown } };
        const projects = body?.success && Array.isArray(body.data?.projects)
          ? body.data.projects.filter((project: unknown): project is InteriorProjectOption => {
              if (!project || typeof project !== 'object') return false;
              const candidate = project as Partial<InteriorProjectOption>;
              return typeof candidate.id === 'string' && typeof candidate.code === 'string'
                && typeof candidate.name === 'string' && typeof candidate.status === 'string';
            })
          : [];
        if (!active) return;
        setProjectOptions(projects);
        if (!projects.length) {
          setData(null);
          setFetchError(response.status === 403 ? 'Bạn chưa được cấp quyền đọc dự án.' : 'Không có dự án nào khả dụng trong tenant hiện tại.');
          setLoading(false);
          return;
        }
        const selected = projects.find((project) => project.id === initialProjectId) ?? projects[0];
        setSelectedProjectId(selected.id);
      } catch {
        if (!active) return;
        setProjectOptions([]);
        setData(null);
        setFetchError('Không thể tải danh sách dự án được cấp quyền.');
        setLoading(false);
      }
    };
    void loadProjects();
    return () => { active = false; };
  }, [initialProjectId]);

  // Load data whenever project selection changes (also covers initial mount)
  useEffect(() => {
    if (selectedProjectId) {
      loadData(selectedProjectId);
    }
  }, [loadData, selectedProjectId]);

  useEffect(() => {
    setShowPaymentEntry(false);
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentReferenceCode('');
    setPaymentTransactionDate('');
    setPaymentNotes('');
  }, [selectedMilestone?.id]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setShowProjectDropdown(false);
    // Update URL param without hard navigation
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', id);
    window.history.replaceState({}, '', url.toString());
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedProjectId) loadData(selectedProjectId);
    else setRefreshing(false);
  };

  const canOpenCommercialWorkflow = (commands?: ContractOverviewResponse['workflowCommands']) => Boolean(
    commands?.createQuotationAvailable || commands?.requestCustomerApprovalAvailable || commands?.createContractAvailable,
  );

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
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(typeof error?.error === 'string' ? error.error : 'Chưa lưu được lệnh chuyển xưởng.');
      }
      const json = await res.json();
      if (json.success && json.orderCode) {
        setReleaseSuccessOrder(json.orderCode);
      } else {
        toast.error('Lệnh chuyển xưởng chưa được lưu.');
      }
    } catch (err) {
      console.error('Failed to release to workshop', err);
      toast.error(err instanceof Error ? err.message : 'Không thể lưu lệnh chuyển xưởng.');
    } finally {
      setReleasing(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMilestone || !data?.commercialWorkflow || !data.workflowCommands?.recordPaymentAvailable) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > selectedMilestone.remainingAmount) {
      toast.error('Nhập số tiền thực nhận lớn hơn 0 và không vượt số dư đợt thu.');
      return;
    }
    if (!paymentMethod || !paymentReferenceCode.trim() || !paymentTransactionDate) {
      toast.error('Cần nhập phương thức, mã tham chiếu chứng từ và ngày giao dịch thực tế.');
      return;
    }

    setSavingPayment(true);
    try {
      const response = await fetch('/api/interior/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-payment',
          projectId: data.header.projectId,
          contractId: data.commercialWorkflow.contractId,
          milestoneId: selectedMilestone.id,
          paymentAmount: amount,
          paymentMethod,
          referenceCode: paymentReferenceCode.trim(),
          transactionDate: paymentTransactionDate,
          ...(paymentNotes.trim() ? { notes: paymentNotes.trim() } : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== 'object' || !('success' in body) || body.success !== true) {
        const code = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error : '';
        const message = code === 'INTERIOR_PERMISSION_DENIED' ? 'Tài khoản không có quyền ghi nhận thanh toán.'
          : code === 'INTERIOR_PAYMENT_REFERENCE_DUPLICATE' ? 'Mã tham chiếu thanh toán đã tồn tại trong hợp đồng này.'
            : code === 'INTERIOR_PAYMENT_TARGET_NOT_FOUND_OR_UNSIGNED' ? 'Chỉ ghi nhận thanh toán cho đúng hợp đồng đã ký.'
              : code === 'INTERIOR_PAYMENT_PRECONDITION_FAILED' ? 'Số tiền vượt số dư hoặc kỳ thanh toán không còn hợp lệ.'
                : code === 'INTERIOR_PAYMENT_INPUT_INVALID' ? 'Thông tin giao dịch chưa hợp lệ.'
                  : 'Chưa ghi nhận được giao dịch; số dư không được cập nhật từ giao diện.';
        throw new Error(message);
      }
      toast.success('Đã ghi nhận giao dịch. Đang đọc lại số dư từ dữ liệu đã lưu.');
      setShowPaymentEntry(false);
      setSelectedMilestone(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentReferenceCode('');
      setPaymentTransactionDate('');
      setPaymentNotes('');
      await loadData(data.header.projectId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể ghi nhận giao dịch.');
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
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

  // ── ERROR STATE ─────────────────────────────────────────────────────────────
  if (fetchError && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Quản lý Báo giá, Hợp đồng &amp; Tiến độ Thu tiền</h1>
        </div>
        <div className="mt-10 flex flex-col items-center gap-4">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fetchError}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ── EMPTY STATE (project has no signed contract) ─────────────────────────────
  if (!loading && (!data || !data.hasContract)) {
    const selectedProject = projectOptions.find((p) => p.id === selectedProjectId);
    const boqRef = data?.referenceBOQValueFormatted;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
        {/* Header bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Quản lý Báo giá, Hợp đồng &amp; Tiến độ Thu tiền
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">Dự án:</span>
              <div className="relative inline-block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProjectDropdown((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <span>{selectedProject ? `${selectedProject.name} (${selectedProject.code})` : selectedProjectId}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
                {showProjectDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    {projectOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProject(p.id)}
                        className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 ${
                          p.id === selectedProjectId ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>{p.name} ({p.code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button type="button" onClick={() => setShowNewContractModal(true)} disabled={!canOpenCommercialWorkflow(data?.workflowCommands)}
              title="Mở quy trình báo giá, chấp thuận khách hàng và hợp đồng."
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="w-4 h-4" />
              <span>{data?.hasContract ? 'Báo giá & Duyệt' : '+ Tạo Hợp Đồng Mới'}</span>
            </button>
          </div>
        </div>

        {/* Empty state card */}
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 flex flex-col items-center gap-5 text-center max-w-xl mx-auto mt-8">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Chưa có hợp đồng kinh tế được ký kết
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {selectedProject ? `${selectedProject.name} (${selectedProject.code})` : 'Dự án đã chọn'} chưa có hợp đồng thương mại.
              {boqRef && (
                <span className="block mt-1 font-medium text-slate-600 dark:text-slate-300">
                  Giá trị BOQ tham chiếu:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">{boqRef}</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              type="button"
              onClick={() => setShowNewContractModal(true)}
              disabled={!canOpenCommercialWorkflow(data?.workflowCommands)}
              title="Mở quy trình báo giá, chấp thuận khách hàng và hợp đồng."
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Lập Báo giá &amp; Ký hợp đồng
            </button>
            <Link
              href={`/dashboard/interior/boq?projectId=${selectedProjectId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              Xem BOQ &amp; Dự toán
            </Link>
          </div>
        </div>

        {showNewContractModal && selectedProjectId && (
          <CommercialWorkflowModal
            projectId={selectedProjectId}
            permissions={{
              createQuotationAvailable: data?.workflowCommands?.createQuotationAvailable === true,
              requestCustomerApprovalAvailable: data?.workflowCommands?.requestCustomerApprovalAvailable === true,
              createContractAvailable: data?.workflowCommands?.createContractAvailable === true,
            }}
            onClose={() => setShowNewContractModal(false)}
            onChanged={() => loadData(selectedProjectId)}
          />
        )}
      </div>
    );
  }

  if (!data) return null;

  if (data.financeAccess === false) {
    const selectedProject = projectOptions.find((project) => project.id === selectedProjectId);
    const summary = data.contractSummary;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Thông tin hợp đồng</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {selectedProject ? `${selectedProject.name} (${selectedProject.code})` : 'Dự án được phân công'}
          </p>
        </div>
        <section className="max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chỉ xem thông tin hợp đồng</p>
          {summary ? (
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><dt className="text-xs text-slate-500">Số hợp đồng</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.contractNumber}</dd></div>
              <div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.status}</dd></div>
              <div><dt className="text-xs text-slate-500">Tên hợp đồng</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.title}</dd></div>
              <div><dt className="text-xs text-slate-500">Ngày ký</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.signedDate ? new Date(summary.signedDate).toLocaleDateString('vi-VN') : 'Chưa ký kết'}</dd></div>
              {summary.clientRepresentative ? <div><dt className="text-xs text-slate-500">Đại diện khách hàng</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.clientRepresentative}</dd></div> : null}
            </dl>
          ) : <p className="mt-3 text-sm text-rose-600">Không tải được thông tin hợp đồng.</p>}
          <p className="mt-5 text-xs text-slate-500">Khoản tiền và tiến độ thu chỉ hiển thị cho người có quyền Finance Read.</p>
          {data.workflowCommands?.requestCustomerApprovalAvailable && data.commercialWorkflow ? (
            <button type="button" onClick={() => setShowNewContractModal(true)}
              className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">
              Gửi hợp đồng cho khách hàng chấp thuận
            </button>
          ) : null}
        </section>
        {showNewContractModal && selectedProjectId && data.commercialWorkflow ? (
          <CommercialWorkflowModal
            projectId={selectedProjectId}
            permissions={{
              createQuotationAvailable: false,
              requestCustomerApprovalAvailable: data.workflowCommands?.requestCustomerApprovalAvailable === true,
              createContractAvailable: false,
            }}
            contract={{
              id: data.commercialWorkflow.contractId,
              status: data.commercialWorkflow.contractStatus,
              quotationId: data.commercialWorkflow.quotationId,
              quotationVersionNumber: data.commercialWorkflow.quotationVersionNumber,
            }}
            onClose={() => setShowNewContractModal(false)}
            onChanged={() => loadData(selectedProjectId)}
          />
        ) : null}
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
          {/* Interactive Project Selector */}
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">Dự án:</span>
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowProjectDropdown((v) => !v)}
                className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <span>{header.selectorLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
              {showProjectDropdown && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {projectOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProject(p.id)}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 ${
                        p.id === selectedProjectId ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{p.name} ({p.code})</span>
                    </button>
                  ))}
                </div>
              )}
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
            disabled={!canOpenCommercialWorkflow(data.workflowCommands)}
            title="Mở quy trình báo giá, chấp thuận khách hàng và hợp đồng."
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{data.hasContract ? 'Báo giá & Duyệt' : '+ Tạo Hợp Đồng Mới'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReleaseModal(true)}
            disabled={!data.workflowCommands?.releaseProductionAvailable || !data.workshopReleaseGating.isEligible}
            title="Chưa có command backend và gate server đầy đủ để phát hành lệnh sản xuất."
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
                  toast.error('Chức năng xuất báo cáo chưa khả dụng; không có tệp nào được tạo.');
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
                  onClick={() => toast.error('API lưu phụ lục chưa khả dụng; không có thay đổi nào được lưu.')}
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

            {data?.workflowCommands?.recordPaymentAvailable === true
              && (data.commercialWorkflow?.contractStatus === 'signed' || data.commercialWorkflow?.contractStatus === 'active')
              && selectedMilestone.remainingAmount > 0 ? (
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                {!showPaymentEntry ? (
                  <button type="button" onClick={() => setShowPaymentEntry(true)}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">
                    Ghi nhận khoản tiền đã thực nhận
                  </button>
                ) : (
                  <form onSubmit={handleRecordPayment} className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ghi nhận chứng từ thanh toán thực tế</h4>
                    <p className="text-[11px] text-slate-500">Nhập dữ liệu theo chứng từ đã nhận. Mã giao dịch và ngày không được tự sinh; máy chủ sẽ kiểm tra hạn mức và mã trùng trong cùng một giao dịch.</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Số tiền thực nhận (VND)
                        <input type="number" min="1" max={selectedMilestone.remainingAmount} step="1" required value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Phương thức
                        <select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                          <option value="">Chọn phương thức</option>
                          <option value="bank_transfer">Chuyển khoản</option>
                          <option value="cash">Tiền mặt</option>
                          <option value="credit_card">Thẻ</option>
                          <option value="escrow">Ký quỹ</option>
                          <option value="other">Khác</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Mã tham chiếu chứng từ
                        <input type="text" required maxLength={160} value={paymentReferenceCode}
                          onChange={(event) => setPaymentReferenceCode(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Ngày giao dịch trên chứng từ
                        <input type="date" required value={paymentTransactionDate}
                          onChange={(event) => setPaymentTransactionDate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
                        Ghi chú đối soát (không bắt buộc)
                        <input type="text" maxLength={1000} value={paymentNotes}
                          onChange={(event) => setPaymentNotes(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowPaymentEntry(false)} disabled={savingPayment}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200">
                        Hủy
                      </button>
                      <button type="submit" disabled={savingPayment}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {savingPayment ? 'Đang lưu…' : 'Lưu giao dịch'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}

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
                      <div className={`w-5 h-5 rounded-full ${crit.satisfied ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'} flex items-center justify-center shrink-0 mt-0.5`}>
                        {crit.satisfied ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
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

                <div className={`p-3 rounded-xl border flex items-center justify-between ${workshopReleaseGating.isEligible ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
                  <div className={`flex items-center gap-2 text-xs font-bold ${workshopReleaseGating.isEligible ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    <ShieldCheck className={`w-4 h-4 ${workshopReleaseGating.isEligible ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span>{workshopReleaseGating.isEligible ? 'Trạng thái kiểm duyệt: ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG' : 'Trạng thái kiểm duyệt: CHƯA ĐỦ ĐIỀU KIỆN'}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md">
                    {workshopReleaseGating.criteria.filter((criterion) => criterion.satisfied).length}/{workshopReleaseGating.criteria.length} Tiêu chí Đạt
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
                    disabled={releasing || !data.workflowCommands?.releaseProductionAvailable || !workshopReleaseGating.isEligible}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
                  toast.info('Đang mở hộp thoại in của trình duyệt; đây không phải bản scan có chữ ký số.');
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

      {showNewContractModal && selectedProjectId && (
        <CommercialWorkflowModal
          projectId={selectedProjectId}
          permissions={{
            createQuotationAvailable: data.workflowCommands?.createQuotationAvailable === true,
            requestCustomerApprovalAvailable: data.workflowCommands?.requestCustomerApprovalAvailable === true,
            createContractAvailable: data.workflowCommands?.createContractAvailable === true,
          }}
          contract={data.commercialWorkflow ? {
            id: data.commercialWorkflow.contractId,
            status: data.commercialWorkflow.contractStatus,
            quotationId: data.commercialWorkflow.quotationId,
            quotationVersionNumber: data.commercialWorkflow.quotationVersionNumber,
          } : undefined}
          onClose={() => setShowNewContractModal(false)}
          onChanged={() => loadData(selectedProjectId)}
        />
      )}
    </div>
  );
}
