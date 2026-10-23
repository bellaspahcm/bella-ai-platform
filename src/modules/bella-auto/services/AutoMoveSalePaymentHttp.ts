import { Client } from 'pg';
import { createClient } from '@/lib/supabase-server';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import { AutoMoveSalePaymentService, SalePaymentError, paymentId } from './AutoMoveSalePaymentService';

export async function salePaymentHttp(request: Request, bookingId: string): Promise<Response> {
  let db: Client | undefined;
  try {
    paymentId(bookingId);
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const key = request.method === 'POST' ? request.headers.get('Idempotency-Key') : null;
    if (request.method === 'POST' && !key) throw new SalePaymentError('PAYMENT_KEY_REQUIRED', 'Idempotency-Key is required.', 400);
    let value: unknown;
    if (request.method === 'POST') {
      try { value = await request.json(); }
      catch { throw new SalePaymentError('INVALID_PAYMENT_JSON', 'Invalid JSON', 400); }
    }
    const url = process.env.AUTOMOVE_DATABASE_URL || process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !api) throw new SalePaymentError('PAYMENT_CONFIG_MISSING', 'Payment database is not configured.', 503);
    db = new Client(saleChainConnection(url, api));
    await db.connect();
    await db.query('begin isolation level read committed');
    await db.query("set local statement_timeout='30s'");
    await db.query("set local lock_timeout='10s'");
    await db.query('set local role authenticated');
    await db.query('set local row_security=on');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [user.id]);
    const service = new AutoMoveSalePaymentService(db, user.id);
    const result = key ? await service.collect(bookingId, key, value) : await service.state(bookingId);
    await db.query('commit');
    return Response.json({ success: true, result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof SalePaymentError || error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof SyntaxError) return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === '42501') return Response.json({ error: 'Access to this payment is denied.', code: 'PAYMENT_ACCESS_DENIED' }, { status: 403 });
      if (error.code === '23505') return Response.json({ error: 'Receipt key or transaction reference already exists.', code: 'PAYMENT_REFERENCE_CONFLICT' }, { status: 409 });
      if (['40001', '40P01', '55P03'].includes(String(error.code))) return Response.json({ error: 'Retry the same payment intent.', code: 'PAYMENT_RETRY_REQUIRED' }, { status: 409 });
    }
    return Response.json({ error: 'Payment could not be verified. Reload before retrying the same intent.' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
