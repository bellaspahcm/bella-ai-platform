/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ApartmentsPage from '../apartments/page';
import DashboardPage from '../page';
import type { Database } from '@/types/database.types';

// Oracles: approved slice gate §6 and D02/D04/D10–D12. These are UI
// projection fixtures, not evidence of persistence, RLS or commercial policy.
type Project = Pick<Database['public']['Tables']['real_estate_projects']['Row'], 'id' | 'name' | 'location'>;
type Unit = Pick<Database['public']['Tables']['real_estate_products']['Row'],
  'id' | 'project_id' | 'product_code' | 'status' | 'block' | 'floor' |
  'area' | 'unit_price' | 'product_type' | 'direction' | 'owner_name'>;
type ReadResult<T> = { success: boolean; data?: T[]; error?: string };
const mockProjects = jest.fn<Promise<ReadResult<Project>>, []>();
const mockProducts = jest.fn<Promise<ReadResult<Unit>>, [string]>();
const mockUpdateStatus = jest.fn();
const mockCreateProduct = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

jest.mock('@/modules/real_estate/actions/projectActions', () => ({
  fetchProjectsAction: () => mockProjects(),
}));
jest.mock('@/modules/real_estate/actions/productActions', () => ({
  fetchProductsAction: (id: string) => mockProducts(id),
  updateProductStatusAction: (...args: unknown[]) => mockUpdateStatus(...args),
  createProductAction: (...args: unknown[]) => mockCreateProduct(...args),
}));
jest.mock('sonner', () => ({ toast: {
  success: (...args: unknown[]) => mockToast.success(...args),
  error: (...args: unknown[]) => mockToast.error(...args),
  info: (...args: unknown[]) => mockToast.info(...args),
} }));
jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: null }) }));
jest.mock('@/core/hooks/useTenantContext', () => ({ useTenantContext: () => ({ tenantId: null }) }));

// Replace the entire notification client boundary, including its write path.
const mockNotificationLimit = jest.fn().mockResolvedValue({ data: [], error: null });
const mockNotificationEq = jest.fn().mockResolvedValue({ error: null });
const mockNotificationUpdate = jest.fn(() => ({ eq: mockNotificationEq }));
const mockNotificationFrom = jest.fn((table: string) => {
  if (table !== 'app_notifications') throw new Error(`Unexpected table: ${table}`);
  return {
    select: () => ({ order: () => ({ limit: mockNotificationLimit }) }),
    update: mockNotificationUpdate,
  };
});
jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({ from: mockNotificationFrom }) }));

type ChartProps = {
  totalProductsCount: number; availableCount: number; reservedCount: number;
  depositedCount: number; signedCount: number; paidCount: number; deliveredCount: number;
  selectedProjectName: string;
};
jest.mock('@/modules/real_estate/components/CEODashboardCharts', () => ({
  CEODashboardCharts: (props: ChartProps) => (
    <section aria-label="Dữ liệu biểu đồ">
      <p>{props.selectedProjectName}</p>
      <span aria-label="Số liệu căn">{JSON.stringify([
        props.totalProductsCount, props.availableCount, props.reservedCount,
        props.depositedCount, props.signedCount, props.paidCount, props.deliveredCount,
      ])}</span>
    </section>
  ),
}));
jest.mock('@/components/ui/PremiumSelect', () => ({
  PremiumSelect: ({ options, value, onChange, placeholder }: {
    options: { value: string; label: string }[]; value: string;
    onChange: (value: string) => void; placeholder?: string;
  }) => (
    <select aria-label={placeholder || options[0]?.label} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Chọn</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} onClick={onClick}>{children}</div>
    ),
  },
}));

const projects: Project[] = [
  { id: 'project-a', name: 'Dự án A', location: 'Vị trí A' },
  { id: 'project-b', name: 'Dự án B', location: 'Vị trí B' },
];
const unitA: Unit = {
  id: 'unit-a', project_id: 'project-a', product_code: 'A-REAL', status: 'available',
  block: 'A', floor: '1', area: 72, unit_price: 0, product_type: 'apartment',
  direction: 'Đông', owner_name: 'Chủ từ dữ liệu đọc',
};
const unitB: Unit = { ...unitA, id: 'unit-b', project_id: 'project-b', product_code: 'B-REAL', status: 'booked' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNotificationLimit.mockReset().mockResolvedValue({ data: [], error: null });
  mockProjects.mockReset().mockResolvedValue({ success: true, data: projects });
  mockProducts.mockReset().mockImplementation(async id => ({ success: true, data: id === 'project-a' ? [unitA] : [unitB] }));
  window.history.replaceState({}, '', '/dashboard/real-estate');
});

