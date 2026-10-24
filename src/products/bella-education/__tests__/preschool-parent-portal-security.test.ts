import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ParentPortalAccessError, PreschoolParentPortalService } from '../parent-portal/services/preschool-parent-portal.service';

// Business expectations: owner-approved AUTHORIZATION_CONTRACT.md sections2/5/6.
const tenantId = '00000000-0000-4000-8000-000000000001';
const guardianId = '00000000-0000-4000-8000-000000000002';
const studentId = '00000000-0000-4000-8000-000000000003';
const secret = 'synthetic-parent-portal-signing-key';
const day = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-20T20:00:00.000Z'); //21 October school time.
const claims = { tenantId, guardianPartyId: guardianId, studentPartyId: studentId, createdAt: now, exp: now + day };

function signText(text: string, key = secret) {
  const payload = Buffer.from(text).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', key).update(payload).digest('hex')}`;
}
function signed(value: object = claims, key = secret) { return signText(JSON.stringify(value), key); }

type Row = Record<string, unknown>;
function fixture() {
  const tables: Record<string, Row[]> = {
    tenants: [{ id: tenantId, status: 'active', product_key: 'bella_preschool' }],
    party_parties: [guardianId, studentId].map(id => ({ id, tenant_id: tenantId, deleted_at: null })),
    party_relationships: [{ id: 'relationship', tenant_id: tenantId, source_party_id: guardianId,
      target_party_id: studentId, relationship_type: 'guardian_of', active_from: null, active_to: null }],
  };
  let failedTable = '';
  const operations: string[] = [];
  const writes = jest.fn(() => { throw new Error('Unexpected business write'); });
  const from = jest.fn((table: string) => {
    operations.push(table);
    const filters: Array<(row: Row) => boolean> = [];
    const result = () => ({ data: failedTable === table ? null : (tables[table] ?? []).filter(row => filters.every(test => test(row))),
      error: failedTable === table ? { code: '42501', message: 'synthetic private DB detail' } : null });
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { filters.push(row => row[field] === value); return query; },
      in: (field: string, values: readonly unknown[]) => { filters.push(row => values.includes(row[field])); return query; },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data?.[0] ?? null }; },
      then: (fulfilled: (response: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(fulfilled),
      insert: writes, update: writes,
    };
    return query;
  });
  return { tables, operations, writes, service: new PreschoolParentPortalService({ from } as unknown as SupabaseClient),
    fail: (table: string) => { failedTable = table; } };
}

