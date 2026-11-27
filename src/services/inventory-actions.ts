'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';
import {
  INVENTORY_REASONS,
  buildSessionConsumptionPlan,
  calculateInventorySummary,
  calculateMonthlyReconciliationEntry,
  calculatePeriodInventoryMovements,
  calculateConsumptionMovement,
  calculateOpeningStock,
  calculateRestockMovement,
  calculateRollbackStock,
  calculateWeightedAverageUnitPrice,
  normalizePackageMaterialRows,
} from '@/lib/business-rules/inventory';
import { buildInventoryConsumedOutboxEvent } from '@/lib/business-rules/accounting-outbox';
import { InventoryError } from '@/core/lib/errors';
import type { Database } from '@/types/database.types';

type InventoryItemInsert = Database['public']['Tables']['inventory_items']['Insert'];
type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update'];
type InventoryLogInsert = Database['public']['Tables']['inventory_logs']['Insert'];
type InventoryLogRow = Database['public']['Tables']['inventory_logs']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type AccountingOutboxRow = Database['public']['Tables']['accounting_outbox']['Row'];
type PackageMaterialInsert = Database['public']['Tables']['package_materials']['Insert'];
type PackageMaterialRow = Database['public']['Tables']['package_materials']['Row'];

type InventorySessionRow = Pick<SessionLogRow, 'id' | 'status' | 'completed_date' | 'booking_id'>;
type InventoryConsumptionLogRow = Pick<InventoryLogRow, 'id' | 'item_id' | 'session_log_id' | 'change_amount' | 'created_at'>;
type InventoryOutboxRow = Pick<AccountingOutboxRow, 'id' | 'reference_id' | 'status'>;

export type AutoConsumeForSessionOptions = {
  force?: boolean;
  source?: 'auto_checkout' | 'business_health_repair';
};

export type InventorySessionReconciliationIssueType =
  | 'missing_inventory_log'
  | 'orphan_inventory_log'
  | 'duplicate_inventory_log'
  | 'missing_inventory_outbox';

export type InventorySessionReconciliationIssue = {
  type: InventorySessionReconciliationIssueType;
  severity: 'warning' | 'critical';
  sessionLogId: string;
  itemId?: string | null;
  inventoryLogIds?: string[];
  message: string;
};

export type InventorySessionReconciliationResult =
  | {
    success: true;
    issues: InventorySessionReconciliationIssue[];
    summary: Record<InventorySessionReconciliationIssueType, number>;
  }
  | { success: false; error: string; issues: InventorySessionReconciliationIssue[] };

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  return error instanceof Error ? error.message : fallback;
}

// ─── Schema (verified 2026-05-15) ──────────────────────────────────────────────
// inventory_items:   id, tenant_id, name, sku, unit, stock_level, min_stock_level,
//                    price_per_unit, category, notes, created_at, updated_at
// inventory_logs:    id, tenant_id, item_id (→ inventory_items), change_amount,
//                    reason, session_log_id (→ session_logs), notes, created_by (→ users), created_at
// package_materials: id, tenant_id, package_id (→ packages), item_id (→ inventory_items),
//                    quantity_per_session, created_at
// ───────────────────────────────────────────────────────────────────────────────

// ─── Helper: get supabase client + optional tenant_id ─────────────────────────
async function getSupabaseWithTenant() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const user = await getCurrentUser();
  return { supabase, tenantId: user?.tenant_id || null, userId: user?.id || null };
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseWithTenant>>['supabase'];
type InventoryRuntimeContext = {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string | null;
};

const INVENTORY_TENANT_ACCESS_ERROR = 'Chưa đăng nhập';

async function assertPackageBelongsToTenant(
  supabase: SupabaseClient,
  packageId: string,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from('packages')
    .select('id')
    .eq('id', packageId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { success: false as const, error: `Lỗi kiểm tra gói dịch vụ: ${error.message}` };
  }
  if (!data) {
    return { success: false as const, error: 'Không tìm thấy gói dịch vụ trong đơn vị kinh doanh hiện tại' };
  }
  return { success: true as const };
}

async function assertInventoryItemsBelongToTenant(
  supabase: SupabaseClient,
  itemIds: string[],
  tenantId: string,
) {
  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
  if (uniqueItemIds.length === 0) return { success: true as const };

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', uniqueItemIds);

  if (error) {
    return { success: false as const, error: `Lỗi kiểm tra vật tư: ${error.message}` };
  }

  const foundIds = new Set((data || []).map((item) => item.id));
  const missingIds = uniqueItemIds.filter((itemId) => !foundIds.has(itemId));
  if (missingIds.length > 0) {
    return {
      success: false as const,
      error: `Có vật tư không thuộc đơn vị kinh doanh hiện tại: ${missingIds.join(', ')}`,
    };
  }

  return { success: true as const };
}

async function assertSessionLogBelongsToTenant(
  supabase: SupabaseClient,
  sessionLogId: string | null | undefined,
  tenantId: string,
) {
  if (!sessionLogId) return { success: true as const };

  const { data, error } = await supabase
    .from('session_logs')
    .select('id')
    .eq('id', sessionLogId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { success: false as const, error: `Lỗi kiểm tra buổi dịch vụ: ${error.message}` };
  }
  if (!data) {
    return { success: false as const, error: 'Buổi dịch vụ không thuộc đơn vị kinh doanh hiện tại' };
  }
  return { success: true as const };
}

