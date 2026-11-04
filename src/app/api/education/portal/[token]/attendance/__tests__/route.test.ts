/** @jest-environment node */
import { GET } from '../route';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

const mockAuthorizePortalToken = jest.fn();
const mockDataRead = jest.fn();
const mockQueryError = jest.fn();
const mockEnrollment = jest.fn();
const claims = {
  tenantId: 'ed100000-0000-0000-0000-000000000001',
  studentPartyId: 'be938bc0-8815-41b8-8609-e2c05ede085d',
  guardianPartyId: 'ed100000-0002-0000-0000-000000000001',
  createdAt: Date.now(), exp: Date.now() + 86_400_000,
};

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-key',
}));

jest.mock('@/products/bella-education/parent-portal/services/preschool-parent-portal.service', () => ({
  PreschoolParentPortalService: Object.assign(jest.fn().mockImplementation(() => ({
    authorizePortalToken: (token: string) => mockAuthorizePortalToken(token),
  })), {
    verifyPortalToken: jest.fn().mockReturnValue({
      tenantId: 'ed100000-0000-0000-0000-000000000001',
      studentPartyId: 'be938bc0-8815-41b8-8609-e2c05ede085d',
      guardianPartyId: 'ed100000-0002-0000-0000-000000000001',
    }),
  }),
  ParentPortalAccessError: class extends Error {
    constructor(public status: number, public code: string) {
      super(code);
    }
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      mockDataRead(table);
      if (table === 'edu_enrollments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: mockEnrollment(), error: mockQueryError(table) }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'edu_attendance_daily_state') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      { id: 'att-1', school_day: '2026-10-31', status: 'present', updated_at: null },
                    ],
                    error: mockQueryError(table),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'edu_attendance') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      { status: 'present', roll_call_time: '2026-10-31T05:00:00Z' },
                    ],
                    error: mockQueryError(table),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    },
  }),
}));

describe('GET /api/education/portal/[token]/attendance', () => {
  beforeEach(() => {
    mockAuthorizePortalToken.mockReset().mockResolvedValue(claims);
    mockDataRead.mockClear();
    mockQueryError.mockReset().mockReturnValue(null);
    mockEnrollment.mockReset().mockReturnValue({ id: 'enr-001' });
    jest.mocked(PreschoolParentPortalService.verifyPortalToken).mockReset().mockReturnValue(claims);
  });

  it('returns attendance history and summary for a verified token', async () => {
    const request = new Request('http://localhost/api/education/portal/valid-token/attendance');
    const response = await GET(request, { params: Promise.resolve({ token: 'valid-token' }) });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: {
        history: Array<{
          id: string;
          schoolDay: string;
          dayLabel: string;
          status: string;
          statusLabel: string;
        }>;
        totalMarked: number;
        presentCount: number;
        attendanceRatePercent: number;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.history).toHaveLength(1);
    expect(body.data.history[0].schoolDay).toBe('2026-10-31');
    expect(body.data.history[0].status).toBe('present');
    expect(body.data.history[0].statusLabel).toBe('Có mặt');
    expect(body.data.totalMarked).toBe(1);
    expect(body.data.presentCount).toBe(1);
    expect(body.data.attendanceRatePercent).toBe(100);
    expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
  });

  it.each([
    { status: 401, code: 'GUARDIAN_NOT_AUTHORIZED' },
    { status: 503, code: 'PORTAL_ACCESS_UNAVAILABLE' },
  ] as const)('does not read attendance when authorization returns $code', async ({ status, code }) => {
    mockAuthorizePortalToken.mockRejectedValue(new ParentPortalAccessError(status, code));
    const response = await GET(new Request('http://localhost/api/education/portal/valid-token/attendance'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: code });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockDataRead).not.toHaveBeenCalled();
  });

  it('waits for current guardian authorization before enrollment or attendance reads', async () => {
    let release: (value: typeof claims) => void = () => { throw new Error('Authorization not initialized'); };
    mockAuthorizePortalToken.mockReturnValue(new Promise<typeof claims>(resolve => { release = resolve; }));
    const responsePromise = GET(new Request('http://localhost/api/education/portal/valid-token/attendance'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
      expect(mockDataRead).not.toHaveBeenCalled();
    } finally { release(claims); }
    expect((await responsePromise).status).toBe(200);
  });

  it('rejects an invalid signature before guardian lookup or private reads', async () => {
    jest.mocked(PreschoolParentPortalService.verifyPortalToken).mockImplementation(() => {
      throw new ParentPortalAccessError(401, 'TOKEN_SIGNATURE_MISMATCH');
    });
    const response = await GET(new Request('http://localhost/api/education/portal/invalid-token/attendance'), {
      params: Promise.resolve({ token: 'invalid-token' }),
    });
    expect(response.status).toBe(401);
    expect(mockAuthorizePortalToken).not.toHaveBeenCalled();
    expect(mockDataRead).not.toHaveBeenCalled();
  });

  it.each(['edu_enrollments', 'edu_attendance_daily_state', 'edu_attendance'])('returns unavailable when %s fails', async table => {
    mockQueryError.mockImplementation((resource: string) => resource === table ? { code: 'XX000', message: 'private DB detail' } : null);
    const response = await GET(new Request('http://localhost/api/education/portal/valid-token/attendance'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: 'PORTAL_ATTENDANCE_UNAVAILABLE' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('preserves the empty summary when no active enrollment exists without a query error', async () => {
    mockEnrollment.mockReturnValue(null);
    const response = await GET(new Request('http://localhost/api/education/portal/valid-token/attendance'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: {
      history: [], totalMarked: 0, presentCount: 0, attendanceRatePercent: null,
    } });
    expect(mockDataRead.mock.calls).toEqual([['edu_enrollments']]);
  });
});
