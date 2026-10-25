/** @jest-environment jsdom */
import { beforeEach, expect, it, jest } from '@jest/globals';
import { useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentGuardians from '../StudentGuardians';

const studentId = 'ed100000-0003-0000-0000-000000000001';
const firstGuardianId = 'ed100000-0004-0000-0000-000000000001';
const secondGuardianId = 'ed100000-0004-0000-0000-000000000002';
const payload = {
  studentId,
  studentPartyId: 'ed100000-0005-0000-0000-000000000001',
  asOfDate: '2026-10-24',
  complete: true,
  guardianCount: 2,
  guardians: [
    {
      guardianPartyId: firstGuardianId,
      displayName: 'Nguyễn Văn Phụ Huynh',
      phone: '0900000001',
      phoneState: 'recorded',
      relationships: [{
        id: 'ed100000-0006-0000-0000-000000000001',
        type: 'parent_of',
        activeFrom: '2026-01-01',
        activeTo: null,
      }],
      pickupStatus: 'authorized',
    },
    {
      guardianPartyId: secondGuardianId,
      displayName: 'Trần Thị Giám Hộ',
      phone: null,
      phoneState: 'missing',
      relationships: [{
        id: 'ed100000-0006-0000-0000-000000000002',
        type: 'guardian_of',
        activeFrom: null,
        activeTo: '2026-12-31',
      }],
      pickupStatus: 'revoked',
    },
  ],
};

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue(response(200, { success: true, guardians: payload }));
});

it('renders every current Guardian while keeping relationship and pickup truth separate', async () => {
  render(<StudentGuardians studentId={studentId} />);
  expect(await screen.findByText('Nguyễn Văn Phụ Huynh')).toBeTruthy();
  expect(screen.getByText('Trần Thị Giám Hộ')).toBeTruthy();
  expect(screen.getByText('Cha/mẹ')).toBeTruthy();
  expect(screen.getByText('Người giám hộ', { selector: 'span' })).toBeTruthy();
  expect(screen.getByText('0900000001')).toBeTruthy();
  expect(screen.getByText('Dữ liệu quan hệ tại ngày 24/10/2026.')).toBeTruthy();
  expect(screen.getByText('Chưa ghi nhận số điện thoại')).toBeTruthy();
  const authorized = screen.getByText('Được phép đón trẻ').closest('p');
  const revoked = screen.getByText('Quyền đón đã thu hồi').closest('p');
  expect(authorized?.getAttribute('data-pickup-status')).toBe('authorized');
  expect(authorized?.className).toContain('text-emerald-700');
  expect(revoked?.getAttribute('data-pickup-status')).toBe('revoked');
  expect(revoked?.className).toContain('text-rose-700');
  expect(screen.queryByRole('button', { name: /lưu|sửa|cấp quyền đón/i })).toBeNull();
  expect(window.localStorage.length).toBe(0);
  expect(global.fetch).toHaveBeenCalledWith(
    `/api/education/enrollments/${studentId}/guardians`,
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('presents an unrecorded pickup decision as a neutral warning', async () => {
  const unrecorded = {
    ...payload,
    guardianCount: 1,
    guardians: [{ ...payload.guardians[0], pickupStatus: 'not_recorded' }],
  };
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(200, {
    success: true,
    guardians: unrecorded,
  }));
  render(<StudentGuardians studentId={studentId} />);
  const status = (await screen.findByText('Chưa ghi nhận quyền đón')).closest('p');
  expect(status?.getAttribute('data-pickup-status')).toBe('not_recorded');
  expect(status?.className).toContain('text-amber-700');
});

it('shows a canonical complete empty state without inventing a Guardian', async () => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(200, {
    success: true,
    guardians: { ...payload, guardianCount: 0, guardians: [] },
  }));
  render(<StudentGuardians studentId={studentId} />);
  expect(await screen.findByText('Chưa có quan hệ người giám hộ được ghi nhận tại ngày dữ liệu.')).toBeTruthy();
  expect(screen.queryByText('Nguyễn Văn Phụ Huynh')).toBeNull();
});

