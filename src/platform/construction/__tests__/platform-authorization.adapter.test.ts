import {
  ConstructionAuthorizationError,
  ConstructionAuthorizationUnavailableError,
} from '../domain/errors';
import { PlatformConstructionAuthorizationAdapter } from '../platform-authorization.adapter';
import type { PlatformActionAuthorizationContract } from '@/platform/authorization';

describe('PlatformConstructionAuthorizationAdapter', () => {
  const params = {
    actor: { userId: 'user-a', tenantId: 'tenant-a', roles: [], orgUnitIds: ['org-a'] },
    tenantId: 'tenant-a',
    orgUnitId: 'org-a',
    permission: 'construction:site:write' as const,
  };

  it('allows only a Platform resolver ALLOW', async () => {
    const authorization: PlatformActionAuthorizationContract = {
      authorize: jest.fn().mockResolvedValue({ status: 'ALLOW', reason: 'DIRECT_GRANT' }),
    };
    const adapter = new PlatformConstructionAuthorizationAdapter(authorization);

    await expect(adapter.ensureAllowed(params)).resolves.toBeUndefined();
    expect(authorization.authorize).toHaveBeenCalledWith({
      permissionId: 'construction:site:write',
      tenantId: 'tenant-a',
      orgUnitId: 'org-a',
    });
  });

  it('keeps a business DENY distinct from resolver unavailability', async () => {
    const denied: PlatformActionAuthorizationContract = {
      authorize: jest.fn().mockResolvedValue({ status: 'DENY', reason: 'NO_GRANT' }),
    };
    const unavailable: PlatformActionAuthorizationContract = {
      authorize: jest.fn().mockResolvedValue({ status: 'UNAVAILABLE', reason: 'ORG_UNIT_UNAVAILABLE' }),
    };

    await expect(new PlatformConstructionAuthorizationAdapter(denied).ensureAllowed(params))
      .rejects.toBeInstanceOf(ConstructionAuthorizationError);
    await expect(new PlatformConstructionAuthorizationAdapter(unavailable).ensureAllowed(params))
      .rejects.toBeInstanceOf(ConstructionAuthorizationUnavailableError);
  });
});
