/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';

const branchId = '00000000-0000-4000-8000-000000000003';
const partyId = '00000000-0000-4000-8000-000000000004';
const courseId = '00000000-0000-4000-8000-000000000006';
jest.mock('next/navigation', () => ({ useParams: () => ({ id: partyId }) }));
const TeacherDetailPage = (require('../[id]/page') as typeof import('../[id]/page')).default;
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const fetchMock = jest.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async url => {
    if (url === '/api/education/branches') return response({ success: true,
      branches: [{ id: branchId, name: 'Chi nhánh thật' }] });
    if (typeof url === 'string' && url.startsWith('/api/education/teachers?')) {
      const params = new URL(url, 'http://localhost').searchParams;
      if (params.get('view') === 'classes') return response({ success: true, branchId,
        classes: [{ id: courseId, code: 'MAM-01', title: 'Lớp thật' }] });
      if (params.get('view') === 'candidates') return response({ success: true, page: {
        branchId, onDate: params.get('onDate'), confirmedOnly: true, offset: 0, limit: 50,
        filteredTotal: 1, nextOffset: null, parties: [{ partyId, displayName: 'Người thật',
          confirmations: [{ confirmationId: partyId, validFrom: '2026-10-25', validTo: null,
            confirmedBy: partyId, confirmedAt: '2026-10-25T00:00:00Z' }] }],
      } });
      return response({ success: true, page: { branchId, courseId,
        onDate: params.get('onDate'), offset: 0, limit: 50, total: 1, nextOffset: null,
        assignments: [{ assignmentId: partyId, tenantId: partyId, branchId, courseId,
          teacherPartyId: partyId, teacherName: 'Người thật', role: 'lead_teacher',
          academicYear: '2026-2027', effectiveStartDate: '2026-10-25', effectiveEndDate: null,
          status: 'active', effectiveOnDate: true, eligibility: 'confirmed', confirmationId: partyId }],
      } });
    }
    throw new Error('Unexpected request');
  });
});
afterEach(() => cleanup());

it('restores the 360 layout with confirmed identity and real class only', async () => {
  render(<TeacherDetailPage />);
  expect(await screen.findByRole('heading', { name: 'Người thật', level: 1 })).toBeVisible();
  expect(screen.getByText('Lớp thật')).toBeVisible();
  expect(screen.getByText('Tuân Thủ Hồ Sơ & Pháp Lý')).toBeVisible();
  expect(screen.getAllByText('Chưa có dữ liệu')).toHaveLength(3);
  expect(screen.queryByText('Cô Nguyễn Thị Mai')).toBeNull();
});
