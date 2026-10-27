import { assertRcReport, rcEnvironment, rcReadinessSatisfied, redactRcLog, summarizeRcHealth } from '../../scripts/run-automove-rc-business-chain';

const ref = 'bmnbqbcdbuklhopfbopv';
const valid = () => ({ AUTOMOVE_RC_SHA: 'a'.repeat(40), NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_DB_URL: `postgresql://postgres.${ref}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'isolated-public-key', SUPABASE_SERVICE_ROLE_KEY: 'isolated-secret-key' });

it('resolves explicit isolated targets and production-mode runtime without Production credentials', () => {
  const result = rcEnvironment({ ...valid(), PRODUCTION_SUPABASE_DB_URL: 'never-forward', VERCEL_TOKEN: 'never-forward' });
  expect(result.NODE_ENV).toBe('production'); expect(result.SKIP_WEBSERVER).toBe('1'); expect(result.E2E_REUSE_SERVER).toBe('0');
  expect(result.DB_URL).toBe(result.SUPABASE_DB_URL); expect(result).not.toHaveProperty('PRODUCTION_SUPABASE_DB_URL');
  expect(result).not.toHaveProperty('VERCEL_TOKEN');
});
it('pins fallback Auth aliases and disables inherited read replicas for isolated verification', () => {
  const result = rcEnvironment({ ...valid(), SUPABASE_SECRET_KEY: 'unrelated-secret', USE_READ_REPLICA: 'true',
    SUPABASE_READ_REPLICA_URL: 'https://example.invalid', SUPABASE_READ_REPLICA_KEY: 'unrelated-replica' });
  expect(result.SUPABASE_SECRET_KEY).toBe(valid().SUPABASE_SERVICE_ROLE_KEY);
  expect(result.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(valid().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  expect(result.USE_READ_REPLICA).toBe('false'); expect(result.SUPABASE_READ_REPLICA_URL).toBe(''); expect(result.SUPABASE_READ_REPLICA_KEY).toBe('');
});
it.each([
  { AUTOMOVE_RC_SHA: 'short' }, { E2E_BASE_URL: 'http://localhost:3000' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://lvnvkpyxtuilhrabtlwv.supabase.co' },
  { NEXT_PUBLIC_SUPABASE_URL: 'http://bmnbqbcdbuklhopfbopv.supabase.co' },
  { SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' },
  { DATABASE_URL: 'postgresql://postgres.lvnvkpyxtuilhrabtlwv@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' },
  { DB_URL: `${valid().SUPABASE_DB_URL}?host=example.invalid` },
  { SUPABASE_DB_URL: '' }, { SUPABASE_SERVICE_ROLE_KEY: '' }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
])('fails closed before build/start on invalid or conflicting configuration: %j', invalid => {
  expect(() => rcEnvironment({ ...valid(), ...invalid })).toThrow();
});
it('requires exactly one successful whole-chain Browser test, not skip/flaky/partial evidence', () => {
  expect(assertRcReport({ stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 } }).expected).toBe(1);
  for (const stats of [{ expected: 0, unexpected: 0, flaky: 0, skipped: 1 }, { expected: 1, unexpected: 1, flaky: 0, skipped: 0 },
    { expected: 1, unexpected: 0, flaky: 1, skipped: 0 }, { expected: 2, unexpected: 0, flaky: 0, skipped: 0 }]) {
    expect(() => assertRcReport({ stats })).toThrow();
  }
});
it('records only allowlisted readiness fields and omits raw health errors', () => {
  expect(summarizeRcHealth(503, { status: 'unhealthy', environment: 'production', checks: { database: 'failed' }, errors: ['secret detail'] }))
    .toEqual({ httpStatus: 503, appStatus: 'unhealthy', environment: 'production', database: 'failed', healthError: 'other' });
  expect(summarizeRcHealth(200, { status: 'healthy', environment: 'unexpected-secret', checks: { database: 'ok' } }))
    .toEqual({ httpStatus: 200, appStatus: 'healthy', environment: 'unexpected', database: 'ok', healthError: 'missing' });
  expect(summarizeRcHealth(302, '<html>internal response body</html>'))
    .toEqual({ httpStatus: 302, appStatus: 'unexpected', environment: 'unexpected', database: 'unexpected', healthError: 'missing' });
  expect(summarizeRcHealth(503, { status: 'unhealthy', errors: ['permission denied for table tenants: private detail'] }).healthError)
    .toBe('permission');
  expect(summarizeRcHealth(503, { status: 'unhealthy', errors: ['Invalid API key: private detail'] }).healthError)
    .toBe('auth');
  expect(summarizeRcHealth(503, { status: 'unhealthy', errors: ['relation tenants does not exist: private detail'] }).healthError)
    .toBe('schema');
  expect(summarizeRcHealth(503, { status: 'unhealthy', errors: ['ETIMEDOUT private detail'] }).healthError)
    .toBe('timeout');
  expect(summarizeRcHealth(503, { status: 'unhealthy', errors: ['fetch failed: private detail'] }).healthError)
    .toBe('connectivity');
});
it('separates HTTP process readiness from database connectivity and does not require the health query to pass RLS', () => {
  expect(rcReadinessSatisfied(503, true)).toBe(true);
  expect(rcReadinessSatisfied(null, true)).toBe(false);
  expect(rcReadinessSatisfied(200, false)).toBe(false);
});
it('redacts configured secrets, DB credentials, JWT and encoded Auth cookies from artifact logs', () => {
  const value = redactRcLog('isolated-secret-key postgresql://user:password@example.invalid/postgres eyJabc.eyJdef.signature base64-abcdefghijklmnopqrstuv', valid());
  expect(value).not.toContain('isolated-secret-key'); expect(value).not.toContain('password');
  expect(value).not.toContain('eyJabc'); expect(value).not.toContain('abcdefghijklmnopqrstuv');
});
