'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { recordAuditLog } from './audit-actions';
import { CurrentUser, StaffRecord } from '@/types/domain';
import type { Database } from '@/types/database.types';
import { getMonthStart } from '@/lib/utils';
import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type UserRow = Database['public']['Tables']['users']['Row'];
type UserUpdate = Database['public']['Tables']['users']['Update'];
type SalarySupabaseClient = SupabaseJsClient<Database>;
type SupabaseQueryError = { code?: string; message?: string } | null;

interface UserWithLogsAndReviews {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string | null;
  tenant_id: string | null;
  session_logs: { count: number }[];
  session_reviews: { rating: number }[];
}

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: string;
}

interface CreateUserResult {
  data?: UserRow;
  defaultPassword?: string;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
}

interface DeleteUserResult {
  success?: boolean;
  message?: string;
  error?: string;
}

const IDENTITY_MANAGEMENT_HOLD =
  'IDENTITY_MANAGEMENT_AUTHORIZATION_NOT_READY: Tạm dừng tạo/xóa nhân sự cho đến khi quyền quản lý tài khoản được xác minh.';

function isMissingSingleRowError(error: SupabaseQueryError) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST116' ||
    message.includes('json object requested') ||
    message.includes('0 rows') ||
    message.includes('no rows')
  );
}

function isMissingAuthSessionError(error: unknown) {
  const message = getErrorMessage(error, '').toLowerCase();
  
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (errObj.code === 'refresh_token_not_found' || errObj.status === 400) {
      return true;
    }
  }

  return (
    message.includes('auth session missing') ||
    message.includes('session missing') ||
    message.includes('no current user') ||
    message.includes('refresh token') ||
    message.includes('invalid refresh token')
  );
}


function assertNonMissingQueryError(error: SupabaseQueryError, context: string) {
  if (!error || isMissingSingleRowError(error)) return;
  throw new Error(`${context}: ${error instanceof Error ? error.message : 'Unknown database error'}`);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isMissingAuthSessionError(authError)) {
    console.error('[getCurrentUser] Auth user validation failed:', authError);
    throw new Error(`Failed to validate current user: ${getErrorMessage(authError)}`);
  }
  
  if (authError || !user) {
    if (process.env.NODE_ENV === 'development') {
      try {
        const { cookies, headers } = await import('next/headers');
        const reqHeaders = await headers();
        const cookieStore = await cookies();
        const mockEmail = reqHeaders.get('x-mock-user-email') || cookieStore.get('mock_user_email')?.value;
        if (mockEmail) {
          const adminUrl = getSupabaseAdminUrl();
          const adminKey = getSupabaseAdminKey();
          if (adminUrl && adminKey) {
            const { createClient: createAdminClient } = await import('@supabase/supabase-js');
            const adminClient = createAdminClient<Database>(adminUrl, adminKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data: devProfile } = await adminClient
              .from('users')
              .select('*')
              .eq('email', mockEmail)
              .single();
            if (devProfile && devProfile.status === 'active' && devProfile.tenant_id) {
              const { data: tenant } = await adminClient
                .from('tenants')
                .select('status')
                .eq('id', devProfile.tenant_id)
                .single();
              if (tenant && tenant.status === 'active') {
                return { ...devProfile, role: devProfile.role.toLowerCase() };
              }
            }
          }
        }
      } catch {
        // headers/cookies may fail outside request context
      }
    }
    return null;
  }

  // Authorization must reflect live canonical state, never a cached profile or email alias.
  const { data: mainProfile, error: mainProfileError } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, role, status, tenant_id')
    .eq('id', user.id)
    .single();
  if (mainProfileError?.code === '42501') return null;
  assertNonMissingQueryError(
    mainProfileError as SupabaseQueryError,
    '[getCurrentUser] Failed to fetch profile by auth id',
  );
  
  if (!mainProfile || mainProfile.id !== user.id || mainProfile.status !== 'active' || !mainProfile.tenant_id) {
    return null;
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('status')
    .eq('id', mainProfile.tenant_id)
    .single();
  if (tenantError?.code === '42501') return null;
  assertNonMissingQueryError(tenantError, '[getCurrentUser] Failed to fetch tenant status');
  if (!tenant || tenant.status !== 'active') return null;

  return { ...mainProfile, role: mainProfile.role.toLowerCase() };
}


