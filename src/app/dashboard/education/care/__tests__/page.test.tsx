/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CarePage from '../page';

jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: jest.fn().mockResolvedValue(null) }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

const originalFetch = global.fetch;
const courses = [
  { id: 'course-a', code: 'A', name: 'Synthetic class A', status: 'active' },
  { id: 'course-b', code: 'B', name: 'Synthetic class B', status: 'active' },
];
const student = (name: string) => ({ enrollmentId: 'synthetic-enrollment', studentPartyId: 'synthetic-student', name, studentCode: null, gender: null, dob: null, care: null });
const reply = (body: unknown, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => body });
afterEach(() => { global.fetch = originalFetch; });

test('A failed class dependency stays visible without invented classes, sample events or medication', async () => {
  const request = jest.fn().mockResolvedValue(reply({ success: false }, false)); global.fetch = request;
  render(<CarePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách lớp');
  expect(within(screen.getByRole('combobox', { name: 'Lớp chăm sóc' })).queryAllByRole('option')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Ghi nhận nhanh' })).toBeDisabled();
  expect(screen.getByText('Lịch sử hoạt động chưa khả dụng.')).toBeVisible();
  expect(screen.queryByText('Theo dõi nhiệt độ cho bé có dấu hiệu sốt')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /thuốc/i })).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});

test('Care roster denial does not fall back to a different authorization workflow', async () => {
  const request = jest.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/education/care/classes'
    ? reply({ success: true, classrooms: courses }) : reply({ success: false }, false))); global.fetch = request;
  render(<CarePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được nhật ký chăm sóc');
  expect(request.mock.calls.every(([url]) => !(url as string).includes('/attendance'))).toBe(true);
  expect(screen.getByRole('button', { name: 'Ghi nhận nhanh' })).toBeDisabled();
});

test.each(['denied', 'partial', 'reload-failed', 'auth-revoked'] as const)('A %s save keeps the quick editor and a visible error without claiming success', async mode => {
  let reads = 0;
  const request = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if(url === '/api/education/care/classes')return Promise.resolve(reply({ success: true, classrooms: [courses[0]] }));
    if(init?.method === 'POST')return Promise.resolve(reply({ success: mode !== 'denied', savedCount: mode === 'partial' ? 0 : 1, total: 1 }, mode !== 'denied'));
    reads++;
    return Promise.resolve(reads > 1 && (mode === 'reload-failed' || mode === 'auth-revoked')
      ? reply({ success: false }, false, mode === 'auth-revoked' ? 403 : 503)
      : reply({ success: true, roster: [student('Synthetic child')] }));
  }); global.fetch = request;
  render(<CarePage />);
  await screen.findByText('Synthetic child', { exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  const dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  expect(within(dialog).getByLabelText('Thân nhiệt & Sức khỏe')).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Ghi chú cho phụ huynh / giáo viên ca sau'), { target: { value: 'Synthetic unsaved draft' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chưa xác nhận lưu đầy đủ');
  expect(dialog).toBeVisible();
  expect(within(dialog).getByLabelText('Ghi chú cho phụ huynh / giáo viên ca sau')).toHaveValue('Synthetic unsaved draft');
  expect(screen.queryByText('Đã lưu chăm sóc cho 1 trẻ.')).not.toBeInTheDocument();
  if(mode === 'auth-revoked')expect(within(screen.getByRole('table')).queryByText('Synthetic child', { exact: true })).not.toBeInTheDocument();
  else expect(within(screen.getByRole('table')).getByText('Synthetic child', { exact: true })).toBeVisible();
  const body = JSON.parse(request.mock.calls.find(([, init]) => init?.method === 'POST')?.[1].body as string);
  expect(body.data.records[0]).not.toHaveProperty('health');
});

test('A slower successful Courses retry cannot erase a Care dependency failure', async () => {
  let resolveCourses: (value: ReturnType<typeof reply>) => void = () => { throw new Error('Retry missing'); };
  const retry = new Promise<ReturnType<typeof reply>>(resolve => { resolveCourses = resolve; });
  let courseReads = 0;
  const request = jest.fn().mockImplementation((url: string) => {
    if(url === '/api/education/care/classes')return ++courseReads === 1
      ? Promise.resolve(reply({ success: true, classrooms: [courses[0]] })) : retry;
    return Promise.resolve(reply({ success: false }, false));
  }); global.fetch = request;
  render(<CarePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được nhật ký chăm sóc');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
  await waitFor(() => expect(request.mock.calls.filter(([url]) => (url as string).includes('/care/bulk'))).toHaveLength(2));
  await act(async () => { resolveCourses(reply({ success: true, classrooms: [courses[0]] })); await retry; });
  expect(screen.getByRole('alert')).toHaveTextContent('Không tải được nhật ký chăm sóc');
});

test('A stale class response cannot replace the newly selected class roster', async () => {
  let resolveOld: (value: ReturnType<typeof reply>) => void = () => { throw new Error('Old request missing'); };
  const old = new Promise<ReturnType<typeof reply>>(resolve => { resolveOld = resolve; });
  const request = jest.fn().mockImplementation((url: string) => url === '/api/education/care/classes'
    ? Promise.resolve(reply({ success: true, classrooms: courses }))
    : url.includes('course-a') ? old : Promise.resolve(reply({ success: true, roster: [student('New class child')] })));
  global.fetch = request;
  render(<CarePage />);
  await waitFor(() => expect(request.mock.calls.some(([url]) => (url as string).includes('course-a'))).toBe(true));
  fireEvent.change(screen.getByRole('combobox', { name: 'Lớp chăm sóc' }), { target: { value: 'course-b' } });
  await screen.findByText('New class child', { exact: true });
  await act(async () => { resolveOld(reply({ success: true, roster: [student('Stale class child')] })); await old; });
  expect(screen.getByText('New class child', { exact: true })).toBeVisible();
  expect(screen.queryByText('Stale class child', { exact: true })).not.toBeInTheDocument();
});

test('A pending save locks its draft and prevents opening a competing editor', async () => {
  let finishSave: (value: ReturnType<typeof reply>) => void = () => { throw new Error('Save missing'); };
  const pending = new Promise<ReturnType<typeof reply>>(resolve => { finishSave = resolve; });
  const request = jest.fn().mockImplementation((url: string, init?: RequestInit) => init?.method === 'POST' ? pending
    : Promise.resolve(url === '/api/education/care/classes' ? reply({ success: true, classrooms: [courses[0]] })
      : reply({ success: true, roster: [student('Synthetic child')] })));
  global.fetch = request;
  render(<CarePage />);
  await screen.findByText('Synthetic child', { exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  const dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  const note = within(dialog).getByLabelText('Ghi chú cho phụ huynh / giáo viên ca sau');
  fireEvent.change(note, { target: { value: 'Original pending draft' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  expect(note).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Đóng ghi nhận nhanh' })).toBeDisabled();
  fireEvent.click(screen.getByTitle('Chỉnh sửa nội dung chăm sóc cho bé'));
  expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa chăm sóc' })).not.toBeInTheDocument();
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  await act(async () => { finishSave(reply({ success: false }, false, 403)); await pending; });
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chưa xác nhận lưu đầy đủ');
  expect(note).toBeEnabled();
  expect(note).toHaveValue('Original pending draft');
});
