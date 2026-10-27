/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CanonicalClassroomCatalog from '../CanonicalClassroomCatalog';
jest.mock('../classroom-live-data', () => ({ loadClassroomOverview: jest.fn(async () => new Map()) }));

// Public wire acceptance, deliberately no local optimistic course fixture.
const tenantId = '00000000-0000-4000-8000-000000000001';
const branchId = '00000000-0000-4000-8000-000000000003';
const operationKey = '00000000-0000-4000-8000-000000000004';
const id = '00000000-0000-4000-8000-000000000005';
const catalog = { success: true, tenantId, courses: [] };
const identity = { id, tenantId, branchId, operationKey, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active' };
const mockFetch = jest.fn<typeof fetch>();
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value }) as Response;
beforeEach(() => {
  mockFetch.mockReset();
  // Create fixtures deny summary reads explicitly; summary behavior is tested separately.
  global.fetch = (url, options) => typeof url === 'string' && url.startsWith('/api/education/attendance/courses?')
    ? Promise.resolve(response({ success: false, error: 'SYNTHETIC_SUMMARY_DENIED' }, 403)) : mockFetch(url, options);
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => operationKey });
  mockFetch.mockImplementation(async url => {
    if (url === '/api/education/courses/catalog') return response(catalog);
    if (url === '/api/education/branches') return response({ success: true, branches: [{ id: branchId, name: 'Synthetic branch' }] });
    throw new Error('Unexpected request');
  });
});
afterEach(() => { cleanup(); jest.useRealTimers(); });
async function openAndFill() {
  render(<CanonicalClassroomCatalog legacy={null} />);
  await screen.findByText('Chưa có lớp học trong phạm vi được cấp quyền.');
  fireEvent.click(screen.getByRole('button', { name: 'Mở Lớp Học Mới' }));
  await screen.findByRole('option', { name: 'Synthetic branch' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Chi nhánh' }), { target: { value: branchId } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã lớp' }), { target: { value: ' syn-01 ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên lớp' }), { target: { value: ' Synthetic class ' } });
}
const writes = () => mockFetch.mock.calls.filter(call => call[0] === '/api/education/courses');
const readWriteBody = (index = 0) => JSON.parse(writes()[index][1]?.body as string) as Record<string, unknown>;
it('submits exact input then links verified server identity and reloads catalog', async () => {
  await openAndFill();
  mockFetch.mockImplementation(async url => url === '/api/education/courses' ? response({ success: true, course: identity }, 201) : response({ ...catalog, courses: [identity] }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  expect(await screen.findByRole('link', { name: 'Mở lớp vừa tạo' })).toHaveAttribute('href', `/dashboard/education/courses/${id}`);
  expect(readWriteBody()).toEqual({ operationKey, branchId, code: ' syn-01 ', title: ' Synthetic class ' });
  expect(await screen.findByRole('heading', { name: 'Synthetic class' })).toBeVisible();
  expect(mockFetch.mock.calls.filter(call => call[0] === '/api/education/courses/catalog')).toHaveLength(2);
});
it('hides the previous tenant creation identity after a catalog scope change', async () => {
  await openAndFill();
  let nextTenant = tenantId;
  mockFetch.mockImplementation(async url => url === '/api/education/courses'
    ? response({ success: true, course: identity }, 201)
    : response({ success: true, tenantId: nextTenant, courses: nextTenant === tenantId ? [identity] : [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  await screen.findByRole('link', { name: 'Mở lớp vừa tạo' });
  nextTenant = '00000000-0000-4000-8000-000000000099';
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Chưa có lớp học trong phạm vi được cấp quyền.');
  expect(screen.queryByRole('link', { name: 'Mở lớp vừa tạo' })).toBeNull();
  expect(screen.queryByText(/Đã tạo lớp Synthetic class/)).toBeNull();
});
it('keeps failed form and operation key across retry, close and reopen', async () => {
  await openAndFill();
  mockFetch.mockResolvedValueOnce(response({ success: false, error: 'CANONICAL_COURSE_UNAVAILABLE' }, 503));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Thông tin được giữ lại');
  expect(screen.getByRole('textbox', { name: 'Mã lớp' })).toHaveValue(' syn-01 ');
  expect(screen.getByRole('textbox', { name: 'Mã lớp' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Chi nhánh' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã lớp' }), { target: { value: 'CHANGED' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên lớp' }), { target: { value: 'Changed' } });
  expect(screen.getByRole('textbox', { name: 'Mã lớp' })).toHaveValue(' syn-01 ');
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toHaveValue(' Synthetic class ');
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở Lớp Học Mới' }));
  await screen.findByRole('option', { name: 'Synthetic branch' });
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toBeDisabled();
  mockFetch.mockResolvedValueOnce(response({ success: true, course: identity }, 201));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  await screen.findByRole('link', { name: 'Mở lớp vừa tạo' });
  expect(readWriteBody(1)).toEqual(readWriteBody(0));
});
it('offers catalog checking and explicitly resets failed payload only for a new operation key', async () => {
  await openAndFill();
  mockFetch.mockResolvedValueOnce(response({ success: false }, 503));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' })); await screen.findByRole('alert');
  expect(screen.getByText(/Yêu cầu trước có thể đã tạo lớp/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra danh sách lớp' }));
  await screen.findByText('Chưa có lớp học trong phạm vi được cấp quyền.');
  expect(mockFetch.mock.calls.filter(call => call[0] === '/api/education/courses/catalog')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Mở Lớp Học Mới' }));
  await screen.findByRole('option', { name: 'Synthetic branch' });
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toBeDisabled();
  const newKey = '00000000-0000-4000-8000-000000000006';
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => newKey });
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu yêu cầu mới' }));
  expect(screen.getByRole('textbox', { name: 'Mã lớp' })).toBeEnabled();
  expect(screen.getByRole('textbox', { name: 'Mã lớp' })).toHaveValue('');
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Chi nhánh' })).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox', { name: 'Chi nhánh' }), { target: { value: branchId } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã lớp' }), { target: { value: 'SYN-02' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên lớp' }), { target: { value: 'New class' } });
  mockFetch.mockResolvedValueOnce(response({ success: true, course: { ...identity, operationKey: newKey, courseCode: 'SYN-02', title: 'New class' } }, 201));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' })); await screen.findByRole('link', { name: 'Mở lớp vừa tạo' });
  expect(readWriteBody(0)).toEqual({ operationKey, branchId, code: ' syn-01 ', title: ' Synthetic class ' });
  expect(readWriteBody(1)).toEqual({ operationKey: newKey, branchId, code: 'SYN-02', title: 'New class' });
});
it.each([
  { tenantId: 'foreign' }, { branchId: 'foreign' }, { operationKey: 'foreign' },
  { courseCode: 'different' }, { title: 'different' }, { status: 'draft' }, { id: 'malformed' },
])('rejects mismatched server identity and retains retry key %#', async patch => {
  await openAndFill(); mockFetch.mockResolvedValueOnce(response({ success: true, course: { ...identity, ...patch } }, 201));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Phản hồi tạo lớp chưa được xác minh');
  expect(screen.queryByRole('link', { name: 'Mở lớp vừa tạo' })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toHaveValue(' Synthetic class ');
  mockFetch.mockResolvedValueOnce(response({ success: true, course: identity }, 201));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  await screen.findByRole('link', { name: 'Mở lớp vừa tạo' });
  expect(readWriteBody(1).operationKey).toBe(operationKey);
});
it('prevents duplicate submission while a transaction is pending', async () => {
  await openAndFill();
  let complete: (value: Response) => void = () => {};
  mockFetch.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  const button = screen.getByRole('button', { name: 'Tạo lớp' });
  fireEvent.click(button); fireEvent.click(button);
  expect(writes()).toHaveLength(1); expect(button).toBeDisabled();
  await act(async () => complete(response({ success: false }, 503)));
  await screen.findByRole('alert');
});
it.each([401, 403, 409, 503])('reports HTTP %s without success or catalog reload', async status => {
  await openAndFill(); mockFetch.mockResolvedValueOnce(response({ success: false }, status));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' })); await screen.findByRole('alert');
  expect(screen.queryByRole('link', { name: 'Mở lớp vừa tạo' })).toBeNull();
  expect(mockFetch.mock.calls.filter(call => call[0] === '/api/education/courses/catalog')).toHaveLength(1);
});
it('sanitizes unknown transport detail and retains the failed form', async () => {
  await openAndFill(); mockFetch.mockRejectedValueOnce(new Error('private transport detail'));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Chưa thể xác nhận tạo lớp'); expect(alert).not.toHaveTextContent('private transport detail');
  expect(screen.getByRole('textbox', { name: 'Tên lớp' })).toHaveValue(' Synthetic class ');
});
it('does not submit when branch options are unavailable', async () => {
  mockFetch.mockImplementation(async url => url === '/api/education/courses/catalog' ? response(catalog) : response({ success: false }, 503));
  render(<CanonicalClassroomCatalog legacy={null} />); await screen.findByText('Chưa có lớp học trong phạm vi được cấp quyền.');
  fireEvent.click(screen.getByRole('button', { name: 'Mở Lớp Học Mới' })); await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Tạo lớp' })).toBeDisabled(); expect(writes()).toHaveLength(0);
});
it('retains search, status and reset after create UI is opened and closed', async () => {
  mockFetch.mockResolvedValueOnce(response({ ...catalog, courses: [identity] }));
  render(<CanonicalClassroomCatalog legacy={null} />); await screen.findByRole('heading', { name: 'Synthetic class' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm tên hoặc mã lớp' }), { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mở Lớp Học Mới' })); await screen.findByRole('option', { name: 'Synthetic branch' });
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(screen.getByText('Không có lớp phù hợp bộ lọc.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại bộ lọc' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Synthetic class' })).toBeVisible());
});
