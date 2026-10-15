import { salePaymentHttp } from '../AutoMoveSalePaymentHttp';
import { AutoMoveSalePaymentService, SalePaymentError } from '../AutoMoveSalePaymentService';

jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
const mockDb = { connect: jest.fn(), query: jest.fn(), end: jest.fn() };
const booking = '6090d1e8-b144-4a51-9464-fd83c95959e0', key = '00000000-0000-4000-8000-000000000007';
const mockClient = { auth: { getUser: jest.fn() } };
const collect = jest.spyOn(AutoMoveSalePaymentService.prototype, 'collect');
const state = jest.spyOn(AutoMoveSalePaymentService.prototype, 'state');
const original = { DB_URL: process.env.DB_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
const request = (body = '{}', withKey = true) => new Request('http://localhost/sale-payments', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(withKey ? { 'Idempotency-Key': key } : {}) }, body });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.DB_URL = 'unit-configuration'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: key } }, error: null });
  mockDb.query.mockResolvedValue({ rows: [] });
  collect.mockResolvedValue({ duplicate: false, receipt: { id: key, idempotencyKey: key, amount: 1, paymentMethod: 'cash',
    transactionRef: null, notes: null, receivedBy: key, receivedAt: '2026-10-15T00:00:00Z' },
  state: { bookingId: booking, recognitionId: key, status: 'MATCHED', issues: [], saleAmount: 1, depositReceived: 0,
    postSaleReceived: 1, totalReceived: 1, outstanding: 0, canCollect: false, receipts: [] } });
});
afterAll(() => { for (const [name, value] of Object.entries(original)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
it('authenticates before opening a DB transaction', async () => {
  mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await salePaymentHttp(request(), booking)).status).toBe(401);
  expect(mockDb.connect).not.toHaveBeenCalled();
});
it('requires the retry key and valid JSON before DB work', async () => {
  expect((await salePaymentHttp(request('{}', false), booking)).status).toBe(400);
  expect((await salePaymentHttp(request('{'), booking)).status).toBe(400);
  expect(mockDb.connect).not.toHaveBeenCalled();
});
it('uses authenticated SQL identity and returns success only after commit', async () => {
  const response = await salePaymentHttp(request(), booking);
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(collect).toHaveBeenCalledWith(booking, key, {});
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('request.jwt.claim.sub'), [key]);
  expect(mockDb.query).toHaveBeenCalledWith('commit');
});
it('never reports success on commit failure and hides database details', async () => {
  mockDb.query.mockImplementation(async sql => { if (sql === 'commit') throw new Error('private connection detail'); return { rows: [] }; });
  const response = await salePaymentHttp(request(), booking);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('private connection detail');
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.end).toHaveBeenCalled();
});
it.each(['23505', '40001', '40P01', '55P03'])('rolls back key/reference/transaction conflict %s', async code => {
  collect.mockRejectedValueOnce({ code });
  expect((await salePaymentHttp(request(), booking)).status).toBe(409);
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('preserves business rejection and performs GET through reconciliation', async () => {
  collect.mockRejectedValueOnce(new SalePaymentError('PAYMENT_FORBIDDEN', 'Unavailable', 403));
  expect((await salePaymentHttp(request(), booking)).status).toBe(403);
  state.mockResolvedValueOnce({ bookingId: booking, recognitionId: null, status: 'NOT_RECOGNIZED', issues: [], saleAmount: 0,
    depositReceived: 0, postSaleReceived: 0, totalReceived: 0, outstanding: 0, canCollect: false, receipts: [] });
  expect((await salePaymentHttp(new Request('http://localhost/sale-payments'), booking)).status).toBe(200);
  expect(state).toHaveBeenCalledWith(booking);
});
