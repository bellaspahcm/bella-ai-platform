'use server';

import { createClient } from '@/lib/supabase-server';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from './user-actions';
import { resolvePackageName } from '@bella/shared';;
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type AppSupabaseClient = SupabaseClient<Database>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
type CustomerCreateInput =
  Partial<Omit<CustomerInsert, 'tenant_id' | 'name_mother' | 'phone'>> &
  Pick<Partial<CustomerInsert>, 'tenant_id' | 'name_mother' | 'phone'> & {
    name?: string;
  };
type PackageRow = Database['public']['Tables']['packages']['Row'];
type PromotionRow = Database['public']['Tables']['promotions']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type RevenueRow = Database['public']['Tables']['revenue']['Row'];
type TenantRow = Database['public']['Tables']['tenants']['Row'];
type SessionReviewInsert = Database['public']['Tables']['session_reviews']['Insert'];

export type CustomerPortalBooking = BookingRow & {
  customers?: Pick<CustomerRow, 'name_mother' | 'phone' | 'loyalty_points'> | null;
  packages?: Pick<PackageRow, 'name'> | null;
  assigned_ktv?: { id: string; full_name: string | null; phone: string | null } | null;
  session_logs?: (SessionLogRow & {
    completed_by_ktv?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  })[];
  tenants?: Pick<
    TenantRow,
    | 'id'
    | 'name'
    | 'contact_phone'
    | 'logo_url'
    | 'brand_theme'
    | 'enabled_modules'
    | 'qr_bank_code'
    | 'qr_account_number'
    | 'qr_account_name'
  > | null;
  revenue?: RevenueRow[];
  active_promotions?: PromotionRow[];
};

type RatingSession = Pick<
  SessionLogRow,
  'completed_by_ktv_id' | 'tenant_id' | 'rating' | 'rating_comment'
> & {
  bookings?: Pick<BookingRow, 'customer_id'> | null;
};

type CustomerListRevenue = Pick<RevenueRow, 'amount' | 'status' | 'revenue_type' | 'tenant_id'>;
type CustomerListBooking = Pick<
  BookingRow,
  | 'deposit_amount'
  | 'package_name'
  | 'full_price'
  | 'discount_percent'
  | 'created_at'
  | 'is_in_care'
  | 'status'
  | 'total_sessions'
  | 'completed_sessions'
  | 'tenant_id'
> & {
  revenue?: CustomerListRevenue[] | null;
};
type CustomerListRow = CustomerRow & {
  bookings?: CustomerListBooking[] | null;
};
type GetCustomersOptions = {
  limit?: number;
  offset?: number;
};

const CUSTOMER_TENANT_ACCESS_ERROR = 'Không xác định được đơn vị kinh doanh của người dùng hiện tại.';

async function getCurrentTenantId() {
  const currentUser = await getCurrentUser();
  return currentUser?.tenant_id || null;
}

/**
 * Truy xuất thông tin booking qua Share Token (Dành cho khách hàng)
 */
export async function getCustomerBookingByToken(token?: string) {
  // When a token is provided, we use the service-role client to bypass RLS.
  // The token itself (64-bit random hex) IS the security boundary — anyone
  // with the token can read the booking, which is the magic-link model.
  // Anon client cannot read public.bookings (RLS policy "Guest xem bookings (Blocked)").
  let supabase: AppSupabaseClient;
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (token && adminUrl && adminKey) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    supabase = createSupabaseClient<Database>(
      adminUrl,
      adminKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  } else {
    supabase = await createClient();
  }

  let query = supabase
    .from('bookings')
    .select(`
      *,
      customers (
        name_mother,
        phone,
        loyalty_points
      ),
      packages!bookings_package_id_fkey (
        name,
        price,
        total_sessions
      ),
      assigned_ktv:users!bookings_assigned_ktv_id_fkey (
        id,
        full_name,
        phone
      ),
      session_logs (
        *,
        completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey (
          id,
          full_name,
          avatar_url
        )
      ),
      tenants (
        id,
        name,
        contact_phone,
        logo_url,
        brand_theme,
        enabled_modules,
        qr_bank_code,
        qr_account_number,
        qr_account_name
      ),
      revenue (
        *
      )
    `);

  if (token) {
    query = query.eq('share_token', token);
  } else {
    const user = await getCurrentUser();
    if (!user || user.role !== 'customer') {
      return null;
    }
    query = query.eq('customer_id', user.id);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch customer booking: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const booking = data as CustomerPortalBooking;

  // Compute effective full_price for retail packages
  const pkg = booking.packages as ({ name?: string; price?: number; total_sessions?: number } | null);
  const giftSessions = Number((booking.metadata as Record<string, unknown>)?.gift_sessions || 0);
  const paidSessions = (booking.total_sessions || 0) - giftSessions;
  const isRetailPackage = pkg && Number(pkg.total_sessions || 1) === 1;
  const unitPrice = pkg?.price || 0;
  const computedFullPrice = isRetailPackage && paidSessions > 1
    ? unitPrice * paidSessions
    : (booking.full_price || 0);

  booking.full_price = computedFullPrice;

  // Sort sessions by number
  if (booking.session_logs) {
    booking.session_logs.sort((a, b) => (a.session_number || 0) - (b.session_number || 0));
  }

  // Resolve package_name correctly using resolvePackageName helper
  booking.package_name = resolvePackageName(booking);

  // Fetch active promotions for this tenant
  if (booking.tenant_id) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const { data: promotions, error: promoError } = await supabase
      .from('promotions')
      .select('*')
      .eq('tenant_id', booking.tenant_id)
      .eq('is_active', true);
      
    if (promoError) {
      throw new Error(`Failed to fetch active promotions for customer booking: ${promoError.message}`);
    }

    booking.active_promotions = (promotions || []).filter((promo) => {
      const startValid = !promo.start_date || promo.start_date <= todayStr;
      const endValid = !promo.end_date || promo.end_date >= todayStr;
      return startValid && endValid;
    });
  } else {
    booking.active_promotions = [];
  }

  return booking;
}

