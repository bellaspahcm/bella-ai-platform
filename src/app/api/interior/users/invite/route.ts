import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database } from '@/types/database.types';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { interiorJsonBody, interiorMutationRow, interiorRbacRpcClient } from '@/products/bella-interior/lib/rbac-api';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

const ROLE_KEYS = new Set([
  'OWNER','ADMIN','SALES','DESIGNER','QS','PM','SITE_MANAGER',
  'PRODUCTION_MANAGER','QC','ACCOUNTANT','WARRANTY','EXECUTIVE',
]);
const SCOPE_TYPES = new Set(['TENANT','BRANCH','PROJECT','SELF']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<NextResponse> {
  const context = await resolveInteriorContext(request);
  if (!context.ok) return context.response;

  const body = await interiorJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : '';
  const roleKey = typeof body?.role_key === 'string' ? body.role_key : '';
  const scopeType = typeof body?.scope_type === 'string' ? body.scope_type : '';
  const scopeId = typeof body?.scope_id === 'string' ? body.scope_id : null;
  if (!EMAIL_PATTERN.test(email) || email.length > 320 || !fullName || fullName.length > 160
      || !ROLE_KEYS.has(roleKey) || !SCOPE_TYPES.has(scopeType)
      || (scopeType === 'BRANCH' || scopeType === 'PROJECT') && (!scopeId || !UUID_PATTERN.test(scopeId))
      || (scopeType === 'TENANT' || scopeType === 'SELF') && scopeId !== null) {
    return NextResponse.json({ success: false, error: 'INTERIOR_INVITATION_INPUT_INVALID' }, { status: 422 });
  }

  let admin: ReturnType<typeof createSupabaseAdminClient<Database>>;
  try {
    const { url, adminKey } = requireSupabaseAdminEnv();
    admin = createSupabaseAdminClient<Database>(url, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_AUTH_INVITATION_UNAVAILABLE' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const invitation = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  const invitedUserId = invitation.data.user?.id;
  if (invitation.error || !invitedUserId) {
    const duplicate = /already|exists|registered/i.test(invitation.error?.message ?? '');
    return NextResponse.json({ success: false, error: duplicate ? 'INTERIOR_ACCOUNT_ALREADY_EXISTS' : 'INTERIOR_INVITATION_FAILED' }, {
      status: duplicate ? 409 : 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const registered = await interiorRbacRpcClient(context.supabase).rpc('interior_register_invited_user', {
    p_user_id: invitedUserId,
    p_full_name: fullName,
    p_role_key: roleKey,
    p_scope_type: scopeType,
    p_scope_id: scopeId,
  });
  const outcome = interiorMutationRow(registered.data);
  if (registered.error || !outcome || outcome.status !== 'COMMITTED') {
    await admin.auth.admin.deleteUser(invitedUserId);
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : null;
    const status = reason === 'ROLE_NOT_DELEGATED' || reason === 'OWNER_ONLY_TENANT_SCOPE' ? 403
      : reason === 'INVALID_SCOPE' || reason === 'INVALID_USER_ROLE_OR_SCOPE' ? 422
        : registered.error ? 503 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_INVITATION_ASSIGNMENT_FAILED', ...(reason ? { reason } : {}) }, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json({
    success: true,
    user_id: invitedUserId,
    role_key: roleKey,
    scope_type: scopeType,
  }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
