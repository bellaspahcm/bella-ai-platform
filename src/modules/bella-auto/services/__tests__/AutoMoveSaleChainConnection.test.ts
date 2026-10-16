import { Client } from 'pg';
import { X509Certificate } from 'node:crypto';
import { saleChainConnection } from '../AutoMoveSaleChainConnection';

const ref = 'bmnbqbcdbuklhopfbopv';
const api = `https://${ref}.supabase.co`;
const url = `postgresql://postgres.${ref}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`;
const runtimeEnv = { VERCEL_ENV: process.env.VERCEL_ENV, AUTOMOVE_PRODUCTION_RUNTIME: process.env.AUTOMOVE_PRODUCTION_RUNTIME };
beforeEach(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.AUTOMOVE_PRODUCTION_RUNTIME;
});
afterAll(() => {
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

it('passes only a verified explicit effective config to pg with authenticated TLS', () => {
  const config = saleChainConnection(url,api);
  expect(config.connectionString).toBeUndefined();
  expect(config.ssl).toMatchObject({rejectUnauthorized:true,servername:'aws-1-ap-southeast-1.pooler.supabase.com'});
  const client = new Client(config);
  expect(client.host).toBe(config.host);
  expect(client.port).toBe(6543);
  if (typeof config.ssl !== 'object' || typeof config.ssl.ca !== 'string') throw Error('Trusted CA required');
  expect(new X509Certificate(config.ssl.ca).fingerprint256.replaceAll(':','')).toBe('807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA');
});

it.each([
  '?host=example.invalid','?user=postgres.other','?port=1234','?password=override',
  '?sslmode=no-verify','?sslmode=require','?ssl=false','?sslrootcert=untrusted.pem',
  '?sslmode=verify-full&sslmode=verify-full','?options=-c%20role=service_role',
])('fails closed on driver/config overrides: %s', suffix => {
  expect(()=>saleChainConnection(url+suffix,api)).toThrow('matching database');
});

it('rejects Production, a wrong project, and invalid PostgreSQL/API URLs', () => {
  for (const [db,auth] of [
    [url.replace(ref,'aaaaaaaaaaaaaaaaaaaa'),api],
    [url.replace('postgresql:','http:'),api],
    [url,api.replace('https:','http:')],
    [url.replace(':6543',':1234'),api],
  ]) expect(()=>saleChainConnection(db,auth)).toThrow('matching database');
});

it('accepts verify-full but cannot let URI SSL settings replace the trusted CA', () => {
  expect(saleChainConnection(url+'?sslmode=verify-full',api).ssl).toMatchObject({rejectUnauthorized:true});
});

const productionApi = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const productionUrl = url.replace(ref, 'lvnvkpyxtuilhrabtlwv');
it.each([undefined, '', 'disabled', 'true', 'ENABLED'])('keeps Production closed without the exact enabled flag: %s', flag => {
  process.env.VERCEL_ENV = 'production';
  if (flag !== undefined) process.env.AUTOMOVE_PRODUCTION_RUNTIME = flag;
  expect(() => saleChainConnection(productionUrl, productionApi)).toThrow('runtime is disabled');
});
it.each([undefined, 'preview', 'development', 'production '])('cannot enable Production from another deployment environment: %s', environment => {
  if (environment !== undefined) process.env.VERCEL_ENV = environment;
  process.env.AUTOMOVE_PRODUCTION_RUNTIME = 'enabled';
  expect(() => saleChainConnection(productionUrl, productionApi)).toThrow('runtime is disabled');
});
it('enables only the matching Production project with verified TLS, and fails closed again when disabled', () => {
  process.env.VERCEL_ENV = 'production';
  process.env.AUTOMOVE_PRODUCTION_RUNTIME = 'enabled';
  expect(saleChainConnection(productionUrl, productionApi)).toMatchObject({
    user: 'postgres.lvnvkpyxtuilhrabtlwv', ssl: { rejectUnauthorized: true, servername: 'aws-1-ap-southeast-1.pooler.supabase.com' },
  });
  expect(() => saleChainConnection(url, productionApi)).toThrow('matching database');
  expect(() => saleChainConnection(productionUrl, api)).toThrow('matching database');
  expect(() => saleChainConnection(productionUrl + '?sslmode=no-verify', productionApi)).toThrow('matching database');
  delete process.env.AUTOMOVE_PRODUCTION_RUNTIME;
  expect(() => saleChainConnection(productionUrl, productionApi)).toThrow('runtime is disabled');
});
