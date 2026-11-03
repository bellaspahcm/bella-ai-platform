/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CarePage from '../page';

let currentSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
}));
jest.mock('@/lib/user-context', () => ({ useUser: () => ({ product: { productKey: 'bella_preschool' }, isLoading: false }) }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

const originalFetch = global.fetch;
const courses = [
  { id: 'course-a', code: 'A', name: 'Synthetic class A', status: 'active' },
  { id: 'course-b', code: 'B', name: 'Synthetic class B', status: 'active' },
];
const student = (name: string) => ({ enrollmentId: 'synthetic-enrollment', studentPartyId: 'synthetic-student', name, studentCode: null, gender: null, dob: null, care: null });
const reply = (body: unknown, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => body });
afterEach(() => { global.fetch = originalFetch; currentSearchParams = new URLSearchParams(); });

test.each([{ roster: [{...student('Synthetic child'),name:null}] }, { roster: [student('Synthetic child'),student('Synthetic duplicate')] }, { roster: [{...student('Synthetic child'),care:{id:'record',mealRecords:'invalid'}}] }])('rejects malformed canonical roster without keeping actionable children: %j', async body => {
  global.fetch=jest.fn().mockImplementation((url:string)=>Promise.resolve(url==='/api/education/care/classes'
    ? reply({success:true,classrooms:[courses[0]]}):reply({success:true,...body})));
  render(<CarePage />);await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Ghi nhận nhanh'})).toBeDisabled();
});

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
  if(mode === 'auth-revoked' || mode === 'reload-failed')expect(within(screen.getByRole('table')).queryByText('Synthetic child', { exact: true })).not.toBeInTheDocument();
  else expect(within(screen.getByRole('table')).getByText('Synthetic child', { exact: true })).toBeVisible();
  const body = JSON.parse(request.mock.calls.find(([, init]) => init?.method === 'POST')?.[1].body as string);
  expect(body.data.records[0]).not.toHaveProperty('health');
});

test('unknown historical health does not block nonhealth Care or become an invented clinical status', async () => {
  global.fetch=jest.fn().mockImplementation((url:string)=>Promise.resolve(url==='/api/education/care/classes'
    ? reply({success:true,classrooms:[courses[0]]}):reply({success:true,roster:[{...student('Historical child'),care:{id:'care',healthChecks:{status:'historical-observation',temperature:36.5}}}]})));
  render(<CarePage />);await screen.findByText('Historical child',{exact:true});
  expect(screen.getByRole('button',{name:'Ghi nhận nhanh'})).toBeEnabled();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

test('renders cross-module student context banner and links when student param is present', async () => {
  currentSearchParams = new URLSearchParams('student=HS0001');
  const request = jest.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/education/care/classes'
    ? reply({ success: true, classrooms: [courses[0]] })
    : reply({ success: true, roster: [{ ...student('Nguyễn Minh An'), studentCode: 'HS0001' }] })));
  global.fetch = request;

  render(<CarePage />);
  expect(await within(screen.getByRole('table')).findByText('Nguyễn Minh An', { exact: true })).toBeVisible();
  expect(screen.getByText(/Đang lọc nhật ký chăm sóc theo học sinh:/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem Hồ Sơ 360°' })).toHaveAttribute('href', '/dashboard/education/enrollments/HS0001');
  expect(screen.getByRole('link', { name: 'Học Tập & Hoạt Động' })).toHaveAttribute('href', '/dashboard/education/grades?student=HS0001');
  expect(screen.getByRole('link', { name: 'Điểm Danh & Đón Trả' })).toHaveAttribute('href', '/dashboard/education/attendance?student=HS0001');

  // Clicking "Xem tất cả trẻ" resets search query and hides banner
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả trẻ' }));
  });
  expect(screen.queryByText(/Đang lọc nhật ký chăm sóc theo học sinh:/)).not.toBeInTheDocument();
});

const canonicalTarget = {
  ...student('Synthetic actual child'),
  enrollmentId: 'target-enrollment',
  studentPartyId: '82c3aa22-9edc-47fa-9ba3-e10af2ba61ef',
  studentCode: 'HS0001',
};
const misleadingChild = {
  ...student('Nguyễn Minh An'),
  enrollmentId: 'other-enrollment',
  studentPartyId: 'a2d11af9-dd44-4e11-9a14-c2abcf7d80a8',
  studentCode: 'HS00010',
  note: 'HS0001 is mentioned in this unrelated note',
};

function fetchCanonicalCareRoster() {
  const request = jest.fn().mockImplementation((url: string, init?: RequestInit) => Promise.resolve(
    url === '/api/education/care/classes' ? reply({ success: true, classrooms: [courses[0]] })
      : init?.method === 'POST' ? reply({ success: true, savedCount: 1, total: 1 })
        : reply({ success: true, roster: [canonicalTarget, misleadingChild] }),
  ));
  global.fetch = request;
  return request;
}

