/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import CustomerDetailPage from '@/app/dashboard/customers/[id]/page';
import { babyCareCustomer, babyCareEditData } from './fixtures/babycare-customer';

jest.mock('next/dynamic', () => () => function EmptyDynamicComponent() { return null; });
jest.mock('@/components/common/PaymentReceiptTemplate', () => ({ PaymentReceiptTemplate: () => null }));
jest.mock('@/services/customer-actions', () => ({ geocodeAddress: jest.fn() }));
jest.mock('@/lib/user-context', () => ({ useUser: () => mockUserContext }));
jest.mock('@/app/dashboard/customers/[id]/useCustomerDetailController', () => ({ useCustomerDetailController: () => mockController }));

const noop = () => {};
const editCustomer = jest.fn();
const mockUserContext = { product: { productKey: 'bella_babycare' }, isLoading: false };
const mockController = {
  customer: babyCareCustomer(), activeBooking: null, loading: false,
  tenantModuleKey: 'babycare', userRole: 'admin', activeDepositAmount: 0, activeNetPrice: 0,
  ktvs: [], selectedBookingIds: new Set<string>(), sortedSessions: [], isCombineMode: false,
  handleOpenEditCustomer: editCustomer, handleBack: noop, handleOpenSessions: noop,
  handleOpenBookingSessions: noop, handleOpenZalo: noop, handleSharePortal: noop, setIsBookingModalOpen: noop,
  isBookingModalOpen: false, isEditModalOpen: false, isPaymentModalOpen: false, isEditBookingModalOpen: false,
  editData: babyCareEditData,
  editBookingData: { full_price: 0, discount_percent: 0, start_date: '', preferred_time: '', gift_sessions: 0, total_sessions: 0, completed_sessions: 0, package_name: '', deposit_amount: 0, status: 'in_progress' },
};

beforeEach(() => {
  mockUserContext.product.productKey = 'bella_babycare';
  editCustomer.mockClear();
});

it('switches BabyCare tabs to their actual content and notes edit action', () => {
  render(<CustomerDetailPage />);
  fireEvent.click(screen.getByRole('tab', { name: 'Hồ sơ mẹ và bé' }));
  expect(screen.getByText('Thông tin mẹ và bé')).toBeInTheDocument();
  expect(screen.queryByText('Buổi tiếp theo')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Ghi chú (0)' }));
  expect(screen.queryByText('Thông tin mẹ và bé')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
  expect(editCustomer).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Khách thanh toán nốt gói dịch vụ.')).not.toBeInTheDocument();
});

it('does not infer BabyCare UI from enabled module when Product Identity is Beauty', () => {
  mockUserContext.product.productKey = 'bella_spa';
  render(<CustomerDetailPage />);
  expect(screen.getByText('Thông tin khách hàng')).toBeInTheDocument();
  expect(screen.queryByText('Thông tin mẹ và bé')).not.toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});
