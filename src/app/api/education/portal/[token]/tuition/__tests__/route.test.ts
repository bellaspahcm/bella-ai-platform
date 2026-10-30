/** @jest-environment node */
import { GET } from '../route';

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
  });
});
