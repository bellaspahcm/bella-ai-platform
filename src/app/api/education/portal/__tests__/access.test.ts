import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ParentPortalTokenClaims } from '@/products/bella-education/parent-portal/domain/parent-portal.types';

const mockVerify = jest.fn<(token: string) => ParentPortalTokenClaims>();
const mockAuthorize = jest.fn<(token: string) => Promise<ParentPortalTokenClaims>>();
const mockPayload = jest.fn<() => Promise<object>>();
const mockChat = jest.fn<() => Promise<object>>();
const mockService = jest.fn(() => ({ authorizePortalToken: mockAuthorize, getParentPortalPayload: mockPayload, sendChatMessage: mockChat }));
const mockRpc = jest.fn<() => Promise<{ data: unknown; error: { code: string } | null }>>();
const mockClient = { from: jest.fn(), rpc: mockRpc };
const mockPrivileged = jest.fn(() => mockClient);
const mockSession = jest.fn(async () => mockClient);
const mockExecute = jest.fn<(...args: unknown[]) => Promise<object>>();
const mockAdminUrl = jest.fn(() => 'http://127.0.0.1:1');
const mockAdminKey = jest.fn(() => 'synthetic-offline-service-key');

jest.mock('@/products/bella-education/parent-portal/services/preschool-parent-portal.service', () => {
  const actual = jest.requireActual<typeof import('@/products/bella-education/parent-portal/services/preschool-parent-portal.service')>('@/products/bella-education/parent-portal/services/preschool-parent-portal.service');
  return { ParentPortalAccessError: actual.ParentPortalAccessError, PreschoolParentPortalService: Object.assign(mockService, { verifyPortalToken: mockVerify }) };
});
jest.mock('@supabase/supabase-js', () => ({ createClient: mockPrivileged }));
jest.mock('@/lib/supabase-server', () => ({ createClient: mockSession }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminUrl: mockAdminUrl, getSupabaseAdminKey: mockAdminKey }));
jest.mock('@/products/bella-education/services/preschool-ai.service', () => ({ executePreschoolCopilot: mockExecute }));

