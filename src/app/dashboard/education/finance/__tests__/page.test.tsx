/** @jest-environment jsdom */

import React from 'react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FinanceStateResponse, FinanceCommandResponse, FinanceStudentOption } from '../page';
import type { BillingPeriod, Invoice } from '@/products/bella-education/finance/domain/finance.types';

// Existing UI regression contract for other products; Preschool containment is tested separately.
jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: { id: 'synthetic-user', tenant_id: 'synthetic-tenant' }, product: { productKey: 'bella_english_center' }, isLoading: false }) }));
const FinancePage = jest.requireActual<typeof import('../page')>('../page').default;

// UI contract only: synthetic HTTP DTOs prove display/request behavior, never DB/auth/RLS.
const studentA: FinanceStudentOption = { enrollmentId: 'enrollment-a', courseId: 'course-a', studentPartyId: 'party-a', studentId: 'student-a', studentCode: 'SYN-A', displayName: 'Synthetic Alpha' };
const studentB: FinanceStudentOption = { ...studentA, enrollmentId: 'enrollment-b', studentPartyId: 'party-b', studentId: 'student-b', studentCode: 'SYN-B', displayName: 'Synthetic Beta' };
const period: BillingPeriod = { id: 'period-2027', tenantId: 'synthetic-tenant', periodName: 'Synthetic term 2027', startDate: '2027-01-01', endDate: '2027-01-31', dueDate: '2027-01-15', status: 'ACTIVE', createdBy: 'synthetic-staff' };
const invoice: Invoice = { id: 'invoice-source', tenantId: 'synthetic-tenant', studentPartyId: studentA.studentPartyId, billingPeriodId: period.id, invoiceNumber: 'SYNTHETIC-VOID', invoiceStatus: 'VOID', settlementStatus: 'OVERPAID', grossAmount: 123456, discountAmount: 0, netAmount: 123456, paidAmount: 123457, outstandingAmount: -1, dueDate: period.dueDate, isArchived: false, createdBy: 'synthetic-staff' };

const branch = { id: 'synthetic-branch', name: 'Synthetic permitted branch' };
const state = (overrides: Partial<FinanceStateResponse> = {}): FinanceStateResponse => ({ success: true,
  branches: [branch], selectedBranchId: branch.id, actorId: 'synthetic-actor', tenantId: 'synthetic-tenant',
  students: [], billingPeriods: [], invoices: [], payments: [], exceptions: [], servicePeriodCompletions: [], ...overrides });
const response = (payload: FinanceStateResponse | FinanceCommandResponse, ok = true): Pick<Response, 'ok' | 'json'> => ({ ok, json: async () => payload });
const fetchMock = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>>();
const postCalls = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');

async function renderFinance() {
  render(<FinancePage />);
  const picker = await screen.findByRole('combobox', { name: 'Cơ sở tài chính' });
  await waitFor(() => expect(picker).toBeEnabled());
  fireEvent.click(picker);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: branch.name }));
}

beforeEach(() => {
  fetchMock.mockReset();
  localStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, run: () => Promise<unknown>) => run(),
  } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true,
    value: (input: RequestInfo | URL, init?: RequestInit) => {
      // The discovery response contains no financial rows. Every workflow test
      // explicitly selects the allowed branch before its queued scoped reads.
      if (String(input) === '/api/education/finance' && !init?.method) {
        return Promise.resolve(response(state({ selectedBranchId: undefined })));
      }
      return fetchMock(input, init);
    },
  });
});

