/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import StudentFinance from '../StudentFinance';

describe('StudentFinance Component', () => {
  const studentId = '1825098e-52f4-4e9b-ac11-521610c741c7';
  const studentName = 'Nguyễn Đăng Khôi';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<StudentFinance studentId={studentId} studentName={studentName} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText(/Đang tải dữ liệu học phí/i)).toBeInTheDocument();
  });

  it('renders error state and retry button', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch;
    render(<StudentFinance studentId={studentId} studentName={studentName} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu tài chính/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no invoices', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        totalDue: 0,
        totalPaid: 0,
        outstanding: 0,
        invoices: [],
      }),
    }) as unknown as typeof fetch;

    render(<StudentFinance studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có hóa đơn học phí nào/i)).toBeInTheDocument();
    });
  });

  it('renders real finance data and invoice cards when present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        totalDue: 8000000,
        totalPaid: 8000000,
        outstanding: 0,
        invoices: [
          {
            id: 'inv-1',
            invoice_number: 'INV-202610-5698',
            gross_amount: 8500000,
            discount_amount: 500000,
            net_amount: 8000000,
            paid_amount: 8000000,
            outstanding_amount: 0,
            invoice_status: 'ISSUED',
            settlement_status: 'PAID',
            due_date: '2026-10-15',
            issued_at: '2026-10-01T00:00:00Z',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<StudentFinance studentId={studentId} studentName={studentName} />);

    await waitFor(() => {
      expect(screen.getByText('INV-202610-5698')).toBeInTheDocument();
      expect(screen.getByText(/PAID/i)).toBeInTheDocument();
    });
  });
});
