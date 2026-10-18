'use client';

/** Finance records come from the Product HTTP response. Reference analytics are labeled separately. */

import React, { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CircleDollarSign,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Search,
  CreditCard,
  FileText,
  RefreshCw,
  Plus,
  Send,
  Users,
  Calendar,
  Download,
  Filter,
  MoreVertical,
  Clock,
  RotateCw,
  TrendingUp,
  X,
  Wallet,
  Check,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

import {
  BillingPeriod,
  Invoice,
  Payment,
  PaymentReceipt,
  TuitionServicePeriodCompletion,
} from '@/products/bella-education/finance/domain/finance.types';

// ── Strict Domain Types ───────────────────────────────────────────────────────

export type FinanceTabKey = 'overview' | 'invoices' | 'debts' | 'payments' | 'reconciliation' | 'reports';

export type InvoiceFilterTab = 'ALL' | 'DRAFT' | 'ISSUED';

export type InvoiceIssuanceStatus = Invoice['invoiceStatus'];
export type InvoiceSettlementStatus = Invoice['settlementStatus'];

export interface FinanceStudentOption {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly studentId: string | null;
  readonly studentCode: string | null;
  readonly displayName: string;
  readonly className?: string;
}

export interface FinanceExceptionRow {
  readonly id: string;
  readonly exception_type: string;
  readonly status: string;
  readonly description?: string | null;
}

export interface FinanceStateResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly students?: FinanceStudentOption[];
  readonly billingPeriods?: BillingPeriod[];
  readonly servicePeriodCompletions?: TuitionServicePeriodCompletion[];
  readonly invoices?: Invoice[];
  readonly payments?: Payment[];
  readonly exceptions?: FinanceExceptionRow[];
}

export interface FinanceCommandResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly invoice?: Invoice;
  readonly completion?: TuitionServicePeriodCompletion;
  readonly alreadyCompleted?: boolean;
  readonly projection?: { readonly isDuplicate: boolean; readonly notice: { readonly id: string } };
  readonly escalatedCount?: number;
  readonly payment?: Payment;
  readonly receipt?: PaymentReceipt;
  readonly updatedSettlementStatus?: string;
}

export interface TableInvoiceItem {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly studentName: string;
  readonly studentCode?: string;
  readonly className: string;
  readonly billingPeriodDisplay: string;
  readonly billingPeriodId: string;
  readonly issuanceStatus: InvoiceIssuanceStatus;
  readonly settlementStatus: InvoiceSettlementStatus;
  readonly amount: number;
}

export interface MonthlyCollectionData {
  readonly month: string;
  readonly collected: number; // In millions
  readonly remaining: number; // In millions
  readonly total: number;
}

export interface ClassDebtItem {
  readonly className: string;
  readonly amountMillions: number;
  readonly percent: number;
  readonly colorClass: string;
}

export interface TopOverdueStudent {
  readonly id: string;
  readonly initial: string;
  readonly avatarBg: string;
  readonly name: string;
  readonly className: string;
  readonly amount: number;
  readonly overdueDays: number;
}

export interface RecentPaymentItem {
  readonly id: string;
  readonly amount: number;
  readonly studentName: string;
  readonly note: string;
  readonly timestamp: string;
}

// ── Mock & Reference Datasets matching Image 2 ────────────────────────────────


const MONTHLY_CHART_DATA: readonly MonthlyCollectionData[] = [
  { month: 'Th04', collected: 130, remaining: 40, total: 170 },
  { month: 'Th05', collected: 125, remaining: 40, total: 165 },
  { month: 'Th06', collected: 115, remaining: 50, total: 165 },
  { month: 'Th07', collected: 175, remaining: 40, total: 215 },
  { month: 'Th08', collected: 160, remaining: 40, total: 200 },
  { month: 'Th09', collected: 198.5, remaining: 46.5, total: 245 },
];

