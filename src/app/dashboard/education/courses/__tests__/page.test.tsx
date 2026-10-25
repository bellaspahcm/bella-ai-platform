/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CoursesPage from '../page';

const mockSettings = jest.fn<() => Promise<unknown>>();
jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: () => mockSettings() }));
jest.mock('@/lib/business-rules/tenant-modules', () => ({ resolveTenantBrandIdentity: () => ({ moduleKey: 'other' }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const course = (id = 'course-a') => ({ id, tenantId: 'own', courseCode: `CODE-${id}`, title: `Synthetic Course ${id}`, status: 'active', prerequisites: ['PRE-1'] });
const reply = (payload: unknown, status = 200): Reply => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const ready = (id = 'course-a') => reply({ success: true, courses: [course(id)] });
function deferred<T>() {
  let resolve: (v: T) => void = () => { throw Error('Deferred unresolved'); };
  let reject: (e: unknown) => void = () => { throw Error('Deferred unresolved'); };
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const mount = async () => { await act(async () => { render(<CoursesPage />); }); };
const noCourses = () => {
  expect(screen.queryByRole('link', { name: /Synthetic Course/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Họa Mi|Nguyễn Thị Mai|36.5|25 bé|Verified Safe/)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
};
beforeEach(() => {
  mockFetch.mockReset(); mockSettings.mockReset(); mockSettings.mockResolvedValue(null);
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: mockFetch });
});
afterEach(() => {
  cleanup();
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
  else Reflect.deleteProperty(globalThis, 'fetch');
});

describe('R1b truthful Course catalog list', () => {
  it('loads without sample facts or a create action', async () => {
    mockFetch.mockReturnValueOnce(deferred<Reply>().promise); await mount();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải'); noCourses();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/education/courses?view=catalog');
    expect(mockFetch.mock.calls[0][1]?.cache).toBe('no-store');
    expect(screen.queryByRole('button', { name: /Tạo|Thêm lớp/ })).not.toBeInTheDocument();
  });
  it('renders only public catalog values and encodes the detail ID', async () => {
    mockFetch.mockResolvedValueOnce(ready('course/a?x=b')); await mount();
    expect(screen.getByRole('link', { name: 'Synthetic Course course/a?x=b' })).toHaveAttribute('href', '/dashboard/education/courses/course%2Fa%3Fx%3Db');
    expect(screen.getByText('Khóa học trong danh mục: 1')).toBeInTheDocument();
    expect(screen.getByText('Điều kiện tiên quyết: PRE-1')).toBeInTheDocument();
    expect(screen.getByText(/Thông tin lớp vận hành/)).toHaveTextContent('chưa khả dụng');
    expect(screen.queryByText(/Tổng học sinh|Tỷ lệ lấp đầy|25 bé|36.5/)).not.toBeInTheDocument();
    expect(mockSettings).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 503])('does not fallback or show successful body on HTTP%i', async status => {
    mockFetch.mockResolvedValueOnce(reply({ success: true, courses: [course()] }, status)); await mount();
    expect(screen.getByRole('alert')).toBeInTheDocument(); noCourses(); expect(mockSettings).not.toHaveBeenCalled();
  });
  it.each([
    null, [], { success: false, courses: [course()] }, { success: 'true', courses: [] },
    { success: true }, { success: true, courses: null }, { success: true, courses: {} },
    { success: true, courses: [{ ...course(), title: {} }] },
    { success: true, courses: [{ ...course(), id: '' }] },
    { success: true, courses: [{ ...course(), tenantId: ' ' }] },
    { success: true, courses: [{ ...course(), status: 'inactive' }] },
    { success: true, courses: [{ ...course(), prerequisites: [{}] }] },
    { success: true, courses: [course(), course()] },
    { success: true, courses: [course(), { ...course('b'), tenantId: 'foreign' }] },
  ])('rejects malformed/mixed identity payload %#', async payload => {
    mockFetch.mockResolvedValueOnce(reply(payload)); await mount(); expect(screen.getByRole('alert')).toBeInTheDocument(); noCourses();
  });
  it.each(['transport', 'JSON'])('reports %s failure without leaking diagnostics', async kind => {
    if (kind === 'transport') mockFetch.mockRejectedValueOnce(Error('private diagnostic'));
    else mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw SyntaxError('private diagnostic'); } });
    await mount(); expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument(); noCourses();
  });
  it('clears a successful catalog immediately on reload and accepts an honest empty result', async () => {
    const next = deferred<Reply>(); mockFetch.mockResolvedValueOnce(ready()).mockReturnValueOnce(next.promise); await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' })); noCourses();
    await act(async () => { next.resolve(reply({ success: true, courses: [] })); });
    expect(screen.getByText('Khóa học trong danh mục: 0')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chưa có khóa học'); noCourses();
  });
  it('does not retain prior Course after reload denial', async () => {
    mockFetch.mockResolvedValueOnce(ready()).mockResolvedValueOnce(reply({ success: false }, 403)); await mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' })); });
    expect(screen.getByRole('alert')).toBeInTheDocument(); noCourses();
  });
  it.each(['success', 'failure'])('ignores old fetch %s after the newest result', async outcome => {
    const old = deferred<Reply>(); mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(ready('new')); await mount();
    const oldSignal = mockFetch.mock.calls[0][1]?.signal;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' })); });
    await act(async () => { if (outcome === 'success') old.resolve(ready()); else old.reject(Error('late failure')); });
    expect(oldSignal?.aborted).toBe(true); expect(screen.getByRole('link', { name: 'Synthetic Course new' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Synthetic Course course-a' })).not.toBeInTheDocument();
  });
  it.each(['success', 'failure'])('ignores stale JSON %s after newer denial', async outcome => {
    const body = deferred<unknown>(); mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise }).mockResolvedValueOnce(reply({ success: false }, 403)); await mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' })); });
    await act(async () => { if (outcome === 'success') body.resolve({ success: true, courses: [course()] }); else body.reject(Error('late JSON')); });
    expect(screen.getByRole('alert')).toBeInTheDocument(); noCourses();
  });
  it('unmounts with request invalidation and no mutation', async () => {
    const pending = deferred<Reply>(); mockFetch.mockReturnValueOnce(pending.promise);
    const view = render(<CoursesPage />); const signal = mockFetch.mock.calls[0][1]?.signal; view.unmount();
    await act(async () => { pending.resolve(ready()); });
    expect(signal?.aborted).toBe(true); expect(view.container).toBeEmptyDOMElement();
    expect(mockFetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });
  it('preserves the existing non-Preschool branch only on trusted unsupported-Product denial', async () => {
    mockSettings.mockResolvedValue({ enabled_modules: ['other'], name: 'Other product' });
    mockFetch.mockResolvedValueOnce(reply({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' }, 403)).mockResolvedValueOnce(reply({ success: true, classrooms: [] }));
    await mount(); expect(screen.getByText('Quản lý khóa học & Lớp học')).toBeInTheDocument();
    // Trusted server Product result is authoritative; branding must not reclassify it.
    expect(mockSettings).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
