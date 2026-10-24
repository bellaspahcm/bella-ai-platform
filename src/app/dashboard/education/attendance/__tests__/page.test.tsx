/** @jest-environment jsdom */

import React from 'react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AttendancePage from '../page';

// Synthetic HTTP fixtures verify confirmed UI updates and context/ordering, never guardian authority or DB/RLS.
type Reply = Pick<Response, 'ok' | 'json'>;
const response = (payload: unknown, ok = true): Reply => ({ ok, json: async () => payload });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const courses = ['A', 'B'].map((id) => ({
  id: `course-${id}`, name: `Synthetic Class ${id}`, code: id,
  gradeKey: id === 'A' ? 'mam' : 'choi',
  students: 1, maxStudents: 10, todayStatus: { present: 0, excused: 0, unmarked: 1, healthAlerts: 0 },
}));
const row = (id: string) => ({
  enrollmentId: `enrollment-${id}`, studentId: `student-${id}`,
  studentPartyId: `party-${id}`, studentCode: `SYN-${id}`, name: `Synthetic Child ${id}`,
  gender: null, dob: null, enrollmentStatus: 'active', attendance: null,
  authorizedGuardians: [{ authorizationId: `authorization-${id}`, studentPartyId: `party-${id}`,
    guardianPartyId: `guardian-${id}`, displayName: `Synthetic Guardian ${id}`, phone: '', status: 'authorized' }],
});
const fetchMock = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const gets: { url: string; task: ReturnType<typeof deferred<Reply>> }[] = [];
const commands: { url: string; init: RequestInit; task: ReturnType<typeof deferred<Reply>> }[] = [];
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
const dateInput = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="date"]');
  if (!input) throw new Error('Missing school-day input');
  return input;
};
const table = () => screen.getByRole('table');
const studentRow = (id: string) => {
  const result = within(table()).getByText(`Synthetic Child ${id}`).closest('tr');
  if (!result) throw new Error('Missing student row');
  return within(result);
};
const attendanceReply = (id = 'A', status = 'present', schoolDay = dateInput().value) => ({
  id: `attendance-${id}`, enrollmentId: `enrollment-${id}`, schoolDay, status,
});
async function complete(index: number, id: string) {
  await act(async () => gets[index].task.resolve(response({ success: true, roster: [row(id)] })));
}
async function start() {
  render(<AttendancePage />);
  await waitFor(() => expect(gets).toHaveLength(1));
}

beforeEach(() => {
  gets.length = 0;
  commands.length = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === '/api/education/attendance/courses') return Promise.resolve(response({ success: true, classrooms: courses }));
    if (!init?.method && url.startsWith('/api/education/attendance?')) {
      const task = deferred<Reply>();
      gets.push({ url, task });
      return task.promise;
    }
    if (init?.method === 'POST') {
      const task = deferred<Reply>();
      commands.push({ url, init, task });
      return task.promise;
    }
    throw new Error(`Unscripted synthetic request: ${url}`);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
});

it('ignores a late old-course success after the selected course has loaded', async () => {
  await start();
  fireEvent.click(screen.getByRole('button', { name: /Synthetic Class B/ }));
  await waitFor(() => expect(gets).toHaveLength(2));
  await complete(1, 'B');
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
  await complete(0, 'A');
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
  expect(posts()).toHaveLength(0);
});

