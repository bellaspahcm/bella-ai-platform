/**
 * AutoSalesProvider
 *
 * Xử lý các nghiệp vụ bán hàng (Lead & Sales Center) của Bella Auto:
 * - Tạo hợp đồng đặt cọc (Booking)
 * - Tự động phân bổ số VIN khi đặt cọc (khóa xe)
 * - Ghi nhận thanh toán cọc và cập nhật trạng thái thanh toán.
 *
 * P0 financial contract note:
 * Booking/deposit updates are not vehicle sale revenue recognition events.
 * Do not emit PACKAGE_SALE from this producer until an approved AutoMove
 * payment_received / sale_revenue_recognized contract exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VehicleAllocationService } from './VehicleAllocationService';
import { CustomerJourneyService } from './CustomerJourneyService';
import { JourneySLAMonitorService } from './JourneySLAMonitorService';

export interface CreateBookingInput {
  tenantId: string;
  customerId: string;
  leadId?: string;
  variantId: string;
  vehicleId?: string; // Số VIN được khớp
  colorExterior: string;
  totalPrice: number;
  depositAmount: number;
  createdByUserId?: string;
}

export interface BookingDetail {
  id: string;
  bookingNumber: string;
  tenantId: string;
  customerId: string;
  leadId: string | null;
  variantId: string;
  vehicleId: string | null;
  colorExterior: string;
  totalPrice: number;
  depositAmount: number;
  depositPaid: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' | 'refunded';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const AutoSalesProvider = {
  /**
   * Tạo hợp đồng đặt cọc xe ô tô mới.
   * Atomic: Insert booking + Phân bổ VIN (nếu có) + Transition Journey.
   */
  async createBooking(
    supabase: SupabaseClient,
    input: CreateBookingInput
  ): Promise<BookingDetail> {
    const { tenantId, customerId, leadId, variantId, vehicleId, colorExterior, totalPrice, depositAmount, createdByUserId } = input;

    // 1. Tạo số booking duy nhất
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingNumber = `BK-AUTO-2026-${randomSuffix}`;
    const initialPaymentStatus: BookingDetail['paymentStatus'] = 'unpaid';
    const initialBookingStatus: BookingDetail['status'] = 'pending';

    // 2. Insert vào bảng auto_bookings
    const { data: booking, error: insertErr } = await supabase
      .from('auto_bookings')
      .insert({
        tenant_id:            tenantId,
        customer_id:          customerId,
        lead_id:              leadId ?? null,
        variant_id:           variantId,
        vehicle_id:           vehicleId ?? null,
        color_exterior:       colorExterior,
        booking_number:       bookingNumber,
        total_price:          totalPrice,
        deposit_amount:       depositAmount,
        deposit_paid:         0,
        payment_status:       initialPaymentStatus,
        status:               initialBookingStatus,
        metadata:             { createdByUserId },
      })
      .select('*')
      .single();

    if (insertErr || !booking) {
      throw new Error(`AutoSalesProvider.createBooking: Lỗi tạo hợp đồng đặt cọc. ${insertErr?.message ?? ''}`);
    }

    // 3. Nếu có VIN (vehicleId) được chỉ định sẵn, thực hiện phân bổ xe ngay
    if (vehicleId) {
      try {
        await VehicleAllocationService.allocate(supabase, {
          tenantId,
          vehicleId,
          contractId:        booking.id,
          allocatedByUserId: createdByUserId,
          reason:            `Phân bổ tự động khi tạo đặt cọc ${bookingNumber}`,
        });
      } catch (allocErr: unknown) {
        // Rollback booking nếu phân bổ xe thất bại để đảm bảo tính nhất quán dữ liệu
        await supabase.from('auto_bookings').delete().eq('id', booking.id);
        throw new Error(`AutoSalesProvider.createBooking: Lỗi phân bổ số VIN. ${errorMessage(allocErr)}`);
      }
    }

    // 4. Cập nhật hành trình khách hàng sang giai đoạn 'deposit_received'
    try {
      await CustomerJourneyService.transitionStage(supabase, {
        tenantId,
        customerId,
        toStageCode:     'deposit_received',
        changedByUserId: createdByUserId,
        reason:          `Đã ký hợp đồng đặt cọc xe ${bookingNumber}`,
        metadata:        { bookingId: booking.id },
      });
    } catch (jErr: unknown) {
      console.warn(`[AutoSalesProvider] Không thể cập nhật hành trình khách hàng: ${errorMessage(jErr)}`);
    }

    return {
      id:            booking.id,
      bookingNumber: booking.booking_number,
      tenantId:      booking.tenant_id,
      customerId:    booking.customer_id,
      leadId:        booking.lead_id,
      variantId:     booking.variant_id,
      vehicleId:     booking.vehicle_id,
      colorExterior: booking.color_exterior,
      totalPrice:    Number(booking.total_price),
      depositAmount: Number(booking.deposit_amount),
      depositPaid:   Number(booking.deposit_paid),
      paymentStatus: initialPaymentStatus,
      status:        initialBookingStatus,
      createdAt:     booking.created_at,
    };
  },

  /**
   * Ghi nhận thanh toán đặt cọc từ khách hàng.
   */
  async recordDepositPayment(
    supabase: SupabaseClient,
    tenantId: string,
    bookingId: string,
    paidAmount: number,
    staffId?: string
  ): Promise<{ success: boolean; paymentStatus: string; depositPaid: number }> {
    
    // 1. Lấy thông tin booking hiện tại
    const { data: booking, error: fetchErr } = await supabase
      .from('auto_bookings')
      .select('id, customer_id, deposit_amount, deposit_paid, booking_number')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !booking) {
      throw new Error(`AutoSalesProvider.recordDepositPayment: Booking không tồn tại.`);
    }

    const newDepositPaid = Number(booking.deposit_paid) + paidAmount;
    let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' = 'unpaid';

    if (newDepositPaid >= Number(booking.deposit_amount)) {
      paymentStatus = 'fully_paid';
    } else if (newDepositPaid > 0) {
      paymentStatus = 'partially_paid';
    }

    // 2. Cập nhật số tiền đã đóng & payment status
    const { error: updateErr } = await supabase
      .from('auto_bookings')
      .update({
        deposit_paid:   newDepositPaid,
        payment_status: paymentStatus,
        status:         paymentStatus === 'fully_paid' ? 'confirmed' : 'pending',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`AutoSalesProvider.recordDepositPayment: Lỗi cập nhật thanh toán. ${updateErr.message}`);
    }

    // 3. Nếu thanh toán hoàn tất, ghi nhận Touchpoint.
    // Không phát PACKAGE_SALE: tiền cọc là payment_received/customer advance
    // candidate, không phải sale_revenue_recognized.
    if (paymentStatus === 'fully_paid') {
      await JourneySLAMonitorService.recordTouchpoint(supabase, {
        tenantId,
        customerId: booking.customer_id,
        channel:    'showroom_visit',
        title:      'Đóng cọc xe hoàn tất',
        content:    `Khách hàng đã nộp đủ tiền cọc ${Number(booking.deposit_amount).toLocaleString('vi-VN')} VND cho hợp đồng ${booking.booking_number}`,
        staffId,
        metadata:   { bookingId, paidAmount },
      });
    }

    return {
      success: true,
      paymentStatus,
      depositPaid: newDepositPaid,
    };
  }
};
