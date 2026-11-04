import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';
import { getCurrentUser } from '@/services/user-actions';
import { publishFeeProgramVersion } from '@/products/bella-education/fee-program/fee-program.persistence';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Body = Record<string, unknown>;

function response(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status, headers });
}
function isBody(value: unknown): value is Body {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exact(body: Body, keys: string[]) {
  return Object.keys(body).sort().join(',') === ['action', ...keys].sort().join(',');
}
function text(value: unknown, max = 160): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function id(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}

async function authorize() {
  const { url, publicKey } = requireSupabasePublicEnv();
  const store = await cookies();
  const client = createServerClient<Database>(url, publicKey, {
    cookies: { getAll: () => store.getAll(), setAll: (values) => {
      for (const { name, value, options } of values) store.set(name, value, options);
    } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { failure: response(401, 'FEE_PROGRAM_UNAUTHENTICATED') } as const;
  const actor = await getCurrentUser();
  if (!actor || actor.id !== data.user.id || actor.status !== 'active' || !actor.tenant_id
    || !['admin', 'super_admin'].includes(actor.role?.toLowerCase() ?? '')) {
    return { failure: response(403, 'FEE_PROGRAM_ACCESS_DENIED') } as const;
  }
  return { client, tenantId: actor.tenant_id } as const;
}

export async function GET() {
  try {
    const access = await authorize();
    if ('failure' in access) return access.failure;
    const { client, tenantId } = access;
    const [types, items, itemVersions, programs, versions, membership] = await Promise.all([
      client.from('preschool_fixed_fee_types').select('id,code,display_name,status').eq('tenant_id', tenantId).order('display_name'),
      client.from('preschool_fee_items').select('id,display_name').eq('tenant_id', tenantId).order('display_name'),
      client.from('preschool_fee_item_versions').select('id,fee_item_id,fee_type_code,amount,currency,status,fee_item_name_snapshot,fee_type_name_snapshot').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      client.from('preschool_fee_programs').select('id,display_name,status').eq('tenant_id', tenantId).order('display_name'),
      client.from('preschool_fee_program_versions').select('id,fee_program_id,billing_period_policy_version_id,status,published_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      client.from('preschool_fee_program_version_items').select('program_version_id,fee_item_version_id').eq('tenant_id', tenantId),
    ]);
    if ([types, items, itemVersions, programs, versions, membership].some((result) => result.error)) {
      return response(503, 'FEE_PROGRAM_READ_UNAVAILABLE');
    }
    return NextResponse.json({ success: true, data: {
      types: types.data, items: items.data, itemVersions: itemVersions.data,
      programs: programs.data, versions: versions.data, membership: membership.data,
    } }, { headers });
  } catch { return response(503, 'FEE_PROGRAM_UNAVAILABLE'); }
}

export async function POST(request: Request) {
  try {
    const access = await authorize();
    if ('failure' in access) return access.failure;
    const body: unknown = await request.json().catch(() => null);
    if (!isBody(body) || typeof body.action !== 'string') return response(400, 'FEE_PROGRAM_INVALID_REQUEST');
    const { client, tenantId } = access;
    if (body.action === 'publish' && exact(body, ['versionId']) && id(body.versionId)) {
      const data = await publishFeeProgramVersion(client, body.versionId);
      return NextResponse.json({ success: true, data }, { headers });
    }
    let result: { error: { code?: string; message: string } | null; data: unknown };
    if (body.action === 'create_type' && exact(body, ['code', 'name']) && text(body.code, 80)
      && /^[A-Z][A-Z0-9_]{0,79}$/.test(body.code) && text(body.name)) {
      result = await client.from('preschool_fixed_fee_types').insert({ tenant_id: tenantId, code: body.code, display_name: body.name.trim() }).select('id').single();
    } else if (body.action === 'update_type' && exact(body, ['id', 'name', 'status']) && id(body.id)
      && text(body.name) && (body.status === 'ACTIVE' || body.status === 'INACTIVE')) {
      result = await client.from('preschool_fixed_fee_types').update({ display_name: body.name.trim(), status: body.status }).eq('tenant_id', tenantId).eq('id', body.id).select('id').single();
    } else if (body.action === 'create_item' && exact(body, ['name']) && text(body.name)) {
      result = await client.from('preschool_fee_items').insert({ tenant_id: tenantId, display_name: body.name.trim() }).select('id').single();
    } else if (body.action === 'create_item_version' && exact(body, ['itemId', 'typeCode', 'amount', 'currency'])
      && id(body.itemId) && text(body.typeCode, 80) && typeof body.amount === 'number' && Number.isFinite(body.amount)
      && body.amount >= 0 && typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency)) {
      result = await client.from('preschool_fee_item_versions').insert({ tenant_id: tenantId, fee_item_id: body.itemId,
        fee_type_code: body.typeCode, amount: body.amount, currency: body.currency, unit_basis: {}, billing_basis: {}, effective_applicability: {} }).select('id').single();
    } else if (body.action === 'create_program' && exact(body, ['name']) && text(body.name)) {
      result = await client.from('preschool_fee_programs').insert({ tenant_id: tenantId, display_name: body.name.trim() }).select('id').single();
    } else if (body.action === 'create_version' && exact(body, ['programId']) && id(body.programId)) {
      result = await client.from('preschool_fee_program_versions').insert({ tenant_id: tenantId, fee_program_id: body.programId,
        billing_period_policy_version_id: null, applicability: {}, effective_applicability: {} }).select('id').single();
    } else if (body.action === 'add_item' && exact(body, ['versionId', 'itemVersionId']) && id(body.versionId) && id(body.itemVersionId)) {
      result = await client.from('preschool_fee_program_version_items').insert({ tenant_id: tenantId,
        program_version_id: body.versionId, fee_item_version_id: body.itemVersionId }).select('program_version_id').single();
    } else return response(400, 'FEE_PROGRAM_INVALID_REQUEST');
    if (result.error) return response(result.error.code === '42501' ? 403 : result.error.code === '23505' ? 409 : 400, 'FEE_PROGRAM_WRITE_REJECTED');
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) {
    if (isBody(error) && typeof error.code === 'string') {
      return response(error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 503, 'FEE_PROGRAM_PUBLISH_REJECTED');
    }
    return response(503, 'FEE_PROGRAM_UNAVAILABLE');
  }
}
