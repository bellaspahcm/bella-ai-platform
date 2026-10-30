'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard, DollarSign, CheckCircle2, Clock, RefreshCw, AlertCircle, Receipt } from 'lucide-react';

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  invoice_status: string;
  settlement_status: string;
  due_date: string | null;
  issued_at: string | null;
}

interface StudentFinanceProps {
  studentId: string;
  studentName?: string;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default function StudentFinance({ studentId, studentName }: StudentFinanceProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/education/enrollments/${studentId}/finance-summary`);
      if (!res.ok) {
        throw new Error('FAILED_TO_LOAD');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'LOAD_ERROR');
      }
      setInvoices(data.invoices ?? []);
      setTotalDue(data.totalDue ?? 0);
      setTotalPaid(data.totalPaid ?? 0);
      setOutstanding(data.outstanding ?? 0);
    } catch {
      setError('Không thể tải dữ liệu tài chính học phí của học sinh.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance]);

  return (
    <section
      role="tabpanel"
      id="finance-tabpanel"
      aria-label={`Học phí & khoản thu của ${studentName || 'học sinh'}`}
      className="space-y-6"
    >
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Đang tải dữ liệu học phí {'&'} khoản thu...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-3" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchFinance}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Tổng Phải Thu (Thực thu)
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatVND(totalDue)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Đã Thanh Toán
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatVND(totalPaid)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Còn Nợ Hiện Tại
                </span>
              </div>
              <div className={`text-xl font-bold ${outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {formatVND(outstanding)}
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Danh Sách Hóa Đơn {'&'} Kỳ Thu ({invoices.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hóa đơn học phí, tiền ăn bán trú và các khoản phí dịch vụ mầm non
                </p>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Chưa có hóa đơn học phí nào trong hệ thống.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Mã Hóa Đơn</th>
                      <th className="py-3 px-3">Ngày Phát Hành</th>
                      <th className="py-3 px-3">Hạn Đóng</th>
                      <th className="py-3 px-3 text-right">Phải Thu</th>
                      <th className="py-3 px-3 text-right">Đã Trả</th>
                      <th className="py-3 px-3 text-right">Còn Nợ</th>
                      <th className="py-3 px-3 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                          {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatVND(inv.net_amount)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {formatVND(inv.paid_amount)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-600 dark:text-slate-300">
                          {formatVND(inv.outstanding_amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inv.settlement_status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {inv.settlement_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