afterEach(() => {
  cleanup();
  expect(mockUpdateStatus).not.toHaveBeenCalled();
  expect(mockCreateProduct).not.toHaveBeenCalled();
});

test('detail reads the selected unit without deposit, owner or import mutation', async () => {
  render(<ApartmentsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
  const detail = screen.getByRole('region', { name: 'Chi tiết căn hộ' });
  expect(within(detail).getByText('Thông tin chỉ đọc')).toBeInTheDocument();
  expect(within(detail).getByText('Chủ từ dữ liệu đọc')).toBeInTheDocument();
  expect(within(detail).getByText('72 m²')).toBeInTheDocument();
  expect(within(detail).getByText('0')).toBeInTheDocument();
  expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(detail).getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nhập căn thực tế' }));
  expect(screen.getByText(/Nhập căn hàng loạt chưa khả dụng/)).toHaveTextContent('Không có căn nào được tạo hoặc lưu.');
  expect(screen.getByRole('button', { name: 'Khai Báo Căn — chưa khả dụng' })).toBeDisabled();
  expect(screen.queryByRole('textbox', { name: /giá|tenant|căn/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Khai Báo Căn — chưa khả dụng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Đóng', exact: true }));
  expect(mockProducts).toHaveBeenCalledTimes(1);
  expect(mockToast.success).not.toHaveBeenCalled();
});

// Task contract: dismissal changes only modal visibility; import remains unavailable.
describe.each(['Ma trận', 'Danh sách'])('%s import modal dismissal', mode => {
  test.each(['Escape', 'close button', 'header close', 'outside click'])('%s preserves read-only page state', async method => {
    window.history.replaceState({}, '', '?projectId=project-b');
    const target = { ...unitB, id: 'selected-unit', product_code: 'MATCH-SELECTED', unit_price: 4_000_000_000 };
    mockProducts.mockResolvedValue({ success: true, data: [
      { ...target, id: 'first-unit', product_code: 'MATCH-FIRST' },
      target,
      { ...target, id: 'other-status', product_code: 'MATCH-AVAILABLE', status: 'available' },
    ] });
    render(<ApartmentsPage />);
    await screen.findByRole('button', { name: 'Xem chi tiết' });
    fireEvent.click(screen.getByRole('button', { name: mode }));
    fireEvent.change(screen.getByPlaceholderText('Tìm mã căn...'), { target: { value: 'MATCH' } });
    const filters = [['Tất cả tòa', 'A'], ['Tất cả tầng', '1'], ['Tất cả loại căn', 'apartment'], ['Khoảng giá', '3-5']];
    for (const [name, value] of filters) fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /Giữ chỗ/ }));
    fireEvent.click(screen.getByRole('button', { name: mode === 'Ma trận' ? 'MATCH-SELECTED 72 m²' : 'MATCH-SELECTED', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));

    const assertPageState = () => {
      expect(screen.getByRole('combobox', { name: 'Đổi dự án...' })).toHaveValue('project-b');
      expect(screen.getByRole('heading', { name: 'Dự án B' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByPlaceholderText('Tìm mã căn...')).toHaveValue('MATCH');
      for (const [name, value] of filters) expect(screen.getByRole('combobox', { name })).toHaveValue(value);
      expect(screen.queryByText('MATCH-AVAILABLE')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'MATCH-SELECTED' })).toBeInTheDocument();
      const detail = screen.getByRole('region', { name: 'Chi tiết căn hộ' });
      expect(within(detail).getByText('MATCH-SELECTED')).toBeInTheDocument();
      expect(within(detail).getByText('4.000.000.000')).toBeInTheDocument();
      expect(within(detail).getByText('Chủ từ dữ liệu đọc')).toBeInTheDocument();
      expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
      if (mode === 'Danh sách') expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
      else expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(mockProjects).toHaveBeenCalledTimes(1);
      expect(mockProducts).toHaveBeenCalledTimes(1);
      expect(mockProducts).toHaveBeenCalledWith('project-b');
      expect(mockUpdateStatus).not.toHaveBeenCalled();
      expect(mockCreateProduct).not.toHaveBeenCalled();
      expect(mockNotificationFrom).not.toHaveBeenCalled();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
      for (const toast of Object.values(mockToast)) expect(toast).not.toHaveBeenCalled();
    };

    // Escape while already closed must not clear filters, selection or detail.
    fireEvent.keyDown(document, { key: 'Escape' });
    assertPageState();
    for (let opening = 0; opening < 2; opening++) {
      fireEvent.click(screen.getByRole('button', { name: 'Nhập căn thực tế' }));
      const heading = screen.getByRole('heading', { name: 'Khai Báo Căn Thực Tế Nhanh' });
      const modal = heading.parentElement!.parentElement!.parentElement!;
      const unavailable = within(modal).getByRole('button', { name: 'Khai Báo Căn — chưa khả dụng' });
      expect(unavailable).toBeDisabled();
      expect(within(modal).getByRole('status')).toHaveTextContent('Không có căn nào được tạo hoặc lưu.');
      fireEvent.click(unavailable);
      fireEvent.click(heading);
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(heading).toBeInTheDocument();
      if (method === 'Escape') fireEvent.keyDown(within(modal).getByRole('button', { name: 'Đóng', exact: true }), { key: 'Escape' });
      else if (method === 'close button') fireEvent.click(within(modal).getByRole('button', { name: 'Đóng', exact: true }));
      else if (method === 'header close') fireEvent.click(within(modal).getByRole('button', { name: '', exact: true }));
      else fireEvent.click(modal.parentElement!);
      expect(screen.queryByRole('heading', { name: 'Khai Báo Căn Thực Tế Nhanh' })).not.toBeInTheDocument();
      assertPageState();
      fireEvent.keyDown(document, { key: 'Escape' });
      assertPageState();
    }
  });
});

const pages = [
  { name: 'apartments', Component: ApartmentsPage },
  { name: 'dashboard', Component: DashboardPage },
];

test('list renders read-model rows, selects read-only detail and restores the matrix selection', async () => {
  const second = { ...unitA, id: 'unit-second', product_code: 'A-SECOND', floor: '2', area: 85 };
  mockProducts.mockResolvedValue({ success: true, data: [unitA, second, unitB] });
  render(<ApartmentsPage />);
  await screen.findByRole('button', { name: 'Xem chi tiết' });
  const list = screen.getByRole('button', { name: 'Danh sách' });
  const matrix = screen.getByRole('button', { name: 'Ma trận' });
  fireEvent.click(list);
  const table = screen.getByRole('table', { name: 'Danh sách căn hộ' });
  expect(within(table).getAllByRole('row')).toHaveLength(3);
  expect(within(table).getByText('A-REAL')).toBeInTheDocument();
  expect(within(table).queryByText('B-REAL')).not.toBeInTheDocument();
  expect(list).toHaveAttribute('aria-pressed', 'true');
  expect(matrix).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(within(table).getByRole('button', { name: 'A-SECOND' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
  const detail = screen.getByRole('region', { name: 'Chi tiết căn hộ' });
  expect(within(detail).getByText('A-SECOND')).toBeInTheDocument();
  expect(within(detail).getByText('85 m²')).toBeInTheDocument();
  expect(within(detail).getByText('Chủ từ dữ liệu đọc')).toBeInTheDocument();
  expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(detail).getAllByRole('button')).toHaveLength(1);
  fireEvent.click(matrix);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'A-SECOND 85 m²' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Chi tiết căn hộ' })).toBeInTheDocument();
  expect(matrix).toHaveAttribute('aria-pressed', 'true');
  expect(list).toHaveAttribute('aria-pressed', 'false');
  expect(mockProjects).toHaveBeenCalledTimes(1);
  expect(mockProducts).toHaveBeenCalledTimes(1);
  expect(mockUpdateStatus).not.toHaveBeenCalled();
  expect(mockCreateProduct).not.toHaveBeenCalled();
  expect(mockNotificationFrom).not.toHaveBeenCalled();
  expect(mockToast.success).not.toHaveBeenCalled();
});

test('search and filters keep identical unit membership across list and matrix switches', async () => {
  const target = { ...unitA, id: 'target', product_code: 'MATCH-1', product_type: 'apartment', unit_price: 4_000_000_000 };
  mockProducts.mockResolvedValue({ success: true, data: [
    target,
    { ...target, id: 'other-code', product_code: 'OTHER' },
    { ...target, id: 'other-floor', product_code: 'MATCH-2', floor: '2' },
    { ...target, id: 'other-block', product_code: 'MATCH-3', block: 'B' },
    { ...target, id: 'other-status', product_code: 'MATCH-4', status: 'booked' },
    { ...target, id: 'other-type', product_code: 'MATCH-5', product_type: 'villa' },
    { ...target, id: 'other-price', product_code: 'MATCH-6', unit_price: 9_000_000_000 },
  ] });
  render(<ApartmentsPage />);
  await screen.findByRole('button', { name: 'Xem chi tiết' });
  fireEvent.change(screen.getByPlaceholderText('Tìm mã căn...'), { target: { value: 'MATCH' } });
  const filters = [['Tất cả tòa', 'A'], ['Tất cả tầng', '1'], ['Tất cả loại căn', 'apartment'], ['Khoảng giá', '3-5']];
  for (const [name, value] of filters) fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Khả dụng/ }));
  for (const mode of ['Danh sách', 'Ma trận', 'Danh sách']) {
    fireEvent.click(screen.getByRole('button', { name: mode }));
    if (mode === 'Danh sách') {
      const table = screen.getByRole('table', { name: 'Danh sách căn hộ' });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(within(table).getByRole('button', { name: 'MATCH-1' })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'MATCH-1 72 m²' })).toBeInTheDocument();
    }
    for (const code of ['OTHER', 'MATCH-2', 'MATCH-3', 'MATCH-4', 'MATCH-5', 'MATCH-6']) expect(screen.queryByText(code)).not.toBeInTheDocument();
    for (const [name, value] of filters) expect(screen.getByRole('combobox', { name })).toHaveValue(value);
    expect(screen.getByPlaceholderText('Tìm mã căn...')).toHaveValue('MATCH');
    expect(screen.getByRole('combobox', { name: 'Đổi dự án...' })).toHaveValue('project-a');
  }
  expect(mockProducts).toHaveBeenCalledTimes(1);
});

