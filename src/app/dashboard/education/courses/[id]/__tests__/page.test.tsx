/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Suspense } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClassWorkspacePage from '../page';
jest.mock('../../classroom-live-data', () => ({ loadClassroomOverview: jest.fn(async () => new Map()) }));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

// UI transport fixtures only: no Auth, RLS, DB, or canonical read-semantics proof.
type Reply = Pick<Response, 'ok' | 'status' | 'json'>;
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Reply>>();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Deferred not initialized'); };
  let reject: (reason: unknown) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function classroom(id = 'class-a') {
  return { id, tenantId: '00000000-0000-4000-8000-000000000002', courseCode: 'CODE-' + id,
    title: 'Synthetic classroom ' + id, status: 'active', prerequisites: ['PRE-1'] };
}

const classroomUuid = '00000000-0000-4000-8000-000000000001';
function registryPayload(courseId = classroomUuid) {
  const tenantId = '00000000-0000-4000-8000-000000000002';
  return { success: true, registry: {
    tenantId,
    request: { query: '', status: 'all', courseId, branchId: null, offset: 0, limit: 20 },
    totals: { students: 1, active: 1, pending: 0 }, filteredTotal: 1, nextOffset: null,
    students: [{ id: '00000000-0000-4000-8000-000000000003', tenantId,
      partyId: '00000000-0000-4000-8000-000000000004', studentCode: 'STU-001', name: 'Synthetic pupil',
      gender: null, dob: null, enrollments: [{ id: '00000000-0000-4000-8000-000000000005', courseId,
        courseCode: 'CODE-CLASS', courseTitle: 'Synthetic classroom', branchId: '00000000-0000-4000-8000-000000000006',
        branchName: 'Synthetic branch', status: 'active' }] }],
  } };
}

