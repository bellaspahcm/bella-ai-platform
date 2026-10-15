'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  listMobilityVehicleDisplayByIds,
  type MobilityVehicleDisplay,
} from '@/platform/mobility/supabase-vehicle-contract';
import { Search, User, Car, CheckCircle, FileCheck } from 'lucide-react';
import { VehicleSaleChainDialog } from './VehicleSaleChainDialog';
import { toast } from 'sonner';

type FilterType = 'all' | 'unpaid' | 'partial' | 'full' | 'settlement' | 'cancelled';

interface Booking {
  id: string;
  booking_number: string;
  deposit_amount: number;
  deposit_paid: number;
  payment_status: string;
  status: string;
  created_at: string;
  vehicle_id: string | null;
  customers: {
    name_mother: string;
    phone: string;
  };
  vehicleDisplay: MobilityVehicleDisplay | null;
}

type BookingRow = Omit<Booking, 'vehicleDisplay'>;

export function BookingListTable({ tenantId }: { tenantId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmationKeys = useRef(new Map<string, string>());
  const [saleBooking, setSaleBooking] = useState<Booking | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('auto_bookings')
        .select(`
          id,
          booking_number,
          deposit_amount,
          deposit_paid,
          payment_status,
          status,
          created_at,
          vehicle_id,
          customers (name_mother, phone)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Completed sales remain accessible for collection without reopening deposits.
      query = filter === 'cancelled' ? query.eq('status', 'cancelled') : filter === 'settlement'
        ? query.not('status', 'eq', 'cancelled')
        : query.not('status', 'in', '("cancelled","completed")');

      // Apply deposit filter
      if (filter === 'unpaid') {
        query = query.eq('deposit_paid', 0);
      } else if (filter === 'partial') {
        query = query.gt('deposit_paid', 0);
        // Note: Can't use .lt('deposit_paid', 'deposit_amount') directly
        // Will filter in JS after fetch
      } else if (filter === 'full') {
        // Filter in JS after fetch
      }

      const { data, error } = await query;

      if (error) throw error;

      const bookingRows = (data || []) as BookingRow[];
      const vehicleIds = bookingRows
        .map((booking) => booking.vehicle_id)
        .filter((vehicleId): vehicleId is string => typeof vehicleId === 'string' && vehicleId.length > 0);
      const vehicles = await listMobilityVehicleDisplayByIds(supabase, { tenantId, vehicleIds });
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));

      // Additional filtering for partial/full
      const filtered = bookingRows.flatMap((booking) => {
        if (!booking.vehicle_id) return [];
        const vehicleDisplay = vehiclesById.get(booking.vehicle_id);
        if (!vehicleDisplay) return [];
        return [{ ...booking, vehicleDisplay }];
      });
      let finalBookings = filtered;
      
      if (filter === 'partial') {
        finalBookings = filtered.filter(b => b.deposit_paid > 0 && b.deposit_paid < b.deposit_amount);
      } else if (filter === 'full') {
        finalBookings = filtered.filter(b => b.deposit_paid >= b.deposit_amount);
      }

      setBookings(finalBookings);
    } catch (error) {
      console.error('Load bookings error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      toast.error('Không thể tải danh sách booking. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tenantId]);

  const handleConfirmDeposit = async (booking: Booking) => {
    const amount = prompt(
      `Nhập số tiền cọc khách đã thanh toán:\n\n` +
      `Booking: ${booking.booking_number}\n` +
      `Khách hàng: ${booking.customers.name_mother}\n` +
      `Đã cọc: ${formatCurrency(booking.deposit_paid)}\n` +
      `Còn thiếu: ${formatCurrency(booking.deposit_amount - booking.deposit_paid)}\n\n` +
      `Số tiền (VNĐ):`,
      (booking.deposit_amount - booking.deposit_paid).toString()
    );

    if (!amount || isNaN(Number(amount))) return;

    setConfirmingId(booking.id);
    try {
      const key = confirmationKeys.current.get(booking.id) ?? crypto.randomUUID();
      confirmationKeys.current.set(booking.id, key);
      const response = await fetch(`/api/bella-auto/bookings/${booking.id}/confirm-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: 'cash', // TODO: Add payment method selector
          notes: 'Xác nhận từ Booking Hub',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`❌ Lỗi: ${result.error}`);
        return;
      }

      alert(result.message);
      confirmationKeys.current.delete(booking.id);
      await loadBookings(); // Reload list
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      alert(`❌ Lỗi: ${errorMessage}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('vi-VN') + ' đ';
  };

  const filteredBookings = bookings.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.booking_number.toLowerCase().includes(term) ||
      b.customers.name_mother.toLowerCase().includes(term) ||
      b.customers.phone.includes(term) ||
      (b.vehicleDisplay?.vin || '').toLowerCase().includes(term)
    );
  });

  // Calculate counts for filter tabs
  const bookingCounts = {
    total: bookings.length,
    unpaid: bookings.filter(b => b.deposit_paid === 0).length,
    partial: bookings.filter(b => b.deposit_paid > 0 && b.deposit_paid < b.deposit_amount).length,
    full: bookings.filter(b => b.deposit_paid >= b.deposit_amount).length,
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <FilterTab
            label="Tất cả"
            count={bookingCounts.total}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterTab
            label="Chưa cọc"
            count={bookingCounts.unpaid}
            active={filter === 'unpaid'}
            onClick={() => setFilter('unpaid')}
            color="red"
          />
          <FilterTab
            label="Cọc 1 phần"
            count={bookingCounts.partial}
            active={filter === 'partial'}
            onClick={() => setFilter('partial')}
            color="yellow"
          />
          <FilterTab
            label="Đã cọc đủ"
            count={bookingCounts.full}
            active={filter === 'full'}
            onClick={() => setFilter('full')}
            color="green"
          />
          <FilterTab label="Thanh toán sau bán" count={0} active={filter === 'settlement'} onClick={() => setFilter('settlement')} />
          <FilterTab label="Lịch sử hủy" count={0} active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} />
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm số booking, khách, VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Số Booking
              </th>
              <th className="text-left p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Khách Hàng
              </th>
              <th className="text-left p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Xe
              </th>
              <th className="text-right p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Cọc Yêu Cầu
              </th>
              <th className="text-right p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Đã Cọc
              </th>
              <th className="text-center p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Trạng Thái
              </th>
              <th className="text-center p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Hành Động
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  {searchTerm ? '🔍 Không tìm thấy booking phù hợp' : '📋 Chưa có booking nào'}
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400">
                      {booking.booking_number}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(booking.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-sm">{booking.customers.name_mother}</div>
                        <div className="text-xs text-slate-500">{booking.customers.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {booking.vehicleDisplay ? (
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-semibold text-sm">
                            {[booking.vehicleDisplay.modelName, booking.vehicleDisplay.variantName]
                              .filter(Boolean)
                              .join(' ') || 'Xe đã phân bổ'}
                          </div>
                          <div className="text-xs text-slate-500">
                            VIN: {booking.vehicleDisplay.vin} • {booking.vehicleDisplay.colorExterior}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa phân bổ VIN</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-bold text-sm">
                      {formatCurrency(booking.deposit_amount)}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(booking.deposit_paid)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Còn {formatCurrency(booking.deposit_amount - booking.deposit_paid)}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <DepositStatusBadge booking={booking} />
                  </td>
                  <td className="p-3 text-center">
                    {filter !== 'settlement' && filter !== 'cancelled' && <button
                      onClick={() => handleConfirmDeposit(booking)}
                      disabled={
                        confirmingId === booking.id ||
                        booking.deposit_paid >= booking.deposit_amount
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {confirmingId === booking.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Xác Nhận Cọc
                        </>
                      )}
                    </button>}
                    <button type="button" disabled={!booking.vehicle_id}
                      onClick={() => setSaleBooking(booking)} title="Hồ sơ bán xe" aria-label={`Hồ sơ bán xe ${booking.booking_number}`}
                      className="ml-2 inline-flex p-2 text-cyan-700 disabled:opacity-40 dark:text-cyan-400">
                      <FileCheck className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {saleBooking && <VehicleSaleChainDialog key={saleBooking.id} bookingId={saleBooking.id}
        bookingNumber={saleBooking.booking_number} tenantId={tenantId} onClose={() => setSaleBooking(null)} />}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
  color = 'blue',
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: 'blue' | 'red' | 'yellow' | 'green';
}) {
  const colorClasses = {
    blue: active
      ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    red: active
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    yellow: active
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    green: active
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${colorClasses[color]}`}
    >
      {label}
      {count > 0 && (
        <span className="ml-2 px-2 py-0.5 rounded-full bg-white/50 dark:bg-slate-950/50 text-xs font-bold">
          {count}
        </span>
      )}
    </button>
  );
}

function DepositStatusBadge({ booking }: { booking: Booking }) {
  if (booking.deposit_paid === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-bold">
        ⚠️ Chưa cọc
      </span>
    );
  }
  if (booking.deposit_paid < booking.deposit_amount) {
    const percent = Math.round((booking.deposit_paid / booking.deposit_amount) * 100);
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold">
        🕐 Cọc {percent}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-bold">
      ✅ Đã cọc đủ
    </span>
  );
}