it('shows pending and genuine empty states without reference invoice rows or synthetic-target commands', async () => {
  let resolveGet: ((value: Pick<Response, 'ok' | 'json'>) => void) | undefined;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveGet = resolve; }));
  await renderFinance();
  expect(screen.getByText('Đang tải hoặc xử lý dữ liệu tài chính…')).toBeInTheDocument();
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  expect(screen.queryByTestId('invoice-workspace')).not.toBeInTheDocument();
  await act(async () => { resolveGet?.(response(state())); });
  const table = await screen.findByTestId('invoice-workspace');
  expect(await within(table).findByText('Chưa có hóa đơn.')).toBeInTheDocument();
  expect(within(table).getByRole('button', { name: 'Tất cả (0)' })).toBeInTheDocument();
  expect(within(table).getByText('Hiển thị 0 / 0 hóa đơn đã tải')).toBeInTheDocument();
  expect(screen.getByLabelText(/Chọn học sinh/)).toHaveValue('');
  expect(screen.getByLabelText(/Kỳ thu/)).toHaveValue('');
  fireEvent.click(screen.getByTestId('btn-compile-invoice'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('keeps load failure distinct from empty and retries using only newly returned records', async () => {
  fetchMock.mockResolvedValueOnce(response({ success: false, error: 'SYNTHETIC_LOAD_FAILURE' }, false));
  fetchMock.mockResolvedValueOnce(response(state({ students: [studentA], billingPeriods: [period], invoices: [invoice] })));
  await renderFinance();
  expect(await screen.findByRole('alert')).toHaveTextContent('SYNTHETIC_LOAD_FAILURE');
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  expect(screen.queryByTestId('invoice-workspace')).not.toBeInTheDocument();
  expect(screen.getByText('Chưa có dữ liệu tài chính đã xác minh để hiển thị nội dung nghiệp vụ.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  const table = await screen.findByTestId('invoice-workspace');
  expect(await within(table).findByText('SYNTHETIC-VOID')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('retains canonical VOID/OVERPAID, actual amount/period, exact counts and working filters', async () => {
  fetchMock.mockResolvedValue(response(state({ students: [studentA], billingPeriods: [period], invoices: [invoice, { ...invoice, id: 'draft-id', invoiceNumber: 'SYNTHETIC-DRAFT', invoiceStatus: 'DRAFT', settlementStatus: 'UNPAID' }] })));
  await renderFinance();
  const table = await screen.findByTestId('invoice-workspace');
  const number = await within(table).findByText('SYNTHETIC-VOID');
  const row = number.closest('tr');
  if (!row) throw new Error('Expected invoice table row');
  expect(within(row).getByText('Đã hủy')).toBeInTheDocument();
  expect(within(row).getByText('Thanh toán thừa')).toBeInTheDocument();
  expect(within(row).getByText('123.456')).toBeInTheDocument();
  expect(within(row).getByText('Synthetic term 2027')).toBeInTheDocument();
  expect(within(row).getByText('—')).toBeInTheDocument();
  expect(within(row).getByTestId('btn-issue-invoice')).toBeDisabled();
  expect(within(table).getByRole('button', { name: 'Tất cả (2)' })).toBeInTheDocument();
  expect(within(table).getByRole('button', { name: 'Bản nháp (1)' })).toBeInTheDocument();
  expect(within(table).getByRole('button', { name: 'Đã phát hành (0)' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái thanh toán'), { target: { value: 'OVERPAID' } });
  expect(within(table).queryByText('SYNTHETIC-DRAFT')).not.toBeInTheDocument();
  expect(within(table).getByText('Hiển thị 1 / 2 hóa đơn đã tải')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái phát hành'), { target: { value: 'DRAFT' } });
  expect(within(table).getByText('Không có hóa đơn phù hợp bộ lọc.')).toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('requires exact selections, previews identity/period without quote, and uses returned command invoice', async () => {
  const loaded = state({ students: [studentA, studentB], billingPeriods: [period] });
  fetchMock.mockResolvedValueOnce(response(loaded));
  fetchMock.mockResolvedValueOnce(response({ success: true, invoice: { ...invoice, invoiceNumber: 'RETURNED-DRAFT', invoiceStatus: 'DRAFT', netAmount: 987654 } }));
  fetchMock.mockResolvedValueOnce(response(loaded));
  await renderFinance();
  await screen.findByRole('option', { name: /Synthetic Beta/ });
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Chọn học sinh/), { target: { value: 'party-b' } });
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Kỳ thu/), { target: { value: period.id } });
  fireEvent.click(screen.getByTestId('btn-compile-invoice'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Synthetic Beta')).toBeInTheDocument();
  expect(within(dialog).getByText('Kỳ thu: Synthetic term 2027')).toBeInTheDocument();
  expect(within(dialog).getByText(/Chưa có số tiền xem trước/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/3\.500\.000|3\.000\.000|700\.000|200\.000/)).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận lập nháp' }));
  await waitFor(() => expect(postCalls()).toHaveLength(1));
  expect(JSON.parse(String(postCalls()[0][1]?.body))).toEqual({ action: 'compileDraftInvoice', branchId: branch.id, studentPartyId: 'party-b', billingPeriodId: 'period-2027' });
  expect(await screen.findByText(/RETURNED-DRAFT \(987\.654 đ\)/)).toBeInTheDocument();
});

it.each(['student', 'period'] as const)('does not silently substitute a %s selection removed by refreshed GET', async (removed) => {
  fetchMock.mockResolvedValueOnce(response(state({ students: [studentA, studentB], billingPeriods: [period] })));
  fetchMock.mockResolvedValueOnce(response(state({ students: removed === 'student' ? [studentB] : [studentA, studentB], billingPeriods: removed === 'period' ? [{ ...period, id: 'different-period' }] : [period] })));
  await renderFinance();
  await screen.findByRole('option', { name: /Synthetic Alpha/ });
  fireEvent.change(screen.getByLabelText(/Chọn học sinh/), { target: { value: studentA.studentPartyId } });
  fireEvent.change(screen.getByLabelText(/^Kỳ thu/), { target: { value: period.id } });
  expect(screen.getByTestId('btn-compile-invoice')).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await screen.findByRole('option', { name: removed === 'student' ? 'Học sinh đã chọn không còn trong danh sách' : 'Kỳ thu đã chọn không còn trong danh sách' });
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  fireEvent.click(screen.getByTestId('btn-compile-invoice'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('clears previously loaded rows and blocks commands when refresh fails', async () => {
  fetchMock.mockResolvedValueOnce(response(state({ students: [studentA], billingPeriods: [period], invoices: [invoice] })));
  fetchMock.mockRejectedValueOnce(new Error('SYNTHETIC_OFFLINE'));
  await renderFinance();
  await screen.findByText('SYNTHETIC-VOID');
  fireEvent.change(screen.getByLabelText(/Chọn học sinh/), { target: { value: studentA.studentPartyId } });
  fireEvent.change(screen.getByLabelText(/^Kỳ thu/), { target: { value: period.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('SYNTHETIC_OFFLINE');
  expect(screen.queryByText('SYNTHETIC-VOID')).not.toBeInTheDocument();
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Xác nhận hoàn thành' })).not.toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('resets a removed invoice-period filter and retains filters for IDs without period metadata', async () => {
  const nextInvoice = { ...invoice, id: 'invoice-next', invoiceNumber: 'SYNTHETIC-NEXT', billingPeriodId: 'unlisted-period-b' };
  fetchMock.mockResolvedValueOnce(response(state({ billingPeriods: [period], invoices: [invoice] })));
  fetchMock.mockResolvedValueOnce(response(state({ invoices: [nextInvoice] })));
  fetchMock.mockResolvedValueOnce(response(state({ invoices: [nextInvoice] })));
  await renderFinance();
  await screen.findByText('SYNTHETIC-VOID');
  fireEvent.change(screen.getByLabelText('Lọc kỳ thu'), { target: { value: period.id } });
  expect(screen.getByLabelText('Lọc kỳ thu')).toHaveValue(period.id);
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await screen.findByText('SYNTHETIC-NEXT');
  expect(screen.getByLabelText('Lọc kỳ thu')).toHaveValue('ALL');
  expect(screen.getByRole('option', { name: 'unlisted-period-b' })).toHaveValue('unlisted-period-b');
  fireEvent.change(screen.getByLabelText('Lọc kỳ thu'), { target: { value: 'unlisted-period-b' } });
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await screen.findByText('SYNTHETIC-NEXT');
  expect(screen.getByLabelText('Lọc kỳ thu')).toHaveValue('unlisted-period-b');
  expect(screen.getByText('Hiển thị 1 / 1 hóa đơn đã tải')).toBeInTheDocument();
});

it('switches tabs and displays corresponding workspace views without crashing', async () => {
  fetchMock.mockResolvedValue(response(state({
    students: [studentA],
    billingPeriods: [period],
    invoices: [invoice],
    payments: [{
      id: 'pay-1',
      tenantId: 'synthetic-tenant',
      payerPartyId: 'payer-1',
      studentPartyId: studentA.studentPartyId,
      paymentNumber: 'PAY-2027-001',
      paymentMethod: 'BANK_TRANSFER',
      amount: 500000,
      allocatedAmount: 500000,
      unallocatedAmount: 0,
      paymentDate: '2027-01-10',
      status: 'RECONCILED',
      createdBy: 'staff-1',
    }],
    exceptions: [{
      id: 'ex-1',
      exception_type: 'PAYMENT_MISMATCH',
      status: 'PENDING',
      description: 'Số tiền nộp không khớp hóa đơn',
    }],
  })));

  await renderFinance();
  await screen.findByText('SYNTHETIC-VOID');

  // Switch to Invoices Tab
  fireEvent.click(screen.getByRole('button', { name: /Hóa đơn/ }));
  expect(screen.getByText('Quản lý Hóa Đơn Học Phí')).toBeInTheDocument();

  // Switch to Debts Tab
  fireEvent.click(screen.getByRole('button', { name: /Công nợ/ }));
  expect(screen.getByText('Quản Lý Công Nợ & Thu Hồi Học Phí')).toBeInTheDocument();

  // Switch to Payments Tab
  fireEvent.click(screen.getByRole('button', { name: /Thanh toán/ }));
  expect(screen.getByText('Sổ Quỹ Thanh Toán & Phiếu Thu Học Phí')).toBeInTheDocument();
  expect(screen.getByText('PAY-2027-001')).toBeInTheDocument();

  // Switch to Reconciliation Tab
  fireEvent.click(screen.getByRole('button', { name: /Đối soát/ }));
  expect(screen.getByText('Trung Tâm Đối Soát & Giải Quyết Ngoại Lệ Tài Chính')).toBeInTheDocument();
  expect(screen.getByText('PAYMENT_MISMATCH')).toBeInTheDocument();

  // Switch to Reports Tab
  fireEvent.click(screen.getByRole('button', { name: /Báo cáo/ }));
  expect(screen.getByText('Báo Cáo Thu Học Phí & Hiệu Quả Thu Hồi')).toBeInTheDocument();
  expect(screen.getByText('Bảng Tổng Hợp Doanh Thu Theo Kỳ Thu')).toBeInTheDocument();
});

it('opens payment modal and submits recordAndReconcilePayment command', async () => {
  const targetInvoice: Invoice = {
    ...invoice,
    id: 'inv-payable',
    invoiceNumber: 'INV-PAYABLE-01',
    invoiceStatus: 'ISSUED',
    settlementStatus: 'UNPAID',
    netAmount: 3000000,
    paidAmount: 0,
    outstandingAmount: 3000000,
  };

  fetchMock.mockResolvedValueOnce(response(state({
    students: [studentA],
    billingPeriods: [period],
    invoices: [targetInvoice],
  })));
  fetchMock.mockResolvedValueOnce(response({
    success: true,
    payment: {
      id: 'pay-new',
      tenantId: 'synthetic-tenant',
      payerPartyId: 'guardian-1',
      studentPartyId: studentA.studentPartyId,
      paymentNumber: 'PAY-0099',
      paymentMethod: 'BANK_TRANSFER',
      amount: 3000000,
      allocatedAmount: 3000000,
      unallocatedAmount: 0,
      paymentDate: '2027-01-12',
      status: 'RECONCILED',
      createdBy: 'staff-1',
    },
    receipt: {
      id: 'rcpt-1',
      tenantId: 'synthetic-tenant',
      paymentId: 'pay-new',
      invoiceId: 'inv-payable',
      receiptNumber: 'RCPT-0099',
      settlementSnapshot: {},
      sha256Fingerprint: 'mock-hash',
      issuedAt: '2027-01-12',
    },
  }));
  fetchMock.mockResolvedValueOnce(response(state({
    students: [studentA],
    billingPeriods: [period],
    invoices: [{ ...targetInvoice, settlementStatus: 'PAID', paidAmount: 3000000, outstandingAmount: 0 }],
  })));

  await renderFinance();
  await screen.findByText('INV-PAYABLE-01');

  // Click on the Thu tiền / Ghi nhận thanh toán button in row or header
  fireEvent.click(screen.getByTitle('Thu tiền cho hóa đơn này'));
  const modal = screen.getByRole('dialog');
  expect(within(modal).getByText('Thu học phí / khôi phục khoản thu')).toBeInTheDocument();
  expect(screen.getByDisplayValue('3000000')).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole('combobox', { name: 'Phương thức thanh toán' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'Chuyển khoản' }));

  // Submit payment
  fireEvent.click(within(modal).getByTestId('finance-confirm-payment'));
  await waitFor(() => expect(postCalls()).toHaveLength(1));
  const command = JSON.parse(String(postCalls()[0][1]?.body));
  expect(command).toEqual({
    action: 'recordAndReconcilePayment',
    branchId: branch.id,
    invoiceId: 'inv-payable',
    operationKey: expect.any(String),
    paymentAmount: 3000000,
    paymentMethod: 'BANK_TRANSFER',
  });
  const saved = localStorage.getItem(['preschool-finance-payment-v1', 'synthetic-actor', 'synthetic-tenant', branch.id, 'inv-payable'].join(':'));
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved!)).toMatchObject({ operationKey: command.operationKey, paymentAmount: command.paymentAmount, invoiceId: command.invoiceId });
});

it('resolves finance exception via modal', async () => {
  const mockException = {
    id: 'exc-77',
    exception_type: 'GUARDIAN_CONTACT_MISSING',
    status: 'PENDING',
    description: 'Chưa có thông tin phụ huynh để gửi hóa đơn',
  };

  fetchMock.mockResolvedValueOnce(response(state({
    exceptions: [mockException],
  })));
  fetchMock.mockResolvedValueOnce(response({
    success: true,
    exception: { id: 'exc-77', status: 'RESOLVED' },
  }));
  fetchMock.mockResolvedValueOnce(response(state({
    exceptions: [{ ...mockException, status: 'RESOLVED' }],
  })));

  await renderFinance();
  // Go to Reconciliation tab
  fireEvent.click(await screen.findByRole('button', { name: /Đối soát/ }));
  expect(await screen.findByText('GUARDIAN_CONTACT_MISSING')).toBeInTheDocument();

  // Click Xử lý
  fireEvent.click(screen.getByRole('button', { name: 'Xử lý' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/Xử Lý Ngoại Lệ Tài Chính/)).toBeInTheDocument();

  // Fill resolution notes and confirm
  fireEvent.change(within(dialog).getByPlaceholderText('Nhập nội dung xử lý ngoại lệ...'), {
    target: { value: 'Đã cập nhật số điện thoại mẹ và gửi lại thông báo.' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận giải quyết' }));

  await waitFor(() => expect(postCalls()).toHaveLength(1));
  expect(JSON.parse(String(postCalls()[0][1]?.body))).toEqual({
    action: 'resolveException',
    branchId: branch.id,
    exceptionId: 'exc-77',
    resolutionNotes: 'Đã cập nhật số điện thoại mẹ và gửi lại thông báo.',
  });
});