const CLASS_DEBTS_DATA: readonly ClassDebtItem[] = [
  { className: 'Mầm A1', amountMillions: 12.5, percent: 55, colorClass: 'bg-rose-500' },
  { className: 'Chồi B1', amountMillions: 18.8, percent: 80, colorClass: 'bg-amber-500' },
  { className: 'Lá C1', amountMillions: 10.2, percent: 45, colorClass: 'bg-emerald-500' },
  { className: 'Nhà Trẻ N1', amountMillions: 5.0, percent: 25, colorClass: 'bg-blue-500' },
];

const TOP_OVERDUE_STUDENTS: readonly TopOverdueStudent[] = [
  {
    id: 'OV-1',
    initial: 'N',
    avatarBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    name: 'Trần Bảo Ngọc',
    className: 'Chồi B1',
    amount: 4200000,
    overdueDays: 15,
  },
  {
    id: 'OV-2',
    initial: 'K',
    avatarBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    name: 'Hoàng Tuấn Kiệt',
    className: 'Lá C1',
    amount: 4000000,
    overdueDays: 8,
  },
  {
    id: 'OV-3',
    initial: 'V',
    avatarBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    name: 'Vũ Gia Hân',
    className: 'Mầm A1',
    amount: 3700000,
    overdueDays: 5,
  },
];

