/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VehicleSalePayments } from '../VehicleSalePayments';

const booking = '6090d1e8-b144-4a51-9464-fd83c95959e0', key = '00000000-0000-4000-8000-000000000007';
const state = { bookingId: booking, recognitionId: key, status: 'MATCHED', issues: [], saleAmount: 1400000000,
  depositReceived: 100000000, postSaleReceived: 0, totalReceived: 100000000, refundedTotal: 0, outstanding: 1300000000, canCollect: true, receipts: [] };
const fetchMock = jest.fn();
beforeEach(() => {
  sessionStorage.clear(); jest.clearAllMocks(); global.fetch = fetchMock;
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => key });
});
const response = (result: unknown, ok = true, status = 200) => ({ ok, status, json: async () => result });
it('does not turn a load failure into a zero balance or a collection form', async () => {
  fetchMock.mockResolvedValueOnce(response({}, false, 500)); render(<VehicleSalePayments bookingId={booking} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không xác minh');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});
it('shows mismatch and does not allow a new collection', async () => {
  fetchMock.mockResolvedValueOnce(response({ result: { ...state, status: 'MISMATCH', issues: ['DEPOSIT_RECEIPT_MISMATCH'], canCollect: false } }));
  render(<VehicleSalePayments bookingId={booking} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('DEPOSIT_RECEIPT_MISMATCH');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});
it('retains the same intent across uncertain failures and remount instead of silently duplicating cash', async () => {
  fetchMock.mockResolvedValueOnce(response({ result: state })).mockRejectedValueOnce(new Error('Network lost'));
  const view = render(<VehicleSalePayments bookingId={booking} />);
  fireEvent.change(await screen.findByLabelText('Số tiền sau bán (VND)'), { target: { value: '300000000' } });
  fireEvent.submit(screen.getByRole('form'));
  await screen.findByRole('alert'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  const saved = JSON.parse(sessionStorage.getItem(`automove-sale-payment:${booking}`) || '{}');
  expect(saved).toMatchObject({ key, data: { amount: 300000000 } });
  view.unmount();
  fetchMock.mockResolvedValueOnce(response({ result: state })).mockResolvedValueOnce(response({ result: { duplicate: true,
    receipt: { id: key, idempotencyKey: key, amount: 300000000, paymentMethod: 'cash', transactionRef: null, notes: null, receivedBy: key, receivedAt: '2026-10-15T00:00:00Z' },
    state: { ...state, postSaleReceived: 300000000, totalReceived: 400000000, outstanding: 1000000000 } } }));
  render(<VehicleSalePayments bookingId={booking} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu thu' }));
  expect(await screen.findByRole('status')).toHaveTextContent('receipt có sẵn');
  const calls = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(calls[0][1].headers['Idempotency-Key']).toBe(calls[1][1].headers['Idempotency-Key']);
  expect(calls[0][1].body).toBe(calls[1][1].body);
  await waitFor(() => expect(sessionStorage.getItem(`automove-sale-payment:${booking}`)).toBeNull());
});
