/** Browser persistence identifies an attempt; the server always reauthorizes it. */
export interface FinancePaymentScope { actorId: string; tenantId: string; branchId: string }
export interface FinancePaymentIntent extends FinancePaymentScope {
  version: 1;
  invoiceId: string;
  operationKey: string;
  paymentAmount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'QR_CODE';
  result?: { paymentId: string; receiptId: string };
}

// Reconstruct an allowed literal at the persistence boundary. A TypeScript
// cast on a shared select's value does not validate its runtime contents.
function canonicalPaymentMethod(value: unknown): FinancePaymentIntent['paymentMethod'] | null {
  switch (value) {
    case 'CASH': return 'CASH';
    case 'BANK_TRANSFER': return 'BANK_TRANSFER';
    case 'QR_CODE': return 'QR_CODE';
    default: return null;
  }
}
export function paymentIntentStorageKey(scope: FinancePaymentScope, invoiceId: string): string {
  return ['preschool-finance-payment-v1', scope.actorId, scope.tenantId, scope.branchId, invoiceId].join(':');
}
export function parsePaymentIntent(raw: string | null, scope: FinancePaymentScope, invoiceId: string): FinancePaymentIntent | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Yêu cầu thanh toán đã lưu bị lỗi; cần kiểm tra kết quả trước khi tiếp tục.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Yêu cầu thanh toán đã lưu không hợp lệ.');
  const row = value as Record<string, unknown>;
  const paymentMethod = canonicalPaymentMethod(row.paymentMethod);
  if (row.version !== 1 || row.actorId !== scope.actorId || row.tenantId !== scope.tenantId || row.branchId !== scope.branchId
      || row.invoiceId !== invoiceId || typeof row.operationKey !== 'string' || !row.operationKey.trim() || row.operationKey.length > 200
      || typeof row.paymentAmount !== 'number' || !Number.isFinite(row.paymentAmount) || row.paymentAmount <= 0
      || !paymentMethod) throw new Error('Yêu cầu thanh toán đã lưu không khớp hồ sơ hiện tại.');
  let result: FinancePaymentIntent['result'];
  if (row.result !== undefined) {
    if (!row.result || typeof row.result !== 'object' || Array.isArray(row.result)) throw new Error('Kết quả thanh toán đã lưu không hợp lệ.');
    const saved = row.result as Record<string, unknown>;
    if (typeof saved.paymentId !== 'string' || !saved.paymentId || typeof saved.receiptId !== 'string' || !saved.receiptId) throw new Error('Thiếu ID kết quả thanh toán đã lưu.');
    result = { paymentId: saved.paymentId, receiptId: saved.receiptId };
  }
  return { version: 1, ...scope, invoiceId, operationKey: row.operationKey, paymentAmount: row.paymentAmount,
    paymentMethod, ...(result ? { result } : {}) };
}
export function preparePaymentIntent(existing: FinancePaymentIntent | null, scope: FinancePaymentScope, invoiceId: string,
  paymentAmount: number, paymentMethod: FinancePaymentIntent['paymentMethod'], newKey: () => string,
  expectedOperationKey?: string): FinancePaymentIntent {
  const method = canonicalPaymentMethod(paymentMethod);
  if (!method) throw new Error('Phương thức thanh toán không hợp lệ.');
  if (expectedOperationKey && existing?.operationKey !== expectedOperationKey) {
    throw new Error('Yêu cầu thanh toán đã thay đổi ở thẻ khác. Đóng và mở lại khoản thu để kiểm tra.');
  }
  if (existing) {
    if (existing.paymentAmount !== paymentAmount || existing.paymentMethod !== method) throw new Error('Khoản thu đang chờ có nội dung khác. Hãy khôi phục đúng khoản thu trước.');
    return existing;
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(paymentAmount))) throw new Error('Nhập số tiền hợp lệ, tối đa hai chữ số thập phân.');
  return { version: 1, ...scope, invoiceId, operationKey: newKey(), paymentAmount, paymentMethod: method };
}
