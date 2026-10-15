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
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID required' }, { status: 400 });
    }

    // Year is variant metadata; agreed booking prices are not catalog data.
    const { data: variants, error } = await supabase
      .from('auto_variants')
      .select('id, name, year')
      .eq('tenant_id', profile.tenant_id)
      .eq('model_id', modelId)
      .order('year', { ascending: false })
      .order('name');

    if (error) {
      console.error('Variants fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 });
    }

    return NextResponse.json({ variants: variants || [] });
  } catch (error) {
    console.error('Variants fetch exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
