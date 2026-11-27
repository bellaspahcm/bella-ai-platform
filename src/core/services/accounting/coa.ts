'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '@/services/audit-actions';
import { getCurrentUser } from '@/services/user-actions';
import { createAccountingDataClient } from './client';
import { TT99_FULL_COA_CATALOG } from './tt99-coa';
import type { CreateAccountInput } from './types';

/**
 * Retrieve all accounting accounts for the current tenant.
 * 
 * @returns Array of accounting accounts ordered by account code
 * @throws Error if user is unauthorized or tenant session is missing
 * 
 * @remarks
 * Returns the complete Chart of Accounts (COA) for the current tenant.
 * Accounts are automatically filtered by tenant_id through RLS policies.
 * 
 * @example
 * ```typescript
 * const accounts = await getAccounts();
 * // Returns accounts like:
 * // [
 * //   { account_code: '111', account_name: 'Tiền mặt', account_type: 'ASSET', ... },
 * //   { account_code: '112', account_name: 'Tiền gửi ngân hàng', account_type: 'ASSET', ... },
 * //   ...
 * // ]
 * ```
 */
export async function getAccounts() {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');
  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('account_code', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create a new accounting account in the Chart of Accounts.
 * 
 * @param input - Account creation parameters including code, name, type, and optional parent
 * @returns Success result with created account data
 * @throws Error if user is not admin/super_admin or if account code already exists
 * 
 * @remarks
 * Only branch admins can create accounts. The account code must be unique within the tenant.
 * If a parent_id is provided, it must belong to the same tenant.
 * 
 * Uses Vietnamese TT133 accounting standard conventions:
 * - Class 1: Assets (1xx)
 * - Class 2: Liabilities (2xx)
 * - Class 3: Equity (3xx)
 * - Class 5: Expenses (5xx)
 * - Class 7: Revenue (7xx)
 * 
 * @example
 * ```typescript
 * // Create a new asset account
 * const result = await createAccount({
 *   account_code: '1131',
 *   account_name: 'Tạm ứng nhân viên',
 *   account_type: 'ASSET',
 *   parent_id: parentAccountId, // optional
 * });
 * ```
 */
export async function createAccount(input: CreateAccountInput) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }
  const supabase = await createAccountingDataClient();

  // Validate parent_id belongs to the same tenant if provided
  if (input.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('id', input.parent_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (parentError || !parent) {
      throw new Error('Tài khoản cha không hợp lệ hoặc không thuộc chi nhánh này.');
    }
  }

  const { data, error } = await supabase
    .from('accounting_accounts')
    .insert({
      tenant_id: user.tenant_id,
      account_code: input.account_code,
      account_name: input.account_name,
      account_type: input.account_type,
      parent_id: input.parent_id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Mã tài khoản "${input.account_code}" đã tồn tại trong hệ thống.`);
    }
    throw error;
  }

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_accounts',
    record_id: data.id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}

/**
 * Update an existing accounting account.
 * 
 * @param id - UUID of the account to update
 * @param input - Partial account update including name and/or active status
 * @returns Success result with updated account data
 * @throws Error if user is not admin/super_admin or account doesn't exist
 * 
 * @remarks
 * Only branch admins can update accounts. Account code cannot be changed after creation.
 * Use is_active flag to deactivate accounts instead of deleting them to preserve audit trail.
 * 
 * @example
 * ```typescript
 * // Rename an account
 * await updateAccount(accountId, {
 *   account_name: 'Tạm ứng nhân viên KTV',
 * });
 * 
 * // Deactivate an account
 * await updateAccount(accountId, {
 *   is_active: false,
 * });
 * ```
 */
export async function updateAccount(id: string, input: Partial<CreateAccountInput> & { is_active?: boolean }) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }
  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase
    .from('accounting_accounts')
    .update({
      account_name: input.account_name,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_accounts',
    record_id: id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}

/**
 * Idempotently seed the full Vietnamese Circular 99/2025/TT-BTC (TT99)
 * Chart of Accounts into `accounting_accounts` for the authenticated tenant.
 */
export async function seedTT99ChartOfAccounts() {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can seed the TT99 Chart of Accounts.');
  }
  const supabase = await createAccountingDataClient();

  const { data: existingRows, error: fetchError } = await supabase
    .from('accounting_accounts')
    .select('id, account_code')
    .eq('tenant_id', user.tenant_id);

  if (fetchError) throw fetchError;

  const codeToId = new Map<string, string>();
  for (const row of existingRows || []) {
    codeToId.set(row.account_code, row.id);
  }

  let insertedCount = 0;

  // Pass 1: Insert missing root accounts (no parent_code)
  const missingRoots = TT99_FULL_COA_CATALOG.filter(
    (item) => !item.parent_code && !codeToId.has(item.account_code),
  );
  if (missingRoots.length > 0) {
    const { data: insertedRoots, error: rootError } = await supabase
      .from('accounting_accounts')
      .insert(
        missingRoots.map((item) => ({
          tenant_id: user.tenant_id,
          account_code: item.account_code,
          account_name: item.account_name,
          account_type: item.account_type,
          parent_id: null,
          is_active: true,
        })),
      )
      .select('id, account_code');
    if (rootError) throw rootError;
    for (const row of insertedRoots || []) {
      codeToId.set(row.account_code, row.id);
      insertedCount += 1;
    }
  }

  // Pass 2: Insert missing child accounts with resolved parent_id
  const missingChildren = TT99_FULL_COA_CATALOG.filter(
    (item) => Boolean(item.parent_code) && !codeToId.has(item.account_code),
  );
  if (missingChildren.length > 0) {
    const { data: insertedChildren, error: childError } = await supabase
      .from('accounting_accounts')
      .insert(
        missingChildren.map((item) => ({
          tenant_id: user.tenant_id,
          account_code: item.account_code,
          account_name: item.account_name,
          account_type: item.account_type,
          parent_id: item.parent_code ? (codeToId.get(item.parent_code) ?? null) : null,
          is_active: true,
        })),
      )
      .select('id, account_code');
    if (childError) throw childError;
    insertedCount += (insertedChildren || []).length;
  }

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_accounts',
    record_id: user.tenant_id,
    new_data: {
      standard_profile: 'TT99',
      inserted_count: insertedCount,
      total_catalog_count: TT99_FULL_COA_CATALOG.length,
    },
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return {
    success: true,
    insertedCount,
    totalCatalogCount: TT99_FULL_COA_CATALOG.length,
  };
}
