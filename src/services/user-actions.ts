'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { recordAuditLog } from './audit-actions';
import { CurrentUser, StaffRecord } from '@/types/domain';
import { randomBytes } from 'crypto';
import type { Database } from '@/types/database.types';
import { getMonthStart } from '@/lib/utils';
import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';

import { sendTemporaryPasswordEmail } from '@/lib/mail';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = {
  from: SupabaseClient['from'];
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};
type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserRow = Database['public']['Tables']['users']['Row'];
type UserUpdate = Database['public']['Tables']['users']['Update'];
type StaffLeaveInsert = Database['public']['Tables']['staff_leaves']['Insert'];
type StaffLeaveRow = Database['public']['Tables']['staff_leaves']['Row'];
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
  
  if (authError || !user) return null;

  // Authorization must reflect live canonical state, never a cached profile or email alias.
  const { data: mainProfile, error: mainProfileError } = await supabase
    .from('users')
    .select('*')
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

import { checkSubscriptionLimit } from '@/lib/subscription';

function generateTemporaryPassword() {
  return `Bella-${randomBytes(9).toString('base64url')}1aA!`;
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

function toUserInsertSnapshot(user: UserRow): UserInsert {
  return {
    avatar_url: user.avatar_url,
    base_salary: user.base_salary,
    created_at: user.created_at,
    email: user.email,
    full_name: user.full_name,
    hire_date: user.hire_date,
    id: user.id,
    phone: user.phone,
    resignation_date: user.resignation_date,
    role: user.role,
    status: user.status,
    tenant_id: user.tenant_id,
    updated_at: user.updated_at,
  };
}

function toUserAuditSnapshot(user: UserRow) {
  return toUserInsertSnapshot(user);
}

function _toStaffLeaveInsertSnapshot(leave: StaffLeaveRow): StaffLeaveInsert {
  return {
    approved_by: leave.approved_by,
    created_at: leave.created_at,
    id: leave.id,
    leave_date: leave.leave_date,
    leave_type: leave.leave_type,
    reason: leave.reason,
    rejection_reason: leave.rejection_reason,
    status: leave.status,
    tenant_id: leave.tenant_id,
    updated_at: leave.updated_at,
    user_id: leave.user_id,
  };
}

async function _restoreDeletedUser(
  supabase: SupabaseClient,
  payload: UserInsert,
) {
  const { error } = await supabase
    .from('users')
    .insert([payload]);

  return error?.message || '';
}

async function _restoreDeletedStaffLeaves(
  supabase: SupabaseClient,
  payloads: StaffLeaveInsert[],
) {
  if (payloads.length === 0) return '';

  const { error } = await supabase
    .from('staff_leaves')
    .insert(payloads);

  return error?.message || '';
}

async function rollbackCreatedAuthUser(
  supabaseAdmin: AdminSupabaseClient,
  authUserId: string,
) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  return error?.message || '';
}