export async function getUsers(): Promise<StaffRecord[]> {
  const supabase = await createDevelopmentBypassClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('[getUsers] Missing tenantId for current user');
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      session_logs(count),
      session_reviews(rating)
    `)
    .eq('tenant_id', tenantId)
    .is('resignation_date', null) // Only show active employees (not resigned)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`[getUsers] users query failed: ${error.message}`);
  }

  const processedData: StaffRecord[] = (data as unknown as UserWithLogsAndReviews[] || []).map((user) => {
    const reviews = user.session_reviews || [];
    const avgRating = reviews.length 
      ? reviews.reduce((acc: number, r) => acc + r.rating, 0) / reviews.length 
      : 5.0;
    
    return {
      id: user.id,
      full_name: user.full_name || '',
      email: user.email,
      role: user.role,
      status: user.status,
      sessions_count: user.session_logs?.[0]?.count || 0,
      avg_rating: avgRating.toFixed(1),
      // Truyền qua để form Cập nhật nhân sự hiển thị đúng dữ liệu
      hire_date: (user as unknown as Record<string, unknown>).hire_date as string | null ?? null,
      position_tier: (user as unknown as Record<string, unknown>).position_tier as 'junior' | 'senior' | 'lead' | null ?? null,
    };
  });


  return processedData;
}

function getErrorMessage(error: unknown, fallback = 'Loi he thong') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

async function rollbackUserUpdate(
  supabase: SupabaseClient,
  id: string,
  payload: UserUpdate,
  tenantId: string,
) {
  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return error?.message || '';
}

function formatRollbackNotes(notes: Array<[string, string]>) {
  return notes
    .filter(([, message]) => message)
    .map(([label, message]) => `; ${label} failed: ${message}`)
    .join('');
}

async function recalculateCurrentMonthSalary(
  supabase: SupabaseClient,
  ktvId: string,
  tenantId: string,
) {
  const { recalculateAndSaveSalaryRecordEngine } = await import('@/modules/hr-salary/actions/salary-recalculation-engine');
  return recalculateAndSaveSalaryRecordEngine(
    supabase as unknown as SalarySupabaseClient,
    ktvId,
    getMonthStart(),
    tenantId,
  );
}

async function rollbackBaseSalaryChange(
  supabase: SupabaseClient,
  id: string,
  previousBaseSalary: number | null,
  tenantId: string,
  recalcTenantId?: string | null,
) {
  const userRollbackError = await rollbackUserUpdate(supabase, id, {
    base_salary: previousBaseSalary,
  }, tenantId);

  let salaryRollbackError = '';
  if (!userRollbackError && recalcTenantId) {
    try {
      await recalculateCurrentMonthSalary(supabase, id, recalcTenantId);
    } catch (error: unknown) {
      salaryRollbackError = getErrorMessage(error);
    }
  }

  return formatRollbackNotes([
    ['user rollback', userRollbackError],
    ['salary rollback', salaryRollbackError],
  ]);
}

export async function createUser(_formData: CreateUserInput): Promise<CreateUserResult> {
  // Temporary containment: the canonical management and assignable-role contract is unproven.
  // Hold every caller before account, profile, audit, cache, or email side effects.
  return { error: IDENTITY_MANAGEMENT_HOLD };
}

export async function updateUserStatus(id: string, status: 'active' | 'inactive') {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh cua nguoi dung hien tai.' };
  }

  const { data: previousUser, error: snapshotError } = await supabase
    .from('users')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }
  
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating user status:', error);
    return { error: error.message };
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { status: previousUser.status },
      new_data: { status }
    });
  } catch (auditError: unknown) {
    const rollbackError = await rollbackUserUpdate(supabase, id, {
      status: previousUser.status,
    }, tenantId);
    const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
    return { error: `Failed to record user status audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  
  // Invalidate Redis cache for this user
  const { deleteCache, CacheKeys } = await import('@/lib/redis-cache');
  void deleteCache(CacheKeys.user(id));
  
  return { success: true };
}

