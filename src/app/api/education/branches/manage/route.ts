import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { createOrgUnitEngineForClient, type OrgUnitDatabase } from '@/platform/org-unit';
import { CURRENT_ACTOR_PROFILE_RPC, reconcileCurrentActorProfile } from '@/platform/security/current-actor.contract';
import { PreschoolChainError, PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const forbiddenHeaders = ['x-role', 'x-user-role', 'x-mock-user-email', 'x-mock-role',
  'x-tenant-id', 'x-user-id', 'x-actor-id'];
const maxBodyBytes = 4096;
type BranchClient = SupabaseClient<Database>;
type BranchRequestContext = {
  readonly allowed: true;
  readonly client: BranchClient;
  readonly actorId: string;
  readonly tenantId: string;
} | {
  readonly allowed: false;
  readonly response: NextResponse;
};

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: privateHeaders });
}

async function resolveBranchManagementContext(request: Request): Promise<BranchRequestContext> {
  if (forbiddenHeaders.some((name) => request.headers.has(name))) {
    return { allowed: false, response: failure('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403) };
  }
  if (new URL(request.url).searchParams.size > 0) {
    return { allowed: false, response: failure('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST', 400) };
  }
  const authorization = request.headers.get('authorization');
  if (authorization !== null && !/^Bearer [^\s]+$/.test(authorization)) {
    return { allowed: false, response: failure('PRESCHOOL_CHAIN_UNAUTHENTICATED', 401) };
  }

  try {
    const client = await createClient();
    const auth = authorization
      ? await client.auth.getUser(authorization.slice(7))
      : await client.auth.getUser();
    if (auth.error || !auth.data.user) {
      return { allowed: false, response: failure('PRESCHOOL_CHAIN_UNAUTHENTICATED', 401) };
    }
    const profile = await client.rpc(CURRENT_ACTOR_PROFILE_RPC);
    if (profile.error) {
      return { allowed: false, response: failure(
        profile.error.code === '42501' ? 'PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED' : 'PRESCHOOL_CHAIN_UNAVAILABLE',
        profile.error.code === '42501' ? 403 : 503,
      ) };
    }
    const actor = reconcileCurrentActorProfile(auth.data.user.id, profile.data);
    if (!actor?.tenant_id || actor.role !== 'admin') {
      return { allowed: false, response: failure('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403) };
    }

    const tenantResult = await client.from('tenants').select('id,status,product_key')
      .eq('id', actor.tenant_id).maybeSingle();
    if (tenantResult.error) {
      return { allowed: false, response: failure('PRESCHOOL_CHAIN_UNAVAILABLE', 503) };
    }
    const tenant = tenantResult.data;
    if (!tenant || tenant.id !== actor.tenant_id || tenant.status !== 'active'
      || tenant.product_key !== 'bella_preschool') {
      return { allowed: false, response: failure('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403) };
    }

    return { allowed: true, client: client as unknown as BranchClient, actorId: actor.id, tenantId: actor.tenant_id };
  } catch {
    return { allowed: false, response: failure('PRESCHOOL_CHAIN_UNAVAILABLE', 503) };
  }
}

function createService(client: BranchClient): PreschoolChainService {
  const callerScopedClient = client as unknown as SupabaseClient<OrgUnitDatabase>;
  return new PreschoolChainService(client, createOrgUnitEngineForClient(callerScopedClient));
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw new Error('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > maxBodyBytes) {
        await reader.cancel();
        throw new Error('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBranchInput(value: unknown): { readonly name: string; readonly code?: string } | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !['name', 'code'].includes(key))) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim();
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  if (value.code === undefined) return { name };
  if (typeof value.code !== 'string') return null;
  const code = value.code.trim();
  if (code.length === 0 || code.length > 40 || /[\u0000-\u001f\u007f]/.test(code)) return null;
  return { name, code };
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = await resolveBranchManagementContext(request);
  if (!context.allowed) return context.response;
  try {
    const branches = await createService(context.client).listManagedBranches(context.tenantId, context.actorId);
    return NextResponse.json({ success: true, branches, count: branches.length }, { headers: privateHeaders });
  } catch (error) {
    return error instanceof PreschoolChainError
      ? failure(error.code, error.status)
      : failure('PRESCHOOL_CHAIN_UNAVAILABLE', 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveBranchManagementContext(request);
  if (!context.allowed) return context.response;

  let value: unknown;
  try {
    value = await readBoundedJson(request);
  } catch {
    return failure('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST', 400);
  }
  const input = parseBranchInput(value);
  if (!input) return failure('PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST', 400);

  try {
    const branch = await createService(context.client).createBranch({
      tenantId: context.tenantId,
      actorUserId: context.actorId,
      ...input,
    });
    return NextResponse.json({ success: true, branch }, { status: 201, headers: privateHeaders });
  } catch (error) {
    return error instanceof PreschoolChainError
      ? failure(error.code, error.status)
      : failure('PRESCHOOL_CHAIN_UNAVAILABLE', 503);
  }
}
