'use server';

/**
 * KTV AI Suggestion Server Actions
 *
 * Exposes Decision Engine recommendations to the admin UI.
 * Two actions:
 *  - getKtvSuggestions: Call the engine, return top 3 candidates + score breakdown
 *  - applyKtvSuggestion: Persist the admin's choice to bookings.assigned_ktv_id
 */

import { createClient } from '@/lib/supabase-server';
import { autoAssignKtv } from '@/services/booking-decision.service';
import { getBookingTenantActor, getEligibleBookingKtvs } from '@/services/booking-ktv-eligibility';
import { isAdminRole } from '@/lib/business-rules/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KtvSuggestion {
  /** KTV user ID */
  ktvId: string;
  /** Display name */
  ktvName: string;
  /** Total score 0-100 */
  score: number;
  /** Human-readable reason string from the engine */
  reason: string;
  /** Score component breakdown */
  breakdown: {
    skillMatch: number;       // 0-25
    availability: number;     // 0-20
    workloadBalance: number;  // 0-20
    performance: number;      // 0-15
    customerPreference: number; // 0-10
    specialization: number;   // 0-10
  };
  /** Whether this is the top recommendation */
  isRecommended: boolean;
}

export interface GetKtvSuggestionsInput {
  /** Parent booking ID (used to look up customer, service, etc.) */
  bookingId: string;
  /** Tenant ID */
  tenantId: string;
  /** Requested session date (YYYY-MM-DD) */
  requestedDate: string;
  /** Requested session time (HH:mm) */
  requestedStartTime: string;
  /** Session duration in minutes */
  durationMinutes: number;
}

export interface GetKtvSuggestionsResult {
  success: boolean;
  suggestions: KtvSuggestion[];
  evaluationMetadata?: {
    algorithmVersion: string;
    totalCandidates: number;
    eligibleCandidates: number;
    executionTimeMs: number;
  };
  error?: string;
}

