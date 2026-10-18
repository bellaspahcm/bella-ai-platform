import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { PreschoolAnalyticsRepository } from '@/products/bella-education/analytics/repositories/preschool-analytics.repository';
import { PreschoolAnalyticsService } from '@/products/bella-education/analytics/services/preschool-analytics.service';

type AnalyticsClient = SupabaseClient<Database>;

function createAdminOperationClient(): AnalyticsClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message);
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const currentUser = await getCurrentUser();
    let tenantId = currentUser?.tenant_id;
    if (!tenantId && process.env.NODE_ENV === 'development') {
      const mockEmail = request.headers.get('x-mock-user-email')?.trim();
      if (mockEmail) {
        const adminClient = createAdminOperationClient();
        if (adminClient) {
          const { data: user } = await adminClient.from('users').select('tenant_id').eq('email', mockEmail).maybeSingle();
          if (user?.tenant_id) tenantId = user.tenant_id;
        }
      }
      if (!tenantId) {
        tenantId = 'ed100000-0000-0000-0000-000000000001';
      }
    }

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }
    const role = currentUser?.role?.toLowerCase() ?? 'admin';
    if (role === 'parent' || role === 'student') {
      return NextResponse.json({ success: false, error: 'ANALYTICS_ROLE_FORBIDDEN' }, { status: 403 });
    }

    const supabase = createAdminOperationClient() ?? await createClient();
    const repo = new PreschoolAnalyticsRepository(supabase);
    const service = new PreschoolAnalyticsService(repo);

    const dashboard = await service.getExecutiveDashboard(tenantId, date);

    return NextResponse.json({ success: true, dashboard });
  } catch (error) {
    console.error('Preschool Analytics API Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Internal Server Error' }, { status: 500 });
  }
}
