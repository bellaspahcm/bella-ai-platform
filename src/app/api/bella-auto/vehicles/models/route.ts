import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    // Get models for brand
    const { data: models, error } = await supabase
      .from('auto_models')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .eq('brand_id', brandId)
      .order('name');

    if (error) {
      console.error('Models fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }

    return NextResponse.json({ models: models || [] });
  } catch (error) {
    console.error('Models fetch exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
