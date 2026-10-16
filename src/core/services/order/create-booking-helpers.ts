import { resolvePackageName, getLocalDateString } from '@bella/shared';;
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { buildPackageSaleOutboxEvent } from '@/lib/business-rules/accounting-outbox';
import { normalizeDiscountPercent } from '@/lib/business-rules/payment';
import { normalizePackageModuleKey } from '@/lib/business-rules/service-package';
import { normalizeEnabledModulesForSave } from '@/lib/business-rules/tenant-modules';
import { assertOpenAccountingPeriod } from '@/core/services/accounting/period-guards';
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/core/services/accounting/template-rules';
import { resolveAccountingReviewStatus } from './accounting-review';
import { resolveKtvCommission } from './commission-actions';
import { attachBranchToJsonMetadata, type HaircutBranchContext } from './haircut-branch-context';
import { moduleRegistry } from '@/core/adapters/registry';
import type { TenantContext } from '@/core/types/tenant';
import type { CoreBookingOrder, BookingOrderStatus } from '@/core/types/booking-order';
import type { ModuleId } from '@/core/types/module';
import type { CoreServiceCatalogItem } from '@/core/types/service-catalog';
import type { createClient } from '@/lib/supabase-server';
import type { bookingSchema } from '@/lib/validations';
import type { Database } from '@/types/database.types';
import type { z } from 'zod';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
type RevenueInsert = Database['public']['Tables']['revenue']['Insert'];
type PackageScopeRow = Pick<Database['public']['Tables']['packages']['Row'], 'id' | 'tenant_id' | 'module_key' | 'name'>;
type TenantModuleScopeRow = Pick<Database['public']['Tables']['tenants']['Row'], 'enabled_modules'>;
type ValidatedBookingData = z.infer<typeof bookingSchema>;
type ActionError = { error: string };
type ActionSuccess = { success: true };
type BookingRowWithBranch = BookingRow & { branch_id?: string | null };
type BookingInsertWithBranch = BookingInsert & { branch_id?: string | null };
type BookingUpdateWithBranch = BookingUpdate & { branch_id?: string | null };
type SessionLogInsertWithBranch = SessionLogInsert & { branch_id?: string | null };
type RevenueInsertWithBranch = RevenueInsert & { branch_id?: string | null };

type CreateBookingFormData = {
  newCustomer?: Omit<CustomerInsert, 'tenant_id'> & Partial<Pick<CustomerInsert, 'tenant_id'>>;
};

const BOOKING_PACKAGE_TENANT_ERROR = 'Gói dịch vụ không thuộc đơn vị kinh doanh hiện tại.';
const BOOKING_PACKAGE_MODULE_ERROR = 'Gói dịch vụ không thuộc ngành kinh doanh được Admin HQ cấp cho spa này.';
const BOOKING_PACKAGE_LOOKUP_ERROR = 'Không thể xác thực gói dịch vụ của booking.';

export async function validateBookingPackageScope(
  supabase: SupabaseServerClient,
  tenantId: string,
  packageId: string | null | undefined,
): Promise<ActionSuccess | ActionError> {
  const normalizedPackageId = typeof packageId === 'string' ? packageId.trim() : '';
  if (!normalizedPackageId) {
    return { success: true };
  }

  const { data: packageRow, error: packageError } = await supabase
    .from('packages')
    .select('id, tenant_id, module_key, name')
    .eq('id', normalizedPackageId)
    .single<PackageScopeRow>();

  if (packageError || !packageRow) {
    return {
      error: `${BOOKING_PACKAGE_LOOKUP_ERROR} ${packageError?.message || 'Không tìm thấy gói dịch vụ.'}`,
    };
  }

  if (packageRow.tenant_id !== tenantId) {
    return { error: BOOKING_PACKAGE_TENANT_ERROR };
  }

  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('enabled_modules')
    .eq('id', tenantId)
    .single<TenantModuleScopeRow>();

  if (tenantError || !tenantRow) {
    return {
      error: `${BOOKING_PACKAGE_LOOKUP_ERROR} ${tenantError?.message || 'Không tìm thấy cấu hình tenant.'}`,
    };
  }

  const enabledModules = normalizeEnabledModulesForSave(tenantRow.enabled_modules);
  const packageModuleKey = normalizePackageModuleKey(packageRow.module_key);

  return enabledModules[packageModuleKey]
    ? { success: true }
    : { error: BOOKING_PACKAGE_MODULE_ERROR };
}