/**
 * Khách hàng gửi đánh giá cho một buổi chăm sóc
 */
export async function submitCustomerRating(sessionId: string, rating: number, comment: string = '') {
  // Customer is anonymous (no auth session) — bypass RLS via service role.
  // Security: sessionId is a non-enumerable UUID. Caller must have already
  // obtained it via getCustomerBookingByToken (gated by share_token).
  let supabase: AppSupabaseClient;
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (adminUrl && adminKey) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    supabase = createSupabaseClient<Database>(
      adminUrl,
      adminKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  } else {
    supabase = await createClient();
  }

  // 1. Lấy thông tin session để đồng bộ hóa
  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('completed_by_ktv_id, tenant_id, rating, rating_comment, bookings(customer_id)')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    throw new Error(`Failed to fetch session before customer rating: ${sessionError.message}`);
  }
  const ratingSession = session as RatingSession | null;
  if (!ratingSession?.tenant_id) {
    throw new Error('Failed to fetch session before customer rating: missing tenant scope');
  }

  // 2. Cập nhật rating vào session_log (Legacy support & quick read)
  const { error: updateError } = await supabase
    .from('session_logs')
    .update({
      rating: rating,
      rating_comment: comment
    })
    .eq('id', sessionId)
    .eq('tenant_id', ratingSession.tenant_id);

  if (updateError) {
    throw new Error(`Failed to update session rating: ${updateError.message}`);
  }

  const rollbackSessionRating = async (message: string) => {
    const { error: rollbackError } = await supabase
      .from('session_logs')
      .update({
        rating: ratingSession?.rating ?? null,
        rating_comment: ratingSession?.rating_comment ?? null
      })
      .eq('id', sessionId)
      .eq('tenant_id', ratingSession.tenant_id);

    if (rollbackError) {
      throw new Error(`${message}; failed to roll back session rating: ${rollbackError.message}`);
    }

    throw new Error(message);
  };

  // 3. Tạo/Cập nhật bản ghi review chính thức (Analytics source)
  if (ratingSession) {
    // Check if a placeholder review already exists for this session log
    const { data: existingReview, error: existingReviewError } = await supabase
      .from('session_reviews')
      .select('id')
      .eq('session_log_id', sessionId)
      .eq('tenant_id', ratingSession.tenant_id)
      .maybeSingle();

    if (existingReviewError) {
      await rollbackSessionRating(`Failed to fetch existing session review: ${existingReviewError.message}`);
    }

    const reviewPayload: SessionReviewInsert = {
      session_log_id: sessionId,
      ktv_id: ratingSession.completed_by_ktv_id,
      reviewer_id: ratingSession.bookings?.customer_id || null,
      rating: rating,
      note: comment,
      status: 'approved',
      tenant_id: ratingSession.tenant_id
    };

    if (existingReview) {
      const { error: reviewError } = await supabase
        .from('session_reviews')
        .update(reviewPayload)
        .eq('id', existingReview.id)
        .eq('tenant_id', ratingSession.tenant_id);
      if (reviewError) {
        await rollbackSessionRating(`Failed to update session review: ${reviewError.message}`);
      }
    } else {
      const { error: reviewError } = await supabase
        .from('session_reviews')
        .insert([reviewPayload]);
      if (reviewError) {
        await rollbackSessionRating(`Failed to insert session review: ${reviewError.message}`);
      }
    }
  }

  // 4. Kích hoạt tính toán thưởng cho KTV qua RPC
  const { error: rpcError } = await supabase.rpc('apply_rating_bonus', {
    p_session_id: sessionId
  });

  if (rpcError) {
    await rollbackSessionRating(`Failed to apply rating bonus: ${rpcError.message}`);
  }

  await Promise.all([
    safeRevalidatePath('/dashboard'),
    safeRevalidatePath('/ktv/earnings')
  ]);
  
  return { success: true };
}

