/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Customers from '../customers/page';
import Contracts from '../contracts/page';
import Documents from '../documents/page';
import Leads from '../leads/page';
import Support from '../support/page';
import Schedules from '../schedules/page';
import Marketing from '../marketing/page';
import Reports from '../reports/page';
import Analytics from '../bi-analytics/page';
import Admin from '../admin/page';
import Projects from '../projects/page';
import GlobalSearch from '../global-search/page';
import { PeopleDirectoryPage } from '@/modules/real_estate/components/PeopleDirectoryPage';
import { OrgChartPage } from '@/modules/real_estate/components/OrgChartPage';
import { HRDirectoryPage } from '@/modules/real_estate/components/HRDirectoryPage';
import { CEODashboardCharts } from '@/modules/real_estate/components/CEODashboardCharts';
import { downloadLandCsv, inDateRange, matchesBudgetRange } from '@/modules/real_estate/components/LandUiControls';

// These are presentation tests. Every business/network boundary is replaced;
// no result here proves persistence, RLS, native Agent Flow or browser E2E.
const mockProjects = jest.fn();
const mockProducts = jest.fn();
const mockCreateProject = jest.fn();
const mockInvestors = jest.fn();
const mockSearch = jest.fn();
const mockSearchFilter = jest.fn();
const mockEmployees = jest.fn();
const mockProfile = jest.fn();
const mockContract = jest.fn();
const mockPush = jest.fn();
const mockToast = { success: jest.fn(), info: jest.fn(), error: jest.fn() };

jest.mock('sonner', () => ({ toast: {
  success: (...args: unknown[]) => mockToast.success(...args),
  info: (...args: unknown[]) => mockToast.info(...args),
  error: (...args: unknown[]) => mockToast.error(...args),
} }));
jest.mock('@/modules/real_estate/actions/projectActions', () => ({
  fetchProjectsAction: () => mockProjects(), createProjectAction: (...args: unknown[]) => mockCreateProject(...args),
}));
jest.mock('@/modules/real_estate/actions/productActions', () => ({ fetchProductsAction: (id: string) => mockProducts(id) }));
jest.mock('@/modules/real_estate/actions/investorActions', () => ({ fetchInvestorsAction: () => mockInvestors() }));
jest.mock('@/modules/real_estate/actions/hrActions', () => ({
  listActiveEmployeesAction: (...args: unknown[]) => mockEmployees(...args),
  getEmployeeProfileAction: (...args: unknown[]) => mockProfile(...args),
  getActiveContractAction: (...args: unknown[]) => mockContract(...args),
}));
jest.mock('@/modules/real_estate/utils/exportUtils', () => ({
  downloadPdfReport: () => { throw new Error('SYNTHETIC_EXPORT_FORBIDDEN'); },
  downloadCsvReport: () => { throw new Error('SYNTHETIC_EXPORT_FORBIDDEN'); },
}));
jest.mock('@/core/hooks/useTenantContext', () => ({ TenantContextContext: React.createContext({ tenantId: 'test-tenant' }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), useSearchParams: () => new URLSearchParams() }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({
  from: (table: string) => {
    if (!['real_estate_projects', 'real_estate_products'].includes(table)) throw new Error(`UNEXPECTED_TABLE:${table}`);
    const chain = { select: () => chain, or: (filter: string) => { mockSearchFilter(table, filter); return chain; }, limit: () => mockSearch(table) };
    return chain;
  },
}) }));
jest.mock('@/components/ui/PremiumSelect', () => ({
  PremiumSelect: ({ options, value, onChange, placeholder, ariaLabel, disabled }: {
    options: { value: string; label: string }[]; value: string; onChange: (value: string) => void;
    placeholder?: string; ariaLabel?: string; disabled?: boolean;
  }) => <select disabled={disabled} aria-label={ariaLabel || placeholder || options[0]?.label} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}));
jest.mock('framer-motion', () => {
  const component = (tag: 'div' | 'button' | 'tr') => function Motion({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, layout: _layout, whileHover: _hover, whileTap: _tap, ...props }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) {
    return React.createElement(tag, props, children);
  };
  return { AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, motion: { div: component('div'), button: component('button'), tr: component('tr') } };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProjects.mockReset().mockResolvedValue({ success: true, data: [] });
  mockProducts.mockReset().mockResolvedValue({ success: true, data: [] });
  mockCreateProject.mockReset().mockRejectedValue(new Error('WRITES_FORBIDDEN'));
  mockInvestors.mockReset().mockResolvedValue({ success: true, data: [] });
  mockSearch.mockReset().mockResolvedValue({ data: [], error: null });
  mockEmployees.mockReset().mockResolvedValue({ success: true, employees: [] });
  mockProfile.mockReset().mockResolvedValue({ success: false, error: 'NO_PROFILE' });
  mockContract.mockReset().mockResolvedValue({ success: true, contract: null });
  localStorage.clear();
});
afterEach(() => { cleanup(); jest.useRealTimers(); });

