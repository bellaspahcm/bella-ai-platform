const probeTimeoutMs = 3000;
const productionProjectRef = 'lvnvkpyxtuilhrabtlwv';
const healthFunctionPath = '/rest/v1/rpc/platform_health_database_probe';

/** Safe public failure; never include API keys, target URLs, or upstream response text. */
export class HealthDatabaseProbeError extends Error {
  constructor() {
    super('Database connectivity check failed');
    this.name = 'HealthDatabaseProbeError';
  }
}

type ProbeConfig = {
  endpoint: string;
  publicKey: string;
};

function resolveConfig(env: NodeJS.ProcessEnv): ProbeConfig {
  try {
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new HealthDatabaseProbeError();

    const rawUrls = [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL]
      .filter((value): value is string => value !== undefined);
    if (rawUrls.length === 0) throw new HealthDatabaseProbeError();

    const urls = rawUrls.map(value => {
      const url = new URL(value);
      const refMatch = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
      const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      const hostedSupabase = refMatch !== null && url.protocol === 'https:' && !url.port;
      const localSupabase = localHost && url.protocol === 'http:' && url.port === '54321' &&
        env.NODE_ENV !== 'production';

      if ((!hostedSupabase && !localSupabase) || url.username || url.password || url.search || url.hash ||
          (url.pathname !== '' && url.pathname !== '/')) {
        throw new HealthDatabaseProbeError();
      }

      if (env.VERCEL === '1' && env.VERCEL_ENV === 'production' && refMatch?.[1] !== productionProjectRef) {
        throw new HealthDatabaseProbeError();
      }

      if (refMatch?.[1] === productionProjectRef && (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production')) {
        throw new HealthDatabaseProbeError();
      }

      return url;
    });

    const selectedUrl = urls[0];
    if (urls.some(url => url.origin !== selectedUrl.origin)) throw new HealthDatabaseProbeError();

    const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!publicKey) throw new HealthDatabaseProbeError();

    return {
      endpoint: new URL(healthFunctionPath, selectedUrl).toString(),
      publicKey,
    };
  } catch {
    throw new HealthDatabaseProbeError();
  }
}

let inFlight: { endpoint: string; publicKey: string; promise: Promise<void> } | undefined;

async function executeProbe(config: ProbeConfig, fetcher: typeof fetch): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);

  try {
    const response = await fetcher(config.endpoint, {
      method: 'POST',
      headers: {
        apikey: config.publicKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new HealthDatabaseProbeError();
    }

    const result = await response.text();
    if (result.trim() !== 'true') throw new HealthDatabaseProbeError();
  } catch {
    throw new HealthDatabaseProbeError();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks Postgres execution through the Supabase Data API using only the
 * configured public key. The backing RPC returns a constant and reads no rows.
 */
export function createHealthDatabaseProbe(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = globalThis.fetch,
): () => Promise<void> {
  const config = resolveConfig(env);

  return () => {
    if (inFlight) {
      if (inFlight.endpoint !== config.endpoint || inFlight.publicKey !== config.publicKey) {
        return Promise.reject(new HealthDatabaseProbeError());
      }
      return inFlight.promise;
    }

    const promise = executeProbe(config, fetcher).finally(() => {
      if (inFlight?.promise === promise) inFlight = undefined;
    });
    inFlight = { ...config, promise };
    return promise;
  };
}
