import { GET } from '../route';
import { createHealthDatabaseProbe, HealthDatabaseProbeError } from '../database-probe';

jest.mock('../database-probe', () => {
  const actual = jest.requireActual<typeof import('../database-probe')>('../database-probe');
  return { ...actual, createHealthDatabaseProbe: jest.fn() };
});

const createProbe = jest.mocked(createHealthDatabaseProbe);
const probe = jest.fn();
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, DEPLOYMENT_ENV: 'production-candidate' };
  probe.mockResolvedValue(undefined);
  createProbe.mockReturnValue(probe);
});

afterAll(() => { process.env = originalEnv; });

it('returns the existing healthy contract with environment, timing and no-store after the executed probe', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'uptime', 'environment', 'checks', '_timing'].sort());
  expect(body).toMatchObject({ status: 'healthy', environment: 'production-candidate', checks: { database: 'ok' },
    uptime: expect.any(Number), timestamp: expect.any(String), _timing: {
      next_handler_ms: expect.any(Number), db_client_init_ms: expect.any(Number), db_query_ms: expect.any(Number),
    } });
  expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
  expect(probe).toHaveBeenCalledTimes(1);
  expect(response.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
  expect(response.headers.get('Server-Timing')).toMatch(/next_handler;dur=\d+\.\d, db_client_init;dur=\d+\.\d, db_query;dur=\d+\.\d, serialization;dur=\d+\.\d/);
});

it.each(['configuration', 'database'])('returns sanitized503 for a known %s failure, retaining the unhealthy keys and timing', async stage => {
  if (stage === 'configuration') createProbe.mockImplementation(() => { throw new HealthDatabaseProbeError(); });
  else probe.mockRejectedValue(new HealthDatabaseProbeError());
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'checks', 'errors', '_timing'].sort());
  expect(body).toMatchObject({ status: 'unhealthy', checks: { database: 'failed' },
    errors: ['Database: Database connectivity check failed'], _timing: {
      next_handler_ms: expect.any(Number), db_client_init_ms: expect.any(Number), db_query_ms: expect.any(Number),
    } });
  expect(response.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
  expect(response.headers.get('Server-Timing')).toMatch(/next_handler;dur=\d+\.\d, db_client_init;dur=\d+\.\d, db_query;dur=\d+\.\d/);
});

it('retains generic500 for unexpected internal failure without exposing any private error text', async () => {
  probe.mockRejectedValue(new Error('postgresql://private-user:private-password@private-host/postgres'));
  const response = await GET();
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'error'].sort());
  expect(body).toMatchObject({ status: 'error', error: 'Health check failed' });
  expect(JSON.stringify(body)).not.toMatch(/private-|postgresql/);
  expect(response.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
});

it('waits for the probe before reporting healthy', async () => {
  let complete: (() => void) | undefined;
  probe.mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
  let resolved = false;
  const response = GET().then(value => { resolved = true; return value; });
  await Promise.resolve();
  expect(resolved).toBe(false);
  complete?.();
  expect((await response).status).toBe(200);
});
