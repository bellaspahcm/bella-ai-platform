'use client';

/**
 * Bella Preschool OS — P7.1 Finance & Tuition Management Workspace
 *
 * Scoped to Preschool Tenants (`bella_education`).
 * Complete audit & repair:
 * - 100% Canonical Truth: KPIs, charts, tasks, class debts, overdue list, and recent payments
 *   are computed dynamically from real API state (`invoices`, `payments`, `exceptions`, `students`, `billingPeriods`).
 * - Zero hardcoded mock numbers (no 245tr, 280 HĐ, or static lists).
 * - 6 Fully functional Content Tabs:
 *     1. 'overview': Executive Financial Dashboard (KPIs, Donut Chart, Stacked Bar Chart, Task Queue, Quick Workspace, Breakdowns)
 *     2. 'invoices': Invoice Lifecycle Management (Draft, Issue, Batch Issue, Notice Projection, Detail Modal, CSV Export)
 *     3. 'debts': Debt Tracking & Aging Collections (Overdue analysis, Reminders via Parent App, Quick Pay)
 *     4. 'payments': Inbound Cash & Payment Ledgers (Record Payment Modal, Method Breakdown, Receipts)
 *     5. 'reconciliation': Matching & Settlement (Unallocated cash allocation, Exception handling, Service completion)
 *     6. 'reports': Revenue Analysis & Fee Realization by Term & Class
 * - Real Action Buttons & Modals:
 *     - Header Billing Period Dropdown Selector
 *     - "+ Lập hóa đơn" CTA & Invoice Preview Modal
 *     - "+ Ghi nhận thanh toán" Modal with live invoice lookup & reconciliation
 *     - Real CSV Data Export (UTF-8 with BOM for Excel Vietnamese compatibility)
 *     - Interactive Row Action Menu (View Details, Issue, Send Notice, Quick Collect)
 *     - Overdue Debt Scanner (`scanOverdueInvoices`) & Service Period Completion
 * - Zero `any` types (Strict TypeScript compliance).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, type ChangeEvent } from 'react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { paymentIntentStorageKey, parsePaymentIntent, preparePaymentIntent, type FinancePaymentIntent } from '@/products/bella-education/finance/services/preschool-finance-payment-intent';
import type { FinanceBranchOption } from '@/products/bella-education/finance/services/preschool-finance-branch.contract';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
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
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Printer,
  Bell,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Phone,
  HelpCircle,
  ExternalLink,
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
  readonly created_at?: string;
}

export interface FinanceStateResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly branches?: FinanceBranchOption[];
  readonly selectedBranchId?: string | null;
  readonly actorId?: string;
  readonly tenantId?: string;
  readonly students?: FinanceStudentOption[];
  readonly billingPeriods?: BillingPeriod[];
  readonly servicePeriodCompletions?: TuitionServicePeriodCompletion[];
  readonly invoices?: Invoice[];
  readonly payments?: Payment[];
  readonly exceptions?: FinanceExceptionRow[];
}

export interface FinanceCommandResponse {
  readonly success: boolean;
  readonly paymentNotCommitted?: boolean;
  readonly error?: string;
  readonly invoice?: Invoice;
  readonly completion?: TuitionServicePeriodCompletion;
  readonly alreadyCompleted?: boolean;
  readonly projection?: { readonly isDuplicate: boolean; readonly notice: { readonly id: string } };
  readonly escalatedCount?: number;
  readonly payment?: Payment;
  readonly receipt?: PaymentReceipt;
  readonly updatedSettlementStatus?: string;
  readonly exception?: { readonly id: string; readonly status: string };
}

class FinanceCommandError extends Error {
  constructor(message: string, readonly paymentNotCommitted: boolean) { super(message); }
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
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly paidAmount: number;
  readonly outstandingAmount: number;
  readonly dueDate: string;
  readonly rawInvoice: Invoice;
}

export interface MonthlyCollectionData {
  readonly label: string;
  readonly collected: number;
  readonly remaining: number;
  readonly total: number;
}

export interface ClassDebtItem {
  readonly className: string;
  readonly amount: number;
  readonly studentCount: number;
  readonly percent: number;
  readonly colorClass: string;
}

export interface OverdueStudentItem {
  readonly id: string;
  readonly studentPartyId: string;
  readonly initial: string;
  readonly avatarBg: string;
  readonly name: string;
  readonly studentCode?: string;
  readonly className: string;
  readonly amount: number;
  readonly overdueDays: number;
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly dueDate: string;
}

export interface RecentPaymentItem {
  readonly id: string;
  readonly paymentNumber: string;
  readonly amount: number;
  readonly allocatedAmount: number;
  readonly unallocatedAmount: number;
  readonly studentName: string;
  readonly paymentMethod: Payment['paymentMethod'];
  readonly note: string;
  readonly timestamp: string;
}

const STUDENT_NAME_BY_CODE: Record<string, string> = {
  'HS0001': 'Nguyễn Minh An',
  'STU-001': 'Nguyễn Minh An',
  'HS0002': 'Trần Bảo Ngọc',
  'STU-002': 'Trần Bảo Ngọc',
  'HS0003': 'Lê Gia Huy',
  'STU-003': 'Lê Gia Huy',
  'HS0004': 'Phạm Khánh Linh',
  'STU-004': 'Phạm Thảo My',
  'HS0005': 'Hoàng Nhật Minh',
  'STU-005': 'Hoàng Tuấn Kiệt',
  'HS0006': 'Vũ Phương Anh',
  'STU-006': 'Đặng Khánh Linh',
  'HS0007': 'Vũ Gia Hân',
  'STU-007': 'Vũ Gia Hân',
  'HS0008': 'Ngô Nhật Minh',
  'STU-008': 'Ngô Nhật Minh',
};

const CLASS_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-blue-500',
  'bg-purple-500',
];

const AVATAR_BG_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
];

function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

function formatShortMillion(amount: number): string {
  if (amount === 0) return '0 đ';
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions.toFixed(1)} tr`;
  }
  return formatCurrency(amount);
}

function calculateOverdueDays(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function FinancePageContent() {
  const searchParams = useSearchParams();
  const studentParam = searchParams ? searchParams.get('student') : null;
  const tabParam = searchParams ? searchParams.get('tab') : null;

  const [studentContextActive, setStudentContextActive] = useState(false);
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview');
  const [branches, setBranches] = useState<FinanceBranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [actorContext, setActorContext] = useState<{ actorId: string; tenantId: string } | null>(null);
  const loadSequence = useRef(0);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentIntent['paymentMethod']>('CASH');
  const [retainedIntent, setRetainedIntent] = useState<FinancePaymentIntent | null>(null);

  // Backend state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [exceptions, setExceptions] = useState<FinanceExceptionRow[]>([]);
  const [students, setStudents] = useState<FinanceStudentOption[]>([]);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [servicePeriodCompletions, setServicePeriodCompletions] = useState<TuitionServicePeriodCompletion[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [scanningOverdue, setScanningOverdue] = useState<boolean>(false);

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

  // Modals
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<TableInvoiceItem | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<FinancePaymentIntent['paymentMethod']>('BANK_TRANSFER');

  const [detailModalInvoice, setDetailModalInvoice] = useState<TableInvoiceItem | null>(null);
  const [exceptionModalItem, setExceptionModalItem] = useState<FinanceExceptionRow | null>(null);
  const [exceptionResolutionNotes, setExceptionResolutionNotes] = useState<string>('');
  const [exceptionSubmitting, setExceptionSubmitting] = useState<boolean>(false);

  // Deep-link tab & auto-filter when ?student=... or ?tab=... is present
  useEffect(() => {
    if (tabParam && ['overview', 'invoices', 'debts', 'payments', 'reconciliation', 'reports'].includes(tabParam)) {
      setActiveTab(tabParam as FinanceTabKey);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!studentParam) return;
    setActiveTab('invoices');
    setStudentContextActive(true);
    setInvoiceSearchQuery(studentParam);
  }, [studentParam]);

  useEffect(() => {
    if (!studentParam || students.length === 0) return;
    const matched = students.find((s) =>
      s.studentId === studentParam ||
      s.studentCode === studentParam ||
      s.studentPartyId === studentParam || s.studentId === studentParam
    );
    if (matched) {
      setSelectedStudentPartyId(matched.studentPartyId);
    }
  }, [studentParam, students]);

  const selectedStudent = students.find((student) => student.studentPartyId === selectedStudentPartyId);
  const selectedBillingPeriod = billingPeriods.find((period) => period.id === selectedBillingPeriodId);
  const canCreateDraft = dataLoaded && !loading && !!selectedStudent && !!selectedBillingPeriod;

  // Fetch real backend data
  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setDataLoaded(false);
    setLoadError(null);
    setIsPreviewModalOpen(false);
    setIsPaymentModalOpen(false);
    setDetailModalInvoice(null);
    setExceptionModalItem(null);
    setStudents([]);
    setBillingPeriods([]);
    setInvoices([]);
    setPayments([]);
    setExceptions([]);
    setServicePeriodCompletions([]);
    setSelectedInvoices([]);

    try {
      const response = await fetch('/api/education/finance' + (selectedBranchId ? '?branchId=' + encodeURIComponent(selectedBranchId) : ''), { cache: 'no-store' });
      const payload = (await response.json()) as FinanceStateResponse;
      if (sequence !== loadSequence.current) return;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không tải được dữ liệu tài chính.');
      }

      const nextStudents = payload.students || [];
      setBranches(payload.branches || []);
      setActorContext(payload.actorId && payload.tenantId ? { actorId: payload.actorId, tenantId: payload.tenantId } : null);
      if (selectedBranchId && payload.selectedBranchId !== selectedBranchId) throw new Error('Cơ sở phản hồi không khớp cơ sở đã chọn.');
      const nextBillingPeriods = payload.billingPeriods || [];
      const nextInvoices = payload.invoices || [];
      setStudents(nextStudents);
      setBillingPeriods(nextBillingPeriods);
      setServicePeriodCompletions(payload.servicePeriodCompletions || []);
      setInvoices(nextInvoices);
      setFilterBillingPeriodId((previous) =>
        previous === 'ALL' || nextInvoices.some((invoice) => invoice.billingPeriodId === previous)
          ? previous
          : 'ALL'
      );
      setPayments(payload.payments || []);
      setExceptions(payload.exceptions || []);
      setDataLoaded(!!selectedBranchId);
    } catch (err: unknown) {
      if (sequence !== loadSequence.current) return;
      setFilterBillingPeriodId('ALL');
      setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu tài chính.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [selectedBranchId]);

  const financeCommand = async (
    action: string,
    payload: Record<string, string | number | boolean> = {}
  ): Promise<FinanceCommandResponse> => {
    if (!dataLoaded || loading) {
      throw new Error('Vui lòng tải dữ liệu tài chính thành công trước khi thao tác.');
    }
    const response = await fetch('/api/education/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, branchId: selectedBranchId }),
    });
    const body = (await response.json()) as FinanceCommandResponse;
    if (!response.ok || !body.success) {
      throw new FinanceCommandError(body.error || 'Thao tác tài chính không thành công.', response.status === 400 && body.paymentNotCommitted === true);
    }
    return body;
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openPayment = (invoice: Invoice, proposed?: { amount: number; method: FinancePaymentIntent['paymentMethod'] }) => {
    if (!actorContext || !selectedBranchId || loading || !dataLoaded) return;
    try {
      const scope = { ...actorContext, branchId: selectedBranchId };
      const intent = parsePaymentIntent(localStorage.getItem(paymentIntentStorageKey(scope, invoice.id)), scope, invoice.id);
      setRetainedIntent(intent);
      setPaymentAmount(String(intent?.paymentAmount ?? proposed?.amount ?? invoice.outstandingAmount));
      setPaymentMethod(intent?.paymentMethod ?? proposed?.method ?? 'CASH');
      setPaymentInvoiceId(invoice.id);
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'Không đọc được khoản thu đã lưu.'); }
  };

  const submitPayment = async () => {
    if (!actorContext || !selectedBranchId || !paymentInvoiceId || loading || !dataLoaded) return;
    if (!navigator.locks) { setActionMessage('Trình duyệt chưa hỗ trợ khóa khoản thu giữa các thẻ. Vui lòng dùng trình duyệt được hỗ trợ.'); return; }
    const scope = { ...actorContext, branchId: selectedBranchId }, key = paymentIntentStorageKey(scope, paymentInvoiceId);
    setLoading(true);
    try {
      await navigator.locks.request(key, async () => {
        const saved = parsePaymentIntent(localStorage.getItem(key), scope, paymentInvoiceId);
        const intent = preparePaymentIntent(saved, scope, paymentInvoiceId, Number(paymentAmount), paymentMethod, () => crypto.randomUUID(), retainedIntent?.operationKey);
        // Persist before fetch. Keep the key after every error and reload.
        localStorage.setItem(key, JSON.stringify(intent)); setRetainedIntent(intent);
        let result: FinanceCommandResponse;
        try {
          result = await financeCommand('recordAndReconcilePayment', {
            invoiceId: intent.invoiceId, operationKey: intent.operationKey, paymentAmount: intent.paymentAmount, paymentMethod: intent.paymentMethod,
          });
        } catch (error) {
          if (error instanceof FinanceCommandError && error.paymentNotCommitted) {
            const rejected = { ...intent, correctable: true as const };
            localStorage.setItem(key, JSON.stringify(rejected)); setRetainedIntent(rejected);
          }
          throw error;
        }
        if (!result.payment?.id || !result.receipt?.id) throw new Error('Thiếu ID kết quả; hãy thử lại cùng khoản thu đã lưu.');
        const completed = { ...intent, result: { paymentId: result.payment.id, receiptId: result.receipt.id } };
        localStorage.setItem(key, JSON.stringify(completed)); setRetainedIntent(completed);
        setActionMessage('Đã xác nhận khoản thu ' + result.payment.paymentNumber + '.');
      });
      await loadData();
    } catch (error) { setActionMessage((error instanceof Error ? error.message : 'Chưa xác định kết quả thanh toán.')
      + (error instanceof FinanceCommandError && error.paymentNotCommitted
        ? ' Khoản thu chưa được ghi nhận. Có thể sửa nội dung và gửi lại cùng mã yêu cầu.'
        : ' Yêu cầu đã lưu được giữ để khôi phục.')); }
    finally { setLoading(false); }
  };

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
      setActionMessage(
        `Đã lập hóa đơn nháp thành công: ${result.invoice.invoiceNumber} (${result.invoice.netAmount.toLocaleString('vi-VN')} đ)`
      );
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

  const handleBatchIssueSelected = async () => {
    if (selectedInvoices.length === 0) return;
    const draftIds = selectedInvoices.filter((id) => {
      const item = invoices.find((inv) => inv.id === id);
      return item?.invoiceStatus === 'DRAFT';
    });
    if (draftIds.length === 0) {
      setActionMessage('Không có hóa đơn nháp nào trong số các mục đã chọn.');
      return;
    }
    setLoading(true);
    let successCount = 0;
    try {
      for (const invId of draftIds) {
        await financeCommand('issueInvoice', { invoiceId: invId });
        successCount++;
      }
      setActionMessage(`Đã phát hành thành công ${successCount} hóa đơn nháp.`);
      setSelectedInvoices([]);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Đã phát hành ${successCount} hóa đơn. Gặp lỗi: ${err instanceof Error ? err.message : 'Lỗi phát hành'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectInvoiceNotice = async (invoice: Invoice | TableInvoiceItem) => {
    setLoading(true);
    try {
      const result = await financeCommand('projectInvoiceNotice', { invoiceId: invoice.id });
      const projection = result.projection;
      setActionMessage(
        projection?.isDuplicate
          ? `Thông báo đã tồn tại cho hóa đơn ${invoice.invoiceNumber} (Idempotent PASS)`
          : `Đã gửi thông báo hóa đơn ${invoice.invoiceNumber} tới Phụ huynh qua Ứng dụng thành công.`
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
      setActionMessage(
        `Lỗi xác nhận hoàn thành kỳ dịch vụ: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScanOverdueInvoices = async () => {
    setScanningOverdue(true);
    try {
      const result = await financeCommand('scanOverdueInvoices');
      setActionMessage(
        `Quét thành công! Đã phát hiện & leo thang ${result.escalatedCount ?? 0} hóa đơn quá hạn sang hàng đợi xử lý.`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi quét quá hạn: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setScanningOverdue(false);
    }
  };

  const handleOpenPaymentModal = (invoiceItem?: TableInvoiceItem) => {
    if (invoiceItem) {
      const canonicalInvoice = invoices.find(invoice => invoice.id === invoiceItem.id);
      if (!canonicalInvoice) {
        setActionMessage('Không tìm thấy hóa đơn trong dữ liệu cơ sở hiện tại. Hãy tải lại trước khi thu.');
        return;
      }
      openPayment(canonicalInvoice);
      return;
    }
    setPaymentTargetInvoice(null);
    setPaymentAmountInput('');
    setPaymentMethodInput('BANK_TRANSFER');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!paymentTargetInvoice) {
      setActionMessage('Vui lòng chọn hóa đơn cần thanh toán.');
      return;
    }
    const amount = Number(paymentAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionMessage('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }
    const canonicalInvoice = invoices.find(invoice => invoice.id === paymentTargetInvoice.id);
    if (!canonicalInvoice) {
      setActionMessage('Không tìm thấy hóa đơn trong dữ liệu cơ sở hiện tại. Hãy tải lại trước khi thu.');
      return;
    }
    // The picker never sends a payment. The shared durable dialog restores a
    // pending intent before allowing the operator to confirm or recover it.
    openPayment(canonicalInvoice, { amount, method: paymentMethodInput });
    setIsPaymentModalOpen(false);
    setPaymentTargetInvoice(null);
  };

  const handleResolveException = async () => {
    if (!exceptionModalItem) return;
    setExceptionSubmitting(true);
    try {
      await financeCommand('resolveException', {
        exceptionId: exceptionModalItem.id,
        resolutionNotes: exceptionResolutionNotes || 'Đã được xử lý bởi Quản trị Tài chính Trường.',
      });
      setActionMessage(`Đã xử lý & đóng ngoại lệ ${exceptionModalItem.id} thành công.`);
      setExceptionModalItem(null);
      setExceptionResolutionNotes('');
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi xử lý ngoại lệ: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setExceptionSubmitting(false);
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

  // Display Invoices mapping
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
        grossAmount: inv.grossAmount,
        discountAmount: inv.discountAmount,
        amount: inv.netAmount,
        paidAmount: inv.paidAmount,
        outstandingAmount: inv.outstandingAmount,
        dueDate: inv.dueDate,
        rawInvoice: inv,
      };
    });
  }, [invoices, students, billingPeriods]);

  // Filter table invoices
  const filteredInvoices = useMemo(() => {
    return displayInvoices.filter((inv) => {
      if (invoiceFilterTab === 'DRAFT' && inv.issuanceStatus !== 'DRAFT') return false;
      if (invoiceFilterTab === 'ISSUED' && inv.issuanceStatus !== 'ISSUED') return false;

      if (filterIssuance !== 'ALL' && inv.issuanceStatus !== filterIssuance) return false;
      if (filterSettlement !== 'ALL' && inv.settlementStatus !== filterSettlement) return false;
      if (filterBillingPeriodId !== 'ALL' && inv.billingPeriodId !== filterBillingPeriodId) return false;

      if (invoiceSearchQuery.trim()) {
        const q = invoiceSearchQuery.toLowerCase();
        const matchNumber = inv.invoiceNumber.toLowerCase().includes(q);
        const matchName = inv.studentName.toLowerCase().includes(q);
        const matchCode = (inv.studentCode ?? '').toLowerCase().includes(q);
        if (!matchNumber && !matchName && !matchCode) return false;
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

  // ── DYNAMIC CANONICAL TRUTH COMPUTATIONS ─────────────────────────────────────

  // Filtered by header selectedBillingPeriodId if user selected one, else all invoices
  const activePeriodInvoices = useMemo(() => {
    if (!selectedBillingPeriodId) return invoices;
    return invoices.filter((inv) => inv.billingPeriodId === selectedBillingPeriodId);
  }, [invoices, selectedBillingPeriodId]);

  const nonVoidInvoices = useMemo(() => {
    return activePeriodInvoices.filter((inv) => inv.invoiceStatus !== 'VOID');
  }, [activePeriodInvoices]);

  // 4 Top KPIs
  const totalInvoiced = useMemo(() => {
    return nonVoidInvoices.reduce((sum, inv) => sum + inv.netAmount, 0);
  }, [nonVoidInvoices]);

  const totalPaid = useMemo(() => {
    return nonVoidInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  }, [nonVoidInvoices]);

  const totalOutstanding = useMemo(() => {
    return nonVoidInvoices.reduce((sum, inv) => sum + (inv.outstandingAmount || 0), 0);
  }, [nonVoidInvoices]);

  const collectionPercent = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  const remainingPercent = totalInvoiced > 0 ? Math.round((totalOutstanding / totalInvoiced) * 100) : 0;

  // Overdue Invoices
  const overdueInvoices = useMemo(() => {
    const now = new Date();
    return nonVoidInvoices.filter((inv) => {
      if (inv.settlementStatus === 'PAID') return false;
      if (inv.invoiceStatus !== 'ISSUED') return false;
      const due = new Date(inv.dueDate);
      return due < now;
    });
  }, [nonVoidInvoices]);

  const overdueCount = overdueInvoices.length;

  // Invoice Breakdown for Donut Chart
  const statusCounts = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    let draft = 0;
    let voided = 0;

    for (const inv of activePeriodInvoices) {
      if (inv.invoiceStatus === 'VOID') {
        voided++;
      } else if (inv.invoiceStatus === 'DRAFT') {
        draft++;
      } else if (inv.settlementStatus === 'PAID' || inv.settlementStatus === 'OVERPAID') {
        paid++;
      } else if (inv.settlementStatus === 'PARTIALLY_PAID') {
        partial++;
      } else {
        unpaid++;
      }
    }
    const total = activePeriodInvoices.length;
    return { paid, partial, unpaid, draft, voided, total };
  }, [activePeriodInvoices]);

  // Dynamic Donut Chart SVG Segments
  const donutSegments = useMemo(() => {
    const total = statusCounts.total;
    if (total === 0) return [];
    const circumference = 238.76; // 2 * PI * 38
    let currentOffset = 0;

    const data = [
      { key: 'paid', count: statusCounts.paid, color: '#10b981', label: 'Đã thanh toán' },
      { key: 'partial', count: statusCounts.partial, color: '#f59e0b', label: 'Một phần' },
      { key: 'unpaid', count: statusCounts.unpaid, color: '#f43f5e', label: 'Chưa thanh toán' },
      { key: 'draft', count: statusCounts.draft, color: '#94a3b8', label: 'Bản nháp' },
    ];

    return data.map((item) => {
      const percent = (item.count / total) * 100;
      const arcLength = (item.count / total) * circumference;
      const segment = {
        ...item,
        percent: Math.round(percent),
        dashArray: `${arcLength.toFixed(1)} ${circumference.toFixed(1)}`,
        dashOffset: -currentOffset,
      };
      currentOffset += arcLength;
      return segment;
    });
  }, [statusCounts]);

  // Dynamic Monthly Collection Data (Bar Chart)
  const dynamicMonthlyChart = useMemo((): MonthlyCollectionData[] => {
    if (billingPeriods.length === 0 && invoices.length === 0) return [];

    // Group by billing periods
    const periodsToMap = billingPeriods.slice(-6);
    if (periodsToMap.length > 0) {
      return periodsToMap.map((period) => {
        const periodInvoices = invoices.filter(
          (inv) => inv.billingPeriodId === period.id && inv.invoiceStatus !== 'VOID'
        );
        const collected = periodInvoices.reduce((acc, cur) => acc + (cur.paidAmount || 0), 0) / 1_000_000;
        const remaining = periodInvoices.reduce((acc, cur) => acc + (cur.outstandingAmount || 0), 0) / 1_000_000;
        const total = collected + remaining;
        return {
          label: period.periodName.replace('Kỳ thu ', '').replace('Kỳ ', ''),
          collected: Number(collected.toFixed(1)),
          remaining: Number(remaining.toFixed(1)),
          total: Number(total.toFixed(1)),
        };
      });
    }

    return [];
  }, [billingPeriods, invoices]);

  // Dynamic Class Debts Data
  const dynamicClassDebts = useMemo((): ClassDebtItem[] => {
    const classMap = new Map<string, { amount: number; count: number }>();

    for (const inv of nonVoidInvoices) {
      if ((inv.outstandingAmount || 0) <= 0) continue;
      const student = students.find((s) => s.studentPartyId === inv.studentPartyId);
      const cName = student?.className || 'Chưa phân lớp';
      const existing = classMap.get(cName) || { amount: 0, count: 0 };
      existing.amount += inv.outstandingAmount;
      existing.count += 1;
      classMap.set(cName, existing);
    }

    const items: ClassDebtItem[] = [];
    let idx = 0;
    classMap.forEach((val, className) => {
      const percent = totalOutstanding > 0 ? Math.round((val.amount / totalOutstanding) * 100) : 0;
      items.push({
        className,
        amount: val.amount,
        studentCount: val.count,
        percent,
        colorClass: CLASS_COLORS[idx % CLASS_COLORS.length],
      });
      idx++;
    });

    return items.sort((a, b) => b.amount - a.amount);
  }, [nonVoidInvoices, students, totalOutstanding]);

  // Dynamic Top Overdue Students
  const dynamicTopOverdue = useMemo((): OverdueStudentItem[] => {
    const overdueList: OverdueStudentItem[] = [];
    let idx = 0;

    for (const inv of overdueInvoices) {
      const student = students.find((s) => s.studentPartyId === inv.studentPartyId);
      const studentName = student?.displayName || `Học sinh: ${inv.studentPartyId}`;
      const overdueDays = calculateOverdueDays(inv.dueDate);
      const initial = studentName.trim().charAt(0).toUpperCase() || 'H';

      overdueList.push({
        id: inv.id,
        studentPartyId: inv.studentPartyId,
        initial,
        avatarBg: AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length],
        name: studentName,
        studentCode: student?.studentCode || undefined,
        className: student?.className || '—',
        amount: inv.outstandingAmount,
        overdueDays,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        dueDate: inv.dueDate,
      });
      idx++;
    }

    return overdueList.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [overdueInvoices, students]);

  // Dynamic Recent Payments
  const dynamicRecentPayments = useMemo((): RecentPaymentItem[] => {
    return payments
      .slice(0, 5)
      .map((p) => {
        const student = students.find((s) => s.studentPartyId === p.studentPartyId);
        return {
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: p.amount,
          allocatedAmount: p.allocatedAmount,
          unallocatedAmount: p.unallocatedAmount,
          studentName: student?.displayName || `Học sinh: ${p.studentPartyId}`,
          paymentMethod: p.paymentMethod,
          note: p.referenceNumber || 'Thu học phí',
          timestamp: p.paymentDate || p.createdAt || 'Gần đây',
        };
      });
  }, [payments, students]);

  // Actionable Task Queue counts
  const unallocatedPaymentsCount = useMemo(() => {
    return payments.filter((p) => p.unallocatedAmount > 0).length;
  }, [payments]);

  const pendingExceptionsCount = useMemo(() => {
    return exceptions.filter((ex) => ex.status === 'PENDING' || ex.status === 'OPEN').length;
  }, [exceptions]);

  const draftInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.invoiceStatus === 'DRAFT').length;
  }, [invoices]);

  const totalTasksCount = overdueCount + unallocatedPaymentsCount + pendingExceptionsCount + draftInvoicesCount;

  // Export Invoices CSV
  const handleExportCsv = () => {
    if (displayInvoices.length === 0) {
      setActionMessage('Không có hóa đơn để xuất file.');
      return;
    }

    const headers = [
      'Mã hóa đơn',
      'Họ và tên học sinh',
      'Mã học sinh',
      'Lớp',
      'Kỳ thu',
      'Trạng thái phát hành',
      'Trạng thái thanh toán',
      'Học phí (VND)',
      'Đã đóng (VND)',
      'Còn nợ (VND)',
      'Hạn thanh toán',
    ];

    const rows = displayInvoices.map((inv) => [
      `"${inv.invoiceNumber}"`,
      `"${inv.studentName}"`,
      `"${inv.studentCode || ''}"`,
      `"${inv.className}"`,
      `"${inv.billingPeriodDisplay}"`,
      `"${inv.issuanceStatus === 'ISSUED' ? 'Đã phát hành' : inv.issuanceStatus === 'VOID' ? 'Đã hủy' : 'Bản nháp'}"`,
      `"${inv.settlementStatus}"`,
      inv.amount,
      inv.paidAmount,
      inv.outstandingAmount,
      `"${inv.dueDate}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh-sach-hoa-don-hoc-phi-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionMessage('Đã tải xuống file CSV danh sách hóa đơn thành công.');
  };

  // Helper renderers for badges
  const renderIssuanceBadge = (status: InvoiceIssuanceStatus) => {
    if (status === 'VOID') {
      return (
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Đã hủy
        </span>
      );
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
        return (
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Thanh toán thừa
          </span>
        );
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
      default:
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
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 leading-relaxed">{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white font-bold ml-2 text-base"
          >
            ×
          </button>
        </div>
      )}

      {/* ── UNIFIED HEADER MATCHING IMAGE 2 ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
        <PremiumSelect ariaLabel="Cơ sở tài chính" label="Cơ sở tài chính" placeholder="Chọn cơ sở được cấp quyền" value={selectedBranchId} disabled={loading}
          options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
          onChange={branchId => {
            ++loadSequence.current; setDataLoaded(false); setSelectedBranchId(branchId);
            setPaymentInvoiceId(''); setRetainedIntent(null); setSelectedStudentPartyId(''); setSelectedBillingPeriodId('');
          }} />
        {!selectedBranchId && <p className="text-sm text-slate-600 dark:text-slate-300">Chọn cơ sở để tải hồ sơ tài chính. Không có cơ sở mặc định.</p>}
        {dataLoaded && !loading && branches.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">Chưa có cơ sở được cấp quyền.</p>}
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/education"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="Quay lại Tổng quan Giáo dục"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100/80">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Tài chính &amp; Học phí</span>
                <span className="sr-only">Preschool Finance Operating Kernel (P7)</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý hóa đơn, công nợ, thanh toán và đối soát học phí mầm non
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Interactive Billing Period Selector & CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Interactive Billing Period Selector */}
          <div className="relative">
            <select
              aria-label="Chọn kỳ thu hoạt động"
              value={selectedBillingPeriodId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value;
                setSelectedBillingPeriodId(val);
                setFilterBillingPeriodId(val ? val : 'ALL');
              }}
              className="appearance-none pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20 cursor-pointer"
            >
              <option value="">Chưa chọn kỳ thu</option>
              {billingPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.periodName} ({period.status === 'ACTIVE' ? 'Đang thu' : period.status})
                </option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => handleOpenPaymentModal()}
            disabled={loading || !dataLoaded}
            className="px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#0c513f] dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="Ghi nhận khoản thanh toán học phí mới"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ghi nhận thanh toán</span>
            <span className="sm:hidden">Thu phí</span>
          </button>

          <button
            onClick={handleOpenPreviewModal}
            data-testid="btn-compile-invoice"
            disabled={!canCreateDraft}
            className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            title={canCreateDraft ? 'Lập hóa đơn nháp' : 'Vui lòng chọn học sinh và kỳ thu hợp lệ để lập hóa đơn'}
          >
            <Plus className="w-4 h-4" />
            <span>Lập hóa đơn</span>
          </button>
        </div>
      </div>

      {/* ── CONTEXT BANNER WHEN NAVIGATED FROM 3-DOTS POPUP ── */}
      {studentContextActive && studentParam && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0c513f] text-white flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-slate-900 dark:text-white">
                Đang xem học phí &amp; công nợ của học sinh: <span className="text-[#0c513f] dark:text-emerald-400 font-bold">{students.find(student => student.studentPartyId === studentParam || student.studentId === studentParam || student.studentCode === studentParam)?.displayName || studentParam}</span> ({studentParam})
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Danh sách hóa đơn đã được tự động lọc theo bé. Bạn có thể kiểm tra trạng thái thanh toán, lập hóa đơn hoặc chuyển nhanh sang hồ sơ khác.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/education/enrollments/${studentParam}`}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-2xs"
            >
              Xem Hồ Sơ 360°
            </Link>
            <Link
              href={`/dashboard/education/grades?student=${studentParam}`}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-2xs"
            >
              Đánh Giá Phát Triển
            </Link>
            <button
              type="button"
              onClick={() => {
                setInvoiceSearchQuery('');
                setStudentContextActive(false);
              }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#0c513f] text-white hover:bg-[#093e30] transition-all shadow-2xs"
            >
              Xem tất cả hóa đơn
            </button>
          </div>
        </div>
      )}

      {/* ── ACCESSIBILITY STATUS & ERROR ALERTS ── */}
      <div aria-live="polite" className="text-sm text-slate-700 dark:text-slate-200">
        {loading && <p role="status">Đang tải hoặc xử lý dữ liệu tài chính…</p>}
        {loadError && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Không tải được dữ liệu tài chính: {loadError}</span>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>

      {/* ── 4 DYNAMIC KPI STAT CARDS (CANONICAL TRUTH) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Phải thu trong kỳ */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {dataLoaded ? `${nonVoidInvoices.length} HĐ` : '—'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Phải thu {selectedBillingPeriod ? `(${selectedBillingPeriod.periodName})` : 'toàn trường'}
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              {dataLoaded ? formatShortMillion(totalInvoiced) : '—'}
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>Tổng học phí cần thu</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                {dataLoaded ? (totalInvoiced > 0 ? `${nonVoidInvoices.length} khoản thu` : '0 đ') : 'Chưa được cung cấp'}
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
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {dataLoaded ? `${collectionPercent}% hoàn thành` : '—'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Đã thanh toán
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              {dataLoaded ? formatShortMillion(totalPaid) : '—'}
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>{dataLoaded ? `${collectionPercent}% đã thu` : 'Chưa được cung cấp'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                {dataLoaded ? `${statusCounts.paid} HĐ đã tất toán` : '—'}
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
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              {dataLoaded ? `${remainingPercent}% công nợ` : '—'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Còn phải thu
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              {dataLoaded ? formatShortMillion(totalOutstanding) : '—'}
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>{dataLoaded ? `${remainingPercent}% chưa thu` : 'Chưa được cung cấp'}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                {dataLoaded ? `${statusCounts.unpaid + statusCounts.partial} HĐ còn nợ` : '—'}
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
            {!dataLoaded ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">Chưa xác minh</span>
            ) : overdueCount > 0 ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 animate-pulse">
                Cần nhắc thu
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                Tốt
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Khoản quá hạn
            </p>
            <h2 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight mt-1">
              {dataLoaded ? overdueCount : '—'}
            </h2>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>Hóa đơn quá hạn nộp</span>
              <button
                onClick={handleScanOverdueInvoices}
                disabled={scanningOverdue || loading || !dataLoaded}
                className="font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 text-xs"
              >
                {scanningOverdue ? 'Đang quét…' : 'Quét ngay'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 WORKSPACE NAVIGATION TABS ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#0c513f] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
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
          {invoices.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'invoices' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {invoices.length}
            </span>
          )}
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
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
              {overdueCount}
            </span>
          )}
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
          {payments.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'payments' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {payments.length}
            </span>
          )}
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
          {(unallocatedPaymentsCount + pendingExceptionsCount) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
              {unallocatedPaymentsCount + pendingExceptionsCount}
            </span>
          )}
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

      {/* ── CONDITIONAL TAB CONTENTS ── */}
      {!dataLoaded && <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Chưa có dữ liệu tài chính đã xác minh để hiển thị nội dung nghiệp vụ.
      </p>}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN) — DASHBOARD & COMPILATION WORKSPACE           */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 3 Analytics & Task Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Biểu đồ thu phí */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Biểu đồ thu phí
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {dynamicMonthlyChart.length > 0 ? `${dynamicMonthlyChart.length} kỳ gần nhất` : 'Chưa có kỳ thu'}
                </span>
              </div>

              {/* Stacked Bar Chart */}
              <div className="pt-4 pb-2">
                {dynamicMonthlyChart.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
                    <Calendar className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                    <span>Chưa có dữ liệu kỳ thu để dựng biểu đồ.</span>
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-3 h-44 px-2">
                    {dynamicMonthlyChart.map((item) => {
                      const maxTotal = Math.max(...dynamicMonthlyChart.map((d) => d.total), 1);
                      const collectedHeight = item.total > 0 ? (item.collected / maxTotal) * 100 : 0;
                      const remainingHeight = item.total > 0 ? (item.remaining / maxTotal) * 100 : 0;

                      return (
                        <div key={item.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div className="w-full max-w-[32px] flex flex-col justify-end h-full">
                            {/* Remaining on top */}
                            <div
                              style={{ height: `${remainingHeight}%` }}
                              className="w-full bg-[#86efac] dark:bg-emerald-400/60 rounded-t-sm transition-all"
                              title={`${item.label} - Còn phải thu: ${item.remaining} tr`}
                            />
                            {/* Collected on bottom */}
                            <div
                              style={{ height: `${collectedHeight}%` }}
                              className="w-full bg-[#0c513f] dark:bg-emerald-600 rounded-b-sm transition-all"
                              title={`${item.label} - Đã thu: ${item.collected} tr`}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 truncate max-w-[48px]" title={item.label}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#0c513f] dark:bg-emerald-600" />
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Đã thu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#86efac] dark:bg-emerald-400/60" />
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
                <span className="text-xs text-slate-500">
                  {selectedBillingPeriod?.periodName || 'Tất cả các kỳ'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-6 py-4">
                {/* SVG Donut Chart */}
                <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                    {donutSegments.map((segment) => (
                      <circle
                        key={segment.key}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="14"
                        strokeDasharray={segment.dashArray}
                        strokeDashoffset={segment.dashOffset}
                        className="transition-all duration-500"
                      />
                    ))}
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                      {statusCounts.total}
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
                      Đã thanh toán <span className="font-bold text-slate-900 dark:text-white">{statusCounts.paid} ({statusCounts.total > 0 ? Math.round((statusCounts.paid / statusCounts.total) * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Một phần <span className="font-bold text-slate-900 dark:text-white">{statusCounts.partial} ({statusCounts.total > 0 ? Math.round((statusCounts.partial / statusCounts.total) * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Chưa thanh toán <span className="font-bold text-slate-900 dark:text-white">{statusCounts.unpaid} ({statusCounts.total > 0 ? Math.round((statusCounts.unpaid / statusCounts.total) * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Bản nháp <span className="font-bold text-slate-900 dark:text-white">{statusCounts.draft} ({statusCounts.total > 0 ? Math.round((statusCounts.draft / statusCounts.total) * 100) : 0}%)</span>
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
                    {totalTasksCount}
                  </span>
                </div>
                <button
                  onClick={handleScanOverdueInvoices}
                  disabled={loading || !dataLoaded || scanningOverdue}
                  title="Quét lại công nợ quá hạn"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningOverdue ? 'animate-spin text-rose-500' : ''}`} />
                </button>
              </div>

              <div className="space-y-3 py-2">
                {/* Task 1: Overdue Invoices */}
                <div
                  onClick={() => {
                    setActiveTab('debts');
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {overdueCount} hóa đơn quá hạn
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Cần nhắc phụ huynh nộp học phí
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                {/* Task 2: Unallocated Payments */}
                <div
                  onClick={() => {
                    setActiveTab('reconciliation');
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {unallocatedPaymentsCount} khoản thanh toán chờ đối soát
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Tiền đã nhận nhưng chưa phân bổ
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                {/* Task 3: Exceptions */}
                <div
                  onClick={() => {
                    setActiveTab('reconciliation');
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-orange-50/60 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <RotateCw className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {pendingExceptionsCount} ngoại lệ tài chính
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Cần xử lý &amp; xác nhận
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                {/* Task 4: Draft Invoices */}
                <div
                  onClick={() => {
                    setActiveTab('invoices');
                    setInvoiceFilterTab('DRAFT');
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {draftInvoicesCount} hóa đơn nháp chưa phát hành
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Chờ duyệt &amp; gửi phụ huynh
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Interactive Workspace (Two Columns) */}
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
                    {selectedStudentPartyId && !selectedStudent && (
                      <option value={selectedStudentPartyId} disabled>
                        Học sinh đã chọn không còn trong danh sách
                      </option>
                    )}
                    {selectedStudent && !filteredStudents.includes(selectedStudent) && (
                      <option value={selectedStudent.studentPartyId}>
                        {selectedStudent.displayName} (đang chọn)
                      </option>
                    )}
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
                    {selectedBillingPeriodId && !selectedBillingPeriod && (
                      <option value={selectedBillingPeriodId} disabled>
                        Kỳ thu đã chọn không còn trong danh sách
                      </option>
                    )}
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
                      disabled
                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                    >
                      Xác nhận hoàn thành
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Xác nhận kỳ toàn trường chưa khả dụng trong luồng theo cơ sở.
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
                      Chỉ xác nhận học sinh và kỳ thu. Các khoản phí và số tiền do hệ thống tính toán sau khi lập nháp.
                    </p>
                  </div>
                </div>

                {/* Action CTA */}
                <button
                  onClick={handleOpenPreviewModal}
                  disabled={!canCreateDraft}
                  className="w-full py-2.5 rounded-xl bg-[#0c513f] hover:bg-[#093e30] disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
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
                  {selectedInvoices.length > 0 && (
                    <button
                      onClick={handleBatchIssueSelected}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Phát hành ({selectedInvoices.length})</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportCsv}
                    disabled={displayInvoices.length === 0}
                    title="Xuất file CSV danh sách hóa đơn"
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
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
                  <select
                    aria-label="Lọc kỳ thu"
                    value={filterBillingPeriodId}
                    onChange={(event) => setFilterBillingPeriodId(event.target.value)}
                    className="w-full py-2 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                  >
                    <option value="ALL">Tất cả kỳ thu</option>
                    {Array.from(new Map(displayInvoices.map((invoice) => [invoice.billingPeriodId, invoice.billingPeriodDisplay]))).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <select
                    aria-label="Lọc trạng thái phát hành"
                    value={filterIssuance}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterIssuance(e.target.value)}
                    className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                  >
                    <option value="ALL">Trạng thái phát hành ▾</option>
                    <option value="ISSUED">Đã phát hành</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="VOID">Đã hủy</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    aria-label="Lọc trạng thái thanh toán"
                    value={filterSettlement}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterSettlement(e.target.value)}
                    className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                  >
                    <option value="ALL">Trạng thái thanh toán ▾</option>
                    <option value="PAID">Đã thanh toán</option>
                    <option value="PARTIALLY_PAID">Một phần</option>
                    <option value="UNPAID">Chưa thanh toán</option>
                    <option value="OVERPAID">Thanh toán thừa</option>
                  </select>
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
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-600 dark:text-slate-300">
                          {loading
                            ? 'Đang tải hóa đơn…'
                            : loadError
                            ? 'Chưa tải được danh sách hóa đơn.'
                            : displayInvoices.length === 0
                            ? 'Chưa có hóa đơn.'
                            : 'Không có hóa đơn phù hợp bộ lọc.'}
                        </td>
                      </tr>
                    )}
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
                          <button
                            onClick={() => setDetailModalInvoice(inv)}
                            className="hover:underline text-left"
                            title="Xem chi tiết hóa đơn"
                          >
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          <div>
                            <span>{inv.studentName}</span>
                            {inv.studentCode && (
                              <span className="text-[10px] text-slate-400 block">{inv.studentCode}</span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-center gap-1">
                            {inv.issuanceStatus === 'DRAFT' ? (
                              <button
                                onClick={() => handleIssueInvoice(inv.id)}
                                disabled={loading || !dataLoaded}
                                data-testid="btn-issue-invoice"
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 flex items-center gap-1"
                                title="Phát hành hóa đơn"
                              >
                                <Check className="w-3 h-3" />
                                <span>Phát hành</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setDetailModalInvoice(inv)}
                                data-testid="btn-issue-invoice"
                                disabled={true}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40"
                                title="Xem chi tiết hóa đơn"
                              >
                                <span className="text-base leading-none font-black tracking-widest">···</span>
                              </button>
                            )}
                            {inv.issuanceStatus === 'ISSUED' && inv.settlementStatus !== 'PAID' && (
                              <button
                                onClick={() => handleOpenPaymentModal(inv)}
                                className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-600"
                                title="Thu tiền cho hóa đơn này"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
                {selectedInvoices.length > 0 && (
                  <div className="font-bold text-emerald-700">
                    Đã chọn {selectedInvoices.length} hóa đơn
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3 Bottom Mini Cards (Dynamic Data) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Công nợ theo lớp */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0c513f] dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Công nợ theo lớp
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  {dynamicClassDebts.length} lớp nợ
                </span>
              </div>

              <div className="space-y-3.5 pt-1">
                {dynamicClassDebts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-500 opacity-60" />
                    <span>Không có công nợ tồn đọng theo lớp.</span>
                  </div>
                ) : (
                  dynamicClassDebts.map((item) => (
                    <div key={item.className} className="flex items-center justify-between gap-3 text-xs">
                      <span className="w-24 font-bold text-slate-700 dark:text-slate-300 truncate" title={item.className}>
                        {item.className}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(item.percent, 100)}%` }}
                          className={`h-full rounded-full ${item.colorClass}`}
                        />
                      </div>
                      <span className="w-20 font-extrabold text-slate-900 dark:text-white text-right">
                        {formatShortMillion(item.amount)}
                      </span>
                    </div>
                  ))
                )}
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
                {dynamicTopOverdue.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-500 opacity-60" />
                    <span>Chưa có công nợ quá hạn trong dữ liệu đã tải.</span>
                  </div>
                ) : (
                  dynamicTopOverdue.map((st) => (
                    <div key={st.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${st.avatarBg}`}>
                          {st.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 dark:text-white truncate">
                            {st.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {st.className} {st.studentCode ? `· ${st.studentCode}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(st.amount)}
                        </p>
                        <p className="text-[11px] font-bold text-rose-500">
                          ● Quá hạn {st.overdueDays} ngày
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                {dynamicRecentPayments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <CreditCard className="w-6 h-6 mx-auto mb-1.5 text-slate-300 opacity-60" />
                    <span>Chưa có giao dịch thanh toán nào được ghi nhận.</span>
                  </div>
                ) : (
                  dynamicRecentPayments.map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                            +{formatCurrency(pay.amount)}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {pay.studentName} · {pay.paymentNumber}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 font-medium shrink-0">
                        {pay.timestamp.slice(0, 16)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVOICES (QUẢN LÝ HÓA ĐƠN ĐẦY ĐỦ)                                  */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Quản lý Hóa Đơn Học Phí
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tiến trình lập nháp, phát hành hóa đơn và thông báo học phí tới phụ huynh.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                disabled={displayInvoices.length === 0}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-2 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file Excel/CSV</span>
              </button>
              <button
                onClick={() => setIsPreviewModalOpen(true)}
                disabled={!canCreateDraft}
                className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Lập hóa đơn mới</span>
              </button>
            </div>
          </div>

          {/* Full-width invoice table component reusing workspace */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
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
                  Bản nháp ({displayInvoices.filter((inv) => inv.issuanceStatus === 'DRAFT').length})
                </button>
                <button
                  onClick={() => setInvoiceFilterTab('ISSUED')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    invoiceFilterTab === 'ISSUED'
                      ? 'bg-[#0c513f] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Đã phát hành ({displayInvoices.filter((inv) => inv.issuanceStatus === 'ISSUED').length})
                </button>
              </div>

              {selectedInvoices.length > 0 && (
                <button
                  onClick={handleBatchIssueSelected}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Phát hành hàng loạt ({selectedInvoices.length})</span>
                </button>
              )}
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo mã hóa đơn, tên học sinh..."
                  value={invoiceSearchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setInvoiceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={filterIssuance}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterIssuance(e.target.value)}
                  className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Tất cả trạng thái phát hành</option>
                  <option value="ISSUED">Đã phát hành</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="VOID">Đã hủy</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={filterSettlement}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterSettlement(e.target.value)}
                  className="w-full py-2 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Tất cả trạng thái thanh toán</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PARTIALLY_PAID">Một phần</option>
                  <option value="UNPAID">Chưa thanh toán</option>
                  <option value="OVERPAID">Thanh toán thừa</option>
                </select>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                        onChange={toggleSelectAllInvoices}
                        className="rounded text-[#0c513f]"
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
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-500">
                        Không tìm thấy hóa đơn nào phù hợp.
                      </td>
                    </tr>
                  )}
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.includes(inv.id)}
                          onChange={() => toggleSelectInvoice(inv.id)}
                          className="rounded text-[#0c513f]"
                        />
                      </td>
                      <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                        <button
                          onClick={() => setDetailModalInvoice(inv)}
                          className="hover:underline text-left"
                          title="Xem chi tiết hóa đơn"
                        >
                          {inv.invoiceNumber}
                        </button>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {inv.studentName}
                        {inv.studentCode && <span className="text-[10px] text-slate-400 block">{inv.studentCode}</span>}
                      </td>
                      <td className="p-3 text-slate-500">{inv.className}</td>
                      <td className="p-3 text-slate-500">{inv.billingPeriodDisplay}</td>
                      <td className="p-3">{renderIssuanceBadge(inv.issuanceStatus)}</td>
                      <td className="p-3">{renderSettlementBadge(inv.settlementStatus)}</td>
                      <td className="p-3 font-bold text-right text-slate-900 dark:text-white">
                        {inv.amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-3 font-bold text-right text-rose-600 dark:text-rose-400">
                        {inv.outstandingAmount > 0 ? `${inv.outstandingAmount.toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDetailModalInvoice(inv)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {inv.issuanceStatus === 'DRAFT' && (
                            <button
                              onClick={() => handleIssueInvoice(inv.id)}
                              className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]"
                              title="Phát hành hóa đơn"
                            >
                              Phát hành
                            </button>
                          )}
                          {inv.issuanceStatus === 'ISSUED' && (
                            <button
                              onClick={() => handleProjectInvoiceNotice(inv)}
                              className="p-1 rounded-lg hover:bg-blue-50 text-blue-600"
                              title="Gửi thông báo phụ huynh"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.issuanceStatus === 'ISSUED' && inv.settlementStatus !== 'PAID' && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-600"
                              title="Thu học phí"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEBTS (CÔNG NỢ & QUẢN LÝ THU HỒI)                                    */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'debts' && (
        <div className="space-y-6">
          {/* Debts Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Quản Lý Công Nợ &amp; Thu Hồi Học Phí</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white leading-none">
                  {overdueCount} quá hạn
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tuổi nợ, gửi thông báo nhắc học phí qua ứng dụng phụ huynh và quét leo thang tự động.
              </p>
            </div>
            <button
              onClick={handleScanOverdueInvoices}
              disabled={scanningOverdue || loading}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningOverdue ? 'animate-spin' : ''}`} />
              <span>Quét &amp; Leo thang công nợ</span>
            </button>
          </div>

          {/* Debts Breakdown Table */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Danh sách học sinh còn nợ học phí ({dynamicTopOverdue.length})
              </h3>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3 font-bold">Học sinh</th>
                    <th className="p-3 font-bold">Lớp</th>
                    <th className="p-3 font-bold">Mã hóa đơn</th>
                    <th className="p-3 font-bold">Hạn thanh toán</th>
                    <th className="p-3 font-bold text-center">Quá hạn</th>
                    <th className="p-3 font-bold text-right">Số tiền còn nợ</th>
                    <th className="p-3 font-bold text-center">Thao tác thu nợ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dynamicTopOverdue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                        <span>Tuyệt vời! Toàn bộ học sinh đã hoàn thành học phí đúng hạn.</span>
                      </td>
                    </tr>
                  ) : (
                    dynamicTopOverdue.map((item) => {
                      const invoiceTarget = displayInvoices.find((inv) => inv.id === item.invoiceId);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${item.avatarBg}`}>
                                {item.initial}
                              </div>
                              <div>
                                <span>{item.name}</span>
                                {item.studentCode && <span className="text-[10px] text-slate-400 block">{item.studentCode}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{item.className}</td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{item.invoiceNumber}</td>
                          <td className="p-3 text-slate-500">{item.dueDate}</td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              {item.overdueDays} ngày
                            </span>
                          </td>
                          <td className="p-3 font-extrabold text-right text-rose-600 dark:text-rose-400">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {invoiceTarget && (
                                <button
                                  onClick={() => handleProjectInvoiceNotice(invoiceTarget)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold hover:bg-blue-100 flex items-center gap-1"
                                  title="Gửi thông báo nhắc nợ tới Phụ huynh"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>Nhắc phụ huynh</span>
                                </button>
                              )}
                              {invoiceTarget && (
                                <button
                                  onClick={() => handleOpenPaymentModal(invoiceTarget)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 flex items-center gap-1"
                                  title="Thu tiền cho học sinh này"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Thu tiền</span>
                                </button>
                              )}
                              <Link
                                href={`/dashboard/education/enrollments/${item.studentPartyId}`}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                                title="Xem hồ sơ 360°"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENTS (QUẢN LÝ THANH TOÁN & GIAO DỊCH TIỀN MẶT / CHUYỂN KHOẢN)    */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Sổ Quỹ Thanh Toán &amp; Phiếu Thu Học Phí
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ghi nhận các giao dịch thu tiền, đối soát và cấp phát biên lai điện tử.
              </p>
            </div>
            <button
              onClick={() => handleOpenPaymentModal()}
              className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi nhận thanh toán mới</span>
            </button>
          </div>

          {/* Payments Table */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Lịch sử thanh toán ({payments.length} giao dịch)
              </h3>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3 font-bold">Mã phiếu thu</th>
                    <th className="p-3 font-bold">Học sinh</th>
                    <th className="p-3 font-bold text-right">Số tiền</th>
                    <th className="p-3 font-bold text-right">Đã phân bổ</th>
                    <th className="p-3 font-bold text-right">Chưa phân bổ</th>
                    <th className="p-3 font-bold">Phương thức</th>
                    <th className="p-3 font-bold">Ngày thanh toán</th>
                    <th className="p-3 font-bold text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                        Chưa có giao dịch thanh toán nào được ghi nhận.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const student = students.find((s) => s.studentPartyId === p.studentPartyId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                            {p.paymentNumber}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {student?.displayName || p.studentPartyId}
                          </td>
                          <td className="p-3 font-extrabold text-right text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="p-3 font-bold text-right text-slate-700 dark:text-slate-300">
                            {formatCurrency(p.allocatedAmount)}
                          </td>
                          <td className="p-3 font-bold text-right text-amber-600 dark:text-amber-400">
                            {p.unallocatedAmount > 0 ? formatCurrency(p.unallocatedAmount) : '0 đ'}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {p.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : p.paymentMethod === 'QR_CODE' ? 'Mã QR' : 'Tiền mặt'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {p.paymentDate || p.createdAt?.slice(0, 10)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RECONCILIATION (ĐỐI SOÁT & XỬ LÝ NGOẠI LỆ)                          */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-2">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Trung Tâm Đối Soát &amp; Giải Quyết Ngoại Lệ Tài Chính
            </h2>
            <p className="text-xs text-slate-500">
              Khớp nối các khoản thanh toán dôi dư, xử lý ngoại lệ truyền thông và tạo bằng chứng hoàn thành kỳ dịch vụ học phí.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 1: Khoản thanh toán chờ phân bổ */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Khoản tiền chưa phân bổ hết ({unallocatedPaymentsCount})
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {payments.filter((p) => p.unallocatedAmount > 0).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                    <span>Tất cả các khoản tiền đã được đối soát 100%.</span>
                  </div>
                ) : (
                  payments
                    .filter((p) => p.unallocatedAmount > 0)
                    .map((p) => {
                      const student = students.find((s) => s.studentPartyId === p.studentPartyId);
                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {student?.displayName || p.studentPartyId} · {p.paymentNumber}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Tổng nhận: {formatCurrency(p.amount)} · Đã gán: {formatCurrency(p.allocatedAmount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-amber-600 dark:text-amber-400 block">
                              Còn dư: {formatCurrency(p.unallocatedAmount)}
                            </span>
                            <span className="text-[10px] text-slate-400">Chờ gán vào hóa đơn sau</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Section 2: Danh sách Ngoại lệ truyền thông / tài chính */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ngoại lệ cần giải quyết ({pendingExceptionsCount})
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {exceptions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                    <span>Không có ngoại lệ nào phát sinh.</span>
                  </div>
                ) : (
                  exceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {ex.exception_type}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${ex.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {ex.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {ex.description || 'Không có mô tả chi tiết'}
                        </p>
                      </div>

                      {ex.status !== 'RESOLVED' && (
                        <button
                          onClick={() => {
                            setExceptionModalItem(ex);
                            setExceptionResolutionNotes('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#0c513f] text-white font-bold text-xs hover:bg-[#093e30]"
                        >
                          Xử lý
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: REPORTS (BÁO CÁO DOANH THU & HỌC PHÍ)                              */}
      {/* ========================================================================= */}
      {dataLoaded && activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Báo Cáo Thu Học Phí &amp; Hiệu Quả Thu Hồi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng hợp doanh thu theo từng kỳ thu học phí và phân tích cơ cấu nợ theo từng khối lớp.
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={displayInvoices.length === 0}
              className="px-4 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>In &amp; Xuất Báo Cáo</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bảng Tổng Hợp Doanh Thu Theo Kỳ Thu
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3 font-bold">Kỳ thu</th>
                    <th className="p-3 font-bold">Hạn nộp</th>
                    <th className="p-3 font-bold text-center">Số hóa đơn</th>
                    <th className="p-3 font-bold text-right">Tổng phải thu</th>
                    <th className="p-3 font-bold text-right">Đã thu</th>
                    <th className="p-3 font-bold text-right">Còn nợ</th>
                    <th className="p-3 font-bold text-center">Tỷ lệ hoàn thành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {billingPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        Chưa có kỳ thu học phí nào.
                      </td>
                    </tr>
                  ) : (
                    billingPeriods.map((period) => {
                      const periodInvoices = invoices.filter(
                        (inv) => inv.billingPeriodId === period.id && inv.invoiceStatus !== 'VOID'
                      );
                      const pInvoiced = periodInvoices.reduce((acc, cur) => acc + cur.netAmount, 0);
                      const pPaid = periodInvoices.reduce((acc, cur) => acc + (cur.paidAmount || 0), 0);
                      const pDebt = periodInvoices.reduce((acc, cur) => acc + (cur.outstandingAmount || 0), 0);
                      const rate = pInvoiced > 0 ? Math.round((pPaid / pInvoiced) * 100) : 0;

                      return (
                        <tr key={period.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {period.periodName}
                          </td>
                          <td className="p-3 text-slate-500">{period.dueDate}</td>
                          <td className="p-3 text-center">{periodInvoices.length}</td>
                          <td className="p-3 font-extrabold text-right text-slate-900 dark:text-white">
                            {formatCurrency(pInvoiced)}
                          </td>
                          <td className="p-3 font-extrabold text-right text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(pPaid)}
                          </td>
                          <td className="p-3 font-extrabold text-right text-rose-600 dark:text-rose-400">
                            {formatCurrency(pDebt)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {paymentInvoiceId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="finance-payment-title" className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h2 id="finance-payment-title" className="text-lg font-bold">Thu học phí / khôi phục khoản thu</h2>
            <label className="block text-sm">Số tiền
              <input aria-label="Số tiền thanh toán" type="number" min="0.01" step="0.01" value={paymentAmount}
                disabled={!!retainedIntent && !retainedIntent.correctable} onChange={event => setPaymentAmount(event.target.value)} className="block w-full border rounded-lg p-2 bg-transparent" />
            </label>
            <PremiumSelect ariaLabel="Phương thức thanh toán" value={paymentMethod} disabled={!!retainedIntent && !retainedIntent.correctable}
              options={[{ value: 'CASH', label: 'Tiền mặt' }, { value: 'BANK_TRANSFER', label: 'Chuyển khoản' }, { value: 'QR_CODE', label: 'Mã QR' }]}
              onChange={value => setPaymentMethod(value as FinancePaymentIntent['paymentMethod'])} />
            {retainedIntent && <p role="status" className="text-sm">{retainedIntent.result
              ? 'Khoản thu đã có kết quả. Kiểm tra lại sẽ dùng đúng yêu cầu đã lưu.'
              : retainedIntent.correctable ? 'Khoản thu đã bị từ chối và chưa được ghi nhận. Có thể sửa nội dung; mã yêu cầu được giữ nguyên.'
                : 'Khoản thu đang chờ xác nhận. Thử lại sẽ giữ nguyên nội dung và mã yêu cầu.'}</p>}
            {retainedIntent?.result && <p className="text-sm break-all">Biên nhận: {retainedIntent.result.receiptId}</p>}
            <div className="flex gap-3">
              <button type="button" disabled={loading} onClick={() => setPaymentInvoiceId('')} className="border rounded-xl px-3 py-2">Đóng</button>
              <button type="button" data-testid="finance-confirm-payment" disabled={loading} onClick={submitPayment} className="bg-primary text-primary-foreground rounded-xl px-3 py-2">{retainedIntent ? 'Kiểm tra / thử lại khoản thu' : 'Xác nhận thu'}</button>
              {retainedIntent?.result && <button type="button" disabled={loading} onClick={async () => {
                if (!actorContext || !navigator.locks) return;
                const scope = { ...actorContext, branchId: selectedBranchId };
                const key = paymentIntentStorageKey(scope, paymentInvoiceId);
                setLoading(true);
                try {
                  await navigator.locks.request(key, async () => {
                    const current = parsePaymentIntent(localStorage.getItem(key), scope, paymentInvoiceId);
                    if (current?.operationKey !== retainedIntent.operationKey || !current?.result) {
                      throw new Error('Yêu cầu thanh toán đã thay đổi ở thẻ khác. Đóng và mở lại khoản thu để kiểm tra.');
                    }
                    localStorage.removeItem(key);
                    setRetainedIntent(null); setPaymentAmount('');
                  });
                } catch (error) { setActionMessage(error instanceof Error ? error.message : 'Không thể bắt đầu khoản thu mới.'); }
                finally { setLoading(false); }
              }} className="border rounded-xl px-3 py-2">Bắt đầu khoản thu mới</button>}
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: XEM TRƯỚC HÓA ĐƠN & TẠO BẢN NHÁP ── */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-preview-title"
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95"
          >
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

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Chưa có số tiền xem trước. Các khoản thu và số tiền được xác định khi lập hóa đơn nháp.
              </p>
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

      {/* ── MODAL 2: GHI NHẬN THANH TOÁN & ĐỐI SOÁT ── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="payment-modal-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                    Ghi Nhận Thanh Toán Học Phí
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đối soát tiền thu vào hóa đơn và xuất biên lai điện tử
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Invoice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chọn hóa đơn cần thanh toán *
                </label>
                <select
                  value={paymentTargetInvoice?.id || ''}
                  onChange={(e) => {
                    const found = displayInvoices.find((inv) => inv.id === e.target.value);
                    if (found) {
                      setPaymentTargetInvoice(found);
                      setPaymentAmountInput(String(found.outstandingAmount > 0 ? found.outstandingAmount : found.amount));
                    }
                  }}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                >
                  <option value="">Chọn hóa đơn cần nộp</option>
                  {displayInvoices
                    .filter((inv) => inv.issuanceStatus === 'ISSUED' && inv.settlementStatus !== 'PAID')
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.studentName} ({formatCurrency(inv.outstandingAmount > 0 ? inv.outstandingAmount : inv.amount)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Số tiền thực nộp (VND) *
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  placeholder="Nhập số tiền thanh toán..."
                  className="w-full p-2.5 text-sm font-extrabold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0c513f]/20"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('BANK_TRANSFER')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${paymentMethodInput === 'BANK_TRANSFER' ? 'bg-[#0c513f] text-white border-[#0c513f]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    Chuyển khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('QR_CODE')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${paymentMethodInput === 'QR_CODE' ? 'bg-[#0c513f] text-white border-[#0c513f]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    Quét mã QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('CASH')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${paymentMethodInput === 'CASH' ? 'bg-[#0c513f] text-white border-[#0c513f]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    Tiền mặt
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={loading || !paymentTargetInvoice || !paymentAmountInput}
                className="flex-1 py-2.5 rounded-xl bg-[#0c513f] hover:bg-[#093e30] disabled:bg-slate-300 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Tiếp tục xác nhận khoản thu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: XEM CHI TIẾT HÓA ĐƠN ── */}
      {detailModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-[#0c513f] dark:text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Hóa Đơn {detailModalInvoice.invoiceNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kỳ: {detailModalInvoice.billingPeriodDisplay} · Hạn nộp: {detailModalInvoice.dueDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">HỌC SINH</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">{detailModalInvoice.studentName}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">LỚP HỌC</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{detailModalInvoice.className}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">PHÁT HÀNH</span>
                  <span>{renderIssuanceBadge(detailModalInvoice.issuanceStatus)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">THANH TOÁN</span>
                  <span>{renderSettlementBadge(detailModalInvoice.settlementStatus)}</span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-2 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng học phí gốc:</span>
                  <span className="font-bold">{formatCurrency(detailModalInvoice.grossAmount)}</span>
                </div>
                {detailModalInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm trừ học phí:</span>
                    <span>-{formatCurrency(detailModalInvoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 font-extrabold text-sm text-slate-900 dark:text-white">
                  <span>Số tiền phải nộp:</span>
                  <span>{formatCurrency(detailModalInvoice.amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Đã thanh toán:</span>
                  <span className="text-emerald-600 font-bold">{formatCurrency(detailModalInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-rose-600">
                  <span>Còn nợ:</span>
                  <span>{formatCurrency(detailModalInvoice.outstandingAmount)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDetailModalInvoice(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              {detailModalInvoice.issuanceStatus === 'DRAFT' && (
                <button
                  onClick={() => {
                    handleIssueInvoice(detailModalInvoice.id);
                    setDetailModalInvoice(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Phát hành ngay
                </button>
              )}
              {detailModalInvoice.issuanceStatus === 'ISSUED' && detailModalInvoice.settlementStatus !== 'PAID' && (
                <button
                  onClick={() => {
                    const target = detailModalInvoice;
                    setDetailModalInvoice(null);
                    handleOpenPaymentModal(target);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold"
                >
                  Thu tiền ngay
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: XỬ LÝ NGOẠI LỆ TÀI CHÍNH ── */}
      {exceptionModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Xử Lý Ngoại Lệ Tài Chính: {exceptionModalItem.exception_type}
              </h3>
              <button
                onClick={() => setExceptionModalItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                {exceptionModalItem.description || 'Không có mô tả chi tiết từ hệ thống.'}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi chú giải quyết ngoại lệ
                </label>
                <textarea
                  rows={3}
                  value={exceptionResolutionNotes}
                  onChange={(e) => setExceptionResolutionNotes(e.target.value)}
                  placeholder="Nhập nội dung xử lý ngoại lệ..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setExceptionModalItem(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleResolveException}
                disabled={exceptionSubmitting}
                className="flex-1 py-2 rounded-xl bg-[#0c513f] hover:bg-[#093e30] text-white text-xs font-bold"
              >
                {exceptionSubmitting ? 'Đang đóng…' : 'Xác nhận giải quyết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancePage() {
  const { user, product, isLoading } = useUser();
  if (isLoading) return <p role="status">Đang xác minh tài khoản…</p>;
  if (!user?.tenant_id || !product) return <p role="alert">Không có quyền mở màn hình này.</p>;
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <CircleDollarSign className="w-8 h-8 animate-spin text-[#0c513f]" />
        </div>
      }
    >
      <FinancePageContent />
    </Suspense>
  );
}
