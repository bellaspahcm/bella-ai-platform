import type { MobilitySqlClient as SqlClient } from '../../../platform/mobility';

type Row = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DepositConfirmationError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !uuid.test(value)) {
    throw new DepositConfirmationError('INVALID_DEPOSIT_REQUEST', `${field} must be a UUID.`, 400);
  }
  return value.toLowerCase();
}
function optionalText(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new DepositConfirmationError('INVALID_DEPOSIT_REQUEST', `${field} must be text.`, 400);
  return value.trim() || null;
}
function balance(booking: Row) {
  const paid = Number(booking.deposit_paid), required = Number(booking.deposit_amount);
  if (!Number.isSafeInteger(paid) || !Number.isSafeInteger(required) || paid < 0 || required < paid) {
    throw new DepositConfirmationError('INVALID_DEPOSIT_BALANCE', 'Booking deposit balance is invalid.');
  }
  return { paid, required };
}
function result(booking: Row, receiptId: string, isDuplicate: boolean) {
  const { paid, required } = balance(booking);
  if (typeof booking.payment_status !== 'string') throw new DepositConfirmationError('INVALID_DEPOSIT_BALANCE', 'Booking payment status is invalid.');
  return { isDuplicate, data: { deposit_id: receiptId, new_deposit_paid: paid,
    payment_status: booking.payment_status, remaining: required - paid } };
}

// Caller owns the transaction and authenticated SQL context. The row lock keeps
// retries and independent payments from racing on the same aggregate balance.
export async function confirmBookingDeposit(db: SqlClient, actorUserId: string, bookingId: string, key: string, value: unknown) {
  const actor = identifier(actorUserId, 'actor'), booking = identifier(bookingId, 'bookingId'), receiptId = identifier(key, 'Idempotency-Key');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DepositConfirmationError('INVALID_DEPOSIT_REQUEST', 'A deposit object is required.', 400);
  const body = value as Row;
  if (Object.keys(body).some(field => !['amount', 'payment_method', 'transaction_ref', 'notes'].includes(field))) {
    throw new DepositConfirmationError('INVALID_DEPOSIT_REQUEST', 'Unexpected deposit fields.', 400);
  }
  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new DepositConfirmationError('INVALID_DEPOSIT_AMOUNT', 'A positive integer VND amount is required.', 400);
  }
  const method = optionalText(body.payment_method, 'payment_method') || 'cash';
  const reference = optionalText(body.transaction_ref, 'transaction_ref'), notes = optionalText(body.notes, 'notes');
  const profile = (await db.query(`select u.tenant_id from public.users u join public.tenants t on t.id=u.tenant_id
    where u.id=$1 and u.status='active' and t.status='active'`, [actor])).rows[0];
  if (!profile || typeof profile.tenant_id !== 'string') throw new DepositConfirmationError('ACTOR_NOT_AUTHORIZED', 'An active tenant identity is required.', 403);
  const tenantId = profile.tenant_id;
  const stored = (await db.query(`select id,tenant_id,deposit_amount,deposit_paid,payment_status,status
    from public.auto_bookings where id=$1 and tenant_id=$2 for update`, [booking, tenantId])).rows[0];
  if (!stored) throw new DepositConfirmationError('BOOKING_NOT_FOUND', 'Booking is unavailable for this tenant.', 404);
  const existing = (await db.query(`select id,booking_id,amount,payment_method,transaction_ref,notes,status,created_by,confirmed_by
    from public.auto_deposits where id=$1 and tenant_id=$2`, [receiptId, tenantId])).rows[0];
  if (existing) {
    if (existing.booking_id !== booking || existing.created_by !== actor || existing.confirmed_by !== actor ||
        existing.status !== 'confirmed' || Number(existing.amount) !== amount || existing.payment_method !== method ||
        existing.transaction_ref !== reference || existing.notes !== notes) {
      throw new DepositConfirmationError('DEPOSIT_IDEMPOTENCY_CONFLICT', 'Deposit key already belongs to another confirmation.');
    }
    return result(stored, receiptId, true);
  }
  const { paid, required } = balance(stored);
  if (amount > required - paid) throw new DepositConfirmationError('DEPOSIT_EXCEEDS_REQUIRED_AMOUNT', 'Deposit exceeds the booking requirement.', 400);
  const newPaid = paid + amount;
  const paymentStatus = newPaid >= required ? 'fully_paid' : 'partially_paid';
  const inserted = await db.query(`insert into public.auto_deposits
    (id,tenant_id,booking_id,amount,payment_method,transaction_ref,notes,status,created_by,confirmed_by,confirmed_at)
    values ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$8,now()) returning id`,
  [receiptId, tenantId, booking, amount, method, reference, notes, actor]);
  if (inserted.rows[0]?.id !== receiptId) throw new DepositConfirmationError('DEPOSIT_NOT_PERSISTED', 'Receipt was not persisted.');
  const updated = (await db.query(`update public.auto_bookings set deposit_paid=$1,payment_status=$2
    where id=$3 and tenant_id=$4 returning deposit_amount,deposit_paid,payment_status`, [newPaid, paymentStatus, booking, tenantId])).rows[0];
  if (!updated || Number(updated.deposit_paid) !== newPaid || updated.payment_status !== paymentStatus) {
    throw new DepositConfirmationError('DEPOSIT_NOT_PERSISTED', 'Booking balance was not persisted.');
  }
  return result(updated, receiptId, false);
}
