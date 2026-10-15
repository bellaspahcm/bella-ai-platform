import { createAllocatedBooking } from '../AutoMoveBookingAllocationService';

const actor = 'bcf037b2-76a3-4a2e-9bfd-cd0f6920e050';
const key = '00000000-0000-4000-8000-000000000002';
const payload = { customerPhone: '0900000000', customerName: 'Customer',
  variantId: '12bd8cba-5c9d-4a46-b126-7c53adf5552b', vehicleId: '2b652d51-cc63-4a2b-a87e-8a5d12e58aeb',
  colorExterior: 'White', totalPrice: 1500000000, depositAmount: 100000000 };
const db = { query: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); db.query.mockResolvedValue({ rows: [] }); });
it.each([
  { ...payload, tenantId: key }, { ...payload, role: 'admin' }, { ...payload, totalPrice: Infinity },
  { ...payload, totalPrice: 0 }, { ...payload, depositAmount: -1 }, { ...payload, depositAmount: 1500000001 },
  { ...payload, depositPaid: 1500000001 }, { ...payload, vehicleId: 'invalid' },
])('rejects client authority, invalid identifiers and invalid amounts without writes', async value => {
  await expect(createAllocatedBooking(db, actor, value, key)).rejects.toMatchObject({ code: 'INVALID_BOOKING', httpStatus: 400 });
  expect(db.query).not.toHaveBeenCalled();
});
it('validates the retry key before database work', async () => {
  await expect(createAllocatedBooking(db, actor, payload, 'invalid')).rejects.toMatchObject({ code: 'INVALID_BOOKING' });
  expect(db.query).not.toHaveBeenCalled();
});
it('requires active canonical profile and tenant before locks or persistence', async () => {
  await expect(createAllocatedBooking(db, actor, payload, key)).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED', httpStatus: 403 });
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("u.status='active' and t.status='active'"), [actor]);
});
