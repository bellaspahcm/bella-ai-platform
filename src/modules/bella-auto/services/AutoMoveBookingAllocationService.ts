import { createHash, randomUUID } from 'node:crypto';
import {
  MobilityFoundationService, PostgresMobilityRepository,
  MOBILITY_ALLOWED_STATUS_TRANSITIONS,
  type MobilityActor, type MobilitySqlClient,
} from '../../../platform/mobility';

type Row = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BookingAllocationError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) {
    super(message);
  }
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BookingAllocationError('INVALID_BOOKING', `${field} is required.`, 400);
  return value.trim();
}
function identifier(value: unknown, field: string): string {
  const result = required(value, field);
  if (!uuid.test(result)) throw new BookingAllocationError('INVALID_BOOKING', `${field} must be a UUID.`, 400);
  return result.toLowerCase();
}
function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new BookingAllocationError('INVALID_BOOKING', `${field} must be a non-negative integer VND amount.`, 400);
  }
  return value;
}
function responseBooking(row: Row): Row {
  return { ...row, total_price: Number(row.total_price), deposit_amount: Number(row.deposit_amount), deposit_paid: Number(row.deposit_paid) };
}

// The caller owns the authenticated serializable transaction. Mobility owns all
// vehicle reads/writes; a failed transition must roll back the booking as well.
export async function createAllocatedBooking(db: MobilitySqlClient, userId: string, value: unknown, key: string) {
  identifier(userId, 'actor');
  const bookingId = identifier(key, 'Idempotency-Key');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookingAllocationError('INVALID_BOOKING', 'A booking object is required.', 400);
  const body = value as Row;
  const allowed = ['customerId', 'customerPhone', 'customerName', 'customerAddress', 'variantId', 'vehicleId', 'colorExterior', 'totalPrice', 'depositAmount', 'depositPaid'];
  if (Object.keys(body).some(field => !allowed.includes(field))) throw new BookingAllocationError('INVALID_BOOKING', 'Unexpected booking fields.', 400);
  const input = {
    customerId: body.customerId ? identifier(body.customerId, 'customerId') : null,
    customerPhone: required(body.customerPhone, 'customerPhone'),
    customerName: required(body.customerName, 'customerName'),
    customerAddress: typeof body.customerAddress === 'string' ? body.customerAddress.trim() : null,
    variantId: identifier(body.variantId, 'variantId'), vehicleId: identifier(body.vehicleId, 'vehicleId'),
    colorExterior: required(body.colorExterior, 'colorExterior'),
    totalPrice: amount(body.totalPrice, 'totalPrice'), depositAmount: amount(body.depositAmount, 'depositAmount'),
    depositPaid: amount(body.depositPaid ?? 0, 'depositPaid'),
  };
  if (!input.totalPrice || input.depositAmount > input.totalPrice || input.depositPaid > input.totalPrice) {
    throw new BookingAllocationError('INVALID_BOOKING', 'Invalid booking/deposit amounts.', 400);
  }
  const profile = (await db.query(`select u.tenant_id,u.role from public.users u
    join public.tenants t on t.id=u.tenant_id
    where u.id=$1 and u.status='active' and t.status='active'`, [userId])).rows[0];
  if (!profile || typeof profile.tenant_id !== 'string' || typeof profile.role !== 'string') {
    throw new BookingAllocationError('ACTOR_NOT_AUTHORIZED', 'An active tenant identity is required.', 403);
  }
  const actor: MobilityActor = { userId, tenantId: profile.tenant_id, roles: [profile.role] };
  const mobility = new MobilityFoundationService(new PostgresMobilityRepository(db, true), {
    ensureAllowed: async params => {
      if (params.actor.userId !== actor.userId || params.actor.tenantId !== actor.tenantId || params.tenantId !== actor.tenantId) {
        throw new BookingAllocationError('TENANT_MISMATCH', 'Mobility actor mismatch.', 403);
      }
    },
  }, { next: () => randomUUID() }, { now: () => new Date().toISOString() });
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`automove-booking:${bookingId}`]);
  const existing = (await db.query('select * from public.auto_bookings where id=$1 and tenant_id=$2', [bookingId, actor.tenantId])).rows[0];
  if (existing) {
    const metadata = existing.metadata as Row | null;
    if (metadata?.bookingRequestHash !== requestHash || metadata?.createdByUserId !== userId) {
      throw new BookingAllocationError('IDEMPOTENCY_CONFLICT', 'Booking retry key was used with another request.');
    }
    const trace = await mobility.getVehicleTrace(actor, { vehicleId: input.vehicleId });
    if (trace.vehicle.allocatedToContractId !== bookingId) throw new BookingAllocationError('ALLOCATION_MISMATCH', 'Persisted booking allocation no longer matches.');
    return { booking: responseBooking(existing), isDuplicate: true };
  }

  const trace = await mobility.getVehicleTrace(actor, { vehicleId: input.vehicleId });
  if (trace.vehicle.variantId !== input.variantId || trace.vehicle.colorExterior !== input.colorExterior) {
    throw new BookingAllocationError('VEHICLE_MISMATCH', 'Selected vehicle does not match the booking variant/color.');
  }
  if (trace.vehicle.allocatedToContractId || !MOBILITY_ALLOWED_STATUS_TRANSITIONS[trace.vehicle.status].includes('allocated')) {
    throw new BookingAllocationError('DUPLICATE_VIN', 'Vehicle is already allocated or unavailable for allocation.');
  }
  const duplicate = await db.query(`select id from public.auto_bookings where tenant_id=$1 and vehicle_id=$2
    and status in ('pending','confirmed','pending_deposit','deposit_confirmed','awaiting_delivery') limit 1`, [actor.tenantId, input.vehicleId]);
  if (duplicate.rows.length) throw new BookingAllocationError('DUPLICATE_VIN', 'Vehicle already belongs to another active booking.');
  let customerId = input.customerId;
  if (customerId) {
    const customer = await db.query('select id from public.customers where id=$1 and tenant_id=$2', [customerId, actor.tenantId]);
    if (!customer.rows.length) throw new BookingAllocationError('CUSTOMER_MISMATCH', 'Booking customer is outside tenant.', 403);
  } else {
    customerId = randomUUID();
    await db.query('insert into public.customers(id,tenant_id,name_mother,phone,address) values ($1,$2,$3,$4,$5)',
      [customerId, actor.tenantId, input.customerName, input.customerPhone, input.customerAddress]);
  }
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`automove-booking-number:${actor.tenantId}:${datePrefix}`]);
  const last = (await db.query(`select booking_number from public.auto_bookings
    where tenant_id=$1 and booking_number like $2 order by booking_number desc limit 1`, [actor.tenantId, `BA-${datePrefix}-%`])).rows[0];
  const sequence = last ? Number(String(last.booking_number).split('-')[2]) + 1 : 1;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new BookingAllocationError('BOOKING_NUMBER_INVALID', 'Existing booking sequence is invalid.');
  const number = `BA-${datePrefix}-${String(sequence).padStart(4, '0')}`;
  const booking = (await db.query(`insert into public.auto_bookings
    (id,tenant_id,booking_number,customer_id,variant_id,vehicle_id,color_exterior,total_price,deposit_amount,deposit_paid,status,metadata)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) returning *`,
  [bookingId, actor.tenantId, number, customerId, input.variantId, input.vehicleId, input.colorExterior,
    input.totalPrice, input.depositAmount, input.depositPaid, input.depositPaid > 0 ? 'deposit_confirmed' : 'pending_deposit',
    JSON.stringify({ createdByUserId: userId, bookingRequestHash: requestHash })])).rows[0];
  const allocation = await mobility.transitionVehicleStatus(actor, {
    vehicleId: input.vehicleId, toStatus: 'allocated', allocatedToContractId: bookingId,
    idempotencyKey: `automove-booking-allocation:${bookingId}`,
    reason: `Booking ${number}`, metadata: { bookingId },
  });
  if (allocation.value.allocatedToContractId !== bookingId) throw new BookingAllocationError('ALLOCATION_MISMATCH', 'Mobility allocation was not persisted for this booking.');
  return { booking: responseBooking(booking), isDuplicate: false };
}
