import { bookingAllocationHttp } from '../AutoMoveBookingAllocationHttp';
import { BookingAllocationError, createAllocatedBooking } from '../AutoMoveBookingAllocationService';

jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
jest.mock('../AutoMoveBookingAllocationService', () => ({
  ...jest.requireActual('../AutoMoveBookingAllocationService'), createAllocatedBooking: jest.fn(),
}));
const mockDb = { connect: jest.fn(), query: jest.fn(), end: jest.fn() };
const command = jest.mocked(createAllocatedBooking);
const originalEnv = { DB_URL: process.env.DB_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
const request = () => new Request('http://localhost/api/bella-auto/bookings', { method: 'POST', headers: { 'Idempotency-Key': '8ef93ef9-8a29-4a6e-94e0-f2d730249f31' } });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DB_URL = 'non-secret-test-configuration'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  mockDb.connect.mockResolvedValue(undefined); mockDb.query.mockResolvedValue({ rows: [] }); mockDb.end.mockResolvedValue(undefined);
  command.mockResolvedValue({ booking: { id: 'booking-1', booking_number: 'BA-20261015-0001' }, isDuplicate: false });
});
afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
it('commits only after the Product command and uses authenticated RLS with the verified actor', async () => {
  const payload = { vehicleId: 'vehicle-1' };
  const response = await bookingAllocationHttp(request(), 'auth-actor', payload);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, isDuplicate: false, booking: { id: 'booking-1' } });
  expect(mockDb.query).toHaveBeenCalledWith('begin isolation level serializable');
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining("request.jwt.claim.sub"), ['auth-actor']);
  expect(command).toHaveBeenCalledWith(mockDb, 'auth-actor', payload, request().headers.get('Idempotency-Key'));
  expect(mockDb.query).toHaveBeenCalledWith('commit');
  expect(mockDb.query.mock.invocationCallOrder.at(-1)).toBeGreaterThan(command.mock.invocationCallOrder[0]);
  expect(mockDb.end).toHaveBeenCalledTimes(1);
});
it('returns persisted retries without changing the response contract', async () => {
  command.mockResolvedValueOnce({ booking: { id: 'booking-1', booking_number: 'BA-20261015-0001' }, isDuplicate: true });
  expect(await (await bookingAllocationHttp(request(), 'auth-actor', {})).json()).toMatchObject({ success: true, isDuplicate: true });
});
it('rolls back allocation failures instead of returning booking success', async () => {
  command.mockRejectedValueOnce(new BookingAllocationError('DUPLICATE_VIN', 'Vehicle already allocated.'));
  const response = await bookingAllocationHttp(request(), 'auth-actor', {});
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'DUPLICATE_VIN' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit'); expect(mockDb.end).toHaveBeenCalledTimes(1);
});
it.each(['40001', '40P01'])('keeps %s contention fail-closed and requires the same retry key', async code => {
  command.mockRejectedValueOnce({ code });
  const response = await bookingAllocationHttp(request(), 'auth-actor', {});
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'BOOKING_RETRY_REQUIRED' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('does not label a persistent unique-data conflict as transient contention', async () => {
  command.mockRejectedValueOnce({ code: '23505' });
  const response = await bookingAllocationHttp(request(), 'auth-actor', {});
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'BOOKING_CONFLICT' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('does not expose arbitrary database errors', async () => {
  command.mockRejectedValueOnce(new Error('Private connection detail'));
  const response = await bookingAllocationHttp(request(), 'auth-actor', {});
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private connection detail');
});
