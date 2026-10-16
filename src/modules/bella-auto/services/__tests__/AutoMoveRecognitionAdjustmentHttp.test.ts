import { recognitionAdjustmentHttp } from '../AutoMoveRecognitionAdjustmentHttp';
import { AutoMoveRecognitionAdjustmentService, RecognitionAdjustmentError } from '../AutoMoveRecognitionAdjustmentService';
import { AccountingPeriodGuardError } from '@/core/services/accounting/period-guards';

jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
const mockDb = { connect: jest.fn(), query: jest.fn(), end: jest.fn(), on: jest.fn() };
const mockClient = { auth: { getUser: jest.fn() } };
const execute = jest.spyOn(AutoMoveRecognitionAdjustmentService.prototype, 'execute');
const state = jest.spyOn(AutoMoveRecognitionAdjustmentService.prototype, 'state');
const id = '6090d1e8-b144-4a51-9464-fd83c95959e0';
const saved = { DB_URL: process.env.DB_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
const request = (body = '{}', key = id) => new Request('http://localhost/adjustment', { method: 'POST', body,
  headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) } });
beforeEach(() => {
  jest.clearAllMocks(); process.env.DB_URL = 'unit-only'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  mockClient.auth.getUser.mockResolvedValue({ data: { user: { id } }, error: null }); mockDb.query.mockResolvedValue({ rows: [] });
  execute.mockResolvedValue({ duplicate: false, entry: {} as Awaited<ReturnType<AutoMoveRecognitionAdjustmentService['execute']>>['entry'], state: {} as Awaited<ReturnType<AutoMoveRecognitionAdjustmentService['state']>> });
});
afterAll(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
it('requires real Auth, valid key and JSON before SQL', async () => {
  mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await recognitionAdjustmentHttp(request(), id)).status).toBe(401);
  expect((await recognitionAdjustmentHttp(request('{}', ''), id)).status).toBe(400);
  expect((await recognitionAdjustmentHttp(request('{'), id)).status).toBe(400); expect(mockDb.connect).not.toHaveBeenCalled();
});
it('uses one serializable authenticated transaction and commits before success', async () => {
  const response = await recognitionAdjustmentHttp(request(), id); expect(response.status).toBe(200);
  expect(mockDb.query).toHaveBeenCalledWith('begin isolation level serializable');
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('request.jwt.claim.sub'), [id]);
  expect(mockDb.query).toHaveBeenCalledWith('commit'); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it.each(['40001', '40P01', '55P03', '23505'])('rolls back retryable %s without masking its contract', async code => {
  execute.mockRejectedValueOnce({ code });
  const response = await recognitionAdjustmentHttp(request(), id);
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'ADJUSTMENT_RETRY_REQUIRED' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('preserves period and current-authority rejection, never reports zero or success', async () => {
  execute.mockRejectedValueOnce(new AccountingPeriodGuardError('ACCOUNTING_PERIOD_NOT_OPEN'));
  expect((await recognitionAdjustmentHttp(request(), id)).status).toBe(409);
  execute.mockRejectedValueOnce(new RecognitionAdjustmentError('ADJUSTMENT_FORBIDDEN', 403));
  expect((await recognitionAdjustmentHttp(request(), id)).status).toBe(403);
  state.mockRejectedValueOnce({ code: '42501' });
  expect((await recognitionAdjustmentHttp(new Request('http://localhost/adjustment'), id)).status).toBe(403);
});
it('never acknowledges a failed commit', async () => {
  mockDb.query.mockImplementationOnce(async () => ({ rows: [] }));
  mockDb.query.mockImplementation(async (sql: string) => { if (sql === 'commit') throw Error('Private connection detail'); return { rows: [] }; });
  const response = await recognitionAdjustmentHttp(request(), id); expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private');
  expect(mockDb.query).toHaveBeenCalledWith('rollback');
});
it('rolls back an asynchronous connection failure before commit', async () => {
  let disconnected: ((error: Error) => void) | undefined;
  mockDb.on.mockImplementationOnce((_event: string, listener: (error: Error) => void) => { disconnected = listener; });
  execute.mockImplementationOnce(async () => {
    disconnected?.(Error('Private idle connection failure'));
    return { duplicate: false, entry: {} as Awaited<ReturnType<AutoMoveRecognitionAdjustmentService['execute']>>['entry'], state: {} as Awaited<ReturnType<AutoMoveRecognitionAdjustmentService['state']>> };
  });
  const response = await recognitionAdjustmentHttp(request(), id);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private');
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
