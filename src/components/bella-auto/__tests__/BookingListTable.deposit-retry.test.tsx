/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BookingListTable } from '../BookingListTable';

jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({ from: () => mockQuery }) }));
jest.mock('@/platform/mobility/supabase-vehicle-contract', () => ({ listMobilityVehicleDisplayByIds: async () => [
  { vehicleId: 'vehicle-1', vin: 'MOCKVEHICLE0000001', colorExterior: 'White', modelName: 'Model' },
] }));
jest.mock('../VehicleSaleChainDialog', () => ({ VehicleSaleChainDialog: () => null }));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
const booking = { id: 'booking-1', booking_number: 'BA-20261015-0001', deposit_amount: 100000000, deposit_paid: 0,
  payment_status: 'unpaid', status: 'pending_deposit', created_at: '2026-10-15T00:00:00Z', vehicle_id: 'vehicle-1',
  customers: { name_mother: 'Test customer', phone: '0900000000' } };
const mockQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  then: (resolve: (result: { data: typeof booking[]; error: null }) => unknown) => Promise.resolve({ data: [booking], error: null }).then(resolve) };
const fetchMock = jest.fn();
const keyMock = jest.fn();
const originalFetch = global.fetch;
const originalUuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
const firstKey = '7c95573b-09cd-4a5b-889e-8b9f832705b2', nextKey = 'ff3365c8-35bc-4c5e-9ac7-df3f37bb995e';
let promptSpy: jest.SpyInstance, alertSpy: jest.SpyInstance, logSpy: jest.SpyInstance;
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, message: 'Confirmed' }) });
  keyMock.mockReset().mockReturnValueOnce(firstKey).mockReturnValue(nextKey);
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: keyMock });
  global.fetch = fetchMock;
  promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('30000000');
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { promptSpy.mockRestore(); alertSpy.mockRestore(); logSpy.mockRestore(); });
afterAll(() => {
  global.fetch = originalFetch;
  if (originalUuid) Object.defineProperty(crypto, 'randomUUID', originalUuid); else Reflect.deleteProperty(crypto, 'randomUUID');
});
async function submit(count: number) {
  const button = await screen.findByRole('button', { name: /Xác Nhận Cọc/ });
  fireEvent.click(button);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count));
  await waitFor(() => expect(screen.getByRole('button', { name: /Xác Nhận Cọc/ })).toBeEnabled());
}
it('retains the payment key after network failure and uses a fresh one for a later acknowledged payment', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Network failure'));
  render(<BookingListTable tenantId="tenant-1" />);
  await submit(1); await submit(2); await submit(3);
  const keys = fetchMock.mock.calls.map(call => call[1].headers['Idempotency-Key']);
  expect(keys).toEqual([firstKey, firstKey, nextKey]);
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
});
it('also retains the key when the server asks the caller to retry', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Retry with same key' }) });
  render(<BookingListTable tenantId="tenant-1" />);
  await submit(1); await submit(2);
  expect(fetchMock.mock.calls.map(call => call[1].headers['Idempotency-Key'])).toEqual([firstKey, firstKey]);
});
