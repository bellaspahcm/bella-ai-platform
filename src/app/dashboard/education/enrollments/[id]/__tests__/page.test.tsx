/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Student360Page from '../page';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'student-1' }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

const course = { id: 'course-1', tenantId: 'tenant-1', courseCode: 'PRE-K', title: 'Lớp Mầm', status: 'active' };
const draftCourse = { id: 'draft-1', tenantId: 'tenant-1', courseCode: 'DRAFT', title: 'Lớp nháp', status: 'draft' };
const row = {
  enrollmentId: 'enrollment-1', studentId: 'student-1', studentPartyId: 'party-1', studentCode: 'EDU-001',
  name: 'Học sinh thật', gender: 'Nữ', dob: '2022-03-12', enrollmentStatus: 'active', attendance: null,
};
const jsonResponse = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
} as Response);
const originalFetch = globalThis.fetch;

afterEach(() => { cleanup(); globalThis.fetch = originalFetch; window.history.replaceState(null, '', '/'); });

describe('Preschool student detail', () => {
  it('renders only a student returned by the authorized class roster', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, courses: [draftCourse, course] }))
      .mockImplementationOnce(async input => {
        const query = new URL(String(input), 'http://local.test').searchParams;
        return jsonResponse({ success: true, courseId: course.id, schoolDay: query.get('date'), roster: [row] });
      });
    globalThis.fetch = fetchMock;

    render(<Student360Page studentId="student-1" />);
    expect(await screen.findByRole('heading', { name: 'Học sinh thật' })).toBeInTheDocument();
    expect(screen.getByText('Lớp Mầm')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Lớp nháp/ })).not.toBeInTheDocument();
    expect(screen.getByText('Chưa điểm danh')).toBeInTheDocument();
    expect(screen.getByText(/Hồ sơ sức khỏe, học phí và lịch sử chưa khả dụng/)).toBeInTheDocument();
    expect(screen.queryByText(/Nguyễn Minh An|0901 234 567|96%|WHO|đã lưu thành công/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/education/courses?view=catalog');
    expect(fetchMock.mock.calls[0][1]?.cache).toBe('no-store');
    const rosterUrl = new URL(String(fetchMock.mock.calls[1][0]), 'http://local.test');
    expect(rosterUrl.pathname).toBe('/api/education/attendance');
    expect(rosterUrl.searchParams.get('view')).toBe('roster');
    expect(rosterUrl.searchParams.get('courseId')).toBe(course.id);
    expect(fetchMock.mock.calls[1][1]?.cache).toBe('no-store');
  });

  it('does not show profile data when catalog access is denied', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: false }, 403));
    globalThis.fetch = fetchMock;
    render(<Student360Page studentId="student-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Hồ sơ chưa khả dụng');
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('fails closed when roster access is denied', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, courses: [course] }))
      .mockResolvedValueOnce(jsonResponse({ success: false }, 403));
    globalThis.fetch = fetchMock;
    render(<Student360Page studentId="student-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác minh roster');
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
  });

  it('does not reveal a student who is absent from the authorized roster', async () => {
    const otherStudent = { ...row, studentId: 'different-student', name: 'Học sinh ngoài lớp' };
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, courses: [course] }))
      .mockImplementationOnce(async input => {
        const query = new URL(String(input), 'http://local.test').searchParams;
        return jsonResponse({ success: true, courseId: course.id, schoolDay: query.get('date'), roster: [otherStudent] });
      });
    globalThis.fetch = fetchMock;
    render(<Student360Page studentId="student-1" />);

    expect(await screen.findByText('Không tìm thấy học sinh trong roster lớp được cấp quyền.')).toBeInTheDocument();
    expect(screen.queryByText('Học sinh ngoài lớp')).not.toBeInTheDocument();
  });
  it('keeps the selected authorized Course on detail and the back link', async () => {
    const second = { ...course, id: 'course-2', title: 'Lớp Chồi' };
    window.history.replaceState(null, '', '/dashboard/education/enrollments/student-1?courseId=course-2');
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: true, courses: [course, second] }))
      .mockImplementationOnce(async input => jsonResponse({ success: true, courseId: second.id, schoolDay: new URL(String(input), 'http://local').searchParams.get('date'), roster: [row] }));
    globalThis.fetch = fetchMock;
    render(<Student360Page studentId="student-1" />);
    expect(await screen.findByRole('heading', { name: 'Học sinh thật' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lớp học' })).toHaveValue(second.id);
    expect(screen.getByRole('link', { name: /Quay lại/ })).toHaveAttribute('href', '/dashboard/education/enrollments?courseId=course-2');
    expect(new URL(String(fetchMock.mock.calls[1][0]), 'http://local').searchParams.get('courseId')).toBe(second.id);
  });

  it.each(['?courseId=foreign', '?courseId=course-1&courseId=course-2', '?courseId=draft-1', '?courseId='])('rejects an invalid Course hint with zero roster calls: %s', async query => {
    window.history.replaceState(null, '', '/dashboard/education/enrollments/student-1' + query);
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: true, courses: [course, draftCourse] }));
    globalThis.fetch = fetchMock; render(<Student360Page studentId="student-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Hồ sơ chưa khả dụng');
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
  });

  it('clears the old profile immediately on Course change and preserves that Course on reload', async () => {
    const second = { ...course, id: 'course-2', title: 'Lớp Chồi' };
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>(res => { resolve = res; });
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: true, courses: [course, second] }))
      .mockImplementationOnce(async input => jsonResponse({ success: true, courseId: course.id, schoolDay: new URL(String(input), 'http://local').searchParams.get('date'), roster: [row] }))
      .mockReturnValueOnce(pending);
    globalThis.fetch = fetchMock; render(<Student360Page studentId="student-1" />);
    await screen.findByRole('heading', { name: 'Học sinh thật' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Lớp học' }), { target: { value: second.id } });
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra roster');
    expect(new URL(window.location.href).searchParams.get('courseId')).toBe(second.id);
    await act(async () => resolve(jsonResponse({ success: false }, 403)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác minh roster');
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
  });

  it('does not render the previous Student while another profile request is pending', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: true, courses: [course] }))
      .mockImplementationOnce(async input => jsonResponse({ success: true, courseId: course.id, schoolDay: new URL(String(input), 'http://local').searchParams.get('date'), roster: [row] }))
      .mockReturnValueOnce(new Promise<Response>(() => undefined));
    globalThis.fetch = fetchMock; const { rerender } = render(<Student360Page studentId="student-1" />);
    await screen.findByRole('heading', { name: 'Học sinh thật' }); rerender(<Student360Page studentId="student-2" />);
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra roster');
  });

  it.each(['wrong-course', 'duplicate-row', 'invalid-date', 'transport'])('rejects malformed/failed roster without showing a profile: %s', async failure => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ success: true, courses: [course] }))
      .mockImplementationOnce(async input => {
        if (failure === 'transport') throw Error('offline');
        const day = new URL(String(input), 'http://local').searchParams.get('date');
        return jsonResponse({ success: true, courseId: failure === 'wrong-course' ? 'foreign' : course.id,
          schoolDay: failure === 'invalid-date' ? '2020-01-01' : day, roster: failure === 'duplicate-row' ? [row, row] : [row] });
      });
    globalThis.fetch = fetchMock; render(<Student360Page studentId="student-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác minh roster');
    expect(screen.queryByRole('heading', { name: 'Học sinh thật' })).not.toBeInTheDocument();
  });

});
