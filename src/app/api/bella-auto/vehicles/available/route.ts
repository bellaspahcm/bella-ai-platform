import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { listAvailableVehiclesForVariant } from '@/platform/mobility/supabase-vehicle-contract';

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
    const variantId = searchParams.get('variantId');
    const colorExterior = searchParams.get('colorExterior');

    if (!variantId) {
      return NextResponse.json({ error: 'Variant ID required' }, { status: 400 });
    }

    const vehicles = await listAvailableVehiclesForVariant(supabase, {
      tenantId: profile.tenant_id,
      variantId,
      colorExterior: colorExterior ?? undefined,
    });

    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        vin: vehicle.vin,
        color_exterior: vehicle.colorExterior,
        status: vehicle.status,
      })),
    });
  } catch (error) {
    console.error('Available vehicles fetch exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