async function deleteInventoryItemById(
  supabase: SupabaseClient,
  itemId: string,
  tenantId: string,
) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('tenant_id', tenantId);

  return error;
}

// ─── READ: apply tenant filter when available, never early-return ──────────────

export async function getInventoryItems() {
  const { supabase, tenantId } = await getSupabaseWithTenant();
  if (!tenantId) throw new InventoryError(INVENTORY_TENANT_ACCESS_ERROR, 'INVENTORY_TENANT_ACCESS_ERROR');

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) {
    throw new InventoryError(`Failed to fetch inventory items: ${error.message}`, 'INVENTORY_FETCH_FAILED', { operation: 'getInventoryItems' });
  }
  return data || [];
}

export async function getInventoryLogs(limit = 50) {
  const { supabase, tenantId } = await getSupabaseWithTenant();
  if (!tenantId) throw new InventoryError(INVENTORY_TENANT_ACCESS_ERROR, 'INVENTORY_TENANT_ACCESS_ERROR');

  const { data, error } = await supabase
    .from('inventory_logs')
    .select(`
      id, change_amount, reason, notes, created_at, tenant_id,
      inventory_items!inventory_logs_item_id_fkey(name, unit)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new InventoryError(`Failed to fetch inventory logs: ${error.message}`, 'INVENTORY_FETCH_FAILED', { operation: 'getInventoryLogs', limit });
  }
  return data || [];
}

export async function getInventoryLogsByDateRange(dateFrom: string, dateTo: string) {
  const { supabase, tenantId } = await getSupabaseWithTenant();
  if (!tenantId) throw new InventoryError(INVENTORY_TENANT_ACCESS_ERROR, 'INVENTORY_TENANT_ACCESS_ERROR');

  // dateTo: extend to end of day
  const dateToEnd = dateTo + 'T23:59:59';

  const { data, error } = await supabase
    .from('inventory_logs')
    .select(`
      id, change_amount, reason, notes, created_at, tenant_id,
      inventory_items!inventory_logs_item_id_fkey(name, unit)
    `)
    .eq('tenant_id', tenantId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateToEnd)
    .order('created_at', { ascending: false });
  if (error) {
    throw new InventoryError(`Failed to fetch inventory logs by date range: ${error.message}`, 'INVENTORY_FETCH_FAILED', { operation: 'getInventoryLogsByDateRange', dateFrom, dateTo });
  }
  return data || [];
}

export async function getInventorySummary() {
  const { supabase, tenantId } = await getSupabaseWithTenant();
  if (!tenantId) throw new InventoryError(INVENTORY_TENANT_ACCESS_ERROR, 'INVENTORY_TENANT_ACCESS_ERROR');

  const { data, error } = await supabase
    .from('inventory_items')
    .select('stock_level, min_stock_level, price_per_unit')
    .eq('tenant_id', tenantId);
  if (error) {
    throw new InventoryError(`Failed to fetch inventory summary: ${error.message}`, 'INVENTORY_FETCH_FAILED', { operation: 'getInventorySummary' });
  }
  return calculateInventorySummary(data);
}

export async function getInventoryPeriodMovementReport(dateFrom: string, dateTo: string) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) {
      return { success: false as const, error: INVENTORY_TENANT_ACCESS_ERROR, rows: [], logs: [], summary: null };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      return { success: false as const, error: 'Khoảng ngày báo cáo không hợp lệ (YYYY-MM-DD)', rows: [], logs: [], summary: null };
    }

    // Fetch live items and logs from 1 day prior to dateFrom (buffer for +07 timezone conversion)
    const bufferStart = new Date(`${dateFrom}T00:00:00Z`);
    bufferStart.setUTCDate(bufferStart.getUTCDate() - 1);

    const [itemsRes, logsRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, name, sku, category, unit, stock_level, min_stock_level, price_per_unit')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('inventory_logs')
        .select('id, item_id, change_amount, reason, notes, created_at, accounting_metadata')
        .eq('tenant_id', tenantId)
        .gte('created_at', bufferStart.toISOString())
        .order('created_at', { ascending: false }),
    ]);

    if (itemsRes.error) {
      return { success: false as const, error: `Lỗi tải danh mục vật tư: ${itemsRes.error.message}`, rows: [], logs: [], summary: null };
    }
    if (logsRes.error) {
      return { success: false as const, error: `Lỗi tải nhật ký xuất nhập kho: ${logsRes.error.message}`, rows: [], logs: [], summary: null };
    }

    const report = calculatePeriodInventoryMovements({
      items: itemsRes.data || [],
      logs: logsRes.data || [],
      dateFrom,
      dateTo,
    });

    return { success: true as const, ...report };
  } catch (error: unknown) {
    console.error('[getInventoryPeriodMovementReport]', error);
    return { success: false as const, error: getErrorMessage(error, 'Lỗi tải báo cáo xuất nhập tồn'), rows: [], logs: [], summary: null };
  }
}

export async function getPackageMaterials(packageId: string, context?: InventoryRuntimeContext) {
  const { supabase, tenantId } = context ?? await getSupabaseWithTenant();
  if (!tenantId) throw new InventoryError(INVENTORY_TENANT_ACCESS_ERROR, 'INVENTORY_TENANT_ACCESS_ERROR');

  const { data, error } = await supabase
    .from('package_materials')
    .select(`
      id, quantity_per_session, item_id,
      inventory_items!package_materials_item_id_fkey(id, name, unit, stock_level, price_per_unit)
    `)
    .eq('package_id', packageId)
    .eq('tenant_id', tenantId);
  if (error) {
    throw new InventoryError(`Failed to fetch package materials for package ${packageId}: ${error.message}`, 'INVENTORY_FETCH_FAILED', { operation: 'getPackageMaterials', packageId });
  }
  return data || [];
}

// ─── CRUD: Định mức tiêu hao vật tư theo gói ───────────────────────────────────
/**
 * Đồng bộ định mức tiêu hao của một gói liệu trình.
 * `rows` chứa danh sách { item_id, quantity_per_session } hiện hành.
 * Hàm sẽ:
 *   - xóa toàn bộ định mức cũ của package_id này;
 *   - chèn lại các định mức mới (dòng có quantity_per_session > 0).
 * Trả về { success, error? } để caller có thể assert side-effect (tuân thủ AGENTS.md §1).
 */
export async function upsertPackageMaterials(
  packageId: string,
  rows: Array<{ item_id: string; quantity_per_session: number }>
) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    if (!packageId) return { success: false, error: 'Thiếu mã gói' };

    const packageScope = await assertPackageBelongsToTenant(supabase, packageId, tenantId);
    if (!packageScope.success) {
      return { success: false, error: packageScope.error };
    }

    const normalizedRows = normalizePackageMaterialRows(rows);
    const itemScope = await assertInventoryItemsBelongToTenant(
      supabase,
      normalizedRows.map((row) => row.item_id),
      tenantId,
    );
    if (!itemScope.success) {
      return { success: false, error: itemScope.error };
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('package_materials')
      .select('*')
      .eq('package_id', packageId)
      .eq('tenant_id', tenantId);

    if (existingError) {
      console.error('[upsertPackageMaterials.snapshot]', existingError);
      return { success: false, error: 'Lỗi đọc định mức cũ: ' + existingError.message };
    }

    // 1. Xóa toàn bộ định mức cũ của gói trong tenant này
    const { error: deleteError } = await supabase
      .from('package_materials')
      .delete()
      .eq('package_id', packageId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('[upsertPackageMaterials.delete]', deleteError);
      return { success: false, error: 'Lỗi xóa định mức cũ: ' + deleteError.message };
    }

    // 2. Lọc các dòng hợp lệ (item_id không rỗng, quantity > 0)
    const validRows: PackageMaterialInsert[] = normalizedRows
      .map(r => ({
        tenant_id: tenantId,
        package_id: packageId,
        item_id: r.item_id,
        quantity_per_session: r.quantity_per_session,
      }));

    if (validRows.length === 0) {
      revalidatePath('/dashboard/services');
      return { success: true, inserted: 0 };
    }

    const { error: insertError } = await supabase
      .from('package_materials')
      .insert(validRows);

    if (insertError) {
      console.error('[upsertPackageMaterials.insert]', insertError);
      const restoreRows: PackageMaterialInsert[] = ((existingRows || []) as PackageMaterialRow[]).map(row => ({
        tenant_id: row.tenant_id,
        package_id: row.package_id,
        item_id: row.item_id,
        quantity_per_session: row.quantity_per_session,
      }));

      if (restoreRows.length > 0) {
        const { error: restoreError } = await supabase
          .from('package_materials')
          .insert(restoreRows);

        if (restoreError) {
          console.error('[upsertPackageMaterials.restore]', restoreError);
          return {
            success: false,
            error: 'Lỗi lưu định mức mới: ' + insertError.message
              + '; rollback failed: ' + restoreError.message,
          };
        }
      }

      return { success: false, error: 'Lỗi lưu định mức mới: ' + insertError.message };
    }

    revalidatePath('/dashboard/services');
    return { success: true, inserted: validRows.length };
  } catch (e: unknown) {
    console.error('[upsertPackageMaterials]', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Kiểm kê tồn kho cuối tháng ────────────────────────────────────────────────
/**
 * Trả về báo cáo kiểm kê tồn kho cho tháng/năm chỉ định.
 * Mỗi item: { item_id, name, unit, stock_level (live), nhap, tieu_hao, expected }
 * - nhap   = tổng change_amount > 0 trong tháng
 * - tieu_hao = tổng |change_amount| với change_amount < 0 trong tháng
 * - expected = stock_level hiện tại (đã cộng/trừ xong)
 */
export async function getMonthlyReconciliation(year: number, month: number) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false as const, error: 'Chưa đăng nhập', items: [] };

    const monthStr = String(month).padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01T00:00:00`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const [itemsRes, logsRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, name, unit, stock_level, price_per_unit')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('inventory_logs')
        .select('item_id, change_amount, reason, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo),
    ]);

    if (itemsRes.error) {
      console.error('[getMonthlyReconciliation.items]', itemsRes.error);
      return { success: false as const, error: 'Lỗi tải vật tư', items: [] };
    }
    if (logsRes.error) {
      console.error('[getMonthlyReconciliation.logs]', logsRes.error);
      return { success: false as const, error: 'Lỗi tải log', items: [] };
    }

    const logsByItem: Record<string, { nhap: number; tieu_hao: number }> = {};
    for (const lg of logsRes.data || []) {
      const k = lg.item_id;
      if (!logsByItem[k]) logsByItem[k] = { nhap: 0, tieu_hao: 0 };
      const amt = Number(lg.change_amount || 0);
      if (amt > 0) logsByItem[k].nhap += amt;
      else logsByItem[k].tieu_hao += Math.abs(amt);
    }

    const items = (itemsRes.data || []).map((it) => {
      const m = logsByItem[it.id] || { nhap: 0, tieu_hao: 0 };
      return {
        item_id: it.id,
        name: it.name,
        unit: it.unit,
        price_per_unit: Number(it.price_per_unit || 0),
        nhap: m.nhap,
        tieu_hao: m.tieu_hao,
        expected: Number(it.stock_level || 0),
      };
    });

    return { success: true as const, items };
  } catch (e: unknown) {
    console.error('[getMonthlyReconciliation]', e);
    return { success: false as const, error: getErrorMessage(e), items: [] };
  }
}

