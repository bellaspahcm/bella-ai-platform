/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomerApprovalClient from './customer-approval-client';

const TOKEN = ['00000000', '0000', '4000', '8000', '000000000002'].join('-');
const APPROVAL_ID = '123e4567-e89b-42d3-a456-426614174050';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Interior customer approval page', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) globalThis.fetch = originalFetch;
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('submits the customer quotation decision through the bearer API and removes the token from the address bar', async () => {
    window.history.replaceState({}, '', `/interior/customer-approval/${APPROVAL_ID}?token=${TOKEN}`);
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return mockResponse({ success: true, data: { approvalId: APPROVAL_ID, status: 'approved' } });
      return mockResponse({
        success: true,
        data: {
          approvalId: APPROVAL_ID,
          subjectType: 'quotation',
          status: 'pending',
          expiresAt: '2026-12-01T00:00:00.000Z',
          canRespond: true,
          clientRepresentative: 'Khách hàng Bella',
          subject: {
            quotationNumber: 'QT-001', versionNumber: 2, grandTotal: 1200000,
            subtotal: 1100000, discountAmount: 0, vatPercent: 8, vatAmount: 88000,
            paymentTerms: 'Theo hợp đồng', items: [],
          },
        },
      });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(<CustomerApprovalClient approvalId={APPROVAL_ID} />);
    expect(await screen.findByText('QT-001 · phiên bản 2')).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Chấp thuận hồ sơ' }));

    expect(await screen.findByText('Đã ghi nhận chấp thuận.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/interior/customer-approvals/${APPROVAL_ID}?token=${TOKEN}`);
    const submittedForm = fetchMock.mock.calls[1][1]?.body;
    expect(submittedForm).toBeInstanceOf(FormData);
    expect((submittedForm as FormData).get('decision')).toBe('approved');
    expect((submittedForm as FormData).has('signature')).toBe(false);
  });

  it('does not submit contract approval without a real signature file', async () => {
    window.history.replaceState({}, '', `/interior/customer-approval/${APPROVAL_ID}?token=${TOKEN}`);
    const fetchMock = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      data: {
        approvalId: APPROVAL_ID,
        subjectType: 'contract',
        status: 'pending',
        expiresAt: '2026-12-01T00:00:00.000Z',
        canRespond: true,
        clientRepresentative: 'Khách hàng Bella',
        subject: {
          contractNumber: 'CTR-001', title: 'Hợp đồng thi công', baselineContractValue: 1000000,
          quotationVersionNumber: 2, boqVersionNumber: 3, designVersionNumber: 4,
          paymentTerms: 'Theo phụ lục', milestones: [],
        },
      },
    }));
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(<CustomerApprovalClient approvalId={APPROVAL_ID} />);
    expect(await screen.findByText('CTR-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Chấp thuận & gửi chữ ký' }));

    expect(await screen.findByText('Hợp đồng cần tệp PDF/PNG/JPEG có chữ ký thật của khách hàng.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