// Confirmed-revenue triggers own accrual; retain the old action as a denial.
export async function addLoyaltyPoints(_customerId: string, _amount: number) {
  throw new Error('Điểm tích lũy được tính tự động từ phiếu thu, không thể cập nhật thủ công.');
}

/**
 * Lấy danh sách khách hàng
 */
export async function getCustomers(options: GetCustomersOptions = {}) {
  const supabase = await createDevelopmentBypassClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error(CUSTOMER_TENANT_ACCESS_ERROR);
  }

  let query = supabase
    .from('customers')
    .select(`
      id,
      name_mother,
      phone,
      name_baby,
      dob_expected,
      dob_baby,
      address,
      notes,
      zalo_oa_id,
      gender_baby,
      status,
      created_at,
      tenant_id,
      loyalty_points,
      bookings (
        deposit_amount,
        package_name,
        full_price,
        discount_percent,
        created_at,
        is_in_care,
        status,
        total_sessions,
        completed_sessions,
        tenant_id,
        revenue (
          amount,
          status,
          revenue_type,
          tenant_id
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .order('name_mother', { ascending: true });

  const safeLimit = Number(options.limit || 0);
  const safeOffset = Number(options.offset || 0);
  if (Number.isFinite(safeLimit) && safeLimit > 0) {
    const limit = Math.min(Math.floor(safeLimit), 200);
    const offset = Number.isFinite(safeOffset) && safeOffset > 0 ? Math.floor(safeOffset) : 0;
    query = offset > 0 ? query.range(offset, offset + limit - 1) : query.limit(limit);
  }

  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }
  const customers = (data || []) as CustomerListRow[];
  return customers.map((customer) => ({
    ...customer,
    bookings: Array.isArray(customer.bookings)
      ? customer.bookings
        .filter((booking) => booking.tenant_id === tenantId)
        .map((booking) => ({
          ...booking,
          revenue: Array.isArray(booking.revenue)
            ? booking.revenue.filter((revenue) => revenue.tenant_id === tenantId)
            : booking.revenue,
        }))
      : customer.bookings,
  }));
}

/**
 * Lấy chi tiết khách hàng
 */
export async function getCustomerById(id: string) {
  const supabase = await createDevelopmentBypassClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error(CUSTOMER_TENANT_ACCESS_ERROR);
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Failed to fetch customer ${id}: ${error.message}`);
  }
  return data;
}

/**
 * Tạo mới khách hàng
 */
export async function createCustomer(customerData: CustomerCreateInput) {
  const supabase = await createDevelopmentBypassClient();
  const currentUser = await getCurrentUser();
  const { name, loyalty_points: _ignoredLoyaltyPoints, ...customerPayload } = customerData;
  void _ignoredLoyaltyPoints;
  if (!currentUser?.tenant_id) {
    return { data: null, error: CUSTOMER_TENANT_ACCESS_ERROR, warning: null };
  }

  const payload: CustomerInsert = {
    ...customerPayload,
    name_mother: customerData.name_mother || name || '',
    phone: customerData.phone || '',
    tenant_id: currentUser.tenant_id
  };

  // Normalize date fields: convert empty string "" to null
  if (payload.dob_expected === '') {
    payload.dob_expected = null;
  }
  if (payload.dob_baby === '') {
    payload.dob_baby = null;
  }

  const { checkSubscriptionLimit } = await import('@/lib/subscription');
  const customerLimit = await checkSubscriptionLimit(currentUser.tenant_id, 'customer');
  if (customerLimit.isBlocked) {
    return { data: null, error: 'Vượt quá giới hạn khách hàng của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.', warning: null };
  }

  // Tự động geocode lấy tọa độ nếu địa chỉ được nhập và admin không truyền sẵn tọa độ
  if (payload.address && (payload.latitude === undefined || payload.latitude === null)) {
    const coords = await geocodeAddress(payload.address);
    if (coords) {
      payload.latitude = coords.latitude;
      payload.longitude = coords.longitude;
    }
  }

  const { data, error } = await supabase
    .from('customers')
    .insert([payload])
    .select();
  
  if (error) {
    console.error('Error creating customer:', error);
    return { data: null, error: error.message, warning: null };
  }
  
  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: data[0].id,
        new_data: data[0]
      });
    } catch (auditErr) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', data[0].id)
        .eq('tenant_id', currentUser.tenant_id);
      return {
        data: null,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record createCustomer audit log',
        warning: null
      };
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  return { data: data?.[0] || null, error: null, warning: null };
}

