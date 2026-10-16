/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VehicleSaleSettlement } from '../VehicleSaleSettlement';

jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
const booking = '6090d1e8-b144-4a51-9464-fd83c95959e0', receipt = '96d14c7c-6023-4572-b0fb-9e959f55e066';
const tenant = 'd4f7567f-787f-46e9-86d8-206c00457b43', key = '00000000-0000-4000-8000-000000000007';
const storageKey = `automove-settlement:${booking}`;
const document = { bucket: 'automove-sale-documents', path: `${tenant}/proof.pdf`, sha256: 'a'.repeat(64) };
const intent = { action: 'refund', receiptType: 'deposit', receiptId: receipt, amount: 20, reason: 'Confirmed cash refund', document, confirmed: true };
const initial = { bookingId: booking, bookingStatus: 'confirmed', vehicleStatus: 'allocated', recognitionId: null,
  grossReceived: 100, refunded: 0, netReceived: 100, canCancel: true, issues: [],
  receipts: [{ id: receipt, type: 'deposit', amount: 100, refunded: 0, refundable: 100 }], actions: [] };
const fetchMock = jest.fn(), originalFetch = global.fetch;
const changed = jest.fn(), closed = jest.fn();
const response = (value: unknown, ok = true, status = 200) => ({ ok, status, json: async () => value });
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); global.fetch = fetchMock;
  fetchMock.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({}, false, 500) : response({ result: initial }));
});
afterAll(() => { global.fetch = originalFetch; });
function mount() { return render(<VehicleSaleSettlement bookingId={booking} tenantId={tenant} onChanged={changed} onClosed={closed} />); }
it('reads real persisted state and distinguishes load failure from zero cash', async () => {
  fetchMock.mockResolvedValueOnce(response({}, false, 403));
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Không xác minh');
  expect(screen.queryByTestId('refund-net')).not.toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
});
it('retains the exact pending intent through network failure and reconciles a duplicate acknowledgement', async () => {
  sessionStorage.setItem(storageKey, JSON.stringify({ key, data: intent }));
  fetchMock.mockImplementation(async (_url, options) => {
    if (!options?.method) return response({ result: initial });
    if (fetchMock.mock.calls.filter(call => call[1]?.method === 'POST').length === 1) throw new Error('Lost response');
    return response({ result: { duplicate: true,
      action: { id: key, action: 'refund', amount: 20, receiptType: 'deposit', receiptId: receipt, reason: intent.reason, document, createdBy: receipt, createdAt: '2026-10-15T00:00:00Z' },
      state: { ...initial, refunded: 20, netReceived: 80, actions: [] } } });
  });
  mount();
  const retry = await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu hoàn/hủy' });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry);
  expect(await screen.findByRole('alert')).toHaveTextContent('Lost response');
  expect(JSON.parse(sessionStorage.getItem(storageKey) || '{}')).toEqual({ key, data: intent });
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId('refund-net')).toHaveTextContent('80 VND'));
  const posts = fetchMock.mock.calls.filter(call => call[1]?.method === 'POST');
  expect(posts).toHaveLength(2); expect(posts[0][1]).toEqual(posts[1][1]);
  expect(posts[0][1].headers['Idempotency-Key']).toBe(key);
  expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(changed).toHaveBeenCalledTimes(1);
});
it('does not turn a malformed success response into an acknowledged financial action', async () => {
  sessionStorage.setItem(storageKey, JSON.stringify({ key, data: intent }));
  fetchMock.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ result: {} }) : response({ result: initial }));
  mount(); const button = await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu hoàn/hủy' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await screen.findByRole('alert'); expect(sessionStorage.getItem(storageKey)).not.toBeNull(); expect(changed).not.toHaveBeenCalled();
});
it('restores a pending cancellation as cancellation, without creating a refund intent', async () => {
  const cancel = { action: 'cancel', reason: intent.reason, document, confirmed: true };
  sessionStorage.setItem(storageKey, JSON.stringify({ key, data: cancel }));
  mount(); await screen.findByTestId('refund-net');
  expect(screen.getByRole('radio', { name: 'Hủy giao dịch' })).toBeChecked();
  expect(screen.queryByLabelText('Số tiền hoàn (VND)')).not.toBeInTheDocument();
});
