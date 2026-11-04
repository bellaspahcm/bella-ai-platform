/** @jest-environment node */
import { GET } from '../route';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

const mockAuthorizePortalToken = jest.fn();
const mockDataRead = jest.fn();
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

const mockInvoice = {
  id: 'ed100000-f001-0000-0000-000000000101',
  invoice_number: 'INV-202610-5698',
  net_amount: 5700000,
  paid_amount: 5700000,
  outstanding_amount: 0,
  settlement_status: 'PAID',
  invoice_status: 'ISSUED',
  issued_at: '2026-10-01T01:00:00Z',
  due_date: '2026-10-05',
  billing_period_id: 'ed100000-d001-0000-0000-000000000001',
  edu_fin_billing_periods: {
    period_name: 'Học phí & Tiền ăn Tháng 10/2026',
  },
};

const mockTenant = {
  name: 'Trường Mầm non Ánh Dương',
  qr_bank_code: 'MB',
  qr_account_number: '1608618121986',
  qr_account_name: 'TRUONG MAM NON ANH DUONG',
};

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
      if (table === 'edu_fin_invoices') {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [mockInvoice], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockTenant, error: null }),
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

describe('GET /api/education/portal/[token]/tuition', () => {
  beforeEach(() => {
    mockAuthorizePortalToken.mockReset().mockResolvedValue(claims);
    mockDataRead.mockClear();
    jest.mocked(PreschoolParentPortalService.verifyPortalToken).mockReset().mockReturnValue(claims);
  });

  it('returns tuition invoices and summary for a verified token', async () => {
    const request = new Request('http://localhost/api/education/portal/valid-token/tuition');
    const response = await GET(request, { params: Promise.resolve({ token: 'valid-token' }) });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: {
        invoices: Array<{
          invoiceNumber: string;
          netAmount: number;
          paidAmount: number;
          outstandingAmount: number;
          settlementStatus: string;
          billingPeriodName: string;
        }>;
        totalDue: number;
        totalPaid: number;
        totalOutstanding: number;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.invoices).toHaveLength(1);
    expect(body.data.invoices[0].invoiceNumber).toBe('INV-202610-5698');
    expect(body.data.invoices[0].netAmount).toBe(5700000);
    expect(body.data.invoices[0].paidAmount).toBe(5700000);
    expect(body.data.invoices[0].outstandingAmount).toBe(0);
    expect(body.data.invoices[0].settlementStatus).toBe('PAID');
    expect(body.data.invoices[0].billingPeriodName).toBe('Học phí & Tiền ăn Tháng 10/2026');
    expect(body.data.totalOutstanding).toBe(0);
    expect(mockAuthorizePortalToken).toHaveBeenCalledWith('valid-token');
  });

  it.each([
    { status: 401, code: 'GUARDIAN_NOT_AUTHORIZED' },
    { status: 503, code: 'PORTAL_ACCESS_UNAVAILABLE' },
  ] as const)('does not read invoices or banking metadata when authorization returns $code', async ({ status, code }) => {
    mockAuthorizePortalToken.mockRejectedValue(new ParentPortalAccessError(status, code));
    const response = await GET(new Request('http://localhost/api/education/portal/valid-token/tuition'), {
      params: Promise.resolve({ token: 'valid-token' }),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: code });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockDataRead).not.toHaveBeenCalled();
  });

  it('waits for current guardian authorization before invoice or tenant reads', async () => {
    let release: (value: typeof claims) => void = () => { throw new Error('Authorization not initialized'); };
    mockAuthorizePortalToken.mockReturnValue(new Promise<typeof claims>(resolve => { release = resolve; }));
    const responsePromise = GET(new Request('http://localhost/api/education/portal/valid-token/tuition'), {
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
    const response = await GET(new Request('http://localhost/api/education/portal/invalid-token/tuition'), {
      params: Promise.resolve({ token: 'invalid-token' }),
    });
    expect(response.status).toBe(401);
    expect(mockAuthorizePortalToken).not.toHaveBeenCalled();
    expect(mockDataRead).not.toHaveBeenCalled();
  });
});
