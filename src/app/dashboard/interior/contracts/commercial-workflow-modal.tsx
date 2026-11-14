'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy, ExternalLink, LoaderCircle, RefreshCw, Send, X } from 'lucide-react';

type JsonRecord = Record<string, unknown>;

interface BoqOption {
  id: string;
  boqNumber: string;
  versionNumber: number;
  status: string;
  designRevisionId: string;
  totalClientPrice: number | null;
}

interface QuotationOption {
  id: string;
  boqId: string;
  boqVersionNumber: number;
  quotationNumber: string;
  versionNumber: number;
  status: string;
  grandTotal: number;
}

interface ApprovalSummary {
  status: string;
}

interface ContractWorkflowContext {
  id: string;
  status: string;
  quotationId: string;
  quotationVersionNumber: number;
}

interface CommercialWorkflowPermissions {
  createQuotationAvailable: boolean;
  requestCustomerApprovalAvailable: boolean;
  createContractAvailable: boolean;
}

interface CommercialWorkflowModalProps {
  projectId: string;
  permissions: CommercialWorkflowPermissions;
  contract?: ContractWorkflowContext;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoq(value: unknown): BoqOption | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.status !== 'string'
    || typeof value.designRevisionId !== 'string') return null;
  const versionNumber = numberValue(value.versionNumber);
  if (versionNumber === null || !Number.isInteger(versionNumber)) return null;
  return {
    id: value.id,
    boqNumber: typeof value.boqNumber === 'string' ? value.boqNumber : value.id,
    versionNumber,
    status: value.status,
    designRevisionId: value.designRevisionId,
    totalClientPrice: numberValue(value.totalClientPrice),
  };
}

function parseQuotation(value: unknown): QuotationOption | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.boqId !== 'string'
    || typeof value.quotationNumber !== 'string' || typeof value.status !== 'string') return null;
  const boqVersionNumber = numberValue(value.boqVersionNumber);
  const versionNumber = numberValue(value.versionNumber);
  const grandTotal = numberValue(value.grandTotal);
  if (boqVersionNumber === null || !Number.isInteger(boqVersionNumber)
    || versionNumber === null || !Number.isInteger(versionNumber) || grandTotal === null) return null;
  return {
    id: value.id,
    boqId: value.boqId,
    boqVersionNumber,
    quotationNumber: value.quotationNumber,
    versionNumber,
    status: value.status,
    grandTotal,
  };
}

function errorMessage(code: unknown): string {
  if (typeof code !== 'string') return 'Không thể hoàn tất thao tác. Dữ liệu chưa được thay đổi nếu máy chủ từ chối yêu cầu.';
  const messages: Record<string, string> = {
    INTERIOR_PERMISSION_DENIED: 'Tài khoản hiện tại không có quyền thực hiện thao tác này trong dự án.',
    INTERIOR_AUTHORIZATION_UNAVAILABLE: 'Không xác minh được quyền hiện tại; yêu cầu đã bị từ chối an toàn.',
    INTERIOR_QUOTATION_REQUIRES_APPROVED_BOQ: 'Báo giá chỉ được tạo từ BOQ đã duyệt hoặc đã khóa theo hợp đồng.',
    INTERIOR_QUOTATION_ALREADY_EXISTS_FOR_BOQ: 'BOQ này đã có báo giá. Hãy dùng phiên bản báo giá hiện có.',
    INTERIOR_QUOTATION_SOURCE_NOT_FOUND: 'Không tìm thấy BOQ trong đúng dự án hoặc tenant hiện tại.',
    INTERIOR_CUSTOMER_CONTACT_REQUIRED: 'Hồ sơ dự án chưa có số liên hệ khách hàng để gửi yêu cầu duyệt.',
    INTERIOR_APPROVAL_SUBJECT_NOT_READY: 'Báo giá/hợp đồng hiện không ở trạng thái có thể gửi khách hàng.',
    INTERIOR_APPROVAL_SUBJECT_VERSION_MISMATCH: 'Phiên bản nguồn đã thay đổi; hãy tải lại dữ liệu trước khi tiếp tục.',
    INTERIOR_ACCEPTED_QUOTATION_REQUIRED: 'Cần có báo giá được khách hàng chấp thuận trước khi lập hợp đồng.',
    INTERIOR_QUOTATION_APPROVAL_EVIDENCE_REQUIRED: 'Chưa có bằng chứng chấp thuận khách hàng cho đúng phiên bản báo giá.',
    INTERIOR_CONTRACT_ALREADY_EXISTS_FOR_QUOTATION: 'Hợp đồng cho phiên bản báo giá này đã được tạo.',
    INTERIOR_CONTRACT_PRECONDITION_FAILED: 'Không thể tạo hợp đồng do điều kiện nguồn hoặc lineage chưa hợp lệ.',
  };
  return messages[code] ?? 'Thao tác chưa hoàn tất. Tải lại dữ liệu và kiểm tra điều kiện nghiệp vụ trước khi thử lại.';
}

