import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

type EducationSupabaseClient = SupabaseClient;

async function getOperationClient(): Promise<EducationSupabaseClient> {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (adminUrl && adminKey) {
    return createSupabaseClient(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return (await createClient()) as SupabaseClient;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const tenantId = user?.tenant_id || '00000000-0000-0000-0000-000000000001';

    const body = (await request.json()) as {
      studentPartyId?: string;
      guardianPartyId?: string;
      validityDays?: number;
    };

    const studentPartyId = body?.studentPartyId;
    if (!studentPartyId || typeof studentPartyId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'STUDENT_REQUIRED', message: 'Mã học sinh là bắt buộc' },
        { status: 400 }
      );
    }

    const supabase = await getOperationClient();

    // If guardianPartyId not explicitly passed, find the active guardian from party_relationships
    let guardianPartyId: string = body?.guardianPartyId || '';
    if (!guardianPartyId) {
      const { data: relationship } = await supabase
        .from('party_relationships')
        .select('source_party_id')
        .eq('tenant_id', tenantId)
        .eq('target_party_id', studentPartyId)
        .in('relationship_type', ['guardian_of', 'parent_of'])
        .limit(1)
        .maybeSingle();

      const rel = relationship as { source_party_id?: string } | null;
      guardianPartyId = rel?.source_party_id || '00000000-0000-0000-0000-000000000002';
    }

    const token = PreschoolParentPortalService.generatePortalToken(
      {
        tenantId,
        guardianPartyId,
        studentPartyId,
      },
      body?.validityDays || 60
    );

    const portalUrl = `/portal/education/${token}`;

    return NextResponse.json({
      success: true,
      token,
      portalUrl,
      tenantId,
      guardianPartyId,
      studentPartyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo token portal phụ huynh';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
