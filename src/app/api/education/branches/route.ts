import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/services/user-actions';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { PreschoolChainService, PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';

type EducationBranchClient = SupabaseClient<Database>;

function createAdminOperationClient(): EducationBranchClient | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor?.id) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if (!actor.tenant_id || !['admin','super_admin','admin_staff'].includes(actor.role.toLowerCase())) return NextResponse.json({success:false,error:'PRESCHOOL_CHAIN_ACTOR_DENIED'},{status:403});
    const client = createAdminOperationClient() ?? await createClient();
    const branches = await new PreschoolChainService(client).listAccessibleBranches(actor.tenant_id,actor.id);

    return NextResponse.json({
      success: true,
      branches,
      count: branches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Preschool branches';
    return NextResponse.json({ success: false, error: message }, { status: error instanceof PreschoolChainError ? error.status : 500 });
  }
}
