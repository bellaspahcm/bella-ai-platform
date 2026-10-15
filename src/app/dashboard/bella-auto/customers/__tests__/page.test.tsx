/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Customer360Page from '../page';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const customer = { id: 'customer-a', name_mother: 'Customer A', phone: '0900000000', address: null };
const other = { ...customer, id: 'customer-b', name_mother: 'Customer B' };
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const originalFetch = global.fetch;
let mockFetch: jest.Mock;
beforeEach(() => {
  mockFetch = jest.fn(async (url: string) => response(url.includes('/profile')
    ? { customer, profile: null, ownedVehicles: [] }
    : { customers: [customer, other], count: 2 }));
  global.fetch = mockFetch;
});
afterEach(() => { global.fetch = originalFetch; });

it('blocks preference submission while a new customer list is loading', async () => {
  render(<Customer360Page />);
  const input = await screen.findByPlaceholderText('BMW, Porsche, VinFast');
  await waitFor(() => expect(input).toBeEnabled());
  mockFetch.mockImplementation(() => new Promise<Response>(() => undefined));
  fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc SĐT...'), { target: { value: 'Customer B' } });
  await waitFor(() => expect(input).toBeDisabled());
  fireEvent.submit(input.closest('form')!);
  expect(mockFetch.mock.calls.every(([, options]) => !options || options.method !== 'PUT')).toBe(true);
});

it('does not expose a previous customer form while the next profile is loading', async () => {
  render(<Customer360Page />);
  await screen.findByPlaceholderText('BMW, Porsche, VinFast');
  let resolveProfile!: (value: Response) => void;
  mockFetch.mockImplementation(() => new Promise<Response>(resolve => { resolveProfile = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: /Customer B/ }));
  expect(screen.queryByPlaceholderText('BMW, Porsche, VinFast')).not.toBeInTheDocument();
  await act(async () => resolveProfile(response({ customer: other, profile: null, ownedVehicles: [] })));
  await waitFor(() => expect(screen.getByPlaceholderText('BMW, Porsche, VinFast')).toBeEnabled());
  expect(screen.getByRole('heading', { name: 'Customer B' })).toBeInTheDocument();
});
