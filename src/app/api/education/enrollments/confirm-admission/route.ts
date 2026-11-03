import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(error: string, status: number, message = error): NextResponse {
  return NextResponse.json({ success: false, error, message }, { status, headers: PRIVATE_HEADERS });
}

interface ConfirmAdmissionPayload {
  enrollmentId?: unknown;
  admissionMode?: unknown;
  paymentConfirmation?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasManualPaymentEvidence(value: unknown): boolean {
  if (!isObject(value) || (value.method !== 'CASH' && value.method !== 'BANK_TRANSFER_MANUAL')) return false;
  if (['actorId', 'actorUserId', 'actorPartyId', 'actorRole', 'tenantId', 'collectorId',
    'actor_id', 'actor_user_id', 'actor_party_id', 'actor_role', 'tenant_id', 'collector_id'].some(key => key in value)) return false;
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0) return false;
  if (typeof value.receivedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.receivedAt)
      || !Number.isFinite(Date.parse(value.receivedAt))) return false;
  return value.method !== 'BANK_TRANSFER_MANUAL'
    || (typeof value.transactionId === 'string' && value.transactionId.trim().length > 0);
}

/**
 * Existing-enrollment activation plus tuition settlement has no verified
 * atomic Product contract. Keep this endpoint closed until that
 * workflow has a canonical persistence and recovery boundary.
 */
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
      return failure('PROFILE_ERROR', 503, 'Không thể xác thực hồ sơ người dùng.');
    }

    const actor = reconcileCurrentActorProfile(auth.data.user.id, profileResult.data);
    if (!actor?.tenant_id || actor.role !== 'admin') {
      return failure('ADMIN_ROLE_REQUIRED', 403, 'Chỉ Quản trị viên (Admin) mới có quyền xác nhận nhập học.');
    }

    let body: ConfirmAdmissionPayload;
    try {
      const parsed: unknown = await request.json();
      if (!isObject(parsed)) return failure('INVALID_PAYLOAD', 400, 'Dữ liệu yêu cầu không hợp lệ.');
      body = parsed as ConfirmAdmissionPayload;
    } catch {
      return failure('INVALID_PAYLOAD', 400, 'Dữ liệu yêu cầu không hợp lệ.');
    }

    const enrollmentId = typeof body.enrollmentId === 'string' ? body.enrollmentId.trim() : '';
    if (!UUID_PATTERN.test(enrollmentId)) {
      return failure('INVALID_ENROLLMENT_ID', 400, 'Mã ghi danh không hợp lệ.');
    }
    if (body.admissionMode !== undefined && body.admissionMode !== 'PAID' && body.admissionMode !== 'DEBT') {
      return failure('INVALID_ADMISSION_MODE', 400, 'Phương thức xác nhận không hợp lệ.');
    }
    if ((body.admissionMode ?? 'DEBT') === 'PAID') {
      if (isObject(body.paymentConfirmation) && body.paymentConfirmation.method === 'BANK_TRANSFER_AUTO') {
        return failure('AUTOMATED_RECONCILIATION_ONLY', 403, 'Giao dịch đối soát tự động phải được xác nhận bởi hệ thống.');
      }
      if (!hasManualPaymentEvidence(body.paymentConfirmation)) {
        return failure('PAYMENT_EVIDENCE_REQUIRED', 400, 'Cần phương thức, số tiền, thời điểm nhận và mã giao dịch khi chuyển khoản.');
      }
    } else if (body.paymentConfirmation !== undefined) {
      return failure('UNEXPECTED_PAYMENT_EVIDENCE', 400, 'Xác nhận công nợ không ghi nhận thanh toán.');
    }

    return failure(
      'ADMISSION_CONFIRMATION_UNAVAILABLE',
      503,
      'Luồng xác nhận ghi danh và học phí đang tạm dừng cho đến khi có thao tác lưu trữ chuẩn, atomic và có thể khôi phục.',
    );
  } catch {
    return failure('CONFIRM_ADMISSION_UNAVAILABLE', 503, 'Không thể xác nhận nhập học an toàn lúc này.');
  }
}
