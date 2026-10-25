/** @jest-environment jsdom */
import { beforeEach, expect, it, jest } from '@jest/globals';
import { useLayoutEffect } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

let currentId = 'SYN-CHILD-001';
jest.mock('next/navigation', () => ({ useParams: () => ({ id: currentId }) }));
const mockGuardianSection = jest.fn<(props: { studentId: string }) => void>();
jest.mock('../StudentGuardians', () => ({
  __esModule: true,
  default: (props: { studentId: string }) => {
    mockGuardianSection(props);
    return <div data-testid="guardian-section" />;
  },
}));
const Student360Page = (require('../page') as typeof import('../page')).default;

const enrollmentId = '00000000-0000-4000-8000-000000000011';
const courseId = '00000000-0000-4000-8000-000000000012';
const branchId = '00000000-0000-4000-8000-000000000013';
const eventId = '00000000-0000-4000-8000-000000000014';
const canonicalProfile = {
  id: 'SYN-CHILD-001',
  studentId: '00000000-0000-4000-8000-000000000001',
  partyId: '00000000-0000-4000-8000-000000000002',
  name: 'Synthetic Child',
  dob: '2022-04-10',
  gender: 'female',
  enrollments: [{
    id: enrollmentId,
    courseId,
    courseCode: 'SYN-C01',
    courseTitle: 'Synthetic Class',
    branchId,
    branchName: 'Synthetic Branch',
    status: 'active',
  }],
  attendance: {
    present: 1,
    absent: 0,
    excused: 0,
    totalRecords: 1,
    records: [{
      id: eventId,
      enrollmentId,
      courseId,
      courseTitle: 'Synthetic Class',
      status: 'present',
      rollCallTime: '2026-10-24T01:30:00.000Z',
    }],
  },
};

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  cleanup();
  currentId = 'SYN-CHILD-001';
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue(response(200, { success: true, profile: canonicalProfile }));
  window.localStorage.clear();
  mockGuardianSection.mockClear();
});

it('shows only canonical identity, enrollment and raw attendance evidence', async () => {
  render(<Student360Page />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Child' })).toBeTruthy();
  expect(screen.getAllByText('Synthetic Class').length).toBeGreaterThan(0);
  expect(screen.getByText(/Synthetic Branch/)).toBeTruthy();
  expect(screen.getAllByText('Có mặt')).toHaveLength(2);
  expect(screen.getByText(eventId)).toBeTruthy();
  expect(screen.queryByText(/36[,.]6/)).toBeNull();
  expect(screen.queryByText(/Face ID/i)).toBeNull();
  expect(screen.queryByText(/NAEYC/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /lưu|chỉnh sửa|thu tiền|gửi/i })).toBeNull();
  expect(window.localStorage.length).toBe(0);
  expect(mockGuardianSection).toHaveBeenCalledWith({ studentId: canonicalProfile.studentId });
  expect(global.fetch).toHaveBeenCalledWith('/api/education/enrollments/SYN-CHILD-001', expect.objectContaining({ cache: 'no-store' }));
});

it.each([
  [401, 'STUDENT_PROFILE_UNAUTHENTICATED', 'Phiên đăng nhập không còn hợp lệ'],
  [403, 'STUDENT_PROFILE_ACCESS_DENIED', 'không có quyền xem hồ sơ'],
  [404, 'STUDENT_PROFILE_NOT_FOUND', 'Không tìm thấy trẻ'],
  [503, 'STUDENT_PROFILE_UNAVAILABLE', 'Chưa thể tải hồ sơ đã xác minh'],
] as const)('renders HTTP %s as an explicit failure with no fallback child', async (status, code, message) => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(status, { success: false, error: code }));
  render(<Student360Page />);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(message);
  expect(screen.queryByText('Synthetic Child')).toBeNull();
  expect(window.localStorage.length).toBe(0);
});

it('rejects a malformed success payload instead of displaying partial data', async () => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(200, {
    success: true,
    profile: { ...canonicalProfile, attendance: { ...canonicalProfile.attendance, totalRecords: 9 } },
  }));
  render(<Student360Page />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa thể tải hồ sơ đã xác minh');
  expect(screen.queryByText('Synthetic Child')).toBeNull();
});

it('clears the previous profile while navigating and ignores the late prior response', async () => {
  let resolveFirst: ((value: Response) => void) | undefined;
  const first = new Promise<Response>(resolve => { resolveFirst = resolve; });
  const fetchMock = jest.fn<typeof fetch>()
    .mockImplementationOnce(() => first)
    .mockResolvedValueOnce(response(404, { success: false, error: 'STUDENT_PROFILE_NOT_FOUND' }));
  global.fetch = fetchMock;
  const view = render(<Student360Page />);
  currentId = 'SYN-CHILD-002';
  view.rerender(<Student360Page />);
  expect((await screen.findByRole('alert')).textContent).toContain('Không tìm thấy trẻ');
  resolveFirst?.(response(200, { success: true, profile: canonicalProfile }));
  await waitFor(() => expect(screen.queryByText('Synthetic Child')).toBeNull());
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/education/enrollments/SYN-CHILD-002', expect.objectContaining({ cache: 'no-store' }));
});


it('never commits old profile or Guardian section when the route selector changes', async () => {
  const staleFrames: boolean[] = [];
  function Frame() {
    useLayoutEffect(() => {
      if (currentId === 'SYN-CHILD-002') {
        staleFrames.push(Boolean(document.querySelector('[data-testid="guardian-section"]'))
          || (document.body.textContent?.includes('Synthetic Child') ?? false));
      }
    });
    return <Student360Page />;
  }
  const view = render(<Frame />);
  expect(await screen.findByRole('heading', { name: 'Synthetic Child' })).toBeTruthy();
  (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() => new Promise<Response>(() => {}));
  currentId = 'SYN-CHILD-002';
  view.rerender(<Frame />);
  expect(staleFrames).toEqual([false]);
  expect(screen.queryByTestId('guardian-section')).toBeNull();
  expect(screen.queryByText('Synthetic Child')).toBeNull();
});
