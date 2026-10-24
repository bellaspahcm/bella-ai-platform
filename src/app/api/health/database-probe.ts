import { Socket } from 'node:net';
import { Client, type ClientConfig } from 'pg';
import { parse } from 'pg-connection-string';

// Public vendor CA, not a credential. Same vendor certificate already verified by
// AutoMoveSaleChainConnection; Health has no dependency on that Product module.
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
// SHA-256: 807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA
const supabaseRootCa = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

// Cold HTTP probes have measured close to 2s across all round trips. Keep the
// driver deadlines separate while bounding the complete operation to 3s.
const probeTimeoutMs = 3000;
const connectionTimeoutMs = 2000;
const closeTimeoutMs = 500;
const productionProjectRef = 'lvnvkpyxtuilhrabtlwv';

/** Safe public failure; never include driver errors or connection configuration. */
export class HealthDatabaseProbeError extends Error {
  constructor() {
    super('Database connectivity check failed');
    this.name = 'HealthDatabaseProbeError';
  }
}

function connectionConfig(env: NodeJS.ProcessEnv): ClientConfig {
  try {
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new HealthDatabaseProbeError();
    const apiUrls = [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL].filter(value => value !== undefined);
    if (apiUrls.length === 0) throw new HealthDatabaseProbeError();
    const refs = apiUrls.map(value => {
      const url = new URL(value || '');
      const ref = url.hostname.split('.')[0];
      if (!/^[a-z]{20}$/.test(ref) || url.hostname !== `${ref}.supabase.co` || url.protocol !== 'https:' ||
          url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new HealthDatabaseProbeError();
      }
      return ref;
    });
    const ref = refs[0];
    if (refs.some(value => value !== ref)) throw new HealthDatabaseProbeError();
    // Deployment-intent flags are configuration, not proof of a hosted environment.
    // NODE_ENV=production alone must never permit a local Production probe.
    if (ref === productionProjectRef && (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production')) {
      throw new HealthDatabaseProbeError();
    }
    const dbUrls = [env.DB_URL, env.SUPABASE_DB_URL, env.DATABASE_URL].filter(value => value !== undefined);
    if (dbUrls.length === 0) throw new HealthDatabaseProbeError();
    const configs = dbUrls.map(value => {
      const url = new URL(value || '');
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash) throw new HealthDatabaseProbeError();
      // Validate before pg's parser, which can otherwise load TLS files/override host.
      for (const [key, parameter] of url.searchParams) {
        if (key !== 'sslmode' || parameter !== 'verify-full' || url.searchParams.getAll(key).length !== 1) {
          throw new HealthDatabaseProbeError();
        }
      }
      const config = parse(value || '');
      const host = config.host;
      const port = Number(config.port || 5432);
      const direct = host === `db.${ref}.supabase.co`;
      const pooler = typeof host === 'string' && /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) &&
        config.user?.endsWith(`.${ref}`);
      if ((!direct && !pooler) || !config.user || !config.password || config.database !== 'postgres' ||
          ![5432, 6543].includes(port) || (direct && port !== 5432)) throw new HealthDatabaseProbeError();
      return { host: host || '', user: config.user, password: config.password, database: config.database, port };
    });
    const selected = configs[0];
    // Do not silently select between conflicting aliases, even for one project.
    if (configs.some(config => config.host !== selected.host || config.user !== selected.user ||
        config.password !== selected.password || config.port !== selected.port || config.database !== selected.database)) {
      throw new HealthDatabaseProbeError();
    }
    // No connectionString: it must not overwrite the verified TLS configuration.
    return { ...selected, ssl: { ca: supabaseRootCa, rejectUnauthorized: true, servername: selected.host },
      connectionTimeoutMillis: connectionTimeoutMs, query_timeout: 1500, statement_timeout: 1500,
      idle_in_transaction_session_timeout: 2000, application_name: 'bella-health-readonly' };
  } catch {
    throw new HealthDatabaseProbeError();
  }
}

async function bounded<T>(operation: Promise<T>, timeoutMs: number, expire: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expire(); reject(new HealthDatabaseProbeError()); }, timeoutMs);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

let inFlight: { config: ClientConfig; promise: Promise<void> } | undefined;

async function executeProbe(config: ClientConfig): Promise<void> {
    // Own the underlying socket so even a failed/hung graceful close is bounded.
    const socket = new Socket();
    let client: Client | undefined;
    let failed = false;
    let expired = false;
    try {
      client = new Client({ ...config, stream: () => socket });
      client.on('error', () => { failed = true; });
      const db = client;
      await bounded((async () => {
        await db.connect();
        if (expired) throw new HealthDatabaseProbeError();
        await db.query('BEGIN READ ONLY');
        try {
          if (expired) throw new HealthDatabaseProbeError();
          const result = await db.query<{ healthy: number }>('SELECT 1 AS healthy');
          if (result.rowCount !== 1 || result.rows.length !== 1 || result.rows[0].healthy !== 1) {
            throw new HealthDatabaseProbeError();
          }
        } finally {
          if (!expired) await db.query('ROLLBACK');
        }
      })(), probeTimeoutMs, () => { expired = true; });
    } catch {
      failed = true;
    } finally {
      try {
        if (client) await bounded(client.end(), closeTimeoutMs, () => { expired = true; });
      } catch {
        failed = true;
      } finally {
        socket.destroy();
      }
    }
    if (failed || expired) throw new HealthDatabaseProbeError();
}

/** A private Health-owner probe, with no business queries or caller-supplied SQL. */
export function createHealthDatabaseProbe(env: NodeJS.ProcessEnv = process.env): () => Promise<void> {
  const config = connectionConfig(env);
  return () => {
    // Coalesce concurrent requests only; completed health results are never cached.
    if (inFlight) {
      const active = inFlight.config;
      if (active.host !== config.host || active.user !== config.user || active.password !== config.password ||
          active.port !== config.port || active.database !== config.database) {
        return Promise.reject(new HealthDatabaseProbeError());
      }
      return inFlight.promise;
    }
    const promise = executeProbe(config).finally(() => { inFlight = undefined; });
    inFlight = { config, promise };
    return promise;
  };
}
