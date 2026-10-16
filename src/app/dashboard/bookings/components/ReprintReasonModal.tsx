'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

type ReprintReasonModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function ReprintReasonModal({
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: ReprintReasonModalProps) {
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length >= 5 && !isSubmitting;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">Xác nhận in lại bill</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Bill này đã có bản in hiệu lực. Vui lòng nhập lý do để lưu vào lịch sử kiểm soát.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">Lý do in lại</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            autoFocus
            placeholder="Ví dụ: Khách làm mất bill, cần in lại để đối chiếu..."
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:bg-white"
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmedReason)}
            disabled={!canSubmit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận in lại
          </button>
        </div>
      </div>
    </div>
  );
}
