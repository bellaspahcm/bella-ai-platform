import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: string, status: number, details?: string): NextResponse {
  return NextResponse.json({ success: false, error, message: details ?? error }, { status, headers: PRIVATE_HEADERS });
}

function createAdminClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;
  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface ConfirmAdmissionPayload {
  enrollmentId?: unknown;
  admissionMode?: unknown;
  note?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const session = await client.auth.getSession();
    if (session.error || !session.data.session?.access_token) {
      return failure('UNAUTHENTICATED', 401, 'Phiên đăng nhập đã hết hạn.');
    }

    const auth = await client.auth.getUser(session.data.session.access_token);
    if (auth.error || !auth.data.user) {
      return failure('UNAUTHENTICATED', 401, 'Phiên đăng nhập đã hết hạn.');
    }

    const profileResult = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profileResult.error) {
      return failure('PROFILE_ERROR', 403, 'Không thể xác thực hồ sơ người dùng.');
    }

    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    const role = (actor?.role ?? '').trim().toLowerCase();

    // STRICT RBAC: Only admin has authority to confirm admission
    if (!actor?.tenant_id || role !== 'admin') {
      return failure('ADMIN_ROLE_REQUIRED', 403, 'Chỉ Quản trị viên (Admin) mới có quyền xác nhận nhập học.');
    }

    let body: ConfirmAdmissionPayload;
    try {
      body = (await request.json()) as ConfirmAdmissionPayload;
    } catch {
      return failure('INVALID_PAYLOAD', 400, 'Dữ liệu yêu cầu không hợp lệ.');
    }

    const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId.trim() : '';
    const admissionMode = body.admissionMode === 'DEBT' ? 'DEBT' : 'PAID';

    if (!enrollmentId || !UUID_PATTERN.test(enrollmentId)) {
      return failure('INVALID_ENROLLMENT_ID', 400, 'Mã ghi danh không hợp lệ.');
    }

    const adminClient = createAdminClient() ?? client;

    // 1. Fetch enrollment
    const { data: enrollment, error: enrollmentError } = await adminClient
      .from('edu_enrollments')
      .select('id, tenant_id, student_party_id, course_id, status, request_id')
      .eq('id', enrollmentId)
      .eq('tenant_id', actor.tenant_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return failure('ENROLLMENT_NOT_FOUND', 404, 'Không tìm thấy hồ sơ ghi danh của học sinh.');
    }

    // Idempotency: if already active
    if (enrollment.status === 'active') {
      return NextResponse.json({
        success: true,
        enrollment: {
          id: enrollment.id,
          status: 'active',
          courseId: enrollment.course_id,
        },
        admissionMode,
        message: 'Học sinh đã ở trạng thái Đang hoạt động.',
      }, { status: 200, headers: PRIVATE_HEADERS });
    }

    // 2. Fetch student details for invoice association
    const { data: student } = await adminClient
      .from('students')
      .select('student_id, party_id, student_code')
      .eq('tenant_id', actor.tenant_id)
      .eq('party_id', enrollment.student_party_id)
      .maybeSingle();

    // 3. Financial Invoicing & Settlement
    const todayStr = new Date().toISOString().slice(0, 10);
    const due15DaysStr = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

    // Get active billing period
    const { data: activePeriod } = await adminClient
      .from('edu_fin_billing_periods')
      .select('id')
      .eq('tenant_id', actor.tenant_id)
      .eq('status', 'ACTIVE')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const billingPeriodId = activePeriod?.id ?? 'ed100000-d001-0000-0000-000000000001';

    // Check existing invoice for this student
    const studentPartyId = enrollment.student_party_id;
    const studentId = student?.student_id;

    let invoiceFilter = adminClient
      .from('edu_fin_invoices')
      .select('id, invoice_number, net_amount, paid_amount, outstanding_amount, settlement_status')
      .eq('tenant_id', actor.tenant_id);

    if (studentId) {
      invoiceFilter = invoiceFilter.or(`student_party_id.eq.${studentPartyId},student_id.eq.${studentId}`);
    } else {
      invoiceFilter = invoiceFilter.eq('student_party_id', studentPartyId);
    }

    const { data: existingInvoices } = await invoiceFilter
      .order('created_at', { ascending: false })
      .limit(1);

    const existingInvoice = existingInvoices?.[0];

    if (existingInvoice) {
      if (admissionMode === 'PAID' && existingInvoice.settlement_status !== 'PAID') {
        const remaining = Number(existingInvoice.outstanding_amount) || Number(existingInvoice.net_amount) || 5700000;
        await adminClient
          .from('edu_fin_invoices')
          .update({
            settlement_status: 'PAID',
            paid_amount: Number(existingInvoice.net_amount) || remaining,
            outstanding_amount: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInvoice.id)
          .eq('tenant_id', actor.tenant_id);

        await adminClient
          .from('edu_fin_payments')
          .insert({
            id: globalThis.crypto.randomUUID(),
            tenant_id: actor.tenant_id,
            payer_party_id: studentPartyId,
            student_id: studentId ?? null,
            student_party_id: studentPartyId,
            payment_number: `PAY-${Date.now().toString().slice(-6)}`,
            payment_method: 'CASH',
            amount: remaining,
            allocated_amount: remaining,
            unallocated_amount: 0,
            reference_number: `THU-HOC-PHI-NHAP-HOC-${student?.student_code ?? ''}`,
            payment_date: new Date().toISOString(),
            status: 'COMPLETED',
            created_by: auth.data.user.id,
          });
      }
    } else {
      // Create canonical tuition invoice for admission
      const invoiceId = globalThis.crypto.randomUUID();
      const codeSuffix = student?.student_code ? student.student_code.replace(/\D/g, '') : Date.now().toString().slice(-4);
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${codeSuffix || '001'}`;
      const totalFee = 5700000;
      const isPaid = admissionMode === 'PAID';

      await adminClient
        .from('edu_fin_invoices')
        .insert({
          id: invoiceId,
          tenant_id: actor.tenant_id,
          student_id: studentId ?? null,
          student_party_id: studentPartyId,
          billing_period_id: billingPeriodId,
          invoice_number: invoiceNumber,
          invoice_status: 'ISSUED',
          settlement_status: isPaid ? 'PAID' : 'UNPAID',
          gross_amount: totalFee,
          discount_amount: 0,
          net_amount: totalFee,
          paid_amount: isPaid ? totalFee : 0,
          outstanding_amount: isPaid ? 0 : totalFee,
          issued_at: new Date().toISOString(),
          due_date: isPaid ? todayStr : due15DaysStr,
          is_archived: false,
          created_by: auth.data.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      // Line items
      await adminClient
        .from('edu_fin_invoice_line_items')
        .insert([
          {
            id: globalThis.crypto.randomUUID(),
            tenant_id: actor.tenant_id,
            invoice_id: invoiceId,
            item_type: 'TUITION',
            description: 'Học phí Khối Mầm non (Tháng nhập học)',
            unit_price: 4500000,
            quantity: 1,
            subtotal_amount: 4500000,
            source_domain: 'FINANCE_CATALOG',
            source_entity_type: 'FEE_STRUCTURE',
            created_at: new Date().toISOString(),
          },
          {
            id: globalThis.crypto.randomUUID(),
            tenant_id: actor.tenant_id,
            invoice_id: invoiceId,
            item_type: 'MEAL_FEE',
            description: 'Tiền ăn bán trú 3 bữa/ngày (Tháng nhập học)',
            unit_price: 1200000,
            quantity: 1,
            subtotal_amount: 1200000,
            source_domain: 'FINANCE_CATALOG',
            source_entity_type: 'FEE_STRUCTURE',
            created_at: new Date().toISOString(),
          },
        ]);

      if (isPaid) {
        await adminClient
          .from('edu_fin_payments')
          .insert({
            id: globalThis.crypto.randomUUID(),
            tenant_id: actor.tenant_id,
            payer_party_id: studentPartyId,
            student_id: studentId ?? null,
            student_party_id: studentPartyId,
            payment_number: `PAY-${Date.now().toString().slice(-6)}`,
            payment_method: 'CASH',
            amount: totalFee,
            allocated_amount: totalFee,
            unallocated_amount: 0,
            reference_number: `THU-HOC-PHI-NHAP-HOC-${student?.student_code ?? ''}`,
            payment_date: new Date().toISOString(),
            status: 'COMPLETED',
            created_by: auth.data.user.id,
          });
      }
    }

    // 4. Activate enrollment
    const { error: activateError } = await adminClient
      .from('edu_enrollments')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollment.id)
      .eq('tenant_id', actor.tenant_id);

    if (activateError) {
      return failure('ACTIVATION_FAILED', 500, 'Không thể cập nhật trạng thái học sinh.');
    }

    // 5. Update course headcount
    const { count: activeCount } = await adminClient
      .from('edu_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', enrollment.course_id)
      .eq('tenant_id', actor.tenant_id)
      .eq('status', 'active');

    if (activeCount !== null) {
      await adminClient
        .from('edu_courses')
        .update({
          current_enrollment: activeCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment.course_id)
        .eq('tenant_id', actor.tenant_id);
    }

    return NextResponse.json({
      success: true,
      enrollment: {
        id: enrollment.id,
        status: 'active',
        courseId: enrollment.course_id,
      },
      admissionMode,
      message: admissionMode === 'PAID'
        ? 'Đã xác nhận nhập học thành công (Học phí đã hoàn tất).'
        : 'Đã xác nhận nhập học thành công (Ghi nhận công nợ học phí cho phụ huynh).',
    }, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[confirm-admission] Unexpected error:', error);
    return failure('CONFIRM_ADMISSION_UNAVAILABLE', 500, 'Đã xảy ra lỗi khi xác nhận nhập học.');
  }
}