it.each(['pending', 'loaded'] as const)('ignores old failure/finally while the selected roster is %s', async (phase) => {
  await start();
  fireEvent.click(screen.getByRole('button', { name: /Synthetic Class B/ }));
  await waitFor(() => expect(gets).toHaveLength(2));
  if (phase === 'loaded') await complete(1, 'B');
  await act(async () => gets[0].task.reject(new Error('OLD_CONTEXT_FAILURE')));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  if (phase === 'pending') {
    expect(within(table()).getByText('Đang tải danh sách thật...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
    await complete(1, 'B');
  }
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
});

it('clears an invalid/empty day, sends no invalid GET, and ignores the old response', async () => {
  await start();
  fireEvent.change(dateInput(), { target: { value: '' } });
  expect(gets).toHaveLength(1);
  await complete(0, 'OLD');
  expect(screen.queryAllByText('Synthetic Child OLD')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  expect(posts()).toHaveLength(0);
});

it('has no actionable roster or request when there are no courses', async () => {
  fetchMock.mockResolvedValueOnce(response({ success: true, classrooms: [] }));
  render(<AttendancePage />);
  await screen.findByText('Chưa có lớp đang hoạt động');
  expect(gets).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  expect(posts()).toHaveLength(0);
});

it('shows unknown class metadata and preserves an observed empty roster as zero', async () => {
  fetchMock.mockResolvedValueOnce(response({ success: true, classrooms: [
    { ...courses[0], gradeKey: null, maxStudents: null, students: 4 },
  ] }));
  await start();
  await act(async () => gets[0].task.resolve(response({ success: true, roster: [] })));
  const classroom = within(screen.getByRole('button', { name: /Synthetic Class A/ }));
  expect(classroom.getByText('Chưa có dữ liệu khối tuổi')).toBeInTheDocument();
  expect(classroom.getByText(/Chưa có dữ liệu sức chứa/)).toBeInTheDocument();
  expect(classroom.getByText('0', { selector: 'span.font-extrabold' })).toBeInTheDocument();
  expect(posts()).toHaveLength(0);
});

it.each(['attendance', 'handover'] as const)('locks context and concurrent commands until %s finishes, keeping the original payload', async (kind) => {
  await start();
  await complete(0, 'A');
  const day = dateInput().value;
  const action = screen.getByRole('button', { name: kind === 'attendance' ? 'Có Mặt' : 'Bàn giao' });
  fireEvent.click(action);
  fireEvent.click(action);
  expect(posts()).toHaveLength(1);
  expect(dateInput()).toBeDisabled();
  const otherCourse = screen.getByRole('button', { name: /Synthetic Class B/ });
  expect(otherCourse).toBeDisabled();
  fireEvent.click(otherCourse);
  fireEvent.change(dateInput(), { target: { value: '2027-02-03' } });
  expect(dateInput()).toHaveValue(day);
  expect(gets).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Vắng' })).toBeDisabled();
  expect(commands[0].url).toBe(kind === 'attendance' ? '/api/education/attendance' : '/api/education/attendance/handover');
  expect(JSON.parse(String(commands[0].init.body))).toEqual(kind === 'attendance'
    ? { enrollmentId: 'enrollment-A', status: 'present', date: day }
    : { studentPartyId: 'party-A', guardianPartyId: 'guardian-A', pickupAuthorizationId: 'authorization-A' });
  await act(async () => commands[0].task.resolve(response({ success: true, attendance: attendanceReply() })));
  if (kind === 'handover') {
    expect(gets).toHaveLength(2);
    expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('courseId')).toBe('course-A');
    expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('date')).toBe(day);
    expect(dateInput()).toBeDisabled();
    expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await complete(1, 'READBACK');
    expect(within(table()).getByText('Synthetic Child READBACK')).toBeInTheDocument();
  } else {
    expect(gets).toHaveLength(1);
    expect(studentRow('A').getByText('Có Mặt', { selector: 'span' })).toBeInTheDocument();
  }
  expect(dateInput()).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent(kind === 'attendance' ? 'Đã ghi nhận điểm danh' : 'Đã bàn giao Synthetic Child A');
  fireEvent.click(otherCourse);
  const nextGet = kind === 'attendance' ? 1 : 2;
  expect(gets).toHaveLength(nextGet + 1);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await complete(nextGet, 'B');
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
});

it('distinguishes a successful handover POST from failed readback and requires fresh data before another command', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Bàn giao' }));
  await act(async () => commands[0].task.resolve(response({ success: true })));
  expect(gets).toHaveLength(2);
  await act(async () => gets[1].task.reject(new Error('SYNTHETIC_READBACK_FAILURE')));
  expect(screen.getByRole('alert')).toHaveTextContent('chưa tải lại được danh sách');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  expect(posts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  await complete(2, 'FRESH');
  expect(within(table()).getByText('Synthetic Child FRESH')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('blocks grade-based course changes during a pending write and recovers the original context', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  const otherGrade = screen.getByRole('button', { name: /Khối Chồi/ });
  expect(otherGrade).toBeDisabled();
  fireEvent.click(otherGrade);
  expect(gets).toHaveLength(1);
  expect(posts()).toHaveLength(1);
  await act(async () => commands[0].task.reject(new TypeError('SYNTHETIC_LOST_ACKNOWLEDGEMENT')));
  expect(screen.getByRole('alert')).toHaveTextContent('SYNTHETIC_LOST_ACKNOWLEDGEMENT');
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('courseId')).toBe('course-A');
  await complete(1, 'FRESH');
  expect(within(table()).getByText('Synthetic Child FRESH')).toBeInTheDocument();
  expect(otherGrade).toBeEnabled();
});

it('keeps POST failure honest and invalidates stale actions until explicit readback', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[0].task.resolve(response({ success: false, error: 'SYNTHETIC_POST_FAILURE' }, false)));
  expect(screen.getByRole('alert')).toHaveTextContent('SYNTHETIC_POST_FAILURE');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(gets).toHaveLength(1);
  expect(dateInput()).toBeEnabled();
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử tải lại danh sách' })).toBeEnabled();
  expect(posts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  await complete(1, 'FRESH');
  expect(within(table()).getByText('Synthetic Child FRESH')).toBeInTheDocument();
  expect(posts()).toHaveLength(1);
});

it('requires canonical readback after a lost acknowledgement instead of offering a blind repeat write', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[0].task.reject(new TypeError('SYNTHETIC_LOST_ACKNOWLEDGEMENT')));
  expect(screen.getByRole('alert')).toHaveTextContent('SYNTHETIC_LOST_ACKNOWLEDGEMENT');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(gets).toHaveLength(1);
  expect(posts()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  await complete(1, 'READBACK');
  expect(within(table()).getByText('Synthetic Child READBACK')).toBeInTheDocument();
  expect(posts()).toHaveLength(1);
});