export async function enforceCreateBookingRateLimit(): Promise<ActionSuccess | ActionError> {
  if (process.env.NODE_ENV === 'test') {
    return { success: true };
  }
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    let clientIp = '127.0.0.1';

    if (forwardedFor) {
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp.trim();
    }

    const { rateLimit } = await import('@/lib/rate-limit');
    const allowed = rateLimit(`booking_ip:${clientIp}`, 5, 5 / 600);
    return allowed
      ? { success: true }
      : { error: 'Bạn đã thực hiện quá nhiều yêu cầu đặt lịch. Vui lòng thử lại sau ít phút.' };
  } catch (err: unknown) {
    console.error('[createBooking] Rate-limiting evaluation failed, rejecting request for safety:', err);
    return { error: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại.' };
  }
}

export async function createCustomerForBookingIfNeeded(
  supabase: SupabaseServerClient,
  validatedData: ValidatedBookingData,
  formData: CreateBookingFormData,
  tenantId: string
): Promise<{ customerId: string; created: boolean } | ActionError> {
  if (validatedData.customer_id !== 'new' || !formData.newCustomer) {
    return { customerId: String(validatedData.customer_id), created: false };
  }

  const customerPayload: CustomerInsert = {
    ...formData.newCustomer,
    tenant_id: tenantId,
  };

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert([customerPayload])
    .select()
    .single();

  if (customerError) {
    console.error('Error creating customer inside createBooking:', customerError);
    return { error: 'Lỗi khi tạo khách hàng: ' + customerError.message };
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'customers',
      record_id: customer.id,
      new_data: customer,
    });
  } catch (auditErr) {
    await supabase.from('customers').delete().eq('id', customer.id);
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : 'Failed to record customer audit log in createBooking',
    };
  }

  return { customerId: customer.id, created: true };
}

export async function findPendingBookingForCustomer(
  supabase: SupabaseServerClient,
  customerId: string,
  tenantId: string
): Promise<BookingRow | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .in('status', ['deposit_pending', 'lead'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function resolveBookingTenant(supabase: SupabaseServerClient): Promise<{
  tenantId: string;
  currentUserId: string | null;
} | ActionError> {
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  let tenantId: string | null = null;
  let userEmail: string | null = null;
  let currentUserId: string | null = currentUser?.id || null;
  let isLoggedIn = false;

  if (currentUser) {
    isLoggedIn = true;
    if (currentUser.tenant_id) {
      tenantId = currentUser.tenant_id || null;
      userEmail = currentUser.email || null;
      console.log('[createBooking] Level1 resolved tenant:', tenantId);
    }
  }

  if (!tenantId) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      isLoggedIn = true;
      currentUserId = currentUserId || authUser.id;
      userEmail = authUser.email ?? null;
      console.log('[createBooking] Level2 authUser authenticated | id:', authUser.id);
      const { data: userProfile } = await supabase
        .from('users')
        .select('tenant_id, email')
        .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
        .limit(1)
        .single();
      if (userProfile?.tenant_id) {
        tenantId = userProfile.tenant_id;
        console.log('[createBooking] Level2 resolved tenant via DB:', tenantId);
      }
    }
  }

  if (!tenantId) {
    if (isLoggedIn) {
      return { error: 'Unauthorized: Tenant ID is required for logged in users.' };
    }
    tenantId = process.env.DEFAULT_TENANT_ID || null;
    if (!tenantId) {
      return { error: 'System Error: DEFAULT_TENANT_ID is not configured for guest bookings.' };
    }
    console.warn('[createBooking] Level3 DEFAULT_TENANT_ID fallback used for guest booking.');
  }

  console.log('[createBooking] Final tenantId:', tenantId, '| user:', userEmail);
  return { tenantId, currentUserId };
}

