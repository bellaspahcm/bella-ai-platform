'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, CreditCard, DollarSign, X, Loader2 } from 'lucide-react';

interface AdmissionConfirmModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly studentName: string;
  readonly studentCode: string;
  readonly className: string;
  readonly enrollmentId: string;
  readonly onConfirmed: () => void;
}

export default function AdmissionConfirmModal({
  isOpen,
  onClose,
  studentName,
  studentCode,
  className,
  enrollmentId,
  onConfirmed,
}: AdmissionConfirmModalProps) {
  const [mode, setMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/education/enrollments/confirm-admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          admissionMode: mode,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Không thể xác nhận nhập học. Vui lòng thử lại.');
      }

      onConfirmed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-admission-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 id="confirm-admission-title" className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Xác Nhận Nhập Học Cho Trẻ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quyền Quản trị viên (Admin) • Chuyển trạng thái sang &quot;Đang hoạt động&quot;
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student summary info */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Học sinh:</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{studentName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Mã học sinh:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{studentCode}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Lớp học:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">{className}</span>
          </div>
          <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-2 flex justify-between items-center">
            <span className="text-slate-500">Khoản thu nhập học tiêu chuẩn:</span>
            <span className="font-black text-slate-900 dark:text-white">5.700.000 đ</span>
          </div>
          <p className="text-[11px] text-slate-400">
            (Bao gồm: Học phí mầm non 4.500.000 đ + Tiền ăn bán trú 1.200.000 đ)
          </p>
        </div>

        {/* Admission Mode Options */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Chọn hình thức xác nhận tài chính:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setMode('PAID')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'PAID'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-600/30'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`p-1.5 rounded-xl ${mode === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white">Đã nộp học phí</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Phụ huynh đã thanh toán đủ học phí đầu vào. Tạo hóa đơn <strong>ĐÃ THANH TOÁN</strong>, công nợ = 0.
              </p>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => setMode('DEBT')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'DEBT'
                  ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`p-1.5 rounded-xl ${mode === 'DEBT' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white">Nhập học nợ phí</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Cho phép trẻ vào học trước. Ghi nhận <strong>CÔNG NỢ</strong>, đồng bộ mã VietQR động lên Portal phụ huynh.
              </p>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{submitting ? 'Đang xử lý...' : 'Xác Nhận Nhập Học'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

