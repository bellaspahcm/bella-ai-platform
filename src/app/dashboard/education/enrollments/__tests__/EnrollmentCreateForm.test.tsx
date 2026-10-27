/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnrollmentCreateForm } from '../EnrollmentCreateForm';

type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const originalRandomUUID = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
const mockRandomUUID = jest.fn<() => string>();
const course = { id: 'course-a', tenantId: 'tenant-a', title: 'Lớp Mầm', courseCode: 'MAM-01' };
const candidatePayload = {
  success: true,
  courseId: course.id,
  tenantId: course.tenantId,
  nextCursor: null,
  candidates: [{
    studentPartyId: 'student-party-1', studentLabel: 'Bé An',
    guardians: [{ guardianPartyId: 'guardian-party-1', guardianLabel: 'Nguyễn An' }],
  }],
};
const reply = (payload: unknown, status = 200): Reply => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

beforeEach(() => {
  mockFetch.mockReset();
  mockRandomUUID.mockReset().mockReturnValueOnce('stable-request-id').mockReturnValue('new-request-id');
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: mockFetch });
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: mockRandomUUID });
});
afterEach(() => {
  cleanup();
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
  else Reflect.deleteProperty(globalThis, 'fetch');
  if (originalRandomUUID) Object.defineProperty(globalThis.crypto, 'randomUUID', originalRandomUUID);
  else Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
});

describe('Preschool Enrollment UI integration', () => {
  it('keeps the workflow blocked and sends no POST while candidate discovery is unavailable', async () => {
    mockFetch.mockResolvedValueOnce(reply({ success: false, error: 'ENROLLMENT_WORKFLOW_UNAVAILABLE' }, 503));
    render(<EnrollmentCreateForm course={course} onEnrolled={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Chưa thể tải danh sách học sinh đủ điều kiện');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('view=candidates');
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('requires explicit Student and guardian selections and posts the exact selected IDs', async () => {
    mockFetch.mockResolvedValueOnce(reply(candidatePayload));
    const onEnrolled = jest.fn();
    render(<EnrollmentCreateForm course={course} onEnrolled={onEnrolled} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    const confirm = await screen.findByRole('button', { name: 'Xác nhận ghi danh' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Học sinh' }), { target: { value: 'student-party-1' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Người giám hộ' }), { target: { value: 'guardian-party-1' } });
    expect(confirm).toBeEnabled();
    mockFetch.mockResolvedValueOnce(reply({ success: true, enrollment: {
      id: 'enrollment-1', tenantId: course.tenantId, courseId: course.id, studentPartyId: 'student-party-1', status: 'active',
    } }));
    fireEvent.click(confirm);

    await waitFor(() => expect(onEnrolled).toHaveBeenCalledWith(course.id));
    const post = mockFetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      courseId: course.id,
      studentPartyId: 'student-party-1',
      guardianPartyId: 'guardian-party-1',
      requestId: 'stable-request-id',
    });
  });

  it('reuses one request ID when the user retries a failed write', async () => {
    mockFetch.mockResolvedValueOnce(reply(candidatePayload));
    render(<EnrollmentCreateForm course={course} onEnrolled={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    await screen.findByRole('combobox', { name: 'Học sinh' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Học sinh' }), { target: { value: 'student-party-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Người giám hộ' }), { target: { value: 'guardian-party-1' } });
    mockFetch.mockResolvedValueOnce(reply({ success: false }, 503)).mockResolvedValueOnce(reply({ success: false }, 503));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi danh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Có thể thử lại');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi danh' }));
    await waitFor(() => expect(mockFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2));
    const requestIds = mockFetch.mock.calls.filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)).requestId);
    expect(requestIds).toEqual(['stable-request-id', 'stable-request-id']);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed candidate data rather than rendering selectable identities', async () => {
    mockFetch.mockResolvedValueOnce(reply({ ...candidatePayload, candidates: [{ studentPartyId: 'student-party-1', studentLabel: 'Bé An', guardians: 'unknown' }] }));
    render(<EnrollmentCreateForm course={course} onEnrolled={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác minh danh sách học sinh');
    expect(screen.queryByRole('combobox', { name: 'Học sinh' })).not.toBeInTheDocument();
  });

  it('continues a bounded search after an empty scanned page without offering an automatic selection', async () => {
    const cursor = '12345678-1111-4111-8111-111111111111';
    mockFetch.mockResolvedValueOnce(reply({ ...candidatePayload, candidates: [], nextCursor: cursor }))
      .mockResolvedValueOnce(reply(candidatePayload));
    render(<EnrollmentCreateForm course={course} onEnrolled={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kết quả tiếp theo' }));
    expect(await screen.findByRole('combobox', { name: 'Học sinh' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Xác nhận ghi danh' })).toBeDisabled();
    const nextUrl = new URL(String(mockFetch.mock.calls[1][0]), 'http://localhost');
    expect(nextUrl.searchParams.get('cursor')).toBe(cursor);
    expect(nextUrl.searchParams.get('query')).toBe('An');
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('discards the old Course candidate response even when transport ignores abort', async () => {
    let resolve: (value: Reply) => void = () => { throw Error('No pending search'); };
    mockFetch.mockReturnValueOnce(new Promise<Reply>(res => { resolve = res; }));
    const { rerender } = render(<EnrollmentCreateForm course={course} onEnrolled={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi danh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học sinh' }), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm học sinh' }));
    rerender(<EnrollmentCreateForm course={{ ...course, id: 'course-b' }} onEnrolled={jest.fn()} />);
    await act(async () => { resolve(reply(candidatePayload)); });
    expect(screen.getByRole('textbox', { name: 'Tìm học sinh' })).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Học sinh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận ghi danh' })).not.toBeInTheDocument();
  });
});
