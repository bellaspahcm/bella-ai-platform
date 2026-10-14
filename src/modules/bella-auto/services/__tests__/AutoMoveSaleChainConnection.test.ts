import { Client } from 'pg';
import { X509Certificate } from 'node:crypto';
import { saleChainConnection } from '../AutoMoveSaleChainConnection';

const ref = 'bmnbqbcdbuklhopfbopv';
const api = `https://${ref}.supabase.co`;
const url = `postgresql://postgres.${ref}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`;

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
  expect(()=>saleChainConnection(url+suffix,api)).toThrow('matching non-Production');
});

it('rejects Production, a wrong project, and invalid PostgreSQL/API URLs', () => {
  for (const [db,auth] of [
    [url, 'https://lvnvkpyxtuilhrabtlwv.supabase.co'],
    [url.replace(ref,'aaaaaaaaaaaaaaaaaaaa'),api],
    [url.replace('postgresql:','http:'),api],
    [url,api.replace('https:','http:')],
    [url.replace(':6543',':1234'),api],
  ]) expect(()=>saleChainConnection(db,auth)).toThrow('matching non-Production');
});

it('accepts verify-full but cannot let URI SSL settings replace the trusted CA', () => {
  expect(saleChainConnection(url+'?sslmode=verify-full',api).ssl).toMatchObject({rejectUnauthorized:true});
});
