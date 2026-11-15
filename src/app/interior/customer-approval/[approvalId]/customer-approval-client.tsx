'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileSignature, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react';

type JsonRecord = Record<string, unknown>;
type ApprovalSubjectType = 'quotation' | 'contract' | 'contract_addendum';

interface CustomerApprovalView {
  approvalId: string;
  subjectType: ApprovalSubjectType;
  status: string;
  expiresAt: string;
  canRespond: boolean;
  clientRepresentative: string;
  subject: JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readApprovalView(value: unknown): CustomerApprovalView | null {
  if (!isRecord(value) || typeof value.approvalId !== 'string'
    || (value.subjectType !== 'quotation' && value.subjectType !== 'contract' && value.subjectType !== 'contract_addendum')
    || typeof value.status !== 'string' || typeof value.expiresAt !== 'string'
    || typeof value.canRespond !== 'boolean' || typeof value.clientRepresentative !== 'string'
    || !isRecord(value.subject)) return null;
  return {
    approvalId: value.approvalId,
    subjectType: value.subjectType,
    status: value.status,
    expiresAt: value.expiresAt,
    canRespond: value.canRespond,
    clientRepresentative: value.clientRepresentative,
    subject: value.subject,
  };
}

function numberValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function formatCurrency(value: unknown): string {
  const amount = numberValue(value);
  return amount === null ? '—' : new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(amount);
}

function apiErrorMessage(code: unknown): string {
  const messages: Record<string, string> = {
    INTERIOR_CUSTOMER_APPROVAL_NOT_FOUND: 'Liên kết không hợp lệ hoặc không còn tồn tại.',
    INTERIOR_CUSTOMER_APPROVAL_NOT_ACTIONABLE: 'Liên kết đã hết hạn hoặc đã được sử dụng.',
    INTERIOR_CONTRACT_SIGNATURE_REQUIRED: 'Chấp thuận hợp đồng cần tệp chứng từ chữ ký thật.',
    INTERIOR_SIGNATURE_FILE_INVALID: 'Tệp chữ ký phải là PDF, PNG hoặc JPEG hợp lệ và không vượt giới hạn dung lượng.',
    INTERIOR_CUSTOMER_APPROVAL_EVIDENCE_INVALID: 'Không xác minh được chứng từ chữ ký.',
    INTERIOR_CUSTOMER_APPROVAL_PERSISTENCE_FAILED: 'Chưa ghi nhận được phản hồi. Hãy liên hệ Bella Interior để được hỗ trợ.',
  };
  return typeof code === 'string' ? messages[code] ?? 'Không thể xác minh liên kết hoặc ghi nhận phản hồi.' : 'Không thể xác minh liên kết hoặc ghi nhận phản hồi.';
}

function displayValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
}

