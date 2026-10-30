import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import {
  ParentPortalAccessError,
  PreschoolParentPortalService,
} from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';
import type {
  PortalTuitionInvoice,
  PortalTuitionSummary,
  ParentPortalVietQrPayload,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type EducationSupabaseClient = SupabaseClient<Database>;

interface RawInvoiceRow {
  readonly id: string;
  readonly invoice_number: string;
  readonly net_amount: number | null;
  readonly paid_amount: number | null;
  readonly outstanding_amount: number | null;
  readonly settlement_status: string;
  readonly invoice_status: string;
  readonly issued_at: string;
  readonly due_date: string | null;
  readonly billing_period_id: string | null;
  readonly edu_fin_billing_periods: {
    readonly period_name: string;
  } | null;
}

interface RawTenantRow {
  readonly name: string | null;
  readonly qr_bank_code: string | null;
  readonly qr_account_number: string | null;
  readonly qr_account_name: string | null;
}

async function getOperationClient(): Promise<EducationSupabaseClient> {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (adminUrl && adminKey) {
    return createSupabaseClient<Database>(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return (await createClient()) as unknown as EducationSupabaseClient;
}

function mapSettlementStatus(raw: string): 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' {
  const upper = raw.trim().toUpperCase();
  if (upper === 'PAID') return 'PAID';
  if (upper === 'PARTIALLY_PAID' || upper === 'PARTIAL') return 'PARTIALLY_PAID';
  return 'UNPAID';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'TOKEN_REQUIRED', message: 'Token phụ huynh là bắt buộc' },
        { status: 401, headers: PRIVATE_HEADERS }
      );
    }

    const claims = PreschoolParentPortalService.verifyPortalToken(token);
    const supabase = await getOperationClient();

    // Query real invoices for this student
    const [invoicesResult, tenantResult] = await Promise.all([
      supabase
        .from('edu_fin_invoices')
        .select(`
          id,
          invoice_number,
          net_amount,
          paid_amount,
          outstanding_amount,
          settlement_status,
          invoice_status,
          issued_at,
          due_date,
          billing_period_id,
          edu_fin_billing_periods (
            period_name
          )
        `)
        .eq('tenant_id', claims.tenantId)
        .or(`student_party_id.eq.${claims.studentPartyId},student_id.eq.${claims.studentPartyId}`)
        .order('issued_at', { ascending: false })
        .limit(12),
      supabase
        .from('tenants')
        .select('name, qr_bank_code, qr_account_number, qr_account_name')
        .eq('id', claims.tenantId)
        .maybeSingle(),
    ]);

    if (invoicesResult.error) {
      return NextResponse.json(
        { success: false, error: 'PORTAL_TUITION_UNAVAILABLE' },
        { status: 503, headers: PRIVATE_HEADERS }
      );
    }

    const rawInvoices = (invoicesResult.data ?? []) as unknown as readonly RawInvoiceRow[];
    const tenant = (tenantResult.data ?? null) as unknown as RawTenantRow | null;

    const invoices: PortalTuitionInvoice[] = rawInvoices.map((inv) => {
      const net = Number(inv.net_amount) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const outstanding = Number(inv.outstanding_amount) || 0;
      const periodName = inv.edu_fin_billing_periods?.period_name ?? null;

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        billingPeriodName: periodName,
        netAmount: net,
        paidAmount: paid,
        outstandingAmount: outstanding,
        settlementStatus: mapSettlementStatus(inv.settlement_status),
        invoiceStatus: inv.invoice_status,
        issuedAt: inv.issued_at,
        dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
      };
    });

    const totalDue = invoices.reduce((sum, i) => sum + i.netAmount, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

    const latestInvoice = invoices.length > 0 ? invoices[0] : null;

    let vietQrPayload: ParentPortalVietQrPayload | undefined;
    if (totalOutstanding > 0 && latestInvoice) {
      const bankCode = tenant?.qr_bank_code?.trim() || 'MB';
      const accountNumber = tenant?.qr_account_number?.trim() || '1608618121986';
      const accountName = tenant?.qr_account_name?.trim() || tenant?.name?.trim() || 'TRUONG MAM NON ANH DUONG';
      const description = `HOCPHI ${latestInvoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}`;
      const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${totalOutstanding}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

      vietQrPayload = {
        bankCode,
        accountNumber,
        accountName,
        amount: totalOutstanding,
        description,
        qrUrl,
      };
    }

    const summary: PortalTuitionSummary = {
      invoices,
      latestInvoice,
      totalDue,
      totalPaid,
      totalOutstanding,
      vietQrPayload,
    };

    return NextResponse.json(
      { success: true, data: summary },
      { headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_TUITION_UNAVAILABLE',
      },
      { status: error instanceof ParentPortalAccessError ? error.status : 500, headers: PRIVATE_HEADERS }
    );
  }
}
