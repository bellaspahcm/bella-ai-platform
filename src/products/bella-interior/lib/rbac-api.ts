import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface InteriorRbacRpcError {
  readonly message?: string;
}

export interface InteriorRbacRpcResponse {
  readonly data: unknown;
  readonly error: InteriorRbacRpcError | null;
}

export interface InteriorRbacRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<InteriorRbacRpcResponse>;
}

export function interiorRbacRpcClient(client: SupabaseClient<Database>): InteriorRbacRpcClient {
  return client as unknown as InteriorRbacRpcClient;
}

export function isInteriorRbacRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validInteriorUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function interiorJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return isInteriorRbacRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function interiorMutationRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  return isInteriorRbacRecord(value[0]) ? value[0] : null;
}
