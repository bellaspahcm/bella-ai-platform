/** @jest-environment node */
import { GET } from '../route';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

const mockAuthorizePortalToken = jest.fn();
const mockDataRead = jest.fn();
const claims = {
  tenantId: 'ed100000-0000-0000-0000-000000000001',
  studentPartyId: 'be938bc0-8815-41b8-8609-e2c05ede085d',
  guardianPartyId: 'ed100000-0002-0000-0000-000000000001',
  createdAt: Date.now(),
  exp: Date.now() + 86_400_000,
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
                  maybeSingle: () => Promise.resolve({ data: { id: 'enr-1', course_id: 'course-1' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'edu_daily_care_records') {
        return {
          select: () => ({
            eq: () => ({
              or: () => Promise.resolve({
                data: [
                  {
                    id: 'care-rec-1',
                    session_id: 'session-1',
                    student_party_id: 'be938bc0-8815-41b8-8609-e2c05ede085d',
                    student_id: null,
                    morning_condition: 'Vui vẻ, hoạt bát, nhiệt độ 36.6°C',
                    meal_records: [
                      { meal: 'Bữa sáng', food: 'Cháo sườn bắp non', amount: 'Hết phần', notes: 'Ăn ngon miệng' },
                      { meal: 'Bữa trưa', food: 'Cơm tấm sườn ram', amount: 'Hết phần', notes: 'Uống đủ nước' },
                    ],
                    nap_records: {
                      start_time: '12:00',
                      end_time: '14:15',
                      quality: 'Ngủ sâu, không giật mình',
                    },
                    health_checks: {
                      temperature: 36.6,
                      mood: 'Tốt',
                    },
                    hygiene_records: [
                      { type: 'Đi vệ sinh', count: 3, notes: 'Bình thường' },
                      { type: 'Uống nước', amount: '600ml trong ngày' },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'edu_daily_care_sessions') {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({
                data: [
                  {
                    id: 'session-1',
                    date: '2026-10-30',
                    class_id: 'course-1',
                  },
                ],
                error: null,
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

describe('GET /api/education/portal/[token]/care', () => {
  beforeEach(() => {
    mockAuthorizePortalToken.mockReset().mockResolvedValue(claims);
    mockDataRead.mockClear();
    jest.mocked(PreschoolParentPortalService.verifyPortalToken).mockReset().mockReturnValue(claims);
  });

  it('returns care summary with parsed meals, nap, health, and hygiene', async () => {
    const request = new Request('http://localhost/api/education/portal/valid-token/care?date=2026-10-30');
    const response = await GET(request, { params: Promise.resolve({ token: 'valid-token' }) });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: {
        selectedDate: string;
        currentRecord: {
          id: string;
          date: string;
          meals: Array<{ mealName: string; foodName: string; portion: string }>;
          nap: { timeRange: string; durationText: string; quality: string };
          health: { temperature: number; condition: string };
          hygiene: Array<{ type: string; detail: string }>;
        } | null;
        latestRecord: {
          date: string;
        } | null;
        overviewMealText: string;
        overviewNapText: string;
        overviewHealthText: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.selectedDate).toBe('2026-10-30');
    expect(body.data.currentRecord).not.toBeNull();
    expect(body.data.currentRecord?.date).toBe('2026-10-30');
    expect(body.data.currentRecord?.meals).toHaveLength(2);
    expect(body.data.currentRecord?.meals[0].foodName).toBe('Cháo sườn bắp non');
    expect(body.data.currentRecord?.nap?.timeRange).toBe('12:00 - 14:15');
    expect(body.data.currentRecord?.health?.temperature).toBe(36.6);
    expect(body.data.currentRecord?.hygiene).toHaveLength(2);
    expect(body.data.latestRecord?.date).toBe('2026-10-30');
    expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
  });

  it.each([
    { scenario: 'revoked guardian binding', status: 401, code: 'GUARDIAN_NOT_AUTHORIZED' },
    { scenario: 'token targeting another child without a current binding', status: 401, code: 'GUARDIAN_NOT_AUTHORIZED' },
    { scenario: 'guardian lookup dependency failure', status: 503, code: 'PORTAL_ACCESS_UNAVAILABLE' },
  ] as const)('does not read Care on $scenario', async ({ status, code }) => {
    mockAuthorizePortalToken.mockRejectedValue(new ParentPortalAccessError(status, code));
    const response = await GET(new Request('http://localhost/api/education/portal/valid-token/care?date=2026-10-30'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: code });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
    expect(mockDataRead).not.toHaveBeenCalled();
  });

  it('waits for current guardian authorization before any enrollment or Care query', async () => {
    let release: (value: typeof claims) => void = () => { throw new Error('Pending authorization not initialized'); };
    const pending = new Promise<typeof claims>(resolve => { release = resolve; });
    mockAuthorizePortalToken.mockReturnValue(pending);
    const responsePromise = GET(new Request('http://localhost/api/education/portal/valid-token/care'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
      expect(mockDataRead).not.toHaveBeenCalled();
    } finally {
      release(claims);
    }
    expect((await responsePromise).status).toBe(200);
    expect(mockDataRead).toHaveBeenCalledWith('edu_daily_care_records');
  });

  it('rejects an invalid signature before guardian lookup or child data access', async () => {
    jest.mocked(PreschoolParentPortalService.verifyPortalToken).mockImplementation(() => {
      throw new ParentPortalAccessError(401, 'TOKEN_SIGNATURE_MISMATCH');
    });
    const response = await GET(new Request('http://localhost/api/education/portal/invalid-token/care'), {
      params: Promise.resolve({ token: 'invalid-token' }),
    });
    expect(response.status).toBe(401);
    expect(mockAuthorizePortalToken).not.toHaveBeenCalled();
    expect(mockDataRead).not.toHaveBeenCalled();
  });
});

