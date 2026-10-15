import { autoMoveManagementHttp } from '../AutoMoveManagementHttp';
import { AutoCustomerProvider } from '../AutoCustomerProvider';
import { MobilityFoundationService, PostgresMobilityRepository } from '@/platform/mobility';

jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockCurrentUser() }));
jest.mock('pg', () => ({ Client: jest.fn(() => mockDb) }));
jest.mock('../AutoMoveSaleChainConnection', () => ({ saleChainConnection: jest.fn(() => ({})) }));
const actor = 'db711ae2-ad69-4797-9dd9-455d4e793232', tenant = 'e3c5da78-ddf3-4d59-8f14-ffb785d650ac';
const customerId = '31ef4c9c-d336-4da5-b249-9093bb651fe7', variantId = '7c4fb62f-55dd-4a05-9d04-276b98aa100d';
const intentId = 'a9001527-7aa8-46a8-90d4-bfc9023b9754';
const mockCurrentUser = jest.fn(), mockMaybeSingle = jest.fn(), mockGetUser = jest.fn();
const builder = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: mockMaybeSingle };
const mockClient = { auth: { getUser: mockGetUser }, from: jest.fn(() => builder) };
const mockDb = { connect: jest.fn(), end: jest.fn(), query: jest.fn() };
const list = jest.spyOn(AutoCustomerProvider, 'listCustomers');
const get = jest.spyOn(AutoCustomerProvider, 'getProfile');
const save = jest.spyOn(AutoCustomerProvider, 'upsertProfile');
const register = jest.spyOn(MobilityFoundationService.prototype, 'registerVehicle');
const readVehicle = jest.spyOn(PostgresMobilityRepository.prototype, 'getVehicle');
const values = { preferredBrands: ['BMW'], preferredSegments: [], budgetRange: null, purchasingPurpose: 'Family' };
const vehicle = { id: intentId, tenantId: tenant, variantId, vin: '1HGCM82633A004352', colorExterior: 'White', modelYear: 2026,
  listPrice: 1000, costPrice: 0, status: 'in_transit' as const, metadata: {}, createdAt: '2026-10-15', updatedAt: '2026-10-15' };
