'use server';

import { createClient } from '@/lib/supabase-server';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from './user-actions';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';
import { isHqTenant } from '@/lib/business-rules/hq-tenant';
import type { HqDashboardStats, HqTenantRecord } from '@/types/domain';
import type { Database } from '@/types/database.types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type HqSupabaseClient = Awaited<ReturnType<typeof createDevelopmentBypassClient>>;
type TenantStatusAuditData = {
  id: string;
  name: string;
  status: string | null;
  updated_at: string | null;
};

function tenantStatusAuditJson(tenant: TenantRow): TenantStatusAuditData {
  return {
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    updated_at: tenant.updated_at,
  };
}

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

function countByTenant(rows: readonly { tenant_id: string | null }[] | null) {
  const counts = new Map<string, number>();
  for (const row of rows || []) {
    if (!row.tenant_id) continue;
    counts.set(row.tenant_id, (counts.get(row.tenant_id) || 0) + 1);
  }
  return counts;
}

function sumRevenueByTenant(rows: readonly { tenant_id: string | null; amount: number | string | null }[] | null) {
  const sums = new Map<string, number>();
  for (const row of rows || []) {
    if (!row.tenant_id) continue;
    sums.set(row.tenant_id, (sums.get(row.tenant_id) || 0) + Number(row.amount || 0));
  }
  return sums;
}

function normalizeRoyaltyType(value: string | null): HqTenantRecord['royalty_type'] {
  return value === 'fixed' || value === 'percentage' ? value : null;
}

async function fetchHqTenants(supabase: HqSupabaseClient): Promise<TenantRow[]> {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return tenants || [];
}

async function fetchTenantAggregates(supabase: HqSupabaseClient) {
  const [staffResult, customerResult, revenueResult] = await Promise.all([
    supabase.from('users').select('tenant_id'),
    supabase.from('customers').select('tenant_id'),
    supabase.from('revenue').select('tenant_id, amount'),
  ]);

  if (staffResult.error) {
    console.warn(`[hq-actions] Warning bulk counting staff: ${staffResult.error.message}`);
  }

  if (customerResult.error) {
    console.warn(`[hq-actions] Warning bulk counting customers: ${customerResult.error.message}`);
  }

  if (revenueResult.error) {
    console.warn(`[hq-actions] Warning bulk fetching revenue: ${revenueResult.error.message}`);
  }

  const revenueRows = revenueResult.error ? [] : revenueResult.data || [];

  return {
    staffCounts: countByTenant(staffResult.error ? [] : staffResult.data || []),
    customerCounts: countByTenant(customerResult.error ? [] : customerResult.data || []),
    revenueSums: sumRevenueByTenant(revenueRows),
    totalRevenue: revenueRows.reduce((acc, item) => acc + Number(item.amount || 0), 0),
  };
}

function buildHqTenantRecords(
  tenants: readonly TenantRow[],
  aggregates: Awaited<ReturnType<typeof fetchTenantAggregates>>
): HqTenantRecord[] {
  return tenants.map((tenant) => ({
    ...tenant,
    royalty_type: normalizeRoyaltyType(tenant.royalty_type),
    staffCount: aggregates.staffCounts.get(tenant.id) || 0,
    customerCount: aggregates.customerCounts.get(tenant.id) || 0,
    revenueSum: aggregates.revenueSums.get(tenant.id) || 0,
  }));
}

async function buildHqDashboardStats(
  supabase: HqSupabaseClient,
  tenants: readonly TenantRow[],
  totalRevenue: number
): Promise<HqDashboardStats> {
  const [sessionsResult, bookingsResult] = await Promise.all([
    supabase.from('session_logs').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
  ]);

  if (sessionsResult.error) {
    throw new Error(`Failed to count session logs: ${sessionsResult.error.message}`);
  }

  if (bookingsResult.error) {
    throw new Error(`Failed to count bookings: ${bookingsResult.error.message}`);
  }

  const totalSpas = tenants.length;
  const activeSpas = tenants.filter((tenant) => tenant.status === 'active').length;
  const suspendedSpas = tenants.filter((tenant) => tenant.status === 'suspended').length;
  const totalBookings = bookingsResult.count || 0;
  const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'];
  const spaGrowthData = [1, 2, 3, 4, 4, totalSpas];

  return {
    totalSpas,
    activeSpas,
    suspendedSpas,
    totalRevenue,
    totalSessions: sessionsResult.count || 0,
    zaloSmsUsed: totalBookings * 4 + 87,
    spaGrowthData: months.map((month, index) => ({ month, spas: spaGrowthData[index] || 0 })),
  };
}

export async function getHqDashboardPayload(): Promise<{
  stats: HqDashboardStats;
  tenants: HqTenantRecord[];
}> {
  const auth = await checkHqAuth();
  if (!auth.authorized) {
    throw new Error(auth.error || 'Unauthorized');
  }

  const supabase = await createDevelopmentBypassClient();
  const tenants = await fetchHqTenants(supabase);
  const aggregates = await fetchTenantAggregates(supabase);
  const stats = await buildHqDashboardStats(supabase, tenants, aggregates.totalRevenue);

  return {
    stats,
    tenants: buildHqTenantRecords(tenants, aggregates),
  };
}