const RECENT_PAYMENTS: readonly RecentPaymentItem[] = [
  {
    id: 'PAY-1',
    amount: 3500000,
    studentName: 'Nguyễn Minh An',
    note: 'HD0001',
    timestamp: '16/09/2026 10:24',
  },
  {
    id: 'PAY-2',
    amount: 2100000,
    studentName: 'Phạm Thảo My',
    note: 'Thanh toán một phần',
    timestamp: '16/09/2026 09:18',
  },
  {
    id: 'PAY-3',
    amount: 3600000,
    studentName: 'Đặng Khánh Linh',
    note: 'HD0006',
    timestamp: '14/09/2026 15:40',
  },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview');

  // Backend state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [exceptions, setExceptions] = useState<FinanceExceptionRow[]>([]);
  const [students, setStudents] = useState<FinanceStudentOption[]>([]);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [servicePeriodCompletions, setServicePeriodCompletions] = useState<TuitionServicePeriodCompletion[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Form & filter states
  const [selectedStudentPartyId, setSelectedStudentPartyId] = useState<string>('');
  const [selectedBillingPeriodId, setSelectedBillingPeriodId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>('');
  const [invoiceFilterTab, setInvoiceFilterTab] = useState<InvoiceFilterTab>('ALL');
  const [filterIssuance, setFilterIssuance] = useState<string>('ALL');
  const [filterSettlement, setFilterSettlement] = useState<string>('ALL');
  const [filterBillingPeriodId, setFilterBillingPeriodId] = useState('ALL');
  const [selectedInvoices, setSelectedInvoices] = useState<readonly string[]>([]);

  // Preview & Create Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const selectedStudent = students.find((student) => student.studentPartyId === selectedStudentPartyId);
  const selectedBillingPeriod = billingPeriods.find((period) => period.id === selectedBillingPeriodId);
  const canCreateDraft = dataLoaded && !loading && !!selectedStudent && !!selectedBillingPeriod;

  // Fetch real backend data
  const loadData = useCallback(async () => {
    setLoading(true);
    setDataLoaded(false);
    setLoadError(null);
    setIsPreviewModalOpen(false);
    setStudents([]);
    setBillingPeriods([]);
    setInvoices([]);
    setPayments([]);
    setExceptions([]);
    setServicePeriodCompletions([]);
    setSelectedInvoices([]);
    try {
      const response = await fetch('/api/education/finance', { cache: 'no-store' });
      const payload = (await response.json()) as FinanceStateResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không tải được dữ liệu tài chính.');
      }

      const nextStudents = payload.students || [];
      const nextBillingPeriods = payload.billingPeriods || [];
      const nextInvoices = payload.invoices || [];
      setStudents(nextStudents);
      setBillingPeriods(nextBillingPeriods);
      setServicePeriodCompletions(payload.servicePeriodCompletions || []);
      setInvoices(nextInvoices);
      setFilterBillingPeriodId((previous) => previous === 'ALL' || nextInvoices.some((invoice) => invoice.billingPeriodId === previous) ? previous : 'ALL');
      setPayments(payload.payments || []);
      setExceptions(payload.exceptions || []);
      setDataLoaded(true);
    } catch (err: unknown) {
      setFilterBillingPeriodId('ALL');
      setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu tài chính.');
    } finally {
      setLoading(false);
    }
  }, []);

  const financeCommand = async (action: string, payload: Record<string, string | number | boolean> = {}): Promise<FinanceCommandResponse> => {
    if (!dataLoaded || loading) throw new Error('Vui lòng tải dữ liệu tài chính thành công trước khi thao tác.');
    const response = await fetch('/api/education/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = (await response.json()) as FinanceCommandResponse;
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Thao tác tài chính không thành công.');
    }
    return body;
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Draft Invoice
  const handleCompileDraftInvoice = async () => {
    if (!dataLoaded || loading) return;
    const targetStudent = selectedStudent;
    if (!targetStudent) {
      setActionMessage('Vui lòng chọn học sinh hợp lệ trong danh sách đã tải.');
      return;
    }
    const targetBillingPeriod = billingPeriods.find((p) => p.id === selectedBillingPeriodId);
    if (!targetBillingPeriod) {
      setActionMessage('Chưa có kỳ thu học phí ACTIVE hợp lệ. Vui lòng cấu hình kỳ thu trước khi lập hóa đơn.');
      return;
    }
    setLoading(true);
    try {
      const result = await financeCommand('compileDraftInvoice', {
        studentPartyId: targetStudent.studentPartyId,
        billingPeriodId: targetBillingPeriod.id,
      });
      if (!result.invoice) throw new Error('Không nhận được hóa đơn sau khi lập nháp.');
      setActionMessage(`Đã lập hóa đơn nháp thành công: ${result.invoice.invoiceNumber} (${result.invoice.netAmount.toLocaleString('vi-VN')} đ)`);
      setIsPreviewModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi lập hóa đơn: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    setLoading(true);
    try {
      const result = await financeCommand('issueInvoice', { invoiceId });
      if (!result.invoice) throw new Error('Không nhận được hóa đơn sau khi phát hành.');
      setActionMessage(`Đã phát hành hóa đơn ${result.invoice.invoiceNumber} (DRAFT ➔ ISSUED).`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi phát hành: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectInvoiceNotice = async (invoice: Invoice) => {
    setLoading(true);
    try {
      const result = await financeCommand('projectInvoiceNotice', { invoiceId: invoice.id });
      const projection = result.projection;
      setActionMessage(
        projection?.isDuplicate
          ? `Thông báo đã tồn tại cho hóa đơn ${invoice.invoiceNumber} (Idempotent PASS)`
          : `Đã gửi thông báo hóa đơn ${invoice.invoiceNumber} tới Phụ huynh thành công.`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi gửi thông báo: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTuitionServicePeriod = async () => {
    const targetBillingPeriod = billingPeriods.find((p) => p.id === selectedBillingPeriodId);
    if (!targetBillingPeriod) {
      setActionMessage('Chưa có kỳ thu học phí ACTIVE hợp lệ để xác nhận hoàn thành dịch vụ.');
      return;
    }
    setLoading(true);
    try {
      const result = await financeCommand('completeTuitionServicePeriod', {
        billingPeriodId: targetBillingPeriod.id,
      });
      if (!result.completion) throw new Error('Không nhận được bằng chứng hoàn thành kỳ dịch vụ.');
      setActionMessage(
        result.alreadyCompleted
          ? `Kỳ dịch vụ ${targetBillingPeriod.periodName} đã được xác nhận hoàn thành trước đó.`
          : `Đã xác nhận hoàn thành kỳ dịch vụ ${targetBillingPeriod.periodName}. Thao tác này chỉ tạo completion evidence, không ghi nhận doanh thu.`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi xác nhận hoàn thành kỳ dịch vụ: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanOverdueInvoices = async () => {
    setLoading(true);
    try {
      const result = await financeCommand('scanOverdueInvoices');
      setActionMessage(`Quét thành công! Đã phát hiện & leo thang ${result.escalatedCount ?? 0} hóa đơn quá hạn sang hàng đợi xử lý.`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi quét quá hạn: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreviewModal = () => {
    if (!dataLoaded || loading) return;
    if (!selectedStudent || !selectedBillingPeriod) {
      setActionMessage('Vui lòng chọn đúng học sinh và kỳ thu trong danh sách đã tải.');
      return;
    }
    setIsPreviewModalOpen(true);
  };

  // Filter students for the left panel search
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    const q = studentSearchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
        (s.className && s.className.toLowerCase().includes(q))
    );
  }, [students, studentSearchQuery]);

  // Preserve identities, amounts and both independent statuses from the Product DTO.
  const displayInvoices = useMemo((): readonly TableInvoiceItem[] => {
      return invoices.map((inv) => {
        const student = students.find((s) => s.studentPartyId === inv.studentPartyId);
        const period = billingPeriods.find((item) => item.id === inv.billingPeriodId);
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          studentName: student?.displayName || `Party: ${inv.studentPartyId}`,
          studentCode: student?.studentCode || undefined,
          className: student?.className || '—',
          billingPeriodDisplay: period?.periodName || inv.billingPeriodId,
          billingPeriodId: inv.billingPeriodId,
          issuanceStatus: inv.invoiceStatus,
          settlementStatus: inv.settlementStatus,
          amount: inv.netAmount,
        };
      });
  }, [invoices, students, billingPeriods]);

  // Filter table invoices
  const filteredInvoices = useMemo(() => {
    return displayInvoices.filter((inv) => {
      // Tab filter
      if (invoiceFilterTab === 'DRAFT' && inv.issuanceStatus !== 'DRAFT') return false;
      if (invoiceFilterTab === 'ISSUED' && inv.issuanceStatus !== 'ISSUED') return false;

      // Dropdown filters
      if (filterIssuance !== 'ALL' && inv.issuanceStatus !== filterIssuance) return false;
      if (filterSettlement !== 'ALL' && inv.settlementStatus !== filterSettlement) return false;
      if (filterBillingPeriodId !== 'ALL' && inv.billingPeriodId !== filterBillingPeriodId) return false;

      // Text search
      if (invoiceSearchQuery.trim()) {
        const q = invoiceSearchQuery.toLowerCase();
        const matchNumber = inv.invoiceNumber.toLowerCase().includes(q);
        const matchName = inv.studentName.toLowerCase().includes(q);
        if (!matchNumber && !matchName) return false;
      }

      return true;
    });
  }, [displayInvoices, invoiceFilterTab, filterIssuance, filterSettlement, filterBillingPeriodId, invoiceSearchQuery]);

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllInvoices = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((inv) => inv.id));
    }
  };

  // Helper renderers for badges
  const renderIssuanceBadge = (status: InvoiceIssuanceStatus) => {
    if (status === 'VOID') {
      return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Đã hủy</span>;
    }
    if (status === 'ISSUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          Đã phát hành
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Bản nháp
      </span>
    );
  };

  const renderSettlementBadge = (status: InvoiceSettlementStatus) => {
    switch (status) {
      case 'OVERPAID':
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Thanh toán thừa</span>;
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Đã thanh toán
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Một phần
          </span>
        );
      case 'UNPAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Chưa thanh toán
          </span>
        );
    }
  };

  return (
    <div
      className="preschool-finance-workspace w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-36 sm:pb-48 font-sans"
      data-testid="finance-command-center"
    >
      {/* ── ACTION NOTIFICATION ALERT ── */}
      {actionMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* ── UNIFIED HEADER MATCHING IMAGE 2 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100/80">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Tài chính & Học phí</span>
                <span className="sr-only">Preschool Finance Operating Kernel (P7)</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý hóa đơn, công nợ, thanh toán và đối soát
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Month Selector & Primary CTA */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
            <span>{selectedBillingPeriod?.periodName || 'Chưa chọn kỳ thu'}</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>

          <button
            onClick={handleOpenPreviewModal}
            data-testid="btn-compile-invoice"
            disabled={!canCreateDraft}
            className="px-4 py-2.5 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Lập hóa đơn</span>
          </button>
        </div>
      </div>

      <div aria-live="polite" className="text-sm text-slate-700 dark:text-slate-200">
        {loading && <p role="status">Đang tải hoặc xử lý dữ liệu tài chính…</p>}
        {loadError && (
          <div role="alert" className="space-y-2">
            <p>Không tải được dữ liệu tài chính: {loadError}</p>
            <button onClick={loadData} disabled={loading} className="underline font-bold">Thử lại</button>
          </div>
        )}
      </div>

      {/* ── 4 KPI STAT CARDS MATCHING IMAGE 2 ── */}
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chỉ số tổng quan minh họa — chưa kết nối số liệu thực tế.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Phải thu trong kỳ */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Phải thu trong kỳ
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              245.0 tr
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>Tổng học phí cần thu</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                ↑ +12%
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Đã thanh toán */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Đã thanh toán
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              198.5 tr
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>81% đã thu</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                ↑ +8%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Còn phải thu */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Còn phải thu
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              46.5 tr
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>19% chưa thu</span>
              <span className="font-bold text-rose-500 dark:text-rose-400 flex items-center gap-0.5">
                ↓ -5%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Khoản quá hạn */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Khoản quá hạn
            </p>
            <h2 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight mt-1">
              12
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>Cần nhắc thu</span>
              <span className="font-bold text-rose-500 dark:text-rose-400 flex items-center gap-0.5">
                ↓ -3%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 WORKSPACE NAVIGATION TABS MATCHING IMAGE 2 ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-white opacity-70" />
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          data-testid="staff-zone-billing"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'invoices'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Hóa đơn</span>
        </button>

        <button
          onClick={() => setActiveTab('debts')}
          data-testid="staff-zone-collections"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'debts'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Công nợ</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          data-testid="staff-zone-cash"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'payments'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Thanh toán</span>
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'reconciliation'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Đối soát</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'reports'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Báo cáo</span>
        </button>
      </div>

      {/* ── 3 MIDDLE ANALYTICS & TASK CARDS MATCHING IMAGE 2 ── */}
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Biểu đồ và danh sách công việc dưới đây dùng dữ liệu minh họa.</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Biểu đồ thu phí */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Biểu đồ thu phí
            </h3>
            <select className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300">
              <option>6 tháng gần đây</option>
              <option>Năm học 2026 - 2027</option>
            </select>
          </div>

          {/* Stacked Bar Chart */}
          <div className="pt-4 pb-2">
            <div className="flex items-end justify-between gap-3 h-44 px-2">
              {MONTHLY_CHART_DATA.map((item) => {
                const max = 250;
                const collectedHeight = (item.collected / max) * 100;
                const remainingHeight = (item.remaining / max) * 100;

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="w-full max-w-[28px] flex flex-col justify-end h-full">
                      {/* Remaining on top */}
                      <div
                        style={{ height: `${remainingHeight}%` }}
                        className="w-full bg-[#86efac] rounded-t-sm"
                        title={`${item.month} - Còn phải thu: ${item.remaining} tr`}
                      />
                      {/* Collected on bottom */}
                      <div
                        style={{ height: `${collectedHeight}%` }}
                        className="w-full bg-[#0c513f] rounded-b-sm"
                        title={`${item.month} - Đã thu: ${item.collected} tr`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#0c513f]" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Đã thu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#86efac]" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Còn phải thu</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Tình trạng hóa đơn (Donut Chart) */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tình trạng hóa đơn
            </h3>
            <select className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300">
              <option>Tháng 09/2026</option>
              <option>Tháng 08/2026</option>
            </select>
          </div>

          <div className="flex items-center justify-center gap-6 py-4">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                {/* 1. Paid (71%) -> stroke-dasharray: 169.5 238.8 */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray="169.5 238.8"
                  strokeDashoffset="0"
                />
                {/* 2. Partial (11%) -> stroke-dasharray: 26.2 238.8 */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="14"
                  strokeDasharray="26.2 238.8"
                  strokeDashoffset="-169.5"
                />
                {/* 3. Unpaid (15%) -> stroke-dasharray: 35.8 238.8 */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="14"
                  strokeDasharray="35.8 238.8"
                  strokeDashoffset="-195.7"
                />
                {/* 4. Draft (3%) -> stroke-dasharray: 7.3 238.8 */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="14"
                  strokeDasharray="7.3 238.8"
                  strokeDashoffset="-231.5"
                />
              </svg>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  280
                </span>
                <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  hóa đơn
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Đã thanh toán <span className="font-bold text-slate-900 dark:text-white">198 (71%)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Một phần <span className="font-bold text-slate-900 dark:text-white">32 (11%)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Chưa thanh toán <span className="font-bold text-slate-900 dark:text-white">42 (15%)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Bản nháp <span className="font-bold text-slate-900 dark:text-white">8 (3%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Công việc cần xử lý */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Công việc cần xử lý
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white leading-none">
                12
              </span>
            </div>
            <button
              onClick={handleScanOverdueInvoices}
              disabled={loading || !dataLoaded}
              title="Quét lại công nợ quá hạn"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 py-2">
            {/* Task 1 */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100/80 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  8 hóa đơn quá hạn
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Cần nhắc phụ huynh
                </p>
              </div>
            </div>

            {/* Task 2 */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100/80 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  5 khoản thanh toán chờ đối soát
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Đã nhận chuyển khoản
                </p>
              </div>
            </div>

            {/* Task 3 */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100/80 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <RotateCw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  3 yêu cầu điều chỉnh học phí
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Chờ phê duyệt
                </p>
              </div>
            </div>

            {/* Task 4 */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100/80 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  2 hóa đơn nháp chưa phát hành
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Từ kỳ thu tháng 09
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN INTERACTIVE WORKSPACE (TWO COLUMNS) MATCHING IMAGE 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Lập hóa đơn mới (Width: ~30%) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <FileText className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Lập hóa đơn mới
            </h2>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Chọn học sinh và kỳ thu để xác nhận thông tin trước khi lập hóa đơn nháp.
          </p>

          <div className="space-y-4">
            {/* Student Selector with search */}
            <div className="space-y-1.5">
              <label htmlFor="finance-student" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>Chọn học sinh</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, lớp hoặc mã học sinh..."
                  value={studentSearchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                />
              </div>

              {/* Student Dropdown */}
              <select
                id="finance-student"
                disabled={loading || !dataLoaded}
                value={selectedStudentPartyId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedStudentPartyId(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              >
                <option value="">{students.length === 0 ? 'Chưa có học sinh đã ghi danh' : 'Chọn học sinh'}</option>
                {selectedStudentPartyId && !selectedStudent && <option value={selectedStudentPartyId} disabled>Học sinh đã chọn không còn trong danh sách</option>}
                {selectedStudent && !filteredStudents.includes(selectedStudent) && <option value={selectedStudent.studentPartyId}>{selectedStudent.displayName} (đang chọn)</option>}
                {filteredStudents.map((st) => (
                  <option key={st.studentPartyId} value={st.studentPartyId}>
                    {st.displayName} {st.studentCode ? `(${st.studentCode})` : ''}{st.className ? ` - ${st.className}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Billing Period Selector */}
            <div className="space-y-1.5">
              <label htmlFor="finance-billing-period" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>Kỳ thu</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="finance-billing-period"
                disabled={loading || !dataLoaded}
                value={selectedBillingPeriodId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedBillingPeriodId(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              >
                <option value="">{billingPeriods.length === 0 ? 'Chưa có kỳ thu khả dụng' : 'Chọn kỳ thu'}</option>
                {selectedBillingPeriodId && !selectedBillingPeriod && <option value={selectedBillingPeriodId} disabled>Kỳ thu đã chọn không còn trong danh sách</option>}
                {billingPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.periodName} ({period.dueDate})
                    </option>
                  ))}
              </select>
            </div>

            {/* Service completion action confirmation preserved for compliance */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Xác nhận hoàn thành dịch vụ kỳ:
                </span>
                <button
                  onClick={handleCompleteTuitionServicePeriod}
                  disabled={loading || !dataLoaded || !selectedBillingPeriod}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                >
                  Xác nhận hoàn thành
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Thao tác này chỉ tạo completion evidence, không ghi nhận doanh thu.
              </p>
            </div>

            {/* Information Callout */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold">ℹ</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Xem trước hóa đơn
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
                  Chỉ xác nhận học sinh và kỳ thu. Các khoản phí và số tiền do hệ thống trả về sau khi lập nháp.
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <button
              onClick={handleOpenPreviewModal}
              disabled={!canCreateDraft}
              className="w-full py-2.5 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Search className="w-4 h-4" />
              <span>Xem trước hóa đơn</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Danh sách hóa đơn (Width: ~70%) */}
        <div data-testid="invoice-workspace" className="lg:col-span-8 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Danh sách hóa đơn
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled
                title="Chưa hỗ trợ xuất dữ liệu"
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Xuất dữ liệu</span>
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50"
                title="Làm mới"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInvoiceFilterTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                invoiceFilterTab === 'ALL'
                  ? 'bg-[#0c513f] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả ({displayInvoices.length})
            </button>
            <button
              onClick={() => setInvoiceFilterTab('DRAFT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                invoiceFilterTab === 'DRAFT'
                  ? 'bg-[#0c513f] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Bản nháp ({displayInvoices.filter((invoice) => invoice.issuanceStatus === 'DRAFT').length})
            </button>
            <button
              onClick={() => setInvoiceFilterTab('ISSUED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                invoiceFilterTab === 'ISSUED'
                  ? 'bg-[#0c513f] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Đã phát hành ({displayInvoices.filter((invoice) => invoice.issuanceStatus === 'ISSUED').length})
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo mã hóa đơn, tên học sinh..."
                value={invoiceSearchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInvoiceSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
              />
            </div>

            <div className="sm:col-span-2">
              <select aria-label="Lọc kỳ thu" value={filterBillingPeriodId} onChange={(event) => setFilterBillingPeriodId(event.target.value)} className="w-full py-2 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                <option value="ALL">Tất cả kỳ thu</option>
                {Array.from(new Map(displayInvoices.map((invoice) => [invoice.billingPeriodId, invoice.billingPeriodDisplay]))).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                aria-label="Lọc trạng thái phát hành"
                value={filterIssuance}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterIssuance(e.target.value)}
                className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Trạng thái phát hành ▾</option>
                <option value="ISSUED">Đã phát hành</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="VOID">Đã hủy</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                aria-label="Lọc trạng thái thanh toán"
                value={filterSettlement}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterSettlement(e.target.value)}
                className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Trạng thái thanh toán ▾</option>
                <option value="PAID">Đã thanh toán</option>
                <option value="PARTIALLY_PAID">Một phần</option>
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="OVERPAID">Thanh toán thừa</option>
              </select>
            </div>

            <div className="sm:col-span-1 flex justify-end">
              <button
                disabled
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                title="Lọc nâng cao"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                      onChange={toggleSelectAllInvoices}
                      className="rounded text-[#0c513f] focus:ring-[#0c513f]"
                    />
                  </th>
                  <th className="p-3 font-bold">Mã hóa đơn</th>
                  <th className="p-3 font-bold">Học sinh</th>
                  <th className="p-3 font-bold">Lớp</th>
                  <th className="p-3 font-bold">Kỳ thu</th>
                  <th className="p-3 font-bold">Phát hành</th>
                  <th className="p-3 font-bold">Thanh toán</th>
                  <th className="p-3 font-bold text-right">Số tiền</th>
                  <th className="p-3 font-bold text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-600 dark:text-slate-300">{loading ? 'Đang tải hóa đơn…' : loadError ? 'Chưa tải được danh sách hóa đơn.' : displayInvoices.length === 0 ? 'Chưa có hóa đơn.' : 'Không có hóa đơn phù hợp bộ lọc.'}</td></tr>}
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(inv.id)}
                        onChange={() => toggleSelectInvoice(inv.id)}
                        className="rounded text-[#0c513f] focus:ring-[#0c513f]"
                      />
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      {inv.studentName}
                    </td>
                    <td className="p-3 text-slate-500">
                      {inv.className}
                    </td>
                    <td className="p-3 text-slate-500">
                      {inv.billingPeriodDisplay}
                    </td>
                    <td className="p-3">
                      {renderIssuanceBadge(inv.issuanceStatus)}
                    </td>
                    <td className="p-3">
                      {renderSettlementBadge(inv.settlementStatus)}
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white text-right">
                      {inv.amount.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleIssueInvoice(inv.id)}
                        disabled={loading || !dataLoaded || inv.issuanceStatus !== 'DRAFT'}
                        data-testid="btn-issue-invoice"
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        title={inv.issuanceStatus === 'DRAFT' ? 'Phát hành hóa đơn' : 'Không có thao tác phát hành'}
                      >
                        <span className="text-base leading-none font-black tracking-widest">···</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500">
            <div>
              Hiển thị {filteredInvoices.length} / {displayInvoices.length} hóa đơn đã tải
            </div>

          </div>
        </div>
      </div>

      {/* ── 3 BOTTOM MINI CARDS MATCHING IMAGE 2 ── */}
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Công nợ theo lớp, học sinh và thanh toán gần đây dưới đây là dữ liệu minh họa.</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Công nợ theo lớp */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <FileText className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Công nợ theo lớp
            </h3>
          </div>

          <div className="space-y-3.5 pt-1">
            {CLASS_DEBTS_DATA.map((item) => (
              <div key={item.className} className="flex items-center justify-between gap-3 text-xs">
                <span className="w-20 font-bold text-slate-700 dark:text-slate-300">
                  {item.className}
                </span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  <div
                    style={{ width: `${item.percent}%` }}
                    className={`h-full rounded-full ${item.colorClass}`}
                  />
                </div>
                <span className="w-16 font-extrabold text-slate-900 dark:text-white text-right">
                  {item.amountMillions.toFixed(1)} tr
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Top công nợ cần thu */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Top công nợ cần thu
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('debts')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <span>→</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {TOP_OVERDUE_STUDENTS.map((st) => (
              <div key={st.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${st.avatarBg}`}>
                    {st.initial}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {st.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {st.className}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {st.amount.toLocaleString('vi-VN')}
                  </p>
                  <p className="text-[11px] font-bold text-rose-500">
                    ● Quá hạn {st.overdueDays} ngày
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Thanh toán gần đây */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thanh toán gần đây
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('payments')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <span>→</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {RECENT_PAYMENTS.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      +{pay.amount.toLocaleString('vi-VN')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {pay.studentName} · {pay.note}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 font-medium">
                  {pay.timestamp}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODAL: XEM TRƯỚC HÓA ĐƠN & TẠO BẢN NHÁP ── */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title" className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="invoice-preview-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                    Xem Trước Hóa Đơn Học Phí
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kỳ thu: {selectedBillingPeriod?.periodName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                aria-label="Đóng xem trước"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Student & Breakdown Information */}
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Học sinh</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{selectedStudent?.displayName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Lớp</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedStudent?.className || '—'}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">Chưa có số tiền xem trước. Các khoản thu và số tiền được xác định khi lập hóa đơn nháp.</p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={handleCompileDraftInvoice}
                disabled={!canCreateDraft}
                className="flex-1 py-2.5 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Xác nhận lập nháp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
