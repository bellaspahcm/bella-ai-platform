import { Client } from 'pg';

const TLS_CONNECTION_PARAMETERS = [
  'ssl',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslnegotiation',
];

export function createConstructionE2eDatabaseClient(
  connectionString: string,
  caCertificate: string,
): Client {
  const connectionUrl = new URL(connectionString);
  const isLocal = connectionUrl.hostname === 'localhost'
    || connectionUrl.hostname === '127.0.0.1';

  for (const parameter of TLS_CONNECTION_PARAMETERS) {
    connectionUrl.searchParams.delete(parameter);
  }

  if (isLocal) {
    return new Client({ connectionString: connectionUrl.toString() });
  }

  return new Client({
    connectionString: connectionUrl.toString(),
    ssl: {
      ca: normalizeCaCertificate(caCertificate),
      rejectUnauthorized: true,
    },
  });
}

function normalizeCaCertificate(value: string): string {
  const normalized = value.trim().replace(/\\n/g, '\n');
  const candidates = [normalized, Buffer.from(normalized, 'base64').toString('utf8').trim()];
  const certificate = candidates.find((candidate) => (
    candidate.includes('-----BEGIN CERTIFICATE-----')
    && candidate.includes('-----END CERTIFICATE-----')
  ));

  if (!certificate) {
    throw new Error(
      normalized
        ? 'CONSTRUCTION_E2E_DATABASE_TLS_CA_INVALID'
        : 'CONSTRUCTION_E2E_DATABASE_TLS_CA_NOT_CONFIGURED',
    );
  }

  return certificate;
}