export async function buildBookingPayload(params: {
  validatedData: ValidatedBookingData;
  customerId: string;
  tenantId: string;
  existingBooking: BookingRow | null;
  tenantContext: TenantContext;
  branchContext: HaircutBranchContext;
}): Promise<BookingInsertWithBranch> {
  const { validatedData, customerId, tenantId, existingBooking, tenantContext, branchContext } = params;
  const confirmedDepositAmount = (existingBooking?.deposit_amount || 0) + (validatedData.deposit_amount || 0);
  const hasConfirmedDeposit = confirmedDepositAmount > 0;
  const lockedCommission = validatedData.ktv_commission || await resolveKtvCommission(validatedData);

  // Task 19.2: Calculate price using adapter pricing logic
  // This ensures pricing is calculated server-side with module-specific discounts
  // and cannot be manipulated by client
  let finalPrice = validatedData.full_price;
  
  // If package_id is provided, recalculate price using adapter
  if (validatedData.package_id) {
    try {
      const { calculateOrderPrice } = await import('./pricing-actions');
      const { createClient } = await import('@/lib/supabase-server');
      const supabase = await createClient();
      
      // Fetch package details from database
      const { data: packageData } = await supabase
        .from('packages')
        .select('id, tenant_id, module_key, name, description, price, total_sessions, session_multiplier')
        .eq('id', validatedData.package_id)
        .single();
      
      if (packageData) {
        // Transform to CoreServiceCatalogItem
        const serviceItem: CoreServiceCatalogItem = {
          id: packageData.id,
          tenantId: packageData.tenant_id || tenantId,
          moduleId: (normalizePackageModuleKey(packageData.module_key) || 'spa') as ModuleId,
          name: packageData.name,
          description: packageData.description || '',
          basePrice: packageData.price || 0,
          currency: 'VND',
          status: 'active', // Assume active since we only query non-deleted packages
          metadata: {
            total_sessions: packageData.total_sessions,
            session_multiplier: packageData.session_multiplier,
            // IMPORTANT: Use only PAID sessions for price calculation.
            // total_sessions includes gift sessions (free), so subtract them.
            // e.g. 10 paid + 1 gift = 11 total → price = 10 × unitPrice (NOT 11)
            booking_total_sessions: validatedData.total_sessions - Number(validatedData.metadata?.gift_sessions || 0),
          },
        };
        
        // Calculate price using adapter
        finalPrice = await calculateOrderPrice(serviceItem, tenantContext);
        console.log(`[buildBookingPayload] Adapter pricing: ${validatedData.full_price} → ${finalPrice}`);
      }
    } catch (error) {
      console.error('[buildBookingPayload] Failed to calculate adapter pricing, using form price:', error);
      // Fall back to form price if adapter pricing fails
    }
  }
  
  // Use admin's explicitly-entered discount value.
  // The server-side auto-discount engine was removed because it silently overrode
  // the admin's intent (e.g., applying 5% Active Customer discount when admin set 0%).
  // Admin always has full control over the discount for each booking.
  const serverCalculatedDiscount = validatedData.discount_percent || 0;
  console.log('[buildBookingPayload] Discount: admin=%s% (trusted, no auto-override)', serverCalculatedDiscount);
  
  // Phase 0.5: Use Decision Engine for booking approval logic
  // TODO: Restore booking-decision-service after provider integration is complete
  // File was moved to archive during refactor, will re-integrate in Phase 2
  let bookingStatus: string;
  const requiredDepositAmount = 0;
  
  // Fallback to legacy logic (Decision Engine temporarily disabled)
  bookingStatus = hasConfirmedDeposit ? 'booked' : 'deposit_pending';
  
  // try {
  //   const { evaluateBookingApproval, getSuggestedBookingStatus } = await import('@/services/booking-decision-service');
  //   const { createClient } = await import('@/lib/supabase-server');
  //   const supabase = await createClient();
  //   
  //   // Fetch customer info for decision context
  //   const { data: customerData } = await supabase
  //     .from('customers')
  //     .select('status, id')
  //     .eq('id', customerId)
  //     .single();
  //   
  //   // Count completed bookings for customer tier
  //   const { count: completedCount } = await supabase
  //     .from('bookings')
  //     .select('*', { count: 'exact', head: true })
  //     .eq('customer_id', customerId)
  //     .eq('status', 'completed');
  //   
  //   // Evaluate booking approval using Decision Engine
  //   const decision = await evaluateBookingApproval({
  //     totalAmount: finalPrice,
  //     customer: {
  //       id: customerId,
  //       status: customerData?.status || 'new',
  //       completedBookingsCount: completedCount || 0,
  //     },
  //     tenantId,
  //     metadata: {
  //       packageId: validatedData.package_id,
  //       discountPercent: normalizeDiscountPercent(validatedData.discount_percent),
  //     },
  //   });
  //   
  //   // Get suggested status from decision
  //   bookingStatus = getSuggestedBookingStatus(decision);
  //   requiredDepositAmount = decision.depositAmount;
  //   
  //   console.log(`[buildBookingPayload] Decision Engine: approved=${decision.approved}, requiresDeposit=${decision.requiresDeposit}, depositAmount=${decision.depositAmount}, status=${bookingStatus}`);
  //   
  // } catch (error) {
  //   console.error('[buildBookingPayload] Decision Engine failed, falling back to legacy logic:', error);
  //   // Fallback to legacy logic if Decision Engine fails
  //   bookingStatus = hasConfirmedDeposit ? 'booked' : 'deposit_pending';
  // }
  
  const payload: BookingInsertWithBranch = {
    customer_id: customerId,
    booking_number: existingBooking?.booking_number || `BK-${new Date().getTime()}`,
    package_id: validatedData.package_id || null,
    package_name: validatedData.package_name || null,
    status: bookingStatus, // Phase 0.5: Decision Engine determines status
    full_price: finalPrice,
    deposit_amount: confirmedDepositAmount,
    total_sessions: validatedData.total_sessions,
    ktv_commission: lockedCommission,
    discount_percent: serverCalculatedDiscount, // Phase 0.5: Server-enforced discount
    start_date: validatedData.start_date || null,
    assigned_ktv_id: validatedData.assigned_ktv_id || null,
    preferred_time: validatedData.preferred_time || null,
    tenant_id: tenantId,
    metadata: attachBranchToJsonMetadata(
      (validatedData.metadata as Database['public']['Tables']['bookings']['Insert']['metadata']) || null,
      branchContext.branchId,
    ),
  };
  if (branchContext.requiresBranch) {
    payload.branch_id = branchContext.branchId;
  }

  return payload;
}

