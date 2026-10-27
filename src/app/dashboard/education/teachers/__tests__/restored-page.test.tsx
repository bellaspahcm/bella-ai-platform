/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeachersPage from '../page';

const branchId = '00000000-0000-4000-8000-000000000003';
const partyId = '00000000-0000-4000-8000-000000000004';
const unconfirmedPartyId = '00000000-0000-4000-8000-000000000008';
const confirmationId = '00000000-0000-4000-8000-000000000005';
const courseId = '00000000-0000-4000-8000-000000000006';
const operationKey = '00000000-0000-4000-8000-000000000007';
let confirmationWritten = false;
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300,
  status, json: async () => body }) as Response;
const fetchMock = jest.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  confirmationWritten = false;
  global.fetch = fetchMock;
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => operationKey });
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/api/education/branches') return response({ success: true,
      branches: [{ id: branchId, name: 'Chi nhánh thật' }] });
    if (typeof url === 'string' && url.startsWith('/api/education/teachers?')) {
      const params = new URL(url, 'http://localhost').searchParams;
      if (params.get('view') === 'classes') return response({ success: true, branchId,
        classes: [{ id: courseId, code: 'MAM-01', title: 'Lớp thật' }] });
      if (params.get('view') === 'candidates') {
        const confirmedOnly = params.get('confirmedOnly') === 'true';
        const alreadyConfirmed = { partyId, displayName: 'Người thật', confirmations: [{ confirmationId,
          validFrom: '2026-10-25', validTo: null, confirmedBy: partyId, confirmedAt: '2026-10-25T00:00:00Z' }] };
        const newCandidate = { partyId: unconfirmedPartyId, displayName: 'Người chưa xác nhận',
          confirmations: confirmationWritten ? [{ confirmationId: '00000000-0000-4000-8000-000000000009',
            validFrom: '2026-10-27', validTo: null, confirmedBy: partyId, confirmedAt: '2026-10-27T00:00:00Z' }] : [] };
        const parties = confirmedOnly
          ? [alreadyConfirmed, ...(confirmationWritten ? [newCandidate] : [])]
          : [alreadyConfirmed, newCandidate];
        return response({ success: true, page: {
          branchId, onDate: params.get('onDate'), confirmedOnly, offset: 0, limit: 50,
          filteredTotal: parties.length, nextOffset: null, parties,
        } });
      }
      return response({ success: true, page: { branchId, courseId,
        onDate: params.get('onDate'), offset: 0, limit: 50, total: 0,
        nextOffset: null, assignments: [] } });
    }
    if (url === '/api/education/teachers' && options?.method === 'POST') {
      const payload = JSON.parse(String(options.body)) as { action?: string };
      if (payload.action === 'confirm') {
        confirmationWritten = true;
        return response({ success: true, confirmation: { id: operationKey } }, 201);
      }
      return response({ success: true, assignment: { assignmentId: operationKey } }, 201);
    }
    throw new Error('Unexpected request');
  });
});
afterEach(() => cleanup());

it('restores the original teacher cards using confirmed people, without sample facts', async () => {
  render(<TeachersPage />);
  expect(screen.getByText('Đội Ngũ Giáo Viên Mầm Non')).toBeVisible();
  expect(await screen.findByText('Người thật')).toBeVisible();
  expect(screen.getByText('Quản lý 1 giáo viên chuyên môn, phân công giảng dạy')).toBeVisible();
  expect(screen.getAllByText('Chưa phân công lớp')).toHaveLength(2);
  expect(screen.queryByText('Cô Nguyễn Thị Mai')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Phân Công Lớp' }));
  const classroom = screen.getAllByRole('combobox').find(item => item.getAttribute('name') === 'classAssigned');
  if (!classroom) throw new Error('Assignment class select not found');
  fireEvent.change(classroom, { target: { value: courseId } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác Nhận Phân Công' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0] === '/api/education/teachers')).toBe(true));
  const write = fetchMock.mock.calls.find(call => call[0] === '/api/education/teachers');
  expect(JSON.parse(write?.[1]?.body as string)).toMatchObject({ action: 'assign', branchId, courseId,
    teacherPartyId: partyId, confirmationId, operationKey, academicYear: '2026-2027' });
});

it('confirms an existing Party through the current branch-scoped API and reloads the teacher list', async () => {
  render(<TeachersPage />);
  await screen.findByText('Người thật');
  fireEvent.click(screen.getByRole('button', { name: /Thêm Giáo Viên Mới/ }));

  fireEvent.change(screen.getByPlaceholderText('Nhập tên hồ sơ đã có trong hệ thống'), {
    target: { value: 'Người chưa xác nhận' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm hồ sơ' }));
  const candidate = await screen.findByRole('button', { name: /Người chưa xác nhận/ });
  const candidateRequest = fetchMock.mock.calls.find(call => typeof call[0] === 'string'
    && call[0].includes('view=candidates') && call[0].includes('confirmedOnly=false'));
  const candidateUrl = new URL(String(candidateRequest?.[0]), 'http://localhost');
  expect(candidateUrl.searchParams.get('branchId')).toBe(branchId);
  expect(candidateUrl.searchParams.get('query')).toBe('Người chưa xác nhận');
  expect(candidateUrl.searchParams.get('confirmedOnly')).toBe('false');
  fireEvent.click(candidate);
  const confirmButton = screen.getByRole('button', { name: 'Xác Nhận Giáo Viên' });
  expect(confirmButton).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', {
    name: 'Tôi xác nhận đây là người thật đang làm giáo viên tại chi nhánh đã chọn.',
  }));
  fireEvent.click(confirmButton);

  await waitFor(() => {
    const write = fetchMock.mock.calls.find(call => call[0] === '/api/education/teachers'
      && call[1]?.method === 'POST');
    expect(JSON.parse(write?.[1]?.body as string)).toMatchObject({
      action: 'confirm', branchId, teacherPartyId: unconfirmedPartyId, operationKey,
      validFrom: expect.any(String), validTo: null,
      attestation: expect.stringContaining('xác nhận hồ sơ Party'),
    });
  });
  expect(await screen.findByText('Đã xác nhận Người chưa xác nhận là giáo viên tại chi nhánh này.')).toBeVisible();
  await waitFor(() => expect(confirmationWritten).toBe(true));
  expect(await screen.findByText('Người chưa xác nhận')).toBeVisible();
});
