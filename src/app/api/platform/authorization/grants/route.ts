import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import type { PlatformDirectUserGrantInput } from '@/platform/authorization/action-authorization.contract';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jsonKeys = ['targetUserId', 'permissionId', 'scope'] as const;
const formKeys = ['targetUserId', 'permissionId', 'scopeType', 'orgUnitId'] as const;

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: privateHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseGrantInput(value: unknown): PlatformDirectUserGrantInput | null {
  if (!isRecord(value) || !onlyKeys(value, jsonKeys)
    || typeof value.targetUserId !== 'string' || !uuidPattern.test(value.targetUserId)
    || typeof value.permissionId !== 'string' || value.permissionId.length < 1
    || value.permissionId.length > 160 || value.permissionId !== value.permissionId.trim()
    || !isRecord(value.scope) || typeof value.scope.type !== 'string') return null;

  if (value.scope.type === 'TENANT' && onlyKeys(value.scope, ['type'])) {
    return { targetUserId: value.targetUserId, permissionId: value.permissionId, scope: { type: 'TENANT' } };
  }
  if (value.scope.type === 'ORG_UNIT' && onlyKeys(value.scope, ['type', 'orgUnitId'])
    && typeof value.scope.orgUnitId === 'string' && uuidPattern.test(value.scope.orgUnitId)) {
    return {
      targetUserId: value.targetUserId,
      permissionId: value.permissionId,
      scope: { type: 'ORG_UNIT', orgUnitId: value.scope.orgUnitId },
    };
  }
  return null;
}

function parseFormGrantInput(raw: string): PlatformDirectUserGrantInput | null {
  const params = new URLSearchParams(raw);
  if ([...params.keys()].some((key) => !formKeys.some((allowed) => allowed === key)
    || params.getAll(key).length !== 1)) return null;
  const scopeType = params.get('scopeType');
  if (scopeType === 'TENANT' && params.has('orgUnitId')) return null;
  const scope = scopeType === 'TENANT'
    ? { type: 'TENANT' }
    : scopeType === 'ORG_UNIT'
      ? { type: 'ORG_UNIT', orgUnitId: params.get('orgUnitId') }
      : null;
  return parseGrantInput({
    targetUserId: params.get('targetUserId'),
    permissionId: params.get('permissionId'),
    scope,
  });
}

async function readGrantInput(request: Request): Promise<PlatformDirectUserGrantInput | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' && contentType !== 'application/x-www-form-urlencoded') return null;
  const raw = await request.text();
  if (!raw || raw.length > 8192) return null;
  if (contentType === 'application/x-www-form-urlencoded') return parseFormGrantInput(raw);
  try { return parseGrantInput(JSON.parse(raw) as unknown); } catch { return null; }
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function mutationResponse(result: Awaited<ReturnType<SupabasePlatformActionAuthorization['grantDirectUser']>>): NextResponse {
  if (result.status === 'COMMITTED') {
    return NextResponse.json({ success: true, grantId: result.grantId }, { status: 201, headers: privateHeaders });
  }
  if (result.status === 'DENIED') {
    if (result.reason === 'NOT_TENANT_GRANT_ADMIN' || result.reason === 'TENANT_MISMATCH') {
      return failure(result.reason, 403);
    }
    if (result.reason === 'ALREADY_GRANTED') return failure(result.reason, 409);
    return failure(result.reason, 422);
  }
  return failure(result.reason, 503);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return failure('REQUEST_ORIGIN_DENIED', 403);
  let input: PlatformDirectUserGrantInput | null;
  try { input = await readGrantInput(request); } catch { return failure('INVALID_REQUEST', 400); }
  if (!input) return failure('INVALID_REQUEST', 400);

  try {
    const client = await createClient();
    const identity = await client.auth.getUser();
    if (identity.error || !identity.data.user?.id) return failure('UNAUTHENTICATED', 401);

    const authorization = new SupabasePlatformActionAuthorization(client as unknown as SupabaseClient<Database>);
    return mutationResponse(await authorization.grantDirectUser(input));
  } catch {
    return failure('AUTHORIZATION_UNAVAILABLE', 503);
  }
}