it('does not issue readback after the page unmounts during a command', async () => {
  const view = render(<AttendancePage />);
  await waitFor(() => expect(gets).toHaveLength(1));
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  view.unmount();
  await act(async () => commands[0].task.resolve(response({ success: true, attendance: attendanceReply('A', 'present', '2026-10-19') })));
  expect(gets).toHaveLength(1);
  expect(posts()).toHaveLength(1);
});

it('ignores a late old-day success after the selected day has loaded', async () => {
  await start();
  const firstDay = dateInput().value;
  const nextDay = firstDay === '2026-10-18' ? '2026-10-19' : '2026-10-18';
  fireEvent.change(dateInput(), { target: { value: nextDay } });
  await waitFor(() => expect(gets).toHaveLength(2));
  expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('date')).toBe(nextDay);
  await complete(1, 'NEW-DAY');
  await complete(0, 'OLD-DAY');
  expect(screen.queryAllByText('Synthetic Child OLD-DAY')).toHaveLength(0);
  expect(within(table()).getByText('Synthetic Child NEW-DAY')).toBeInTheDocument();
});

it('hides stale pickup cards immediately while another course loads', async () => {
  await start();
  await complete(0, 'A');
  expect(screen.getByRole('button', { name: 'Bàn giao' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /Synthetic Class B/ }));
  await waitFor(() => expect(gets).toHaveLength(2));
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  expect(posts()).toHaveLength(0);
});


