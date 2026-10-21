/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EducationDashboardPage from '../page';
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/dashboard-client-context', () => ({ clearDashboardClientContextCache: jest.fn() }));

const snapshot: Partial<ExecutiveDashboardDTO> = {
  enrollment: {
    totalEnrolledStudents: 186, totalClassrooms: 1, totalTeachers: 2,
    classroomUtilization: [{ classId: 'synthetic-class', className: 'Lớp Lá', currentEnrollment: 186, maxCapacity: 200, utilizationRate: 93 }],
  },
  attendance: { todayPresentCount: 0, todayAbsentCount: 0, todayLateCount: 0, presentVsEnrolledRate: 0 },
  commandCenter: { unmarkedAttendanceCount: 156, leaveRequestsCount: 0, overdueInvoicesCount: 0, healthIncidentsCount: 0, parentRequestsCount: 0, totalParentsCount: 0 },
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
      ? { success: analyticsAvailable, dashboard: analyticsAvailable ? snapshot : undefined }
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
}

function submittedPayload(): Record<string, unknown> {
  const call = mockFetch.mock.calls.find(([url]) => url === '/api/education/ai/copilot');
  expect(call).toBeDefined();
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
}

it('sends measured zero, recorded absence and unmarked values from the dashboard', async () => {
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
  await screen.findByText('Có mặt 0 trẻ (0% chuyên cần).');
  expect(submittedPayload()).toMatchObject({ action: 'executive_briefing', totalStudents: 186, presentCount: 0, absentCount: 0, unmarkedAttendanceCount: 156 });
});

it('does not generate sample statistics when analytics failed', async () => {
  analyticsAvailable = false;
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được số liệu tổng quan');
  expect(mockFetch.mock.calls.some(([url]) => url === '/api/education/ai/copilot')).toBe(false);
});

it.each(['briefing', 'compliance', 'qa'])('shows authorization errors for %s instead of silently ignoring them', async tab => {
  copilotStatus = 403;
  await loadPage();
  if (tab === 'compliance') {
    fireEvent.click(screen.getByRole('button', { name: 'Rà soát TT52' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quét an toàn & sĩ số' }));
  } else if (tab === 'qa') {
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi đáp BGH' }));
    fireEvent.change(screen.getByPlaceholderText(/Đặt câu hỏi điều hành/), { target: { value: 'Kiểm tra kết nối' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Tạo điểm tin đầu ngày' }));
  }
  expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản chưa có quyền');
});

it('sends actual classes without inferred ages or fabricated teachers and shows incomplete evidence', async () => {
  copilotData = { verificationComplete: false, compliant: false, complianceScore: 100, inspectedClassesCount: 1, violations: [], warnings: ['Chưa có nhóm tuổi đã xác minh.'] };
  await loadPage();
  fireEvent.click(screen.getByRole('button', { name: 'Rà soát TT52' }));
  fireEvent.click(screen.getByRole('button', { name: 'Quét an toàn & sĩ số' }));
  await screen.findByText('Chưa đủ dữ liệu để kết luận');
  expect(submittedPayload().classRosterStats).toEqual([{ className: 'Lớp Lá', studentCount: 186 }]);
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
