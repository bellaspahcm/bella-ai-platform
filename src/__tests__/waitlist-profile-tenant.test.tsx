/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WaitlistContent } from '@/app/dashboard/waitlist/components/WaitlistContent';
import { WaitlistDetailContent } from '@/app/dashboard/waitlist/[entryId]/components/WaitlistDetailContent';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/user-context', () => ({ useUser: () => mockUserContext }));
jest.mock('@/core/hooks/useTenantContext', () => ({ useTenantContext: () => ({ tenantId: 'dev-tenant' }) }));
jest.mock('@/hooks/usePageRefresh', () => ({ usePageRefresh: jest.fn() }));
jest.mock('@/hooks/useModuleVocabulary', () => ({ useModuleVocabulary: () => getModuleVocabulary('babycare') }));
jest.mock('@/app/dashboard/waitlist/components/WaitlistStatsPanel', () => ({
  WaitlistStatsPanel: ({ tenantId }: { tenantId: string }) => <div data-testid="stats-tenant">{tenantId}</div>,
}));
jest.mock('@/app/dashboard/waitlist/components/WaitlistFilters', () => ({
  WaitlistFilters: ({ tenantId }: { tenantId: string }) => <div data-testid="filters-tenant">{tenantId}</div>,
}));
jest.mock('@/app/dashboard/waitlist/components/WaitlistTable', () => ({ WaitlistTable: () => <div>Danh sách đã tải</div> }));
jest.mock('@/app/dashboard/waitlist/components/AddToWaitlistModal', () => ({
  AddToWaitlistModal: ({ isOpen, tenantId }: { isOpen: boolean; tenantId: string }) => isOpen ? <div data-testid="add-tenant">{tenantId}</div> : null,
}));

const mockUserContext: { user: { tenant_id: string | null } | null; isLoading: boolean } = {
  user: { tenant_id: 'authenticated-babycare' }, isLoading: false,
};
const mockFetch = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  mockUserContext.user = { tenant_id: 'authenticated-babycare' };
  mockUserContext.isLoading = false;
  mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ entries: [], total: 0 }) });
  global.fetch = mockFetch;
});
afterAll(() => { global.fetch = originalFetch; });

it.each(['authenticated-babycare', 'authenticated-beauty'])('uses profile tenant %s instead of presentation fallback for all consumers', async tenantId => {
  mockUserContext.user = { tenant_id: tenantId };
  render(<WaitlistContent />);
  await screen.findByText('Danh sách đã tải');
  const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
  expect(url.searchParams.get('tenant_id')).toBe(tenantId);
  expect(screen.getByTestId('stats-tenant')).toHaveTextContent(tenantId);
  expect(screen.getByTestId('filters-tenant')).toHaveTextContent(tenantId);
  fireEvent.click(screen.getByRole('button', { name: /^Thêm/ }));
  expect(screen.getByTestId('add-tenant')).toHaveTextContent(tenantId);
});

it('waits for the authenticated profile without sending a fallback request', async () => {
  mockUserContext.user = null;
  mockUserContext.isLoading = true;
  const { rerender } = render(<WaitlistContent />);
  expect(screen.getByText('Đang tải danh sách chờ...')).toBeInTheDocument();
  expect(mockFetch).not.toHaveBeenCalled();
  mockUserContext.user = { tenant_id: 'authenticated-babycare' };
  mockUserContext.isLoading = false;
  rerender(<WaitlistContent />);
  await screen.findByText('Danh sách đã tải');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not request data when the loaded profile has no tenant', async () => {
  mockUserContext.user = { tenant_id: null };
  render(<WaitlistContent />);
  await screen.findByText('Không tìm thấy thông tin chi nhánh');
  expect(mockFetch).not.toHaveBeenCalled();
});

it('waits for a profile before reading a detail and its notifications', async () => {
  mockUserContext.user = null;
  mockUserContext.isLoading = true;
  const { rerender } = render(<WaitlistDetailContent entryId="entry-1" />);
  expect(mockFetch).not.toHaveBeenCalled();
  mockUserContext.user = { tenant_id: 'authenticated-babycare' };
  mockUserContext.isLoading = false;
  rerender(<WaitlistDetailContent entryId="entry-1" />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/waitlist/entry-1/notifications'));
  expect(mockFetch).toHaveBeenCalledWith('/api/waitlist/entry-1');
});

it('does not leave detail loading indefinitely when no tenant is assigned', async () => {
  mockUserContext.user = { tenant_id: null };
  render(<WaitlistDetailContent entryId="entry-1" />);
  await screen.findByText('Không tìm thấy thông tin chi nhánh');
  expect(mockFetch).not.toHaveBeenCalled();
});

it('keeps a server tenant rejection visible instead of masking it', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden: Tenant mismatch' }) });
    render(<WaitlistContent />);
    await waitFor(() => expect(screen.getByText('Forbidden: Tenant mismatch')).toBeInTheDocument());
    expect(screen.queryByText('Danh sách đã tải')).not.toBeInTheDocument();
  } finally { spy.mockRestore(); }
});
