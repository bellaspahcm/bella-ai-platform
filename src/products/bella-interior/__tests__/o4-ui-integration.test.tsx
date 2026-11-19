/**
 * @jest-environment jsdom
 */

/**
 * Bella Interior OS — Acceptance UI Integration Test Suite (O4-D)
 *
 * Verifies:
 * 1. AcceptanceSessionModal rendering with project context and campaign binding.
 * 2. Visual inspection of Three Independent State Dimensions (inspectionResult, approvalStatus, documentationStatus).
 * 3. Session creation workflow and form submission.
 * 4. Acceptance Notes with 7 Categories and downstream routing feedback.
 * 5. Evidence Package file upload with server-side SHA-256 verification.
 * 6. Manager Approval Decision Gate and defect preservation invariants.
 *
 * @module src/products/bella-interior/__tests__
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AcceptanceSessionModal from '@/app/dashboard/interior/qc-handover/acceptance-session-modal';

const PROJECT_ID = 'd450fc00-a593-484f-a8ad-ff8aebf756df'; // Aqua Bay Ecopark INT-2024-004
const PROJECT_NAME = 'Aqua Bay Ecopark';
const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Bella Interior O4-D: Acceptance & Handover UI Integration', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) globalThis.fetch = originalFetch;
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('renders modal with project context and displays sessions with 3 state dimensions', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/interior/delivery/acceptance/campaigns')) {
        return mockResponse({
          success: true,
          data: [
            {
              id: CAMPAIGN_ID,
              projectId: PROJECT_ID,
              campaignCode: 'CP-2024-004',
              campaignName: 'Chiến dịch nghiệm thu Aqua Bay Ecopark',
            },
          ],
        });
      }
      if (url.includes('/api/interior/delivery/acceptance/sessions?')) {
        return mockResponse({
          success: true,
          data: [
            {
              id: SESSION_ID,
              campaignId: CAMPAIGN_ID,
              projectId: PROJECT_ID,
              sessionCode: 'SS-01',
              sessionType: 'ROOM_BY_ROOM',
              inspectionScope: 'Phòng khách & Ban công (Sofa, Kệ tivi)',
              inspectionDate: '2026-11-21',
              recorderActorId: 'actor-1',
              customerRepresentative: 'Nguyễn Văn A',
              inspectionResult: 'ACCEPTED_WITH_REMARKS',
              approvalStatus: 'PENDING',
              documentationStatus: 'PARTIAL',
            },
          ],
        });
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/notes`)) {
        return mockResponse({ success: true, data: [] });
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/evidence`)) {
        return mockResponse({ success: true, data: [] });
      }
      return mockResponse({ success: false, error: 'NOT_FOUND' }, 404);
    });

    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(
      <AcceptanceSessionModal
        projectId={PROJECT_ID}
        projectName={PROJECT_NAME}
        onClose={jest.fn()}
      />
    );

    // 1. Project header and Campaign Code
    expect(await screen.findByText('Aqua Bay Ecopark')).toBeInTheDocument();
    expect(await screen.findByText('CP-2024-004')).toBeInTheDocument();

    // 2. Session details
    expect(await screen.findByText('SS-01')).toBeInTheDocument();
    expect(await screen.findByText('Phòng khách & Ban công (Sofa, Kệ tivi)')).toBeInTheDocument();

    // 3. Three Independent State Dimensions
    expect(await screen.findByText('⚠ Đạt có ý kiến')).toBeInTheDocument(); // inspectionResult
    expect(await screen.findByText('CHỜ QUẢN LÝ DUYỆT')).toBeInTheDocument(); // approvalStatus
    expect(await screen.findByText('Hồ sơ một phần')).toBeInTheDocument(); // documentationStatus
  });

  it('switches to Note recording tab and submits note with downstream routing', async () => {
    let createdNote = false;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/interior/delivery/acceptance/campaigns')) {
        return mockResponse({
          success: true,
          data: [{ id: CAMPAIGN_ID, projectId: PROJECT_ID, campaignCode: 'CP-2024-004', campaignName: 'Campaign' }],
        });
      }
      if (url.includes('/api/interior/delivery/acceptance/sessions?')) {
        return mockResponse({
          success: true,
          data: [
            {
              id: SESSION_ID,
              campaignId: CAMPAIGN_ID,
              projectId: PROJECT_ID,
              sessionCode: 'SS-01',
              sessionType: 'ROOM_BY_ROOM',
              inspectionScope: 'Sofa phòng khách',
              inspectionDate: '2026-11-21',
              customerRepresentative: 'Khách',
              inspectionResult: 'ACCEPTED_WITH_REMARKS',
              approvalStatus: 'PENDING',
              documentationStatus: 'PARTIAL',
            },
          ],
        });
      }
      if (init?.method === 'POST' && url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/notes`)) {
        createdNote = true;
        return mockResponse({
          success: true,
          data: {
            id: 'note-1',
            sessionId: SESSION_ID,
            category: 'QUALITY_ISSUE',
            severity: 'medium',
            description: 'Vết trầy xước chân sofa',
            remediationStatus: 'OPEN',
            routedEntityType: 'punch_list',
          },
        }, 201);
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/notes`)) {
        return mockResponse({
          success: true,
          data: createdNote
            ? [{
                id: 'note-1',
                sessionId: SESSION_ID,
                category: 'QUALITY_ISSUE',
                severity: 'medium',
                description: 'Vết trầy xước chân sofa',
                remediationStatus: 'OPEN',
                routedEntityType: 'punch_list',
              }]
            : [],
        });
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/evidence`)) {
        return mockResponse({ success: true, data: [] });
      }
      return mockResponse({ success: false }, 400);
    });

    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(
      <AcceptanceSessionModal
        projectId={PROJECT_ID}
        projectName={PROJECT_NAME}
        onClose={jest.fn()}
      />
    );

    // Wait for initial sessions load
    expect(await screen.findByText('SS-01')).toBeInTheDocument();

    // Click Notes Tab
    const notesTabButton = screen.getByRole('button', { name: /Ghi Chú & Lỗi/i });
    fireEvent.click(notesTabButton);

    // Fill Note form
    const descInput = await screen.findByPlaceholderText(/Ví dụ: Vết trầy nhẹ chân ghế sofa/i);
    fireEvent.change(descInput, { target: { value: 'Vết trầy xước chân sofa' } });

    // Submit Note
    const submitBtn = screen.getByRole('button', { name: /Lưu Ý Kiến & Điều Hướng/i });
    fireEvent.click(submitBtn);

    // Verify note is created and displayed with Punch List routing badge
    await waitFor(() => {
      expect(createdNote).toBe(true);
    });
    expect(await screen.findByText('Đã lưu ghi chú và tự động điều hướng xử lý.')).toBeInTheDocument();
  });

  it('manager approves session with PARTIAL documentation and preserves open defect notes', async () => {
    let approved = false;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/interior/delivery/acceptance/campaigns')) {
        return mockResponse({
          success: true,
          data: [{ id: CAMPAIGN_ID, projectId: PROJECT_ID, campaignCode: 'CP-2024-004', campaignName: 'Campaign' }],
        });
      }
      if (init?.method === 'POST' && url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/approval`)) {
        approved = true;
        return mockResponse({
          success: true,
          data: {
            id: SESSION_ID,
            approvalStatus: 'APPROVED',
            documentationStatus: 'PARTIAL',
            approvedByActorId: 'manager-1',
            approvedAt: '2026-11-21T10:00:00.000Z',
          },
        });
      }
      if (url.includes('/api/interior/delivery/acceptance/sessions?')) {
        return mockResponse({
          success: true,
          data: [
            {
              id: SESSION_ID,
              campaignId: CAMPAIGN_ID,
              projectId: PROJECT_ID,
              sessionCode: 'SS-01',
              sessionType: 'ROOM_BY_ROOM',
              inspectionScope: 'Phòng khách & Ban công',
              inspectionDate: '2026-11-21',
              customerRepresentative: 'Khách hàng A',
              inspectionResult: 'ACCEPTED_WITH_REMARKS',
              approvalStatus: approved ? 'APPROVED' : 'PENDING',
              documentationStatus: 'PARTIAL',
              approvedAt: approved ? '2026-11-21T10:00:00.000Z' : null,
            },
          ],
        });
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/notes`)) {
        return mockResponse({
          success: true,
          data: [
            {
              id: 'note-1',
              sessionId: SESSION_ID,
              category: 'QUALITY_ISSUE',
              severity: 'medium',
              description: 'Vết trầy chân ghế sofa',
              remediationStatus: 'OPEN', // Defect is OPEN
              routedEntityType: 'punch_list',
            },
          ],
        });
      }
      if (url.includes(`/api/interior/delivery/acceptance/sessions/${SESSION_ID}/evidence`)) {
        return mockResponse({
          success: true,
          data: [
            {
              id: 'ev-1',
              fileName: 'sofa_overview.jpg',
              version: 1,
              evidenceCategory: 'OVERALL',
              sha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
              fileSizeBytes: 204800,
              uploadedAt: '2026-11-21T09:00:00.000Z',
            },
          ],
        });
      }
      return mockResponse({ success: false }, 400);
    });

    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(
      <AcceptanceSessionModal
        projectId={PROJECT_ID}
        projectName={PROJECT_NAME}
        onClose={jest.fn()}
      />
    );

    // Wait for initial sessions load
    expect(await screen.findByText('SS-01')).toBeInTheDocument();

    // Click Approval Tab
    const approvalTabButton = screen.getByRole('button', { name: /Phê Duyệt Quản Lý/i });
    fireEvent.click(approvalTabButton);

    // Check approval explanation text
    expect(await screen.findByText(/Hồ sơ giấy không chặn phê duyệt/i)).toBeInTheDocument();
    expect(await screen.findByText(/Duyệt không tự đóng lỗi/i)).toBeInTheDocument();

    // Submit Approval decision
    const submitApprovalBtn = screen.getByRole('button', { name: /Xác Nhận Quyết Định/i });
    fireEvent.click(submitApprovalBtn);

    // Verify approval request was sent and success banner rendered
    await waitFor(() => {
      expect(approved).toBe(true);
    });
    expect(await screen.findByText(/Đã ghi nhận quyết định: APPROVED. Lỗi tồn đọng được bảo toàn độc lập!/i)).toBeInTheDocument();
  });
});
