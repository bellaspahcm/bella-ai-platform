/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EducationDashboardPage from '../page';
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/dashboard-client-context', () => ({ clearDashboardClientContextCache: jest.fn() }));
jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: { id: 'synthetic-admin', tenant_id: 'synthetic-tenant', full_name: 'Synthetic Admin', email: 'synthetic@example.invalid', role: 'admin' }, product: { productKey: 'bella_preschool' }, isLoading: false }) }));

// Accepted MVP read contract: unavailable domains stay null, not fake zeroes.
const snapshot: ExecutiveDashboardDTO = {
  tenantId: 'synthetic-tenant', evaluatedAt: '2026-10-23T00:00:00.000Z',
  enrollment: {
    totalEnrolledStudents: 186, totalClassrooms: 1, totalTeachers: null,
    classroomUtilization: [{ classId: 'synthetic-class', className: 'Lớp Lá', currentEnrollment: 186, maxCapacity: 200, utilizationRate: 93 }],
  },
  attendance: { todayPresentCount: 0, todayAbsentCount: 0, todayLateCount: null, presentVsEnrolledRate: 0 },
  commandCenter: { unmarkedAttendanceCount: 156, leaveRequestsCount: null, overdueInvoicesCount: null, healthIncidentsCount: null, parentRequestsCount: null, totalParentsCount: null },
  careAndSafety: { activeHealthIncidents: null, pendingMedicationDoses: null },
  learning: { draftPortfoliosCount: null, pendingMilestoneReviews: null },
  parentEngagement: { unacknowledgedNotices: null, pendingConsentRequests: null },
  finance: { invoicedGrossTotal: null, reconciledCashCollected: null, outstandingBalanceTotal: null, overdueAccountsCount: null },
  workforce: { activeStaffingViolations: null, openStaffingExceptions: null },
  facilities: { outOfServiceAssetsCount: null, outOfServiceZonesCount: null, overdueScheduleCount: null, openSafetyExceptions: null },
};

let analyticsAvailable = true;
let copilotStatus = 200;
let copilotData: Record<string, unknown>;
const mockFetch = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
  const analytics = String(input).startsWith('/api/education/analytics');
  return {
    ok: analytics || copilotStatus === 200,
    status: analytics ? 200 : copilotStatus,
    json: async () => analytics
      ? { success: analyticsAvailable, branches: [{ id: 'synthetic-branch', name: 'Synthetic Branch' }], selectedBranchId: 'synthetic-branch', dashboard: analyticsAvailable ? snapshot : undefined }
      : copilotStatus === 200 ? { success: true, data: copilotData } : { error: 'FORBIDDEN' },
  } as Response;
});

const originalFetch = global.fetch;
beforeEach(() => {
  mockFetch.mockClear();
  global.fetch = mockFetch;
  analyticsAvailable = true;
  copilotStatus = 200;
  copilotData = { executiveSummary: 'Có mặt 0 trẻ (0% chuyên cần).', attendanceRate: 0, criticalAlerts: [], actionableRecommendations: [], generatedAt: '2026-10-21T02:00:00Z' };
});
afterAll(() => { global.fetch = originalFetch; });

async function loadPage() {
  render(<EducationDashboardPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' })).toBeEnabled());
  if (analyticsAvailable) await waitFor(() => expect(screen.getByLabelText('Chọn cơ sở Tổng quan')).toHaveValue('synthetic-branch'));
}

function submittedPayload(): Record<string, unknown> {
  const call = mockFetch.mock.calls.find(([url]) => url === '/api/education/ai/copilot');
  expect(call).toBeDefined();
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
}

it('preserves observed zeroes but never dispatches briefing without its canonical supporting data', async () => {
  await loadPage();
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('186');
  expect(screen.getByTestId('metric-attendance-rate')).toHaveTextContent('0%');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
  await screen.findByText('Chưa đủ dữ liệu chuẩn về sức khỏe, học phí và yêu cầu phụ huynh để tạo điểm tin điều hành.');
  expect(mockFetch.mock.calls.some(([url]) => url === '/api/education/ai/copilot')).toBe(false);
  expect(screen.queryByText('Có mặt 0 trẻ (0% chuyên cần).')).not.toBeInTheDocument();
});

it('does not generate sample statistics when analytics failed', async () => {
  analyticsAvailable = false;
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được Tổng quan');
  expect(screen.getByTestId('metric-total-kids')).toHaveTextContent('—');
  expect(mockFetch.mock.calls.some(([url]) => url === '/api/education/ai/copilot')).toBe(false);
});

it.each(['briefing', 'compliance'])('keeps unavailable %s at zero requests even when an endpoint would reject it', async tab => {
  copilotStatus = 403;
  await loadPage();
  if (tab === 'compliance') {
    fireEvent.click(screen.getByRole('button', { name: 'Rà soát TT52' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quét an toàn & sĩ số' }));
    await screen.findByText('Chưa có dữ liệu độ tuổi và nhân sự chuẩn để kiểm tra định mức.');
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
    await screen.findByText('Chưa đủ dữ liệu chuẩn về sức khỏe, học phí và yêu cầu phụ huynh để tạo điểm tin điều hành.');
  }
  expect(mockFetch.mock.calls.some(([url]) => url === '/api/education/ai/copilot')).toBe(false);
});

it('shows authorization errors for active Q&A instead of silently ignoring them', async () => {
  copilotStatus = 403;
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Hỏi đáp BGH' }));
  fireEvent.change(screen.getByPlaceholderText(/Đặt câu hỏi điều hành/), { target: { value: 'Kiểm tra kết nối' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản chưa có quyền');
  expect(submittedPayload()).toMatchObject({ action: 'ask_copilot', question: 'Kiểm tra kết nối' });
});

it('withholds compliance without canonical ages and staffing and never claims a compliance score', async () => {
  copilotData = { verificationComplete: false, compliant: false, complianceScore: 100, inspectedClassesCount: 1, violations: [], warnings: ['Chưa có nhóm tuổi đã xác minh.'] };
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Rà soát TT52' }));
  fireEvent.click(screen.getByRole('button', { name: 'Quét an toàn & sĩ số' }));
  await screen.findByText('Chưa có dữ liệu độ tuổi và nhân sự chuẩn để kiểm tra định mức.');
  expect(mockFetch.mock.calls.some(([url]) => url === '/api/education/ai/copilot')).toBe(false);
  expect(screen.queryByText('Đạt chuẩn 100%')).not.toBeInTheDocument();
  expect(screen.queryByText('/100')).not.toBeInTheDocument();
});

it('identifies rules-based Q&A instead of presenting a model answer', async () => {
  copilotData = { answer: 'Hướng dẫn dự phòng.', source: 'preschool_ai_pack_rules' };
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Hỏi đáp BGH' }));
  fireEvent.change(screen.getByPlaceholderText(/Đặt câu hỏi điều hành/), { target: { value: 'Kiểm tra kết nối' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
  expect(await screen.findByText(/Hướng dẫn theo quy tắc \(chưa kết nối mô hình AI\)/)).toHaveTextContent('Hướng dẫn dự phòng.');
});
