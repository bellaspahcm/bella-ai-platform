/** @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import InteriorDashboardPage from './page';

jest.mock('@/lib/user-context', () => ({ useUser: () => ({ user: null }) }));
jest.mock('@/components/interior/InteriorUserBar', () => () => null);

describe('Interior dashboard data availability', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('shows an error instead of sample projects and financial values when the API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false } as Response);
    render(<InteriorDashboardPage />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Không thể tải dữ liệu tổng quan'));
    expect(screen.queryByText('Villa Sunrise Renovation')).not.toBeInTheDocument();
    expect(screen.queryByText('9,28 tỷ đ')).not.toBeInTheDocument();
  });
});