test.each(['HS0001', ' hs0001 ', canonicalTarget.studentPartyId, canonicalTarget.studentPartyId.toUpperCase()])(
  'student context %s selects canonical identity instead of a sample name, prefix or note', async selector => {
    currentSearchParams = new URLSearchParams({ student: selector });
    fetchCanonicalCareRoster();
    render(<CarePage />);
    const table = within(screen.getByRole('table'));
    expect(await table.findByText(canonicalTarget.name, { exact: true })).toBeVisible();
    expect(table.queryByText(misleadingChild.name, { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText(/Đang lọc nhật ký chăm sóc theo học sinh:/)).toHaveTextContent(canonicalTarget.name);
  },
);

test('care quick save from a canonical child context sends only that Party ID and reloads the roster', async () => {
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  const request = fetchCanonicalCareRoster();
  render(<CarePage />);
  await within(screen.getByRole('table')).findByText(canonicalTarget.name, { exact: true });
  fireEvent.click(within(screen.getByRole('row', { name: new RegExp(canonicalTarget.name) })).getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  const dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
  const post = request.mock.calls.find(([, init]) => init?.method === 'POST');
  const body = JSON.parse(post?.[1].body as string) as { action: string; courseId: string; data: { records: Array<{ studentPartyId: string }> } };
  expect(body.action).toBe('save_care');
  expect(body.courseId).toBe(courses[0].id);
  expect(body.data.records.map(record => record.studentPartyId)).toEqual([canonicalTarget.studentPartyId]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' })).not.toBeInTheDocument());
  expect(request.mock.calls.filter(([url, init]) => url.includes('/care/bulk') && init?.method !== 'POST')).toHaveLength(2);
});

test('an unmatched context does not substitute a child; manual search leaves context and preserves name/note search', async () => {
  currentSearchParams = new URLSearchParams({ student: 'HS0009' });
  const request = fetchCanonicalCareRoster();
  render(<CarePage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ghi nhận nhanh' })).toBeEnabled());
  const table = within(screen.getByRole('table'));
  expect(table.queryByText(canonicalTarget.name, { exact: true })).not.toBeInTheDocument();
  expect(table.queryByText(misleadingChild.name, { exact: true })).not.toBeInTheDocument();
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.change(screen.getByPlaceholderText('Tìm tên trẻ...'), { target: { value: 'unrelated note' } });
  expect(await table.findByText(misleadingChild.name, { exact: true })).toBeVisible();
  expect(table.queryByText(canonicalTarget.name, { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/Đang lọc nhật ký chăm sóc theo học sinh:/)).not.toBeInTheDocument();
});

test('removing the student query clears its context and restores the authorized roster', async () => {
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  fetchCanonicalCareRoster();
  const view = render(<CarePage />);
  await within(screen.getByRole('table')).findByText(canonicalTarget.name, { exact: true });
  currentSearchParams = new URLSearchParams();
  view.rerender(<CarePage />);
  expect(await within(screen.getByRole('table')).findByText(misleadingChild.name, { exact: true })).toBeVisible();
  expect(screen.queryByText(/Đang lọc nhật ký chăm sóc theo học sinh:/)).not.toBeInTheDocument();
});

test('navigating to another child clears the previous bulk selection and draft before saving', async () => {
  const request = fetchCanonicalCareRoster();
  const view = render(<CarePage />);
  const otherRow = await screen.findByRole('row', { name: new RegExp(misleadingChild.name) });
  fireEvent.click(within(otherRow).getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  let dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  fireEvent.change(within(dialog).getByLabelText('Bữa ăn'), { target: { value: 'NONE' } });
  fireEvent.change(within(dialog).getByLabelText('Giấc ngủ trưa'), { target: { value: 'REFUSED' } });
  fireEvent.change(within(dialog).getByLabelText('Vệ sinh cá nhân'), { target: { value: 'ABNORMAL' } });
  fireEvent.change(within(dialog).getByLabelText('Ghi chú cho phụ huynh / giáo viên ca sau'), { target: { value: 'Other child draft' } });
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  view.rerender(<CarePage />);
  expect(screen.queryByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' })).not.toBeInTheDocument();
  const targetCheckbox = within(screen.getByRole('row', { name: new RegExp(canonicalTarget.name) })).getByRole('checkbox');
  expect(targetCheckbox).not.toBeChecked();
  fireEvent.click(targetCheckbox);
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  expect(within(dialog).getByLabelText('Bữa ăn')).toHaveValue('ALL');
  expect(within(dialog).getByLabelText('Giấc ngủ trưa')).toHaveValue('DEEP');
  expect(within(dialog).getByLabelText('Vệ sinh cá nhân')).toHaveValue('TOILET');
  expect(within(dialog).getByLabelText('Ghi chú cho phụ huynh / giáo viên ca sau')).toHaveValue('');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
  const post = request.mock.calls.find(([, init]) => init?.method === 'POST');
  const body = JSON.parse(post?.[1].body as string) as { data: { records: Array<{ studentPartyId: string; note: string }> } };
  expect(body.data.records.map(record => ({ studentPartyId: record.studentPartyId, note: record.note })))
    .toEqual([{ studentPartyId: canonicalTarget.studentPartyId, note: '' }]);
});

test('the existing whole-class quick-save action stays whole-class when no rows are selected', async () => {
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  const request = fetchCanonicalCareRoster();
  render(<CarePage />);
  await within(screen.getByRole('table')).findByText(canonicalTarget.name, { exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  const dialog = screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
  const post = request.mock.calls.find(([, init]) => init?.method === 'POST');
  const body = JSON.parse(post?.[1].body as string) as { data: { records: Array<{ studentPartyId: string }> } };
  expect(body.data.records.map(record => record.studentPartyId))
    .toEqual([canonicalTarget.studentPartyId, misleadingChild.studentPartyId]);
  // This fixture acknowledges only one row: the existing false-success guard must still reject it.
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chưa xác nhận lưu đầy đủ');
});

test('ambiguous student codes do not guess a child; an exact Party ID still resolves', async () => {
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentCode });
  global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/education/care/classes'
    ? reply({ success: true, classrooms: [courses[0]] })
    : reply({ success: true, roster: [canonicalTarget, { ...misleadingChild, studentCode: canonicalTarget.studentCode }] })));
  const view = render(<CarePage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ghi nhận nhanh' })).toBeEnabled());
  const table = within(screen.getByRole('table'));
  expect(table.queryByText(canonicalTarget.name, { exact: true })).not.toBeInTheDocument();
  expect(table.queryByText(misleadingChild.name, { exact: true })).not.toBeInTheDocument();
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  view.rerender(<CarePage />);
  expect(await table.findByText(canonicalTarget.name, { exact: true })).toBeVisible();
  expect(table.queryByText(misleadingChild.name, { exact: true })).not.toBeInTheDocument();
});

test('exact Party ID takes precedence over another child with that value as student code', async () => {
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/education/care/classes'
    ? reply({ success: true, classrooms: [courses[0]] })
    : reply({ success: true, roster: [canonicalTarget, { ...misleadingChild, studentCode: canonicalTarget.studentPartyId }] })));
  render(<CarePage />);
  const table = within(screen.getByRole('table'));
  expect(await table.findByText(canonicalTarget.name, { exact: true })).toBeVisible();
  expect(table.queryByText(misleadingChild.name, { exact: true })).not.toBeInTheDocument();
});

test('an old quick-save completion cannot clear a newly selected child after query navigation', async () => {
  let finishSave: (value: ReturnType<typeof reply>) => void = () => { throw new Error('Save missing'); };
  const pending = new Promise<ReturnType<typeof reply>>(resolve => { finishSave = resolve; });
  const request = fetchCanonicalCareRoster();
  const originalImplementation = request.getMockImplementation()!;
  let writes = 0;
  let saved = false;
  request.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && writes++ === 0) return pending.then(result => { saved = true; return result; });
    if (saved && url.includes('/care/bulk') && init?.method !== 'POST') return Promise.resolve(reply({
      success: true,
      roster: [canonicalTarget, { ...misleadingChild, care: { id: 'saved-care', morningCondition: 'Saved old-child note', mealRecords: [{ portion: 'NONE' }] } }],
    }));
    return originalImplementation(url, init);
  });
  const view = render(<CarePage />);
  const oldRow = await screen.findByRole('row', { name: new RegExp(misleadingChild.name) });
  fireEvent.click(within(oldRow).getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' })).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  currentSearchParams = new URLSearchParams({ student: canonicalTarget.studentPartyId });
  view.rerender(<CarePage />);
  const targetCheckbox = within(screen.getByRole('row', { name: new RegExp(canonicalTarget.name) })).getByRole('checkbox');
  fireEvent.click(targetCheckbox);
  await act(async () => { finishSave(reply({ success: true, savedCount: 1, total: 1 })); await pending; });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ghi nhận nhanh' })).toBeEnabled());
  expect(within(screen.getByRole('row', { name: new RegExp(canonicalTarget.name) })).getByRole('checkbox')).toBeChecked();
  expect(request.mock.calls.filter(([url, init]) => url.includes('/care/bulk') && init?.method !== 'POST')).toHaveLength(2);
  expect(screen.queryByText('Đã lưu chăm sóc cho 1 trẻ.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận nhanh' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' })).getByRole('button', { name: 'Lưu Ghi Nhận' }));
  await waitFor(() => expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2));
  const post = request.mock.calls.filter(([, init]) => init?.method === 'POST')[1];
  const body = JSON.parse(post[1]?.body as string) as { data: { records: Array<{ studentPartyId: string }> } };
  expect(body.data.records.map(record => record.studentPartyId)).toEqual([canonicalTarget.studentPartyId]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ghi Nhận Chăm Sóc Nhanh' })).not.toBeInTheDocument());
  currentSearchParams = new URLSearchParams({ student: misleadingChild.studentPartyId });
  view.rerender(<CarePage />);
  expect(await within(screen.getByRole('table')).findByText('Saved old-child note', { exact: true })).toBeVisible();
});