test.each([
  ['customers', Customers], ['contracts', Contracts], ['documents', Documents], ['leads', Leads],
  ['support', Support], ['schedules', Schedules], ['marketing', Marketing], ['reports', Reports],
  ['analytics', Analytics], ['admin', Admin], ['people', PeopleDirectoryPage], ['org', OrgChartPage],
])('%s identifies sample data without contacting business services', (_name, Page) => {
  render(<Page />);
  expect(screen.getByRole('note')).toHaveTextContent('Dữ liệu minh họa');
  expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
  expect(mockProjects).not.toHaveBeenCalled();
  expect(mockSearch).not.toHaveBeenCalled();
  expect(mockToast.success).not.toHaveBeenCalled();
});

test('customer grid uses the filtered customer set and hides a removed selection', () => {
  render(<Customers />);
  const search = screen.getByPlaceholderText(/Tìm.*tên.*SĐT/i);
  const firstRow = within(screen.getAllByRole('table')[0]).getAllByRole('row')[1];
  fireEvent.click(within(firstRow).getByRole('radio'));
  fireEvent.change(search, { target: { value: 'NO_MATCH_12345' } });
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Lưới khách hàng' }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('Không có khách hàng phù hợp.')).toBeInTheDocument();
  fireEvent.change(search, { target: { value: '' } });
  expect(screen.getByRole('region', { name: 'Lưới khách hàng' }).querySelectorAll('button').length).toBeGreaterThan(0);
});

test('page size and next/previous actually replace customer rows', () => {
  render(<Customers />);
  fireEvent.change(screen.getByRole('combobox', { name: '5 / trang' }), { target: { value: '5' } });
  const before = within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1).map(row => row.textContent);
  expect(before.length).toBe(5);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  const after = within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1).map(row => row.textContent);
  expect(after).not.toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
  expect(within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1).map(row => row.textContent)).toEqual(before);
});

test.each([['contracts', Contracts], ['documents', Documents], ['support', Support]])('%s has a safe empty result after search', (_name, Page) => {
  render(<Page />);
  const search = screen.getAllByRole('textbox').find(input => /Tìm/i.test(input.getAttribute('placeholder') || ''));
  expect(search).toBeDefined();
  fireEvent.change(search!, { target: { value: 'NO_MATCH_12345' } });
  expect(screen.getByRole('navigation', { name: 'Phân trang' })).toHaveTextContent('0 kết quả');
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
});

test('document date filter consumes the selected period', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-18T10:00:00+07:00'));
  render(<Documents />);
  const before = screen.getAllByRole('row').length;
  fireEvent.change(screen.getByRole('combobox', { name: 'Thời gian' }), { target: { value: 'month' } });
  expect(screen.getAllByRole('row').length).toBeLessThan(before);
  fireEvent.change(screen.getByRole('combobox', { name: 'Thời gian' }), { target: { value: 'all' } });
  expect(screen.getAllByRole('row').length).toBe(before);
});

test('report creation and download cannot claim that a file was saved', () => {
  render(<Reports />);
  fireEvent.click(screen.getByRole('button', { name: /Tạo báo cáo mới/ }));
  fireEvent.click(screen.getAllByTitle('Tải tệp PDF')[0]);
  expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining('chưa khả dụng'));
  expect(mockToast.success).not.toHaveBeenCalled();
  expect(screen.getAllByRole('combobox').every(select => (select as HTMLSelectElement).disabled)).toBe(true);
});

test('project read rejection exits loading and offers a retry', async () => {
  mockProjects.mockRejectedValueOnce(new Error('OFFLINE'));
  render(<Projects />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(mockProjects).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByText('Không có dự án phù hợp.')).toBeInTheDocument();
});

