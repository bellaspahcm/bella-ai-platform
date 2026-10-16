/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BookingModal } from '@/components/features/BookingModal';
import { createBooking } from '@/core/services/order';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';
import type { Database } from '@/types/database.types';
import { UserProvider } from '@/lib/user-context';
import { BeautyRuntimeBranchSelector } from '@/components/layout/BeautyRuntimeBranchSelector';
import { toast } from 'sonner';
import { getBeautyRuntimeBranchContext, selectBeautyRuntimeBranch } from '@/services/beauty-runtime-branch-actions';

jest.mock('@/components/features/VietQRPaymentModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/useTenantModuleKey', () => {
  const refreshTenantModuleKey = jest.fn();
  return { useTenantModuleKey: () => ({ tenantModuleKey: 'beauty_spa', refreshTenantModuleKey }) };
});
jest.mock('@/hooks/useScrollLock', () => ({ useScrollLock: jest.fn() }));
jest.mock('@/lib/dashboard-client-context', () => ({
  getCachedTenantSettings: jest.fn(),
  getCachedCurrentUser: jest.fn(async () => ({ id: 'operator', tenant_id: 'tenant', role: 'admin' })),
}));
jest.mock('@/services/beauty-runtime-branch-actions', () => ({
  getBeautyRuntimeBranchContext: jest.fn(async () => ({ success: true, data: { branches: [{ id: 'branch-main', name: 'MAIN' }], activeBranchId: 'branch-main', requiresSelection: false } })),
  selectBeautyRuntimeBranch: jest.fn(async (id: string) => ({ success: true, data: { activeBranchId: id } })),
}));
jest.mock('@/core/services/order', () => ({
  createBooking: jest.fn(async () => ({ error: 'Stop after submit capture' })),
  getDraftBooking: jest.fn(async () => null),
  getBookingDetailsWithPayment: jest.fn(),
  getPackages: jest.fn(async () => [{ id: 'package', name: 'Synthetic Manicure', price: 300000, total_sessions: 2 }]),
}));
jest.mock('@/services/customer-actions', () => ({ getCustomers: jest.fn(async () => []) }));
jest.mock('@/services/user-actions', () => ({ getUsers: jest.fn(async () => []) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const customer = { id: 'customer', name_mother: 'Synthetic customer', phone: 'TEST-ONLY' } as Database['public']['Tables']['customers']['Row'];

describe('BookingModal selected branch transport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  async function submit() {
    render(<UserProvider><BeautyRuntimeBranchSelector enabled /><BookingModal isOpen onClose={jest.fn()} preselectedCustomer={customer} /></UserProvider>);
    await waitFor(() => expect(screen.getByLabelText('Chọn chi nhánh hoạt động')).toHaveTextContent('MAIN'));
    fireEvent.click(await screen.findByTestId('booking-package-option'));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1));
    return (createBooking as jest.Mock).mock.calls[0][0];
  }

  it('transports the active Nail branch through existing metadata', async () => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ product_key: 'bella_nail' });
    window.localStorage.setItem('bella.beauty.active_branch.v1', 'branch-main');
    expect(await submit()).toMatchObject({ metadata: { branch_id: 'branch-main', gift_sessions: 0 } });
  });

  it('uses the shared selected state even when browser storage throws', async () => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ id: 'tenant', product_key: 'bella_nail' });
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    try { expect(await submit()).toMatchObject({ metadata: { branch_id: 'branch-main' } }); }
    finally { get.mockRestore(); set.mockRestore(); }
  });

  it('does not send a booking request when shared branch selection is missing', async () => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ id: 'tenant', product_key: 'bella_nail' });
    render(<UserProvider><BookingModal isOpen onClose={jest.fn()} preselectedCustomer={customer} /></UserProvider>);
    fireEvent.click(await screen.findByTestId('booking-package-option'));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('uses a newly selected sidebar branch while localStorage is blocked', async () => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ id: 'tenant', product_key: 'bella_nail' });
    (getBeautyRuntimeBranchContext as jest.Mock).mockResolvedValueOnce({ success: true, data: {
      branches: [{ id: 'branch-main', name: 'MAIN' }, { id: 'branch-b', name: 'SECOND' }], activeBranchId: null, requiresSelection: true,
    } });
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    try {
      render(<UserProvider><BeautyRuntimeBranchSelector enabled /><BookingModal isOpen onClose={jest.fn()} preselectedCustomer={customer} /></UserProvider>);
      fireEvent.click(await screen.findByLabelText('Chọn chi nhánh hoạt động'));
      fireEvent.click(await screen.findByText('SECOND'));
      await waitFor(() => expect(screen.getByLabelText('Chọn chi nhánh hoạt động')).toHaveTextContent('SECOND'));
      expect(selectBeautyRuntimeBranch).toHaveBeenCalledWith('branch-b');
      fireEvent.click(await screen.findByTestId('booking-package-option'));
      fireEvent.click(screen.getByTestId('booking-submit-button'));
      await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1));
      expect((createBooking as jest.Mock).mock.calls[0][0].metadata.branch_id).toBe('branch-b');
    } finally { get.mockRestore(); set.mockRestore(); }
  });

  it('blocks submit while the sidebar selection is awaiting authorization', async () => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ id: 'tenant', product_key: 'bella_nail' });
    (getBeautyRuntimeBranchContext as jest.Mock).mockResolvedValueOnce({ success: true, data: {
      branches: [{ id: 'branch-main', name: 'MAIN' }, { id: 'branch-b', name: 'SECOND' }], activeBranchId: 'branch-main', requiresSelection: false,
    } });
    let finish: (value: unknown) => void = () => {};
    (selectBeautyRuntimeBranch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<UserProvider><BeautyRuntimeBranchSelector enabled /><BookingModal isOpen onClose={jest.fn()} preselectedCustomer={customer} /></UserProvider>);
    fireEvent.click(await screen.findByLabelText('Chọn chi nhánh hoạt động'));
    const option = await screen.findByText('SECOND');
    fireEvent.click(option);
    fireEvent.click(option);
    expect(selectBeautyRuntimeBranch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText('Chọn chi nhánh hoạt động')).toBeDisabled());
    fireEvent.click(await screen.findByTestId('booking-package-option'));
    fireEvent.click(screen.getByTestId('booking-submit-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(createBooking).not.toHaveBeenCalled();
    finish({ success: true, data: { activeBranchId: 'branch-b' } });
    await waitFor(() => expect(screen.getByLabelText('Chọn chi nhánh hoạt động')).toHaveTextContent('SECOND'));
  });

  it.each(['bella_haircut', 'beauty_spa'])('preserves the existing payload for %s', async product => {
    (getCachedTenantSettings as jest.Mock).mockResolvedValue({ product_key: product });
    window.localStorage.setItem('bella.beauty.active_branch.v1', 'stale-selection');
    expect((await submit()).metadata).toEqual({ gift_sessions: 0 });
  });
});
