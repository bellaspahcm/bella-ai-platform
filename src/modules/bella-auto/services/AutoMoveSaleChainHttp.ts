import { Client } from 'pg';
import { createClient } from '@/lib/supabase-server';
import { AutoMoveSaleChainService, type DocumentDownload } from './AutoMoveSaleChainService';
import { VehicleSaleRecognitionError } from './VehicleSaleRecognitionService';
import type { MobilitySqlClient } from '@/platform/mobility';
import { createClient as createUserClient } from '@supabase/supabase-js';
import { saleChainConnection } from './AutoMoveSaleChainConnection';

export type SaleChainAction = 'state' | 'snapshot' | 'draft-update' | 'approve' | 'handover' | 'recognize';

export function createSaleChainBearerClient(authorization: string, apiUrl: string, publicKey: string) {
  if (!/^Bearer \S+$/.test(authorization)) throw new VehicleSaleRecognitionError('UNAUTHORIZED','Unauthorized',401);
  return createUserClient(apiUrl,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
}

export async function executeSaleChainAction(params: {
  action: SaleChainAction; payload: unknown; actorUserId: string;
  db: MobilitySqlClient; download: DocumentDownload;
}) {
  const service = new AutoMoveSaleChainService(params.db, params.actorUserId, params.download);
  await service.authorize();
  switch (params.action) {
    case 'state': {
      if (typeof params.payload !== 'string' || !/^[a-f0-9-]{36}$/i.test(params.payload)) {
        throw new VehicleSaleRecognitionError('INVALID_BOOKING', 'A booking UUID is required.');
      }
      return service.state(params.payload);
    }
    case 'snapshot': return service.createSnapshot(params.payload);
    case 'draft-update': return service.updateDraft(params.payload);
    case 'approve': return service.approve(params.payload);
    case 'handover': return service.handover(params.payload);
    case 'recognize': return service.recognize(params.payload);
  }
}

export async function saleChainHttp(request: Request, action: SaleChainAction): Promise<Response> {
  let db: Client | undefined;
  try {
    let userClient = await createClient();
    const authorization = request.headers.get('authorization');
    if (authorization) {
      if (!/^Bearer \S+$/.test(authorization)) return Response.json({error:'Unauthorized'},{status:401});
      const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!apiUrl || !publicKey) throw new VehicleSaleRecognitionError('AUTH_NOT_CONFIGURED','Public Auth configuration is required.',503);
      userClient = createSaleChainBearerClient(authorization,apiUrl,publicKey);
    }
    const { data: { user }, error } = await userClient.auth.getUser(authorization?.slice(7));
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const dbUrl = process.env.AUTOMOVE_DATABASE_URL || process.env.DB_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!dbUrl || !apiUrl) throw new VehicleSaleRecognitionError('DATABASE_NOT_CONFIGURED', 'Sale-chain database is not configured.', 503);
    const config = saleChainConnection(dbUrl,apiUrl);
    const payload: unknown = action === 'state' ? new URL(request.url).searchParams.get('bookingId') : await request.json();
    db = new Client(config);
    await db.connect();
    // A concurrent vehicle reallocation must abort, not invalidate the checked booking binding.
    await db.query('begin isolation level serializable');
    await db.query("set local statement_timeout = '30s'");
    await db.query('set local role authenticated');
    await db.query('set local row_security=on');
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role','authenticated',true)", [user.id]);
    const result = await executeSaleChainAction({ action, payload, actorUserId: user.id, db,
      download: async document => {
        const { data, error: storageError } = await userClient.storage.from(document.bucket).download(document.path);
        if (storageError || !data) throw new VehicleSaleRecognitionError('DOCUMENT_UNAVAILABLE', 'Source document is missing or inaccessible to the approver.', 409);
        if (data.size > 20 * 1024 * 1024) throw new VehicleSaleRecognitionError('DOCUMENT_TOO_LARGE', 'Source document exceeds 20 MB.');
        return new Uint8Array(await data.arrayBuffer());
      },
    });
    await db.query('commit');
    return Response.json({ success: true, result });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof VehicleSaleRecognitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === '42501') {
      return Response.json({ error: 'Access to this sale is denied.', code: 'SALE_ACCESS_DENIED' }, { status: 403 });
    }
    if (error instanceof SyntaxError) return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    return Response.json({ error: 'AutoMove sale-chain operation failed.' }, { status: 500 });
  } finally { if (db) await db.end(); }
}
