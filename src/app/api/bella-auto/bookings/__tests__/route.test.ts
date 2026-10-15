import { POST } from '../route';
import { bookingAllocationHttp } from '@/modules/bella-auto/services/AutoMoveBookingAllocationHttp';

jest.mock('@/lib/supabase-server', () => ({ createServerClient: () => mockClient }));
jest.mock('@/modules/bella-auto/services/AutoMoveBookingAllocationHttp', () => ({ bookingAllocationHttp: jest.fn() }));
const getUser = jest.fn();
const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn() };
const bookings = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), like: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), limit: jest.fn(), insert: jest.fn().mockReturnThis(), single: jest.fn() };
const mockClient = { auth: { getUser }, from: jest.fn((table: string) => table === 'users' ? profile : bookings) };
const allocated = jest.mocked(bookingAllocationHttp);
const body = { customerId: 'customer-1', customerName: 'Existing customer', customerPhone: '0900000000',
  variantId: 'variant-1', vehicleId: 'vehicle-1', colorExterior: 'White', totalPrice: 1500000000, depositAmount: 100000000 };
const request = (payload: unknown = body) => new Request('http://localhost/api/bella-auto/bookings', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'stable-key' }, body: JSON.stringify(payload),
});
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'verified-auth-actor' } }, error: null });
  profile.single.mockResolvedValue({ data: { tenant_id: 'server-profile-tenant' }, error: null });
  bookings.limit.mockResolvedValue({ data: [] });
  bookings.single.mockResolvedValue({ data: { id: 'unallocated-booking', booking_number: 'BA-20261015-0001' }, error: null });
  allocated.mockResolvedValue(Response.json({ success: true, booking: { id: 'allocated-booking' } }));
});
it('delegates VIN booking with verified actor to the transactional public-contract path', async () => {
  const req = request();
  expect((await POST(req)).status).toBe(200);
  expect(allocated).toHaveBeenCalledWith(req, 'verified-auth-actor', body);
  expect(mockClient.from).not.toHaveBeenCalledWith('auto_vehicles');
  expect(bookings.insert).not.toHaveBeenCalled();
});
it('retains the existing no-VIN booking path and response', async () => {
  const { vehicleId, ...withoutVin } = body;
  expect(vehicleId).toBe('vehicle-1');
  const response = await POST(request(withoutVin));
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, booking: { id: 'unallocated-booking' } });
  expect(allocated).not.toHaveBeenCalled();
  expect(bookings.insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'server-profile-tenant', vehicle_id: null, status: 'pending_deposit',
    total_price: body.totalPrice, metadata: { createdByUserId: 'verified-auth-actor' } }));
});
it('rejects missing Auth before delegating or writing', async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401); expect(allocated).not.toHaveBeenCalled(); expect(mockClient.from).not.toHaveBeenCalled();
});
it('rejects missing tenant before delegation', async () => {
  profile.single.mockResolvedValueOnce({ data: null, error: null });
  expect((await POST(request())).status).toBe(403); expect(allocated).not.toHaveBeenCalled();
});
it('retains price validation before delegation', async () => {
  expect((await POST(request({ ...body, totalPrice: 0 }))).status).toBe(400); expect(allocated).not.toHaveBeenCalled();
});
it('does not convert allocation rejection into booking success', async () => {
  allocated.mockResolvedValueOnce(Response.json({ code: 'DUPLICATE_VIN' }, { status: 409 }));
  const response = await POST(request());
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ code: 'DUPLICATE_VIN' });
  expect(bookings.insert).not.toHaveBeenCalled();
});