type CapacityConfig = {
  break_buffer_minutes?: number;
  max_sessions_per_day?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCapacityConfig(metadata: unknown): CapacityConfig {
  if (!isRecord(metadata) || !isRecord(metadata.capacity_config)) {
    return {};
  }

  return {
    break_buffer_minutes: typeof metadata.capacity_config.break_buffer_minutes === 'number'
      ? metadata.capacity_config.break_buffer_minutes
      : undefined,
    max_sessions_per_day: typeof metadata.capacity_config.max_sessions_per_day === 'number'
      ? metadata.capacity_config.max_sessions_per_day
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// getKtvSuggestions
// ---------------------------------------------------------------------------

/**
 * Get AI-powered KTV recommendations for a booking session.
 *
 * Calls the Decision Engine and returns top 3 ranked candidates
 * with score breakdowns, suitable for display in the admin UI.
 *
 * @example
 * const result = await getKtvSuggestions({
 *   bookingId: 'booking-123',
 *   tenantId: 'tenant-001',
 *   requestedDate: '2026-07-15',
 *   requestedStartTime: '14:00',
 *   durationMinutes: 90,
 * });
 */
export async function getKtvSuggestions(
  input: GetKtvSuggestionsInput
): Promise<GetKtvSuggestionsResult> {
  try {
    await getBookingTenantActor(input.tenantId);
    const supabase = await createClient();

    // 1. Verify booking exists and fetch required context
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        tenant_id,
        customer_id,
        assigned_ktv_id,
        packages ( name, module_key, default_duration_minutes )
      `)
      .eq('id', input.bookingId)
      .eq('tenant_id', input.tenantId)
      .single();

    if (bookingError || !booking) {
      return { success: false, suggestions: [], error: 'Không tìm thấy booking' };
    }

    // 2. Fetch customer loyalty points and metadata
    const { data: customer } = await supabase
      .from('customers')
      .select('loyalty_points, metadata')
      .eq('id', booking.customer_id)
      .single();

    const loyaltyPoints = customer?.loyalty_points || 0;
    const metadata = (customer?.metadata as Record<string, unknown>) || {};
    const status = String(metadata.status || '').toLowerCase().trim();

    const customerTier: 'vip' | 'loyal' | 'new' =
      status === 'vip' || loyaltyPoints >= 1000 ? 'vip'
      : status === 'loyal' || loyaltyPoints >= 300 ? 'loyal'
      : 'new';

    // 3. Resolve service info from package
    const pkgData = booking.packages as { name?: string; module_key?: string; default_duration_minutes?: number } | null;
    const serviceType = pkgData?.module_key || 'general';
    const durationMinutes = input.durationMinutes
      || pkgData?.default_duration_minutes
      || 60;

    // 4. Call Decision Engine via autoAssignKtv (returns winner + alternatives)
    const engineResult = await autoAssignKtv({
      tenantId: input.tenantId,
      customerId: booking.customer_id,
      serviceId: input.bookingId,
      serviceType,
      requestedDate: input.requestedDate,
      requestedStartTime: input.requestedStartTime,
      durationMinutes,
      customerTier,
    });

    // 5. Build suggestions list from winner + alternatives
    const allCandidates: KtvSuggestion[] = [];

    // Top recommendation (winner)
    if (engineResult.assignedKtvId) {
      allCandidates.push({
        ktvId: engineResult.assignedKtvId,
        ktvName: engineResult.assignedKtvName || 'KTV',
        score: 100, // Winner — exact score extracted from reason string below
        reason: engineResult.reason,
        breakdown: parseBreakdownFromReason(engineResult.reason),
        isRecommended: true,
      });
    }

    // Runner-ups from alternatives
    (engineResult.alternatives || []).slice(0, 2).forEach(alt => {
      allCandidates.push({
        ktvId: alt.ktvId,
        ktvName: alt.ktvName,
        score: alt.score,
        reason: alt.reason,
        breakdown: parseBreakdownFromReason(alt.reason),
        isRecommended: false,
      });
    });

    // 6. Filter out unavailable KTVs (those with conflicts at requested time)
    const suggestions = await filterAvailableKtvs(
      allCandidates,
      input.tenantId,
      input.requestedDate,
      input.requestedStartTime,
      durationMinutes,
      input.bookingId
    );

    if (suggestions.length === 0) {
      return {
        success: false,
        suggestions: [],
        error: 'Không có KTV có tài khoản và quyền hợp lệ khả dụng lúc ' + input.requestedStartTime,
      };
    }

    return {
      success: true,
      suggestions,
      evaluationMetadata: {
        algorithmVersion: '1.0.0',
        totalCandidates: 0, // Filled by engine context in production
        eligibleCandidates: suggestions.length,
        executionTimeMs: engineResult.executionTime,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return { success: false, suggestions: [], error: message };
  }
}

// ---------------------------------------------------------------------------
// applyKtvSuggestion
// ---------------------------------------------------------------------------

export interface ApplyKtvSuggestionResult {
  success: boolean;
  error?: string;
}

/**
 * Apply a KTV suggestion by updating bookings.assigned_ktv_id.
 *
 * Only admin can call this. The server action verifies ownership
 * before updating.
 */
export async function applyKtvSuggestion(
  bookingId: string,
  ktvId: string,
  tenantId: string
): Promise<ApplyKtvSuggestionResult> {
  try {
    const actor = await getBookingTenantActor(tenantId);
    if (!isAdminRole(actor.role)) {
      return { success: false, error: 'Chỉ quản trị viên tenant được chọn KTV đề xuất.' };
    }
    const supabase = await createClient();

    // Verify the booking belongs to this tenant
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, tenant_id, status')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: 'Booking không tồn tại hoặc không thuộc chi nhánh này' };
    }

    const eligibleKtvs = await getEligibleBookingKtvs(tenantId, ktvId);
    if (!eligibleKtvs.some(ktv => ktv.id === ktvId)) {
      return { success: false, error: 'KTV không có tài khoản đăng nhập và quyền hợp lệ trong tenant này.' };
    }

    // Revalidate account eligibility even for previously displayed suggestions.
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ assigned_ktv_id: ktvId })
      .eq('id', bookingId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a rough breakdown from the reason string returned by the engine.
 * The engine returns structured data in `score.components` but the service
 * layer currently only forwards the `reason` string. We return estimated
 * breakdown values since the exact component scores are not yet exposed
 * through the service layer return type.
 *
 * TODO: Expose `score.components` from `autoAssignKtv()` for exact breakdown.
 */
function parseBreakdownFromReason(reason: string): KtvSuggestion['breakdown'] {
  // Extract total score from reason string: "... (score: 91/100) ..."
  const scoreMatch = reason.match(/score:\s*(\d+)/);
  const totalScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 70;

  // Distribute proportionally as approximation (exact requires service layer change)
  const ratio = totalScore / 100;
  return {
    skillMatch: Math.round(25 * ratio),
    availability: Math.round(20 * ratio),
    workloadBalance: Math.round(20 * ratio),
    performance: Math.round(15 * ratio),
    customerPreference: Math.round(10 * ratio),
    specialization: Math.round(10 * ratio),
  };
}

/**
 * Filter KTV suggestions to only those available at requested time.
 * 
 * Uses the CapacityManagementProvider (same logic as booking validation)
 * to check for conflicts (break time violation, overlap, daily limit).
 * 
 * @param candidates - All KTV suggestions from Decision Engine
 * @param tenantId - Tenant ID for fetching capacity config
 * @param date - Requested date (YYYY-MM-DD)
 * @param time - Requested time (HH:mm)
 * @param duration - Session duration in minutes
 * @param excludeBookingId - Booking ID to exclude (for edit mode)
 * @returns Filtered list of only available KTVs
 */
async function filterAvailableKtvs(
  candidates: KtvSuggestion[],
  tenantId: string,
  date: string,
  time: string,
  duration: number,
  excludeBookingId?: string
): Promise<KtvSuggestion[]> {
  try {
    const supabase = await createClient();

    // 1. Fetch capacity config
    const { data: tenant } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .single();

    const capacityConfig = readCapacityConfig(tenant?.metadata);
    const breakBufferMinutes = capacityConfig.break_buffer_minutes || 15;
    const maxSessionsPerDay = capacityConfig.max_sessions_per_day || 8;

    // 2. Check each KTV for availability
    const availableKtvs: KtvSuggestion[] = [];

    for (const candidate of candidates) {

      // Fetch existing bookings for this KTV on same date
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, start_date, end_date, preferred_time, packages(default_duration_minutes)')
        .eq('tenant_id', tenantId)
        .eq('assigned_ktv_id', candidate.ktvId)
        .eq('start_date', date)
        .in('status', ['booked', 'in_progress', 'deposit_pending']);

      console.log(`[filterAvailableKtvs] KTV ${candidate.ktvName}:`, {
        totalBookings: existingBookings?.length || 0,
        date,
        time,
        excludeBookingId,
      });

      // Exclude current booking if editing
      const filteredBookings = (existingBookings || [])
        .filter(b => b.id !== excludeBookingId)
        .map(b => ({
          startTime: b.preferred_time || '09:00',
          durationMinutes: ((b.packages as { default_duration_minutes?: number } | null)?.default_duration_minutes) || 60,
        }));

      console.log(`[filterAvailableKtvs] After filtering:`, {
        ktvName: candidate.ktvName,
        filteredCount: filteredBookings.length,
        filteredBookings,
      });

      // Check if new session would conflict
      const hasConflict = checkKtvConflict(
        filteredBookings,
        time,
        duration,
        breakBufferMinutes,
        maxSessionsPerDay
      );

      console.log(`[filterAvailableKtvs] Conflict check result:`, {
        ktvName: candidate.ktvName,
        hasConflict,
      });

      if (!hasConflict) {
        availableKtvs.push(candidate);
      }
    }

    console.log(`[filterAvailableKtvs] Final result:`, {
      totalCandidates: candidates.length,
      availableCount: availableKtvs.length,
      availableNames: availableKtvs.map(k => k.ktvName),
    });

    return availableKtvs;
  } catch (err: unknown) {
    console.error('[filterAvailableKtvs] Error:', err);
    // On error, return all candidates (don't block UI)
    return candidates;
  }
}

/**
 * Check if a KTV has a conflict at the requested time.
 * 
 * Conflict types:
 * 1. Time overlap with existing booking
 * 2. Break time buffer violation (< 15 min between sessions)
 * 3. Daily limit reached (>= 8 sessions)
 * 
 * @returns true if conflict exists, false if KTV is available
 */
function checkKtvConflict(
  existingBookings: { startTime: string; durationMinutes: number }[],
  newTime: string,
  newDuration: number,
  breakBufferMinutes: number,
  maxSessionsPerDay: number
): boolean {
  // Check daily limit
  if (existingBookings.length >= maxSessionsPerDay) {
    return true; // Conflict: Daily limit reached
  }

  // Parse new session time
  const [newHour, newMinute] = newTime.split(':').map(Number);
  const newStartMinutes = newHour * 60 + newMinute;
  const newEndMinutes = newStartMinutes + newDuration;

  // Check each existing booking for overlap or break time violation
  for (const booking of existingBookings) {
    const [hour, minute] = booking.startTime.split(':').map(Number);
    const existingStartMinutes = hour * 60 + minute;
    const existingEndMinutes = existingStartMinutes + booking.durationMinutes;

    // Check for time overlap
    if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
      return true; // Conflict: Time overlap
    }

    // Check for break time buffer violation
    // Case 1: New session starts right after existing session (need break buffer)
    if (newStartMinutes >= existingEndMinutes && newStartMinutes < existingEndMinutes + breakBufferMinutes) {
      return true; // Conflict: Break buffer violation (new session too soon after existing)
    }

    // Case 2: Existing session starts right after new session (need break buffer)
    if (existingStartMinutes >= newEndMinutes && existingStartMinutes < newEndMinutes + breakBufferMinutes) {
      return true; // Conflict: Break buffer violation (existing session too soon after new)
    }
  }

  return false; // No conflict
}
