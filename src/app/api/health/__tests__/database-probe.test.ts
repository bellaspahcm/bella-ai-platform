import { createHealthDatabaseProbe, HealthDatabaseProbeError } from '../database-probe';

const ref = 'bmnbqbcdbuklhopfbopv';
const productionRef = 'lvnvkpyxtuilhrabtlwv';
const publicKey = 'sb_publishable_health_fixture';

const environment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
});

const response = (status: number, text: string): Response => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => text,
  body: { cancel: async () => undefined } as unknown as ReadableStream<Uint8Array>,
}) as Response;

const successfulFetch = jest.fn<typeof fetch>();

beforeEach(() => {
  jest.clearAllMocks();
  successfulFetch.mockResolvedValue(response(200, 'true'));
});

it('calls only the constant database RPC using the public key and no-store semantics', async () => {
  await createHealthDatabaseProbe(environment(), successfulFetch)();

  expect(successfulFetch).toHaveBeenCalledTimes(1);
  expect(successfulFetch).toHaveBeenCalledWith(
    `https://${ref}.supabase.co/rest/v1/rpc/platform_health_database_probe`,
    expect.objectContaining({
      method: 'POST',
      headers: {
        apikey: publicKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }),
  );
  const [, request] = successfulFetch.mock.calls[0];
  expect(request?.headers).not.toHaveProperty('Authorization');
});

it.each([
  { NEXT_PUBLIC_SUPABASE_URL: undefined },
  { NEXT_PUBLIC_SUPABASE_URL: '' },
  { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined },
  { NEXT_PUBLIC_SUPABASE_URL: `http://${ref}.supabase.co` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co.evil.invalid` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://user:password@${ref}.supabase.co` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co:444` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co/path` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co?host=example.invalid` },
  { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co#fragment` },
  { SUPABASE_URL: `https://${'a'.repeat(20)}.supabase.co` },
  { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
])('rejects missing or unsafe configuration before making a request: %j', overrides => {
  expect(() => createHealthDatabaseProbe({ ...environment(), ...overrides }, successfulFetch))
    .toThrow(HealthDatabaseProbeError);
  expect(successfulFetch).not.toHaveBeenCalled();
});

it.each([undefined, ''])('accepts the anon key when the publishable key is absent or empty: %s', async publishableKey => {
  const env = {
    ...environment(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-fixture',
  };
  await createHealthDatabaseProbe(env, successfulFetch)();
  expect(successfulFetch.mock.calls[0][1]?.headers).toMatchObject({ apikey: 'legacy-anon-fixture' });
});

it('supports the local Supabase API only outside production', async () => {
  const env = {
    ...environment(),
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  };
  await createHealthDatabaseProbe(env, successfulFetch)();
  expect(successfulFetch).toHaveBeenCalledWith(
    'http://127.0.0.1:54321/rest/v1/rpc/platform_health_database_probe',
    expect.any(Object),
  );
  expect(() => createHealthDatabaseProbe({ ...env, NODE_ENV: 'production' }, successfulFetch))
    .toThrow(HealthDatabaseProbeError);
});

it.each([
  {},
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', VERCEL_ENV: 'production' },
  { VERCEL: '1', VERCEL_ENV: 'preview' },
  { VERCEL: 'true', VERCEL_ENV: 'production' },
])('rejects a local probe configured for the Production project: %j', flags => {
  expect(() => createHealthDatabaseProbe({
    ...environment(),
    NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-fixture',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_health_fixture',
    ...flags,
  }, successfulFetch)).toThrow(HealthDatabaseProbeError);
  expect(successfulFetch).not.toHaveBeenCalled();
});

it('allows the Production target only for explicit Vercel Production runtime configuration', async () => {
  await createHealthDatabaseProbe({
    ...environment(),
    NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    VERCEL: '1',
    VERCEL_ENV: 'production',
  }, successfulFetch)();
  expect(successfulFetch).toHaveBeenCalledTimes(1);
});

it('rejects a non-Production Supabase project in Vercel Production', () => {
  expect(() => createHealthDatabaseProbe({
    ...environment(),
    VERCEL: '1',
    VERCEL_ENV: 'production',
  }, successfulFetch)).toThrow(HealthDatabaseProbeError);
  expect(successfulFetch).not.toHaveBeenCalled();
});

it.each([
  { status: 403, text: '{"message":"forbidden"}' },
  { status: 404, text: '{"message":"function not found"}' },
  { status: 503, text: 'database unavailable' },
  { status: 200, text: 'false' },
  { status: 200, text: '[]' },
  { status: 200, text: 'true; private detail' },
])('fails closed for an unexpected upstream response: %j', async result => {
  successfulFetch.mockResolvedValue(response(result.status, result.text));
  await expect(createHealthDatabaseProbe(environment(), successfulFetch)())
    .rejects.toEqual(new HealthDatabaseProbeError());
});

it('sanitizes network and upstream parse failures', async () => {
  successfulFetch.mockRejectedValue(new Error('https://private.invalid/?key=secret'));
  await expect(createHealthDatabaseProbe(environment(), successfulFetch)())
    .rejects.toEqual(new HealthDatabaseProbeError());
});

it('aborts a hung request at the bounded timeout', async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | undefined;
  successfulFetch.mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
    signal = init?.signal as AbortSignal;
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));

  const result = expect(createHealthDatabaseProbe(environment(), successfulFetch)())
    .rejects.toEqual(new HealthDatabaseProbeError());
  await jest.advanceTimersByTimeAsync(3000);
  await result;
  expect(signal?.aborted).toBe(true);
  jest.useRealTimers();
});

it('performs a fresh database probe on each completed health request', async () => {
  const probe = createHealthDatabaseProbe(environment(), successfulFetch);
  await probe();
  await probe();
  expect(successfulFetch).toHaveBeenCalledTimes(2);
});
