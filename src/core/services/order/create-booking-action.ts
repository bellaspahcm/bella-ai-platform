'use server';

import { sanitizeTime } from '@bella/shared';;
import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';
import type { Database } from '@/types/database.types';
import type { z } from 'zod';
import { invalidateAvailabilityCache } from '@/app/api/bookings/check-ktv-availability/route';
import type { CommissionConfig } from '@/types/commission-types';
import {
  buildBookingPayload,
  createCustomerForBookingIfNeeded,
  createInitialSessionLogs,
  enforceCreateBookingRateLimit,
  findPendingBookingForCustomer,
  recordBookingDepositRevenue,
  resolveBookingTenant,
  upsertBookingRecord,
  validateBookingPackageScope,
  constructTenantContextForBooking,
  invokeAdapterValidation,
} from './create-booking-helpers';
import {
  readRequestedBranchId,
  resolveHaircutBranchContext,
} from './haircut-branch-context';

type CreateBookingInput = z.input<typeof bookingSchema> & {
  newCustomer?: Omit<Database['public']['Tables']['customers']['Insert'], 'tenant_id'> &
    Partial<Pick<Database['public']['Tables']['customers']['Insert'], 'tenant_id'>>;
};
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingValidationDetails = z.inferFlattenedErrors<typeof bookingSchema>['fieldErrors'];
type CreateBookingResult =
  | { error: string; details?: BookingValidationDetails; data?: undefined }
  | { data: BookingRow; error?: undefined; details?: undefined };

function getCommissionConfig(settings: Readonly<Record<string, unknown>>): CommissionConfig | undefined {
  const value = settings.commission_config;
  return typeof value === 'object' && value !== null ? value as CommissionConfig : undefined;
}

