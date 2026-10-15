'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CreditCard, FileText, Loader2, Printer, QrCode, Search } from 'lucide-react';

import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { formatBookingCustomerLabel } from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

import type { TimelineSession } from './BookingsTimelineGrid';

type BookingsPosPanelProps = {
  sessions: TimelineSession[];
  selectedDate: Date;
  tenantModuleKey: TenantModuleKey;
  isSyncing: boolean;
  printingSessionLogId: string | null;
  isSameDay: (d1: Date | string, d2: Date | string) => boolean;
  onSessionSelect: (session: TimelineSession) => void;
  onPrintInvoice: (session: TimelineSession) => void;
  onQrClick: (bookingId: string) => void;
};

type PosSession = {
  session: TimelineSession;
  customerName: string;
  phone: string;
  bookingNumber: string;
  packageName: string;
  ktvName: string;
  remainingDebt: number;
  totalPaid: number;
  priceAfterDiscount: number;
};

const fmtVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function getPosSession(session: TimelineSession, tenantModuleKey: TenantModuleKey): PosSession {
  const booking = session.bookings;
  const paymentState = calculateBookingPaymentState({
    fullPrice: booking?.full_price,
    discountPercent: booking?.discount_percent,
    depositAmount: booking?.deposit_amount,
    bookingStatus: booking?.status,
    revenues: booking?.revenue || null,
  });

  return {
    session,
    customerName: formatBookingCustomerLabel({
      moduleKey: tenantModuleKey,
      primaryName: booking?.customers?.name_mother,
      secondaryName: booking?.customers?.name_baby,
    }),
    phone: booking?.customers?.phone || '',
    bookingNumber: booking?.booking_number || session.booking_id.slice(0, 8),
    packageName: booking?.packages?.name || booking?.package_name || 'Gói dịch vụ',
    ktvName: booking?.assigned_ktv?.full_name || 'Chưa phân công',
    remainingDebt: paymentState.remainingDebt,
    totalPaid: paymentState.totalPaid,
    priceAfterDiscount: paymentState.priceAfterDiscount,
  };
}

export function BookingsPosPanel({
  sessions,
  selectedDate,
  tenantModuleKey,
  isSyncing,
  printingSessionLogId,
  isSameDay,
  onSessionSelect,
  onPrintInvoice,
  onQrClick,
}: BookingsPosPanelProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearchText(query);

  const posSessions = useMemo(() => {
    const seenBookings = new Set<string>();

    return sessions
      .filter((session) => isSameDay(session.assigned_date, selectedDate))
      .filter((session) => {
        if (seenBookings.has(session.booking_id)) return false;
        seenBookings.add(session.booking_id);
        return true;
      })
      .map((session) => getPosSession(session, tenantModuleKey))
      .filter((item) => {
        if (!normalizedQuery) return true;

        const haystack = [
          item.customerName,
          item.phone,
          item.bookingNumber,
          item.packageName,
          item.ktvName,
        ].join(' ').toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.remainingDebt !== b.remainingDebt) return b.remainingDebt - a.remainingDebt;
        return String(a.session.assigned_time || a.session.bookings?.preferred_time || '').localeCompare(
          String(b.session.assigned_time || b.session.bookings?.preferred_time || '')
        );
      });
  }, [isSameDay, normalizedQuery, selectedDate, sessions, tenantModuleKey]);

  const unpaidCount = posSessions.filter((item) => item.remainingDebt > 0).length;
  const totalDebt = posSessions.reduce((sum, item) => sum + Math.max(0, item.remainingDebt), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Ca trong ngày</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{posSessions.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">Còn công nợ</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{unpaidCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Cần thu</p>
          <p className="mt-2 text-2xl font-black text-emerald-950">{fmtVND(totalDebt)}</p>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-100/60">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Danh sách thu ngân</h2>
              <p className="text-xs font-bold text-slate-400">Chọn ca để in bill, mở VietQR hoặc xem chi tiết.</p>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm khách, SĐT, booking..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-primary focus:bg-white"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {posSessions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <CalendarClock className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-black uppercase tracking-wider text-slate-400">
                {isSyncing ? 'Đang tải danh sách ca...' : 'Không có ca phù hợp trong ngày này'}
              </p>
            </div>
          ) : (
            posSessions.map((item) => (
              <div key={item.session.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {item.session.assigned_time || item.session.bookings?.preferred_time || '09:00'}
                    </span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600">
                      {item.bookingNumber}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      item.remainingDebt > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                    >
                      {item.remainingDebt > 0 ? 'Còn thu' : 'Đã đủ'}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-base font-black text-slate-900">{item.customerName}</h3>
                  <p className="mt-1 truncate text-xs font-bold text-slate-500">
                    {item.packageName} · KTV: {item.ktvName}{item.phone ? ` · ${item.phone}` : ''}
                  </p>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                  <div className="grid grid-cols-3 gap-2 text-right text-xs">
                    <div>
                      <p className="font-black text-slate-400">Tổng</p>
                      <p className="font-black text-slate-800">{fmtVND(item.priceAfterDiscount)}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400">Đã thu</p>
                      <p className="font-black text-slate-800">{fmtVND(item.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400">Còn</p>
                      <p className="font-black text-amber-700">{fmtVND(item.remainingDebt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {(() => {
                      const isThisPrinting = printingSessionLogId === item.session.id;
                      return (
                    <button
                      type="button"
                      onClick={() => onPrintInvoice(item.session)}
                      disabled={Boolean(printingSessionLogId)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:opacity-80"
                    >
                      {isThisPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                      {isThisPrinting ? 'Đang in...' : 'In bill'}
                    </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => onQrClick(item.session.booking_id)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                    >
                      <QrCode className="h-4 w-4" />
                      VietQR
                    </button>
                    <button
                      type="button"
                      onClick={() => onSessionSelect(item.session)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                    >
                      <FileText className="h-4 w-4" />
                      Chi tiết
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
