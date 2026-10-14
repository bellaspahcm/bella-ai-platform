/** @jest-environment jsdom */

import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CustomerDetailInfoCard, CustomerHeaderBanner } from '@/app/dashboard/customers/[id]/components/CustomerProfilePanel';
import { EditCustomerModal } from '@/app/dashboard/customers/[id]/components/CustomerDetailModals';
import { ActiveBookingPanel } from '@/app/dashboard/customers/[id]/components/ActiveBookingPanel';
import { SessionHistoryPanel } from '@/app/dashboard/customers/[id]/components/SessionHistoryPanel';
import { CustomerStatsPanel } from '@/app/dashboard/customers/[id]/components/CustomerStatsPanel';
import { getBabyCareCustomerStats, getBabyCareSessionSummary } from '@/app/dashboard/customers/[id]/babycare-customer-view';
import { babyCareBooking, babyCareCustomer, babyCareEditData, babyCareRevenue, babyCareSession } from './fixtures/babycare-customer';

jest.mock('@/services/customer-actions', () => ({ geocodeAddress: jest.fn() }));

const noop = () => {};
const activeProps = {
  ktvs: [{ id: 'ktv-1', full_name: 'KTV phụ trách', role: 'ktv' }],
  tenantModuleKey: 'babycare' as const, userRole: 'admin' as const,
  isDepositOnly: false, activeDepositAmount: 0, activeNetPrice: 4500000,
  isExportingQuotation: false, isUpdatingKtv: false, onOpenBooking: noop,
  onPayRemaining: noop, onOpenZalo: noop, onSharePortal: noop, onExportQuotation: noop,
  onExportContract: noop, onEditBooking: noop, onUpdateKtv: noop, onOpenBookingSessions: noop,
};
const sessionProps = {
  sortedSessions: [], isCompleted: false, isReusing: false, onOpenSessions: noop,
  onOpenBookingSessions: noop, onReusePackage: noop, tenantModuleKey: 'babycare' as const,
};

function EditHarness({ isBabyCare = true }: { isBabyCare?: boolean }) {
  const [data, setData] = useState(babyCareEditData);
  return <EditCustomerModal isOpen onClose={noop} onConfirm={noop} isSubmitting={false}
    data={data} setData={setData} tenantModuleKey={isBabyCare ? 'babycare' : 'beauty_spa'} isBabyCare={isBabyCare} />;
}

