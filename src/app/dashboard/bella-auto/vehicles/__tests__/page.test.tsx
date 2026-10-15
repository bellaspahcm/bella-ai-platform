/** @jest-environment jsdom */
import { render, waitFor } from '@testing-library/react';
import VehicleInventoryPage from '../page';

jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockCurrentUser() }));
jest.mock('@/lib/supabase-client', () => ({ createClient: () => mockClient }));
jest.mock('@/platform/mobility/supabase-vehicle-contract', () => ({
  listMobilityVehicleInventory: (...args: unknown[]) => mockInventory(...args),
}));
jest.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => mockError(...args), success: jest.fn() } }));

const mockCurrentUser = jest.fn(), mockInventory = jest.fn(), mockError = jest.fn();
const mockClient = { auth: {} };
const tenantId = 'c9fc2d19-dcf1-4b7e-9939-bae396b14904';
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser.mockResolvedValue({ tenant_id: tenantId });
  mockInventory.mockResolvedValue([]);
});

it('reads Mobility inventory using canonical server authority, not a development tenant fallback', async () => {
  render(<VehicleInventoryPage />);
  await waitFor(() => expect(mockInventory).toHaveBeenCalledWith(mockClient, { tenantId }));
});

it('does not read inventory when current identity has no tenant', async () => {
  mockCurrentUser.mockResolvedValue(null);
  render(<VehicleInventoryPage />);
  await waitFor(() => expect(mockError).toHaveBeenCalledWith('Không thể tải danh sách xe'));
  expect(mockInventory).not.toHaveBeenCalled();
});

it('does not fall back to another tenant when canonical identity lookup fails', async () => {
  mockCurrentUser.mockRejectedValue(new Error('Identity unavailable'));
  render(<VehicleInventoryPage />);
  await waitFor(() => expect(mockError).toHaveBeenCalledWith('Không thể tải danh sách xe'));
  expect(mockInventory).not.toHaveBeenCalled();
});
