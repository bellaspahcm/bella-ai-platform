import type { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { z } from 'zod';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Json = Database['public']['Tables']['bookings']['Insert']['metadata'];
type ActionError = { error: string };

export const HAIRCUT_PRODUCT_KEY = 'bella_haircut';

export type HaircutBranchContext =
  | {
      requiresBranch: false;
      branchId: null;
      source: 'not_haircut';
    }
  | {
      requiresBranch: true;
      branchId: string;
      source: 'requested' | 'single_accessible';
      strictDraftScope?: true;
    };

type TenantProductRow = {
  product_key: string | null;
};

type UserOrgUnitAccessRow = {
  org_unit_id: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeBranchId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function readRequestedBranchId(input: {
  branch_id?: unknown;
  branchId?: unknown;
  metadata?: unknown;
}): string | null {
  const metadata = asRecord(input.metadata);
  return normalizeBranchId(input.branch_id)
    ?? normalizeBranchId(input.branchId)
    ?? normalizeBranchId(metadata?.branch_id)
    ?? normalizeBranchId(metadata?.branchId)
    ?? null;
}

async function readTenantProduct(
  supabase: SupabaseServerClient,
  tenantId: string
): Promise<TenantProductRow | ActionError> {
  const { data, error } = await supabase
    .from('tenants')
    .select('product_key')
    .eq('id', tenantId)
    .single<TenantProductRow>();

  if (error || !data) {
    return { error: 'Không thể xác định product identity của tenant: ' + (error?.message || 'Không tìm thấy tenant') };
  }

  return data;
}

export async function resolveHaircutBranchContext(params: {
  supabase: SupabaseServerClient;
  tenantId: string;
  currentUserId: string | null;
  requestedBranchId?: string | null;
}): Promise<HaircutBranchContext | ActionError> {
  const { supabase, tenantId, currentUserId, requestedBranchId } = params;
  const tenantProduct = await readTenantProduct(supabase, tenantId);
  if ('error' in tenantProduct) {
    return tenantProduct;
  }

  // Nail adopts the existing runtime branch authority without changing Haircut's
  // single-accessible inference or the behavior of other products.
  if (tenantProduct.product_key === 'bella_nail') {
    const requestedBranch = z.string().uuid().safeParse(requestedBranchId);
    if (!currentUserId || !requestedBranch.success) {
      return { error: 'Nail yêu cầu người dùng và chi nhánh hợp lệ đã chọn.' };
    }
    const { getCurrentUser } = await import('@/services/user-actions');
    const currentUser = await getCurrentUser();
    if (currentUser?.id !== currentUserId || currentUser.tenant_id !== tenantId) {
      return { error: 'Không thể xác thực người dùng và tenant cho booking Nail.' };
    }
    const { selectBeautyRuntimeBranch } = await import('@/services/beauty-runtime-branch-actions');
    const selection = await selectBeautyRuntimeBranch(requestedBranch.data);
    if (!selection.success) return { error: selection.error };
    return { requiresBranch: true, branchId: selection.data.activeBranchId, source: 'requested', strictDraftScope: true };
  }

  if (tenantProduct.product_key !== HAIRCUT_PRODUCT_KEY) {
    return {
      requiresBranch: false,
      branchId: null,
      source: 'not_haircut',
    };
  }

  if (!currentUserId) {
    return { error: 'Haircut yêu cầu user context để xác thực chi nhánh.' };
  }

  let accessQuery = supabase
    .from('user_org_unit_access')
    .select('org_unit_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', currentUserId);

  if (requestedBranchId) {
    accessQuery = accessQuery.eq('org_unit_id', requestedBranchId);
  }

  const { data, error } = await accessQuery.returns<UserOrgUnitAccessRow[]>();
  if (error) {
    return { error: 'Không thể xác thực quyền truy cập chi nhánh Haircut: ' + error.message };
  }

  const accessibleBranchIds = Array.from(
    new Set((data || []).map((row) => row.org_unit_id).filter(Boolean))
  );

  if (requestedBranchId) {
    return accessibleBranchIds.includes(requestedBranchId)
      ? {
          requiresBranch: true,
          branchId: requestedBranchId,
          source: 'requested',
        }
      : { error: 'Bạn không có quyền thao tác trên chi nhánh Haircut đã chọn.' };
  }

  if (accessibleBranchIds.length === 1) {
    return {
      requiresBranch: true,
      branchId: accessibleBranchIds[0],
      source: 'single_accessible',
    };
  }

  if (accessibleBranchIds.length === 0) {
    return { error: 'Haircut chưa có chi nhánh hợp lệ cho user hiện tại.' };
  }

  return { error: 'Haircut có nhiều chi nhánh. Vui lòng chọn chi nhánh trước khi thao tác.' };
}

export function attachBranchToJsonMetadata(metadata: Json, branchId: string | null): Json {
  if (!branchId) return metadata || null;
  const metadataRecord = asRecord(metadata) || {};
  return {
    ...metadataRecord,
    branch_id: branchId,
  } as Json;
}
