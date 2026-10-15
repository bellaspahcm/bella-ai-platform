import { Client } from 'pg';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import { confirmBookingDeposit, DepositConfirmationError } from './AutoMoveDepositConfirmationService';

export async function depositConfirmationHttp(request: Request, actorUserId: string, bookingId: string): Promise<Response> {
  let db: Client | undefined;
  try {
    const key = request.headers.get('Idempotency-Key');
    if (!key) throw new DepositConfirmationError('DEPOSIT_KEY_REQUIRED', 'Idempotency-Key is required for a deposit confirmation.', 400);
    let payload: unknown;
    try { payload = await request.json(); }
    catch { throw new DepositConfirmationError('INVALID_DEPOSIT_REQUEST', 'Invalid JSON.', 400); }
    const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!dbUrl || !apiUrl) throw new DepositConfirmationError('DATABASE_NOT_CONFIGURED', 'Deposit database is not configured.', 503);
    db = new Client(saleChainConnection(dbUrl, apiUrl));
    await db.connect();
    await db.query('begin isolation level read committed');
    await db.query("set local statement_timeout='30s'");
    await db.query("set local lock_timeout='10s'");
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actorUserId]);
    const result = await confirmBookingDeposit(db, actorUserId, bookingId, key, payload);
    await db.query('commit');
    return Response.json({ success: true, ...result,
      message: result.data.remaining === 0 ? 'Đã xác nhận cọc đủ. Booking có thể tiến hành bàn giao xe.'
        : `Đã xác nhận cọc. Khách hàng còn thiếu ${result.data.remaining} VNĐ` });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof DepositConfirmationError || error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === '23505') return Response.json({ error: 'Deposit key conflicts with an existing confirmation.', code: 'DEPOSIT_IDEMPOTENCY_CONFLICT' }, { status: 409 });
      if (['40001', '40P01', '55P03'].includes(String(error.code))) return Response.json({ error: 'Retry the deposit with the same key.', code: 'DEPOSIT_RETRY_REQUIRED' }, { status: 409 });
    }
    return Response.json({ error: 'Deposit confirmation failed.' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
