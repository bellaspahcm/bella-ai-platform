/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../page';
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/dashboard-client-context', () => ({ clearDashboardClientContextCache: jest.fn() }));
let mockContext = { user: { id: 'admin-a', tenant_id: 'tenant-a', full_name: 'Actual Admin', email: 'synthetic@example.invalid', role: 'admin' }, product: { productKey: 'bella_preschool' }, isLoading: false };
jest.mock('@/lib/user-context', () => ({ useUser: () => mockContext }));
const fetchMock = jest.fn<typeof fetch>();
const jsonReply = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body }) as Response;
const branches = [{ id: 'branch-a', name: 'Cơ sở A' }, { id: 'branch-b', name: 'Cơ sở B' }];
const dashboard: ExecutiveDashboardDTO = {
  tenantId: 'tenant-a', evaluatedAt: '2026-10-23T01:00:00.000Z',
  enrollment: { totalEnrolledStudents: 0, totalClassrooms: 1, totalTeachers: null,
    classroomUtilization: [{ classId: 'class-a', className: 'Lớp Chồi', currentEnrollment: 0, maxCapacity: null, utilizationRate: null }] },
  attendance: { todayPresentCount: 0, todayAbsentCount: 0, todayLateCount: null, presentVsEnrolledRate: 0 },
  careAndSafety: { activeHealthIncidents: null, pendingMedicationDoses: null },
  learning: { draftPortfoliosCount: null, pendingMilestoneReviews: null },
  parentEngagement: { unacknowledgedNotices: null, pendingConsentRequests: null },
  finance: { invoicedGrossTotal: null, reconciledCashCollected: null, outstandingBalanceTotal: null, overdueAccountsCount: null },
  workforce: { activeStaffingViolations: null, openStaffingExceptions: null },
  facilities: { outOfServiceAssetsCount: null, outOfServiceZonesCount: null, overdueScheduleCount: null, openSafetyExceptions: null },
  commandCenter: { unmarkedAttendanceCount: 0, leaveRequestsCount: null, overdueInvoicesCount: null, healthIncidentsCount: null, parentRequestsCount: null, totalParentsCount: null },
};
const reply = (data: ExecutiveDashboardDTO = dashboard, branchId = 'branch-a', available = [branches[0]]) => jsonReply({ success: true, branches: available, selectedBranchId: branchId, dashboard: data });
beforeEach(() => {
  mockContext = { user: { id: 'admin-a', tenant_id: 'tenant-a', full_name: 'Actual Admin', email: 'synthetic@example.invalid', role: 'admin' }, product: { productKey: 'bella_preschool' }, isLoading: false };
  fetchMock.mockReset();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
});

it('keeps failed reads unavailable and uses real profile and bulletin navigation', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);
  render(<Dashboard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('ANALYTICS_HTTP_403');
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('—');
  expect(screen.getByTestId('metric-total-teachers')).toHaveTextContent('—');
  expect(screen.getByText('Actual Admin')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Bảng tin chung' })).toHaveAttribute('href', '/dashboard/education/communication?tab=announcements');
  expect(screen.queryByText(/Nguyễn Thị Lan|Nguyễn Minh Anh đã đến trường|\+12%/)).not.toBeInTheDocument();
});

it('selects a branch, preserves observed zeroes and never guesses age or missing counts', async () => {
  fetchMock.mockResolvedValueOnce(jsonReply({ success: true, branches, selectedBranchId: null, dashboard: null }));
  fetchMock.mockResolvedValue(reply(dashboard, 'branch-b', branches));
  render(<Dashboard />);
  await screen.findByText('Chọn cơ sở để xem dữ liệu được cấp quyền.');
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-b' } });
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent(/^0$/));
  expect(String(fetchMock.mock.calls[1][0])).toContain('branchId=branch-b');
  expect(screen.getByTestId('metric-attendance-rate')).toHaveTextContent(/^0%$/);
  expect(screen.getByTestId('metric-total-teachers')).toHaveTextContent('—');
  expect(screen.getByTestId('metric-total-parents')).toHaveTextContent('—');
  expect(screen.getByText('Chưa có dữ liệu độ tuổi')).toBeInTheDocument();
  expect(screen.queryByText('0 sự cố sức khỏe')).not.toBeInTheDocument();
  expect(screen.queryByText('0 mục cần chú ý')).not.toBeInTheDocument();
});

it('uses distinct student total from the API instead of summing enrollment rows', async () => {
  fetchMock.mockResolvedValue(reply({ ...dashboard, enrollment: { ...dashboard.enrollment, totalEnrolledStudents: 1,
    classroomUtilization: [0, 1].map(id => ({ classId: `c-${id}`, className: `Class ${id}`, currentEnrollment: 1, maxCapacity: null, utilizationRate: null })) } }));
  render(<Dashboard />);
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent(/^1$/));
});

