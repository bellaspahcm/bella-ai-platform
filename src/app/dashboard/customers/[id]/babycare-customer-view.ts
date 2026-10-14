import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import type { CustomerDetailBooking, CustomerDetailSession } from './types';

function scheduleKey(session: CustomerDetailSession) {
  return `${session.assigned_date || '9999-12-31'}T${session.assigned_time || '23:59:59'}`;
}

export function getBabyCareSessionSummary(booking: Pick<CustomerDetailBooking, 'session_logs' | 'status'> | null) {
  const sessions = booking?.session_logs ?? [];
  const scheduled = sessions.filter(session => session.status === 'scheduled')
    .sort((a, b) => scheduleKey(a).localeCompare(scheduleKey(b)) || a.session_number - b.session_number);
  const completed = sessions.filter(session => session.status === 'completed')
    .sort((a, b) => (b.completed_date || b.assigned_date || '').localeCompare(a.completed_date || a.assigned_date || ''));

  return { nextSession: booking?.status === 'cancelled' ? undefined : scheduled[0], completed };
}

export function getBabyCareCustomerStats(bookings: CustomerDetailBooking[]) {
  const completed = bookings.flatMap(booking => getBabyCareSessionSummary(booking).completed);
  const scheduled = bookings.filter(booking => booking.status !== 'cancelled')
    .flatMap(booking => booking.session_logs ?? [])
    .filter(session => session.status === 'scheduled' && session.assigned_date)
    .sort((a, b) => scheduleKey(a).localeCompare(scheduleKey(b)));
  const lastSessionDate = completed.map(session => session.completed_date || session.assigned_date)
    .filter((date): date is string => Boolean(date)).sort().at(-1);

  return {
    totalPaid: bookings.reduce((sum, booking) => sum + calculateBookingPaymentState({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues: booking.revenue,
    }).totalPaid, 0),
    completedSessions: bookings.reduce((sum, booking) => sum + (booking.completed_sessions ?? 0), 0),
    activePackages: bookings.filter(booking => booking.status === 'active' || booking.status === 'in_progress').length,
    lastSessionDate,
    nextSession: scheduled[0],
  };
}