export async function upsertBookingRecord(params: {
  supabase: SupabaseServerClient;
  existingBooking: BookingRow | null;
  bookingPayload: BookingInsertWithBranch;
  expectedDraftScope?: { tenantId: string; customerId: string; branchId: string };
}): Promise<{ booking: BookingRowWithBranch } | ActionError> {
  const { supabase, existingBooking, bookingPayload, expectedDraftScope } = params;

  // Nail does not transfer an existing draft or its children between branches.
  // Callers without this explicit policy (including Haircut) retain their path.
  if (expectedDraftScope) {
    const matchesScope = (row: { tenant_id?: string | null; customer_id?: string | null; branch_id?: string | null }) =>
      row.tenant_id === expectedDraftScope.tenantId &&
      String(row.customer_id) === expectedDraftScope.customerId &&
      row.branch_id === expectedDraftScope.branchId;
    if (!matchesScope(bookingPayload) || (existingBooking && !matchesScope(existingBooking))) {
      return { error: 'Booking nháp không khớp tenant, khách hàng hoặc chi nhánh đã chọn. Không thể chuyển chi nhánh.' };
    }
    if (existingBooking) {
      for (const table of ['session_logs', 'revenue'] as const) {
        const { data, error } = await supabase
          .from(table)
          .select('tenant_id, branch_id')
          .eq('booking_id', existingBooking.id)
          .returns<Array<{ tenant_id: string | null; branch_id: string | null }>>();
        if (error || !data) return { error: 'Không thể xác minh dữ liệu liên quan của booking nháp. Chưa thực hiện cập nhật.' };
        if (data.some(row => row.tenant_id !== expectedDraftScope.tenantId || row.branch_id !== expectedDraftScope.branchId)) {
          return { error: 'Session hoặc giao dịch của booking nháp không khớp chi nhánh. Chưa thực hiện cập nhật.' };
        }
      }
    }
  }

  if (existingBooking) {
    const updatePayload: BookingUpdateWithBranch = bookingPayload;
    let updateQuery = supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', existingBooking.id);
    if (expectedDraftScope) {
      updateQuery = updateQuery
        .eq('tenant_id', expectedDraftScope.tenantId)
        .eq('customer_id', expectedDraftScope.customerId)
        .eq('branch_id', expectedDraftScope.branchId);
    }
    const { data: updated, error } = await updateQuery
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return { error: error.message };
    }

    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'bookings',
        record_id: existingBooking.id,
        old_data: existingBooking,
        new_data: bookingPayload,
      });
    } catch (auditErr) {
      await supabase
        .from('bookings')
        .update(existingBooking)
        .eq('id', existingBooking.id);
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : 'Failed to record createBooking update audit log',
      };
    }

    return { booking: updated };
  }

  const { data: inserted, error } = await supabase
    .from('bookings')
    .insert([bookingPayload])
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    return { error: error.message };
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: inserted.id,
      new_data: inserted,
    });
  } catch (auditErr) {
    await supabase.from('bookings').delete().eq('id', inserted.id);
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : 'Failed to record createBooking insert audit log',
    };
  }

  return { booking: inserted };
}