it.each([
  { success: true, branches, selectedBranchId: 'branch-a', dashboard: { tenantId: 'tenant-a' } },
  { success: true, branches: [branches[0]], selectedBranchId: 'branch-a', dashboard: { ...dashboard, tenantId: 'foreign' } },
  { success: true, branches, selectedBranchId: 'foreign', dashboard },
  { success: true, branches, selectedBranchId: 'branch-a', dashboard },
])('rejects malformed or foreign-scope analytics', async payload => {
  fetchMock.mockResolvedValue(jsonReply(payload));
  render(<Dashboard />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/ANALYTICS_RESPONSE/);
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('—');
});

it('clears previous branch metrics immediately and ignores a late response', async () => {
  let resolveLate: (response: Response) => void = () => undefined;
  fetchMock.mockResolvedValueOnce(jsonReply({ success: true, branches, selectedBranchId: null, dashboard: null }));
  fetchMock.mockResolvedValue(reply(dashboard, 'branch-a', branches));
  const view = render(<Dashboard />);
  await screen.findByText('Chọn cơ sở để xem dữ liệu được cấp quyền.');
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-a' } });
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('0'));
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveLate = resolve; }));
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-b' } });
  expect(screen.queryByTestId('metric-total-kids')).not.toBeInTheDocument();
  fetchMock.mockResolvedValue(reply(dashboard, 'branch-a', branches));
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-a' } });
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent(/^0$/));
  await act(async () => resolveLate(reply({ ...dashboard, enrollment: { ...dashboard.enrollment, totalEnrolledStudents: 99 } }, 'branch-b')));
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent(/^0$/);
  mockContext = { ...mockContext, user: { ...mockContext.user, id: 'other-admin', tenant_id: 'other-tenant' } };
  fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);
  view.rerender(<Dashboard />);
  await screen.findByRole('alert');
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('—');
});

it('does not send fabricated data to executive AI or compliance endpoints', async () => {
  fetchMock.mockResolvedValue(reply());
  render(<Dashboard />);
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('0'));
  const requests = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /Tạo điểm tin/i }));
  expect(await screen.findByText(/Chưa đủ dữ liệu chuẩn về sức khỏe/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(requests);
});


it('discards old-branch questions and late AI replies when branch scope changes', async () => {
  let resolveAi: (response: Response) => void = () => undefined;
  fetchMock.mockResolvedValueOnce(jsonReply({ success: true, branches, selectedBranchId: null, dashboard: null }));
  fetchMock.mockResolvedValue(reply(dashboard, 'branch-a', branches));
  render(<Dashboard />);
  await screen.findByText('Chọn cơ sở để xem dữ liệu được cấp quyền.');
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-a' } });
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('0'));
  fireEvent.click(screen.getByRole('button', { name: 'Hỏi đáp BGH' }));
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveAi = resolve; }));
  fireEvent.change(screen.getByPlaceholderText(/Đặt câu hỏi điều hành/), { target: { value: 'Branch A question' } });
  fireEvent.submit(screen.getByPlaceholderText(/Đặt câu hỏi điều hành/).closest('form')!);
  await screen.findByText('Branch A question');
  fetchMock.mockResolvedValue(reply(dashboard, 'branch-b', branches));
  fireEvent.change(screen.getByLabelText('Chọn cơ sở Tổng quan'), { target: { value: 'branch-b' } });
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('0'));
  await act(async () => resolveAi(jsonReply({ success: true, data: { answer: 'Old Branch A answer' } })));
  expect(screen.queryByText('Branch A question')).not.toBeInTheDocument();
  expect(screen.queryByText('Old Branch A answer')).not.toBeInTheDocument();
});

it('shows the Vietnam day consistently in the date picker and request near midnight', async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T18:00:00.000Z') });
  try {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    render(<Dashboard />);
    await act(async () => undefined);
    fireEvent.click(screen.getByTitle('Bấm để chọn ngày xem lịch học'));
    expect(screen.getByLabelText('Ngày Tổng quan')).toHaveValue('2026-10-23');
    expect(String(fetchMock.mock.calls[0][0])).toContain('date=2026-10-23');
  } finally { jest.useRealTimers(); }
});


it('filters only canonical class rows and keeps unsupported revenue periods unavailable', async () => {
  fetchMock.mockResolvedValue(reply());
  render(<Dashboard />);
  await waitFor(() => expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('0'));
  fireEvent.change(screen.getByLabelText('Lọc lớp trong cơ sở đang chọn'), { target: { value: 'No matching class' } });
  expect(screen.queryByText('Chồi')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Kỳ doanh thu chưa khả dụng')).toBeDisabled();
  expect(screen.queryByText('6 tháng gần nhất')).not.toBeInTheDocument();
});
