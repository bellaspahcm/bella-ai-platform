/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateBookingModal } from '../CreateBookingModal';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
const customer = { id: 'customer-1', name_mother: 'Catalog customer', phone: '0900000000', address: null };
let failedCatalog: string | undefined;

beforeEach(() => {
  failedCatalog = undefined;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const key = url.split('/').pop()?.split('?')[0];
    const data: Record<string, unknown> = {
      search: { customers: [customer] },
      brands: { brands: [{ id: 'brand-1', name: 'Canonical brand' }] },
      models: { models: [{ id: 'model-1', name: 'Canonical model' }] },
      variants: { variants: [{ id: 'variant-1', name: 'Canonical variant', year: 2026 }] },
      available: { vehicles: [] },
    };
    return { ok: key !== failedCatalog, json: async () => data[key || ''] };
  });
  global.fetch = fetchMock;
});
afterAll(() => { global.fetch = originalFetch; });

async function vehicleStep() {
  render(<CreateBookingModal isOpen onClose={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại hoặc tên...'), { target: { value: 'Catalog' } });
  fireEvent.click(await screen.findByRole('button', { name: /Catalog customer/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp Theo' }));
}

it('uses variant year and requires an explicitly entered agreed price, without catalog pricing', async () => {
  await vehicleStep();
  fireEvent.click(await screen.findByRole('button', { name: 'Canonical brand' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Canonical model' }));
  fireEvent.click(await screen.findByRole('button', { name: /Canonical variant/ }));
  expect(screen.getByText('Năm 2026')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Trắng', exact: true }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/available?')));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp Theo' }));
  const price = screen.getByPlaceholderText('850,000,000');
  expect(price).toHaveValue('');
  expect(screen.queryByText(/Giá niêm yết/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tiếp Theo' })).toBeDisabled();
  fireEvent.change(price, { target: { value: '1500000000' } });
  expect(price).toHaveValue('1.500.000.000');
  expect(screen.getByRole('button', { name: 'Tiếp Theo' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp Theo' }));
  expect(screen.getByText('Canonical model', { exact: true })).toBeVisible();
  expect(screen.getByText('Canonical variant (2026)', { exact: true })).toBeVisible();
});

it.each([
  ['brands', 'Không tải được hãng xe.'],
  ['models', 'Không tải được dòng xe.'],
  ['variants', 'Không tải được phiên bản xe.'],
])('shows a visible error when the %s API fails', async (catalog, message) => {
  failedCatalog = catalog;
  await vehicleStep();
  if (catalog !== 'brands') fireEvent.click(await screen.findByRole('button', { name: 'Canonical brand' }));
  if (catalog === 'variants') fireEvent.click(await screen.findByRole('button', { name: 'Canonical model' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('button', { name: 'Tiếp Theo' })).toBeDisabled();
});
