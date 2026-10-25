/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnrollmentsPage from '../page';

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));

type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const course = (id: string, status: 'active' | 'draft' = 'active') => ({
  id, tenantId: 'tenant-a', courseCode: `CODE-${id}`, title: `Class ${id}`, status,
});
const reply = (payload: unknown, status = 200): Reply => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const rosterRow = (studentId = 'student/a?x=1') => ({
  enrollmentId: 'enrollment-1', studentId, studentPartyId: 'party-1', studentCode: 'P-001',
  name: 'Pupil One', gender: null, dob: null, enrollmentStatus: 'active', attendance: null,
});
const catalog = (courses = [course('course-a')]) => reply({ success: true, courses });
const roster = (rows: unknown[] = [rosterRow()], courseId = 'course-a') => reply({
  success: true, courseId, schoolDay: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()), roster: rows,
});
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw Error('Deferred unresolved'); };
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/dashboard/education/enrollments');
  mockFetch.mockReset();
  // Existing active-roster regressions stay independent of the new school-registry request.
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith('/api/education/student-registry') ? Promise.resolve(reply({ success: true, registry: {
      tenantId: '00000000-0000-0000-0000-000000000001', request: { query: '', status: 'all', courseId: null, branchId: null, offset: 0, limit: 20 },
      totals: { students: 0, active: 0, pending: 0 }, filteredTotal: 0, nextOffset: null, students: [],
    } })) : mockFetch(input, init) });
});
afterEach(() => {
  cleanup(); window.history.replaceState(null, '', '/');
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
  else Reflect.deleteProperty(globalThis, 'fetch');
});

describe('Preschool Enrollment list backed by authorized active roster', () => {
  it('loads canonical active Courses then renders roster and encoded student link', async () => {
    mockFetch.mockResolvedValueOnce(catalog([course('course-a'), course('draft', 'draft')])).mockResolvedValueOnce(roster());
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('link', { name: 'Pupil One' })).toHaveAttribute('href', '/dashboard/education/enrollments/student%2Fa%3Fx%3D1?courseId=course-a');
    expect(screen.getByText(/P-001 · Class course-a/)).toBeInTheDocument();
    expect(screen.getByText('Điểm danh hôm nay: Chưa điểm danh')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /draft/ })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/education/courses?view=catalog');
    expect(mockFetch.mock.calls[0][1]?.cache).toBe('no-store');
    const rosterUrl = new URL(String(mockFetch.mock.calls[1][0]), 'http://localhost');
    expect(rosterUrl.pathname).toBe('/api/education/attendance');
    expect(rosterUrl.searchParams.get('view')).toBe('roster');
    expect(rosterUrl.searchParams.get('courseId')).toBe('course-a');
    expect(rosterUrl.searchParams.get('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockFetch.mock.calls[1][1]?.cache).toBe('no-store');
  });

  it.each([
    ['catalog denial', [reply({ success: false }, 403)], 'Không thể tải danh mục lớp'],
    ['roster denial', [catalog(), reply({ success: false }, 403)], 'Không thể xác minh roster'],
  ])('fails closed on %s', async (_label, responses, expected) => {
    for (const response of responses) mockFetch.mockResolvedValueOnce(response);
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.queryByRole('link', { name: 'Pupil One' })).not.toBeInTheDocument();
  });

  it.each([
    { ...rosterRow(), enrollmentStatus: 'pending' },
    { ...rosterRow(), attendance: { id: 'a1', tenantId: 'tenant-foreign', enrollmentId: 'enrollment-1', schoolDay: '2026-10-22', status: 'present', createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' } },
    { ...rosterRow(), studentId: '' },
  ])('rejects invalid or out-of-scope roster entries', async row => {
    mockFetch.mockResolvedValueOnce(catalog()).mockResolvedValueOnce(roster([row]));
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác minh roster');
    expect(screen.queryByRole('link', { name: 'Pupil One' })).not.toBeInTheDocument();
  });

  it('does not retain old roster after changing Course', async () => {
    const nextRoster = deferred<Reply>();
    mockFetch.mockResolvedValueOnce(catalog([course('course-a'), course('course-b')]))
      .mockResolvedValueOnce(roster([rosterRow('student-a')], 'course-a'))
      .mockReturnValueOnce(nextRoster.promise);
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('link', { name: 'Pupil One' })).toHaveAttribute('href', '/dashboard/education/enrollments/student-a?courseId=course-a');
    fireEvent.change(screen.getByRole('combobox', { name: 'Lớp học' }), { target: { value: 'course-b' } });
    expect(screen.queryByRole('link', { name: 'Pupil One' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải roster');
    nextRoster.resolve(roster([rosterRow('student-b')], 'course-b'));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Pupil One' })).toHaveAttribute('href', '/dashboard/education/enrollments/student-b?courseId=course-b'));
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
  it('restores an authorized Course from the back link instead of defaulting to the first Course', async () => {
    window.history.replaceState(null, '', '/dashboard/education/enrollments?courseId=course-b');
    mockFetch.mockResolvedValueOnce(catalog([course('course-a'), course('course-b')])).mockResolvedValueOnce(roster([rosterRow('student-b')], 'course-b'));
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('link', { name: 'Pupil One' })).toHaveAttribute('href', '/dashboard/education/enrollments/student-b?courseId=course-b');
    expect(screen.getByRole('combobox', { name: 'Lớp học' })).toHaveValue('course-b');
  });

  it.each(['?courseId=foreign', '?courseId=course-a&courseId=course-b', '?courseId='])('rejects an invalid Course hint without a roster request: %s', async query => {
    window.history.replaceState(null, '', '/dashboard/education/enrollments' + query);
    mockFetch.mockResolvedValueOnce(catalog());
    render(<EnrollmentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh mục lớp');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

});
