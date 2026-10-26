/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PreschoolAttendance from '../preschool-attendance';

// Explicit synthetic responses for UI failure boundaries, not DB/RLS evidence.
const course = (id: string) => ({ id, tenantId: 'tenant', courseCode: `CODE-${id}`, title: `Class ${id}`, status: 'active' });
const courses = [course('A'), course('B')];
const row = (id = 'A') => ({ enrollmentId: id, studentId: `student-${id}`, studentPartyId: `party-${id}`, studentCode: null,
  name: `Pupil ${id}`, gender: null, dob: null, enrollmentStatus: 'active', attendance: null });
type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const reply = (body: unknown, status = 200): Reply => ({ ok: status === 200, status, json: async () => body });
function deferred() {
  let resolve!: (v: Reply) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<Reply>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const fetchMock = jest.fn<Promise<Reply>, [RequestInfo | URL, RequestInit?]>();
let catalogReply: Reply;
let attendanceClassesReply: Reply;
const gets: { url: URL; task: ReturnType<typeof deferred> }[] = [];
const classRequests: string[] = [];
const posts: { init: RequestInit; task: ReturnType<typeof deferred> }[] = [];
const dateInput = () => document.querySelector<HTMLInputElement>('input[type=date]')!;
const renderPage = () => render(<PreschoolAttendance legacy={<p>Legacy Product</p>} />);
async function start() { renderPage(); await waitFor(() => expect(gets).toHaveLength(1)); }
async function complete(i: number, rows: unknown[] = [row()]) {
  await act(async () => gets[i].task.resolve(reply({ success: true, courseId: gets[i].url.searchParams.get('courseId'),
    schoolDay: gets[i].url.searchParams.get('date'), roster: rows })));
}
function state(status = 'present') { return { id: 'state', tenantId: 'tenant', enrollmentId: 'A', schoolDay: dateInput().value,
  status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
beforeEach(() => {
  gets.length = 0; classRequests.length = 0; posts.length = 0; fetchMock.mockReset();
  catalogReply = reply({ success: true, courses });
  attendanceClassesReply = reply({ success: true, tenantId: 'tenant', schoolDay: today(), classrooms: [
    { id: 'A', name: 'Assigned Class A', branchId: '00000000-0000-4000-8000-000000000001' },
  ] });
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), 'http://synthetic.invalid');
    if (url.pathname === '/api/education/courses') return Promise.resolve(catalogReply);
    if (url.pathname === '/api/education/attendance/courses') {
      classRequests.push(url.toString());
      return Promise.resolve(attendanceClassesReply);
    }
    const task = deferred();
    if (init?.method === 'POST') posts.push({ init, task }); else gets.push({ url, task });
    return task.promise;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

it('uses canonical catalog and the explicit roster-only mode, with no legacy overview request', async () => {
  await start(); await complete(0);
  expect(gets[0].url.searchParams.get('view')).toBe('roster');
  expect(screen.getByText('Pupil A')).toBeVisible();
  expect(screen.getByLabelText('Tổng hợp điểm danh')).toHaveTextContent('1 học sinh');
  expect(screen.queryByText(/Sĩ số:/)).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/education/courses')).toBe(false);
});
it('opens the class selected by the existing classroom link and never substitutes another class', async () => {
  window.history.replaceState({}, '', '/?courseId=B');
  try {
    await start();
    expect(gets[0].url.searchParams.get('courseId')).toBe('B');
    await complete(0, [row('B')]);
    expect(screen.getByText('Pupil B')).toBeVisible();
  } finally { window.history.replaceState({}, '', '/'); }
});
it.each([401, 403, 503])('does not fall back to legacy or fabricated data on catalog denial %s', async status => {
  catalogReply = reply({ success: false }, status); renderPage();
  await screen.findByRole('alert');
  expect(screen.queryByText('Legacy Product')).not.toBeInTheDocument();
  expect(gets).toHaveLength(0); expect(posts).toHaveLength(0);
});
it('retains legacy only after the server identifies an unsupported Product', async () => {
  catalogReply = reply({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' }, 403); renderPage();
  expect(await screen.findByText('Legacy Product')).toBeVisible(); expect(gets).toHaveLength(0);
});
it('loads only caller-assigned classes from the attendance API when the catalog denies teacher access', async () => {
  catalogReply = reply({ success: false, error: 'COURSE_ACCESS_DENIED' }, 403);
  await start();
  expect(classRequests).toHaveLength(1);
  expect(new URL(classRequests[0]).searchParams.get('date')).toBe(today());
  expect(gets[0].url.searchParams.get('courseId')).toBe('A');
  await complete(0, [row('A')]);
  expect(screen.getByRole('button', { name: 'Assigned Class A' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Class B · CODE-B' })).not.toBeInTheDocument();
  expect(screen.getByText('Pupil A')).toBeVisible();
});
it('does not substitute a teacher class when an incoming deep link names an unassigned class', async () => {
  catalogReply = reply({ success: false, error: 'COURSE_ACCESS_DENIED' }, 403);
  window.history.replaceState({}, '', '/?courseId=B');
  try {
    renderPage();
    await screen.findByRole('alert');
    expect(classRequests).toHaveLength(1);
    expect(gets).toHaveLength(0);
    expect(screen.queryByText('Pupil A')).not.toBeInTheDocument();
  } finally { window.history.replaceState({}, '', '/'); }
});
it('fails closed on malformed attendance class scope without fetching a roster', async () => {
  catalogReply = reply({ success: false, error: 'COURSE_ACCESS_DENIED' }, 403);
  attendanceClassesReply = reply({ success: true, tenantId: ' ', schoolDay: today(), classrooms: [
    { id: 'A', name: 'Assigned Class A', branchId: '00000000-0000-4000-8000-000000000001' },
  ] });
  renderPage();
  await screen.findByRole('alert');
  expect(gets).toHaveLength(0);
});
it.each([null, [{ ...course('A'), tenantId: 'foreign' }, course('B')], [course('A'), course('A')], [{ ...course('A'), status: 'invalid' }]])('rejects malformed/mixed/duplicate catalog %j', async data => {
  catalogReply = reply({ success: true, courses: data }); renderPage();
  await screen.findByRole('alert'); expect(gets).toHaveLength(0);
});
it('keeps an empty canonical catalog empty without roster requests', async () => {
  catalogReply = reply({ success: true, courses: [] }); renderPage();
  await screen.findByText('Chưa có khóa học đang hoạt động.'); expect(gets).toHaveLength(0);
});
it.each([{ rows: [{ ...row(), enrollmentStatus: 'pending' }] }, { rows: [row(), row()] }, { rows: [{ ...row(), name: null }] }])('rejects malformed or ineligible roster %j', async ({ rows: data }) => {
  await start(); await complete(0, data); expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument(); expect(posts).toHaveLength(0);
});
it('clears old rows immediately and ignores stale old-course responses', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: 'Class B · CODE-B' }));
  await waitFor(() => expect(gets).toHaveLength(2)); await complete(1, [row('B')]); await complete(0);
  expect(screen.getByText('Pupil B')).toBeVisible(); expect(screen.queryByText('Pupil A')).not.toBeInTheDocument();
});
it('shows failure instead of zero counts on transport errors and can retry', async () => {
  await start(); await act(async () => gets[0].task.reject(new Error('transport')));
  expect(screen.getByRole('alert')).toBeVisible(); expect(screen.queryByLabelText('Tổng hợp điểm danh')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' })); await complete(1, []);
  expect(screen.getByLabelText('Tổng hợp điểm danh')).toHaveTextContent('0 học sinh');
});
it('locks duplicate commands/context until confirmed persistence, then reloads the actual roster', async () => {
  await start(); await complete(0);
  const action = screen.getByRole('button', { name: 'Có mặt — Pupil A' }); fireEvent.click(action); fireEvent.click(action);
  expect(posts).toHaveLength(1); expect(dateInput()).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Class B · CODE-B' })).toBeDisabled();
  expect(screen.queryByText('Đã ghi nhận điểm danh.')).not.toBeInTheDocument();
  expect(JSON.parse(String(posts[0].init.body))).toEqual({ enrollmentId: 'A', status: 'present', date: dateInput().value });
  await act(async () => posts[0].task.resolve(reply({ success: true, attendance: state() })));
  expect(screen.getByText('Đã ghi nhận điểm danh.')).toBeVisible(); expect(screen.getByLabelText('Tổng hợp điểm danh')).toHaveTextContent('Có mặt: 1');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
  await complete(1, [{ ...row(), attendance: state('absent') }]);
  expect(screen.getByLabelText('Tổng hợp điểm danh')).toHaveTextContent('Vắng: 1');
});
it.each(['malformed', 'denied', 'transport', 'wrong-status'])('requires readback after uncertain command %s without fake success', async kind => {
  await start(); await complete(0); fireEvent.click(screen.getByRole('button', { name: 'Có mặt — Pupil A' }));
  await act(async () => {
    if (kind === 'transport') posts[0].task.reject(new Error('lost response'));
    else posts[0].task.resolve(reply(kind === 'malformed' ? { success: true } : { success: true, attendance: state('absent') }, kind === 'denied' ? 403 : 200));
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Chưa xác nhận');
  expect(screen.queryByRole('table')).not.toBeInTheDocument(); expect(screen.queryByText('Đã ghi nhận điểm danh.')).not.toBeInTheDocument();
});
it('does not fetch or write a non-current day, even when a modified input supplies it', async () => {
  await start(); await complete(0); fireEvent.change(dateInput(), { target: { value: '2020-01-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('ngày hôm nay'); expect(gets).toHaveLength(1); expect(posts).toHaveLength(0);
});
