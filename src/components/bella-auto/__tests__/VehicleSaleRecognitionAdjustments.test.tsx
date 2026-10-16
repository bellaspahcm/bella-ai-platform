/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VehicleSaleRecognitionAdjustments } from '../VehicleSaleRecognitionAdjustments';

jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
const id = '6090d1e8-b144-4a51-9464-fd83c95959e0', tenant = 'd4f7567f-787f-46e9-86d8-206c00457b43';
const document = { bucket: 'automove-sale-documents', path: `${tenant}/proof.pdf`, sha256: 'a'.repeat(64) };
const intent = { action: 'price', revision: 'a'.repeat(64), delta: -20, reason: 'Confirmed correction', document, confirmed: true };
const initial = { recognitionId: id, revision: intent.revision, salePrice: 100, costBasis: 50, reversed: false, policyId: 'original', policyVersion: '1.0.0', entries: [] };
const changed = jest.fn(), reversed = jest.fn(), fetchMock = jest.fn(), originalFetch = global.fetch;
const storageKey = `automove-adjustment:${id}`;
const response = (value: unknown, ok = true, status = 200) => ({ ok, status, json: async () => value });
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); global.fetch = fetchMock; fetchMock.mockResolvedValue(response({ result: initial })); });
afterAll(() => { global.fetch = originalFetch; });
function mount() { return render(<VehicleSaleRecognitionAdjustments bookingId={id} tenantId={tenant} onChanged={changed} onReversed={reversed} />); }
it('shows permission/history errors instead of zero or a missing recognition', async () => {
  fetchMock.mockResolvedValue(response({ code: 'ADJUSTMENT_UNKNOWN_HISTORY' }, false, 409)); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Không xác minh'); expect(screen.queryByTestId('adjusted-sale')).not.toBeInTheDocument();
});
it('preserves the exact pending intent across a lost response and reconciles the persisted retry', async () => {
  sessionStorage.setItem(storageKey, JSON.stringify({ key: id, data: intent })); let posts = 0;
  fetchMock.mockImplementation(async (_url, options) => {
    if (!options?.method) return response({ result: initial }); if (++posts === 1) throw Error('Lost response');
    const entry = { id, type: 'sale_revenue_adjusted', saleDelta: -20, costDelta: 0, reason: intent.reason, document, periodId: id, createdBy: id, createdAt: '2026-10-16T00:00:00Z' };
    return response({ result: { duplicate: true, entry, state: { ...initial, salePrice: 80, entries: [entry] } } });
  });
  mount(); const retry = await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu điều chỉnh' });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry); await screen.findByRole('alert');
  expect(JSON.parse(sessionStorage.getItem(storageKey) || '{}')).toEqual({ key: id, data: intent }); expect(changed).not.toHaveBeenCalled();
  fireEvent.click(retry); await waitFor(() => expect(screen.getByTestId('adjusted-sale')).toHaveTextContent('80 VND'));
  const calls = fetchMock.mock.calls.filter(call => call[1]?.method === 'POST'); expect(calls).toHaveLength(2); expect(calls[0][1]).toEqual(calls[1][1]);
  expect(changed).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(storageKey)).toBeNull();
});
it('does not acknowledge malformed success or automatically trigger reversal', async () => {
  sessionStorage.setItem(storageKey, JSON.stringify({ key: id, data: intent }));
  fetchMock.mockImplementation(async (_url, options) => options?.method ? response({ result: {} }) : response({ result: initial }));
  mount(); const retry = await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu điều chỉnh' });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry); await screen.findByRole('alert');
  expect(sessionStorage.getItem(storageKey)).not.toBeNull(); expect(changed).not.toHaveBeenCalled(); expect(reversed).not.toHaveBeenCalledWith(true);
});