/**
 * Checks if the current user belongs to the Headquarter and is an admin
 */
export async function checkHqAuth() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return { authorized: false, error: 'Quyền truy cập bị từ chối.' };
  }
  
  if (!currentUser.tenant_id) {
    return { authorized: false, error: 'Tài khoản không thuộc chi nhánh nào.' };
  }
  
  const supabase = await createClient();
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('product_key, status')
    .eq('id', currentUser.tenant_id)
    .single();

  if (tenantError) {
    if (tenantError.code === '42501' || tenantError.code === 'PGRST116') {
      return { authorized: false, error: 'Quyền truy cập bị từ chối.' };
    }
    throw new Error(`Failed to verify HQ tenant: ${tenantError.message}`);
  }
     
  if (tenant?.status !== 'active' || !isHqTenant(tenant)) {
    return { authorized: false, error: 'Trang này chỉ dành cho quản trị viên Tổng bộ.' };
  }
  
  return { authorized: true, user: currentUser };
}

/**
 * Fetches dashboard KPI numbers for the system Super Admin
 */
export async function getHqDashboardStats() {
  const auth = await checkHqAuth();
  if (!auth.authorized) {
    throw new Error(auth.error || 'Unauthorized');
  }

  const supabase = await createDevelopmentBypassClient();
  const tenants = await fetchHqTenants(supabase);
  const aggregates = await fetchTenantAggregates(supabase);

  return buildHqDashboardStats(supabase, tenants, aggregates.totalRevenue);
}

/**
 * Fetches all registered tenants with their counts
 */
export async function getAllTenants() {
  const auth = await checkHqAuth();
  if (!auth.authorized) {
    throw new Error(auth.error || 'Unauthorized');
  }

  const supabase = await createDevelopmentBypassClient();
  const tenants = await fetchHqTenants(supabase);
  const aggregates = await fetchTenantAggregates(supabase);

  return buildHqTenantRecords(tenants, aggregates);
}

/**
 * Suspends or Activates a tenant
 */
export async function toggleTenantStatus(tenantId: string, status: 'active' | 'suspended') {
  const auth = await checkHqAuth();
  if (!auth.authorized) {
    return { success: false, error: auth.error };
  }

  const supabase = await createClient();

  // Prevent suspending Headquarter
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError) {
    return { success: false, error: `Failed to fetch tenant before status update: ${tenantError.message}` };
  }

  if (!tenant) {
    return { success: false, error: 'Không tìm thấy chi nhánh cần cập nhật trạng thái.' };
  }

  if (isHqTenant(tenant)) {
    return { success: false, error: 'Không thể khóa tenant Tổng bộ.' };
  }

  const updatePayload: TenantUpdate = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Update status in tenants table
  const { error } = await supabase
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenantId);

  if (error) {
    console.error('Error updating tenant status:', error);
    return { success: false, error: error.message };
  }

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      old_data: tenantStatusAuditJson(tenant),
      new_data: {
        ...tenantStatusAuditJson(tenant),
        status,
        updated_at: updatePayload.updated_at ?? tenant.updated_at,
      }
    });
  } catch (auditError) {
    const rollbackPayload: TenantUpdate = {
      status: tenant.status,
      updated_at: tenant.updated_at,
    };
    const { error: rollbackError } = await supabase
      .from('tenants')
      .update(rollbackPayload)
      .eq('id', tenantId);

    if (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after tenant status update: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after tenant status update: ${getErrorMessage(auditError)}`,
    };
  }

  // Safe revalidate
  await safeRevalidatePath('/hq');
  await safeRevalidatePath('/dashboard');

  return { success: true };
}


// =============================================================================
// Phase 29.3 — Multi-branch Consolidated P&L (HQ View)
// =============================================================================

export interface ConsolidatedPnLRow {
  tenant_id: string;
  tenant_name: string;
  gross_revenue: number;
  deductions: number;
  net_revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  financial_income: number;
  financial_expense: number;
  operating_expense: number;
  operating_profit: number;
  other_income: number;
  other_expense: number;
  profit_before_tax: number;
  tax_expense: number;
  net_profit: number;
  net_margin_percent: number;
  total_bookings_count: number;
  total_sessions_completed: number;
  internal_revenue_eliminated: number;
  internal_cogs_eliminated: number;
}

/**
 * Fetches consolidated P&L across all active tenants in the network.
 * HQ-only — RPC enforces is_hq_super_admin() server-side.
 * Returns rows sorted client-side by net_profit DESC for ranking.
 */
export async function getConsolidatedPnLReport(
  fromDate: string,
  toDate: string
): Promise<ConsolidatedPnLRow[]> {
  const auth = await checkHqAuth();
  if (!auth.authorized) {
    throw new Error(auth.error || 'Unauthorized: HQ Super Admin access required.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_consolidated_pnl', {
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;

  // Sort by net_profit DESC — best-performing branches first
  const rows = (data as ConsolidatedPnLRow[]) || [];
  return rows.sort((a, b) => Number(b.net_profit) - Number(a.net_profit));
}
