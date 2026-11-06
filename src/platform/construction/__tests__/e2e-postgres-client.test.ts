import { createConstructionE2eDatabaseClient } from './support/e2e-postgres-client';

const CA_CERTIFICATE = [
  '-----BEGIN CERTIFICATE-----',
  'YWJj',
  '-----END CERTIFICATE-----',
].join('\n');

describe('Construction E2E PostgreSQL TLS client', () => {
  it('uses the configured CA with certificate verification and removes URL TLS overrides', () => {
    const client = createConstructionE2eDatabaseClient(
      'postgresql://db.bmnbqbcdbuklhopfbopv.supabase.co:5432/postgres'
        + '?sslmode=require&sslrootcert=%2Ftmp%2Fca.crt&ssl=1',
      CA_CERTIFICATE,
    );

    expect(client.connectionParameters.ssl).toEqual({
      ca: CA_CERTIFICATE,
      rejectUnauthorized: true,
    });
  });

  it('supports escaped newlines and Base64 PEM configuration', () => {
    const escapedCertificate = CA_CERTIFICATE.replace(/\n/g, '\\n');
    const client = createConstructionE2eDatabaseClient(
      'postgresql://db.bmnbqbcdbuklhopfbopv.supabase.co:5432/postgres',
      escapedCertificate,
    );

    expect(client.connectionParameters.ssl).toEqual({
      ca: CA_CERTIFICATE,
      rejectUnauthorized: true,
    });

    const base64Client = createConstructionE2eDatabaseClient(
      'postgresql://db.bmnbqbcdbuklhopfbopv.supabase.co:5432/postgres',
      Buffer.from(CA_CERTIFICATE).toString('base64'),
    );

    expect(base64Client.connectionParameters.ssl).toEqual({
      ca: CA_CERTIFICATE,
      rejectUnauthorized: true,
    });
  });

  it('does not require a CA for the local Supabase database', () => {
    const client = createConstructionE2eDatabaseClient(
      'postgresql://localhost:54322/postgres?sslmode=require',
      '',
    );

    expect(client.connectionParameters.ssl).toBeFalsy();
  });

  it('fails closed when a remote CA is missing or invalid', () => {
    const connectionString = 'postgresql://db.bmnbqbcdbuklhopfbopv.supabase.co:5432/postgres';

    expect(() => createConstructionE2eDatabaseClient(connectionString, '')).toThrow(
      'CONSTRUCTION_E2E_DATABASE_TLS_CA_NOT_CONFIGURED',
    );
    expect(() => createConstructionE2eDatabaseClient(connectionString, 'not-a-certificate')).toThrow(
      'CONSTRUCTION_E2E_DATABASE_TLS_CA_INVALID',
    );
  });
});
