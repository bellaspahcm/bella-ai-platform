import { settlementHttp } from '../AutoMoveSettlementHttp';
import { AutoMoveSettlementService, SettlementError } from '../AutoMoveSettlementService';

jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
const mockDb = { connect: jest.fn(), query: jest.fn(), end: jest.fn(), on: jest.fn() };
const mockClient = { auth: { getUser: jest.fn() } };
const execute = jest.spyOn(AutoMoveSettlementService.prototype, 'execute');
const state = jest.spyOn(AutoMoveSettlementService.prototype, 'state');
const booking = '6090d1e8-b144-4a51-9464-fd83c95959e0', actor = '96d14c7c-6023-4572-b0fb-9e959f55e066';
const original = { DB_URL: process.env.DB_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
const request = (body = '{}', key = actor) => new Request('http://localhost/settlement', { method: 'POST', body,
  headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) } });
beforeEach(() => {
  jest.clearAllMocks(); process.env.DB_URL = 'unit-only'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mockDb.query.mockResolvedValue({ rows: [] });
  execute.mockResolvedValue({ duplicate: false, action: {} as Awaited<ReturnType<AutoMoveSettlementService['execute']>>['action'], state: {} as Awaited<ReturnType<AutoMoveSettlementService['state']>> });
});
afterAll(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
it('authenticates and validates key/JSON before opening SQL', async () => {
  mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await settlementHttp(request(), booking)).status).toBe(401);
  expect((await settlementHttp(request('{}', ''), booking)).status).toBe(400);
  expect((await settlementHttp(request('{'), booking)).status).toBe(400);
  expect(mockDb.connect).not.toHaveBeenCalled();
});
it('binds authenticated SQL and commits before reporting success', async () => {
  const response = await settlementHttp(request(), booking);
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mockDb.query).toHaveBeenCalledWith('begin isolation level serializable');
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('request.jwt.claim.sub'), [actor]);
  expect(execute).toHaveBeenCalledWith(booking, actor, {});
  expect(mockDb.query).toHaveBeenCalledWith('commit');
});
it('never reports success after commit failure', async () => {
  mockDb.query.mockImplementation(async (sql: string) => { if (sql === 'commit') throw new Error('Private database details'); return { rows: [] }; });
  const response = await settlementHttp(request(), booking);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private database');
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.end).toHaveBeenCalled();
});
it('handles an idle connection error without committing or replaying the command', async () => {
  const result=await execute.getMockImplementation()?.(booking,actor,{});
  if(!result)throw Error('Fixture result missing');
  execute.mockImplementationOnce(async()=>{
    const listener=mockDb.on.mock.calls.find(call=>call[0]==='error')?.[1];
    if(typeof listener!=='function')throw Error('Connection error listener missing');
    listener(new Error('Connection lost'));return result;
  });
  expect((await settlementHttp(request(),booking)).status).toBe(500);
  expect(mockDb.query).not.toHaveBeenCalledWith('commit');
  expect(mockDb.query).toHaveBeenCalledWith('rollback');
  expect(execute).toHaveBeenCalledTimes(1);
});
it.each(['40001', '40P01', '55P03', '23505'])('preserves retry semantics and rolls back %s', async code => {
  execute.mockRejectedValueOnce({ code });
  const response = await settlementHttp(request(), booking);
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'SETTLEMENT_RETRY_REQUIRED' });
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
it('preserves current authority denial and read errors rather than showing zero', async () => {
  execute.mockRejectedValueOnce(new SettlementError('SETTLEMENT_FORBIDDEN', 'Unavailable', 403));
  expect((await settlementHttp(request(), booking)).status).toBe(403);
  state.mockRejectedValueOnce({ code: '42501' });
  expect((await settlementHttp(new Request('http://localhost/settlement'), booking)).status).toBe(403);
  expect(mockDb.query).not.toHaveBeenCalledWith('commit');
});