export async function recordBookingDepositRevenue(params: {
  supabase: SupabaseServerClient;
  booking: BookingRowWithBranch;
  tenantId: string;
  depositAmount: number;
}): Promise<ActionSuccess | ActionError> {
  const { supabase, booking, tenantId, depositAmount } = params;
  if (depositAmount <= 0) {
    return { success: true };
  }

  let insertedRevenue: { id: string } | null = null;
  let revenueFailed = false;

  const revenueType = 'deposit';
  const receivedDate = getLocalDateString();
  const businessEventType = inferBusinessEventType({
    sourceTable: 'revenue',
    revenueType,
  });
  const accountingPayload = buildRevenueAccountingMetadata({
    revenueType,
    amount: depositAmount,
    paymentMethod: 'bank_transfer',
    bookingId: booking.id,
    reason: `Cọc gói ${resolvePackageName(booking)}`,
  });
  if (booking.branch_id) {
    accountingPayload.branch_id = booking.branch_id;
  }

  try {
    await assertOpenAccountingPeriod(supabase, {
      tenantId,
      date: receivedDate,
      context: 'Create booking deposit',
    });
  } catch (periodErr) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    return {
      error: periodErr instanceof Error
        ? periodErr.message
        : 'Accounting period is closed or unavailable',
    };
  }

  const revenuePayload: RevenueInsertWithBranch = {
    booking_id: booking.id,
    amount: depositAmount,
    revenue_type: revenueType,
    payment_method: 'bank_transfer',
    received_date: receivedDate,
    status: 'confirmed',
    notes: `Cọc gói ${resolvePackageName(booking)}`,
    tenant_id: tenantId,
    business_event_type: businessEventType,
    accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
    accounting_metadata: accountingPayload,
  };
  if (booking.branch_id) {
    revenuePayload.branch_id = booking.branch_id;
  }

  const { data: revenueData, error: revenueError } = await supabase
    .from('revenue')
    .insert([revenuePayload])
    .select('id')
    .single();

  if (revenueData) insertedRevenue = revenueData;

  if (revenueError) {
    console.warn('Error recording initial deposit revenue with standard client, trying with admin client fallback:', revenueError);
    const adminUrl = getSupabaseAdminUrl();
    const serviceRoleKey = getSupabaseAdminKey();
    if (adminUrl && serviceRoleKey) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseClient<Database>(
        adminUrl,
        serviceRoleKey
      );
      const { data: adminRevenueData, error: adminRevenueError } = await supabaseAdmin
        .from('revenue')
        .insert([revenuePayload])
        .select('id')
        .single();

      if (adminRevenueData) insertedRevenue = adminRevenueData;

      if (adminRevenueError) {
        console.error('Error recording initial deposit revenue with admin client as well:', adminRevenueError);
        revenueFailed = true;
      } else {
        console.log('Successfully recorded initial deposit revenue with admin client fallback');
      }
    } else {
      revenueFailed = true;
    }
  }

  if (revenueFailed) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    return { error: 'Không thể ghi nhận doanh thu đặt cọc. Đã hủy tạo booking.' };
  }

  if (insertedRevenue?.id && tenantId) {
    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    const outboxEnqueued = await enqueueWithAutoClient(
      supabase,
      buildPackageSaleOutboxEvent({
        tenantId,
        revenueId: insertedRevenue.id,
        totalAmount: depositAmount,
        description: `Cọc gói ${resolvePackageName(booking)}`,
        branchId: booking.branch_id || null,
      }),
      '[createBooking]'
    );
    if (!outboxEnqueued) {
      await supabase.from('revenue').delete().eq('id', insertedRevenue.id);
      await supabase.from('bookings').delete().eq('id', booking.id);
      return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu đặt cọc. Đã hủy tạo booking.' };
    }
  }

  return { success: true };
}