function currency(value: number | null): string {
  return value === null ? 'Không có quyền xem giá trị' : new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(value);
}

function customerPageUrl(approvalId: unknown, apiEndpoint: unknown): string | null {
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

export default function CommercialWorkflowModal({
  projectId,
  permissions,
  contract,
  onClose,
  onChanged,
}: CommercialWorkflowModalProps) {
  const [boqs, setBoqs] = useState<BoqOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [selectedBoqId, setSelectedBoqId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [contractApprovalPending, setContractApprovalPending] = useState(false);
  const [approvalLink, setApprovalLink] = useState<{ url: string; label: string } | null>(null);

  const loadCommercialRecords = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const results = await Promise.all([
      fetch(`/api/interior/boq?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null),
      fetch(`/api/interior/quotations?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null),
      contract
        ? fetch(`/api/interior/customer-approvals?subjectId=${encodeURIComponent(contract.id)}`, { cache: 'no-store' }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const [boqResponse, quotationResponse, approvalsResponse] = results;
    if (!contract && (!boqResponse || !quotationResponse)) {
      setLoadError('Không kết nối được tới dữ liệu thương mại của dự án.');
      setBoqs([]);
      setQuotations([]);
      setLoading(false);
      return;
    }
    if (contract && !approvalsResponse) {
      setLoadError('Không thể kiểm tra yêu cầu chấp thuận đang chờ của hợp đồng.');
    }
    const [boqBody, quotationBody, approvalsBody] = await Promise.all([
      boqResponse ? boqResponse.json().catch(() => null) as Promise<unknown> : Promise.resolve(null),
      quotationResponse ? quotationResponse.json().catch(() => null) as Promise<unknown> : Promise.resolve(null),
      approvalsResponse ? approvalsResponse.json().catch(() => null) as Promise<unknown> : Promise.resolve(null),
    ]);
    const boqRows: unknown[] | null = isRecord(boqBody) && isRecord(boqBody.data) && Array.isArray(boqBody.data.boqs)
      ? boqBody.data.boqs as unknown[] : null;
    const quotationRows: unknown[] | null = isRecord(quotationBody) && Array.isArray(quotationBody.data)
      ? quotationBody.data as unknown[] : null;

    let nextLoadError = '';
    if (!contract && (!boqResponse?.ok || !isRecord(boqBody) || boqBody.success !== true || !boqRows)) {
      setBoqs([]);
      nextLoadError = errorMessage(isRecord(boqBody) ? boqBody.error : null);
    } else if (!contract && boqRows) {
      const parsedBoqs = boqRows.map((item: unknown) => parseBoq(item)).filter((item): item is BoqOption => item !== null);
      setBoqs(parsedBoqs);
      setSelectedBoqId((current) => parsedBoqs.some((boq) => boq.id === current) ? current : '');
    }

    if (!contract && (!quotationResponse?.ok || !isRecord(quotationBody) || quotationBody.success !== true || !quotationRows)) {
      setQuotations([]);
      if (!nextLoadError) nextLoadError = errorMessage(isRecord(quotationBody) ? quotationBody.error : null);
    } else if (!contract && quotationRows) {
      setQuotations(quotationRows.map((item: unknown) => parseQuotation(item)).filter((item): item is QuotationOption => item !== null));
    }

    if (approvalsResponse?.ok && isRecord(approvalsBody) && Array.isArray(approvalsBody.data)) {
      setContractApprovalPending(approvalsBody.data.some((item: unknown) => isRecord(item) && item.status === 'pending'));
    } else {
      setContractApprovalPending(Boolean(contract));
    }
    setLoadError(nextLoadError || (contract && !approvalsResponse ? 'Không thể kiểm tra yêu cầu chấp thuận đang chờ của hợp đồng.' : ''));
    setLoading(false);
  }, [contract, projectId]);

  useEffect(() => {
    void loadCommercialRecords();
  }, [loadCommercialRecords]);

  const availableBoqs = useMemo(() => boqs.filter((boq) =>
    (boq.status === 'approved' || boq.status === 'locked_for_contract')
    && !quotations.some((quotation) => quotation.boqId === boq.id),
  ), [boqs, quotations]);

  const saveJson = async (url: string, body: JsonRecord): Promise<JsonRecord> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(result) || result.success !== true || !isRecord(result.data)) {
      throw new Error(errorMessage(isRecord(result) ? result.error : null));
    }
    return result.data;
  };

  const createQuotation = async () => {
    if (!selectedBoqId) return;
    setSavingAction('quotation');
    try {
      await saveJson('/api/interior/quotations', { projectId, boqId: selectedBoqId });
      toast.success('Đã lưu bản nháp báo giá từ đúng phiên bản BOQ.');
      await loadCommercialRecords();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMessage(null));
    } finally {
      setSavingAction(null);
    }
  };

  const requestApproval = async (subjectType: 'quotation' | 'contract', subjectId: string, label: string) => {
    setSavingAction(`approval:${subjectId}`);
    try {
      const result = await saveJson('/api/interior/customer-approvals', { projectId, subjectType, subjectId });
      const url = customerPageUrl(result.approvalId, result.customerApprovalEndpoint);
      if (!url) throw new Error('Máy chủ không trả về liên kết chấp thuận hợp lệ.');
      setApprovalLink({ url, label });
      if (subjectType === 'contract') setContractApprovalPending(true);
      toast.success('Đã tạo yêu cầu. Chưa có chấp thuận nào được ghi nhận từ thao tác này.');
      await loadCommercialRecords();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMessage(null));
    } finally {
      setSavingAction(null);
    }
  };

  const createContract = async (quotation: QuotationOption) => {
    setSavingAction(`contract:${quotation.id}`);
    try {
      await saveJson('/api/interior/contracts', { action: 'create-contract', projectId, quotationId: quotation.id });
      toast.success('Đã tạo bản nháp hợp đồng từ đúng báo giá và bằng chứng khách hàng đã chấp thuận.');
      onClose();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMessage(null));
    } finally {
      setSavingAction(null);
    }
  };

  const copyApprovalLink = async () => {
    if (!approvalLink) return;
    try {
      await navigator.clipboard.writeText(approvalLink.url);
      toast.success('Đã sao chép liên kết. Chỉ gửi cho khách hàng được chỉ định qua kênh được duyệt.');
    } catch {
      toast.error('Trình duyệt không cấp quyền sao chép. Hãy chọn và sao chép liên kết đang hiển thị.');
    }
  };

  const contractCanRequestApproval = contract
    && (contract.status === 'draft' || contract.status === 'in_review');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="commercial-workflow-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 id="commercial-workflow-title" className="text-base font-bold text-slate-900 dark:text-white">
              Báo giá &amp; hồ sơ khách hàng
            </h2>
            <p className="mt-1 text-xs text-slate-500">Dữ liệu và giá trị lấy từ BOQ, báo giá và hợp đồng đã lưu.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadCommercialRecords()} disabled={loading || savingAction !== null}
              aria-label="Tải lại dữ liệu thương mại" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadError ? <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{loadError}</p> : null}
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tải dữ liệu thương mại…</div> : (
          <div className="mt-4 space-y-5">
            {!contract ? (
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tạo báo giá từ BOQ đã duyệt</h3>
                <p className="mt-1 text-xs text-slate-500">Máy chủ chốt phiên bản BOQ, dòng hàng và phép tính. Mặc định nghiệp vụ hiện hành: VAT 8%, hiệu lực 30 ngày; điều khoản thanh toán do dịch vụ thương mại áp dụng.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select aria-label="BOQ đã duyệt" value={selectedBoqId} onChange={(event) => setSelectedBoqId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    disabled={!permissions.createQuotationAvailable || availableBoqs.length === 0}>
                    <option value="">{availableBoqs.length ? 'Chọn BOQ đã duyệt' : 'Không có BOQ đủ điều kiện chưa được báo giá'}</option>
                    {availableBoqs.map((boq) => (
                      <option key={boq.id} value={boq.id}>
                        {boq.boqNumber} · v{boq.versionNumber} · {boq.status === 'approved' ? 'Đã duyệt' : 'Đã khóa'} · {currency(boq.totalClientPrice)}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void createQuotation()}
                    disabled={!permissions.createQuotationAvailable || !selectedBoqId || savingAction !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {savingAction === 'quotation' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                    Tạo bản nháp báo giá
                  </button>
                </div>
                {!permissions.createQuotationAvailable ? <p className="mt-2 text-xs text-slate-500">Không có quyền báo giá hoặc quyền chưa xác minh được.</p> : null}
              </section>
            ) : null}

            {!contract ? <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Báo giá trong dự án</h3>
              {quotations.length === 0 ? <p className="mt-2 text-xs text-slate-500">Chưa có báo giá được lưu.</p> : (
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {quotations.map((quotation) => {
                    const busy = savingAction === `approval:${quotation.id}` || savingAction === `contract:${quotation.id}`;
                    return (
                      <li key={quotation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{quotation.quotationNumber} · v{quotation.versionNumber}</p>
                          <p className="mt-1 text-[11px] text-slate-500">BOQ {quotation.boqId} · v{quotation.boqVersionNumber} · {currency(quotation.grandTotal)}</p>
                          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Trạng thái: {quotation.status}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {!contract && quotation.status === 'draft' && permissions.requestCustomerApprovalAvailable ? (
                            <button type="button" onClick={() => void requestApproval('quotation', quotation.id, `${quotation.quotationNumber} v${quotation.versionNumber}`)} disabled={busy || savingAction !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-[11px] font-semibold text-emerald-700 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300">
                              <Send className="h-3.5 w-3.5" /> Gửi khách duyệt
                            </button>
                          ) : null}
                          {!contract && quotation.status === 'accepted' && permissions.createContractAvailable ? (
                            <button type="button" onClick={() => void createContract(quotation)} disabled={busy || savingAction !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50">
                              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Tạo hợp đồng nháp
                            </button>
                          ) : null}
                          {quotation.status === 'sent_to_client' ? <span className="self-center text-[11px] text-amber-700 dark:text-amber-300">Đang chờ khách hàng phản hồi</span> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section> : null}

            {contract ? (
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Chữ ký hợp đồng</h3>
                <p className="mt-1 text-xs text-slate-500">Hợp đồng chỉ chuyển sang đã ký sau khi khách hàng gửi quyết định kèm chứng từ chữ ký thật.</p>
                {contractCanRequestApproval && permissions.requestCustomerApprovalAvailable ? (
                  <button type="button" onClick={() => void requestApproval('contract', contract.id, `Hợp đồng phiên bản báo giá ${contract.quotationVersionNumber}`)}
                    disabled={contractApprovalPending || savingAction !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300">
                    {savingAction === `approval:${contract.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {contractApprovalPending ? 'Đã có yêu cầu ký đang chờ khách' : 'Tạo liên kết để khách ký'}
                  </button>
                ) : <p className="mt-2 text-xs text-slate-500">Trạng thái hợp đồng hiện tại: {contract.status}.</p>}
              </section>
            ) : null}

            {approvalLink ? (
              <section role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">Liên kết khách hàng · {approvalLink.label}</p>
                <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">Token chỉ được trả một lần. Chỉ gửi cho khách hàng được chỉ định qua kênh được duyệt; việc tạo liên kết chưa ghi nhận chấp thuận.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input aria-label="Liên kết chấp thuận khách hàng" readOnly value={approvalLink.url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[11px] text-slate-700 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-200" />
                  <button type="button" onClick={() => void copyApprovalLink()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white">
                    <Copy className="h-3.5 w-3.5" /> Sao chép
                  </button>
                  <a href={approvalLink.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-300">
                    <ExternalLink className="h-3.5 w-3.5" /> Mở trang khách
                  </a>
                </div>
              </section>
            ) : null}
          </div>
        )}
        <div className="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Đóng</button>
        </div>
      </section>
    </div>
  );
}
