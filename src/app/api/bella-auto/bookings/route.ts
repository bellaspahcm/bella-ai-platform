import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { bookingAllocationHttp } from '@/modules/bella-auto/services/AutoMoveBookingAllocationHttp';

interface CreateBookingRequest {
  // Customer
  customerId?: string;
  customerPhone: string;
  customerName: string;
  customerAddress?: string;
  
  // Vehicle
  variantId: string;
  vehicleId?: string;
  colorExterior: string;
  
  // Pricing
  totalPrice: number;
  depositAmount: number;
  depositPaid?: number;
}

export async function POST(request: Request) {
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

    const body: CreateBookingRequest = await request.json();

    // Validation
    if (!body.customerPhone || !body.customerName) {
      return NextResponse.json({ error: 'Customer phone and name required' }, { status: 400 });
    }

    if (!body.variantId || !body.colorExterior) {
      return NextResponse.json({ error: 'Vehicle variant and color required' }, { status: 400 });
    }

    if (!body.totalPrice || body.totalPrice <= 0) {
      return NextResponse.json({ error: 'Valid total price required' }, { status: 400 });
    }

    if (body.depositAmount === undefined || body.depositAmount < 0 || body.depositAmount > body.totalPrice) {
      return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 });
    }

    if (body.vehicleId) {
      return bookingAllocationHttp(request, user.id, body);
    }

    let customerId = body.customerId;

    // Create customer if needed
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          tenant_id: profile.tenant_id,
          name_mother: body.customerName,
          phone: body.customerPhone,
          address: body.customerAddress || null,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Customer creation error:', customerError);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
      }

      customerId = newCustomer.id;
    }

    // Generate booking number (format: BA-YYYYMMDD-XXXX)
    const today = new Date();
    const datePrefix = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const { data: todayBookings } = await supabase
      .from('auto_bookings')
      .select('booking_number')
      .eq('tenant_id', profile.tenant_id)
      .like('booking_number', `BA-${datePrefix}-%`)
      .order('booking_number', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (todayBookings && todayBookings.length > 0) {
      const lastNumber = todayBookings[0].booking_number.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    const bookingNumber = `BA-${datePrefix}-${sequence.toString().padStart(4, '0')}`;

    // Determine initial status
    const depositPaidAmount = body.depositPaid || 0;
    const status = depositPaidAmount > 0 ? 'deposit_confirmed' : 'pending_deposit';

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('auto_bookings')
      .insert({
        tenant_id: profile.tenant_id,
        booking_number: bookingNumber,
        customer_id: customerId,
        variant_id: body.variantId,
        vehicle_id: body.vehicleId || null,
        color_exterior: body.colorExterior,
        total_price: body.totalPrice,
        deposit_amount: body.depositAmount,
        deposit_paid: depositPaidAmount,
        status: status,
        metadata: { createdByUserId: user.id },
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      booking,
      message: `Booking ${bookingNumber} đã được tạo thành công`
    });

  } catch (error) {
    console.error('Booking creation exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
