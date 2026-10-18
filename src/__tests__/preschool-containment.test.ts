/**
 * Owner-approved temporary HTTP hold, not authorization or DB/E2E proof.
 * Expected envelopes come from the immutable containment review patches.
 */
import { createServer, request as httpRequest } from 'node:http';
import { NextResponse } from 'next/server';
import { GET as parentDailyGet } from '@/app/api/education/parent-daily/route';
import { POST as coursePost } from '@/app/api/education/courses/route';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';
import { PreschoolParentDailyExperienceService } from '@/products/bella-education/services/preschool-parent-daily-experience.service';

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => { throw new Error('Unexpected authenticated DB client'); }),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => { throw new Error('Unexpected privileged DB client'); }),
}));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminKey: jest.fn(() => { throw new Error('Unexpected admin key access'); }),
  getSupabaseAdminUrl: jest.fn(() => { throw new Error('Unexpected admin URL access'); }),
}));
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(() => { throw new Error('Unexpected authority lookup'); }),
}));
jest.mock('@bella/shared', () => ({
  getLocalDateString: jest.fn(() => { throw new Error('Unexpected GET helper'); }),
}));
jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: jest.fn(() => { throw new Error('Unexpected teacher assignment'); }),
}));
jest.mock('@/products/bella-education/services/preschool-parent-daily-experience.service', () => ({
  PreschoolParentDailyExperienceService: jest.fn(() => { throw new Error('Unexpected parent read'); }),
}));

const heldEndpoints: Array<{
  path: string;
  method: 'GET' | 'POST';
  handle: (request: Request) => Promise<Response>;
  error: string;
  message: string;
  warning: string;
}> = [
  {
    path: '/api/education/parent-daily',
    method: 'GET',
    handle: parentDailyGet,
    error: 'PARENT_ACCESS_NOT_READY',
    message: 'Quyền truy cập hồ sơ phụ huynh đang được xác minh. Vui lòng liên hệ nhà trường.',
    warning: '[education/parent-daily] PARENT_ACCESS_NOT_READY',
  },
  {
    path: '/api/education/courses',
    method: 'POST',
    handle: coursePost,
    error: 'COURSE_AUTHORIZATION_NOT_READY',
    message: 'Quyền tạo lớp đang được xác minh. Vui lòng thử lại sau.',
    warning: '[education/courses] COURSE_AUTHORIZATION_NOT_READY',
  },
];

const downstreamTripwires = [
  createClient, createSupabaseClient, getSupabaseAdminKey, getSupabaseAdminUrl,
  getCurrentUser, TeacherAssignmentContractImpl, PreschoolParentDailyExperienceService,
];

describe('Preschool temporary HTTP containment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Unexpected downstream network request');
    });
  });

  afterEach(() => {
    for (const tripwire of downstreamTripwires) expect(tripwire).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  describe.each(heldEndpoints)('$method $path', (endpoint) => {
    test.each([
      ['anonymous', undefined],
      ['parent', 'synthetic-parent-token'],
      ['admin_staff', 'synthetic-staff-token'],
      ['other-tenant', 'synthetic-other-tenant-token'],
    ])('holds the %s request with the approved response', async (_actor, token) => {
      const request = new Request(`http://localhost${endpoint.path}?tenantId=synthetic-tenant&date=invalid`, {
        method: endpoint.method,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: endpoint.method === 'POST' ? '{"courseCode":"SYNTHETIC","teacherPartyId":"synthetic-teacher"}' : undefined,
      });

      const response = await endpoint.handle(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        success: false, error: endpoint.error, message: endpoint.message,
      });
      expect(request.bodyUsed).toBe(false);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(endpoint.warning);
    });

    test('does not inspect request properties or parse a body', async () => {
      const request = new Proxy(new Request(`http://localhost${endpoint.path}`, {
        method: endpoint.method,
        body: endpoint.method === 'POST' ? '{malformed' : undefined,
      }), {
        get() { throw new Error('Unexpected request access'); },
      });

      const response = await endpoint.handle(request);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        success: false, error: endpoint.error, message: endpoint.message,
      });
      expect(console.warn).toHaveBeenCalledWith(endpoint.warning);
    });
  });

  test('returns 503 before consuming malformed Course JSON', async () => {
    const request = new Request('http://localhost/api/education/courses', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{malformed',
    });
    const parse = jest.spyOn(request, 'json');

    const post: (request: Request) => Promise<Response> = coursePost;
    const response = await post(request);

    expect(response.status).toBe(503);
    expect(parse).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  test('serves both real handler responses over loopback HTTP', async () => {
    // This adapter proves response transport only; it is not Next routing/Auth/E2E evidence.
    const server = createServer((incoming, outgoing) => {
      const endpoint = heldEndpoints.find((item) => item.path === incoming.url && item.method === incoming.method);
      if (!endpoint) { outgoing.writeHead(404).end(); return; }
      const request = new Request(`http://localhost${endpoint.path}`, { method: endpoint.method });
      void endpoint.handle(request).then(async (response) => {
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(await response.text());
      }).catch((error: Error) => outgoing.destroy(error));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing loopback address');
      expect(address.address).toBe('127.0.0.1');

      for (const endpoint of heldEndpoints) {
        const result = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
          const call = httpRequest({ hostname: '127.0.0.1', port: address.port, path: endpoint.path, method: endpoint.method,
            headers: { 'content-type': 'application/json' } }, (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
            response.on('error', reject);
          });
          call.on('error', reject);
          call.end(endpoint.method === 'POST' ? '{malformed' : undefined);
        });
        expect(result.status).toBe(503);
        expect(JSON.parse(result.body)).toEqual({ success: false, error: endpoint.error, message: endpoint.message });
      }
      expect(console.warn).toHaveBeenCalledTimes(2);
      for (const endpoint of heldEndpoints) expect(console.warn).toHaveBeenCalledWith(endpoint.warning);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
