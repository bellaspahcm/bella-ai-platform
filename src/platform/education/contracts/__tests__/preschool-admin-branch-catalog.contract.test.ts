import { describe, expect, it, jest } from '@jest/globals';
import { PreschoolAdminBranchCatalogContractImpl } from '../preschool-admin-branch-catalog.contract.impl';

const branchId = '11111111-1111-4111-8111-111111111111';

function createClient(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const rpc = jest.fn(() => Promise.resolve(result));
  return { client: { rpc }, rpc };
}

describe('PreschoolAdminBranchCatalogContractImpl', () => {
  it('reads the branch catalog through a zero-argument current-caller RPC', async () => {
    const { client, rpc } = createClient({ data: [{ id: branchId, name: 'Cơ sở chính' }], error: null });
    const contract = new PreschoolAdminBranchCatalogContractImpl(client as never);

    await expect(contract.listCurrentPreschoolAdminBranches()).resolves.toEqual([
      { id: branchId, name: 'Cơ sở chính' },
    ]);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_admin_branch_catalog');
  });

  it('accepts an empty authorized branch catalog', async () => {
    const { client } = createClient({ data: [], error: null });
    const contract = new PreschoolAdminBranchCatalogContractImpl(client as never);

    await expect(contract.listCurrentPreschoolAdminBranches()).resolves.toEqual([]);
  });

  it('fails closed when the caller is denied', async () => {
    const { client } = createClient({ data: null, error: { code: '42501', message: 'denied' } });
    const contract = new PreschoolAdminBranchCatalogContractImpl(client as never);

    await expect(contract.listCurrentPreschoolAdminBranches())
      .rejects.toThrow('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
  });

  it('rejects malformed or duplicate branch identities', async () => {
    const malformed = createClient({ data: [{ id: branchId, name: 'North', tenant_id: 'extra' }], error: null });
    const duplicate = createClient({ data: [
      { id: branchId, name: 'North' }, { id: branchId, name: 'South' },
    ], error: null });

    await expect(new PreschoolAdminBranchCatalogContractImpl(malformed.client as never)
      .listCurrentPreschoolAdminBranches()).rejects.toThrow('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
    await expect(new PreschoolAdminBranchCatalogContractImpl(duplicate.client as never)
      .listCurrentPreschoolAdminBranches()).rejects.toThrow('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
  });
});
