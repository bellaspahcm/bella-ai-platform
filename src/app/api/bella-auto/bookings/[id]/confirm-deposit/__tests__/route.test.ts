import { POST } from '../route';
import { depositConfirmationHttp } from '@/modules/bella-auto/services/AutoMoveDepositConfirmationHttp';

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/modules/bella-auto/services/AutoMoveDepositConfirmationHttp', () => ({ depositConfirmationHttp: jest.fn() }));
const getUser = jest.fn();
const mockClient = { auth: { getUser }, from: jest.fn() };
const confirm = jest.mocked(depositConfirmationHttp);
const bookingId = '1cc85369-4357-4272-a1d1-8d3f83c75d56';
const request = (amount = 100000000) => new Request(`http://localhost/api/bella-auto/bookings/${bookingId}/confirm-deposit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'dd185ca1-1c84-467d-840a-3591f73f5178' }, body: JSON.stringify({ amount, payment_method: 'cash', notes: 'Route regression' }),
});
const context = () => ({ params: Promise.resolve({ id: bookingId }) });
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'verified-actor' } }, error: null });
  confirm.mockResolvedValue(Response.json({ success: true, data: { deposit_id: 'deposit-1', new_deposit_paid: 100000000, payment_status: 'fully_paid', remaining: 0 } }));
});
it('awaits Promise params and delegates with exact booking ID and verified Auth identity', async () => {
  const req = request();
  const response = await POST(req, context());
  expect(response.status).toBe(200);
  expect(confirm).toHaveBeenCalledWith(req, 'verified-actor', bookingId);
  expect(await response.json()).toMatchObject({ success: true, data: { deposit_id: 'deposit-1', new_deposit_paid: 100000000, payment_status: 'fully_paid', remaining: 0 } });
  expect(mockClient.from).not.toHaveBeenCalled();
});
it('rejects missing Auth before booking reads or writes', async () => {
  getUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await POST(request(), context())).status).toBe(401);
  expect(mockClient.from).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
it('preserves not-found handling from the transaction boundary', async () => {
  confirm.mockResolvedValueOnce(Response.json({ code: 'BOOKING_NOT_FOUND' }, { status: 404 }));
  expect((await POST(request(), context())).status).toBe(404);
});
it('rejects Auth errors even when an unreliable user object is present', async () => {
  getUser.mockResolvedValueOnce({ data: { user: { id: 'verified-actor' } }, error: new Error('Invalid session') });
  expect((await POST(request(), context())).status).toBe(401); expect(confirm).not.toHaveBeenCalled();
});
