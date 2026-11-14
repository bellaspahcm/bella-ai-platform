/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommercialWorkflowModal from './commercial-workflow-modal';

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000';
const BOQ_ID = '123e4567-e89b-42d3-a456-426614174040';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Commercial workflow UI handoff', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) globalThis.fetch = originalFetch;
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('creates a quote from the selected approved BOQ through the existing API without client-supplied totals', async () => {
    let created = false;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url === '/api/interior/quotations') {
        created = true;
        return mockResponse({ success: true, data: { quotationId: '123e4567-e89b-42d3-a456-426614174030' } }, 201);
      }
      if (url.startsWith('/api/interior/boq?')) {
        return mockResponse({ success: true, data: { boqs: [{
          id: BOQ_ID, boqNumber: 'BOQ-001', versionNumber: 4, status: 'approved',
          designRevisionId: '123e4567-e89b-42d3-a456-426614174060', totalClientPrice: 1250000,
        }] } });
      }
      if (url.startsWith('/api/interior/quotations?')) {
        return mockResponse({ success: true, data: created ? [{
          id: '123e4567-e89b-42d3-a456-426614174030', boqId: BOQ_ID, boqVersionNumber: 4,
          quotationNumber: 'QT-001', versionNumber: 1, status: 'draft', grandTotal: 1350000,
        }] : [] });
      }
      return mockResponse({ success: false, error: 'UNEXPECTED_REQUEST' }, 500);
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const onChanged = jest.fn();

    render(
      <CommercialWorkflowModal
        projectId={PROJECT_ID}
        permissions={{ createQuotationAvailable: true, requestCustomerApprovalAvailable: true, createContractAvailable: true }}
        onClose={jest.fn()}
        onChanged={onChanged}
      />,
    );

    const select = await screen.findByRole('combobox', { name: 'BOQ đã duyệt' });
    fireEvent.change(select, { target: { value: BOQ_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp báo giá' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input) === '/api/interior/quotations' && init?.method === 'POST');
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ projectId: PROJECT_ID, boqId: BOQ_ID });
    expect(JSON.parse(String(createCall?.[1]?.body))).not.toHaveProperty('grandTotal');
  });

  it('does not expose a write action when the permission resolver has not granted it', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return url.startsWith('/api/interior/boq?')
        ? mockResponse({ success: true, data: { boqs: [] } })
        : mockResponse({ success: true, data: [] });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    render(
      <CommercialWorkflowModal
        projectId={PROJECT_ID}
        permissions={{ createQuotationAvailable: false, requestCustomerApprovalAvailable: false, createContractAvailable: false }}
        onClose={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Tạo bản nháp báo giá' })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
