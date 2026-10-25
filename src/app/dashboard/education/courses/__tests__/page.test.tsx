/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import CoursesPage from '../page';

const mockFetch = jest.fn<typeof fetch>();
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const course = { id: 'synthetic-course', tenantId: 'synthetic-tenant', courseCode: 'SYN-01', title: 'Lớp thử nghiệm', status: 'active' };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

beforeEach(() => {
  mockFetch.mockReset();
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: mockFetch });
});
afterEach(() => {
  cleanup();
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
  else Reflect.deleteProperty(globalThis, 'fetch');
});

it('giữ giao diện lớp học mới và chỉ đọc từ catalog canonical', async () => {
  mockFetch.mockResolvedValue(response({ success: true, tenantId: 'synthetic-tenant', courses: [course] }));
  render(<CoursesPage />);
  expect(await screen.findByRole('heading', { name: 'Lớp thử nghiệm' })).toBeVisible();
  expect(screen.getByText('Hiển thị 1 / 1 lớp')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mở Lớp Học Mới' })).toBeDisabled();
  expect(screen.queryByText(/Nguyễn Thị Mai|Phòng 103|25 bé/)).toBeNull();
  expect(mockFetch).toHaveBeenCalledWith('/api/education/courses/catalog', expect.objectContaining({ cache: 'no-store' }));
  expect(mockFetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('chỉ hiển thị fallback an toàn khi máy chủ xác nhận sản phẩm không hỗ trợ', async () => {
  mockFetch.mockResolvedValue(response({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' }, 403));
  render(<CoursesPage />);
  expect(await screen.findByText('Quản lý khóa học & Lớp học')).toBeVisible();
  expect(screen.queryByText(/Lớp Mầm A2|Nguyễn Thị Mai|Phòng 103/)).toBeNull();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('không chuyển sang fallback khi truy cập bị từ chối hoặc dữ liệu sai tenant', async () => {
  mockFetch.mockResolvedValueOnce(response({ success: false, error: 'ACCESS_DENIED' }, 403));
  const denied = render(<CoursesPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách lớp');
  expect(screen.queryByText('Quản lý khóa học & Lớp học')).toBeNull();
  denied.unmount();

  mockFetch.mockResolvedValueOnce(response({ success: true, tenantId: 'synthetic-tenant', courses: [{ ...course, tenantId: 'foreign' }] }));
  render(<CoursesPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách lớp');
  expect(screen.queryByRole('heading', { name: 'Lớp thử nghiệm' })).toBeNull();
});
