/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PreschoolStudentRegistry } from '../PreschoolStudentRegistry';
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href}>{children}</a> }));
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const response = (offset = 0, status = 'all', query = '') => ({ success: true, registry: {
  tenantId: id(1), request: { query, status, courseId: null, branchId: null, offset, limit: 20 },
  totals: { students: 23, active: 20, pending: 3 }, filteredTotal: status === 'pending' ? 3 : 23,
  nextOffset: offset === 0 && status === 'all' ? 20 : null,
  students: Array.from({ length: status === 'pending' ? 3 : offset === 0 ? 20 : 3 }, (_, i) => ({
    id: id(100 + offset + i), tenantId: id(1), partyId: id(200 + offset + i), studentCode: `SYN-${offset + i}`,
    name: `Synthetic child ${offset + i}`, gender: null, dob: null,
    enrollments: [{ id: id(300 + offset + i), courseId: id(2), courseCode: 'SYN-C', courseTitle: 'Synthetic class',
      branchId: id(3), branchName: 'Synthetic branch', status: status === 'pending' ? 'pending' : 'active' }],
  })),
} });
type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const fetcher = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const original = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const ok = (value: unknown): Reply => ({ ok: true, status: 200, json: async () => value });
beforeEach(() => { fetcher.mockReset(); Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetcher }); });
afterEach(() => { cleanup(); if (original) Object.defineProperty(globalThis, 'fetch', original); else Reflect.deleteProperty(globalThis, 'fetch'); });
describe('School-wide registry, separate from daily active roster', () => {
  it('shows actual authorized totals and pages, including pending children without an unsupported active-profile link', async () => {
    fetcher.mockResolvedValueOnce(ok(response())).mockResolvedValueOnce(ok(response(20))).mockResolvedValueOnce(ok(response(0, 'pending')));
    render(<PreschoolStudentRegistry />);
    expect(await screen.findByText('Tổng hồ sơ: 23 · Đang học: 20 · Chờ nhập học: 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trang trẻ tiếp' }));
    expect(screen.queryByText('Synthetic child 0 · SYN-0')).not.toBeInTheDocument();
    expect(await screen.findByText('Synthetic child 20 · SYN-20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang trẻ tiếp' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Chờ nhập học', exact: true }));
    expect(await screen.findByText('Kết quả phù hợp bộ lọc: 3')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(new URL(String(fetcher.mock.calls[2][0]), 'http://localhost').searchParams.get('offset')).toBe('0');
  });
  it.each(['denial', 'transport', 'malformed'])('shows unavailable, not zero, on %s', async fault => {
    if (fault === 'transport') fetcher.mockRejectedValue(Error('network'));
    else fetcher.mockResolvedValue(fault === 'denial' ? { ok: false, status: 403, json: async () => ({ success: false }) } : ok({ success: true, registry: { students: [] } }));
    render(<PreschoolStudentRegistry />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa thể xác định tổng hồ sơ');
    expect(screen.queryByText(/Tổng hồ sơ: 0/)).not.toBeInTheDocument();
  });
  it('ignores stale success after a denied filter response and uses no-store', async () => {
    let resolveOld: (v: Reply) => void = () => undefined;
    fetcher.mockReturnValueOnce(new Promise<Reply>(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false }) });
    render(<PreschoolStudentRegistry />);
    fireEvent.click(screen.getByRole('button', { name: 'Chờ nhập học', exact: true }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    resolveOld(ok(response()));
    await waitFor(() => expect(screen.queryByText(/Tổng hồ sơ: 23/)).not.toBeInTheDocument());
    expect(fetcher.mock.calls[0][1]?.cache).toBe('no-store');
  });
  it('rejects pasted control characters without rendering an exception or issuing another request', async () => {
    fetcher.mockResolvedValue(ok(response())); render(<PreschoolStudentRegistry />);
    expect(await screen.findByText('Kết quả phù hợp bộ lọc: 23')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm trẻ theo tên hoặc mã' }), { target: { value: 'An\u007fB' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm trẻ', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa thực hiện tìm kiếm');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not display a Preschool failure on an explicitly unsupported Product', async () => {
    fetcher.mockResolvedValue({ ok: false, status: 404, json: async () => ({ success: false, error: 'REGISTRY_UNSUPPORTED_PRODUCT' }) });
    const view = render(<PreschoolStudentRegistry />);
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });
});
