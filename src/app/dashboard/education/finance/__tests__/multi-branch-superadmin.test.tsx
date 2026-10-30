/** @jest-environment jsdom */

import React from 'react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { FinanceStateResponse, FinanceCommandResponse } from '../page';
import type { FinanceBranchBreakdown, FinanceBranchOption } from '@/products/bella-education/finance/services/preschool-finance-branch.contract';

let mockUserRole = 'super_admin';
jest.mock('@/lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'super-admin-user', tenant_id: 'tenant-preschool', role: mockUserRole, full_name: 'Hiệu Trưởng Ánh Dương' },
    product: { productKey: 'bella_preschool' },
    isLoading: false,
  }),
}));

const FinancePage = jest.requireActual<typeof import('../page')>('../page').default;

const branch1: FinanceBranchOption = { id: 'branch-1', name: 'Cơ sở Quận 1', code: 'CS01' };
const branch2: FinanceBranchOption = { id: 'branch-2', name: 'Cơ sở Quận 7', code: 'CS02' };

const breakdowns: FinanceBranchBreakdown[] = [
  {
    branchId: 'branch-1',
    branchName: 'Cơ sở Quận 1',
    branchCode: 'CS01',
    studentCount: 45,
    invoiceCount: 45,
    totalGross: 450000000,
    totalPaid: 400000000,
    totalDebt: 50000000,
    collectionRate: 88.9,
    overdueCount: 2,
  },
  {
    branchId: 'branch-2',
    branchName: 'Cơ sở Quận 7',
    branchCode: 'CS02',
    studentCount: 30,
    invoiceCount: 30,
    totalGross: 300000000,
    totalPaid: 290000000,
    totalDebt: 10000000,
    collectionRate: 96.7,
    overdueCount: 0,
  },
];

const mockState = (overrides: Partial<FinanceStateResponse> = {}): FinanceStateResponse => ({
  success: true,
  isSuperAdmin: mockUserRole === 'super_admin',
  actorRole: mockUserRole,
  branches: [branch1, branch2],
  selectedBranchId: 'ALL',
  actorId: 'test-user',
  tenantId: 'tenant-preschool',
  students: [],
  billingPeriods: [],
  invoices: [],
  payments: [],
  exceptions: [],
  servicePeriodCompletions: [],
  branchBreakdowns: breakdowns,
  ...overrides,
});

const response = (payload: FinanceStateResponse | FinanceCommandResponse, ok = true): Pick<Response, 'ok' | 'json'> => ({
  ok,
  json: async () => payload,
});

describe('Preschool Finance Multi-Branch & Super-Admin Scoping', () => {
  beforeEach(() => {
    mockUserRole = 'super_admin';
    localStorage.clear();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: async (_name: string, run: () => Promise<unknown>) => run() },
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('branchId=ALL')) {
          return Promise.resolve(response(mockState({ selectedBranchId: 'ALL' })));
        }
        if (url.includes('branchId=branch-1')) {
          return Promise.resolve(response(mockState({ selectedBranchId: 'branch-1', branchBreakdowns: undefined })));
        }
        return Promise.resolve(response(mockState({ selectedBranchId: null, branchBreakdowns: undefined })));
      },
    });
  });

  it('renders Super-Admin option to view all branches and displays consolidated breakdown table', async () => {
    render(<FinancePage />);

    const picker = await screen.findByRole('combobox', { name: 'Cơ sở tài chính' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);

    // Super-admin sees option for all branches
    const allBranchesBtn = within(screen.getByRole('listbox')).getByRole('button', {
      name: '🌐 Tất cả chi nhánh (Tổng hợp toàn chuỗi)',
    });
    expect(allBranchesBtn).toBeInTheDocument();

    fireEvent.click(allBranchesBtn);

    // Verify consolidated multi-branch header & table render
    expect(await screen.findByText('Báo Cáo Tổng Hợp Dữ Liệu Toàn Chuỗi Mầm Non')).toBeInTheDocument();
    expect(screen.getByText('Bảng Phân Tích & Đối Soát Từng Cơ Sở')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở Quận 1')).toBeInTheDocument();
    expect(screen.getByText('Cơ sở Quận 7')).toBeInTheDocument();
    expect(screen.getByText('88.9%')).toBeInTheDocument();
    expect(screen.getByText('96.7%')).toBeInTheDocument();
  });

  it('allows Super-Admin to drill down into a specific branch from the consolidated table', async () => {
    render(<FinancePage />);

    const picker = await screen.findByRole('combobox', { name: 'Cơ sở tài chính' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);

    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('button', {
        name: '🌐 Tất cả chi nhánh (Tổng hợp toàn chuỗi)',
      })
    );

    expect(await screen.findByText('Báo Cáo Tổng Hợp Dữ Liệu Toàn Chuỗi Mầm Non')).toBeInTheDocument();

    // Click "Xem chi tiết" for Cơ sở Quận 1
    const viewButtons = screen.getAllByRole('button', { name: /Xem chi tiết/ });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(viewButtons[0]);

    // Should switch to branch-1 and show button to return to all branches
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xem tổng hợp tất cả chi nhánh/ })).toBeInTheDocument();
    });
  });

  it('restricts branch admin from viewing consolidated all branches option', async () => {
    mockUserRole = 'admin';
    render(<FinancePage />);

    const picker = await screen.findByRole('combobox', { name: 'Cơ sở tài chính' });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);

    // Branch admin should NOT see ALL branches option
    expect(
      within(screen.getByRole('listbox')).queryByRole('button', {
        name: '🌐 Tất cả chi nhánh (Tổng hợp toàn chuỗi)',
      })
    ).not.toBeInTheDocument();

    // Branch admin sees individual branches
    expect(within(screen.getByRole('listbox')).getByRole('button', { name: branch1.name })).toBeInTheDocument();
  });
});
