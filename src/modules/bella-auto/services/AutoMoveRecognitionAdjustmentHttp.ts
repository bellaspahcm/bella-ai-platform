import { Client } from 'pg';
import { createClient } from '@/lib/supabase-server';
import { AccountingPeriodGuardError } from '@/core/services/accounting/period-guards';
import { createSaleChainBearerClient } from './AutoMoveSaleChainHttp';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import { paymentId, SalePaymentError } from './AutoMoveSalePaymentService';
import { AutoMoveRecognitionAdjustmentService, RecognitionAdjustmentError } from './AutoMoveRecognitionAdjustmentService';

export async function recognitionAdjustmentHttp(request: Request, bookingId: string): Promise<Response> {
  let db: Client | undefined, disconnected: Error | undefined;
  try {
    paymentId(bookingId);
    let client = await createClient();
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL, authorization = request.headers.get('authorization');
    if (authorization) {
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!api || !key) throw new RecognitionAdjustmentError('ADJUSTMENT_CONFIG', 503);
      client = createSaleChainBearerClient(authorization, api, key);
    }
    const { data: { user }, error } = await client.auth.getUser(authorization?.slice(7));
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const key = request.method === 'POST' ? request.headers.get('Idempotency-Key') : null;
    if (request.method === 'POST' && !key) throw new RecognitionAdjustmentError('ADJUSTMENT_KEY_REQUIRED', 400);
    let value: unknown;
    if (key) { paymentId(key); try { value = await request.json(); } catch { throw new RecognitionAdjustmentError('ADJUSTMENT_INVALID_JSON', 400); } }
    const url = process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!api || !url) throw new RecognitionAdjustmentError('ADJUSTMENT_CONFIG', 503);
    db = new Client({ ...saleChainConnection(url, api), query_timeout: 35000 });
    db.on('error', (error: Error) => { disconnected = error; });
    await db.connect(); await db.query('begin isolation level serializable');
    await db.query("set local statement_timeout='30s'"); await db.query("set local lock_timeout='10s'");
    await db.query("set local idle_in_transaction_session_timeout='45s'");
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [user.id]);
    const service = new AutoMoveRecognitionAdjustmentService(db, user.id, async document => {
      const { data, error: failure } = await client.storage.from(document.bucket).download(document.path);
      if (failure || !data) throw new RecognitionAdjustmentError('ADJUSTMENT_DOCUMENT_UNAVAILABLE');
      if (data.size > 20 * 1024 * 1024) throw new RecognitionAdjustmentError('ADJUSTMENT_DOCUMENT_SIZE', 400);
      return new Uint8Array(await data.arrayBuffer());
    });
    const result = key ? await service.execute(bookingId, key, value) : await service.state(bookingId);
    if (disconnected) throw disconnected;
    await db.query('commit');
    return Response.json({ success: true, result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof RecognitionAdjustmentError || error instanceof SalePaymentError || error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof AccountingPeriodGuardError) return Response.json({ error: error.message, code: error.code }, { status: error.code.endsWith('FORBIDDEN') ? 403 : 409 });
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '42501') return Response.json({ error: 'Access denied.', code: 'ADJUSTMENT_FORBIDDEN' }, { status: 403 });
    if (['23505', '40001', '40P01', '55P03'].includes(code)) return Response.json({ error: 'Retry the same intent.', code: 'ADJUSTMENT_RETRY_REQUIRED' }, { status: 409 });
    return Response.json({ error: 'Adjustment could not be verified.', code: 'ADJUSTMENT_UNVERIFIED' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
