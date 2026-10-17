/** @jest-environment jsdom */

import React from 'react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FinancePage, { type FinanceStateResponse, type FinanceCommandResponse, type FinanceStudentOption } from '../page';
import type { BillingPeriod, Invoice } from '@/products/bella-education/finance/domain/finance.types';

// UI contract only: synthetic HTTP DTOs prove display/request behavior, never DB/auth/RLS.
const studentA: FinanceStudentOption = { enrollmentId: 'enrollment-a', courseId: 'course-a', studentPartyId: 'party-a', studentId: 'student-a', studentCode: 'SYN-A', displayName: 'Synthetic Alpha' };
const studentB: FinanceStudentOption = { ...studentA, enrollmentId: 'enrollment-b', studentPartyId: 'party-b', studentId: 'student-b', studentCode: 'SYN-B', displayName: 'Synthetic Beta' };
const period: BillingPeriod = { id: 'period-2027', tenantId: 'synthetic-tenant', periodName: 'Synthetic term 2027', startDate: '2027-01-01', endDate: '2027-01-31', dueDate: '2027-01-15', status: 'ACTIVE', createdBy: 'synthetic-staff' };
const invoice: Invoice = { id: 'invoice-source', tenantId: 'synthetic-tenant', studentPartyId: studentA.studentPartyId, billingPeriodId: period.id, invoiceNumber: 'SYNTHETIC-VOID', invoiceStatus: 'VOID', settlementStatus: 'OVERPAID', grossAmount: 123456, discountAmount: 0, netAmount: 123456, paidAmount: 123457, outstandingAmount: -1, dueDate: period.dueDate, isArchived: false, createdBy: 'synthetic-staff' };

const state = (overrides: Partial<FinanceStateResponse> = {}): FinanceStateResponse => ({ success: true, students: [], billingPeriods: [], invoices: [], payments: [], exceptions: [], servicePeriodCompletions: [], ...overrides });
const response = (payload: FinanceStateResponse | FinanceCommandResponse, ok = true): Pick<Response, 'ok' | 'json'> => ({ ok, json: async () => payload });
const fetchMock = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>>();
const postCalls = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
});

it('shows pending and genuine empty states without reference invoice rows or synthetic-target commands', async () => {
  let resolveGet: ((value: Pick<Response, 'ok' | 'json'>) => void) | undefined;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveGet = resolve; }));
  render(<FinancePage />);
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  expect(within(screen.getByTestId('invoice-workspace')).queryByText('HD0001')).not.toBeInTheDocument();
  await act(async () => { resolveGet?.(response(state())); });
  const table = screen.getByTestId('invoice-workspace');
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
  render(<FinancePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('SYNTHETIC_LOAD_FAILURE');
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  const table = screen.getByTestId('invoice-workspace');
  expect(within(table).getByText('Chưa tải được danh sách hóa đơn.')).toBeInTheDocument();
  expect(within(table).queryByText('HD0001')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await within(table).findByText('SYNTHETIC-VOID')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(postCalls()).toHaveLength(0);
});

it('retains canonical VOID/OVERPAID, actual amount/period, exact counts and working filters', async () => {
  fetchMock.mockResolvedValue(response(state({ students: [studentA], billingPeriods: [period], invoices: [invoice, { ...invoice, id: 'draft-id', invoiceNumber: 'SYNTHETIC-DRAFT', invoiceStatus: 'DRAFT', settlementStatus: 'UNPAID' }] })));
  render(<FinancePage />);
  const table = screen.getByTestId('invoice-workspace');
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
  render(<FinancePage />);
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
  expect(postCalls()[0][1]?.body).toBe(JSON.stringify({ action: 'compileDraftInvoice', studentPartyId: 'party-b', billingPeriodId: 'period-2027' }));
  expect(await screen.findByText(/RETURNED-DRAFT \(987\.654 đ\)/)).toBeInTheDocument();
});

it.each(['student', 'period'] as const)('does not silently substitute a %s selection removed by refreshed GET', async (removed) => {
  fetchMock.mockResolvedValueOnce(response(state({ students: [studentA, studentB], billingPeriods: [period] })));
  fetchMock.mockResolvedValueOnce(response(state({ students: removed === 'student' ? [studentB] : [studentA, studentB], billingPeriods: removed === 'period' ? [{ ...period, id: 'different-period' }] : [period] })));
  render(<FinancePage />);
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
  render(<FinancePage />);
  await screen.findByText('SYNTHETIC-VOID');
  fireEvent.change(screen.getByLabelText(/Chọn học sinh/), { target: { value: studentA.studentPartyId } });
  fireEvent.change(screen.getByLabelText(/^Kỳ thu/), { target: { value: period.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('SYNTHETIC_OFFLINE');
  expect(screen.queryByText('SYNTHETIC-VOID')).not.toBeInTheDocument();
  expect(screen.getByTestId('btn-compile-invoice')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Xác nhận hoàn thành' })).toBeDisabled();
  expect(postCalls()).toHaveLength(0);
});

it('resets a removed invoice-period filter and retains filters for IDs without period metadata', async () => {
  const nextInvoice = { ...invoice, id: 'invoice-next', invoiceNumber: 'SYNTHETIC-NEXT', billingPeriodId: 'unlisted-period-b' };
  fetchMock.mockResolvedValueOnce(response(state({ billingPeriods: [period], invoices: [invoice] })));
  fetchMock.mockResolvedValueOnce(response(state({ invoices: [nextInvoice] })));
  fetchMock.mockResolvedValueOnce(response(state({ invoices: [nextInvoice] })));
  render(<FinancePage />);
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
