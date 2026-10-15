import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { MobilityError } from '../../../platform/mobility';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import { BookingAllocationError, createAllocatedBooking } from './AutoMoveBookingAllocationService';

// actorUserId is supplied only by the route's verified Supabase Auth identity.
export async function bookingAllocationHttp(request: Request, actorUserId: string, payload: unknown): Promise<Response> {
  let db: Client | undefined;
  try {
    const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!dbUrl || !apiUrl) throw new BookingAllocationError('DATABASE_NOT_CONFIGURED', 'Booking database is not configured.', 503);
    db = new Client(saleChainConnection(dbUrl, apiUrl));
    await db.connect();
    await db.query('begin isolation level serializable');
    await db.query("set local statement_timeout='30s'");
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actorUserId]);
    const result = await createAllocatedBooking(db, actorUserId, payload, request.headers.get('Idempotency-Key') ?? randomUUID());
    await db.query('commit');
    return Response.json({ success: true, booking: result.booking, isDuplicate: result.isDuplicate,
      message: `Booking ${result.booking.booking_number} đã được tạo thành công` });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof BookingAllocationError || error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof MobilityError) {
      const status = error.code === 'MOBILITY_NOT_FOUND' ? 404 : error.code === 'MOBILITY_AUTHORIZATION_DENIED' ? 403 : 409;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    if (error && typeof error === 'object' && 'code' in error && ['40001', '40P01'].includes(String(error.code))) {
      return Response.json({ error: 'Booking contention: retry with the same key.', code: 'BOOKING_RETRY_REQUIRED' }, { status: 409 });
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'Booking conflicts with existing data.', code: 'BOOKING_CONFLICT' }, { status: 409 });
    }
    return Response.json({ error: 'Booking allocation failed.' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