describe('Parent Portal signing and live resource authorization', () => {
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalAuthSecret = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
    delete process.env.NEXTAUTH_SECRET;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    if (originalAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = originalAuthSecret;
  });

  it('caps only new tokens at24h and retains independently signed legacy60-day tokens', () => {
    const generated = PreschoolParentPortalService.generatePortalToken(claims);
    expect(PreschoolParentPortalService.verifyPortalToken(generated)).toEqual(claims);
    const old = { ...claims, createdAt: now - 2 * day, exp: now + 58 * day };
    expect(PreschoolParentPortalService.verifyPortalToken(signed(old))).toEqual(old);
    const halfDay = PreschoolParentPortalService.generatePortalToken(claims, 0.5);
    expect(PreschoolParentPortalService.verifyPortalToken(halfDay).exp).toBe(now + day / 2);
  });
  it.each([0, -1, 1.01, NaN, Infinity])('rejects invalid new duration %s', duration => {
    expect(() => PreschoolParentPortalService.generatePortalToken(claims, duration)).toThrow('PORTAL_TOKEN_DURATION_INVALID');
  });
  it('preserves configured precedence and supports the original secondary secret', () => {
    process.env.NEXTAUTH_SECRET = 'synthetic-secondary-key';
    const token = PreschoolParentPortalService.generatePortalToken(claims);
    expect(token).toBe(signed());
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(PreschoolParentPortalService.generatePortalToken(claims)).toBe(signed(claims, 'synthetic-secondary-key'));
    expect(PreschoolParentPortalService.verifyPortalToken(signed(claims, 'synthetic-secondary-key'))).toEqual(claims);
  });
  it('fails unavailable without either configured signing key', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => PreschoolParentPortalService.generatePortalToken(claims)).toThrow('PORTAL_SIGNING_UNAVAILABLE');
    expect(() => PreschoolParentPortalService.verifyPortalToken(signed())).toThrow(ParentPortalAccessError);
    try { PreschoolParentPortalService.verifyPortalToken(signed()); } catch (error) {
      expect(error).toMatchObject({ status: 503, code: 'PORTAL_SIGNING_UNAVAILABLE' });
    }
  });
  it.each([
    { tenantId: null }, { tenantId: {} }, { guardianPartyId: 1 }, { studentPartyId: ' ' },
    { createdAt: 'now' }, { createdAt: -1 }, { exp: null }, { exp: 'tomorrow' }, { exp: now },
  ])('rejects independently signed malformed claims %j', patch => {
    expect(() => PreschoolParentPortalService.verifyPortalToken(signed({ ...claims, ...patch }))).toThrow('TOKEN_CLAIMS_INCOMPLETE');
  });
  it.each(['null', '[]', '{'])('rejects signed malformed JSON shape %s', text => {
    expect(() => PreschoolParentPortalService.verifyPortalToken(signText(text))).toThrow(ParentPortalAccessError);
  });
  it('rejects wrong signatures and expired legacy tokens', () => {
    expect(() => PreschoolParentPortalService.verifyPortalToken(signed(claims, 'synthetic-wrong-key'))).toThrow('TOKEN_SIGNATURE_MISMATCH');
    expect(() => PreschoolParentPortalService.verifyPortalToken(signed({ ...claims, createdAt: now - 61 * day, exp: now - day }))).toThrow('TOKEN_EXPIRED');
  });

  it.each(['guardian_of', 'parent_of'])('accepts current correctly directed %s including the school end day', async type => {
    const f = fixture();
    Object.assign(f.tables.party_relationships[0], { relationship_type: type, active_from: '2026-10-21', active_to: '2026-10-21' });
    await expect(f.service.authorizePortalToken(signed())).resolves.toEqual(claims);
    expect(f.writes).not.toHaveBeenCalled();
  });
  it.each([
    { relationship_type: 'works_for' }, { source_party_id: studentId, target_party_id: guardianId },
    { tenant_id: 'foreign' }, { active_from: '2026-10-22' }, { active_to: '2026-10-20' },
    { active_from: 'invalid' }, { active_to: '2026-02-31' },
  ])('denies invalid relationship %j before payload/thread/chat effects', async patch => {
    const f = fixture();
    Object.assign(f.tables.party_relationships[0], patch);
    await expect(f.service.getParentPortalPayload(signed(), '2026-10-19')).rejects.toMatchObject({ status: 401, code: 'GUARDIAN_NOT_AUTHORIZED' });
    await expect(f.service.sendChatMessage(signed(), 'synthetic message')).rejects.toMatchObject({ status: 401 });
    expect(f.operations.every(table => ['tenants', 'party_parties', 'party_relationships'].includes(table))).toBe(true);
    expect(f.writes).not.toHaveBeenCalled();
  });
  it.each(['inactive', 'foreign-product', 'missing', 'deleted-guardian', 'deleted-student', 'foreign-guardian', 'foreign-student'])('denies %s live binding', async condition => {
    const f = fixture();
    if (condition === 'inactive') f.tables.tenants[0].status = 'inactive';
    if (condition === 'foreign-product') f.tables.tenants[0].product_key = 'bella_hospital';
    if (condition === 'missing') f.tables.party_parties.splice(0, 1);
    if (condition.startsWith('deleted')) f.tables.party_parties[condition.endsWith('guardian') ? 0 : 1].deleted_at = '2026-10-20';
    if (condition.startsWith('foreign-')) f.tables.party_parties[condition.endsWith('guardian') ? 0 : 1].tenant_id = 'foreign';
    await expect(f.service.authorizePortalToken(signed())).rejects.toMatchObject({ status: 401 });
    expect(f.writes).not.toHaveBeenCalled();
  });
  it.each(['tenants', 'party_parties', 'party_relationships'])('does not fallback after %s lookup/RLS error', async table => {
    const f = fixture(); f.fail(table);
    await expect(f.service.authorizePortalToken(signed())).rejects.toMatchObject({ status: 503, code: 'PORTAL_ACCESS_UNAVAILABLE' });
    expect(f.operations.filter(value => value === table)).toHaveLength(1);
    expect(f.writes).not.toHaveBeenCalled();
  });
  it('does not use an older requested payload date to resurrect an expired relationship', async () => {
    const f = fixture(); f.tables.party_relationships[0].active_to = '2026-10-20';
    await expect(f.service.getParentPortalPayload(signed(), '2026-10-20')).rejects.toThrow('GUARDIAN_NOT_AUTHORIZED');
  });
});