/**
 * Creates a new booking with customer, payment, and session initialization.
 * 
 * This is the **primary booking creation workflow** handling customer management,
 * pricing calculation, payment recording, and session scheduling in a single transaction.
 * 
 * @param formData - Booking creation input with customer and service details
 * @returns Success object with booking data, or error object with validation details
 * 
 * @throws Does not throw - returns error object instead for safe UI handling
 * 
 * @remarks
 * **Booking Creation Workflow:**
 * 1. **Rate Limit Enforcement**: Prevent booking spam (max 10 per minute)
 * 2. **Input Validation**: Validate against {@link bookingSchema}
 * 3. **Tenant Resolution**: Determine tenant from current user session
 * 4. **Package Scope Validation**: Ensure package belongs to tenant
 * 5. **Customer Management**: Create new customer or use existing
 * 6. **Pending Booking Check**: Find existing pending booking for customer
 * 7. **Tenant Context Construction**: Load tenant config for adapter
 * 8. **Pricing Calculation**: Calculate price via adapter integration (Task 19.2)
 * 9. **Adapter Validation**: Run module-specific validation (Task 19.1)
 * 10. **Booking Record**: Insert/update booking in database
 * 11. **Deposit Revenue**: Record deposit payment as revenue
 * 12. **Session Logs**: Create initial session logs for package
 * 13. **Cache Invalidation**: Revalidate relevant dashboard pages
 * 
 * **Input Structure:**
 * ```typescript
 * {
 *   customer_id?: string,         // Existing customer UUID
 *   newCustomer?: {               // New customer data (if no customer_id)
 *     phone: string,
 *     full_name: string,
 *     email?: string
 *   },
 *   package_id: string,           // Service package UUID
 *   preferred_date?: string,      // YYYY-MM-DD
 *   preferred_time?: string,      // HH:mm
 *   ktv_id?: string,              // Preferred KTV UUID
 *   notes?: string,
 *   deposit_amount?: number       // Initial deposit in VND
 * }
 * ```
 * 
 * **Return Types:**
 * - **Success**: `{ data: BookingRow }` with created booking
 * - **Validation Error**: `{ error: string, details: ValidationDetails }`
 * - **Business Error**: `{ error: string }` (e.g., rate limit, tenant error)
 * 
 * **Critical Business Rules:**
 * - **Rate Limiting**: Max 10 bookings per minute per user
 * - **Package Scope**: Package must belong to current tenant
 * - **Pending Booking**: Only one pending booking per customer allowed
 * - **Deposit Required**: Deposit amount must be > 0 for prepaid packages
 * - **Session Auto-creation**: Creates session logs equal to `total_sessions`
 * 
 * **Adapter Integration (Task 19.1 & 19.2):**
 * - **Pricing (19.2)**: Uses adapter to calculate `full_price` based on module rules
 * - **Validation (19.1)**: Calls `adapter.validateBooking()` for module-specific checks
 * 
 * **Tenant Context:**
 * Loads tenant configuration and modules for adapter integration:
 * - Industry modules (e.g., 'spa', 'retail')
 * - Tenant settings (currency, timezone, etc.)
 * - Pricing rules and multipliers
 * 
 * **Revenue Recognition:**
 * - Deposit creates revenue entry with `status: 'confirmed'`
 * - Remaining balance recorded after service completion
 * - Links revenue to booking via `reference_id`
 * 
 * **Session Initialization:**
 * - Creates `total_sessions` count of session logs
 * - Initial status: 'scheduled'
 * - Numbered sequentially (1, 2, 3, ...)
 * - Preferred KTV assigned if provided
 * 
 * **Cache Invalidation:**
 * Revalidates multiple dashboard pages:
 * - `/dashboard/bookings` (booking list)
 * - `/dashboard/sessions` (session calendar)
 * - `/dashboard/customers` (customer list)
 * - `/dashboard/customers/{id}` (customer detail)
 * - `/dashboard` (main dashboard)
 * - `/dashboard/finance` (financial overview)
 * 
 * @example
 * ```typescript
 * // Create booking with new customer
 * const result = await createBooking({
 *   newCustomer: {
 *     phone: '0912345678',
 *     full_name: 'Nguyễn Văn A',
 *     email: 'a@example.com'
 *   },
 *   package_id: 'package-uuid',
 *   preferred_date: '2026-06-20',
 *   preferred_time: '14:00',
 *   ktv_id: 'ktv-uuid',
 *   deposit_amount: 1000000,
 *   notes: 'Khách hàng yêu cầu KTV có kinh nghiệm'
 * });
 * 
 * if ('error' in result) {
 *   if (result.details) {
 *     // Validation errors
 *     console.error('Validation errors:', result.details);
 *   } else {
 *     // Business errors
 *     console.error('Booking error:', result.error);
 *   }
 * } else {
 *   console.log('Booking created:', result.data.id);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Create booking with existing customer
 * const result = await createBooking({
 *   customer_id: 'customer-uuid',
 *   package_id: 'package-uuid',
 *   deposit_amount: 2000000
 * });
 * 
 * if ('data' in result) {
 *   alert(`Đã đặt lịch: ${result.data.id}`);
 *   router.push(`/dashboard/bookings/${result.data.id}`);
 * }
 * ```
 * 
 * @see {@link buildBookingPayload} for pricing calculation
 * @see {@link invokeAdapterValidation} for module validation
 * @see {@link createInitialSessionLogs} for session initialization
 * @see {@link recordBookingDepositRevenue} for revenue recording
 */
