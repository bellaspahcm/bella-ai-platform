import 'server-only';

import { isTechnicianRole, ROLE_GROUPS } from '@bella/shared';
import { createClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getCurrentUser } from '@/services/user-actions';

export async function getBookingTenantActor(tenantId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id || currentUser.tenant_id !== tenantId
    || currentUser.isSuspended) {
    throw new Error('Không có quyền xác minh KTV của tenant này.');
  }

  const supabase = await createClient();
  const { data: actor, error } = await supabase
    .from('users')
    .select('id, tenant_id, role, status, resignation_date')
    .eq('id', currentUser.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !actor || actor.tenant_id !== tenantId || actor.status !== 'active' || actor.resignation_date) {
    throw new Error('Không có quyền xác minh KTV của tenant này.');
  }

  return actor;
}

export async function getEligibleBookingKtvs(tenantId: string, ktvId?: string) {
  await getBookingTenantActor(tenantId);
  const supabase = await createClient();
  let query = supabase
    .from('users')
    .select('id, full_name, position_tier, metadata, tenant_id, role, status, resignation_date')
    .eq('tenant_id', tenantId)
    .in('role', [...ROLE_GROUPS.TECHNICIAN])
    .eq('status', 'active')
    .is('resignation_date', null);

  if (ktvId !== undefined) query = query.eq('id', ktvId);

  const { data, error } = await query;
  if (error) throw new Error('Không thể xác minh quyền KTV. Vui lòng thử lại.');

  const candidates = (data ?? []).filter(row => row.tenant_id === tenantId
    && isTechnicianRole(row.role) && row.status === 'active' && !row.resignation_date);
  if (candidates.length === 0) return [];

  // Admin access is only for Auth identity verification, never for tenant data.
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error('Hệ thống chưa cấu hình xác minh tài khoản đăng nhập KTV.');

  const eligible: typeof candidates = [];
  for (const candidate of candidates) {
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(candidate.id);
    if (authError) {
      if (authError.status === 404 || authError.code === 'user_not_found') continue;
      throw new Error('Không thể xác minh tài khoản đăng nhập KTV. Vui lòng thử lại.');
    }

    const identity = authData?.user;
    if (!identity || identity.id !== candidate.id || identity.deleted_at || identity.is_anonymous) continue;
    if (identity.banned_until) {
      const bannedUntil = Date.parse(identity.banned_until);
      if (!Number.isFinite(bannedUntil) || bannedUntil > Date.now()) continue;
    }

    eligible.push(candidate);
  }

  return eligible;
}