it.each([
  [401, 'Phiên đăng nhập không còn hợp lệ'],
  [403, 'không có quyền xem người giám hộ'],
  [503, 'Chưa thể tải danh sách người giám hộ'],
] as const)('shows HTTP %s as a local section failure and preserves zero side effects', async (status, message) => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(status, {
    success: false,
    error: 'SANITIZED',
  }));
  render(<StudentGuardians studentId={studentId} />);
  expect((await screen.findByRole('alert')).textContent).toContain(message);
  expect(window.localStorage.length).toBe(0);
});

it('rejects malformed partial success and retries only on user action', async () => {
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
  fetchMock.mockResolvedValueOnce(response(200, {
    success: true,
    guardians: { ...payload, complete: false },
  })).mockResolvedValueOnce(response(200, { success: true, guardians: payload }));
  render(<StudentGuardians studentId={studentId} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa thể tải');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Nguyễn Văn Phụ Huynh')).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('rejects a successful payload for a different Student', async () => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(response(200, {
    success: true,
    guardians: { ...payload, studentId: 'ed100000-0003-0000-0000-000000000099' },
  }));
  render(<StudentGuardians studentId={studentId} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa thể tải');
  expect(screen.queryByText('Nguyễn Văn Phụ Huynh')).toBeNull();
});

it('ignores a late response after Student navigation', async () => {
  let resolveFirst: ((value: Response) => void) | undefined;
  const first = new Promise<Response>(resolve => { resolveFirst = resolve; });
  const fetchMock = jest.fn<typeof fetch>()
    .mockImplementationOnce(() => first)
    .mockResolvedValueOnce(response(503, { success: false, error: 'UNAVAILABLE' }));
  global.fetch = fetchMock;
  const view = render(<StudentGuardians studentId={studentId} />);
  const nextStudent = 'ed100000-0003-0000-0000-000000000002';
  view.rerender(<StudentGuardians studentId={nextStudent} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Chưa thể tải');
  resolveFirst?.(response(200, { success: true, guardians: payload }));
  await waitFor(() => expect(screen.queryByText('Nguyễn Văn Phụ Huynh')).toBeNull());
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    `/api/education/enrollments/${nextStudent}/guardians`,
    expect.objectContaining({ cache: 'no-store' }),
  );
});
it('never commits previous Guardian contacts while switching from a ready Student', async () => {
  const nextStudentId = 'ed100000-0003-0000-0000-000000000002';
  const observedStaleContacts: boolean[] = [];
  function Frame({ selectedId }: { selectedId: string }) {
    useLayoutEffect(() => {
      if (selectedId === nextStudentId) {
        observedStaleContacts.push(document.body.textContent?.includes('Nguyễn Văn Phụ Huynh') ?? false);
      }
    }, [selectedId]);
    return <StudentGuardians studentId={selectedId} />;
  }
  const view = render(<Frame selectedId={studentId} />);
  expect(await screen.findByText('Nguyễn Văn Phụ Huynh')).toBeTruthy();
  (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() => new Promise<Response>(() => {}));
  view.rerender(<Frame selectedId={nextStudentId} />);
  expect(observedStaleContacts).toEqual([false]);
  expect(screen.queryByText('Nguyễn Văn Phụ Huynh')).toBeNull();
  expect(screen.queryByText('0900000001')).toBeNull();
  expect(screen.getByText('Đang tải người giám hộ…')).toBeTruthy();
});


it('shows an error and retry when a Guardian request stalls', async () => {
  jest.useFakeTimers();
  try {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() => new Promise<Response>(() => {}));
    render(<StudentGuardians studentId={studentId} />);
    await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(screen.getByRole('alert').textContent).toContain('Chưa thể tải');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(screen.queryByText('Nguyễn Văn Phụ Huynh')).toBeNull();
  } finally {
    cleanup();
    jest.useRealTimers();
  }
});
