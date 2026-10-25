/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeacherWorkspace from '../TeacherWorkspace';

const branchId = '00000000-0000-4000-8000-000000000003';
const teacherPartyId = '00000000-0000-4000-8000-000000000004';
const operationKey = '00000000-0000-4000-8000-000000000005';
const courseId = '00000000-0000-4000-8000-000000000006';
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300,
  status, json: async () => body }) as Response;
const fetchMock = jest.fn<typeof fetch>();
let confirmed: boolean;
let assigned: boolean;
beforeEach(() => {
  confirmed = false;
  assigned = false;
  fetchMock.mockReset();
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => operationKey });
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/api/education/branches') return response({ success: true, branches: [{ id: branchId, name: 'Chi nhánh thật' }] });
    if (typeof url === 'string' && url.startsWith('/api/education/teachers?')) {
      const params = new URL(url, 'http://localhost').searchParams;
      if (params.get('view') === 'classes') return response({ success: true, branchId,
        classes: [{ id: courseId, code: 'MAM-01', title: 'Lớp thật' }] });
      if (params.get('view') === 'candidates') return response({ success: true, page: {
        tenantId: '00000000-0000-4000-8000-000000000001', branchId,
        onDate: params.get('onDate'), confirmedOnly: params.get('confirmedOnly') === 'true', offset: 0, limit: 20,
        filteredTotal: params.get('confirmedOnly') === 'true' && !confirmed ? 0 : 1,
        nextOffset: null, parties: params.get('confirmedOnly') === 'true' && !confirmed ? [] : [{ partyId: teacherPartyId,
          displayName: 'Người thật', confirmations: confirmed ? [{ confirmationId: operationKey,
            validFrom: '2026-10-25', validTo: null, confirmedBy: '00000000-0000-4000-8000-000000000002',
            confirmedAt: '2026-10-25T00:00:00Z' }] : [] }],
      } });
      return response({ success: true, page: { branchId, courseId,
        onDate: params.get('onDate'), offset: 0, limit: 20, total: assigned ? 1 : 0,
        nextOffset: null, assignments: assigned ? [{ assignmentId: operationKey,
          teacherName: 'Người thật', role: 'lead_teacher', academicYear: '2026-2027', status: 'active',
          effectiveStartDate: '2026-10-25', effectiveEndDate: null, eligibility: 'confirmed' }] : [] } });
    }
    if (url === '/api/education/teachers' && options?.method === 'POST') {
      const payload = JSON.parse(options.body as string) as Record<string, unknown>;
      if (payload.action === 'assign') {
        assigned = true;
        return response({ success: true, assignment: { assignmentId: operationKey } }, 201);
      }
      confirmed = true;
      return response({ success: true, confirmation: { id: operationKey } }, 201);
    }
    throw new Error('Unexpected request');
  });
});
afterEach(() => cleanup());

it('opens a real-data workspace without sample teacher rows', async () => {
  render(<TeacherWorkspace />);
  await screen.findByRole('option', { name: 'Chi nhánh thật' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Chi nhánh' }), { target: { value: branchId } });
  expect(await screen.findByText('Chưa có giáo viên được xác nhận tại chi nhánh vào ngày này.')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chỉ đã xác nhận' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm người' }), { target: { value: 'Người' } });
  expect(await screen.findByText('Người thật')).toBeVisible();
  expect(await screen.findByRole('option', { name: 'Lớp thật (MAM-01)' })).toBeVisible();
  expect(screen.queryByText('Chưa mở trong MVP Preschool')).toBeNull();
  expect(screen.queryByText('Giáo viên mẫu')).toBeNull();
});

it('submits explicit confirmation and reads the persisted list again', async () => {
  render(<TeacherWorkspace />);
  await screen.findByRole('option', { name: 'Chi nhánh thật' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Chi nhánh' }), { target: { value: branchId } });
  await screen.findByText('Chưa có giáo viên được xác nhận tại chi nhánh vào ngày này.');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chỉ đã xác nhận' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm người' }), { target: { value: 'Người' } });
  await screen.findByText('Người thật');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận giáo viên' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Căn cứ xác nhận là giáo viên tại chi nhánh' }),
    { target: { value: 'Đã đối chiếu hồ sơ nhân sự' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và lưu' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0] === '/api/education/teachers')).toBe(true));
  const write = fetchMock.mock.calls.find(call => call[0] === '/api/education/teachers');
  expect(JSON.parse(write?.[1]?.body as string)).toMatchObject({ action: 'confirm', branchId,
    teacherPartyId, operationKey, attestation: 'Đã đối chiếu hồ sơ nhân sự' });
  await screen.findByText('Đã xác nhận');
});

it('submits an explicit year, role and dates for a confirmed person and reads the roster again', async () => {
  confirmed = true;
  render(<TeacherWorkspace />);
  await screen.findByRole('option', { name: 'Chi nhánh thật' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Chi nhánh' }), { target: { value: branchId } });
  await screen.findByText('Đã xác nhận');
  await screen.findByRole('option', { name: 'Lớp thật (MAM-01)' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Lớp' }), { target: { value: courseId } });
  fireEvent.click(screen.getByRole('button', { name: 'Phân công vào lớp' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Năm học' }), { target: { value: '2026-2027' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và lưu' }));
  await screen.findByText('1 phân công được lưu');
  const write = fetchMock.mock.calls.find(call => call[0] === '/api/education/teachers');
  expect(JSON.parse(write?.[1]?.body as string)).toMatchObject({ action: 'assign', branchId,
    courseId, confirmationId: operationKey, teacherPartyId, academicYear: '2026-2027',
    role: 'lead_teacher', operationKey });
});