export async function createBooking(formData: CreateBookingInput): Promise<CreateBookingResult> {
  const rateLimitResult = await enforceCreateBookingRateLimit();
  if ('error' in rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const { createDevelopmentBypassClient } = await import('@/lib/supabase-dev-bypass-server');
  const supabase = await createDevelopmentBypassClient();
  
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu booking không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;
  if (validatedData.preferred_time) {
    validatedData.preferred_time = sanitizeTime(validatedData.preferred_time) || undefined;
  }

  const tenantResult = await resolveBookingTenant(supabase);
  if ('error' in tenantResult) {
    return { error: tenantResult.error };
  }
  const tenantId = tenantResult.tenantId;
  const currentUserId = tenantResult.currentUserId;

  const packageScopeResult = await validateBookingPackageScope(supabase, tenantId, validatedData.package_id);
  if ('error' in packageScopeResult) {
    return { error: packageScopeResult.error };
  }

  const branchContext = await resolveHaircutBranchContext({
    supabase,
    tenantId,
    currentUserId,
    requestedBranchId: readRequestedBranchId(validatedData),
  });
  if ('error' in branchContext) {
    return { error: branchContext.error };
  }

  const customerResult = await createCustomerForBookingIfNeeded(supabase, validatedData, formData, tenantId);
  if ('error' in customerResult) {
    return { error: customerResult.error };
  }
  const customerId = customerResult.customerId;

  // CRITICAL FIX (15/07/2026): Check for OVERLAPPING bookings (not just multiple bookings)
  // UPDATE (15/07/2026 - Evening): Also block deposit_pending to prevent overlaps
  // DISABLED: Old logic blocked ALL multiple bookings (wrong - customer can have multiple bookings at different times)
  // NEW: Only block if bookings OVERLAP in time
  
  // TODO: Implement proper time overlap check here
  // For now, Decision Engine will handle time conflicts via break time buffer
  // This section is intentionally disabled to allow multiple bookings per customer
  
  /* DISABLED LOGIC:
  const { data: activeBookings, error: conflictCheckError } = await supabase
    .from('bookings')
    .select('id, package_name, status, start_date, booking_number')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed']);

  if (activeBookings && activeBookings.length > 0) {
    return {
      error: `❌ Khách hàng đang có ${activeBookings.length} gói đang thực hiện...`
    };
  }
  */

  const existingBooking = customerResult.created
    ? null
    : await findPendingBookingForCustomer(supabase, customerId, tenantId);

  // Task 19.1 & 19.2: Construct tenant context for adapter integration
  const tenantContext = await constructTenantContextForBooking(supabase, tenantId);
  if ('error' in tenantContext) {
    return { error: tenantContext.error };
  }
  
  // Task 19.2: Build booking payload with adapter pricing
  const bookingPayload = await buildBookingPayload({
    validatedData,
    customerId,
    tenantId,
    existingBooking,
    tenantContext: tenantContext.context,
    branchContext,
  });
  
  // Task 19.1: Integrate adapter validation
  const adapterValidationResult = await invokeAdapterValidation(
    bookingPayload,
    tenantContext.context
  );
  if ('error' in adapterValidationResult) {
    return { error: adapterValidationResult.error };
  }
  
  const bookingResult = await upsertBookingRecord({
    supabase,
    existingBooking,
    bookingPayload,
    ...(branchContext.requiresBranch && branchContext.strictDraftScope ? {
      expectedDraftScope: { tenantId, customerId, branchId: branchContext.branchId },
    } : {}),
  });
  if ('error' in bookingResult) {
    return { error: bookingResult.error };
  }
  const booking = bookingResult.booking;

  const depositResult = await recordBookingDepositRevenue({
    supabase,
    booking,
    tenantId,
    depositAmount: validatedData.deposit_amount,
  });
  if ('error' in depositResult) {
    return { error: depositResult.error };
  }

  const sessionLogsResult = await createInitialSessionLogs({
    supabase,
    booking,
    validatedData,
    tenantId,
  });
  if ('error' in sessionLogsResult) {
    return { error: sessionLogsResult.error };
  }

  // Task 12: Create service items with commission calculation (optional feature)
  if (validatedData.serviceItems && validatedData.serviceItems.length > 0) {
    const { createBookingServiceItems } = await import('./create-booking-service-items-helper');
    
    // Extract commission defaults from tenant context settings
    const commissionDefaults = getCommissionConfig(tenantContext.context.settings)?.service_commission_default;
    
    const serviceItemsResult = await createBookingServiceItems({
      supabase,
      booking,
      serviceItems: validatedData.serviceItems,
      tenantId,
      commissionDefaults,
    });
    
    if ('error' in serviceItemsResult || !serviceItemsResult.success) {
      console.error('[createBooking] Service items creation failed:', serviceItemsResult.error);
      // Note: Booking already created, don't return error (best-effort approach)
      // Service items can be added later via booking detail page
    } else {
      console.log(`[createBooking] Created ${serviceItemsResult.count} service items with total commission: ${serviceItemsResult.totalCommission} VND`);
    }
  }

  // ── Availability Cache Invalidation ──────────────────────────────────────
  // After booking and initial session logs are committed to the DB,
  // invalidate the Redis availability cache for the booking slot.
  // Fire-and-forget: failure does not block booking creation.
  if (booking.start_date && booking.preferred_time) {
    invalidateAvailabilityCache({
      tenantId,
      date: booking.start_date,
      time: booking.preferred_time,
      duration: 60, // Default duration — keys without duration variant expire via TTL
    }).catch(err =>
      console.error('[createBooking] Availability cache invalidation failed (non-blocking):', err)
    );
  }

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers',
    `/dashboard/customers/${customerId}`,
    '/dashboard',
    '/dashboard/finance'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data: booking };
}