const input = { variantId, vin: vehicle.vin, colorExterior: vehicle.colorExterior, modelYear: vehicle.modelYear, listPrice: vehicle.listPrice };
const req = (data: unknown, withKey = true) => new Request('http://localhost/api/bella-auto/vehicles', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(withKey ? { 'Idempotency-Key': intentId } : {}) }, body: JSON.stringify(data),
});
beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mockCurrentUser.mockResolvedValue({ id: actor, tenant_id: tenant });
  mockMaybeSingle.mockResolvedValue({ data: { id: customerId, name_mother: 'Actual customer' }, error: null });
  list.mockResolvedValue({ customers: [], count: 0, page: 1, pageSize: 50 });
  get.mockResolvedValue({ profile: { customerId, ...values, totalVehiclesOwned: 0, totalValueSpent: 0 }, ownedVehicles: [] });
  save.mockResolvedValue(undefined);
  register.mockResolvedValue({ value: vehicle, isDuplicate: false });
  readVehicle.mockResolvedValue(vehicle);
  mockDb.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('select u.id,u.tenant_id,u.role')
    ? [{ id: actor, tenant_id: tenant, role: 'accountant' }] : sql.includes('select v.id') ? [{ id: variantId }] : [] }));
});
it('requires real authentication and active canonical tenant before all work', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await autoMoveManagementHttp(new Request('http://localhost/customers'), 'customers')).status).toBe(401);
  mockCurrentUser.mockResolvedValueOnce(null);
  expect((await autoMoveManagementHttp(req(input), 'register')).status).toBe(403);
  expect(mockDb.connect).not.toHaveBeenCalled(); expect(register).not.toHaveBeenCalled();
});
it('lists real customers using the trusted tenant and bounded pagination', async () => {
  expect((await autoMoveManagementHttp(new Request('http://localhost/customers?q=actual&page=2'), 'customers')).status).toBe(200);
  expect(list).toHaveBeenCalledWith(mockClient, tenant, 'actual', 2);
  expect((await autoMoveManagementHttp(new Request('http://localhost/customers?page=NaN'), 'customers')).status).toBe(400);
});
it('rejects foreign customer before reading or writing its profile', async () => {
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect((await autoMoveManagementHttp(req(values), 'preferences', customerId)).status).toBe(404);
  expect(builder.eq).toHaveBeenCalledWith('tenant_id', tenant);
  expect(save).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
});
it('saves only preference fields and confirms persisted values before success', async () => {
  expect((await autoMoveManagementHttp(req(values), 'preferences', customerId)).status).toBe(200);
  expect(save).toHaveBeenCalledWith(mockClient, tenant, { customerId, ...values });
  get.mockResolvedValueOnce({ profile: null, ownedVehicles: [] });
  expect((await autoMoveManagementHttp(req(values), 'preferences', customerId)).status).toBe(409);
});
it.each([{ ...values, tenantId: tenant }, { ...values, totalValueSpent: 123 }, { ...values, status: 'approved' }])('rejects extra profile fields %j', async data => {
  expect((await autoMoveManagementHttp(req(data), 'preferences', customerId)).status).toBe(400);
  expect(save).not.toHaveBeenCalled();
});
it('does not report success when profile persistence fails', async () => {
  save.mockRejectedValueOnce(new Error('Private DB detail'));
  const response = await autoMoveManagementHttp(req(values), 'preferences', customerId);
  expect(response.status).toBe(500); expect(await response.text()).not.toContain('Private DB detail');
});
it('registers through Mobility and reads back under authenticated identity before commit', async () => {
  expect((await autoMoveManagementHttp(req(input), 'register')).status).toBe(200);
  expect(register).toHaveBeenCalledWith({ userId: actor, tenantId: tenant, roles: ['accountant'] }, { ...input, idempotencyKey: intentId });
  expect(mockDb.query).toHaveBeenCalledWith('set local role authenticated');
  expect(mockDb.query).toHaveBeenCalledWith('commit'); expect(readVehicle).toHaveBeenCalledWith(tenant, intentId);
});
it('rejects payload identity injection and missing retry key before DB', async () => {
  expect((await autoMoveManagementHttp(req({ ...input, tenantId: tenant }), 'register')).status).toBe(400);
  expect((await autoMoveManagementHttp(req(input, false), 'register')).status).toBe(400);
  expect(mockDb.connect).not.toHaveBeenCalled();
});
it('rejects a variant outside the tenant without invoking Mobility write', async () => {
  mockDb.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('select u.id,u.tenant_id,u.role') ? [{ role: 'accountant' }] : [] }));
  expect((await autoMoveManagementHttp(req(input), 'register')).status).toBe(404);
  expect(register).not.toHaveBeenCalled(); expect(mockDb.query).toHaveBeenCalledWith('rollback');
});
it('rolls back a missing read-back and a failed commit, never returning vehicle success', async () => {
  readVehicle.mockResolvedValueOnce(null);
  expect((await autoMoveManagementHttp(req(input), 'register')).status).toBe(500);
  expect(mockDb.query).not.toHaveBeenCalledWith('commit');
  mockDb.query.mockImplementation(async (sql: string) => {
    if (sql === 'commit') throw new Error('Private commit failure');
    return { rows: sql.includes('select u.id,u.tenant_id,u.role') ? [{ role: 'accountant' }] : sql.includes('select v.id') ? [{ id: variantId }] : [] };
  });
  const response = await autoMoveManagementHttp(req(input), 'register');
  expect(response.status).toBe(500); expect(await response.json()).not.toHaveProperty('vehicle');
  expect(mockDb.query).toHaveBeenCalledWith('rollback'); expect(mockDb.end).toHaveBeenCalled();
});
