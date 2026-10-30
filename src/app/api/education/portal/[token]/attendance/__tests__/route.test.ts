/** @jest-environment node */
import { GET } from '../route';

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-key',
}));

jest.mock('@/products/bella-education/parent-portal/services/preschool-parent-portal.service', () => ({
  PreschoolParentPortalService: {
    verifyPortalToken: jest.fn().mockReturnValue({
      tenantId: 'ed100000-0000-0000-0000-000000000001',
      studentPartyId: 'be938bc0-8815-41b8-8609-e2c05ede085d',
      guardianPartyId: 'ed100000-0002-0000-0000-000000000001',
    }),
  },
  ParentPortalAccessError: class extends Error {
    constructor(public status: number, public code: string) {
      super(code);
    }
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'edu_enrollments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: 'enr-001' }, error: null }),
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
                    error: null,
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
                    error: null,
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
  });
});