const { ParentPortalAccessError } = require('@/products/bella-education/parent-portal/services/preschool-parent-portal.service') as typeof import('@/products/bella-education/parent-portal/services/preschool-parent-portal.service');
const { GET } = require('../[token]/route') as typeof import('../[token]/route');
const { POST: CHAT } = require('../[token]/chat/route') as typeof import('../[token]/chat/route');
const { POST: COPILOT } = require('../[token]/copilot/route') as typeof import('../[token]/copilot/route');
const claims: ParentPortalTokenClaims = { tenantId: 'synthetic-tenant', guardianPartyId: 'synthetic-guardian', studentPartyId: 'synthetic-student', createdAt: 1, exp: 9999999999999 };
const handlers = { payload: GET, chat: CHAT, copilot: COPILOT };
type Endpoint = keyof typeof handlers;
const endpoints: Endpoint[] = ['payload', 'chat', 'copilot'];
function input(endpoint: Endpoint, body = JSON.stringify({ message: 'synthetic question', action: 'ask_copilot' })) {
  return new Request(`http://localhost/api/education/portal/synthetic-token${endpoint === 'payload' ? '' : '/' + endpoint}`, endpoint === 'payload' ? undefined : { method: 'POST', body });
}
function invoke(endpoint: Endpoint, request = input(endpoint), token = 'synthetic-token') {
  return handlers[endpoint](request, { params: Promise.resolve({ token }) });
}
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ success: false, error: code });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
}
beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(claims); mockAuthorize.mockResolvedValue(claims);
  mockPayload.mockResolvedValue({ tenantId: '00000000-0000-4000-8000-000000000001', child: { id: 'synthetic-student' } });
  mockChat.mockResolvedValue({ id: 'synthetic-message' });
  mockExecute.mockResolvedValue({ success: true, action: 'ask_copilot', data: { answer: 'synthetic answer' }, piiMasked: true, timestamp: 'synthetic-time' });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Portal consumer API security boundaries', () => {
  const dailyClaims: ParentPortalTokenClaims = { tenantId: '00000000-0000-4000-8000-000000000001', studentPartyId: '00000000-0000-4000-8000-000000000002', guardianPartyId: '00000000-0000-4000-8000-000000000003', courseId: '00000000-0000-4000-8000-000000000004', scope: 'daily_read_v1', createdAt: 1, exp: 9999999999999 };
  const daily = () => ({ ...dailyClaims, schoolName: 'Synthetic School', childName: 'Synthetic Child', guardianName: 'Synthetic Guardian', courseTitle: 'Synthetic Class', courseCode: 'SYN', schoolDay: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), attendanceStatus: 'present', attendanceUpdatedAt: null, totalClassSize: 1, presentTodayCount: 1, serverTime: new Date().toISOString() });
  it.each(['chat', 'copilot'] as const)('rejects new read-only scope on %s before clients/body/model', async endpoint => {
    mockVerify.mockReturnValue(dailyClaims);
    const req = input(endpoint); const parse = jest.spyOn(req, 'json');
    await expectError(await invoke(endpoint, req), 403, 'PORTAL_READ_ONLY');
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(parse).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled();
  });
  it('reads new scope with verified exact claims, strips all extra/contact fields and never invokes legacy aggregator', async () => {
    mockVerify.mockReturnValue(dailyClaims);
    mockRpc.mockResolvedValueOnce({ data: { ...daily(), contactPhone: 'private-contact' }, error: null })
      .mockResolvedValueOnce({ data: { tenantId: dailyClaims.tenantId, announcements: [] }, error: null });
    const response = await invoke('payload'); expect(response.status).toBe(200);
    const body = await response.json(); expect(body.data).not.toHaveProperty('contactPhone'); expect(body.data).not.toHaveProperty('exp');
    expect(mockRpc).toHaveBeenCalledWith('preschool_portal_daily_read', { p_tenant_id: dailyClaims.tenantId, p_course_id: dailyClaims.courseId, p_student_party_id: dailyClaims.studentPartyId, p_guardian_party_id: dailyClaims.guardianPartyId });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'preschool_portal_school_announcements_read', { p_tenant_id: dailyClaims.tenantId });
    expect(body.data.announcements).toEqual([]);
    expect(mockPayload).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled();
  });
  it('fails closed when announcement feed is unavailable or cross-tenant', async () => {
    mockVerify.mockReturnValue(dailyClaims);
    mockRpc.mockResolvedValueOnce({ data: daily(), error: null })
      .mockResolvedValueOnce({ data: { tenantId: '00000000-0000-4000-8000-000000000099', announcements: [] }, error: null });
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE');
  });
  it('rejects caller date selectors in new scope before adapter', async () => {
    mockVerify.mockReturnValue(dailyClaims);
    await expectError(await invoke('payload', new Request('http://localhost/api/education/portal/token?date=2026-01-01')), 403, 'PORTAL_SELECTOR_FORBIDDEN'); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('fails closed without server adapter instead of anonymous/caller fallback', async () => {
    mockVerify.mockReturnValue(dailyClaims); mockAdminKey.mockReturnValueOnce('');
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE'); expect(mockSession).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each(['42501', 'XX000'])('maps live new-scope RPC denial safely: %s', async code => {
    mockVerify.mockReturnValue(dailyClaims); mockRpc.mockResolvedValue({ data: null, error: { code } });
    await expectError(await invoke('payload'), code === '42501' ? 401 : 503, code === '42501' ? 'GUARDIAN_NOT_AUTHORIZED' : 'PORTAL_ACCESS_UNAVAILABLE');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it.each(['tenantId', 'courseId', 'studentPartyId', 'guardianPartyId', 'schoolDay'])('rejects mismatched new-scope %s before returning data', async key => {
    mockVerify.mockReturnValue(dailyClaims); mockRpc.mockResolvedValue({ data: { ...daily(), [key]: key === 'schoolDay' ? '2000-01-01' : '00000000-0000-4000-8000-000000000099' }, error: null });
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE');
  });
  it('rejects a malformed array attendance status rather than coercing it to a valid label', async () => {
    mockVerify.mockReturnValue(dailyClaims); mockRpc.mockResolvedValue({ data: { ...daily(), attendanceStatus: ['present'] }, error: null });
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE');
  });
  it.each(endpoints)('%s requires a token before operation-client construction', async endpoint => {
    await expectError(await invoke(endpoint, input(endpoint), ''), 401, 'TOKEN_REQUIRED');
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled();
  });
  it.each(endpoints)('%s rejects invalid signature before clients/body/service', async endpoint => {
    mockVerify.mockImplementation(() => { throw new ParentPortalAccessError(401, 'TOKEN_SIGNATURE_MISMATCH'); });
    const req = input(endpoint, '{invalid'); const parse = jest.spyOn(req, 'json');
    await expectError(await invoke(endpoint, req), 401, 'TOKEN_SIGNATURE_MISMATCH');
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockService).not.toHaveBeenCalled(); expect(parse).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled();
  });
  it.each(endpoints)('%s reports missing signing configuration as503 before clients', async endpoint => {
    mockVerify.mockImplementation(() => { throw new ParentPortalAccessError(503, 'PORTAL_SIGNING_UNAVAILABLE'); });
    await expectError(await invoke(endpoint), 503, 'PORTAL_SIGNING_UNAVAILABLE'); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each(['chat', 'copilot'] as const)('%s rechecks live binding before parsing or executing', async endpoint => {
    mockAuthorize.mockRejectedValue(new ParentPortalAccessError(401, 'GUARDIAN_NOT_AUTHORIZED'));
    const req = input(endpoint, '{invalid'); const parse = jest.spyOn(req, 'json');
    await expectError(await invoke(endpoint, req), 401, 'GUARDIAN_NOT_AUTHORIZED');
    expect(parse).not.toHaveBeenCalled(); expect(mockChat).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled();
  });
  it('maps payload live-binding denial from the service to401', async () => {
    mockPayload.mockRejectedValue(new ParentPortalAccessError(401, 'GUARDIAN_NOT_AUTHORIZED'));
    await expectError(await invoke('payload'), 401, 'GUARDIAN_NOT_AUTHORIZED'); expect(mockExecute).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'cross-tenant'] as const)('fails closed for a legacy Portal link when the bulletin feed is %s', async scenario => {
    mockRpc.mockResolvedValueOnce({ data: scenario === 'cross-tenant'
      ? { tenantId: '00000000-0000-4000-8000-000000000099', announcements: [] }
      : null, error: scenario === 'unavailable' ? { code: 'XX000' } : null });
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE');
    expect(mockPayload).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('preschool_portal_school_announcements_read', { p_tenant_id: '00000000-0000-4000-8000-000000000001' });
  });
  it('fails closed for legacy bulletin reads when the server-only adapter is not configured', async () => {
    mockAdminKey.mockReturnValueOnce('');
    await expectError(await invoke('payload'), 503, 'PORTAL_ACCESS_UNAVAILABLE');
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockPayload).not.toHaveBeenCalled();
  });
  it.each(endpoints)('%s sanitizes unknown dependency errors without retry or raw details', async endpoint => {
    const error = new Error('synthetic private DB detail');
    if (endpoint === 'payload') mockPayload.mockRejectedValue(error); else mockAuthorize.mockRejectedValue(error);
    await expectError(await invoke(endpoint), 503, 'PORTAL_ACCESS_UNAVAILABLE');
    expect(mockPrivileged).toHaveBeenCalledTimes(1); expect(mockSession).not.toHaveBeenCalled(); expect(mockExecute).not.toHaveBeenCalled();
  });
  it.each(['executive_briefing', 'executive_safety_audit', 'assess_care_safety', 'unknown'])('denies parent action %s before AI', async action => {
    await expectError(await invoke('copilot', input('copilot', JSON.stringify({ action }))), 403, 'PORTAL_ACTION_FORBIDDEN'); expect(mockExecute).not.toHaveBeenCalled();
  });
  it('preserves legitimate question output after live binding and discards caller identity/role/key', async () => {
    const response = await invoke('copilot', input('copilot', JSON.stringify({ action: 'ask_copilot', message: 'synthetic question', tenantId: 'foreign', role: 'super_admin', geminiApiKey: 'untrusted', clinicalData: {} })));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ success: true, action: 'ask_copilot', piiMasked: true });
    expect(mockAuthorize.mock.invocationCallOrder[0]).toBeLessThan(mockExecute.mock.invocationCallOrder[0]);
    expect(mockExecute.mock.calls[0][0]).toMatchObject({ action: 'ask_copilot', message: 'synthetic question' });
    expect(mockExecute.mock.calls[0][0]).not.toHaveProperty('tenantId'); expect(mockExecute.mock.calls[0][0]).not.toHaveProperty('role');
    expect(mockExecute.mock.calls[0][0]).not.toHaveProperty('clinicalData'); expect(mockExecute.mock.calls[0][0]).not.toMatchObject({ geminiApiKey: 'untrusted' });
  });
  it('preserves payload and chat output mapping after their service guards', async () => {
    mockRpc.mockResolvedValueOnce({ data: { tenantId: '00000000-0000-4000-8000-000000000001', announcements: [] }, error: null });
    const response = await invoke('payload'); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { tenantId: '00000000-0000-4000-8000-000000000001', child: { id: 'synthetic-student' }, announcements: [] } });
    expect(mockRpc).toHaveBeenCalledWith('preschool_portal_school_announcements_read', { p_tenant_id: '00000000-0000-4000-8000-000000000001' });
    const chat = await invoke('chat'); expect(chat.status).toBe(200);
    expect(await chat.json()).toEqual({ success: true, message: { id: 'synthetic-message' } });
    expect(mockChat).toHaveBeenCalledWith('synthetic-token', 'synthetic question');
  });
});