function reply(payload: unknown, status = 200): Reply {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function ready(id = 'class-a'): Reply { return reply({ success: true, course: classroom(id) }); }

function page(params: Promise<{ id: string }>) {
  return <Suspense fallback={<p role="status">Đang mở lớp…</p>}><ClassWorkspacePage params={params} /></Suspense>;
}

async function mountPage(id = 'class-a') {
  const mounted: { view?: ReturnType<typeof render> } = {};
  await act(async () => {
    const params = Promise.resolve({ id });
    mounted.view = render(page(params));
    await params;
  });
  if (!mounted.view) throw new Error('Class workspace fixture did not mount');
  return mounted.view;
}

async function navigate(view: ReturnType<typeof render>, id: string) {
  await act(async () => {
    const params = Promise.resolve({ id });
    view.rerender(page(params));
    await params;
  });
}

function expectNoWorkspace() {
  expect(screen.queryByText(/Synthetic classroom/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Synthetic pupil/)).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText(/Họa Mi|Nguyễn Thị Mai|Hoàng Nam|Montessori|Verified Safe/)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}

describe('R1b catalog detail — retained R1a containment invariants', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: mockFetch });
  });
  afterEach(() => {
    cleanup();
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('shows loading without a sample class, child, or teacher while GET is pending', async () => {
    const pending = deferred<Reply>();
    mockFetch.mockReturnValueOnce(pending.promise);
    await mountPage();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu lớp học');
    expectNoWorkspace();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/education/courses/class-a?view=catalog');
    expect(options?.signal?.aborted).toBe(false);
    expect(options?.cache).toBe('no-store');
  });

  it('renders a shape-valid response for the requested class without invented presentation claims', async () => {
    mockFetch.mockResolvedValueOnce(ready());
    await mountPage();
    expect(screen.getByRole('heading', { name: 'Synthetic classroom class-a' })).toBeInTheDocument();
    expect(screen.getByText('CODE-class-a')).toBeInTheDocument();
    expect(screen.getByText('PRE-1')).toBeInTheDocument();
    expect(screen.queryByText(/36.5|Synthetic room|25 bé/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Montessori|Reggio|37.8|Verified Safe|Không trùng lịch|Canonical Database|Canonical table/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Danh Sách Học Sinh' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa xác định được số học sinh');
    expect(screen.queryByText(/Synthetic pupil/)).not.toBeInTheDocument();
  });

  it('loads the selected canonical class roster through the scoped registry and links attendance to that ID', async () => {
    mockFetch.mockResolvedValueOnce(ready(classroomUuid)).mockResolvedValueOnce(reply(registryPayload()));
    await mountPage(classroomUuid);
    expect(screen.getByRole('heading', { name: 'Synthetic classroom ' + classroomUuid })).toBeInTheDocument();
    expect(mockFetch.mock.calls[1][0]).toBe(`/api/education/student-registry?courseId=${classroomUuid}&offset=0&limit=20`);
    fireEvent.click(screen.getByRole('button', { name: 'Danh Sách Học Sinh' }));
    expect(screen.getByText('Synthetic pupil')).toBeInTheDocument();
    expect(screen.getByText('STU-001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Điểm danh lớp này' })).toHaveAttribute(
      'href', `/dashboard/education/attendance?courseId=${classroomUuid}`,
    );
    expect(screen.queryByText(/36\.5|Chưa điểm danh hôm nay/)).not.toBeInTheDocument();
  });

  it.each([401, 403, 404, 503])('shows an explicit error for HTTP %i even if the body claims success', async status => {
    const json = jest.fn<() => Promise<unknown>>().mockResolvedValue({ success: true, course: classroom() });
    mockFetch.mockResolvedValueOnce({ ok: false, status, json });
    await mountPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải dữ liệu lớp học');
    if (status === 403) expect(json).toHaveBeenCalledTimes(1);
    else expect(json).not.toHaveBeenCalled();
    expectNoWorkspace();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeEnabled();
  });

  it('shows transport failure without exposing exception text', async () => {
    mockFetch.mockRejectedValueOnce(new Error('private transport diagnostic'));
    await mountPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải dữ liệu lớp học');
    expect(screen.queryByText(/private transport/)).not.toBeInTheDocument();
    expectNoWorkspace();
  });

  it('rejects invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('private malformed JSON'); } });
    await mountPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
  });

  it.each([
    ['null envelope', null], ['array envelope', []],
    ['200 denial', { success: false, course: classroom() }],
    ['truthy success', { success: 'true', course: classroom() }],
    ['missing Course', { success: true }], ['array Course', { success: true, course: [] }],
    ['wrong ID', { success: true, course: classroom('class-b') }],
    ['missing fields', { success: true, course: { id: 'class-a' } }],
    ['object title', { success: true, course: { ...classroom(), title: {} } }],
    ['blank title', { success: true, course: { ...classroom(), title: '' } }],
    ['null code', { success: true, course: { ...classroom(), courseCode: null } }],
    ['blank code', { success: true, course: { ...classroom(), courseCode: ' ' } }],
    ['object tenant', { success: true, course: { ...classroom(), tenantId: {} } }],
    ['blank tenant', { success: true, course: { ...classroom(), tenantId: '' } }],
    ['unknown status', { success: true, course: { ...classroom(), status: 'inactive' } }],
    ['null status', { success: true, course: { ...classroom(), status: null } }],
    ['object status', { success: true, course: { ...classroom(), status: {} } }],
    ['null prerequisites', { success: true, course: { ...classroom(), prerequisites: null } }],
    ['string prerequisites', { success: true, course: { ...classroom(), prerequisites: 'PRE' } }],
    ['object prerequisite', { success: true, course: { ...classroom(), prerequisites: [{}] } }],
    ['numeric prerequisite', { success: true, course: { ...classroom(), prerequisites: [1] } }],
  ])('contains malformed response: %s', async (_description, payload) => {
    mockFetch.mockResolvedValueOnce(reply(payload));
    await mountPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải dữ liệu lớp học');
    expectNoWorkspace();
    expect(screen.queryByText(/untrusted/)).not.toBeInTheDocument();
  });

  it('renders an explicit null classroom as empty and permits retry', async () => {
    mockFetch.mockResolvedValueOnce(reply({ success: true, course: null })).mockResolvedValueOnce(ready());
    await mountPage();
    expect(screen.getByRole('status')).toHaveTextContent('Chưa có dữ liệu lớp học.');
    expectNoWorkspace();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' })); });
    expect(screen.getByRole('heading', { name: /Synthetic classroom class-a/ })).toBeInTheDocument();
  });

  it('preserves an empty prerequisite array without adding operational zeroes or people', async () => {
    mockFetch.mockResolvedValueOnce(reply({ success: true, course: { ...classroom(), prerequisites: [] } }));
    await mountPage();
    expect(screen.getByText('Không có')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity|Synthetic teacher|36.5|0 bé/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Danh Sách Học Sinh' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải danh sách học sinh trong phạm vi được cấp quyền');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not use a fallback class ID when the ID is empty', async () => {
    await mountPage('');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
  });

  it('encodes the class selector as one URL path segment and binds the original response ID', async () => {
    mockFetch.mockResolvedValueOnce(ready('class/a?x=b'));
    await mountPage('class/a?x=b');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/education/courses/class%2Fa%3Fx%3Db?view=catalog');
    expect(screen.getByRole('heading', { name: /Synthetic classroom class\/a/ })).toBeInTheDocument();
  });

  it('keeps assignment visibly unavailable and issues no mutation from either teacher view', async () => {
    mockFetch.mockResolvedValueOnce(ready());
    await mountPage();
    const overviewButton = screen.getByRole('button', { name: 'Phân công GVN' });
    expect(overviewButton).toBeDisabled();
    expect(overviewButton).toHaveAccessibleDescription(/hiện chưa khả dụng/);
    fireEvent.click(overviewButton);
    fireEvent.click(screen.getByRole('button', { name: 'Đội Ngũ GVN' }));
    const teachersButton = screen.getByRole('button', { name: 'Phân công Giáo viên Mới' });
    expect(teachersButton).toBeDisabled();
    expect(teachersButton).toHaveAccessibleDescription(/hiện chưa khả dụng/);
    fireEvent.click(teachersButton);
    expect(screen.queryByRole('button', { name: /Chấm dứt|Xác nhận phân công/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/education/courses/class-a?view=catalog', expect.objectContaining({ cache: 'no-store' }));
    expect(mockFetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it('revalidates catalog authorization on legacy retry and removes the previous workspace after denial', async () => {
    const revalidation = deferred<Reply>();
    mockFetch
      .mockResolvedValueOnce(reply({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' }, 403))
      .mockResolvedValueOnce(reply({ success: true, classroom: {
        id: 'class-a', code: 'LEGACY-A', name: 'Legacy workspace', grade: '', room: '',
        maxStudents: 0, currentStudents: 0, teachers: [], teacherSummary: '', roster: [],
      } }))
      .mockReturnValueOnce(revalidation.promise);
    await mountPage();
    expect(screen.getByRole('heading', { name: 'Legacy workspace — Workspace 360°' })).toBeInTheDocument();
    expect(mockFetch.mock.calls[1][0]).toBe('/api/education/courses/class-a');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    expect(screen.queryByRole('heading', { name: 'Legacy workspace — Workspace 360°' })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls[2][0]).toBe('/api/education/courses/class-a?view=catalog');
    await act(async () => { revalidation.resolve(reply({ success: false }, 403)); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
    expect(screen.queryByRole('heading', { name: 'Legacy workspace — Workspace 360°' })).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('clears a loaded class immediately on reload and keeps it absent after denial', async () => {
    const reload = deferred<Reply>();
    mockFetch.mockResolvedValueOnce(ready()).mockReturnValueOnce(reload.promise);
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    expectNoWorkspace();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu lớp học');
    await act(async () => { reload.resolve(reply({ success: false }, 403)); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
  });

  it('clears the previous class during navigation and after the new class is denied', async () => {
    const next = deferred<Reply>();
    mockFetch.mockResolvedValueOnce(ready()).mockReturnValueOnce(next.promise);
    const view = await mountPage();
    await navigate(view, 'class-b');
    expectNoWorkspace();
    await act(async () => { next.resolve(reply({ success: false }, 401)); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
  });

  it.each(['success', 'failure'])('ignores stale class-a %s while class-b remains pending even if transport ignores abort', async outcome => {
    const old = deferred<Reply>();
    const next = deferred<Reply>();
    mockFetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const view = await mountPage();
    const oldSignal = mockFetch.mock.calls[0][1]?.signal;
    await navigate(view, 'class-b');
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === 'success') old.resolve(ready());
      else old.reject(new Error('late failure'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu lớp học');
    expectNoWorkspace();
    await act(async () => { next.resolve(ready('class-b')); });
    expect(screen.getByRole('heading', { name: /Synthetic classroom class-b/ })).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic classroom class-a/)).not.toBeInTheDocument();
  });

  it.each(['success', 'failure'])('does not overwrite a newer ready class with a stale JSON %s', async outcome => {
    const body = deferred<unknown>();
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise }).mockResolvedValueOnce(ready('class-b'));
    const view = await mountPage();
    await navigate(view, 'class-b');
    await act(async () => {
      if (outcome === 'success') body.resolve({ success: true, course: classroom() });
      else body.reject(new SyntaxError('late invalid JSON'));
    });
    expect(screen.getByRole('heading', { name: /Synthetic classroom class-b/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not replace a newer denial with a stale successful class response', async () => {
    const old = deferred<Reply>();
    mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reply({ success: false }, 403));
    const view = await mountPage();
    await navigate(view, 'class-b');
    await act(async () => { old.resolve(ready()); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expectNoWorkspace();
  });

  it.each(['success', 'failure'])('binds same-class reload to the newest generation despite a late %s', async outcome => {
    const old = deferred<Reply>();
    const next = deferred<Reply>();
    mockFetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await mountPage();
    const oldSignal = mockFetch.mock.calls[0][1]?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { next.resolve(reply({ success: true, course: { ...classroom(), title: 'Newest response' } })); });
    await act(async () => {
      if (outcome === 'success') old.resolve(ready());
      else old.reject(new Error('stale reload failure'));
    });
    expect(screen.getByRole('heading', { name: 'Newest response' })).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic classroom/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['success', 'failure'])('aborts and invalidates an unmounted request before late %s', async outcome => {
    const pending = deferred<Reply>();
    mockFetch.mockReturnValueOnce(pending.promise);
    const view = await mountPage();
    const signal = mockFetch.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === 'success') pending.resolve(ready());
      else pending.reject(new Error('late unmount failure'));
    });
    expect(view.container).toBeEmptyDOMElement();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
