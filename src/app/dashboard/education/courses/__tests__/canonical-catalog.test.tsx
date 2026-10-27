/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CanonicalClassroomCatalog from '../CanonicalClassroomCatalog';
jest.mock('../classroom-live-data', () => ({ loadClassroomOverview: jest.fn(async () => new Map()) }));

const mockFetch = jest.fn<typeof fetch>();
const course = { id: 'synthetic-course', tenantId: 'synthetic-tenant', title: 'Synthetic class', courseCode: 'SYN-01', status: 'active' };
const body = { success: true, tenantId: 'synthetic-tenant', courses: [course] };
const response = (value: unknown = body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value }) as Response;
const mount = () => render(<CanonicalClassroomCatalog legacy={<p>Existing other Product</p>} />);
beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; mockFetch.mockResolvedValue(response()); });
afterEach(() => { cleanup(); jest.useRealTimers(); });

it('shows loading without claiming an empty catalog or operational zeroes', () => {
  mockFetch.mockReturnValue(new Promise(() => {})); mount();
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  expect(screen.getByText('—')).toBeVisible();
  expect(screen.queryByText(/Chưa có lớp học/)).toBeNull();
  expect(screen.queryByText('0')).toBeNull();
});
it('displays actual catalog identities and enables the exact-class detail route without invented metrics', async () => {
  mount(); expect(await screen.findByRole('heading', { name: 'Synthetic class' })).toBeVisible();
  expect(screen.getByText('Hiển thị 1 / 1 lớp')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Vào lớp học' })).toHaveAttribute('href', '/dashboard/education/courses/synthetic-course');
  expect(within(screen.getByRole('region', { name: 'Thống kê lớp học' })).getAllByText('Chưa được cung cấp')).toHaveLength(3);
  expect(mockFetch).toHaveBeenCalledWith('/api/education/courses/catalog', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
});
it('retains filters and only enables class creation after the canonical catalog is ready', async () => {
  mount(); await screen.findByRole('heading', { name: 'Synthetic class' });
  expect(screen.getByText('Preschool ERP Operations')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mở Lớp Học Mới' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Khối Mầm (—)' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Khối lớp' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Tất cả lớp (1)' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Điểm danh' })).toHaveAttribute('href', '/dashboard/education/attendance?courseId=synthetic-course');
  expect(screen.queryByText('Năm học 2025 - 2026')).toBeNull();
});
it('keeps a genuine validated empty catalog distinct from errors', async () => {
  mockFetch.mockResolvedValue(response({ ...body, courses: [] })); mount();
  expect(await screen.findByText('Chưa có lớp học trong phạm vi được cấp quyền.')).toBeVisible();
  expect(screen.getByText('0')).toBeVisible(); expect(screen.queryByRole('alert')).toBeNull();
});
it.each([401, 403, 500, 503])('shows HTTP %s denial/failure as unavailable, never legacy or empty success', async status => {
  mockFetch.mockResolvedValue(response({ success: false, error: 'DENIED' }, status)); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa thể xác định tổng số lớp');
  expect(screen.queryByText('0')).toBeNull(); expect(screen.queryByText('Existing other Product')).toBeNull();
});
it.each([
  { success: true }, { ...body, tenantId: '' }, { ...body, courses: null },
  { ...body, courses: [course, course] }, { ...body, courses: [{ ...course, tenantId: 'foreign' }] },
  { ...body, courses: [{ ...course, status: 'unexpected' }] }, { ...body, courses: [{ ...course, id: null }] },
])('rejects malformed, duplicate or cross-tenant response %#', async payload => {
  mockFetch.mockResolvedValue(response(payload)); mount(); await screen.findByRole('alert');
  expect(screen.queryByRole('link', { name: 'Vào lớp học' })).toBeNull();
});
it('reports transport and invalid JSON failures without data fabrication', async () => {
  mockFetch.mockRejectedValueOnce(new Error('transport')); mount(); await screen.findByRole('alert');
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('invalid JSON'); } } as Response);
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' })); await screen.findByRole('alert');
  expect(screen.queryByText('0')).toBeNull();
});
it('clears previously loaded rows immediately on reload and keeps them cleared on failure', async () => {
  mount(); await screen.findByRole('heading', { name: 'Synthetic class' });
  mockFetch.mockRejectedValueOnce(new Error('transport'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  expect(screen.queryByRole('heading', { name: 'Synthetic class' })).toBeNull();
  await screen.findByRole('alert'); expect(screen.queryByText('1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  expect(await screen.findByRole('heading', { name: 'Synthetic class' })).toBeVisible();
});
it('ignores stale responses from an earlier request', async () => {
  let complete: (value: Response) => void = () => { throw new Error('Not initialized'); };
  mockFetch.mockReturnValueOnce(new Promise(resolve => { complete = resolve; })); mount();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByRole('heading', { name: 'Synthetic class' });
  await act(async () => { complete(response({ ...body, courses: [{ ...course, title: 'Stale class' }] })); });
  expect(screen.queryByRole('heading', { name: 'Stale class' })).toBeNull();
});
it('aborts a stalled request and ignores its eventual success', async () => {
  jest.useFakeTimers();
  let complete: (value: Response) => void = () => { throw new Error('Not initialized'); };
  mockFetch.mockReturnValueOnce(new Promise(resolve => { complete = resolve; })); mount();
  act(() => { jest.advanceTimersByTime(15_000); });
  expect(screen.getByRole('alert')).toBeVisible();
  const options = mockFetch.mock.calls[0][1]; expect(options?.signal?.aborted).toBe(true);
  await act(async () => { complete(response()); });
  expect(screen.queryByRole('heading', { name: 'Synthetic class' })).toBeNull();
});
it('preserves other Products only on the trusted unsupported Product response', async () => {
  mockFetch.mockResolvedValue(response({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' }, 403)); mount();
  expect(await screen.findByText('Existing other Product')).toBeVisible();
});
it('does not select the other Product fallback from an invalid success response', async () => {
  mockFetch.mockResolvedValue(response({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' })); mount();
  await screen.findByRole('alert'); expect(screen.queryByText('Existing other Product')).toBeNull();
});
it('filters real name/code and status without changing the actual catalog count', async () => {
  mockFetch.mockResolvedValue(response({ ...body, courses: [course, { ...course, id: 'second', title: 'Archived class', courseCode: 'ARC-02', status: 'archived' }] }));
  mount(); await screen.findByText('Hiển thị 2 / 2 lớp');
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm tên hoặc mã lớp' }), { target: { value: 'ARC-02' } });
  expect(screen.queryByRole('heading', { name: 'Synthetic class' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Archived class' })).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Trạng thái lớp' }), { target: { value: 'active' } });
  await waitFor(() => expect(screen.getByText('Không có lớp phù hợp bộ lọc.')).toBeVisible());
  expect(screen.getByText('Hiển thị 0 / 2 lớp')).toBeVisible();
});
