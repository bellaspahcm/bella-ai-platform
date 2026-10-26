/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Suspense } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClassroomLiveOverview } from '../classroom-live-data';

const mockLoadOverview = jest.fn(() => Promise.resolve(new Map<string, ClassroomLiveOverview>()));
jest.mock('../classroom-live-data', () => ({ loadClassroomOverview: mockLoadOverview }));
jest.mock('next/link', () => ({ __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
const CanonicalClassroomCatalog = require('../CanonicalClassroomCatalog').default as typeof import('../CanonicalClassroomCatalog').default;
const ClassWorkspacePage = require('../[id]/page').default as typeof import('../[id]/page').default;

const tenantId = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const branchId = '00000000-0000-4000-8000-000000000003';
const course = { id, tenantId, courseCode: 'MAM-01', title: 'Lớp kiểm chứng', status: 'active', prerequisites: [] };
const live: ClassroomLiveOverview = { id, tenantId, branchId, code: course.courseCode, name: course.title,
  teacher: 'Cô E2E (Chủ nhiệm)', teacherCount: 1, room: 'Chưa ghi nhận phòng', students: 1, maxStudents: 2,
  todayStatus: { present: 1, excused: 0, unmarked: 0 } };
const originalFetch = global.fetch;
const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  mockLoadOverview.mockResolvedValue(new Map([[id, live]]));
  global.fetch = jest.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    if (url === '/api/education/courses/catalog') return reply({ success: true, tenantId, courses: [course] });
    if (url.includes('?view=catalog')) return reply({ success: true, course });
    return reply({ success: true, registry: {
      tenantId, request: { query: '', status: 'all', courseId: id, branchId: null, offset: 0, limit: 20 },
      totals: { students: 1, active: 1, pending: 0 }, filteredTotal: 1, nextOffset: null,
      students: [{ id: '00000000-0000-4000-8000-000000000004', tenantId,
        partyId: '00000000-0000-4000-8000-000000000005', studentCode: 'E2E-01', name: 'Trẻ E2E', gender: null, dob: null,
        enrollments: [{ id: '00000000-0000-4000-8000-000000000006', courseId: id, courseCode: course.courseCode,
          courseTitle: course.title, branchId, branchName: 'Cơ sở E2E', status: 'active' }] }],
    } });
  });
});
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.clearAllMocks(); });

it('fills existing class-card slots from verified operational data and preserves the selected attendance class', async () => {
  render(<CanonicalClassroomCatalog legacy={null} />);
  expect(await screen.findByText('Giáo viên: Cô E2E (Chủ nhiệm)')).toBeVisible();
  expect(screen.getByText('1 / 2')).toBeVisible();
  expect(screen.getByText('Còn 1 chỗ')).toBeVisible();
  expect(screen.getByText('Tổng học sinh').parentElement).toHaveTextContent('1');
  expect(screen.getByText('Chỗ trống còn lại').parentElement).toHaveTextContent('1');
  expect(screen.getByText('Tỷ lệ lấp đầy').parentElement).toHaveTextContent('50%');
  expect(screen.getByRole('link', { name: 'Điểm danh', exact: true })).toHaveAttribute('href', `/dashboard/education/attendance?courseId=${id}`);
});

it('keeps capacity totals unavailable when canonical class capacity is unknown', async () => {
  mockLoadOverview.mockResolvedValue(new Map([[id, { ...live, maxStudents: null }]]));
  render(<CanonicalClassroomCatalog legacy={null} />);
  expect(await screen.findByText('Giáo viên: Cô E2E (Chủ nhiệm)')).toBeVisible();
  expect(screen.getByText('Tổng học sinh').parentElement).toHaveTextContent('1');
  expect(screen.getByText('Chỗ trống còn lại').parentElement).toHaveTextContent('Chưa được cung cấp');
  expect(screen.getByText('Tỷ lệ lấp đầy').parentElement).toHaveTextContent('Chưa được cung cấp');
  expect(screen.getByText('Sức chứa chưa xác minh')).toBeVisible();
});

it('does not attach stale metadata to a renamed catalog identity', async () => {
  mockLoadOverview.mockResolvedValue(new Map([[id, { ...live, name: 'Tên cũ' }]]));
  render(<CanonicalClassroomCatalog legacy={null} />);
  await screen.findByRole('heading', { name: course.title });
  expect(screen.queryByText(/Cô E2E/)).toBeNull();
  expect(screen.getByText('Tổng học sinh').parentElement).toHaveTextContent('Chưa được cung cấp');
});

it('shows the same child/teacher in the existing detail tabs and enables the existing assignment navigation', async () => {
  const params = Promise.resolve({ id });
  await act(async () => { render(<Suspense fallback={null}><ClassWorkspacePage params={params} /></Suspense>); await params; });
  expect(await screen.findByText('Giáo viên: Cô E2E (Chủ nhiệm)')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Danh Sách Học Sinh', exact: true }));
  expect(await screen.findByText('Trẻ E2E')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Đội Ngũ GVN', exact: true }));
  expect(screen.getByRole('button', { name: 'Phân công Giáo viên Mới' })).toBeEnabled();
});