export async function detectInventorySessionReconciliationIssues(options?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<InventorySessionReconciliationResult> {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập', issues: [] };

    let completedSessionsQuery = supabase
      .from('session_logs')
      .select('id, status, completed_date, booking_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');

    if (options?.dateFrom) completedSessionsQuery = completedSessionsQuery.gte('completed_date', options.dateFrom);
    if (options?.dateTo) completedSessionsQuery = completedSessionsQuery.lte('completed_date', options.dateTo);

    const { data: completedSessionsData, error: completedSessionsError } = await completedSessionsQuery;
    if (completedSessionsError) {
      return {
        success: false,
        error: `Lỗi tải danh sách ca hoàn thành: ${completedSessionsError.message}`,
        issues: [],
      };
    }

    let consumptionLogsQuery = supabase
      .from('inventory_logs')
      .select('id, item_id, session_log_id, change_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('reason', INVENTORY_REASONS.sessionConsumption);

    if (options?.dateFrom) consumptionLogsQuery = consumptionLogsQuery.gte('created_at', options.dateFrom);
    if (options?.dateTo) consumptionLogsQuery = consumptionLogsQuery.lte('created_at', options.dateTo);

    const { data: consumptionLogsData, error: consumptionLogsError } = await consumptionLogsQuery;
    if (consumptionLogsError) {
      return {
        success: false,
        error: `Lỗi tải log tiêu hao kho: ${consumptionLogsError.message}`,
        issues: [],
      };
    }

    const completedSessions = (completedSessionsData || []) as InventorySessionRow[];
    const consumptionLogs = (consumptionLogsData || []) as InventoryConsumptionLogRow[];
    const completedSessionIds = new Set(completedSessions.map((session) => session.id));
    const logSessionIds = Array.from(new Set(
      consumptionLogs
        .map((log) => log.session_log_id)
        .filter((sessionLogId): sessionLogId is string => Boolean(sessionLogId)),
    ));

    let referencedSessions = new Map<string, InventorySessionRow>();
    if (logSessionIds.length > 0) {
      const { data: referencedSessionsData, error: referencedSessionsError } = await supabase
        .from('session_logs')
        .select('id, status, completed_date, booking_id')
        .eq('tenant_id', tenantId)
        .in('id', logSessionIds);

      if (referencedSessionsError) {
        return {
          success: false,
          error: `Lỗi tải ca liên quan tới log kho: ${referencedSessionsError.message}`,
          issues: [],
        };
      }

      referencedSessions = new Map(
        ((referencedSessionsData || []) as InventorySessionRow[]).map((session) => [session.id, session]),
      );
    }

    let outboxBySession = new Map<string, InventoryOutboxRow[]>();
    if (logSessionIds.length > 0) {
      const { data: outboxData, error: outboxError } = await supabase
        .from('accounting_outbox')
        .select('id, reference_id, status')
        .eq('tenant_id', tenantId)
        .eq('event_type', 'INVENTORY_CONSUMED')
        .eq('reference_type', 'SESSION_LOG')
        .in('reference_id', logSessionIds);

      if (outboxError) {
        return {
          success: false,
          error: `Lỗi tải hàng đợi kế toán kho: ${outboxError.message}`,
          issues: [],
        };
      }

      outboxBySession = ((outboxData || []) as InventoryOutboxRow[]).reduce((map, outbox) => {
        const rows = map.get(outbox.reference_id) || [];
        rows.push(outbox);
        map.set(outbox.reference_id, rows);
        return map;
      }, new Map<string, InventoryOutboxRow[]>());
    }

    const logsBySession = consumptionLogs.reduce((map, log) => {
      if (!log.session_log_id) return map;
      const rows = map.get(log.session_log_id) || [];
      rows.push(log);
      map.set(log.session_log_id, rows);
      return map;
    }, new Map<string, InventoryConsumptionLogRow[]>());

    const issues: InventorySessionReconciliationIssue[] = [];

    completedSessions.forEach((session) => {
      if (!logsBySession.has(session.id)) {
        issues.push({
          type: 'missing_inventory_log',
          severity: 'warning',
          sessionLogId: session.id,
          message: `Ca ${session.id} đã hoàn thành nhưng chưa có log tiêu hao kho.`,
        });
      }
    });

    consumptionLogs.forEach((log) => {
      const sessionLogId = log.session_log_id || '';
      const referencedSession = sessionLogId ? referencedSessions.get(sessionLogId) : null;
      if (!sessionLogId || !referencedSession || referencedSession.status !== 'completed') {
        issues.push({
          type: 'orphan_inventory_log',
          severity: 'critical',
          sessionLogId: sessionLogId || 'UNKNOWN_SESSION',
          itemId: log.item_id,
          inventoryLogIds: [log.id],
          message: `Log kho ${log.id} đang trừ vật tư nhưng ca liên quan không còn trạng thái hoàn thành.`,
        });
      }
    });

    logsBySession.forEach((logs, sessionLogId) => {
      const logsByItem = logs.reduce((map, log) => {
        const rows = map.get(log.item_id) || [];
        rows.push(log);
        map.set(log.item_id, rows);
        return map;
      }, new Map<string, InventoryConsumptionLogRow[]>());

      logsByItem.forEach((itemLogs, itemId) => {
        if (itemLogs.length > 1) {
          issues.push({
            type: 'duplicate_inventory_log',
            severity: 'critical',
            sessionLogId,
            itemId,
            inventoryLogIds: itemLogs.map((log) => log.id),
            message: `Ca ${sessionLogId} có nhiều log tiêu hao cho cùng vật tư ${itemId}.`,
          });
        }
      });

      if (completedSessionIds.has(sessionLogId) && !outboxBySession.has(sessionLogId)) {
        issues.push({
          type: 'missing_inventory_outbox',
          severity: 'warning',
          sessionLogId,
          inventoryLogIds: logs.map((log) => log.id),
          message: `Ca ${sessionLogId} đã trừ kho nhưng chưa có outbox kế toán INVENTORY_CONSUMED.`,
        });
      }
    });

    const summary = issues.reduce<Record<InventorySessionReconciliationIssueType, number>>(
      (acc, issue) => {
        acc[issue.type] += 1;
        return acc;
      },
      {
        missing_inventory_log: 0,
        orphan_inventory_log: 0,
        duplicate_inventory_log: 0,
        missing_inventory_outbox: 0,
      },
    );

    return { success: true, issues, summary };
  } catch (e: unknown) {
    console.error('[detectInventorySessionReconciliationIssues]', e);
    return { success: false, error: getErrorMessage(e), issues: [] };
  }
}

/**
 * Lưu kết quả kiểm kê cuối tháng.
 * `entries` là mảng { item_id, actual_stock, notes? }.
 * Với mỗi item:
 *   - Tính variance = actual - expected (lấy expected từ stock_level hiện hành).
 *   - Cập nhật inventory_items.stock_level = actual.
 *   - Ghi 1 dòng inventory_logs(reason='monthly_reconciliation', change_amount=variance).
 * Nếu variance = 0 → vẫn ghi log để xác nhận đã kiểm kê (notes = "Khớp sổ").
 */
export async function saveMonthlyReconciliation(
  year: number,
  month: number,
  entries: Array<{ item_id: string; actual_stock: number; notes?: string }>
) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập', processed: 0 };
    if (!entries || entries.length === 0) {
      return { success: false, error: 'Chưa nhập số lượng thực tế nào', processed: 0 };
    }

    const periodLabel = `${String(month).padStart(2, '0')}/${year}`;
    let processed = 0;
    const failures: string[] = [];

    for (const entry of entries) {
      if (!entry.item_id) {
        failures.push('Thiếu mã vật tư');
        continue;
      }
      const actualSnapshot = calculateMonthlyReconciliationEntry({
        actualStock: entry.actual_stock,
        expectedStock: 0,
        periodLabel,
        notes: entry.notes,
      });
      if ('error' in actualSnapshot) {
        failures.push(`Item ${entry.item_id}: số liệu không hợp lệ`);
        continue;
      }

      // Đọc tồn hệ thống hiện hành
      const { data: itemRow, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('stock_level, name, unit')
        .eq('id', entry.item_id)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !itemRow) {
        failures.push(`Item ${entry.item_id}: không tìm thấy`);
        continue;
      }

      const reconciliation = calculateMonthlyReconciliationEntry({
        actualStock: entry.actual_stock,
        expectedStock: itemRow.stock_level,
        unit: itemRow.unit,
        periodLabel,
        notes: entry.notes,
      });
      if ('error' in reconciliation) {
        failures.push(`Item ${entry.item_id}: số liệu không hợp lệ`);
        continue;
      }

      // Cập nhật stock_level về số thực tế
      const updatePayload: InventoryItemUpdate = {
        stock_level: reconciliation.actualStock,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', entry.item_id)
        .eq('tenant_id', tenantId);

      if (updateErr) {
        failures.push(`Item ${itemRow.name}: lỗi cập nhật - ${updateErr.message}`);
        continue;
      }

      const logPayload: InventoryLogInsert = {
        item_id: entry.item_id,
        change_amount: reconciliation.variance,
        reason: reconciliation.reason,
        notes: reconciliation.noteText,
        created_by: userId,
        tenant_id: tenantId,
      };

      const { error: logErr } = await supabase.from('inventory_logs').insert(logPayload);

      if (logErr) {
        const rollbackPayload: InventoryItemUpdate = {
          stock_level: reconciliation.expectedStock,
          updated_at: new Date().toISOString(),
        };
        const { error: rollbackErr } = await supabase
          .from('inventory_items')
          .update(rollbackPayload)
          .eq('id', entry.item_id)
          .eq('tenant_id', tenantId);
        const rollbackNote = rollbackErr ? `; rollback failed - ${rollbackErr.message}` : '';
        failures.push(`Item ${itemRow.name}: lỗi ghi log - ${logErr.message}${rollbackNote}`);
        continue;
      }

      processed++;
    }

    revalidatePath('/dashboard/inventory');

    if (failures.length > 0) {
      return {
        success: false,
        processed,
        failed: failures.length,
        error: `Đã kiểm kê ${processed} mặt hàng; ${failures.length} lỗi: ${failures.slice(0, 3).join('; ')}`,
      };
    }
    return { success: true, processed, failed: 0 };
  } catch (e: unknown) {
    console.error('[saveMonthlyReconciliation]', e);
    return { success: false, error: getErrorMessage(e), processed: 0, failed: entries?.length || 0 };
  }
}

