/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import BellaAutoAnalyticsDashboard from '../BellaAutoAnalyticsDashboard';

const mockRpc = jest.fn(async (..._args: unknown[]) => ({ data: [], error: null }));
jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('@/components/ui/SafeResponsiveContainer', () => ({ SafeResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div> }));
jest.mock('recharts', () => Object.fromEntries([
  'AreaChart','Area','BarChart','Bar','PieChart','Pie','Cell','XAxis','YAxis','CartesianGrid','Tooltip',
].map(name => [name, ({ children }: PropsWithChildren) => <div>{children}</div>])));
jest.mock('@/components/ui/PremiumSelect', () => ({ PremiumSelect: () => null }));

const data = {
  summary: { revenue: 0, sales: 0, averageSalePrice: 0 },
  timeZone: 'UTC',
  revenueByMonth: Array.from({ length: 6 }, (_, i) => ({ month: `2026-${String(i+5).padStart(2,'0')}`, revenue: 0, sales: 0 })),
  topModels: [],
};
const originalFetch = global.fetch;
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { global.fetch = originalFetch; });

it('renders canonical revenue and never calls legacy booking sales RPCs', async () => {
  const response = { ...data, summary: { revenue: 1400000000, sales: 1, averageSalePrice: 1400000000 },
    revenueByMonth: data.revenueByMonth.map((row, i) => i === 5 ? { ...row, revenue: 1400000000, sales: 1 } : row) };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => response })) as jest.Mock;
  render(<BellaAutoAnalyticsDashboard tenantId="tenant-a" inventory={{ totalVehicles: 1, showroomCount: 0, warehouseCount: 0, allocatedCount: 0, deliveredCount: 1 }} />);
  await waitFor(() => expect(screen.getByTestId('recognized-sales-current-month')).toHaveTextContent('1.400.000.000 VNĐ'));
  expect(global.fetch).toHaveBeenCalledWith('/api/bella-auto/analytics/recognized-sales', expect.objectContaining({ cache: 'no-store' }));
  expect(mockRpc.mock.calls.map(args => args[0])).not.toEqual(expect.arrayContaining(['get_auto_revenue_by_month','get_auto_top_models']));
  expect(screen.getByTestId('recognized-sales-total')).toHaveTextContent('1.400.000.000 VNĐ');
  expect(screen.getByTestId('recognized-sales-average')).toHaveTextContent('1.400.000.000 VNĐ');
  expect(screen.queryByText('142,8')).not.toBeInTheDocument();
});

it('shows an explicit failure, not zero revenue, and retries the read', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => data });
  global.fetch = fetcher;
  render(<BellaAutoAnalyticsDashboard tenantId="tenant-a" />);
  const retry = await screen.findAllByRole('button', { name: 'Thử lại' });
  expect(screen.queryByTestId('recognized-sales-current-month')).not.toBeInTheDocument();
  expect(screen.queryByText('Chưa có dữ liệu doanh thu')).not.toBeInTheDocument();
  fireEvent.click(retry[0]);
  await waitFor(() => expect(screen.getByTestId('recognized-sales-current-month')).toHaveTextContent('0 VNĐ'));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('treats a malformed financial payload as a failure', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ...data, revenueByMonth: [{ revenue: null }] }) })) as jest.Mock;
  render(<BellaAutoAnalyticsDashboard tenantId="tenant-a" />);
  expect(await screen.findAllByRole('alert')).toHaveLength(2);
  expect(screen.queryByTestId('recognized-sales-current-month')).not.toBeInTheDocument();
});

it('inventory age is unavailable after successful RPCs', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => data })) as jest.Mock;
  render(<BellaAutoAnalyticsDashboard tenantId="tenant-a" />);
  const ageCard = (await screen.findByText('Thời gian tồn TB')).parentElement?.parentElement;
  expect(ageCard).toHaveTextContent('Chưa có dữ liệu');
  expect(ageCard).not.toHaveTextContent(/\d|ngày|%|so với tháng trước/i);
});

it('inventory age is unavailable after failed RPCs', async () => {
  mockRpc.mockRejectedValueOnce(new Error('Inventory RPC failed'));
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => data })) as jest.Mock;
  render(<BellaAutoAnalyticsDashboard tenantId="tenant-a" />);
  const ageCard = (await screen.findByText('Thời gian tồn TB')).parentElement?.parentElement;
  expect(ageCard).toHaveTextContent('Chưa có dữ liệu');
  expect(ageCard).not.toHaveTextContent(/\d|ngày|%|so với tháng trước/i);
});