async function rollbackCreatedUserProfile(
  supabaseAdmin: AdminSupabaseClient,
  authUserId: string,
) {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', authUserId);

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

export async function createUser(formData: CreateUserInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.tenant_id) {
      return { error: 'Không xác định được chi nhánh của người dùng hiện tại.' };
    }

    const targetRole = (formData.role || 'ktv').trim().toLowerCase();

    if (targetRole === 'ktv' || targetRole === 'ktv_lead') {
      const ktvLimit = await checkSubscriptionLimit(currentUser.tenant_id, 'ktv');
      if (ktvLimit.isBlocked) {
        return { error: 'Vượt quá giới hạn nhân sự kỹ thuật viên của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.' };
      }
    }

    // STEP 1 — Create the Supabase Auth account first so the employee can log in.
    // Without this, the public.users row was a dead record (no auth → no login).
    // Pattern mirrors registerNewTenant() in onboarding-actions.ts.
    const serviceRoleKey = getSupabaseAdminKey();
    const supabaseUrl = getSupabaseAdminUrl();
    console.warn('[createUser] env check', {
      hasAdminKey: !!serviceRoleKey,
      hasUrl: !!supabaseUrl,
    });

    if (!serviceRoleKey) {
      return { error: 'Hệ thống chưa cấu hình SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY ở Vercel — không thể tạo tài khoản đăng nhập. Vào Vercel → Settings → Environment Variables để thêm.' };
    }
    if (!supabaseUrl) {
      return { error: 'Hệ thống chưa cấu hình NEXT_PUBLIC_SUPABASE_URL — không thể kết nối Supabase.' };
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const temporaryPassword = generateTemporaryPassword();

    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: temporaryPassword,
      email_confirm: true, // bypass confirmation email (rate limit + UX)
      user_metadata: { full_name: formData.full_name },
    });

    console.warn('[createUser] auth.admin.createUser result', {
      hasUser: !!adminData?.user?.id,
      authUserId: adminData?.user?.id ?? null,
      errorMessage: adminError?.message ?? null,
      errorStatus: (adminError as { status?: number } | null)?.status ?? null,
    });

    if (adminError) {
      console.error('[createUser] Auth user creation failed:', adminError);
      if (adminError.message?.toLowerCase().includes('already') || adminError.message?.includes('registered')) {
        return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
      }
      return { error: `Không thể tạo tài khoản đăng nhập: ${adminError.message}` };
    }

    const authUserId = adminData?.user?.id;
    if (!authUserId) {
      return { error: 'Tạo tài khoản đăng nhập không thành công (auth user id rỗng).' };
    }

    // STEP 2 — Insert the profile row with id matching the auth user, so
    // getCurrentUser()'s primary id lookup (users.id = auth.uid) hits directly.
    // Uses supabaseAdmin (service role) to bypass any RLS policy that might
    // restrict cross-user inserts on public.users (id != auth.uid()).
    const userPayload: UserInsert = {
      id: authUserId,
      email: formData.email,
      full_name: formData.full_name,
      role: targetRole,
      status: 'active',
      tenant_id: currentUser.tenant_id,
    };

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([userPayload])
      .select()
      .single();

    if (error) {
      // Rollback the auth user so we don't leave an orphan account hanging.
      const authRollbackError = await rollbackCreatedAuthUser(supabaseAdmin, authUserId);
      console.error('[createUser] Profile insert failed:', error);
      const rollbackNote = formatRollbackNotes([
        ['auth rollback', authRollbackError],
      ]);
      if (!rollbackNote && (error.code === '23505' || error.message?.includes('users_email_key'))) {
        return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
      }
      return { error: `${error.message}${rollbackNote}` };
    }

    try {
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'users',
        record_id: data.id,
        new_data: {
          full_name: formData.full_name,
          email: formData.email,
          role: targetRole,
        },
      });
    } catch (auditError: unknown) {
      const profileRollbackError = await rollbackCreatedUserProfile(supabaseAdmin, authUserId);
      const authRollbackError = await rollbackCreatedAuthUser(supabaseAdmin, authUserId);
      const rollbackNote = formatRollbackNotes([
        ['profile rollback', profileRollbackError],
        ['auth rollback', authRollbackError],
      ]);
      return { error: `Failed to record user create audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
    }

    await safeRevalidatePath('/dashboard/settings');

    let emailSent = false;
    let emailError: string | undefined;

    try {
      const mailResult = await sendTemporaryPasswordEmail(
        formData.email,
        formData.full_name,
        temporaryPassword
      );
      emailSent = mailResult.success;
      emailError = mailResult.error;
    } catch (err: unknown) {
      console.error('[createUser] Error calling sendTemporaryPasswordEmail:', err);
      emailError = getErrorMessage(err, 'UNKNOWN_MAIL_ERROR');
    }

    return {
      data,
      defaultPassword: temporaryPassword,
      emailSent,
      emailError,
    };
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error('[createUser] Exception thrown:', err);
    return { error: `Lỗi khởi tạo nhân sự: ${message}` };
  }
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

export async function deleteUser(id: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh cua nguoi dung hien tai.' };
  }

  const {
    data: previousUser,
    error: snapshotError,
  }: { data: UserRow | null; error: { message?: string } | null } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }

  const {
    data: _previousStaffLeaves,
    error: staffLeavesSnapshotError,
  }: { data: StaffLeaveRow[] | null; error: { message?: string } | null } = await supabase
    .from('staff_leaves')
    .select('*')
    .eq('user_id', id)
    .eq('tenant_id', tenantId);

  if (staffLeavesSnapshotError) {
    return { error: staffLeavesSnapshotError.message || 'Failed to snapshot staff leaves' };
  }
  
  // Always use soft delete to prevent foreign key constraint violations
  // Many tables reference users: bookings, attendance, sessions, salary_records, 
  // expenses, audit_logs, kpi_records, leave_requests, product_sales, etc.
  
  // IMPORTANT: Delete from Supabase Auth first to free email for reuse
  const { deleteAuthUser } = await import('@/lib/supabase-admin');
  const authDeleteError = await deleteAuthUser(id);
  if (authDeleteError) {
    console.warn('[deleteUser] Failed to delete from auth.users:', authDeleteError);
    // Continue with soft delete anyway - auth deletion is best-effort
  }
  
  // Soft delete in public.users: Set resignation_date + archive email
  const timestamp = Date.now();
  const originalEmail = previousUser.email;
  const archivedEmail = originalEmail ? `${timestamp}.deleted.${originalEmail}` : `${timestamp}.deleted@archived.local`;
  
  const { error: softDeleteError } = await supabase
    .from('users')
    .update({ 
      resignation_date: new Date().toISOString().split('T')[0],
      email: archivedEmail, // Archive email to free it for reuse
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  
  if (softDeleteError) {
    console.error('Error soft deleting user:', softDeleteError);
    return { error: 'Không thể xóa nhân sự: ' + softDeleteError.message };
  }
  
  // Record audit log for soft delete
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: toUserAuditSnapshot(previousUser),
      new_data: { resignation_date: new Date().toISOString().split('T')[0] }
    });
  } catch (auditError: unknown) {
    console.warn('Failed to record soft delete audit log:', auditError);
    // Don't rollback soft delete if audit fails
  }
  
  await safeRevalidatePath('/dashboard/settings');
  return { 
    success: true,
    message: 'Nhân sự đã được đánh dấu nghỉ việc.'
  };
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