async function selectProject(page: string, id: string) {
  if (page === 'apartments') {
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Đổi dự án...' }), { target: { value: id } });
    });
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Chọn dự án' }));
    const option = screen.getByRole('button', { name: id === 'project-a' ? /Dự án A/ : /Dự án B/ });
    await act(async () => { fireEvent.click(option); });
  }
}

describe.each(pages)('$name project read truth', ({ name, Component }) => {
  test('resolves the link only through accessible projects and rejects foreign units', async () => {
    window.history.replaceState({}, '', '?projectId=project-b');
    mockProducts.mockResolvedValue({ success: true, data: [unitA, unitB] });
    render(<Component />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(mockProducts).toHaveBeenCalledTimes(1);
    expect(mockProducts).toHaveBeenCalledWith('project-b');
    if (name === 'apartments') {
      expect(screen.getByRole('heading', { name: 'B-REAL' })).toBeInTheDocument();
      expect(screen.queryByText('A-REAL')).not.toBeInTheDocument();
    } else {
      expect(screen.getByLabelText('Số liệu căn')).toHaveTextContent('[1,0,1,0,0,0,0]');
    }
  });

  test('invalid projectId cannot silently fall back or query units', async () => {
    window.history.replaceState({}, '', '?projectId=outside-access');
    render(<Component />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Dự án không khả dụng');
    expect(mockProducts).not.toHaveBeenCalled();
    expect(screen.queryByText('A-REAL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dữ liệu biểu đồ')).not.toBeInTheDocument();
  });

  test('empty projects do not invent a project or units', async () => {
    mockProjects.mockResolvedValue({ success: true, data: [] });
    render(<Component />);
    expect(await screen.findByText('Chưa có dự án được truy cập.')).toBeInTheDocument();
    expect(mockProducts).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dữ liệu biểu đồ')).not.toBeInTheDocument();
  });

  test('empty unit reads preserve zero without demo units or dashboard KPIs', async () => {
    mockProducts.mockResolvedValue({ success: true, data: [] });
    render(<Component />);
    expect(await screen.findByText('Chưa có căn hộ nào được khai báo cho dự án này.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).not.toBeInTheDocument();
    if (name === 'dashboard') expect(screen.getByLabelText('Số liệu căn')).toHaveTextContent('[0,0,0,0,0,0,0]');
  });

  test('switch clears detail/data immediately; failed read and retry stay on that project', async () => {
    const pending = deferred<ReadResult<Unit>>();
    mockProducts.mockImplementation(id => id === 'project-a' ? Promise.resolve({ success: true, data: [unitA] }) : pending.promise);
    render(<Component />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    if (name === 'apartments') fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    await selectProject(name, 'project-b');
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(screen.queryByText('A-REAL')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Chi tiết căn hộ' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dữ liệu biểu đồ')).not.toBeInTheDocument();
    await act(async () => pending.reject(new Error('Unit read denied')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unit read denied');
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).not.toBeInTheDocument();
    mockProducts.mockResolvedValue({ success: true, data: [] });
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(await screen.findByText('Chưa có căn hộ nào được khai báo cho dự án này.')).toBeInTheDocument();
    expect(mockProducts).toHaveBeenLastCalledWith('project-b');
  });

  test.each(['success', 'error'])('late %s from A cannot replace B or end its loading state', async outcome => {
    const a = deferred<ReadResult<Unit>>();
    const b = deferred<ReadResult<Unit>>();
    mockProducts.mockImplementation(id => id === 'project-a' ? a.promise : b.promise);
    render(<Component />);
    await waitFor(() => expect(mockProducts).toHaveBeenCalledWith('project-a'));
    await selectProject(name, 'project-b');
    await act(async () => {
      if (outcome === 'success') a.resolve({ success: true, data: [unitA] });
      else a.reject(new Error('Stale failure'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('A-REAL')).not.toBeInTheDocument();
    await act(async () => b.resolve({ success: true, data: [unitB] }));
    if (name === 'apartments') expect(screen.getByRole('heading', { name: 'B-REAL' })).toBeInTheDocument();
    else expect(screen.getByLabelText('Số liệu căn')).toHaveTextContent('[1,0,1,0,0,0,0]');
  });

  test('late A result after B completes cannot replace the current data', async () => {
    const a = deferred<ReadResult<Unit>>();
    mockProducts.mockImplementation(id => id === 'project-a' ? a.promise : Promise.resolve({ success: true, data: [unitB] }));
    render(<Component />);
    await waitFor(() => expect(mockProducts).toHaveBeenCalledWith('project-a'));
    await selectProject(name, 'project-b');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    await act(async () => a.resolve({ success: true, data: [unitA] }));
    if (name === 'apartments') {
      expect(screen.getByRole('heading', { name: 'B-REAL' })).toBeInTheDocument();
      expect(screen.queryByText('A-REAL')).not.toBeInTheDocument();
    } else expect(screen.getByLabelText('Số liệu căn')).toHaveTextContent('[1,0,1,0,0,0,0]');
  });

  test('project read errors expose retry and never query units or show business data', async () => {
    mockProjects.mockResolvedValue({ success: false, error: 'Project read denied' });
    render(<Component />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Project read denied');
    expect(mockProducts).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Dữ liệu biểu đồ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).not.toBeInTheDocument();
    mockProjects.mockResolvedValue({ success: true, data: [] });
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(await screen.findByText('Chưa có dự án được truy cập.')).toBeInTheDocument();
  });
});

test('dashboard notification dropdown is read-only and uses the mocked client', async () => {
  render(<DashboardPage />);
  await screen.findByLabelText('Dữ liệu biểu đồ');
  await waitFor(() => expect(mockNotificationLimit).toHaveBeenCalledWith(5));
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
  expect(mockNotificationFrom).toHaveBeenCalledWith('app_notifications');
  expect(mockNotificationUpdate).not.toHaveBeenCalled();
});

test('dashboard displays returned unread notifications without acknowledging them', async () => {
  mockNotificationLimit.mockResolvedValue({ data: [{ id: 'notice-a', title: 'REAL_NOTICE', message: 'Returned message', is_read: false, created_at: '2026-10-18T00:00:00Z' }], error: null });
  render(<DashboardPage />);
  await waitFor(() => expect(mockNotificationLimit).toHaveBeenCalledWith(5));
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
  expect(await screen.findByText('REAL_NOTICE')).toBeInTheDocument();
  expect(screen.queryByText('Cảnh báo SLA Lead')).not.toBeInTheDocument();
  expect(mockNotificationUpdate).not.toHaveBeenCalled();
});

test('choosing a project during refresh cannot leave refresh permanently disabled', async () => {
  render(<DashboardPage />);
  await screen.findByLabelText('Dữ liệu biểu đồ');
  const pending = deferred<ReadResult<Unit>>();
  mockProducts.mockImplementation(id => id === 'project-a' ? pending.promise : Promise.resolve({ success: true, data: [unitB] }));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
  await waitFor(() => expect(mockProducts).toHaveBeenCalledTimes(2));
  await selectProject('dashboard', 'project-b');
  await screen.findByLabelText('Dữ liệu biểu đồ');
  expect(screen.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeEnabled();
  await act(async () => { pending.resolve({ success: true, data: [unitA] }); });
  expect(screen.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeEnabled();
  expect(screen.getByLabelText('Dữ liệu biểu đồ')).toHaveTextContent('Dự án B');
});