export async function updateUser(
  id: string, 
  formData: { 
    full_name: string; 
    role: string;
    position_tier?: 'junior' | 'senior' | 'lead' | null;
    hire_date?: string | null;
  }
) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh cua nguoi dung hien tai.' };
  }

  const { data: previousUser, error: snapshotError } = await supabase
    .from('users')
    .select('full_name, role, position_tier, hire_date')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }
  
  const updatePayload: UserUpdate = {
    full_name: formData.full_name,
    role: formData.role,
  };

  // Only update position_tier and hire_date if provided (use type assertion for new fields)
  if (formData.position_tier !== undefined) {
    updatePayload.position_tier = formData.position_tier ?? 'junior';
  }
  if (formData.hire_date !== undefined) {
    updatePayload.hire_date = formData.hire_date;
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating user:', error);
    return { error: error.message };
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { 
        full_name: previousUser?.full_name, 
        role: previousUser?.role,
        position_tier: previousUser?.position_tier,
        hire_date: previousUser?.hire_date,
      },
      new_data: updatePayload,
    });
  } catch (auditError: unknown) {
    const rollbackError = await rollbackUserUpdate(supabase, id, {
      full_name: previousUser?.full_name,
      role: previousUser?.role,
    } as UserUpdate, tenantId);
    const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
    return { error: `Failed to record user update audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  
  // Trigger salary recalculation if position_tier or hire_date changed for KTV roles
  const isKTVRole = formData.role === 'ktv' || formData.role === 'ktv_lead';
  const positionChanged = formData.position_tier !== undefined && formData.position_tier !== previousUser?.position_tier;
  const hireDateChanged = formData.hire_date !== undefined && formData.hire_date !== previousUser?.hire_date;
  
  if (isKTVRole && (positionChanged || hireDateChanged)) {
    try {
      // Get current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Recalculate salary for current month
      const { recalculateAndSaveSalaryRecordEngine } = await import('@/modules/hr-salary/actions/salary-recalculation-engine');
      await recalculateAndSaveSalaryRecordEngine(
        supabase,
        id,
        tenantId,
        currentMonth
      );
      
      console.log(`[updateUser] Recalculated salary for user ${id} due to position/hire date change`);
    } catch (recalcError) {
      // Log error but don't fail the user update
      console.error('[updateUser] Failed to recalculate salary:', recalcError);
    }
  }
  
  return { success: true };
}

export async function deleteUser(_id: string): Promise<DeleteUserResult> {
  // Do not delete Auth identities before a denied profile mutation or infer management authority.
  return { error: IDENTITY_MANAGEMENT_HOLD };
}

export async function updateBaseSalary(id: string, base_salary: number) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return { error: 'Quyền truy cập bị từ chối: Chỉ Admin hoặc Manager mới có quyền thay đổi lương cứng.' };
  }

  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh cua nguoi dung hien tai.' };
  }

  const {
    data: previousUser,
    error: snapshotError,
  }: {
    data: Pick<UserRow, 'base_salary' | 'role' | 'tenant_id'> | null;
    error: { message?: string } | null;
  } = await supabase
    .from('users')
    .select('base_salary, role, tenant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }

  const { error } = await supabase
    .from('users')
    .update({ base_salary })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating base salary:', error);
    return { error: error.message };
  }

  const recalcTenantId = previousUser.role === 'ktv' ? tenantId : null;

  if (recalcTenantId) {
    try {
      await recalculateCurrentMonthSalary(supabase, id, recalcTenantId);
    } catch (recalcError: unknown) {
      const rollbackNote = await rollbackBaseSalaryChange(
        supabase,
        id,
        previousUser.base_salary,
        tenantId,
        recalcTenantId,
      );
      return { error: `Failed to recalculate salary after base salary update: ${getErrorMessage(recalcError)}${rollbackNote}` };
    }
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { base_salary: previousUser.base_salary },
      new_data: { base_salary }
    });
  } catch (auditError: unknown) {
    const rollbackNote = await rollbackBaseSalaryChange(
      supabase,
      id,
      previousUser.base_salary,
      tenantId,
      recalcTenantId,
    );
    return { error: `Failed to record base salary audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}


