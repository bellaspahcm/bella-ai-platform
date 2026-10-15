import { depositConfirmationHttp } from '../AutoMoveDepositConfirmationHttp';
import { confirmBookingDeposit, DepositConfirmationError } from '../AutoMoveDepositConfirmationService';

jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
jest.mock('../AutoMoveDepositConfirmationService', () => ({ ...jest.requireActual('../AutoMoveDepositConfirmationService'), confirmBookingDeposit: jest.fn() }));
const mockDb = { connect: jest.fn(), query: jest.fn(), end: jest.fn() };
const command = jest.mocked(confirmBookingDeposit);
const env = { DB_URL: process.env.DB_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
const key = '00000000-0000-4000-8000-000000000007';
const request = (includeKey = true, body = '{"amount":30000000}') => new Request('http://localhost/confirm-deposit', { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(includeKey ? { 'Idempotency-Key': key } : {}) }, body });
beforeEach(() => {
  jest.clearAllMocks(); process.env.DB_URL = 'non-secret-unit-configuration'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  mockDb.connect.mockResolvedValue(undefined); mockDb.query.mockResolvedValue({ rows: [] }); mockDb.end.mockResolvedValue(undefined);
  command.mockResolvedValue({ isDuplicate: false, data: { deposit_id: key, new_deposit_paid: 30000000, payment_status: 'partially_paid', remaining: 70000000 } });
});
afterAll(() => { for (const [name, value] of Object.entries(env)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
it('commits the command in an authenticated transaction and preserves response fields', async () => {
  const response = await depositConfirmationHttp(request(), 'verified-actor', 'booking-1');
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, isDuplicate: false, data: { deposit_id: key, new_deposit_paid: 30000000 } });
  expect(mockDb.query).toHaveBeenCalledWith('begin isolation level read committed');
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('request.jwt.claim.sub'), ['verified-actor']);
  expect(command).toHaveBeenCalledWith(mockDb, 'verified-actor', 'booking-1', key, { amount: 30000000 });
  expect(mockDb.query).toHaveBeenCalledWith('commit'); expect(mockDb.end).toHaveBeenCalledTimes(1);
});
it('rejects a missing key before connecting rather than minting one for every retry', async () => {
  const response = await depositConfirmationHttp(request(false), 'verified-actor', 'booking-1');
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: 'DEPOSIT_KEY_REQUIRED' });
  expect(mockDb.connect).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
});
it('does not claim success if a write fails; both mutations are rolled back', async () => {
  command.mockRejectedValueOnce(new Error('Private database detail'));
  const response = await depositConfirmationHttp(request(), 'verified-actor', 'booking-1');
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private database detail');
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit'); expect(mockDb.end).toHaveBeenCalledTimes(1);
});
it('returns receipt replay instead of applying the amount again', async () => {
  command.mockResolvedValueOnce({ isDuplicate: true, data: { deposit_id: key, new_deposit_paid: 30000000, payment_status: 'partially_paid', remaining: 70000000 } });
  expect(await (await depositConfirmationHttp(request(), 'verified-actor', 'booking-1')).json()).toMatchObject({ isDuplicate: true });
});
it.each(['40001', '40P01', '55P03'])('rolls back %s and instructs retry with the same key', async code => {
  command.mockRejectedValueOnce({ code });
  const response = await depositConfirmationHttp(request(), 'verified-actor', 'booking-1');
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'DEPOSIT_RETRY_REQUIRED' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('handles hidden-tenant PK conflicts without leaking another receipt', async () => {
  command.mockRejectedValueOnce({ code: '23505' });
  const response = await depositConfirmationHttp(request(), 'verified-actor', 'booking-1');
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'DEPOSIT_IDEMPOTENCY_CONFLICT' });
});
it('returns business denial without a commit', async () => {
  command.mockRejectedValueOnce(new DepositConfirmationError('BOOKING_NOT_FOUND', 'Unavailable', 404));
  expect((await depositConfirmationHttp(request(), 'verified-actor', 'booking-1')).status).toBe(404);
  expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('reports the combined collection cap without committing a new deposit', async () => {
  command.mockRejectedValueOnce({ code: '23514', constraint: 'automove_combined_collection_cap' });
  const response = await depositConfirmationHttp(request(), 'verified-actor', 'booking-1');
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'DEPOSIT_EXCEEDS_SALE_BALANCE' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback');
  expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('rejects invalid JSON without opening a connection', async () => {
  expect((await depositConfirmationHttp(request(true, '{'), 'verified-actor', 'booking-1')).status).toBe(400);
  expect(mockDb.connect).not.toHaveBeenCalled();
});
