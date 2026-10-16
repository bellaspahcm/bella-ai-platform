import { Client } from 'pg';
import { createClient } from '@/lib/supabase-server';
import { createSaleChainBearerClient } from './AutoMoveSaleChainHttp';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import { SalePaymentError, paymentId } from './AutoMoveSalePaymentService';
import { AutoMoveSettlementService, SettlementError } from './AutoMoveSettlementService';

export async function settlementHttp(request: Request, bookingId: string): Promise<Response> {
  let db: Client | undefined;
  let connectionFailure: Error | undefined;
  try {
    paymentId(bookingId);
    let client = await createClient();
    const authorization = request.headers.get('authorization');
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (authorization) {
      const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!api || !publicKey) throw new SettlementError('SETTLEMENT_AUTH_CONFIG', 'Auth configuration is required.', 503);
      client = createSaleChainBearerClient(authorization, api, publicKey);
    }
    const { data: { user }, error } = await client.auth.getUser(authorization?.slice(7));
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const key = request.method === 'POST' ? request.headers.get('Idempotency-Key') : null;
    if (request.method === 'POST' && !key) throw new SettlementError('SETTLEMENT_KEY_REQUIRED', 'Idempotency-Key is required.', 400);
    let value: unknown;
    if (key) {
      paymentId(key);
      try { value = await request.json(); }
      catch { throw new SettlementError('SETTLEMENT_INVALID_JSON', 'Invalid JSON', 400); }
    }
    const url = process.env.AUTOMOVE_DATABASE_URL || process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!api || !url) throw new SettlementError('SETTLEMENT_CONFIG', 'Settlement database is not configured.', 503);
    db = new Client({ ...saleChainConnection(url, api), query_timeout: 35000 });
    // An idle disconnect during Storage verification must fail this request,
    // not become an uncaught process exception or replay a financial command.
    db.on('error', (error: Error) => { connectionFailure = error; });
    await db.connect();
    await db.query('begin isolation level serializable');
    await db.query("set local statement_timeout='30s'");
    await db.query("set local lock_timeout='10s'");
    await db.query("set local idle_in_transaction_session_timeout='45s'");
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [user.id]);
    const service = new AutoMoveSettlementService(db, user.id, async document => {
      const { data, error: storageError } = await client.storage.from(document.bucket).download(document.path);
      if (storageError || !data) throw new SettlementError('SETTLEMENT_DOCUMENT_UNAVAILABLE', 'Document is missing or inaccessible.');
      if (data.size > 20 * 1024 * 1024) throw new SettlementError('SETTLEMENT_DOCUMENT_SIZE', 'Document exceeds 20 MB.', 400);
      return new Uint8Array(await data.arrayBuffer());
    });
    const result = key ? await service.execute(bookingId, key, value) : await service.state(bookingId);
    if (connectionFailure) throw connectionFailure;
    await db.query('commit');
    return Response.json({ success: true, result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof SettlementError || error instanceof SalePaymentError || error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof SyntaxError) return Response.json({ error: 'Invalid JSON', code: 'SETTLEMENT_INVALID_JSON' }, { status: 400 });
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '42501') return Response.json({ error: 'Access denied.', code: 'SETTLEMENT_FORBIDDEN' }, { status: 403 });
    if (['40001','40P01','55P03','23505'].includes(code)) return Response.json({ error: 'Reload and retry the same intent.', code: 'SETTLEMENT_RETRY_REQUIRED' }, { status: 409 });
    return Response.json({ error: 'Settlement could not be verified.', code: 'SETTLEMENT_UNVERIFIED' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
