import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { Client, type ClientConfig } from 'pg';
import { createHealthDatabaseProbe, HealthDatabaseProbeError } from '../database-probe';

jest.mock('pg', () => ({ Client: jest.fn() }));

const ref = 'bmnbqbcdbuklhopfbopv';
const otherRef = 'aaaaaaaaaaaaaaaaaaaa';
const productionRef = 'lvnvkpyxtuilhrabtlwv';
const dbUrl = (project = ref) => `postgresql://postgres.${project}:fixture-password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`;
const environment = (): NodeJS.ProcessEnv => ({ NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, DB_URL: dbUrl() });
const rawFailure = new Error('postgresql://private-user:private-password@private-host/postgres certificate details');
const result = { rowCount: 1, rows: [{ healthy: 1 }] };
const connect = jest.fn();
const query = jest.fn();
const end = jest.fn();
const on = jest.fn();
const constructor = jest.mocked(Client);
let destroy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  connect.mockResolvedValue(undefined);
  query.mockResolvedValue(result);
  end.mockResolvedValue(undefined);
  on.mockReturnValue(undefined);
  constructor.mockImplementation(() => ({ connect, query, end, on }) as unknown as Client);
  destroy = jest.spyOn(Socket.prototype, 'destroy');
});

afterEach(() => {
  destroy.mockRestore();
  jest.useRealTimers();
});