test('failed inventory remains unknown and never contributes fabricated units', async () => {
  mockProjects.mockResolvedValue({ success: true, data: [{ id: 'a', name: 'Actual project', status: 'on_sale' }] });
  mockProducts.mockRejectedValue(new Error('OFFLINE'));
  render(<Projects />);
  await screen.findByText(/Một số dữ liệu kho căn chưa tải được/);
  expect(screen.getAllByText('Actual project').length).toBeGreaterThan(0);
  expect(screen.queryByText('1,200')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bản đồ dự án' }));
  expect(screen.getByText(/Chưa có tọa độ dự án được xác minh/)).toBeInTheDocument();
});

test('global search clear cancels a pending debounce', async () => {
  jest.useFakeTimers();
  render(<GlobalSearch />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(mockSearch).not.toHaveBeenCalled();
  expect(screen.queryByText(/Không tìm thấy/)).not.toBeInTheDocument();
});

test('stale global search cannot restore results after clear', async () => {
  jest.useFakeTimers();
  const pending = deferred<{ data: { id: string; name: string; status: string }[]; error: null }>();
  mockSearch.mockImplementation((table: string) => table === 'real_estate_projects' ? pending.promise : Promise.resolve({ data: [], error: null }));
  render(<GlobalSearch />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
  await act(async () => { jest.advanceTimersByTime(400); });
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  await act(async () => { pending.resolve({ data: [{ id: 'a', name: 'OLD_RESULT', status: 'planning' }], error: null }); });
  expect(screen.queryByText('OLD_RESULT')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('partial search failure stays explicit; lead shortcut opens leads', async () => {
  jest.useFakeTimers();
  render(<GlobalSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Lead cục bộ' }));
  expect(mockPush).toHaveBeenCalledWith('/dashboard/real-estate/leads');
  mockSearch.mockResolvedValue({ data: null, error: { message: 'DENIED' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(screen.getByRole('alert')).toHaveTextContent('chưa đầy đủ');
  expect(screen.queryByText(/Không tìm thấy kết quả/)).not.toBeInTheDocument();
});

test.each([
  ['văn phòng', 'product_type.eq.office'], ['giữ chỗ', 'status.in.(booked,held)'], ['cọc', 'status.eq.deposited'],
])('search %s uses existing enum values and text operators on text columns', async (query, expected) => {
  jest.useFakeTimers();
  render(<GlobalSearch />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: query } });
  await act(async () => { jest.advanceTimersByTime(400); });
  const filter = mockSearchFilter.mock.calls.find(([table]) => table === 'real_estate_products')?.[1];
  expect(filter).toContain(expected);
  expect(filter).not.toMatch(/product_type\.ilike|status\.eq\.(reserved|sold)/);
  if (query === 'giữ chỗ') expect(filter).not.toContain('deposited');
});

// PostgREST's quoted filter grammar escapes both quotes and backslashes.
// The decoded value must still retain PostgreSQL LIKE's own literal escapes.
// https://docs.postgrest.org/en/v12/references/api/url_grammar.html#reserved-characters
test.each([
  [String.raw`A\B`, String.raw`%A\\B%`],
  [String.raw`A\"B`, String.raw`%A\\"B%`],
  ['A%B_C', String.raw`%A\%B\_C%`],
  [String.raw`A\%_"B`, String.raw`%A\\\%\_"B%`],
  ['A",status.eq.paid),or(id.not.is.null', '%A",status.eq.paid),or(id.not.is.null%'],
  ['Đường, block (A): tầng 2', '%Đường, block (A): tầng 2%'],
])('quoted search preserves literal input %s inside a single filter value', async (query, expectedPattern) => {
  jest.useFakeTimers();
  render(<GlobalSearch />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: query } });
  await act(async () => { jest.advanceTimersByTime(400); });
  const quotedPattern = JSON.stringify(expectedPattern);
  expect(mockSearchFilter).toHaveBeenCalledWith('real_estate_projects', `name.ilike.${quotedPattern},code.ilike.${quotedPattern}`);
  expect(mockSearchFilter).toHaveBeenCalledWith('real_estate_products', `product_code.ilike.${quotedPattern}`);
});

test('support date range filters rows and can be cleared', () => {
  render(<Support />);
  const before = screen.getByRole('navigation', { name: 'Phân trang' }).textContent;
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả thời gian' }));
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2099-01-01' } });
  expect(screen.getByRole('navigation', { name: 'Phân trang' })).toHaveTextContent('0 kết quả');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa thời gian' }));
  expect(screen.getByRole('navigation', { name: 'Phân trang' }).textContent).toEqual(before);
});

test('org search and right tabs stay bound to the selected unit', () => {
  render(<OrgChartPage />);
  const input = screen.getAllByRole('textbox').find(element => /Tìm.*đơn vị/i.test(element.getAttribute('placeholder') || ''));
  expect(input).toBeDefined();
  fireEvent.change(input!, { target: { value: 'NO_MATCH_12345' } });
  expect(screen.getByText('Không có đơn vị phù hợp.')).toBeInTheDocument();
  fireEvent.change(input!, { target: { value: 'Bình Dương' } });
  const results = screen.getByLabelText('Kết quả đơn vị');
  fireEvent.click(within(results).getAllByRole('button')[0]);
  expect(screen.queryByText('Shophouse Marina, TP. Nha Trang')).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading').some(heading => heading.textContent?.includes('Bình Dương'))).toBe(true);
});

test('HR list rejection is visible rather than retaining stale rows', async () => {
  mockEmployees.mockRejectedValue(new Error('LIST_FAILED'));
  render(<HRDirectoryPage />);
  expect(await screen.findByText(/LIST_FAILED/)).toBeInTheDocument();
  expect(mockEmployees).toHaveBeenCalledTimes(1);
});

test('late employee A details cannot overwrite selected employee B', async () => {
  const a = deferred<unknown>();
  const b = deferred<unknown>();
  const employees = ['a', 'b'].map(personId => ({ personId, displayName: `Employee ${personId}`, departmentName: 'QA', employmentStatus: 'active', employmentType: 'full_time' }));
  mockEmployees.mockResolvedValue({ success: true, employees });
  mockProfile.mockImplementation(({ personId }: { personId: string }) => personId === 'a' ? a.promise : b.promise);
  render(<HRDirectoryPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Employee a/ }));
  fireEvent.click(screen.getByRole('button', { name: /Employee b/ }));
  await act(async () => { b.resolve({ success: true, profile: employees[1] }); });
  expect(screen.getByRole('heading', { name: 'Employee b' })).toBeInTheDocument();
  await act(async () => { a.resolve({ success: true, profile: employees[0] }); });
  expect(screen.queryByRole('heading', { name: 'Employee a' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Employee b' })).toBeInTheDocument();
});

test('lead drawer tabs expose the selected lead history and retain read-only notes', () => {
  render(<Leads />);
  const tabs = screen.getByRole('tablist', { name: 'Chi tiết lead' });
  fireEvent.click(within(tabs).getByRole('tab', { name: 'Lịch sử' }));
  expect(within(tabs).getByRole('tab', { name: 'Lịch sử' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('Nhu cầu & dự án')).not.toBeInTheDocument();
  fireEvent.click(within(tabs).getByRole('tab', { name: 'Ghi chú' }));
  const note = screen.getByPlaceholderText('Thêm ghi chú...');
  expect(note).toHaveAttribute('readonly');
});

test('overview inventory preserves zero instead of fabricated fallback units', () => {
  render(<CEODashboardCharts totalProductsCount={0} availableCount={0} reservedCount={0} depositedCount={0} signedCount={0} paidCount={0} deliveredCount={0} units={[]} selectedProjectName="Empty project" />);
  expect(screen.getByText('Tổng: 0 căn')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Ma trận kho căn' })).getByText('Chưa có căn hộ phù hợp.')).toBeInTheDocument();
  expect(screen.queryByText('CH-501')).not.toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent('dữ liệu minh họa');
});

test('overview floor selector and inventory navigation use actual rows/project ID', () => {
  render(<CEODashboardCharts totalProductsCount={2} availableCount={1} reservedCount={1} depositedCount={0} signedCount={0} paidCount={0} deliveredCount={0} selectedProjectId="project-a" units={[
    { id: 'a', product_code: 'REAL-A', floor: '1', status: 'available' },
    { id: 'b', product_code: 'REAL-B', floor: '2', status: 'booked' },
  ]} />);
  const matrix = screen.getByRole('region', { name: 'Ma trận kho căn' });
  fireEvent.change(within(matrix).getByRole('combobox', { name: 'Tầng ma trận tổng quan' }), { target: { value: '2' } });
  expect(within(matrix).queryByText('REAL-A')).not.toBeInTheDocument();
  fireEvent.click(within(matrix).getByRole('button', { name: /REAL-B/ }));
  expect(mockPush).toHaveBeenCalledWith('/dashboard/real-estate/apartments?projectId=project-a');
});

test('date and budget filters handle current quarter, boundaries and unknown values', () => {
  const now = new Date(2026, 9, 18);
  expect(inDateRange('18/10/2026', 'today', now)).toBe(true);
  expect(inDateRange('30/09/2026', 'quarter', now)).toBe(false);
  expect(inDateRange('Chưa ký', 'month', now)).toBe(false);
  expect(matchesBudgetRange('3.0 – 5.0 tỷ', '3-5')).toBe(true);
  expect(matchesBudgetRange('10 – 20 tỷ', '3-5')).toBe(false);
  expect(matchesBudgetRange('Chưa cập nhật', '3-5')).toBe(false);
});

test('CSV exports provided rows with quoting, no synthetic rows and formula protection', async () => {
  let blob: Blob | undefined;
  const create = jest.fn((value: Blob) => { blob = value; return 'blob:test'; });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  downloadLandCsv('actual.csv', [{ code: '=1+1', name: 'A,"B"', price: 0 }]);
  expect(click).toHaveBeenCalledTimes(1);
  const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob!); });
  expect(text).toContain('"\'=1+1"');
  expect(text).toContain('"A,""B"""');
  expect(text).toContain('"0"');
  expect(text).not.toContain('Item_');
  expect(document.querySelector('a[download]')).toBeNull();
  click.mockRestore();
});