it('merges only confirmed attendance, preserves other rows and pickup data, and derives counts and filters without GETs', async () => {
  await start();
  const second = { ...row('B'), safePickupHandover: {
    id: 'handover-B', studentPartyId: 'party-B', guardianPartyId: 'guardian-B',
    pickupAuthorizationId: 'authorization-B', handedOverAt: '2026-10-19T08:00:00.000Z', handedOverBy: 'actor',
  } };
  await act(async () => gets[0].task.resolve(response({ success: true, roster: [row('A'), second] })));
  const otherStudent = studentRow('B').getByText('Synthetic Child B');
  const otherGuardian = screen.getByText('Được phép đón: Synthetic Guardian B');
  const initialReads = fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST').length;
  fireEvent.click(studentRow('A').getByRole('button', { name: 'Có Mặt' }));
  expect(otherStudent).toBeInTheDocument();
  expect(screen.queryByText('Đang tải danh sách thật...')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chưa điểm (2)' })).toBeInTheDocument();
  // The canonical POST result, rather than the requested status, supplies the displayed status.
  await act(async () => commands[0].task.resolve(response({ success: true, attendance: attendanceReply('A', 'excused') })));
  expect(studentRow('A').getByText('Có Phép', { selector: 'span' })).toBeInTheDocument();
  expect(otherStudent).toBeInTheDocument();
  expect(otherGuardian).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phép (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chưa điểm (1)' })).toBeInTheDocument();
  expect(within(screen.getByRole('button', { name: /Synthetic Class A/ })).getByText('1 phép')).toBeInTheDocument();
  fireEvent.click(studentRow('A').getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[1].task.resolve(response({ success: true, attendance: attendanceReply() })));
  expect(screen.getByRole('button', { name: 'Có mặt (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phép (0)' })).toBeInTheDocument();
  fireEvent.click(studentRow('A').getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[2].task.resolve(response({ success: true, attendance: attendanceReply() })));
  expect(screen.getByRole('button', { name: 'Có mặt (1)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Có mặt (1)' }));
  expect(within(table()).getByText('Synthetic Child A')).toBeInTheDocument();
  expect(within(table()).queryByText('Synthetic Child B')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả (2)' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Lọc đưa đón' }), { target: { value: 'handed_over' } });
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
  expect(within(table()).queryByText('Synthetic Child A')).not.toBeInTheDocument();
  expect(gets).toHaveLength(1);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST')).toHaveLength(initialReads);
  expect(posts()).toHaveLength(3);
});

it.each(['missing', 'null', 'wrong-enrollment', 'wrong-day', 'wrong-status', 'missing-id', 'truthy-success'] as const)(
  'rejects %s attendance confirmation and requires canonical read-back before another command', async (kind) => {
    await start();
    await complete(0, 'A');
    const confirmed = attendanceReply();
    const attendance: unknown = kind === 'missing' ? undefined : kind === 'null' ? null : {
      ...confirmed,
      ...(kind === 'wrong-enrollment' ? { enrollmentId: 'enrollment-OTHER' } : {}),
      ...(kind === 'wrong-day' ? { schoolDay: '2000-01-01' } : {}),
      ...(kind === 'wrong-status' ? { status: 'unmarked' } : {}),
      ...(kind === 'missing-id' ? { id: '' } : {}),
    };
    fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
    await act(async () => commands[0].task.resolve(response({ success: kind === 'truthy-success' ? 'true' : true, attendance })));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(table()).queryByText('Synthetic Child A')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
    expect(gets).toHaveLength(1);
    expect(posts()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
    await waitFor(() => expect(gets).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
    await complete(1, 'A');
    expect(studentRow('A').getByText('Chưa điểm danh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chưa điểm (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Có Mặt' })).toBeEnabled();
  },
);

it('recovers the actual committed attendance after a lost response before permitting retry', async () => {
  await start();
  const day = dateInput().value;
  await act(async () => gets[0].task.resolve(response({ success: true, roster: [{ ...row('A'), attendance: attendanceReply('A', 'excused', day) }] })));
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[0].task.reject(new Error('NETWORK_FAILURE')));
  expect(screen.getByRole('alert')).toHaveTextContent('NETWORK_FAILURE');
  expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  await waitFor(() => expect(gets).toHaveLength(2));
  await act(async () => gets[1].task.resolve(response({ success: true, roster: [{ ...row('A'), attendance: attendanceReply('A', 'present', day) }] })));
  expect(studentRow('A').getByText('Có Mặt', { selector: 'span' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Có mặt (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phép (0)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[1].task.resolve(response({ success: true, attendance: attendanceReply('A', 'absent', day) })));
  expect(screen.getByRole('button', { name: 'Vắng (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phép (0)' })).toBeInTheDocument();
  expect(gets).toHaveLength(2);
});

it('keeps attendance and pickup commands unavailable when read-back is denied after an uncertain write', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[0].task.reject(new Error('NETWORK_FAILURE')));
  fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại danh sách' }));
  await waitFor(() => expect(gets).toHaveLength(2));
  await act(async () => gets[1].task.resolve(response({ success: false, error: 'CURRENT_BRANCH_ACCESS_DENIED' }, false)));
  expect(screen.getByRole('alert')).toHaveTextContent('CURRENT_BRANCH_ACCESS_DENIED');
  expect(within(table()).queryByText('Synthetic Child A')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Có Mặt' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(posts()).toHaveLength(1);
});
