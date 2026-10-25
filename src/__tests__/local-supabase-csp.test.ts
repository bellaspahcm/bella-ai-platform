import { NextRequest } from 'next/server';
import type { NextConfig } from 'next';

jest.mock('@sentry/nextjs', () => ({ withSentryConfig: (config: NextConfig) => config }));
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }),
}));

async function policies(): Promise<string[]> {
  const { default: config } = await import('../../next.config');
  const { proxy } = await import('@/proxy');
  const headers = await config.headers?.();
  const appHeaders = headers?.find(entry => entry.source === '/((?!user-manuals).*)');
  const configCsp = appHeaders?.headers.find(header => header.key === 'Content-Security-Policy')?.value;
  const response = await proxy(new NextRequest('http://localhost:3006/login'));
  const proxyCsp = response.headers.get('Content-Security-Policy');
  if (!configCsp || !proxyCsp) throw new Error('CSP_REQUIRED_IN_BOTH_LAYERS');
  return [configCsp, proxyCsp];
}

describe('development Supabase CSP boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'development',
      DEPLOYMENT_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:24531',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key' });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['http://127.0.0.1:24531', 'http://localhost:24531'])('allows only configured origin %s', async origin => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
    for (const csp of await policies()) {
      const connect = csp.split('; ').find(directive => directive.startsWith('connect-src '))?.split(' ');
      expect(connect).toContain(origin);
      expect(connect).not.toContain('http://127.0.0.1:24532');
      expect(connect).not.toContain('http://localhost:*');
      expect(csp).toContain("frame-ancestors 'self'");
    }
  });

  it.each([
    '', 'invalid', 'http://localhost', 'http://localhost:80', 'https://localhost:24531',
    'http://127.0.0.2:24531', 'http://localhost.attacker.test:24531', 'http://192.168.1.1:24531',
    'http://user:password@localhost:24531', 'http://localhost:24531/path',
    'http://localhost:24531/?query=value', 'http://localhost:24531/#hash',
  ])('adds no origin for rejected configuration %s', async url => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    for (const csp of await policies()) expect(csp).not.toMatch(/http:\/\//);
  });

  it.each([
    ['production', 'production'], ['production', 'development'], ['test', 'development'],
    ['development', 'production'], ['development', 'staging'],
  ])('keeps local origin closed in NODE_ENV=%s DEPLOYMENT_ENV=%s', async (nodeEnv, deploymentEnv) => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: nodeEnv, DEPLOYMENT_ENV: deploymentEnv });
    for (const csp of await policies()) expect(csp).not.toContain('http://127.0.0.1:24531');
  });
});
