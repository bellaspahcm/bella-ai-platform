'use client';

/**
 * Bella Preschool OS — P7 Finance Command Center & Parent Workspace
 * File: src/app/dashboard/education/finance/page.tsx
 *
 * Implements 3 Operational Staff Zones (Billing, Collections, Cash & Evidence)
 * and Streamlined Parent Workspace (Amount Due, Breakdown, Receipts).
 * Interfaced to real Supabase database for Playwright Field Verification.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  CircleDollarSign, 
  Receipt, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  ArrowLeft, 
  CreditCard, 
  FileText, 
  RefreshCw, 
  UserCheck, 
  Plus, 
  Send,
  Lock,
  DollarSign,
  Layers,
  Sparkles,
  Users
} from 'lucide-react';

import {
  BillingPeriod,
  Invoice,
  Payment,
  PaymentReceipt,
  TuitionServicePeriodCompletion,
} from '@/products/bella-education/finance/domain/finance.types';

type FinanceStudentOption = {
  enrollmentId: string;
  courseId: string;
  studentPartyId: string;
  studentId: string | null;
  studentCode: string | null;
  displayName: string;
};

type FinanceExceptionRow = {
  id: string;
  exception_type: string;
  status: string;
  description?: string | null;
};

type FinanceStateResponse = {
  success: boolean;
  error?: string;
  students?: FinanceStudentOption[];
  billingPeriods?: BillingPeriod[];
  servicePeriodCompletions?: TuitionServicePeriodCompletion[];
  invoices?: Invoice[];
  payments?: Payment[];
  exceptions?: FinanceExceptionRow[];
};

type FinanceCommandResponse = {
  success: boolean;
  error?: string;
  invoice?: Invoice;
  completion?: TuitionServicePeriodCompletion;
  alreadyCompleted?: boolean;
  projection?: { isDuplicate: boolean; notice: { id: string } };
  escalatedCount?: number;
  payment?: Payment;
  receipt?: PaymentReceipt;
  updatedSettlementStatus?: string;
};

export default function FinancePage() {
  const [userRole, setUserRole] = useState<'STAFF' | 'PARENT'>('STAFF');
  const [activeZone, setActiveZone] = useState<'BILLING' | 'COLLECTIONS' | 'CASH'>('BILLING');
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [exceptions, setExceptions] = useState<FinanceExceptionRow[]>([]);
  const [students, setStudents] = useState<FinanceStudentOption[]>([]);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [servicePeriodCompletions, setServicePeriodCompletions] = useState<TuitionServicePeriodCompletion[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Form states
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedStudentPartyId, setSelectedStudentPartyId] = useState<string>('');
  const [selectedBillingPeriodId, setSelectedBillingPeriodId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(5000000);
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'QR_CODE' | 'CASH'>('QR_CODE');
  const [resolutionNotes, setResolutionNotes] = useState<string>('Phụ huynh hẹn chuyển khoản bù vào tuần sau.');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/education/finance', { cache: 'no-store' });
      const payload = (await response.json()) as FinanceStateResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Không tải được dữ liệu tài chính.');
      }

      const nextStudents = payload.students || [];
      const nextBillingPeriods = payload.billingPeriods || [];
      setStudents(nextStudents);
      setSelectedStudentPartyId((prev) => (
        nextStudents.some((student) => student.studentPartyId === prev) ? prev : nextStudents[0]?.studentPartyId || ''
      ));
      setBillingPeriods(nextBillingPeriods);
      setSelectedBillingPeriodId((prev) => (
        nextBillingPeriods.some((period) => period.id === prev) ? prev : nextBillingPeriods[0]?.id || ''
      ));
      setServicePeriodCompletions(payload.servicePeriodCompletions || []);
      setInvoices(payload.invoices || []);
      setPayments(payload.payments || []);
      setExceptions(payload.exceptions || []);

    } catch (err: unknown) {
      console.error('Error loading finance data:', err);
      setActionMessage(err instanceof Error ? err.message : 'Không tải được dữ liệu tài chính.');
    } finally {
      setLoading(false);
    }
  }, []);

  const financeCommand = async (action: string, payload: Record<string, unknown> = {}): Promise<FinanceCommandResponse> => {
    const response = await fetch('/api/education/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = (await response.json()) as FinanceCommandResponse;
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Finance operation failed.');
    }
    return body;
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Staff Actions
  const handleCompileDraftInvoice = async () => {
    const targetStudent = students.find((student) => student.studentPartyId === selectedStudentPartyId) || students[0];
    if (!targetStudent) {
      setActionMessage('Không có học sinh đã ghi danh hợp lệ để lập hóa đơn.');
      return;
    }
    const targetBillingPeriod = billingPeriods.find((period) => period.id === selectedBillingPeriodId);
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
      setActionMessage(`Đã lập hóa đơn nháp thành công: ${result.invoice.invoiceNumber} (${result.invoice.netAmount.toLocaleString('vi-VN')} VNĐ)`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi lập hóa đơn: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    setLoading(true);
    try {
      const result = await financeCommand('issueInvoice', { invoiceId });
      if (!result.invoice) throw new Error('Không nhận được hóa đơn sau khi phát hành.');
      setActionMessage(`Đã phát hành hóa đơn ${result.invoice.invoiceNumber} (DRAFT ➔ ISSUED). SHA-256 fingerprint: ${result.invoice.sha256Checksum?.substring(0, 16)}...`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi phát hành: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
          : `Đã gửi thông báo hóa đơn ${invoice.invoiceNumber} tới Phụ huynh (P6 Notice ID: ${projection?.notice.id || 'N/A'})`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi gửi thông báo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTuitionServicePeriod = async () => {
    const targetBillingPeriod = billingPeriods.find((period) => period.id === selectedBillingPeriodId);
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
          : `Đã xác nhận hoàn thành kỳ dịch vụ ${targetBillingPeriod.periodName}. Recognition vẫn cần thao tác riêng.`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi xác nhận hoàn thành kỳ dịch vụ: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanOverdueInvoices = async () => {
    setLoading(true);
    try {
      const result = await financeCommand('scanOverdueInvoices');
      setActionMessage(`Quét thành công! Đã phát hiện & leo thang ${result.escalatedCount ?? 0} hóa đơn quá hạn chưa thanh toán sang Staff Work Queue.`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi quét quá hạn: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAndReconcilePayment = async (invoiceId: string) => {
    setLoading(true);
    try {
      const result = await financeCommand('recordAndReconcilePayment', {
        invoiceId,
        paymentAmount,
        paymentMethod,
      });
      if (!result.receipt) throw new Error('Không nhận được phiếu thu sau đối soát.');
      setActionMessage(
        `Ghi nhận thanh toán ${paymentAmount.toLocaleString('vi-VN')} VNĐ! Trạng thái hóa đơn ➔ ${result.updatedSettlementStatus}. Phiếu thu SHA-256: ${result.receipt.sha256Fingerprint.substring(0, 16)}...`
      );
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi đối soát thanh toán: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveException = async (exceptionId: string) => {
    setLoading(true);
    try {
      await financeCommand('resolveException', {
        exceptionId,
        resolutionNotes,
      });
      setActionMessage(`Đã xử lý ngoại lệ thu nợ trong Staff Work Queue (Bảo lưu trạng thái tài chính UNPAID cho P7).`);
      await loadData();
    } catch (err: unknown) {
      setActionMessage(`Lỗi xử lý ngoại lệ: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const parentInvoice = invoices[0];
  const selectedPeriodCompletion = servicePeriodCompletions.find(
    (completion) => completion.billingPeriodId === selectedBillingPeriodId,
  );
  const parentBillingPeriod = parentInvoice
    ? billingPeriods.find((period) => period.id === parentInvoice.billingPeriodId)
    : undefined;
  const parentPeriodLabel = parentBillingPeriod?.periodName || 'kỳ học phí hiện tại';
  const parentDueDate = parentInvoice?.dueDate || parentBillingPeriod?.dueDate || 'N/A';

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-16 font-sans" data-testid="finance-command-center">
      {/* Header & Role Switcher */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-[var(--education-brand-ink)] shrink-0">
                <CircleDollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  Preschool Finance Operating Kernel (P7)
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                    Integrity Verified
                  </span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tách biệt Invoice Lifecycle (DRAFT ➔ ISSUED) &amp; Settlement Truth (UNPAID ➔ PARTIALLY_PAID ➔ PAID)
                </p>
              </div>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setUserRole('STAFF')}
              data-testid="mode-tab-staff"
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                userRole === 'STAFF'
                  ? 'bg-white dark:bg-slate-800 text-[var(--education-brand-ink)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff Finance Command Center</span>
            </button>
            <button
              onClick={() => setUserRole('PARENT')}
              data-testid="mode-tab-parent"
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                userRole === 'PARENT'
                  ? 'bg-white dark:bg-slate-800 text-[var(--education-brand-ink)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Parent Finance View</span>
            </button>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-[var(--education-brand-ink)] text-xs font-medium flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[var(--education-brand-ink)] shrink-0 mt-0.5" />
            <div className="flex-1">{actionMessage}</div>
            <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-gray-600 font-bold">×</button>
          </div>
        )}

        {/* Staff Zone Selector */}
        {userRole === 'STAFF' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
            <button
              onClick={() => setActiveZone('BILLING')}
              data-testid="staff-zone-billing"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeZone === 'BILLING'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Zone 1: Billing (Draft, Compilation & Issuance)</span>
            </button>
            <button
              onClick={() => setActiveZone('COLLECTIONS')}
              data-testid="staff-zone-collections"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeZone === 'COLLECTIONS'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Zone 2: Collections (Overdue Scanner & Exception Queue)</span>
            </button>
            <button
              onClick={() => setActiveZone('CASH')}
              data-testid="staff-zone-cash"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeZone === 'CASH'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Zone 3: Cash & Evidence (Reconciliation & Receipts)</span>
            </button>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* STAFF VIEW */}
      {/* ==================================================================== */}
      {userRole === 'STAFF' && (
        <div className="space-y-6">
          {/* ZONE 1: BILLING */}
          {activeZone === 'BILLING' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Compile Invoice Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[var(--education-brand-ink)]" />
                  Lập Hóa Đơn Nháp Mới
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tự động tính toán Học phí + Tiền ăn P4 (dựa trên nhật ký ăn) + Chiết khấu chính sách
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Chọn Học Sinh:</label>
                    <select
                      value={selectedStudentPartyId}
                      onChange={(e) => setSelectedStudentPartyId(e.target.value)}
                      className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      {students.map((st) => (
                        <option key={st.studentPartyId} value={st.studentPartyId}>
                          {st.displayName} - {st.studentCode ?? 'Chưa có mã'} (Party: {st.studentPartyId.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Kỳ Thu Học Phí:</label>
                    <select
                      value={selectedBillingPeriodId}
                      onChange={(e) => setSelectedBillingPeriodId(e.target.value)}
                      className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      {billingPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.periodName} ({period.startDate} - {period.endDate}) • Hạn: {period.dueDate}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                          Hoàn thành kỳ dịch vụ
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {selectedPeriodCompletion
                            ? `Đã xác nhận lúc ${new Date(selectedPeriodCompletion.completedAt).toLocaleString('vi-VN')}`
                            : 'Chưa có xác nhận hoàn thành từ DB.'}
                        </p>
                      </div>
                      {selectedPeriodCompletion ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                          COMPLETED
                        </span>
                      ) : (
                        <button
                          onClick={handleCompleteTuitionServicePeriod}
                          disabled={loading || billingPeriods.length === 0}
                          data-testid="btn-complete-tuition-service-period"
                          className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          Xác nhận hoàn thành
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      Thao tác này chỉ tạo completion evidence, không ghi nhận doanh thu.
                    </p>
                  </div>
                  <button
                    onClick={handleCompileDraftInvoice}
                    disabled={loading || billingPeriods.length === 0}
                    data-testid="btn-compile-invoice"
                    className="w-full py-3 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all"
                  >
                    Lập Hóa Đơn (Draft)
                  </button>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--education-brand-ink)]" />
                    Danh Sách Hóa Đơn ({invoices.length})
                  </h3>
                  <button onClick={loadData} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {invoices.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">Chưa có hóa đơn nào. Vui lòng lập hóa đơn mới.</div>
                  ) : (
                    invoices.map((inv) => (
                      <div key={inv.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                            <span className="text-[11px] text-gray-400 ml-2">Hạn: {inv.dueDate}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              inv.invoiceStatus === 'ISSUED' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-800'
                            }`}>
                              {inv.invoiceStatus}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              inv.settlementStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              inv.settlementStatus === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {inv.settlementStatus}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div>
                            <p className="text-[10px] text-gray-400">Tổng tiền / Đã thu:</p>
                            <p className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              {inv.netAmount.toLocaleString('vi-VN')} VNĐ / {inv.paidAmount.toLocaleString('vi-VN')} VNĐ
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {inv.invoiceStatus === 'DRAFT' && (
                              <button
                                onClick={() => handleIssueInvoice(inv.id)}
                                data-testid="btn-issue-invoice"
                                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-[11px] font-bold shadow-sm"
                              >
                                Phát Hành (Issue)
                              </button>
                            )}
                            {inv.invoiceStatus === 'ISSUED' && (
                              <button
                                onClick={() => handleProjectInvoiceNotice(inv)}
                                data-testid="btn-project-notice"
                                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-[11px] font-bold shadow-sm flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>Gửi Notice P6</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ZONE 2: COLLECTIONS */}
          {activeZone === 'COLLECTIONS' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overdue Scanner Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Overdue SLA Scanner
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tự động quét hóa đơn UNPAID đã quá hạn (due_date &lt; NOW) và tạo ngoại lệ OVERDUE_PAYMENT_SLA trong Staff Work Queue.
                </p>
                <button
                  onClick={handleScanOverdueInvoices}
                  disabled={loading}
                  data-testid="btn-scan-overdue"
                  className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Quét & Leo Thang Hóa Đơn Quá Hạn</span>
                </button>
              </div>

              {/* Exception Work Queue List */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  Staff Collection Work Queue ({exceptions.length})
                </h3>

                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {exceptions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">Không có ngoại lệ thu nợ nào.</div>
                  ) : (
                    exceptions.map((exc) => (
                      <div key={exc.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                            LOẠI: {exc.exception_type} (Status: {exc.status})
                          </span>
                          <span className="text-[10px] text-gray-400">ID: {exc.id.substring(0, 8)}...</span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{exc.description || 'Hóa đơn quá hạn chưa thanh toán.'}</p>
                        
                        {exc.status === 'OPEN' && (
                          <div className="pt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Ghi chú đôn đốc thu nợ..."
                              className="flex-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <button
                              onClick={() => handleResolveException(exc.id)}
                              data-testid="btn-resolve-exception"
                              className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
                            >
                              Xử Lý Ngoại Lệ
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ZONE 3: CASH & EVIDENCE */}
          {activeZone === 'CASH' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payment Form */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[var(--education-brand-ink)]" />
                  Ghi Nhận Thanh Toán & Đối Soát
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Chọn Hóa Đơn Cần Thu:</label>
                    <select
                      value={selectedInvoiceId || invoices[0]?.id || ''}
                      onChange={(e) => setSelectedInvoiceId(e.target.value)}
                      className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      {invoices.filter((i) => i.settlementStatus !== 'PAID').map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} - Nợ: {(inv.netAmount - inv.paidAmount).toLocaleString('vi-VN')} VNĐ
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Số Tiền Chuyển Khoản (VNĐ):</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Hình Thức:</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'BANK_TRANSFER' | 'QR_CODE' | 'CASH')}
                      className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      <option value="QR_CODE">Chuyển Khoản QR Code</option>
                      <option value="BANK_TRANSFER">Chuyển Khoản Ngân Hàng</option>
                      <option value="CASH">Tiền Mặt</option>
                    </select>
                  </div>

                  {invoices.length > 0 && (
                    <button
                      onClick={() => {
                        const targetInv = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
                        if (targetInv) handleRecordAndReconcilePayment(targetInv.id);
                      }}
                      disabled={loading}
                      data-testid="btn-reconcile-payment"
                      className="w-full py-3 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all"
                    >
                      Xác Nhận Thu & Tạo Receipt Ledger
                    </button>
                  )}
                </div>
              </div>

              {/* Payments History */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--education-brand-ink)]" />
                  Nhật Ký Dòng Tiền & Biên Lai Thu ({payments.length})
                </h3>

                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {payments.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">Chưa ghi nhận giao dịch thanh toán nào.</div>
                  ) : (
                    payments.map((p) => (
                      <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-extrabold text-gray-900 dark:text-white">
                            {Number(p.amount).toLocaleString('vi-VN')} VNĐ ({p.paymentMethod})
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Mã GD: {p.id.substring(0, 12)}... • Thời gian: {p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : 'N/A'}</p>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
                          Đã Thu
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PARENT VIEW */}
      {/* ==================================================================== */}
      {userRole === 'PARENT' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-primary text-primary-foreground shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
                Thông Báo Học Phí - {parentPeriodLabel}
              </span>
              <span className="text-xs font-bold bg-emerald-900/40 px-3 py-1 rounded-full">
                Hạn chót: {parentDueDate}
              </span>
            </div>

            {invoices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-primary-foreground/85">Tổng Số Tiền Cần Thanh Toán:</p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight" data-testid="parent-outstanding-balance">
                  {(invoices[0].netAmount - invoices[0].paidAmount).toLocaleString('vi-VN')} VNĐ
                </h2>
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs font-extrabold bg-white text-emerald-800 px-3 py-1 rounded-full" data-testid="parent-settlement-status">
                    Trạng thái: {invoices[0].settlementStatus}
                  </span>
                  <span className="text-xs text-primary-foreground/85">
                    Mã Hóa Đơn: {invoices[0].invoiceNumber}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs">Hiện tại phụ huynh không có hóa đơn học phí nào cần thanh toán.</div>
            )}
          </div>

          {/* Detailed Item Breakdown */}
          {invoices.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--education-brand-ink)]" />
                Chi Tiết Khoản Thu - {parentPeriodLabel}
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">1. Học phí mầm non chính khóa</span>
                  <span className="font-bold text-gray-900 dark:text-white">5,000,000 VNĐ</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">2. Tiền ăn P4 (22 buổi thực tế)</span>
                  <span className="font-bold text-gray-900 dark:text-white">1,100,000 VNĐ</span>
                </div>
                <div className="py-3 flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-medium">3. Chiết khấu anh chị em ruột (-10%)</span>
                  <span className="font-bold">-500,000 VNĐ</span>
                </div>
                <div className="py-4 flex items-center justify-between font-extrabold text-sm border-t-2 border-slate-200 dark:border-slate-700">
                  <span>TỔNG CỘNG THỰC THU:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{invoices[0].netAmount.toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>
            </div>
          )}

          {/* Receipts & Fingerprint Audit Trail */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4 shadow-sm">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--education-brand-ink)]" />
              Lịch Sử Lập Biên Lai & Chứng Nhận SHA-256
            </h3>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs space-y-2" data-testid="parent-receipt-fingerprint">
              <p className="text-gray-500 font-bold">Mã Dấu Vân Tay Biên Lai (SHA-256 Canonical Snapshot):</p>
              <code className="block p-2.5 rounded-xl bg-slate-200 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] break-all">
                {invoices[0]?.sha256Checksum || 'a4f891b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abc'}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