// ─── WRITE: still require auth (needed for audit trail + tenant scoping) ───────

export async function addInventoryItem(item: {
  name: string;
  sku?: string;
  unit: string;
  stock_level: number;
  min_stock_level: number;
  price_per_unit: number;
  category?: string;
  notes?: string;
}) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    if (!item.name || !item.unit) return { success: false, error: 'Nhập tên và đơn vị' };

    const openingStock = calculateOpeningStock(item.stock_level);
    if ('error' in openingStock) {
      return { success: false, error: 'Tồn kho ban đầu không hợp lệ' };
    }
    const { initialStock } = openingStock;

    const insertPayload: InventoryItemInsert = {
      ...item,
      stock_level: initialStock,
      tenant_id: tenantId,
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[addInventoryItem]', error);
      return { success: false, error: 'Không thể thêm vật tư: ' + error.message };
    }

    if (initialStock > 0) {
      const openingUnitPrice = Math.max(0, Number(item.price_per_unit || 0));
      const logPayload: InventoryLogInsert = {
        item_id: data.id,
        change_amount: initialStock,
        reason: INVENTORY_REASONS.initial,
        notes: 'Tồn kho ban đầu',
        created_by: userId,
        tenant_id: tenantId,
        accounting_metadata: {
          unit_price: openingUnitPrice,
          total_value: initialStock * openingUnitPrice,
          weighted_avg_after: openingUnitPrice,
        },
      };

      const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
      if (logError) {
        const rollbackError = await deleteInventoryItemById(supabase, data.id, tenantId);
        return {
          success: false,
          error: rollbackError
            ? `Lỗi ghi log tồn kho ban đầu: ${logError.message}; rollback thất bại: ${rollbackError.message}`
            : `Lỗi ghi log tồn kho ban đầu: ${logError.message}`,
        };
      }
    }

    revalidatePath('/dashboard/inventory');
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[addInventoryItem]', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateInventoryItem(
  itemId: string,
  patch: {
    name: string;
    sku?: string;
    unit: string;
    min_stock_level: number;
    price_per_unit: number;
    category?: string;
    notes?: string;
  }
) {
  try {
    const { supabase, tenantId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    if (!itemId) return { success: false, error: 'Thiếu mã vật tư cần cập nhật' };

    const trimmedName = patch.name.trim();
    const trimmedUnit = patch.unit.trim();
    if (!trimmedName || !trimmedUnit) {
      return { success: false, error: 'Tên vật tư và đơn vị tính không được để trống' };
    }

    const minStock = Number(patch.min_stock_level);
    const unitPrice = Number(patch.price_per_unit);
    if (!Number.isFinite(minStock) || minStock < 0) {
      return { success: false, error: 'Định mức tồn tối thiểu không hợp lệ' };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { success: false, error: 'Đơn giá vật tư không hợp lệ' };
    }

    const updatePayload: InventoryItemUpdate = {
      name: trimmedName,
      sku: patch.sku?.trim() || null,
      unit: trimmedUnit,
      min_stock_level: minStock,
      price_per_unit: unitPrice,
      category: patch.category?.trim() || null,
      notes: patch.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      console.error('[updateInventoryItem]', error);
      return {
        success: false,
        error: error ? `Không thể cập nhật vật tư: ${error.message}` : 'Không tìm thấy vật tư trong đơn vị hiện tại',
      };
    }

    revalidatePath('/dashboard/inventory');
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[updateInventoryItem]', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function restockItem(
  itemId: string,
  amount: number,
  notes?: string,
  newUnitPrice?: number
) {
  try {
    const { supabase, tenantId, userId } = await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    const numericAmount = Number(amount);
    if (!itemId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Số lượng nhập kho không hợp lệ' };
    }

    if (newUnitPrice !== undefined) {
      const parsedPrice = Number(newUnitPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return { success: false, error: 'Đơn giá nhập kho không hợp lệ' };
      }
    }

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock_level, price_per_unit')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const movement = calculateRestockMovement({
      stockLevel: item.stock_level,
      amount: numericAmount,
    });
    if ('error' in movement) return { success: false, error: movement.error };

    const previousStock = movement.previousStock;
    const previousPrice = Number(item.price_per_unit || 0);
    const batchUnitPrice = newUnitPrice !== undefined ? Number(newUnitPrice) : previousPrice;
    const nextWeightedAvgPrice = calculateWeightedAverageUnitPrice({
      currentStock: previousStock,
      currentUnitPrice: previousPrice,
      importQty: numericAmount,
      importUnitPrice: batchUnitPrice,
    });

    const updatePayload: InventoryItemUpdate = {
      stock_level: movement.newStock,
      updated_at: new Date().toISOString(),
      ...(newUnitPrice !== undefined ? { price_per_unit: nextWeightedAvgPrice } : {}),
    };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    const logPayload: InventoryLogInsert = {
      item_id: itemId,
      change_amount: movement.changeAmount,
      reason: movement.reason,
      notes: notes || 'Nhập hàng',
      created_by: userId,
      tenant_id: tenantId,
      accounting_metadata: {
        unit_price: batchUnitPrice,
        total_value: numericAmount * batchUnitPrice,
        weighted_avg_before: previousPrice,
        weighted_avg_after: newUnitPrice !== undefined ? nextWeightedAvgPrice : previousPrice,
      },
    };

    const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
    if (logError) {
      const rollbackPayload: InventoryItemUpdate = {
        stock_level: previousStock,
        price_per_unit: previousPrice,
      };
      const { error: rollbackError } = await supabase
        .from('inventory_items')
        .update(rollbackPayload)
        .eq('id', itemId)
        .eq('tenant_id', tenantId);
      return {
        success: false,
        error: rollbackError
          ? `Lỗi ghi log nhập kho: ${logError.message}; rollback thất bại: ${rollbackError.message}`
          : `Lỗi ghi log nhập kho: ${logError.message}`,
      };
    }

    revalidatePath('/dashboard/inventory');
    return { success: true };
  } catch (e) {
    console.error('[restockItem]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

export async function consumeInventory(
  itemId: string,
  amount: number,
  sessionLogId?: string,
  notes?: string,
  context?: InventoryRuntimeContext,
) {
  try {
    const { supabase, tenantId, userId } = context ?? await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };
    const numericAmount = Number(amount);
    if (!itemId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Số lượng tiêu hao không hợp lệ' };
    }

    const sessionScope = await assertSessionLogBelongsToTenant(supabase, sessionLogId, tenantId);
    if (!sessionScope.success) return { success: false, error: sessionScope.error };

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('name, stock_level, price_per_unit')
      .eq('id', itemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !item) return { success: false, error: 'Không tìm thấy vật tư' };

    const movement = calculateConsumptionMovement({
      stockLevel: item.stock_level,
      amount: numericAmount,
      itemName: `Mặt hàng "${item.name}"`,
    });
    if ('error' in movement) return { success: false, error: movement.error };

    const previousStock = movement.previousStock;
    const exportUnitPrice = Math.max(0, Number(item.price_per_unit || 0));
    const updatePayload: InventoryItemUpdate = { stock_level: movement.newStock };

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('tenant_id', tenantId);

    if (updateError) return { success: false, error: 'Lỗi cập nhật tồn kho' };

    const logPayload: InventoryLogInsert = {
      item_id: itemId,
      change_amount: movement.changeAmount,
      reason: movement.reason,
      session_log_id: sessionLogId || null,
      notes: notes || 'Tiêu hao buổi liệu trình',
      created_by: userId,
      tenant_id: tenantId,
      accounting_metadata: {
        unit_price: exportUnitPrice,
        total_value: numericAmount * exportUnitPrice,
      },
    };

    const { error: logError } = await supabase.from('inventory_logs').insert(logPayload);
    if (logError) {
      const rollbackPayload: InventoryItemUpdate = { stock_level: previousStock };
      const { error: rollbackError } = await supabase
        .from('inventory_items')
        .update(rollbackPayload)
        .eq('id', itemId)
        .eq('tenant_id', tenantId);
      return {
        success: false,
        error: rollbackError
          ? `Lỗi ghi log tiêu hao: ${logError.message}; rollback thất bại: ${rollbackError.message}`
          : `Lỗi ghi log tiêu hao: ${logError.message}`,
      };
    }

    revalidatePath('/dashboard/inventory');
    return { success: true, newStock: movement.newStock };
  } catch (e) {
    console.error('[consumeInventory]', e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

// ─── Auto-consume khi hoàn thành buổi ─────────────────────────────────────────
export async function autoConsumeForSession(
  packageId: string,
  sessionLogId: string,
  options: AutoConsumeForSessionOptions = {}
) {
  let runtimeContext: InventoryRuntimeContext | null = null;

  try {
    const { createDevelopmentBypassClient } = await import('@/lib/supabase-dev-bypass-server');
    const supabase = await createDevelopmentBypassClient();
    const user = await getCurrentUser();
    const tenantId = user?.tenant_id || null;
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    // Đọc cấu hình từ bảng tenants để kiểm tra chế độ trừ kho tự động
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('salary_config')
      .eq('id', tenantId)
      .single();
    if (tenantError) {
      return { success: false, error: `Lỗi tải cấu hình tự động trừ kho: ${tenantError.message}` };
    }

    const salaryConfig = (tenantData?.salary_config as Record<string, unknown> | null) || {};
    const isAutoConsumeEnabled = !!salaryConfig.auto_consume_inventory;

    if (!isAutoConsumeEnabled && !options.force) {
      console.log(`[autoConsumeForSession] Auto-consumption is disabled for tenant ${tenantId}. Bypassing.`);
      return { success: true, bypassed: true };
    }

    const { data: existingConsumptionLogs, error: existingConsumptionError } = await supabase
      .from('inventory_logs')
      .select('id, change_amount')
      .eq('session_log_id', sessionLogId)
      .eq('reason', INVENTORY_REASONS.sessionConsumption)
      .eq('tenant_id', tenantId);

    if (existingConsumptionError) {
      return {
        success: false,
        error: `Lỗi kiểm tra tiêu hao kho đã ghi nhận: ${existingConsumptionError.message}`,
      };
    }

    const existingLogs = (existingConsumptionLogs || []) as Pick<InventoryLogRow, 'id' | 'change_amount'>[];
    if (existingLogs.length > 0) {
      return {
        success: true,
        bypassed: true,
        alreadyConsumed: true,
        processed: existingLogs.length,
        totalCost: 0,
      };
    }

    runtimeContext = {
      supabase: supabase as SupabaseClient,
      tenantId,
      userId: user?.id || null,
    };
    const materials = await getPackageMaterials(packageId, runtimeContext);
    const consumptionPlan = buildSessionConsumptionPlan(materials);

    for (const item of consumptionPlan.items) {
      const consumeResult = await consumeInventory(
        item.itemId,
        item.quantity,
        sessionLogId,
        options.source === 'business_health_repair'
          ? 'Health repair: tiêu hao buổi liệu trình'
          : 'Tự động tiêu hao buổi liệu trình',
        runtimeContext,
      );

      if (!consumeResult.success) {
        console.warn(`[autoConsumeForSession] Consume failed for item ${item.itemId}, rolling back consumed items...`);
        // Rollback lại các mặt hàng đã trừ của session này
        const rollbackResult = await rollbackInventoryConsumption(sessionLogId, runtimeContext);
        const rollbackError = rollbackResult.success ? '' : `; rollback thất bại: ${rollbackResult.error}`;
        return { success: false, error: `${consumeResult.error || 'Kho không đủ nguyên liệu'}${rollbackError}` };
      }
    }

    // Enqueue INVENTORY_CONSUMED outbox event if totalCost > 0
    if (consumptionPlan.totalCost > 0) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      const outboxEnqueued = await enqueueWithAutoClient(
        supabase,
        buildInventoryConsumedOutboxEvent({
          tenantId,
          sessionLogId,
          amount: consumptionPlan.totalCost,
        }),
        '[autoConsumeForSession]'
      );
      if (!outboxEnqueued) {
        throw new InventoryError('Failed to enqueue INVENTORY_CONSUMED accounting event', 'INVENTORY_OUTBOX_ENQUEUE_FAILED', { sessionLogId, totalCost: consumptionPlan.totalCost });
      }
    }

    return { success: true, processed: consumptionPlan.items.length, totalCost: consumptionPlan.totalCost };
  } catch (e: unknown) {
    console.error('[autoConsumeForSession]', e);
    // Hủy bỏ và hoàn kho nếu gặp lỗi hệ thống giữa chừng
    const rollbackResult = await rollbackInventoryConsumption(sessionLogId, runtimeContext ?? undefined);
    const rollbackError = rollbackResult.success ? '' : `; rollback thất bại: ${rollbackResult.error}`;
    return { success: false, error: `${getErrorMessage(e, 'Lỗi tiêu hao tự động')}${rollbackError}` };
  }
}

/**
 * Hoàn trả tồn kho vật tư khi hoàn tác ca làm việc (Rollback)
 */
export async function rollbackInventoryConsumption(sessionLogId: string, context?: InventoryRuntimeContext) {
  try {
    const { supabase, tenantId } = context ?? await getSupabaseWithTenant();
    if (!tenantId) return { success: false, error: 'Chưa đăng nhập' };

    // 1. Lấy toàn bộ logs tiêu hao của session này
    const { data: logs, error: fetchErr } = await supabase
      .from('inventory_logs')
      .select('id, item_id, change_amount')
      .eq('session_log_id', sessionLogId)
      .eq('reason', INVENTORY_REASONS.sessionConsumption)
      .eq('tenant_id', tenantId);

    if (fetchErr) {
      console.error('[rollbackInventoryConsumption] Error fetching logs:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    if (!logs || logs.length === 0) {
      return { success: true, processed: 0 };
    }

    // 2. Hoàn trả kho cho từng mặt hàng
    for (const log of logs) {
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select('stock_level')
        .eq('id', log.item_id)
        .eq('tenant_id', tenantId)
        .single();

      if (itemErr || !item) {
        return { success: false, error: itemErr?.message || `Không tìm thấy vật tư ${log.item_id} để hoàn kho` };
      }

      const updatePayload: InventoryItemUpdate = {
        stock_level: calculateRollbackStock({
          stockLevel: item.stock_level,
          changeAmount: log.change_amount,
        }),
      };
      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', log.item_id)
        .eq('tenant_id', tenantId);

      if (updateErr) {
        return { success: false, error: `Lỗi hoàn kho vật tư ${log.item_id}: ${updateErr.message}` };
      }
    }

    // 3. Xóa các logs này
    const logIds = logs.map(l => l.id);
    const { error: deleteErr } = await supabase
      .from('inventory_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', logIds);

    if (deleteErr) {
      console.error('[rollbackInventoryConsumption] Error deleting logs:', deleteErr);
      return { success: false, error: deleteErr.message };
    }

    return { success: true, processed: logs.length };
  } catch (e: unknown) {
    console.error('[rollbackInventoryConsumption] Error:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}