function LineItems({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return <p className="mt-3 text-sm text-slate-500">Không có dòng hàng trong hồ sơ gửi duyệt.</p>;
  const items = value.filter(isRecord);
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[540px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
          <tr><th className="px-3 py-2">Hạng mục</th><th className="px-3 py-2">SL</th><th className="px-3 py-2">Đơn giá</th><th className="px-3 py-2 text-right">Thành tiền</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item, index) => (
            <tr key={`${displayValue(item.itemNumber)}-${index}`}>
              <td className="px-3 py-2"><span className="font-medium text-slate-900 dark:text-white">{displayValue(item.itemName)}</span>
                {typeof item.roomZoneName === 'string' ? <span className="mt-0.5 block text-xs text-slate-500">{item.roomZoneName}</span> : null}
              </td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{displayValue(item.quantity)} {displayValue(item.unit)}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatCurrency(item.clientUnitPrice)}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">{formatCurrency(item.clientTotalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Milestones({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return <p className="mt-3 text-sm text-slate-500">Không có lịch thanh toán trong hồ sơ gửi duyệt.</p>;
  const milestones = value.filter(isRecord);
  return (
    <ol className="mt-4 space-y-2">
      {milestones.map((item, index) => (
        <li key={`${displayValue(item.milestoneOrder)}-${index}`} className="flex items-start justify-between gap-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
          <span className="min-w-0"><span className="font-medium text-slate-900 dark:text-white">{displayValue(item.name)}</span>
            {typeof item.triggerCondition === 'string' ? <span className="mt-0.5 block text-xs text-slate-500">{item.triggerCondition}</span> : null}
          </span>
          <span className="shrink-0 text-right text-slate-700 dark:text-slate-300">{formatCurrency(item.amount)}{typeof item.percentage === 'number' ? ` · ${item.percentage}%` : ''}</span>
        </li>
      ))}
    </ol>
  );
}

function ApprovalSubject({ approval }: { approval: CustomerApprovalView }) {
  const subject = approval.subject;
  if (approval.subjectType === 'quotation') {
    return (
      <>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Báo giá</dt><dd className="mt-1 font-semibold">{displayValue(subject.quotationNumber)} · phiên bản {displayValue(subject.versionNumber)}</dd></div>
          <div><dt className="text-xs text-slate-500">Tổng thanh toán</dt><dd className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(subject.grandTotal)}</dd></div>
          <div><dt className="text-xs text-slate-500">Tạm tính / giảm giá</dt><dd className="mt-1">{formatCurrency(subject.subtotal)} / {formatCurrency(subject.discountAmount)}</dd></div>
          <div><dt className="text-xs text-slate-500">VAT</dt><dd className="mt-1">{displayValue(subject.vatPercent)}% · {formatCurrency(subject.vatAmount)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Điều khoản thanh toán</dt><dd className="mt-1 whitespace-pre-wrap">{displayValue(subject.paymentTerms)}</dd></div>
        </dl>
        <LineItems value={subject.items} />
      </>
    );
  }

  if (approval.subjectType === 'contract') {
    return (
      <>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Hợp đồng</dt><dd className="mt-1 font-semibold">{displayValue(subject.contractNumber)}</dd></div>
          <div><dt className="text-xs text-slate-500">Giá trị gốc</dt><dd className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(subject.baselineContractValue)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Tên hợp đồng</dt><dd className="mt-1 font-semibold">{displayValue(subject.title)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Nguồn đã chấp thuận</dt><dd className="mt-1">Báo giá v{displayValue(subject.quotationVersionNumber)} · BOQ v{displayValue(subject.boqVersionNumber)} · Thiết kế v{displayValue(subject.designVersionNumber)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Điều khoản thanh toán</dt><dd className="mt-1 whitespace-pre-wrap">{displayValue(subject.paymentTerms)}</dd></div>
        </dl>
        <h3 className="mt-5 text-sm font-semibold">Các đợt thanh toán</h3>
        <Milestones value={subject.milestones} />
      </>
    );
  }

  return (
    <>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Phụ lục</dt><dd className="mt-1 font-semibold">{displayValue(subject.addendumNumber)} · {displayValue(subject.title)}</dd></div>
        <div><dt className="text-xs text-slate-500">Giá trị sau phụ lục</dt><dd className="mt-1 font-semibold">{formatCurrency(subject.proposedContractValue)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Lý do</dt><dd className="mt-1 whitespace-pre-wrap">{displayValue(subject.reason)}</dd></div>
        <div><dt className="text-xs text-slate-500">Giá trị thay đổi</dt><dd className="mt-1">{formatCurrency(subject.valueDelta)}</dd></div>
        <div><dt className="text-xs text-slate-500">Hợp đồng gốc</dt><dd className="mt-1">{displayValue(subject.contractNumber)}</dd></div>
      </dl>
      <h3 className="mt-5 text-sm font-semibold">Lịch thanh toán đề xuất</h3>
      <Milestones value={subject.proposedPaymentSchedule} />
    </>
  );
}

export default function CustomerApprovalClient({ approvalId }: { approvalId: string }) {
  const [approval, setApproval] = useState<CustomerApprovalView | null>(null);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    setApprovalToken(token);
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (!token) {
      setError('Liên kết thiếu mã truy cập. Hãy mở lại liên kết được gửi bởi Bella Interior.');
      setLoading(false);
      return () => { active = false; };
    }
    void fetch(`/api/interior/customer-approvals/${encodeURIComponent(approvalId)}?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    }).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || body.success !== true) {
        throw new Error(apiErrorMessage(isRecord(body) ? body.error : null));
      }
      const view = isRecord(body.data) ? readApprovalView(body.data) : null;
      if (!view) throw new Error('Nội dung chấp thuận không hợp lệ.');
      if (active) setApproval(view);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không thể xác minh liên kết.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [approvalId]);

  const submitDecision = async (nextDecision: 'approved' | 'rejected') => {
    if (!approval) return;
    setDecision(nextDecision);
    setError('');
    if (nextDecision === 'approved' && !consent) {
      setError('Vui lòng xác nhận đã xem đúng phiên bản hồ sơ trước khi chấp thuận.');
      return;
    }
    if (nextDecision === 'rejected' && !rejectionReason.trim()) {
      setError('Cần ghi rõ lý do từ chối.');
      return;
    }
    if (approval.subjectType === 'contract' && nextDecision === 'approved' && !signatureFile) {
      setError('Hợp đồng cần tệp PDF/PNG/JPEG có chữ ký thật của khách hàng.');
      return;
    }
    if (nextDecision === 'approved' && signatureFile
      && (!['application/pdf', 'image/png', 'image/jpeg'].includes(signatureFile.type) || signatureFile.size > 5 * 1024 * 1024)) {
      setError('Tệp chữ ký phải là PDF, PNG hoặc JPEG và không vượt 5 MB.');
      return;
    }

    const form = new FormData();
    form.set('decision', nextDecision);
    if (customerNotes.trim()) form.set('customerNotes', customerNotes.trim());
    if (nextDecision === 'rejected') form.set('rejectionReason', rejectionReason.trim());
    if (nextDecision === 'approved' && signatureFile) form.set('signature', signatureFile);

    setSaving(true);
    try {
      const token = approvalToken;
      if (!token) throw new Error('Mã truy cập không còn trong trang. Hãy mở lại liên kết gốc.');
      const response = await fetch(`/api/interior/customer-approvals/${encodeURIComponent(approval.approvalId)}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: form,
        cache: 'no-store',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || body.success !== true) {
        throw new Error(apiErrorMessage(isRecord(body) ? body.error : null));
      }
      setResult(nextDecision);
      setApproval((current) => current ? { ...current, status: nextDecision, canRespond: false } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa ghi nhận được phản hồi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:py-12">
      <meta name="referrer" content="no-referrer" />
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Bella Interior</p><h1 className="mt-1 text-xl font-bold">Xác nhận hồ sơ thương mại</h1></div>
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Trang này hiển thị đúng phiên bản báo giá, hợp đồng hoặc phụ lục được gửi cho khách hàng. Chỉ tiếp tục nếu thông tin dưới đây khớp với hồ sơ bạn nhận.</p>
        </header>

        {loading ? <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin" />Đang xác minh liên kết an toàn…</section> : null}
        {!loading && error && !approval ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</section> : null}

        {approval ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div><p className="text-xs text-slate-500">Khách hàng</p><h2 className="mt-1 text-lg font-semibold">{approval.clientRepresentative}</h2></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{approval.subjectType === 'quotation' ? 'Báo giá' : approval.subjectType === 'contract' ? 'Hợp đồng' : 'Phụ lục'}</span>
              </div>
              <ApprovalSubject approval={approval} />
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">Liên kết hết hạn: {new Date(approval.expiresAt).toLocaleString('vi-VN')}</p>
            </section>

            {result ? (
              <section role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                {result === 'approved' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div><p className="font-semibold">{result === 'approved' ? 'Đã ghi nhận chấp thuận.' : 'Đã ghi nhận phản hồi từ chối.'}</p><p className="mt-1 text-xs">Mã chấp thuận: {approval.approvalId}. Bella Interior đã nhận kết quả cho đúng phiên bản hiển thị.</p></div>
              </section>
            ) : approval.canRespond ? (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Ghi chú cho Bella Interior (không bắt buộc)
                  <textarea maxLength={2000} value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </label>
                {approval.subjectType === 'contract' ? (
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Tệp hợp đồng có chữ ký thật (PDF, PNG hoặc JPEG, tối đa 5 MB)
                    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
                      className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 dark:border-slate-700 dark:bg-slate-800 dark:file:bg-slate-700" />
                    {signatureFile ? <span className="mt-1 block text-xs text-slate-500">Đã chọn: {signatureFile.name}</span> : null}
                  </label>
                ) : null}
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
                  <span>Tôi đã xem và xác nhận đây là đúng phiên bản hồ sơ cần phản hồi. Tôi hiểu thao tác chấp thuận sẽ ghi nhận quyết định của khách hàng.</span>
                </label>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Lý do từ chối (chỉ bắt buộc khi chọn từ chối)
                  <textarea maxLength={2000} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <div className="flex flex-col justify-end gap-2 sm:flex-row">
                  <button type="button" onClick={() => void submitDecision('rejected')} disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">
                    {saving && decision === 'rejected' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Từ chối
                  </button>
                  <button type="button" onClick={() => void submitDecision('approved')} disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {saving && decision === 'approved' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : approval.subjectType === 'contract' ? <FileSignature className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {approval.subjectType === 'contract' ? 'Chấp thuận & gửi chữ ký' : 'Chấp thuận hồ sơ'}
                  </button>
                </div>
              </section>
            ) : (
              <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Liên kết không còn chờ phản hồi hoặc đã hết hạn. Không có thay đổi nào được thực hiện từ trang này.</section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