describe('BabyCare customer card reconciliation', () => {
  it('uses editable mother/baby fields and removes invented CRM attributes', () => {
    render(<CustomerDetailInfoCard customer={babyCareCustomer()} tenantModuleKey="babycare" isBabyCare onEditCustomer={noop} />);
    expect(screen.getByText('Họ tên mẹ')).toBeInTheDocument();
    expect(screen.getByText('Tên bé')).toBeInTheDocument();
    expect(screen.getByText('Bé trai')).toBeInTheDocument();
    expect(screen.getByText('20/09/2026')).toBeInTheDocument();
    expect(screen.getByText('25/09/2026')).toBeInTheDocument();
    expect(screen.queryByText('Nguồn khách')).not.toBeInTheDocument();
    expect(screen.queryByText('Khách thân thiết')).not.toBeInTheDocument();
    expect(screen.queryByText('Phân nhóm')).not.toBeInTheDocument();
  });

  it('does not invent gender, VIP or notes when the profile is empty', () => {
    render(<CustomerHeaderBanner customer={babyCareCustomer({ gender_baby: null, name_baby: null, loyalty_points: 60 })}
      tenantModuleKey="babycare" isBabyCare userRole="admin" onEditCustomer={noop} onOpenBooking={noop} />);
    expect(screen.getByText(/Chưa biết/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có ghi chú/)).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Đổi ảnh đại diện')).not.toBeInTheDocument();
  });

  it('edits dates independently, allows clearing them, and edits baby gender', () => {
    render(<EditHarness />);
    fireEvent.change(screen.getByLabelText('Ngày sinh bé'), { target: { value: '2026-09-21' } });
    expect(screen.getByLabelText('Ngày dự sinh')).toHaveValue('2026-09-25');
    fireEvent.change(screen.getByLabelText('Ngày dự sinh'), { target: { value: '2026-09-28' } });
    expect(screen.getByLabelText('Ngày sinh bé')).toHaveValue('2026-09-21');
    fireEvent.change(screen.getByLabelText('Ngày sinh bé'), { target: { value: '' } });
    expect(screen.getByLabelText('Ngày dự sinh')).toHaveValue('2026-09-28');
    fireEvent.click(screen.getByRole('button', { name: 'Bé gái' }));
    expect(screen.getByRole('button', { name: 'Bé gái' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Khách thân thiết')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguồn khách')).not.toBeInTheDocument();
  });

  it('uses earliest scheduled date, not session number; excludes cancelled/pending from history', () => {
    const booking = babyCareBooking({ session_logs: [
      babyCareSession({ id: 'late', session_number: 1, assigned_date: '2026-10-20' }),
      babyCareSession({ id: 'early', session_number: 3, assigned_date: '2026-10-15' }),
      babyCareSession({ id: 'cancelled', status: 'cancelled', assigned_date: '2026-10-01' }),
      babyCareSession({ id: 'done', status: 'completed', completed_date: '2026-10-14' }),
    ] });
    expect(getBabyCareSessionSummary(booking).nextSession?.id).toBe('early');
    render(<SessionHistoryPanel {...sessionProps} activeBooking={booking} isBabyCare customerAddress="Nhà khách" />);
    expect(screen.getByText('Buổi số 3 / 33')).toBeInTheDocument();
    expect(screen.getByText('Nhà khách')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử chăm sóc (1)')).toBeInTheDocument();
    expect(screen.queryByText(/Phòng|60 phút|Thứ hai|Hình ảnh trước/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
  });

  it('shows empty state without stock images, future dates or demo staff', () => {
    const { container } = render(<SessionHistoryPanel {...sessionProps} activeBooking={null} isBabyCare />);
    expect(screen.getByText('Chưa có gói chăm sóc.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có buổi chăm sóc hoàn thành.')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('does not show a next appointment on a cancelled package', () => {
    expect(getBabyCareSessionSummary(babyCareBooking({ status: 'cancelled', session_logs: [babyCareSession()] })).nextSession).toBeUndefined();
  });

  it('renders real package status and KTV selection without scoring or dummy export', () => {
    const updateKtv = jest.fn();
    render(<ActiveBookingPanel {...activeProps} onUpdateKtv={updateKtv} activeBooking={babyCareBooking({ status: 'completed' })} isBabyCare />);
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'KTV phụ trách' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'KTV phụ trách' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'KTV phụ trách' }));
    expect(updateKtv).toHaveBeenCalledWith('ktv-1');
    expect(screen.queryByText('AI ĐỀ XUẤT KTV PHÙ HỢP')).not.toBeInTheDocument();
    expect(screen.queryByText('15/09/2026')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất hợp đồng' })).not.toBeInTheDocument();
  });

  it('shows no demo package for a BabyCare customer without bookings', () => {
    render(<ActiveBookingPanel {...activeProps} activeBooking={null} isBabyCare />);
    expect(screen.getByText('Khách hàng chưa có gói chăm sóc.')).toBeInTheDocument();
    expect(screen.queryByText('Gội Đầu Dưỡng Sinh Demo')).not.toBeInTheDocument();
  });

  it('retains zero and excludes pending revenue and refunded money from paid totals', () => {
    const stats = getBabyCareCustomerStats([babyCareBooking({ revenue: [
      babyCareRevenue(), babyCareRevenue({ id: 'pending', amount: 1000000, status: 'pending' }),
      babyCareRevenue({ id: 'refund', amount: 100000, revenue_type: 'refund' }),
    ] })]);
    expect(stats.totalPaid).toBe(400000);
    expect(stats.completedSessions).toBe(0);
    render(<CustomerStatsPanel activeBooking={null} allBookings={[]} activeDepositAmount={0} activeNetPrice={0} userRole="admin" isBabyCare />);
    const paid = screen.getByText('Đã thanh toán').parentElement;
    expect(paid).not.toBeNull();
    if (paid) expect(within(paid).getByText('0đ')).toBeInTheDocument();
    expect(screen.getByText('0 buổi')).toBeInTheDocument();
    expect(screen.getByText('0 gói')).toBeInTheDocument();
    expect(screen.getByText('Chưa xếp lịch')).toBeInTheDocument();
    expect(screen.queryByText('18 ngày trước')).not.toBeInTheDocument();
  });

  it('keeps legacy Beauty card and edit behavior when BabyCare is not enabled', () => {
    const { unmount } = render(<CustomerDetailInfoCard customer={babyCareCustomer()} tenantModuleKey="beauty_spa" onEditCustomer={noop} />);
    expect(screen.getByText('Thông tin khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Nguồn khách')).toBeInTheDocument();
    expect(screen.queryByText('Tên bé')).not.toBeInTheDocument();
    unmount();
    render(<EditHarness isBabyCare={false} />);
    expect(screen.queryByLabelText('Ngày dự sinh')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ngày sinh khách hàng')).toHaveValue('2026-09-20');
    expect(screen.getByText('Khách thân thiết')).toBeInTheDocument();
  });
});
