import type { CustomerDetailBooking, CustomerDetailRecord, CustomerDetailRevenue, CustomerDetailSession, EditCustomerData } from '@/app/dashboard/customers/[id]/types';

export function babyCareCustomer(overrides: Partial<CustomerDetailRecord> = {}): CustomerDetailRecord {
  return {
    id: 'customer-1', tenant_id: 'tenant-1', name_mother: 'Mẹ Hồng', phone: '0900000001',
    name_baby: 'Bé An', gender_baby: 'boy', dob_baby: '2026-09-20', dob_expected: '2026-09-25',
    address: 'Địa chỉ chăm sóc tại nhà', notes: null, loyalty_points: 0,
    latitude: null, longitude: null, metadata: null, referrer_id: null, status: 'active',
    created_at: '2026-09-29T08:00:00Z', updated_at: null, zalo_oa_id: null,
    baby: { name: 'Bé An', gender: 'Nam', dob: '2026-09-20' }, sessions: [], allBookings: [],
    ...overrides,
  };
}

export function babyCareBooking(overrides: Partial<CustomerDetailBooking> = {}): CustomerDetailBooking {
  return {
    id: 'booking-1', tenant_id: 'tenant-1', booking_number: 'BC-001', customer_id: 'customer-1',
    package_id: 'package-1', package_name: 'Tắm bé tại nhà', full_price: 6000000, discount_percent: 25,
    deposit_amount: 500000, status: 'in_progress', total_sessions: 33, completed_sessions: 0,
    assigned_bed_id: null, assigned_room_id: null, assigned_ktv_id: 'ktv-1', branch_id: null,
    assigned_ktv: { full_name: 'KTV phụ trách' }, contract_signed: null, contract_url: null,
    created_at: '2026-09-29T08:00:00Z', end_date: null, expected_birth_date: null,
    is_in_care: null, ktv_commission: null, last_updated_date: null, metadata: null,
    preferred_time: '08:00', required_equipment_ids: null, share_token: null, start_date: '2026-10-13', updated_at: null,
    session_logs: [], revenue: [], ...overrides,
  };
}

export function babyCareSession(overrides: Partial<CustomerDetailSession> = {}): CustomerDetailSession {
  return {
    id: 'session-1', tenant_id: 'tenant-1', booking_id: 'booking-1', session_number: 1,
    status: 'scheduled', assigned_date: '2026-10-15', assigned_time: '08:00:00',
    address: null, actual_duration: null, standard_duration: null,
    accounting_metadata: {}, accounting_review_status: 'not_required', accounting_template_id: null,
    booking_resource_id: null, branch_id: null, business_event_type: null,
    checkin_lat: null, checkin_lon: null, checkout_lat: null, checkout_lon: null,
    completed_by_ktv_id: null, completed_date: null, created_at: null, duration_warning_type: null,
    end_time: null, is_confirmed: null, ktv_checkout_note: null, notes: null, rating: null,
    rating_comment: null, start_time: null, time_deviation: null, zalo_reminder_sent: null,
    zalo_reminder_time: null, ...overrides,
  };
}

export function babyCareRevenue(overrides: Partial<CustomerDetailRevenue> = {}): CustomerDetailRevenue {
  return {
    id: 'revenue-1', tenant_id: 'tenant-1', booking_id: 'booking-1', amount: 500000,
    revenue_type: 'deposit', status: 'confirmed', received_date: '2026-10-14',
    accounting_metadata: {}, accounting_review_status: 'not_required', accounting_template_id: null,
    branch_id: null, business_event_type: null, is_locked: null, notes: null,
    payment_method: 'cash', receipt_url: null, recorded_by_id: null, ...overrides,
  };
}

export const babyCareEditData: EditCustomerData = {
  name_mother: 'Mẹ Hồng', phone: '0900000001', name_baby: 'Bé An', gender_baby: 'boy',
  dob_baby: '2026-09-20', dob_expected: '2026-09-25', address: 'Địa chỉ chăm sóc tại nhà',
  notes: '', latitude: null, longitude: null,
};
