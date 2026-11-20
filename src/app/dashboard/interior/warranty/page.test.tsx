/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WarrantyDashboardPage from './page';
import { InteriorWarrantyAnalyticsService } from '@/products/bella-interior/services/interior-warranty-analytics.service';

let projectId: string | null = null;
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(projectId ? { projectId } : ''),
}));

describe('Warranty project entry', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    projectId = null;
    if (originalFetch) globalThis.fetch = originalFetch;
    else Reflect.deleteProperty(globalThis, 'fetch');
    jest.restoreAllMocks();
  });

  it('asks for a project instead of showing a load failure or fetching ambiguous data', () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    render(<WarrantyDashboardPage />);

    expect(screen.getByRole('heading', { name: 'Chọn dự án để xem bảo hành' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem danh sách dự án' })).toHaveAttribute('href', '/dashboard/interior/projects');
    expect(screen.queryByText('Không thể tải dữ liệu bảo hành.')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the existing analytics output as sample data for a selected project', async () => {
    projectId = '123e4567-e89b-42d3-a456-426614174000';
    const overview = await InteriorWarrantyAnalyticsService.getWarrantyOverview('test-tenant', projectId);
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { overview } }),
    });
    globalThis.fetch = fetchMock;
    render(<WarrantyDashboardPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/interior/warranty/analytics?projectId=${projectId}`,
      { cache: 'no-store' },
    ));
    expect(await screen.findByText(/hiện là dữ liệu mẫu/)).toBeInTheDocument();
  });
});