/**
 * Cập nhật khách hàng
 */
export async function updateCustomer(id: string, customerData: CustomerUpdate) {
  const supabase = await createClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return { data: null, error: CUSTOMER_TENANT_ACCESS_ERROR, warning: null };
  }

  const { tenant_id: _ignoredTenantId, loyalty_points: _ignoredLoyaltyPoints, ...scopedCustomerData } = customerData;
  void _ignoredTenantId;
  void _ignoredLoyaltyPoints;
  const payload: CustomerUpdate = { ...scopedCustomerData };
  
  // Normalize date fields: convert empty string "" to null
  if (payload.dob_expected === '') {
    payload.dob_expected = null;
  }
  if (payload.dob_baby === '') {
    payload.dob_baby = null;
  }
  
  // Fetch existing customer before update for audit trail
  let oldCustomer = null;
  try {
    const { data: existing, error: existingError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError) {
      return { data: null, error: existingError.message, warning: null };
    }
    oldCustomer = existing;
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch old customer for audit trail',
      warning: null
    };
  }

  // Tự động geocode nếu địa chỉ thay đổi và admin không chủ động truyền sẵn tọa độ mới
  if (payload.address && payload.address !== oldCustomer?.address &&
      (payload.latitude === undefined || payload.latitude === null)) {
    const coords = await geocodeAddress(payload.address);
    if (coords) {
      payload.latitude = coords.latitude;
      payload.longitude = coords.longitude;
    }
  }

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select();
  
  if (error) {
    console.error('Error updating customer:', error);
    return { data: null, error: error.message, warning: null };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'customers',
        record_id: id,
        old_data: oldCustomer,
        new_data: payload
      });
    } catch (auditErr) {
      if (oldCustomer) {
        const { loyalty_points: _previousPoints, ...rollbackProfile } = oldCustomer;
        void _previousPoints;
        await supabase
          .from('customers')
          .update(rollbackProfile)
          .eq('id', id)
          .eq('tenant_id', tenantId);
      }
      return {
        data: null,
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record updateCustomer audit log',
        warning: null
      };
    }
  }
  
  await Promise.all([
    safeRevalidatePath('/dashboard/customers'),
    safeRevalidatePath(`/dashboard/customers/${id}`)
  ]);
  return { data: data?.[0] || null, error: null, warning: null };
}

/**
 * Xóa khách hàng
 */
export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return { success: false, error: CUSTOMER_TENANT_ACCESS_ERROR };
  }

  // Fetch existing customer before delete for audit trail
  let oldCustomer = null;
  try {
    const { data: existing, error: existingError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError) {
      return { success: false, error: existingError.message };
    }
    oldCustomer = existing;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch old customer for delete audit trail'
    };
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  
  if (error) {
    console.error('Error deleting customer:', error);
    let userMessage = error.message;
    if (error.code === '23503') {
      userMessage = 'Không thể xóa khách hàng đã có dịch vụ';
    }
    return { success: false, error: userMessage };
  }

  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'customers',
      record_id: id,
      old_data: oldCustomer
    });
  } catch (auditErr) {
    if (oldCustomer) {
      await supabase
        .from('customers')
        .insert([oldCustomer]);
    }
    return {
      success: false,
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record deleteCustomer audit log'
    };
  }
  
  await safeRevalidatePath('/dashboard/customers');
  return { success: true, error: null };
}

/**
 * Alias cho submitCustomerRating để tương thích với các component cũ
 */
export const submitSessionRating = submitCustomerRating;
export const getCustomerPortalData = getCustomerBookingByToken;

/**
 * Tự động chuyển đổi địa chỉ thành tọa độ GPS sử dụng OpenStreetMap Nominatim API
 */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address) return null;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      {
        headers: {
          'User-Agent': 'BellaSpaERP/1.0 (contact@bellaspa.com.vn)'
        }
      }
    );
    if (!response.ok) {
      console.warn('Geocoding response error:', response.statusText);
      return null;
    }
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { latitude: lat, longitude: lon };
      }
    }
    return null;
  } catch (error) {
    console.error('Error during geocoding address:', error);
    return null;
  }
}