export async function createInitialSessionLogs(params: {
  supabase: SupabaseServerClient;
  booking: BookingRowWithBranch;
  validatedData: ValidatedBookingData;
  tenantId: string;
}): Promise<ActionSuccess | ActionError> {
  const { supabase, booking, validatedData, tenantId } = params;
  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (existingLogsCount && existingLogsCount > 0) {
    return { success: true };
  }

  const totalSessions = validatedData.total_sessions || 15;
  let startDateStr = validatedData.start_date;

  if (!startDateStr) {
    startDateStr = getLocalDateString();
  }

  // Fetch package default duration if package_id exists
  let defaultDuration = 60;
  if (booking.package_id) {
    const { data: pkgData } = await supabase
      .from('packages')
      .select('default_duration_minutes')
      .eq('id', booking.package_id)
      .single();
    if (pkgData?.default_duration_minutes) {
      defaultDuration = pkgData.default_duration_minutes;
    }
  }

  const sessionLogs: SessionLogInsertWithBranch[] = Array.from({ length: totalSessions }, (_, index) => {
    const [year, month, day] = startDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + index);

    const assignedDate = getLocalDateString(date);

    const sessionPayload: SessionLogInsertWithBranch = {
      booking_id: booking.id,
      session_number: index + 1,
      status: 'scheduled',
      assigned_date: assignedDate,
      assigned_time: validatedData.preferred_time || null,
      tenant_id: tenantId,
      standard_duration: defaultDuration,
    };
    if (booking.branch_id) {
      sessionPayload.branch_id = booking.branch_id;
    }
    return sessionPayload;
  });

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs);

  if (sessionsError) {
    console.error('Error creating session logs:', sessionsError);
    return { error: 'Booking created but session logs failed: ' + sessionsError.message };
  }

  return { success: true };
}

/**
 * Construct TenantContext for booking operations.
 * 
 * Task 19.1: Build TenantContext to pass to adapter validation.
 * 
 * @param supabase - Supabase client
 * @param tenantId - Tenant ID
 * @returns TenantContext or error
 */
export async function constructTenantContextForBooking(
  supabase: SupabaseServerClient,
  tenantId: string
): Promise<{ context: TenantContext } | ActionError> {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    return {
      error: `Không thể tải cấu hình chi nhánh: ${tenantError?.message || 'Không tìm thấy'}`,
    };
  }

  // Extract enabled modules
  let enabledModules: string[] = ['spa'];
  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
    } else if (typeof tenant.enabled_modules === 'object') {
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([_key, value]) => value === true)
        .map(([key]) => key === 'babycare' ? 'spa' : key);
    } else if (typeof tenant.enabled_modules === 'string') {
      enabledModules = [tenant.enabled_modules === 'babycare' ? 'spa' : tenant.enabled_modules];
    }
  }
  if (enabledModules.length === 0) {
    enabledModules = ['spa'];
  }

  // Extract subscription plan
  const subscriptionPlan = (tenant.subscription_tier as TenantContext['subscriptionPlan']) || 'basic';

  // Extract feature flags
  const featureFlags: Record<string, boolean> = {};
  if (tenant.role_permissions && typeof tenant.role_permissions === 'object') {
    const rolePermissions = tenant.role_permissions as Record<string, unknown>;
    if (rolePermissions.feature_flags && typeof rolePermissions.feature_flags === 'object') {
      Object.assign(featureFlags, rolePermissions.feature_flags);
    }
  }

  // Extract settings
  const settings: Record<string, unknown> = {
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    companyName: tenant.name,
  };

  // Type guard for brand theme JSON
  function isBrandThemeObject(obj: unknown): obj is { logoUrl?: string; primaryColor?: string } {
    return typeof obj === 'object' && obj !== null;
  }

  if (tenant.brand_theme && isBrandThemeObject(tenant.brand_theme)) {
    Object.assign(settings, {
      logoUrl: tenant.brand_theme.logoUrl || tenant.logo_url,
      primaryColor: tenant.brand_theme.primaryColor,
    });
  } else if (tenant.logo_url) {
    settings.logoUrl = tenant.logo_url;
  }

  if (tenant.salary_config && typeof tenant.salary_config === 'object') {
    settings.salaryConfig = tenant.salary_config;
  }

  const context: TenantContext = {
    tenantId: tenant.id,
    tenantName: tenant.name || 'Unnamed Tenant',
    enabledModules: enabledModules as readonly ModuleId[],
    subscriptionPlan,
    featureFlags,
    settings,
  };

  return { context };
}

