/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import Facilities from '../facilities/page';
import Grades from '../grades/page';
import Finance from '../finance/page';

jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: { id: 'synthetic-admin', tenant_id: 'synthetic-tenant' }, product: { productKey: 'bella_preschool' }, isLoading: false }) }));
jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_SETTINGS'); } }));
jest.mock('@supabase/supabase-js', () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_DB'); });
jest.mock('@/lib/supabase-client', () => { throw new Error('HELD_WORKSPACE_MUST_NOT_LOAD_CALLER_DB'); });
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href}>{children}</a> }));

it('renders learning workspace with sample-data disclaimer; live fetch is attempted but UI stays in demo mode on failure', () => {
  // Grades page now calls /api/education/grades on mount (live data integration).
  // The fetch mock rejects — isLiveLoaded stays false → demo banner persists.
  const fetchMock = jest.fn(() => Promise.reject(new Error('NETWORK_UNAVAILABLE_IN_TEST')));
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  render(<Grades />);
  expect(screen.getByRole('heading', { name: 'Học Tập & Phát Triển Mầm Non' })).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(/Dữ liệu minh họa/);
  expect(screen.getByRole('note')).toHaveTextContent(/chưa được tải từ hồ sơ thật/);
  // loadGradesData() is called on mount — one fetch call is expected.
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/education/grades'),
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('keeps facilities read-only until verified data and APIs are available', () => {
  const fetchMock = jest.fn();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  render(<Facilities />);
  expect(screen.getByRole('heading', { name: 'Cơ sở vật chất & Tài sản' })).toBeInTheDocument();
  expect(screen.getByText('Quản lý thiết bị, bảo trì, an toàn và kiểm định định kỳ')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Khởi Tạo Cơ Sở Vật Chất Mẫu/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Báo Cáo Sự Cố An Toàn/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Danh Mục Tài Sản/ }));
  expect(screen.getByRole('table')).toHaveTextContent('Chưa có danh mục tài sản đã xác minh.');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('restores the finance layout with commands disabled before a successful canonical read', () => {
  const fetchMock = jest.fn(() => new Promise<Response>(() => undefined));
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  render(<Finance />);
  expect(screen.getByRole('heading', { name: /Tài chính & Học phí/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Lập hóa đơn/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Ghi nhận thanh toán/ })).toBeDisabled();
  expect(screen.getByText('Chưa xác minh')).toBeInTheDocument();
  expect(screen.getByText('Chưa có dữ liệu tài chính đã xác minh để hiển thị nội dung nghiệp vụ.')).toBeInTheDocument();
  expect(screen.queryByText('Không có công nợ tồn đọng theo lớp.')).not.toBeInTheDocument();
});
