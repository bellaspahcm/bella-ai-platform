import { GET, POST } from '../route';

const mockProfile = jest.fn();
const mockPrivileged = jest.fn(() => { throw new Error('PRIVILEGED_CLIENT_MUST_NOT_BE_CREATED'); });
const mockTenant = jest.fn();
const mockAuth = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockProfile() }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminKey: () => mockPrivileged(), getSupabaseAdminUrl: () => mockPrivileged() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockPrivileged() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ auth: { getUser: () => mockAuth() }, from: (table: string) => mockFrom(table) }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.mockResolvedValue({ id: 'actor', tenant_id: 'tenant', role: 'admin', status: 'active' });
  mockAuth.mockResolvedValue({ error: null, data: { user: { id: 'actor' } } });
  mockTenant.mockResolvedValue({ error: null, data: { id: 'tenant', status: 'active', product_key: 'bella_preschool' } });
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'tenants') throw new Error('BUSINESS_TABLE_MUST_NOT_BE_ACCESSED');
    return { select: () => ({ eq: () => ({ maybeSingle: () => mockTenant() }) }) };
  });
});

it('holds reads before any privileged or business dependency', async () => {
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ success: false, error: 'PRESCHOOL_FINANCE_NOT_READY', code: 'PRESCHOOL_FINANCE_NOT_READY' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mockPrivileged).not.toHaveBeenCalled();
  expect(mockFrom.mock.calls).toEqual([['tenants']]);
});

it.each(['createDraftInvoice', 'issueInvoice', 'sendInvoiceNotice', 'scanOverdueInvoices', 'recordAndReconcilePayment', 'completeTuitionServicePeriod', 'resolveException'])('holds %s without creating a privileged client or writing data', async action => {
  const response = await POST(new Request('http://localhost/api/education/finance', { method: 'POST', body: JSON.stringify({ action, paymentAmount: 1000, tenantId: 'forged' }) }));
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe('PRESCHOOL_FINANCE_NOT_READY');
  expect(mockPrivileged).not.toHaveBeenCalled();
  expect(mockFrom.mock.calls).toEqual([['tenants']]);
});

it.each(['missing', 'foreign', 'inactive', 'denied'])('fails closed when canonical product scope is %s', async condition => {
  mockTenant.mockResolvedValue({ error: condition === 'denied' ? { code: '42501' } : null,
    data: condition === 'missing' ? null : { id: condition === 'foreign' ? 'other' : 'tenant', status: condition === 'inactive' ? 'inactive' : 'active', product_key: 'bella_preschool' } });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(mockPrivileged).not.toHaveBeenCalled();
});

it('rejects a profile that does not belong to the real Auth subject', async () => {
  mockAuth.mockResolvedValue({ error: null, data: { user: { id: 'foreign-auth' } } });
  expect((await GET()).status).toBe(401);
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockPrivileged).not.toHaveBeenCalled();
});
