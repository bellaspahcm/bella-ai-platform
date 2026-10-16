import type { Dispatch, SetStateAction } from 'react';
import type { Database } from '@/types/database.types';

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type BookingRow = Database['public']['Tables']['bookings']['Row'];
export type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
export type RevenueRow = Database['public']['Tables']['revenue']['Row'];
export type UserRow = Database['public']['Tables']['users']['Row'];

export type CustomerDetailSession = SessionLogRow & {
  completed_by_ktv?: { full_name: string | null; phone?: string | null } | null;
  type?: string | null;
};

export type CustomerDetailRevenue = RevenueRow & {
  recorded_by?: { full_name: string | null } | null;
};

export type CustomerDetailBooking = BookingRow & {
  packages?: { name?: string | null } | null;
  assigned_ktv?: { full_name: string | null; phone?: string | null } | null;
  session_logs?: CustomerDetailSession[];
  revenue?: CustomerDetailRevenue[];
};

export type CustomerDetailRecord = CustomerRow & {
  baby: {
    name: string;
    dob: string;
    gender: string;
  };
  sessions: unknown[];
  allBookings: CustomerDetailBooking[];
  is_fully_paid?: boolean;
};

export type KtvOption = Pick<UserRow, 'id' | 'full_name' | 'role'>;

export type EditCustomerData = {
  name_mother: string;
  phone: string;
  name_baby: string;
  dob_expected: string;
  dob_baby: string;
  address: string;
  notes: string;
  gender_baby: string;
  latitude: number | null;
  longitude: number | null;
};

export type PaymentData = {
  amount: number;
  method: string;
  notes: string;
  receipt_url: string;
  status: string;
};

export type EditBookingData = {
  package_name: string;
  full_price: number;
  deposit_amount: number;
  discount_percent: number;
  total_sessions: number;
  gift_sessions: number;
  completed_sessions: number;
  preferred_time: string;
  start_date: string;
  status: string;
};

export type ModalStateSetter<T> = Dispatch<SetStateAction<T>>;
