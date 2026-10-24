/** @jest-environment jsdom */
import { beforeEach, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { readSchoolRegistry as Reader } from '../registry-reader';
const read = jest.fn<typeof Reader>();
jest.mock('../registry-reader', () => ({ ...jest.requireActual<typeof import('../registry-reader')>('../registry-reader'), readSchoolRegistry: read }));
const { RegistrySessionError } = require('../registry-reader') as typeof import('../registry-reader');
const Page = (require('../page') as typeof import('../page')).default;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const course = (n: number, status: 'active' | 'pending') => ({ id: id(n + 100), courseId: id(n), courseCode: `SYN-C${n}`, courseTitle: `Synthetic Class ${n}`, branchId: id(99), branchName: 'Synthetic branch', status });
beforeEach(() => {
  cleanup(); read.mockReset();
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, json: async () => ({ success: false }) } as Response);
  read.mockResolvedValue({ totals: { students: 2, active: 1, pending: 2 }, students: [
    { id: id(10), partyId: id(20), tenantId: id(1), studentCode: 'SYN-1', name: 'Synthetic Multi', gender: null, dob: null, enrollments: [course(2, 'active'), course(3, 'pending')] },
    { id: id(11), partyId: id(21), tenantId: id(1), studentCode: 'SYN-2', name: 'Synthetic Pending', gender: 'female', dob: null, enrollments: [course(3, 'pending')] },
  ] });
});
it('preserves current table and offers each canonical class for a child enrolled in multiple classes', async () => {
  render(<Page />); await screen.findByRole('link', { name: 'Synthetic Multi' });
  const option = screen.getByRole('option', { name: 'Synthetic Class 2' });
  fireEvent.change(option.parentElement as HTMLSelectElement, { target: { value: 'Synthetic Class 2' } });
  expect(screen.getByRole('link', { name: 'Synthetic Multi' })).toBeTruthy(); expect(screen.queryByRole('link', { name: 'Synthetic Pending' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Synthetic Class 2 · Synthetic Class 3' })).toBeNull();
});
it('shows both enrollment badges and unavailable health data without inventing guardian or gender', async () => {
  render(<Page />); const child = await screen.findByRole('link', { name: 'Synthetic Multi' });
  const row = child.closest('tr'); expect(row?.textContent).toContain('Đang học'); expect(row?.textContent).toContain('Chờ nhập học');
  expect(row?.textContent).toContain('Chưa ghi nhận'); expect(row?.textContent).toContain('Chưa được cung cấp trong danh sách');
  expect(screen.getByText('Chưa xác minh')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lưu ý y tế (chưa xác minh)' })).toBeDisabled();
  expect(screen.queryByText('+ 12 trẻ so với năm trước')).toBeNull();
});
it('renders denial as unavailable instead of no matching children or a truthful zero', async () => {
  read.mockRejectedValue(Error('denied')); render(<Page />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Chưa thể xác định tổng hồ sơ'));
  expect(screen.queryByText('Không tìm thấy học sinh nào phù hợp')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Synthetic Multi' })).toBeNull();
});
it('offers the existing real-login path for an unauthenticated session without fabricating a child list', async () => {
  read.mockRejectedValue(new RegistrySessionError('REGISTRY_UNAUTHENTICATED')); render(<Page />);
  const login = await screen.findByRole('link', { name: 'Đăng nhập tài khoản thật' });
  expect(login.getAttribute('href')).toBe('/login?reset=true&next=%2Fdashboard%2Feducation%2Fenrollments');
  expect(screen.getByRole('alert').textContent).toContain('REGISTRY_UNAUTHENTICATED');
  expect(screen.queryByRole('link', { name: 'Synthetic Multi' })).toBeNull();
});
