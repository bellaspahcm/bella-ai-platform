/** @jest-environment jsdom */

import React from 'react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AttendancePage from '../page';

// Synthetic HTTP fixtures verify context/ordering only, never guardian authority or DB/RLS.
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
    if (url === '/api/education/courses') return Promise.resolve(response({ success: true, classrooms: courses }));
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

it.each(['attendance', 'handover'] as const)('locks context and concurrent commands until %s POST and readback finish, keeping the original payload', async (kind) => {
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
  await act(async () => commands[0].task.resolve(response({ success: true })));
  expect(gets).toHaveLength(2);
  expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('courseId')).toBe('course-A');
  expect(new URL(gets[1].url, 'https://synthetic.invalid').searchParams.get('date')).toBe(day);
  expect(dateInput()).toBeDisabled();
  expect(screen.queryAllByText('Synthetic Child A')).toHaveLength(0);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await complete(1, 'READBACK');
  expect(within(table()).getByText('Synthetic Child READBACK')).toBeInTheDocument();
  expect(dateInput()).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent(kind === 'attendance' ? 'Đã ghi nhận điểm danh' : 'Đã bàn giao Synthetic Child A');
  fireEvent.click(otherCourse);
  expect(gets).toHaveLength(3);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await complete(2, 'B');
  expect(within(table()).getByText('Synthetic Child B')).toBeInTheDocument();
});

it.each(['attendance', 'handover'] as const)('distinguishes a successful %s POST from failed readback and requires fresh data before another command', async (kind) => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: kind === 'attendance' ? 'Có Mặt' : 'Bàn giao' }));
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

it('keeps POST failure honest without starting readback or reporting success', async () => {
  await start();
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  await act(async () => commands[0].task.resolve(response({ success: false, error: 'SYNTHETIC_POST_FAILURE' }, false)));
  expect(screen.getByRole('alert')).toHaveTextContent('SYNTHETIC_POST_FAILURE');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(gets).toHaveLength(1);
  expect(dateInput()).toBeEnabled();
  expect(within(table()).getByText('Synthetic Child A')).toBeInTheDocument();
});

it('does not issue readback after the page unmounts during a command', async () => {
  const view = render(<AttendancePage />);
  await waitFor(() => expect(gets).toHaveLength(1));
  await complete(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: 'Có Mặt' }));
  view.unmount();
  await act(async () => commands[0].task.resolve(response({ success: true })));
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