it('checks only a constant SELECT inside a read-only transaction and always closes', async () => {
  await createHealthDatabaseProbe(environment())();
  expect(connect).toHaveBeenCalledTimes(1);
  expect(query.mock.calls.map(call => call[0])).toEqual(['BEGIN READ ONLY', 'SELECT 1 AS healthy', 'ROLLBACK']);
  expect(end).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  const config = constructor.mock.calls[0][0] as ClientConfig;
  expect(config).not.toHaveProperty('connectionString');
  expect(config).toMatchObject({ host: 'aws-1-ap-southeast-1.pooler.supabase.com', database: 'postgres',
    user: `postgres.${ref}`, port: 5432, connectionTimeoutMillis: 2000, query_timeout: 1500,
    statement_timeout: 1500, idle_in_transaction_session_timeout: 2000,
    ssl: { rejectUnauthorized: true, servername: 'aws-1-ap-southeast-1.pooler.supabase.com' } });
  const tls = config.ssl as { ca: string };
  // Bind the existing vendor certificate bytes, independently of its inline comment.
  const der = Buffer.from(tls.ca.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
  expect(createHash('sha256').update(der).digest('hex')).toBe('807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa');
});

it.each([
  { DB_URL: undefined, SUPABASE_DB_URL: dbUrl() },
  { DB_URL: undefined, DATABASE_URL: dbUrl() },
  { SUPABASE_DB_URL: dbUrl(), DATABASE_URL: `${dbUrl()}?sslmode=verify-full` },
  { DB_URL: `postgresql://postgres:fixture-password@db.${ref}.supabase.co:5432/postgres` },
  { DB_URL: dbUrl().replace(':5432/', ':6543/') },
  { SUPABASE_URL: `https://${ref}.supabase.co/` },
  { NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_URL: `https://${ref}.supabase.co` },
])('uses explicit verified target configuration: %j', async overrides => {
  await expect(createHealthDatabaseProbe({ ...environment(), ...overrides })()).resolves.toBeUndefined();
});

it.each([
  { NEXT_PUBLIC_SUPABASE_URL: undefined },
  { NEXT_PUBLIC_SUPABASE_URL: '' },
  { NEXT_PUBLIC_SUPABASE_URL: `http://${ref}.supabase.co` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co.evil.invalid` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://user:password@${ref}.supabase.co` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co:444` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co/path` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co?host=example.invalid` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co#fragment` },
  { SUPABASE_URL: `https://${otherRef}.supabase.co` },
  { SUPABASE_URL: '' },
  { DB_URL: undefined },
  { DB_URL: '' },
  { DB_URL: 'not a connection URI' },
  { DB_URL: `https://postgres:password@db.${ref}.supabase.co/postgres` },
  { DB_URL: dbUrl(otherRef) },
  { DB_URL: dbUrl(productionRef) },
  { DB_URL: 'postgresql://postgres:password@example.invalid/postgres' },
  { DB_URL: dbUrl().replace(/\/postgres$/, '/another_database') },
  { DB_URL: dbUrl().replace(':5432/', ':6544/') },
  { DB_URL: `postgresql://postgres:password@db.${ref}.supabase.co:6543/postgres` },
  { DB_URL: dbUrl().replace(':fixture-password', '') },
  { DB_URL: `${dbUrl()}#fragment` },
  { SUPABASE_DB_URL: dbUrl(otherRef) },
  { DATABASE_URL: dbUrl(otherRef) },
  { DATABASE_URL: dbUrl().replace('fixture-password', 'different-password') },
  { DATABASE_URL: dbUrl().replace(':5432/', ':6543/') },
  { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
])('rejects missing, malformed or conflicting configuration before creating a client: %j', overrides => {
  expect(() => createHealthDatabaseProbe({ ...environment(), ...overrides })).toThrow(HealthDatabaseProbeError);
  expect(constructor).not.toHaveBeenCalled();
});

it.each([
  'host=example.invalid', 'user=postgres', 'password=changed', 'sslmode=disable', 'sslmode=require',
  'sslmode=no-verify', 'sslrootcert=%2Fprivate%2Ffile', 'sslcert=%2Fprivate%2Ffile',
  'sslkey=%2Fprivate%2Ffile', 'ssl=true', 'options=-c%20default_transaction_read_only%3Doff',
  'sslmode=verify-full&sslmode=verify-full', 'SSLmode=verify-full', 'application_name=unverified',
])('rejects URI overrides before the pg parser can apply them: %s', parameter => {
  expect(() => createHealthDatabaseProbe({ ...environment(), DB_URL: `${dbUrl()}?${parameter}` })).toThrow(HealthDatabaseProbeError);
  expect(constructor).not.toHaveBeenCalled();
});

it.each([
  {}, { NODE_ENV: 'production' }, { NODE_ENV: 'production', VERCEL_ENV: 'production' },
  { VERCEL: '1', VERCEL_ENV: 'preview' }, { VERCEL: 'true', VERCEL_ENV: 'production' },
])('rejects a locally configured actual Production project before connect: %j', flags => {
  expect(() => createHealthDatabaseProbe({ NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    DB_URL: dbUrl(productionRef), ...flags })).toThrow(HealthDatabaseProbeError);
  expect(constructor).not.toHaveBeenCalled();
});

it('supports existing explicit hosted deployment intent only as config validation, without touching Product runtime flags', async () => {
  // Driver is mocked; this test performs no Production connection or query.
  await createHealthDatabaseProbe({ NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    DB_URL: dbUrl(productionRef), VERCEL: '1', VERCEL_ENV: 'production' })();
  expect(constructor).toHaveBeenCalledTimes(1);
});

it('creates a separate ephemeral client per request', async () => {
  const probe = createHealthDatabaseProbe(environment());
  await probe();
  await probe();
  expect(constructor).toHaveBeenCalledTimes(2);
  expect(end).toHaveBeenCalledTimes(2);
});

it('coalesces concurrent requests only while the same target probe is in flight', async () => {
  let release: (() => void) | undefined;
  connect.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const first = createHealthDatabaseProbe(environment())();
  const second = createHealthDatabaseProbe(environment())();
  expect(first).toBe(second);
  expect(constructor).toHaveBeenCalledTimes(1);
  await expect(createHealthDatabaseProbe({ ...environment(), DB_URL: dbUrl().replace(':5432/', ':6543/') })())
    .rejects.toEqual(new HealthDatabaseProbeError());
  release?.();
  await Promise.all([first, second]);
  connect.mockResolvedValue(undefined);
  await createHealthDatabaseProbe(environment())();
  expect(constructor).toHaveBeenCalledTimes(2);
});

it('clears the in-flight probe after failure so a fresh check can recover', async () => {
  connect.mockRejectedValueOnce(rawFailure);
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  await expect(createHealthDatabaseProbe(environment())()).resolves.toBeUndefined();
  expect(constructor).toHaveBeenCalledTimes(2);
  expect(end).toHaveBeenCalledTimes(2);
});

it('sanitizes connect/TLS failures and still closes without sending SQL', async () => {
  connect.mockRejectedValue(rawFailure);
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(query).not.toHaveBeenCalled();
  expect(end).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('sanitizes constructor failure and destroys the owned socket', async () => {
  constructor.mockImplementation(() => { throw rawFailure; });
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(destroy).toHaveBeenCalledTimes(1);
});

it.each(['BEGIN READ ONLY', 'SELECT 1 AS healthy', 'ROLLBACK'])('fails closed on %s failure and closes', async failingQuery => {
  query.mockImplementation((text: string) => text === failingQuery ? Promise.reject(rawFailure) : Promise.resolve(result));
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(end).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(query.mock.calls.map(call => call[0])).toEqual(failingQuery === 'BEGIN READ ONLY'
    ? ['BEGIN READ ONLY'] : ['BEGIN READ ONLY', 'SELECT 1 AS healthy', 'ROLLBACK']);
});

it.each([
  { rowCount: 0, rows: [] }, { rowCount: 2, rows: [{ healthy: 1 }, { healthy: 1 }] },
  { rowCount: 1, rows: [{ healthy: 0 }] }, { rowCount: 1, rows: [{ healthy: '1' }] },
  { rowCount: null, rows: [{ healthy: 1 }] }, { rowCount: 1, rows: [] },
])('rejects an unexpected SQL result and rolls back: %j', async unexpected => {
  query.mockResolvedValue(unexpected);
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  expect(end).toHaveBeenCalledTimes(1);
});

it('does not report healthy when an asynchronous client error occurs', async () => {
  query.mockImplementation(async () => {
    const errorListener = on.mock.calls[0][1] as () => void;
    errorListener();
    return result;
  });
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(end).toHaveBeenCalledTimes(1);
});

it('does not report healthy when closing fails after successful SQL', async () => {
  end.mockRejectedValue(rawFailure);
  await expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('allows bounded multi-round-trip latency beyond2s without widening individual driver deadlines', async () => {
  jest.useFakeTimers();
  connect.mockImplementation(() => new Promise<void>(resolve => setTimeout(resolve, 1700)));
  query.mockImplementation(() => new Promise<typeof result>(resolve => setTimeout(() => resolve(result), 200)));
  const completed = createHealthDatabaseProbe(environment())();
  await jest.advanceTimersByTimeAsync(2300);
  await expect(completed).resolves.toBeUndefined();
  expect(end).toHaveBeenCalledTimes(1);
  expect(constructor.mock.calls[0][0]).toMatchObject({ connectionTimeoutMillis: 2000,
    idle_in_transaction_session_timeout: 2000, query_timeout: 1500, statement_timeout: 1500 });
});

it.each(['connect', 'query'])('bounds a hung %s and prevents late SQL after cleanup', async stage => {
  jest.useFakeTimers();
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  if (stage === 'connect') connect.mockReturnValue(pending);
  else query.mockImplementation((text: string) => text === 'SELECT 1 AS healthy' ? pending : Promise.resolve(result));
  const rejected = expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  await jest.advanceTimersByTimeAsync(3000);
  await rejected;
  expect(end).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
  const sentBeforeRelease = query.mock.calls.length;
  release?.();
  await jest.advanceTimersByTimeAsync(0);
  expect(query).toHaveBeenCalledTimes(sentBeforeRelease);
  if (stage === 'connect') expect(query).not.toHaveBeenCalled();
});

it('bounds a hung close and force-destroys the underlying socket', async () => {
  jest.useFakeTimers();
  end.mockReturnValue(new Promise<void>(() => undefined));
  const rejected = expect(createHealthDatabaseProbe(environment())()).rejects.toEqual(new HealthDatabaseProbeError());
  await jest.advanceTimersByTimeAsync(500);
  await rejected;
  expect(destroy).toHaveBeenCalledTimes(1);
});
