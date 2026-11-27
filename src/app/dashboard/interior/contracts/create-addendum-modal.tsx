'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy, ExternalLink, FilePlus, LoaderCircle, Lock, X } from 'lucide-react';
import type { MilestoneTableItem } from '@/products/bella-interior/domain/contract-overview.types';

interface CreateAddendumModalProps {
  projectId: string;
  contractId: string;
  contractNumber: string;
  currentContractValue: number;
  milestones: MilestoneTableItem[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

interface EditableMilestone {
  id: string;
  milestoneOrder: number;
  name: string;
  percentageOfTotal: number;
  amount: number;
  triggerCondition: string;
  dueDate?: string;
  locked: boolean;
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)} đ`;
}

function toCustomerApprovalPageUrl(approvalId: unknown, apiEndpoint: unknown): string | null {
  if (typeof approvalId !== 'string' || typeof apiEndpoint !== 'string') return null;
  try {
    const endpoint = new URL(apiEndpoint, window.location.origin);
    const token = endpoint.searchParams.get('token');
    if (!token || endpoint.pathname !== `/api/interior/customer-approvals/${approvalId}`) return null;
    const page = new URL(`/interior/customer-approval/${approvalId}`, window.location.origin);
    page.searchParams.set('token', token);
    return page.toString();
  } catch {
    return null;
  }
}

export default function CreateAddendumModal({
  projectId,
  contractId,
  contractNumber,
  currentContractValue,
  milestones,
  onClose,
  onCreated,
}: CreateAddendumModalProps) {
  const [addendumNumber, setAddendumNumber] = useState(`PL-${contractNumber}-01`);
  const [addendumTitle, setAddendumTitle] = useState('');
  const [addendumValueInput, setAddendumValueInput] = useState('');
  const [addendumReason, setAddendumReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

  const parsedValueDelta = Number(addendumValueInput);
  const validDelta = Number.isFinite(parsedValueDelta) && parsedValueDelta !== 0 ? parsedValueDelta : 0;
  const revisedTotal = Math.round((currentContractValue + validDelta) * 100) / 100;

  const baseMilestones: EditableMilestone[] = useMemo(
    () =>
      milestones.map((m) => ({
        id: m.id,
        milestoneOrder: m.milestoneOrder,
        name: m.phaseName,
        percentageOfTotal: m.percentage,
        amount: m.amount,
        triggerCondition: m.phaseName,
        ...(m.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(m.dueDate) ? { dueDate: m.dueDate } : {}),
        locked: m.status === 'paid' || m.collectedAmount > 0 || m.invoiceStatus === 'issued',
      })),
    [milestones],
  );

  // Auto-reconcile unpaid milestones whenever valueDelta changes
  const reconciledMilestones: EditableMilestone[] = useMemo(() => {
    if (baseMilestones.length === 0 || validDelta === 0 || revisedTotal <= 0) {
      return baseMilestones;
    }
    const unlockedIndices = baseMilestones
      .map((m, idx) => (!m.locked ? idx : -1))
      .filter((idx) => idx >= 0);

    if (unlockedIndices.length === 0) return baseMilestones;

    const lastUnlockedIdx = unlockedIndices[unlockedIndices.length - 1];
    const cloned = baseMilestones.map((m) => ({ ...m }));
    cloned[lastUnlockedIdx].amount = Math.round((cloned[lastUnlockedIdx].amount + validDelta) * 100) / 100;

    // Recalculate percentages cleanly so they sum to 100
    let pctSum = 0;
    for (let i = 0; i < cloned.length; i += 1) {
      if (i === lastUnlockedIdx) continue;
      const pct = Math.round(((cloned[i].amount / revisedTotal) * 100) * 100) / 100;
      cloned[i].percentageOfTotal = pct;
      pctSum += pct;
    }
    cloned[lastUnlockedIdx].percentageOfTotal = Math.round((100 - pctSum) * 100) / 100;
    return cloned;
  }, [baseMilestones, revisedTotal, validDelta]);

  const unlockedCount = baseMilestones.filter((m) => !m.locked).length;
  const lastUnlockedAmount = reconciledMilestones.find((m, idx) => !m.locked && idx === reconciledMilestones.length - 1)?.amount ?? 1;
  const scheduleValid =
    reconciledMilestones.length > 0 &&
    unlockedCount > 0 &&
    revisedTotal > 0 &&
    reconciledMilestones.every((m) => m.amount > 0 && m.percentageOfTotal > 0) &&
    lastUnlockedAmount > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addendumNumber.trim() || !addendumTitle.trim() || !addendumReason.trim() || validDelta === 0) {
      toast.error('Vui lòng nhập đầy đủ mã phụ lục, tiêu đề, lý do và giá trị điều chỉnh khác 0.');
      return;
    }
    if (!scheduleValid) {
      toast.error('Không thể cân đối lịch thanh toán cho các đợt chưa thu. Vui lòng kiểm tra lại giá trị điều chỉnh.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/interior/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-addendum',
          projectId,
          contractId,
          addendumNumber: addendumNumber.trim(),
          addendumTitle: addendumTitle.trim(),
          addendumReason: addendumReason.trim(),
          addendumValue: validDelta,
          addendumMilestones: reconciledMilestones.map((m) => ({
            id: m.id,
            milestoneOrder: m.milestoneOrder,
            name: m.name,
            percentageOfTotal: m.percentageOfTotal,
            amount: m.amount,
            triggerCondition: m.triggerCondition,
            ...(m.dueDate ? { dueDate: m.dueDate } : {}),
          })),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { approvalId?: string; customerApprovalEndpoint?: string };
      } | null;

      if (!res.ok || !json?.success) {
        const errCode = json?.error || '';
        const msg =
          errCode === 'INTERIOR_PERMISSION_DENIED'
            ? 'Tài khoản không có quyền lập phụ lục hợp đồng.'
            : errCode === 'INTERIOR_CUSTOMER_CONTACT_REQUIRED'
              ? 'Hồ sơ dự án chưa có số điện thoại khách hàng để gửi duyệt phụ lục.'
              : errCode === 'INTERIOR_ADDENDUM_OR_APPROVAL_ALREADY_EXISTS'
                ? 'Mã phụ lục hoặc yêu cầu duyệt đã tồn tại.'
                : errCode === 'INTERIOR_ADDENDUM_PRECONDITION_FAILED'
                  ? 'Điều kiện điều chỉnh lịch thanh toán hoặc trạng thái hợp đồng chưa hợp lệ.'
                  : 'Không thể tạo phụ lục hợp đồng.';
        throw new Error(msg);
      }

      const generatedUrl = toCustomerApprovalPageUrl(
        json.data?.approvalId,
        json.data?.customerApprovalEndpoint,
      );
      setApprovalUrl(generatedUrl);
      toast.success('Đã tạo phụ lục hợp đồng và phát hành liên kết chờ khách hàng duyệt.');
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo phụ lục hợp đồng.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tạo Phụ Lục Hợp Đồng ({contractNumber})
              </h3>
              <p className="text-xs text-slate-500">
                Điều chỉnh giá trị & tự động cân đối các đợt thanh toán chưa thu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {approvalUrl ? (
          <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Phụ lục đã được lưu & gửi yêu cầu khách hàng chấp thuận</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Gửi liên kết bên dưới cho khách hàng để xác nhận phụ lục. Giá trị hợp đồng sẽ tự động cập nhật sau khi khách hàng phê duyệt.
            </p>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <input
                type="text"
                readOnly
                value={approvalUrl}
                className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-200 outline-none truncate"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(approvalUrl);
                  toast.success('Đã sao chép liên kết duyệt phụ lục.');
                }}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md text-xs font-semibold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Sao chép
              </button>
              <a
                href={approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở
              </a>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-semibold"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Mã phụ lục *
                <input
                  type="text"
                  required
                  value={addendumNumber}
                  onChange={(e) => setAddendumNumber(e.target.value)}
                  placeholder="VD: PL-01"
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </label>

              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Giá trị điều chỉnh (+ tăng / - giảm, VND) *
                <input
                  type="number"
                  required
                  step="1000"
                  value={addendumValueInput}
                  onChange={(e) => setAddendumValueInput(e.target.value)}
                  placeholder="VD: 50000000 hoặc -20000000"
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </label>

              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
                Tiêu đề phụ lục *
                <input
                  type="text"
                  required
                  value={addendumTitle}
                  onChange={(e) => setAddendumTitle(e.target.value)}
                  placeholder="VD: Bổ sung hệ tủ kịch trần phòng Master"
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </label>

              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
                Lý do điều chỉnh *
                <textarea
                  rows={2}
                  required
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                  placeholder="Mô tả chi tiết phạm vi phát sinh / thay đổi theo yêu cầu chủ đầu tư..."
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Cân đối lịch thanh toán sau phụ lục
                </span>
                <span className="font-semibold text-emerald-600">
                  Giá trị mới: {formatVnd(revisedTotal)}
                </span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                {reconciledMilestones.map((m) => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.locked ? (
                        <span title="Đợt đã thu / đã xuất hóa đơn (không thể sửa)">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {m.name}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatVnd(m.amount)}
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500">
                        ({m.percentageOfTotal}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {unlockedCount === 0 && (
                <p className="text-[11px] text-rose-600 font-medium">
                  Tất cả các đợt thanh toán đều đã thu/xuất hóa đơn nên không thể điều chỉnh lịch thanh toán.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting || validDelta === 0 || !scheduleValid}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                {submitting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
                <span>{submitting ? 'Đang tạo...' : 'Lưu & Gửi khách duyệt'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
