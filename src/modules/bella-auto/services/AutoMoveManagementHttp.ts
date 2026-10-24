import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { AutoCustomerProvider } from './AutoCustomerProvider';
import { saleChainConnection } from './AutoMoveSaleChainConnection';
import { MobilityFoundationService, PostgresMobilityRepository, MobilityError } from '@/platform/mobility';

const preferences = z.object({
  preferredBrands: z.array(z.string().trim().min(1).max(100)).max(30),
  preferredSegments: z.array(z.string().trim().min(1).max(100)).max(30),
  budgetRange: z.string().trim().max(200).nullable(), purchasingPurpose: z.string().trim().max(1000).nullable(),
}).strict();
const registration = z.object({
  variantId: z.string().uuid(), vin: z.string().trim().regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
  colorExterior: z.string().trim().min(1).max(100), modelYear: z.number().int().positive(),
  listPrice: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  chassisNumber: z.string().trim().max(100).optional(), engineNumber: z.string().trim().max(100).optional(),
  locationNote: z.string().trim().max(1000).optional(), expectedArrivalDate: z.iso.date().optional(),
}).strict();
type Action = 'customers' | 'profile' | 'preferences' | 'register';

export async function autoMoveManagementHttp(request: Request, action: Action, customerId?: string): Promise<Response> {
  let db: Client | undefined;
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: 'Unauthorized' }, 401);
    const profile = await getCurrentUser();
    if (!profile || profile.id !== user.id || !profile.tenant_id) return json({ error: 'Active tenant identity is required.' }, 403);
    const tenantId = profile.tenant_id;
    if (action === 'customers') {
      const url = new URL(request.url), q = (url.searchParams.get('q') || '').trim();
      const page = Number(url.searchParams.get('page') || 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || q.length > 100) return json({ error: 'Invalid search.' }, 400);
      return json(await AutoCustomerProvider.listCustomers(client, tenantId, q, page));
    }
    if (action === 'profile' || action === 'preferences') {
      if (!z.uuid().safeParse(customerId).success) return json({ error: 'Invalid customer.' }, 400);
      const { data: customer, error: customerError } = await client.from('customers')
        .select('id,name_mother,phone,address').eq('id', customerId!).eq('tenant_id', tenantId).maybeSingle();
      if (customerError) throw customerError;
      if (!customer) return json({ error: 'Customer unavailable for this tenant.' }, 404);
      if (action === 'preferences') {
        const input = preferences.safeParse(await request.json());
        if (!input.success) return json({ error: 'Invalid preferences.' }, 400);
        await AutoCustomerProvider.upsertProfile(client, tenantId, { customerId: customer.id, ...input.data });
        const result = await AutoCustomerProvider.getProfile(client, tenantId, customer.id);
        const saved = result.profile;
        if (!saved || JSON.stringify([saved.preferredBrands,saved.preferredSegments,saved.budgetRange,saved.purchasingPurpose]) !==
          JSON.stringify([input.data.preferredBrands,input.data.preferredSegments,input.data.budgetRange,input.data.purchasingPurpose])) {
          return json({ error: 'Preference read-back did not match. Reload before retrying.' }, 409);
        }
        return json({ customer, ...result });
      }
      return json({ customer, ...await AutoCustomerProvider.getProfile(client, tenantId, customer.id) });
    }
    const parsed = registration.safeParse(await request.json());
    const key = request.headers.get('Idempotency-Key');
    if (!parsed.success || !z.uuid().safeParse(key).success) return json({ error: 'Valid vehicle fields and retry key are required.' }, 400);
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    db = new Client(saleChainConnection(process.env.AUTOMOVE_DATABASE_URL || process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api));
    await db.connect(); await db.query('begin');
    await db.query("set local statement_timeout='30s'");
    await db.query("set local lock_timeout='10s'");
    await db.query('set local role authenticated');
    await db.query('set local row_security=on');
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [user.id]);
    const actor = (await db.query(`select u.id,u.tenant_id,u.role from public.users u join public.tenants t on t.id=u.tenant_id
      where u.id=$1 and u.status='active' and t.status='active' and u.tenant_id=$2`, [user.id, tenantId])).rows[0];
    if (!actor) { await db.query('rollback'); return json({ error: 'Active tenant identity is required.' }, 403); }
    const variant = await db.query(`select v.id from public.auto_variants v
      join public.auto_models m on m.id=v.model_id and m.tenant_id=v.tenant_id
      join public.auto_brands b on b.id=m.brand_id and b.tenant_id=v.tenant_id where v.id=$1 and v.tenant_id=$2`, [parsed.data.variantId, tenantId]);
    if (!variant.rows.length) { await db.query('rollback'); return json({ error: 'Variant unavailable for this tenant.' }, 404); }
    await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${tenantId}:vehicle-register:${key}`]);
    const repository = new PostgresMobilityRepository(db, true);
    const service = new MobilityFoundationService(repository, {
      ensureAllowed: async params => {
        if (params.actor.userId !== user.id || params.tenantId !== tenantId || params.permission !== 'mobility:vehicle:write') {
          throw new Error('Invalid Mobility authority binding.');
        }
      },
    }, { next: () => randomUUID() }, { now: () => new Date().toISOString() });
    const result = await service.registerVehicle({ userId: user.id, tenantId, roles: [actor.role] }, { ...parsed.data, idempotencyKey: key! });
    const persisted = await repository.getVehicle(tenantId, result.value.id);
    if (!persisted || persisted.vin !== result.value.vin || persisted.variantId !== parsed.data.variantId ||
      (!result.isDuplicate && (persisted.colorExterior !== result.value.colorExterior || persisted.modelYear !== result.value.modelYear ||
        persisted.listPrice !== result.value.listPrice || persisted.status !== 'in_transit'))) throw new Error('Vehicle read-back failed.');
    await db.query('commit');
    return json({ vehicle: persisted, isDuplicate: result.isDuplicate });
  } catch (error: unknown) {
    if (db) await db.query('rollback').catch(() => undefined);
    if (error instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400);
    if (error instanceof MobilityError) return json({ error: error.message, code: error.code }, error.code === 'MOBILITY_IDEMPOTENCY_CONFLICT' ? 409 : 400);
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === '42501') return json({ error: 'Access denied.' }, 403);
      if (error.code === '23505') return json({ error: 'Vehicle already exists.', code: 'MANAGEMENT_CONFLICT' }, 409);
      if (['40001','40P01','55P03'].includes(String(error.code))) return json({ error: 'Retry the same request.', code: 'MANAGEMENT_RETRY_REQUIRED' }, 409);
    }
    return json({ error: 'Không xác minh được dữ liệu đã lưu. Vui lòng tải lại trước khi thử lại.' }, 500);
  } finally { if (db) await db.end(); }
}