/**
 * Invoke module adapter validation for booking.
 * 
 * Task 19.1: Call adapter.validateBookingRules() if adapter exists.
 * Gracefully handle missing adapters.
 * 
 * @param bookingPayload - Booking insert payload
 * @param context - Tenant context
 * @returns Success or error
 */
export async function invokeAdapterValidation(
  bookingPayload: BookingInsert,
  context: TenantContext
): Promise<ActionSuccess | ActionError> {
  // Determine module ID from enabled modules (default to 'spa')
  const moduleId = context.enabledModules.length > 0 
    ? context.enabledModules[0] 
    : 'spa';

  // Lookup adapter from registry
  const adapter = moduleRegistry.get(moduleId as ModuleId);

  // If no adapter registered, use default validation (allow)
  if (!adapter) {
    console.log(`[invokeAdapterValidation] No adapter found for module '${moduleId}', skipping validation`);
    return { success: true };
  }

  // If adapter doesn't implement validateBookingRules, skip validation
  if (!adapter.validateBookingRules) {
    console.log(`[invokeAdapterValidation] Adapter '${moduleId}' does not implement validateBookingRules, skipping`);
    return { success: true };
  }

  // Transform BookingInsert to CoreBookingOrder for adapter
  // Map database status to CoreBookingOrder status
  const mapStatus = (dbStatus: string | null | undefined): BookingOrderStatus => {
    if (!dbStatus) return 'draft';
    // Map spa-specific statuses to core statuses
    if (dbStatus === 'deposit_pending' || dbStatus === 'pending') return 'draft';
    if (dbStatus === 'confirmed' || dbStatus === 'active') return 'confirmed';
    if (dbStatus === 'in_progress') return 'in_progress';
    if (dbStatus === 'completed') return 'completed';
    if (dbStatus === 'cancelled') return 'cancelled';
    return 'draft'; // Default fallback
  };

  const coreOrder: CoreBookingOrder = {
    id: (bookingPayload as { id?: string }).id || '', // Support editing existing bookings
    tenantId: context.tenantId,
    moduleId: (context.enabledModules[0] || 'spa') as ModuleId,
    customerId: bookingPayload.customer_id || '',
    serviceItemId: bookingPayload.package_id || '',
    status: mapStatus(bookingPayload.status),
    totalAmount: bookingPayload.full_price || 0,
    paidAmount: bookingPayload.deposit_amount || 0,
    scheduledStartTime: bookingPayload.start_date || '',
    scheduledEndTime: bookingPayload.end_date || '',
    metadata: {
      assigned_ktv_id: bookingPayload.assigned_ktv_id,
      sessions_total: bookingPayload.total_sessions,
      sessions_completed: 0,
      package_category: '', // Will be filled from package metadata
      original_db_status: bookingPayload.status, // Preserve original status for adapter
      preferred_time: bookingPayload.preferred_time, // Add preferred_time for capacity validation
    },
  };

  try {
    // Call adapter validation
    console.log(`[invokeAdapterValidation] Calling adapter.validateBookingRules for module '${moduleId}'`);
    const isValid = await adapter.validateBookingRules(coreOrder, context);

    if (!isValid) {
      return {
        error: 'Đơn hàng không đáp ứng điều kiện nghiệp vụ của module. Vui lòng kiểm tra lại thông tin.',
      };
    }

    console.log(`[invokeAdapterValidation] Adapter validation passed for module '${moduleId}'`);
    return { success: true };
  } catch (error) {
    console.error(`[invokeAdapterValidation] Adapter validation failed:`, error);
    return {
      error: error instanceof Error 
        ? `Lỗi kiểm tra điều kiện nghiệp vụ: ${error.message}` 
        : 'Lỗi kiểm tra điều kiện nghiệp vụ',
    };
  }
}
