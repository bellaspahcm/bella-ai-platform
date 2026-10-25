import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const mockGetUser = jest.fn();
let mockCookieAction: 'set' | 'remove' | null = null;
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn((_url: string, _key: string, options: { cookies: {
    set: (name: string, value: string, options: object) => void;
    remove: (name: string, options: object) => void;
  } }) => ({ auth: { getUser: async () => {
    if (mockCookieAction === 'set') options.cookies.set('fixture', 'value', {});
    if (mockCookieAction === 'remove') options.cookies.remove('fixture', {});
    return mockGetUser();
  } }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'admin' }, error: null }) }) }) }) })),
}));

describe('proxy preserves catalog read cache semantics', () => {
  it.each([null, 'set', 'remove'] as const)('keeps only exact Portal endpoints private after cookie %s', async action => {
    mockCookieAction = action;
    for (const user of [null, { id: 'auth-id' }]) for (const path of ['/token', '/signed-token', '/signed-token/chat', '/signed-token/copilot']) {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      expect((await proxy(new NextRequest('http://localhost/api/education/portal' + path))).headers.get('cache-control')).toBe('private, no-store');
    }
    for (const path of ['', '/signed-token/other', '/signed-token/chat/extra']) {
      // Existing proxy recreates cookie responses without the default header on unrelated paths.
      // Preserve that neighboring behavior; only approved exact Portal endpoints are changed.
      expect((await proxy(new NextRequest('http://localhost/api/education/portal' + path))).headers.get('cache-control')).toBe(action === null ? 'no-store, must-revalidate' : null);
    }
  });
  beforeEach(() => {
    mockCookieAction = null;
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
  });

  it.each([null, 'set', 'remove'] as const)('keeps private/no-store after cookie %s for catalog success or denial', async action => {
    mockCookieAction = action;
    for (const user of [null, { id: 'auth-id' }]) {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      for (const suffix of ['', '/course-id']) {
        const response = await proxy(new NextRequest('http://localhost/api/education/courses' + suffix + '?view=catalog'));
        expect(response.headers.get('cache-control')).toBe('private, no-store');
      }
    }
  });

  it.each(['?view=catalog&view=catalog', '?view=invalid&view=catalog'])('keeps malformed catalog denials private: %s', async query => {
    const response = await proxy(new NextRequest('http://localhost/api/education/courses' + query));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([
    ['/api/education/courses', 'GET'], ['/api/education/courses/id', 'GET'],
    ['/api/education/courses/id/teachers?view=catalog', 'GET'],
    ['/api/education/courses?view=catalog', 'POST'], ['/api/education/attendance/handover', 'GET'],
    ['/api/education/announcements/other', 'GET'],
  ])('preserves default policy for %s %s', async (pathname, method) => {
    const response = await proxy(new NextRequest('http://localhost' + pathname, { method }));
    expect(response.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });

  it.each(['/api/education/care/bulk', '/api/education/care/classes'])('preserves existing Care policy: %s', async pathname => {
    const response = await proxy(new NextRequest('http://localhost' + pathname));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([null, 'set', 'remove'] as const)('keeps exact Attendance responses private after cookie %s', async action => {
    mockCookieAction = action;
    for (const method of ['GET', 'POST']) {
      for (const user of [null, { id: 'auth-id' }]) {
        mockGetUser.mockResolvedValue({ data: { user }, error: null });
        const response = await proxy(new NextRequest('http://localhost/api/education/attendance?view=roster', { method }));
        expect(response.headers.get('cache-control')).toBe('private, no-store');
      }
    }
  });
  it.each([null, 'set', 'remove'] as const)('keeps exact Enrollment responses private after cookie %s', async action => {
    mockCookieAction = action;
    for (const method of ['GET', 'POST']) for (const user of [null, { id: 'auth-id' }]) {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      const response = await proxy(new NextRequest('http://localhost/api/education/enrollments?view=candidates', { method }));
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect((await proxy(new NextRequest('http://localhost/api/education/enrollments/other'))).headers.get('cache-control')).toBe(action === null ? 'no-store, must-revalidate' : null);
  });
  it.each([null, 'set', 'remove'] as const)('keeps exact school announcement API responses private after cookie %s', async action => {
    mockCookieAction = action;
    for (const method of ['GET', 'POST']) {
      const response = await proxy(new NextRequest('http://localhost/api/education/announcements', { method }));
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it.each([null, 'set', 'remove'] as const)('keeps exact Analytics/Finance responses private after cookie %s', async action => {
    mockCookieAction = action;
    for (const endpoint of ['analytics', 'finance']) for (const method of ['GET', 'POST']) for (const user of [null, { id: 'auth-id' }]) {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      const response = await proxy(new NextRequest(`http://localhost/api/education/${endpoint}?tenantId=foreign`, { method }));
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    for (const path of ['/api/education/analytics/history', '/api/education/finance/other', '/api/education/finance/']) {
      expect((await proxy(new NextRequest('http://localhost' + path))).headers.get('cache-control')).toBe(action === null ? 'no-store, must-revalidate' : null);
    }
  });

});
