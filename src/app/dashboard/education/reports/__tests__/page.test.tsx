/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsPage from '../page';
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: { id: 'admin', tenant_id: 'tenant-a' }, product: { productKey: 'bella_preschool' }, isLoading: false }) }));

const fetchMock = jest.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  fetchMock.mockResolvedValue({
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
    json: async () => ({ success: false, error: 'ANALYTICS_BRANCH_SCOPE_NOT_READY' }),
  } as Response);
});

it('shows unavailable metrics and no substituted sample data when analytics is held', async () => {
  render(<ReportsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('ANALYTICS_BRANCH_SCOPE_NOT_READY');
  expect(screen.queryByText(/95\.2|96\.0|2\.05|Bé vui đến trường|Báo cáo tổng hợp tháng 09\/2026/)).not.toBeInTheDocument();
  expect(screen.getByText('Chưa có dữ liệu chuyên cần theo tháng.')).toBeInTheDocument();
  expect(screen.getByText('Chưa có dữ liệu học phí phân bổ theo tháng.')).toBeInTheDocument();
  expect(screen.getByText('Chưa có danh sách hoạt động từ nguồn chuẩn.')).toBeInTheDocument();
  expect(screen.getByText('Chưa có tài liệu báo cáo được tạo.')).toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

it('does not claim AI analysis or provide period options without their contracts', async () => {
  render(<ReportsPage />);
  await screen.findByRole('alert');
  expect(screen.getByText(/Chưa có contract phân tích AI/)).toHaveAttribute('role', 'status');
  expect(screen.getByLabelText('Chọn kỳ báo cáo')).toHaveValue('');
  expect(screen.getByLabelText('Chọn kỳ báo cáo').querySelectorAll('option')).toHaveLength(1);
});

it('keeps export unavailable and reports that no file was created', async () => {
  render(<ReportsPage />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
  await waitFor(() => expect(screen.getAllByRole('status').some((item) => item.textContent?.includes('Không có file được tạo'))).toBe(true));
  expect(document.querySelector('a[download]')).toBeNull();
});


const branchDashboard: ExecutiveDashboardDTO = {
  tenantId: 'tenant-a', evaluatedAt: '2026-10-22T03:00:00.000Z',
  enrollment: { totalEnrolledStudents: 2, totalClassrooms: 1, totalTeachers: null,
    classroomUtilization: [{ classId: 'course-a', className: 'Lớp A', currentEnrollment: 2, maxCapacity: null, utilizationRate: null }] },
  attendance: { todayPresentCount: 1, todayAbsentCount: 0, todayLateCount: null, presentVsEnrolledRate: 50 },
  careAndSafety: { activeHealthIncidents: null, pendingMedicationDoses: null },
  learning: { draftPortfoliosCount: null, pendingMilestoneReviews: null },
  parentEngagement: { unacknowledgedNotices: null, pendingConsentRequests: null },
  finance: { invoicedGrossTotal: null, reconciledCashCollected: null, outstandingBalanceTotal: null, overdueAccountsCount: null },
  workforce: { activeStaffingViolations: null, openStaffingExceptions: null },
  facilities: { outOfServiceAssetsCount: null, outOfServiceZonesCount: null, overdueScheduleCount: null, openSafetyExceptions: null },
  commandCenter: { unmarkedAttendanceCount: 1, leaveRequestsCount: null, overdueInvoicesCount: null,
    healthIncidentsCount: null, parentRequestsCount: null, totalParentsCount: null },
};
const jsonReply = (payload: unknown): Response => ({ ok: true, status: 200, json: async () => payload }) as Response;

it('requires a branch choice and fetches only the selected branch', async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(jsonReply({ success: true, branches: [
    { id: 'branch-a', name: 'Cơ sở A' }, { id: 'branch-b', name: 'Cơ sở B' },
  ], selectedBranchId: null, dashboard: null }));
  fetchMock.mockResolvedValueOnce(jsonReply({ success: true, branches: [
    { id: 'branch-a', name: 'Cơ sở A' }, { id: 'branch-b', name: 'Cơ sở B' },
  ], selectedBranchId: 'branch-b', dashboard: branchDashboard }));
  render(<ReportsPage />);
  expect(await screen.findByText('Chọn cơ sở để xem roster và điểm danh trong phạm vi được cấp.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Chọn cơ sở báo cáo'), { target: { value: 'branch-b' } });
  expect(await screen.findByText('Lớp A')).toBeInTheDocument();
  const secondRequest = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost');
  expect(secondRequest.searchParams.get('branchId')).toBe('branch-b');
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  expect(screen.getByText('1 / 2 trẻ')).toBeInTheDocument();
  expect(screen.queryByText('0 tài khoản')).not.toBeInTheDocument();
});


it.each([
  { ...branchDashboard, tenantId: 'foreign-tenant' },
  { tenantId: 'tenant-a' },
])('rejects foreign or malformed dashboard data without rendering metrics', async dashboard => {
  fetchMock.mockResolvedValue(jsonReply({ success: true, branches: [{ id: 'branch-a', name: 'A' }], selectedBranchId: 'branch-a', dashboard }));
  render(<ReportsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/ANALYTICS_RESPONSE/);
  expect(screen.queryByText('1 / 2 trẻ')).not.toBeInTheDocument();
});
